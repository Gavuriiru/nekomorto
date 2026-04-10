# SSRF Fix Plan

## Changes

No additional application code changes were required after the audit. The current remote-fetch surfaces already use scheme, DNS, redirect, and host validation.

## New files

No new application files were required.

## Verification goals

- [x] User-supplied remote image fetching validates URLs before requesting them
- [x] Private IPv4/IPv6 ranges and localhost are blocked
- [x] Only `http` and `https` schemes are allowed
- [x] Hostnames are resolved and checked before fetch
- [x] Redirect targets are revalidated before follow-up requests

## Manual verification (for the human)

- Attempt a remote image import against `http://127.0.0.1/...` and confirm it fails.
- Attempt a remote image import that redirects to an internal IP and confirm it fails.
