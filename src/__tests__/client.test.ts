import { describe, expect, it, vi } from 'vitest';
import { createClient, isBrdgError, TransferTimeoutError, type BrdgError } from '../index';
import * as sdk from '../index';

type Call = { url: string; init: RequestInit };

function fakeFetch(
  handler: (call: Call) => { status?: number; body?: unknown; headers?: Record<string, string> },
) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    const { status = 200, body, headers = {} } = handler(call);
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('BrdgClient', () => {
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
    expect(calls[0]?.url).toBe('https://api.brdg.now/v1/bridge/quote');
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

  it('turns the error envelope into a BrdgError with the code and retry hint', async () => {
    const { fetchImpl } = fakeFetch(() => ({
      status: 429,
      body: { error: { code: 'rate_limited', message: 'slow down', retryAfterMs: 1200 } },
    }));
    const client = createClient({ fetch: fetchImpl });
    const failure = await client.getVenues().catch((error: unknown) => error);
    expect(isBrdgError(failure)).toBe(true);
    const error = failure as BrdgError;
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

const RATE_LIMITED = {
  status: 429,
  body: { error: { code: 'rate_limited', message: 'slow down', retryAfterMs: 5 } },
};
const QUOTE = {
  fromChain: 'base',
  toChain: 'solana',
  amountAtomic: '100000000',
  sender: '0x58E602386DB134b1F9B1d6d390C11A2B7b486677',
} as const;
const FAST = { retries: 3, baseDelayMs: 1, maxDelayMs: 2 };

describe('fast fill', () => {
  it('quotes, builds and submits a signature on the fastfill paths', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ body: { ok: true } }));
    const client = createClient({ fetch: fetchImpl });
    await client.getFastFillQuote({
      fromChain: 'base',
      toChain: 'arbitrum',
      fromToken: 'USDC',
      toToken: 'USDC',
      amountAtomic: '10000000',
      sender: '0x58E602386DB134b1F9B1d6d390C11A2B7b486677',
    } as never);
    await client.buildFastFill({ decisionId: 'd1' } as never);
    await client.submitFastFillSignature('t/1', { signature: '0xab' } as never);
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.brdg.now/v1/fastfill/quote',
      'https://api.brdg.now/v1/fastfill/build',
      'https://api.brdg.now/v1/fastfill/transfers/t%2F1/submit',
    ]);
    expect(JSON.parse(String(calls[2]?.init.body))).toEqual({ signature: '0xab' });
  });
});

describe('apiKey', () => {
  it('sends x-brdg-api-key on every request, beside custom headers', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ body: { venues: [], decisionId: 'd' } }));
    const client = createClient({
      fetch: fetchImpl,
      apiKey: 'brdg_secret',
      headers: { 'x-integrator': 'print' },
    });
    await client.getVenues();
    await client.getQuote(QUOTE);
    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>;
      expect(headers['x-brdg-api-key']).toBe('brdg_secret');
      expect(headers['x-integrator']).toBe('print');
    }
    expect(calls).toHaveLength(2);
  });

  it('sends no key header without the option', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ body: { venues: [] } }));
    await createClient({ fetch: fetchImpl }).getVenues();
    expect(calls[0]?.init.headers as Record<string, string>).not.toHaveProperty('x-brdg-api-key');
  });
});

