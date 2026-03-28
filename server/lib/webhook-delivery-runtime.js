const REQUIRED_DEPENDENCY_KEYS = [
  "buildWebhookTargetLabel",
  "clampWebhookInteger",
  "createRequestId",
  "createWebhookAuditReqFromContextBase",
  "resolveWebhookAuditActionsBase",
  "upsertWebhookDelivery",
  "validateWebhookUrlForProvider",
  "webhookDeliveryScope",
  "webhookDeliveryStatus",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[webhook-delivery-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createWebhookDeliveryRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    buildWebhookTargetLabel,
    clampWebhookInteger,
    createRequestId,
    createWebhookAuditReqFromContextBase,
    resolveWebhookAuditActionsBase,
    upsertWebhookDelivery,
    validateWebhookUrlForProvider,
    webhookDeliveryScope,
    webhookDeliveryStatus,
  } = dependencies;

  const createWebhookAuditReqFromContext = (contextInput = {}) =>
    createWebhookAuditReqFromContextBase(contextInput, createRequestId);

  const resolveWebhookAuditActions = (scope) =>
    resolveWebhookAuditActionsBase(scope, webhookDeliveryScope);

  const enqueueWebhookDelivery = ({
    scope,
    provider = "discord",
    webhookUrl,
    payload,
    channel = "",
    eventKey = "",
    timeoutMs = 5000,
    maxAttempts = 1,
    targetLabel = "",
    context = {},
  } = {}) => {
    const validated = validateWebhookUrlForProvider({ provider, webhookUrl });
    if (!validated.ok) {
      return {
        ok: false,
        status: validated.code === "missing_webhook_url" ? "skipped" : "failed",
        code: validated.code,
      };
    }

    const now = new Date().toISOString();
    const record = upsertWebhookDelivery({
      id: createRequestId(),
      scope: String(scope || "").trim(),
      provider: String(provider || "").trim().toLowerCase(),
      channel: String(channel || "").trim() || null,
      eventKey: String(eventKey || "").trim() || null,
      status: webhookDeliveryStatus.QUEUED,
      targetUrl: validated.url,
      targetLabel: String(targetLabel || "").trim() || buildWebhookTargetLabel(validated.url),
      payload: payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {},
      context:
        context && typeof context === "object" && !Array.isArray(context)
          ? {
              ...context,
              timeoutMs: clampWebhookInteger(timeoutMs, 1000, 30000, 5000),
            }
          : { timeoutMs: clampWebhookInteger(timeoutMs, 1000, 30000, 5000) },
      attemptCount: 0,
      maxAttempts: clampWebhookInteger(maxAttempts, 1, 10, 1),
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });

    if (!record) {
      return { ok: false, status: "failed", code: "delivery_enqueue_failed" };
    }

    return {
      ok: true,
      status: "queued",
      code: "queued",
      deliveryId: record.id,
      delivery: record,
    };
  };

  return {
    createWebhookAuditReqFromContext,
    enqueueWebhookDelivery,
    resolveWebhookAuditActions,
  };
};

export default createWebhookDeliveryRuntime;
