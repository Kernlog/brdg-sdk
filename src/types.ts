/**
 * Named request and response types, derived from the generated OpenAPI paths so
 * they cannot drift from what the API validates.
 */
import type { paths } from './generated/api';

type JsonOf<T> = T extends { content: { 'application/json': infer B } } ? B : never;

/**
 * The JSON request body of an operation.
 */
export type RequestBody<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  requestBody: infer R;
}
  ? JsonOf<NonNullable<R>>
  : never;

/**
 * The JSON body of an operation's 200 response.
 */
export type Response<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: { 200: infer R };
}
  ? JsonOf<R>
  : never;

/**
 * The query parameters of an operation.
 */
export type Query<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  parameters: { query?: infer Q };
}
  ? NonNullable<Q>
  : never;

// Markets
export type SourceChainsResponse = Response<'/bridge/source-chains', 'get'>;
export type SourceChain = SourceChainsResponse['chains'][number];
export type RoutesQuery = Query<'/bridge/routes', 'get'>;
export type RoutesResponse = Response<'/bridge/routes', 'get'>;
export type Route = RoutesResponse['routes'][number];
export type VenuesResponse = Response<'/bridge/venues', 'get'>;
export type Venue = VenuesResponse['venues'][number];
export type ChainKey = RoutesQuery['fromChain'];

// Quote and execute
export type QuoteRequest = RequestBody<'/bridge/quote', 'post'>;
export type QuoteResponse = Response<'/bridge/quote', 'post'>;
export type QuoteRow = QuoteResponse['quotes'][number];
export type RejectedVenue = QuoteResponse['rejected'][number];
export type BuildRequest = RequestBody<'/bridge/build', 'post'>;
export type BuildResponse = Response<'/bridge/build', 'post'>;
export type BuildStep = BuildResponse['steps'][number];
export type SubmitRequest = RequestBody<'/bridge/transfers/{id}/submit', 'post'>;
export type SubmitResponse = Response<'/bridge/transfers/{id}/submit', 'post'>;
export type Transfer = Response<'/bridge/transfers/{id}', 'get'>;
export type TransferStatus = Transfer['status'];
export type RedeemResponse = Response<'/bridge/transfers/{id}/redeem', 'post'>;
export type RedeemSubmitRequest = RequestBody<'/bridge/transfers/{id}/redeem/submit', 'post'>;
export type RedeemSubmitResponse = Response<'/bridge/transfers/{id}/redeem/submit', 'post'>;

// Large orders
export type AcceptPlanRequest = RequestBody<'/bridge/plan/accept', 'post'>;
export type AcceptPlanResponse = Response<'/bridge/plan/accept', 'post'>;
export type SplitStartRequest = RequestBody<'/bridge/split/start', 'post'>;
export type SplitNextRequest = RequestBody<'/bridge/split/next', 'post'>;
export type SplitGroup = Response<'/bridge/split/groups/{id}', 'get'>;

// Hyperliquid
export type PermitRequest = RequestBody<'/bridge/transfers/{id}/permit', 'post'>;
export type PermitResponse = Response<'/bridge/transfers/{id}/permit', 'post'>;
export type SpotTransferRequest = RequestBody<'/bridge/transfers/{id}/spot-transfer', 'post'>;
export type SpotTransferResponse = Response<'/bridge/transfers/{id}/spot-transfer', 'post'>;

// Sessions and orders
export type NonceRequest = RequestBody<'/auth/nonce', 'post'>;
export type NonceResponse = Response<'/auth/nonce', 'post'>;
export type VerifyRequest = RequestBody<'/auth/verify', 'post'>;
export type VerifyResponse = Response<'/auth/verify', 'post'>;
export type Session = Response<'/auth/session', 'get'>;
export type ChainFamily = NonceRequest['chainFamily'];
export type OrdersQuery = Query<'/bridge/orders', 'get'>;
export type OrdersResponse = Response<'/bridge/orders', 'get'>;
export type HistoryQuery = Query<'/bridge/history', 'get'>;
export type HistoryResponse = Response<'/bridge/history', 'get'>;
export type SetUsernameRequest = RequestBody<'/auth/profile', 'patch'>;
export type SetUsernameResponse = Response<'/auth/profile', 'patch'>;
export type WalletNicknameRequest = RequestBody<'/auth/wallets/{chainFamily}/{address}', 'patch'>;
export type WalletNicknameResponse = Response<'/auth/wallets/{chainFamily}/{address}', 'patch'>;
export type UnlinkWalletResponse = Response<'/auth/wallets/{chainFamily}/{address}', 'delete'>;

// Realtime
export type WatchRequest = RequestBody<'/bridge/watch', 'post'>;
export type WatchResponse = Response<'/bridge/watch', 'post'>;
export type ConnectionTokenRequest = RequestBody<'/realtime/connection-token', 'post'>;
export type ConnectionTokenResponse = Response<'/realtime/connection-token', 'post'>;
export type SubscriptionTokenRequest = RequestBody<'/realtime/subscription-token', 'post'>;
export type SubscriptionTokenResponse = Response<'/realtime/subscription-token', 'post'>;

// Data
export type PricesResponse = Response<'/prices', 'get'>;
export type PriceHistoryResponse = Response<'/prices/{asset}/history', 'get'>;
export type BalanceRequest = RequestBody<'/balance', 'post'>;
export type BalanceResponse = Response<'/balance', 'post'>;
export type PortfolioRequest = RequestBody<'/balance/portfolio', 'post'>;
export type PortfolioResponse = Response<'/balance/portfolio', 'post'>;
export type StatsResponse = Response<'/stats', 'get'>;
export type LeaderboardQuery = Query<'/leaderboard', 'get'>;
export type LeaderboardResponse = Response<'/leaderboard', 'get'>;
export type ProfileResponse = Response<'/profile', 'get'>;
export type HealthResponse = Response<'/health', 'get'>;
