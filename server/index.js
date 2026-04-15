import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import connectPgSimple from "connect-pg-simple";
import express from "express";
import session from "express-session";
import multer from "multer";
import { Pool } from "pg";
import { buildAdminExportRuntimeDependencies } from "./bootstrap/build-admin-export-runtime-dependencies.js";
import { buildContentRuntimeDependencies } from "./bootstrap/build-content-runtime-dependencies.js";
import { buildMediaSupportRuntimeDependencies } from "./bootstrap/build-media-support-runtime-dependencies.js";
import { createContentRuntimeBundle } from "./bootstrap/create-content-runtime-bundle.js";
import { createMediaSupportRuntimeBundle } from "./bootstrap/create-media-support-runtime-bundle.js";
import { buildRootServerRegistrationSource } from "./bootstrap/build-root-server-registration-source.js";
import { buildOperationalMonitoringRuntimeDependencies } from "./bootstrap/build-operational-monitoring-runtime-dependencies.js";
import { buildProjectRuntimeDependencies } from "./bootstrap/build-project-runtime-dependencies.js";
import { buildPublicRuntimeDependencies } from "./bootstrap/build-public-runtime-dependencies.js";
import { buildServerBootConfig } from "./bootstrap/build-server-boot-config.js";
import {
  createServerPlatformRuntime,
  getRequestIp as getTrustedRequestIp,
} from "./bootstrap/create-server-platform-runtime.js";
import { buildSiteConfigRuntimeDependencies } from "./bootstrap/build-site-config-runtime-dependencies.js";
import { buildSiteRenderingRuntimeDependencies } from "./bootstrap/build-site-rendering-runtime-dependencies.js";
import { createSiteConfigRuntimeBundle } from "./bootstrap/create-site-config-runtime-bundle.js";
import { createSiteRenderingRuntimeBundle } from "./bootstrap/create-site-rendering-runtime-bundle.js";
import { registerRootServerRoutes } from "./bootstrap/register-root-server-routes.js";
import { buildUserRuntimeDependencies } from "./bootstrap/build-user-runtime-dependencies.js";
import { buildWebhookRuntimeDependencies } from "./bootstrap/build-webhook-runtime-dependencies.js";
import { createProjectRuntimeBundle } from "./bootstrap/create-project-runtime-bundle.js";
import { createPublicRuntimeBundle } from "./bootstrap/create-public-runtime-bundle.js";
import { createUserRuntimeBundle } from "./bootstrap/create-user-runtime-bundle.js";
import { createWebhookRuntimeBundle } from "./bootstrap/create-webhook-runtime-bundle.js";
import { startServerJobs } from "./bootstrap/start-server-jobs.js";
import {
  ADMIN_EXPORT_DATASETS,
  filterByDateRange,
  filterExportEntries,
  normalizeExportDataset,
  normalizeExportFilters,
  normalizeExportFormat,
  normalizeExportStatus,
  writeExportFile,
} from "./lib/admin-exports.js";
import * as adminExports from "./lib/admin-exports.js";
import { createAdminExportRuntime } from "./lib/admin-export-runtime.js";
import { createAnalyticsStore } from "./lib/analytics-store.js";
import { API_CONTRACT_VERSION } from "./lib/api-contract-v1.js";
import { ANILIST_API, fetchAniListMediaById } from "./lib/anilist-client.js";
import { createAuditLogStore } from "./lib/audit-log-store.js";
import { createGlobalErrorHandler } from "./lib/global-error-handler.js";
import {
  AccessRole,
  BASIC_PROFILE_FIELDS,
  PermissionId,
  addOwnerRoleLabel,
  can,
  computeEffectiveAccessRole,
  computeGrants,
  defaultPermissionsForRole,
  expandLegacyPermissions,
  isBasicProfileField,
  normalizeAccessRole,
  pickBasicProfilePatch,
  removeOwnerRoleLabel,
  sanitizePermissionsForStorage,
} from "./lib/authz.js";
import * as authzLib from "./lib/authz.js";
import {
  isUploadFolderAllowedInScope,
  resolveUploadScopeAccess,
  shouldIncludeUploadInHashDedupe,
} from "./lib/avatar-upload-scope.js";
import { getBuildMetadata } from "./lib/build-metadata.js";
import { deriveChapterSynopsis } from "./lib/chapter-synopsis.js";
import { buildCommentTargetInfo } from "./lib/comment-target-info.js";
import { bulkModeratePendingComments } from "./lib/comments-bulk-moderation.js";
import { createPublicReadCacheRuntime } from "./lib/public-read-cache-runtime.js";
import { selectRecentApprovedComments } from "./lib/dashboard-recent-comments.js";
import { createDataRepository } from "./lib/data-repository.js";
import { createDataRepositoryAdaptersRuntime } from "./lib/data-repository-adapters-runtime.js";
import { createDataRepositoryBasicRuntime } from "./lib/data-repository-basic-runtime.js";
import { proxyDiscordAvatarRequest } from "./lib/discord-avatar-proxy.js";
import { buildEditorialCalendarItems } from "./lib/editorial-calendar.js";
import { buildHealthStatusResponse } from "./lib/health-checks.js";
import {
  extractLocalStylesheetHrefs,
  injectBootstrapGlobals,
  injectHomeHeroShell,
  injectPreloadLinks,
} from "./lib/html-bootstrap.js";
import { applyHtmlCachingHeaders } from "./lib/html-cache-control.js";
import { createIdempotencyStore } from "./lib/idempotency-store.js";
import { createJobQueue } from "./lib/job-queue.js";
import { truncateMetaDescription } from "./lib/meta-description.js";
import { createMetricsRegistry } from "./lib/metrics.js";
import { createOgRenderCache } from "./lib/og-render-cache.js";
import {
  buildInstitutionalOgDeliveryHeaders,
  buildInstitutionalOgRevisionValue,
  buildVersionedInstitutionalOgImagePath,
  getInstitutionalOgCachedRender,
} from "./lib/institutional-og-delivery.js";
import {
  buildOperationalAlertsResponse,
  buildOperationalAlertsV1,
} from "./lib/operational-alerts.js";
import { createOperationalMonitoringRuntime } from "./lib/operational-monitoring-runtime.js";
import { createResolveBootstrapPwaEnabled } from "./lib/pwa-bootstrap-policy.js";
import { updateLexicalPollVotes } from "./lib/lexical-poll-votes.js";
import {
  createDiscordAvatarUrl,
  createRouteGuards,
  createRuntimeMetadataBuilder,
  normalizeTags,
} from "./lib/root-composition-helpers.js";
import { isPlainObject, parseEditRevisionOptions } from "./lib/request-runtime-helpers.js";
import {
  defaultSiteSettings,
  fixMojibakeDeep,
  fixMojibakeText,
} from "./lib/site-settings-runtime-helpers.js";
import {
  MAX_SVG_SIZE_BYTES,
  MAX_UPLOAD_SIZE_BYTES,
  getUploadExtFromMime,
  getUploadMimeFromExtension,
  normalizeAvatarDisplay,
  normalizeUploadMime,
  sanitizeSvg,
  sanitizeUploadBaseName,
  sanitizeUploadFolder,
  sanitizeUploadSlot,
  validateUploadImageBuffer,
} from "./lib/upload-runtime-helpers.js";
import {
  PWA_MANIFEST_BASE,
  PWA_MANIFEST_CACHE_CONTROL,
  PWA_THEME_COLOR_DARK,
  PWA_THEME_COLOR_LIGHT,
  STATIC_DEFAULT_CACHE_CONTROL,
  setStaticCacheHeaders,
} from "./lib/static-runtime-policy.js";
import { createSystemAuditReqFactory } from "./lib/system-audit-req.js";
import {
  createGetActiveProjectTypes,
  isChapterBasedType,
  normalizeTypeLookupKey,
} from "./lib/project-type-utils.js";
import { resolveAuthAppOrigin } from "./lib/origin-config.js";
import {
  buildPostOgImageAlt,
  buildPostOgRevision,
  buildVersionedPostOgImagePath,
} from "../shared/post-og-seo.js";
import { getPostOgCachedRender } from "./lib/post-og-delivery.js";
import { extractFirstImageFromPostContent, resolvePostCover } from "./lib/post-cover.js";
import { createSlug, createUniqueSlug } from "./lib/post-slug.js";
import { resolvePostStatus } from "./lib/post-status.js";
import { dedupePostVersionRecordsNewestFirst } from "./lib/post-version-dedupe.js";
import { prisma } from "./lib/prisma-client.js";
import { withDatabaseStartupRetry } from "./lib/database-startup-retry.js";
import { applyProjectChapterUpdate } from "./lib/project-chapter-editor.js";
import {
  applyEpisodePublicationMetadata,
  collectEpisodeUpdates as collectEpisodeUpdatesByVisibility,
  isEpisodePublic,
  resolveProjectUpdateUnitLabel,
} from "./lib/project-episode-updates.js";
import {
  buildEpisodeKey,
  findDuplicateEpisodeKey,
  findPublishedImageEpisodeWithoutPages,
  resolveEpisodeLookup,
} from "./lib/project-episodes.js";
import { exportProjectEpub } from "./lib/project-epub-export.js";
import {
  EPUB_IMPORT_JOB_RESULT_TTL_MS,
  deleteEpubImportJobResult,
  readEpubImportJobResult,
  toEpubImportJobApiResponse,
  writeEpubImportJobResult,
} from "./lib/project-epub-import-jobs.js";
import { cleanupProjectEpubImportTempUploads } from "./lib/project-epub-import-cleanup.js";
import {
  EPUB_IMPORT_MULTIPART_LIMITS,
  mapEpubImportExecutionError,
  mapEpubImportMultipartError,
} from "./lib/project-epub-import-request.js";
import { importProjectEpub } from "./lib/project-epub-import.js";
import {
  exportProjectImageChapter,
  exportProjectImageCollection,
  importProjectImageChapters,
  previewProjectImageImport,
} from "./lib/project-manga.js";
import {
  PROJECT_IMAGE_EXPORT_JOB_RESULT_TTL_MS,
  PROJECT_IMAGE_IMPORT_JOB_RESULT_TTL_MS,
  deleteProjectImageExportJobResult,
  deleteProjectImageImportJobResult,
  ensureProjectImageExportJobsDirectory,
  readProjectImageImportJobResult,
  toProjectImageExportJobApiResponse,
  toProjectImageImportJobApiResponse,
  writeProjectImageImportJobResult,
} from "./lib/project-manga-jobs.js";
import {
  PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS,
  mapProjectImageImportExecutionError,
  mapProjectImageImportMultipartError,
  resolveProjectImageImportRequestInput,
} from "./lib/project-manga-request.js";
import { localizeProjectImageFields } from "./lib/project-image-localizer.js";
import {
  buildProjectOgDeliveryHeaders,
  buildProjectOgRevision,
  buildVersionedProjectOgImagePath,
  getProjectOgCachedRender,
  prewarmProjectOgCache,
} from "./lib/project-og-delivery.js";
import { buildProjectReadingOgCardModel } from "./lib/project-reading-og.js";
import {
  buildProjectReadingOgDeliveryHeaders,
  buildProjectReadingOgRevisionValue,
  buildVersionedProjectReadingOgImagePath,
  getProjectReadingOgCachedRender,
} from "./lib/project-reading-og-delivery.js";
import {
  getProjectEpisodePageCount,
  hasProjectEpisodePages,
  normalizeProjectEpisodeContentFormat,
  normalizeProjectEpisodePages,
  normalizeProjectReaderConfig,
  normalizeProjectReaderPreferences,
  resolveProjectReaderConfig,
} from "../shared/project-reader.js";
import { findDuplicateVolumeCover } from "./lib/project-volume-covers.js";
import { normalizeLegacyUpdateRecord } from "./lib/pt-legacy-normalization.js";
import { buildPublicBootstrapPayload } from "./lib/public-bootstrap.js";
import {
  resolveExistingPublicVariantUrl,
  resolveHomeHeroPreloadFromSlide,
  resolvePublicPostCoverPreload,
  resolvePublicReaderHeroPreload,
  sanitizePublicMediaVariantEntry,
  shouldExposePublicUploadInMediaVariants,
} from "./lib/public-media-variants.js";
import { resolvePublicProjectsListPreloads } from "./lib/public-projects-preloads.js";
import { buildPublicReadableProjects, buildPublicVisibleProjects } from "./lib/public-projects.js";
import { resolvePublicRedirect } from "./lib/public-redirects.js";
import { PUBLIC_STATIC_PATHS as SITEMAP_STATIC_PUBLIC_PATHS } from "./lib/public-visibility-runtime.js";
import {
  PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME,
  PUBLIC_BOOTSTRAP_MODE_FULL,
} from "./lib/public-site-runtime.js";
import {
  buildPublicSearchSuggestions,
  normalizeSearchQuery,
  parseSearchLimit,
  parseSearchScope,
  publicSearchConfig,
} from "./lib/public-search.js";
import { resolvePublicTeamAvatarPreload } from "./lib/public-team-preloads.js";
import { createRateLimiter } from "./lib/rate-limiter.js";
import { importRemoteImageFile } from "./lib/remote-image-import.js";
import { createResponseCache } from "./lib/response-cache.js";
import { createRevisionToken } from "./lib/revision-token.js";
import { resolveThemeColor } from "./lib/theme-color.js";
import { buildRssXml } from "./lib/rss-xml.js";
import { registerRuntimeMiddleware } from "./lib/register-runtime-middleware.js";
import { buildSchemaOrgPayload, serializeSchemaOrgEntry } from "./lib/schema-org.js";
import { decryptStringWithKeyring, encryptStringWithKeyring } from "./lib/security-crypto.js";
import {
  SecurityEventSeverity,
  SecurityEventStatus,
  createSecurityEventPayload,
  createSlidingWindowCounter,
  getIpv4Network24,
  normalizeSecurityEventStatus,
} from "./lib/security-events.js";
import { injectNonceIntoHtmlScripts } from "./lib/security-headers.js";
import {
  buildAuthRedirectUrl,
  establishAuthenticatedSession,
  saveSessionState,
} from "./lib/session-auth.js";
import { buildSitemapXml } from "./lib/sitemap-xml.js";
import { stripHtml } from "./lib/site-meta-builders.js";
import {
  buildOtpAuthUrl,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyTotpCode,
} from "./lib/totp.js";
import {
  attachUploadMediaMetadata,
  buildStorageAreaSummary,
  computeBufferSha256,
  deriveFocalPointsFromCrops,
  findUploadByHash,
  getPrimaryFocalPoint,
  mergeUploadVariantPresetKeys,
  normalizeUploadVariantPresetKeys,
  normalizeFocalCrops,
  normalizeFocalPoints,
  normalizeVariants,
  resolveUploadAbsolutePath,
  resolveUploadVariantPresetKeysForArea,
} from "./lib/upload-media.js";
import { buildDiskStorageAreaSummary, runUploadsCleanup } from "./lib/uploads-cleanup.js";
import {
  buildWebhookAuditMeta,
  clampWebhookInteger,
  createResolveEditorialAuthorFromPost,
  createWebhookAuditReqFromContext as createWebhookAuditReqFromContextBase,
  pickFirstNonEmptyText,
  resolveWebhookAuditActions as resolveWebhookAuditActionsBase,
} from "./lib/webhook-support.js";
import { createWebhookDeliveryRuntime } from "./lib/webhook-delivery-runtime.js";
import {
  invalidateUploadsCleanupPreviewCache,
  loadCachedUploadsCleanupPreview,
} from "./lib/uploads-cleanup-preview-cache.js";
import {
  createUploadStorageService,
  getUploadAssetDescriptors,
  getUploadVariantUrlPrefix,
  normalizeUploadStorageProvider,
  readUploadStorageProvider,
} from "./lib/upload-storage.js";
import {
  cleanupUploadStagingWorkspace,
  createUploadStagingWorkspace,
  materializeUploadEntrySourceToStaging,
  persistUploadEntryFromStaging,
  writeUploadBufferToStaging,
} from "./lib/uploads-storage-runtime.js";
import {
  extractUploadUrlsFromText,
  normalizeUploadUrl,
  runUploadsReorganization,
} from "./lib/uploads-reorganizer.js";
import {
  sanitizeAssetUrl,
  sanitizeFavoriteWorksByCategory,
  sanitizeIconSource,
  sanitizePublicHref,
  sanitizeSocials,
} from "./lib/url-safety.js";
import {
  isDiscordAvatarUrl,
  resolveEffectiveUserAvatarUrl,
  resolveUserAvatarRenderVersion,
  shouldSyncDiscordAvatarToStoredUser,
} from "./lib/user-avatar.js";
import { dispatchWebhookMessage } from "./lib/webhooks/dispatcher.js";
import {
  WEBHOOK_DELIVERY_SCOPE,
  WEBHOOK_DELIVERY_STATUS,
  computeWebhookRetryDelayMs,
  createWebhookWorkerId,
  summarizeWebhookDeliveries,
  toWebhookDeliveryApiResponse,
} from "./lib/webhooks/delivery.js";
import {
  buildEditorialEventContext,
  buildEditorialMentions,
  migrateEditorialMentionPlaceholdersInSettings,
  normalizeEditorialWebhookSettings,
  renderWebhookTemplate,
  resolveEditorialEventChannel,
  resolveEditorialEventLabel,
  validateEditorialWebhookSettingsPlaceholders,
} from "./lib/webhooks/editorial.js";
import { toDiscordWebhookPayload } from "./lib/webhooks/providers/discord.js";
import {
  defaultOperationalWebhookSettings,
  defaultSecurityWebhookSettings,
  normalizeOperationalWebhookSettings,
  normalizeSecurityWebhookSettings,
  normalizeWebhookSettingsBundle,
  OPERATIONAL_WEBHOOK_INTERVAL_DEFAULT_MS,
  OPERATIONAL_WEBHOOK_INTERVAL_MAX_MS,
  OPERATIONAL_WEBHOOK_INTERVAL_MIN_MS,
  WEBHOOK_TIMEOUT_DEFAULT_MS,
  WEBHOOK_TIMEOUT_MAX_MS,
  WEBHOOK_TIMEOUT_MIN_MS,
} from "./lib/webhooks/settings.js";
import { buildOperationalAlertsWebhookNotification } from "./lib/webhooks/templates/operational-alerts.js";
import { diffOperationalAlertSets } from "./lib/webhooks/transitions.js";
import {
  buildWebhookTargetLabel,
  validateWebhookUrlForProvider,
} from "./lib/webhooks/validation.js";
import { deriveAniListMediaOrganization } from "../shared/anilist-media.js";
import {
  buildInstitutionalOgImageAlt,
  resolveInstitutionalOgPageKeyFromPath,
  resolveInstitutionalOgPagePath,
  resolveInstitutionalOgPageTitle,
  resolveInstitutionalOgSupportText,
} from "../shared/institutional-og-seo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT_DIR = path.join(__dirname, "..");
const PUBLIC_UPLOADS_DIR = path.join(REPO_ROOT_DIR, "public", "uploads");
const uploadStorageService = createUploadStorageService({
  uploadsDir: PUBLIC_UPLOADS_DIR,
});

