# Nekomorto

Guia completo (PT-BR) para rodar, operar e manter o projeto em ambiente local e em producao com Docker.

## 1. Titulo e Visao Geral do Projeto

O Nekomorto e uma aplicacao web **DB-only**:

- O PostgreSQL e a fonte unica de verdade dos dados.
- O backend roda em Node.js/Express (`server/index.js`).
- O frontend React/Vite e servido pelo backend no runtime principal.
- As sessoes HTTP sao persistidas no PostgreSQL com `connect-pg-simple` (tabela padrao `user_sessions`).
- Arquivos `server/data/*.example.json` sao apenas referencias estaticas e nao sao usados como fonte operacional.

## 2. Arquitetura de Runtime

### Desenvolvimento (`npm run dev`)

- Sobe o servidor Node com watch.
- Porta padrao: `8080`.
- O servidor injeta middleware do Vite em desenvolvimento, entao frontend e API ficam no mesmo host (`http://localhost:8080`).

### Producao (`npm run build` + `npm run start`)

- `npm run build` gera o frontend em `dist/`.
- `npm run start` sobe o servidor em modo `production`.
- Em producao, o servidor exige `dist/index.html`; sem build, a inicializacao falha.

### Health check

Endpoint:

- `GET /api/health`

Resposta esperada (exemplo):

```json
{
  "ok": true,
  "dataSource": "db",
  "maintenanceMode": false,
  "ts": "2026-02-21T12:34:56.000Z"
}
```

## 3. Pre-requisitos

- Node.js `24.13.x` (pino oficial; ver `.nvmrc` e `.node-version`)
- npm `11.x`
- PostgreSQL acessivel pela `DATABASE_URL`
- Git
- Docker + Docker Compose plugin (opcional para rodar DB local e obrigatorio para stack de producao em container)

Validacao rapida:

```bash
node -v
npm -v
docker -v
docker compose version
```

Portas comuns:

- `8080`: app integrada (backend + frontend)
- `5173`: frontend Vite quando usar `npm run dev:client`
- `5432`: PostgreSQL

## 4. Inicio Rapido (Local sem Docker completo)

Use este fluxo se voce ja tiver PostgreSQL rodando fora do Docker.

### Linux/macOS

```bash
git clone <REPO_URL>
cd nekomorto
npm install
cp .env.example .env
```

### Windows (PowerShell)

```powershell
git clone <REPO_URL>
Set-Location nekomorto
npm install
Copy-Item .env.example .env
```

Edite `.env` e preencha pelo menos:

```dotenv
DATABASE_URL=postgresql://usuario:senha@127.0.0.1:5432/nekomorto
```

Depois rode migracoes e suba a aplicacao:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev
```

URL local padrao:

- `http://localhost:8080`

Validacao padrao:

```bash
npm run api:health:check -- --base=http://localhost:8080 --expect-source=db --expect-maintenance=false
```

Checks de qualidade:

```bash
npm run lint
npm run test
```

## 5. Configurar Banco Local com Docker (recomendado para dev)

Stack de banco local em `ops/postgres/docker-compose.staging.yml`.

### 5.1 Criar arquivo de ambiente do Postgres

Linux/macOS:

```bash
cp ops/postgres/env.staging.example ops/postgres/.env.staging
```

PowerShell:

```powershell
Copy-Item ops/postgres/env.staging.example ops/postgres/.env.staging
```

Edite `ops/postgres/.env.staging` e defina uma senha forte em `POSTGRES_PASSWORD`.

### 5.2 Subir o Postgres local

```bash
docker compose --env-file ops/postgres/.env.staging -f ops/postgres/docker-compose.staging.yml up -d
docker compose --env-file ops/postgres/.env.staging -f ops/postgres/docker-compose.staging.yml ps
```

### 5.3 Ajustar `DATABASE_URL` no `.env` da aplicacao

Exemplo:

