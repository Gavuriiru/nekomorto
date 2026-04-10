# SECRETS_EXPOSURE Security Report

## Status: PASS

## Findings

The repo is currently in a good state for secret handling.

- [`.gitignore`](/d:/dev/nekomorto/.gitignore) ignores `.env` and `.env.*`, while explicitly allowing [`.env.example`](/d:/dev/nekomorto/.env.example) and [`.env.prod.example`](/d:/dev/nekomorto/ops/prod/.env.prod.example).
- `git ls-files .env` returned nothing.
- `git ls-files .env .env.*` returned only `.env.example`.
- [`.env.example`](/d:/dev/nekomorto/.env.example) contains placeholders or empty values only for `DATABASE_URL`, Discord OAuth secrets, session secrets, storage keys, metrics tokens, and encryption material.
- A repo-wide scan of application source under `src/` and `server/` excluding tests/examples returned no hardcoded API keys, live/test Stripe keys, AWS access keys, bearer tokens, or credential-bearing connection strings.
- Public frontend env vars are limited to non-secret config:
  - `VITE_API_BASE`
  - `VITE_PWA_DEV_ENABLED`
  - `VITE_DASHBOARD_AUTOSAVE_*`
  - `VITE_RBAC_V2_ENABLED`
  - build metadata vars injected at build time

Relevant secure snippets:

```gitignore
.env
.env.*
!.env.example
!ops/prod/.env.prod.example
```

```env
DATABASE_URL=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
SESSION_SECRET=
UPLOAD_STORAGE_SECRET_ACCESS_KEY=
METRICS_TOKEN=
DATA_ENCRYPTION_KEYS_JSON=
```

Verification results:

- `git ls-files .env` returned no tracked `.env` file.
- Secret-pattern `rg` over runtime source returned no matches.
- No `NEXT_PUBLIC_*`, `VITE_*`, or `REACT_APP_*` variable in app source holds a secret.
- [`.env.example`](/d:/dev/nekomorto/.env.example) exists and contains placeholders only.

## What's at risk

If secrets ever move into tracked files or public env vars, attackers could take over Discord OAuth, sessions, storage, database access, metrics, or encryption material. The current audited state does not expose those secrets.

## What's already secure

- Server-side secrets stay in env-backed runtime config.
- Frontend code reads only non-secret `VITE_*` flags.
- Placeholder env examples are present for onboarding without shipping real credentials.

## Recommendations

1. Keep all runtime secrets server-side only and continue blocking `.env` from git.
2. Rotate immediately if any real credential is ever added to examples, docs, or test fixtures by mistake.
3. Keep secret scanning in CI focused on `src/`, `server/`, `scripts/`, and workflow files.
