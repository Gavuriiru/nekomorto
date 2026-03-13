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

## 4. Inicio Rapido (recomendado: 1 comando)

Fluxo oficial para desenvolvimento local com PostgreSQL em Docker:

### Linux/macOS

```bash
git clone <REPO_URL>
cd nekomorto
npm install
npm run setup:dev
```

### Windows (PowerShell)

```powershell
git clone <REPO_URL>
Set-Location nekomorto
npm install
npm run setup:dev
```

No primeiro run, `npm run setup:dev`:

- valida `docker`, `docker compose`, `node` e `npm`
- garante `ops/postgres/.env.staging` (pedindo `POSTGRES_PASSWORD` quando necessario)
- sobe PostgreSQL local e aguarda readiness
- cria `.env` de forma interativa quando ausente (com `DATABASE_URL` local automatica)
- preserva `.env` existente e valida `DATABASE_URL`
- executa `npm run prisma:generate` e `npm run prisma:migrate:deploy`
- inicia `npm run dev` automaticamente

Observacoes:

- Se `.env` nao existir, o primeiro setup exige terminal interativo (TTY).
- Para encerrar a app, use `Ctrl+C`.
- Para reexecutar setup, rode `npm run setup:dev` novamente (idempotente).

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

## 5. Configurar Banco Local com Docker (fluxo manual alternativo)

Se preferir controlar os passos manualmente, use o fluxo abaixo.

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
- O HMR do modo integrado usa a mesma origem da pagina. Nao publique nem encaminhe a porta `24678`.
- Para cloudflared, aponte o tunel inteiro para `http://127.0.0.1:8080`.
- O OAuth do Discord retorna para a mesma origem que iniciou o login nesse modo.

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
- O callback do Discord continua sendo processado pelo backend, mas o redirect final volta para a origem que iniciou o login.

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

Arquivos oficiais desta secao:

- `dev base`: `.env.example`
- `prod compose`: `ops/prod/.env.prod.example`
- `dev deploy`: `ops/dev/.env.dev.example`

Convencoes usadas nas tabelas:

- `bool backend`: aceita `true/false/1/0/yes/no/on/off`
- `bool frontend flexivel`: aceita `true/false/1/0/yes/no/on/off`
- `bool frontend estrito`: somente `true` habilita; qualquer outro valor cai no default
- `CSV`: lista separada por virgula; espacos sao ignorados quando aplicavel
- `URL http(s)` / `origem http(s)`: URL absoluta com schema; `APP_ORIGIN` e `ADMIN_ORIGINS` usam apenas a origem

### 7.1 Runtime e rede

| Variavel | Onde aparece | Obrigatoria quando | Default | Valores/Formato | Descricao |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | `dev base`, `prod compose`, `dev deploy` | sempre | sem fallback seguro; os exemplos definem `development` ou `production` | `development` ou `production` | Controla as regras de runtime. Em `production`, a app exige `APP_ORIGIN`, credenciais Discord e configuracao inicial de owner. |
| `PORT` | `dev base`, `prod compose`, `dev deploy` | nunca | `8080` | inteiro de porta TCP | Porta HTTP da app. |
| `DATABASE_URL` | `dev base`, `prod compose`, `dev deploy` | sempre | nenhum | string de conexao PostgreSQL | Sem ela o servidor nao sobe. |
| `PRISMA_TX_TIMEOUT_MS` | `dev base` | nunca | `30000` | inteiro em ms, clamp `1-600000` | Timeout padrao das transacoes Prisma. |
| `PRISMA_TX_MAX_WAIT_MS` | `dev base` | nunca | `5000` | inteiro em ms, clamp `1-600000` | Espera maxima na fila de transacoes Prisma. |
| `MAINTENANCE_MODE` | `dev base`, `prod compose`, `dev deploy` | nunca | `false` | `bool backend` | Quando ligado, bloqueia mutacoes `POST/PUT/PATCH/DELETE` em `/api`. |
| `STAGING_API_BASE` | `dev base` | nunca | vazio | `URL http(s)` | Base opcional para smoke/health checks durante cutover ou paridade com staging. |
| `APP_ORIGIN` | `dev base`, `prod compose`, `dev deploy` | `production` | em dev, se vazio, o backend usa `http://127.0.0.1:5173` como origem primaria local | `CSV` de origens `http(s)` absolutas | Lista de origens publicas permitidas. A primeira origem valida vira host canonico para links, OG e auth fallback. |
| `ADMIN_ORIGINS` | `prod compose`, `dev deploy` | nunca | vazio | `CSV` de origens `http(s)` absolutas | Origens extras autorizadas para painel/admin. Sao somadas a `APP_ORIGIN`. |
| `VITE_API_BASE` | `dev base` | nunca | vazio | `URL http(s)` | Override opcional da base da API no frontend. Em same-origin, producao e tunel, deixe vazio. |

