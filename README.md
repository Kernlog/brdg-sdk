# @kernlog/brdg-sdk

TypeScript client for the [BRDG API](https://docs.brdg.now/api-reference/overview): quote a cross-chain transfer, build the transaction, submit it, track it. Typed from the API's own OpenAPI document. No API key, no runtime dependencies.

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

## Configuration

```ts
createClient({
  baseUrl: 'https://api.brdg.now/v1', // default
  headers: { 'x-integrator': 'my-app' },
  fetch: customFetch,
});
```

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
| `getTransfer(transferId)`                                           | `GET /bridge/transfers/{id}`                      |
| `waitForTransfer(transferId, options?)`                             | polls `GET /bridge/transfers/{id}` until terminal |

## Development

Clone, `pnpm install`, then `pnpm check` runs typecheck, lint, tests and the build. Releases are described in [RELEASING.md](RELEASING.md) and recorded in [CHANGELOG.md](CHANGELOG.md).

`src/generated/api.ts` is generated from the running API by `pnpm generate` (`BRIDGE_API`, default `http://localhost:3001`, a running BridgeSwap API). Regenerate and commit it after any route or schema change; every exported type in `src/types.ts` is derived from it.
