# Changelog

All notable changes to `@kernlog/brdg-sdk` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `apiKey` client option: sends the partner key as `x-brdg-api-key` on every request. With a key the
  API applies its per-IP rate limit to the `userIp` in each request body instead of the calling
  server, under a partner-wide ceiling. Exported as `API_KEY_HEADER`.
- `retry` client option (`true` or `RetryOptions`: `retries`, `baseDelayMs`, `maxDelayMs`,
  `maxRetryAfterMs`), off by default. Exponential backoff with full jitter, honouring `Retry-After`
  and `retryAfterMs`. GETs retry on `429`, `5xx` and network failures; POSTs only on
  `429 rate_limited`, where the API did nothing.
- `waitForTransfer` polls through transient read failures (`429`, `5xx`, network) instead of
  throwing, waits out a `retryAfterMs`, and reports each one to the new `onError` callback. A `404`
  or other answer is still thrown at once.

### Changed

- `BrdgError.retryAfterMs` is the longer of the `Retry-After` header and the body's hint.
- A non-2xx response whose body is not JSON (a proxy's error page) now throws a `BrdgError` with
  its status instead of a JSON parse error.

## [0.3.0] - 2026-09-23

### Changed

- Package renamed from `@kernlog/bridg-sdk` to `@kernlog/brdg-sdk`.
- The API host is now `api.brdg.now`: `MAINNET_API_URL` is `https://api.brdg.now/v1`.
- `BridgClient`, `BridgClientOptions`, `BridgError`, `BridgErrorBody` and `isBridgError` are renamed
  to `BrdgClient`, `BrdgClientOptions`, `BrdgError`, `BrdgErrorBody` and `isBrdgError`. The error's
  `name` is now `BrdgError`.

### Deprecated

- The old `Bridg*` names and `isBridgError`, kept as aliases of the new ones.

## [0.2.0] - 2026-09-21

### Changed

- The client now covers the public surface only: markets, quote, build, submit, transfer and
  `waitForTransfer`. Session, order-history, large-order, Hyperliquid, realtime and data methods
  are removed, along with the `token` option and `setToken`. A Hyperliquid deposit is a transfer
  to chain `hypercore`; nothing else is needed.

## [0.1.1] - 2026-09-21

### Changed

- Package renamed from `@bridg/sdk` to `@kernlog/bridg-sdk`. First version published to npm.

## [0.1.0] - 2026-09-20

### Added

- `createClient` / `BridgClient` with one method per public endpoint: markets, quote and
  execute, large orders, Hyperliquid, sessions and orders, realtime, data.
- `waitForTransfer`, which polls a transfer until it reaches a terminal status.
- `BridgError` carrying the API's `code`, `status`, `details` and `retryAfterMs`.
- Request and response types generated from the API's OpenAPI document.

[Unreleased]: https://github.com/Kernlog/brdg-sdk/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Kernlog/brdg-sdk/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Kernlog/brdg-sdk/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Kernlog/brdg-sdk/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Kernlog/brdg-sdk/releases/tag/v0.1.0
