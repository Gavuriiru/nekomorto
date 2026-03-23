import { validateWebhookUrlForProvider } from "./validation.js";

const parseRetryAfterMs = (response) => {
  const headerValue = String(response?.headers?.get?.("retry-after") || "").trim();
  if (!headerValue) {
    return null;
  }
  const numericSeconds = Number(headerValue);
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
    return Math.floor(numericSeconds * 1000);
  }
  const parsedDate = new Date(headerValue).getTime();
  if (!Number.isFinite(parsedDate)) {
    return null;
  }
  return Math.max(0, parsedDate - Date.now());
};

const isRetryableHttpStatus = (statusCode) => {
  const numeric = Number(statusCode);
  if (!Number.isFinite(numeric)) {
    return false;
  }
  return numeric === 408 || numeric === 425 || numeric === 429 || numeric >= 500;
};

export const dispatchWebhookMessage = async ({
  provider,
  webhookUrl,
  message,
  timeoutMs = 5000,
  retries = 0,
} = {}) => {
  const safeProvider = String(provider || "")
    .trim()
    .toLowerCase();
  if (!safeProvider) {
    return { ok: false, status: "failed", code: "missing_provider" };
  }
  const validatedWebhook = validateWebhookUrlForProvider({ provider: safeProvider, webhookUrl });
  if (!validatedWebhook.ok) {
    return {
      ok: false,
      status: validatedWebhook.code === "missing_webhook_url" ? "skipped" : "failed",
      code: validatedWebhook.code,
      retryable: false,
      durationMs: 0,
    };
  }
  if (!message || typeof message !== "object") {
    return { ok: false, status: "failed", code: "invalid_message", retryable: false, durationMs: 0 };
  }
  const safeWebhookUrl = validatedWebhook.url;
  const maxRetries = Math.max(0, Number(retries) || 0);
  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(100, Number(timeoutMs) || 5000));
    const startedAt = Date.now();
    try {
      const response = await fetch(safeWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const durationMs = Math.max(0, Date.now() - startedAt);
      if (response.ok) {
        return {
          ok: true,
          status: "sent",
          statusCode: response.status,
          attempt,
          retryable: false,
          durationMs,
        };
      }
      const bodyText = await response.text().catch(() => "");
      const retryAfterMs = parseRetryAfterMs(response);
      const result = {
        ok: false,
        status: "failed",
        code: "http_error",
        statusCode: response.status,
        bodyText: String(bodyText || "").slice(0, 500),
        attempt,
        retryAfterMs,
        retryable: isRetryableHttpStatus(response.status),
        durationMs,
      };
      if (attempt > maxRetries || !result.retryable) {
        return result;
      }
    } catch (error) {
      clearTimeout(timer);
      const durationMs = Math.max(0, Date.now() - startedAt);
      const result = {
        ok: false,
        status: "failed",
        code: error?.name === "AbortError" ? "timeout" : "network_error",
        message: String(error?.message || error || ""),
        attempt,
        retryable: true,
        durationMs,
      };
      if (attempt > maxRetries) {
        return result;
      }
    }
  }
  return { ok: false, status: "failed", code: "unknown", retryable: false, durationMs: 0 };
};
