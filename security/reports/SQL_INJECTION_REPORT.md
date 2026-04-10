# SQL_INJECTION Security Report

## Status: PASS

## Findings

The codebase primarily uses Prisma model methods and does not concatenate user input into SQL strings.

Reviewed database access files include:

- [server/lib/data-repository.js](/d:/dev/nekomorto/server/lib/data-repository.js)
- [server/lib/normalized-domain-store.js](/d:/dev/nekomorto/server/lib/normalized-domain-store.js)
- [server/lib/operational-monitoring-runtime.js](/d:/dev/nekomorto/server/lib/operational-monitoring-runtime.js)

Raw SQL usage found:

```js
const rows = await db.$queryRaw`
  SELECT to_regclass('public.normalized_runtime_state')::text AS table_name
`;
```

```js
await prisma.$queryRawUnsafe("SELECT 1");
```

Assessment:

- The tagged `$queryRaw` call is parameter-safe and uses a constant string.
- The `$queryRawUnsafe("SELECT 1")` call is not ideal stylistically, but it uses a constant literal with no user input.
- No string concatenation, template interpolation with user data, `.format()`, or f-string equivalent was found in SQL execution paths.

Verification results:

- Grep review found no query string concatenation with user-controlled input.
- Main database operations use Prisma CRUD methods rather than raw SQL.

## What's at risk

SQL injection would let attackers read, modify, or destroy arbitrary database records by smuggling SQL through request parameters or bodies.

## What's already secure

- Prisma CRUD methods are the dominant access pattern.
- The raw SQL that exists is constant or tagged, not user-built.
- No dynamic SQL composition with request data was found.

## Recommendations

1. Keep using Prisma model methods where possible.
2. Prefer `$queryRaw` over `$queryRawUnsafe` even for constant probes when convenient.
3. Reject any future raw SQL that interpolates request data directly.
