# Changelog

All notable changes to `@bridg/sdk` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-09-20

### Added

- `createClient` / `BridgClient` with one method per public endpoint: markets, quote and
  execute, large orders, Hyperliquid, sessions and orders, realtime, data.
- `waitForTransfer`, which polls a transfer until it reaches a terminal status.
- `BridgError` carrying the API's `code`, `status`, `details` and `retryAfterMs`.
- Request and response types generated from the API's OpenAPI document.

[Unreleased]: https://github.com/Kernlog/bridg-sdk/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Kernlog/bridg-sdk/releases/tag/v0.1.0
