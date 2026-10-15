import { API_KEY_HEADER, MAINNET_API_URL, SDK_VERSION } from './constants';
import { BrdgError } from './errors';
import { request, type QueryValue } from './request';
import { resolveRetry, type ResolvedRetry, type RetryOptions } from './retry';
import type * as T from './types';
import { waitForTransfer, type WaitForTransferOptions } from './wait';

export interface BrdgClientOptions {
  /**
   * API origin including the version prefix. Default {@link MAINNET_API_URL}.
   */
  baseUrl?: string;
  /**
   * Partner API key, sent as `x-brdg-api-key` on every request. For server
   * integrators: with it, the API's per-IP rate limit applies to the `userIp`
   * in each request body instead of your server's address, under a
   * partner-wide ceiling. Keep it server-side; never ship it to a browser.
   */
  apiKey?: string;
  /**
   * Extra headers on every request.
   */
  headers?: Record<string, string>;
  /**
   * Retry transient failures with exponential backoff and full jitter,
   * honouring `Retry-After`. `true` for the defaults. GETs retry on `429`,
   * `5xx` and network failures; POSTs only on `429 rate_limited`, where the
   * API did nothing. Off by default.
   */
  retry?: boolean | RetryOptions;
  /**
   * A `fetch` implementation; defaults to the global one.
   */
  fetch?: typeof fetch;
}

interface PathParams {
  signal?: AbortSignal;
}

/**
 * The API's referral code rule, applied after trimming and lower-casing: 3 to 15 of a-z, 0-9 and
 * `-`, no leading or trailing hyphen, and no `--` run.
 */
const REFERRAL_CODE = /^[a-z0-9](?:[a-z0-9-]{1,13}[a-z0-9])$/;

function normalizeReferralCode(code: string): string | null {
  const normalized = code.trim().toLowerCase();
  return REFERRAL_CODE.test(normalized) && !normalized.includes('--') ? normalized : null;
}

/**
 * The body with `referralCode` normalized, or a thrown `invalid_referral_code` before any request.
 * The API would silently ignore a malformed code and charge the full fee; failing here tells the
 * integrator instead. The rejected input is never echoed into the message.
 */
function withReferralCode<B extends { referralCode?: string }>(body: B, endpoint: string): B {
  if (body.referralCode === undefined) return body;
  const referralCode = normalizeReferralCode(body.referralCode);
  if (referralCode === null)
    throw new BrdgError(endpoint, 400, {
      code: 'invalid_referral_code',
      message:
        'referralCode must be 3 to 15 characters of a-z, 0-9 and single hyphens, starting and ending with a letter or digit',
    });
  return { ...body, referralCode };
}

/**
 * A client for the BRDG API. One method per endpoint; the names follow the
 * API reference at https://docs.brdg.now/api-reference/overview. An API key
 * is optional (`apiKey`), for server integrators.
 */
export class BrdgClient {
  readonly version = SDK_VERSION;
  readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;
  private readonly retry: ResolvedRetry | null;

  constructor(options: BrdgClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? MAINNET_API_URL;
    this.headers = {
      ...options.headers,
      ...(options.apiKey === undefined ? {} : { [API_KEY_HEADER]: options.apiKey }),
    };
    this.retry = resolveRetry(options.retry);
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function')
      throw new TypeError('No fetch available: pass one in BrdgClientOptions.fetch');

    this.fetchImpl = fetchImpl;
  }