```dotenv
DATABASE_URL=postgresql://nekomorto_app:<POSTGRES_PASSWORD>@127.0.0.1:5432/nekomorto
```

### 5.4 Aplicar migracoes e iniciar app

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev
```

Para derrubar o banco local:

```bash
docker compose --env-file ops/postgres/.env.staging -f ops/postgres/docker-compose.staging.yml down
```

## 6. Rodar em Modos Diferentes

### 6.1 Modo integrado (recomendado)

```bash
npm run dev
```

- API + frontend em `http://localhost:8080`.
- Para acesso por tunel/dominio publico, mantenha `VITE_API_BASE` vazio para usar same-origin.

### 6.2 Modo separado (backend e frontend em portas diferentes)

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev:client:local-api
```

Esse comando ja injeta `VITE_API_BASE=http://127.0.0.1:8080` so nesta sessao.
Se preferir manter `npm run dev:client`, exporte a variavel apenas no terminal (sem editar `.env`):

```bash
VITE_API_BASE=http://127.0.0.1:8080 npm run dev:client
```

Frontend:

- `http://localhost:5173`

### 6.3 Simular producao local

```bash
npm run build
npm run start
```

Depois valide:

```bash
npm run api:smoke -- --base=http://localhost:8080
```

Observacoes importantes para `NODE_ENV=production`:

- `APP_ORIGIN` precisa estar preenchida com origem valida.
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` precisam existir.
- Voce precisa configurar `OWNER_IDS` **ou** `BOOTSTRAP_TOKEN`.

## 7. Variaveis de Ambiente (guia completo)

Arquivo base para desenvolvimento:

- `.env.example`

Arquivo base para producao com Docker Compose:

- `ops/prod/.env.prod.example`

### 7.1 Variaveis principais

| Variavel | Dev | Producao | Descricao |
| --- | --- | --- | --- |
| `DATABASE_URL` | obrigatoria | obrigatoria | String de conexao PostgreSQL. Sem ela o servidor nao sobe. |
| `APP_ORIGIN` | opcional | obrigatoria | Lista de origens publicas permitidas (separadas por virgula). |
| `SESSION_SECRET` | recomendada | obrigatoria | Segredo de sessao HTTP. |
| `DISCORD_CLIENT_ID` | opcional | obrigatoria | OAuth Discord. |
| `DISCORD_CLIENT_SECRET` | opcional | obrigatoria | OAuth Discord. |
| `OWNER_IDS` | opcional | condicional | IDs dos owners iniciais (virgula). |
| `BOOTSTRAP_TOKEN` | opcional | condicional | Token one-shot para criar primeiro owner quando `OWNER_IDS` estiver vazio. |
| `PORT` | opcional | opcional | Porta HTTP da app (`8080` por padrao). |
| `SESSION_TABLE` | opcional | opcional | Tabela de sessao (`user_sessions` por padrao). |
| `MAINTENANCE_MODE` | opcional | opcional | Bloqueia mutacoes `POST/PUT/PATCH/DELETE` na API quando `true`. |
| `ADMIN_ORIGINS` | opcional | opcional | Origens extras para painel/admin. |
| `DISCORD_REDIRECT_URI` | opcional | opcional | `auto` (padrao) ou URL absoluta fixa. |
| `VITE_API_BASE` | opcional | opcional | Override da base de API no frontend. Em modo integrado/producao same-origin, deixe vazio. |

Condicional em producao:

- `OWNER_IDS` ou `BOOTSTRAP_TOKEN`: pelo menos um dos dois precisa estar configurado.

### 7.2 Variaveis opcionais relevantes

- `STAGING_API_BASE`
- `ANALYTICS_IP_SALT`
- `ANALYTICS_RETENTION_DAYS` (default: `90`)
- `ANALYTICS_AGG_RETENTION_DAYS` (default: `365`)
- `AUTO_UPLOAD_REORGANIZE_ON_STARTUP`
- `RBAC_V2_ENABLED`
- `RBAC_V2_ACCEPT_LEGACY_STAR`
- `VITE_RBAC_V2_ENABLED`
- `VITE_DASHBOARD_AUTOSAVE_ENABLED`
- `VITE_DASHBOARD_AUTOSAVE_DEBOUNCE_MS`
- `VITE_DASHBOARD_AUTOSAVE_RETRY_MAX`
- `VITE_DASHBOARD_AUTOSAVE_RETRY_BASE_MS`

### 7.3 Bootstrap de owner (`/api/bootstrap-owner`)

Use apenas quando `OWNER_IDS` estiver vazio e voce tiver definido `BOOTSTRAP_TOKEN`.

Regras:

- Endpoint: `POST /api/bootstrap-owner`
- Exige usuario autenticado.
- Token pode ir no body (`token`) ou no header `x-bootstrap-token`.
- Depois do primeiro owner ser criado, bootstrap deixa de ser necessario.

## 8. Docker em Producao (detalhado)

### 8.1 Arquivos oficiais de producao

- `Dockerfile`
- `docker-compose.prod.yml`
- `ops/caddy/Caddyfile`
- `ops/prod/.env.prod.example`
- `ops/prod/deploy-prod.sh`
- `.github/workflows/deploy-prod.yml`

### 8.2 Provisionamento inicial do host Ubuntu

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git ufw

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Reinicie a sessao SSH apos adicionar usuario ao grupo `docker`.

### 8.3 Preparar diretorio de deploy

```bash
sudo mkdir -p /srv/nekomorto
sudo chown -R $USER:$USER /srv/nekomorto
git clone <REPO_URL> /srv/nekomorto
cd /srv/nekomorto
cp ops/prod/.env.prod.example .env.prod
```

Edite `.env.prod` com valores reais, incluindo:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_ORIGIN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `OWNER_IDS` ou `BOOTSTRAP_TOKEN`

Para producao same-origin (recomendado), nao configure `VITE_API_BASE`.
No Discord Developer Portal, confirme as redirect URIs:

- `https://nekomata.moe/login` (obrigatoria)
- `https://www.nekomata.moe/login` (recomendada)

