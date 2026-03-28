import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import { createServer as createHttpServer } from "node:http";
import path from "path";
import { fileURLToPath } from "url";
import connectPgSimple from "connect-pg-simple";
import express from "express";
import session from "express-session";
import multer from "multer";
import { Pool } from "pg";
import { createServerRouteDependencies } from "./bootstrap/create-server-route-dependencies.js";
import { registerServerRoutes } from "./bootstrap/register-server-routes.js";
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
import { createAnalyticsStore } from "./lib/analytics-store.js";
import { API_CONTRACT_VERSION, buildApiContractV1 } from "./lib/api-contract-v1.js";
import { ANILIST_API, fetchAniListMediaById } from "./lib/anilist-client.js";
import { createAuditLogStore } from "./lib/audit-log-store.js";
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
  isTruthyEnv,
  normalizeAccessRole,
  pickBasicProfilePatch,
  removeOwnerRoleLabel,
  sanitizePermissionsForStorage,
} from "./lib/authz.js";
import {
  isUploadFolderAllowedInScope,
  resolveUploadScopeAccess,
  shouldIncludeUploadInHashDedupe,
} from "./lib/avatar-upload-scope.js";
import { getBuildMetadata } from "./lib/build-metadata.js";
import { deriveChapterSynopsis } from "./lib/chapter-synopsis.js";
import { buildCommentTargetInfo } from "./lib/comment-target-info.js";
import { bulkModeratePendingComments } from "./lib/comments-bulk-moderation.js";
import { createPublicMediaRuntime } from "./lib/public-media-runtime.js";
import { selectRecentApprovedComments } from "./lib/dashboard-recent-comments.js";
import { createDataRepository } from "./lib/data-repository.js";
import { proxyDiscordAvatarRequest } from "./lib/discord-avatar-proxy.js";
import { buildEditorialCalendarItems } from "./lib/editorial-calendar.js";
import { createViteDevServer, resolveClientIndexPath } from "./lib/frontend-runtime.js";
import { buildHealthStatusResponse } from "./lib/health-checks.js";
import {
  extractLocalStylesheetHrefs,
  injectBootstrapGlobals,
  injectHomeHeroShell,
  injectPreloadLinks,
} from "./lib/html-bootstrap.js";
import {
  HTML_CACHE_CONTROL_PRIVATE_REVALIDATE,
  applyHtmlCachingHeaders,
} from "./lib/html-cache-control.js";
import { createIdempotencyStore } from "./lib/idempotency-store.js";
import { createJobQueue } from "./lib/job-queue.js";
import { createJsonFileCache } from "./lib/json-file-cache.js";
import { truncateMetaDescription } from "./lib/meta-description.js";
import {
  createAbsoluteUrlResolver,
  createHtmlSender,
  createIndexHtmlLoader,
  createMetaHtmlRenderer,
} from "./lib/meta-html.js";
import { registerAuthRoutes } from "./lib/register-auth-routes.js";
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
import { registerOperationalRoutes } from "./lib/register-operational-routes.js";
import {
  buildOriginConfig,
  isAllowedOrigin as isAllowedOriginByConfig,
  resolveAuthAppOrigin,
  resolveDiscordRedirectUri as resolveDiscordRedirectUriByConfig,
} from "./lib/origin-config.js";
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
import {
  normalizeLegacyInviteCardText,
  normalizeLegacyUpdateRecord,
} from "./lib/pt-legacy-normalization.js";
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
import { normalizePublicRedirects, resolvePublicRedirect } from "./lib/public-redirects.js";
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
import { registerSessionRoutes } from "./lib/register-session-routes.js";
import { registerSelfServiceRoutes } from "./lib/register-self-service-routes.js";
import { buildSchemaOrgPayload, serializeSchemaOrgEntry } from "./lib/schema-org.js";
import {
  decryptStringWithKeyring,
  encryptStringWithKeyring,
  parseDataEncryptionKeyring,
  resolveSessionSecrets,
} from "./lib/security-crypto.js";
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
import { buildSessionCookieConfig } from "./lib/session-cookie-config.js";
import { buildSitemapXml } from "./lib/sitemap-xml.js";
import { createSiteMetaBuilders, stripHtml } from "./lib/site-meta-builders.js";
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
  createBuildEditorialWebhookImageContext,
  createResolveEditorialAuthorFromPost,
  createWebhookAuditReqFromContext as createWebhookAuditReqFromContextBase,
  pickFirstNonEmptyText,
  resolveWebhookAuditActions as resolveWebhookAuditActionsBase,
} from "./lib/webhook-support.js";
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
import { buildWebhookTargetLabel, validateWebhookUrlForProvider } from "./lib/webhooks/validation.js";
import { deriveAniListMediaOrganization } from "../src/lib/anilist-media.js";
import {
  buildInstitutionalOgImageAlt,
  resolveInstitutionalOgPageKeyFromPath,
  resolveInstitutionalOgPagePath,
  resolveInstitutionalOgPageTitle,
  resolveInstitutionalOgSupportText,
} from "../shared/institutional-og-seo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_UPLOADS_DIR = path.join(__dirname, "..", "public", "uploads");
const uploadStorageService = createUploadStorageService({
  uploadsDir: PUBLIC_UPLOADS_DIR,
});

const app = express();
app.disable("x-powered-by");
const PgSessionStore = connectPgSimple(session);
let dataRepository = null;

const STATIC_DEFAULT_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const STATIC_IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const PWA_MANIFEST_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=600";
const PWA_SW_CACHE_CONTROL = "no-cache";
const PWA_THEME_COLOR_DARK = "#101114";
const PWA_THEME_COLOR_LIGHT = "#f8fafc";
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
const PWA_MANIFEST_BASE = Object.freeze({
  id: "/",
  name: "Nekomata Fansub",
  short_name: "Nekomata",
  description:
    "Fansub dedicada a trazer historias inesqueciveis com o carinho que a comunidade merece.",
  start_url: "/",
  display: "standalone",
  lang: "pt-BR",
  scope: "/",
  categories: ["entertainment", "books"],
  screenshots: [
    {
      src: "/pwa/screenshots/home-mobile-1080x1920.png",
      sizes: "1080x1920",
      type: "image/png",
      form_factor: "narrow",
      label: "Pagina inicial mobile",
    },
    {
      src: "/pwa/screenshots/project-mobile-1080x1920.png",
      sizes: "1080x1920",
      type: "image/png",
      form_factor: "narrow",
      label: "Pagina de projeto mobile",
    },
    {
      src: "/pwa/screenshots/home-desktop-1920x1080.png",
      sizes: "1920x1080",
      type: "image/png",
      form_factor: "wide",
      label: "Pagina inicial desktop",
    },
  ],
  icons: [
    {
      src: "/pwa/icon-192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "/pwa/icon-512.png",
      sizes: "512x512",
      type: "image/png",
    },
    {
      src: "/pwa/icon-512-maskable.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
});

const hasHashedAssetName = (filePath) => {
  const fileName = path.basename(String(filePath || ""));
  return /-[A-Za-z0-9_-]{6,}\./.test(fileName);
};

const setStaticCacheHeaders = (res, filePath) => {
  const normalizedPath = String(filePath || "");
  const fileName = path.basename(normalizedPath);

  if (fileName === "manifest.webmanifest") {
    res.setHeader("Cache-Control", PWA_MANIFEST_CACHE_CONTROL);
    return;
  }

  if (fileName === "sw.js" || /^workbox-[A-Za-z0-9_-]+\.js$/.test(fileName)) {
    res.setHeader("Cache-Control", PWA_SW_CACHE_CONTROL);
    return;
  }

  if (normalizedPath.endsWith(".html")) {
    res.setHeader("Cache-Control", HTML_CACHE_CONTROL_PRIVATE_REVALIDATE);
    return;
  }
  if (
    normalizedPath.includes(`${path.sep}assets${path.sep}`) &&
    hasHashedAssetName(normalizedPath)
  ) {
    res.setHeader("Cache-Control", STATIC_IMMUTABLE_CACHE_CONTROL);
    return;
  }
  res.setHeader("Cache-Control", STATIC_DEFAULT_CACHE_CONTROL);
};

const loadOwnerIds = () => {
  if (!dataRepository) {
    return [...OWNER_IDS];
  }
  const stored = dataRepository.loadOwnerIds();
  return Array.from(new Set([...OWNER_IDS, ...stored.map((id) => String(id))]));
};
const writeOwnerIds = (ids) => {
  const unique = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
  if (dataRepository) {
    dataRepository.writeOwnerIds(unique);
  }
};
const isOwner = (id) => loadOwnerIds().includes(String(id));
const getPrimaryOwnerId = () => loadOwnerIds()[0] || null;
const isPrimaryOwner = (id) => {
  const primary = getPrimaryOwnerId();
  return Boolean(primary && String(id) === String(primary));
};

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
  "editorial_webhook.queued": ["deliveryId", "scope", "channel", "eventKey", "eventLabel", "postId", "projectId", "attempt"],
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
  getPrimaryAppOrigin: () => PRIMARY_APP_ORIGIN,
});

const SECURITY_EVENT_MAX_ROWS = 20_000;
const SECURITY_EVENT_COOLDOWN_MS = 10 * 60 * 1000;
const securityRuleEventCooldown = new Map();

const shouldEmitSecurityRuleEvent = (ruleKey, actorKey = "") => {
  const normalizedRule = String(ruleKey || "").trim();
  if (!normalizedRule) {
    return false;
  }
  const key = `${normalizedRule}:${String(actorKey || "").trim()}`;
  const nowTs = Date.now();
  const previousTs = Number(securityRuleEventCooldown.get(key) || 0);
  if (Number.isFinite(previousTs) && nowTs - previousTs < SECURITY_EVENT_COOLDOWN_MS) {
    return false;
  }
  securityRuleEventCooldown.set(key, nowTs);
  if (securityRuleEventCooldown.size > 5000) {
    const cutoff = nowTs - SECURITY_EVENT_COOLDOWN_MS;
    Array.from(securityRuleEventCooldown.entries()).forEach(([entryKey, value]) => {
      if (Number(value) < cutoff) {
        securityRuleEventCooldown.delete(entryKey);
      }
    });
  }
  return true;
};

const trimSecurityEvents = (events) => {
  const safe = Array.isArray(events) ? events : [];
  if (safe.length <= SECURITY_EVENT_MAX_ROWS) {
    return safe;
  }
  return safe.slice(0, SECURITY_EVENT_MAX_ROWS);
};

const sanitizeSecurityEventData = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }
  const output = {};
  Object.entries(data)
    .slice(0, 50)
    .forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      if (value === null) {
        output[key] = null;
        return;
      }
      if (typeof value === "string") {
        output[key] = value.slice(0, 1000);
        return;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        output[key] = value;
        return;
      }
      if (Array.isArray(value)) {
        output[key] = value.slice(0, 20);
        return;
      }
      if (typeof value === "object") {
        output[key] = value;
      }
    });
  return output;
};

const emitSecurityEvent = ({
  req,
  type,
  severity,
  riskScore,
  actorUserId,
  targetUserId,
  data,
} = {}) => {
  const payload = createSecurityEventPayload({
    type,
    severity,
    riskScore,
    actorUserId: actorUserId || req?.session?.user?.id || null,
    targetUserId,
    ip: getRequestIp(req),
    userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 512),
    sessionId: req?.sessionID ? String(req.sessionID) : null,
    requestId: req?.requestId ? String(req.requestId) : null,
    status: SecurityEventStatus.OPEN,
    data: sanitizeSecurityEventData(data),
  });
  const saved = upsertSecurityEvent(payload);
  if (!saved) {
    return null;
  }
  const allEvents = trimSecurityEvents(loadSecurityEvents());
  if (allEvents.length !== loadSecurityEvents().length && dataRepository?.writeSecurityEvents) {
    dataRepository.writeSecurityEvents(allEvents);
  }
  metricsRegistry.inc("security_events_open_total", {
    severity: String(saved.severity || "info"),
    type: String(saved.type || "security_event"),
  });
  appendAuditLog(req || createSystemAuditReq(), "security.event.open", "security", {
    id: saved.id,
    type: saved.type,
    severity: saved.severity,
    riskScore: saved.riskScore,
    targetUserId: saved.targetUserId || null,
  });
  if (String(saved.severity || "").toLowerCase() === SecurityEventSeverity.CRITICAL) {
    void dispatchCriticalSecurityEventWebhook(saved);
  }
  return saved;
};

const DISCORD_API = "https://discord.com/api/v10";
const SCOPES = ["identify", "email"];

const {
  DATABASE_URL = "",
  REDIS_URL = "",
  MAINTENANCE_MODE: MAINTENANCE_MODE_ENV = "false",
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI = "auto",
  APP_ORIGIN = "",
  ADMIN_ORIGINS = "",
  SESSION_SECRET,
  SESSION_SECRETS = "",
  SESSION_TABLE = "user_sessions",
  DATA_ENCRYPTION_KEYS_JSON = "",
  SECURITY_RECOVERY_CODE_PEPPER = "",
  MFA_ISSUER = "Nekomata",
  TOTP_ICON_URL = "",
  MFA_ENROLLMENT_TTL_MS: MFA_ENROLLMENT_TTL_MS_ENV = "",
  ADMIN_EXPORTS_DIR = "",
  ADMIN_EXPORT_TTL_HOURS: ADMIN_EXPORT_TTL_HOURS_ENV = "",
  METRICS_ENABLED: METRICS_ENABLED_ENV = "false",
  METRICS_TOKEN = "",
  PORT = 8080,
  OWNER_IDS: OWNER_IDS_ENV = "",
  BOOTSTRAP_TOKEN,
  ANALYTICS_IP_SALT = "",
  ANALYTICS_RETENTION_DAYS: ANALYTICS_RETENTION_DAYS_ENV = "",
  ANALYTICS_AGG_RETENTION_DAYS: ANALYTICS_AGG_RETENTION_DAYS_ENV = "",
  AUTO_UPLOAD_REORGANIZE = "true",
  AUTO_UPLOAD_REORGANIZE_ON_STARTUP: AUTO_UPLOAD_REORGANIZE_ON_STARTUP_ENV = "false",
  RBAC_V2_ENABLED: RBAC_V2_ENABLED_ENV = "false",
  RBAC_V2_ACCEPT_LEGACY_STAR: RBAC_V2_ACCEPT_LEGACY_STAR_ENV = "true",
  OPS_ALERTS_WEBHOOK_ENABLED: OPS_ALERTS_WEBHOOK_ENABLED_ENV = "false",
  OPS_ALERTS_WEBHOOK_PROVIDER: OPS_ALERTS_WEBHOOK_PROVIDER_ENV = "discord",
  OPS_ALERTS_WEBHOOK_URL: OPS_ALERTS_WEBHOOK_URL_ENV = "",
  OPS_ALERTS_WEBHOOK_TIMEOUT_MS: OPS_ALERTS_WEBHOOK_TIMEOUT_MS_ENV = "",
  OPS_ALERTS_WEBHOOK_INTERVAL_MS: OPS_ALERTS_WEBHOOK_INTERVAL_MS_ENV = "",
  OPS_ALERTS_DB_LATENCY_WARNING_MS: OPS_ALERTS_DB_LATENCY_WARNING_MS_ENV = "",
  RATE_LIMIT_PREFIX: RATE_LIMIT_PREFIX_ENV = "nekomorto:rate_limit",
  IDEMPOTENCY_TTL_MS: IDEMPOTENCY_TTL_MS_ENV = "",
  PUBLIC_READ_CACHE_TTL_MS: PUBLIC_READ_CACHE_TTL_MS_ENV = "",
  PUBLIC_READ_CACHE_MAX_ENTRIES: PUBLIC_READ_CACHE_MAX_ENTRIES_ENV = "",
  ANALYTICS_COMPACTION_INTERVAL_MS: ANALYTICS_COMPACTION_INTERVAL_MS_ENV = "",
  VITE_PWA_DEV_ENABLED: VITE_PWA_DEV_ENABLED_ENV = "false",
  HOME_HERO_SHELL_ENABLED: HOME_HERO_SHELL_ENABLED_ENV = "true",
} = process.env;

const isProduction = process.env.NODE_ENV === "production";
const isMaintenanceMode = isTruthyEnv(MAINTENANCE_MODE_ENV, false);
const isRbacV2Enabled = isTruthyEnv(RBAC_V2_ENABLED_ENV, false);
const isRbacV2AcceptLegacyStar = isTruthyEnv(RBAC_V2_ACCEPT_LEGACY_STAR_ENV, true);
const isAutoUploadReorganizationEnabled = !["0", "false", "no", "off"].includes(
  String(AUTO_UPLOAD_REORGANIZE || "")
    .trim()
    .toLowerCase(),
);
const isAutoUploadReorganizationOnStartupEnabled = isTruthyEnv(
  AUTO_UPLOAD_REORGANIZE_ON_STARTUP_ENV,
  false,
);
const isOpsAlertsWebhookEnabled = isTruthyEnv(OPS_ALERTS_WEBHOOK_ENABLED_ENV, false);
const isMetricsEnabled = isTruthyEnv(METRICS_ENABLED_ENV, false);
const isPwaDevEnabled = VITE_PWA_DEV_ENABLED_ENV === "true";
const isHomeHeroShellEnabled = isTruthyEnv(HOME_HERO_SHELL_ENABLED_ENV, true);
const MFA_ENROLLMENT_TTL_MS = Number.isFinite(Number(MFA_ENROLLMENT_TTL_MS_ENV))
  ? Math.min(Math.max(Math.floor(Number(MFA_ENROLLMENT_TTL_MS_ENV)), 60_000), 24 * 60 * 60 * 1000)
  : 10 * 60 * 1000;
const ADMIN_EXPORT_TTL_HOURS = Number.isFinite(Number(ADMIN_EXPORT_TTL_HOURS_ENV))
  ? Math.min(Math.max(Math.floor(Number(ADMIN_EXPORT_TTL_HOURS_ENV)), 1), 7 * 24)
  : 24;
const OWNER_IDS = (OWNER_IDS_ENV || (isProduction ? "" : "380305493391966208"))
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const originConfig = buildOriginConfig({
  appOriginEnv: APP_ORIGIN,
  adminOriginsEnv: ADMIN_ORIGINS,
  discordRedirectUriEnv: DISCORD_REDIRECT_URI,
  isProduction,
});
const ALLOWED_ORIGINS = originConfig.allowedOrigins;
const PRIMARY_APP_ORIGIN = originConfig.primaryAppOrigin;
const PRIMARY_APP_HOST = originConfig.primaryAppHost;
const CONFIGURED_DISCORD_REDIRECT_URI = originConfig.configuredDiscordRedirectUri;
const OPS_ALERTS_WEBHOOK_PROVIDER =
  String(OPS_ALERTS_WEBHOOK_PROVIDER_ENV || "discord")
    .trim()
    .toLowerCase() || "discord";
const OPS_ALERTS_WEBHOOK_URL = String(OPS_ALERTS_WEBHOOK_URL_ENV || "").trim();
const REPO_ROOT_DIR = path.join(__dirname, "..");
const adminExportsDir = path.resolve(
  REPO_ROOT_DIR,
  String(ADMIN_EXPORTS_DIR || "").trim() || path.join("backups", "admin-exports"),
);
const epubImportJobsDir = path.resolve(REPO_ROOT_DIR, path.join("backups", "epub-import-jobs"));
const projectImageImportJobsDir = path.resolve(
  REPO_ROOT_DIR,
  path.join("backups", "project-image-import-jobs"),
);
const projectImageExportJobsDir = path.resolve(
  REPO_ROOT_DIR,
  path.join("backups", "project-image-export-jobs"),
);
const sessionSecretList = resolveSessionSecrets({
  sessionSecretsEnv: SESSION_SECRETS,
  sessionSecretFallback: SESSION_SECRET,
});
const dataEncryptionKeyring = parseDataEncryptionKeyring({
  dataEncryptionKeysJson: DATA_ENCRYPTION_KEYS_JSON,
  legacySecret: sessionSecretList[0] || SESSION_SECRET || "",
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
const sessionCookieConfig = buildSessionCookieConfig({
  isProduction,
  cookieBaseName: "rainbow.sid",
  sessionSecret: SESSION_SECRET,
  sessionSecrets: sessionSecretList.join(","),
});
const MFA_RECOVERY_CODE_PEPPER = String(SECURITY_RECOVERY_CODE_PEPPER || "").trim();
const MFA_ICON_URL = String(TOTP_ICON_URL || "").trim();
const AUTH_FAILED_BURST_WARNING = Object.freeze({ threshold: 8, windowMs: 5 * 60 * 1000 });
const AUTH_FAILED_BURST_CRITICAL = Object.freeze({ threshold: 20, windowMs: 15 * 60 * 1000 });
const MFA_FAILED_BURST_WARNING = Object.freeze({ threshold: 5, windowMs: 10 * 60 * 1000 });
const EXCESSIVE_SESSIONS_WARNING = 7;
const NEW_NETWORK_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_EXPORT_MAX_ROWS = 25_000;
const METRICS_TOKEN_NORMALIZED = String(METRICS_TOKEN || "").trim();
const SESSION_INDEX_TOUCH_MIN_INTERVAL_MS = 30 * 1000;
const sessionIndexTouchTsBySid = new Map();

const AUTO_REORGANIZE_TRIGGER_TO_ACTION = {
  startup: "uploads.auto_reorganize.startup",
  "post-save": "uploads.auto_reorganize.post_save",
  "project-save": "uploads.auto_reorganize.project_save",
};

let autoUploadReorganizationInFlight = null;
const pendingAutoReorganizationTriggers = new Set();

const createSystemAuditReq = () => ({
  headers: {},
  ip: "127.0.0.1",
  session: {
    user: {
      id: "system",
      name: "System",
    },
  },
  requestId: `auto-reorg-${crypto.randomUUID()}`,
});

const normalizeAutoReorganizationTrigger = (value) =>
  value === "startup" || value === "post-save" || value === "project-save" ? value : "post-save";

const buildAutoReorganizationMeta = ({ trigger, report, durationMs, error }) => ({
  trigger,
  moves: Number(report?.appliedMovesCount || 0),
  rewrites: Number(report?.totalRewrites || 0),
  failures: Number(report?.moveFailuresCount || 0) + (error ? 1 : 0),
  durationMs: Number(durationMs || 0),
  ...(error ? { error: String(error?.message || error) } : {}),
});

const runAutoUploadReorganization = async ({ trigger, req } = {}) => {
  if (!isAutoUploadReorganizationEnabled) {
    return { ok: false, skipped: true, reason: "disabled" };
  }

  const normalizedTrigger = normalizeAutoReorganizationTrigger(trigger);
  pendingAutoReorganizationTriggers.add(normalizedTrigger);

  if (autoUploadReorganizationInFlight) {
    return autoUploadReorganizationInFlight;
  }

  const runner = async () => {
    let latestResult = { ok: true, skipped: true };
    while (pendingAutoReorganizationTriggers.size > 0) {
      const batch = Array.from(pendingAutoReorganizationTriggers);
      pendingAutoReorganizationTriggers.clear();
      const triggerForRun = batch.includes("startup")
        ? "startup"
        : batch.includes("project-save")
          ? "project-save"
          : "post-save";
      const startedAt = Date.now();
      try {
        const datasets = {
          posts: loadPosts(),
          projects: loadProjects(),
          users: loadUsers(),
          comments: loadComments(),
          updates: loadUpdates(),
          pages: loadPages(),
          siteSettings: loadSiteSettings(),
          uploads: loadUploads(),
        };
        const report = runUploadsReorganization({
          datasets,
          uploadsDir: path.join(REPO_ROOT_DIR, "public", "uploads"),
          applyChanges: true,
        });
        const changedDatasets = new Set(
          Array.isArray(report?.changedDatasets) ? report.changedDatasets : [],
        );
        if (changedDatasets.has("posts")) {
          writePosts(report.rewritten.posts);
        }
        if (changedDatasets.has("projects")) {
          writeProjects(report.rewritten.projects);
        }
        if (changedDatasets.has("users")) {
          writeUsers(report.rewritten.users);
        }
        if (changedDatasets.has("comments")) {
          writeComments(report.rewritten.comments);
        }
        if (changedDatasets.has("updates")) {
          writeUpdates(report.rewritten.updates);
        }
        if (changedDatasets.has("pages")) {
          writePages(report.rewritten.pages);
        }
        if (changedDatasets.has("siteSettings")) {
          writeSiteSettings(report.rewritten.siteSettings);
        }
        if (changedDatasets.has("uploads")) {
          writeUploads(report.rewritten.uploads);
        }
        const durationMs = Date.now() - startedAt;
        const action = AUTO_REORGANIZE_TRIGGER_TO_ACTION[triggerForRun];
        appendAuditLog(
          req || createSystemAuditReq(),
          action,
          "uploads",
          buildAutoReorganizationMeta({
            trigger: triggerForRun,
            report,
            durationMs,
          }),
        );
        latestResult = { ok: true, trigger: triggerForRun, report, durationMs };
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        appendAuditLog(
          req || createSystemAuditReq(),
          "uploads.auto_reorganize.failed",
          "uploads",
          buildAutoReorganizationMeta({
            trigger: triggerForRun,
            durationMs,
            error,
          }),
        );
        latestResult = { ok: false, trigger: triggerForRun, error, durationMs };
      }
    }
    return latestResult;
  };

  autoUploadReorganizationInFlight = runner().finally(() => {
    autoUploadReorganizationInFlight = null;
  });

  return autoUploadReorganizationInFlight;
};

const parseEnvInteger = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(parsed), min), max);
};

const OPS_ALERTS_WEBHOOK_TIMEOUT_MS = parseEnvInteger(
  OPS_ALERTS_WEBHOOK_TIMEOUT_MS_ENV,
  5000,
  1000,
  30000,
);
const OPS_ALERTS_WEBHOOK_INTERVAL_MS = parseEnvInteger(
  OPS_ALERTS_WEBHOOK_INTERVAL_MS_ENV,
  60000,
  10000,
  3600000,
);
const OPS_ALERTS_DB_LATENCY_WARNING_MS = parseEnvInteger(
  OPS_ALERTS_DB_LATENCY_WARNING_MS_ENV,
  1000,
  50,
  60000,
);
const RATE_LIMIT_PREFIX =
  String(RATE_LIMIT_PREFIX_ENV || "nekomorto:rate_limit").trim() || "nekomorto:rate_limit";
const IDEMPOTENCY_TTL_MS = parseEnvInteger(
  IDEMPOTENCY_TTL_MS_ENV,
  24 * 60 * 60 * 1000,
  1000,
  7 * 24 * 60 * 60 * 1000,
);
const PUBLIC_READ_CACHE_TTL_MS = parseEnvInteger(PUBLIC_READ_CACHE_TTL_MS_ENV, 30000, 250, 300000);
const PUBLIC_READ_CACHE_MAX_ENTRIES = parseEnvInteger(
  PUBLIC_READ_CACHE_MAX_ENTRIES_ENV,
  4000,
  100,
  50000,
);
const ANALYTICS_COMPACTION_INTERVAL_MS = parseEnvInteger(
  ANALYTICS_COMPACTION_INTERVAL_MS_ENV,
  30 * 60 * 1000,
  60 * 1000,
  24 * 60 * 60 * 1000,
);

const ANALYTICS_SCHEMA_VERSION = 1;
const ANALYTICS_RETENTION_DAYS = parseEnvInteger(ANALYTICS_RETENTION_DAYS_ENV, 90, 7, 3650);
const ANALYTICS_AGG_RETENTION_DAYS = parseEnvInteger(
  ANALYTICS_AGG_RETENTION_DAYS_ENV,
  365,
  30,
  3650,
);
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

dataRepository = await createDataRepository({
  databaseUrl: DATABASE_URL,
  ownerIdsFallback: OWNER_IDS,
  analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
  analyticsRetentionDays: ANALYTICS_RETENTION_DAYS,
  analyticsAggRetentionDays: ANALYTICS_AGG_RETENTION_DAYS,
});

const getRequestIp = (req) => req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "";

const serializeQueryForCache = (query) => {
  if (!query || typeof query !== "object") {
    return "";
  }
  const params = [];
  Object.keys(query)
    .sort((a, b) => a.localeCompare(b, "en"))
    .forEach((key) => {
      const value = query[key];
      if (Array.isArray(value)) {
        value.forEach((item) => {
          params.push([key, String(item)]);
        });
        return;
      }
      if (value === undefined) {
        return;
      }
      params.push([key, String(value)]);
    });
  if (params.length === 0) {
    return "";
  }
  return params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
};

const buildPublicReadCacheKey = (req) => {
  const pathName = String(req.path || req.originalUrl || "").split("?")[0] || "/";
  const queryText = serializeQueryForCache(req.query);
  if (!queryText) {
    return pathName;
  }
  return `${pathName}?${queryText}`;
};

const readPublicCachedJson = (req) => {
  const cacheKey = buildPublicReadCacheKey(req);
  const cached = publicReadCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  return {
    cacheKey,
    payload: cached.payload,
    statusCode: Number(cached.statusCode || 200),
  };
};

const writePublicCachedJson = (req, payload, { statusCode = 200, ttlMs, tags = [] } = {}) => {
  const cacheKey = buildPublicReadCacheKey(req);
  publicReadCache.set(
    cacheKey,
    {
      payload,
      statusCode: Number(statusCode) || 200,
    },
    {
      ttlMs,
      tags,
    },
  );
  return cacheKey;
};

const invalidatePublicReadCacheTags = (tags) => {
  publicReadCache.invalidateTags(tags);
};

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

const clientRootDir = path.join(__dirname, "..");
const clientDistDir = path.join(clientRootDir, "dist");
const clientIndexPath = resolveClientIndexPath({
  clientRootDir,
  clientDistDir,
  isProduction,
});
const httpServer = createHttpServer(app);
const viteDevServer = await createViteDevServer({ isProduction, httpServer });
const getIndexHtml = createIndexHtmlLoader({
  fs,
  clientIndexPath,
  isProduction,
});
const toAbsoluteUrl = createAbsoluteUrlResolver({
  origin: PRIMARY_APP_ORIGIN,
});
const MAX_SVG_SIZE_BYTES = 256 * 1024;
const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_DIMENSION = 8192;
const MAX_UPLOAD_IMAGE_PIXELS = 33_554_432;
const ALLOWED_UPLOAD_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);
const UPLOAD_EXTENSION_TO_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};
const UPLOAD_MIME_TO_EXTENSION = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const DEFAULT_AVATAR_DISPLAY = {
  x: 0,
  y: 0,
  zoom: 1,
  rotation: 0,
};
const sanitizeUploadFolder = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value
    .trim()
    .replace(/[^a-z0-9/_-]+/gi, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\//, "");
};
const sanitizeUploadBaseName = (value) =>
  String(value || "upload")
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const sanitizeUploadSlot = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const normalizeAvatarDisplay = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const x = Number(source.x);
  const y = Number(source.y);
  const zoom = Number(source.zoom);
  const rotation = Number(source.rotation);
  return {
    x: Number.isFinite(x) ? x : DEFAULT_AVATAR_DISPLAY.x,
    y: Number.isFinite(y) ? y : DEFAULT_AVATAR_DISPLAY.y,
    zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : DEFAULT_AVATAR_DISPLAY.zoom,
    rotation: Number.isFinite(rotation) ? rotation : DEFAULT_AVATAR_DISPLAY.rotation,
  };
};
const isSupportedUploadImageMime = (value) =>
  ALLOWED_UPLOAD_IMAGE_MIMES.has(String(value || "").toLowerCase());
const getUploadExtFromMime = (value) =>
  UPLOAD_MIME_TO_EXTENSION[String(value || "").toLowerCase()] || "png";
const getUploadMimeFromExtension = (value) =>
  UPLOAD_EXTENSION_TO_MIME[String(value || "").toLowerCase()] || "";
const normalizeUploadMime = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized;
};
const readUInt24LE = (buffer, offset) =>
  buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
const detectUploadImageMimeFromBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return "";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6) {
    const header = buffer.toString("ascii", 0, 6);
    if (header === "GIF87a" || header === "GIF89a") {
      return "image/gif";
    }
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  const snippet = buffer.toString("utf-8", 0, Math.min(buffer.length, 4096)).replace(/^\uFEFF/, "");
  if (/<svg[\s>]/i.test(snippet)) {
    return "image/svg+xml";
  }
  return "";
};
const getPngDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) {
    return null;
  }
  if (
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47 ||
    buffer[4] !== 0x0d ||
    buffer[5] !== 0x0a ||
    buffer[6] !== 0x1a ||
    buffer[7] !== 0x0a
  ) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};
const getGifDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10) {
    return null;
  }
  const header = buffer.toString("ascii", 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") {
    return null;
  }
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
};
const getJpegDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    if (offset + 4 > buffer.length) {
      break;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      break;
    }
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 9 >= buffer.length) {
        break;
      }
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
};
const getWebpDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > buffer.length) {
      break;
    }
    if (chunkType === "VP8X" && chunkSize >= 10) {
      return {
        width: 1 + readUInt24LE(buffer, dataOffset + 4),
        height: 1 + readUInt24LE(buffer, dataOffset + 7),
      };
    }
    if (chunkType === "VP8L" && chunkSize >= 5) {
      if (buffer[dataOffset] !== 0x2f) {
        return null;
      }
      const b0 = buffer[dataOffset + 1];
      const b1 = buffer[dataOffset + 2];
      const b2 = buffer[dataOffset + 3];
      const b3 = buffer[dataOffset + 4];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
    if (chunkType === "VP8 " && chunkSize >= 10) {
      if (
        buffer[dataOffset + 3] !== 0x9d ||
        buffer[dataOffset + 4] !== 0x01 ||
        buffer[dataOffset + 5] !== 0x2a
      ) {
        return null;
      }
      return {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  return null;
};
const getUploadImageDimensions = (buffer, mime) => {
  const normalizedMime = normalizeUploadMime(mime);
  if (normalizedMime === "image/png") {
    return getPngDimensions(buffer);
  }
  if (normalizedMime === "image/jpeg") {
    return getJpegDimensions(buffer);
  }
  if (normalizedMime === "image/gif") {
    return getGifDimensions(buffer);
  }
  if (normalizedMime === "image/webp") {
    return getWebpDimensions(buffer);
  }
  return null;
};
const validateUploadImageBuffer = (buffer, requestedMime, options = {}) => {
  const strictRequestedMime = options.strictRequestedMime === true;
  const normalizedRequested = normalizeUploadMime(requestedMime);
  const detectedMime = detectUploadImageMimeFromBuffer(buffer);
  if (
    strictRequestedMime &&
    detectedMime &&
    normalizedRequested &&
    detectedMime !== normalizedRequested
  ) {
    return { valid: false, error: "mime_mismatch" };
  }
  const mime = detectedMime || normalizedRequested;
  if (!isSupportedUploadImageMime(mime)) {
    return { valid: false, error: "unsupported_image_type" };
  }
  if (mime === "image/svg+xml") {
    return { valid: true, mime, dimensions: null };
  }
  const dimensions = getUploadImageDimensions(buffer, mime);
  if (!dimensions) {
    return { valid: false, error: "invalid_image_data" };
  }
  const width = Number(dimensions.width);
  const height = Number(dimensions.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { valid: false, error: "invalid_image_dimensions" };
  }
  if (width > MAX_UPLOAD_IMAGE_DIMENSION || height > MAX_UPLOAD_IMAGE_DIMENSION) {
    return { valid: false, error: "image_dimensions_too_large" };
  }
  if (width * height > MAX_UPLOAD_IMAGE_PIXELS) {
    return { valid: false, error: "image_pixel_count_too_large" };
  }
  return {
    valid: true,
    mime,
    dimensions: {
      width,
      height,
    },
  };
};
const resolveDiscordRedirectUri = (req) => {
  return resolveDiscordRedirectUriByConfig({
    req,
    configuredDiscordRedirectUri: CONFIGURED_DISCORD_REDIRECT_URI,
    primaryAppOrigin: PRIMARY_APP_ORIGIN,
    isAllowedOriginFn: isAllowedOrigin,
  });
};
const isAllowedOrigin = (origin) => {
  return isAllowedOriginByConfig({
    origin,
    allowedOrigins: ALLOWED_ORIGINS,
    isProduction,
  });
};

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

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeDashboardWidgetsPreference = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  const dedupe = new Set();
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item) => DASHBOARD_WIDGET_IDS.has(item))
    .filter((item) => {
      if (dedupe.has(item)) {
        return false;
      }
      dedupe.add(item);
      return true;
    })
    .slice(0, 20);
};

const normalizeDashboardHomeByRolePreference = (value) => {
  if (!isPlainObject(value)) {
    return {};
  }
  const normalized = {};
  Array.from(DASHBOARD_HOME_ROLE_IDS).forEach((roleId) => {
    const roleInput = value[roleId];
    const widgets = normalizeDashboardWidgetsPreference(roleInput?.widgets);
    if (widgets.length > 0) {
      normalized[roleId] = { widgets };
    }
  });
  return normalized;
};

const normalizeDashboardNotificationsPreference = (value) => {
  if (!isPlainObject(value)) {
    return {};
  }
  const normalized = {};
  const lastSeenAtRaw = String(value.lastSeenAt || "").trim();
  if (lastSeenAtRaw) {
    const parsedTs = new Date(lastSeenAtRaw).getTime();
    if (Number.isFinite(parsedTs)) {
      normalized.lastSeenAt = new Date(parsedTs).toISOString();
    }
  }
  return normalized;
};

const normalizeUserPreferences = (value) => {
  if (!isPlainObject(value)) {
    return {};
  }
  const normalized = {};
  const themeMode = String(value.themeMode || "")
    .trim()
    .toLowerCase();
  if (USER_PREFERENCES_THEME_MODE_SET.has(themeMode)) {
    normalized.themeMode = themeMode;
  }
  const density = String(value.density || "")
    .trim()
    .toLowerCase();
  if (USER_PREFERENCES_DENSITY_SET.has(density)) {
    normalized.density = density;
  }
  const dashboardInput = isPlainObject(value.dashboard) ? value.dashboard : null;
  if (dashboardInput) {
    const dashboard = {};
    const homeByRole = normalizeDashboardHomeByRolePreference(dashboardInput.homeByRole);
    if (Object.keys(homeByRole).length > 0) {
      dashboard.homeByRole = homeByRole;
    }
    const notifications = normalizeDashboardNotificationsPreference(dashboardInput.notifications);
    if (Object.keys(notifications).length > 0) {
      dashboard.notifications = notifications;
    }
    if (Object.keys(dashboard).length > 0) {
      normalized.dashboard = dashboard;
    }
  }
  const readerInput = isPlainObject(value.reader) ? value.reader : null;
  if (readerInput) {
    const reader = normalizeProjectReaderPreferences(readerInput);
    if (Object.keys(reader).length > 0) {
      normalized.reader = reader;
    }
  }
  return normalized;
};

const loadUserPreferences = (userId) => {
  const normalizedId = String(userId || "").trim();
  if (!normalizedId || !dataRepository) {
    return {};
  }
  const parsed = dataRepository.loadUserPreferences(normalizedId);
  const normalized = normalizeUserPreferences(parsed);
  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    dataRepository.writeUserPreferences(normalizedId, normalized);
  }
  return normalized;
};

const writeUserPreferences = (userId, preferences) => {
  const normalizedId = String(userId || "").trim();
  if (!normalizedId || !dataRepository) {
    return {};
  }
  const normalized = normalizeUserPreferences(preferences);
  dataRepository.writeUserPreferences(normalizedId, normalized);
  return normalized;
};

const parseEditRevisionOptions = (value) => {
  if (!isPlainObject(value)) {
    return { ifRevision: "", forceOverride: false };
  }
  return {
    ifRevision: String(value.ifRevision || "").trim(),
    forceOverride: value.forceOverride === true,
  };
};

const ensureNoEditConflict = () => true;

const loadUserMfaTotpRecord = (userId) => {
  const normalizedId = String(userId || "").trim();
  if (
    !normalizedId ||
    !dataRepository ||
    typeof dataRepository.loadUserMfaTotpRecord !== "function"
  ) {
    return null;
  }
  return dataRepository.loadUserMfaTotpRecord(normalizedId);
};

const writeUserMfaTotpRecord = (userId, record) => {
  const normalizedId = String(userId || "").trim();
  if (
    !normalizedId ||
    !dataRepository ||
    typeof dataRepository.writeUserMfaTotpRecord !== "function"
  ) {
    return null;
  }
  dataRepository.writeUserMfaTotpRecord(normalizedId, record);
  return loadUserMfaTotpRecord(normalizedId);
};

const deleteUserMfaTotpRecord = (userId) => {
  const normalizedId = String(userId || "").trim();
  if (
    !normalizedId ||
    !dataRepository ||
    typeof dataRepository.deleteUserMfaTotpRecord !== "function"
  ) {
    return;
  }
  dataRepository.deleteUserMfaTotpRecord(normalizedId);
};

const isTotpEnabledForUser = (userId) => {
  const record = loadUserMfaTotpRecord(userId);
  return Boolean(record && record.enabledAt && !record.disabledAt && record.secretEncrypted);
};

const getUserTotpSecret = (userId) => {
  const record = loadUserMfaTotpRecord(userId);
  if (!record || !record.secretEncrypted || record.disabledAt) {
    return null;
  }
  const decrypted = decryptStringWithKeyring({
    keyring: dataEncryptionKeyring,
    payload: record.secretEncrypted,
  });
  if (!decrypted) {
    return null;
  }
  try {
    const parsed = JSON.parse(decrypted);
    const secret = String(parsed?.secret || "")
      .trim()
      .toUpperCase();
    if (!secret) {
      return null;
    }
    return secret;
  } catch {
    return null;
  }
};

const loadUserSessionIndexRecords = ({ userId = null, includeRevoked = true } = {}) => {
  if (!dataRepository || typeof dataRepository.loadUserSessionIndexRecords !== "function") {
    return [];
  }
  return dataRepository.loadUserSessionIndexRecords({ userId, includeRevoked });
};

const upsertUserSessionIndexRecord = (record) => {
  if (!dataRepository || typeof dataRepository.upsertUserSessionIndexRecord !== "function") {
    return;
  }
  dataRepository.upsertUserSessionIndexRecord(record);
};

const revokeUserSessionIndexRecord = (sid, options = {}) => {
  if (!dataRepository || typeof dataRepository.revokeUserSessionIndexRecord !== "function") {
    return;
  }
  dataRepository.revokeUserSessionIndexRecord(sid, options);
};

const removeUserSessionIndexRecord = (sid) => {
  if (!dataRepository || typeof dataRepository.removeUserSessionIndexRecord !== "function") {
    return;
  }
  dataRepository.removeUserSessionIndexRecord(sid);
};

const loadSecurityEvents = () => {
  if (!dataRepository || typeof dataRepository.loadSecurityEvents !== "function") {
    return [];
  }
  return dataRepository.loadSecurityEvents();
};

const upsertSecurityEvent = (event) => {
  if (!dataRepository || typeof dataRepository.upsertSecurityEvent !== "function") {
    return null;
  }
  return dataRepository.upsertSecurityEvent(event);
};

const loadAdminExportJobs = () => {
  if (!dataRepository || typeof dataRepository.loadAdminExportJobs !== "function") {
    return [];
  }
  return dataRepository.loadAdminExportJobs();
};

const upsertAdminExportJob = (job) => {
  if (!dataRepository || typeof dataRepository.upsertAdminExportJob !== "function") {
    return null;
  }
  return dataRepository.upsertAdminExportJob(job);
};

const loadWebhookDeliveries = () => {
  if (!dataRepository || typeof dataRepository.loadWebhookDeliveries !== "function") {
    return [];
  }
  return dataRepository.loadWebhookDeliveries();
};

const findWebhookDelivery = (id) => {
  if (!dataRepository || typeof dataRepository.findWebhookDelivery !== "function") {
    return null;
  }
  return dataRepository.findWebhookDelivery(id);
};

const upsertWebhookDelivery = (delivery) => {
  if (!dataRepository || typeof dataRepository.upsertWebhookDelivery !== "function") {
    return null;
  }
  return dataRepository.upsertWebhookDelivery(delivery);
};

const claimWebhookDelivery = async (options) => {
  if (!dataRepository || typeof dataRepository.claimWebhookDelivery !== "function") {
    return null;
  }
  return dataRepository.claimWebhookDelivery(options);
};

const loadWebhookState = (key) => {
  if (!dataRepository || typeof dataRepository.loadWebhookState !== "function") {
    return null;
  }
  return dataRepository.loadWebhookState(key);
};

const writeWebhookState = (key, data) => {
  if (!dataRepository || typeof dataRepository.writeWebhookState !== "function") {
    return null;
  }
  return dataRepository.writeWebhookState(key, data);
};

const loadEpubImportJobs = () => {
  if (!dataRepository || typeof dataRepository.loadEpubImportJobs !== "function") {
    return [];
  }
  return dataRepository.loadEpubImportJobs();
};

const isEpubImportJobStorageAvailable = () => {
  if (!dataRepository || typeof dataRepository.isEpubImportJobStorageAvailable !== "function") {
    return false;
  }
  return dataRepository.isEpubImportJobStorageAvailable();
};

const upsertEpubImportJob = (job) => {
  if (!dataRepository || typeof dataRepository.upsertEpubImportJob !== "function") {
    return null;
  }
  return dataRepository.upsertEpubImportJob(job);
};

const loadProjectImageImportJobs = () => {
  if (!dataRepository || typeof dataRepository.loadProjectImageImportJobs !== "function") {
    return [];
  }
  return dataRepository.loadProjectImageImportJobs();
};

const isProjectImageImportJobStorageAvailable = () => {
  if (
    !dataRepository ||
    typeof dataRepository.isProjectImageImportJobStorageAvailable !== "function"
  ) {
    return false;
  }
  return dataRepository.isProjectImageImportJobStorageAvailable();
};

const upsertProjectImageImportJob = (job) => {
  if (!dataRepository || typeof dataRepository.upsertProjectImageImportJob !== "function") {
    return null;
  }
  return dataRepository.upsertProjectImageImportJob(job);
};

const loadProjectImageExportJobs = () => {
  if (!dataRepository || typeof dataRepository.loadProjectImageExportJobs !== "function") {
    return [];
  }
  return dataRepository.loadProjectImageExportJobs();
};

const isProjectImageExportJobStorageAvailable = () => {
  if (
    !dataRepository ||
    typeof dataRepository.isProjectImageExportJobStorageAvailable !== "function"
  ) {
    return false;
  }
  return dataRepository.isProjectImageExportJobStorageAvailable();
};

const upsertProjectImageExportJob = (job) => {
  if (!dataRepository || typeof dataRepository.upsertProjectImageExportJob !== "function") {
    return null;
  }
  return dataRepository.upsertProjectImageExportJob(job);
};

const loadSecretRotations = () => {
  if (!dataRepository || typeof dataRepository.loadSecretRotations !== "function") {
    return [];
  }
  return dataRepository.loadSecretRotations();
};

const appendSecretRotation = (entry) => {
  if (!dataRepository || typeof dataRepository.appendSecretRotation !== "function") {
    return null;
  }
  return dataRepository.appendSecretRotation(entry);
};

const listActiveSessionsForUser = (userId) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return [];
  }
  return loadUserSessionIndexRecords({ userId: normalizedUserId, includeRevoked: false })
    .filter((item) => !item.revokedAt)
    .sort((a, b) => new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime());
};

const destroySessionBySid = (sid) =>
  new Promise((resolve) => {
    try {
      sessionStore.destroy(String(sid || ""), () => resolve());
    } catch {
      resolve();
    }
  });

const revokeSessionBySid = async ({
  sid,
  revokedBy = null,
  revokeReason = "manual_revoke",
} = {}) => {
  const normalizedSid = String(sid || "").trim();
  if (!normalizedSid) {
    return false;
  }
  await destroySessionBySid(normalizedSid);
  revokeUserSessionIndexRecord(normalizedSid, {
    revokedBy: revokedBy ? String(revokedBy) : null,
    revokeReason: String(revokeReason || "manual_revoke"),
  });
  metricsRegistry.inc("active_sessions_total", {}, -1);
  return true;
};

const resolveRecoveryCodesRemaining = (record) => {
  const list = Array.isArray(record?.recoveryCodesHashed) ? record.recoveryCodesHashed : [];
  return list.filter((item) => typeof item === "string" && item.trim()).length;
};

const verifyTotpOrRecoveryCode = ({
  userId,
  codeOrRecoveryCode,
  consumeRecoveryCode = true,
} = {}) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return { ok: false, reason: "invalid_user" };
  }
  const code = String(codeOrRecoveryCode || "").trim();
  if (!code) {
    return { ok: false, reason: "code_required" };
  }

  const secret = getUserTotpSecret(normalizedUserId);
  if (secret && verifyTotpCode({ secret, code })) {
    return {
      ok: true,
      method: "totp",
      remainingRecoveryCodes: resolveRecoveryCodesRemaining(
        loadUserMfaTotpRecord(normalizedUserId),
      ),
    };
  }

  const record = loadUserMfaTotpRecord(normalizedUserId);
  if (!record) {
    return { ok: false, reason: "mfa_not_enabled" };
  }
  const hashes = Array.isArray(record.recoveryCodesHashed) ? record.recoveryCodesHashed : [];
  const targetHash = hashRecoveryCode({ code, pepper: MFA_RECOVERY_CODE_PEPPER });
  if (!targetHash) {
    return { ok: false, reason: "invalid_code" };
  }
  const index = hashes.findIndex((item) => item === targetHash);
  if (index < 0) {
    return { ok: false, reason: "invalid_code" };
  }

  const remainingHashes = consumeRecoveryCode
    ? hashes.filter((item, itemIndex) => itemIndex !== index)
    : hashes;
  if (consumeRecoveryCode) {
    writeUserMfaTotpRecord(normalizedUserId, {
      ...record,
      recoveryCodesHashed: remainingHashes,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    ok: true,
    method: "recovery_code",
    remainingRecoveryCodes: remainingHashes.length,
  };
};

const toAbsoluteAssetUrl = (value) => {
  const normalized = sanitizeAssetUrl(value);
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("/")) {
    return `${PRIMARY_APP_ORIGIN}${normalized}`;
  }
  return normalized;
};

const resolveMfaMetadata = ({ req, userId, accountName } = {}) => {
  const normalizedUserId = String(userId || "").trim();
  const sessionUser = req?.session?.user || req?.session?.pendingMfaUser || null;
  const issuer = String(MFA_ISSUER || "Nekomata").trim() || "Nekomata";
  const accountLabel =
    String(
      accountName || sessionUser?.username || sessionUser?.name || normalizedUserId || "user",
    ).trim() || "user";
  const siteSettings = loadSiteSettings();
  const iconUrl = toAbsoluteAssetUrl(
    sessionUser?.avatarUrl || MFA_ICON_URL || siteSettings?.site?.faviconUrl || "",
  );
  return {
    issuer,
    accountLabel,
    iconUrl,
  };
};

const startTotpEnrollment = ({ req, userId, accountName, issuer, iconUrl } = {}) => {
  if (!req?.session || !userId) {
    return null;
  }
  const secret = generateTotpSecret();
  const enrollmentToken = crypto.randomUUID();
  req.session.mfaEnrollment = {
    token: enrollmentToken,
    secret,
    userId: String(userId),
    createdAt: Date.now(),
    accountName: String(accountName || userId),
    issuer: String(issuer || MFA_ISSUER || "Nekomata"),
    iconUrl: String(iconUrl || ""),
  };
  return {
    enrollmentToken,
    secret,
    otpauthUrl: buildOtpAuthUrl({
      issuer: String(issuer || MFA_ISSUER || "Nekomata"),
      accountName: String(accountName || userId),
      secret,
      iconUrl: String(iconUrl || ""),
    }),
  };
};

const resolveEnrollmentFromSession = ({ req, enrollmentToken, userId } = {}) => {
  const stored = req?.session?.mfaEnrollment;
  if (!stored || typeof stored !== "object") {
    return null;
  }
  if (String(stored.userId || "") !== String(userId || "")) {
    return null;
  }
  if (String(stored.token || "") !== String(enrollmentToken || "")) {
    return null;
  }
  const createdAt = Number(stored.createdAt || 0);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > MFA_ENROLLMENT_TTL_MS) {
    return null;
  }
  return stored;
};

const clearEnrollmentFromSession = (req) => {
  if (!req?.session) {
    return;
  }
  req.session.mfaEnrollment = null;
};

const buildMySecuritySummary = ({ req, userId } = {}) => {
  const record = loadUserMfaTotpRecord(userId);
  const activeSessions = listActiveSessionsForUser(userId);
  const metadata = resolveMfaMetadata({ req, userId });
  return {
    totpEnabled: Boolean(record && record.enabledAt && !record.disabledAt),
    recoveryCodesRemaining: resolveRecoveryCodesRemaining(record),
    activeSessionsCount: activeSessions.length,
    issuer: metadata.issuer,
    accountLabel: metadata.accountLabel,
    iconUrl: metadata.iconUrl,
  };
};

const updateSessionIndexFromRequest = (req, { force = false } = {}) => {
  const sid = String(req?.sessionID || "").trim();
  const userId = String(req?.session?.user?.id || "").trim();
  const isPendingMfa = Boolean(req?.session?.pendingMfaUser?.id && !req?.session?.user?.id);
  if (!sid || (!userId && !isPendingMfa)) {
    return;
  }
  const nowTs = Date.now();
  const lastTouchTs = Number(sessionIndexTouchTsBySid.get(sid) || 0);
  if (
    !force &&
    Number.isFinite(lastTouchTs) &&
    nowTs - lastTouchTs < SESSION_INDEX_TOUCH_MIN_INTERVAL_MS
  ) {
    return;
  }
  sessionIndexTouchTsBySid.set(sid, nowTs);
  upsertUserSessionIndexRecord({
    sid,
    userId: userId || String(req?.session?.pendingMfaUser?.id || ""),
    createdAt: req?.session?.createdAt || new Date(nowTs).toISOString(),
    lastSeenAt: new Date(nowTs).toISOString(),
    lastIp: getRequestIp(req) || "",
    userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 512),
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    isPendingMfa,
  });
};

const maybeEmitNewNetworkLoginEvent = ({ req, userId } = {}) => {
  const network = getIpv4Network24(getRequestIp(req));
  if (!network || !userId) {
    return;
  }
  const nowTs = Date.now();
  const seen = loadUserSessionIndexRecords({ userId, includeRevoked: true }).some((item) => {
    const ts = new Date(item?.lastSeenAt || 0).getTime();
    if (!Number.isFinite(ts) || nowTs - ts > NEW_NETWORK_LOOKBACK_MS) {
      return false;
    }
    return getIpv4Network24(item?.lastIp) === network;
  });
  if (seen || !shouldEmitSecurityRuleEvent("new_network_login_warning", `${userId}:${network}`)) {
    return;
  }
  emitSecurityEvent({
    req,
    type: "new_network_login_warning",
    severity: SecurityEventSeverity.WARNING,
    riskScore: 55,
    actorUserId: userId,
    targetUserId: userId,
    data: { network, lookbackDays: 30 },
  });
};

const maybeEmitExcessiveSessionsEvent = ({ req, userId } = {}) => {
  const activeCount = listActiveSessionsForUser(userId).length;
  if (
    activeCount <= EXCESSIVE_SESSIONS_WARNING ||
    !shouldEmitSecurityRuleEvent("excessive_sessions_warning", userId)
  ) {
    return;
  }
  emitSecurityEvent({
    req,
    type: "excessive_sessions_warning",
    severity: SecurityEventSeverity.WARNING,
    riskScore: 45,
    actorUserId: userId,
    targetUserId: userId,
    data: {
      activeSessions: activeCount,
      threshold: EXCESSIVE_SESSIONS_WARNING,
    },
  });
};

const handleAuthFailureSecuritySignals = ({ req, error = "login_failed" } = {}) => {
  const ip = getRequestIp(req);
  if (!ip) {
    return;
  }
  const warningWindowCount = authFailedByIpCounter.record({
    key: ip,
    windowMs: AUTH_FAILED_BURST_WARNING.windowMs,
  }).count;
  const criticalWindowCount = authFailedByIpCounter.count({
    key: ip,
    windowMs: AUTH_FAILED_BURST_CRITICAL.windowMs,
  });

  if (
    criticalWindowCount >= AUTH_FAILED_BURST_CRITICAL.threshold &&
    shouldEmitSecurityRuleEvent("auth_failed_burst_ip_critical", ip)
  ) {
    emitSecurityEvent({
      req,
      type: "auth_failed_burst_ip_critical",
      severity: SecurityEventSeverity.CRITICAL,
      riskScore: 90,
      data: {
        ip,
        attempts: criticalWindowCount,
        windowMs: AUTH_FAILED_BURST_CRITICAL.windowMs,
        error: String(error || "login_failed"),
      },
    });
    return;
  }

  if (
    warningWindowCount >= AUTH_FAILED_BURST_WARNING.threshold &&
    shouldEmitSecurityRuleEvent("auth_failed_burst_ip_warning", ip)
  ) {
    emitSecurityEvent({
      req,
      type: "auth_failed_burst_ip_warning",
      severity: SecurityEventSeverity.WARNING,
      riskScore: 65,
      data: {
        ip,
        attempts: warningWindowCount,
        windowMs: AUTH_FAILED_BURST_WARNING.windowMs,
        error: String(error || "login_failed"),
      },
    });
  }
};

const handleMfaFailureSecuritySignals = ({ req, userId, error = "mfa_invalid_code" } = {}) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return;
  }
  metricsRegistry.inc("auth_mfa_verify_total", { status: "failed" });
  const count = mfaFailedByUserCounter.record({
    key: normalizedUserId,
    windowMs: MFA_FAILED_BURST_WARNING.windowMs,
  }).count;
  if (
    count >= MFA_FAILED_BURST_WARNING.threshold &&
    shouldEmitSecurityRuleEvent("mfa_failed_burst_user_warning", normalizedUserId)
  ) {
    emitSecurityEvent({
      req,
      type: "mfa_failed_burst_user_warning",
      severity: SecurityEventSeverity.WARNING,
      riskScore: 70,
      actorUserId: normalizedUserId,
      targetUserId: normalizedUserId,
      data: {
        userId: normalizedUserId,
        attempts: count,
        windowMs: MFA_FAILED_BURST_WARNING.windowMs,
        error: String(error || "mfa_invalid_code"),
      },
    });
  }
};

const maybeEmitAdminActionFromNewNetwork = (req) => {
  const userId = String(req?.session?.user?.id || "").trim();
  if (!userId || !String(req?.path || "").startsWith("/api/admin")) {
    return;
  }
  if (!isAdminUser(req?.session?.user)) {
    return;
  }
  const network = getIpv4Network24(getRequestIp(req));
  if (!network) {
    return;
  }
  const nowTs = Date.now();
  const hasKnownNetwork = loadUserSessionIndexRecords({ userId, includeRevoked: true }).some(
    (item) => {
      const ts = new Date(item?.lastSeenAt || 0).getTime();
      if (!Number.isFinite(ts) || nowTs - ts > NEW_NETWORK_LOOKBACK_MS) {
        return false;
      }
      return getIpv4Network24(item?.lastIp) === network;
    },
  );
  if (
    hasKnownNetwork ||
    !shouldEmitSecurityRuleEvent("admin_action_from_new_network_warning", `${userId}:${network}`)
  ) {
    return;
  }
  emitSecurityEvent({
    req,
    type: "admin_action_from_new_network_warning",
    severity: SecurityEventSeverity.WARNING,
    riskScore: 72,
    actorUserId: userId,
    targetUserId: userId,
    data: {
      network,
      path: String(req.path || ""),
      method: String(req.method || "").toUpperCase(),
    },
  });
};

const loadAllowedUsers = () => {
  if (!dataRepository) {
    return [];
  }
  const parsed = dataRepository.loadAllowedUsers();
  return Array.isArray(parsed) ? parsed : [];
};

const writeAllowedUsers = (ids) => {
  if (dataRepository) {
    dataRepository.writeAllowedUsers(ids);
  }
};

const loadUsers = () => {
  if (!dataRepository) {
    return [];
  }
  const items = dataRepository.loadUsers();
  const normalized = normalizeUsers(Array.isArray(items) ? items : []);
  if (JSON.stringify(items) !== JSON.stringify(normalized)) {
    writeUsers(normalized);
  }
  return normalized;
};

const writeUsers = (users) => {
  if (dataRepository) {
    dataRepository.writeUsers(normalizeUploadsDeep(users));
  }
};

const normalizeLinkTypes = (items) => {
  const source = Array.isArray(items) ? items : [];
  const dedupe = new Set();
  const normalized = [];
  source.forEach((item) => {
    const id = String(item?.id || "").trim();
    const label = String(item?.label || "").trim();
    if (!id || !label || dedupe.has(id)) {
      return;
    }
    dedupe.add(id);
    normalized.push({
      id,
      label,
      icon: sanitizeIconSource(item?.icon) || "globe",
    });
  });
  return normalized;
};

const loadLinkTypes = () => {
  if (!dataRepository) {
    return [];
  }
  const parsed = dataRepository.loadLinkTypes();
  const normalized = normalizeLinkTypes(parsed);
  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    writeLinkTypes(normalized);
  }
  return normalized;
};

const writeLinkTypes = (items) => {
  if (dataRepository) {
    dataRepository.writeLinkTypes(normalizeLinkTypes(items));
  }
};

const PUBLIC_READ_CACHE_TAGS = Object.freeze({
  BOOTSTRAP: "public:bootstrap",
  SEARCH: "public:search",
  POSTS: "public:posts",
  PROJECTS: "public:projects",
});

const loadPosts = () => {
  const cached = readJsonFileFromCache("posts");
  if (cached) {
    return cached;
  }
  if (!dataRepository) {
    return [];
  }
  const parsed = dataRepository.loadPosts();
  const items = Array.isArray(parsed) ? parsed : [];
  const pruned = pruneExpiredDeleted(items);
  if (pruned.length !== items.length) {
    writePosts(pruned);
  }
  const normalized = normalizePosts(pruned);
  if (JSON.stringify(pruned) !== JSON.stringify(normalized)) {
    writePosts(normalized);
  }
  writeJsonFileToCache("posts", normalized);
  return normalized;
};

const writePosts = (posts) => {
  const validProjectIds = new Set(
    normalizeProjects(loadProjects())
      .filter((project) => !project.deletedAt)
      .map((project) => String(project.id)),
  );
  const sanitizedPosts = (Array.isArray(posts) ? posts : []).map((post) => {
    const normalizedProjectId = String(post?.projectId || "").trim();
    if (!normalizedProjectId || validProjectIds.has(normalizedProjectId)) {
      return post;
    }
    return {
      ...post,
      projectId: "",
    };
  });
  if (dataRepository) {
    dataRepository.writePosts(normalizeUploadsDeep(sanitizedPosts));
  }
  invalidatePublicReadCacheTags([
    PUBLIC_READ_CACHE_TAGS.BOOTSTRAP,
    PUBLIC_READ_CACHE_TAGS.SEARCH,
    PUBLIC_READ_CACHE_TAGS.POSTS,
  ]);
  invalidateJsonFileCache("posts");
};

const loadPostVersions = () => {
  const cached = readJsonFileFromCache("post_versions");
  if (cached) {
    return cached;
  }
  if (!dataRepository || typeof dataRepository.loadPostVersions !== "function") {
    return [];
  }
  const parsed = dataRepository.loadPostVersions();
  const items = Array.isArray(parsed) ? parsed : [];
  const normalized = prunePostVersions(items);
  if (JSON.stringify(items) !== JSON.stringify(normalized)) {
    writePostVersions(normalized);
  }
  writeJsonFileToCache("post_versions", normalized);
  return normalized;
};

