# DEPENDENCIES Fix Plan

## Changes

- `package.json` - pinned dependencies to exact versions and added `dompurify`
- `package-lock.json` - updated the resolved dependency graph and lockfile
- `scripts/patch-lodash-subpaths.mjs` - added a postinstall compatibility patch required to keep the test environment stable after lockfile refreshes

## New files

- `scripts/patch-lodash-subpaths.mjs` - restores the extensionless lodash subpath expected by the current test toolchain

## Verification goals

- [x] Exact versions are pinned in `package.json`
- [x] `package-lock.json` is committed
- [x] `npm audit --json` shows no critical or high vulnerabilities
- [x] The newly added dependency for XSS hardening was verified on npm before installation

## Manual verification (for the human)

- When adding any future dependency, verify the package on the official npm registry before installing it.

