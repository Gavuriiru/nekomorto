# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nekomorto is a web platform for Nekomata with a public area (home, posts, pages, projects catalog, chapter/episode reading) and an authenticated dashboard for internal operations. It is a **DB-only** application where PostgreSQL is the single source of truth.

**Tech Stack**: React 19 + Vite + TypeScript + Tailwind CSS 4 (frontend), Node.js/Express (backend), PostgreSQL + Prisma ORM (database), Discord OAuth (auth), connect-pg-simple (sessions).

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

### Quality Checks
```bash
npm run lint                     # Biome linter (formatter disabled in this command)
npm run format                   # Biome format --write
npm run format:check             # Biome format check only
npm run typecheck                # TypeScript 6 (tsc -b)
npm run typecheck:ts7-preview    # TypeScript 7 native preview (non-blocking)
npm run test                     # Vitest unit tests
npm run test:a11y                # Accessibility tests (axe-core)
npm run test:watch               # Vitest watch mode
```

### Database
```bash
npm run prisma:generate          # Generate Prisma client
npm run prisma:migrate:deploy    # Apply migrations
npm run db:backup                # Snapshot database to backups/
```

### Health and Validation
```bash
npm run api:health:check -- --base=http://localhost:8080 --expect-source=db --expect-maintenance=false
npm run api:smoke -- --base=http://localhost:8080
npm run uploads:check-integrity              # Validate uploads (default: fast mode)
npm run uploads:check-integrity -- --mode=deep  # Deep validation with remote checks
```

### Lighthouse Performance
```bash
npm run lighthouse:home:mobile
npm run lighthouse:projects:mobile
npm run lighthouse:projects:desktop
npm run lighthouse:dashboard:desktop
npm run lighthouse:reader-pages:mobile
```

## Architecture

### Directory Structure
- `src/` - React frontend (pages, components, hooks, routes, lib, styles)
- `server/` - Express backend (`index.js` entry + `routes/` + `lib/`)
- `shared/` - Utilities shared between frontend and backend runtime
- `prisma/` - Prisma schema and migrations
- `ops/` - Docker compose files, deployment scripts, runbooks
- `docs/` - Schema docs, migration runbooks, audit reports
- `public/` - Static assets, uploads directory
- `scripts/` - Build, deployment, and maintenance scripts

### Frontend Routing
- Public routes: `src/routes/PublicRoutes.tsx`
- Dashboard routes: `src/routes/DashboardRoutes.tsx`
- Path alias: `@/` maps to `src/`

### Backend Routes
Organized by domain in `server/routes/`:
- `register-app-routes.js` - Main app routes (session, contracts)
- `register-public-routes.js` - Public API endpoints
- `register-content-routes.js` - Posts, pages CRUD
- `register-project-routes.js` - Projects, chapters, episodes
- `register-user-routes.js` - User management
- `register-admin-routes.js` - Admin operations
- `register-upload-routes.js` - File uploads
- `register-og-routes.js` - Open Graph image generation
- `register-integration-routes.js` - External integrations

### Database Models (Prisma)
Key models in `prisma/schema.prisma`:
- `PostRecord`, `PostVersionRecord` - Posts with versioning
- `ProjectRecord` - Projects
- `UserRecord` - Users with access roles
- `CommentRecord` - Comments
- `UploadRecord` - Upload metadata
- Sessions stored in `user_sessions` (connect-pg-simple)

### React Contexts (hooks/)
- `site-settings-context.ts` - Site configuration
- `dashboard-preferences-context.ts` - Dashboard user preferences
- `dashboard-session-context.ts` - Dashboard auth session
- `theme-mode-context.ts` - Theme (light/dark)
- `global-shortcuts-context.ts` - Keyboard shortcuts

### Component Pattern
Tests are colocated with components using the pattern:
- `ComponentName.tsx` - Component implementation
- `ComponentName.test.tsx` - Unit tests
- `ComponentName.xxx.test.tsx` - Specific feature tests

## Key Conventions

### Environment Variables
- Development: `.env` (copy from `.env.example`)
- Production: `.env.prod` or Docker env
- Required: `DATABASE_URL`, in production also `APP_ORIGIN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, and either `OWNER_IDS` or `BOOTSTRAP_TOKEN`

### Dev vs Production Modes
- `npm run dev`: Vite dev middleware injected into Express, HMR on same origin, OAuth returns to same origin
- `npm run start`: Requires built `dist/`, static file serving only

### Uploads
- Public contract: `/uploads/...` regardless of storage backend
- `UPLOAD_STORAGE_DRIVER`: `local` (default) or `s3`
- Delivery always via proxy (`UPLOAD_STORAGE_DELIVERY=proxy`)

### Biome Configuration
- Formatter: 2-space indent, 100 char line width, double quotes, semicolons always
- Linter: `noUnusedVariables: off` (handled by TypeScript)
- Excludes: `backups/`, `dev-dist/`, `dist/`, `node_modules/`, `public/uploads/`, `server/data/`, `src/lexical-playground/`

### Testing
- Vitest with jsdom environment
- Setup file: `src/test/setup.ts`
- a11y tests use `jest-axe` and run separately via `test:a11y`

## Production Deployment

Docker Compose with PostgreSQL + app container + reverse proxy (Caddy/Traefik/Nginx via profiles):

```bash
# Deploy sequence (example with caddy profile)
docker compose --env-file .env.prod -f docker-compose.prod.yml --profile caddy up -d postgres
docker compose --env-file .env.prod -f docker-compose.prod.yml --profile caddy run --rm app npm run prisma:migrate:deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml --profile caddy run --rm app npm run uploads:check-integrity -- --mode=fast
docker compose --env-file .env.prod -f docker-compose.prod.yml --profile caddy up -d
```

## References

- `README.md` - Full setup, deployment, and troubleshooting guide (PT-BR)
- `docs/SCHEMA.md` - Database schema documentation
- `docs/wcag-2.2-aa-audit-matrix.md` - Accessibility audit matrix
- `ops/postgres/README.md` - Backup/restore procedures