# FRONTEND_SECRETS Security Report

## Status: PASS

## Findings

The frontend does not contain embedded secret keys and sends sensitive operations through backend routes.

- Client env usage in `src/` is limited to non-secret flags and base URL configuration:
  - [src/lib/api-base.ts](/d:/dev/nekomorto/src/lib/api-base.ts)
  - [src/config/autosave.ts](/d:/dev/nekomorto/src/config/autosave.ts)
  - [src/lib/frontend-build.ts](/d:/dev/nekomorto/src/lib/frontend-build.ts)
  - [src/lib/access-control.ts](/d:/dev/nekomorto/src/lib/access-control.ts)
- The audited `VITE_*` variables do not hold secrets.
- Frontend API access goes through backend endpoints via helpers such as [src/lib/api-client.ts](/d:/dev/nekomorto/src/lib/api-client.ts), not direct third-party secret-bearing calls.
- Webhook configuration in [src/pages/DashboardWebhooks.tsx](/d:/dev/nekomorto/src/pages/DashboardWebhooks.tsx) stores URLs but still submits test/send actions to backend `/api/integrations/webhooks/*` routes.

Representative safe env snippet:

```env
VITE_API_BASE=
VITE_PWA_DEV_ENABLED=false
VITE_DASHBOARD_AUTOSAVE_ENABLED=true
VITE_RBAC_V2_ENABLED=false
```

Verification results:

- No secret API keys were found under `src/`, `public/`, or client config.
- No `NEXT_PUBLIC_*`, `VITE_*`, or `REACT_APP_*` secret variable was found.
- Sensitive operations flow through backend routes instead of browser-side secret requests.

## What's at risk

If a frontend secret is bundled, every site visitor can recover and abuse it. That could expose third-party APIs, storage, or privileged webhooks.

## What's already secure

- Client code uses publishable/non-secret runtime flags only.
- Backend routes handle privileged integrations and authenticated mutations.
- No hardcoded client-side bearer tokens or secret keys were found.

## Recommendations

1. Keep privileged third-party integrations behind server routes.
2. Treat any future `VITE_*` addition as public by default during review.
3. Keep frontend secret scanning in CI for `src/`, `public/`, and build config.
