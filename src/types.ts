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
