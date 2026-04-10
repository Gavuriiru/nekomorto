# AUTH_MIDDLEWARE Fix Plan

## Changes

- `server/routes/user/register-user-management-routes.js` - mounted `requireAuth` before `PUT /api/users/:id`
- `server/lib/register-session-routes.js` - added pre-handler session-or-pending-MFA middleware for `GET /api/me`
- `server/lib/register-auth-routes.js` - added pre-handler pending-MFA middleware for `POST /api/auth/mfa/verify`
- `src/server/register-session-routes.test.ts` - added regression coverage for `/api/me`
- `src/server/register-user-routes.test.ts` - retained middleware assertions around protected user routes

## New files

- `src/server/register-session-routes.test.ts` - verifies `/api/me` is guarded before handler execution

## Verification goals

- [x] Every route that returns or modifies protected user data has auth middleware before the handler
- [x] Unauthenticated requests to protected routes return `401`
- [x] Non-admin/non-owner requests to privileged routes return `403`
- [x] Pending-MFA verification is gated before handler execution
- [x] Focused auth/security regression tests pass

## Manual verification (for the human)

- Call `GET /api/me` without a session and confirm it returns `401` immediately.
- Call `PUT /api/users/:id` without a session and confirm it returns `401`.
- Attempt an owner/admin route with a normal account and confirm it returns `403`.

