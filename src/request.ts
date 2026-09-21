import { BridgError, type BridgErrorBody } from './errors';

export type QueryValue = string | number | boolean | undefined;

export interface RequestConfig {
  baseUrl: string;
  fetch: typeof fetch;
  headers: Record<string, string>;
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
 * One JSON round trip. A non-2xx answer becomes a {@link BridgError} carrying
 * the API's own `code`; a network failure propagates as thrown by `fetch`.
 */
export async function request<T>(config: RequestConfig, options: RequestOptions): Promise<T> {
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
  const json: unknown = text.length ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const body = (json as Partial<BridgErrorBody> | undefined)?.error;
    throw new BridgError(`${options.method} ${options.path}`, response.status, body);
  }
  return json as T;
}
