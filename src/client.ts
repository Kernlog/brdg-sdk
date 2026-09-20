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
   * A session token from {@link BridgClient.verifySignature}, for the routes
   * that need one.
   */
  token?: string;
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
 * A client for the Bridg API. Every method is one endpoint; the names follow
 * the API reference at https://docs.bridg.now/api-reference/overview.
 *
 * Quote, build, submit and track need no token. Sessions are only for listing
 * your own orders and managing your profile.
 */
export class BridgClient {
  readonly version = SDK_VERSION;
  readonly baseUrl: string;
  private token: string | undefined;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BridgClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? MAINNET_API_URL;
    this.token = options.token;
    this.headers = options.headers ?? {};
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function')
      throw new TypeError('No fetch available: pass one in BridgClientOptions.fetch');

    this.fetchImpl = fetchImpl;
  }

  /**
   * Attach or clear the session token used on authenticated routes.
   */
  setToken(token: string | undefined): void {
    this.token = token;
  }

  private call<R>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    init: { query?: Record<string, QueryValue>; body?: unknown; signal?: AbortSignal } = {},
  ): Promise<R> {
    return request<R>(
      { baseUrl: this.baseUrl, fetch: this.fetchImpl, headers: this.headers, token: this.token },
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

  /**
   * Build the destination-chain step that finishes a transfer in NEEDS_ACTION.
   */
  buildRedeem(transferId: string, opts?: PathParams): Promise<T.RedeemResponse> {
    return this.call('POST', `/bridge/transfers/${encodeURIComponent(transferId)}/redeem`, opts);
  }

  /**
   * Hand back the signed redeem step.
   */
  submitRedeem(
    transferId: string,
    body: T.RedeemSubmitRequest,
    opts?: PathParams,
  ): Promise<T.RedeemSubmitResponse> {
    return this.call('POST', `/bridge/transfers/${encodeURIComponent(transferId)}/redeem/submit`, {
      body,
      ...opts,
    });
  }

  // Large orders

  /**
   * Record which large-order plan the user took instead of the single route.
   */
  acceptPlan(body: T.AcceptPlanRequest, opts?: PathParams): Promise<T.AcceptPlanResponse> {
    return this.call('POST', '/bridge/plan/accept', { body, ...opts });
  }

  /**
   * Start executing an accepted split plan. `next` is the build for leg one.
   */
  startSplit(body: T.SplitStartRequest, opts?: PathParams): Promise<T.SplitGroup> {
    return this.call('POST', '/bridge/split/start', { body, ...opts });
  }

  /**
   * Once the previous leg is terminal, decide and build the next one.
   */
  nextSplitLeg(body: T.SplitNextRequest, opts?: PathParams): Promise<T.SplitGroup> {
    return this.call('POST', '/bridge/split/next', { body, ...opts });
  }

  /**
   * Read one split order and its legs.
   */
  getSplitGroup(groupId: string, opts?: PathParams): Promise<T.SplitGroup> {
    return this.call('GET', `/bridge/split/groups/${encodeURIComponent(groupId)}`, opts);
  }

  // Hyperliquid

  /**
   * Hand back the signed permit that makes a HyperCore deposit gasless.
   */
  submitPermit(
    transferId: string,
    body: T.PermitRequest,
    opts?: PathParams,
  ): Promise<T.PermitResponse> {
    return this.call('POST', `/bridge/transfers/${encodeURIComponent(transferId)}/permit`, {
      body,
      ...opts,
    });
  }

  /**
   * Hand back the signed transfer that moves a HyperCore credit into spot.
   */
  submitSpotTransfer(
    transferId: string,
    body: T.SpotTransferRequest,
    opts?: PathParams,
  ): Promise<T.SpotTransferResponse> {
    return this.call('POST', `/bridge/transfers/${encodeURIComponent(transferId)}/spot-transfer`, {
      body,
      ...opts,
    });
  }

  // Sessions and orders

  /**
   * Request a sign-in message for a wallet. Sign it verbatim and pass it to
   * {@link verifySignature}.
   */
  requestNonce(body: T.NonceRequest, opts?: PathParams): Promise<T.NonceResponse> {
    return this.call('POST', '/auth/nonce', { body, ...opts });
  }

  /**
   * Verify a signed message and mint a session. The token is kept on the
   * client.
   */
  async verifySignature(body: T.VerifyRequest, opts?: PathParams): Promise<T.VerifyResponse> {
    const session = await this.call<T.VerifyResponse>('POST', '/auth/verify', { body, ...opts });
    if (typeof (session as { token?: unknown }).token === 'string')
      this.token = (session as { token: string }).token;

    return session;
  }

  /**
   * The signed-in user.
   */
  getSession(opts?: PathParams): Promise<T.Session> {
    return this.call('GET', '/auth/session', opts);
  }

  /**
   * Revoke the current session and forget its token.
   */
  async logout(opts?: PathParams): Promise<void> {
    await this.call<unknown>('POST', '/auth/logout', opts);
    this.token = undefined;
  }

  /**
   * The caller's own orders for one of their wallets. Session required.
   */
  listOrders(query: T.OrdersQuery, opts?: PathParams): Promise<T.OrdersResponse> {
    return this.call('GET', '/bridge/orders', { query, ...opts });
  }

  /**
   * Read one order. The same record as {@link getTransfer}.
   */
  getOrder(orderId: string, opts?: PathParams): Promise<T.Transfer> {
    return this.call('GET', `/bridge/orders/${encodeURIComponent(orderId)}`, opts);
  }

  /**
   * The caller's own transfers across every linked wallet. Session required.
   */
  getHistory(query: T.HistoryQuery = {}, opts?: PathParams): Promise<T.HistoryResponse> {
    return this.call('GET', '/bridge/history', { query, ...opts });
  }

  /**
   * Set the caller's public name.
   */
  setUsername(body: T.SetUsernameRequest, opts?: PathParams): Promise<T.SetUsernameResponse> {
    return this.call('PATCH', '/auth/profile', { body, ...opts });
  }

  /**
   * Name one of the caller's wallets.
   */
  nameWallet(
    chainFamily: T.ChainFamily,
    address: string,
    body: T.WalletNicknameRequest,
    opts?: PathParams,
  ): Promise<T.WalletNicknameResponse> {
    return this.call('PATCH', `/auth/wallets/${chainFamily}/${encodeURIComponent(address)}`, {
      body,
      ...opts,
    });
  }

  /**
   * Unlink a wallet from the caller.
   */
  unlinkWallet(
    chainFamily: T.ChainFamily,
    address: string,
    opts?: PathParams,
  ): Promise<T.UnlinkWalletResponse> {
    return this.call('DELETE', `/auth/wallets/${chainFamily}/${encodeURIComponent(address)}`, opts);
  }

  // Realtime

  /**
   * Watch a corridor and get its live board.
   */
  watchCorridor(body: T.WatchRequest, opts?: PathParams): Promise<T.WatchResponse> {
    return this.call('POST', '/bridge/watch', { body, ...opts });
  }

  /**
   * Mint a websocket connection token.
   */
  getConnectionToken(
    body: T.ConnectionTokenRequest = {},
    opts?: PathParams,
  ): Promise<T.ConnectionTokenResponse> {
    return this.call('POST', '/realtime/connection-token', { body, ...opts });
  }

  /**
   * Mint a subscription token for one channel.
   */
  getSubscriptionToken(
    body: T.SubscriptionTokenRequest,
    opts?: PathParams,
  ): Promise<T.SubscriptionTokenResponse> {
    return this.call('POST', '/realtime/subscription-token', { body, ...opts });
  }

  // Data

  /**
   * Current USD price per canonical asset.
   */
  getPrices(opts?: PathParams): Promise<T.PricesResponse> {
    return this.call('GET', '/prices', opts);
  }

  /**
   * One asset's hourly USD prices for the last month.
   */
  getPriceHistory(asset: string, opts?: PathParams): Promise<T.PriceHistoryResponse> {
    return this.call('GET', `/prices/${encodeURIComponent(asset)}/history`, opts);
  }

  /**
   * A wallet's balance of one asset on one chain.
   */
  getBalance(body: T.BalanceRequest, opts?: PathParams): Promise<T.BalanceResponse> {
    return this.call('POST', '/balance', { body, ...opts });
  }

  /**
   * Everything the caller holds, across every chain their wallets can sign.
   */
  getPortfolio(body: T.PortfolioRequest, opts?: PathParams): Promise<T.PortfolioResponse> {
    return this.call('POST', '/balance/portfolio', { body, ...opts });
  }

  /**
   * Platform headline figures.
   */
  getStats(opts?: PathParams): Promise<T.StatsResponse> {
    return this.call('GET', '/stats', opts);
  }

  /**
   * Top wallets by bridged volume.
   */
  getLeaderboard(
    query: T.LeaderboardQuery = {},
    opts?: PathParams,
  ): Promise<T.LeaderboardResponse> {
    return this.call('GET', '/leaderboard', { query, ...opts });
  }

  /**
   * The caller's own volume, savings and ranks. Session required.
   */
  getProfile(opts?: PathParams): Promise<T.ProfileResponse> {
    return this.call('GET', '/profile', opts);
  }

  /**
   * Service health.
   */
  getHealth(opts?: PathParams): Promise<T.HealthResponse> {
    return this.call('GET', '/health', opts);
  }
}

/**
 * Create a client. `createClient()` with no options targets production.
 */
export function createClient(options?: BridgClientOptions): BridgClient {
  return new BridgClient(options);
}