const writePostVersions = (entries) => {
  if (dataRepository && typeof dataRepository.writePostVersions === "function") {
    dataRepository.writePostVersions(entries);
  }
  invalidateJsonFileCache("post_versions");
};

const updateLexicalPollVotes = (content, { question, optionUid, voterId, checked }) => {
  if (!content || typeof content !== "string") {
    return { updated: false };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { updated: false };
  }
  if (!parsed || typeof parsed !== "object") {
    return { updated: false };
  }
  const safeQuestion = typeof question === "string" ? question : null;
  const safeOptionUid = String(optionUid || "").trim();
  const safeVoterId = String(voterId || "").trim();
  if (!safeOptionUid || !safeVoterId) {
    return { updated: false };
  }
  let updated = false;

  const updateNode = (node) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (node.type === "poll" && Array.isArray(node.options)) {
      if (safeQuestion && node.question !== safeQuestion) {
        // continue searching
      } else {
        const option = node.options.find((entry) => entry && entry.uid === safeOptionUid);
        if (option) {
          const votes = Array.isArray(option.votes)
            ? option.votes.filter((vote) => typeof vote === "string")
            : [];
          const hasVote = votes.includes(safeVoterId);
          const shouldCheck = typeof checked === "boolean" ? checked : !hasVote;
          if (shouldCheck && !hasVote) {
            votes.push(safeVoterId);
            option.votes = votes;
            updated = true;
          } else if (!shouldCheck && hasVote) {
            option.votes = votes.filter((vote) => vote !== safeVoterId);
            updated = true;
          }
          return;
        }
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(updateNode);
    }
  };

  updateNode(parsed.root || parsed);

  if (!updated) {
    return { updated: false };
  }

  return { updated: true, content: JSON.stringify(parsed) };
};

const jsonFileCache = createJsonFileCache();
const shouldUseInMemoryCache = true;

const readJsonFileFromCache = (cacheKey) => {
  if (!shouldUseInMemoryCache) {
    return null;
  }
  return jsonFileCache.read(cacheKey);
};

const writeJsonFileToCache = (cacheKey, value) => {
  if (!shouldUseInMemoryCache) {
    return;
  }
  jsonFileCache.write(cacheKey, value);
};

const invalidateJsonFileCache = (cacheKey) => {
  jsonFileCache.invalidate(cacheKey);
};

const defaultSiteSettings = {
  site: {
    name: "NEKOMATA",
    logoUrl: "",
    faviconUrl: "",
    description:
      "Fansub dedicada a trazer histórias inesquecíveis com o carinho que a comunidade merece.",
    defaultShareImage: "/placeholder.svg",
    defaultShareImageAlt: "Imagem padrão de compartilhamento da Nekomata",
    titleSeparator: " | ",
  },
  theme: {
    accent: "#9667e0",
    mode: "dark",
    useAccentInProgressCard: false,
  },
  navbar: {
    links: [
      { label: "Início", href: "/", icon: "home" },
      { label: "Projetos", href: "/projetos", icon: "folder-kanban" },
      { label: "Equipe", href: "/equipe", icon: "users" },
      { label: "Recrutamento", href: "/recrutamento", icon: "user-plus" },
      { label: "Sobre", href: "/sobre", icon: "info" },
    ],
  },
  community: {
    discordUrl: "https://discord.com/invite/BAHKhdX2ju",
    inviteCard: {
      title: "Entre no Discord",
      subtitle: "Converse com a equipe e acompanhe novidades em tempo real.",
      panelTitle: "Comunidade do Zuraaa!",
      panelDescription:
        "Receba alertas de lançamentos, participe de eventos e fale sobre os nossos projetos.",
      ctaLabel: "Entrar no servidor",
      ctaUrl: "https://discord.com/invite/BAHKhdX2ju",
    },
  },
  branding: {
    assets: {
      symbolUrl: "",
      wordmarkUrl: "",
    },
    overrides: {
      navbarSymbolUrl: "",
      footerSymbolUrl: "",
      navbarWordmarkUrl: "",
      footerWordmarkUrl: "",
    },
    display: {
      navbar: "symbol-text",
      footer: "symbol-text",
    },
    wordmarkUrl: "",
    wordmarkUrlNavbar: "",
    wordmarkUrlFooter: "",
    wordmarkPlacement: "both",
    wordmarkEnabled: false,
  },
  downloads: {
    sources: [
      {
        id: "google-drive",
        label: "Google Drive",
        color: "#34A853",
        icon: "google-drive",
        tintIcon: true,
      },
      { id: "mega", label: "MEGA", color: "#D9272E", icon: "mega", tintIcon: true },
      { id: "torrent", label: "Torrent", color: "#7C3AED", icon: "torrent", tintIcon: true },
      { id: "mediafire", label: "Mediafire", color: "#2563EB", icon: "mediafire", tintIcon: true },
      { id: "telegram", label: "Telegram", color: "#0EA5E9", icon: "telegram", tintIcon: true },
      { id: "outro", label: "Outro", color: "#64748B", icon: "link", tintIcon: true },
    ],
  },
  teamRoles: [
    { id: "tradutor", label: "Tradutor", icon: "languages" },
    { id: "revisor", label: "Revisor", icon: "check" },
    { id: "typesetter", label: "Typesetter", icon: "pen-tool" },
    { id: "qualidade", label: "Qualidade", icon: "sparkles" },
    { id: "desenvolvedor", label: "Desenvolvedor", icon: "code" },
    { id: "cleaner", label: "Cleaner", icon: "paintbrush" },
    { id: "redrawer", label: "Redrawer", icon: "layers" },
    { id: "encoder", label: "Encoder", icon: "video" },
    { id: "k-timer", label: "K-Timer", icon: "clock" },
    { id: "logo-maker", label: "Logo Maker", icon: "badge" },
    { id: "k-maker", label: "K-Maker", icon: "palette" },
  ],
  footer: {
    brandName: "NEKOMATA",
    brandLogoUrl: "",
    brandDescription:
      "Fansub dedicada a trazer histórias inesquecíveis com o carinho que a comunidade merece. Traduzimos por paixão, respeitando autores e apoiando o consumo legal das obras.",
    columns: [
      {
        title: "Nekomata",
        links: [
          { label: "Sobre", href: "/sobre" },
          { label: "Equipe", href: "/equipe" },
        ],
      },
      {
        title: "Ajude nossa equipe",
        links: [
          { label: "Recrutamento", href: "/recrutamento" },
          { label: "Doações", href: "/doacoes" },
        ],
      },
      {
        title: "Links úteis",
        links: [
          { label: "Projetos", href: "/projetos" },
          { label: "FAQ", href: "/faq" },
          { label: "Reportar erros", href: "https://discord.com/invite/BAHKhdX2ju" },
          { label: "Info Anime", href: "https://infoanime.com.br" },
        ],
      },
    ],
    socialLinks: [
      { label: "Instagram", href: "https://instagram.com", icon: "instagram" },
      { label: "Facebook", href: "https://facebook.com", icon: "facebook" },
      { label: "Twitter", href: "https://twitter.com", icon: "twitter" },
      { label: "Discord", href: "https://discord.com/invite/BAHKhdX2ju", icon: "discord" },
    ],
    disclaimer: [
      "Todo o conteúdo divulgado aqui pertence a seus respectivos autores e editoras. As traduções são realizadas por fãs, sem fins lucrativos, com o objetivo de divulgar as obras no Brasil.",
      "Caso goste de alguma obra, apoie a versão oficial. A venda de materiais legendados pela equipe é proibida.",
    ],
    highlightTitle: "Atribuição • Não Comercial",
    highlightDescription:
      "Este site segue a licença Creative Commons BY-NC. Você pode compartilhar com créditos, sem fins comerciais.",
    copyright: "© 2014 - 2026 Nekomata Fansub. Feito por fãs para fãs.",
  },
  seo: {
    redirects: [],
  },
  reader: {
    projectTypes: {
      manga: normalizeProjectReaderConfig({}, { projectType: "manga" }),
      webtoon: normalizeProjectReaderConfig({}, { projectType: "webtoon" }),
    },
  },
};

const mergeSettings = (base, override) => {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override : base;
  }
  if (base && typeof base === "object") {
    const next = { ...base };
    if (override && typeof override === "object") {
      Object.keys(override).forEach((key) => {
        next[key] = mergeSettings(base[key], override[key]);
      });
    }
    return next;
  }
  return override ?? base;
};

const hasMojibake = (value) => /\u00C3|\u00C2|\uFFFD/.test(String(value || ""));
function fixMojibakeText(value) {
  if (typeof value !== "string") {
    return value;
  }
  if (!hasMojibake(value)) {
    return value;
  }
  try {
    return Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
}
const fixMojibakeDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => fixMojibakeDeep(item));
  }
  if (value && typeof value === "object") {
    const next = { ...value };
    Object.keys(next).forEach((key) => {
      next[key] = fixMojibakeDeep(next[key]);
    });
    return next;
  }
  return fixMojibakeText(value);
};

const normalizeUploadsPath = (value) => {
  if (!value || typeof value !== "string") {
    return value;
  }
  if (value.startsWith("/uploads/")) {
    return value;
  }
  try {
    const parsed = new URL(value, PRIMARY_APP_ORIGIN);
    if (parsed.pathname && parsed.pathname.startsWith("/uploads/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // ignore
  }
  return value;
};

const normalizeUploadsInText = (value) => {
  if (!value || typeof value !== "string") {
    return value;
  }
  if (!value.includes("/uploads/")) {
    return value;
  }
  const urlPattern = /https?:\/\/[^\s"'()<>]+/gi;
  return value.replace(urlPattern, (match) => normalizeUploadsPath(match));
};

const normalizeUploadsDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeUploadsDeep(item));
  }
  if (value && typeof value === "object") {
    const next = { ...value };
    Object.keys(next).forEach((key) => {
      next[key] = normalizeUploadsDeep(next[key]);
    });
    return next;
  }
  return normalizeUploadsInText(value);
};

const normalizeSiteSettings = (payload) => {
  const merged = fixMojibakeDeep(mergeSettings(defaultSiteSettings, payload || {}));
  const normalizeThemeMode = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    return normalized === "light" ? "light" : "dark";
  };
  const accentValue =
    String(merged?.theme?.accent || defaultSiteSettings.theme.accent || "").trim() ||
    defaultSiteSettings.theme.accent;
  merged.theme = {
    ...(merged.theme || {}),
    accent: accentValue,
    mode: normalizeThemeMode(merged?.theme?.mode),
    useAccentInProgressCard: merged?.theme?.useAccentInProgressCard === true,
  };
  const resolveNavbarIcon = (label, href, icon) => {
    const iconValue = String(icon || "")
      .trim()
      .toLowerCase();
    if (iconValue) {
      return iconValue;
    }
    const normalizedLabel = String(label || "")
      .trim()
      .toLowerCase();
    const normalizedHref = String(href || "").trim();
    const matchByHref = defaultSiteSettings.navbar.links.find(
      (item) => String(item.href || "").trim() === normalizedHref,
    );
    if (matchByHref?.icon) {
      return String(matchByHref.icon).trim().toLowerCase();
    }
    const matchByLabel = defaultSiteSettings.navbar.links.find(
      (item) =>
        String(item.label || "")
          .trim()
          .toLowerCase() === normalizedLabel,
    );
    if (matchByLabel?.icon) {
      return String(matchByLabel.icon).trim().toLowerCase();
    }
    return "link";
  };
  const navbarLinks = Array.isArray(merged?.navbar?.links)
    ? merged.navbar.links
        .map((link) => ({
          label: String(link?.label || "").trim(),
          href: sanitizePublicHref(String(link?.href || "").trim()) || "",
          icon: resolveNavbarIcon(link?.label, link?.href, link?.icon),
        }))
        .filter((link) => link.label && link.href)
    : [];
  const normalizedNavbarLinks = Array.isArray(merged?.navbar?.links)
    ? navbarLinks
    : defaultSiteSettings.navbar.links.map((link) => ({ ...link }));
  merged.navbar = {
    links: normalizedNavbarLinks,
  };
  const allowedPlacements = new Set(["navbar", "footer", "both"]);
  const allowedNavbarModes = new Set(["wordmark", "symbol-text", "symbol", "text"]);
  const allowedFooterModes = new Set(["wordmark", "symbol-text", "text"]);
  const legacyPlacement = String(merged?.branding?.wordmarkPlacement || "both");
  const normalizedLegacyPlacement = allowedPlacements.has(legacyPlacement)
    ? legacyPlacement
    : "both";
  const legacyWordmarkEnabled = Boolean(merged?.branding?.wordmarkEnabled);
  const legacyWordmarkUrl = String(merged?.branding?.wordmarkUrl || "").trim();
  const legacyWordmarkUrlNavbar = String(merged?.branding?.wordmarkUrlNavbar || "").trim();
  const legacyWordmarkUrlFooter = String(merged?.branding?.wordmarkUrlFooter || "").trim();
  const legacySiteSymbol = String(merged?.site?.logoUrl || "").trim();
  const legacyFooterSymbol = String(merged?.footer?.brandLogoUrl || "").trim();

  const payloadBranding =
    payload?.branding && typeof payload.branding === "object" ? payload.branding : null;
  const hasAnyNewBrandingInput = Boolean(
    payloadBranding &&
      (typeof payloadBranding.assets === "object" ||
        typeof payloadBranding.overrides === "object" ||
        typeof payloadBranding.display === "object"),
  );

  const rawBrandAssets =
    merged?.branding?.assets && typeof merged.branding.assets === "object"
      ? merged.branding.assets
      : {};
  const rawBrandOverrides =
    merged?.branding?.overrides && typeof merged.branding.overrides === "object"
      ? merged.branding.overrides
      : {};
  const rawBrandDisplay =
    merged?.branding?.display && typeof merged.branding.display === "object"
      ? merged.branding.display
      : {};

  const symbolAssetUrl =
    sanitizeAssetUrl(
      rawBrandAssets.symbolUrl || (!hasAnyNewBrandingInput ? legacySiteSymbol : "") || "",
    ) || "";
  const wordmarkAssetUrl =
    sanitizeAssetUrl(
      rawBrandAssets.wordmarkUrl ||
        (!hasAnyNewBrandingInput
          ? legacyWordmarkUrl || legacyWordmarkUrlNavbar || legacyWordmarkUrlFooter
          : "") ||
        "",
    ) || "";

  const navbarSymbolOverride = sanitizeAssetUrl(rawBrandOverrides.navbarSymbolUrl || "") || "";
  const footerSymbolOverride =
    sanitizeAssetUrl(
      rawBrandOverrides.footerSymbolUrl ||
        (!hasAnyNewBrandingInput ? legacyFooterSymbol : "") ||
        "",
    ) || "";
  const navbarWordmarkOverride =
    sanitizeAssetUrl(
      rawBrandOverrides.navbarWordmarkUrl ||
        (!hasAnyNewBrandingInput ? legacyWordmarkUrlNavbar : "") ||
        "",
    ) || "";
  const footerWordmarkOverride =
    sanitizeAssetUrl(
      rawBrandOverrides.footerWordmarkUrl ||
        (!hasAnyNewBrandingInput ? legacyWordmarkUrlFooter : "") ||
        "",
    ) || "";

  const legacyNavbarMode =
    legacyWordmarkEnabled &&
    (normalizedLegacyPlacement === "navbar" || normalizedLegacyPlacement === "both")
      ? "wordmark"
      : "symbol-text";
  const legacyFooterMode =
    legacyWordmarkEnabled &&
    (normalizedLegacyPlacement === "footer" || normalizedLegacyPlacement === "both")
      ? "wordmark"
      : "symbol-text";

  const navbarModeCandidate = String(rawBrandDisplay.navbar || "").trim();
  const footerModeCandidate = String(rawBrandDisplay.footer || "").trim();
  const navbarMode = allowedNavbarModes.has(navbarModeCandidate)
    ? navbarModeCandidate
    : legacyNavbarMode;
  const footerMode = allowedFooterModes.has(footerModeCandidate)
    ? footerModeCandidate
    : legacyFooterMode;

  const resolvedNavbarWordmark = navbarWordmarkOverride || wordmarkAssetUrl;
  const resolvedFooterWordmark = footerWordmarkOverride || wordmarkAssetUrl;
  const resolvedFooterSymbol = footerSymbolOverride || symbolAssetUrl;

  const usesWordmarkNavbar = navbarMode === "wordmark";
  const usesWordmarkFooter = footerMode === "wordmark";
  const compatPlacement =
    usesWordmarkNavbar && usesWordmarkFooter
      ? "both"
      : usesWordmarkNavbar
        ? "navbar"
        : usesWordmarkFooter
          ? "footer"
          : normalizedLegacyPlacement;
  const compatWordmarkEnabled = usesWordmarkNavbar || usesWordmarkFooter;

  merged.branding = {
    ...(merged.branding || {}),
    assets: {
      symbolUrl: symbolAssetUrl,
      wordmarkUrl: wordmarkAssetUrl,
    },
    overrides: {
      navbarSymbolUrl: navbarSymbolOverride,
      footerSymbolUrl: footerSymbolOverride,
      navbarWordmarkUrl: navbarWordmarkOverride,
      footerWordmarkUrl: footerWordmarkOverride,
    },
    display: {
      navbar: navbarMode,
      footer: footerMode,
    },
    wordmarkUrl: wordmarkAssetUrl,
    wordmarkUrlNavbar: resolvedNavbarWordmark,
    wordmarkUrlFooter: resolvedFooterWordmark,
    wordmarkPlacement: compatPlacement,
    wordmarkEnabled: compatWordmarkEnabled,
  };
  const normalizedSiteName =
    String(merged?.site?.name || defaultSiteSettings.site.name || "Nekomata").trim() ||
    String(defaultSiteSettings.site.name || "Nekomata").trim() ||
    "Nekomata";
  const siteFaviconUrl =
    sanitizeAssetUrl(merged?.site?.faviconUrl || defaultSiteSettings.site.faviconUrl || "") || "";
  const siteDefaultShareImage =
    sanitizeAssetUrl(
      merged?.site?.defaultShareImage || defaultSiteSettings.site.defaultShareImage || "",
    ) || defaultSiteSettings.site.defaultShareImage;
  const siteDefaultShareImageAlt =
    String(
      merged?.site?.defaultShareImageAlt || defaultSiteSettings.site.defaultShareImageAlt || "",
    ).trim() || defaultSiteSettings.site.defaultShareImageAlt;
  merged.site = {
    ...(merged.site || {}),
    name: normalizedSiteName,
    logoUrl: symbolAssetUrl,
    faviconUrl: siteFaviconUrl,
    defaultShareImage: siteDefaultShareImage,
    defaultShareImageAlt: siteDefaultShareImageAlt,
  };
  merged.footer = {
    ...(merged.footer || {}),
    brandName: normalizedSiteName,
    brandLogoUrl: resolvedFooterSymbol,
  };
  const discordUrl =
    sanitizePublicHref(
      String(
        merged?.community?.discordUrl || defaultSiteSettings.community.discordUrl || "",
      ).trim(),
    ) ||
    sanitizePublicHref(String(defaultSiteSettings.community.discordUrl || "").trim()) ||
    "";
  const inviteCardPayload =
    merged?.community?.inviteCard && typeof merged.community.inviteCard === "object"
      ? merged.community.inviteCard
      : {};
  const inviteCardDefaults = defaultSiteSettings.community?.inviteCard || {};
  const inviteCardTitle =
    String(inviteCardPayload.title || inviteCardDefaults.title || "").trim() ||
    String(inviteCardDefaults.title || "").trim();
  const inviteCardSubtitle =
    String(inviteCardPayload.subtitle || inviteCardDefaults.subtitle || "").trim() ||
    String(inviteCardDefaults.subtitle || "").trim();
  const inviteCardPanelTitle =
    String(inviteCardPayload.panelTitle || inviteCardDefaults.panelTitle || "").trim() ||
    String(inviteCardDefaults.panelTitle || "").trim();
  const inviteCardPanelDescription =
    normalizeLegacyInviteCardText(
      String(inviteCardPayload.panelDescription || inviteCardDefaults.panelDescription || ""),
    ).trim() || String(inviteCardDefaults.panelDescription || "").trim();
  const inviteCardCtaLabel =
    String(inviteCardPayload.ctaLabel || inviteCardDefaults.ctaLabel || "").trim() ||
    String(inviteCardDefaults.ctaLabel || "").trim();
  const inviteCardCtaUrlRaw =
    sanitizePublicHref(String(inviteCardPayload.ctaUrl || "").trim()) || "";
  const inviteCardCtaUrl = inviteCardCtaUrlRaw || discordUrl;

  merged.community = {
    ...(merged.community || {}),
    discordUrl,
    inviteCard: {
      title: inviteCardTitle,
      subtitle: inviteCardSubtitle,
      panelTitle: inviteCardPanelTitle,
      panelDescription: inviteCardPanelDescription,
      ctaLabel: inviteCardCtaLabel,
      ctaUrl: inviteCardCtaUrl,
    },
  };

  if (discordUrl) {
    if (Array.isArray(merged.footer?.socialLinks)) {
      merged.footer.socialLinks = merged.footer.socialLinks.map((link) => {
        if (String(link.label || "").toLowerCase() === "discord" && !link.href) {
          return { ...link, href: discordUrl };
        }
        return link;
      });
    }
  }
  if (Array.isArray(merged?.downloads?.sources)) {
    merged.downloads.sources = merged.downloads.sources.map((source) => ({
      ...source,
      tintIcon: source?.tintIcon !== false,
    }));
  }
  if (Array.isArray(merged?.footer?.socialLinks)) {
    merged.footer.socialLinks = merged.footer.socialLinks
      .map((link) => ({
        ...link,
        label: String(link?.label || "").trim(),
        href: sanitizePublicHref(link?.href) || "",
      }))
      .filter((link) => link.label && link.href);
  }
  merged.seo = {
    ...(merged.seo && typeof merged.seo === "object" ? merged.seo : {}),
    redirects: normalizePublicRedirects(merged?.seo?.redirects),
  };
  const rawReaderProjectTypes =
    merged?.reader?.projectTypes && typeof merged.reader.projectTypes === "object"
      ? merged.reader.projectTypes
      : {};
  merged.reader = {
    projectTypes: {
      manga: normalizeProjectReaderConfig(rawReaderProjectTypes.manga, {
        projectType: "manga",
      }),
      webtoon: normalizeProjectReaderConfig(rawReaderProjectTypes.webtoon, {
        projectType: "webtoon",
      }),
    },
  };
  return normalizeUploadsDeep(merged);
};

const LEGACY_BRANDING_STORAGE_KEYS = [
  "wordmarkUrl",
  "wordmarkUrlNavbar",
  "wordmarkUrlFooter",
  "wordmarkPlacement",
  "wordmarkEnabled",
];
const LEGACY_SITE_STORAGE_KEYS = ["logoUrl"];
const LEGACY_FOOTER_STORAGE_KEYS = ["brandLogoUrl"];

const buildSiteSettingsStoragePayload = (settings) => {
  const normalized = normalizeUploadsDeep(fixMojibakeDeep(settings || {}));
  const next = { ...(normalized && typeof normalized === "object" ? normalized : {}) };

  if (next.branding && typeof next.branding === "object") {
    const branding = { ...next.branding };
    LEGACY_BRANDING_STORAGE_KEYS.forEach((key) => {
      delete branding[key];
    });
    next.branding = branding;
  }

  if (next.site && typeof next.site === "object") {
    const site = { ...next.site };
    LEGACY_SITE_STORAGE_KEYS.forEach((key) => {
      delete site[key];
    });
    next.site = site;
  }

  if (next.footer && typeof next.footer === "object") {
    const footer = { ...next.footer };
    LEGACY_FOOTER_STORAGE_KEYS.forEach((key) => {
      delete footer[key];
    });
    next.footer = footer;
  }

  return next;
};

const loadProjects = () => {
  const cached = readJsonFileFromCache("projects");
  if (cached) {
    return cached;
  }
  if (!dataRepository) {
    return [];
  }
  const parsed = dataRepository.loadProjects();
  const items = Array.isArray(parsed) ? parsed : [];
  const pruned = pruneExpiredDeleted(items);
  if (pruned.length !== items.length) {
    writeProjects(pruned);
  }
  const normalized = normalizeProjects(pruned);
  if (JSON.stringify(pruned) !== JSON.stringify(normalized)) {
    writeProjects(normalized);
  }
  writeJsonFileToCache("projects", normalized);
  return normalized;
};

const writeProjects = (projects) => {
  if (dataRepository) {
    dataRepository.writeProjects(normalizeUploadsDeep(projects));
  }
  invalidatePublicReadCacheTags([
    PUBLIC_READ_CACHE_TAGS.BOOTSTRAP,
    PUBLIC_READ_CACHE_TAGS.SEARCH,
    PUBLIC_READ_CACHE_TAGS.PROJECTS,
  ]);
  invalidateJsonFileCache("projects");
};

const loadUpdates = () => {
  const cached = readJsonFileFromCache("updates");
  if (cached) {
    return cached;
  }
  if (!dataRepository) {
    return [];
  }
  const parsed = dataRepository.loadUpdates();
  const updates = Array.isArray(parsed) ? parsed : [];
  const normalized = updates.map((update) => normalizeLegacyUpdateRecord(update));
  if (JSON.stringify(updates) !== JSON.stringify(normalized)) {
    writeUpdates(normalized);
  }
  writeJsonFileToCache("updates", normalized);
  return normalized;
};

const writeUpdates = (updates) => {
  const validProjectIds = new Set(
    normalizeProjects(loadProjects())
      .filter((project) => !project.deletedAt)
      .map((project) => String(project.id)),
  );
  const sanitizedUpdates = (Array.isArray(updates) ? updates : []).filter((update) => {
    const projectId = String(update?.projectId || "").trim();
    if (!projectId) {
      return true;
    }
    return validProjectIds.has(projectId);
  });
  if (dataRepository) {
    dataRepository.writeUpdates(sanitizedUpdates);
  }
  invalidatePublicReadCacheTags([PUBLIC_READ_CACHE_TAGS.BOOTSTRAP]);
  invalidateJsonFileCache("updates");
};

const loadTagTranslations = () => {
  const cached = readJsonFileFromCache("tag-translations");
  if (cached) {
    return cached;
  }
  if (!dataRepository) {
    return { tags: {}, genres: {}, staffRoles: {} };
  }
  const parsed = dataRepository.loadTagTranslations();
  const normalized = {
    tags: parsed?.tags && typeof parsed.tags === "object" ? parsed.tags : {},
    genres: parsed?.genres && typeof parsed.genres === "object" ? parsed.genres : {},
    staffRoles:
      parsed?.staffRoles && typeof parsed.staffRoles === "object" ? parsed.staffRoles : {},
  };
  writeJsonFileToCache("tag-translations", normalized);
  return normalized;
};

const writeTagTranslations = (payload) => {
  if (dataRepository) {
    dataRepository.writeTagTranslations(payload);
  }
  invalidatePublicReadCacheTags([PUBLIC_READ_CACHE_TAGS.BOOTSTRAP]);
  invalidateJsonFileCache("tag-translations");
};

const loadComments = () => {
  if (!dataRepository) {
    return [];
  }
  const parsed = dataRepository.loadComments();
  return Array.isArray(parsed) ? parsed : [];
};

const hasProjectChapter = (project, chapterNumber, volume) => {
  return resolveEpisodeLookup(project, chapterNumber, volume, { requirePublished: true }).ok;
};

const enforceCommentTargetIntegrity = (comments) => {
  const safeComments = Array.isArray(comments) ? comments : [];
  if (safeComments.length === 0) {
    return safeComments;
  }
  const posts = normalizePosts(loadPosts());
  const projects = normalizeProjects(loadProjects());
  const postSlugs = new Set(
    posts.filter((post) => !post.deletedAt).map((post) => String(post.slug || "")),
  );
  const projectMap = new Map(
    projects
      .filter((project) => !project.deletedAt)
      .map((project) => [String(project.id || ""), project]),
  );
  return safeComments.filter((comment) => {
    const targetType = String(comment?.targetType || "")
      .trim()
      .toLowerCase();
    const targetId = String(comment?.targetId || "").trim();
    if (!targetType || !targetId) {
      return false;
    }
    if (targetType === "post") {
      return postSlugs.has(targetId);
    }
    if (targetType === "project") {
      return projectMap.has(targetId);
    }
    if (targetType === "chapter") {
      const project = projectMap.get(targetId);
      if (!project) {
        return false;
      }
      return hasProjectChapter(
        project,
        comment?.targetMeta?.chapterNumber,
        comment?.targetMeta?.volume,
      );
    }
    return false;
  });
};

const writeComments = (comments) => {
  const sanitizedComments = enforceCommentTargetIntegrity(comments);
  if (dataRepository) {
    dataRepository.writeComments(sanitizedComments);
  }
};

const loadUploads = () => {
  if (!dataRepository) {
    return [];
  }
  const parsed = dataRepository.loadUploads();
  return (Array.isArray(parsed) ? parsed : []).map((entry) => ({
    ...(entry && typeof entry === "object" ? entry : {}),
    storageProvider: readUploadStorageProvider(entry, "local"),
  }));
};

const writeUploads = (uploads, options = {}) => {
  if (dataRepository) {
    return dataRepository.writeUploads(uploads, options);
  }
  if (options?.awaitPersist === true) {
    return Promise.resolve();
  }
  return undefined;
};

const deleteManagedUploadEntryAssets = async (entry, providerOverride) => {
  const currentEntry = entry && typeof entry === "object" ? entry : null;
  if (!currentEntry) {
    return;
  }
  const provider = normalizeUploadStorageProvider(
    providerOverride || readUploadStorageProvider(currentEntry, "local"),
    uploadStorageService.activeProvider,
  );
  try {
    await uploadStorageService.deleteUpload({
      provider,
      uploadUrl: currentEntry.url,
    });
  } catch {
    // best-effort delete
  }
  const variantPrefix = getUploadVariantUrlPrefix(currentEntry);
  if (!variantPrefix) {
    return;
  }
  try {
    await uploadStorageService.deleteUploadPrefix({
      provider,
      uploadUrlPrefix: variantPrefix,
    });
  } catch {
    // best-effort delete
  }
};

const buildManagedStorageAreaSummary = (uploads) => {
  const allUploads = Array.isArray(uploads) ? uploads : [];
  const localUploads = allUploads.filter(
    (entry) => readUploadStorageProvider(entry, "local") === "local",
  );
  const remoteUploads = allUploads.filter(
    (entry) => readUploadStorageProvider(entry, "local") === "s3",
  );
  const localSummary = buildDiskStorageAreaSummary({
    uploads: localUploads,
    uploadsDir: PUBLIC_UPLOADS_DIR,
  });
  const remoteSummary = buildStorageAreaSummary(remoteUploads);
  const areasMap = new Map();

  const mergeRows = (rows) => {
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const area = String(row?.area || "root");
      const current = areasMap.get(area) || {
        area,
        originalBytes: 0,
        variantBytes: 0,
        totalBytes: 0,
        originalFiles: 0,
        variantFiles: 0,
        totalFiles: 0,
      };
      areasMap.set(area, {
        area,
        originalBytes: current.originalBytes + Number(row?.originalBytes || 0),
        variantBytes: current.variantBytes + Number(row?.variantBytes || 0),
        totalBytes: current.totalBytes + Number(row?.totalBytes || 0),
        originalFiles: current.originalFiles + Number(row?.originalFiles || 0),
        variantFiles: current.variantFiles + Number(row?.variantFiles || 0),
        totalFiles: current.totalFiles + Number(row?.totalFiles || 0),
      });
    });
  };

  mergeRows(localSummary?.areas);
  mergeRows(remoteSummary?.areas);

  const areas = Array.from(areasMap.values()).sort((left, right) => {
    if (left.totalBytes !== right.totalBytes) {
      return right.totalBytes - left.totalBytes;
    }
    return String(left.area || "").localeCompare(String(right.area || ""), "en");
  });
  const totals = areas.reduce(
    (acc, item) => ({
      area: "total",
      originalBytes: acc.originalBytes + Number(item?.originalBytes || 0),
      variantBytes: acc.variantBytes + Number(item?.variantBytes || 0),
      totalBytes: acc.totalBytes + Number(item?.totalBytes || 0),
      originalFiles: acc.originalFiles + Number(item?.originalFiles || 0),
      variantFiles: acc.variantFiles + Number(item?.variantFiles || 0),
      totalFiles: acc.totalFiles + Number(item?.totalFiles || 0),
    }),
    {
      area: "total",
      originalBytes: 0,
      variantBytes: 0,
      totalBytes: 0,
      originalFiles: 0,
      variantFiles: 0,
      totalFiles: 0,
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    totals,
    areas,
  };
};