### 7.2 Auth, sessao e bootstrap

| Variavel | Onde aparece | Obrigatoria quando | Default | Valores/Formato | Descricao |
| --- | --- | --- | --- | --- | --- |
| `DISCORD_CLIENT_ID` | `dev base`, `prod compose`, `dev deploy` | `production` | vazio | string | Client ID do OAuth do Discord. |
| `DISCORD_CLIENT_SECRET` | `dev base`, `prod compose`, `dev deploy` | `production` | vazio | string secreta | Client secret do OAuth do Discord. |
| `DISCORD_REDIRECT_URI` | `dev base`, `prod compose`, `dev deploy` | nunca | `auto` | `auto` ou `URL http(s)` absoluta | Em `auto`, o callback vai para `<origem-permitida>/login`. Se definido manualmente, precisa ser URL absoluta valida. |
| `SESSION_SECRET` | `dev base`, `prod compose`, `dev deploy` | `production`, exceto quando `SESSION_SECRETS` estiver preenchido | vazio; em dev, se `SESSION_SECRETS` tambem estiver vazio, cai no fallback inseguro `dev-session-secret` | string secreta longa | Segredo principal de sessao HTTP. |
| `SESSION_SECRETS` | `dev base`, `prod compose`, `dev deploy` | nunca | vazio | `CSV` de secrets, mais novo primeiro | Lista de rotacao de secrets de sessao. Quando preenchida, substitui `SESSION_SECRET` como lista aceita e o primeiro valor vira o ativo. |
| `SESSION_TABLE` | `dev base`, `prod compose`, `dev deploy` | nunca | `user_sessions` | nome de tabela SQL | Nome da tabela usada pelo `connect-pg-simple`. |
| `OWNER_IDS` | `dev base`, `prod compose`, `dev deploy` | `production` quando `BOOTSTRAP_TOKEN` estiver vazio | vazio; em dev existe fallback interno para um owner local do projeto | `CSV` de IDs de usuario do Discord | Owners iniciais carregados no boot. |
| `BOOTSTRAP_TOKEN` | `dev base`, `prod compose`, `dev deploy` | `production` quando `OWNER_IDS` estiver vazio | vazio | string secreta | Token one-shot para `POST /api/bootstrap-owner` criar o primeiro owner. |

Regra de producao:

- Configure `OWNER_IDS` ou `BOOTSTRAP_TOKEN`; pelo menos um dos dois precisa existir.

### 7.3 Frontend e feature flags

| Variavel | Onde aparece | Obrigatoria quando | Default | Valores/Formato | Descricao |
| --- | --- | --- | --- | --- | --- |
| `VITE_PWA_DEV_ENABLED` | `dev base` | nunca | `false` | `bool frontend estrito` | Liga manifest, swap e workbox no dev do Vite. |
| `VITE_DASHBOARD_AUTOSAVE_ENABLED` | `dev base` | nunca | `true` | `bool frontend flexivel` | Habilita autosave do dashboard por padrao. |
| `VITE_DASHBOARD_AUTOSAVE_DEBOUNCE_MS` | `dev base` | nunca | `1200` | inteiro em ms, clamp `300-10000` | Debounce entre edicoes e envio do autosave. |
| `VITE_DASHBOARD_AUTOSAVE_RETRY_MAX` | `dev base` | nunca | `2` | inteiro, clamp `0-5` | Quantidade maxima de retries do autosave. |
| `VITE_DASHBOARD_AUTOSAVE_RETRY_BASE_MS` | `dev base` | nunca | `1500` | inteiro em ms, clamp `300-10000` | Base do backoff entre retries do autosave. |
| `RBAC_V2_ENABLED` | `dev base`, `prod compose`, `dev deploy` | nunca | `false` | `bool backend` | Ativa o fluxo backend do RBAC v2. |
| `RBAC_V2_ACCEPT_LEGACY_STAR` | `dev base`, `prod compose`, `dev deploy` | nunca | `true` | `bool backend` | Mantem compatibilidade com o atalho legado `*` ao migrar para RBAC v2. |
| `VITE_RBAC_V2_ENABLED` | `dev base` | nunca | `false` | `bool frontend flexivel` | Liga o frontend para ler grants do RBAC v2. |

