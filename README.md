# @kernlog/bridg-sdk

TypeScript client for the [Bridg API](https://docs.bridg.now/api-reference/overview). One method per endpoint, typed from the API's own OpenAPI document, no runtime dependencies.

```bash
npm install @kernlog/bridg-sdk
```

Node 18+ or any runtime with a global `fetch`.

## Quote, build, sign, submit, track

```ts
import { createClient } from '@kernlog/bridg-sdk';

const bridg = createClient();

// 1. Markets
const { chains } = await bridg.getSourceChains();
const { routes } = await bridg.getRoutes({ fromChain: 'base', toChain: 'solana' });

// 2. Quote: 100 USDC on Base to USDC on Solana
const quote = await bridg.getQuote({
  fromChain: 'base',
  toChain: 'solana',
  fromToken: 'USDC',
  toToken: 'USDC',
  amountAtomic: '100000000',
  sender: '0xYourEvmWallet',
  recipient: 'YourSolanaWallet',
});
quote.best; // the row Bridg builds by default
quote.bestByTime; // quoteId of the fastest executable row
quote.quotes; // every venue that answered, best first

// 3. Build the unsigned steps for the winner (or pass quoteId for another row)
const build = await bridg.buildTransfer({ decisionId: quote.decisionId });

// 4. Sign build.steps in order with the user's wallet, then report the hash
await bridg.submitTransfer(build.transferId, { txHash: '0x…', step: 'main' });

// 5. Track
const transfer = await bridg.waitForTransfer(build.transferId, {
  onUpdate: (t) => console.log(t.status),
});
```

`amountAtomic` and every amount in a response are strings in atomic units.

## Configuration

```ts
createClient({
  baseUrl: 'https://api.bridg.now/v1', // default
  token: 'session token', // only for listing your own orders
  headers: { 'x-integrator': 'my-app' },
  fetch: customFetch,
});
```

## Sessions

Quote, build and submit are open. A session is needed only for `listOrders`, `getHistory`, `getProfile` and wallet management.

```ts
const { message } = await bridg.requestNonce({ address, chainFamily: 'evm' });
const signature = await wallet.signMessage({ message }); // sign the string verbatim
await bridg.verifySignature({ chainFamily: 'evm', message, signature }); // token kept on the client
const { transfers } = await bridg.listOrders({ sender: address });
```

## Referrals

Put your wallet and rate on the quote. Both fields or neither; the wallet must be valid on the source chain.

```ts
await bridg.getQuote({ ...params, referralWallet: '0xYourWallet', referralBps: 10 });
```

## Errors

Every API error is a `BridgError` with the API's `code`, the HTTP `status`, `details` and, on `429`, `retryAfterMs`.

```ts
import { isBridgError } from '@kernlog/bridg-sdk';

try {
  await bridg.buildTransfer({ decisionId });
} catch (error) {
  if (isBridgError(error) && error.code === 'quote_drifted') {
    // re-quote and choose again; error.details carries both figures
  }
}
```

The codes are listed at [docs.bridg.now/reference/errors](https://docs.bridg.now/reference/errors).

## Methods

| Group               | Methods                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Markets             | `getSourceChains` `getRoutes` `getVenues`                                                                                             |
| Quote and execute   | `getQuote` `buildTransfer` `submitTransfer` `getTransfer` `waitForTransfer` `buildRedeem` `submitRedeem`                              |
| Large orders        | `acceptPlan` `startSplit` `nextSplitLeg` `getSplitGroup`                                                                              |
| Hyperliquid         | `submitPermit` `submitSpotTransfer`                                                                                                   |
| Sessions and orders | `requestNonce` `verifySignature` `getSession` `logout` `listOrders` `getOrder` `getHistory` `setUsername` `nameWallet` `unlinkWallet` |
| Realtime            | `watchCorridor` `getConnectionToken` `getSubscriptionToken`                                                                           |
| Data                | `getPrices` `getPriceHistory` `getBalance` `getPortfolio` `getStats` `getLeaderboard` `getProfile` `getHealth`                        |

## Development

Clone, `pnpm install`, then `pnpm check` runs typecheck, lint, tests and the build. Releases are described in [RELEASING.md](RELEASING.md) and recorded in [CHANGELOG.md](CHANGELOG.md).

`src/generated/api.ts` is generated from the running API by `pnpm generate` (`BRIDGE_API`, default `http://localhost:3001`, a running BridgeSwap API). Regenerate and commit it after any route or schema change; every exported type in `src/types.ts` is derived from it.
