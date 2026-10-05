import { BrdgError, type BrdgErrorBody } from './errors';
import { isRetryable, parseRetryAfter, retryDelayMs, sleep, type ResolvedRetry } from './retry';

export type QueryValue = string | number | boolean | undefined;

export interface RequestConfig {
  baseUrl: string;
  fetch: typeof fetch;
  headers: Record<string, string>;
  /**
   * The retry policy, or null for one attempt only.
   */
  retry: ResolvedRetry | null;
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

function buildUrl(
  baseUrl: string,
  path: string,
  query: Record<string, QueryValue> | undefined,
): string {
  const url = new URL(baseUrl.replace(/\/$/, '') + path);
  for (const [key, value] of Object.entries(query ?? {}))
    if (value !== undefined) url.searchParams.set(key, String(value));

  return url.toString();
}

/**
 * One JSON round trip, retried per `config.retry`. A non-2xx answer becomes a
 * {@link BrdgError} carrying the API's own `code`; a network failure propagates
 * as thrown by `fetch`.
 */
export async function request<T>(config: RequestConfig, options: RequestOptions): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await attemptOnce<T>(config, options);
    } catch (error) {
      const policy = config.retry;
      if (policy === null || attempt >= policy.retries || !isRetryable(options.method, error))
        throw error;
      const delay = retryDelayMs(policy, attempt, error);
      if (delay === null) throw error;
      await sleep(delay, options.signal);
    }
  }
}

async function attemptOnce<T>(config: RequestConfig, options: RequestOptions): Promise<T> {
  const url = buildUrl(config.baseUrl, options.path, options.query);
  const headers: Record<string, string> = { accept: 'application/json', ...config.headers };
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const response = await config.fetch(url, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  const text = await response.text();
  let json: unknown;
  try {
    json = text.length ? JSON.parse(text) : undefined;
  } catch (error) {
    // A proxy's HTML error page on a 5xx is still a 5xx: report the status, not a parse error.
    if (response.ok) throw error;
  }

  if (!response.ok) {
    const body = (json as Partial<BrdgErrorBody> | undefined)?.error;
    // The longer of the header and the body's hint, so a caller never retries early.
    const header = parseRetryAfter(response.headers.get('retry-after'));
    const retryAfterMs =
      header === undefined ? body?.retryAfterMs : Math.max(header, body?.retryAfterMs ?? 0);
    throw new BrdgError(`${options.method} ${options.path}`, response.status, {
      ...body,
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    });
  }
  return json as T;
}
