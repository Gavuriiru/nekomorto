# CSRF Security Report

## Status: PASS

## Findings

The app protects state-changing API routes with a layered cookie and origin model rather than synchronizer tokens.

- [server/lib/session-cookie-config.js](/d:/dev/nekomorto/server/lib/session-cookie-config.js) sets:
  - `httpOnly: true`
  - `sameSite: "lax"`
  - `secure: true` in production and `"auto"` in development
- [server/lib/register-runtime-middleware.js](/d:/dev/nekomorto/server/lib/register-runtime-middleware.js) applies a global same-origin gate to mutating `/api` requests in production.

Current controls:

```js
cookie: {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction ? true : "auto",
  path: "/",
}
```

```js
if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
  return next();
}
...
if (!origin || !isAllowedOrigin(origin)) {
  return res.status(403).json({ error: "csrf" });
}
```

Verification results:

- Session cookies are `SameSite=Lax`.
- Mutating `/api` requests require an allowed origin/referer in production.
- Cookie/session config tests passed in [src/server/session-cookie-config.test.ts](/d:/dev/nekomorto/src/server/session-cookie-config.test.ts).

## What's at risk

Without SameSite protection or a same-origin gate, a third-party site could trick a logged-in browser into submitting authenticated cross-site POST/PUT/PATCH/DELETE requests.

## What's already secure

- Session cookies are not readable by JavaScript.
- SameSite is set to `lax`.
- Production API mutations are blocked when the request origin is not allowlisted.

## Recommendations

1. Keep the same-origin middleware mounted globally for all `/api` mutations.
2. Preserve `SameSite=Lax` or move to `Strict` only if product requirements allow it.
3. Revisit token-based CSRF protection only if cross-site authenticated embeds become a product requirement.