### 7.4 Analytics e comportamento operacional

| Variavel | Onde aparece | Obrigatoria quando | Default | Valores/Formato | Descricao |
| --- | --- | --- | --- | --- | --- |
| `ANALYTICS_IP_SALT` | `dev base`, `prod compose`, `dev deploy` | nunca | vazio; se ficar vazio, o backend cai para `SESSION_SECRET` e depois `dev-analytics-salt` | string | Salt usado para hash de IP nos eventos de analytics. |
| `ANALYTICS_RETENTION_DAYS` | `dev base`, `prod compose`, `dev deploy` | nunca | `90` | inteiro em dias, clamp `7-3650` | Retencao dos eventos brutos de analytics. |
| `ANALYTICS_AGG_RETENTION_DAYS` | `dev base`, `prod compose`, `dev deploy` | nunca | `365` | inteiro em dias, clamp `30-3650` | Retencao dos agregados de analytics. |
| `AUTO_UPLOAD_REORGANIZE_ON_STARTUP` | `dev base`, `prod compose`, `dev deploy` | nunca | `false` | `bool backend` | Executa a reorganizacao automatica de pastas de upload no startup. |
| `OG_PUBLIC_TARGET_KB` | `dev base` | nunca | `350` | inteiro em KB, faixa valida `150-1024` | Tamanho alvo do primeiro JPEG publico aceitavel para cards OG. Valores fora da faixa voltam ao default. |
| `OG_PUBLIC_JPEG_QUALITIES` | `dev base` | nunca | `84,80,76,72` | `CSV` de inteiros `60-100` | Escada de qualidades JPEG para OG publico. Entradas invalidas sao ignoradas; a lista final fica unica e em ordem decrescente. |

### 7.5 Uploads/storage

O contrato publico de uploads continua sendo `/uploads/...` em todos os modos.
Mesmo com storage externo, a app continua entregando assets via proxy (`UPLOAD_STORAGE_DELIVERY=proxy`), entao frontend, payloads publicos e referencias salvas no banco nao mudam.

Defaults e comportamento base:

- `UPLOAD_VARIANT_AVIF_QUALITY=90` continua sendo o padrao.
- `UPLOAD_STORAGE_DRIVER=local` continua sendo o padrao.
- `UPLOAD_STORAGE_DELIVERY=proxy` continua sendo o padrao desta fase.
- Ao ativar `UPLOAD_STORAGE_DRIVER=s3`, apenas uploads novos passam a usar o provider ativo.
- Uploads antigos continuam em `local` ate sync ou restore explicito.
- `storageProvider` continua sendo detalhe interno; o frontend segue consumindo `/uploads/...`.
- Mudar `UPLOAD_VARIANT_AVIF_QUALITY` so afeta variantes novas ou regeneradas.

