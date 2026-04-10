# SECURITY_HEADERS Fix Plan

## Changes

No additional application code changes were required after the audit.

## New files

No new application files were required.

## Verification goals

- [x] CSP is present on responses
- [x] HSTS is present on responses
- [x] `X-Frame-Options` is present on responses
- [x] `X-Content-Type-Options` is present on responses
- [x] `Referrer-Policy` is present on responses
- [x] Headers are set from a single global middleware/helper

## Manual verification (for the human)

- Issue a production-mode request to one HTML page and one API route, and confirm the headers are present in the response.
