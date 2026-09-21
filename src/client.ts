import { MAINNET_API_URL, SDK_VERSION } from './constants';
import { request, type QueryValue } from './request';
import type * as T from './types';
import { waitForTransfer, type WaitForTransferOptions } from './wait';

export interface BridgClientOptions {
  /**
   * API origin including the version prefix. Default {@link MAINNET_API_URL}.
   */
  baseUrl?: string;
  /**
   * Extra headers on every request.
   */
  headers?: Record<string, string>;
  /**
   * A `fetch` implementation; defaults to the global one.
   */
  fetch?: typeof fetch;
}

interface PathParams {
  signal?: AbortSignal;
}

/**
 * A client for the Bridg API. One method per endpoint; the names follow the
 * API reference at https://docs.bridg.now/api-reference/overview. No API key.
 */
export class BridgClient {
  readonly version = SDK_VERSION;
  readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BridgClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? MAINNET_API_URL;
    this.headers = options.headers ?? {};
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function')
      throw new TypeError('No fetch available: pass one in BridgClientOptions.fetch');

    this.fetchImpl = fetchImpl;
  }

  private call<R>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    init: { query?: Record<string, QueryValue>; body?: unknown; signal?: AbortSignal } = {},
  ): Promise<R> {
    return request<R>(
      { baseUrl: this.baseUrl, fetch: this.fetchImpl, headers: this.headers },
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
   */
  getQuote(body: T.QuoteRequest, opts?: PathParams): Promise<T.QuoteResponse> {
    return this.call('POST', '/bridge/quote', { body, ...opts });
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
export function createClient(options?: BridgClientOptions): BridgClient {
  return new BridgClient(options);
}
