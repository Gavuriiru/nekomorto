# Runbook: Comprometimento de Conta Admin

## Gatilhos
- Evento `owner_transfer_critical`.
- Evento `admin_action_from_new_network_warning` com forte evidencia.
- Alertas de MFA falhando em burst + acao admin suspeita.

## Acao imediata (primeiros 10 minutos)
1. Classificar como `SEV-1` ate provar o contrario.
2. Revogar sessoes do usuario suspeito (`DELETE /api/admin/users/:id/sessions/:sid` ou rotina em lote).
3. Resetar 2FA do usuario suspeito (`POST /api/admin/users/:id/security/totp/reset`) e forcar novo enrollment.
4. Rotacionar `SESSION_SECRETS` (introduzir novo segredo ativo).
5. Se houver risco de exfiltracao, rotacionar `DATA_ENCRYPTION_KEYS_JSON` conforme processo de keyring.

## Contencao
1. Bloquear mudancas de permissao/owner temporariamente.
2. Auditar `audit_log` e `security_events` no intervalo do incidente.
3. Confirmar integridade de contas owner e admins restantes.

## Recuperacao
1. Restabelecer acessos legitimos com credenciais atualizadas.
2. Validar fluxos: login, MFA verify, sessoes ativas, exports admin.
3. Reativar operacao normal apenas com aprovacao do IC.

## Comunicacao
- Interno imediato (seguranca + lideranca).
- Externo apenas se houver impacto real a usuarios/dados.

## Pos-incidente
- Abrir post-mortem em ate 24h.
- Registrar acoes preventivas com owner e prazo.