| Variavel | Onde aparece | Obrigatoria quando | Default | Valores/Formato | Descricao |
| --- | --- | --- | --- | --- | --- |
| `UPLOAD_VARIANT_AVIF_QUALITY` | `dev base`, `prod compose`, `dev deploy` | nunca | `90` | inteiro `1-100`; entradas invalidas voltam para `90` | Qualidade AVIF global das variantes geradas para uploads. Valores maiores aumentam fidelidade, trafego e armazenamento. So afeta uploads novos ou regenerados/backfill. |
| `UPLOAD_STORAGE_DRIVER` | `dev base` | nunca | `local` | `local` ou `s3` | Provider ativo. Valores desconhecidos caem para `local`. |
| `UPLOAD_STORAGE_DELIVERY` | `dev base` | nunca | `proxy` | `proxy` | Modo de entrega desta fase. Mantenha `proxy` para preservar `/uploads/...`. |
| `UPLOAD_STORAGE_BUCKET` | `dev base` | quando `UPLOAD_STORAGE_DRIVER=s3` | vazio | nome de bucket | Bucket do provider S3-compatible. |
| `UPLOAD_STORAGE_REGION` | `dev base` | quando `UPLOAD_STORAGE_DRIVER=s3` | vazio | string | Regiao do bucket. Em Cloudflare R2, use `auto`. |
| `UPLOAD_STORAGE_ENDPOINT` | `dev base` | depende do provider; normalmente necessario em R2 | vazio | `URL http(s)` | Endpoint customizado do provider S3-compatible. |
| `UPLOAD_STORAGE_ACCESS_KEY_ID` | `dev base` | quando `UPLOAD_STORAGE_DRIVER=s3` | vazio | string | Credencial de acesso do provider. |
| `UPLOAD_STORAGE_SECRET_ACCESS_KEY` | `dev base` | quando `UPLOAD_STORAGE_DRIVER=s3` | vazio | string secreta | Segredo de acesso do provider. |
| `UPLOAD_STORAGE_PREFIX` | `dev base` | nunca | vazio | fragmento de path sem `/` inicial/final | Prefixo interno das object keys no bucket. |
| `UPLOAD_STORAGE_S3_FORCE_PATH_STYLE` | `dev base` | nunca | `false` | `bool backend` | Use `true` somente se o provider exigir path-style. |
| `UPLOAD_STORAGE_PUBLIC_BASE_URL` | `dev base` | nunca | vazio | `URL http(s)` | Reservado para futuros fluxos de entrega publica direta; nao participa do fluxo padrao atual. |

Exemplo com Cloudflare R2:

```dotenv
UPLOAD_STORAGE_DRIVER=s3
UPLOAD_STORAGE_DELIVERY=proxy
UPLOAD_STORAGE_BUCKET=nekomorto-media
UPLOAD_STORAGE_REGION=auto
UPLOAD_STORAGE_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
UPLOAD_STORAGE_ACCESS_KEY_ID=<r2_access_key_id>
UPLOAD_STORAGE_SECRET_ACCESS_KEY=<r2_secret_access_key>
UPLOAD_STORAGE_PREFIX=prod
UPLOAD_STORAGE_S3_FORCE_PATH_STYLE=false
UPLOAD_STORAGE_PUBLIC_BASE_URL=
```

Exemplo com AWS S3:

```dotenv
UPLOAD_STORAGE_DRIVER=s3
UPLOAD_STORAGE_DELIVERY=proxy
UPLOAD_STORAGE_BUCKET=nekomorto-media
UPLOAD_STORAGE_REGION=us-east-1
UPLOAD_STORAGE_ACCESS_KEY_ID=<aws_access_key_id>
UPLOAD_STORAGE_SECRET_ACCESS_KEY=<aws_secret_access_key>
UPLOAD_STORAGE_PREFIX=prod
UPLOAD_STORAGE_S3_FORCE_PATH_STYLE=false
UPLOAD_STORAGE_PUBLIC_BASE_URL=
```

Fora do escopo desta fase:

- signed URLs
- upload direto do browser para bucket
- entrega publica direta por CDN/bucket

### 7.6 Seguranca, MFA, exports, metrics e alerts

