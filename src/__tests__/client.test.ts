import { describe, expect, it, vi } from 'vitest';
import { createClient, isBridgError, TransferTimeoutError, type BridgError } from '../index';

type Call = { url: string; init: RequestInit };

function fakeFetch(handler: (call: Call) => { status?: number; body?: unknown }) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    const { status = 200, body } = handler(call);
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('BridgClient', () => {
  it('posts a quote as JSON to the production base url by default', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ body: { decisionId: 'd1', quotes: [] } }));
    const client = createClient({ fetch: fetchImpl });
    const quote = await client.getQuote({
      fromChain: 'base',
      toChain: 'solana',
      fromToken: 'USDC',
      toToken: 'USDC',
      amountAtomic: '100000000',
      sender: '0x58E602386DB134b1F9B1d6d390C11A2B7b486677',
      recipient: '3BQtHR41iDPiu9skeSVzmBDpZKcKqEEDnMn6UkbAHvZz',
    });
    expect(quote.decisionId).toBe('d1');
    expect(calls[0]?.url).toBe('https://api.bridg.now/v1/bridge/quote');
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init.body)).amountAtomic).toBe('100000000');
    expect((calls[0]?.init.headers as Record<string, string>)['content-type']).toBe(
      'application/json',
    );
  });

  it('encodes query parameters and drops undefined ones', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ body: { routes: [] } }));
    const client = createClient({ fetch: fetchImpl, baseUrl: 'http://localhost:3001/v1/' });
    await client.getRoutes({ fromChain: 'base', toChain: 'solana', privacy: undefined });
    expect(calls[0]?.url).toBe(
      'http://localhost:3001/v1/bridge/routes?fromChain=base&toChain=solana',
    );
  });

  it('turns the error envelope into a BridgError with the code and retry hint', async () => {
    const { fetchImpl } = fakeFetch(() => ({
      status: 429,
      body: { error: { code: 'rate_limited', message: 'slow down', retryAfterMs: 1200 } },
    }));
    const client = createClient({ fetch: fetchImpl });
    const failure = await client.getVenues().catch((error: unknown) => error);
    expect(isBridgError(failure)).toBe(true);
    const error = failure as BridgError;
    expect(error.code).toBe('rate_limited');
    expect(error.status).toBe(429);
    expect(error.retryAfterMs).toBe(1200);
    expect(error.endpoint).toBe('GET /bridge/venues');
  });

  it('waits for a transfer until it is terminal', async () => {
    const statuses = ['SUBMITTED', 'PENDING', 'COMPLETED'];
    const { fetchImpl, calls } = fakeFetch(() => ({ body: { status: statuses.shift() } }));
    const client = createClient({ fetch: fetchImpl });
    const seen: string[] = [];
    const transfer = await client.waitForTransfer('t1', {
      intervalMs: 1,
      onUpdate: (t) => seen.push(t.status),
    });
    expect(transfer.status).toBe('COMPLETED');
    expect(seen).toEqual(['SUBMITTED', 'PENDING', 'COMPLETED']);
    expect(calls).toHaveLength(3);
  });

  it('throws TransferTimeoutError when the deadline passes first', async () => {
    const { fetchImpl } = fakeFetch(() => ({ body: { status: 'PENDING' } }));
    const client = createClient({ fetch: fetchImpl });
    await expect(
      client.waitForTransfer('t2', { intervalMs: 1, timeoutMs: 0 }),
    ).rejects.toBeInstanceOf(TransferTimeoutError);
  });
});
