import { BrdgClient, type BrdgClientOptions } from './client';
import { BrdgError, isBrdgError, type BrdgErrorBody } from './errors';

export { BrdgClient, createClient, type BrdgClientOptions } from './client';
export { MAINNET_API_URL, SDK_VERSION, TERMINAL_TRANSFER_STATUSES } from './constants';
export { BrdgError, TransferTimeoutError, isBrdgError, type BrdgErrorBody } from './errors';
export { isTerminalStatus, type WaitForTransferOptions } from './wait';
export type * from './types';
export type { paths as ApiPaths } from './generated/api';

// Declarations, not `export { X as Y }`: TypeScript ignores @deprecated on export specifiers.

/** @deprecated Use BrdgClient. */
export const BridgClient = BrdgClient;
/** @deprecated Use BrdgClient. */
export type BridgClient = BrdgClient;
/** @deprecated Use BrdgClientOptions. */
export type BridgClientOptions = BrdgClientOptions;
/** @deprecated Use BrdgError. */
export const BridgError = BrdgError;
/** @deprecated Use BrdgError. */
export type BridgError = BrdgError;
/** @deprecated Use BrdgErrorBody. */
export type BridgErrorBody = BrdgErrorBody;
/** @deprecated Use isBrdgError. */
export const isBridgError = isBrdgError;
