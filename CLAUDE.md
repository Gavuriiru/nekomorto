# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Antigravity when working with code in this repository.

## Project Overview

Nekomorto is a web platform for Nekomata with a public area (home, posts, pages, projects catalog, chapter/episode reading) and an authenticated dashboard for internal operations. It is a **DB-only** application where PostgreSQL is the single source of truth.

**Tech Stack**: React 19 + Vite + TypeScript + Tailwind CSS 4 (frontend), Node.js/Express (backend), PostgreSQL + Prisma ORM (database), Discord OAuth (auth), connect-pg-simple (sessions).

> [!IMPORTANT]
> **No Redis**: This project intentionally does not use Redis. Rate limiting and caching are handled in-memory (optimized for single-instance deployments).

## Development Commands

### Setup and Development
```bash
npm install                      # Install dependencies
npm run setup:dev                # First-time setup (Docker Postgres + .env + migrations + dev)
npm run dev                      # Integrated mode: backend + frontend on port 8080
npm run dev:server               # Backend only on port 8080
npm run dev:client               # Frontend only on port 5173
npm run dev:client:local-api     # Frontend on 5173 with API pointing to localhost:8080
```

### Build and Production
```bash
npm run build                    # Production build (includes PWA + chunk validation)
npm run start                    # Production server (requires NODE_ENV=production + built dist/)
npm run preview                  # Preview Vite build locally
```

### Quality and Maintenance
```bash
npm run lint                     # Biome linter (formatter disabled in this command)
npm run format                   # Biome format --write
npm run format:check             # Biome format check only
npm run typecheck                # TypeScript 6 (tsc -b)
npm run typecheck:ts7-preview    # TypeScript 7 native preview (non-blocking)
npm run test                     # Vitest unit tests
npm run test:a11y                # Accessibility tests (axe-core)
npm run test:watch               # Vitest watch mode
npm run staging:parity:check     # Check configuration parity with staging
```

### Database and Backfill
```bash
npm run prisma:generate          # Generate Prisma client
npm run prisma:migrate:deploy    # Apply migrations
npm run db:backup                # Snapshot database to backups/
npm run db:backfill:normalized   # Normalize runtime data in database
npm run projects:backfill:anilist # Sync project metadata with AniList
```

### Uploads and Assets
```bash
npm run uploads:check-integrity              # Validate uploads (default: fast mode)
npm run uploads:check-integrity -- --mode=deep # Deep validation with remote checks
npm run uploads:reorganize                   # Organize upload folders
npm run uploads:sync-to-object-storage       # Sync local uploads to S3/R2
npm run uploads:localize-project-images      # Download remote images to local/S3 storage
```

### Performance and Lighthouse
```bash
npm run lighthouse:home:mobile
npm run lighthouse:public-surface            # Complete scan of all public pages
npm run lighthouse:public-surface:compare    # Compare current performance with baseline
npm run lighthouse:public-surface:accept     # Accept current performance as new baseline
```

## Architecture

### The "Hero Shell" Pattern
A critical part of the UX is the **Hero Shell**. A minimal, server-injected HTML shell is served immediately to prevent layout shifts (CLS) and "black flashes" before React hydrates.
- Logic is in `src/lib/home-hero.ts`.
- Transitions must be seamless and flicker-free.

### Directory Structure
- `src/` - React frontend (pages, components, hooks, routes, lib, styles)
- `server/` - Express backend (`index.js` entry + `routes/` + `lib/`)
- `shared/` - Utilities shared between frontend and backend runtime
- `prisma/` - Prisma schema and migrations
- `ops/` - Docker compose files, deployment scripts, runbooks
- `docs/` - Schema docs, migration runbooks, audit reports
- `scripts/` - Build, deployment, and maintenance scripts

### Path Aliases
- `@/` maps to `src/`

## Key Conventions

### Security Guardrails
> [!CAUTION]
> All code MUST adhere to the operational guardrails defined in [AGENTS.md](file:///d:/dev/nekomorto/AGENTS.md), especially the mandatory security section.
> - No secrets in frontend.
> - Parameterized queries always.
> - Auth middleware before handlers.

### Operational Scripts
When performing maintenance or one-off tasks, look into `scripts/` for inspiration or use a `scratch-*.mjs` file in the root for temporary debugging (automatically ignored by most linting/build tools).

### Biome Configuration
- Formatter: 2-space indent, 100 char line width, double quotes, semicolons always.
- Excludes: `backups/`, `dev-dist/`, `dist/`, `node_modules/`, `public/uploads/`.

## Testing
- Vitest with jsdom environment.
- Setup file: `src/test/setup.ts`.
- a11y tests run separately via `test:a11y`.

## Deployment
Managed via `ops/prod/deploy-prod.sh` and GitHub Actions. Uses Caddy/Traefik as reverse proxies by default.