const app = express();
app.disable("x-powered-by");
const PgSessionStore = connectPgSimple(session);
let dataRepository = null;
const DEFAULT_PROJECT_TYPE_CATALOG = Object.freeze([
  "Anime",
  "Manga",
  "Mangá",
  "Webtoon",
  "Light Novel",
  "Filme",
  "OVA",
  "ONA",
  "Especial",
  "Spin-off",
]);

const AUDIT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const AUDIT_MAX_ENTRIES = 20000;
const AUDIT_CSV_MAX_ROWS = 10000;
const AUDIT_META_STRING_MAX = 256;
const AUDIT_ENABLED_ACTION_PATTERN =
  /(^|\.)(create|update|delete|restore|reorder|login|logout|denied|failed|rate_limited|bootstrap|rebuild|image|rename|success|reorganize|sent|skipped|test)(\.|_|$)/i;
const AUDIT_DEFAULT_META_KEYS = [
  "error",
  "id",
  "slug",
  "resourceId",
  "projectId",
  "userId",
  "ownerId",
  "count",
  "targetId",
  "fromPrimaryId",
  "toPrimaryId",
  "fileName",
  "folder",
  "url",
  "wasOwner",
  "before",
  "after",
  "changes",
  "trigger",
  "moves",
  "rewrites",
  "failures",
  "durationMs",
  "usersSocialsDropped",
  "linkTypeIconsDropped",
  "siteLinksDropped",
  "uploadId",
  "hashSha256",
  "dedupeHit",
  "variantBytes",
  "altTextLength",
];
const AUDIT_META_ALLOWLIST = {
  "auth.login.failed": ["error"],
  "auth.login.success": ["userId"],
  "auth.logout": [],
  "auth.bootstrap.success": ["ownerId"],
  "auth.bootstrap.denied": ["error"],
  "auth.bootstrap.disabled": [],
  "auth.bootstrap.rate_limited": [],
  "users.delete": ["id", "wasOwner"],
  "uploads.image": [
    "uploadId",
    "fileName",
    "folder",
    "url",
    "hashSha256",
    "dedupeHit",
    "variantBytes",
  ],
  "uploads.image_from_url": [
    "uploadId",
    "fileName",
    "folder",
    "url",
    "remoteUrl",
    "hashSha256",
    "dedupeHit",
    "variantBytes",
  ],
  "uploads.rename": ["oldUrl", "newUrl", "updatedReferences", "replacements"],
  "uploads.alt_text.update": ["uploadId", "altTextLength"],
  "uploads.delete": ["url"],
  "uploads.cleanup_unused": [
    "deletedCount",
    "deletedUnusedUploadsCount",
    "deletedOrphanedVariantFilesCount",
    "deletedOrphanedVariantDirsCount",
    "quarantinedLooseOriginalFilesCount",
    "deletedQuarantineFilesCount",
    "deletedQuarantineDirsCount",
    "failedCount",
    "freedBytes",
    "quarantinedBytes",
    "purgedQuarantineBytes",
    "failures",
  ],
  "uploads.auto_reorganize.startup": ["trigger", "moves", "rewrites", "failures", "durationMs"],
  "uploads.auto_reorganize.post_save": ["trigger", "moves", "rewrites", "failures", "durationMs"],
  "uploads.auto_reorganize.project_save": [
    "trigger",
    "moves",
    "rewrites",
    "failures",
    "durationMs",
  ],
  "uploads.auto_reorganize.failed": [
    "trigger",
    "moves",
    "rewrites",
    "failures",
    "durationMs",
    "error",
  ],
  "posts.version.create": ["id", "slug", "versionId", "reason", "label"],
  "posts.rollback": [
    "id",
    "slug",
    "versionId",
    "targetVersionId",
    "backupVersionId",
    "rollbackVersionId",
    "slugAdjusted",
  ],
  "users.create": ["id", "after"],
  "users.update": ["id", "before", "after", "changes"],
  "users.update_self": ["id", "before", "after", "changes"],
  "users.delete": ["id", "wasOwner", "before"],
  "owners.update": ["count", "before", "after"],
  "owners.transfer_primary": [
    "targetId",
    "fromPrimaryId",
    "toPrimaryId",
    "before",
    "after",
    "changes",
  ],
  "security.update.sanitization_startup": [
    "usersSocialsDropped",
    "linkTypeIconsDropped",
    "siteLinksDropped",
  ],
  "editorial_webhook.queued": [
    "deliveryId",
    "scope",
    "channel",
    "eventKey",
    "eventLabel",
    "postId",
    "projectId",
    "attempt",
  ],
  "editorial_webhook.sent": [
    "deliveryId",
    "scope",
    "eventKey",
    "eventLabel",
    "channel",
    "status",
    "statusCode",
    "attempt",
    "durationMs",
    "nextAttemptAt",
    "postId",
    "projectId",
  ],
  "editorial_webhook.failed": [
    "deliveryId",
    "scope",
    "eventKey",
    "eventLabel",
    "channel",
    "status",
    "code",
    "statusCode",
    "attempt",
    "durationMs",
    "nextAttemptAt",
    "error",
    "postId",
    "projectId",
  ],
  "ops_alerts.webhook.queued": ["deliveryId", "scope", "eventLabel", "attempt"],
  "ops_alerts.webhook.sent": [
    "deliveryId",
    "scope",
    "eventLabel",
    "status",
    "statusCode",
    "attempt",
    "durationMs",
    "nextAttemptAt",
  ],
  "ops_alerts.webhook.failed": [
    "deliveryId",
    "scope",
    "eventLabel",
    "status",
    "code",
    "statusCode",
    "attempt",
    "durationMs",
    "nextAttemptAt",
    "error",
  ],
  "security.webhook.queued": ["deliveryId", "scope", "eventLabel", "securityEventId", "attempt"],
  "security.webhook.sent": [
    "deliveryId",
    "scope",
    "eventLabel",
    "securityEventId",
    "status",
    "statusCode",
    "attempt",
    "durationMs",
    "nextAttemptAt",
  ],
  "security.webhook.failed": [
    "deliveryId",
    "scope",
    "eventLabel",
    "securityEventId",
    "status",
    "code",
    "statusCode",
    "attempt",
    "durationMs",
    "nextAttemptAt",
    "error",
  ],
  "editorial_webhook.skipped": ["eventKey", "channel", "code", "postId", "projectId"],
  "integrations.webhooks_editorial.read": ["channel", "eventKey"],
  "integrations.webhooks_editorial.update": [
    "channel",
    "eventKey",
    "count",
    "postId",
    "projectId",
    "code",
  ],
  "integrations.webhooks_editorial.test": [
    "channel",
    "eventKey",
    "status",
    "code",
    "statusCode",
    "attempt",
    "postId",
    "projectId",
    "error",
  ],
  "integrations.webhooks.read": ["scope", "channel", "eventKey"],
  "integrations.webhooks.update": ["scope", "channel", "eventKey", "count", "code"],
  "integrations.webhooks.operational_test": ["status", "code", "statusCode", "attempt", "error"],
  "integrations.webhooks.security_test": [
    "status",
    "code",
    "statusCode",
    "attempt",
    "securityEventId",
    "error",
  ],
};

