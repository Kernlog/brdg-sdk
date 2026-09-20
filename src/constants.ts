/**
 * The production API. Every path in this package is relative to it.
 */
export const MAINNET_API_URL = 'https://api.bridg.now/v1';

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

export const SDK_VERSION = '0.1.0';
