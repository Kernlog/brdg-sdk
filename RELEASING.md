# Releasing

No CI. Releases are cut by hand from a clean `main`.

1. Move the `[Unreleased]` entries in `CHANGELOG.md` under a new version heading with today's date.
2. Bump `version` in `package.json` and `SDK_VERSION` in `src/constants.ts` to match.
3. `pnpm check` must pass: typecheck, lint, tests, build.
4. Commit as `release: vX.Y.Z`, then tag and publish the GitHub release:
   `git tag vX.Y.Z && git push --tags && gh release create vX.Y.Z --notes-from-tag`
5. Publish to npm: `pnpm publish --access public` (runs the build through `prepack`).