const { appendAuditLog, isAuditActionEnabled, loadAuditLog, parseAuditTs } = createAuditLogStore({
  auditDefaultMetaKeys: AUDIT_DEFAULT_META_KEYS,
  auditEnabledActionPattern: AUDIT_ENABLED_ACTION_PATTERN,
  auditMaxEntries: AUDIT_MAX_ENTRIES,
  auditMetaAllowlist: AUDIT_META_ALLOWLIST,
  auditMetaStringMax: AUDIT_META_STRING_MAX,
  auditRetentionMs: AUDIT_RETENTION_MS,
  crypto,
  fixMojibakeText,
  getDataRepository: () => dataRepository,
  getRequestIp: getTrustedRequestIp,
  getPrimaryAppOrigin: () => PRIMARY_APP_ORIGIN,
});

const DISCORD_API = "https://discord.com/api/v10";
const SCOPES = ["identify", "email"];

const {
  ADMIN_EXPORT_TTL_HOURS,
  ANALYTICS_AGG_RETENTION_DAYS,
  ANALYTICS_COMPACTION_INTERVAL_MS,
  ANALYTICS_IP_SALT,
  ANALYTICS_RETENTION_DAYS,
  ALLOWED_ORIGINS,
  BOOTSTRAP_TOKEN,
  CONFIGURED_DISCORD_REDIRECT_URI,
  DATABASE_URL,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  IDEMPOTENCY_TTL_MS,
  MFA_ENROLLMENT_TTL_MS,
  MFA_ICON_URL,
  MFA_ISSUER,
  MFA_RECOVERY_CODE_PEPPER,
  METRICS_TOKEN_NORMALIZED,
  OPS_ALERTS_DB_LATENCY_WARNING_MS,
  OPS_ALERTS_WEBHOOK_INTERVAL_MS,
  OPS_ALERTS_WEBHOOK_PROVIDER,
  OPS_ALERTS_WEBHOOK_TIMEOUT_MS,
  OPS_ALERTS_WEBHOOK_URL,
  OWNER_IDS,
  PORT,
  PRIMARY_APP_HOST,
  PRIMARY_APP_ORIGIN,
  PUBLIC_READ_CACHE_MAX_ENTRIES,
  PUBLIC_READ_CACHE_TTL_MS,
  RATE_LIMIT_PREFIX,
  REDIS_URL,
  SESSION_SECRET,
  SESSION_TABLE,
  adminExportsDir,
  buildSiteSettingsStoragePayload,
  dataEncryptionKeyring,
  epubImportJobsDir,
  isAutoUploadReorganizationEnabled,
  isAutoUploadReorganizationOnStartupEnabled,
  isHomeHeroShellEnabled,
  isMaintenanceMode,
  isMetricsEnabled,
  isOpsAlertsWebhookEnabled,
  isProduction,
  isPwaDevEnabled,
  isRbacV2AcceptLegacyStar,
  isRbacV2Enabled,
  normalizeSiteSettings,
  normalizeUploadsDeep,
  projectImageExportJobsDir,
  projectImageImportJobsDir,
  sessionCookieConfig,
  sessionSecretList,
} = buildServerBootConfig({
  repoRootDir: REPO_ROOT_DIR,
});