### 8.4 DNS, dominio e Caddy

Antes do primeiro `up` com Caddy:

- Garanta que `A/AAAA` do dominio apontam para o IP do host.
- O `ops/caddy/Caddyfile` atual esta configurado para:
  - `nekomata.moe`
  - `www.nekomata.moe`

Se o seu dominio for outro, ajuste esse arquivo antes de subir a stack.

### 8.5 Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 8.6 Primeiro deploy (ordem obrigatoria)

```bash
cd /srv/nekomorto
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d postgres
docker compose --env-file .env.prod -f docker-compose.prod.yml build app
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app npm run prisma:migrate:deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app npm run uploads:check-integrity
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d app caddy
```

### 8.7 Validacao apos deploy

```bash
curl -fsS https://nekomata.moe/api/health
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f app
```

Smoke test (opcao 1: com Node no host):

```bash
npm run api:smoke -- --base=https://nekomata.moe
```

Smoke test (opcao 2: sem Node no host, usando container da app):

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app node scripts/smoke-api.mjs --base=https://nekomata.moe
```

## 9. Deploy Automatico com GitHub Actions

Workflow:

- `.github/workflows/deploy-prod.yml`

Triggers:

- `push` para `main`
- `workflow_dispatch`

Secrets necessarios no repositorio:

- `PROD_HOST`
- `PROD_PORT` (opcional, default `22`)
- `PROD_USER`
- `PROD_SSH_KEY`
- `PROD_DEPLOY_PATH` (exemplo: `/srv/nekomorto`)

Comportamento do deploy remoto (`ops/prod/deploy-prod.sh`):

1. Sincroniza branch de deploy.
2. Executa `git reset --hard origin/<branch>` no host.
3. Sobe `postgres`.
4. Builda imagem `app`.
5. Aplica migracoes Prisma.
6. Executa check de integridade de uploads (`npm run uploads:check-integrity`).
7. Sobe `app` + `caddy`.
8. Executa healthcheck interno e externo.

Importante:

- Mudancas locais nao commitadas no host de deploy serao descartadas pelo `reset --hard`.

## 10. Backup e Restore

Scripts:

- `ops/postgres/backup.sh`
- `ops/postgres/restore.sh`

Documentacao complementar:

- `ops/postgres/README.md`

### 10.1 Backup (producao com override de compose/env)

```bash
cd /srv/nekomorto
COMPOSE_FILE=/srv/nekomorto/docker-compose.prod.yml \
ENV_FILE=/srv/nekomorto/.env.prod \
./ops/postgres/backup.sh
```

### 10.2 Restore (producao com override de compose/env)

```bash
cd /srv/nekomorto
COMPOSE_FILE=/srv/nekomorto/docker-compose.prod.yml \
ENV_FILE=/srv/nekomorto/.env.prod \
./ops/postgres/restore.sh /path/to/backup.sql.gz
```

### 10.3 Snapshot da aplicacao (DB datasets + uploads)

Script adicional:

```bash
npm run db:backup
```

Esse comando gera snapshot em `backups/` usando a `DATABASE_URL` atual.

### 10.4 Restore de uploads para ambiente local

Use quando `public/uploads` estiver vazio ou faltando arquivos.

Export no host de producao (exemplo com volume Docker):

```bash
docker run --rm \
  -v nekomorto-uploads-prod-data:/from \
  -v "$(pwd)":/to \
  alpine sh -c "cd /from && tar -czf /to/uploads-prod-snapshot.tgz ."
