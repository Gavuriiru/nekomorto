# RATE_LIMITING Security Report

## Status: PASS

## Findings

Rate limiting is present on the app's sensitive unauthenticated and abuse-prone surfaces, and IP resolution now ignores spoofed `X-Forwarded-For`.

Runtime buckets are defined in [server/lib/rate-limit-runtime.js](/d:/dev/nekomorto/server/lib/rate-limit-runtime.js):

```js
const canAttemptAuth = async (ip) => consumeIpRateLimit({
  bucket: "auth_attempt",
  ip,
  maxPerWindow: isProduction ? 20 : 120,
});
```

```js
const canUploadImage = async (ip) => consumeIpRateLimit({ bucket: "upload_image", ... });
const canSubmitComment = async (ip) => consumeIpRateLimit({ bucket: "comment_submit", ... });
const canBootstrap = async (ip) => consumeIpRateLimit({ bucket: "bootstrap_owner", ... });
const canRegisterView = async (ip) => consumeIpRateLimit({ bucket: "register_view", ... });
const canRegisterPollVote = async (ip) => consumeIpRateLimit({ bucket: "poll_vote", ... });
```

Trusted IP resolution now comes from [server/bootstrap/create-server-platform-runtime.js](/d:/dev/nekomorto/server/bootstrap/create-server-platform-runtime.js):

```js
export const getRequestIp = (req) => normalizeRequestIp(req?.ip);
```

Routes updated to use the trusted helper include:

- auth login in [server/lib/register-auth-routes.js](/d:/dev/nekomorto/server/lib/register-auth-routes.js)
- bootstrap owner in [server/routes/user/register-user-bootstrap-owner-routes.js](/d:/dev/nekomorto/server/routes/user/register-user-bootstrap-owner-routes.js)
- comment submission in [server/routes/content/register-content-comment-routes.js](/d:/dev/nekomorto/server/routes/content/register-content-comment-routes.js)
- upload routes in [server/routes/upload/register-upload-metadata-routes.js](/d:/dev/nekomorto/server/routes/upload/register-upload-metadata-routes.js) and [server/routes/upload/register-upload-management-routes.js](/d:/dev/nekomorto/server/routes/upload/register-upload-management-routes.js)
- public analytics/view/poll routes in `server/routes/public/*` and `server/routes/content/public-posts/*`

Registration and password-reset routes were not found in this app, so those specific checklist items are not applicable.

Verification results:

- Spoofed `X-Forwarded-For` is no longer used directly for rate limiting.
- Protected rate-limited routes return `429` when the limiter rejects.
- Tests passed in:
  - [src/server/create-server-platform-runtime.test.ts](/d:/dev/nekomorto/src/server/create-server-platform-runtime.test.ts)
  - [src/server/register-upload-routes.test.ts](/d:/dev/nekomorto/src/server/register-upload-routes.test.ts)
  - [src/server/register-user-routes.test.ts](/d:/dev/nekomorto/src/server/register-user-routes.test.ts)
  - [src/server/register-public-routes.test.ts](/d:/dev/nekomorto/src/server/register-public-routes.test.ts)

## What's at risk

Weak or bypassable rate limiting would increase brute-force and spam risk across auth, comments, uploads, and public analytics/view counters.

## What's already secure

- Login attempts are throttled.
- Comments, uploads, bootstrap-owner, public views, and poll votes are throttled.
- Rate limiting keys now use trusted Express IP resolution instead of raw forwarded headers.

## Recommendations

1. Keep proxy trust settings aligned with the real reverse-proxy topology.
2. Preserve the trusted `getRequestIp` helper for any future rate-limited route.
3. Revisit per-bucket thresholds periodically based on production traffic.
