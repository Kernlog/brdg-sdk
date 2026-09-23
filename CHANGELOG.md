# Changelog

All notable changes to `@kernlog/brdg-sdk` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
