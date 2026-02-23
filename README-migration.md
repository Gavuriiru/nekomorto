# Operacao DB-Only

Este documento descreve a operacao atual do projeto em modo **DB-only**.

## Estado atual

- Runtime usa apenas PostgreSQL.
- `DATABASE_URL` e obrigatoria em todos os ambientes.
- Sessao HTTP usa PostgreSQL (`connect-pg-simple`) na tabela `user_sessions`.
- `server/data/*.json` nao e fonte operacional de dados.
- Arquivos `server/data/*.example.json` sao apenas referencia estaticas.

## Variaveis de ambiente

Obrigatorias:

```bash
DATABASE_URL=postgresql://user:password@host:5432/nekomorto
SESSION_SECRET=<segredo_forte>
APP_ORIGIN=https://example.com,https://www.example.com
```

Opcionais relevantes:

```bash
SESSION_TABLE=user_sessions
MAINTENANCE_MODE=false
ADMIN_ORIGINS=https://admin.example.com
DISCORD_REDIRECT_URI=auto
```

## Execucao

Desenvolvimento:

```bash
npm run dev
```

Build e start:

```bash
npm run build
npm run start
```

Health check:

```bash
npm run api:health:check -- --base=http://localhost:8080 --expect-source=db --expect-maintenance=false
```

Smoke:

```bash
npm run api:smoke -- --base=http://localhost:8080
```

## Scripts operacionais DB-only

Backup:

```bash
npm run db:backup
```

Reorganizar uploads (dry-run / apply):

```bash
npm run uploads:reorganize
npm run uploads:reorganize -- --apply
```

Inventario de uploads para DB:

```bash
npm run uploads:generate-inventory
```

Localizar imagens de projeto:

```bash
npm run uploads:localize-project-images
npm run uploads:localize-project-images -- --apply
npm run uploads:localize-project-images -- --apply --project <id>
```

Isolar imagens por projeto:

```bash
npm run uploads:isolate-project-images
npm run uploads:isolate-project-images -- --apply
npm run uploads:isolate-project-images -- --apply --project <id>
```

Check de integridade de uploads:

```bash
npm run uploads:check-integrity
```

Migracao RBAC v2 (usuarios):

```bash
npm run users:migrate-permissions-v2
npm run users:migrate-permissions-v2 -- --apply
```

## Restauracao de uploads (local/dev)

Quando `public/uploads` estiver ausente ou incompleto, restaure a pasta a partir do snapshot/volume da producao.

Export no host de producao (exemplo com volume Docker):

```bash
docker run --rm \
  -v nekomorto-uploads-prod-data:/from \
  -v "$(pwd)":/to \
  alpine sh -c "cd /from && tar -czf /to/uploads-prod-snapshot.tgz ."
```

Copie o arquivo para a maquina local (exemplo):

```bash
scp <user>@<host>:/srv/nekomorto/uploads-prod-snapshot.tgz .
```

Restaure localmente:

```bash
mkdir -p public/uploads
tar -xzf uploads-prod-snapshot.tgz -C public/uploads
```

Valide integridade:

```bash
node --env-file=.env scripts/check-upload-integrity.mjs
```

Se o check falhar, restaure novamente o snapshot correto e repita a validacao ate zerar erros criticos.

## Sessao em PostgreSQL

- Prisma provisiona a tabela `user_sessions` via migration.
- `SESSION_TABLE` controla o nome da tabela (default `user_sessions`).
- O backend nao usa mais `session-file-store`.

## Rollback

Rollback de dados passa a ser:

1. restore do snapshot DB;
2. restore da pasta `public/uploads`.

Nao existe rollback para modo JSON.