| Variavel | Onde aparece | Obrigatoria quando | Default | Valores/Formato | Descricao |
| --- | --- | --- | --- | --- | --- |
| `DATA_ENCRYPTION_KEYS_JSON` | `dev base`, `prod compose`, `dev deploy` | nunca | vazio | JSON no formato `{"activeKeyId":"key-2026-01","keys":{"key-2026-01":"<base64>"}}` | Keyring para criptografia em repouso. Prefira JSON; o parser ainda aceita secret legacy simples como fallback. |
| `SECURITY_RECOVERY_CODE_PEPPER` | `dev base`, `prod compose`, `dev deploy` | recomendado quando MFA estiver em uso | vazio | string secreta | Pepper adicional para proteger recovery codes de MFA. |
| `MFA_ISSUER` | `dev base`, `prod compose` | nunca | `Nekomata` | string | Nome exibido pelos apps autenticadores nos TOTP da plataforma. |
| `TOTP_ICON_URL` | `dev base`, `prod compose` | nunca | vazio | `URL http(s)` | Icone publico opcional para o cadastro TOTP. |
| `MFA_ENROLLMENT_TTL_MS` | `dev base`, `prod compose` | nunca | `600000` | inteiro em ms, clamp `60000-86400000` | TTL da tentativa de enrollment MFA. |
| `ADMIN_EXPORTS_DIR` | `dev base`, `prod compose` | nunca | `backups/admin-exports` | caminho relativo ao repo ou absoluto | Diretorio usado para armazenar exports administrativos temporarios. |
| `ADMIN_EXPORT_TTL_HOURS` | `dev base`, `prod compose` | nunca | `24` | inteiro em horas, clamp `1-168` | Tempo de vida dos arquivos em `ADMIN_EXPORTS_DIR`. |
| `METRICS_ENABLED` | `dev base`, `prod compose`, `dev deploy` | nunca | `false` | `bool backend` | Habilita a exposicao de metrics operacionais. |
| `METRICS_TOKEN` | `dev base`, `prod compose`, `dev deploy` | quando `METRICS_ENABLED=true` | vazio | string secreta | Token exigido para acessar metrics quando elas estiverem habilitadas. |
| `OPS_ALERTS_WEBHOOK_ENABLED` | `dev base`, `prod compose` | nunca | `false` | `bool backend` | Liga os alertas operacionais/webhooks da categoria 6. |
| `OPS_ALERTS_WEBHOOK_PROVIDER` | `dev base`, `prod compose` | quando `OPS_ALERTS_WEBHOOK_ENABLED=true` | `discord` | `discord` | Provider do webhook. Hoje somente `discord` e suportado; valores diferentes fazem o envio ser ignorado. |
| `OPS_ALERTS_WEBHOOK_URL` | `dev base`, `prod compose` | quando `OPS_ALERTS_WEBHOOK_ENABLED=true` | vazio | `URL http(s)` | URL do webhook operacional. |
| `OPS_ALERTS_WEBHOOK_TIMEOUT_MS` | `dev base`, `prod compose` | nunca | `5000` | inteiro em ms, clamp `1000-30000` | Timeout do envio do webhook. |
| `OPS_ALERTS_WEBHOOK_INTERVAL_MS` | `dev base`, `prod compose` | nunca | `60000` | inteiro em ms, clamp `10000-3600000` | Intervalo minimo entre envios recorrentes do webhook. |
| `OPS_ALERTS_DB_LATENCY_WARNING_MS` | `dev base`, `prod compose` | nunca | `1000` | inteiro em ms, clamp `50-60000` | Latencia do banco que passa a gerar warning operacional. |

### 7.7 Deploy/container vars dos exemplos oficiais

| Variavel | Onde aparece | Obrigatoria quando | Default | Valores/Formato | Descricao |
| --- | --- | --- | --- | --- | --- |
| `APP_IMAGE_REPO` | `prod compose`, `dev deploy` | nunca | `ghcr.io/gavuriiru/nekomorto` no compose e no script de deploy | repositorio Docker | Repositorio da imagem da app usada no deploy. |
| `APP_IMAGE_TAG` | `prod compose`, `dev deploy` | nunca | `latest` no compose e no script de deploy | tag Docker | Tag da imagem da app. O padrao de CI costuma usar `sha-<commit>`. |
| `APP_COMMIT_SHA` | `dev deploy` | nunca | vazio; se `APP_IMAGE_TAG` seguir `sha-<commit>`, o backend tenta inferir o SHA | hash de commit | Metadata opcional de build exposta pela app. |
| `APP_BUILD_TIME` | `dev deploy` | nunca | vazio | timestamp; prefira ISO 8601 UTC | Metadata opcional com o horario do build. |
| `POSTGRES_DB` | `prod compose`, `dev deploy` | quando usar o `docker-compose.prod.yml` oficial | `nekomorto` no compose; o exemplo de dev deploy usa `nekomorto_dev` | nome de banco PostgreSQL | Nome do banco inicial do container Postgres e do healthcheck. |
| `POSTGRES_USER` | `prod compose`, `dev deploy` | quando usar o `docker-compose.prod.yml` oficial | `nekomorto_app` no compose; o exemplo de dev deploy usa `nekomorto_dev` | nome de usuario PostgreSQL | Usuario do container Postgres. |
| `POSTGRES_PASSWORD` | `prod compose`, `dev deploy` | quando usar o `docker-compose.prod.yml` oficial | nenhum | string secreta forte | Senha do container Postgres. O compose falha sem ela. |

