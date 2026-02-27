# Runbook: Incidente Geral

## Objetivo
Padronizar resposta a incidentes de seguranca/operacao, com classificacao de severidade, comunicacao, mitigacao e recuperacao.

## Classificacao SEV
- `SEV-1`: indisponibilidade total, comprometimento de conta owner/admin, vazamento confirmado.
- `SEV-2`: degradacao severa de fluxo critico (auth, publicacao, moderacao, export admin).
- `SEV-3`: degradacao parcial com workaround.
- `SEV-4`: anomalia sem impacto direto em usuario final.

## Papeis
- `Incident Commander (IC)`: coordena resposta e decide priorizacao.
- `Ops Lead`: executa mitigacoes infra/deploy.
- `Backend Lead`: diagnostico app/dados.
- `Comms Owner`: status interno e externo.

## Checklist de resposta
1. Abrir incidente com `id`, severidade inicial, horario UTC e responsaveis.
2. Congelar alteracoes de deploy nao essenciais.
3. Coletar sinais: logs estruturados, metricas, traces, eventos de seguranca, audit log.
4. Definir mitigacao de curto prazo (rollback, feature flag off, isolamento de rota).
5. Validar recuperacao com smoke (`/api/health/live`, `/api/health/ready`, fluxos criticos).
6. Atualizar stakeholders em cadencia fixa (15 min em SEV-1/2).
7. Encerrar incidente com status final e acao de follow-up.

## Rollback
- Usar ultimo deploy estavel conhecido.
- Revalidar migracoes e compatibilidade de sessao.
- Confirmar que filas/jobs voltaram ao comportamento nominal.

## Evidencias minimas
- Timeline com timestamps.
- Request IDs representativos.
- Graficos de erro/latencia.
- Acoes executadas e resultado.
