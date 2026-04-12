export const WEBHOOK_DELIVERY_STATUS = Object.freeze({
  QUEUED: "queued",
  PROCESSING: "processing",
  RETRYING: "retrying",
  SENT: "sent",
  FAILED: "failed",
});

export const WEBHOOK_DELIVERY_SCOPE = Object.freeze({
  EDITORIAL: "editorial",
  OPS_ALERTS: "ops_alerts",
  SECURITY: "security",
});

export const WEBHOOK_RETRY_BASE_MS = 5_000;
export const WEBHOOK_RETRY_MAX_MS = 15 * 60 * 1000;

const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const normalizeAttemptCount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.floor(numeric);
};

export const isWebhookDeliveryTerminalStatus = (status) =>
  String(status || "")
    .trim()
    .toLowerCase() === WEBHOOK_DELIVERY_STATUS.SENT ||
  String(status || "")
    .trim()
    .toLowerCase() === WEBHOOK_DELIVERY_STATUS.FAILED;

export const isWebhookDeliveryRetryableStatus = (status) =>
  [
    WEBHOOK_DELIVERY_STATUS.QUEUED,
    WEBHOOK_DELIVERY_STATUS.PROCESSING,
    WEBHOOK_DELIVERY_STATUS.RETRYING,
  ].includes(
    String(status || "")
      .trim()
      .toLowerCase(),
  );

export const computeWebhookRetryDelayMs = ({ attemptCount, retryAfterMs } = {}) => {
  const normalizedRetryAfter = Number(retryAfterMs);
  if (Number.isFinite(normalizedRetryAfter) && normalizedRetryAfter > 0) {
    return Math.min(WEBHOOK_RETRY_MAX_MS, Math.max(1_000, Math.floor(normalizedRetryAfter)));
  }
  const exponent = Math.max(0, normalizeAttemptCount(attemptCount) - 1);
  const baseDelay = Math.min(WEBHOOK_RETRY_MAX_MS, WEBHOOK_RETRY_BASE_MS * 2 ** exponent);
  const jitter = Math.floor(baseDelay * (Math.random() * 0.2));
  return Math.min(WEBHOOK_RETRY_MAX_MS, baseDelay + jitter);
};

const buildResourceIds = (context) => {
  const source = asObject(context);
  const resourceIds = {};
  ["postId", "projectId", "securityEventId"].forEach((key) => {
    const value = String(source[key] || "").trim();
    if (value) {
      resourceIds[key] = value;
    }
  });
  return resourceIds;
};

export const toWebhookDeliveryApiResponse = (record = {}) => {
  const context = asObject(record.context);
  const status = String(record.status || "")
    .trim()
    .toLowerCase();
  return {
    id: String(record.id || "").trim(),
    scope: String(record.scope || "").trim(),
    channel: String(record.channel || "").trim(),
    eventKey: String(record.eventKey || "").trim(),
    eventLabel: String(context.eventLabel || "").trim(),
    status,
    provider: String(record.provider || "").trim(),
    attemptCount: normalizeAttemptCount(record.attemptCount),
    maxAttempts: normalizeAttemptCount(record.maxAttempts),
    createdAt: record.createdAt ? String(record.createdAt) : null,
    nextAttemptAt: record.nextAttemptAt ? String(record.nextAttemptAt) : null,
    lastAttemptAt: record.lastAttemptAt ? String(record.lastAttemptAt) : null,
    statusCode: Number.isFinite(Number(record.lastStatusCode))
      ? Number(record.lastStatusCode)
      : null,
    error: record.lastError ? String(record.lastError) : null,
    targetLabel: String(record.targetLabel || "").trim(),
    resourceIds: buildResourceIds(context),
    isRetryable: status === WEBHOOK_DELIVERY_STATUS.FAILED,
  };
};

export const summarizeWebhookDeliveries = (records = []) => {
  const now = Date.now();
  const windowStart = now - 24 * 60 * 60 * 1000;
  return (Array.isArray(records) ? records : []).reduce(
    (summary, record) => {
      const status = String(record?.status || "")
        .trim()
        .toLowerCase();
      if (status === WEBHOOK_DELIVERY_STATUS.QUEUED) {
        summary.queued += 1;
      } else if (status === WEBHOOK_DELIVERY_STATUS.PROCESSING) {
        summary.processing += 1;
      } else if (status === WEBHOOK_DELIVERY_STATUS.RETRYING) {
        summary.retrying += 1;
      } else if (status === WEBHOOK_DELIVERY_STATUS.FAILED) {
        summary.failed += 1;
      }

      const sentAtTs = new Date(record?.sentAt || record?.updatedAt || 0).getTime();
      if (
        status === WEBHOOK_DELIVERY_STATUS.SENT &&
        Number.isFinite(sentAtTs) &&
        sentAtTs >= windowStart
      ) {
        summary.sentLast24h += 1;
      }
      return summary;
    },
    {
      queued: 0,
      processing: 0,
      retrying: 0,
      failed: 0,
      sentLast24h: 0,
    },
  );
};

export const createWebhookWorkerId = (prefix = "webhook-worker") =>
  `${String(prefix || "webhook-worker").trim() || "webhook-worker"}-${process.pid}`;
