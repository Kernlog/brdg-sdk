# @kernlog/brdg-sdk

TypeScript client for the [BRDG API](https://docs.brdg.now/api-reference/overview): quote a cross-chain transfer, build the transaction, submit it, track it. Typed from the API's own OpenAPI document. No API key required, no runtime dependencies.

```bash
npm install @kernlog/brdg-sdk
```

Node 18+ or any runtime with a global `fetch`.

## Quote, build, sign, submit, track

```ts
import { createClient } from '@kernlog/brdg-sdk';

const brdg = createClient();

// 1. Markets
const { chains } = await brdg.getSourceChains();
const { routes } = await brdg.getRoutes({ fromChain: 'base', toChain: 'solana' });

// 2. Quote: 100 USDC on Base to USDC on Solana
const quote = await brdg.getQuote({
  fromChain: 'base',
  toChain: 'solana',
  fromToken: 'USDC',
  toToken: 'USDC',
  amountAtomic: '100000000',
  sender: '0xYourEvmWallet',
  recipient: 'YourSolanaWallet',
});
quote.best; // the row BRDG builds by default
quote.bestByTime; // quoteId of the fastest executable row
quote.quotes; // every venue that answered, best first

// 3. Build the unsigned steps for the winner (or pass quoteId for another row)
const build = await brdg.buildTransfer({ decisionId: quote.decisionId });

// 4. Sign build.steps in order with the user's wallet, then report the hash
await brdg.submitTransfer(build.transferId, { txHash: '0x…', step: 'main' });

// 5. Track
const transfer = await brdg.waitForTransfer(build.transferId, {
  onUpdate: (t) => console.log(t.status),
});
```

`amountAtomic` and every amount in a response are strings in atomic units.

## Fast fill

A fast fill lands in seconds: the venue's solver pays the destination from its own liquidity.
Relay and Across are gasless: the build ends in one EIP-712 message to sign. Mayan Swift is sent by
the user like any transaction, and is offered only when `sender` holds the source-chain gas.

```ts
const quote = await brdg.getFastFillQuote({
  fromChain: 'base',
  toChain: 'arbitrum',
  fromToken: 'USDC',
  toToken: 'USDC',
  amountAtomic: '10000000',
  sender: '0xYourEvmWallet',
});
const build = await brdg.buildFastFill({ decisionId: quote.decisionId });

for (const step of build.steps) {
  if (step.vm === 'sign') {
    // Gasless: sign payload.domain/types/primaryType/message with eth_signTypedData_v4
    await brdg.submitFastFillSignature(build.transferId, { signature: '0x…' });
  } else {
    // An approve, or a Mayan order: send it like any step
    await brdg.submitTransfer(build.transferId, { txHash: '0x…', step: step.step });
  }
}
```

## Configuration

```ts
createClient({
  baseUrl: 'https://api.brdg.now/v1', // default
  apiKey: process.env.BRDG_API_KEY, // optional partner key, server-side only
  retry: true, // optional; off by default
  headers: { 'x-integrator': 'my-app' },
  fetch: customFetch,
});
```

### Calling from a server

Without a key every request your server makes shares one per-IP rate limit (10 per minute for
quote, build and submit), whichever of your users it is for. With a partner `apiKey`, sent as
`x-brdg-api-key`, the per-IP limit applies to the `userIp` you put on each request instead, under a
partner-wide ceiling. The per-wallet limit is unchanged. Keep the key on the server.

```ts
const brdg = createClient({ apiKey: process.env.BRDG_API_KEY, retry: true });
await brdg.getQuote({ ...params, userIp: endUser.ip });
```

Keys are issued by BRDG on request; there is no self-serve signup. For a key or higher limits, contact
[@kernlog on Telegram](https://t.me/kernlog) or [kernlog@print.world](mailto:kernlog@print.world).

An unknown key is `401 invalid_api_key`, a disabled one `401 api_key_disabled`. Every `429` and
bad-key `401` carries the same contact in `error.details.contact`.

### Retries

`retry: true` (or `{ retries, baseDelayMs, maxDelayMs, maxRetryAfterMs }`, defaults 3, 500, 10000, 60000) retries with exponential backoff and full jitter, waiting at least what `Retry-After` asks.
GETs retry on `429`, `5xx` and network failures. POSTs retry only on `429 rate_limited`, where the
API did nothing; a `5xx` or dropped connection on a build or submit is thrown, because it may have
happened. `waitForTransfer` always polls through transient read failures until its timeout; pass
`onError` to see them.

## Referrals

Put your wallet and rate on the quote. Both fields or neither; the wallet must be valid on the source chain.

```ts
await brdg.getQuote({ ...params, referralWallet: '0xYourWallet', referralBps: 10 });
```

## Errors

Every API error is a `BrdgError` with the API's `code`, the HTTP `status`, `details` and, on `429`, `retryAfterMs`.

```ts
import { isBrdgError } from '@kernlog/brdg-sdk';

try {
  await brdg.buildTransfer({ decisionId });
} catch (error) {
  if (isBrdgError(error) && error.code === 'quote_drifted') {
    // re-quote and choose again; error.details carries both figures
  }
}
```

The codes are listed at [docs.brdg.now/reference/errors](https://docs.brdg.now/reference/errors).

## Methods

| Method                                                              | Endpoint                                          |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `getSourceChains()`                                                 | `GET /bridge/source-chains`                       |
| `getRoutes({ fromChain, toChain, privacy? })`                       | `GET /bridge/routes`                              |
| `getVenues()`                                                       | `GET /bridge/venues`                              |
| `getQuote(request)`                                                 | `POST /bridge/quote`                              |
| `buildTransfer({ decisionId, quoteId? })`                           | `POST /bridge/build`                              |
| `submitTransfer(transferId, { txHash \| signedTransaction, step })` | `POST /bridge/transfers/{id}/submit`              |
| `getFastFillQuote(request)`                                         | `POST /fastfill/quote`                            |
| `buildFastFill({ decisionId })`                                     | `POST /fastfill/build`                            |
| `submitFastFillSignature(transferId, { signature })`                | `POST /fastfill/transfers/{id}/submit`            |
| `getTransfer(transferId)`                                           | `GET /bridge/transfers/{id}`                      |
| `waitForTransfer(transferId, options?)`                             | polls `GET /bridge/transfers/{id}` until terminal |

## Development

Clone, `pnpm install`, then `pnpm check` runs typecheck, lint, tests and the build. Releases are described in [RELEASING.md](RELEASING.md) and recorded in [CHANGELOG.md](CHANGELOG.md).

`src/generated/api.ts` is generated from the running API by `pnpm generate` (`BRIDGE_API`, default `http://localhost:3001`, a running BridgeSwap API). Regenerate and commit it after any route or schema change; every exported type in `src/types.ts` is derived from it.
