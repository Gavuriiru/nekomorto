# Migração e Deploy

Este documento resume ajustes necessários para migrar o site e operar em múltiplos domínios, além de exemplos de paginação das APIs públicas.

Runbook completo de execucao: `docs/DB_MIGRATION_RUNBOOK.md`.

## Fluxo Integrado (Frontend + Backend)

### Desenvolvimento
Um comando sobe API + frontend no mesmo origin:

```bash
npm run dev
```

URL padrão:
```text
http://localhost:8080
```

Comandos opcionais de diagnóstico:
```bash
npm run dev:server
npm run dev:client
```

### Produção
Build + start integrados:

```bash
npm run build
npm run start
```

`npm run start` exige `dist/index.html` gerado no build.
Em produção, CORS aceita apenas origens da allowlist configurada.
Requests sem header `Origin` são aceitos somente em `GET`/`HEAD`/`OPTIONS`.

## Variáveis de Ambiente

### `APP_ORIGIN`
Lista de origens publicas permitidas (separadas por virgula).
Em `NODE_ENV=production`, esta variavel e obrigatoria e deve conter ao menos uma origem `http(s)` valida.
Exemplo:
```
APP_ORIGIN=https://meusite.com,https://www.meusite.com
```

### `ADMIN_ORIGINS`
Lista de origens adicionais (ex.: painel/admin) permitidas no CORS.
Exemplo:
```
ADMIN_ORIGINS=https://admin.meusite.com
```

### `DISCORD_REDIRECT_URI`
Se for `auto`, o redirect do Discord usa a origem da requisicao (quando permitida) e fallback para `APP_ORIGIN` primario.
Caso contrario, defina um URL absoluto `http(s)` completo:
```
DISCORD_REDIRECT_URI=https://meusite.com/login
```

### `VITE_API_BASE`
Opcional no frontend. Sem valor, o app usa chamadas same-origin (`window.location.origin`).
Use apenas quando frontend e API estiverem em dominios diferentes.
Exemplo:
```
VITE_API_BASE=https://api.meusite.com
```

### `DATABASE_URL`
Obrigatoria quando `DATA_SOURCE=db`.
Exemplo:
```
DATABASE_URL=postgresql://user:password@localhost:5432/nekomata
```

### `DATA_SOURCE`
Seleciona a fonte de dados da API.
Valores:
```
DATA_SOURCE=json
DATA_SOURCE=db
```

### `MAINTENANCE_MODE`
Quando `true`, bloqueia requests mutaveis em `/api` (`POST`, `PUT`, `PATCH`, `DELETE`).
Use no cutover para janela curta.
```
MAINTENANCE_MODE=true
```

## Paginação nas APIs Públicas

As rotas abaixo aceitam `page` e `limit`. Se não forem passados, retornam o mesmo comportamento antigo (sem paginação).

### Posts
```
GET /api/public/posts?page=1&limit=12
```
Resposta:
```
{
  "posts": [...],
  "page": 1,
  "limit": 12,
  "total": 123
}
```

### Projetos
```
GET /api/public/projects?page=1&limit=24
```

### Atualizações
```
GET /api/public/updates?page=1&limit=10
```

## Uploads

Uploads internos são armazenados como caminhos relativos:
```
/uploads/...
```
Isso evita travar domínio ou IP.

Para gerar um inventário retroativo dos uploads, use:
```
node scripts/generate-uploads-inventory.mjs
```

O inventário fica em:
```
server/data/uploads.json
```

## Backup Rápido

Cria um snapshot de `server/data` e `public/uploads` em `backups/`.
```
node scripts/backup-data.mjs
```

## Localizar Imagens Remotas de Projetos

Converte imagens remotas em campos estruturados de projetos para `/uploads/...`.

Dry-run (sem baixar/escrever):
```
node scripts/localize-project-images.mjs
```

Aplicar em todos os projetos:
```
node scripts/localize-project-images.mjs --apply
```

Aplicar em um projeto especifico:
```
node scripts/localize-project-images.mjs --apply --project 21878
```

## Localizacao de Imagens de Projetos (politica atual)

- Campos principais (`cover`, `banner`, `heroImageUrl`) sao localizados em `/uploads/projects/<projectId>/`.
- Imagens de `relations[].image` sao localizadas em `/uploads/projects/<projectId>/` com nome deterministico (`relation-<anilistId>` ou hash da URL).
- Capas de episodios (`episodeDownloads[].coverImageUrl`) sao localizadas em `/uploads/projects/<projectId>/episodes/`.

Backfill legado (dry-run e apply):

```bash
node scripts/localize-project-images.mjs
node scripts/localize-project-images.mjs --apply
node scripts/localize-project-images.mjs --apply --project 21878
```

## Isolamento Manual de Imagens de Projeto

Duplica imagens usadas por projeto para pastas do proprio projeto, inclusive quando a mesma URL
e compartilhada por multiplos projetos ou por projeto+post.

Dry-run (padrao):
```bash
node scripts/isolate-project-images.mjs
```

Aplicar em todos os projetos:
```bash
node scripts/isolate-project-images.mjs --apply
```

Aplicar em um projeto especifico:
```bash
node scripts/isolate-project-images.mjs --apply --project 21878
```

## RBAC V2

### Flags de rollout

Backend:
```bash
RBAC_V2_ENABLED=false
RBAC_V2_ACCEPT_LEGACY_STAR=true
```

