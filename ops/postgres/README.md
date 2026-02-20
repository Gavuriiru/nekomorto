# PostgreSQL Staging (Self-hosted)

This folder contains the staging DB stack and operational scripts for the JSON -> PostgreSQL migration.

## Files

- `docker-compose.staging.yml`: PostgreSQL 16 stack with persistent volume, restart policy, and healthcheck.
- `env.staging.example`: env template used by docker compose.
- `backup.sh`: `pg_dump` backup script with retention pruning.
- `restore.sh`: restore script for `.sql` or `.sql.gz` files.

## Quick start

1. Copy env file:

```bash
cp ops/postgres/env.staging.example ops/postgres/.env.staging
```

2. Set a strong `POSTGRES_PASSWORD` in `ops/postgres/.env.staging`.
3. Start PostgreSQL:

```bash
docker compose \
  --env-file ops/postgres/.env.staging \
  -f ops/postgres/docker-compose.staging.yml \
  up -d
```

4. Confirm health:

```bash
docker compose \
  --env-file ops/postgres/.env.staging \
  -f ops/postgres/docker-compose.staging.yml \
  ps
```

## App connection string

Use this format in the application host:

```text
DATABASE_URL=postgresql://nekomorto_app:<POSTGRES_PASSWORD>@<db-host>:5432/nekomorto
```

Keep `DATA_SOURCE=json` until the cutover window.

## Daily backup

Make scripts executable once:

```bash
chmod +x ops/postgres/backup.sh ops/postgres/restore.sh
```

Run backup manually:

```bash
./ops/postgres/backup.sh
```

Default retention is 7 days (`RETENTION_DAYS=7`).

Example cron (daily at 03:10 UTC):

```bash
10 3 * * * cd /srv/nekomorto && /srv/nekomorto/ops/postgres/backup.sh >> /var/log/nekomorto-pg-backup.log 2>&1
```

## Restore example

```bash
./ops/postgres/restore.sh ops/postgres/backups/nekomorto_YYYYMMDDTHHMMSSZ.sql.gz
```

## Network hardening

- Default bind is `127.0.0.1` (see `POSTGRES_BIND_IP`).
- If app and DB are in different hosts, bind on private network IP and restrict `5432/tcp` to the application host only.
- Block public ingress to PostgreSQL from the internet.
