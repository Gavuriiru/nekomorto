const DISCORD_WEBHOOK_HOSTS = new Set([
  "discord.com",
  "discordapp.com",
  "canary.discord.com",
  "ptb.discord.com",
]);

const DISCORD_WEBHOOK_PATH_PATTERN = /^\/api\/webhooks\/[^/]+\/[^/]+\/?$/i;

const toSafeUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

export const validateDiscordWebhookUrl = (value) => {
  const parsed = toSafeUrl(value);
  if (!parsed) {
    return { ok: false, code: "invalid_webhook_url", reason: "invalid_url" };
  }

  const protocol = String(parsed.protocol || "").toLowerCase();
  if (protocol !== "https:") {
    return { ok: false, code: "invalid_webhook_url", reason: "invalid_protocol" };
  }

  const hostname = String(parsed.hostname || "").toLowerCase();
  if (!DISCORD_WEBHOOK_HOSTS.has(hostname)) {
    return { ok: false, code: "invalid_webhook_url", reason: "unsupported_host" };
  }

  if (!DISCORD_WEBHOOK_PATH_PATTERN.test(String(parsed.pathname || ""))) {
    return { ok: false, code: "invalid_webhook_url", reason: "invalid_path" };
  }

  return {
    ok: true,
    url: parsed.toString(),
    host: hostname,
    pathname: parsed.pathname,
  };
};

export const validateWebhookUrlForProvider = ({ provider, webhookUrl } = {}) => {
  const normalizedProvider = String(provider || "")
    .trim()
    .toLowerCase();
  if (!normalizedProvider) {
    return { ok: false, code: "missing_provider" };
  }
  if (!String(webhookUrl || "").trim()) {
    return { ok: false, code: "missing_webhook_url" };
  }
  if (normalizedProvider !== "discord") {
    return { ok: false, code: "unsupported_provider" };
  }
  return validateDiscordWebhookUrl(webhookUrl);
};

const redactWebhookPath = (pathname) => {
  const parts = String(pathname || "")
    .split("/")
    .filter(Boolean);
  if (parts.length < 4) {
    return "/api/webhooks/...";
  }
  return `/${parts[0]}/${parts[1]}/${parts[2]}/...`;
};

export const buildWebhookTargetLabel = (value) => {
  const validated = validateDiscordWebhookUrl(value);
  if (!validated.ok) {
    return "discord://invalid";
  }
  return `${validated.host}${redactWebhookPath(validated.pathname)}`;
};

export const DISCORD_ALLOWED_WEBHOOK_HOSTS = Object.freeze(Array.from(DISCORD_WEBHOOK_HOSTS));