### 7.8 Bootstrap de owner (`/api/bootstrap-owner`)

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
- `APP_IMAGE_REPO` e `APP_IMAGE_TAG` (opcionais; defaults para GHCR + `latest`)

Para producao same-origin (recomendado), nao configure `VITE_API_BASE`.
Em ambiente realmente `production`, origens locais so serao aceitas se estiverem permitidas por `APP_ORIGIN`.
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
docker compose --env-file .env.prod -f docker-compose.prod.yml pull app
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app npm run prisma:migrate:deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app npm run uploads:check-integrity -- --mode=fast
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d app caddy
```

Esse fluxo pressupoe que a imagem ja foi publicada no GHCR (via `push` em `main` ou `workflow_dispatch`).

Notas operacionais para uploads:

- `fast` e o modo recomendado no deploy por custo e latencia.
- Use `deep` apenas para validacoes manuais mais fortes, especialmente apos sync/restore.
- Se `UPLOAD_STORAGE_DRIVER=s3`, bucket e credenciais precisam existir antes do rollout.
- Durante a fase mista (`local + s3`), preserve `public/uploads` no host ate concluir validacao e decidir pelo rollback ou consolidacao.

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
- `workflow_dispatch` (com input opcional `image_tag`)

Secrets necessarios no repositorio:

- `PROD_HOST`
- `PROD_PORT` (opcional, default `22`)
- `PROD_USER`
- `PROD_SSH_KEY`
- `PROD_DEPLOY_PATH` (exemplo: `/srv/nekomorto`)

Fluxo CI/CD:

1. Job `build_and_push` publica `ghcr.io/gavuriiru/nekomorto` com tags `latest` e `sha-<commit>`.
2. Job `deploy` resolve a tag:
   - sem `image_tag`: usa `sha-<commit_atual>`;
   - com `image_tag`: valida `latest` ou `sha-[0-9a-f]{40}` e usa a tag informada.
3. Via SSH, chama `ops/prod/deploy-prod.sh` no host com `APP_IMAGE_REPO` e `APP_IMAGE_TAG`.

Pacote no GHCR:

- `https://github.com/gavuriiru/nekomorto/pkgs/container/nekomorto`

Comportamento do deploy remoto (`ops/prod/deploy-prod.sh`):

1. Sincroniza branch de deploy.
2. Executa `git reset --hard origin/<branch>` no host.
3. Sobe `postgres`.
4. Faz `pull` da imagem `app` definida por `APP_IMAGE_REPO:APP_IMAGE_TAG`.
5. Aplica migracoes Prisma.
6. Executa check de integridade de uploads em modo rapido (`npm run uploads:check-integrity -- --mode=fast`).
7. Sobe `app` + `caddy`.
8. Executa healthcheck interno e externo.

Importante:

- Mudancas locais nao commitadas no host de deploy serao descartadas pelo `reset --hard`.
- Rollback/redeploy manual: execute `workflow_dispatch` e preencha `image_tag` com `sha-<commit>` ja publicado no GHCR.

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

### 10.5 Migracao e rollback entre local e object storage

Fluxo recomendado para adotar storage externo sem mudar URLs publicas:

1. Habilite `UPLOAD_STORAGE_DRIVER=s3` apenas para uploads novos.
2. Opcionalmente sincronize uploads legados para o bucket.
3. Valide com check de integridade.
4. Se precisar voltar, restaure os arquivos para `public/uploads`.
5. So depois volte `UPLOAD_STORAGE_DRIVER=local`.

Sync para object storage:

```bash
npm run uploads:sync-to-object-storage -- --dry-run
npm run uploads:sync-to-object-storage -- --apply
```

Restore do object storage para `public/uploads`:

```bash
npm run uploads:restore-from-object-storage -- --dry-run
npm run uploads:restore-from-object-storage -- --apply
```

Filtros suportados:

- `--folder <pasta>`
- `--upload-id <id>`

Exemplos:

```bash
npm run uploads:sync-to-object-storage -- --apply --folder=posts
npm run uploads:restore-from-object-storage -- --apply --upload-id=<upload-id>
```

