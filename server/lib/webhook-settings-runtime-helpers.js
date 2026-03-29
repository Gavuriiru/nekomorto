const requireFunction = (name, value) => {
  if (typeof value !== "function") {
    throw new Error(`${name} must be a function`);
  }
  return value;
};

export const createWebhookSettingsRuntimeHelpers = ({
  createSecurityEventPayload,
  crypto,
  defaultOperationalWebhookSettings,
  defaultProjectTypeCatalog,
  defaultSecurityWebhookSettings,
  isOpsAlertsWebhookEnabled = false,
  migrateEditorialMentionPlaceholdersInSettings,
  normalizeEditorialWebhookSettings,
  normalizeWebhookSettingsBundle,
  opsAlertsWebhookIntervalMs,
  opsAlertsWebhookProvider,
  opsAlertsWebhookTimeoutMs,
  opsAlertsWebhookUrl,
  SecurityEventSeverity,
  SecurityEventStatus,
  validateWebhookUrlForProvider,
} = {}) => {
  const buildSecurityEventPayload = requireFunction(
    "createSecurityEventPayload",
    createSecurityEventPayload,
  );
  const buildOperationalDefaults = requireFunction(
    "defaultOperationalWebhookSettings",
    defaultOperationalWebhookSettings,
  );
  const buildSecurityDefaults = requireFunction(
    "defaultSecurityWebhookSettings",
    defaultSecurityWebhookSettings,
  );
  const normalizeWebhookBundle = requireFunction(
    "normalizeWebhookSettingsBundle",
    normalizeWebhookSettingsBundle,
  );
  const normalizeEditorialSettings = requireFunction(
    "normalizeEditorialWebhookSettings",
    normalizeEditorialWebhookSettings,
  );
  const migrateEditorialPlaceholders = requireFunction(
    "migrateEditorialMentionPlaceholdersInSettings",
    migrateEditorialMentionPlaceholdersInSettings,
  );
  const validateWebhookUrl = requireFunction(
    "validateWebhookUrlForProvider",
    validateWebhookUrlForProvider,
  );

  if (typeof crypto?.randomUUID !== "function") {
    throw new Error("crypto.randomUUID must be available");
  }

  const defaultProjectTypes = Array.isArray(defaultProjectTypeCatalog)
    ? defaultProjectTypeCatalog
    : [];

  const buildEnvOperationalWebhookSettings = () =>
    buildOperationalDefaults({
      enabled: isOpsAlertsWebhookEnabled,
      provider: opsAlertsWebhookProvider,
      webhookUrl: opsAlertsWebhookUrl,
      timeoutMs: opsAlertsWebhookTimeoutMs,
      intervalMs: opsAlertsWebhookIntervalMs,
    });

  const buildEnvSecurityWebhookSettings = () =>
    buildSecurityDefaults({
      enabled: isOpsAlertsWebhookEnabled,
      provider: opsAlertsWebhookProvider,
      webhookUrl: opsAlertsWebhookUrl,
      timeoutMs: opsAlertsWebhookTimeoutMs,
    });

  const buildWebhookSettingsBundle = (payload) =>
    normalizeWebhookBundle(payload, {
      defaultProjectTypes,
      operationalFallback: buildEnvOperationalWebhookSettings(),
      securityFallback: buildEnvSecurityWebhookSettings(),
    });

  const normalizeUnifiedWebhookSettingsForRequest = (settings, projectTypes = []) =>
    normalizeWebhookBundle(settings, {
      projectTypes,
      defaultProjectTypes,
      operationalFallback: buildEnvOperationalWebhookSettings(),
      securityFallback: buildEnvSecurityWebhookSettings(),
    }).settings;

  const ensureWebhookSettingsNoConflict = ({
    res,
    currentSettings,
    currentRevision,
    projectTypes,
    sources,
    options,
  } = {}) => {
    const requestedRevision = String(options?.ifRevision || "").trim();
    if (
      !requestedRevision ||
      options?.forceOverride === true ||
      requestedRevision === currentRevision
    ) {
      return true;
    }
    return res.status(409).json({
      error: "edit_conflict",
      currentRevision,
      settings: currentSettings,
      projectTypes: Array.isArray(projectTypes) ? projectTypes : [],
      sources: sources && typeof sources === "object" ? sources : undefined,
    });
  };

  const ensureEditorialWebhookSettingsNoConflict = ({
    res,
    currentSettings,
    currentRevision,
    projectTypes,
    options,
  } = {}) =>
    ensureWebhookSettingsNoConflict({
      res,
      currentSettings,
      currentRevision,
      projectTypes,
      options,
    });

  const validateWebhookChannelUrl = ({ channel, provider = "discord", webhookUrl } = {}) => {
    const normalizedWebhookUrl = String(webhookUrl || "").trim();
    if (!normalizedWebhookUrl) {
      return null;
    }
    const validation = validateWebhookUrl({
      provider,
      webhookUrl: normalizedWebhookUrl,
    });
    if (validation.ok) {
      return null;
    }
    return {
      channel: String(channel || "").trim() || "unknown",
      code: validation.code || "invalid_webhook_url",
      reason: validation.reason || validation.code || "invalid_webhook_url",
    };
  };

  const validateEditorialWebhookChannelUrls = (settings) => {
    const normalized = migrateEditorialPlaceholders(normalizeEditorialSettings(settings));
    const errors = ["posts", "projects"]
      .map((channelKey) =>
        validateWebhookChannelUrl({
          channel: channelKey,
          provider: "discord",
          webhookUrl: normalized?.channels?.[channelKey]?.webhookUrl,
        }),
      )
      .filter(Boolean);
    return {
      ok: errors.length === 0,
      errors,
    };
  };

  const validateUnifiedWebhookSettingsUrls = (settings) => {
    const editorialValidation = validateEditorialWebhookChannelUrls(settings?.editorial);
    const errors = [...editorialValidation.errors];
    const operationalError = validateWebhookChannelUrl({
      channel: "operational",
      provider: settings?.operational?.provider,
      webhookUrl: settings?.operational?.webhookUrl,
    });
    const securityError = validateWebhookChannelUrl({
      channel: "security",
      provider: settings?.security?.provider,
      webhookUrl: settings?.security?.webhookUrl,
    });
    if (operationalError) {
      errors.push(operationalError);
    }
    if (securityError) {
      errors.push(securityError);
    }
    return {
      ok: errors.length === 0,
      errors,
    };
  };

  const buildOperationalWebhookTestTransition = () => ({
    hasChanges: true,
    triggered: [
      {
        code: "webhook_test_alert",
        title: "Teste manual de webhook operacional",
        severity: "warning",
      },
    ],
    changed: [],
    resolved: [],
  });

  const buildSecurityWebhookTestEvent = () =>
    buildSecurityEventPayload({
      type: "integrations.webhooks.test",
      severity: SecurityEventSeverity.CRITICAL,
      riskScore: 90,
      status: SecurityEventStatus.OPEN,
      actorUserId: "system",
      requestId: `security-webhook-test-${crypto.randomUUID()}`,
      data: {
        source: "dashboard_webhooks_test",
      },
    });

  return {
    buildEnvOperationalWebhookSettings,
    buildEnvSecurityWebhookSettings,
    buildOperationalWebhookTestTransition,
    buildSecurityWebhookTestEvent,
    buildWebhookSettingsBundle,
    ensureEditorialWebhookSettingsNoConflict,
    ensureWebhookSettingsNoConflict,
    normalizeUnifiedWebhookSettingsForRequest,
    validateEditorialWebhookChannelUrls,
    validateUnifiedWebhookSettingsUrls,
  };
};

export default createWebhookSettingsRuntimeHelpers;
