import {
  migrateEditorialMentionPlaceholdersInSettings,
  normalizeEditorialWebhookSettings,
} from "./editorial.js";

export const WEBHOOK_SETTINGS_VERSION = 2;
export const WEBHOOK_PROVIDER_DISCORD = "discord";
export const WEBHOOK_TIMEOUT_DEFAULT_MS = 5_000;
export const WEBHOOK_TIMEOUT_MIN_MS = 1_000;
export const WEBHOOK_TIMEOUT_MAX_MS = 30_000;
export const OPERATIONAL_WEBHOOK_INTERVAL_DEFAULT_MS = 60_000;
export const OPERATIONAL_WEBHOOK_INTERVAL_MIN_MS = 10_000;
export const OPERATIONAL_WEBHOOK_INTERVAL_MAX_MS = 60 * 60 * 1_000;

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const clampInt = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(numeric)));
};

const normalizeProvider = (value, fallback = WEBHOOK_PROVIDER_DISCORD) => {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase();
  return normalized === WEBHOOK_PROVIDER_DISCORD ? WEBHOOK_PROVIDER_DISCORD : fallback;
};

export const defaultOperationalWebhookSettings = (fallback = {}) => {
  const source = asObject(fallback);
  return {
    enabled: source.enabled === true,
    provider: normalizeProvider(source.provider),
    webhookUrl: String(source.webhookUrl || "").trim(),
    timeoutMs: clampInt(
      source.timeoutMs,
      WEBHOOK_TIMEOUT_MIN_MS,
      WEBHOOK_TIMEOUT_MAX_MS,
      WEBHOOK_TIMEOUT_DEFAULT_MS,
    ),
    intervalMs: clampInt(
      source.intervalMs,
      OPERATIONAL_WEBHOOK_INTERVAL_MIN_MS,
      OPERATIONAL_WEBHOOK_INTERVAL_MAX_MS,
      OPERATIONAL_WEBHOOK_INTERVAL_DEFAULT_MS,
    ),
  };
};

export const defaultSecurityWebhookSettings = (fallback = {}) => {
  const source = asObject(fallback);
  return {
    enabled: source.enabled === true,
    provider: normalizeProvider(source.provider),
    webhookUrl: String(source.webhookUrl || "").trim(),
    timeoutMs: clampInt(
      source.timeoutMs,
      WEBHOOK_TIMEOUT_MIN_MS,
      WEBHOOK_TIMEOUT_MAX_MS,
      WEBHOOK_TIMEOUT_DEFAULT_MS,
    ),
  };
};

export const normalizeOperationalWebhookSettings = (value, { fallback = {} } = {}) => {
  const input = asObject(value);
  const defaults = defaultOperationalWebhookSettings(fallback);
  return {
    enabled: input.enabled === true,
    provider: normalizeProvider(input.provider, defaults.provider),
    webhookUrl: String(input.webhookUrl || "").trim(),
    timeoutMs: clampInt(
      input.timeoutMs,
      WEBHOOK_TIMEOUT_MIN_MS,
      WEBHOOK_TIMEOUT_MAX_MS,
      defaults.timeoutMs,
    ),
    intervalMs: clampInt(
      input.intervalMs,
      OPERATIONAL_WEBHOOK_INTERVAL_MIN_MS,
      OPERATIONAL_WEBHOOK_INTERVAL_MAX_MS,
      defaults.intervalMs,
    ),
  };
};

export const normalizeSecurityWebhookSettings = (value, { fallback = {} } = {}) => {
  const input = asObject(value);
  const defaults = defaultSecurityWebhookSettings(fallback);
  return {
    enabled: input.enabled === true,
    provider: normalizeProvider(input.provider, defaults.provider),
    webhookUrl: String(input.webhookUrl || "").trim(),
    timeoutMs: clampInt(
      input.timeoutMs,
      WEBHOOK_TIMEOUT_MIN_MS,
      WEBHOOK_TIMEOUT_MAX_MS,
      defaults.timeoutMs,
    ),
  };
};

export const normalizeWebhookSettingsBundle = (
  payload,
  {
    projectTypes = [],
    defaultProjectTypes = [],
    operationalFallback = {},
    securityFallback = {},
  } = {},
) => {
  const input = asObject(payload);
  const hasUnifiedEnvelope =
    Number(input.version) === WEBHOOK_SETTINGS_VERSION ||
    hasOwn(input, "editorial") ||
    hasOwn(input, "operational") ||
    hasOwn(input, "security");

  const editorial = migrateEditorialMentionPlaceholdersInSettings(
    normalizeEditorialWebhookSettings(hasUnifiedEnvelope ? input.editorial : input, {
      projectTypes,
      defaultProjectTypes,
    }),
  );
  const hasOperational = hasUnifiedEnvelope && hasOwn(input, "operational");
  const hasSecurity = hasUnifiedEnvelope && hasOwn(input, "security");

  return {
    settings: {
      version: WEBHOOK_SETTINGS_VERSION,
      editorial,
      operational: normalizeOperationalWebhookSettings(
        hasOperational ? input.operational : operationalFallback,
        {
          fallback: operationalFallback,
        },
      ),
      security: normalizeSecurityWebhookSettings(hasSecurity ? input.security : securityFallback, {
        fallback: securityFallback,
      }),
    },
    sources: {
      editorial: "stored",
      operational: hasOperational ? "stored" : "env",
      security: hasSecurity ? "stored" : "env",
    },
  };
};
