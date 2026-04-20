# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project summary

Nekomorto is a DB-only editorial and reading platform for Nekomata.

- Public surface: home, posts, institutional pages, projects catalog, and chapter/episode reading.
- Authenticated surface: internal dashboard for content, users, uploads, analytics, redirects, webhooks, security, and audit log.
- PostgreSQL is the runtime source of truth. Do not introduce parallel authoritative storage.
- Auth and sessions are server-side; sessions are persisted in PostgreSQL via `connect-pg-simple`.
- Uploads may be local or object-storage-backed, but the public contract stays under `/uploads/...`.

Read `AGENTS.md` before making changes that affect security, auth, persistence, performance, uploads, or operations. It is the project’s operational contract.

## Environment and toolchain

- Node.js: `24.14.x`
- npm: `11.x`
- TypeScript: `6.0.2`
- Vite: `8`
- React: `19`
- Prisma: `7`

## Common commands

### Install and first-time setup
```bash
npm install
npm run setup:dev
```

`npm run setup:dev` is the preferred first run. It validates Docker/Node/npm, prepares `ops/postgres/.env.staging`, starts local PostgreSQL, ensures `.env`, runs Prisma generate + migrate deploy, and then starts dev mode.

### Local development
```bash
npm run dev                      # integrated app on http://localhost:8080
npm run dev:server               # backend on 8080
npm run dev:client               # frontend only on 5173
npm run dev:client:local-api     # frontend on 5173 against local backend on 8080
```

Prefer `npm run dev`. In dev, the Express server injects Vite middleware, so frontend and API share the same origin on `localhost:8080`.

### Build and production simulation
```bash
npm run build
npm run start
npm run preview
```

`npm run build` is not a plain Vite build: it also builds the PWA bundle, validates chunking, and runs the home-page build guard.

### Quality gates
```bash
npm run lint
npm run format
npm run format:check
npm run typecheck
npm run typecheck:ts7-preview
npm run test
npm run test:a11y
```

### Running a single test
```bash
npm run test -- src/path/to/file.test.tsx
npm run test:a11y -- src/path/to/file.a11y.test.tsx
```

If you need direct Vitest filtering, use:
```bash
npx vitest run src/path/to/file.test.tsx
```

### Database and runtime validation
```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npm run api:health:check -- --base=http://localhost:8080 --expect-source=db --expect-maintenance=false
npm run api:smoke -- --base=http://localhost:8080
```

### Performance and regression checks
```bash
npm run build:audit
npm run lighthouse:home:mobile
npm run lighthouse:projects:mobile
npm run lighthouse:projects:desktop
npm run lighthouse:reader-pages:mobile
npm run lighthouse:dashboard:desktop
npm run lighthouse:public-surface
npm run lighthouse:public-surface:compare
```

Use the Lighthouse scripts when touching public performance, bundle loading, the reader, or the dashboard.

### Upload and media maintenance
```bash
npm run uploads:check-integrity
npm run uploads:check-integrity -- --mode=deep
npm run uploads:reorganize
npm run uploads:sync-to-object-storage
npm run uploads:localize-project-images
```

## Big-picture architecture

### Runtime model

The app is not split into an independent SPA frontend and separate API deployment. The primary runtime is Express in `server/index.js`, which serves the app, owns auth/session state, exposes API and operational endpoints, and in development injects Vite middleware.

That means:
- same-origin behavior matters in development and production;
- server rendering/bootstrap decisions directly affect frontend perceived performance;
- auth, permissions, uploads, health, metrics, and webhooks live in the backend runtime, not in a separate service.

### Frontend structure

Frontend entry is `src/main.tsx`, and the app shell is composed in `src/App.tsx`.

Key route split:
- `src/routes/PublicRoutes.tsx`: public product routes
- `src/routes/DashboardRoutes.tsx`: authenticated dashboard routes

The dashboard bundle is lazy-loaded from `App.tsx`, while public routes are the default path. Dashboard pages are wrapped in client-side auth guards, but protected data must still be enforced on the server.

Shared frontend providers in `App.tsx` handle site settings, theme mode, accessibility announcements, and global shortcuts.

### Bootstrap and public rendering flow

Public rendering is optimized around fast first paint:
- `src/main.tsx` mounts React immediately;
- server-injected bootstrap data can be consumed synchronously when present;
- missing bootstrap data falls back to a background fetch from `/api/public/bootstrap`;
- the home page uses the hero-shell flow from `src/lib/home-hero.ts` to avoid layout shift and startup flicker.

When changing home-page rendering, initial loading, or public bootstrapping, preserve the hero-shell and bootstrap behavior. Regressions here will show up as CLS/flicker/perceived-load regressions even if React logic is otherwise correct.

### Backend composition pattern

`server/index.js` is the runtime assembly point, not just a flat route file. It wires together runtime bundles and registrations such as:
- boot config and platform runtime
- public/content/project/user/webhook runtimes
- operational monitoring and admin export runtimes
- root route registration via `server/bootstrap/register-root-server-routes.js`

A useful mental model is:
1. build runtime dependencies/bundles,
2. group them into route runtime contexts,
3. register direct routes and server routes.

When adding backend behavior, look for the relevant runtime/builder in `server/bootstrap/` or `server/lib/` before expanding `server/index.js` directly.

### Data boundaries

- `server/`: Express runtime, auth, API, uploads, operational endpoints, OG image delivery, webhooks, metrics.
- `src/`: React UI, routes, hooks, styles, client bootstrapping, tests.
- `shared/`: logic shared across server and client runtimes.
- `prisma/`: schema and migrations.
- `scripts/`: setup, audit, smoke, Lighthouse, upload, and backfill tooling.
- `ops/`: Docker, deploy, backup, restore, and operational runbooks.

If logic is needed by both client and server, prefer `shared/` over duplication.

## Project-specific constraints

- PostgreSQL is the only source of truth at runtime.
- Do not introduce Redis or other extra infrastructure without an explicit requirement.
- Keep changes compatible with single-instance deployment assumptions.
- Preserve health/readiness/liveness and existing operational telemetry.
- Public-surface optimizations must not degrade accessibility, observability, or UX stability.

## Code conventions worth remembering

From `CODE_STYLE.md` and current configs:
- formatting is Biome-enforced: 2 spaces, semicolons, double quotes, 100-char line width;
- use the `@/` alias for imports inside `src/`;
- React components use PascalCase filenames;
- hooks use `use-kebab-case.ts` filenames;
- prefer interfaces for object-shaped TypeScript types;
- keep database access through Prisma.

## Testing notes

- Test setup file: `src/test/setup.ts`
- Default Vitest config: `vitest.config.ts`
- Separate accessibility config: `vitest.a11y.config.ts`

Use `npm run test:a11y` whenever changing interaction, focus handling, semantics, keyboard behavior, or contrast-sensitive UI.

## Practical file starting points

When exploring unfamiliar work, start here first:
- `server/index.js` — backend runtime assembly
- `server/bootstrap/register-root-server-routes.js` — route registration entry
- `src/main.tsx` — client bootstrap flow
- `src/App.tsx` — global providers and route split
- `src/routes/PublicRoutes.tsx` — public route map
- `src/routes/DashboardRoutes.tsx` — dashboard route map
- `vite.config.ts` — aliasing, dev host policy, and build chunking config
- `package.json` — canonical scripts

## Additional repo guidance

There is no `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` in this repository at the time of writing, so the main repo-specific guidance sources are:
- `AGENTS.md`
- `README.md`
- `CODE_STYLE.md`