const metricsRegistry = createMetricsRegistry({
  defaultLabels: {
    service: "nekomorto",
  },
});
const authFailedByIpCounter = createSlidingWindowCounter();
const mfaFailedByUserCounter = createSlidingWindowCounter();
if (!String(DATABASE_URL || "").trim()) {
  throw new Error("DATABASE_URL is required");
}
const sessionStore = new PgSessionStore({
  pool: new Pool({ connectionString: DATABASE_URL }),
  tableName: String(SESSION_TABLE || "user_sessions"),
  createTableIfMissing: false,
  ttl: 60 * 60 * 24 * 7,
});
const AUTH_FAILED_BURST_WARNING = Object.freeze({ threshold: 8, windowMs: 5 * 60 * 1000 });
const AUTH_FAILED_BURST_CRITICAL = Object.freeze({ threshold: 20, windowMs: 15 * 60 * 1000 });
const MFA_FAILED_BURST_WARNING = Object.freeze({ threshold: 5, windowMs: 10 * 60 * 1000 });
const EXCESSIVE_SESSIONS_WARNING = 7;
const NEW_NETWORK_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_EXPORT_MAX_ROWS = 25_000;
const SESSION_INDEX_TOUCH_MIN_INTERVAL_MS = 30 * 1000;
const sessionIndexTouchTsBySid = new Map();
const createSystemAuditReq = createSystemAuditReqFactory({
  createRequestId: () => crypto.randomUUID(),
});

const ANALYTICS_SCHEMA_VERSION = 1;
const ANALYTICS_RETENTION_MS = ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const ANALYTICS_AGG_RETENTION_MS = ANALYTICS_AGG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const ANALYTICS_EVENT_TYPE_SET = new Set([
  "view",
  "chapter_view",
  "download_click",
  "comment_created",
  "comment_approved",
  "pwa_install_prompt_shown",
  "pwa_install_prompt_accepted",
  "pwa_install_prompt_dismissed",
  "pwa_installed",
]);
const ANALYTICS_COOLDOWN_EVENT_TYPE_SET = new Set(["view", "chapter_view"]);
const ANALYTICS_COOLDOWN_RESOURCE_SET = new Set(["post", "project", "chapter"]);
const ANALYTICS_VIEW_COOLDOWN_MS = 30 * 60 * 1000;
const ANALYTICS_META_STRING_MAX = 180;
const analyticsViewCooldown = new Map();
const PUBLIC_ANALYTICS_EVENT_TYPE_SET = new Set([
  "chapter_view",
  "download_click",
  "pwa_install_prompt_shown",
  "pwa_install_prompt_accepted",
  "pwa_install_prompt_dismissed",
  "pwa_installed",
]);
const PUBLIC_ANALYTICS_RESOURCE_TYPE_SET = new Set(["chapter", "pwa"]);
const DASHBOARD_WIDGET_IDS = new Set([
  "metrics_overview",
  "analytics_summary",
  "projects_rank",
  "recent_posts",
  "comments_queue",
  "ops_status",
  "projects_quick",
]);
const DASHBOARD_HOME_ROLE_IDS = new Set(["editor", "moderador", "admin"]);

const rateLimiter = await createRateLimiter({
  redisUrl: REDIS_URL,
  prefix: RATE_LIMIT_PREFIX,
  onError: ({ label, error }) => {
    console.warn(
      `[rate-limit:${String(label || "unknown")}] ${String(error?.message || error || "error")}`,
    );
  },
});
const idempotencyStore = createIdempotencyStore({
  ttlMs: IDEMPOTENCY_TTL_MS,
  maxEntries: 5000,
});
const publicReadCache = createResponseCache({
  defaultTtlMs: PUBLIC_READ_CACHE_TTL_MS,
  maxEntries: PUBLIC_READ_CACHE_MAX_ENTRIES,
});
const { invalidatePublicReadCacheTags, readPublicCachedJson, writePublicCachedJson } =
  createPublicReadCacheRuntime({
    publicReadCache,
  });
const ogRenderCache = createOgRenderCache({
  ttlMs: 5 * 60 * 1000,
  maxEntries: 256,
});
const backgroundJobQueue = createJobQueue({
  name: "backend",
  concurrency: 1,
  historySize: 200,
  onError: ({ type, error }) => {
    console.error(
      `[job-queue:${String(type || "job")}] ${String(error?.message || error || "failed")}`,
    );
  },
});

dataRepository = await withDatabaseStartupRetry(
  () =>
    createDataRepository({
      databaseUrl: DATABASE_URL,
      ownerIdsFallback: OWNER_IDS,
      analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
      analyticsRetentionDays: ANALYTICS_RETENTION_DAYS,
      analyticsAggRetentionDays: ANALYTICS_AGG_RETENTION_DAYS,
    }),
  {
    onRetry: ({ attempt, error, maxAttempts, retryDelayMs }) => {
      console.warn(
        `[startup:database] data repository bootstrap failed on attempt ${attempt}/${maxAttempts}: ${String(error?.message || error || "db_startup_failed")}. Retrying in ${retryDelayMs}ms.`,
      );
    },
  },
);

const dataRepositoryAdaptersRuntime = createDataRepositoryAdaptersRuntime({
  dataRepository,
});

const {
  appendSecretRotation,
  claimWebhookDelivery,
  findWebhookDelivery,
  isEpubImportJobStorageAvailable,
  isProjectImageExportJobStorageAvailable,
  isProjectImageImportJobStorageAvailable,
  loadAdminExportJobs,
  loadEpubImportJobs,
  loadProjectImageExportJobs,
  loadProjectImageImportJobs,
  loadSecretRotations,
  loadSecurityEvents,
  loadWebhookDeliveries,
  loadWebhookState,
  upsertAdminExportJob,
  upsertEpubImportJob,
  upsertProjectImageExportJob,
  upsertProjectImageImportJob,
  upsertSecurityEvent,
  upsertWebhookDelivery,
  writeWebhookState,
} = dataRepositoryAdaptersRuntime;

const {
  getPrimaryOwnerId,
  isOwner,
  isPrimaryOwner,
  loadAllowedUsers,
  loadLinkTypes,
  loadOwnerIds,
  loadUsers,
  normalizeLinkTypes,
  writeAllowedUsers,
  writeLinkTypes,
  writeOwnerIds,
  writeUsers,
} = createDataRepositoryBasicRuntime({
  dataRepository,
  getNormalizeUploadsDeep: () => normalizeUploadsDeep,
  getNormalizeUsers: () => normalizeUsers,
  ownerIds: OWNER_IDS,
  sanitizeIconSource,
});

const {
  clientDistDir,
  clientRootDir,
  getIndexHtml,
  getRequestIp,
  httpServer,
  isAllowedOrigin,
  resolveDiscordRedirectUri,
  toAbsoluteUrl,
  viteDevServer,
} = await createServerPlatformRuntime({
  app,
  fs,
  repoRootDir: REPO_ROOT_DIR,
  allowedOrigins: ALLOWED_ORIGINS,
  configuredDiscordRedirectUri: CONFIGURED_DISCORD_REDIRECT_URI,
  primaryAppOrigin: PRIMARY_APP_ORIGIN,
  isProduction,
});

