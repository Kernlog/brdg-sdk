/**
 * The production API. Every path in this package is relative to it.
 */
export const MAINNET_API_URL = 'https://api.brdg.now/v1';

/**
 * Transfer statuses after which nothing changes.
 */
export const TERMINAL_TRANSFER_STATUSES = [
  'COMPLETED',
  'PARTIAL',
  'REFUNDED',
  'FAILED',
  'ABANDONED',
] as const;

/**
 * The header a partner API key is sent in.
 */
export const API_KEY_HEADER = 'x-brdg-api-key';

export const SDK_VERSION = '0.5.0';
