# Rollout Categoria 6 (Staging -> Producao)

Este runbook valida:

- webhook operacional (Discord) por mudanca de estado
- smoke de health + sitemap + RSS
- card de status operacional no dashboard

## 1) Preparacao de env (por ambiente)

No arquivo `.env` do ambiente, configure:

```env
OPS_ALERTS_WEBHOOK_ENABLED=true
OPS_ALERTS_WEBHOOK_PROVIDER=discord
OPS_ALERTS_WEBHOOK_URL=<webhook_do_canal_do_ambiente>
OPS_ALERTS_WEBHOOK_TIMEOUT_MS=5000
OPS_ALERTS_WEBHOOK_INTERVAL_MS=60000
OPS_ALERTS_DB_LATENCY_WARNING_MS=1000
```

Boas praticas:

- staging e producao devem usar webhooks diferentes
- `SESSION_SECRET` forte e diferente entre ambientes
- `NODE_ENV=production`
- `APP_ORIGIN` e `ADMIN_ORIGINS` corretos

## 2) Deploy (staging primeiro)

No host do ambiente:

```bash
ENV_FILE=.env.staging \
HEALTHCHECK_BASE_URL=https://staging.example.com \
./ops/prod/deploy-prod.sh
```

O script ja executa:

- health interno (`/api/health`)
- smoke Categoria 6 interno e externo (quando `RUN_CATEGORY6_SMOKE=true`)

Opcional: desativar smoke no deploy:

```bash
RUN_CATEGORY6_SMOKE=false ./ops/prod/deploy-prod.sh
```

## 3) Validacao webhook (staging)

Forcar alerta controlado de manutencao:

1. Ajustar `MAINTENANCE_MODE=true` no env do staging e reiniciar app.
2. Aguardar `OPS_ALERTS_WEBHOOK_INTERVAL_MS + 15s`.
3. Confirmar mensagem de alerta (triggered) no canal de staging.
4. Voltar `MAINTENANCE_MODE=false` e reiniciar app.
5. Aguardar novamente.
6. Confirmar mensagem de resolucao (resolved).
7. Manter estado estavel por 2 ciclos e confirmar ausencia de spam.

## 4) Smoke manual (staging)

```bash
curl -fsS https://staging.example.com/api/health/live
curl -fsS https://staging.example.com/api/health/ready
curl -fsS https://staging.example.com/api/health
curl -fsS https://staging.example.com/sitemap.xml
curl -fsS https://staging.example.com/rss/posts.xml
curl -fsS https://staging.example.com/rss/lancamentos.xml
curl -fsS "https://staging.example.com/api/public/rss.xml?feed=posts"
curl -fsS "https://staging.example.com/api/public/rss.xml?feed=lancamentos"
```

Checklist esperado:

- status HTTP 200 para endpoints publicos
- `/api/health/ready` pode retornar 503 se `status=fail` (com causa em `checks`)
- XML valido em sitemap/RSS

## 5) Producao

Repetir exatamente os passos de staging, alterando:

- `ENV_FILE=.env.prod`
- `HEALTHCHECK_BASE_URL=https://nekomata.moe`
- webhook de producao

## 6) Pos-validacao

- Verificar card "Status operacional" no dashboard com usuario staff/admin
- Verificar `/api/admin/operational-alerts` com sessao autenticada
- Registrar no changelog interno:
  - horario do deploy
  - ambiente
  - resultado dos smokes
  - resultado do webhook (triggered/resolved)