const {
  appendAnalyticsEvent,
  buildAnalyticsRange,
  enqueueAnalyticsCompactionJob,
  filterAnalyticsEvents,
  getDayKeyFromTs,
  incrementCounter,
  loadAnalyticsEvents,
  normalizeAnalyticsTypeFilter,
  parseAnalyticsRangeDays,
  parseAnalyticsTs,
} = createAnalyticsStore({
  analyticsAggRetentionDays: ANALYTICS_AGG_RETENTION_DAYS,
  analyticsAggRetentionMs: ANALYTICS_AGG_RETENTION_MS,
  analyticsCooldownEventTypeSet: ANALYTICS_COOLDOWN_EVENT_TYPE_SET,
  analyticsCooldownResourceSet: ANALYTICS_COOLDOWN_RESOURCE_SET,
  analyticsEventTypeSet: ANALYTICS_EVENT_TYPE_SET,
  analyticsIpSalt: ANALYTICS_IP_SALT,
  analyticsMetaStringMax: ANALYTICS_META_STRING_MAX,
  analyticsRetentionDays: ANALYTICS_RETENTION_DAYS,
  analyticsRetentionMs: ANALYTICS_RETENTION_MS,
  analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
  analyticsViewCooldown,
  analyticsViewCooldownMs: ANALYTICS_VIEW_COOLDOWN_MS,
  backgroundJobQueue,
  crypto,
  getDataRepository: () => dataRepository,
  getRequestIp,
  primaryAppHost: PRIMARY_APP_HOST,
  primaryAppOrigin: PRIMARY_APP_ORIGIN,
  sessionSecret: SESSION_SECRET,
});

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !SESSION_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, or SESSION_SECRET in env.");
  }
}
if (isProduction && !OWNER_IDS.length && !BOOTSTRAP_TOKEN) {
  throw new Error("Missing OWNER_IDS or BOOTSTRAP_TOKEN in env.");
}

registerRuntimeMiddleware({
  app,
  apiContractVersion: API_CONTRACT_VERSION,
  clientDistDir,
  clientRootDir,
  getRequestIp,
  idempotencyStore,
  idempotencyTtlMs: IDEMPOTENCY_TTL_MS,
  isAllowedOrigin,
  isMaintenanceMode,
  isMetricsEnabled,
  isProduction,
  isPwaDevEnabled,
  loadSiteSettings: () => loadSiteSettings(),
  loadUploads: () => loadUploads(),
  maybeEmitAdminActionFromNewNetwork: (req) => maybeEmitAdminActionFromNewNetwork(req),
  metricsRegistry,
  pwaManifestBase: PWA_MANIFEST_BASE,
  pwaManifestCacheControl: PWA_MANIFEST_CACHE_CONTROL,
  pwaThemeColorDark: PWA_THEME_COLOR_DARK,
  pwaThemeColorLight: PWA_THEME_COLOR_LIGHT,
  sessionCookieConfig,
  sessionStore,
  setStaticCacheHeaders,
  staticDefaultCacheControl: STATIC_DEFAULT_CACHE_CONTROL,
  updateSessionIndexFromRequest: (...args) => updateSessionIndexFromRequest(...args),
  uploadStorageService,
  viteDevServer,
});

const USER_PREFERENCES_MAX_BYTES = 20 * 1024;
const USER_PREFERENCES_THEME_MODE_SET = new Set(["light", "dark", "system"]);
const USER_PREFERENCES_DENSITY_SET = new Set(["comfortable", "compact"]);

const ensureNoEditConflict = () => true;

const PUBLIC_READ_CACHE_TAGS = Object.freeze({
  BOOTSTRAP: "public:bootstrap",
  SEARCH: "public:search",
  POSTS: "public:posts",
  PROJECTS: "public:projects",
});

const contentRuntime = createContentRuntimeBundle(
  buildContentRuntimeDependencies({
    PUBLIC_READ_CACHE_TAGS,
    createSlug,
    createUniqueSlug,
    crypto,
    dataRepository,
    dedupePostVersionRecordsNewestFirst,
    getProjectEpisodePageCount,
    invalidatePublicReadCacheTags,
    normalizeLegacyUpdateRecord,
    normalizeProjectEpisodeContentFormat,
    normalizeProjectEpisodePages,
    normalizeProjectReaderConfig,
    normalizeUploadsDeep,
    readUploadStorageProvider,
    resolveEpisodeLookup,
    resolvePostStatus,
  }),
);

const {
  invalidateJsonFileCache,
  readJsonFileFromCache,
  writeJsonFileToCache,
  appendPostVersion,
  applyCommentCountToPosts,
  applyCommentCountToProjects,
  applyPostSnapshotForRollback,
  incrementPostViews,
  incrementProjectViews,
  isWithinRestoreWindow,
  listPostVersions,
  loadComments,
  loadPostVersions,
  loadPosts,
  loadProjects,
  loadUpdates,
  loadUploads,
  normalizePosts,
  normalizeProjects,
  postVersionReasonLabel,
  pruneExpiredDeleted,
  writeComments,
  writePosts,
  writeProjects,
  writeUpdates,
  writeUploads,
} = contentRuntime;

const siteConfigRuntime = createSiteConfigRuntimeBundle(
  buildSiteConfigRuntimeDependencies({
    DEFAULT_PROJECT_TYPE_CATALOG,
    OPS_ALERTS_WEBHOOK_INTERVAL_MS,
    OPS_ALERTS_WEBHOOK_PROVIDER,
    OPS_ALERTS_WEBHOOK_TIMEOUT_MS,
    OPS_ALERTS_WEBHOOK_URL,
    PUBLIC_READ_CACHE_TAGS,
    PUBLIC_UPLOADS_DIR,
    SecurityEventSeverity,
    SecurityEventStatus,
    appendAuditLog,
    buildSiteSettingsStoragePayload,
    createSecurityEventPayload,
    createSystemAuditReq,
    crypto,
    dataRepository,
    defaultOperationalWebhookSettings,
    defaultSecurityWebhookSettings,
    defaultSiteSettings,
    fixMojibakeDeep,
    invalidateJsonFileCache,
    invalidatePublicReadCacheTags,
    isAutoUploadReorganizationEnabled,
    isOpsAlertsWebhookEnabled,
    loadComments,
    loadPosts,
    loadProjects,
    loadUpdates,
    loadUploads,
    loadUsers,
    migrateEditorialMentionPlaceholdersInSettings,
    normalizeEditorialWebhookSettings,
    normalizeOperationalWebhookSettings,
    normalizeSecurityWebhookSettings,
    normalizeSiteSettings,
    normalizeUploadsDeep,
    normalizeWebhookSettingsBundle,
    readJsonFileFromCache,
    runUploadsReorganization,
    sanitizeIconSource,
    validateWebhookUrlForProvider,
    writeComments,
    writeJsonFileToCache,
    writePosts,
    writeProjects,
    writeUpdates,
    writeUploads,
    writeUsers,
  }),
);

const {
  buildEnvOperationalWebhookSettings,
  buildEnvSecurityWebhookSettings,
  buildOperationalWebhookTestTransition,
  buildSecurityWebhookTestEvent,
  buildWebhookSettingsBundle,
  ensureEditorialWebhookSettingsNoConflict,
  ensureWebhookSettingsNoConflict,
  loadIntegrationSettings,
  loadIntegrationSettingsBundle,
  loadIntegrationSettingsSources,
  loadPages,
  loadSiteSettings,
  loadTagTranslations,
  normalizeUnifiedWebhookSettingsForRequest,
  runAutoUploadReorganization,
  validateEditorialWebhookChannelUrls,
  validateUnifiedWebhookSettingsUrls,
  writeIntegrationSettings,
  writePages,
  writeSiteSettings,
  writeTagTranslations,
} = siteConfigRuntime;

const mediaSupportRuntime = createMediaSupportRuntimeBundle(
  buildMediaSupportRuntimeDependencies({
    PRIMARY_APP_ORIGIN,
    PUBLIC_UPLOADS_DIR,
    STATIC_DEFAULT_CACHE_CONTROL,
    appendAuditLog,
    attachUploadMediaMetadata,
    backgroundJobQueue,
    buildDiskStorageAreaSummary,
    buildStorageAreaSummary,
    cleanupUploadStagingWorkspace,
    createSystemAuditReq,
    createUploadStagingWorkspace,
    crypto,
    dataRepository,
    deriveFocalPointsFromCrops,
    extractUploadUrlsFromText,
    fs,
    getPrimaryFocalPoint,
    getPublicVisibleProjects: () => getPublicVisibleProjects(),
    getUploadVariantUrlPrefix,
    isProduction,
    loadComments,
    loadIntegrationSettings,
    loadLinkTypes,
    loadPages,
    loadPosts,
    loadProjects,
    loadSiteSettings,
    loadTagTranslations,
    loadUpdates,
    loadUploads,
    loadUsers,
    materializeUploadEntrySourceToStaging,
    mergeUploadVariantPresetKeys,
    metricsRegistry,
    normalizeFocalCrops,
    normalizeFocalPoints,
    normalizeUploadStorageProvider,
    normalizeUploadUrl,
    normalizeUploadVariantPresetKeys,
    normalizeVariants,
    ogRenderCache,
    path,
    persistUploadEntryFromStaging,
    prewarmProjectOgCache,
    rateLimiter,
    readUploadStorageProvider,
    resolveExistingPublicVariantUrl,
    resolveUploadAbsolutePath,
    sanitizeIconSource,
    sanitizePublicHref,
    sanitizeSocials,
    sanitizePublicMediaVariantEntry,
    sanitizeUploadSlot,
    shouldExposePublicUploadInMediaVariants,
    uploadStorageService,
    writeUploads,
  }),
);

