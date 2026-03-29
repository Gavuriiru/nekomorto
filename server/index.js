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
import { buildAdminExportRuntimeDependencies } from "./bootstrap/build-admin-export-runtime-dependencies.js";
import { buildDirectRouteRegistrationDependenciesFromRoot } from "./bootstrap/build-direct-route-registration-dependencies-from-root.js";
import { buildOperationalMonitoringRuntimeDependencies } from "./bootstrap/build-operational-monitoring-runtime-dependencies.js";
import { buildProjectRuntimeDependencies } from "./bootstrap/build-project-runtime-dependencies.js";
import { buildPublicRuntimeDependencies } from "./bootstrap/build-public-runtime-dependencies.js";
import { buildServerRouteContextSourceFromRoot } from "./bootstrap/build-server-route-context-source-from-root.js";
import { buildUserRuntimeDependencies } from "./bootstrap/build-user-runtime-dependencies.js";
import { buildWebhookRuntimeDependencies } from "./bootstrap/build-webhook-runtime-dependencies.js";
import { createProjectRuntimeBundle } from "./bootstrap/create-project-runtime-bundle.js";
import { createPublicRuntimeBundle } from "./bootstrap/create-public-runtime-bundle.js";
import { createServerRouteDependencies } from "./bootstrap/create-server-route-dependencies.js";
import { createUserRuntimeBundle } from "./bootstrap/create-user-runtime-bundle.js";
import { createWebhookRuntimeBundle } from "./bootstrap/create-webhook-runtime-bundle.js";
import { registerDirectServerRoutes } from "./bootstrap/register-direct-server-routes.js";
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
import * as adminExports from "./lib/admin-exports.js";
import { createAdminExportRuntime } from "./lib/admin-export-runtime.js";
import { createAnalyticsStore } from "./lib/analytics-store.js";
import { API_CONTRACT_VERSION } from "./lib/api-contract-v1.js";
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
import { createContentCollectionsRuntime } from "./lib/content-collections-runtime.js";
import { createPublicMediaRuntime } from "./lib/public-media-runtime.js";
import { createPublicReadCacheRuntime } from "./lib/public-read-cache-runtime.js";
import { selectRecentApprovedComments } from "./lib/dashboard-recent-comments.js";
import { createDataRepository } from "./lib/data-repository.js";
import { createDataRepositoryAdaptersRuntime } from "./lib/data-repository-adapters-runtime.js";
import { createDataRepositoryBasicRuntime } from "./lib/data-repository-basic-runtime.js";
import { createDataRepositoryContentRuntime } from "./lib/data-repository-content-runtime.js";
import { createDataRepositorySiteConfigRuntime } from "./lib/data-repository-site-config-runtime.js";
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
import {
  createDiscordAvatarUrl,
  createRouteGuards,
  createRuntimeMetadataBuilder,
  normalizeTags,
} from "./lib/root-composition-helpers.js";
import {
  createSiteSettingsRuntimeHelpers,
  defaultSiteSettings,
  fixMojibakeDeep,
  fixMojibakeText,
} from "./lib/site-settings-runtime-helpers.js";
import { createGravatarRuntime } from "./lib/gravatar-runtime.js";
import { createRateLimitRuntime } from "./lib/rate-limit-runtime.js";
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
import { createWebhookSettingsRuntimeHelpers } from "./lib/webhook-settings-runtime-helpers.js";
import { createStartupSecuritySanitizationRuntime } from "./lib/startup-security-sanitization-runtime.js";
import {
  createGetActiveProjectTypes,
  isChapterBasedType,
  normalizeTypeLookupKey,
} from "./lib/project-type-utils.js";
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
import { createPostVersionRuntime } from "./lib/post-version-runtime.js";
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
import { PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME, PUBLIC_BOOTSTRAP_MODE_FULL } from "./lib/public-site-runtime.js";
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
import { createUploadEntriesRuntime } from "./lib/upload-entries-runtime.js";
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
  "MangÃƒÂ¡",
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
const { buildSiteSettingsStoragePayload, normalizeSiteSettings, normalizeUploadsDeep } =
  createSiteSettingsRuntimeHelpers({
    primaryAppOrigin: PRIMARY_APP_ORIGIN,
  });
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
const {
  invalidatePublicReadCacheTags,
  readPublicCachedJson,
  writePublicCachedJson,
} = createPublicReadCacheRuntime({
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

dataRepository = await createDataRepository({
  databaseUrl: DATABASE_URL,
  ownerIdsFallback: OWNER_IDS,
  analyticsSchemaVersion: ANALYTICS_SCHEMA_VERSION,
  analyticsRetentionDays: ANALYTICS_RETENTION_DAYS,
  analyticsAggRetentionDays: ANALYTICS_AGG_RETENTION_DAYS,
});

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

const getRequestIp = (req) => req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "";

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

const PUBLIC_READ_CACHE_TAGS = Object.freeze({
  BOOTSTRAP: "public:bootstrap",
  SEARCH: "public:search",
  POSTS: "public:posts",
  PROJECTS: "public:projects",
});

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

const {
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
} = createWebhookSettingsRuntimeHelpers({
  createSecurityEventPayload,
  crypto,
  defaultOperationalWebhookSettings,
  defaultProjectTypeCatalog: DEFAULT_PROJECT_TYPE_CATALOG,
  defaultSecurityWebhookSettings,
  isOpsAlertsWebhookEnabled,
  migrateEditorialMentionPlaceholdersInSettings,
  normalizeEditorialWebhookSettings,
  normalizeWebhookSettingsBundle,
  opsAlertsWebhookIntervalMs: OPS_ALERTS_WEBHOOK_INTERVAL_MS,
  opsAlertsWebhookProvider: OPS_ALERTS_WEBHOOK_PROVIDER,
  opsAlertsWebhookTimeoutMs: OPS_ALERTS_WEBHOOK_TIMEOUT_MS,
  opsAlertsWebhookUrl: OPS_ALERTS_WEBHOOK_URL,
  SecurityEventSeverity,
  SecurityEventStatus,
  validateWebhookUrlForProvider,
});

const {
  applyCommentCountToPosts,
  applyCommentCountToProjects,
  incrementPostViews,
  incrementProjectViews,
  normalizePosts,
  normalizeProjects,
} = createContentCollectionsRuntime({
  createSlug,
  getLoadPosts: () => loadPosts,
  getLoadProjects: () => loadProjects,
  getProjectEpisodePageCount,
  getWritePosts: () => writePosts,
  getWriteProjects: () => writeProjects,
  normalizeProjectEpisodeContentFormat,
  normalizeProjectEpisodePages,
  normalizeProjectReaderConfig,
  normalizeUploadsDeep,
  resolvePostStatus,
});

const {
  appendPostVersion,
  applyPostSnapshotForRollback,
  isWithinRestoreWindow,
  listPostVersions,
  loadPostVersions,
  postVersionReasonLabel,
  pruneExpiredDeleted,
} = createPostVersionRuntime({
  createSlug,
  createUniqueSlug,
  crypto,
  dataRepository,
  dedupePostVersionRecordsNewestFirst,
  getNormalizePosts: () => normalizePosts,
  invalidateJsonFileCache,
  readJsonFileFromCache,
  writeJsonFileToCache,
});

const {
  loadComments,
  loadPosts,
  loadProjects,
  loadUpdates,
  loadUploads,
  writeComments,
  writePosts,
  writeProjects,
  writeUpdates,
  writeUploads,
} = createDataRepositoryContentRuntime({
  dataRepository,
  getNormalizePosts: () => normalizePosts,
  getNormalizeProjects: () => normalizeProjects,
  getPruneExpiredDeleted: () => pruneExpiredDeleted,
  invalidateJsonFileCache,
  invalidatePublicReadCacheTags,
  normalizeLegacyUpdateRecord,
  normalizeUploadsDeep,
  publicReadCacheTags: PUBLIC_READ_CACHE_TAGS,
  readJsonFileFromCache,
  readUploadStorageProvider,
  resolveEpisodeLookup,
  writeJsonFileToCache,
});

const {
  loadIntegrationSettings,
  loadIntegrationSettingsBundle,
  loadIntegrationSettingsSources,
  loadPages,
  loadSiteSettings,
  loadTagTranslations,
  writeIntegrationSettings,
  writePages,
  writeSiteSettings,
  writeTagTranslations,
} = createDataRepositorySiteConfigRuntime({
  dataRepository,
  defaultSiteSettings,
  fixMojibakeDeep,
  getBuildEnvOperationalWebhookSettings: () => buildEnvOperationalWebhookSettings,
  getBuildEnvSecurityWebhookSettings: () => buildEnvSecurityWebhookSettings,
  getBuildSiteSettingsStoragePayload: () => buildSiteSettingsStoragePayload,
  getBuildWebhookSettingsBundle: () => buildWebhookSettingsBundle,
  getNormalizeSiteSettings: () => normalizeSiteSettings,
  invalidateJsonFileCache,
  invalidatePublicReadCacheTags,
  normalizeOperationalWebhookSettings,
  normalizeSecurityWebhookSettings,
  normalizeUploadsDeep,
  publicReadCacheTags: PUBLIC_READ_CACHE_TAGS,
  readJsonFileFromCache,
  writeJsonFileToCache,
});

const {
  buildManagedStorageAreaSummary,
  deleteManagedUploadEntryAssets,
  deletePrivateUploadByUrl,
  ensureUploadEntryHasRequiredVariants,
  extractRequestedUploadFocalPayload,
  getUploadFolderFromUrlValue,
  hasOwnField,
  isPrivateUploadFolder,
  normalizeUploadUrlValue,
  readUploadAltText,
  readUploadFocalState,
  readUploadSlot,
  readUploadSlotManaged,
  resolveIncomingUploadFocalState,
  upsertUploadEntries,
} = createUploadEntriesRuntime({
  STATIC_DEFAULT_CACHE_CONTROL,
  attachUploadMediaMetadata,
  buildDiskStorageAreaSummary,
  buildStorageAreaSummary,
  cleanupUploadStagingWorkspace,
  createUploadStagingWorkspace,
  crypto,
  deriveFocalPointsFromCrops,
  fs,
  getLoadUploads: () => loadUploads,
  getPrimaryFocalPoint,
  getUploadVariantUrlPrefix,
  getWriteUploads: () => writeUploads,
  materializeUploadEntrySourceToStaging,
  mergeUploadVariantPresetKeys,
  normalizeFocalCrops,
  normalizeFocalPoints,
  normalizeUploadStorageProvider,
  normalizeUploadVariantPresetKeys,
  normalizeVariants,
  path,
  persistUploadEntryFromStaging,
  primaryAppOrigin: PRIMARY_APP_ORIGIN,
  publicUploadsDir: PUBLIC_UPLOADS_DIR,
  readUploadStorageProvider,
  resolveUploadAbsolutePath,
  sanitizeUploadSlot,
  uploadStorageService,
});

const publicMediaRuntime = createPublicMediaRuntime({
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

const {
  buildPublicMediaVariants,
  collectDownloadIconUploads,
  collectLinkTypeIconUploads,
  enqueueProjectOgPrewarm,
  getUsedUploadUrls,
  logProjectOgDelivery,
  resolveMetaImageVariantUrl,
} = publicMediaRuntime;

const { runStartupSecuritySanitization } = createStartupSecuritySanitizationRuntime({
  appendAuditLog,
  createSystemAuditReq,
  dataRepository,
  loadIntegrationSettings,
  loadLinkTypes,
  loadSiteSettings,
  loadUsers,
  sanitizeIconSource,
  sanitizePublicHref,
  sanitizeSocials,
});

const {
  buildGravatarUrl,
  createGravatarHash,
  normalizeEmail,
  resolveGravatarAvatarUrl,
} = createGravatarRuntime({
  crypto,
});

const {
  canAttemptAuth,
  canBootstrap,
  canRegisterPollVote,
  canRegisterView,
  canSubmitComment,
  canUploadImage,
} = createRateLimitRuntime({
  isProduction,
  metricsRegistry,
  rateLimiter,
});


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

const getActiveProjectTypes = createGetActiveProjectTypes({
  defaultProjectTypeCatalog: DEFAULT_PROJECT_TYPE_CATALOG,
  loadProjects,
  normalizeProjects,
});
const {
  createWebhookAuditReqFromContext,
  enqueueWebhookDelivery,
  resolveWebhookAuditActions,
} = createWebhookDeliveryRuntime({
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

const {
  enqueueAdminExportJob,
  toAdminExportJobApiResponse,
} = adminExportRuntime;

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

const directRouteDependencies = buildDirectRouteRegistrationDependenciesFromRoot({
  API_CONTRACT_VERSION,
  DISCORD_API,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  METRICS_TOKEN_NORMALIZED,
  MFA_RECOVERY_CODE_PEPPER,
  PRIMARY_APP_ORIGIN,
  SCOPES,
  SecurityEventStatus,
  USER_PREFERENCES_MAX_BYTES,
  app,
  appendAuditLog,
  buildAuthRedirectUrl,
  buildMySecuritySummary,
  buildRuntimeMetadata,
  buildUserPayload,
  canAttemptAuth,
  clearEnrollmentFromSession,
  createDiscordAvatarUrl,
  dataEncryptionKeyring,
  deleteUserMfaTotpRecord,
  encryptStringWithKeyring,
  ensureOwnerUser,
  establishAuthenticatedSession,
  evaluateOperationalMonitoring,
  generateRecoveryCodes,
  getRequestIp,
  handleAuthFailureSecuritySignals,
  handleMfaFailureSecuritySignals,
  isEpubImportJobStorageAvailable,
  isMetricsEnabled,
  isPlainObject,
  isProjectImageImportJobStorageAvailable,
  isAllowedOrigin,
  isTotpEnabledForUser,
  listActiveSessionsForUser,
  loadAllowedUsers,
  loadSecurityEvents,
  loadUserPreferences,
  loadUserSessionIndexRecords,
  maybeEmitExcessiveSessionsEvent,
  maybeEmitNewNetworkLoginEvent,
  metricsRegistry,
  normalizeUserPreferences,
  proxyDiscordAvatarRequest,
  requireAuth,
  resolveAuthAppOrigin,
  resolveDiscordRedirectUri,
  resolveEnrollmentFromSession,
  resolveMfaMetadata,
  revokeSessionBySid,
  revokeUserSessionIndexRecord,
  saveSessionState,
  sessionCookieConfig,
  sessionIndexTouchTsBySid,
  startTotpEnrollment,
  syncPersistedDiscordAvatarForLogin,
  updateSessionIndexFromRequest,
  verifyTotpCode,
  verifyTotpOrRecoveryCode,
  writeUserMfaTotpRecord,
  writeUserPreferences,
  hashRecoveryCode,
});

registerDirectServerRoutes(directRouteDependencies);

const serverRouteDependencySource = buildServerRouteContextSourceFromRoot({
  ...adminExports,
  ...authzLib,
  ...dataRepositoryAdaptersRuntime,
  ...userRuntime,
  ...publicMediaRuntime,
  ...adminExportRuntime,
  ...projectRuntime,
  ...publicRuntime,
  ...webhookRuntime,
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
  AUDIT_CSV_MAX_ROWS,
  BOOTSTRAP_TOKEN,
  MAX_SVG_SIZE_BYTES,
  MAX_UPLOAD_SIZE_BYTES,
  PRIMARY_APP_ORIGIN,
  PUBLIC_ANALYTICS_EVENT_TYPE_SET,
  PUBLIC_ANALYTICS_RESOURCE_TYPE_SET,
  PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME,
  PUBLIC_BOOTSTRAP_MODE_FULL,
  PUBLIC_READ_CACHE_TAGS,
  PUBLIC_READ_CACHE_TTL_MS,
  PUBLIC_UPLOADS_DIR,
  STATIC_DEFAULT_CACHE_CONTROL,
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
  buildEditorialCalendarItems,
  buildGravatarUrl,
  buildInstitutionalOgDeliveryHeaders,
  buildInstitutionalPageMeta,
  buildManagedStorageAreaSummary,
  buildOperationalWebhookTestTransition,
  buildPostMeta,
  buildProjectMeta,
  buildProjectOgDeliveryHeaders,
  buildProjectOgRevision,
  buildProjectReadingMeta,
  buildProjectReadingOgDeliveryHeaders,
  buildPublicSearchSuggestions,
  buildRssXml,
  buildSchemaOrgPayload,
  buildSecurityWebhookTestEvent,
  buildSiteMetaWithSettings,
  buildSitemapXml,
  bulkModeratePendingComments,
  canBootstrap,
  canRegisterPollVote,
  canRegisterView,
  canSubmitComment,
  canUploadImage,
  cleanupProjectEpubImportTempUploads,
  cleanupUploadStagingWorkspace,
  collectEpisodeUpdatesByVisibility,
  computeBufferSha256,
  createGravatarHash,
  createRevisionToken,
  createSlug,
  createUniqueSlug,
  createUploadStagingWorkspace,
  crypto,
  dataEncryptionKeyring,
  deleteManagedUploadEntryAssets,
  deletePrivateUploadByUrl,
  deriveAniListMediaOrganization,
  deriveChapterSynopsis,
  dispatchWebhookMessage,
  ensureEditorialWebhookSettingsNoConflict,
  ensureNoEditConflict,
  ensureUploadEntryHasRequiredVariants,
  ensureWebhookSettingsNoConflict,
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
  getUploadExtFromMime,
  getUploadFolderFromUrlValue,
  getUploadMimeFromExtension,
  getUploadVariantUrlPrefix,
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
  isHomeHeroShellEnabled,
  isOwner,
  isPrimaryOwner,
  isPrivateUploadFolder,
  isRbacV2Enabled,
  isUploadFolderAllowedInScope,
  isWithinRestoreWindow,
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
  loadSiteSettings,
  loadTagTranslations,
  loadUpdates,
  loadUploads,
  loadUsers,
  localizeProjectImageFields,
  mapEpubImportExecutionError,
  mapProjectImageImportExecutionError,
  materializeUploadEntrySourceToStaging,
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
  resolveEditorialEventChannel,
  resolveEpisodeLookup,
  resolveGravatarAvatarUrl,
  resolveIncomingUploadFocalState,
  resolveInstitutionalOgPageKeyFromPath,
  resolveInstitutionalOgPageTitle,
  resolvePostCover,
  resolvePostStatus,
  resolveProjectImageImportRequestInput,
  resolveProjectReaderConfig,
  resolveProjectUpdateUnitLabel,
  resolvePublicRedirect,
  resolveThemeColor,
  resolveUploadAbsolutePath,
  resolveUploadVariantPresetKeysForArea,
  runAutoUploadReorganization,
  runUploadsCleanup,
  sanitizeFavoriteWorksByCategory,
  sanitizeSocials,
  sanitizeSvg,
  sanitizeUploadBaseName,
  sanitizeUploadFolder,
  sanitizeUploadSlot,
  sendHtml,
  sessionCookieConfig,
  shouldIncludeUploadInHashDedupe,
  summarizeWebhookDeliveries,
  toAbsoluteUrl,
  toEpubImportJobApiResponse,
  toProjectImageExportJobApiResponse,
  toProjectImageImportJobApiResponse,
  toWebhookDeliveryApiResponse,
  updateLexicalPollVotes,
  upsertUploadEntries,
  uploadStorageService,
  validateEditorialWebhookChannelUrls,
  validateEditorialWebhookSettingsPlaceholders,
  validateUnifiedWebhookSettingsUrls,
  validateUploadImageBuffer,
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
});

registerServerRoutes(createServerRouteDependencies(serverRouteDependencySource));

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