Validacao recomendada:

- Deploy e rotina normal: `npm run uploads:check-integrity -- --mode=fast`
- Verificacao manual mais forte apos sync/restore: `npm run uploads:check-integrity -- --mode=deep`

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
6. Verifique no DevTools que o websocket do Vite usa o mesmo host da pagina e nao `:24678`.

### Fluxo com cloudflared no modo integrado

Checklist:

1. Rode `npm run dev`.
2. Mantenha `VITE_API_BASE=` vazio.
3. Configure o cloudflared para encaminhar `https://dev.nekomata.moe` para `http://127.0.0.1:8080`.
4. Abra a app em `https://dev.nekomata.moe`.
5. Confirme no DevTools:
   - `window.location.origin` e a origem publica esperada
   - `/api/contracts/v1.json` responde na mesma origem
   - o websocket HMR usa o mesmo host da pagina

Troubleshooting:

- Se `localhost` ainda mostrar um host publico no HMR, confirme que a aba realmente esta carregando `http://localhost:8080` e que o request de `@vite/client` veio da instancia local.
- Se o contrato da API responder com suporte EPUB mas `POST /api/projects/epub/import` der `404`, o tunel/proxy esta apontando para outra instancia.

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

### Erro: `storage_provider_not_configured` ou falha ao iniciar com `UPLOAD_STORAGE_DRIVER=s3`

Causa comum:

- bucket, regiao ou credenciais nao configurados
- `UPLOAD_STORAGE_ENDPOINT` ausente em providers que exigem endpoint customizado (ex.: R2)

Correcao:

1. Confirme no `.env` ou `.env.prod`:
   - `UPLOAD_STORAGE_BUCKET`
   - `UPLOAD_STORAGE_REGION`
   - `UPLOAD_STORAGE_ACCESS_KEY_ID`
   - `UPLOAD_STORAGE_SECRET_ACCESS_KEY`
2. Se estiver usando R2, defina `UPLOAD_STORAGE_ENDPOINT`.
3. Se nao quiser usar bucket agora, volte para:

```dotenv
UPLOAD_STORAGE_DRIVER=local
UPLOAD_STORAGE_DELIVERY=proxy
```

### Erro: check em modo `deep` acusa assets remotos ausentes

Causa comum:

- o upload foi marcado como remoto, mas original ou variantes nao existem mais no bucket
- sync parcial ou rollback incompleto

Correcao:

1. Rode novamente o sync ou restore apropriado.
2. Revalide com:

```bash
npm run uploads:check-integrity -- --mode=deep
```

3. Nao volte `UPLOAD_STORAGE_DRIVER=local` enquanto os arquivos ainda nao tiverem sido restaurados para `public/uploads`.

### Erro: rollback para `local` concluido no `.env`, mas arquivos continuam faltando

Causa comum:

- `UPLOAD_STORAGE_DRIVER=local` foi reativado antes do restore do object storage para `public/uploads`

Correcao:

1. Restaure primeiro os arquivos:

```bash
npm run uploads:restore-from-object-storage -- --apply
```

2. Valide em modo forte:

```bash
npm run uploads:check-integrity -- --mode=deep
```

3. So depois mantenha `UPLOAD_STORAGE_DRIVER=local`.

### Diferenca pratica entre `fast` e `deep` no check de integridade

- `fast`: recomendado para deploy e rotina. Valida referencias, metadata e arquivos locais sem fazer verificacao remota em massa.
- `deep`: recomendado para auditoria manual, pos-sync e pos-restore. Tambem faz verificacao remota dos assets em storage externo.

## 13. Referencia Rapida de Comandos

Setup local rapido:

```bash
npm install
npm run setup:dev
```

Setup local manual (alternativa):

```bash
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
npm run uploads:check-integrity -- --mode=fast
npm run uploads:check-integrity -- --mode=deep
npm run uploads:sync-to-object-storage -- --dry-run
npm run uploads:sync-to-object-storage -- --apply
npm run uploads:restore-from-object-storage -- --dry-run
npm run uploads:restore-from-object-storage -- --apply
```

Producao (ordem):

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d postgres
docker compose --env-file .env.prod -f docker-compose.prod.yml pull app
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app npm run prisma:migrate:deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app npm run uploads:check-integrity -- --mode=fast
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