const upsertUploadEntries = (incomingEntries) => {
  if (!Array.isArray(incomingEntries) || incomingEntries.length === 0) {
    return { changed: false, uploads: loadUploads() };
  }
  const existingUploads = loadUploads();
  const byUrl = new Map(
    existingUploads.filter((item) => item?.url).map((item) => [String(item.url), item]),
  );
  let changed = false;
  incomingEntries.forEach((entry) => {
    const nextUrl = String(entry?.url || "").trim();
    if (!nextUrl || !nextUrl.startsWith("/uploads/")) {
      return;
    }
    const current = byUrl.get(nextUrl);
    const focalState = resolveIncomingUploadFocalState(entry, current);
    const next = {
      ...(current || {}),
      ...entry,
      id: current?.id || entry?.id || crypto.randomUUID(),
      url: nextUrl,
      fileName: String(entry?.fileName || current?.fileName || ""),
      folder: String(entry?.folder || current?.folder || ""),
      storageProvider: readUploadStorageProvider(
        entry,
        readUploadStorageProvider(current, "local"),
      ),
      size: Number.isFinite(entry?.size) ? Number(entry.size) : (current?.size ?? null),
      mime: String(entry?.mime || current?.mime || ""),
      width: Number.isFinite(entry?.width) ? Number(entry.width) : (current?.width ?? null),
      height: Number.isFinite(entry?.height) ? Number(entry.height) : (current?.height ?? null),
      area: String(entry?.area || current?.area || ""),
      hashSha256: String(entry?.hashSha256 || current?.hashSha256 || ""),
      altText: readUploadAltText(entry) || readUploadAltText(current),
      focalCrops: focalState.focalCrops,
      focalPoints: focalState.focalPoints,
      focalPoint: focalState.focalPoint,
      variantsVersion: Number.isFinite(Number(entry?.variantsVersion))
        ? Number(entry.variantsVersion)
        : Number.isFinite(Number(current?.variantsVersion))
          ? Number(current.variantsVersion)
          : 1,
      variants: normalizeVariants(
        entry?.variants && typeof entry.variants === "object"
          ? entry.variants
          : current?.variants && typeof current.variants === "object"
            ? current.variants
            : {},
      ),
      variantBytes: Number.isFinite(Number(entry?.variantBytes))
        ? Number(entry.variantBytes)
        : Number.isFinite(Number(current?.variantBytes))
          ? Number(current.variantBytes)
          : 0,
      createdAt: String(entry?.createdAt || current?.createdAt || new Date().toISOString()),
    };
    if (JSON.stringify(current || null) !== JSON.stringify(next)) {
      changed = true;
    }
    byUrl.set(nextUrl, next);
  });
  if (!changed) {
    return { changed: false, uploads: existingUploads };
  }
  const nextUploads = Array.from(byUrl.values()).sort((a, b) =>
    String(a.url || "").localeCompare(String(b.url || ""), "en"),
  );
  writeUploads(nextUploads);
  return { changed: true, uploads: nextUploads };
};

const ensureUploadEntryHasRequiredVariants = async ({
  uploads,
  uploadsDir,
  entry,
  sourceMime,
  hashSha256,
  requiredVariantPresetKeys,
} = {}) => {
  const currentEntry = entry && typeof entry === "object" ? entry : null;
  if (!currentEntry) {
    return { entry, uploads: Array.isArray(uploads) ? uploads : [], changed: false };
  }
  const currentVariantPresetKeys = normalizeUploadVariantPresetKeys(
    Object.keys(normalizeVariants(currentEntry?.variants)),
  );
  const requestedVariantPresetKeys = normalizeUploadVariantPresetKeys(requiredVariantPresetKeys);
  if (
    requestedVariantPresetKeys.length === 0 ||
    requestedVariantPresetKeys.every((presetKey) => currentVariantPresetKeys.includes(presetKey))
  ) {
    return { entry: currentEntry, uploads: Array.isArray(uploads) ? uploads : [], changed: false };
  }
  const mergedVariantPresetKeys = mergeUploadVariantPresetKeys(
    currentVariantPresetKeys,
    requestedVariantPresetKeys,
  );

  try {
    const currentProvider = readUploadStorageProvider(currentEntry, "local");
    let stagingWorkspace = null;
    let stagingUploadsDir = uploadsDir;
    let sourcePath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl: currentEntry?.url });
    try {
      if (currentProvider !== "local" || !sourcePath || !fs.existsSync(sourcePath)) {
        stagingWorkspace = createUploadStagingWorkspace();
        stagingUploadsDir = stagingWorkspace.uploadsDir;
        const materialized = await materializeUploadEntrySourceToStaging({
          storageService: uploadStorageService,
          entry: currentEntry,
          uploadsDir: stagingUploadsDir,
        });
        sourcePath = materialized.sourcePath;
      }

      const updatedEntry = await attachUploadMediaMetadata({
        uploadsDir: stagingUploadsDir,
        entry: {
          ...currentEntry,
          storageProvider: currentProvider,
        },
        sourcePath,
        sourceMime: sourceMime || currentEntry?.mime,
        hashSha256,
        variantsVersion: Math.max(1, Number(currentEntry?.variantsVersion || 1)),
        regenerateVariants: true,
        variantPresetKeys: mergedVariantPresetKeys,
      });
      if (currentProvider !== "local") {
        await persistUploadEntryFromStaging({
          storageService: uploadStorageService,
          entry: updatedEntry,
          uploadsDir: stagingUploadsDir,
          provider: currentProvider,
          cacheControl: STATIC_DEFAULT_CACHE_CONTROL,
        });
      }
      if (JSON.stringify(updatedEntry) === JSON.stringify(currentEntry)) {
        return {
          entry: updatedEntry,
          uploads: Array.isArray(uploads) ? uploads : [],
          changed: false,
        };
      }
      const nextUploads = (Array.isArray(uploads) ? uploads : []).map((item) =>
        String(item?.id || "") === String(currentEntry?.id || "") ? updatedEntry : item,
      );
      writeUploads(nextUploads);
      return { entry: updatedEntry, uploads: nextUploads, changed: true };
    } finally {
      cleanupUploadStagingWorkspace(stagingWorkspace);
    }
  } catch {
    return { entry: currentEntry, uploads: Array.isArray(uploads) ? uploads : [], changed: false };
  }
};

const PRIVATE_UPLOAD_FOLDERS = new Set(["downloads", "socials", "users"]);

const getUploadRootSegment = (value) => {
  if (!value) {
    return "";
  }
  const normalized = String(value).replace(/^\/+/, "");
  const [root] = normalized.split(/[\\/]/);
  return String(root || "").toLowerCase();
};

const isPrivateUploadFolder = (value) => PRIVATE_UPLOAD_FOLDERS.has(getUploadRootSegment(value));

const normalizeUploadUrlValue = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("/uploads/")) {
    return trimmed.split("?")[0].split("#")[0];
  }
  try {
    const parsed = new URL(trimmed, PRIMARY_APP_ORIGIN);
    if (parsed.pathname && parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // ignore
  }
  return null;
};

const hasOwnField = (value, key) =>
  Boolean(value && Object.prototype.hasOwnProperty.call(value, key));

const readUploadFocalState = (value) => {
  const focalCrops = normalizeFocalCrops(value?.focalCrops, undefined, {
    sourceWidth: value?.width,
    sourceHeight: value?.height,
    fallbackPoints: value?.focalPoints,
    fallbackPoint: value?.focalPoint,
  });
  const focalPoints = deriveFocalPointsFromCrops(focalCrops);
  return {
    focalCrops,
    focalPoints,
    focalPoint: getPrimaryFocalPoint(focalPoints),
  };
};

const readUploadAltText = (value) => String(value?.altText || "").trim();
const readUploadSlot = (value) => sanitizeUploadSlot(value?.slot);
const readUploadSlotManaged = (value) =>
  hasOwnField(value, "slotManaged") ? value?.slotManaged === true : undefined;

const resolveIncomingUploadFocalState = (incoming, current) => {
  if (hasOwnField(incoming, "focalCrops")) {
    const focalCrops = normalizeFocalCrops(incoming.focalCrops, current?.focalCrops, {
      sourceWidth: current?.width,
      sourceHeight: current?.height,
      fallbackPoints: current?.focalPoints,
      fallbackPoint: current?.focalPoint,
    });
    const focalPoints = deriveFocalPointsFromCrops(focalCrops);
    return {
      focalCrops,
      focalPoints,
      focalPoint: getPrimaryFocalPoint(focalPoints),
    };
  }
  if (hasOwnField(incoming, "focalPoints")) {
    const focalPoints = normalizeFocalPoints(
      incoming.focalPoints,
      current?.focalPoints ?? current?.focalPoint,
    );
    const focalCrops = normalizeFocalCrops(undefined, undefined, {
      sourceWidth: current?.width,
      sourceHeight: current?.height,
      fallbackPoints: focalPoints,
    });
    return {
      focalCrops,
      focalPoints,
      focalPoint: getPrimaryFocalPoint(focalPoints),
    };
  }
  if (hasOwnField(incoming, "focalPoint")) {
    const focalPoints = normalizeFocalPoints(incoming.focalPoint);
    const focalCrops = normalizeFocalCrops(undefined, undefined, {
      sourceWidth: current?.width,
      sourceHeight: current?.height,
      fallbackPoints: focalPoints,
    });
    return {
      focalCrops,
      focalPoints,
      focalPoint: getPrimaryFocalPoint(focalPoints),
    };
  }
  return readUploadFocalState(current);
};

const extractRequestedUploadFocalPayload = (value) => {
  const body = value && typeof value === "object" ? value : {};
  if (hasOwnField(body, "focalCrops")) {
    return { focalCrops: body.focalCrops };
  }
  if (hasOwnField(body, "focalPoints")) {
    return { focalPoints: body.focalPoints };
  }
  if (hasOwnField(body, "focalPoint")) {
    return { focalPoint: body.focalPoint };
  }
  if (hasOwnField(body, "x") || hasOwnField(body, "y")) {
    return { focalPoint: body };
  }
  return {};
};

const getUploadFolderFromUrlValue = (value) => {
  const normalized = normalizeUploadUrlValue(value);
  if (!normalized) {
    return "";
  }
  const relative = normalized.replace(/^\/uploads\//, "");
  const lastSlash = relative.lastIndexOf("/");
  if (lastSlash < 0) {
    return "";
  }
  return relative.slice(0, lastSlash);
};

const {
  buildPublicMediaVariants,
  collectDownloadIconUploads,
  collectLinkTypeIconUploads,
  enqueueProjectOgPrewarm,
  getUsedUploadUrls,
  logProjectOgDelivery,
  resolveMetaImageVariantUrl,
} = createPublicMediaRuntime({
  backgroundJobQueue,
  extractUploadUrlsFromText,
  getPublicVisibleProjects: () => getPublicVisibleProjects(),
  getUploadFolderFromUrlValue,
  isPrivateUploadFolder,
  loadComments: () => loadComments(),
  loadLinkTypes: () => loadLinkTypes(),
  loadPages: () => loadPages(),
  loadPosts: () => loadPosts(),
  loadProjects: () => loadProjects(),
  loadSiteSettings: () => loadSiteSettings(),
  loadTagTranslations: () => loadTagTranslations(),
  loadUpdates: () => loadUpdates(),
  loadUploads: () => loadUploads(),
  loadUsers: () => loadUsers(),
  normalizeUploadUrl,
  normalizeUploadUrlValue,
  normalizeVariants,
  ogRenderCache,
  prewarmProjectOgCache,
  primaryAppOrigin: PRIMARY_APP_ORIGIN,
  publicUploadsDir: PUBLIC_UPLOADS_DIR,
  readUploadFocalState,
  readUploadStorageProvider,
  resolveExistingPublicVariantUrl,
  sanitizePublicMediaVariantEntry,
  shouldExposePublicUploadInMediaVariants,
});

const deletePrivateUploadByUrl = (value) => {
  try {
    const normalized = normalizeUploadUrlValue(value);
    if (!normalized) {
      return;
    }
    const relativePath = normalized.replace(/^\/uploads\//, "");
    if (!isPrivateUploadFolder(relativePath)) {
      return;
    }
    const uploadsDir = path.join(__dirname, "..", "public", "uploads");
    const targetPath = path.join(uploadsDir, relativePath);
    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(path.resolve(uploadsDir))) {
      return;
    }
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
    const uploads = loadUploads();
    const nextUploads = uploads.filter((item) => item.url !== normalized);
    if (nextUploads.length !== uploads.length) {
      writeUploads(nextUploads);
    }
  } catch {
    // ignore cleanup errors
  }
};

const loadPages = () => {
  if (!dataRepository) {
    return {};
  }
  let parsed = dataRepository.loadPages();
  if (!parsed || typeof parsed !== "object") {
    parsed = {};
  }
  const normalized = normalizeUploadsDeep(fixMojibakeDeep(parsed));
  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    writePages(normalized);
  }
  return normalized;
};

const writePages = (pages) => {
  if (dataRepository) {
    dataRepository.writePages(normalizeUploadsDeep(fixMojibakeDeep(pages)));
  }
  invalidatePublicReadCacheTags([PUBLIC_READ_CACHE_TAGS.BOOTSTRAP]);
};

const loadSiteSettings = () => {
  const cached = readJsonFileFromCache("site-settings");
  if (cached) {
    return cached;
  }
  if (!dataRepository) {
    return normalizeSiteSettings(defaultSiteSettings);
  }
  let parsed = dataRepository.loadSiteSettings();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const seeded = normalizeSiteSettings(defaultSiteSettings);
    writeSiteSettings(seeded);
    writeJsonFileToCache("site-settings", seeded);
    return seeded;
  }
  const normalized = normalizeSiteSettings(parsed);
  const storagePayload = buildSiteSettingsStoragePayload(normalized);
  if (JSON.stringify(parsed) !== JSON.stringify(storagePayload)) {
    writeSiteSettings(normalized);
  }
  writeJsonFileToCache("site-settings", normalized);
  return normalized;
};

const { renderMetaHtml } = createMetaHtmlRenderer({
  getIndexHtml,
  primaryAppOrigin: PRIMARY_APP_ORIGIN,
  resolveMetaImageVariantUrl,
  serializeSchemaOrgEntry,
  toAbsoluteUrl,
  truncateMetaDescription,
});
const sendHtml = createHtmlSender({
  applyHtmlCachingHeaders,
  injectNonceIntoHtmlScripts,
  viteDevServer,
});
const {
  buildInstitutionalPageMeta,
  buildPostMeta,
  buildProjectMeta,
  buildProjectReadingMeta,
  buildSiteMetaWithSettings,
  getPageTitleFromPath,
} = createSiteMetaBuilders({
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
  loadPages,
  loadSiteSettings,
  loadTagTranslations,
  primaryAppOrigin: PRIMARY_APP_ORIGIN,
  resolveInstitutionalOgPagePath,
  resolveInstitutionalOgPageTitle,
  resolveInstitutionalOgSupportText,
  resolveMetaImageVariantUrl,
  resolvePostCover,
  truncateMetaDescription,
});
const buildEditorialWebhookImageContext = createBuildEditorialWebhookImageContext({
  buildPostOgRevision,
  buildProjectOgRevision,
  buildProjectReadingOgCardModel,
  buildProjectReadingOgRevisionValue,
  buildVersionedPostOgImagePath,
  buildVersionedProjectOgImagePath,
  buildVersionedProjectReadingOgImagePath,
  extractFirstImageFromPostContent,
  primaryAppOrigin: PRIMARY_APP_ORIGIN,
  resolveMetaImageVariantUrl,
  resolvePostCover,
});

const writeSiteSettings = (settings) => {
  const normalized = normalizeSiteSettings(settings);
  const storagePayload = buildSiteSettingsStoragePayload(normalized);
  if (dataRepository) {
    dataRepository.writeSiteSettings(storagePayload);
  }
  invalidatePublicReadCacheTags([PUBLIC_READ_CACHE_TAGS.BOOTSTRAP]);
  invalidateJsonFileCache("site-settings");
};

const buildEnvOperationalWebhookSettings = () =>
  defaultOperationalWebhookSettings({
    enabled: isOpsAlertsWebhookEnabled,
    provider: OPS_ALERTS_WEBHOOK_PROVIDER,
    webhookUrl: OPS_ALERTS_WEBHOOK_URL,
    timeoutMs: OPS_ALERTS_WEBHOOK_TIMEOUT_MS,
    intervalMs: OPS_ALERTS_WEBHOOK_INTERVAL_MS,
  });

const buildEnvSecurityWebhookSettings = () =>
  defaultSecurityWebhookSettings({
    enabled: isOpsAlertsWebhookEnabled,
    provider: OPS_ALERTS_WEBHOOK_PROVIDER,
    webhookUrl: OPS_ALERTS_WEBHOOK_URL,
    timeoutMs: OPS_ALERTS_WEBHOOK_TIMEOUT_MS,
  });

const buildWebhookSettingsBundle = (payload) =>
  normalizeWebhookSettingsBundle(payload, {
    defaultProjectTypes: DEFAULT_PROJECT_TYPE_CATALOG,
    operationalFallback: buildEnvOperationalWebhookSettings(),
    securityFallback: buildEnvSecurityWebhookSettings(),
  });

const loadIntegrationSettingsBundle = () => {
  const cached = readJsonFileFromCache("integration-settings");
  if (
    cached &&
    cached.settings &&
    typeof cached.settings === "object" &&
    cached.sources &&
    typeof cached.sources === "object"
  ) {
    return cached;
  }
  if (!dataRepository || typeof dataRepository.loadIntegrationSettings !== "function") {
    const defaults = buildWebhookSettingsBundle({});
    writeJsonFileToCache("integration-settings", defaults);
    return defaults;
  }
  const parsed = dataRepository.loadIntegrationSettings();
  const bundle = buildWebhookSettingsBundle(parsed);
  writeJsonFileToCache("integration-settings", bundle);
  return bundle;
};

const loadIntegrationSettings = () => loadIntegrationSettingsBundle().settings;

const loadIntegrationSettingsSources = () => loadIntegrationSettingsBundle().sources;

const writeIntegrationSettings = (settings) => {
  const bundle = buildWebhookSettingsBundle(settings);
  const persistedBundle = {
    settings: {
      ...bundle.settings,
      operational: normalizeOperationalWebhookSettings(bundle.settings.operational, {
        fallback: buildEnvOperationalWebhookSettings(),
      }),
      security: normalizeSecurityWebhookSettings(bundle.settings.security, {
        fallback: buildEnvSecurityWebhookSettings(),
      }),
    },
    sources: {
      editorial: "stored",
      operational: "stored",
      security: "stored",
    },
  };
  if (dataRepository && typeof dataRepository.writeIntegrationSettings === "function") {
    dataRepository.writeIntegrationSettings(persistedBundle.settings);
  }
  invalidateJsonFileCache("integration-settings");
  writeJsonFileToCache("integration-settings", persistedBundle);
  return persistedBundle.settings;
};

