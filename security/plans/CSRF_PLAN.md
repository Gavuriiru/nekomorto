# CSRF Fix Plan

## Changes

No additional application code changes were required after the audit.

## New files

No new application files were required.

## Verification goals

- [x] Session cookies use `SameSite=Lax`
- [x] Mutating API routes enforce same-origin validation in production
- [x] Cross-origin form/API posts to state-changing endpoints fail the origin check

## Manual verification (for the human)

- From a different origin in a browser, attempt a form POST to a mutating `/api` endpoint and confirm the app returns `403` with `csrf`.
