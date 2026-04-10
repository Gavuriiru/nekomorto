# CORS Security Report

## Status: PASS

## Findings

CORS is constrained by an explicit origin allowlist and is not configured with a wildcard.

- [server/lib/cors-policy.js](/d:/dev/nekomorto/server/lib/cors-policy.js) computes per-request CORS options from the configured allowlist.
- [server/lib/register-runtime-middleware.js](/d:/dev/nekomorto/server/lib/register-runtime-middleware.js) mounts CORS only for `/api` and `/auth`.

Current logic:

```js
if (!isCorsRequestAllowed({ origin, method, isProduction, isAllowedOriginFn })) {
  return null;
}

return {
  origin: normalizeString(origin) ? true : false,
  credentials: true,
};
```

This `origin: true` response reflection is safe here because it is only reached after `isAllowedOriginFn(origin)` has already approved the request origin.

Verification results:

- No wildcard origin is configured.
- `credentials: true` is paired only with validated allowlisted origins.
- CORS tests passed in [src/server/cors-policy.test.ts](/d:/dev/nekomorto/src/server/cors-policy.test.ts).

## What's at risk

Overly broad CORS would let untrusted sites read authenticated responses or abuse cookie-backed APIs.

## What's already secure

- Origin checks are allowlist-based.
- Requests without an allowed origin fail CORS evaluation.
- Credentials are not combined with `*`.

## Recommendations

1. Keep `APP_ORIGIN` tight and environment-specific.
2. Avoid adding catch-all origins for convenience.
3. Re-review CORS whenever a new frontend origin is introduced.
