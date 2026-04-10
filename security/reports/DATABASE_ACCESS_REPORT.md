# DATABASE_ACCESS Security Report

## Status: PASS

## Findings

This project uses server-only PostgreSQL access through Prisma, not direct browser access through Supabase or Firebase.

- [prisma/schema.prisma](/d:/dev/nekomorto/prisma/schema.prisma) defines a PostgreSQL datasource and Prisma models mapped to server-managed tables.
- No Supabase client, Firebase client, anon key, service role key, or browser-side database SDK usage was found in `src/` or `server/`.
- Database access is mediated through server-side repository/runtime code such as:
  - [server/lib/data-repository.js](/d:/dev/nekomorto/server/lib/data-repository.js)
  - [server/lib/normalized-domain-store.js](/d:/dev/nekomorto/server/lib/normalized-domain-store.js)
  - [server/lib/prisma-client.js](/d:/dev/nekomorto/server/lib/prisma-client.js)
- The only raw SQL found is controlled and not user-concatenated:

```js
const rows = await db.$queryRaw`
  SELECT to_regclass('public.normalized_runtime_state')::text AS table_name
`;
```

```js
await prisma.$queryRawUnsafe("SELECT 1");
```

Architecture note:

- The checklist items about per-table Supabase RLS and Firebase rules are not applicable to this stack because the browser does not talk directly to the database.
- Access control is enforced at the API layer before repository operations.

Verification results:

- Prisma is configured for PostgreSQL only.
- No direct client-side database access path was found.
- No unrestricted Supabase/Firebase policy surface exists because those products are not in use.

## What's at risk

If database credentials or direct browser database access were later introduced, missing row-level enforcement could expose records broadly. In the current architecture, the database is reachable only through the server application.

## What's already secure

- Browser code does not connect straight to the database.
- Prisma model methods and server repositories act as the access boundary.
- Auth and authorization logic sit in routes/middleware before repository writes and reads.

## Recommendations

1. Keep database access server-only.
2. If this project ever migrates to Supabase/Firebase direct client access, add explicit RLS/security rules before exposing any table/collection.
3. Keep raw SQL limited to constant strings or tagged/parameterized queries.
