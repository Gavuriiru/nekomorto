# PASSWORD_HASHING Security Report

## Status: N/A

## Findings

No local username/password authentication flow was found in the current application.

- Authentication is based on Discord OAuth plus server sessions:
  - [server/lib/register-auth-routes.js](/d:/dev/nekomorto/server/lib/register-auth-routes.js)
  - [server/lib/session-cookie-config.js](/d:/dev/nekomorto/server/lib/session-cookie-config.js)
- MFA uses TOTP and recovery codes:
  - [server/lib/totp.js](/d:/dev/nekomorto/server/lib/totp.js)
  - [server/lib/auth-security-runtime.js](/d:/dev/nekomorto/server/lib/auth-security-runtime.js)

Hashing code found during the audit applies to non-password use cases such as:

- Gravatar email hashing
- analytics IP hashing
- idempotency/revision hashing
- TOTP/recovery-code support

No password creation, password verification, or password reset handler was found.

## What's at risk

If local passwords are added later without a strong password hasher, users could be exposed to credential cracking after any database leak.

## What's already secure

- No local password database is currently exposed.
- Authentication relies on OAuth sessions plus MFA rather than storing password hashes.

## Recommendations

1. If local passwords are ever introduced, use Argon2, bcrypt, or scrypt only.
2. Add password-reset and password-policy reviews before shipping any credential auth flow.
