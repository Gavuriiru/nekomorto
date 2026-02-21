# Runbook de Producao DB-Only (Ubuntu + Caddy + Docker Compose)

Este runbook define o fluxo oficial para `https://nekomata.moe` em topologia de host unico:

- `app` + `postgres` + `caddy` no mesmo servidor Ubuntu
- deploy automatico por GitHub Actions + SSH
- runtime DB-only, sem fallback JSON

## 1. Premissas e arquivos oficiais

Arquivos usados em producao:

- `docker-compose.prod.yml`
- `ops/caddy/Caddyfile`
- `ops/prod/.env.prod.example`
- `ops/prod/deploy-prod.sh`
- `.github/workflows/deploy-prod.yml`

Premissas:

- `DATABASE_URL` obrigatoria
- sessao em PostgreSQL (`SESSION_TABLE=user_sessions`)
- `/api/health` com `dataSource=db`
- runtime Node pinado em `24.13.0` (npm `11.x`)
- upgrades de runtime/deps apenas via PR dedicado com gate completo

## 1.1 Politica de atualizacao de runtime/deps

1. Nao usar tags flutuantes de Node em producao.
2. Atualizar pin de Node em ciclos controlados (PR dedicado).
3. Priorizar patch/minor de dependencias; majors em PRs separados.
4. Cadencia recomendada: 1 PR mensal de manutencao (runtime + deps seguras).
5. Gate obrigatorio em toda rodada:

- `npm run lint`
- `npm run test`
- `npm run api:smoke -- --base=<ambiente>`

## 2. Provisionamento inicial do host Ubuntu

1. Instalar Docker Engine + Compose plugin.
2. Criar diretorio de deploy:

```bash
sudo mkdir -p /srv/nekomorto
sudo chown -R $USER:$USER /srv/nekomorto
```

3. Clonar repositorio:

```bash
git clone <REPO_URL> /srv/nekomorto
cd /srv/nekomorto
```

4. Criar arquivo de ambiente:

```bash
cp ops/prod/.env.prod.example .env.prod
```

5. Ajustar variaveis minimas em `.env.prod`:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://nekomorto_app:<senha>@postgres:5432/nekomorto
SESSION_SECRET=<segredo_forte>
SESSION_TABLE=user_sessions
APP_ORIGIN=https://nekomata.moe,https://www.nekomata.moe
ADMIN_ORIGINS=<origens_admin>
MAINTENANCE_MODE=false
```

6. Configurar firewall:

- abrir `22`, `80`, `443`
- nao expor `5432`
7. Confirmar DNS antes do primeiro `up` do Caddy:

- `nekomata.moe` e `www.nekomata.moe` apontando para o IP publico do host

## 3. Primeiro deploy em producao

No host:

```bash
cd /srv/nekomorto
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d postgres
docker compose --env-file .env.prod -f docker-compose.prod.yml build app
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app npm run prisma:migrate:deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d app caddy
```

Validar:

```bash
curl -fsS https://nekomata.moe/api/health
npm run api:smoke -- --base=https://nekomata.moe
```

Criterio de aceite:

- `health` retorna `ok=true`, `dataSource=db`, `maintenanceMode=false`
- smoke 100% ok

## 4. Migracao de dados (local -> producao)

1. Congelar escrita na origem (`MAINTENANCE_MODE=true`).
2. Gerar dump SQL na origem.
3. Transferir dump para o host de producao (`scp`).
4. Restaurar no destino com override de compose/env:

```bash
cd /srv/nekomorto
COMPOSE_FILE=/srv/nekomorto/docker-compose.prod.yml \
ENV_FILE=/srv/nekomorto/.env.prod \
./ops/postgres/restore.sh /path/backup.sql.gz
```

5. Reaplicar migrations e validar estado:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app npm run prisma:migrate:deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm app npx prisma migrate status
```

6. Reabrir escrita (`MAINTENANCE_MODE=false`) apos health/smoke ok.

## 5. Deploy automatico por GitHub Actions

Workflow:

- `.github/workflows/deploy-prod.yml`

Trigger:

- push em `main`

Secrets obrigatorios:

- `PROD_HOST`
- `PROD_PORT` (opcional; default 22)
- `PROD_USER`
- `PROD_SSH_KEY`
- `PROD_DEPLOY_PATH` (ex.: `/srv/nekomorto`)

Fluxo remoto:

1. sync de `origin/main`
2. `docker compose build app`
3. `docker compose run --rm app npm run prisma:migrate:deploy`
4. `docker compose up -d app caddy`
5. health check interno/externo

Recomendacao:

- manter `environment: production` com aprovacao manual nas primeiras semanas

## 6. Backup e restore continuo

Backup diario (cron) com override de compose/env:

```bash
cd /srv/nekomorto
COMPOSE_FILE=/srv/nekomorto/docker-compose.prod.yml \
ENV_FILE=/srv/nekomorto/.env.prod \
./ops/postgres/backup.sh
```

Restore sob demanda:

```bash
cd /srv/nekomorto
COMPOSE_FILE=/srv/nekomorto/docker-compose.prod.yml \
ENV_FILE=/srv/nekomorto/.env.prod \
./ops/postgres/restore.sh /path/backup.sql.gz
```

## 7. Operacao em janela de manutencao

1. Definir `MAINTENANCE_MODE=true` em `.env.prod`.
2. Reiniciar app:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d app
```

3. Validar:

```bash
npm run api:health:check -- --base=https://nekomata.moe --expect-source=db --expect-maintenance=true
```

4. Finalizar operacao, voltar `MAINTENANCE_MODE=false`, reiniciar app.

## 8. Rollback

Rollback suportado:

1. Codigo: voltar commit e executar deploy novamente.
2. Dados: restore SQL + restore de uploads.

Rollback para JSON nao e suportado.
