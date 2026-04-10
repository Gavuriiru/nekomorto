# ACCESS_CONTROL Security Report

## Status: PASS

## Findings

Resource-ID routes were reviewed for both authentication and post-auth authorization. This project uses a mix of self-scoped ownership checks and explicit admin/editor role checks, which is correct for its CMS-style architecture.

Self-scoped routes:

- [server/routes/user/register-user-self-routes.js](/d:/dev/nekomorto/server/routes/user/register-user-self-routes.js) updates only `req.session.user.id` through `PUT /api/users/self`
- [server/lib/register-self-service-routes.js](/d:/dev/nekomorto/server/lib/register-self-service-routes.js) operates on the authenticated user for preferences, MFA, and session revocation

Owner/admin-scoped routes:

- [server/routes/admin/register-security-routes.js](/d:/dev/nekomorto/server/routes/admin/register-security-routes.js) requires `requireAuth` plus `isOwner`, `isPrimaryOwner`, or `canManageSecurityAdmin`
- [server/routes/user/register-user-management-routes.js](/d:/dev/nekomorto/server/routes/user/register-user-management-routes.js) pairs `requireAuth` with owner/admin/RBAC capability checks before updating or deleting another user
- [server/routes/project/write/register-project-write-project-routes.js](/d:/dev/nekomorto/server/routes/project/write/register-project-write-project-routes.js) requires `requireAuth` plus `canManageProjects`
- [server/routes/content/register-content-comment-routes.js](/d:/dev/nekomorto/server/routes/content/register-content-comment-routes.js) requires `requireAuth` plus `canManageComments` for moderation actions
- [server/routes/upload/register-upload-metadata-routes.js](/d:/dev/nekomorto/server/routes/upload/register-upload-metadata-routes.js) and [server/routes/upload/register-upload-management-routes.js](/d:/dev/nekomorto/server/routes/upload/register-upload-management-routes.js) require `requireAuth` plus `resolveRequestUploadAccessScope` or `canManageUploads`

Representative current checks:

```js
const index = users.findIndex((user) => user.id === String(sessionUser.id));
```

```js
if (!isOwner(actorId)) {
  return res.status(403).json({ error: "forbidden" });
}
```

```js
if (!canManageProjects(sessionUser?.id)) {
  return res.status(403).json({ error: "forbidden" });
}
```

Important architecture note:

- The checklist's `current_user.id == resource.owner_id` model applies to self-service resources here.
- Shared admin/editor resources such as projects, posts, exports, webhooks, and security events are intentionally role-protected rather than owner-protected.
- No route was found where simple authentication alone implicitly grants write access to another user's self-scoped resource.

Verification results:

- Self-service routes use the current session user as the lookup key.
- Resource-ID admin/editor routes apply explicit capability checks after auth.
- Failing ownership/role checks returns `403`.

## What's at risk

Missing post-auth authorization on resource IDs would allow horizontal privilege escalation, such as editing another user's profile, revoking unrelated sessions, or modifying protected content.

## What's already secure

- Self-only user/session routes are bound to the current session identity.
- Admin/editor resources are explicitly role-gated.
- Upload and comment moderation endpoints enforce scope/permission checks after auth.

## Recommendations

1. Continue treating self-service ownership checks and admin/editor role checks as separate concerns.
2. Keep role/capability checks adjacent to each resource-ID route for auditability.
3. Add route-level tests whenever a new `:id` or `:sid` endpoint is introduced.
