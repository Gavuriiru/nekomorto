# RATE_LIMITING Fix Plan

## Changes

- `server/bootstrap/create-server-platform-runtime.js` - standardized trusted client IP normalization
- `server/lib/register-auth-routes.js` - continued auth throttling through the trusted IP helper
- `server/routes/public/register-public-analytics-routes.js` - switched rate-limit identity to trusted IP helper
- `server/routes/public/register-public-project-routes.js` - switched project view/poll throttling to trusted IP helper
- `server/routes/content/register-content-comment-routes.js` - switched comment throttling to trusted IP helper
- `server/routes/content/public-posts/register-content-post-view-route.js` - switched post view throttling to trusted IP helper
- `server/routes/content/public-posts/register-content-post-poll-vote-route.js` - switched post poll throttling to trusted IP helper
- `server/routes/upload/register-upload-metadata-routes.js` - switched upload throttling to trusted IP helper
- `server/routes/upload/register-upload-management-routes.js` - switched upload-from-url throttling to trusted IP helper
- `server/routes/user/register-user-bootstrap-owner-routes.js` - switched bootstrap throttling to trusted IP helper

## New files

- `src/server/create-server-platform-runtime.test.ts` - verifies IP normalization/trust behavior

## Verification goals

- [x] Login attempts are rate limited
- [x] Upload, comment, bootstrap, public view, and public poll routes are rate limited
- [x] Rejected requests return `429`
- [x] Spoofed `X-Forwarded-For` is not used directly as the limiter key
- [x] Focused rate-limit/runtime tests pass

## Manual verification (for the human)

- Repeatedly hit a rate-limited route such as `/api/uploads/image-from-url` or `/auth/discord` and confirm a `429` response.
- Validate the reverse proxy in production sets `req.ip` correctly for the application.

