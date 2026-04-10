# CORS Fix Plan

## Changes

No additional application code changes were required after the audit.

## New files

No new application files were required.

## Verification goals

- [x] CORS origin uses an explicit allowlist
- [x] No wildcard origin is used
- [x] `credentials: true` is returned only for allowlisted origins
- [x] Non-allowlisted origins fail CORS evaluation

## Manual verification (for the human)

- Send one request from an allowlisted origin and one from a non-allowlisted origin, then compare the `Access-Control-Allow-Origin` behavior.