```

Copie o arquivo para sua maquina local:

```bash
scp <user>@<host>:/srv/nekomorto/uploads-prod-snapshot.tgz .
```

Restaure em `public/uploads`:

```bash
mkdir -p public/uploads
tar -xzf uploads-prod-snapshot.tgz -C public/uploads
```

Valide com o check de integridade:

```bash
node --env-file=.env scripts/check-upload-integrity.mjs
```

## 11. Operacao de Manutencao

### 11.1 Entrar em manutencao

1. Edite `.env.prod` e defina:

```dotenv
MAINTENANCE_MODE=true
```

2. Reinicie somente a app:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d app
```

3. Valide:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app node scripts/check-health.mjs --base=http://app:8080 --expect-source=db --expect-maintenance=true
```

### 11.2 Sair de manutencao

1. Volte para:

```dotenv
MAINTENANCE_MODE=false
```

2. Reinicie app:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d app
```

3. Valide:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app node scripts/check-health.mjs --base=http://app:8080 --expect-source=db --expect-maintenance=false
```

## 12. Troubleshooting

### Erro: `EADDRINUSE: address already in use :::8080`

Causa: porta `8080` ocupada.

Correcao:

- Pare o processo que esta usando a porta, ou
- Altere `PORT` no `.env`.

Linux/macOS:

```bash
lsof -i :8080
kill -9 <PID>
```

PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 8080 | Select-Object LocalAddress,LocalPort,OwningProcess,State
Stop-Process -Id <PID> -Force
```

### Erro: `Cannot find package 'connect-pg-simple' imported from ...`

Causa: dependencias nao instaladas ou `node_modules` inconsistente.

Correcao:

```bash
npm install
```

### Erro: `The requested module '@prisma/client' does not provide an export named 'PrismaClient'`

Causa: client do Prisma nao gerado (ausencia de `node_modules/.prisma/client`).

Correcao:

```bash
npm run prisma:generate
```

### Erro: `DATABASE_URL is required`

Causa: variavel obrigatoria nao configurada.

Correcao:

1. Defina `DATABASE_URL` no `.env` (ou `.env.prod`).
2. Aponte para Postgres acessivel.
3. Rode migracoes:

