import { BrdgError } from './errors';

/**
 * Retry policy for transient failures. Off unless `retry` is passed to the
 * client.
 *
 * What is retried, and why only that:
 * - `GET`: a `429`, any `5xx`, or a network failure. Reads change nothing, so
 *   asking again is always safe.
 * - `POST`: only a `429 rate_limited`. The API refuses a rate-limited call
 *   before it does anything, so nothing was quoted, built or submitted. A `5xx`
 *   or a dropped connection on a POST is NOT retried: a build or submit may
 *   have happened, and repeating it blindly is how a transfer gets doubled.
 */
export interface RetryOptions {
  /**
   * Retries after the first attempt. Default 3.
   */
  retries?: number;
  /**
   * Backoff base: attempt `n` waits a random time up to `baseDelayMs * 2^n`
   * (full jitter). Default 500.
   */
  baseDelayMs?: number;
  /**
   * Cap on one backoff wait. Default 10000.
   */
  maxDelayMs?: number;
  /**
   * The longest server-requested wait (`Retry-After` / `retryAfterMs`) the
   * client will honour. A longer one is thrown to the caller instead of slept
   * through. Default 60000.
   */
  maxRetryAfterMs?: number;
}

export type ResolvedRetry = Required<RetryOptions>;

/**
 * Fills in the defaults, or null when retries are off.
 */
export function resolveRetry(option: boolean | RetryOptions | undefined): ResolvedRetry | null {
  if (option === undefined || option === false) return null;
  const given = option === true ? {} : option;
  return {
    retries: given.retries ?? 3,
    baseDelayMs: given.baseDelayMs ?? 500,
    maxDelayMs: given.maxDelayMs ?? 10_000,
    maxRetryAfterMs: given.maxRetryAfterMs ?? 60_000,
  };
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

/**
 * True when the failure is worth asking again for: a `429`, a `5xx`, or a
 * network failure (anything `fetch` threw that is not an abort).
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof BrdgError) return error.status === 429 || error.status >= 500;
  return !isAbort(error);
}

/**
 * True when this method may be retried after this failure. See
 * {@link RetryOptions}.
 */
export function isRetryable(method: string, error: unknown): boolean {
  if (method === 'GET') return isTransientError(error);
  return error instanceof BrdgError && error.status === 429 && error.code === 'rate_limited';
}

/**
 * How long to wait before retry number `attempt` (0-based), or null when the
 * server asked for longer than the policy allows.
 */
export function retryDelayMs(
  policy: ResolvedRetry,
  attempt: number,
  error: unknown,
): number | null {
  const asked = error instanceof BrdgError ? error.retryAfterMs : undefined;
  if (asked !== undefined) return asked > policy.maxRetryAfterMs ? null : asked;
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
  return Math.floor(Math.random() * ceiling);
}

/**
 * Parses a `Retry-After` header: delta-seconds or an HTTP date.
 *
 * @returns Milliseconds, or undefined when absent or unreadable.
 */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (header === null || header.trim() === '') return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/**
 * Sleeps, waking early with the abort reason when `signal` fires.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
      },
      { once: true },
    );
  });
}
