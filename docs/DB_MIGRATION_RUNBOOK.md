# Runbook DB-Only (PostgreSQL)

Este runbook descreve operacao e deploy apos o corte definitivo para DB-only.

## Premissas

- Aplicacao usa apenas PostgreSQL.
- `DATABASE_URL` obrigatoria.
- Sessao usa tabela `user_sessions`.
- Sem dual-write com JSON.

## 1. Preparacao de ambiente

Confirmar variaveis obrigatorias:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://nekomorto_app:<senha>@<host>:5432/nekomorto
SESSION_SECRET=<segredo>
APP_ORIGIN=https://nekomata.moe,https://www.nekomata.moe
```

Opcionais comuns:

```bash
SESSION_TABLE=user_sessions
ADMIN_ORIGINS=https://admin.nekomata.moe
MAINTENANCE_MODE=false
```

## 2. Schema e migrate

Gerar client e aplicar migrations:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npx prisma migrate status
```

Aceite:

- `migrate deploy` sem erro.
- `migrate status` sem pendencias.

## 3. Deploy da aplicacao

```bash
npm run build
npm run start
```

Validar health:

```bash
npm run api:health:check -- --base=https://nekomata.moe --expect-source=db --expect-maintenance=false
```

Validar smoke:

```bash
npm run api:smoke -- --base=https://nekomata.moe
```

## 4. Janela de manutencao (quando necessario)

1. Definir `MAINTENANCE_MODE=true` e reiniciar app.
2. Executar atividade operacional (ex.: reorganizacao de uploads).
3. Validar:

```bash
npm run api:health:check -- --base=https://nekomata.moe --expect-source=db --expect-maintenance=true
npm run api:smoke -- --base=https://nekomata.moe
```

4. Reabrir escrita: `MAINTENANCE_MODE=false` + restart.

## 5. Operacoes de dados

Backup DB + uploads:

```bash
npm run db:backup
```

Reorganizar uploads:

```bash
npm run uploads:reorganize
npm run uploads:reorganize -- --apply
```

Localizar/isolar imagens:

```bash
npm run uploads:localize-project-images -- --apply
npm run uploads:isolate-project-images -- --apply
```

Reconstruir inventario de uploads no DB:

```bash
npm run uploads:generate-inventory
```

## 6. RBAC usuarios

Dry-run:

```bash
npm run users:migrate-permissions-v2
```

Apply:

```bash
npm run users:migrate-permissions-v2 -- --apply
```

## 7. Rollback

Rollback suportado:

1. restore do snapshot DB;
2. restore de `public/uploads`.

Rollback para JSON nao e suportado.