const {
  buildGravatarUrl,
  buildManagedStorageAreaSummary,
  buildPublicMediaVariants,
  canAttemptAuth,
  canBootstrap,
  canRegisterPollVote,
  canRegisterView,
  canSubmitComment,
  canUploadImage,
  collectDownloadIconUploads,
  collectLinkTypeIconUploads,
  createGravatarHash,
  deleteManagedUploadEntryAssets,
  deletePrivateUploadByUrl,
  enqueueProjectOgPrewarm,
  ensureUploadEntryHasRequiredVariants,
  extractRequestedUploadFocalPayload,
  getUsedUploadUrls,
  getUploadFolderFromUrlValue,
  hasOwnField,
  isPrivateUploadFolder,
  logProjectOgDelivery,
  normalizeEmail,
  normalizeUploadUrlValue,
  readUploadAltText,
  readUploadFocalState,
  readUploadSlot,
  readUploadSlotManaged,
  resolveGravatarAvatarUrl,
  resolveIncomingUploadFocalState,
  resolveMetaImageVariantUrl,
  runStartupSecuritySanitization,
  upsertUploadEntries,
} = mediaSupportRuntime;
const publicMediaRuntime = mediaSupportRuntime;

const siteRenderingRuntime = createSiteRenderingRuntimeBundle(
  buildSiteRenderingRuntimeDependencies({
    PRIMARY_APP_ORIGIN,
    applyHtmlCachingHeaders,
    buildInstitutionalOgImageAlt,
    buildInstitutionalOgRevisionValue,
    buildPostOgImageAlt,
    buildPostOgRevision,
    buildProjectOgRevision,
    buildProjectReadingOgCardModel,
    buildProjectReadingOgRevisionValue,
    buildVersionedInstitutionalOgImagePath,
    buildVersionedPostOgImagePath,
    buildVersionedProjectOgImagePath,
    buildVersionedProjectReadingOgImagePath,
    extractFirstImageFromPostContent,
    getIndexHtml,
    injectNonceIntoHtmlScripts,
    loadPages,
    loadSiteSettings,
    loadTagTranslations,
    resolveInstitutionalOgPagePath,
    resolveInstitutionalOgPageTitle,
    resolveInstitutionalOgSupportText,
    resolveMetaImageVariantUrl,
    resolvePostCover,
    serializeSchemaOrgEntry,
    toAbsoluteUrl,
    truncateMetaDescription,
    viteDevServer,
  }),
);
const {
  buildEditorialWebhookImageContext,
  buildInstitutionalPageMeta,
  buildPostMeta,
  buildProjectMeta,
  buildProjectReadingMeta,
  buildSiteMetaWithSettings,
  getPageTitleFromPath,
  renderMetaHtml,
  sendHtml,
} = siteRenderingRuntime;

const getActiveProjectTypes = createGetActiveProjectTypes({
  defaultProjectTypeCatalog: DEFAULT_PROJECT_TYPE_CATALOG,
  loadProjects,
  normalizeProjects,
});
const { createWebhookAuditReqFromContext, enqueueWebhookDelivery, resolveWebhookAuditActions } =
  createWebhookDeliveryRuntime({
    buildWebhookTargetLabel,
    clampWebhookInteger,
    createRequestId: () => crypto.randomUUID(),
    createWebhookAuditReqFromContextBase,
    resolveWebhookAuditActionsBase,
    upsertWebhookDelivery,
    validateWebhookUrlForProvider,
    webhookDeliveryScope: WEBHOOK_DELIVERY_SCOPE,
    webhookDeliveryStatus: WEBHOOK_DELIVERY_STATUS,
  });

const userRuntime = createUserRuntimeBundle(
  buildUserRuntimeDependencies({
    AUTH_FAILED_BURST_CRITICAL,
    AUTH_FAILED_BURST_WARNING,
    AccessRole,
    DASHBOARD_HOME_ROLE_IDS,
    DASHBOARD_WIDGET_IDS,
    EXCESSIVE_SESSIONS_WARNING,
    MFA_ENROLLMENT_TTL_MS,
    MFA_FAILED_BURST_WARNING,
    MFA_ICON_URL,
    MFA_ISSUER,
    MFA_RECOVERY_CODE_PEPPER,
    NEW_NETWORK_LOOKBACK_MS,
    PRIMARY_APP_ORIGIN,
    PermissionId,
    SESSION_INDEX_TOUCH_MIN_INTERVAL_MS,
    SecurityEventSeverity,
    SecurityEventStatus,
    USER_PREFERENCES_DENSITY_SET,
    USER_PREFERENCES_THEME_MODE_SET,
    addOwnerRoleLabel,
    appendAuditLog,
    authFailedByIpCounter,
    buildAnalyticsRange,
    buildCommentTargetInfo,
    buildOtpAuthUrl,
    can,
    computeEffectiveAccessRole,
    computeGrants,
    createRevisionToken,
    createSecurityEventPayload,
    createSystemAuditReq,
    crypto,
    dataEncryptionKeyring,
    dataRepository,
    decryptStringWithKeyring,
    defaultPermissionsForRole,
    expandLegacyPermissions,
    filterAnalyticsEvents,
    generateTotpSecret,
    getDispatchCriticalSecurityEventWebhook: () => dispatchCriticalSecurityEventWebhook,
    getIpv4Network24,
    getRequestIp,
    hashRecoveryCode,
    isDiscordAvatarUrl,
    isOwner,
    isPlainObject,
    isPrimaryOwner,
    isRbacV2AcceptLegacyStar,
    isRbacV2Enabled,
    loadAnalyticsEvents,
    loadComments,
    loadOwnerIds,
    loadPosts,
    loadProjects,
    loadSecurityEvents,
    loadSiteSettings,
    loadUploads,
    loadUsers,
    metricsRegistry,
    mfaFailedByUserCounter,
    normalizeAccessRole,
    normalizeAnalyticsTypeFilter,
    normalizeAvatarDisplay,
    normalizePosts,
    normalizeProjectReaderPreferences,
    normalizeProjects,
    normalizeSecurityEventStatus,
    normalizeUploadsDeep,
    parseAnalyticsRangeDays,
    removeOwnerRoleLabel,
    resolveEffectiveUserAvatarUrl,
    resolveUploadScopeAccess,
    resolveUserAvatarRenderVersion,
    sanitizeAssetUrl,
    sanitizeFavoriteWorksByCategory,
    sanitizePermissionsForStorage,
    sanitizeSocials,
    selectRecentApprovedComments,
    sessionIndexTouchTsBySid,
    sessionStore,
    shouldSyncDiscordAvatarToStoredUser,
    upsertSecurityEvent,
    verifyTotpCode,
    writeAllowedUsers,
    writeUsers,
  }),
);

const {
  applyOwnerRole,
  buildDashboardOverviewResponsePayload,
  buildMySecuritySummary,
  buildPublicTeamMembers,
  buildUserPayload,
  buildUserProfileRevisionToken,
  canManageComments,
  canManageIntegrations,
  canManagePages,
  canManagePosts,
  canManageProjects,
  canManageSecurityAdmin,
  canManageSettings,
  canManageUploads,
  canManageUsersAccess,
  canManageUsersBasic,
  canViewAnalytics,
  canViewAuditLog,
  clearEnrollmentFromSession,
  deleteUserMfaTotpRecord,
  emitSecurityEvent,
  enforceUserAccessInvariants,
  ensureOwnerUser,
  getUserAccessContextById,
  getUserTotpSecret,
  handleAuthFailureSecuritySignals,
  handleMfaFailureSecuritySignals,
  isAdminUser,
  isTotpEnabledForUser,
  listActiveSessionsForUser,
  loadUserMfaTotpRecord,
  loadUserPreferences,
  loadUserSessionIndexRecords,
  maybeEmitAdminActionFromNewNetwork,
  maybeEmitExcessiveSessionsEvent,
  maybeEmitNewNetworkLoginEvent,
  normalizeUserPreferences,
  normalizeUsers,
  normalizeUploadScopeUserId,
  parseDashboardNotificationsLimit,
  permissionsForRead,
  resolveDiscordAvatarFallbackUrl,
  resolveEnrollmentFromSession,
  resolveMfaMetadata,
  resolveRequestUploadAccessScope,
  revokeSessionBySid,
  revokeUserSessionIndexRecord,
  shouldEmitSecurityRuleEvent,
  startTotpEnrollment,
  syncAllowedUsers,
  syncPersistedDiscordAvatarForLogin,
  syncSessionUserDisplayProfile,
  toDashboardNotificationId,
  toSecurityEventApiResponse,
  updateSecurityEventStatus,
  updateSessionIndexFromRequest,
  userWithAccessForResponse,
  verifyTotpOrRecoveryCode,
  withEffectiveAvatarUrl,
  withUserProfileRevision,
  writeUserMfaTotpRecord,
  writeUserPreferences,
} = userRuntime;

const { evaluateOperationalMonitoring } = createOperationalMonitoringRuntime(
  buildOperationalMonitoringRuntimeDependencies({
    OPS_ALERTS_DB_LATENCY_WARNING_MS,
    PUBLIC_UPLOADS_DIR,
    REDIS_URL,
    backgroundJobQueue,
    buildHealthStatusResponse,
    buildOperationalAlertsResponse,
    buildOperationalAlertsV1,
    dataRepository,
    fs,
    isMaintenanceMode,
    isProduction,
    prisma,
    rateLimiter,
    sessionCookieConfig,
  }),
);

const setNoStoreJson = (res) => {
  res.setHeader("Cache-Control", "no-store");
};

