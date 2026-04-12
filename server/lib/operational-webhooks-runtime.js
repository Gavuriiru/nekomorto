const WEBHOOK_STATE_KEY_OPS_ALERTS_BASELINE = "ops_alerts_baseline";

const REQUIRED_DEPENDENCY_KEYS = [
  "appendAuditLog",
  "buildOperationalAlertsWebhookNotification",
  "buildWebhookAuditMeta",
  "buildWebhookTargetLabel",
  "clampWebhookInteger",
  "claimWebhookDelivery",
  "computeWebhookRetryDelayMs",
  "createRequestId",
  "createSystemAuditReq",
  "createWebhookAuditReqFromContext",
  "createWebhookWorkerId",
  "diffOperationalAlertSets",
  "dispatchWebhookMessage",
  "enqueueWebhookDelivery",
  "evaluateOperationalMonitoring",
  "loadIntegrationSettings",
  "loadWebhookState",
  "primaryAppOrigin",
  "resolveWebhookAuditActions",
  "toDiscordWebhookPayload",
  "upsertWebhookDelivery",
  "webhookDeliveryScope",
  "webhookDeliveryStatus",
  "writeWebhookState",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[operational-webhooks-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createOperationalWebhooksRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    appendAuditLog,
    buildOperationalAlertsWebhookNotification,
    buildWebhookAuditMeta,
    buildWebhookTargetLabel,
    clampWebhookInteger,
    claimWebhookDelivery,
    computeWebhookRetryDelayMs,
    createRequestId,
    createSystemAuditReq,
    createWebhookAuditReqFromContext,
    createWebhookWorkerId,
    diffOperationalAlertSets,
    dispatchWebhookMessage,
    enqueueWebhookDelivery,
    evaluateOperationalMonitoring,
    loadIntegrationSettings,
    loadWebhookState,
    operationalWebhookIntervalDefaultMs = 60_000,
    operationalWebhookIntervalMaxMs = 3_600_000,
    operationalWebhookIntervalMinMs = 10_000,
    primaryAppOrigin,
    resolveWebhookAuditActions,
    toDiscordWebhookPayload,
    upsertWebhookDelivery,
    webhookDeliveryScope,
    webhookDeliveryStatus,
    writeWebhookState,
  } = dependencies;

  const operationalAlertsWebhookState = {
    inFlight: null,
    timer: null,
    lastStartedAt: 0,
  };

  const webhookDeliveryWorkerState = {
    inFlight: null,
    timer: null,
    workerId: createWebhookWorkerId("backend-webhook"),
  };

  const buildOperationalDashboardUrl = () => `${primaryAppOrigin}/dashboard`;

  const loadOperationalWebhookSettings = () => loadIntegrationSettings().operational;

  const loadSecurityWebhookSettings = () => loadIntegrationSettings().security;

  const resolveOperationalWebhookIntervalMs = (settings) =>
    Math.min(
      Math.max(
        Math.floor(Number(settings?.intervalMs) || operationalWebhookIntervalDefaultMs),
        operationalWebhookIntervalMinMs,
      ),
      operationalWebhookIntervalMaxMs,
    );

  const loadOperationalAlertsBaseline = () => {
    const state = loadWebhookState(WEBHOOK_STATE_KEY_OPS_ALERTS_BASELINE);
    return Array.isArray(state?.data?.alerts) ? state.data.alerts : [];
  };

  const writeOperationalAlertsBaseline = ({ alerts = [], generatedAt = "" } = {}) =>
    writeWebhookState(WEBHOOK_STATE_KEY_OPS_ALERTS_BASELINE, {
      alerts: Array.isArray(alerts) ? alerts : [],
      generatedAt: String(generatedAt || new Date().toISOString()),
    });

  const buildWebhookFailureDetail = (result) =>
    String(result?.bodyText || result?.message || result?.code || "")
      .trim()
      .slice(0, 500);

  const appendWebhookQueuedAuditLog = ({ scope, delivery, req } = {}) => {
    const auditConfig = resolveWebhookAuditActions(scope);
    appendAuditLog(
      req || createWebhookAuditReqFromContext(delivery?.context),
      auditConfig.queuedAction,
      auditConfig.resource,
      {
        ...buildWebhookAuditMeta(delivery),
        attempt: 0,
      },
    );
  };

  const appendWebhookDeliveryAttemptAuditLog = ({
    delivery,
    result,
    nextAttemptAt = null,
    terminal = false,
  } = {}) => {
    const auditConfig = resolveWebhookAuditActions(delivery?.scope);
    const action = result?.ok ? auditConfig.sentAction : auditConfig.failedAction;
    appendAuditLog(
      createWebhookAuditReqFromContext(delivery?.context),
      action,
      auditConfig.resource,
      {
        ...buildWebhookAuditMeta(delivery),
        status: result?.ok ? "sent" : terminal ? "failed" : "retrying",
        code: result?.code || null,
        statusCode: result?.statusCode || null,
        attempt: result?.attempt || null,
        durationMs: result?.durationMs || null,
        nextAttemptAt,
        error: result?.ok ? null : buildWebhookFailureDetail(result) || null,
      },
    );
  };

  const resolveWebhookDeliveryTimeoutMs = (delivery) => {
    const timeoutMs = delivery?.context?.timeoutMs;
    return clampWebhookInteger(timeoutMs, 1000, 30000, 5000);
  };

  const processWebhookDelivery = async (delivery) => {
    const now = new Date();
    const attemptedCount = clampWebhookInteger(delivery?.attemptCount, 0, 1000, 0) + 1;
    const result = await dispatchWebhookMessage({
      provider: delivery?.provider,
      webhookUrl: delivery?.targetUrl,
      message: delivery?.payload,
      timeoutMs: resolveWebhookDeliveryTimeoutMs(delivery),
      retries: 0,
    });
    const updatedBase = {
      ...delivery,
      attemptCount: attemptedCount,
      lastAttemptAt: now.toISOString(),
      lastStatusCode: result?.statusCode || null,
      lastErrorCode: result?.ok ? null : result?.code || null,
      lastError: result?.ok ? null : buildWebhookFailureDetail(result) || null,
      processingOwner: null,
      processingStartedAt: null,
      updatedAt: now.toISOString(),
    };
    if (result.ok) {
      const persisted = upsertWebhookDelivery({
        ...updatedBase,
        status: webhookDeliveryStatus.SENT,
        nextAttemptAt: null,
        sentAt: now.toISOString(),
      });
      appendWebhookDeliveryAttemptAuditLog({
        delivery: persisted || updatedBase,
        result: { ...result, attempt: attemptedCount },
        terminal: true,
      });
      return persisted || updatedBase;
    }

    if (result.retryable && attemptedCount < clampWebhookInteger(delivery?.maxAttempts, 1, 10, 1)) {
      const delayMs = computeWebhookRetryDelayMs({
        attemptCount: attemptedCount,
        retryAfterMs: result?.retryAfterMs,
      });
      const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
      const persisted = upsertWebhookDelivery({
        ...updatedBase,
        status: webhookDeliveryStatus.RETRYING,
        nextAttemptAt,
      });
      appendWebhookDeliveryAttemptAuditLog({
        delivery: persisted || updatedBase,
        result: { ...result, attempt: attemptedCount },
        nextAttemptAt,
        terminal: false,
      });
      return persisted || updatedBase;
    }

    const persisted = upsertWebhookDelivery({
      ...updatedBase,
      status: webhookDeliveryStatus.FAILED,
      nextAttemptAt: null,
    });
    appendWebhookDeliveryAttemptAuditLog({
      delivery: persisted || updatedBase,
      result: { ...result, attempt: attemptedCount },
      terminal: true,
    });
    return persisted || updatedBase;
  };

  const runWebhookDeliveryWorkerTick = async () => {
    if (webhookDeliveryWorkerState.inFlight) {
      return webhookDeliveryWorkerState.inFlight;
    }
    webhookDeliveryWorkerState.inFlight = (async () => {
      let processed = 0;
      try {
        while (true) {
          const delivery = await claimWebhookDelivery({
            workerId: webhookDeliveryWorkerState.workerId,
            now: new Date().toISOString(),
          });
          if (!delivery) {
            break;
          }
          processed += 1;
          await processWebhookDelivery(delivery);
        }
        return { ok: true, processed };
      } catch (error) {
        console.error("[webhook-worker] failed", error);
        return {
          ok: false,
          processed,
          error: String(error?.message || error || "webhook_worker_failed"),
        };
      } finally {
        webhookDeliveryWorkerState.inFlight = null;
      }
    })();
    return webhookDeliveryWorkerState.inFlight;
  };

  const buildSecurityWebhookPayload = (event) => {
    const title = `Evento crítico de segurança: ${String(event?.type || "security_event")}`;
    const description = [
      `Status: ${String(event?.status || "open")}`,
      `Risco: ${Number(event?.riskScore || 0)}`,
      event?.actorUserId ? `Ator: ${event.actorUserId}` : "",
      event?.targetUserId ? `Alvo: ${event.targetUserId}` : "",
      event?.ip ? `IP: ${event.ip}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      content: "Alerta crítico de segurança detectado.",
      embeds: [
        {
          title,
          description: description || "Sem detalhes adicionais.",
          color: 0xff4d4f,
          timestamp: new Date(event?.ts || Date.now()).toISOString(),
          fields: [
            {
              name: "Dashboard",
              value: buildOperationalDashboardUrl(),
              inline: false,
            },
            {
              name: "Event ID",
              value: String(event?.id || "unknown"),
              inline: false,
            },
          ],
        },
      ],
      allowed_mentions: { parse: [] },
    };
  };

  const buildOperationalAlertsWebhookPayload = ({ transition, generatedAt }) =>
    toDiscordWebhookPayload(
      buildOperationalAlertsWebhookNotification({
        transition,
        dashboardUrl: buildOperationalDashboardUrl(),
        generatedAt,
      }),
    );

  const dispatchCriticalSecurityEventWebhook = async (event) => {
    const securitySettings = loadSecurityWebhookSettings();
    if (!event || securitySettings.enabled !== true) {
      return { ok: false, status: "skipped", code: "disabled" };
    }
    if (!securitySettings.webhookUrl) {
      return { ok: false, status: "skipped", code: "missing_webhook_url" };
    }
    if (securitySettings.provider !== "discord") {
      return { ok: false, status: "skipped", code: "unsupported_provider" };
    }
    const payload = buildSecurityWebhookPayload(event);
    const queued = enqueueWebhookDelivery({
      scope: webhookDeliveryScope.SECURITY,
      provider: "discord",
      webhookUrl: securitySettings.webhookUrl,
      payload,
      timeoutMs: securitySettings.timeoutMs,
      maxAttempts: 4,
      targetLabel: buildWebhookTargetLabel(securitySettings.webhookUrl),
      context: {
        eventLabel: String(event.type || "security_event"),
        securityEventId: String(event.id || ""),
        actorId: "system",
        actorName: "System",
        requestId: `security-webhook-${String(event.id || createRequestId())}`,
      },
    });
    if (!queued.ok) {
      appendAuditLog(createSystemAuditReq(), "security.webhook.failed", "security", {
        id: event.id,
        type: event.type,
        severity: event.severity,
        code: queued.code || null,
      });
      return queued;
    }
    appendWebhookQueuedAuditLog({
      scope: webhookDeliveryScope.SECURITY,
      delivery: queued.delivery,
      req: createSystemAuditReq(),
    });
    void runWebhookDeliveryWorkerTick();
    return queued;
  };

  const dispatchOperationalAlertsWebhookTransition = async ({ transition, generatedAt }) => {
    const operationalSettings = loadOperationalWebhookSettings();
    if (!transition?.hasChanges) {
      return { ok: false, status: "skipped", code: "no_change" };
    }

    if (operationalSettings.enabled !== true) {
      appendAuditLog(createSystemAuditReq(), "ops_alerts.webhook.skipped", "system", {
        reason: "disabled",
        changes:
          Number(transition.triggered?.length || 0) +
          Number(transition.changed?.length || 0) +
          Number(transition.resolved?.length || 0),
      });
      return { ok: false, status: "skipped", code: "disabled" };
    }

    if (!operationalSettings.webhookUrl) {
      appendAuditLog(createSystemAuditReq(), "ops_alerts.webhook.skipped", "system", {
        reason: "missing_webhook_url",
      });
      return { ok: false, status: "skipped", code: "missing_webhook_url" };
    }

    if (operationalSettings.provider !== "discord") {
      appendAuditLog(createSystemAuditReq(), "ops_alerts.webhook.skipped", "system", {
        reason: "unsupported_provider",
        provider: operationalSettings.provider,
      });
      return { ok: false, status: "skipped", code: "unsupported_provider" };
    }

    const payload = buildOperationalAlertsWebhookPayload({ transition, generatedAt });
    const queued = enqueueWebhookDelivery({
      scope: webhookDeliveryScope.OPS_ALERTS,
      provider: operationalSettings.provider,
      webhookUrl: operationalSettings.webhookUrl,
      payload,
      timeoutMs: operationalSettings.timeoutMs,
      maxAttempts: 4,
      targetLabel: buildWebhookTargetLabel(operationalSettings.webhookUrl),
      context: {
        eventLabel: "Alertas operacionais",
        triggeredCount: Number(transition.triggered?.length || 0),
        changedCount: Number(transition.changed?.length || 0),
        resolvedCount: Number(transition.resolved?.length || 0),
        generatedAt: String(generatedAt || ""),
        actorId: "system",
        actorName: "System",
        requestId: `ops-alerts-webhook-${createRequestId()}`,
      },
    });
    if (!queued.ok) {
      appendAuditLog(createSystemAuditReq(), "ops_alerts.webhook.failed", "system", {
        provider: operationalSettings.provider,
        code: queued.code || "delivery_enqueue_failed",
      });
      return queued;
    }
    appendWebhookQueuedAuditLog({
      scope: webhookDeliveryScope.OPS_ALERTS,
      delivery: queued.delivery,
      req: createSystemAuditReq(),
    });
    void runWebhookDeliveryWorkerTick();
    return queued;
  };

  const runOperationalAlertsWebhookTick = async () => {
    if (operationalAlertsWebhookState.inFlight) {
      return operationalAlertsWebhookState.inFlight;
    }
    operationalAlertsWebhookState.inFlight = (async () => {
      try {
        const snapshot = await evaluateOperationalMonitoring();
        const transition = diffOperationalAlertSets({
          previousAlerts: loadOperationalAlertsBaseline(),
          currentAlerts: snapshot.alerts.alerts,
        });
        const result = await dispatchOperationalAlertsWebhookTransition({
          transition,
          generatedAt: snapshot.alerts.generatedAt,
        });
        if (result.ok) {
          writeOperationalAlertsBaseline({
            alerts: Array.isArray(snapshot.alerts.alerts) ? snapshot.alerts.alerts : [],
            generatedAt: snapshot.alerts.generatedAt,
          });
        }
        return result;
      } catch (error) {
        appendAuditLog(createSystemAuditReq(), "ops_alerts.webhook.failed", "system", {
          provider: loadOperationalWebhookSettings()?.provider,
          code: "tick_failed",
          error: String(error?.message || error || "tick_failed"),
        });
        return { ok: false, status: "failed", code: "tick_failed" };
      } finally {
        operationalAlertsWebhookState.inFlight = null;
      }
    })();
    return operationalAlertsWebhookState.inFlight;
  };

  const runOperationalAlertsSchedulerTick = async () => {
    const operationalSettings = loadOperationalWebhookSettings();
    if (operationalSettings.enabled !== true) {
      return { ok: false, status: "skipped", code: "disabled" };
    }
    const now = Date.now();
    const intervalMs = resolveOperationalWebhookIntervalMs(operationalSettings);
    if (
      operationalAlertsWebhookState.lastStartedAt > 0 &&
      now - operationalAlertsWebhookState.lastStartedAt < intervalMs
    ) {
      return { ok: false, status: "skipped", code: "not_due" };
    }
    operationalAlertsWebhookState.lastStartedAt = now;
    return runOperationalAlertsWebhookTick();
  };

  return {
    appendWebhookQueuedAuditLog,
    buildOperationalAlertsWebhookPayload,
    buildSecurityWebhookPayload,
    dispatchCriticalSecurityEventWebhook,
    operationalAlertsWebhookState,
    runOperationalAlertsSchedulerTick,
    runOperationalAlertsWebhookTick,
    runWebhookDeliveryWorkerTick,
    webhookDeliveryWorkerState,
  };
};

export default createOperationalWebhooksRuntime;
