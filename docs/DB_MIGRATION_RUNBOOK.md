# DB Migration Runbook (JSON -> PostgreSQL + Prisma)

This runbook implements the staging-first strategy and is aligned with the operational scripts in this repo.

## Scope and defaults

- Scope: staging first, then production.
- Quality gate: block only on errors; warnings are not blockers.
- Infra model: self-hosted PostgreSQL using Docker Compose.
- No dual-write: app runs with one data source at a time (`json` or `db`).
- Parity policy: strict parity is required only during cutover window (before reopening writes).

## Phase 1 - Provision staging PostgreSQL

1. Prepare DB host.
2. Configure stack files under `ops/postgres/`.
3. Copy env and set secret:

```bash
cp ops/postgres/env.staging.example ops/postgres/.env.staging
```

4. Start database:

```bash
docker compose --env-file ops/postgres/.env.staging -f ops/postgres/docker-compose.staging.yml up -d
```

5. Confirm container health:

```bash
docker compose --env-file ops/postgres/.env.staging -f ops/postgres/docker-compose.staging.yml ps
```

## Phase 2 - Configure app (still JSON)

Set app env in staging:

```text
DATABASE_URL=postgresql://nekomorto_app:<POSTGRES_PASSWORD>@<db-host>:5432/nekomorto
DATA_SOURCE=json
MAINTENANCE_MODE=false
```

Deploy/restart app to validate runtime configuration.

## Phase 3 - Pre-cutover checks

```bash
npm run db:staging:precutover
```

Equivalent manual commands:

```bash
npm run db:preflight
npm run db:migrate:json:dry-run
```

Acceptance:

- `db:preflight` has no errors.
- dry-run completes successfully.

## Phase 4 - Prepare schema in PostgreSQL

```bash
npm run db:staging:prepare-schema
```

Equivalent manual commands:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npx prisma migrate status
```

Acceptance:

- `prisma migrate status` without pending migrations.

## Phase 5 - Cutover window (staging)

1. Enable maintenance mode in app env:

```text
MAINTENANCE_MODE=true
```

2. Run cutover:

```bash
npm run db:staging:cutover
```

Equivalent manual commands:

```bash
node scripts/backup-data.mjs
npm run db:hash:snapshot
npm run db:migrate:json:apply
npm run db:verify:parity:strict
```

3. Switch data source and restart app:

```text
DATA_SOURCE=db
```

4. Validate health and smoke:

```bash
npm run db:staging:health:maintenance -- --base=https://staging.example.com
npm run db:staging:smoke -- --base=https://staging.example.com
```

5. Disable maintenance mode and validate again:

```text
MAINTENANCE_MODE=false
```

```bash
npm run db:staging:health:open -- --base=https://staging.example.com
npm run db:staging:smoke -- --base=https://staging.example.com
```

## Phase 6 - Functional validation

- Validate write flows in dashboard (post/project/comment/user).
- Restart app and confirm persistence.
- Observe Prisma/DB logs for at least 24 hours.
- Optional non-blocking audit after reopening writes:

```bash
npm run db:verify:parity:postcutover
```

## Phase 7 - Production promotion

Repeat phases 2-6 in production with a scheduled maintenance window.

Final blockers before opening writes:

- `db:verify:parity:strict` must have `differences: []`.
- smoke checks must pass.

## Rollback note

Safe instant rollback exists only before reopening writes on `DATA_SOURCE=db`.
After reopening writes, rollback requires reconciliation planning.