describe('retry', () => {
  it('is off by default: one attempt, the 429 is thrown', async () => {
    const { fetchImpl, calls } = fakeFetch(() => RATE_LIMITED);
    await expect(createClient({ fetch: fetchImpl }).getVenues()).rejects.toMatchObject({
      status: 429,
    });
    expect(calls).toHaveLength(1);
  });

  it('retries a GET on 5xx and 429, then succeeds', async () => {
    const answers = [
      { status: 503, body: { error: { code: 'x', message: 'down' } } },
      RATE_LIMITED,
    ];
    const { fetchImpl, calls } = fakeFetch(() => answers.shift() ?? { body: { venues: [] } });
    const venues = await createClient({ fetch: fetchImpl, retry: FAST }).getVenues();
    expect(venues).toEqual({ venues: [] });
    expect(calls).toHaveLength(3);
  });

  it('retries a GET through a network failure', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('fetch failed');
      return new Response(JSON.stringify({ venues: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    await createClient({ fetch: fetchImpl, retry: FAST }).getVenues();
    expect(calls).toBe(2);
  });

  it('retries a POST on 429 rate_limited, where nothing was done', async () => {
    const answers = [RATE_LIMITED];
    const { fetchImpl, calls } = fakeFetch(() => answers.shift() ?? { body: { decisionId: 'd' } });
    const quote = await createClient({ fetch: fetchImpl, retry: FAST }).getQuote(QUOTE);
    expect(quote.decisionId).toBe('d');
    expect(calls).toHaveLength(2);
  });

  it('never retries a POST on 5xx or a network failure: it may have happened', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({
      status: 502,
      body: { error: { code: 'broadcast_failed', message: 'x' } },
    }));
    const client = createClient({ fetch: fetchImpl, retry: FAST });
    await expect(client.submitTransfer('t', { txHash: '0x1', step: 'main' })).rejects.toMatchObject(
      {
        status: 502,
      },
    );
    expect(calls).toHaveLength(1);

    let networkCalls = 0;
    const dropping = (async () => {
      networkCalls += 1;
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(
      createClient({ fetch: dropping, retry: FAST }).buildTransfer({ decisionId: 'd' }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(networkCalls).toBe(1);
  });

  it('never retries a 4xx other than 429', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({
      status: 401,
      body: { error: { code: 'invalid_api_key', message: 'x' } },
    }));
    await expect(
      createClient({ fetch: fetchImpl, retry: FAST }).getQuote(QUOTE),
    ).rejects.toMatchObject({ code: 'invalid_api_key' });
    expect(calls).toHaveLength(1);
  });

  it('stops after `retries` and throws the last error', async () => {
    const { fetchImpl, calls } = fakeFetch(() => RATE_LIMITED);
    await expect(
      createClient({ fetch: fetchImpl, retry: { ...FAST, retries: 2 } }).getVenues(),
    ).rejects.toMatchObject({ code: 'rate_limited' });
    expect(calls).toHaveLength(3);
  });

  it('waits the Retry-After header when it is longer than the body hint', async () => {
    vi.useFakeTimers();
    try {
      const answers = [{ ...RATE_LIMITED, headers: { 'retry-after': '2' } }];
      const { fetchImpl, calls } = fakeFetch(() => answers.shift() ?? { body: { venues: [] } });
      const pending = createClient({ fetch: fetchImpl, retry: FAST }).getVenues();
      await vi.advanceTimersByTimeAsync(1_999);
      expect(calls).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws instead of sleeping past maxRetryAfterMs', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({
      ...RATE_LIMITED,
      headers: { 'retry-after': '120' },
    }));
    const failure = await createClient({ fetch: fetchImpl, retry: FAST })
      .getVenues()
      .catch((error: unknown) => error as BrdgError);
    expect((failure as BrdgError).retryAfterMs).toBe(120_000);
    expect(calls).toHaveLength(1);
  });
});

describe('waitForTransfer through transient failures', () => {
  it('polls through a 503, a 429 and a network failure, and reports each', async () => {
    const script: (() => Response)[] = [
      () => new Response(JSON.stringify({ status: 'PENDING' }), { status: 200 }),
      () =>
        new Response(JSON.stringify({ error: { code: 'x', message: 'down' } }), { status: 503 }),
      () => {
        throw new TypeError('fetch failed');
      },
      () =>
        new Response(
          JSON.stringify({ error: { code: 'rate_limited', message: 'x', retryAfterMs: 1 } }),
          {
            status: 429,
          },
        ),
      () => new Response(JSON.stringify({ status: 'COMPLETED' }), { status: 200 }),
    ];
    const fetchImpl = (async () => script.shift()!()) as unknown as typeof fetch;
    const errors: unknown[] = [];
    const transfer = await createClient({ fetch: fetchImpl }).waitForTransfer('t', {
      intervalMs: 1,
      onError: (error) => errors.push(error),
    });
    expect(transfer.status).toBe('COMPLETED');
    expect(errors).toHaveLength(3);
  });

  it('throws a 404 at once: the transfer does not exist', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({
      status: 404,
      body: { error: { code: 'transfer_not_found', message: 'x' } },
    }));
    await expect(
      createClient({ fetch: fetchImpl }).waitForTransfer('t', { intervalMs: 1 }),
    ).rejects.toMatchObject({ code: 'transfer_not_found' });
    expect(calls).toHaveLength(1);
  });

  it('throws the last error at the deadline when no read ever succeeded', async () => {
    const { fetchImpl } = fakeFetch(() => ({
      status: 503,
      body: { error: { code: 'x', message: 'down' } },
    }));
    await expect(
      createClient({ fetch: fetchImpl }).waitForTransfer('t', { intervalMs: 1, timeoutMs: 0 }),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe('deprecated Bridg aliases', () => {
  it('are the renamed exports', () => {
    expect(sdk.BridgClient).toBe(sdk.BrdgClient);
    expect(sdk.BridgError).toBe(sdk.BrdgError);
    expect(sdk.isBridgError).toBe(sdk.isBrdgError);
  });
});