Frontend:
```bash
VITE_RBAC_V2_ENABLED=false
```

### Migracao de permissoes (`users.json`)

Dry-run:
```bash
node scripts/migrate-permissions-v2.mjs --dry-run
```

Aplicar:
```bash
node scripts/migrate-permissions-v2.mjs --apply
```

O script:
- converte `*` para permissoes explicitas;
- preenche `accessRole`;
- remove `Dono` persistido em `roles`;
- preserva permissoes desconhecidas em storage;
- reconcilia `owner-ids.json`;
- grava backup em `backups/` e auditoria em `server/data/audit-log.json`.

## Preflight de Migracao para DB

Executa validacao e gera relatorio em `reports/`:
```bash
npm run db:preflight
```

Dry-run da migracao JSON -> DB:
```bash
npm run db:migrate:json:dry-run
```

Aplicar migracao JSON -> DB:
```bash
npm run db:migrate:json:apply
```

Verificar paridade entre JSON e DB:
```bash
npm run db:verify:parity
```

Verificacao estrita (gate de cutover):
```bash
npm run db:verify:parity:strict
```

Verificacao pos-cutover (nao bloqueante, ignora analytics):
```bash
npm run db:verify:parity:postcutover
```

Gerar hash de snapshot de `server/data`:
```bash
npm run db:hash:snapshot
```

## Cutover (Janela Curta)

1. Ative manutencao para escrita:
```bash
MAINTENANCE_MODE=true
```
2. Faça backup e hash:
```bash
node scripts/backup-data.mjs
npm run db:hash:snapshot
```
3. Aplique migration SQL e gere client:
```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```
4. Migre os dados e valide:
```bash
npm run db:migrate:json:apply
npm run db:verify:parity:strict
```
5. Troque para DB e reinicie:
```bash
DATA_SOURCE=db
```
6. Rode smoke tests da API:
```bash
npm run api:smoke
```

## PostgreSQL Staging (Self-hosted com Docker Compose)

Arquivos de infraestrutura:

```text
ops/postgres/docker-compose.staging.yml
ops/postgres/env.staging.example
ops/postgres/backup.sh
ops/postgres/restore.sh
ops/postgres/README.md
```

### Subir o banco de staging

1. Copie o env de exemplo:
```bash
cp ops/postgres/env.staging.example ops/postgres/.env.staging
```
2. Defina `POSTGRES_PASSWORD` forte em `ops/postgres/.env.staging`.
3. Suba o Postgres:
```bash
docker compose --env-file ops/postgres/.env.staging -f ops/postgres/docker-compose.staging.yml up -d
```

O compose cria DB `nekomorto` e usuario `nekomorto_app`.

### DATABASE_URL para a aplicacao

```text
DATABASE_URL=postgresql://nekomorto_app:<POSTGRES_PASSWORD>@<db-host>:5432/nekomorto
```

Durante preparo, mantenha:

```text
DATA_SOURCE=json
MAINTENANCE_MODE=false
```

### Backup diario (pg_dump + retencao)

```bash
chmod +x ops/postgres/backup.sh ops/postgres/restore.sh
./ops/postgres/backup.sh
```

O script aplica retencao de 7 dias por padrao (`RETENTION_DAYS=7`).
Exemplo de cron diario (03:10 UTC):

```bash
10 3 * * * cd /srv/nekomorto && /srv/nekomorto/ops/postgres/backup.sh >> /var/log/nekomorto-pg-backup.log 2>&1
```

### Restore

```bash
./ops/postgres/restore.sh ops/postgres/backups/nekomorto_YYYYMMDDTHHMMSSZ.sql.gz
```

## Orquestracao de Cutover (scripts novos)

Comando base:

```bash
npm run db:cutover -- <stage>
```

Stages disponiveis:

- `preflight`: roda `db:preflight` + `db:migrate:json:dry-run`
- `prepare-schema`: roda `prisma:generate` + `prisma:migrate:deploy` + `prisma migrate status`
- `cutover`: roda backup/hash + `db:migrate:json:apply` + `db:verify:parity`
- `smoke`: roda `api:smoke`
- `health-db-maintenance`: valida `/api/health` com `dataSource=db` e `maintenanceMode=true`
- `health-db-open`: valida `/api/health` com `dataSource=db` e `maintenanceMode=false`
- `staging-all`: executa `preflight` + `prepare-schema` + `cutover` + `smoke`

Atalhos em `package.json`:

```bash
npm run db:staging:precutover
npm run db:staging:prepare-schema
npm run db:staging:cutover
npm run db:staging:smoke -- --base=https://staging.example.com
npm run db:staging:health:maintenance -- --base=https://staging.example.com
npm run db:staging:health:open -- --base=https://staging.example.com
npm run db:staging:all -- --base=https://staging.example.com
```

Observacoes importantes:

- `db:staging:cutover` exige `DATABASE_URL` e, por seguranca, `MAINTENANCE_MODE=true`.
- O script nao altera `.env` automaticamente. A troca `DATA_SOURCE=json -> db` continua sendo controlada pelo deploy.
- Para bypass da checagem de manutencao (nao recomendado), use `--allow-no-maintenance`.
- Politica de paridade: `db:verify:parity:strict` e gate apenas antes de reabrir escrita.
- Apos reabrir escrita em `DATA_SOURCE=db`, divergencias em analytics sao esperadas; use `db:verify:parity:postcutover` apenas como auditoria.
