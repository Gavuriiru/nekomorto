import { createAutoUploadReorganizationRuntime } from "../lib/auto-upload-reorganization-runtime.js";
import { createDataRepositorySiteConfigRuntime } from "../lib/data-repository-site-config-runtime.js";
import { createWebhookSettingsRuntimeHelpers } from "../lib/webhook-settings-runtime-helpers.js";
import { assertRequiredDependencies } from "./assert-required-dependencies.js";

const SITE_CONFIG_RUNTIME_DEPENDENCY_KEYS = [
  "DEFAULT_PROJECT_TYPE_CATALOG",
  "OPS_ALERTS_WEBHOOK_INTERVAL_MS",
  "OPS_ALERTS_WEBHOOK_PROVIDER",
  "OPS_ALERTS_WEBHOOK_TIMEOUT_MS",
  "OPS_ALERTS_WEBHOOK_URL",
  "PUBLIC_READ_CACHE_TAGS",
  "PUBLIC_UPLOADS_DIR",
  "SecurityEventSeverity",
  "SecurityEventStatus",
  "appendAuditLog",
  "buildSiteSettingsStoragePayload",
  "createSecurityEventPayload",
  "createSystemAuditReq",
  "crypto",
  "dataRepository",
  "defaultOperationalWebhookSettings",
  "defaultSecurityWebhookSettings",
  "defaultSiteSettings",
  "fixMojibakeDeep",
  "invalidateJsonFileCache",
  "invalidatePublicReadCacheTags",
  "isAutoUploadReorganizationEnabled",
  "isOpsAlertsWebhookEnabled",
  "loadComments",
  "loadPosts",
  "loadProjects",
  "loadUpdates",
  "loadUploads",
  "loadUsers",
  "migrateEditorialMentionPlaceholdersInSettings",
  "normalizeEditorialWebhookSettings",
  "normalizeOperationalWebhookSettings",
  "normalizeSecurityWebhookSettings",
  "normalizeSiteSettings",
  "normalizeUploadsDeep",
  "normalizeWebhookSettingsBundle",
  "readJsonFileFromCache",
  "runUploadsReorganization",
  "sanitizeIconSource",
  "validateWebhookUrlForProvider",
  "writeJsonFileToCache",
  "writeComments",
  "writePosts",
  "writeProjects",
  "writeUpdates",
  "writeUploads",
  "writeUsers",
];

export const createSiteConfigRuntimeBundle = (dependencies = {}) => {
  assertRequiredDependencies(
    "createSiteConfigRuntimeBundle",
    dependencies,
    SITE_CONFIG_RUNTIME_DEPENDENCY_KEYS,
  );

  const webhookSettingsRuntimeHelpers = createWebhookSettingsRuntimeHelpers({
    createSecurityEventPayload: dependencies.createSecurityEventPayload,
    crypto: dependencies.crypto,
    defaultOperationalWebhookSettings: dependencies.defaultOperationalWebhookSettings,
    defaultProjectTypeCatalog: dependencies.DEFAULT_PROJECT_TYPE_CATALOG,
    defaultSecurityWebhookSettings: dependencies.defaultSecurityWebhookSettings,
    isOpsAlertsWebhookEnabled: dependencies.isOpsAlertsWebhookEnabled,
    migrateEditorialMentionPlaceholdersInSettings:
      dependencies.migrateEditorialMentionPlaceholdersInSettings,
    normalizeEditorialWebhookSettings: dependencies.normalizeEditorialWebhookSettings,
    normalizeWebhookSettingsBundle: dependencies.normalizeWebhookSettingsBundle,
    opsAlertsWebhookIntervalMs: dependencies.OPS_ALERTS_WEBHOOK_INTERVAL_MS,
    opsAlertsWebhookProvider: dependencies.OPS_ALERTS_WEBHOOK_PROVIDER,
    opsAlertsWebhookTimeoutMs: dependencies.OPS_ALERTS_WEBHOOK_TIMEOUT_MS,
    opsAlertsWebhookUrl: dependencies.OPS_ALERTS_WEBHOOK_URL,
    SecurityEventSeverity: dependencies.SecurityEventSeverity,
    SecurityEventStatus: dependencies.SecurityEventStatus,
    validateWebhookUrlForProvider: dependencies.validateWebhookUrlForProvider,
  });

  const dataRepositorySiteConfigRuntime = createDataRepositorySiteConfigRuntime({
    dataRepository: dependencies.dataRepository,
    defaultSiteSettings: dependencies.defaultSiteSettings,
    fixMojibakeDeep: dependencies.fixMojibakeDeep,
    getBuildEnvOperationalWebhookSettings: () =>
      webhookSettingsRuntimeHelpers.buildEnvOperationalWebhookSettings,
    getBuildEnvSecurityWebhookSettings: () =>
      webhookSettingsRuntimeHelpers.buildEnvSecurityWebhookSettings,
    getBuildSiteSettingsStoragePayload: () => dependencies.buildSiteSettingsStoragePayload,
    getBuildWebhookSettingsBundle: () => webhookSettingsRuntimeHelpers.buildWebhookSettingsBundle,
    getNormalizeSiteSettings: () => dependencies.normalizeSiteSettings,
    invalidateJsonFileCache: dependencies.invalidateJsonFileCache,
    invalidatePublicReadCacheTags: dependencies.invalidatePublicReadCacheTags,
    normalizeOperationalWebhookSettings: dependencies.normalizeOperationalWebhookSettings,
    normalizeSecurityWebhookSettings: dependencies.normalizeSecurityWebhookSettings,
    normalizeUploadsDeep: dependencies.normalizeUploadsDeep,
    publicReadCacheTags: dependencies.PUBLIC_READ_CACHE_TAGS,
    readJsonFileFromCache: dependencies.readJsonFileFromCache,
    writeJsonFileToCache: dependencies.writeJsonFileToCache,
  });

  const autoUploadReorganizationRuntime = createAutoUploadReorganizationRuntime({
    appendAuditLog: dependencies.appendAuditLog,
    createSystemAuditReq: dependencies.createSystemAuditReq,
    isAutoUploadReorganizationEnabled: dependencies.isAutoUploadReorganizationEnabled,
    loadComments: dependencies.loadComments,
    loadPages: dataRepositorySiteConfigRuntime.loadPages,
    loadPosts: dependencies.loadPosts,
    loadProjects: dependencies.loadProjects,
    loadSiteSettings: dataRepositorySiteConfigRuntime.loadSiteSettings,
    loadUpdates: dependencies.loadUpdates,
    loadUploads: dependencies.loadUploads,
    loadUsers: dependencies.loadUsers,
    runUploadsReorganization: dependencies.runUploadsReorganization,
    uploadsDir: dependencies.PUBLIC_UPLOADS_DIR,
    writeComments: dependencies.writeComments,
    writePages: dataRepositorySiteConfigRuntime.writePages,
    writePosts: dependencies.writePosts,
    writeProjects: dependencies.writeProjects,
    writeSiteSettings: dataRepositorySiteConfigRuntime.writeSiteSettings,
    writeUpdates: dependencies.writeUpdates,
    writeUploads: dependencies.writeUploads,
    writeUsers: dependencies.writeUsers,
  });

  return {
    ...webhookSettingsRuntimeHelpers,
    ...dataRepositorySiteConfigRuntime,
    ...autoUploadReorganizationRuntime,
  };
};

export default createSiteConfigRuntimeBundle;
