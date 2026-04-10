# SECURITY_HEADERS Security Report

## Status: PASS

## Findings

The required security headers are applied from a single global runtime middleware.

- [server/lib/security-headers.js](/d:/dev/nekomorto/server/lib/security-headers.js) builds and applies the header set.
- [server/lib/register-runtime-middleware.js](/d:/dev/nekomorto/server/lib/register-runtime-middleware.js) mounts the header middleware globally for production responses.

Current header application:

```js
res.setHeader("X-Content-Type-Options", "nosniff");
res.setHeader("X-Frame-Options", "DENY");
res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
res.setHeader("Content-Security-Policy", buildContentSecurityPolicy(nonce));
```

The CSP also includes:

- `default-src 'self'`
- `frame-ancestors 'none'`
- `object-src 'none'`
- nonce support for inline scripts the server injects into HTML

Verification results:

- The five requested headers are present in the runtime header helper.
- Header application is centralized rather than repeated per route.
- Tests passed in [src/server/security-headers.test.ts](/d:/dev/nekomorto/src/server/security-headers.test.ts).

## What's at risk

Missing headers would weaken browser-side protections against clickjacking, MIME confusion, mixed trust boundaries, and script injection.

## What's already secure

- Headers are set centrally.
- CSP uses a restrictive default source and nonce-aware script policy.
- HSTS, frame protection, type sniffing protection, and referrer policy are all present.

## Recommendations

1. Keep header policy centralized in the runtime middleware.
2. Re-test CSP whenever new third-party embeds or external asset domains are introduced.
3. Continue shipping these headers on all production responses.
