# AUTH_MIDDLEWARE Security Report

## Status: PASS

## Findings

A route-by-route inventory was built from `server/routes/` and the registrar files under `server/lib/register-*.js`. Public content remains public, and protected user/admin/editor flows now consistently enforce auth before handlers.

Key protected registrars/files reviewed:

- [server/lib/register-auth-routes.js](/d:/dev/nekomorto/server/lib/register-auth-routes.js)
- [server/lib/register-session-routes.js](/d:/dev/nekomorto/server/lib/register-session-routes.js)
- [server/lib/register-self-service-routes.js](/d:/dev/nekomorto/server/lib/register-self-service-routes.js)
- [server/routes/user/register-user-management-routes.js](/d:/dev/nekomorto/server/routes/user/register-user-management-routes.js)
- [server/routes/user/register-user-list-routes.js](/d:/dev/nekomorto/server/routes/user/register-user-list-routes.js)
- [server/routes/user/register-user-self-routes.js](/d:/dev/nekomorto/server/routes/user/register-user-self-routes.js)
- [server/routes/user/register-user-owner-routes.js](/d:/dev/nekomorto/server/routes/user/register-user-owner-routes.js)
- [server/routes/project/](/d:/dev/nekomorto/server/routes/project)
- [server/routes/content/](/d:/dev/nekomorto/server/routes/content)
- [server/routes/upload/](/d:/dev/nekomorto/server/routes/upload)
- [server/routes/admin/](/d:/dev/nekomorto/server/routes/admin)
- [server/routes/register-integration-routes.js](/d:/dev/nekomorto/server/routes/register-integration-routes.js)
- [server/routes/register-site-config-routes.js](/d:/dev/nekomorto/server/routes/register-site-config-routes.js)

Public routes inventoried as intentionally unauthenticated:

- `GET /api/public/bootstrap`
- `GET /api/public/search/suggest`
- `GET /api/public/projects`
- `GET /api/public/projects/:id`
- `POST /api/public/projects/:id/view`
- `GET /api/public/projects/:id/chapters/:number`
- `POST /api/public/projects/:id/chapters/:number/polls/vote`
- `GET /api/public/posts`
- `GET /api/public/posts/:slug`
- `POST /api/public/posts/:slug/view`
- `POST /api/public/posts/:slug/polls/vote`
- `GET /api/public/comments`
- `POST /api/public/comments`
- `GET /api/public/settings`
- `GET /api/public/pages`
- `GET /api/public/users`
- `GET /api/public/me`
- health, sitemap, RSS, OG, static app fallback, and manifest routes

Protected routes inventoried as requiring auth or stronger:

- `GET /api/me`
- `GET/PUT /api/me/preferences`
- `GET /api/me/security`
- `POST /api/me/security/totp/enroll/start`
- `POST /api/me/security/totp/enroll/confirm`
- `POST /api/me/security/totp/disable`
- `GET /api/me/sessions`
- `DELETE /api/me/sessions/others`
- `DELETE /api/me/sessions/:sid`
- `POST /api/users`
- `PUT /api/users/reorder`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`
- `PUT /api/users/self`
- `GET/PUT/POST /api/owners*`
- all `/api/projects`, `/api/posts`, `/api/comments`, `/api/uploads`, `/api/settings`, `/api/pages`, `/api/integrations/webhooks`, `/api/admin/*`, `/api/analytics/*`, and editorial/security/admin export routes

Issues found and remediated during the audit:

1. `PUT /api/users/:id` previously checked auth inside the handler instead of mounting `requireAuth` first.
2. `GET /api/me` previously performed its session check in-handler rather than through pre-handler middleware.
3. `POST /api/auth/mfa/verify` previously relied on an in-handler pending-MFA guard instead of a dedicated pre-handler gate.

Remediation snippets:

```diff
- app.put("/api/users/:id", (req, res) => {
-   if (!req.session?.user) {
-     return res.status(401).json({ error: "unauthorized" });
-   }
+ app.put("/api/users/:id", requireAuth, (req, res) => {
```

```diff
- router.get("/api/me", (req, res) => {
+ router.get("/api/me", requireUserSessionOrPendingMfa, (req, res) => {
```

```diff
- router.post("/api/auth/mfa/verify", async (req, res) => {
+ router.post("/api/auth/mfa/verify", requirePendingMfaSession, async (req, res) => {
```

Verification results:

- Focused security suite passed with `18` files and `82` tests green, including:
  - [src/server/register-session-routes.test.ts](/d:/dev/nekomorto/src/server/register-session-routes.test.ts)
  - [src/server/register-user-routes.test.ts](/d:/dev/nekomorto/src/server/register-user-routes.test.ts)
  - [src/server/register-upload-routes.test.ts](/d:/dev/nekomorto/src/server/register-upload-routes.test.ts)
  - [src/server/register-content-routes.test.ts](/d:/dev/nekomorto/src/server/register-content-routes.test.ts)
- Unauthenticated access to protected routes now fails before business logic runs.
- Role failures on admin/owner routes continue to return `403`.

## What's at risk

Without pre-handler auth middleware, protected endpoints can drift into inconsistent behavior, leak user data on refactors, or run sensitive logic before returning `401`.

## What's already secure

- Public routes are clearly separated from protected admin/editor/self-service routes.
- `requireAuth` and `requirePrimaryOwner` are used broadly across protected registrars.
- Pending-MFA requests are constrained by dedicated API guards and middleware.

## Recommendations

1. Keep auth/session validation in middleware, not inline inside handlers.
2. Keep the route inventory updated whenever new `/api` endpoints are added.
3. Add a review checklist item requiring explicit public/protected classification for every new route.