const normalizeUnifiedWebhookSettingsForRequest = (settings, projectTypes = []) =>
  normalizeWebhookSettingsBundle(settings, {
    projectTypes,
    defaultProjectTypes: DEFAULT_PROJECT_TYPE_CATALOG,
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
  if (!requestedRevision || options?.forceOverride === true || requestedRevision === currentRevision) {
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
  const validation = validateWebhookUrlForProvider({
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
  const normalized = migrateEditorialMentionPlaceholdersInSettings(
    normalizeEditorialWebhookSettings(settings),
  );
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
  createSecurityEventPayload({
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

const countDroppedUserSocials = (usersInput) => {
  const users = Array.isArray(usersInput) ? usersInput : [];
  return users.reduce((total, user) => {
    const socials = Array.isArray(user?.socials) ? user.socials.filter(Boolean) : [];
    const sanitized = sanitizeSocials(socials);
    return total + Math.max(0, socials.length - sanitized.length);
  }, 0);
};

const countDroppedLinkTypeIcons = (itemsInput) => {
  const items = Array.isArray(itemsInput) ? itemsInput : [];
  return items.reduce((total, item) => {
    const iconRaw = String(item?.icon || "").trim();
    if (!iconRaw) {
      return total;
    }
    return sanitizeIconSource(iconRaw) ? total : total + 1;
  }, 0);
};

const countDroppedSiteLinks = (settingsInput) => {
  const settings = settingsInput && typeof settingsInput === "object" ? settingsInput : {};
  let total = 0;
  const navbarLinks = Array.isArray(settings?.navbar?.links) ? settings.navbar.links : [];
  navbarLinks.forEach((link) => {
    const href = String(link?.href || "").trim();
    if (href && !sanitizePublicHref(href)) {
      total += 1;
    }
  });
  const footerLinks = Array.isArray(settings?.footer?.socialLinks)
    ? settings.footer.socialLinks
    : [];
  footerLinks.forEach((link) => {
    const href = String(link?.href || "").trim();
    if (href && !sanitizePublicHref(href)) {
      total += 1;
    }
  });
  const communityDiscordUrl = String(settings?.community?.discordUrl || "").trim();
  if (communityDiscordUrl && !sanitizePublicHref(communityDiscordUrl)) {
    total += 1;
  }
  const inviteCardCtaUrl = String(settings?.community?.inviteCard?.ctaUrl || "").trim();
  if (inviteCardCtaUrl && !sanitizePublicHref(inviteCardCtaUrl)) {
    total += 1;
  }
  return total;
};

const runStartupSecuritySanitization = () => {
  const rawUsers = dataRepository ? dataRepository.loadUsers() : [];
  const rawLinkTypes = dataRepository ? dataRepository.loadLinkTypes() : [];
  const rawSiteSettings = dataRepository ? dataRepository.loadSiteSettings() : {};
  const usersSocialsDropped = countDroppedUserSocials(rawUsers);
  const linkTypeIconsDropped = countDroppedLinkTypeIcons(rawLinkTypes);
  const siteLinksDropped = countDroppedSiteLinks(rawSiteSettings);

  // Trigger normalization and persistence for legacy data.
  loadUsers();
  loadLinkTypes();
  loadSiteSettings();
  loadIntegrationSettings();

  const totalDropped = usersSocialsDropped + linkTypeIconsDropped + siteLinksDropped;
  if (totalDropped > 0) {
    appendAuditLog(createSystemAuditReq(), "security.update.sanitization_startup", "security", {
      usersSocialsDropped,
      linkTypeIconsDropped,
      siteLinksDropped,
    });
  }
};

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const createGravatarHash = (email) =>
  crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
const buildGravatarUrl = (hash, size = 96) =>
  `https://gravatar.com/avatar/${hash}?d=identicon&s=${size}`;

const resolveGravatarAvatarUrl = async (hash) => {
  const apiKey = process.env.GRAVATAR_API_KEY;
  if (!apiKey) {
    return buildGravatarUrl(hash);
  }
  try {
    const response = await fetch(`https://api.gravatar.com/v3/profiles/${hash}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      return buildGravatarUrl(hash);
    }
    const data = await response.json();
    if (data?.avatar_url) {
      return String(data.avatar_url);
    }
  } catch {
    // ignore
  }
  return buildGravatarUrl(hash);
};

const consumeIpRateLimit = async ({ bucket, ip, maxPerWindow, windowMs = 60 * 1000 }) => {
  if (!ip) {
    return true;
  }
  try {
    const result = await rateLimiter.consume({
      bucket,
      key: ip,
      limit: maxPerWindow,
      windowMs,
    });
    if (!result?.allowed) {
      metricsRegistry.inc("rate_limit_reject_total", {
        bucket: String(bucket || "default"),
      });
    }
    return Boolean(result?.allowed);
  } catch {
    return true;
  }
};

const canSubmitComment = async (ip) =>
  consumeIpRateLimit({
    bucket: "comment_submit",
    ip,
    maxPerWindow: 3,
  });

const canAttemptAuth = async (ip) =>
  consumeIpRateLimit({
    bucket: "auth_attempt",
    ip,
    maxPerWindow: isProduction ? 20 : 120,
  });

const canUploadImage = async (ip) =>
  consumeIpRateLimit({
    bucket: "upload_image",
    ip,
    maxPerWindow: isProduction ? 20 : 120,
  });

const canBootstrap = async (ip) =>
  consumeIpRateLimit({
    bucket: "bootstrap_owner",
    ip,
    maxPerWindow: isProduction ? 5 : 60,
  });

const sanitizeSvg = (value) => {
  if (!value) return "";
  let output = value;
  output = output.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "");
  output = output.replace(/<\s*foreignObject[^>]*>[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, "");
  output = output.replace(/<\s*(iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  output = output.replace(/\son\w+\s*=\s*(["']).*?\1/gi, "");
  output = output.replace(/javascript:/gi, "");
  output = output.replace(/data:(?!image\/(png|jpe?g|gif|webp);base64)/gi, "");
  output = output.replace(/(href|xlink:href|src)\s*=\s*(["'])(.*?)\2/gi, (_m, attr, quote, url) => {
    const safe = String(url || "");
    if (safe.startsWith("#") || safe.startsWith("/")) {
      return `${attr}=${quote}${safe}${quote}`;
    }
    return "";
  });
  return output;
};

const canRegisterView = async (ip) =>
  consumeIpRateLimit({
    bucket: "register_view",
    ip,
    maxPerWindow: isProduction ? 60 : 300,
  });

const canRegisterPollVote = async (ip) =>
  consumeIpRateLimit({
    bucket: "poll_vote",
    ip,
    maxPerWindow: isProduction ? 20 : 120,
  });
const DELETE_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
const POST_VERSION_RETENTION_DAYS = 15;
const POST_VERSION_RETENTION_MS = POST_VERSION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const POST_VERSION_RETENTION_MAX = 50;
const isWithinRestoreWindow = (deletedAt) => {
  if (!deletedAt) {
    return false;
  }
  const ts = new Date(deletedAt).getTime();
  if (!Number.isFinite(ts)) {
    return false;
  }
  return Date.now() - ts <= DELETE_RETENTION_MS;
};
const pruneExpiredDeleted = (items) =>
  (Array.isArray(items) ? items : []).filter(
    (item) => !item?.deletedAt || isWithinRestoreWindow(item.deletedAt),
  );

const isPostVersionWithinRetention = (createdAt, nowMs = Date.now()) => {
  const createdAtMs = new Date(createdAt || 0).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }
  return nowMs - createdAtMs <= POST_VERSION_RETENTION_MS;
};

const buildSearchText = (...parts) =>
  parts
    .flat()
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const normalizePosts = (posts) => {
  const now = Date.now();
  return posts.map((post, index) => {
    const id = String(post.id || `${Date.now()}-${index}`);
    const title = String(post.title || "Sem título");
    const slug = String(post.slug || createSlug(title) || id);
    const publishedAt = post.publishedAt || post.createdAt || new Date().toISOString();
    const scheduledAt = post.scheduledAt || null;
    const status = resolvePostStatus(post.status, publishedAt, now);
    const normalized = {
      id,
      title,
      slug,
      coverImageUrl: post.coverImageUrl || null,
      coverAlt: post.coverAlt || "",
      excerpt: post.excerpt || "",
      content: post.content || "",
      contentFormat:
        post.contentFormat === "html" || post.contentFormat === "lexical"
          ? post.contentFormat
          : "markdown",
      author: post.author || "",
      publishedAt,
      scheduledAt,
      status,
      seoTitle: post.seoTitle || "",
      seoDescription: post.seoDescription || "",
      projectId: post.projectId || "",
      tags: Array.isArray(post.tags) ? post.tags.filter(Boolean) : [],
      views: Number.isFinite(post.views) ? post.views : 0,
      viewsDaily: post.viewsDaily && typeof post.viewsDaily === "object" ? post.viewsDaily : {},
      commentsCount: Number.isFinite(post.commentsCount) ? post.commentsCount : 0,
      deletedAt: post.deletedAt || null,
      deletedBy: post.deletedBy || null,
      createdAt: post.createdAt || new Date().toISOString(),
      updatedAt: post.updatedAt || post.createdAt || new Date().toISOString(),
    };
    normalized.searchText = buildSearchText(
      normalized.title,
      normalized.excerpt,
      normalized.author,
      ...(Array.isArray(normalized.tags) ? normalized.tags : []),
    );
    return normalizeUploadsDeep(normalized);
  });
};

const normalizePostVersionReason = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    normalized === "create" ||
    normalized === "update" ||
    normalized === "manual" ||
    normalized === "rollback"
  ) {
    return normalized;
  }
  return "update";
};

const buildPostVersionSnapshot = (postInput) => {
  const normalizedPost = normalizePosts([postInput || {}])[0] || normalizePosts([{}])[0];
  return {
    id: normalizedPost.id,
    slug: normalizedPost.slug,
    title: normalizedPost.title,
    status: normalizedPost.status,
    publishedAt: normalizedPost.publishedAt,
    scheduledAt: normalizedPost.scheduledAt || null,
    projectId: normalizedPost.projectId || "",
    excerpt: normalizedPost.excerpt || "",
    content: normalizedPost.content || "",
    contentFormat: normalizedPost.contentFormat || "markdown",
    author: normalizedPost.author || "",
    coverImageUrl: normalizedPost.coverImageUrl || null,
    coverAlt: normalizedPost.coverAlt || "",
    seoTitle: normalizedPost.seoTitle || "",
    seoDescription: normalizedPost.seoDescription || "",
    tags: Array.isArray(normalizedPost.tags) ? normalizedPost.tags.filter(Boolean) : [],
    updatedAt: normalizedPost.updatedAt || new Date().toISOString(),
  };
};

const normalizePostVersionSnapshot = (snapshotInput, fallback = {}) => {
  const source =
    snapshotInput && typeof snapshotInput === "object" && !Array.isArray(snapshotInput)
      ? snapshotInput
      : {};
  const seed = {
    id: String(source.id || fallback.postId || crypto.randomUUID()),
    slug: String(source.slug || fallback.slug || source.title || fallback.postId || "post"),
    title: String(source.title || fallback.title || "Sem título"),
    status: source.status,
    publishedAt: source.publishedAt || source.scheduledAt || new Date().toISOString(),
    scheduledAt: source.scheduledAt || null,
    projectId: source.projectId || "",
    excerpt: source.excerpt || "",
    content: source.content || "",
    contentFormat: source.contentFormat || "markdown",
    author: source.author || "",
    coverImageUrl: source.coverImageUrl || null,
    coverAlt: source.coverAlt || "",
    seoTitle: source.seoTitle || "",
    seoDescription: source.seoDescription || "",
    tags: Array.isArray(source.tags) ? source.tags : [],
    createdAt: source.createdAt || source.updatedAt || new Date().toISOString(),
    updatedAt: source.updatedAt || new Date().toISOString(),
  };
  return buildPostVersionSnapshot(seed);
};

const comparePostVersionNewestFirst = (left, right) => {
  const leftTs = new Date(left?.createdAt || 0).getTime();
  const rightTs = new Date(right?.createdAt || 0).getTime();
  const safeLeftTs = Number.isFinite(leftTs) ? leftTs : 0;
  const safeRightTs = Number.isFinite(rightTs) ? rightTs : 0;
  if (safeRightTs !== safeLeftTs) {
    return safeRightTs - safeLeftTs;
  }
  const leftVersion = Number(left?.versionNumber) || 0;
  const rightVersion = Number(right?.versionNumber) || 0;
  if (rightVersion !== leftVersion) {
    return rightVersion - leftVersion;
  }
  return String(right?.id || "").localeCompare(String(left?.id || ""), "pt-BR");
};

const normalizePostVersionRecords = (entries) => {
  const source = Array.isArray(entries) ? entries : [];
  const normalized = [];
  const seenIds = new Set();
  source.forEach((entry, index) => {
    const candidate = entry && typeof entry === "object" ? entry : {};
    const id = String(candidate.id || "").trim() || crypto.randomUUID();
    if (seenIds.has(id)) {
      return;
    }
    seenIds.add(id);
    const postId = String(candidate.postId || candidate?.snapshot?.id || "").trim();
    if (!postId) {
      return;
    }
    const createdAtRaw =
      candidate.createdAt || candidate?.snapshot?.updatedAt || new Date().toISOString();
    const createdAtParsed = new Date(createdAtRaw);
    const createdAt = Number.isFinite(createdAtParsed.getTime())
      ? createdAtParsed.toISOString()
      : new Date().toISOString();
    const fallbackSlug = String(candidate.slug || candidate?.snapshot?.slug || "").trim();
    const fallbackTitle = String(candidate?.snapshot?.title || "").trim();
    const snapshot = normalizePostVersionSnapshot(candidate.snapshot, {
      postId,
      slug: fallbackSlug,
      title: fallbackTitle,
    });
    const versionNumber = Number(candidate.versionNumber);
    normalized.push({
      id,
      postId,
      versionNumber:
        Number.isFinite(versionNumber) && versionNumber > 0 ? Math.floor(versionNumber) : index + 1,
      reason: normalizePostVersionReason(candidate.reason),
      label:
        typeof candidate.label === "string" && candidate.label.trim()
          ? String(candidate.label)
          : null,
      actorId:
        typeof candidate.actorId === "string" && candidate.actorId.trim()
          ? String(candidate.actorId)
          : null,
      actorName:
        typeof candidate.actorName === "string" && candidate.actorName.trim()
          ? String(candidate.actorName)
          : null,
      slug: snapshot.slug,
      createdAt,
      snapshot,
    });
  });
  normalized.sort((a, b) => {
    if (a.postId !== b.postId) {
      return a.postId.localeCompare(b.postId, "pt-BR");
    }
    const versionDiff = (Number(a.versionNumber) || 0) - (Number(b.versionNumber) || 0);
    if (versionDiff !== 0) {
      return versionDiff;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  return normalized;
};

const prunePostVersions = (entries, postId, maxVersionsPerPost = POST_VERSION_RETENTION_MAX) => {
  const normalized = normalizePostVersionRecords(entries).filter((item) =>
    isPostVersionWithinRetention(item.createdAt),
  );
  const safePostId = String(postId || "").trim();
  const safeMax = Math.max(1, Number(maxVersionsPerPost) || POST_VERSION_RETENTION_MAX);
  const grouped = new Map();
  normalized.forEach((item) => {
    if (safePostId && item.postId !== safePostId) {
      return;
    }
    const bucket = grouped.get(item.postId) || [];
    bucket.push(item);
    grouped.set(item.postId, bucket);
  });
  if (grouped.size === 0) {
    return normalized;
  }
  const keepIds = new Set();
  grouped.forEach((itemsByPost) => {
    dedupePostVersionRecordsNewestFirst(itemsByPost.sort(comparePostVersionNewestFirst))
      .slice(0, safeMax)
      .forEach((item) => keepIds.add(item.id));
  });
  return normalized.filter((item) => {
    if (safePostId) {
      return item.postId !== safePostId || keepIds.has(item.id);
    }
    return keepIds.has(item.id);
  });
};

const appendPostVersion = ({ post, reason, actor = null, label = null }) => {
  const normalizedPost = normalizePosts([post || {}])[0];
  if (!normalizedPost?.id) {
    return null;
  }
  const versions = loadPostVersions();
  const versionsForPost = versions.filter((item) => item.postId === normalizedPost.id);
  const nextVersionNumber =
    versionsForPost.reduce((max, item) => Math.max(max, Number(item.versionNumber) || 0), 0) + 1;
  const record = {
    id: crypto.randomUUID(),
    postId: normalizedPost.id,
    versionNumber: nextVersionNumber,
    reason: normalizePostVersionReason(reason),
    label: typeof label === "string" && label.trim() ? String(label).trim() : null,
    actorId: actor?.id ? String(actor.id) : null,
    actorName: actor?.name ? String(actor.name) : null,
    slug: normalizedPost.slug,
    createdAt: new Date().toISOString(),
    snapshot: buildPostVersionSnapshot(normalizedPost),
  };
  const nextEntries = prunePostVersions(
    [...versions, record],
    normalizedPost.id,
    POST_VERSION_RETENTION_MAX,
  );
  writePostVersions(nextEntries);
  return record;
};

const encodePostVersionCursor = (item) => {
  const createdAt = encodeURIComponent(String(item?.createdAt || ""));
  const id = encodeURIComponent(String(item?.id || ""));
  return `${createdAt}|${id}`;
};

const decodePostVersionCursor = (cursor) => {
  const raw = String(cursor || "").trim();
  if (!raw.includes("|")) {
    return null;
  }
  const [createdAtRaw, idRaw] = raw.split("|");
  const createdAt = decodeURIComponent(createdAtRaw || "");
  const id = decodeURIComponent(idRaw || "");
  if (!createdAt || !id) {
    return null;
  }
  return { createdAt, id };
};

const listPostVersions = (postId, options = {}) => {
  const safePostId = String(postId || "").trim();
  if (!safePostId) {
    return { versions: [], nextCursor: null };
  }
  const limitRaw = Number(options.limit);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 20, 1), 100);
  const cursor = decodePostVersionCursor(options.cursor);
  let versions = loadPostVersions()
    .filter((item) => item.postId === safePostId)
    .sort(comparePostVersionNewestFirst);
  if (cursor) {
    const cursorTs = new Date(cursor.createdAt).getTime();
    versions = versions.filter((item) => {
      const itemTs = new Date(item.createdAt).getTime();
      if (itemTs < cursorTs) {
        return true;
      }
      if (itemTs > cursorTs) {
        return false;
      }
      return String(item.id) < String(cursor.id);
    });
  }
  const slice = versions.slice(0, limit);
  const nextCursor =
    versions.length > limit ? encodePostVersionCursor(slice[slice.length - 1]) : null;
  return { versions: slice, nextCursor };
};

const applyPostSnapshotForRollback = ({ existingPost, snapshot, allPosts }) => {
  const current = normalizePosts([existingPost || {}])[0];
  if (!current?.id) {
    return null;
  }
  const safeSnapshot = normalizePostVersionSnapshot(snapshot, {
    postId: current.id,
    slug: current.slug,
    title: current.title,
  });
  const otherSlugs = normalizePosts(Array.isArray(allPosts) ? allPosts : [])
    .filter((item) => item.id !== current.id)
    .map((item) => item.slug);
  const requestedSlug =
    createSlug(safeSnapshot.slug || safeSnapshot.title || current.slug) || current.slug;
  const resolvedSlug = createUniqueSlug(requestedSlug, otherSlugs);
  const updated = normalizePosts([
    {
      ...current,
      ...safeSnapshot,
      id: current.id,
      slug: resolvedSlug,
      views: current.views,
      viewsDaily: current.viewsDaily,
      commentsCount: current.commentsCount,
      deletedAt: current.deletedAt,
      deletedBy: current.deletedBy,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    },
  ])[0];
  return updated;
};

const postVersionReasonLabel = (reason) => {
  if (reason === "create") return "Criação";
  if (reason === "manual") return "Manual";
  if (reason === "rollback") return "Rollback";
  return "Atualização";
};

const normalizeProjects = (projects) =>
  projects.map((project, index) => {
    const sourceVolumeEntries = Array.isArray(project?.volumeEntries)
      ? project.volumeEntries
      : Array.isArray(project?.volumeCovers)
        ? project.volumeCovers
        : [];
    const normalizedVolumeEntries = sourceVolumeEntries
      .map((entry) => {
        const volume = Number.isFinite(Number(entry?.volume)) ? Number(entry.volume) : null;
        if (volume === null) {
          return null;
        }
        const coverImageUrl = String(entry?.coverImageUrl || "").trim();
        return {
          volume,
          synopsis: String(entry?.synopsis || "").trim(),
          coverImageUrl,
          coverImageAlt: coverImageUrl
            ? String(entry?.coverImageAlt || `Capa do volume ${volume}`).trim()
            : "",
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.volume - right.volume);
    const normalizedVolumeCovers = normalizedVolumeEntries
      .filter((entry) => String(entry?.coverImageUrl || "").trim())
      .map((entry) => ({
        volume: entry.volume,
        coverImageUrl: String(entry.coverImageUrl || "").trim(),
        coverImageAlt: String(entry.coverImageAlt || `Capa do volume ${entry.volume}`).trim(),
      }));
    const normalizedEpisodeDownloads = Array.isArray(project.episodeDownloads)
      ? project.episodeDownloads.map((episode) => {
          const episodeObject = episode && typeof episode === "object" ? episode : {};
          const { synopsis: _episodeSynopsis, ...episodeWithoutSynopsis } = episodeObject;
          const normalizedSources = Array.isArray(episode?.sources)
            ? episode.sources.map((source) => {
                const label = String(source?.label || "");
                const url = String(source?.url || "");
                return {
                  label,
                  url,
                };
              })
            : [];
          const legacyHash = Array.isArray(episode?.sources)
            ? String(
                episode.sources.find((source) => String(source?.hash || "").trim())?.hash || "",
              ).trim()
            : "";
          const legacyRawSizeBytes = Array.isArray(episode?.sources)
            ? Number(
                episode.sources.find((source) => {
                  const parsed = Number(source?.sizeBytes);
                  return Number.isFinite(parsed) && parsed > 0;
                })?.sizeBytes,
              )
            : Number.NaN;
          const hash = String(episode?.hash || "").trim() || legacyHash;
          const rawSizeBytes = Number(episode?.sizeBytes);
          const resolvedRawSizeBytes =
            Number.isFinite(rawSizeBytes) && rawSizeBytes > 0 ? rawSizeBytes : legacyRawSizeBytes;
          const sizeBytes =
            Number.isFinite(resolvedRawSizeBytes) && resolvedRawSizeBytes > 0
              ? Math.round(resolvedRawSizeBytes)
              : undefined;
          const entryKind =
            String(episodeObject?.entryKind || "")
              .trim()
              .toLowerCase() === "extra"
              ? "extra"
              : "main";
          const readingOrderRaw = Number(episodeObject?.readingOrder);
          const readingOrder = Number.isFinite(readingOrderRaw)
            ? Math.round(readingOrderRaw)
            : undefined;
          const normalizedPages = normalizeProjectEpisodePages(episodeObject?.pages);
          const contentFormat = normalizeProjectEpisodeContentFormat(
            episode?.contentFormat,
            normalizedPages.length > 0 ? "images" : "lexical",
          );
          const pageCount = getProjectEpisodePageCount({
            ...episodeObject,
            contentFormat,
            pages: normalizedPages,
          });
          const requestedCoverImageUrl = String(episode?.coverImageUrl || "").trim();
          const coverImageUrl =
            requestedCoverImageUrl ||
            (contentFormat === "images" ? String(normalizedPages[0]?.imageUrl || "").trim() : "");
          return {
            ...episodeWithoutSynopsis,
            number: Number.isFinite(Number(episode?.number)) ? Number(episode.number) : 0,
            volume: Number.isFinite(Number(episode?.volume)) ? Number(episode.volume) : undefined,
            title: String(episode?.title || ""),
            entryKind,
            entrySubtype: String(episodeObject?.entrySubtype || "").trim() || undefined,
            readingOrder,
            displayLabel:
              entryKind === "extra"
                ? String(episodeObject?.displayLabel || "").trim() || undefined
                : undefined,
            releaseDate: String(episode?.releaseDate || ""),
            duration: String(episode?.duration || ""),
            sourceType:
              episodeObject?.sourceType === "Blu-ray" || episodeObject?.sourceType === "Web"
                ? episodeObject.sourceType
                : episodeObject?.sourceType === "Blu-Ray"
                  ? "Blu-ray"
                  : "TV",
            coverImageUrl: coverImageUrl || undefined,
            content: typeof episode?.content === "string" ? episode.content : "",
            contentFormat,
            pages: normalizedPages,
            pageCount,
            hasPages: pageCount > 0,
            publicationStatus:
              String(episodeObject?.publicationStatus || "")
                .trim()
                .toLowerCase() === "draft"
                ? "draft"
                : "published",
            sources: normalizedSources,
            coverImageAlt: String(episode?.coverImageAlt || episode?.title || "").trim(),
            hash: hash || undefined,
            sizeBytes,
            chapterUpdatedAt: episodeObject.chapterUpdatedAt || "",
          };
        })
      : [];

    const normalized = {
      id: String(project.id || `project-${Date.now()}-${index}`),
      anilistId: project.anilistId ? Number(project.anilistId) : null,
      title: String(project.title || "Sem título"),
      titleOriginal: String(project.titleOriginal || ""),
      titleEnglish: String(project.titleEnglish || ""),
      synopsis: String(project.synopsis || ""),
      description: String(project.description || ""),
      type: String(project.type || project.format || ""),
      status: String(project.status || ""),
      year: String(project.year || ""),
      studio: String(project.studio || ""),
      animationStudios: Array.isArray(project.animationStudios)
        ? project.animationStudios.filter(Boolean)
        : [],
      episodes: String(project.episodes || ""),
      tags: Array.isArray(project.tags) ? project.tags.filter(Boolean) : [],
      genres: Array.isArray(project.genres) ? project.genres.filter(Boolean) : [],
      cover: project.cover || "/placeholder.svg",
      coverAlt: String(project.coverAlt || project.title || "Capa do projeto").trim(),
      banner: project.banner || "/placeholder.svg",
      bannerAlt: String(project.bannerAlt || `${project.title || "Projeto"} (banner)`).trim(),
      season: String(project.season || ""),
      schedule: String(project.schedule || ""),
      rating: String(project.rating || ""),
      country: String(project.country || ""),
      source: String(project.source || ""),
      discordRoleId: /^\d+$/.test(String(project.discordRoleId || "").trim())
        ? String(project.discordRoleId || "").trim()
        : "",
      producers: Array.isArray(project.producers) ? project.producers.filter(Boolean) : [],
      score: Number.isFinite(project.score) ? project.score : null,
      startDate: project.startDate || "",
      endDate: project.endDate || "",
      relations: Array.isArray(project.relations) ? project.relations : [],
      staff: Array.isArray(project.fansubStaff)
        ? project.fansubStaff
        : Array.isArray(project.staff)
          ? project.staff
          : [],
      animeStaff: Array.isArray(project.animeStaff) ? project.animeStaff : [],
      trailerUrl: project.trailerUrl || "",
      forceHero: Boolean(project.forceHero),
      heroImageUrl: String(project.heroImageUrl || ""),
      heroImageAlt: String(project.heroImageAlt || `${project.title || "Projeto"} (hero)`).trim(),
      readerConfig: normalizeProjectReaderConfig(project.readerConfig, {
        projectType: project.type || project.format || "",
      }),
      volumeEntries: normalizedVolumeEntries,
      volumeCovers: normalizedVolumeCovers,
      episodeDownloads: normalizedEpisodeDownloads,
      views: Number.isFinite(project.views) ? project.views : 0,
      viewsDaily:
        project.viewsDaily && typeof project.viewsDaily === "object" ? project.viewsDaily : {},
      commentsCount: Number.isFinite(project.commentsCount) ? project.commentsCount : 0,
      order: Number.isFinite(project.order) ? project.order : index,
      deletedAt: project.deletedAt || null,
      deletedBy: project.deletedBy || null,
      createdAt: project.createdAt || new Date().toISOString(),
      updatedAt: project.updatedAt || project.createdAt || new Date().toISOString(),
    };
    normalized.searchText = buildSearchText(
      normalized.title,
      normalized.titleOriginal,
      normalized.titleEnglish,
      normalized.synopsis,
      normalized.description,
      normalized.type,
      normalized.status,
      normalized.studio,
      ...(Array.isArray(normalized.animationStudios) ? normalized.animationStudios : []),
      ...(Array.isArray(normalized.producers) ? normalized.producers : []),
      ...(Array.isArray(normalized.tags) ? normalized.tags : []),
      ...(Array.isArray(normalized.genres) ? normalized.genres : []),
    );
    return normalizeUploadsDeep(normalized);
  });

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const incrementPostViews = (slug) => {
  const posts = normalizePosts(loadPosts());
  const index = posts.findIndex((post) => post.slug === String(slug));
  if (index === -1) {
    return null;
  }
  const existing = posts[index];
  const nextViews = Number.isFinite(existing.views) ? existing.views + 1 : 1;
  const todayKey = getTodayKey();
  const nextViewsDaily = {
    ...(existing.viewsDaily || {}),
    [todayKey]: Number.isFinite(existing.viewsDaily?.[todayKey])
      ? existing.viewsDaily[todayKey] + 1
      : 1,
  };
  posts[index] = {
    ...existing,
    views: nextViews,
    viewsDaily: nextViewsDaily,
  };
  writePosts(posts);
  return posts[index];
};

const incrementProjectViews = (id) => {
  const projects = normalizeProjects(loadProjects());
  const index = projects.findIndex((project) => project.id === String(id));
  if (index === -1) {
    return null;
  }
  const existing = projects[index];
  const nextViews = Number.isFinite(existing.views) ? existing.views + 1 : 1;
  const todayKey = getTodayKey();
  const nextViewsDaily = {
    ...(existing.viewsDaily || {}),
    [todayKey]: Number.isFinite(existing.viewsDaily?.[todayKey])
      ? existing.viewsDaily[todayKey] + 1
      : 1,
  };
  projects[index] = {
    ...existing,
    views: nextViews,
    viewsDaily: nextViewsDaily,
  };
  writeProjects(projects);
  return projects[index];
};

const countApprovedComments = (comments, targetType, targetId) =>
  comments.filter(
    (comment) =>
      comment.status === "approved" &&
      comment.targetType === targetType &&
      comment.targetId === targetId,
  ).length;

const applyCommentCountToPosts = (posts, comments, targetId) => {
  const next = [...posts];
  const index = next.findIndex((post) => post.slug === targetId || post.id === targetId);
  if (index === -1) {
    return next;
  }
  next[index] = {
    ...next[index],
    commentsCount: countApprovedComments(comments, "post", next[index].slug),
    updatedAt: new Date().toISOString(),
  };
  return next;
};

const applyCommentCountToProjects = (projects, comments, targetId) => {
  const next = [...projects];
  const index = next.findIndex((project) => project.id === targetId);
  if (index === -1) {
    return next;
  }
  next[index] = {
    ...next[index],
    commentsCount: countApprovedComments(comments, "project", next[index].id),
    updatedAt: new Date().toISOString(),
  };
  return next;
};

const normalizeTypeLookupKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const dedupeProjectTypes = (typesInput) => {
  const map = new Map();
  (Array.isArray(typesInput) ? typesInput : []).forEach((raw) => {
    const type = String(raw || "").trim();
    const key = normalizeTypeLookupKey(type);
    if (!type || !key || map.has(key)) {
      return;
    }
    map.set(key, type);
  });
  return Array.from(map.values()).sort((left, right) =>
    left.localeCompare(right, "pt-BR", { sensitivity: "base" }),
  );
};

const getActiveProjectTypes = ({ includeDefaults = true } = {}) => {
  const existingTypes = normalizeProjects(loadProjects())
    .filter((project) => !project.deletedAt)
    .map((project) => String(project.type || "").trim())
    .filter(Boolean);
  const deduped = dedupeProjectTypes(existingTypes);
  if (deduped.length > 0) {
    return deduped;
  }
  return includeDefaults ? dedupeProjectTypes(DEFAULT_PROJECT_TYPE_CATALOG) : [];
};

const isChapterBasedType = (type) => {
  const normalized = normalizeTypeLookupKey(type);
  return (
    normalized.includes("mang") ||
    normalized.includes("webtoon") ||
    normalized.includes("light") ||
    normalized.includes("novel")
  );
};

const isLightNovelType = (type) => {
  const normalized = normalizeTypeLookupKey(type);
  return normalized.includes("light") || normalized.includes("novel");
};

const collectEpisodeUpdates = (prevProject, nextProject) => {
  const updates = [];
  const prevEpisodes = Array.isArray(prevProject?.episodeDownloads)
    ? prevProject.episodeDownloads
    : [];
  const nextEpisodes = Array.isArray(nextProject?.episodeDownloads)
    ? nextProject.episodeDownloads
    : [];
  const prevMap = new Map(prevEpisodes.map((ep) => [Number(ep.number), ep]));
  const isLightNovel = isLightNovelType(nextProject?.type || "");
  nextEpisodes.forEach((ep) => {
    const number = Number(ep.number);
    const unitLabel = resolveProjectUpdateUnitLabel(nextProject?.type || "", ep);
    const sources = Array.isArray(ep.sources) ? ep.sources.filter((s) => s.url) : [];
    const hasContent = typeof ep.content === "string" && ep.content.trim().length > 0;
    if (!sources.length && !(isLightNovel && hasContent)) {
      return;
    }
    const prev = prevMap.get(number);
    const prevSources = Array.isArray(prev?.sources) ? prev.sources.filter((s) => s.url) : [];
    const prevContent = typeof prev?.content === "string" ? prev.content.trim() : "";
    const urls = sources
      .map((s) => s.url)
      .sort()
      .join("|");
    const prevUrls = prevSources
      .map((s) => s.url)
      .sort()
      .join("|");
    if (isLightNovel) {
      const chapterUpdatedAt = ep.chapterUpdatedAt || "";
      const prevSignature = [
        String(prev?.title || ""),
        String(prev?.releaseDate || ""),
        prevContent,
      ].join("||");
      const nextSignature = [
        String(ep.title || ""),
        String(ep.releaseDate || ""),
        String(ep.content || "").trim(),
      ].join("||");
      if (!prev || !prevContent) {
        if (!chapterUpdatedAt) {
          return;
        }
        updates.push({
          kind: "Lançamento",
          reason: `${unitLabel} ${number} disponível`,
          episodeNumber: number,
          unit: unitLabel,
          updatedAt: chapterUpdatedAt,
        });
        return;
      }
      if (nextSignature !== prevSignature) {
        updates.push({
          kind: "Ajuste",
          reason: `Conteúdo ajustado no ${unitLabel.toLowerCase()} ${number}`,
          episodeNumber: number,
          unit: unitLabel,
          updatedAt: chapterUpdatedAt || new Date().toISOString(),
        });
      }
      return;
    }
    if (!prev || prevSources.length === 0) {
      updates.push({
        kind: "Lançamento",
        reason: `${unitLabel} ${number} disponível`,
        episodeNumber: number,
        unit: unitLabel,
      });
      return;
    }
    if (urls !== prevUrls) {
      const newUrlSet = new Set(sources.map((s) => s.url));
      const addedOnly =
        sources.length > prevSources.length && prevSources.every((s) => newUrlSet.has(s.url));
      updates.push({
        kind: "Ajuste",
        reason: addedOnly
          ? `Novo link adicionado no ${unitLabel.toLowerCase()} ${number}`
          : `Links ajustados no ${unitLabel.toLowerCase()} ${number}`,
        episodeNumber: number,
        unit: unitLabel,
      });
    }
  });
  return updates;
};

const resolveProjectWebhookEventKey = (kind) => {
  const normalized = String(kind || "")
    .trim()
    .toLowerCase();
  if (normalized.startsWith("lan")) {
    return "project_release";
  }
  if (normalized.startsWith("aju")) {
    return "project_adjust";
  }
  return "";
};

const findProjectChapterByEpisodeNumber = (project, episodeNumber, volume) => {
  const lookup = resolveEpisodeLookup(project, episodeNumber, volume);
  if (!lookup.ok) {
    return null;
  }
  const chapter = lookup.episode;
  const synopsis = deriveChapterSynopsis(chapter);
  return {
    number: Number.isFinite(Number(chapter.number))
      ? Number(chapter.number)
      : Number(episodeNumber),
    volume: Number.isFinite(Number(chapter.volume)) ? Number(chapter.volume) : "",
    title: String(chapter.title || ""),
    synopsis,
    content: String(chapter.content || ""),
    releaseDate: String(chapter.releaseDate || ""),
    updatedAt: String(chapter.chapterUpdatedAt || chapter.updatedAt || ""),
    coverImageUrl: String(chapter.coverImageUrl || ""),
  };
};

const createWebhookAuditReqFromContext = (contextInput = {}) =>
  createWebhookAuditReqFromContextBase(contextInput, crypto.randomUUID);

const resolveWebhookAuditActions = (scope) =>
  resolveWebhookAuditActionsBase(scope, WEBHOOK_DELIVERY_SCOPE);

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
    id: crypto.randomUUID(),
    scope: String(scope || "").trim(),
    provider: String(provider || "").trim().toLowerCase(),
    channel: String(channel || "").trim() || null,
    eventKey: String(eventKey || "").trim() || null,
    status: WEBHOOK_DELIVERY_STATUS.QUEUED,
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

const prepareEditorialWebhookDispatch = ({
  eventKey,
  post = null,
  project = null,
  update = null,
  chapter = null,
  settings: settingsInput = null,
  allowDisabled = false,
} = {}) => {
  const channelKey = resolveEditorialEventChannel(eventKey);
  if (!channelKey) {
    return { ok: false, status: "skipped", code: "invalid_event_key" };
  }
  const projectTypes = getActiveProjectTypes();
  const baseSettings =
    settingsInput && typeof settingsInput === "object"
      ? settingsInput
      : loadIntegrationSettings().editorial;
  const settings = normalizeEditorialWebhookSettings(baseSettings, {
    projectTypes,
  });
  const channel = settings?.channels?.[channelKey];
  if (!channel || typeof channel !== "object") {
    return { ok: false, status: "skipped", code: "missing_channel", channel: channelKey };
  }
  if (!allowDisabled && channel.enabled !== true) {
    return { ok: false, status: "skipped", code: "channel_disabled", channel: channelKey };
  }
  if (!allowDisabled && channel?.events?.[eventKey] !== true) {
    return { ok: false, status: "skipped", code: "event_disabled", channel: channelKey };
  }

  const webhookUrl = String(channel?.webhookUrl || "").trim();
  if (!webhookUrl) {
    return { ok: false, status: "skipped", code: "missing_webhook_url", channel: channelKey };
  }
  const webhookValidation = validateWebhookUrlForProvider({
    provider: "discord",
    webhookUrl,
  });
  if (!webhookValidation.ok) {
    return { ok: false, status: "failed", code: webhookValidation.code, channel: channelKey };
  }

  const template = channel?.templates?.[eventKey];
  if (!template || typeof template !== "object") {
    return { ok: false, status: "skipped", code: "missing_template", channel: channelKey };
  }

  const safeProject =
    project && typeof project === "object"
      ? project
      : post?.projectId
        ? normalizeProjects(loadProjects()).find((item) => item.id === String(post.projectId)) ||
          null
        : null;
  const safeChapter =
    chapter && typeof chapter === "object"
      ? chapter
      : safeProject
        ? findProjectChapterByEpisodeNumber(safeProject, update?.episodeNumber, update?.volume)
        : null;
  const author = resolveEditorialAuthorFromPost(post);
  const safePost =
    post && typeof post === "object"
      ? {
          ...post,
          authorAvatarUrl: author.avatarUrl || String(post.authorAvatarUrl || "").trim(),
        }
      : post;
  const mentions = buildEditorialMentions({
    settings,
    eventKey,
    projectType: safeProject?.type || "",
    projectDiscordRoleId: safeProject?.discordRoleId || "",
    includeProjectRole: channelKey === "projects",
  });
  const occurredAt =
    String(update?.updatedAt || safePost?.updatedAt || safeProject?.updatedAt || "").trim() ||
    new Date().toISOString();
  const siteSettings = loadSiteSettings();
  const translations = loadTagTranslations();
  const siteName = String(siteSettings?.site?.name || "Nekomata").trim() || "Nekomata";
  const siteUrl = PRIMARY_APP_ORIGIN;
  const siteLogoUrl =
    String(
      siteSettings?.site?.logoUrl ||
        siteSettings?.branding?.assets?.symbolUrl ||
        siteSettings?.branding?.assets?.wordmarkUrl ||
        "",
    ).trim() || "";
  const siteCoverImageUrl = String(siteSettings?.site?.defaultShareImage || "").trim();
  const siteFaviconUrl = String(siteSettings?.site?.faviconUrl || "").trim();
  const imageContext = buildEditorialWebhookImageContext({
    post: safePost,
    project: safeProject,
    chapter: safeChapter,
    settings: siteSettings,
    translations,
  });
  const context = buildEditorialEventContext({
    eventKey,
    occurredAt,
    siteName,
    siteUrl,
    siteLogoUrl,
    siteCoverImageUrl,
    siteFaviconUrl,
    origin: PRIMARY_APP_ORIGIN,
    mentions,
    author,
    post: safePost,
    project: safeProject,
    chapter: safeChapter,
    update,
    postImageUrl: imageContext.postImageUrl,
    postOgImageUrl: imageContext.postOgImageUrl,
    projectImageUrl: imageContext.projectImageUrl,
    projectBackdropImageUrl: imageContext.projectBackdropImageUrl,
    projectOgImageUrl: imageContext.projectOgImageUrl,
    chapterImageUrl: imageContext.chapterImageUrl,
    chapterOgImageUrl: imageContext.chapterOgImageUrl,
  });
  const rendered = renderWebhookTemplate(template, context);
  const payload = toDiscordWebhookPayload({
    content: rendered?.content || "",
    origin: PRIMARY_APP_ORIGIN,
    embed: {
      title: rendered?.embed?.title || "",
      description: rendered?.embed?.description || "",
      footerText: rendered?.embed?.footerText || rendered?.embed?.footer || "",
      footerIconUrl: rendered?.embed?.footerIconUrl || "",
      url: rendered?.embed?.url || "",
      color: rendered?.embed?.color || "",
      authorName: rendered?.embed?.authorName || "",
      authorIconUrl: rendered?.embed?.authorIconUrl || "",
      authorUrl: rendered?.embed?.authorUrl || "",
      thumbnailUrl: rendered?.embed?.thumbnailUrl || "",
      imageUrl: rendered?.embed?.imageUrl || "",
      fields: Array.isArray(rendered?.embed?.fields) ? rendered.embed.fields : [],
      timestamp: occurredAt,
    },
    allowedMentionsRoleIds: mentions.roleIds || [],
  });
  const hasContent = String(payload?.content || "").trim().length > 0;
  const hasEmbeds = Array.isArray(payload?.embeds) && payload.embeds.length > 0;
  if (!hasContent && !hasEmbeds) {
    return { ok: false, status: "skipped", code: "empty_payload", channel: channelKey };
  }

  return {
    ok: true,
    channel: channelKey,
    eventKey,
    webhookUrl,
    targetLabel: buildWebhookTargetLabel(webhookValidation.url),
    timeoutMs: clampWebhookInteger(channel.timeoutMs, 1000, 30000, 5000),
    retries: clampWebhookInteger(channel.retries, 0, 5, 1),
    maxAttempts: clampWebhookInteger(channel.retries, 0, 5, 1) + 1,
    payload,
    mentionsRoleIds: Array.isArray(mentions.roleIds) ? mentions.roleIds : [],
    context,
  };
};

const dispatchEditorialWebhookEvent = async ({
  eventKey,
  post = null,
  project = null,
  update = null,
  chapter = null,
  req = null,
} = {}) => {
  const actorReq = req || createSystemAuditReq();
  const prepared = prepareEditorialWebhookDispatch({
    eventKey,
    post,
    project,
    update,
    chapter,
  });
  if (!prepared.ok) {
    appendAuditLog(actorReq, "editorial_webhook.skipped", "integrations", {
      eventKey,
      channel: prepared.channel || resolveEditorialEventChannel(eventKey),
      code: prepared.code || "skipped",
      postId: post?.id || null,
      projectId: project?.id || post?.projectId || null,
    });
    return prepared;
  }

  const queued = enqueueWebhookDelivery({
    scope: WEBHOOK_DELIVERY_SCOPE.EDITORIAL,
    provider: "discord",
    webhookUrl: prepared.webhookUrl,
    payload: prepared.payload,
    channel: prepared.channel,
    eventKey: prepared.eventKey,
    timeoutMs: prepared.timeoutMs,
    maxAttempts: prepared.maxAttempts,
    targetLabel: prepared.targetLabel,
    context: {
      ...prepared.context,
      eventLabel: resolveEditorialEventLabel(eventKey),
      postId: post?.id || "",
      projectId: project?.id || post?.projectId || "",
      actorId: actorReq.session?.user?.id || "system",
      actorName: actorReq.session?.user?.name || "System",
      actorIp: actorReq.ip || actorReq.headers?.["x-forwarded-for"] || "",
      requestId: actorReq.requestId || "",
    },
  });
  if (!queued.ok) {
    appendAuditLog(actorReq, "editorial_webhook.failed", "integrations", {
      eventKey,
      eventLabel: resolveEditorialEventLabel(eventKey),
      channel: prepared.channel,
      code: queued.code || "delivery_enqueue_failed",
      postId: post?.id || null,
      projectId: project?.id || post?.projectId || null,
    });
    return queued;
  }

  appendAuditLog(actorReq, "editorial_webhook.queued", "integrations", {
    ...buildWebhookAuditMeta(queued.delivery),
    attempt: 0,
  });
  void runWebhookDeliveryWorkerTick();

  return {
    ...queued,
    eventKey,
    channel: prepared.channel,
  };
};

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
};

const createDiscordAvatarUrl = (user) => {
  if (!user?.avatar) {
    return null;
  }
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
};

const syncPersistedDiscordAvatarForLogin = ({ userId, discordAvatarUrl }) => {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return;
  }
  let users = normalizeUsers(loadUsers());
  const targetIndex = users.findIndex((user) => user.id === normalizedUserId);
  if (targetIndex === -1) {
    return;
  }
  const existing = users[targetIndex];
  if (
    !shouldSyncDiscordAvatarToStoredUser({
      storedAvatarUrl: existing?.avatarUrl,
      discordAvatarUrl,
    })
  ) {
    return;
  }
  users[targetIndex] = {
    ...existing,
    avatarUrl: String(discordAvatarUrl || "").trim() || null,
  };
  users = isRbacV2Enabled
    ? enforceUserAccessInvariants(users)
    : normalizeUsers(users).map((user) =>
        isOwner(user.id) ? { ...user, status: "active", permissions: ["*"] } : user,
      );
  users.sort((a, b) => a.order - b.order);
  writeUsers(users);
  syncAllowedUsers(users);
};

const withEffectiveAvatarUrl = (user, fallbackAvatarUrl = null) => {
  if (!user) {
    return user;
  }
  return {
    ...user,
    avatarUrl:
      resolveEffectiveUserAvatarUrl({
        storedAvatarUrl: user?.avatarUrl,
        fallbackAvatarUrl,
      }) || null,
  };
};

const resolveDiscordAvatarFallbackUrl = (value) =>
  isDiscordAvatarUrl(value) ? String(value || "").trim() : null;

const buildUserProfileRevisionToken = (user, uploadsInput = null) =>
  createRevisionToken({
    id: String(user?.id || ""),
    name: String(user?.name || ""),
    username: String(user?.username || ""),
    avatarUrl: String(user?.avatarUrl || ""),
    avatarDisplay: normalizeAvatarDisplay(user?.avatarDisplay),
    avatarRenderVersion: resolveUserAvatarRenderVersion({
      avatarUrl: user?.avatarUrl,
      uploads: Array.isArray(uploadsInput) ? uploadsInput : loadUploads(),
    }),
  });

const withUserProfileRevision = (user, uploadsInput = null) => ({
  ...user,
  revision: buildUserProfileRevisionToken(user, uploadsInput),
});

const syncSessionUserDisplayProfile = (req, user, uploadsInput = null) => {
  if (!req?.session?.user || !user) {
    return;
  }
  const resolvedAvatarUrl =
    resolveEffectiveUserAvatarUrl({
      storedAvatarUrl: user?.avatarUrl,
      fallbackAvatarUrl: resolveDiscordAvatarFallbackUrl(req.session.user?.avatarUrl),
    }) || null;
  const nextSessionUser = {
    ...req.session.user,
    name: String(user?.name || req.session.user.name || ""),
    phrase: String(user?.phrase || ""),
    bio: String(user?.bio || ""),
    avatarUrl: resolvedAvatarUrl,
    avatarDisplay: normalizeAvatarDisplay(user?.avatarDisplay),
  };
  req.session.user = withUserProfileRevision(nextSessionUser, uploadsInput);
};

const buildUserPayload = (sessionUser) => {
  ensureOwnerUser(sessionUser);
  const users = normalizeUsers(loadUsers());
  const matched = users.find((user) => user.id === String(sessionUser.id));
  const uploads = loadUploads();
  const ownerIds = loadOwnerIds().map((id) => String(id));
  const primaryOwnerId = ownerIds[0] ? String(ownerIds[0]) : null;
  const accessRole = computeEffectiveAccessRole({
    userId: sessionUser?.id,
    accessRole: matched?.accessRole || AccessRole.NORMAL,
    ownerIds,
    primaryOwnerId,
  });
  const grants = computeGrants({
    userId: sessionUser?.id,
    accessRole,
    permissions: matched?.permissions,
    ownerIds,
    primaryOwnerId,
    acceptLegacyStar: isRbacV2AcceptLegacyStar,
  });
  const roles = addOwnerRoleLabel(
    matched?.roles || [],
    ownerIds.includes(String(sessionUser?.id || "")),
  );
  const avatarUrl =
    resolveEffectiveUserAvatarUrl({
      storedAvatarUrl: matched?.avatarUrl,
      fallbackAvatarUrl: resolveDiscordAvatarFallbackUrl(sessionUser?.avatarUrl),
    }) || null;
  const payload = {
    ...sessionUser,
    name: String(matched?.name || sessionUser?.name || ""),
    phrase: String(matched?.phrase || sessionUser?.phrase || ""),
    bio: String(matched?.bio || sessionUser?.bio || ""),
    avatarUrl,
    avatarDisplay: normalizeAvatarDisplay(matched?.avatarDisplay || sessionUser?.avatarDisplay),
    socials: matched?.socials || sessionUser?.socials || [],
    favoriteWorks: matched?.favoriteWorks || sessionUser?.favoriteWorks || {},
    status: matched?.status || sessionUser?.status || "active",
    permissions: permissionsForRead(matched?.permissions || []),
    roles,
    accessRole,
    ownerIds,
    primaryOwnerId,
    grants,
  };
  return withUserProfileRevision(payload, uploads);
};

const getRepositoryHealthSnapshot = () => {
  if (!dataRepository || typeof dataRepository.getHealthSnapshot !== "function") {
    return {
      queueDepth: 0,
      oldestPendingMs: 0,
      lastPersistStartedAt: null,
      lastPersistCompletedAt: null,
      lastPersistErrorAt: null,
      lastPersistErrorLabel: null,
      lastPersistErrorMessage: null,
    };
  }
  return dataRepository.getHealthSnapshot();
};

const OPERATIONAL_PERSIST_ERROR_RECENT_WINDOW_MS = 15 * 60 * 1000;

const buildMaintenanceHealthCheck = () => ({
  name: "maintenance_mode",
  status: isMaintenanceMode ? "warning" : "ok",
  message: isMaintenanceMode ? "Modo de manutenção ativo." : "Modo de manutenção desativado.",
});

const buildSessionConfigHealthCheck = () => ({
  name: "session_config",
  status: sessionCookieConfig.usesDefaultSecretInProduction ? "warning" : "ok",
  message: sessionCookieConfig.usesDefaultSecretInProduction
    ? "SESSION_SECRET fallback em produção."
    : "Configuração de sessão válida.",
  meta: {
    cookieName: sessionCookieConfig.name,
    secure: Boolean(sessionCookieConfig.cookie?.secure),
    sameSite: sessionCookieConfig.cookie?.sameSite || "lax",
    path: sessionCookieConfig.cookie?.path || "/",
  },
});

const buildRepositoryHealthCheck = () => {
  const snapshot = getRepositoryHealthSnapshot();
  const lastErrorTs = snapshot.lastPersistErrorAt
    ? new Date(snapshot.lastPersistErrorAt).getTime()
    : null;
  const hasRecentError =
    Number.isFinite(lastErrorTs) &&
    Date.now() - Number(lastErrorTs) <= OPERATIONAL_PERSIST_ERROR_RECENT_WINDOW_MS;
  const backlog =
    Number(snapshot.queueDepth || 0) > 10 || Number(snapshot.oldestPendingMs || 0) > 30_000;
  return {
    name: "data_repository",
    status: hasRecentError ? "warning" : backlog ? "warning" : "ok",
    message: hasRecentError
      ? "Houve erro recente na persistência em background."
      : backlog
        ? "Fila de persistência acumulada."
        : "Persistência em background saudável.",
    meta: snapshot,
  };
};

const buildBackgroundJobQueueHealthCheck = () => {
  const snapshot = backgroundJobQueue.snapshot();
  const maxRuntimeMs = Array.isArray(snapshot.activeJobs)
    ? snapshot.activeJobs.reduce((max, job) => Math.max(max, Number(job.runtimeMs || 0)), 0)
    : 0;
  const hasBacklog = Number(snapshot.pending || 0) > 20 || maxRuntimeMs > 120000;
  return {
    name: "background_jobs",
    status: hasBacklog ? "warning" : "ok",
    message: hasBacklog ? "Fila de jobs em atraso." : "Fila de jobs operacional.",
    meta: {
      pending: Number(snapshot.pending || 0),
      running: Number(snapshot.running || 0),
      maxRuntimeMs,
    },
  };
};

const buildRateLimiterHealthCheck = () => {
  const usingRedis = rateLimiter.mode === "redis";
  return {
    name: "rate_limit_backend",
    status: isProduction && !usingRedis ? "warning" : "ok",
    message: usingRedis ? "Rate limit distribuido ativo (Redis)." : "Rate limit local em memoria.",
    meta: {
      mode: rateLimiter.mode,
      redisConfigured: Boolean(String(REDIS_URL || "").trim()),
    },
  };
};

const probeDbHealthCheck = async () => {
  const startedAt = Date.now();
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    const latencyMs = Date.now() - startedAt;
    return {
      name: "database",
      status: latencyMs > OPS_ALERTS_DB_LATENCY_WARNING_MS ? "warning" : "ok",
      latencyMs,
      message:
        latencyMs > OPS_ALERTS_DB_LATENCY_WARNING_MS
          ? "Banco respondeu acima do limite de latência."
          : "Banco respondeu ao ping.",
    };
  } catch (error) {
    return {
      name: "database",
      status: "critical",
      latencyMs: Date.now() - startedAt,
      message: String(error?.message || error || "db_ping_failed"),
    };
  }
};

const probeUploadsDirHealthCheck = async () => {
  const startedAt = Date.now();
  try {
    await fs.promises.access(PUBLIC_UPLOADS_DIR, fs.constants.R_OK | fs.constants.W_OK);
    return {
      name: "uploads_dir",
      status: "ok",
      latencyMs: Date.now() - startedAt,
      message: "Diretório de uploads acessível.",
      meta: { path: PUBLIC_UPLOADS_DIR },
    };
  } catch (error) {
    return {
      name: "uploads_dir",
      status: "warning",
      latencyMs: Date.now() - startedAt,
      message: String(error?.message || error || "uploads_dir_unavailable"),
      meta: { path: PUBLIC_UPLOADS_DIR },
    };
  }
};

const evaluateOperationalMonitoring = async () => {
  const dbCheck = await probeDbHealthCheck();
  const repositoryHealth = getRepositoryHealthSnapshot();
  const checks = [
    dbCheck,
    buildRepositoryHealthCheck(),
    buildBackgroundJobQueueHealthCheck(),
    buildRateLimiterHealthCheck(),
    await probeUploadsDirHealthCheck(),
    buildSessionConfigHealthCheck(),
    buildMaintenanceHealthCheck(),
  ];
  const health = buildHealthStatusResponse({
    checks,
    dataSource: dataRepository?.getDataSource?.() || "db",
    maintenanceMode: isMaintenanceMode,
    ts: new Date().toISOString(),
  });
  const alerts = buildOperationalAlertsV1({
    maintenanceMode: isMaintenanceMode,
    dbCheck,
    repositoryHealth,
    session: {
      usesDefaultSecretInProduction: sessionCookieConfig.usesDefaultSecretInProduction,
    },
    thresholds: {
      dbLatencyWarningMs: OPS_ALERTS_DB_LATENCY_WARNING_MS,
    },
    now: health.ts,
  });
  const alertsResponse = buildOperationalAlertsResponse({
    alerts,
    checks: health.checks,
    generatedAt: health.ts,
  });
  return {
    ts: health.ts,
    checks: health.checks,
    health,
    alerts: alertsResponse,
    repositoryHealth,
    dbCheck,
  };
};

const setNoStoreJson = (res) => {
  res.setHeader("Cache-Control", "no-store");
};

const epubImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: EPUB_IMPORT_MULTIPART_LIMITS,
});
const projectImageImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS,
});
const parseLegacyEpubImportBody = express.raw({
  type: ["application/epub+zip", "application/octet-stream"],
  limit: "64mb",
});
const getSingleMultipartValue = (value) => (Array.isArray(value) ? value[0] : value);
const createProjectSnapshotError = (code, key) => {
  const error = new Error(code);
  error.code = code;
  if (key) {
    error.key = key;
  }
  return error;
};
const normalizeProjectSnapshotForEpubImport = (rawProjectSnapshot) => {
  const payload = getSingleMultipartValue(rawProjectSnapshot);
  if (payload === undefined || payload === null || String(payload).trim() === "") {
    return null;
  }

  let parsedSnapshot;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    parsedSnapshot = payload;
  } else {
    try {
      parsedSnapshot = JSON.parse(String(payload));
    } catch {
      throw createProjectSnapshotError("invalid_project_snapshot");
    }
  }

  if (!parsedSnapshot || typeof parsedSnapshot !== "object" || Array.isArray(parsedSnapshot)) {
    throw createProjectSnapshotError("invalid_project_snapshot");
  }

  const normalizedProject = normalizeProjects([parsedSnapshot])[0];
  const duplicateEpisodeKey = findDuplicateEpisodeKey(normalizedProject?.episodeDownloads);
  if (duplicateEpisodeKey) {
    throw createProjectSnapshotError("duplicate_episode_key", duplicateEpisodeKey.key);
  }
  const duplicateVolumeCoverKey = findDuplicateVolumeCover(normalizedProject?.volumeEntries);
  if (duplicateVolumeCoverKey) {
    throw createProjectSnapshotError("duplicate_volume_cover_key", duplicateVolumeCoverKey.key);
  }

  return normalizedProject;
};
const parseEpubImportRequestBody = (req, res, next) => {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("multipart/form-data")) {
    return epubImportUpload.single("file")(req, res, (error) => {
      if (error) {
        const mappedError = mapEpubImportMultipartError(error);
        return res.status(mappedError.status).json(mappedError.body);
      }
      return next();
    });
  }

  return parseLegacyEpubImportBody(req, res, next);
};

const parseProjectImageImportRequestBody = (req, res, next) => {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("multipart/form-data")) {
    return res.status(400).json({ error: "multipart_required" });
  }
  return projectImageImportUpload.fields([
    { name: "archive", maxCount: 1 },
    { name: "files", maxCount: PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS.files },
  ])(req, res, (error) => {
    if (error) {
      const mappedError = mapProjectImageImportMultipartError(error);
      return res.status(mappedError.status).json(mappedError.body);
    }
    return next();
  });
};

const resolveEpubImportRequestInput = (req) => {
  const isMultipartRequest = String(req.headers["content-type"] || "")
    .toLowerCase()
    .includes("multipart/form-data");
  const rawProjectId = String(req.query.projectId || "").trim();
  const targetVolumeRaw = isMultipartRequest
    ? getSingleMultipartValue(req.body?.targetVolume)
    : req.query.targetVolume;
  const defaultStatusRaw = isMultipartRequest
    ? getSingleMultipartValue(req.body?.defaultStatus)
    : req.query.defaultStatus;
  const defaultStatus = String(defaultStatusRaw || "draft")
    .trim()
    .toLowerCase();
  const targetVolume =
    targetVolumeRaw !== undefined &&
    targetVolumeRaw !== null &&
    String(targetVolumeRaw).trim() !== "" &&
    Number.isFinite(Number(targetVolumeRaw))
      ? Number(targetVolumeRaw)
      : undefined;
  const buffer = isMultipartRequest
    ? Buffer.isBuffer(req.file?.buffer)
      ? req.file.buffer
      : Buffer.from([])
    : Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from([]);
  const project = normalizeProjectSnapshotForEpubImport(req.body?.project);
  return {
    isMultipartRequest,
    rawProjectId,
    targetVolume,
    defaultStatus,
    buffer,
    project,
  };
};

const buildRuntimeMetadata = () => ({
  apiVersion: API_CONTRACT_VERSION,
  ...getBuildMetadata(),
});

registerSessionRoutes({
  app,
  apiContractVersion: API_CONTRACT_VERSION,
  buildApiContractV1Payload: () =>
    buildApiContractV1({
      capabilities: {
        project_epub_import_async: isEpubImportJobStorageAvailable(),
        project_manga_import_async: isProjectImageImportJobStorageAvailable(),
      },
    }),
  buildRuntimeMetadata,
  buildUserPayload,
  proxyDiscordAvatarRequest,
});

registerOperationalRoutes({
  app,
  buildRuntimeMetadata,
  evaluateOperationalMonitoring,
  isMetricsEnabled,
  loadSecurityEvents,
  loadUserSessionIndexRecords,
  metricsRegistry,
  metricsTokenNormalized: METRICS_TOKEN_NORMALIZED,
  securityEventStatusOpen: SecurityEventStatus.OPEN,
});

const WEBHOOK_STATE_KEY_OPS_ALERTS_BASELINE = "ops_alerts_baseline";
const WEBHOOK_WORKER_POLL_INTERVAL_MS = 5_000;
const OPERATIONAL_ALERTS_SCHEDULER_POLL_MS = 5_000;

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
const analyticsCompactionState = {
  timer: null,
};

const buildOperationalDashboardUrl = () => `${PRIMARY_APP_ORIGIN}/dashboard`;

const loadOperationalWebhookSettings = () => loadIntegrationSettings().operational;

const loadSecurityWebhookSettings = () => loadIntegrationSettings().security;

const loadWebhookSettingsSources = () => loadIntegrationSettingsSources();

const resolveOperationalWebhookIntervalMs = (settings) =>
  Math.min(
    Math.max(
      Math.floor(Number(settings?.intervalMs) || OPERATIONAL_WEBHOOK_INTERVAL_DEFAULT_MS),
      OPERATIONAL_WEBHOOK_INTERVAL_MIN_MS,
    ),
    OPERATIONAL_WEBHOOK_INTERVAL_MAX_MS,
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
  appendAuditLog(req || createWebhookAuditReqFromContext(delivery?.context), auditConfig.queuedAction, auditConfig.resource, {
    ...buildWebhookAuditMeta(delivery),
    attempt: 0,
  });
};

const appendWebhookDeliveryAttemptAuditLog = ({ delivery, result, nextAttemptAt = null, terminal = false } = {}) => {
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
      status: WEBHOOK_DELIVERY_STATUS.SENT,
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
      status: WEBHOOK_DELIVERY_STATUS.RETRYING,
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
    status: WEBHOOK_DELIVERY_STATUS.FAILED,
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

const buildSecurityWebhookPayloadLegacy = (event) => {
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
  const title = `Evento crítico de segurança: ${String(event.type || "security_event")}`;
  const description = [
    `Status: ${String(event.status || "open")}`,
    `Risco: ${Number(event.riskScore || 0)}`,
    event.actorUserId ? `Ator: ${event.actorUserId}` : "",
    event.targetUserId ? `Alvo: ${event.targetUserId}` : "",
    event.ip ? `IP: ${event.ip}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const payloadLegacy = {
    content: "Alerta crítico de segurança detectado.",
    embeds: [
      {
        title,
        description: description || "Sem detalhes adicionais.",
        color: 0xff4d4f,
        timestamp: new Date(event.ts || Date.now()).toISOString(),
        fields: [
          {
            name: "Dashboard",
            value: buildOperationalDashboardUrl(),
            inline: false,
          },
          {
            name: "Event ID",
            value: String(event.id || "unknown"),
            inline: false,
          },
        ],
      },
    ],
    allowed_mentions: { parse: [] },
  };
  const queued = enqueueWebhookDelivery({
    scope: WEBHOOK_DELIVERY_SCOPE.SECURITY,
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
      requestId: `security-webhook-${String(event.id || crypto.randomUUID())}`,
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
    scope: WEBHOOK_DELIVERY_SCOPE.SECURITY,
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
    scope: WEBHOOK_DELIVERY_SCOPE.OPS_ALERTS,
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
      requestId: `ops-alerts-webhook-${crypto.randomUUID()}`,
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
    scope: WEBHOOK_DELIVERY_SCOPE.OPS_ALERTS,
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
        provider: operationalSettings.provider,
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

const requireAuth = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
};

const requireOwner = (req, res, next) => {
  if (!req.session?.user || !isOwner(req.session.user.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  return next();
};

const requirePrimaryOwner = (req, res, next) => {
  if (!req.session?.user || !isPrimaryOwner(req.session.user.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  return next();
};

registerSelfServiceRoutes({
  app,
  appendAuditLog,
  buildMySecuritySummary,
  clearEnrollmentFromSession,
  dataEncryptionKeyring,
  deleteUserMfaTotpRecord,
  encryptStringWithKeyring,
  generateRecoveryCodes,
  handleMfaFailureSecuritySignals,
  hashRecoveryCode,
  isPlainObject,
  isTotpEnabledForUser,
  listActiveSessionsForUser,
  metricsRegistry,
  mfaRecoveryCodePepper: MFA_RECOVERY_CODE_PEPPER,
  normalizeUserPreferences,
  requireAuth,
  resolveEnrollmentFromSession,
  resolveMfaMetadata,
  revokeSessionBySid,
  saveSessionState,
  startTotpEnrollment,
  userPreferencesMaxBytes: USER_PREFERENCES_MAX_BYTES,
  verifyTotpCode,
  verifyTotpOrRecoveryCode,
  loadUserPreferences,
  writeUserMfaTotpRecord,
  writeUserPreferences,
});

const canManageSecurityAdmin = (userId) => {
  if (!userId) {
    return false;
  }
  return canViewAuditLog(userId) || canManageUsersAccess(userId) || isPrimaryOwner(userId);
};

const toSecurityEventApiResponse = (event) => ({
  id: event.id,
  ts: event.ts,
  type: event.type,
  severity: event.severity,
  riskScore: Number(event.riskScore || 0),
  status: event.status,
  actorUserId: event.actorUserId || null,
  targetUserId: event.targetUserId || null,
  ip: event.ip || "",
  userAgent: event.userAgent || "",
  sessionId: event.sessionId || null,
  requestId: event.requestId || null,
  data: event.data || {},
});

const findSecurityEventById = (id) =>
  loadSecurityEvents().find((entry) => String(entry?.id || "") === String(id || "")) || null;

const updateSecurityEventStatus = ({ eventId, status, actorUserId } = {}) => {
  const existing = findSecurityEventById(eventId);
  if (!existing) {
    return null;
  }
  const normalizedStatus = normalizeSecurityEventStatus(status);
  const updated = upsertSecurityEvent({
    ...existing,
    status: normalizedStatus,
    updatedAt: new Date().toISOString(),
    data: {
      ...(existing.data && typeof existing.data === "object" ? existing.data : {}),
      statusUpdatedAt: new Date().toISOString(),
      statusUpdatedBy: actorUserId ? String(actorUserId) : "system",
    },
  });
  return updated;
};

const EXPORT_HEADERS_BY_DATASET = Object.freeze({
  audit_log: [
    "id",
    "ts",
    "actorId",
    "actorName",
    "action",
    "resource",
    "resourceId",
    "status",
    "ip",
    "requestId",
    "meta",
  ],
  security_events: [
    "id",
    "ts",
    "type",
    "severity",
    "riskScore",
    "status",
    "actorUserId",
    "targetUserId",
    "ip",
    "userAgent",
    "requestId",
    "data",
  ],
  users: ["id", "name", "status", "accessRole", "permissions", "roles", "isOwner", "updatedAt"],
  sessions: [
    "sid",
    "userId",
    "createdAt",
    "lastSeenAt",
    "lastIp",
    "userAgent",
    "revokedAt",
    "revokedBy",
    "revokeReason",
    "isPendingMfa",
  ],
});

const buildExportRowsByDataset = ({ dataset, filters }) => {
  const normalizedDataset = normalizeExportDataset(dataset);
  const normalizedFilters = normalizeExportFilters(filters);

  if (normalizedDataset === "audit_log") {
    let rows = loadAuditLog();
    rows = filterByDateRange(rows, {
      dateFrom: normalizedFilters.dateFrom,
      dateTo: normalizedFilters.dateTo,
      tsAccessor: (entry) => entry.ts,
    });
    rows = filterExportEntries(rows, normalizedFilters, {
      fieldAccessors: {
        actorUserId: (entry) => entry.actorId,
        targetUserId: (entry) => entry.resourceId,
        action: (entry) => entry.action,
        resource: (entry) => entry.resource,
        status: (entry) => entry.status,
      },
    });
    const mapped = rows.slice(0, ADMIN_EXPORT_MAX_ROWS).map((entry) => ({
      id: entry.id,
      ts: entry.ts,
      actorId: entry.actorId,
      actorName: entry.actorName,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId || "",
      status: entry.status,
      ip: entry.ip || "",
      requestId: entry.requestId || "",
      meta: entry.meta || {},
    }));
    return {
      headers: EXPORT_HEADERS_BY_DATASET.audit_log,
      rows: mapped,
      truncated: rows.length > mapped.length,
    };
  }

  if (normalizedDataset === "security_events") {
    let rows = loadSecurityEvents();
    rows = filterByDateRange(rows, {
      dateFrom: normalizedFilters.dateFrom,
      dateTo: normalizedFilters.dateTo,
      tsAccessor: (entry) => entry.ts,
    });
    rows = filterExportEntries(rows, normalizedFilters, {
      fieldAccessors: {
        actorUserId: (entry) => entry.actorUserId,
        targetUserId: (entry) => entry.targetUserId,
        action: (entry) => entry.type,
        severity: (entry) => entry.severity,
        status: (entry) => entry.status,
      },
    });
    const mapped = rows.slice(0, ADMIN_EXPORT_MAX_ROWS).map((entry) => ({
      id: entry.id,
      ts: entry.ts,
      type: entry.type,
      severity: entry.severity,
      riskScore: Number(entry.riskScore || 0),
      status: entry.status,
      actorUserId: entry.actorUserId || "",
      targetUserId: entry.targetUserId || "",
      ip: entry.ip || "",
      userAgent: entry.userAgent || "",
      requestId: entry.requestId || "",
      data: entry.data || {},
    }));
    return {
      headers: EXPORT_HEADERS_BY_DATASET.security_events,
      rows: mapped,
      truncated: rows.length > mapped.length,
    };
  }

  if (normalizedDataset === "users") {
    const ownerIds = new Set(loadOwnerIds().map((entry) => String(entry)));
    let rows = normalizeUsers(loadUsers()).map((entry) => ({
      id: entry.id,
      name: entry.name || "",
      status: entry.status || "active",
      accessRole: entry.accessRole || AccessRole.NORMAL,
      permissions: Array.isArray(entry.permissions) ? entry.permissions : [],
      roles: Array.isArray(entry.roles) ? entry.roles : [],
      isOwner: ownerIds.has(String(entry.id)),
      updatedAt: entry.updatedAt || "",
    }));
    rows = filterExportEntries(rows, normalizedFilters, {
      fieldAccessors: {
        actorUserId: (entry) => entry.id,
        targetUserId: (entry) => entry.id,
        status: (entry) => entry.status,
      },
    });
    const mapped = rows.slice(0, ADMIN_EXPORT_MAX_ROWS);
    return {
      headers: EXPORT_HEADERS_BY_DATASET.users,
      rows: mapped,
      truncated: rows.length > mapped.length,
    };
  }

  let sessionRows = loadUserSessionIndexRecords({ includeRevoked: true });
  sessionRows = filterByDateRange(sessionRows, {
    dateFrom: normalizedFilters.dateFrom,
    dateTo: normalizedFilters.dateTo,
    tsAccessor: (entry) => entry.lastSeenAt || entry.createdAt,
  });
  sessionRows = filterExportEntries(sessionRows, normalizedFilters, {
    fieldAccessors: {
      actorUserId: (entry) => entry.userId,
      targetUserId: (entry) => entry.userId,
      status: (entry) => (entry.revokedAt ? "revoked" : "active"),
    },
  });
  const mapped = sessionRows.slice(0, ADMIN_EXPORT_MAX_ROWS).map((entry) => ({
    sid: entry.sid,
    userId: entry.userId,
    createdAt: entry.createdAt || null,
    lastSeenAt: entry.lastSeenAt || null,
    lastIp: entry.lastIp || "",
    userAgent: entry.userAgent || "",
    revokedAt: entry.revokedAt || null,
    revokedBy: entry.revokedBy || null,
    revokeReason: entry.revokeReason || null,
    isPendingMfa: Boolean(entry.isPendingMfa),
  }));
  return {
    headers: EXPORT_HEADERS_BY_DATASET.sessions,
    rows: mapped,
    truncated: sessionRows.length > mapped.length,
  };
};

const toAdminExportJobApiResponse = (job) => ({
  id: job.id,
  dataset: job.dataset,
  format: job.format,
  status: normalizeExportStatus(job.status),
  requestedBy: job.requestedBy,
  filters: job.filters || {},
  rowCount: Number.isFinite(Number(job.rowCount)) ? Number(job.rowCount) : null,
  error: job.error || null,
  createdAt: job.createdAt || null,
  startedAt: job.startedAt || null,
  finishedAt: job.finishedAt || null,
  expiresAt: job.expiresAt || null,
  hasFile: Boolean(job.filePath),
});

const runAdminExportJob = async (jobId) => {
  const current = loadAdminExportJobs().find(
    (entry) => String(entry?.id || "") === String(jobId || ""),
  );
  if (!current) {
    return null;
  }
  const nowIso = new Date().toISOString();
  let processing = upsertAdminExportJob({
    ...current,
    status: "processing",
    startedAt: nowIso,
    finishedAt: null,
    error: null,
  });
  try {
    const payload = buildExportRowsByDataset({
      dataset: processing.dataset,
      filters: processing.filters,
    });
    const filePath = writeExportFile({
      exportsDir: adminExportsDir,
      fileName: `${processing.dataset}-${processing.id}`,
      format: processing.format,
      headers: payload.headers,
      rows: payload.rows,
    });
    const finishedAt = new Date();
    processing = upsertAdminExportJob({
      ...processing,
      status: "completed",
      filePath,
      rowCount: payload.rows.length,
      finishedAt: finishedAt.toISOString(),
      expiresAt: new Date(
        finishedAt.getTime() + ADMIN_EXPORT_TTL_HOURS * 60 * 60 * 1000,
      ).toISOString(),
      error: payload.truncated ? "truncated_max_rows" : null,
    });
    appendAuditLog(createSystemAuditReq(), "admin.exports.completed", "exports", {
      id: processing.id,
      dataset: processing.dataset,
      rowCount: payload.rows.length,
    });
    metricsRegistry.inc("export_jobs_total", {
      status: "completed",
      dataset: String(processing.dataset || "unknown"),
    });
    return processing;
  } catch (error) {
    const failed = upsertAdminExportJob({
      ...processing,
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: String(error?.message || error || "export_failed"),
    });
    appendAuditLog(createSystemAuditReq(), "admin.exports.failed", "exports", {
      id: current.id,
      dataset: current.dataset,
      error: String(error?.message || error || "export_failed"),
    });
    metricsRegistry.inc("export_jobs_total", {
      status: "failed",
      dataset: String(current.dataset || "unknown"),
    });
    return failed;
  }
};

const enqueueAdminExportJob = (jobId) =>
  backgroundJobQueue.enqueue({
    type: "admin.export",
    payload: { jobId },
    run: async () => runAdminExportJob(jobId),
  });

const findEpubImportJobForUser = (jobId, actorId) =>
  loadEpubImportJobs().find(
    (entry) =>
      String(entry?.id || "") === String(jobId || "") &&
      String(entry?.requestedBy || "") === String(actorId || ""),
  ) || null;

const expireEpubImportJob = (
  job,
  { error = "O resultado da importacao EPUB expirou. Envie o arquivo novamente." } = {},
) => {
  if (!job) {
    return null;
  }
  deleteEpubImportJobResult(job.resultPath);
  return upsertEpubImportJob({
    ...job,
    status: "expired",
    resultPath: null,
    error,
    finishedAt: job.finishedAt || new Date().toISOString(),
    expiresAt: job.expiresAt || new Date().toISOString(),
  });
};

const runEpubImportJob = async (
  jobId,
  { buffer, project, targetVolume, defaultStatus, uploadUserId } = {},
) => {
  const current = loadEpubImportJobs().find(
    (entry) => String(entry?.id || "") === String(jobId || ""),
  );
  if (!current) {
    return null;
  }
  let processing = upsertEpubImportJob({
    ...current,
    status: "processing",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    expiresAt: null,
    error: null,
  });
  try {
    const preview = await importProjectEpub({
      buffer,
      project,
      targetVolume,
      defaultStatus,
      uploadsDir: path.join(__dirname, "..", "public", "uploads"),
      loadUploads,
      writeUploads,
      uploadUserId,
    });
    const finishedAt = new Date();
    const resultPath = writeEpubImportJobResult({
      jobsDir: epubImportJobsDir,
      jobId: processing.id,
      result: preview,
    });
    processing = upsertEpubImportJob({
      ...processing,
      status: "completed",
      summary:
        preview?.summary && typeof preview.summary === "object" && !Array.isArray(preview.summary)
          ? preview.summary
          : {},
      resultPath,
      error: null,
      finishedAt: finishedAt.toISOString(),
      expiresAt: new Date(finishedAt.getTime() + EPUB_IMPORT_JOB_RESULT_TTL_MS).toISOString(),
    });
    return processing;
  } catch (error) {
    deleteEpubImportJobResult(processing?.resultPath);
    const mappedError = mapEpubImportExecutionError(error);
    return upsertEpubImportJob({
      ...processing,
      status: "failed",
      resultPath: null,
      finishedAt: new Date().toISOString(),
      error: String(mappedError?.body?.detail || error?.message || error || "epub_import_failed"),
    });
  }
};

const enqueueEpubImportJob = (jobId, payload) =>
  backgroundJobQueue.enqueue({
    type: "project.epub_import",
    payload: {
      jobId,
      projectId: payload?.project?.id || payload?.rawProjectId || "",
      targetVolume: payload?.targetVolume ?? null,
    },
    run: async () => runEpubImportJob(jobId, payload),
  });

loadEpubImportJobs().forEach((job) => {
  const normalizedStatus = String(job?.status || "")
    .trim()
    .toLowerCase();
  if (normalizedStatus === "completed") {
    const expiresAtTs = new Date(job?.expiresAt || 0).getTime();
    if (Number.isFinite(expiresAtTs) && expiresAtTs <= Date.now()) {
      expireEpubImportJob(job);
    }
    return;
  }
  if (normalizedStatus !== "queued" && normalizedStatus !== "processing") {
    return;
  }
  upsertEpubImportJob({
    ...job,
    status: "failed",
    resultPath: null,
    finishedAt: new Date().toISOString(),
    error: "A importacao EPUB foi interrompida porque o servidor reiniciou antes da conclusao.",
  });
});

const findProjectImageImportJobForUser = (jobId, actorId) =>
  loadProjectImageImportJobs().find(
    (entry) =>
      String(entry?.id || "") === String(jobId || "") &&
      String(entry?.requestedBy || "") === String(actorId || ""),
  ) || null;

const expireProjectImageImportJob = (
  job,
  { error = "O resultado da importacao de imagens expirou. Envie o lote novamente." } = {},
) => {
  if (!job) {
    return null;
  }
  deleteProjectImageImportJobResult(job.resultPath);
  return upsertProjectImageImportJob({
    ...job,
    status: "expired",
    resultPath: null,
    error,
    finishedAt: job.finishedAt || new Date().toISOString(),
    expiresAt: job.expiresAt || new Date().toISOString(),
  });
};

const runProjectImageImportJob = async (
  jobId,
  {
    project,
    files,
    manifestEntries,
    archiveBuffer,
    archiveName,
    targetVolume,
    targetChapterNumber,
    defaultStatus,
  } = {},
) => {
  const current = loadProjectImageImportJobs().find(
    (entry) => String(entry?.id || "") === String(jobId || ""),
  );
  if (!current) {
    return null;
  }
  let processing = upsertProjectImageImportJob({
    ...current,
    status: "processing",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    expiresAt: null,
    error: null,
  });
  try {
    const result = await importProjectImageChapters({
      project,
      files,
      manifestEntries,
      archiveBuffer,
      archiveName,
      targetVolume,
      targetChapterNumber,
      defaultStatus,
      uploadsDir: path.join(__dirname, "..", "public", "uploads"),
      loadUploads,
      writeUploads,
    });
    const finishedAt = new Date();
    const resultPath = writeProjectImageImportJobResult({
      jobsDir: projectImageImportJobsDir,
      jobId: processing.id,
      result,
    });
    processing = upsertProjectImageImportJob({
      ...processing,
      status: "completed",
      summary:
        result?.summary && typeof result.summary === "object" && !Array.isArray(result.summary)
          ? result.summary
          : {},
      resultPath,
      error: null,
      finishedAt: finishedAt.toISOString(),
      expiresAt: new Date(
        finishedAt.getTime() + PROJECT_IMAGE_IMPORT_JOB_RESULT_TTL_MS,
      ).toISOString(),
    });
    return processing;
  } catch (error) {
    deleteProjectImageImportJobResult(processing?.resultPath);
    const mappedError = mapProjectImageImportExecutionError(error);
    return upsertProjectImageImportJob({
      ...processing,
      status: "failed",
      resultPath: null,
      finishedAt: new Date().toISOString(),
      error:
        String(mappedError?.body?.detail || "").trim() ||
        String(error?.message || error || "project_image_import_failed"),
    });
  }
};

const enqueueProjectImageImportJob = (jobId, payload) =>
  backgroundJobQueue.enqueue({
    type: "project.image_import",
    payload: {
      jobId,
      projectId: payload?.project?.id || "",
      targetVolume: payload?.targetVolume ?? null,
      targetChapterNumber: payload?.targetChapterNumber ?? null,
    },
    run: async () => runProjectImageImportJob(jobId, payload),
  });

const buildProjectImageExportDownloadPath = (projectId, jobId) =>
  `/api/projects/${encodeURIComponent(String(projectId || ""))}/manga-export/jobs/${encodeURIComponent(String(jobId || ""))}/download`;

const findProjectImageExportJobForUser = (jobId, actorId) =>
  loadProjectImageExportJobs().find(
    (entry) =>
      String(entry?.id || "") === String(jobId || "") &&
      String(entry?.requestedBy || "") === String(actorId || ""),
  ) || null;

const expireProjectImageExportJob = (
  job,
  { error = "O arquivo exportado expirou. Gere a exportacao novamente." } = {},
) => {
  if (!job) {
    return null;
  }
  deleteProjectImageExportJobResult(job.resultPath);
  return upsertProjectImageExportJob({
    ...job,
    status: "expired",
    resultPath: null,
    error,
    finishedAt: job.finishedAt || new Date().toISOString(),
    expiresAt: job.expiresAt || new Date().toISOString(),
  });
};

const writeProjectImageExportResultFile = ({ jobId, fileName, buffer } = {}) => {
  const directory = ensureProjectImageExportJobsDirectory(projectImageExportJobsDir);
  const safeJobId = String(jobId || "").trim() || "project-image-export-job";
  const safeFileName = path.basename(String(fileName || "export.zip"));
  const filePath = path.join(directory, `${safeJobId}-${safeFileName}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
};

const runProjectImageExportJob = async (jobId, { project, volume, includeDrafts } = {}) => {
  const current = loadProjectImageExportJobs().find(
    (entry) => String(entry?.id || "") === String(jobId || ""),
  );
  if (!current) {
    return null;
  }
  let processing = upsertProjectImageExportJob({
    ...current,
    status: "processing",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    expiresAt: null,
    error: null,
  });
  try {
    const result = exportProjectImageCollection({
      project,
      volume,
      uploadsDir: path.join(__dirname, "..", "public", "uploads"),
      includeDrafts,
    });
    const finishedAt = new Date();
    const resultPath = writeProjectImageExportResultFile({
      jobId: processing.id,
      fileName: result.filename,
      buffer: result.buffer,
    });
    processing = upsertProjectImageExportJob({
      ...processing,
      status: "completed",
      summary:
        result?.summary && typeof result.summary === "object" && !Array.isArray(result.summary)
          ? {
              ...result.summary,
              filename: result.filename,
              contentType: result.contentType,
            }
          : {},
      resultPath,
      error: null,
      finishedAt: finishedAt.toISOString(),
      expiresAt: new Date(
        finishedAt.getTime() + PROJECT_IMAGE_EXPORT_JOB_RESULT_TTL_MS,
      ).toISOString(),
    });
    return processing;
  } catch (error) {
    deleteProjectImageExportJobResult(processing?.resultPath);
    return upsertProjectImageExportJob({
      ...processing,
      status: "failed",
      resultPath: null,
      finishedAt: new Date().toISOString(),
      error: String(error?.message || error || "project_image_export_failed"),
    });
  }
};

const enqueueProjectImageExportJob = (jobId, payload) =>
  backgroundJobQueue.enqueue({
    type: "project.image_export",
    payload: {
      jobId,
      projectId: payload?.project?.id || "",
      volume: payload?.volume ?? null,
    },
    run: async () => runProjectImageExportJob(jobId, payload),
  });

loadProjectImageImportJobs().forEach((job) => {
  const normalizedStatus = String(job?.status || "")
    .trim()
    .toLowerCase();
  if (normalizedStatus === "completed") {
    const expiresAtTs = new Date(job?.expiresAt || 0).getTime();
    if (Number.isFinite(expiresAtTs) && expiresAtTs <= Date.now()) {
      expireProjectImageImportJob(job);
    }
    return;
  }
  if (normalizedStatus !== "queued" && normalizedStatus !== "processing") {
    return;
  }
  upsertProjectImageImportJob({
    ...job,
    status: "failed",
    resultPath: null,
    finishedAt: new Date().toISOString(),
    error:
      "A importacao de imagens foi interrompida porque o servidor reiniciou antes da conclusao.",
  });
});

loadProjectImageExportJobs().forEach((job) => {
  const normalizedStatus = String(job?.status || "")
    .trim()
    .toLowerCase();
  if (normalizedStatus === "completed") {
    const expiresAtTs = new Date(job?.expiresAt || 0).getTime();
    if (Number.isFinite(expiresAtTs) && expiresAtTs <= Date.now()) {
      expireProjectImageExportJob(job);
    }
    return;
  }
  if (normalizedStatus !== "queued" && normalizedStatus !== "processing") {
    return;
  }
  upsertProjectImageExportJob({
    ...job,
    status: "failed",
    resultPath: null,
    finishedAt: new Date().toISOString(),
    error:
      "A exportacao de imagens foi interrompida porque o servidor reiniciou antes da conclusao.",
  });
});

const legacyAdminBadgePermissions = [
  "posts",
  "projetos",
  "comentarios",
  "usuarios",
  "paginas",
  "configuracoes",
];

const inferLegacyAccessRole = (user) => {
  const permissions = Array.isArray(user?.permissions)
    ? user.permissions.map((item) => String(item || ""))
    : [];
  if (permissions.includes("*")) {
    return AccessRole.ADMIN;
  }
  if (permissions.includes("usuarios")) {
    return AccessRole.ADMIN;
  }
  return AccessRole.NORMAL;
};

const normalizePermissionsRaw = (permissions) => {
  if (!Array.isArray(permissions)) {
    return [];
  }
  const next = [];
  permissions.forEach((permissionRaw) => {
    const permission = String(permissionRaw || "").trim();
    if (!permission) {
      return;
    }
    if (!next.includes(permission)) {
      next.push(permission);
    }
  });
  return next;
};

const normalizeUsers = (users) => {
  const ownerIds = loadOwnerIds().map((id) => String(id));
  const primaryOwnerId = ownerIds[0] ? String(ownerIds[0]) : null;
  return users.map((user, index) => {
    const normalizedId = String(user.id || "");
    const legacyRole = inferLegacyAccessRole(user);
    const accessRole = computeEffectiveAccessRole({
      userId: normalizedId,
      accessRole: normalizeAccessRole(user.accessRole, legacyRole),
      ownerIds,
      primaryOwnerId,
    });
    return normalizeUploadsDeep({
      id: normalizedId,
      name: user.name || "Sem nome",
      phrase: user.phrase || "",
      bio: user.bio || "",
      avatarUrl: user.avatarUrl || null,
      socials: sanitizeSocials(user.socials),
      favoriteWorks: sanitizeFavoriteWorksByCategory(user.favoriteWorks),
      status: user.status === "retired" ? "retired" : "active",
      permissions: normalizePermissionsRaw(user.permissions),
      roles: removeOwnerRoleLabel(Array.isArray(user.roles) ? user.roles.filter(Boolean) : []),
      avatarDisplay: normalizeAvatarDisplay(user.avatarDisplay),
      accessRole,
      order: typeof user.order === "number" ? user.order : index,
    });
  });
};

const resolveEditorialAuthorFromPost = createResolveEditorialAuthorFromPost({
  loadUsers,
  normalizeTypeLookupKey,
  normalizeUsers,
});

const applyOwnerRole = (user) => {
  const isOwnerUser = isOwner(user.id);
  return {
    ...user,
    roles: addOwnerRoleLabel(user.roles || [], isOwnerUser),
  };
};

const buildPublicTeamMembers = () => {
  const ownerIds = loadOwnerIds().map((id) => String(id));
  return normalizeUsers(loadUsers())
    .sort((a, b) => a.order - b.order)
    .map((user) => {
      const withAccess = userWithAccessForResponse(user, ownerIds);
      return {
        id: user.id,
        name: user.name,
        phrase: user.phrase,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        avatarDisplay: normalizeAvatarDisplay(user.avatarDisplay),
        socials: user.socials,
        favoriteWorks: user.favoriteWorks,
        roles: applyOwnerRole(user).roles,
        accessRole: withAccess.accessRole,
        isAdmin: withAccess.accessRole === AccessRole.ADMIN,
        status: user.status,
      };
    });
};

const getUserAccessContextById = (userId, usersInput = null) => {
  const normalizedId = String(userId || "");
  if (!normalizedId) {
    return {
      user: null,
      accessRole: AccessRole.NORMAL,
      grants: computeGrants(),
      isOwner: false,
      isPrimaryOwner: false,
      ownerIds: loadOwnerIds().map((id) => String(id)),
      primaryOwnerId: getPrimaryOwnerId() ? String(getPrimaryOwnerId()) : null,
    };
  }
  const users = Array.isArray(usersInput) ? usersInput : normalizeUsers(loadUsers());
  const user = users.find((item) => item.id === normalizedId) || null;
  const ownerIds = loadOwnerIds().map((id) => String(id));
  const primaryOwnerId = ownerIds[0] ? String(ownerIds[0]) : null;
  const accessRole = computeEffectiveAccessRole({
    userId: normalizedId,
    accessRole: user?.accessRole || AccessRole.NORMAL,
    ownerIds,
    primaryOwnerId,
  });
  const grants = computeGrants({
    userId: normalizedId,
    accessRole,
    permissions: user?.permissions,
    ownerIds,
    primaryOwnerId,
    acceptLegacyStar: isRbacV2AcceptLegacyStar,
  });
  return {
    user,
    accessRole,
    grants,
    isOwner: ownerIds.includes(normalizedId),
    isPrimaryOwner: Boolean(primaryOwnerId && normalizedId === primaryOwnerId),
    ownerIds,
    primaryOwnerId,
  };
};

const hasPermissionByUserId = (userId, permissionId) => {
  const context = getUserAccessContextById(userId);
  return can({ grants: context.grants, permissionId });
};

const isAdminUser = (user) => {
  if (!user?.id) {
    return false;
  }
  if (isRbacV2Enabled) {
    const context = getUserAccessContextById(user.id);
    return (
      context.accessRole === AccessRole.OWNER_PRIMARY ||
      context.accessRole === AccessRole.OWNER_SECONDARY ||
      context.accessRole === AccessRole.ADMIN
    );
  }
  if (isOwner(user.id)) {
    return true;
  }
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes("usuarios");
};

const isAdminBadgeUser = (user) => {
  if (!user) {
    return false;
  }
  if (isRbacV2Enabled) {
    const context = getUserAccessContextById(user.id);
    return (
      !context.isOwner &&
      (context.accessRole === AccessRole.ADMIN || context.accessRole === AccessRole.OWNER_SECONDARY)
    );
  }
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (permissions.includes("*")) {
    return true;
  }
  return legacyAdminBadgePermissions.every((permission) => permissions.includes(permission));
};

const canManagePosts = (userId) => {
  if (!userId) {
    return false;
  }
  if (isRbacV2Enabled) {
    return hasPermissionByUserId(userId, PermissionId.POSTS);
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes("posts");
};

const canManageProjects = (userId) => {
  if (!userId) {
    return false;
  }
  if (isRbacV2Enabled) {
    return hasPermissionByUserId(userId, PermissionId.PROJETOS);
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes("projetos");
};

const canManageComments = (userId) => {
  if (!userId) {
    return false;
  }
  if (isRbacV2Enabled) {
    return hasPermissionByUserId(userId, PermissionId.COMENTARIOS);
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return (
    permissions.includes("*") ||
    permissions.includes("comentarios") ||
    permissions.includes("posts") ||
    permissions.includes("projetos")
  );
};

const canManagePages = (userId) => {
  if (!userId) {
    return false;
  }
  if (isRbacV2Enabled) {
    return hasPermissionByUserId(userId, PermissionId.PAGINAS);
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes("paginas");
};

const canManageSettings = (userId) => {
  if (!userId) {
    return false;
  }
  if (isRbacV2Enabled) {
    return hasPermissionByUserId(userId, PermissionId.CONFIGURACOES);
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes("configuracoes");
};

const canManageUploads = (userId) => {
  if (!userId) {
    return false;
  }
  if (isRbacV2Enabled) {
    return hasPermissionByUserId(userId, PermissionId.UPLOADS);
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return (
    permissions.includes("*") ||
    permissions.includes("posts") ||
    permissions.includes("projetos") ||
    permissions.includes("configuracoes")
  );
};

const canViewAnalytics = (userId) => {
  if (!userId) {
    return false;
  }
  if (isRbacV2Enabled) {
    return hasPermissionByUserId(userId, PermissionId.ANALYTICS);
  }
  return canManagePosts(userId) || canManageProjects(userId) || canManageComments(userId);
};

const buildDashboardOverviewResponsePayload = (userId) => {
  const canReadProjects = canManageProjects(userId);
  const canReadPosts = canManagePosts(userId);
  const canReadComments = canManageComments(userId);
  const canReadAnalytics = canViewAnalytics(userId);

  const projects = canReadProjects
    ? normalizeProjects(loadProjects()).sort((a, b) => a.order - b.order)
    : [];
  const posts = canReadPosts
    ? normalizePosts(loadPosts()).sort(
        (a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime(),
      )
    : [];
  const comments = canReadComments ? loadComments() : [];

  const totalProjects = projects.length;
  const totalMedia = projects.reduce(
    (sum, project) =>
      sum + (Array.isArray(project.episodeDownloads) ? project.episodeDownloads.length : 0),
    0,
  );
  const activeProjects = projects.filter((project) => {
    const status = String(project.status || "").toLowerCase();
    return status.includes("andamento") || status.includes("produ");
  }).length;
  const finishedProjects = projects.filter((project) => {
    const status = String(project.status || "").toLowerCase();
    return status.includes("complet") || status.includes("lan");
  }).length;
  const rankedProjects = projects
    .map((project) => ({
      id: project.id,
      title: String(project.title || ""),
      status: String(project.status || ""),
      views: Number(project.views || 0),
    }))
    .filter((project) => project.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);
  const quickProjects = projects.slice(0, 3).map((project) => ({
    id: project.id,
    title: String(project.title || ""),
    status: String(project.status || ""),
  }));
  const recentPosts = posts
    .slice()
    .sort((a, b) => {
      const aDate = new Date(a.updatedAt || a.publishedAt || 0).getTime();
      const bDate = new Date(b.updatedAt || b.publishedAt || 0).getTime();
      return bDate - aDate;
    })
    .slice(0, 3)
    .map((post) => ({
      id: post.id,
      slug: String(post.slug || ""),
      title: String(post.title || ""),
      status: String(post.status || ""),
      views: Number(post.views || 0),
      publishedAt: String(post.publishedAt || ""),
      updatedAt: String(post.updatedAt || post.publishedAt || ""),
    }));
  const pendingCommentsCount = comments.filter((comment) => comment.status === "pending").length;
  const recentComments = selectRecentApprovedComments(comments, 3)
    .map((comment) => {
      const target = buildCommentTargetInfo(comment, posts, projects, PRIMARY_APP_ORIGIN);
      return {
        id: comment.id,
        author: String(comment.name || ""),
        message: String(comment.content || ""),
        page: target.label,
        createdAt: String(comment.createdAt || ""),
        url: target.url,
        status: String(comment.status || "approved"),
      };
    });

  let totalViewsLast7 = 0;
  let totalProjectViewsLast7 = 0;
  let totalPostViewsLast7 = 0;
  let analyticsSeries7d = [];
  if (canReadAnalytics) {
    const range = buildAnalyticsRange(parseAnalyticsRangeDays("7d"));
    const allEvents = filterAnalyticsEvents(
      loadAnalyticsEvents(),
      range.fromTs,
      range.toTs,
      normalizeAnalyticsTypeFilter("all"),
    );
    const projectEvents = filterAnalyticsEvents(
      loadAnalyticsEvents(),
      range.fromTs,
      range.toTs,
      normalizeAnalyticsTypeFilter("project"),
    );
    const postEvents = filterAnalyticsEvents(
      loadAnalyticsEvents(),
      range.fromTs,
      range.toTs,
      normalizeAnalyticsTypeFilter("post"),
    );
    totalViewsLast7 = allEvents.filter((event) => event.eventType === "view").length;
    totalProjectViewsLast7 = projectEvents.filter((event) => event.eventType === "view").length;
    totalPostViewsLast7 = postEvents.filter((event) => event.eventType === "view").length;
    analyticsSeries7d = range.dayKeys.map((day) => ({
      date: day,
      value: allEvents.filter((event) => {
        if (event.eventType !== "view") {
          return false;
        }
        return new Date(event.ts || event.createdAt || 0).toISOString().slice(0, 10) === day;
      }).length,
    }));
  }

  return {
    metrics: {
      totalProjects,
      totalMedia,
      activeProjects,
      finishedProjects,
      totalViewsLast7,
      totalProjectViewsLast7,
      totalPostViewsLast7,
    },
    analyticsSeries7d,
    rankedProjects,
    recentPosts,
    recentComments,
    pendingCommentsCount,
    quickProjects,
  };
};

const canViewAuditLog = (userId) => {
  if (!userId) {
    return false;
  }
  if (isRbacV2Enabled) {
    return hasPermissionByUserId(userId, PermissionId.AUDIT_LOG);
  }
  return isOwner(userId);
};

const canManageIntegrations = (userId) => {
  if (!userId) {
    return false;
  }
  if (isRbacV2Enabled) {
    return hasPermissionByUserId(userId, PermissionId.INTEGRACOES);
  }
  return canManageProjects(userId) || canManageSettings(userId);
};

const parseDashboardNotificationsLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 30;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), 100);
};

const toDashboardNotificationId = (value) =>
  crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, 16);

const canManageUsersBasic = (userId) => {
  if (!userId) {
    return false;
  }
  if (isRbacV2Enabled) {
    return hasPermissionByUserId(userId, PermissionId.USUARIOS_BASICO);
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes("usuarios");
};

const canManageUsersAccess = (userId) => {
  if (!userId) {
    return false;
  }
  if (isRbacV2Enabled) {
    return hasPermissionByUserId(userId, PermissionId.USUARIOS_ACESSO);
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes("usuarios");
};

const normalizeUploadScopeUserId = (value) => String(value || "").trim();

const resolveRequestUploadAccessScope = ({
  sessionUser,
  folder = "",
  listAll = false,
  scopeUserId = "",
} = {}) =>
  resolveUploadScopeAccess({
    hasUploadManagement: canManageUploads(sessionUser?.id),
    canManagePosts: canManagePosts(sessionUser?.id),
    canManageProjects: canManageProjects(sessionUser?.id),
    canManageUsersBasic: canManageUsersBasic(sessionUser?.id),
    canManagePages: canManagePages(sessionUser?.id),
    canManageSettings: canManageSettings(sessionUser?.id),
    sessionUserId: String(sessionUser?.id || "").trim(),
    scopeUserId: normalizeUploadScopeUserId(scopeUserId),
    folder,
    listAll,
  });

const enforceUserAccessInvariants = (usersInput) => {
  const ownerIds = loadOwnerIds().map((id) => String(id));
  const primaryOwnerId = ownerIds[0] ? String(ownerIds[0]) : null;
  return normalizeUsers(usersInput).map((user) => {
    const effectiveAccessRole = computeEffectiveAccessRole({
      userId: user.id,
      accessRole: user.accessRole,
      ownerIds,
      primaryOwnerId,
    });

    if (isRbacV2Enabled) {
      const sanitizedPermissions = sanitizePermissionsForStorage(user.permissions, {
        acceptLegacyStar: false,
        keepUnknown: true,
      });
      if (effectiveAccessRole === AccessRole.OWNER_PRIMARY) {
        return {
          ...user,
          status: "active",
          accessRole: AccessRole.OWNER_PRIMARY,
          permissions: [...defaultPermissionsForRole(AccessRole.OWNER_PRIMARY)],
        };
      }
      if (effectiveAccessRole === AccessRole.OWNER_SECONDARY) {
        return {
          ...user,
          status: "active",
          accessRole: AccessRole.OWNER_SECONDARY,
          permissions: sanitizedPermissions,
        };
      }
      return {
        ...user,
        accessRole: effectiveAccessRole,
        permissions: sanitizedPermissions,
      };
    }

    if (ownerIds.includes(user.id)) {
      return { ...user, status: "active", permissions: ["*"], accessRole: effectiveAccessRole };
    }
    return { ...user, accessRole: effectiveAccessRole };
  });
};

const permissionsForRead = (permissions) => {
  if (!isRbacV2Enabled) {
    return normalizePermissionsRaw(permissions);
  }
  const expanded = expandLegacyPermissions(permissions, {
    acceptLegacyStar: isRbacV2AcceptLegacyStar,
    keepUnknown: true,
  });
  return [...expanded.knownPermissions, ...expanded.unknownPermissions];
};

const userWithAccessForResponse = (user, ownerIdsInput = null) => {
  const ownerIds = Array.isArray(ownerIdsInput)
    ? ownerIdsInput.map((id) => String(id))
    : loadOwnerIds().map((id) => String(id));
  const primaryOwnerId = ownerIds[0] ? String(ownerIds[0]) : null;
  const accessRole = computeEffectiveAccessRole({
    userId: user.id,
    accessRole: user.accessRole,
    ownerIds,
    primaryOwnerId,
  });
  const grants = computeGrants({
    userId: user.id,
    accessRole,
    permissions: user.permissions,
    ownerIds,
    primaryOwnerId,
    acceptLegacyStar: isRbacV2AcceptLegacyStar,
  });
  return {
    ...user,
    accessRole,
    permissions: permissionsForRead(user.permissions),
    grants,
  };
};

const syncAllowedUsers = (users) => {
  const activeIds = users.filter((user) => user.status === "active").map((user) => user.id);
  const unique = Array.from(new Set([...loadOwnerIds(), ...activeIds]));
  writeAllowedUsers(unique);
};

const ensureOwnerUser = (sessionUser) => {
  if (!sessionUser || !isOwner(sessionUser.id)) {
    return;
  }

  let users = normalizeUsers(loadUsers());
  const ownerIds = loadOwnerIds().map((id) => String(id));
  const primaryOwnerId = ownerIds[0] ? String(ownerIds[0]) : null;
  const targetAccessRole = computeEffectiveAccessRole({
    userId: sessionUser.id,
    accessRole: AccessRole.OWNER_SECONDARY,
    ownerIds,
    primaryOwnerId,
  });
  if (!users.some((user) => user.id === String(sessionUser.id))) {
    users.push({
      id: String(sessionUser.id),
      name: sessionUser.name || "Administrador",
      phrase: "",
      bio: "",
      avatarUrl: sessionUser.avatarUrl || null,
      avatarDisplay: normalizeAvatarDisplay(null),
      socials: [],
      status: "active",
      permissions: isRbacV2Enabled ? [...defaultPermissionsForRole(targetAccessRole)] : ["*"],
      accessRole: targetAccessRole,
      order: users.length,
    });
  }

  users = enforceUserAccessInvariants(users);
  users.sort((a, b) => a.order - b.order);
  writeUsers(users);
  syncAllowedUsers(users);
};

const SITEMAP_STATIC_PUBLIC_PATHS = [
  "/",
  "/projetos",
  "/sobre",
  "/equipe",
  "/faq",
  "/recrutamento",
  "/doacoes",
];

const getPublicReadableProjects = () =>
  buildPublicReadableProjects(normalizeProjects(loadProjects()));
const getPublicVisibleProjects = () =>
  buildPublicVisibleProjects(normalizeProjects(loadProjects()));

const getPublicVisiblePosts = () => {
  const now = Date.now();
  return normalizePosts(loadPosts())
    .filter((post) => !post.deletedAt)
    .filter((post) => {
      const publishTime = new Date(post.publishedAt).getTime();
      return publishTime <= now && (post.status === "published" || post.status === "scheduled");
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
};

const getPublicVisibleUpdates = () => {
  const rawProjects = normalizeProjects(loadProjects()).filter((project) => !project.deletedAt);
  const projectMap = new Map(rawProjects.map((project) => [String(project.id), project]));
  return loadUpdates()
    .filter((update) => {
      const projectId = String(update?.projectId || "").trim();
      if (!projectId) {
        return false;
      }
      const project = projectMap.get(projectId);
      if (!project) {
        return false;
      }
      const lookup = resolveEpisodeLookup(project, update?.episodeNumber, update?.volume, {
        requirePublished: true,
      });
      if (!lookup.ok) {
        return false;
      }
      return isEpisodePublic(project.type || "", lookup.episode);
    })
    .map((update) => {
      const reason = String(update?.reason || "");
      const kind = String(update?.kind || "");
      if (
        kind.toLowerCase().startsWith("lan") &&
        reason.toLowerCase().includes("novo link adicionado")
      ) {
        return { ...update, kind: "Ajuste" };
      }
      return update;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

const stripAndTruncateRssText = (value, max = 280) => {
  const text = stripHtml(String(value || ""))
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return "";
  }
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
};

const buildPublicSitemapEntries = () => {
  const settings = loadSiteSettings();
  const siteUpdatedAt = String(settings?.updatedAt || "").trim();
  const entries = [
    ...SITEMAP_STATIC_PUBLIC_PATHS.map((pathname) => ({
      loc: `${PRIMARY_APP_ORIGIN}${pathname}`,
      lastmod: siteUpdatedAt || null,
      changefreq: pathname === "/" ? "hourly" : "daily",
      priority: pathname === "/" ? 1 : pathname === "/projetos" ? 0.9 : 0.7,
    })),
    ...getPublicVisibleProjects().map((project) => ({
      loc: `${PRIMARY_APP_ORIGIN}/projeto/${project.id}`,
      lastmod: project.updatedAt || project.createdAt || null,
      changefreq: "weekly",
      priority: 0.8,
    })),
    ...getPublicVisiblePosts().map((post) => ({
      loc: `${PRIMARY_APP_ORIGIN}/postagem/${post.slug}`,
      lastmod: post.updatedAt || post.publishedAt || null,
      changefreq: "monthly",
      priority: 0.7,
    })),
  ];
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry.loc || seen.has(entry.loc)) {
      return false;
    }
    seen.add(entry.loc);
    return true;
  });
};

const buildPostsRssItems = () =>
  getPublicVisiblePosts()
    .slice(0, 50)
    .map((post) => {
      const link = `${PRIMARY_APP_ORIGIN}/postagem/${post.slug}`;
      return {
        title: post.title || "Postagem",
        link,
        guid: link,
        pubDate: post.publishedAt,
        description: stripAndTruncateRssText(
          post.seoDescription || post.excerpt || post.content || "",
        ),
        categories: Array.isArray(post.tags) ? post.tags.slice(0, 5) : [],
      };
    });

const buildLaunchesRssItems = () => {
  const publicProjects = new Map(
    getPublicVisibleProjects().map((project) => [String(project.id), project]),
  );
  return getPublicVisibleUpdates()
    .filter((update) => {
      const kind = String(update?.kind || "")
        .trim()
        .toLowerCase();
      return kind.startsWith("lan") || kind === "ajuste";
    })
    .slice(0, 50)
    .map((update) => {
      const projectId = String(update?.projectId || "").trim();
      const project = publicProjects.get(projectId);
      const projectTitle = String(update?.projectTitle || project?.title || "Projeto");
      const unit = String(update?.unit || "Capítulo").trim() || "Capítulo";
      const isExtraUnit = unit.toLowerCase() === "extra";
      const episodeNumber = Number.isFinite(Number(update?.episodeNumber))
        ? Number(update.episodeNumber)
        : null;
      const kind = String(update?.kind || "Atualização").trim() || "Atualização";
      const link = project ? `${PRIMARY_APP_ORIGIN}/projeto/${project.id}` : PRIMARY_APP_ORIGIN;
      return {
        title: `${kind}: ${projectTitle}${episodeNumber !== null ? ` - ${unit}${isExtraUnit ? "" : ` ${episodeNumber}`}` : ""}`,
        link,
        guid: `${link}#update-${String(update?.id || crypto.randomUUID())}`,
        pubDate: String(update?.updatedAt || new Date().toISOString()),
        description: stripAndTruncateRssText(
          String(update?.reason || `${kind} em ${projectTitle}`),
          320,
        ),
        categories: [kind],
      };
    });
};

const sendXmlResponse = (res, xml, contentType) => {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  return res.status(200).send(xml);
};

const sortPublicLaunchUpdates = (updates) =>
  [...(Array.isArray(updates) ? updates : [])]
    .filter((update) => {
      const kind = String(update?.kind || "")
        .trim()
        .toLowerCase();
      return kind === "lançamento" || kind === "lancamento";
    })
    .sort((a, b) => new Date(b?.updatedAt || 0).getTime() - new Date(a?.updatedAt || 0).getTime());

const buildPublicHeroSlides = (projects, updates) => {
  const projectList = Array.isArray(projects) ? projects : [];
  const launchUpdates = sortPublicLaunchUpdates(updates);
  const latestLaunchByProject = new Map();
  launchUpdates.forEach((update) => {
    const projectId = String(update?.projectId || "").trim();
    if (!projectId || latestLaunchByProject.has(projectId)) {
      return;
    }
    latestLaunchByProject.set(projectId, String(update?.updatedAt || ""));
  });

  const projectsById = new Map(projectList.map((project) => [String(project?.id || ""), project]));
  const resultIds = new Set();
  const slides = [];
  const maxSlides = 5;
  const epoch = "1970-01-01T00:00:00.000Z";
  const createSlide = (project, updatedAt) => {
    const projectId = String(project?.id || "");
    if (!projectId || resultIds.has(projectId)) {
      return null;
    }
    const image =
      String(project?.heroImageUrl || "").trim() ||
      String(project?.banner || "").trim() ||
      String(project?.cover || "").trim() ||
      "";
    if (!image) {
      return null;
    }
    return {
      id: projectId,
      image,
      updatedAt: updatedAt || epoch,
    };
  };

  const orderedProjects = projectList
    .map((project, index) => {
      const projectId = String(project?.id || "");
      const updatedAt = latestLaunchByProject.get(projectId) || "";
      const time = updatedAt ? new Date(updatedAt).getTime() : 0;
      return { project, index, updatedAt, time };
    })
    .sort((a, b) => {
      if (b.time !== a.time) {
        return b.time - a.time;
      }
      return a.index - b.index;
    });

  orderedProjects.forEach((item) => {
    const slide = createSlide(item.project, item.updatedAt);
    if (!slide) {
      return;
    }
    if (slides.length < maxSlides) {
      slides.push(slide);
      resultIds.add(slide.id);
      return;
    }
    if (item.project?.forceHero !== true) {
      return;
    }
    slides.push(slide);
    resultIds.add(slide.id);
    const removeIndexFromEnd = [...slides]
      .reverse()
      .findIndex((candidate) => projectsById.get(candidate.id)?.forceHero !== true);
    if (removeIndexFromEnd === -1) {
      const removed = slides.shift();
      if (removed) {
        resultIds.delete(removed.id);
      }
      return;
    }
    const removeIndex = slides.length - 1 - removeIndexFromEnd;
    const [removed] = slides.splice(removeIndex, 1);
    if (removed) {
      resultIds.delete(removed.id);
    }
  });

  return slides;
};

const PUBLIC_BOOTSTRAP_MODE_FULL = "full";
const PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME = "critical-home";

const toCriticalHomeProjectPayload = (project) => ({
  id: String(project?.id || "").trim(),
  title: String(project?.title || "").trim(),
  synopsis: String(project?.synopsis || ""),
  description: String(project?.description || ""),
  type: String(project?.type || ""),
  status: String(project?.status || ""),
  tags: Array.isArray(project?.tags) ? project.tags : [],
  cover: String(project?.cover || ""),
  coverAlt: String(project?.coverAlt || ""),
  banner: String(project?.banner || ""),
  bannerAlt: String(project?.bannerAlt || ""),
  heroImageUrl: String(project?.heroImageUrl || ""),
  heroImageAlt: String(project?.heroImageAlt || ""),
  forceHero: project?.forceHero === true,
  trailerUrl: String(project?.trailerUrl || ""),
  volumeEntries: [],
  volumeCovers: [],
  episodeDownloads: [],
  views: Number.isFinite(Number(project?.views)) ? Math.max(0, Number(project.views)) : 0,
  viewsDaily:
    project?.viewsDaily && typeof project.viewsDaily === "object" ? project.viewsDaily : {},
});

const toCriticalHomeUpdatePayload = (update) => ({
  id: String(update?.id || "").trim(),
  projectId: String(update?.projectId || "").trim(),
  projectTitle: String(update?.projectTitle || ""),
  episodeNumber: Number.isFinite(Number(update?.episodeNumber)) ? Number(update.episodeNumber) : 0,
  volume: Number.isFinite(Number(update?.volume)) ? Number(update.volume) : undefined,
  kind: String(update?.kind || ""),
  reason: String(update?.reason || ""),
  updatedAt: String(update?.updatedAt || ""),
  image: String(update?.image || ""),
  unit: String(update?.unit || ""),
});

const toCriticalHomePagesPayload = (pages) => ({
  home:
    pages?.home && typeof pages.home === "object"
      ? {
          shareImage: String(pages.home.shareImage || ""),
          shareImageAlt: String(pages.home.shareImageAlt || ""),
        }
      : { shareImage: "", shareImageAlt: "" },
});

const buildCriticalHomeBootstrapPayload = ({ settings, pages, projects, updates, generatedAt }) => {
  const heroSlides = buildPublicHeroSlides(projects, updates);
  const heroProjectIds = new Set(heroSlides.map((slide) => String(slide?.id || "").trim()));
  const criticalProjects = projects
    .filter((project) => heroProjectIds.has(String(project?.id || "").trim()))
    .map((project) => toCriticalHomeProjectPayload(project));
  const criticalUpdates = sortPublicLaunchUpdates(updates)
    .filter((update) => heroProjectIds.has(String(update?.projectId || "").trim()))
    .slice(0, Math.max(1, heroProjectIds.size))
    .map((update) => toCriticalHomeUpdatePayload(update));

  const payload = buildPublicBootstrapPayload({
    settings,
    pages: toCriticalHomePagesPayload(pages),
    projects: criticalProjects,
    posts: [],
    updates: criticalUpdates,
    tagTranslations: {
      tags: {},
      genres: {},
      staffRoles: {},
    },
    generatedAt,
    payloadMode: PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME,
  });
  payload.mediaVariants = buildPublicMediaVariants([
    payload.projects,
    payload.updates,
    payload.pages,
    { image: settings?.site?.defaultShareImage || "" },
  ]);
  return payload;
};

const buildPublicBootstrapResponsePayload = ({
  settings = loadSiteSettings(),
  pages = loadPages(),
  generatedAt = new Date().toISOString(),
  payloadMode = PUBLIC_BOOTSTRAP_MODE_FULL,
} = {}) => {
  const now = Date.now();
  const projects = getPublicVisibleProjects();
  const posts = normalizePosts(loadPosts())
    .filter((post) => !post.deletedAt)
    .filter((post) => {
      const publishTime = new Date(post.publishedAt).getTime();
      return publishTime <= now && (post.status === "published" || post.status === "scheduled");
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .map((post) => {
      const resolvedCover = resolvePostCover(post);
      return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        coverImageUrl: resolvedCover.coverImageUrl,
        coverAlt: resolvedCover.coverAlt,
        excerpt: post.excerpt,
        author: post.author,
        publishedAt: post.publishedAt,
        projectId: post.projectId || "",
        tags: Array.isArray(post.tags) ? post.tags : [],
      };
    });
  const updates = getPublicVisibleUpdates().slice(0, 10);
  const safePayloadMode =
    payloadMode === PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME
      ? PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME
      : PUBLIC_BOOTSTRAP_MODE_FULL;

  if (safePayloadMode === PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME) {
    return buildCriticalHomeBootstrapPayload({
      settings,
      pages,
      projects,
      updates,
      generatedAt,
    });
  }

  const teamMembers = buildPublicTeamMembers();
  const teamLinkTypes = loadLinkTypes();
  const payload = buildPublicBootstrapPayload({
    settings,
    pages,
    projects,
    posts,
    updates,
    teamMembers,
    teamLinkTypes,
    tagTranslations: loadTagTranslations(),
    generatedAt,
    payloadMode: PUBLIC_BOOTSTRAP_MODE_FULL,
  });
  payload.mediaVariants = buildPublicMediaVariants(
    [
      payload.projects,
      payload.posts,
      payload.updates,
      payload.teamMembers,
      payload.teamLinkTypes,
      payload.pages,
      { image: settings?.site?.defaultShareImage || "" },
    ],
    {
      allowPrivateUrls: payload.teamMembers.map((member) => member?.avatarUrl).filter(Boolean),
    },
  );
  return payload;
};

const resolveHomeHeroPreload = (publicBootstrap) => {
  const slides = buildPublicHeroSlides(publicBootstrap?.projects, publicBootstrap?.updates);
  const firstSlide = slides[0];
  return resolveHomeHeroPreloadFromSlide({
    imageUrl: firstSlide?.image || "",
    mediaVariants: publicBootstrap?.mediaVariants,
    resolveVariantUrl: resolveMetaImageVariantUrl,
  });
};

const findBootstrapProjectByRouteSlug = (projects, routeSlug) => {
  const rawRouteSlug = String(routeSlug || "").trim();
  if (!rawRouteSlug) {
    return null;
  }
  const normalizedRouteSlug = createSlug(rawRouteSlug);
  return (
    (Array.isArray(projects) ? projects : []).find((candidate) => {
      const candidateId = String(candidate?.id || "").trim();
      return (
        candidateId === rawRouteSlug ||
        createSlug(candidateId) === normalizedRouteSlug ||
        createSlug(candidate?.title || "") === normalizedRouteSlug
      );
    }) || null
  );
};

const resolveBootstrapReadingHeroImageUrl = ({ project, chapterNumber, volume }) => {
  if (!project || !Number.isFinite(chapterNumber)) {
    return "";
  }
  const episodes = Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : [];
  const matchingEpisode =
    episodes.find((episode) => {
      if (Number(episode?.number) !== chapterNumber) {
        return false;
      }
      if (!Number.isFinite(volume)) {
        return true;
      }
      return Number(episode?.volume) === volume;
    }) || null;
  const resolvedVolume = Number.isFinite(volume)
    ? volume
    : Number.isFinite(Number(matchingEpisode?.volume))
      ? Number(matchingEpisode.volume)
      : undefined;
  const volumeEntry =
    Number.isFinite(resolvedVolume) && Array.isArray(project?.volumeEntries)
      ? project.volumeEntries.find((entry) => Number(entry?.volume) === resolvedVolume) || null
      : null;
  const volumeCover =
    Number.isFinite(resolvedVolume) && Array.isArray(project?.volumeCovers)
      ? project.volumeCovers.find((entry) => Number(entry?.volume) === resolvedVolume) || null
      : null;

  return (
    String(matchingEpisode?.coverImageUrl || "").trim() ||
    String(volumeEntry?.coverImageUrl || "").trim() ||
    String(volumeCover?.coverImageUrl || "").trim() ||
    String(project?.cover || "").trim() ||
    String(project?.heroImageUrl || "").trim() ||
    String(project?.banner || "").trim()
  );
};

const escapeHtmlAttribute = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildHomeHeroShellMarkup = (publicBootstrap) => {
  const heroPreload = resolveHomeHeroPreload(publicBootstrap);
  const heroSrc = String(heroPreload?.href || "").trim();
  if (!heroSrc) {
    return "";
  }
  const heroSrcSet = String(heroPreload?.imagesrcset || "").trim();
  const heroSizes = String(heroPreload?.imagesizes || "100vw").trim() || "100vw";

  const attrs = [
    `src="${escapeHtmlAttribute(heroSrc)}"`,
    'alt=""',
    'aria-hidden="true"',
    'fetchpriority="high"',
    'decoding="async"',
    'style="position:absolute;inset:0;height:100%;width:100%;object-fit:cover;object-position:center;"',
  ];
  if (heroSrcSet) {
    attrs.push(`srcset="${escapeHtmlAttribute(heroSrcSet)}"`);
    attrs.push(`sizes="${escapeHtmlAttribute(heroSizes)}"`);
  }

  return [
    '<div id="home-hero-shell" aria-hidden="true" style="position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0;background:#05070a;">',
    `  <img ${attrs.join(" ")} />`,
    '  <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,7,10,0.95) 0%,rgba(5,7,10,0.72) 44%,rgba(5,7,10,0.18) 100%);"></div>',
    '  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,10,0.06) 0%,rgba(5,7,10,0.68) 100%);"></div>',
    "</div>",
  ].join("\n");
};

const injectPublicBootstrapHtml = ({
  html,
  req,
  settings,
  pages,
  includeHeroImagePreload = false,
  includeProjectsImagePreloads = false,
  bootstrapMode = PUBLIC_BOOTSTRAP_MODE_FULL,
  includeHomeHeroShell = false,
}) => {
  const publicBootstrap = buildPublicBootstrapResponsePayload({
    settings,
    pages,
    payloadMode: bootstrapMode,
  });
  const publicMe = req?.session?.user ? buildUserPayload(req.session.user) : null;
  let nextHtml = injectBootstrapGlobals({
    html,
    publicBootstrap,
    settings,
    publicMe,
  });
  const preloads = extractLocalStylesheetHrefs(nextHtml).map((href) => ({
    href,
    as: "style",
    crossorigin: "anonymous",
  }));
  if (includeHeroImagePreload) {
    const heroPreload = resolveHomeHeroPreload(publicBootstrap);
    if (heroPreload) {
      preloads.push(heroPreload);
    }
  }
  if (includeProjectsImagePreloads) {
    preloads.push(
      ...resolvePublicProjectsListPreloads({
        projects: publicBootstrap?.projects,
        mediaVariants: publicBootstrap?.mediaVariants,
        resolveVariantUrl: resolveMetaImageVariantUrl,
      }),
    );
  }
  if (req?.path === "/equipe") {
    const teamAvatarPreload = resolvePublicTeamAvatarPreload({
      teamMembers: publicBootstrap?.teamMembers,
      mediaVariants: publicBootstrap?.mediaVariants,
      resolveVariantUrl: resolveMetaImageVariantUrl,
    });
    if (teamAvatarPreload) {
      preloads.push(teamAvatarPreload);
    }
  }
  if (req?.path?.startsWith("/postagem/")) {
    const routeSlug = String(req?.params?.slug || "").trim();
    const bootstrapPost =
      (Array.isArray(publicBootstrap?.posts) ? publicBootstrap.posts : []).find(
        (candidate) => String(candidate?.slug || "").trim() === routeSlug,
      ) || null;
    const postCoverPreload = resolvePublicPostCoverPreload({
      coverUrl: bootstrapPost?.coverImageUrl || "",
      mediaVariants: publicBootstrap?.mediaVariants,
      resolveVariantUrl: resolveMetaImageVariantUrl,
    });
    if (postCoverPreload) {
      preloads.push(postCoverPreload);
    }
  }
  if (/^\/projeto(?:s)?\/.+\/leitura\/.+/.test(String(req?.path || ""))) {
    const routeProjectId = String(req?.params?.id || "").trim();
    const chapterNumber = Number(req?.params?.chapter);
    const routeVolume = Number(req?.query?.volume);
    const bootstrapProject = findBootstrapProjectByRouteSlug(
      publicBootstrap?.projects,
      routeProjectId,
    );
    const readingHeroImageUrl = resolveBootstrapReadingHeroImageUrl({
      project: bootstrapProject,
      chapterNumber,
      volume: Number.isFinite(routeVolume) ? routeVolume : undefined,
    });
    const readerHeroPreload = resolvePublicReaderHeroPreload({
      imageUrl: readingHeroImageUrl,
      mediaVariants: publicBootstrap?.mediaVariants,
      resolveVariantUrl: resolveMetaImageVariantUrl,
    });
    if (readerHeroPreload) {
      preloads.push(readerHeroPreload);
    }
  }
  if (preloads.length > 0) {
    nextHtml = injectPreloadLinks({
      html: nextHtml,
      preloads,
    });
  }
  if (includeHomeHeroShell) {
    nextHtml = injectHomeHeroShell({
      html: nextHtml,
      shellMarkup: buildHomeHeroShellMarkup(publicBootstrap),
    });
  }
  return nextHtml;
};

const injectDashboardBootstrapHtml = ({ html, req, settings }) => {
  const publicMe = req?.session?.user ? buildUserPayload(req.session.user) : null;
  let nextHtml = injectBootstrapGlobals({
    html,
    publicBootstrap: null,
    settings,
    publicMe,
    skipPublicFetch: true,
  });
  const preloads = extractLocalStylesheetHrefs(nextHtml).map((href) => ({
    href,
    as: "style",
    crossorigin: "anonymous",
  }));
  if (preloads.length > 0) {
    nextHtml = injectPreloadLinks({
      html: nextHtml,
      preloads,
    });
  }
  return nextHtml;
};

registerAuthRoutes({
  app,
  appendAuditLog,
  buildAuthRedirectUrl,
  canAttemptAuth,
  createDiscordAvatarUrl,
  discordApi: DISCORD_API,
  discordClientId: DISCORD_CLIENT_ID,
  discordClientSecret: DISCORD_CLIENT_SECRET,
  ensureOwnerUser,
  establishAuthenticatedSession,
  getRequestIp,
  handleAuthFailureSecuritySignals,
  handleMfaFailureSecuritySignals,
  isAllowedOrigin,
  isTotpEnabledForUser,
  loadAllowedUsers,
  metricsRegistry,
  maybeEmitExcessiveSessionsEvent,
  maybeEmitNewNetworkLoginEvent,
  primaryAppOrigin: PRIMARY_APP_ORIGIN,
  resolveAuthAppOrigin,
  resolveDiscordRedirectUri,
  revokeUserSessionIndexRecord,
  saveSessionState,
  scopes: SCOPES,
  sessionCookieConfig,
  sessionIndexTouchTsBySid,
  syncPersistedDiscordAvatarForLogin,
  updateSessionIndexFromRequest,
  verifyTotpOrRecoveryCode,
});

registerServerRoutes(
  createServerRouteDependencies({
    ADMIN_EXPORT_DATASETS,
    AccessRole,
  ANILIST_API,
  AUDIT_CSV_MAX_ROWS,
  BASIC_PROFILE_FIELDS,
  BOOTSTRAP_TOKEN,
  MAX_SVG_SIZE_BYTES,
  MAX_UPLOAD_SIZE_BYTES,
  PermissionId,
  PRIMARY_APP_ORIGIN,
  PUBLIC_ANALYTICS_EVENT_TYPE_SET,
  PUBLIC_ANALYTICS_RESOURCE_TYPE_SET,
  PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME,
  PUBLIC_BOOTSTRAP_MODE_FULL,
  PUBLIC_READ_CACHE_TAGS,
  PUBLIC_READ_CACHE_TTL_MS,
  PUBLIC_UPLOADS_DIR,
  STATIC_DEFAULT_CACHE_CONTROL,
  SecurityEventSeverity,
  SecurityEventStatus,
  WEBHOOK_DELIVERY_STATUS,
  app,
  appendAnalyticsEvent,
  appendAuditLog,
  appendPostVersion,
  appendSecretRotation,
  appendWebhookQueuedAuditLog,
  applyCommentCountToPosts,
  applyCommentCountToProjects,
  applyEpisodePublicationMetadata,
  applyOwnerRole,
  applyPostSnapshotForRollback,
  applyProjectChapterUpdate,
  attachUploadMediaMetadata,
  buildAnalyticsRange,
  buildDashboardOverviewResponsePayload,
  buildEditorialCalendarItems,
  buildInstitutionalOgDeliveryHeaders,
  buildInstitutionalPageMeta,
  buildLaunchesRssItems,
  buildManagedStorageAreaSummary,
  buildOperationalAlertsWebhookPayload,
  buildOperationalWebhookTestTransition,
  buildPostMeta,
  buildPostsRssItems,
  buildProjectImageExportDownloadPath,
  buildProjectMeta,
  buildProjectOgDeliveryHeaders,
  buildProjectOgRevision,
  buildProjectReadingMeta,
  buildProjectReadingOgDeliveryHeaders,
  buildPublicBootstrapResponsePayload,
  buildPublicMediaVariants,
  buildPublicSearchSuggestions,
  buildPublicSitemapEntries,
  buildPublicTeamMembers,
  buildRssXml,
  buildSchemaOrgPayload,
  buildSecurityWebhookPayload,
  buildSecurityWebhookTestEvent,
  buildSiteMetaWithSettings,
  buildSitemapXml,
  buildUserProfileRevisionToken,
  bulkModeratePendingComments,
  can,
  canBootstrap,
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
  canRegisterPollVote,
  canRegisterView,
  canSubmitComment,
  canUploadImage,
  canViewAnalytics,
  canViewAuditLog,
  cleanupProjectEpubImportTempUploads,
  cleanupUploadStagingWorkspace,
  collectDownloadIconUploads,
  collectEpisodeUpdatesByVisibility,
  collectLinkTypeIconUploads,
  computeBufferSha256,
  createGravatarHash,
  buildGravatarUrl,
  createRevisionToken,
  createSlug,
  createUniqueSlug,
  createUploadStagingWorkspace,
  crypto,
  dataEncryptionKeyring,
  defaultPermissionsForRole,
  deleteManagedUploadEntryAssets,
  deletePrivateUploadByUrl,
  deleteUserMfaTotpRecord,
  deriveAniListMediaOrganization,
  deriveChapterSynopsis,
  dispatchEditorialWebhookEvent,
  dispatchWebhookMessage,
  emitSecurityEvent,
  enforceUserAccessInvariants,
  enqueueAdminExportJob,
  enqueueEpubImportJob,
  enqueueProjectImageExportJob,
  enqueueProjectImageImportJob,
  enqueueProjectOgPrewarm,
  ensureEditorialWebhookSettingsNoConflict,
  ensureNoEditConflict,
  ensureOwnerUser,
  ensureUploadEntryHasRequiredVariants,
  evaluateOperationalMonitoring,
  expireEpubImportJob,
  expireProjectImageExportJob,
  expireProjectImageImportJob,
  exportProjectEpub,
  exportProjectImageChapter,
  extractFirstImageFromPostContent,
  extractRequestedUploadFocalPayload,
  fetchAniListMediaById,
  filterAnalyticsEvents,
  filterByDateRange,
  filterExportEntries,
  findDuplicateEpisodeKey,
  findDuplicateVolumeCover,
  findEpubImportJobForUser,
  findProjectChapterByEpisodeNumber,
  findProjectImageExportJobForUser,
  findProjectImageImportJobForUser,
  findPublishedImageEpisodeWithoutPages,
  findUploadByHash,
  findWebhookDelivery,
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
  getPublicReadableProjects,
  getPublicVisibleProjects,
  getPublicVisibleUpdates,
  getUploadExtFromMime,
  getUploadFolderFromUrlValue,
  getUploadMimeFromExtension,
  getUploadVariantUrlPrefix,
  getUsedUploadUrls,
  getUserAccessContextById,
  hasOwnField,
  hasProjectEpisodePages,
  importProjectEpub,
  importRemoteImageFile,
  incrementCounter,
  incrementPostViews,
  incrementProjectViews,
  injectDashboardBootstrapHtml,
  injectPublicBootstrapHtml,
  invalidateUploadsCleanupPreviewCache,
  isAdminUser,
  isAllowedOrigin,
  isAuditActionEnabled,
  isBasicProfileField,
  isChapterBasedType,
  isEpubImportJobStorageAvailable,
  isHomeHeroShellEnabled,
  isOwner,
  isPrimaryOwner,
  isPrivateUploadFolder,
  isProjectImageExportJobStorageAvailable,
  isProjectImageImportJobStorageAvailable,
  isRbacV2Enabled,
  isTotpEnabledForUser,
  isUploadFolderAllowedInScope,
  isWithinRestoreWindow,
  listActiveSessionsForUser,
  listPostVersions,
  loadAdminExportJobs,
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
  loadSecretRotations,
  loadSecurityEvents,
  loadSiteSettings,
  loadTagTranslations,
  loadUpdates,
  loadUploads,
  loadUserSessionIndexRecords,
  loadUsers,
  loadWebhookDeliveries,
  localizeProjectImageFields,
  logProjectOgDelivery,
  mapEpubImportExecutionError,
  mapProjectImageImportExecutionError,
  materializeUploadEntrySourceToStaging,
  metricsRegistry,
  migrateEditorialMentionPlaceholdersInSettings,
  normalizeAccessRole,
  normalizeAnalyticsTypeFilter,
  normalizeAvatarDisplay,
  normalizeEditorialWebhookSettings,
  normalizeEmail,
  normalizeExportDataset,
  normalizeExportFilters,
  normalizeExportFormat,
  normalizeExportStatus,
  normalizeLinkTypes,
  normalizePosts,
  normalizeProjectEpisodeContentFormat,
  normalizeProjectEpisodePages,
  normalizeProjectSnapshotForEpubImport,
  normalizeProjects,
  normalizeSearchQuery,
  normalizeSiteSettings,
  normalizeTags,
  normalizeUnifiedWebhookSettingsForRequest,
  normalizeUploadMime,
  normalizeUploadScopeUserId,
  normalizeUsers,
  normalizeVariants,
  ogRenderCache,
  parseAnalyticsRangeDays,
  parseAnalyticsTs,
  parseAuditTs,
  parseDashboardNotificationsLimit,
  parseEditRevisionOptions,
  parseEpubImportRequestBody,
  parseProjectImageImportRequestBody,
  parseSearchLimit,
  parseSearchScope,
  persistUploadEntryFromStaging,
  pickBasicProfilePatch,
  postVersionReasonLabel,
  prepareEditorialWebhookDispatch,
  previewProjectImageImport,
  publicSearchConfig,
  readEpubImportJobResult,
  readProjectImageImportJobResult,
  readPublicCachedJson,
  readUploadAltText,
  readUploadFocalState,
  readUploadSlot,
  readUploadSlotManaged,
  readUploadStorageProvider,
  removeOwnerRoleLabel,
  renderMetaHtml,
  requireAuth,
  requirePrimaryOwner,
  resolveEditorialAuthorFromPost,
  resolveEditorialEventChannel,
  resolveEpisodeLookup,
  resolveEpubImportRequestInput,
  resolveGravatarAvatarUrl,
  resolveIncomingUploadFocalState,
  resolveInstitutionalOgPageKeyFromPath,
  resolveInstitutionalOgPageTitle,
  resolveMetaImageVariantUrl,
  resolvePostCover,
  resolvePostStatus,
  resolveProjectImageImportRequestInput,
  resolveProjectReaderConfig,
  resolveProjectUpdateUnitLabel,
  resolveProjectWebhookEventKey,
  resolveRequestUploadAccessScope,
  resolvePublicRedirect,
  resolveThemeColor,
  resolveUploadAbsolutePath,
  resolveUploadVariantPresetKeysForArea,
  resolveDiscordAvatarFallbackUrl,
  revokeSessionBySid,
  runAutoUploadReorganization,
  runUploadsCleanup,
  runWebhookDeliveryWorkerTick,
  sanitizeFavoriteWorksByCategory,
  sanitizePermissionsForStorage,
  sanitizeSocials,
  sanitizeSvg,
  sanitizeUploadBaseName,
  sanitizeUploadFolder,
  sanitizeUploadSlot,
  sendHtml,
  sendXmlResponse,
  sessionCookieConfig,
  shouldEmitSecurityRuleEvent,
  shouldIncludeUploadInHashDedupe,
  summarizeWebhookDeliveries,
  syncAllowedUsers,
  syncPersistedDiscordAvatarForLogin,
  syncSessionUserDisplayProfile,
  toAbsoluteUrl,
  toAdminExportJobApiResponse,
  toDashboardNotificationId,
  toEpubImportJobApiResponse,
  toProjectImageExportJobApiResponse,
  toProjectImageImportJobApiResponse,
  toSecurityEventApiResponse,
  toWebhookDeliveryApiResponse,
  updateLexicalPollVotes,
  updateSecurityEventStatus,
  upsertAdminExportJob,
  upsertEpubImportJob,
  upsertProjectImageExportJob,
  upsertProjectImageImportJob,
  upsertUploadEntries,
  upsertWebhookDelivery,
  uploadStorageService,
  userWithAccessForResponse,
  validateEditorialWebhookChannelUrls,
  validateEditorialWebhookSettingsPlaceholders,
  validateUnifiedWebhookSettingsUrls,
  validateUploadImageBuffer,
  withEffectiveAvatarUrl,
  withUserProfileRevision,
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
    writeUsers,
  }),
);

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