const projectRuntime = createProjectRuntimeBundle(
  buildProjectRuntimeDependencies({
    EPUB_IMPORT_JOB_RESULT_TTL_MS,
    EPUB_IMPORT_MULTIPART_LIMITS,
    PROJECT_IMAGE_EXPORT_JOB_RESULT_TTL_MS,
    PROJECT_IMAGE_IMPORT_JOB_RESULT_TTL_MS,
    PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS,
    PUBLIC_UPLOADS_DIR,
    backgroundJobQueue,
    deleteEpubImportJobResult,
    deleteProjectImageExportJobResult,
    deleteProjectImageImportJobResult,
    ensureProjectImageExportJobsDirectory,
    epubImportJobsDir,
    express,
    exportProjectImageCollection,
    findDuplicateEpisodeKey,
    findDuplicateVolumeCover,
    fs,
    importProjectEpub,
    importProjectImageChapters,
    loadEpubImportJobs,
    loadProjectImageExportJobs,
    loadProjectImageImportJobs,
    loadUploads,
    mapEpubImportExecutionError,
    mapEpubImportMultipartError,
    mapProjectImageImportExecutionError,
    mapProjectImageImportMultipartError,
    multer,
    normalizeProjects,
    path,
    projectImageExportJobsDir,
    projectImageImportJobsDir,
    upsertEpubImportJob,
    upsertProjectImageExportJob,
    upsertProjectImageImportJob,
    writeEpubImportJobResult,
    writeProjectImageImportJobResult,
    writeUploads,
  }),
);

const {
  buildProjectImageExportDownloadPath,
  enqueueEpubImportJob,
  enqueueProjectImageExportJob,
  enqueueProjectImageImportJob,
  expireEpubImportJob,
  expireProjectImageExportJob,
  expireProjectImageImportJob,
  findEpubImportJobForUser,
  findProjectImageExportJobForUser,
  findProjectImageImportJobForUser,
  normalizeProjectSnapshotForEpubImport,
  parseEpubImportRequestBody,
  parseProjectImageImportRequestBody,
  recoverEpubImportJobsAfterRestart,
  recoverProjectImageJobsAfterRestart,
  resolveEpubImportRequestInput,
} = projectRuntime;

const buildRuntimeMetadata = createRuntimeMetadataBuilder({
  apiVersion: API_CONTRACT_VERSION,
  getBuildMetadata,
});

const WEBHOOK_WORKER_POLL_INTERVAL_MS = 5_000;
const OPERATIONAL_ALERTS_SCHEDULER_POLL_MS = 5_000;

const analyticsCompactionState = {
  timer: null,
};

const webhookRuntime = createWebhookRuntimeBundle(
  buildWebhookRuntimeDependencies({
    OPERATIONAL_WEBHOOK_INTERVAL_DEFAULT_MS,
    OPERATIONAL_WEBHOOK_INTERVAL_MAX_MS,
    OPERATIONAL_WEBHOOK_INTERVAL_MIN_MS,
    PRIMARY_APP_ORIGIN,
    WEBHOOK_DELIVERY_SCOPE,
    WEBHOOK_DELIVERY_STATUS,
    appendAuditLog,
    buildEditorialEventContext,
    buildEditorialMentions,
    buildEditorialWebhookImageContext,
    buildOperationalAlertsWebhookNotification,
    buildWebhookAuditMeta,
    buildWebhookTargetLabel,
    claimWebhookDelivery,
    clampWebhookInteger,
    computeWebhookRetryDelayMs,
    createResolveEditorialAuthorFromPost,
    createSystemAuditReq,
    createWebhookAuditReqFromContext,
    createWebhookWorkerId,
    crypto,
    deriveChapterSynopsis,
    diffOperationalAlertSets,
    dispatchWebhookMessage,
    enqueueWebhookDelivery,
    evaluateOperationalMonitoring,
    getActiveProjectTypes,
    getRequestIp,
    loadIntegrationSettings,
    loadProjects,
    loadSiteSettings,
    loadTagTranslations,
    loadUsers,
    loadWebhookState,
    normalizeEditorialWebhookSettings,
    normalizeProjects,
    normalizeTypeLookupKey,
    normalizeUsers,
    renderWebhookTemplate,
    resolveEditorialEventChannel,
    resolveEditorialEventLabel,
    resolveEpisodeLookup,
    resolveWebhookAuditActions,
    toDiscordWebhookPayload,
    upsertWebhookDelivery,
    validateWebhookUrlForProvider,
    writeWebhookState,
  }),
);

const {
  appendWebhookQueuedAuditLog,
  buildOperationalAlertsWebhookPayload,
  buildSecurityWebhookPayload,
  dispatchCriticalSecurityEventWebhook,
  dispatchEditorialWebhookEvent,
  findProjectChapterByEpisodeNumber,
  operationalAlertsWebhookState,
  prepareEditorialWebhookDispatch,
  resolveEditorialAuthorFromPost,
  resolveProjectWebhookEventKey,
  runOperationalAlertsSchedulerTick,
  runWebhookDeliveryWorkerTick,
  webhookDeliveryWorkerState,
} = webhookRuntime;

const { requireAuth, requirePrimaryOwner } = createRouteGuards({
  isOwner,
  isPrimaryOwner,
});

const adminExportRuntime = createAdminExportRuntime(
  buildAdminExportRuntimeDependencies({
    ADMIN_EXPORT_MAX_ROWS,
    ADMIN_EXPORT_TTL_HOURS,
    AccessRole,
    adminExportsDir,
    appendAuditLog,
    backgroundJobQueue,
    createSystemAuditReq,
    filterByDateRange,
    filterExportEntries,
    loadAdminExportJobs,
    loadAuditLog,
    loadOwnerIds,
    loadSecurityEvents,
    loadUserSessionIndexRecords,
    loadUsers,
    metricsRegistry,
    normalizeExportDataset,
    normalizeExportFilters,
    normalizeExportStatus,
    normalizeUsers,
    upsertAdminExportJob,
    writeExportFile,
  }),
);

const { enqueueAdminExportJob, toAdminExportJobApiResponse } = adminExportRuntime;

recoverEpubImportJobsAfterRestart();
recoverProjectImageJobsAfterRestart();

const publicRuntime = createPublicRuntimeBundle(
  buildPublicRuntimeDependencies({
    BOOTSTRAP_PWA_ENABLED: isProduction || isPwaDevEnabled,
    PRIMARY_APP_ORIGIN,
    SITEMAP_STATIC_PUBLIC_PATHS,
    buildPublicBootstrapPayload,
    buildPublicMediaVariants,
    buildPublicReadableProjects,
    buildPublicTeamMembers,
    buildPublicVisibleProjects,
    buildUserPayload,
    createSlug,
    crypto,
    extractLocalStylesheetHrefs,
    injectBootstrapGlobals,
    injectHomeHeroShell,
    injectPreloadLinks,
    isEpisodePublic,
    loadLinkTypes,
    loadPages,
    loadPosts,
    loadProjects,
    loadSiteSettings,
    loadTagTranslations,
    loadUpdates,
    normalizePosts,
    normalizeProjects,
    resolveEpisodeLookup,
    resolveBootstrapPwaEnabled: createResolveBootstrapPwaEnabled({
      isProduction,
      isPwaDevEnabled,
    }),
    resolveHomeHeroPreloadFromSlide,
    resolveMetaImageVariantUrl,
    resolvePostCover,
    resolvePublicPostCoverPreload,
    resolvePublicProjectsListPreloads,
    resolvePublicReaderHeroPreload,
    resolvePublicTeamAvatarPreload,
    stripHtml,
  }),
);

const {
  buildLaunchesRssItems,
  buildPostsRssItems,
  buildPublicBootstrapResponsePayload,
  buildPublicSitemapEntries,
  getPublicReadableProjects,
  getPublicVisiblePosts,
  getPublicVisibleProjects,
  getPublicVisibleUpdates,
  injectDashboardBootstrapHtml,
  injectPublicBootstrapHtml,
  sendXmlResponse,
} = publicRuntime;

