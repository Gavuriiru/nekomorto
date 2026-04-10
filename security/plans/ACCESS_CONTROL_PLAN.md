# ACCESS_CONTROL Fix Plan

## Changes

No additional application code changes were required after the audit. Existing access-control patterns were validated against the current architecture.

## New files

No new application files were required.

## Verification goals

- [x] Self-service routes bind access to `req.session.user.id`
- [x] Admin/editor resource routes perform explicit capability checks after auth
- [x] Failed ownership or role checks return `403`
- [x] No reviewed resource-ID route grants access solely because the caller is authenticated

## Manual verification (for the human)

- Test one self-service route such as `DELETE /api/me/sessions/:sid` with another user's session id and confirm it fails.
- Test one admin/editor route such as `PUT /api/projects/:id` with a non-privileged account and confirm it returns `403`.