```bash
npm run prisma:migrate:deploy
```

### Erro: `APP_ORIGIN is required in production and must contain at least one valid origin.`

Causa: app em modo producao sem `APP_ORIGIN`.

Correcao:

```dotenv
APP_ORIGIN=https://seu-dominio.com,https://www.seu-dominio.com
```

### Erro: `Missing production build at .../dist/index.html. Run "npm run build" before "npm run start".`

Causa: `npm run start` executado sem build de frontend.

Correcao:

```bash
npm run build
npm run start
```

### Erros de tabela/migracao Prisma (ex.: tabela `posts` nao existe)

Causa: banco sem schema atualizado.

Correcao:

```bash
npm run prisma:migrate:deploy
npx prisma migrate status
```

### Erro: `Missing OWNER_IDS or BOOTSTRAP_TOKEN in env.`

Causa: producao sem owner inicial configurado.

Correcao:

- Defina `OWNER_IDS` com IDs Discord existentes, ou
- Defina `BOOTSTRAP_TOKEN` e use `POST /api/bootstrap-owner` apos login.

### Erro: `Missing DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, or SESSION_SECRET in env.`

Causa: variaveis obrigatorias de producao ausentes.

Correcao:

Preencha no `.env.prod`:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `SESSION_SECRET`

### Erro: login volta para `/login` e `GET /api/me` retorna `401`

Causa comum:

- `VITE_API_BASE` aponta para `http://localhost:8080` enquanto o acesso ocorre por dominio publico (`https://...`).
- Cookie de sessao antigo/invalido no navegador.

Correcao:

1. Em modo integrado/tunel, deixe no `.env`:

```dotenv
VITE_API_BASE=
```

2. Reinicie app e tunel.
3. Limpe cookies do dominio publico e de `localhost`.
4. Inicie o login pela URL publica (ex.: `https://dev.nekomata.moe/login`).
5. Verifique no DevTools que as chamadas usam `https://<mesmo-dominio>/api/...` (nao `http://localhost:8080/api/...`).

Diagnostico em producao:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f app
```

Procure eventos `auth.login.failed` com codigos `state_mismatch`, `token_exchange_failed` ou `unauthorized`.

Para verificar se a sessao esta sendo persistida:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) as total_sessions from user_sessions;"
```

### Erro: imagens quebradas em `/uploads` (home, projetos, posts, footer)

Causa comum:

- `public/uploads` ausente/incompleto no ambiente atual.

Correcao:

1. Restaure os arquivos de uploads a partir de backup/snapshot valido.
2. Execute o check:

```bash
npm run uploads:check-integrity
```

3. Se o comando falhar, repita a restauracao ate eliminar `missing_source_file` e `missing_upload_file_for_inventory`.

## 13. Referencia Rapida de Comandos

Setup local rapido:

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev
```

Health e smoke:

```bash
npm run api:health:check -- --base=http://localhost:8080 --expect-source=db --expect-maintenance=false
npm run api:smoke -- --base=http://localhost:8080
```

Qualidade:

```bash
npm run lint
npm run test
npm run uploads:check-integrity
```

Producao (ordem):

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d postgres
docker compose --env-file .env.prod -f docker-compose.prod.yml build app
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app npm run prisma:migrate:deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app npm run uploads:check-integrity
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d app caddy
```

Backup e restore (producao):

```bash
COMPOSE_FILE=/srv/nekomorto/docker-compose.prod.yml ENV_FILE=/srv/nekomorto/.env.prod ./ops/postgres/backup.sh
COMPOSE_FILE=/srv/nekomorto/docker-compose.prod.yml ENV_FILE=/srv/nekomorto/.env.prod ./ops/postgres/restore.sh /path/backup.sql.gz
```

---

Referencias complementares:

- `docs/DB_MIGRATION_RUNBOOK.md`
- `ops/postgres/README.md`