const rootRouteRegistrationDependencies = buildRootServerRegistrationSource({
  adminExports,
  authzLib,
  dataRepositoryAdaptersRuntime,
  userRuntime,
  publicMediaRuntime,
  adminExportRuntime,
  projectRuntime,
  publicRuntime,
  webhookRuntime,
  ANILIST_API,
  API_CONTRACT_VERSION,
  AUDIT_CSV_MAX_ROWS,
  BOOTSTRAP_TOKEN,
  DISCORD_API,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  MAX_SVG_SIZE_BYTES,
  MAX_UPLOAD_SIZE_BYTES,
  METRICS_TOKEN_NORMALIZED,
  MFA_RECOVERY_CODE_PEPPER,
  PRIMARY_APP_ORIGIN,
  PUBLIC_ANALYTICS_EVENT_TYPE_SET,
  PUBLIC_ANALYTICS_RESOURCE_TYPE_SET,
  PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME,
  PUBLIC_BOOTSTRAP_MODE_FULL,
  PUBLIC_READ_CACHE_TAGS,
  PUBLIC_READ_CACHE_TTL_MS,
  PUBLIC_UPLOADS_DIR,
  SCOPES,
  STATIC_DEFAULT_CACHE_CONTROL,
  USER_PREFERENCES_MAX_BYTES,
  WEBHOOK_DELIVERY_STATUS,
  SecurityEventSeverity,
  SecurityEventStatus,
  app,
  appendAnalyticsEvent,
  appendAuditLog,
  appendPostVersion,
  applyCommentCountToPosts,
  applyCommentCountToProjects,
  applyEpisodePublicationMetadata,
  applyPostSnapshotForRollback,
  applyProjectChapterUpdate,
  attachUploadMediaMetadata,
  buildAnalyticsRange,
  buildAuthRedirectUrl,
  buildEditorialCalendarItems,
  buildGravatarUrl,
  buildInstitutionalOgDeliveryHeaders,
  buildInstitutionalPageMeta,
  buildManagedStorageAreaSummary,
  buildMySecuritySummary,
  buildOperationalWebhookTestTransition,
  buildPostMeta,
  buildProjectMeta,
  buildProjectOgDeliveryHeaders,
  buildProjectOgRevision,
  buildProjectReadingMeta,
  buildProjectReadingOgDeliveryHeaders,
  buildPublicSearchSuggestions,
  buildRssXml,
  buildRuntimeMetadata,
  buildSchemaOrgPayload,
  buildSecurityWebhookTestEvent,
  buildSiteMetaWithSettings,
  buildSitemapXml,
  buildUserPayload,
  bulkModeratePendingComments,
  canAttemptAuth,
  canBootstrap,
  canRegisterPollVote,
  canRegisterView,
  canSubmitComment,
  canUploadImage,
  cleanupProjectEpubImportTempUploads,
  cleanupUploadStagingWorkspace,
  clearEnrollmentFromSession,
  collectEpisodeUpdatesByVisibility,
  computeBufferSha256,
  createDiscordAvatarUrl,
  createGravatarHash,
  createRevisionToken,
  createSlug,
  createUniqueSlug,
  createUploadStagingWorkspace,
  crypto,
  dataEncryptionKeyring,
  deleteManagedUploadEntryAssets,
  deletePrivateUploadByUrl,
  deleteUserMfaTotpRecord,
  deriveAniListMediaOrganization,
  deriveChapterSynopsis,
  dispatchWebhookMessage,
  encryptStringWithKeyring,
  ensureEditorialWebhookSettingsNoConflict,
  ensureNoEditConflict,
  ensureOwnerUser,
  ensureUploadEntryHasRequiredVariants,
  ensureWebhookSettingsNoConflict,
  establishAuthenticatedSession,
  evaluateOperationalMonitoring,
  exportProjectEpub,
  exportProjectImageChapter,
  extractFirstImageFromPostContent,
  extractRequestedUploadFocalPayload,
  fetchAniListMediaById,
  filterAnalyticsEvents,
  findDuplicateEpisodeKey,
  findDuplicateVolumeCover,
  findPublishedImageEpisodeWithoutPages,
  findUploadByHash,
  generateRecoveryCodes,
  getActiveProjectTypes,
  getDayKeyFromTs,
  getIndexHtml,
  getInstitutionalOgCachedRender,
  getPageTitleFromPath,
  getPostOgCachedRender,
  getPrimaryOwnerId,
  getProjectEpisodePageCount,
  getProjectOgCachedRender,
  getProjectReadingOgCachedRender,
  getRequestIp,
  getUploadExtFromMime,
  getUploadFolderFromUrlValue,
  getUploadMimeFromExtension,
  getUploadVariantUrlPrefix,
  handleAuthFailureSecuritySignals,
  handleMfaFailureSecuritySignals,
  hashRecoveryCode,
  hasOwnField,
  hasProjectEpisodePages,
  importProjectEpub,
  importRemoteImageFile,
  incrementCounter,
  incrementPostViews,
  incrementProjectViews,
  invalidateUploadsCleanupPreviewCache,
  isAllowedOrigin,
  isAuditActionEnabled,
  isChapterBasedType,
  isEpisodePublic,
  isEpubImportJobStorageAvailable,
  isHomeHeroShellEnabled,
  isMetricsEnabled,
  isOwner,
  isPlainObject,
  isPrimaryOwner,
  isPrivateUploadFolder,
  isProjectImageImportJobStorageAvailable,
  isRbacV2Enabled,
  isTotpEnabledForUser,
  isUploadFolderAllowedInScope,
  isWithinRestoreWindow,
  listActiveSessionsForUser,
  listPostVersions,
  loadAllowedUsers,
  loadAnalyticsEvents,
  loadAuditLog,
  loadCachedUploadsCleanupPreview,
  loadComments,
  loadIntegrationSettings,
  loadIntegrationSettingsSources,
  loadLinkTypes,
  loadOwnerIds,
  loadPages,
  loadPostVersions,
  loadPosts,
  loadProjects,
  loadSecurityEvents,
  loadSiteSettings,
  loadTagTranslations,
  loadUpdates,
  loadUploads,
  loadUserPreferences,
  loadUserSessionIndexRecords,
  loadUsers,
  localizeProjectImageFields,
  mapEpubImportExecutionError,
  mapProjectImageImportExecutionError,
  materializeUploadEntrySourceToStaging,
  maybeEmitExcessiveSessionsEvent,
  maybeEmitNewNetworkLoginEvent,
  metricsRegistry,
  migrateEditorialMentionPlaceholdersInSettings,
  normalizeAnalyticsTypeFilter,
  normalizeAvatarDisplay,
  normalizeEditorialWebhookSettings,
  normalizeEmail,
  normalizeLinkTypes,
  normalizePosts,
  normalizeProjectEpisodeContentFormat,
  normalizeProjectEpisodePages,
  normalizeProjects,
  normalizeSearchQuery,
  normalizeSiteSettings,
  normalizeTags,
  normalizeTypeLookupKey,
  normalizeUnifiedWebhookSettingsForRequest,
  normalizeUploadMime,
  normalizeUserPreferences,
  normalizeVariants,
  ogRenderCache,
  parseAnalyticsRangeDays,
  parseAnalyticsTs,
  parseAuditTs,
  parseEditRevisionOptions,
  parseSearchLimit,
  parseSearchScope,
  persistUploadEntryFromStaging,
  postVersionReasonLabel,
  previewProjectImageImport,
  proxyDiscordAvatarRequest,
  publicSearchConfig,
  readEpubImportJobResult,
  readProjectImageImportJobResult,
  readPublicCachedJson,
  readUploadAltText,
  readUploadFocalState,
  readUploadSlot,
  readUploadSlotManaged,
  readUploadStorageProvider,
  renderMetaHtml,
  requireAuth,
  requirePrimaryOwner,
  resolveAuthAppOrigin,
  resolveDiscordRedirectUri,
  resolveEditorialEventChannel,
  resolveEnrollmentFromSession,
  resolveEpisodeLookup,
  resolveGravatarAvatarUrl,
  resolveIncomingUploadFocalState,
  resolveInstitutionalOgPageKeyFromPath,
  resolveInstitutionalOgPageTitle,
  resolveMfaMetadata,
  resolvePostCover,
  resolvePostStatus,
  resolveProjectImageImportRequestInput,
  resolveProjectReaderConfig,
  resolveProjectUpdateUnitLabel,
  resolvePublicRedirect,
  resolveThemeColor,
  resolveUploadAbsolutePath,
  resolveUploadVariantPresetKeysForArea,
  revokeSessionBySid,
  revokeUserSessionIndexRecord,
  runAutoUploadReorganization,
  runUploadsCleanup,
  sanitizeFavoriteWorksByCategory,
  sanitizeSocials,
  sanitizeSvg,
  sanitizeUploadBaseName,
  sanitizeUploadFolder,
  sanitizeUploadSlot,
  saveSessionState,
  sendHtml,
  sessionCookieConfig,
  sessionIndexTouchTsBySid,
  shouldIncludeUploadInHashDedupe,
  startTotpEnrollment,
  summarizeWebhookDeliveries,
  syncPersistedDiscordAvatarForLogin,
  toAbsoluteUrl,
  toEpubImportJobApiResponse,
  toProjectImageExportJobApiResponse,
  toProjectImageImportJobApiResponse,
  toWebhookDeliveryApiResponse,
  updateLexicalPollVotes,
  updateSessionIndexFromRequest,
  upsertUploadEntries,
  uploadStorageService,
  validateEditorialWebhookChannelUrls,
  validateEditorialWebhookSettingsPlaceholders,
  validateUnifiedWebhookSettingsUrls,
  validateUploadImageBuffer,
  verifyTotpCode,
  verifyTotpOrRecoveryCode,
  writeComments,
  writeIntegrationSettings,
  writeLinkTypes,
  writeOwnerIds,
  writePages,
  writePosts,
  writeProjects,
  writePublicCachedJson,
  writeSiteSettings,
  writeTagTranslations,
  writeUpdates,
  writeUploadBufferToStaging,
  writeUploads,
  writeUserMfaTotpRecord,
  writeUserPreferences,
  writeUsers,
});

registerRootServerRoutes(rootRouteRegistrationDependencies);
app.use(createGlobalErrorHandler());

const listenPort = Number(PORT);
startServerJobs({
  ANALYTICS_COMPACTION_INTERVAL_MS,
  OPERATIONAL_ALERTS_SCHEDULER_POLL_MS,
  WEBHOOK_WORKER_POLL_INTERVAL_MS,
  analyticsCompactionState,
  enqueueAnalyticsCompactionJob,
  httpServer,
  isAutoUploadReorganizationOnStartupEnabled,
  isMaintenanceMode,
  listenPort,
  operationalAlertsWebhookState,
  rateLimiter,
  runAutoUploadReorganization,
  runOperationalAlertsSchedulerTick,
  runStartupSecuritySanitization,
  runWebhookDeliveryWorkerTick,
  webhookDeliveryWorkerState,
});