  private call<R>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    init: { query?: Record<string, QueryValue>; body?: unknown; signal?: AbortSignal } = {},
  ): Promise<R> {
    return request<R>(
      { baseUrl: this.baseUrl, fetch: this.fetchImpl, headers: this.headers, retry: this.retry },
      { method, path, ...init },
    );
  }

  // Markets

  /**
   * Every chain a transfer can start from, with how many venues accept it.
   */
  getSourceChains(opts?: PathParams): Promise<T.SourceChainsResponse> {
    return this.call('GET', '/bridge/source-chains', opts);
  }

  /**
   * Which venues serve a corridor, and with which assets.
   */
  getRoutes(query: T.RoutesQuery, opts?: PathParams): Promise<T.RoutesResponse> {
    return this.call('GET', '/bridge/routes', { query, ...opts });
  }

  /**
   * The venue registry: switches, health and capabilities.
   */
  getVenues(opts?: PathParams): Promise<T.VenuesResponse> {
    return this.call('GET', '/bridge/venues', opts);
  }

  // Quote and execute

  /**
   * Price a transfer across every venue that serves it. The response carries
   * `best`, the `bestByPrice` and `bestByTime` row ids, and the full table.
   * A `referralCode` is trimmed and lower-cased; a malformed one throws
   * `invalid_referral_code` before any request.
   */
  async getQuote(body: T.QuoteRequest, opts?: PathParams): Promise<T.QuoteResponse> {
    const checked = withReferralCode(body, 'POST /bridge/quote');
    return this.call('POST', '/bridge/quote', { body: checked, ...opts });
  }

  /**
   * Turn a decision into the unsigned steps a wallet signs. Pass `quoteId` to
   * build a row other than `best`.
   */
  buildTransfer(body: T.BuildRequest, opts?: PathParams): Promise<T.BuildResponse> {
    return this.call('POST', '/bridge/build', { body, ...opts });
  }

  /**
   * Hand back the signed transaction, or the hash of one the wallet already
   * sent.
   */
  submitTransfer(
    transferId: string,
    body: T.SubmitRequest,
    opts?: PathParams,
  ): Promise<T.SubmitResponse> {
    return this.call('POST', `/bridge/transfers/${encodeURIComponent(transferId)}/submit`, {
      body,
      ...opts,
    });
  }

  // Fast fill

  /**
   * Price a fast fill: only venues whose solver fills the destination at once
   * compete, ranked by what the user receives. Relay and Across are gasless (the
   * build ends in a message to sign); Mayan Swift is sent by the user and is
   * offered only when `sender` holds the source-chain gas. `referralCode` is
   * checked as on {@link getQuote}.
   */
  async getFastFillQuote(
    body: T.FastFillQuoteRequest,
    opts?: PathParams,
  ): Promise<T.FastFillQuoteResponse> {
    const checked = withReferralCode(body, 'POST /fastfill/quote');
    return this.call('POST', '/fastfill/quote', { body: checked, ...opts });
  }

  /**
   * Build the winning fast fill. A gasless venue's last step is
   * `{ vm: 'sign', scheme: 'eip712' }`, submitted with
   * {@link submitFastFillSignature}; any transaction step (a Permit2 approve, a
   * Mayan order) goes through {@link submitTransfer}.
   */
  buildFastFill(body: T.FastFillBuildRequest, opts?: PathParams): Promise<T.FastFillBuildResponse> {
    return this.call('POST', '/fastfill/build', { body, ...opts });
  }

  /**
   * Hand a fast fill's EIP-712 signature to the venue's relayer. Safe to repeat
   * with the same signature: it is never sent twice.
   */
  submitFastFillSignature(
    transferId: string,
    body: T.FastFillSubmitRequest,
    opts?: PathParams,
  ): Promise<T.FastFillSubmitResponse> {
    return this.call('POST', `/fastfill/transfers/${encodeURIComponent(transferId)}/submit`, {
      body,
      ...opts,
    });
  }

  // Referrals

  /**
   * Whether a referral code exists. The code is trimmed and lower-cased; a
   * malformed one answers `{ valid: false, reason: 'invalid' }` without a
   * request, exactly as the API would.
   */
  resolveReferral(code: string, opts?: PathParams): Promise<T.ReferralResolution> {
    const normalized = normalizeReferralCode(code);
    if (normalized === null) return Promise.resolve({ valid: false, reason: 'invalid' });
    // `leaderboard` is reserved, and as a path segment it would hit the leaderboard instead.
    if (normalized === 'leaderboard') return Promise.resolve({ valid: false, reason: 'not_found' });
    return this.call('GET', `/referrals/${encodeURIComponent(normalized)}`, opts);
  }

  /**
   * Referral codes ranked by points, then by the earliest claimed. `limit` is
   * 1 to 100, default 25. Refreshed by the API about every 30 seconds.
   */
  getReferralLeaderboard(
    query: T.ReferralLeaderboardQuery = {},
    opts?: PathParams,
  ): Promise<T.ReferralLeaderboard> {
    return this.call('GET', '/referrals/leaderboard', { query, ...opts });
  }

  /**
   * Read one transfer. Open by id.
   */
  getTransfer(transferId: string, opts?: PathParams): Promise<T.Transfer> {
    return this.call('GET', `/bridge/transfers/${encodeURIComponent(transferId)}`, opts);
  }

  /**
   * Poll a transfer until it is terminal: COMPLETED, PARTIAL, REFUNDED, FAILED
   * or ABANDONED.
   */
  waitForTransfer(transferId: string, options?: WaitForTransferOptions): Promise<T.Transfer> {
    return waitForTransfer(
      () => this.getTransfer(transferId, { signal: options?.signal }),
      transferId,
      options,
    );
  }
}

/** Create a client. `createClient()` with no options targets production. */
export function createClient(options?: BrdgClientOptions): BrdgClient {
  return new BrdgClient(options);
}
