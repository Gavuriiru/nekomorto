export const dispatchWebhookMessage = async ({
  provider,
  webhookUrl,
  message,
  timeoutMs = 5000,
  retries = 0,
} = {}) => {
  const safeProvider = String(provider || "").trim().toLowerCase();
  const safeWebhookUrl = String(webhookUrl || "").trim();
  if (!safeProvider) {
    return { ok: false, status: "failed", code: "missing_provider" };
  }
  if (!safeWebhookUrl) {
    return { ok: false, status: "skipped", code: "missing_webhook_url" };
  }
  if (!message || typeof message !== "object") {
    return { ok: false, status: "failed", code: "invalid_message" };
  }
  const maxRetries = Math.max(0, Number(retries) || 0);
  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(100, Number(timeoutMs) || 5000));
    try {
      const response = await fetch(safeWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok) {
        return { ok: true, status: "sent", statusCode: response.status, attempt };
      }
      const bodyText = await response.text().catch(() => "");
      const result = {
        ok: false,
        status: "failed",
        code: "http_error",
        statusCode: response.status,
        bodyText: String(bodyText || "").slice(0, 500),
        attempt,
      };
      if (attempt > maxRetries || response.status < 500) {
        return result;
      }
    } catch (error) {
      clearTimeout(timer);
      const result = {
        ok: false,
        status: "failed",
        code: error?.name === "AbortError" ? "timeout" : "network_error",
        message: String(error?.message || error || ""),
        attempt,
      };
      if (attempt > maxRetries) {
        return result;
      }
    }
  }
  return { ok: false, status: "failed", code: "unknown" };
};

