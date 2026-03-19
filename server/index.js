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
import { API_CONTRACT_VERSION, buildApiContractV1 } from "./lib/api-contract-v1.js";
import { ANILIST_API, fetchAniListMediaById } from "./lib/anilist-client.js";
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
import { bulkModeratePendingComments } from "./lib/comments-bulk-moderation.js";
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
  resolveHtmlCacheControl,
} from "./lib/html-cache-control.js";
import { createIdempotencyStore } from "./lib/idempotency-store.js";
import { createJobQueue } from "./lib/job-queue.js";
import { createJsonFileCache } from "./lib/json-file-cache.js";
import { truncateMetaDescription } from "./lib/meta-description.js";
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
import { runUploadsReorganization } from "./lib/uploads-reorganizer.js";
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
import { buildOperationalAlertsWebhookNotification } from "./lib/webhooks/templates/operational-alerts.js";
import { diffOperationalAlertSets } from "./lib/webhooks/transitions.js";
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
  "editorial_webhook.sent": [
    "eventKey",
    "eventLabel",
    "channel",
    "status",
    "statusCode",
    "attempt",
    "postId",
    "projectId",
  ],
  "editorial_webhook.failed": [
    "eventKey",
    "eventLabel",
    "channel",
    "status",
    "code",
    "statusCode",
    "attempt",
    "postId",
    "projectId",
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
};

const parseAuditTs = (value) => {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const inferAuditStatus = (action) => {
  const normalized = String(action || "").toLowerCase();
  if (!normalized) {
    return "success";
  }
  if (normalized.includes("denied")) {
    return "denied";
  }
  if (normalized.includes("failed") || normalized.includes("rate_limited")) {
    return "failed";
  }
  return "success";
};

const isAuditActionEnabled = (action) => {
  const normalized = String(action || "").toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized === "integrations.webhooks_editorial.read") {
    return true;
  }
  if (
    normalized.includes(".read") ||
    normalized.endsWith(".read") ||
    normalized.includes("_read")
  ) {
    return false;
  }
  return AUDIT_ENABLED_ACTION_PATTERN.test(normalized);
};

const truncateAuditString = (value) => {
  const text = String(value || "");
  if (text.length <= AUDIT_META_STRING_MAX) {
    return text;
  }
  return `${text.slice(0, AUDIT_META_STRING_MAX)}...`;
};

const redactSignedUrl = (value) => {
  const text = String(value || "");
  const hasSensitiveQuery = /[?&](token|signature|sig|x-amz-signature|x-goog-signature)=/i.test(
    text,
  );
  if (!hasSensitiveQuery) {
    return null;
  }
  try {
    const parsed = new URL(text, PRIMARY_APP_ORIGIN);
    return `${parsed.origin}${parsed.pathname}?[redacted]`;
  } catch {
    return "[redacted_url]";
  }
};

const isSensitiveAuditKey = (key) =>
  /(token|secret|password|cookie|authorization|session|credential|jwt|signature|sig)/i.test(
    String(key || ""),
  );

const redactSensitiveFields = (value, key = "", depth = 0) => {
  if (depth > 4) {
    return "[max_depth]";
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    if (isSensitiveAuditKey(key)) {
      return "[redacted]";
    }
    const redactedUrl = redactSignedUrl(value);
    return redactedUrl || truncateAuditString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactSensitiveFields(item, key, depth + 1));
  }
  if (typeof value === "object") {
    const next = {};
    Object.keys(value)
      .slice(0, 30)
      .forEach((entryKey) => {
        if (isSensitiveAuditKey(entryKey)) {
          next[entryKey] = "[redacted]";
          return;
        }
        next[entryKey] = redactSensitiveFields(value[entryKey], entryKey, depth + 1);
      });
    return next;
  }
  return truncateAuditString(value);
};

const sanitizeAuditMeta = (meta, action) => {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return {};
  }
  const keys = AUDIT_META_ALLOWLIST[action] || AUDIT_DEFAULT_META_KEYS;
  const next = {};
  keys.forEach((key) => {
    if (!(key in meta)) {
      return;
    }
    next[key] = redactSensitiveFields(meta[key], key);
  });
  return next;
};

const compactAuditEntries = (entries, nowTs = Date.now()) => {
  const cutoff = nowTs - AUDIT_RETENTION_MS;
  const filtered = entries
    .filter((item) => parseAuditTs(item?.ts) !== null)
    .filter((item) => parseAuditTs(item.ts) >= cutoff)
    .sort((a, b) => parseAuditTs(a.ts) - parseAuditTs(b.ts));
  if (filtered.length <= AUDIT_MAX_ENTRIES) {
    return filtered;
  }
  return filtered.slice(filtered.length - AUDIT_MAX_ENTRIES);
};

const normalizeAuditEntry = (item) => {
  const normalizedAction = String(item?.action || "").trim();
  return {
    id: String(item?.id || crypto.randomUUID()),
    ts: item?.ts || new Date().toISOString(),
    actorId: String(item?.actorId || "anonymous"),
    actorName: String(item?.actorName || "anonymous"),
    ip: String(item?.ip || ""),
    action: normalizedAction,
    resource: String(item?.resource || ""),
    resourceId: item?.resourceId ? String(item.resourceId) : null,
    status: ["success", "failed", "denied"].includes(item?.status)
      ? item.status
      : inferAuditStatus(normalizedAction),
    requestId: item?.requestId ? String(item.requestId) : null,
    meta: sanitizeAuditMeta(item?.meta, normalizedAction),
  };
};

const loadAuditLog = () => {
  if (!dataRepository) {
    return [];
  }
  const entries = dataRepository.loadAuditLog();
  return (Array.isArray(entries) ? entries : []).map(normalizeAuditEntry);
};

const writeAuditLog = (entries) => {
  const compacted = compactAuditEntries(Array.isArray(entries) ? entries : []);
  if (dataRepository) {
    dataRepository.writeAuditLog(compacted);
  }
};

const appendAuditLog = (req, action, resource, meta = {}) => {
  try {
    if (!isAuditActionEnabled(action)) {
      return;
    }
    const now = new Date();
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    const sessionUser = req.session?.user || null;
    const sanitizedMeta = sanitizeAuditMeta(meta, action);
    const resourceId =
      sanitizedMeta?.resourceId ||
      sanitizedMeta?.id ||
      sanitizedMeta?.slug ||
      sanitizedMeta?.projectId ||
      sanitizedMeta?.userId ||
      null;
    const actorNameRaw = sessionUser?.name || "anonymous";
    const actorNameFixed =
      typeof fixMojibakeText === "function" ? fixMojibakeText(actorNameRaw) : String(actorNameRaw);
    const actorName =
      String(actorNameFixed || "anonymous")
        .replace(/\uFFFD/g, "")
        .trim() || "anonymous";
    const entry = {
      id: crypto.randomUUID(),
      ts: now.toISOString(),
      actorId: sessionUser?.id || "anonymous",
      actorName,
      ip: String(ip || ""),
      action: String(action || ""),
      resource: String(resource || ""),
      resourceId,
      status: inferAuditStatus(action),
      requestId: req.requestId ? String(req.requestId) : null,
      meta: sanitizedMeta,
    };
    if (dataRepository && typeof dataRepository.appendAuditLogEntry === "function") {
      dataRepository.appendAuditLogEntry(entry);
      return;
    }
    const existing = loadAuditLog();
    existing.push(entry);
    writeAuditLog(existing);
  } catch {
    // ignore audit errors
  }
};

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

const parseAnalyticsTs = (value) => {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const getDayKeyFromTs = (value) => {
  const ts = Number(value);
  if (!Number.isFinite(ts)) {
    return new Date().toISOString().slice(0, 10);
  }
  return new Date(ts).toISOString().slice(0, 10);
};

const normalizeAnalyticsTypeFilter = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["post", "project"].includes(normalized)) {
    return normalized;
  }
  return "all";
};

const parseAnalyticsRangeDays = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "7d") return 7;
  if (normalized === "30d") return 30;
  if (normalized === "90d") return 90;
  return 30;
};

const sanitizeAnalyticsText = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= ANALYTICS_META_STRING_MAX) {
    return text;
  }
  return `${text.slice(0, ANALYTICS_META_STRING_MAX)}...`;
};

const sanitizeUtmValue = (value) =>
  sanitizeAnalyticsText(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .slice(0, 64);

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

const getVisitorHash = (req) => {
  const ip = getRequestIp(req);
  if (!ip) {
    return "anonymous";
  }
  const salt = ANALYTICS_IP_SALT || SESSION_SECRET || "dev-analytics-salt";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
};

const getRequestAcquisition = (req) => {
  const refererHeader = String(req.headers.referer || "");
  const fallback = {
    referrerHost: "(direct)",
    utm: { source: "", medium: "", campaign: "" },
  };
  if (!refererHeader) {
    return fallback;
  }
  try {
    const parsed = new URL(refererHeader, PRIMARY_APP_ORIGIN);
    const host = String(parsed.host || "")
      .trim()
      .toLowerCase();
    const utm = {
      source: sanitizeUtmValue(parsed.searchParams.get("utm_source") || ""),
      medium: sanitizeUtmValue(parsed.searchParams.get("utm_medium") || ""),
      campaign: sanitizeUtmValue(parsed.searchParams.get("utm_campaign") || ""),
    };
    if (!host) {
      return { ...fallback, utm };
    }
    const referrerHost = host === PRIMARY_APP_HOST ? "(internal)" : host;
    return { referrerHost, utm };
  } catch {
    return fallback;
  }
};

const sanitizeAnalyticsMeta = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const allowlist = [
    "targetType",
    "targetId",
    "status",
    "action",
    "resourceType",
    "resourceId",
    "projectId",
    "chapterNumber",
    "volume",
    "sourceLabel",
    "surface",
    "platform",
    "browser",
    "displayMode",
    "outcome",
  ];
  const output = {};
  allowlist.forEach((key) => {
    if (!(key in value)) {
      return;
    }
    output[key] = sanitizeAnalyticsText(value[key]);
  });
  return output;
};

const normalizeAnalyticsEvent = (event) => {
  const eventType = String(event?.eventType || "")
    .trim()
    .toLowerCase();
  const normalizedType = ANALYTICS_EVENT_TYPE_SET.has(eventType) ? eventType : "view";
  const resourceTypeRaw = String(event?.resourceType || "")
    .trim()
    .toLowerCase();
  const resourceType = resourceTypeRaw || "post";
  return {
    id: String(event?.id || crypto.randomUUID()),
    ts: event?.ts || new Date().toISOString(),
    day: String(event?.day || getDayKeyFromTs(parseAnalyticsTs(event?.ts) || Date.now())),
    eventType: normalizedType,
    resourceType,
    resourceId: String(event?.resourceId || "").trim(),
    visitorHash: String(event?.visitorHash || "anonymous"),
    referrerHost: sanitizeAnalyticsText(event?.referrerHost || "(direct)") || "(direct)",
    utm: {
      source: sanitizeUtmValue(event?.utm?.source || ""),
      medium: sanitizeUtmValue(event?.utm?.medium || ""),
      campaign: sanitizeUtmValue(event?.utm?.campaign || ""),
    },
    isAuthenticated: Boolean(event?.isAuthenticated),
    meta: sanitizeAnalyticsMeta(event?.meta || {}),
  };
};

const loadAnalyticsEvents = () => {
  if (!dataRepository) {
    return [];
  }
  const events = dataRepository.loadAnalyticsEvents();
  return (Array.isArray(events) ? events : [])
    .map((event) => normalizeAnalyticsEvent(event))
    .filter(Boolean);
};

const writeAnalyticsEvents = (events) => {
  const lines = (Array.isArray(events) ? events : [])
    .map((event) => normalizeAnalyticsEvent(event))
    .filter(Boolean);
  if (dataRepository) {
    dataRepository.writeAnalyticsEvents(lines);
  }
};

const appendAnalyticsEventEntry = (event) => {
  const normalizedEvent = normalizeAnalyticsEvent(event);
  if (!dataRepository) {
    return;
  }
  if (typeof dataRepository.appendAnalyticsEventEntry === "function") {
    dataRepository.appendAnalyticsEventEntry(normalizedEvent);
    return;
  }
  const events = loadAnalyticsEvents();
  events.push(normalizedEvent);
  writeAnalyticsEvents(events);
};

const loadAnalyticsDaily = () => {
  const fallback = {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    days: {},
  };
  if (!dataRepository) {
    return fallback;
  }
  const parsed = dataRepository.loadAnalyticsDaily();
  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }
  return {
    schemaVersion: Number(parsed.schemaVersion) || ANALYTICS_SCHEMA_VERSION,
    generatedAt: String(parsed.generatedAt || fallback.generatedAt),
    days: parsed.days && typeof parsed.days === "object" ? parsed.days : {},
  };
};

const writeAnalyticsDaily = (data) => {
  if (!dataRepository) {
    return;
  }
  dataRepository.writeAnalyticsDaily({
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    generatedAt: data?.generatedAt || new Date().toISOString(),
    days: data?.days && typeof data.days === "object" ? data.days : {},
  });
};

const writeAnalyticsMeta = (value) => {
  const payload = {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    retentionDays: ANALYTICS_RETENTION_DAYS,
    aggregateRetentionDays: ANALYTICS_AGG_RETENTION_DAYS,
    updatedAt: new Date().toISOString(),
    ...(value && typeof value === "object" ? value : {}),
  };
  if (dataRepository) {
    dataRepository.writeAnalyticsMeta(payload);
  }
};

const ensureAnalyticsDayBucket = (days, dayKey) => {
  if (!days[dayKey]) {
    days[dayKey] = {
      totals: {
        views: 0,
        chapterViews: 0,
        downloadClicks: 0,
        commentsCreated: 0,
        commentsApproved: 0,
      },
      byResourceType: {
        post: { views: 0 },
        project: { views: 0 },
      },
      acquisition: {
        referrerHost: {},
        utmSource: {},
        utmMedium: {},
        utmCampaign: {},
      },
    };
  }
  return days[dayKey];
};

const incrementCounter = (target, key, amount = 1) => {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) {
    return;
  }
  target[normalizedKey] = Number(target[normalizedKey] || 0) + amount;
};

const buildAnalyticsDailyFromEvents = (events, nowTs = Date.now()) => {
  const cutoff = nowTs - ANALYTICS_AGG_RETENTION_MS;
  const days = {};
  events.forEach((event) => {
    const ts = parseAnalyticsTs(event.ts);
    if (ts === null || ts < cutoff) {
      return;
    }
    const dayKey = getDayKeyFromTs(ts);
    const bucket = ensureAnalyticsDayBucket(days, dayKey);
    if (event.eventType === "view") {
      bucket.totals.views += 1;
      if (event.resourceType === "post" || event.resourceType === "project") {
        bucket.byResourceType[event.resourceType].views += 1;
      }
      incrementCounter(bucket.acquisition.referrerHost, event.referrerHost || "(direct)");
      if (event.utm?.source) incrementCounter(bucket.acquisition.utmSource, event.utm.source);
      if (event.utm?.medium) incrementCounter(bucket.acquisition.utmMedium, event.utm.medium);
      if (event.utm?.campaign) incrementCounter(bucket.acquisition.utmCampaign, event.utm.campaign);
    }
    if (event.eventType === "chapter_view") {
      bucket.totals.chapterViews += 1;
    }
    if (event.eventType === "download_click") {
      bucket.totals.downloadClicks += 1;
    }
    if (event.eventType === "comment_created") {
      bucket.totals.commentsCreated += 1;
    }
    if (event.eventType === "comment_approved") {
      bucket.totals.commentsApproved += 1;
    }
  });
  return {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    days,
  };
};

const compactAnalyticsData = (nowTs = Date.now()) => {
  const cutoff = nowTs - ANALYTICS_RETENTION_MS;
  const compacted = loadAnalyticsEvents()
    .filter((event) => parseAnalyticsTs(event.ts) !== null)
    .filter((event) => parseAnalyticsTs(event.ts) >= cutoff)
    .sort((a, b) => (parseAnalyticsTs(a.ts) || 0) - (parseAnalyticsTs(b.ts) || 0));
  writeAnalyticsEvents(compacted);
  const daily = buildAnalyticsDailyFromEvents(compacted, nowTs);
  writeAnalyticsDaily(daily);
  writeAnalyticsMeta({
    eventCount: compacted.length,
    lastCompactionAt: new Date().toISOString(),
  });
  return { events: compacted, daily };
};

const enqueueAnalyticsCompactionJob = ({ trigger = "manual" } = {}) =>
  backgroundJobQueue.enqueue({
    type: "analytics.compaction",
    payload: { trigger },
    run: async () => compactAnalyticsData(),
  });

const shouldRegisterAnalyticsView = (visitorHash, resourceType, resourceId, nowTs = Date.now()) => {
  const key = `${visitorHash}|${resourceType}|${resourceId}`;
  const previous = analyticsViewCooldown.get(key);
  if (Number.isFinite(previous) && nowTs - previous < ANALYTICS_VIEW_COOLDOWN_MS) {
    return false;
  }
  analyticsViewCooldown.set(key, nowTs);
  if (analyticsViewCooldown.size > 20000) {
    const expirationTs = nowTs - ANALYTICS_VIEW_COOLDOWN_MS;
    Array.from(analyticsViewCooldown.entries()).forEach(([entryKey, ts]) => {
      if (ts < expirationTs) {
        analyticsViewCooldown.delete(entryKey);
      }
    });
  }
  return true;
};

const appendAnalyticsEvent = (req, payload) => {
  try {
    const normalizedPayload = payload && typeof payload === "object" ? payload : {};
    const eventType = String(normalizedPayload.eventType || "")
      .trim()
      .toLowerCase();
    if (!ANALYTICS_EVENT_TYPE_SET.has(eventType)) {
      return { ok: false, reason: "invalid_event_type" };
    }
    const resourceType = String(normalizedPayload.resourceType || "")
      .trim()
      .toLowerCase();
    const resourceId = String(normalizedPayload.resourceId || "").trim();
    if (!resourceType || !resourceId) {
      return { ok: false, reason: "invalid_resource" };
    }
    const now = new Date();
    const visitorHash = getVisitorHash(req);
    if (
      ANALYTICS_COOLDOWN_EVENT_TYPE_SET.has(eventType) &&
      ANALYTICS_COOLDOWN_RESOURCE_SET.has(resourceType) &&
      !shouldRegisterAnalyticsView(visitorHash, resourceType, resourceId, now.getTime())
    ) {
      return { ok: false, reason: "cooldown" };
    }
    const acquisition = getRequestAcquisition(req);
    const event = normalizeAnalyticsEvent({
      id: crypto.randomUUID(),
      ts: now.toISOString(),
      day: getDayKeyFromTs(now.getTime()),
      eventType,
      resourceType,
      resourceId,
      visitorHash,
      referrerHost: acquisition.referrerHost,
      utm: acquisition.utm,
      isAuthenticated: Boolean(req.session?.user),
      meta: sanitizeAnalyticsMeta(normalizedPayload.meta || {}),
    });
    appendAnalyticsEventEntry(event);
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
};

const buildAnalyticsRange = (rangeDays, nowTs = Date.now()) => {
  const safeDays = Number.isFinite(rangeDays) ? Math.max(1, Math.floor(rangeDays)) : 30;
  const endDate = new Date(nowTs);
  endDate.setUTCHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setUTCDate(endDate.getUTCDate() - (safeDays - 1));
  startDate.setUTCHours(0, 0, 0, 0);
  const keys = [];
  for (let index = 0; index < safeDays; index += 1) {
    const day = new Date(startDate);
    day.setUTCDate(startDate.getUTCDate() + index);
    keys.push(day.toISOString().slice(0, 10));
  }
  return {
    rangeDays: safeDays,
    fromTs: startDate.getTime(),
    toTs: endDate.getTime(),
    dayKeys: keys,
  };
};

const filterAnalyticsEvents = (events, fromTs, toTs, type) =>
  events.filter((event) => {
    const ts = parseAnalyticsTs(event.ts);
    if (ts === null || ts < fromTs || ts > toTs) {
      return false;
    }
    if (type !== "all" && event.resourceType !== type) {
      if (event.resourceType === "comment") {
        return String(event.meta?.targetType || "").toLowerCase() === type;
      }
      if (event.resourceType === "chapter" && type === "project") {
        return true;
      }
      return false;
    }
    return true;
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
let cachedIndexHtml = null;

const getIndexHtml = () => {
  if (isProduction) {
    if (!cachedIndexHtml) {
      cachedIndexHtml = fs.readFileSync(clientIndexPath, "utf-8");
    }
    return cachedIndexHtml;
  }
  return fs.readFileSync(clientIndexPath, "utf-8");
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toAbsoluteUrl = (value) => {
  const input = String(value || "").trim();
  if (!input) {
    return "";
  }
  if (input.startsWith("http://") || input.startsWith("https://") || input.startsWith("data:")) {
    return input;
  }
  try {
    return new URL(input, PRIMARY_APP_ORIGIN).toString();
  } catch {
    return input;
  }
};

const upsertMeta = (html, attr, key, content) => {
  const escaped = escapeHtml(content);
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  const regex = new RegExp(`<meta[^>]*${attr}="${key}"[^>]*>`, "i");
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace("</head>", `  ${tag}\n</head>`);
};

const upsertLink = (html, rel, href) => {
  const escaped = escapeHtml(href);
  const tag = `<link rel="${rel}" href="${escaped}" />`;
  const regex = new RegExp(`<link[^>]*rel="${rel}"[^>]*>`, "i");
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace("</head>", `  ${tag}\n</head>`);
};

const replaceTitle = (html, title) =>
  html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

const appendStructuredDataScripts = (html, structuredData) => {
  const entries = Array.isArray(structuredData) ? structuredData : [];
  if (entries.length === 0) {
    return html;
  }
  const scripts = entries
    .filter((entry) => entry && typeof entry === "object")
    .map(
      (entry) =>
        `  <script type="application/ld+json" data-schema-org="true">${serializeSchemaOrgEntry(entry)}</script>`,
    );
  if (scripts.length === 0) {
    return html;
  }
  return html.replace("</head>", `${scripts.join("\n")}\n</head>`);
};

const renderMetaHtml = ({
  title,
  description,
  image,
  imageAlt,
  url,
  themeColor,
  type = "website",
  siteName,
  favicon,
  structuredData = [],
}) => {
  let html = getIndexHtml();
  const safeUrl = url || PRIMARY_APP_ORIGIN;
  const safeImage = image ? toAbsoluteUrl(resolveMetaImageVariantUrl(image)) : "";
  const safeDescription = truncateMetaDescription(description);
  const safeThemeColor = String(themeColor || "#9667e0");
  html = replaceTitle(html, title);
  html = upsertMeta(html, "name", "description", safeDescription);
  html = upsertMeta(html, "name", "theme-color", safeThemeColor);
  html = upsertMeta(html, "property", "og:title", title);
  html = upsertMeta(html, "property", "og:description", safeDescription);
  html = upsertMeta(html, "property", "og:type", type);
  html = upsertMeta(html, "property", "og:url", safeUrl);
  html = upsertMeta(html, "property", "og:site_name", siteName);
  html = upsertMeta(html, "property", "og:locale", "pt_BR");
  if (safeImage) {
    html = upsertMeta(html, "property", "og:image", safeImage);
    html = upsertMeta(html, "property", "og:image:alt", String(imageAlt || ""));
    html = upsertMeta(html, "name", "twitter:image", safeImage);
    html = upsertMeta(html, "name", "twitter:image:alt", String(imageAlt || ""));
  }
  html = upsertMeta(html, "name", "twitter:title", title);
  html = upsertMeta(html, "name", "twitter:description", safeDescription);
  html = upsertMeta(html, "name", "twitter:card", safeImage ? "summary_large_image" : "summary");
  html = upsertLink(html, "canonical", safeUrl);
  if (favicon) {
    html = upsertLink(html, "icon", toAbsoluteUrl(favicon));
  }
  html = appendStructuredDataScripts(html, structuredData);
  return html;
};

const sendHtml = async (req, res, html) => {
  let nextHtml = html;
  const requestPath = req.originalUrl || req.url || "/";
  if (viteDevServer) {
    nextHtml = await viteDevServer.transformIndexHtml(requestPath, nextHtml);
  }
  const nonce = typeof res.locals?.cspNonce === "string" ? res.locals.cspNonce : "";
  const body = nonce ? injectNonceIntoHtmlScripts(nextHtml, nonce) : nextHtml;
  res.setHeader(
    "Cache-Control",
    resolveHtmlCacheControl({
      pathname: requestPath,
      isAuthenticated: Boolean(req?.session?.user),
    }),
  );
  return res.type("html").send(body);
};

const stripHtml = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isValidPostCoverImageUrl = (value) => {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (/^(data|blob):/i.test(trimmed)) {
    return false;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return true;
  }
  return trimmed.startsWith("/");
};

const findFirstLexicalImage = (node) => {
  if (!node) {
    return null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirstLexicalImage(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (typeof node !== "object") {
    return null;
  }

  const imageType = typeof node.type === "string" ? node.type.toLowerCase() : "";
  const src = typeof node.src === "string" ? node.src.trim() : "";
  if (imageType === "image" && isValidPostCoverImageUrl(src)) {
    return {
      coverImageUrl: src,
      coverAlt: typeof node.altText === "string" ? node.altText.trim() : "",
    };
  }

  if (Array.isArray(node.children)) {
    const foundInChildren = findFirstLexicalImage(node.children);
    if (foundInChildren) {
      return foundInChildren;
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "children" || key === "src" || key === "altText") {
      continue;
    }
    const found = findFirstLexicalImage(value);
    if (found) {
      return found;
    }
  }
  return null;
};

const extractFirstImageFromHtml = (value) => {
  const regex = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match = regex.exec(String(value || ""));
  while (match) {
    const url = String(match[1] || "").trim();
    if (isValidPostCoverImageUrl(url)) {
      const tag = String(match[0] || "");
      const altMatch = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
      return {
        coverImageUrl: url,
        coverAlt: altMatch ? String(altMatch[1] || "").trim() : "",
        index: typeof match.index === "number" ? match.index : Number.MAX_SAFE_INTEGER,
      };
    }
    match = regex.exec(String(value || ""));
  }
  return null;
};

const extractFirstImageFromMarkdown = (value) => {
  const regex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gi;
  let match = regex.exec(String(value || ""));
  while (match) {
    const url = String(match[2] || "").trim();
    if (isValidPostCoverImageUrl(url)) {
      return {
        coverImageUrl: url,
        coverAlt: String(match[1] || "").trim(),
        index: typeof match.index === "number" ? match.index : Number.MAX_SAFE_INTEGER,
      };
    }
    match = regex.exec(String(value || ""));
  }
  return null;
};

const extractFirstImageFromPostContent = (content, contentFormat) => {
  const rawContent = String(content || "");
  if (!rawContent.trim()) {
    return null;
  }

  if (contentFormat === "lexical") {
    try {
      const parsed = JSON.parse(rawContent);
      return findFirstLexicalImage(parsed?.root || parsed);
    } catch {
      return null;
    }
  }

  const htmlCandidate = extractFirstImageFromHtml(rawContent);
  const markdownCandidate = extractFirstImageFromMarkdown(rawContent);
  if (!htmlCandidate && !markdownCandidate) {
    return null;
  }
  if (htmlCandidate && !markdownCandidate) {
    return htmlCandidate;
  }
  if (!htmlCandidate && markdownCandidate) {
    return markdownCandidate;
  }
  return htmlCandidate.index <= markdownCandidate.index ? htmlCandidate : markdownCandidate;
};

const resolvePostCover = (post) => {
  const manualCover = typeof post?.coverImageUrl === "string" ? post.coverImageUrl.trim() : "";
  if (isValidPostCoverImageUrl(manualCover)) {
    return {
      coverImageUrl: manualCover,
      coverAlt: typeof post?.coverAlt === "string" ? post.coverAlt.trim() : "",
      source: "manual",
    };
  }

  const extracted = extractFirstImageFromPostContent(post?.content, post?.contentFormat);
  if (extracted?.coverImageUrl) {
    return {
      coverImageUrl: extracted.coverImageUrl,
      coverAlt: extracted.coverAlt || String(post?.title || "").trim() || "",
      source: "content",
    };
  }

  return {
    coverImageUrl: null,
    coverAlt: "",
    source: "none",
  };
};

const buildSiteMetaWithSettings = (settings) => ({
  title: settings.site?.name || "Nekomata",
  description: truncateMetaDescription(settings.site?.description || ""),
  image: settings.site?.defaultShareImage || "",
  imageAlt: settings.site?.defaultShareImageAlt || "",
  url: PRIMARY_APP_ORIGIN,
  type: "website",
  siteName: settings.site?.name || "Nekomata",
  favicon: settings.site?.faviconUrl || "",
});

const buildSiteMeta = () => buildSiteMetaWithSettings(loadSiteSettings());

const buildInstitutionalPageMeta = (
  pageKey,
  { settings = loadSiteSettings(), pages = loadPages() } = {},
) => {
  const resolvedPageKey = String(pageKey || "").trim();
  const titleText = resolveInstitutionalOgPageTitle(resolvedPageKey);
  if (!titleText) {
    return buildSiteMetaWithSettings(settings);
  }

  const siteName = settings.site?.name || "Nekomata";
  const separator = settings.site?.titleSeparator ?? "";
  const description = truncateMetaDescription(
    resolveInstitutionalOgSupportText({
      pageKey: resolvedPageKey,
      pages,
      settings,
    }) ||
      settings.site?.description ||
      "",
  );
  const imageRevision = buildInstitutionalOgRevisionValue({
    pageKey: resolvedPageKey,
    pages,
    settings,
  });
  const image = buildVersionedInstitutionalOgImagePath({
    pageKey: resolvedPageKey,
    revision: imageRevision,
  });

  return {
    title: `${titleText}${separator}${siteName}`,
    description,
    image,
    imageAlt: buildInstitutionalOgImageAlt(resolvedPageKey),
    url: `${PRIMARY_APP_ORIGIN}${resolveInstitutionalOgPagePath(resolvedPageKey)}`,
    type: "website",
    siteName,
    favicon: settings.site?.faviconUrl || "",
  };
};

const getPageTitleFromPathLegacy = (value) => {
  const pathValue = String(value || "/");
  const rules = [
    [/^\/$/, "Início"],
    [/^\/postagem\/.+/, "Postagem"],
    [/^\/equipe\/?$/, "Equipe"],
    [/^\/sobre\/?$/, "Sobre"],
    [/^\/doacoes\/?$/, "Doações"],
    [/^\/faq\/?$/, "FAQ"],
    [/^\/projetos\/?$/, "Projetos"],
    [/^\/projeto\/.+\/leitura\/.+/, "Leitura"],
    [/^\/projeto\/.+/, "Projeto"],
    [/^\/projetos\/.+\/leitura\/.+/, "Leitura"],
    [/^\/projetos\/.+/, "Projeto"],
    [/^\/recrutamento\/?$/, "Recrutamento"],
    [/^\/login\/?$/, "Login"],
    [/^\/dashboard\/usuarios\/?$/, "Usuários"],
    [/^\/dashboard\/posts\/?$/, "Posts"],
    [/^\/dashboard\/projetos\/?$/, "Projetos"],
    [/^\/dashboard\/comentarios\/?$/, "Comentários"],
    [/^\/dashboard\/paginas\/?$/, "Páginas"],
    [/^\/dashboard\/configuracoes\/?$/, "Configurações"],
    [/^\/dashboard\/redirecionamentos\/?$/, "Redirecionamentos"],
    [/^\/dashboard\/?$/, "Dashboard"],
  ];
  const match = rules.find(([regex]) => regex.test(pathValue));
  return match ? match[1] : getPageTitleFromPathLegacy(pathValue);
};

const getPageTitleFromPath = (value) => {
  const pathValue = String(value || "/");
  const rules = [
    [/^\/$/, "In\u00edcio"],
    [/^\/postagem\/.+/, "Postagem"],
    [/^\/equipe\/?$/, "Equipe"],
    [/^\/sobre\/?$/, "Sobre"],
    [/^\/doacoes\/?$/, "Doa\u00e7\u00f5es"],
    [/^\/faq\/?$/, "FAQ"],
    [/^\/projetos\/?$/, "Projetos"],
    [/^\/projeto\/.+\/leitura\/.+/, "Leitura"],
    [/^\/projeto\/.+/, "Projeto"],
    [/^\/projetos\/.+\/leitura\/.+/, "Leitura"],
    [/^\/projetos\/.+/, "Projeto"],
    [/^\/recrutamento\/?$/, "Recrutamento"],
    [/^\/login\/?$/, "Login"],
    [/^\/dashboard\/usuarios\/?$/, "Usu\u00e1rios"],
    [/^\/dashboard\/posts\/?$/, "Posts"],
    [/^\/dashboard\/projetos\/?$/, "Projetos"],
    [/^\/dashboard\/comentarios\/?$/, "Coment\u00e1rios"],
    [/^\/dashboard\/paginas\/?$/, "P\u00e1ginas"],
    [/^\/dashboard\/configuracoes\/?$/, "Configura\u00e7\u00f5es"],
    [/^\/dashboard\/redirecionamentos\/?$/, "Redirecionamentos"],
    [/^\/dashboard\/?$/, "Dashboard"],
  ];
  const match = rules.find(([regex]) => regex.test(pathValue));
  return match ? match[1] : "";
};

const buildProjectMeta = (
  project,
  { settings = loadSiteSettings(), translations = loadTagTranslations() } = {},
) => {
  const siteName = settings.site?.name || "Nekomata";
  const title = project?.title ? `${project.title} | ${siteName}` : siteName;
  const description = truncateMetaDescription(
    stripHtml(project?.synopsis || project?.description || "") || settings.site?.description || "",
  );
  const imageRevision = buildProjectOgRevision({
    project,
    settings,
    translations,
    origin: PRIMARY_APP_ORIGIN,
    resolveVariantUrl: resolveMetaImageVariantUrl,
  });
  const image = buildVersionedProjectOgImagePath({
    projectId: project?.id || "",
    revision: imageRevision,
  });
  const imageAlt = `Card de compartilhamento do projeto ${String(project?.title || "Projeto").trim() || "Projeto"}`;
  return {
    title,
    description,
    image,
    imageAlt,
    url: `${PRIMARY_APP_ORIGIN}/projeto/${project?.id || ""}`,
    type: "article",
    siteName,
    favicon: settings.site?.faviconUrl || "",
  };
};

const buildProjectReadingMeta = (
  project,
  {
    chapterNumber,
    volume,
    settings = loadSiteSettings(),
    translations = loadTagTranslations(),
  } = {},
) => {
  const model = buildProjectReadingOgCardModel({
    project,
    chapterNumber,
    volume,
    settings,
    tagTranslations: translations?.tags,
    genreTranslations: translations?.genres,
    origin: PRIMARY_APP_ORIGIN,
    resolveVariantUrl: resolveMetaImageVariantUrl,
  });
  if (!model) {
    return null;
  }

  const siteName = settings.site?.name || "Nekomata";
  const title = model?.seoTitle ? `${model.seoTitle} | ${siteName}` : siteName;
  const description = truncateMetaDescription(
    stripHtml(model?.seoDescription || "") || settings.site?.description || "",
  );
  const imageRevision = buildProjectReadingOgRevisionValue({
    project,
    chapterNumber,
    volume,
    settings,
    translations,
  });
  const image = buildVersionedProjectReadingOgImagePath({
    projectId: project?.id || "",
    chapterNumber: model.chapterNumberResolved ?? chapterNumber,
    volume: model.volumeResolved,
    revision: imageRevision,
  });
  const volumeQuery = Number.isFinite(Number(model.volumeResolved))
    ? `?volume=${encodeURIComponent(String(model.volumeResolved))}`
    : "";

  return {
    title,
    description,
    image,
    imageAlt:
      String(model?.imageAlt || "").trim() ||
      `Card de compartilhamento da leitura de ${String(project?.title || "Projeto").trim() || "Projeto"}`,
    url: `${PRIMARY_APP_ORIGIN}/projeto/${encodeURIComponent(String(project?.id || "").trim())}/leitura/${encodeURIComponent(String(model.chapterNumberResolved ?? chapterNumber))}${volumeQuery}`,
    type: "article",
    siteName,
    favicon: settings.site?.faviconUrl || "",
  };
};

const buildPostMeta = (post) => {
  const settings = loadSiteSettings();
  const siteName = settings.site?.name || "Nekomata";
  const title = post?.title ? `${post.title} | ${siteName}` : siteName;
  const description = truncateMetaDescription(
    stripHtml(post?.seoDescription || post?.excerpt || post?.content || "") ||
      settings.site?.description ||
      "",
  );
  const resolvedCover = resolvePostCover(post);
  const firstPostImage = extractFirstImageFromPostContent(post?.content, post?.contentFormat);
  const imageRevision = buildPostOgRevision({
    post,
    settings,
    coverImageUrl: resolvedCover?.coverImageUrl,
    firstPostImageUrl: firstPostImage?.coverImageUrl,
  });
  const image = buildVersionedPostOgImagePath({
    slug: post?.slug || "",
    revision: imageRevision,
  });
  const imageAlt = buildPostOgImageAlt(post?.title);
  return {
    title,
    description,
    image,
    imageAlt,
    url: `${PRIMARY_APP_ORIGIN}/postagem/${post?.slug || ""}`,
    type: "article",
    siteName,
    favicon: settings.site?.faviconUrl || "",
  };
};

const pickFirstNonEmptyText = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

const buildEditorialWebhookImageContext = ({
  post = null,
  project = null,
  chapter = null,
  settings = loadSiteSettings(),
  translations = loadTagTranslations(),
} = {}) => {
  const safePost = post && typeof post === "object" ? post : null;
  const safeProject = project && typeof project === "object" ? project : null;
  const safeChapter = chapter && typeof chapter === "object" ? chapter : null;
  const fallbackSiteImageUrl = pickFirstNonEmptyText(
    settings?.site?.defaultShareImage,
    "/placeholder.svg",
  );

  const resolvedPostCover = safePost ? resolvePostCover(safePost) : null;
  const firstPostImage = safePost
    ? extractFirstImageFromPostContent(safePost.content, safePost.contentFormat)
    : null;

  const postSlug = String(safePost?.slug || "").trim();
  const postOgImageUrl = postSlug
    ? buildVersionedPostOgImagePath({
        slug: postSlug,
        revision: buildPostOgRevision({
          post: safePost,
          settings,
          coverImageUrl: resolvedPostCover?.coverImageUrl,
          firstPostImageUrl: firstPostImage?.coverImageUrl,
        }),
      })
    : "";

  const projectId = String(safeProject?.id || "").trim();
  const projectOgImageUrl = projectId
    ? buildVersionedProjectOgImagePath({
        projectId,
        revision: buildProjectOgRevision({
          project: safeProject,
          settings,
          translations,
          origin: PRIMARY_APP_ORIGIN,
          resolveVariantUrl: resolveMetaImageVariantUrl,
        }),
      })
    : "";

  const chapterNumber = Number(safeChapter?.number);
  const chapterVolume = Number(safeChapter?.volume);
  let chapterOgImageUrl = "";
  if (projectId && Number.isFinite(chapterNumber)) {
    const chapterModel = buildProjectReadingOgCardModel({
      project: safeProject,
      chapterNumber,
      volume: Number.isFinite(chapterVolume) ? chapterVolume : undefined,
      settings,
      tagTranslations: translations?.tags,
      genreTranslations: translations?.genres,
      origin: PRIMARY_APP_ORIGIN,
      resolveVariantUrl: resolveMetaImageVariantUrl,
    });
    if (chapterModel) {
      const chapterNumberResolved = Number.isFinite(Number(chapterModel.chapterNumberResolved))
        ? Number(chapterModel.chapterNumberResolved)
        : chapterNumber;
      const chapterVolumeResolved = Number.isFinite(Number(chapterModel.volumeResolved))
        ? Number(chapterModel.volumeResolved)
        : Number.isFinite(chapterVolume)
          ? chapterVolume
          : undefined;
      chapterOgImageUrl = buildVersionedProjectReadingOgImagePath({
        projectId,
        chapterNumber: chapterNumberResolved,
        volume: chapterVolumeResolved,
        revision: buildProjectReadingOgRevisionValue({
          project: safeProject,
          chapterNumber: chapterNumberResolved,
          volume: chapterVolumeResolved,
          settings,
          translations,
        }),
      });
    }
  }

  const resolvedProjectOgImageUrl = pickFirstNonEmptyText(projectOgImageUrl);
  const resolvedChapterOgImageUrl = pickFirstNonEmptyText(
    chapterOgImageUrl,
    resolvedProjectOgImageUrl,
  );

  return {
    postImageUrl: pickFirstNonEmptyText(
      resolvedPostCover?.coverImageUrl,
      firstPostImage?.coverImageUrl,
      postOgImageUrl,
      fallbackSiteImageUrl,
      "/placeholder.svg",
    ),
    postOgImageUrl,
    projectImageUrl: pickFirstNonEmptyText(
      safeProject?.cover,
      safeProject?.heroImageUrl,
      safeProject?.banner,
      projectOgImageUrl,
      fallbackSiteImageUrl,
      "/placeholder.svg",
    ),
    projectBackdropImageUrl: pickFirstNonEmptyText(
      safeProject?.banner,
      safeProject?.heroImageUrl,
      safeProject?.cover,
      projectOgImageUrl,
      fallbackSiteImageUrl,
      "/placeholder.svg",
    ),
    projectOgImageUrl,
    chapterImageUrl: pickFirstNonEmptyText(
      safeChapter?.coverImageUrl,
      safeProject?.heroImageUrl,
      safeProject?.banner,
      safeProject?.cover,
      resolvedChapterOgImageUrl,
      resolvedProjectOgImageUrl,
      fallbackSiteImageUrl,
      "/placeholder.svg",
    ),
    chapterOgImageUrl: resolvedChapterOgImageUrl,
  };
};
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
const fixMojibakeText = (value) => {
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
};
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

const collectPublicUploadUrls = (value, urls, seen = new WeakSet()) => {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    const normalized = normalizeUploadUrlValue(value);
    if (normalized) {
      urls.add(normalized);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectPublicUploadUrls(item, urls, seen));
    return;
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    Object.values(value).forEach((item) => collectPublicUploadUrls(item, urls, seen));
  }
};

const buildPublicMediaVariants = (sourcesInput, options = {}) => {
  const sources = Array.isArray(sourcesInput) ? sourcesInput : [sourcesInput];
  const urls = new Set();
  sources.forEach((source) => collectPublicUploadUrls(source, urls));
  if (urls.size === 0) {
    return {};
  }
  const allowPrivateUrls = Array.isArray(options?.allowPrivateUrls) ? options.allowPrivateUrls : [];
  const uploads = loadUploads();
  const mediaVariants = {};
  uploads.forEach((entry) => {
    const normalizedUrl = normalizeUploadUrlValue(entry?.url);
    if (!normalizedUrl || !urls.has(normalizedUrl)) {
      return;
    }
    const folder = String(entry?.folder || getUploadFolderFromUrlValue(normalizedUrl) || "");
    if (
      !shouldExposePublicUploadInMediaVariants({
        uploadUrl: normalizedUrl,
        folder,
        allowPrivateUrls,
      })
    ) {
      return;
    }
    const variants = normalizeVariants(entry?.variants);
    if (!variants || Object.keys(variants).length === 0) {
      return;
    }
    const variantsVersionRaw = Number(entry?.variantsVersion);
    const variantsVersion = Number.isFinite(variantsVersionRaw)
      ? Math.max(1, Math.floor(variantsVersionRaw))
      : 1;
    const focalState = readUploadFocalState(entry);
    const sanitizedEntry = sanitizePublicMediaVariantEntry(
      {
        variantsVersion,
        variants,
        focalPoints: focalState.focalPoints,
        focalPoint: focalState.focalPoint,
      },
      {
        uploadsDir: PUBLIC_UPLOADS_DIR,
        assetExists: readUploadStorageProvider(entry, "local") === "s3" ? () => true : undefined,
      },
    );
    if (!sanitizedEntry) {
      return;
    }
    mediaVariants[normalizedUrl] = sanitizedEntry;
  });
  return mediaVariants;
};

const resolveUploadVariantUrlFromEntry = ({ entry, preset, fallbackUrl }) =>
  resolveExistingPublicVariantUrl({
    entry,
    preset,
    fallbackUrl,
    uploadsDir: PUBLIC_UPLOADS_DIR,
    assetExists: readUploadStorageProvider(entry, "local") === "s3" ? () => true : undefined,
  });

const resolveMetaImageVariantUrl = (value, preset = "og") => {
  const fallbackUrl = String(value || "").trim();
  if (!fallbackUrl) {
    return "";
  }
  const normalizedUrl = normalizeUploadUrlValue(fallbackUrl);
  if (!normalizedUrl) {
    return fallbackUrl;
  }
  const entry =
    loadUploads().find((item) => normalizeUploadUrlValue(item?.url) === normalizedUrl) || null;
  if (!entry) {
    return fallbackUrl;
  }
  return resolveUploadVariantUrlFromEntry({
    entry,
    preset,
    fallbackUrl,
  });
};

const MAX_PROJECT_OG_LOG_USER_AGENT_LENGTH = 200;

const selectVisibleProjectsForOgPrewarm = (projectIds) => {
  const visibleProjects = getPublicVisibleProjects();
  const normalizedIds = Array.isArray(projectIds)
    ? projectIds.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  if (normalizedIds.length === 0) {
    return visibleProjects;
  }
  const allowedIds = new Set(normalizedIds);
  return visibleProjects.filter((project) => allowedIds.has(String(project?.id || "").trim()));
};

const enqueueProjectOgPrewarm = ({ reason = "manual", projectIds } = {}) =>
  backgroundJobQueue.enqueue({
    type: "project-og-prewarm",
    payload: {
      reason: String(reason || "manual").trim() || "manual",
      projectIds: Array.isArray(projectIds)
        ? projectIds.map((value) => String(value || "").trim()).filter(Boolean)
        : [],
    },
    run: async () => {
      const selectedProjects = selectVisibleProjectsForOgPrewarm(projectIds);
      if (selectedProjects.length === 0) {
        return {
          total: 0,
          warmed: 0,
          cacheHits: 0,
        };
      }
      return prewarmProjectOgCache({
        projects: selectedProjects,
        settings: loadSiteSettings(),
        translations: loadTagTranslations(),
        origin: PRIMARY_APP_ORIGIN,
        resolveVariantUrl: resolveMetaImageVariantUrl,
        ogRenderCache,
      });
    },
  });

const logProjectOgDelivery = ({ projectId, cacheHit, timings, userAgent } = {}) => {
  const totalMs = Number(timings?.total || 0);
  if (cacheHit && totalMs <= 500) {
    return;
  }
  console.info("project_og_delivery", {
    projectId: String(projectId || "").trim() || null,
    cacheHit: Boolean(cacheHit),
    totalMs,
    timings:
      timings && typeof timings === "object"
        ? Object.fromEntries(
            Object.entries(timings)
              .filter(([, value]) => Number.isFinite(Number(value)))
              .map(([key, value]) => [key, Number(value)]),
          )
        : {},
    userAgent:
      String(userAgent || "")
        .trim()
        .slice(0, MAX_PROJECT_OG_LOG_USER_AGENT_LENGTH) || null,
  });
};

const collectDownloadIconUploads = (settings) => {
  const urls = new Set();
  const sources = settings?.downloads?.sources;
  if (!Array.isArray(sources)) {
    return urls;
  }
  sources.forEach((source) => {
    const normalized = normalizeUploadUrlValue(source?.icon);
    if (!normalized) {
      return;
    }
    const relative = normalized.replace(/^\/uploads\//, "");
    if (isPrivateUploadFolder(relative)) {
      urls.add(normalized);
    }
  });
  return urls;
};

const collectLinkTypeIconUploads = (items) => {
  const urls = new Set();
  if (!Array.isArray(items)) {
    return urls;
  }
  items.forEach((item) => {
    const normalized = normalizeUploadUrlValue(item?.icon);
    if (!normalized) {
      return;
    }
    const relative = normalized.replace(/^\/uploads\//, "");
    if (isPrivateUploadFolder(relative)) {
      urls.add(normalized);
    }
  });
  return urls;
};

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

const writeSiteSettings = (settings) => {
  const normalized = normalizeSiteSettings(settings);
  const storagePayload = buildSiteSettingsStoragePayload(normalized);
  if (dataRepository) {
    dataRepository.writeSiteSettings(storagePayload);
  }
  invalidatePublicReadCacheTags([PUBLIC_READ_CACHE_TAGS.BOOTSTRAP]);
  invalidateJsonFileCache("site-settings");
};

const loadIntegrationSettings = () => {
  const cached = readJsonFileFromCache("integration-settings");
  if (cached) {
    return cached;
  }
  if (!dataRepository || typeof dataRepository.loadIntegrationSettings !== "function") {
    const defaults = normalizeEditorialWebhookSettings(
      {},
      {
        defaultProjectTypes: DEFAULT_PROJECT_TYPE_CATALOG,
      },
    );
    writeJsonFileToCache("integration-settings", defaults);
    return defaults;
  }
  const parsed = dataRepository.loadIntegrationSettings();
  const normalized = normalizeEditorialWebhookSettings(parsed, {
    defaultProjectTypes: DEFAULT_PROJECT_TYPE_CATALOG,
  });
  const migrated = migrateEditorialMentionPlaceholdersInSettings(normalized);
  if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
    writeIntegrationSettings(migrated);
  }
  writeJsonFileToCache("integration-settings", migrated);
  return migrated;
};

const writeIntegrationSettings = (settings) => {
  const normalized = normalizeEditorialWebhookSettings(settings, {
    defaultProjectTypes: DEFAULT_PROJECT_TYPE_CATALOG,
  });
  const migrated = migrateEditorialMentionPlaceholdersInSettings(normalized);
  if (dataRepository && typeof dataRepository.writeIntegrationSettings === "function") {
    dataRepository.writeIntegrationSettings(migrated);
  }
  invalidateJsonFileCache("integration-settings");
  return migrated;
};

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

const clampWebhookInteger = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
};

const resolveEditorialAuthorFromPost = (postInput) => {
  const post = postInput && typeof postInput === "object" ? postInput : null;
  const authorName = String(post?.author || "").trim();
  if (!authorName) {
    return {
      name: "",
      avatarUrl: "",
    };
  }
  const normalizedAuthorName = normalizeTypeLookupKey(authorName);
  const user =
    normalizeUsers(loadUsers()).find((item) => {
      if (item?.status !== "active") {
        return false;
      }
      return normalizeTypeLookupKey(item?.name || "") === normalizedAuthorName;
    }) || null;
  return {
    name: authorName,
    avatarUrl: String(user?.avatarUrl || "").trim(),
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
    settingsInput && typeof settingsInput === "object" ? settingsInput : loadIntegrationSettings();
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
    timeoutMs: clampWebhookInteger(channel.timeoutMs, 1000, 30000, 5000),
    retries: clampWebhookInteger(channel.retries, 0, 5, 1),
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

  const result = await dispatchWebhookMessage({
    provider: "discord",
    webhookUrl: prepared.webhookUrl,
    message: prepared.payload,
    timeoutMs: prepared.timeoutMs,
    retries: prepared.retries,
  });

  appendAuditLog(
    actorReq,
    result.ok ? "editorial_webhook.sent" : "editorial_webhook.failed",
    "integrations",
    {
      eventKey,
      eventLabel: resolveEditorialEventLabel(eventKey),
      channel: prepared.channel,
      status: result.status,
      code: result.code || null,
      statusCode: result.statusCode || null,
      attempt: result.attempt || null,
      postId: post?.id || null,
      projectId: project?.id || post?.projectId || null,
    },
  );

  return {
    ...result,
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

const operationalAlertsWebhookState = {
  previousAlerts: [],
  inFlight: null,
  timer: null,
};
const analyticsCompactionState = {
  timer: null,
};

const buildOperationalDashboardUrl = () => `${PRIMARY_APP_ORIGIN}/dashboard`;

const dispatchCriticalSecurityEventWebhook = async (event) => {
  if (!event || !isOpsAlertsWebhookEnabled || !OPS_ALERTS_WEBHOOK_URL) {
    return { ok: false, status: "skipped", code: "disabled" };
  }
  if (OPS_ALERTS_WEBHOOK_PROVIDER !== "discord") {
    return { ok: false, status: "skipped", code: "unsupported_provider" };
  }
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
  const payload = {
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
  const result = await dispatchWebhookMessage({
    provider: "discord",
    webhookUrl: OPS_ALERTS_WEBHOOK_URL,
    message: payload,
    timeoutMs: OPS_ALERTS_WEBHOOK_TIMEOUT_MS,
    retries: 1,
  });
  appendAuditLog(createSystemAuditReq(), "security.webhook.dispatch", "security", {
    id: event.id,
    type: event.type,
    severity: event.severity,
    status: result.ok ? "success" : "failed",
    code: result.code || null,
    statusCode: result.statusCode || null,
  });
  return result;
};

const dispatchOperationalAlertsWebhookTransition = async ({ transition, generatedAt }) => {
  if (!transition?.hasChanges) {
    return { ok: false, status: "skipped", code: "no_change" };
  }

  if (!isOpsAlertsWebhookEnabled) {
    appendAuditLog(createSystemAuditReq(), "ops_alerts.webhook.skipped", "system", {
      reason: "disabled",
      changes:
        Number(transition.triggered?.length || 0) +
        Number(transition.changed?.length || 0) +
        Number(transition.resolved?.length || 0),
    });
    return { ok: false, status: "skipped", code: "disabled" };
  }

  if (!OPS_ALERTS_WEBHOOK_URL) {
    appendAuditLog(createSystemAuditReq(), "ops_alerts.webhook.skipped", "system", {
      reason: "missing_webhook_url",
    });
    return { ok: false, status: "skipped", code: "missing_webhook_url" };
  }

  if (OPS_ALERTS_WEBHOOK_PROVIDER !== "discord") {
    appendAuditLog(createSystemAuditReq(), "ops_alerts.webhook.skipped", "system", {
      reason: "unsupported_provider",
      provider: OPS_ALERTS_WEBHOOK_PROVIDER,
    });
    return { ok: false, status: "skipped", code: "unsupported_provider" };
  }

  const notification = buildOperationalAlertsWebhookNotification({
    transition,
    dashboardUrl: buildOperationalDashboardUrl(),
    generatedAt,
  });
  const payload = toDiscordWebhookPayload(notification);
  const result = await dispatchWebhookMessage({
    provider: OPS_ALERTS_WEBHOOK_PROVIDER,
    webhookUrl: OPS_ALERTS_WEBHOOK_URL,
    message: payload,
    timeoutMs: OPS_ALERTS_WEBHOOK_TIMEOUT_MS,
    retries: 1,
  });

  if (result.ok) {
    appendAuditLog(createSystemAuditReq(), "ops_alerts.webhook.sent", "system", {
      provider: OPS_ALERTS_WEBHOOK_PROVIDER,
      statusCode: result.statusCode || null,
      triggered: Number(transition.triggered?.length || 0),
      changed: Number(transition.changed?.length || 0),
      resolved: Number(transition.resolved?.length || 0),
    });
  } else if (result.status !== "skipped") {
    appendAuditLog(createSystemAuditReq(), "ops_alerts.webhook.failed", "system", {
      provider: OPS_ALERTS_WEBHOOK_PROVIDER,
      code: result.code || "failed",
      statusCode: result.statusCode || null,
      error: result.message || result.bodyText || null,
    });
  }

  return result;
};

const runOperationalAlertsWebhookTick = async () => {
  if (operationalAlertsWebhookState.inFlight) {
    return operationalAlertsWebhookState.inFlight;
  }
  operationalAlertsWebhookState.inFlight = (async () => {
    try {
      const snapshot = await evaluateOperationalMonitoring();
      const transition = diffOperationalAlertSets({
        previousAlerts: operationalAlertsWebhookState.previousAlerts,
        currentAlerts: snapshot.alerts.alerts,
      });
      const result = await dispatchOperationalAlertsWebhookTransition({
        transition,
        generatedAt: snapshot.alerts.generatedAt,
      });
      operationalAlertsWebhookState.previousAlerts = Array.isArray(snapshot.alerts.alerts)
        ? snapshot.alerts.alerts
        : [];
      return result;
    } catch (error) {
      appendAuditLog(createSystemAuditReq(), "ops_alerts.webhook.failed", "system", {
        provider: OPS_ALERTS_WEBHOOK_PROVIDER,
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

app.get("/api/audit-log", requireAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const userId = req.session?.user?.id;
  if (!canViewAuditLog(userId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const pageRaw = Number(req.query.page);
  const limitRaw = Number(req.query.limit);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.max(Math.floor(limitRaw), 10), 100)
      : 50;

  const action = String(req.query.action || "").trim();
  const resource = String(req.query.resource || "").trim();
  const actorId = String(req.query.actorId || "").trim();
  const status = String(req.query.status || "")
    .trim()
    .toLowerCase();
  const q = String(req.query.q || "")
    .trim()
    .toLowerCase();
  const format = String(req.query.format || "")
    .trim()
    .toLowerCase();
  const dateFromRaw = String(req.query.dateFrom || "").trim();
  const dateToRaw = String(req.query.dateTo || "").trim();
  const dateFromTs = dateFromRaw ? parseAuditTs(dateFromRaw) : null;
  const dateToTs = dateToRaw ? parseAuditTs(dateToRaw) : null;

  let entries = loadAuditLog();
  entries = entries.filter((entry) => isAuditActionEnabled(entry.action));
  if (action) {
    entries = entries.filter((entry) => entry.action === action);
  }
  if (resource) {
    entries = entries.filter((entry) => entry.resource === resource);
  }
  if (actorId) {
    entries = entries.filter((entry) => entry.actorId === actorId);
  }
  if (status && ["success", "failed", "denied"].includes(status)) {
    entries = entries.filter((entry) => entry.status === status);
  }
  if (dateFromTs !== null) {
    entries = entries.filter((entry) => {
      const ts = parseAuditTs(entry.ts);
      return ts !== null && ts >= dateFromTs;
    });
  }
  if (dateToTs !== null) {
    entries = entries.filter((entry) => {
      const ts = parseAuditTs(entry.ts);
      return ts !== null && ts <= dateToTs;
    });
  }
  if (q) {
    entries = entries.filter((entry) => {
      const haystack = [
        entry.actorName,
        entry.resourceId || "",
        entry.ip,
        entry.action,
        entry.resource,
        JSON.stringify(entry.meta || {}),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  entries.sort((a, b) => (parseAuditTs(b.ts) || 0) - (parseAuditTs(a.ts) || 0));

  if (format === "csv") {
    const escapeCsv = (value) => {
      const text = String(value ?? "");
      if (text.includes('"') || text.includes(",") || text.includes("\n")) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const exportEntries = entries.slice(0, AUDIT_CSV_MAX_ROWS);
    const isTruncated = entries.length > exportEntries.length;
    const rows = [];
    rows.push("id,ts,actorId,actorName,action,resource,resourceId,status,ip,requestId,meta");
    exportEntries.forEach((entry) => {
      rows.push(
        [
          escapeCsv(entry.id),
          escapeCsv(entry.ts),
          escapeCsv(entry.actorId),
          escapeCsv(entry.actorName),
          escapeCsv(entry.action),
          escapeCsv(entry.resource),
          escapeCsv(entry.resourceId || ""),
          escapeCsv(entry.status),
          escapeCsv(entry.ip || ""),
          escapeCsv(entry.requestId || ""),
          escapeCsv(JSON.stringify(entry.meta || {})),
        ].join(","),
      );
    });
    const csv = `\uFEFF${rows.join("\n")}`;
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"audit-log-${stamp}.csv\"`);
    res.setHeader("X-Audit-Export-Truncated", isTruncated ? "1" : "0");
    res.setHeader("X-Audit-Export-Count", String(exportEntries.length));
    res.setHeader("X-Audit-Export-Total", String(entries.length));
    return res.status(200).send(csv);
  }

  const total = entries.length;
  const start = (page - 1) * limit;
  const paged = entries.slice(start, start + limit);

  return res.json({
    entries: paged,
    page,
    limit,
    total,
    filtersApplied: {
      action,
      resource,
      actorId,
      status: ["success", "failed", "denied"].includes(status) ? status : "",
      q,
      dateFrom: dateFromRaw,
      dateTo: dateToRaw,
    },
  });
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

app.get("/api/admin/security/events", requireAuth, (req, res) => {
  if (!canManageSecurityAdmin(req.session?.user?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const pageRaw = Number(req.query.page);
  const limitRaw = Number(req.query.limit);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.max(Math.floor(limitRaw), 10), 200)
      : 50;
  const filters = normalizeExportFilters(req.query);
  let rows = loadSecurityEvents();
  rows = filterByDateRange(rows, {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    tsAccessor: (entry) => entry.ts,
  });
  rows = filterExportEntries(rows, filters, {
    fieldAccessors: {
      actorUserId: (entry) => entry.actorUserId,
      targetUserId: (entry) => entry.targetUserId,
      severity: (entry) => entry.severity,
      status: (entry) => entry.status,
      action: (entry) => entry.type,
    },
  });
  rows.sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime());
  const total = rows.length;
  const start = (page - 1) * limit;
  const paged = rows.slice(start, start + limit).map((entry) => toSecurityEventApiResponse(entry));
  return res.json({ events: paged, page, limit, total });
});
app.post("/api/admin/security/events/:id/ack", requireAuth, (req, res) => {
  if (!canManageSecurityAdmin(req.session?.user?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const event = updateSecurityEventStatus({
    eventId: req.params.id,
    status: SecurityEventStatus.ACK,
    actorUserId: req.session?.user?.id || "system",
  });
  if (!event) {
    return res.status(404).json({ error: "not_found" });
  }
  appendAuditLog(req, "security.event.ack", "security", { id: event.id });
  return res.json({ ok: true, event: toSecurityEventApiResponse(event) });
});
app.post("/api/admin/security/events/:id/resolve", requireAuth, (req, res) => {
  if (!canManageSecurityAdmin(req.session?.user?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const event = updateSecurityEventStatus({
    eventId: req.params.id,
    status: SecurityEventStatus.RESOLVED,
    actorUserId: req.session?.user?.id || "system",
  });
  if (!event) {
    return res.status(404).json({ error: "not_found" });
  }
  appendAuditLog(req, "security.event.resolve", "security", { id: event.id });
  return res.json({ ok: true, event: toSecurityEventApiResponse(event) });
});
app.post("/api/admin/security/events/:id/ignore", requireAuth, (req, res) => {
  if (!canManageSecurityAdmin(req.session?.user?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const event = updateSecurityEventStatus({
    eventId: req.params.id,
    status: SecurityEventStatus.IGNORED,
    actorUserId: req.session?.user?.id || "system",
  });
  if (!event) {
    return res.status(404).json({ error: "not_found" });
  }
  appendAuditLog(req, "security.event.ignore", "security", { id: event.id });
  return res.json({ ok: true, event: toSecurityEventApiResponse(event) });
});
app.get("/api/admin/security/rotation", requireAuth, (req, res) => {
  if (!isPrimaryOwner(req.session?.user?.id) && !canManageSecurityAdmin(req.session?.user?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const recent = loadSecretRotations().slice(0, 50);
  return res.json({
    session: {
      acceptedSecretsCount: Number(sessionCookieConfig.acceptedSecretsCount || 0),
      activeSecretConfigured: Boolean(sessionCookieConfig.activeSecret),
    },
    encryption: {
      activeKeyId: dataEncryptionKeyring.activeKeyId || null,
      availableKeyIds: Object.keys(dataEncryptionKeyring.keys || {}),
    },
    recentRotations: recent,
  });
});
app.post("/api/admin/security/rotation", requireAuth, (req, res) => {
  if (!isPrimaryOwner(req.session?.user?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const secretFamily = String(req.body?.secretFamily || "").trim();
  const keyId = String(req.body?.keyId || "").trim();
  if (!secretFamily || !keyId) {
    return res.status(400).json({ error: "secret_family_and_key_id_required" });
  }
  const entry = appendSecretRotation({
    id: crypto.randomUUID(),
    secretFamily,
    keyId,
    rotatedAt: new Date().toISOString(),
    rotatedBy: req.session?.user?.id || "system",
    notes: String(req.body?.notes || "").trim(),
    status: String(req.body?.status || "completed").trim() || "completed",
  });
  appendAuditLog(req, "security.rotation.record", "security", {
    secretFamily,
    keyId,
    id: entry?.id || null,
  });
  return res.status(201).json({ ok: true, rotation: entry });
});
app.post("/api/admin/users/:id/security/totp/reset", requireAuth, (req, res) => {
  const actorId = String(req.session?.user?.id || "").trim();
  if (!isOwner(actorId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const targetId = String(req.params.id || "").trim();
  if (!targetId) {
    return res.status(400).json({ error: "invalid_target_id" });
  }
  deleteUserMfaTotpRecord(targetId);
  appendAuditLog(req, "auth.mfa.reset_admin", "users", {
    targetId,
  });
  emitSecurityEvent({
    req,
    type: "mfa_reset_admin",
    severity: SecurityEventSeverity.WARNING,
    riskScore: 60,
    actorUserId: actorId || null,
    targetUserId: targetId,
    data: { targetId },
  });
  return res.json({ ok: true });
});
app.get("/api/admin/users/:id/sessions", requireAuth, (req, res) => {
  const actorId = String(req.session?.user?.id || "").trim();
  if (!isOwner(actorId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const targetId = String(req.params.id || "").trim();
  if (!targetId) {
    return res.status(400).json({ error: "invalid_target_id" });
  }
  const sessions = listActiveSessionsForUser(targetId).map((entry) => ({
    sid: entry.sid,
    userId: entry.userId,
    createdAt: entry.createdAt || null,
    lastSeenAt: entry.lastSeenAt || null,
    lastIp: entry.lastIp || "",
    userAgent: entry.userAgent || "",
    current: false,
    isCurrent: false,
    revokedAt: entry.revokedAt || null,
    isPendingMfa: Boolean(entry.isPendingMfa),
  }));
  return res.json({ sessions });
});
app.get("/api/admin/sessions/active", requireAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const actorId = String(req.session?.user?.id || "").trim();
  if (!isOwner(actorId)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const pageRaw = Number(req.query.page);
  const limitRaw = Number(req.query.limit);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.max(Math.floor(limitRaw), 1), 500)
      : 100;

  const usersById = new Map(
    normalizeUsers(loadUsers()).map((entry) => [String(entry.id || ""), entry]),
  );
  const currentSid = String(req.sessionID || "");
  const rows = loadUserSessionIndexRecords({ includeRevoked: false })
    .filter((entry) => !entry.revokedAt)
    .sort((a, b) => new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime());
  const total = rows.length;
  const start = (page - 1) * limit;
  const sessions = rows.slice(start, start + limit).map((entry) => {
    const normalizedUserId = String(entry.userId || "").trim();
    const user = usersById.get(normalizedUserId) || null;
    return {
      sid: String(entry.sid || ""),
      userId: normalizedUserId,
      userName: String(user?.name || normalizedUserId || "usuario"),
      userAvatarUrl: user?.avatarUrl || null,
      createdAt: entry.createdAt || null,
      lastSeenAt: entry.lastSeenAt || null,
      lastIp: entry.lastIp || "",
      userAgent: entry.userAgent || "",
      isPendingMfa: Boolean(entry.isPendingMfa),
      currentForViewer: String(entry.sid || "") === currentSid,
    };
  });

  return res.json({
    sessions,
    page,
    limit,
    total,
  });
});
app.delete("/api/admin/users/:id/sessions/:sid", requireAuth, async (req, res) => {
  const actorId = String(req.session?.user?.id || "").trim();
  if (!isOwner(actorId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const targetId = String(req.params.id || "").trim();
  const sid = String(req.params.sid || "").trim();
  if (!targetId || !sid) {
    return res.status(400).json({ error: "invalid_params" });
  }
  const target = listActiveSessionsForUser(targetId).find(
    (entry) => String(entry.sid || "") === sid,
  );
  if (!target) {
    return res.status(404).json({ error: "session_not_found" });
  }
  await revokeSessionBySid({
    sid,
    revokedBy: actorId || null,
    revokeReason: "admin_revoke",
  });
  appendAuditLog(req, "auth.sessions.admin_revoke", "users", {
    targetId,
    sid,
  });
  return res.json({ ok: true });
});
app.post("/api/admin/exports", requireAuth, async (req, res) => {
  const actorId = String(req.session?.user?.id || "").trim();
  if (!canManageSecurityAdmin(actorId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const dataset = normalizeExportDataset(req.body?.dataset);
  const format = normalizeExportFormat(req.body?.format);
  if (!ADMIN_EXPORT_DATASETS.includes(dataset)) {
    return res.status(400).json({ error: "invalid_dataset" });
  }
  const filters = normalizeExportFilters(req.body?.filters || {});
  const job = upsertAdminExportJob({
    id: crypto.randomUUID(),
    dataset,
    format,
    status: "queued",
    requestedBy: actorId,
    filters,
    filePath: null,
    rowCount: null,
    error: null,
    createdAt: new Date().toISOString(),
  });
  if (!job) {
    return res.status(500).json({ error: "job_create_failed" });
  }
  metricsRegistry.inc("export_jobs_total", {
    status: "queued",
    dataset: String(dataset || "unknown"),
  });
  appendAuditLog(req, "admin.exports.create", "exports", {
    id: job.id,
    dataset,
    format,
  });
  void enqueueAdminExportJob(job.id).catch((error) => {
    console.error(
      `[admin-export] failed to enqueue job ${job.id}: ${String(error?.message || error)}`,
    );
  });
  return res.status(202).json({ job: toAdminExportJobApiResponse(job) });
});
app.get("/api/admin/exports", requireAuth, (req, res) => {
  const actorId = String(req.session?.user?.id || "").trim();
  if (!canManageSecurityAdmin(actorId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const pageRaw = Number(req.query.page);
  const limitRaw = Number(req.query.limit);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.max(Math.floor(limitRaw), 10), 200)
      : 50;
  const statusFilter = normalizeExportStatus(req.query.status);
  const datasetFilter = normalizeExportDataset(req.query.dataset);
  let rows = loadAdminExportJobs();
  if (String(req.query.status || "").trim()) {
    rows = rows.filter((entry) => normalizeExportStatus(entry.status) === statusFilter);
  }
  if (String(req.query.dataset || "").trim()) {
    rows = rows.filter((entry) => normalizeExportDataset(entry.dataset) === datasetFilter);
  }
  if (String(req.query.requestedBy || "").trim()) {
    rows = rows.filter(
      (entry) => String(entry.requestedBy || "") === String(req.query.requestedBy || ""),
    );
  }
  rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const total = rows.length;
  const start = (page - 1) * limit;
  const paged = rows.slice(start, start + limit).map((entry) => toAdminExportJobApiResponse(entry));
  return res.json({ jobs: paged, page, limit, total });
});
app.get("/api/admin/exports/:id", requireAuth, (req, res) => {
  const actorId = String(req.session?.user?.id || "").trim();
  if (!canManageSecurityAdmin(actorId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const job = loadAdminExportJobs().find(
    (entry) => String(entry?.id || "") === String(req.params.id || ""),
  );
  if (!job) {
    return res.status(404).json({ error: "not_found" });
  }
  return res.json({ job: toAdminExportJobApiResponse(job) });
});
app.get("/api/admin/exports/:id/download", requireAuth, (req, res) => {
  const actorId = String(req.session?.user?.id || "").trim();
  if (!canManageSecurityAdmin(actorId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const job = loadAdminExportJobs().find(
    (entry) => String(entry?.id || "") === String(req.params.id || ""),
  );
  if (!job) {
    return res.status(404).json({ error: "not_found" });
  }
  if (normalizeExportStatus(job.status) !== "completed" || !job.filePath) {
    return res.status(409).json({ error: "job_not_completed" });
  }
  const expiresAtTs = new Date(job.expiresAt || 0).getTime();
  if (Number.isFinite(expiresAtTs) && Date.now() > expiresAtTs) {
    upsertAdminExportJob({
      ...job,
      status: "expired",
      error: "file_expired",
      filePath: null,
    });
    return res.status(410).json({ error: "export_expired" });
  }
  if (!fs.existsSync(job.filePath)) {
    return res.status(404).json({ error: "file_not_found" });
  }
  appendAuditLog(req, "admin.exports.download", "exports", {
    id: job.id,
    dataset: job.dataset,
  });
  const extension = normalizeExportFormat(job.format) === "jsonl" ? "jsonl" : "csv";
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=\"${job.dataset}-${job.id}.${extension}\"`,
  );
  res.setHeader(
    "Content-Type",
    extension === "jsonl" ? "application/x-ndjson; charset=utf-8" : "text/csv; charset=utf-8",
  );
  return res.sendFile(path.resolve(job.filePath));
});
app.delete("/api/admin/exports/:id", requireAuth, (req, res) => {
  const actorId = String(req.session?.user?.id || "").trim();
  if (!canManageSecurityAdmin(actorId)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const job = loadAdminExportJobs().find(
    (entry) => String(entry?.id || "") === String(req.params.id || ""),
  );
  if (!job) {
    return res.status(404).json({ error: "not_found" });
  }
  if (job.filePath && fs.existsSync(job.filePath)) {
    try {
      fs.unlinkSync(job.filePath);
    } catch {
      // ignore cleanup failure
    }
  }
  const expired = upsertAdminExportJob({
    ...job,
    status: "expired",
    filePath: null,
    finishedAt: job.finishedAt || new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    error: job.error || null,
  });
  appendAuditLog(req, "admin.exports.expire", "exports", { id: job.id });
  return res.json({ ok: true, job: expired ? toAdminExportJobApiResponse(expired) : null });
});

app.get("/api/analytics/overview", requireAuth, (req, res) => {
  if (!canViewAnalytics(req.session?.user?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const rangeDays = parseAnalyticsRangeDays(req.query.range);
  const type = normalizeAnalyticsTypeFilter(req.query.type);
  const range = buildAnalyticsRange(rangeDays);
  const events = filterAnalyticsEvents(loadAnalyticsEvents(), range.fromTs, range.toTs, type);
  const viewEvents = events.filter((event) => event.eventType === "view");
  const chapterViewEvents = events.filter((event) => event.eventType === "chapter_view");
  const downloadClickEvents = events.filter((event) => event.eventType === "download_click");
  const commentCreatedEvents = events.filter((event) => event.eventType === "comment_created");
  const commentApprovedEvents = events.filter((event) => event.eventType === "comment_approved");
  const uniqueVisitors = new Set(viewEvents.map((event) => event.visitorHash));

  return res.json({
    range: `${rangeDays}d`,
    type,
    from: new Date(range.fromTs).toISOString(),
    to: new Date(range.toTs).toISOString(),
    metrics: {
      views: viewEvents.length,
      uniqueViews: uniqueVisitors.size,
      chapterViews: chapterViewEvents.length,
      downloadClicks: downloadClickEvents.length,
      commentsCreated: commentCreatedEvents.length,
      commentsApproved: commentApprovedEvents.length,
    },
  });
});

app.get("/api/analytics/timeseries", requireAuth, (req, res) => {
  if (!canViewAnalytics(req.session?.user?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const rangeDays = parseAnalyticsRangeDays(req.query.range);
  const type = normalizeAnalyticsTypeFilter(req.query.type);
  const metricRaw = String(req.query.metric || "")
    .trim()
    .toLowerCase();
  const metric = ["views", "unique_views", "comments", "chapter_views", "download_clicks"].includes(
    metricRaw,
  )
    ? metricRaw
    : "views";
  const range = buildAnalyticsRange(rangeDays);
  const events = filterAnalyticsEvents(loadAnalyticsEvents(), range.fromTs, range.toTs, type);
  const perDay = Object.fromEntries(
    range.dayKeys.map((day) => [
      day,
      {
        views: 0,
        chapterViews: 0,
        downloadClicks: 0,
        comments: 0,
        uniqueVisitors: new Set(),
      },
    ]),
  );
  events.forEach((event) => {
    const ts = parseAnalyticsTs(event.ts);
    if (ts === null) {
      return;
    }
    const dayKey = getDayKeyFromTs(ts);
    if (!perDay[dayKey]) {
      return;
    }
    if (event.eventType === "view") {
      perDay[dayKey].views += 1;
      perDay[dayKey].uniqueVisitors.add(event.visitorHash);
      return;
    }
    if (event.eventType === "comment_created") {
      perDay[dayKey].comments += 1;
      return;
    }
    if (event.eventType === "chapter_view") {
      perDay[dayKey].chapterViews += 1;
      return;
    }
    if (event.eventType === "download_click") {
      perDay[dayKey].downloadClicks += 1;
    }
  });

  const pickMetricValue = (day) => {
    if (metric === "views") return perDay[day].views;
    if (metric === "comments") return perDay[day].comments;
    if (metric === "chapter_views") return perDay[day].chapterViews;
    if (metric === "download_clicks") return perDay[day].downloadClicks;
    return perDay[day].uniqueVisitors.size;
  };

  return res.json({
    range: `${rangeDays}d`,
    type,
    metric,
    series: range.dayKeys.map((day) => ({
      date: day,
      value: pickMetricValue(day),
    })),
  });
});

app.get("/api/analytics/top-content", requireAuth, (req, res) => {
  if (!canViewAnalytics(req.session?.user?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const rangeDays = parseAnalyticsRangeDays(req.query.range);
  const type = normalizeAnalyticsTypeFilter(req.query.type);
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 50) : 10;
  const range = buildAnalyticsRange(rangeDays);
  const allEvents = filterAnalyticsEvents(loadAnalyticsEvents(), range.fromTs, range.toTs, type);
  const viewEvents = allEvents.filter((event) => event.eventType === "view");
  const grouped = new Map();
  viewEvents.forEach((event) => {
    const resourceType = event.resourceType === "project" ? "project" : "post";
    const key = `${resourceType}:${event.resourceId}`;
    const previous = grouped.get(key) || {
      resourceType,
      resourceId: event.resourceId,
      views: 0,
      uniqueVisitors: new Set(),
    };
    previous.views += 1;
    previous.uniqueVisitors.add(event.visitorHash);
    grouped.set(key, previous);
  });

  const postsBySlug = new Map(normalizePosts(loadPosts()).map((post) => [post.slug, post]));
  const projectsById = new Map(
    normalizeProjects(loadProjects()).map((project) => [project.id, project]),
  );

  const entries = Array.from(grouped.values())
    .map((item) => {
      const title =
        item.resourceType === "project"
          ? projectsById.get(item.resourceId)?.title || `Projeto ${item.resourceId}`
          : postsBySlug.get(item.resourceId)?.title || `Post ${item.resourceId}`;
      return {
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        title,
        views: item.views,
        uniqueViews: item.uniqueVisitors.size,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);

  return res.json({
    range: `${rangeDays}d`,
    type,
    limit,
    entries,
  });
});

app.get("/api/analytics/acquisition", requireAuth, (req, res) => {
  if (!canViewAnalytics(req.session?.user?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const rangeDays = parseAnalyticsRangeDays(req.query.range);
  const type = normalizeAnalyticsTypeFilter(req.query.type);
  const range = buildAnalyticsRange(rangeDays);
  const events = filterAnalyticsEvents(
    loadAnalyticsEvents(),
    range.fromTs,
    range.toTs,
    type,
  ).filter((event) => event.eventType === "view");

  const counters = {
    referrerHost: {},
    utmSource: {},
    utmMedium: {},
    utmCampaign: {},
  };

  events.forEach((event) => {
    incrementCounter(counters.referrerHost, event.referrerHost || "(direct)");
    if (event.utm?.source) incrementCounter(counters.utmSource, event.utm.source);
    if (event.utm?.medium) incrementCounter(counters.utmMedium, event.utm.medium);
    if (event.utm?.campaign) incrementCounter(counters.utmCampaign, event.utm.campaign);
  });

  const toSortedEntries = (target) =>
    Object.entries(target)
      .map(([key, value]) => ({ key, count: Number(value) || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

  return res.json({
    range: `${rangeDays}d`,
    type,
    referrerHost: toSortedEntries(counters.referrerHost),
    utmSource: toSortedEntries(counters.utmSource),
    utmMedium: toSortedEntries(counters.utmMedium),
    utmCampaign: toSortedEntries(counters.utmCampaign),
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

app.get("/api/admin/operational-alerts", requireAuth, async (req, res) => {
  if (!canManageSettings(req.session?.user?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  res.setHeader("Cache-Control", "no-store");
  const snapshot = await evaluateOperationalMonitoring();
  return res.json(snapshot.alerts);
});

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
      const target = buildCommentTargetInfo(comment, posts, projects);
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

app.get("/api/dashboard/overview", requireAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const userId = String(req.session?.user?.id || "").trim();
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return res.json(buildDashboardOverviewResponsePayload(userId));
});

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

app.get("/api/dashboard/notifications", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const items = [];
  const nowTs = Date.now();
  const limit = parseDashboardNotificationsLimit(req.query.limit);

  if (canManageComments(userId)) {
    const comments = loadComments();
    const pendingCount = comments.filter((comment) => comment.status === "pending").length;
    if (pendingCount > 0) {
      const ts = new Date().toISOString();
      items.push({
        id: toDashboardNotificationId(`comments:pending:${pendingCount}`),
        kind: "pending",
        source: "comments",
        severity: pendingCount > 20 ? "critical" : "warning",
        title: "Comentários pendentes",
        description:
          pendingCount === 1
            ? "Há 1 comentário aguardando moderação."
            : `Há ${pendingCount} comentários aguardando moderação.`,
        href: "/dashboard/comentarios",
        ts,
      });
    }
    const approvedSince = nowTs - 24 * 60 * 60 * 1000;
    const approvedRecent = comments.filter((comment) => {
      if (comment.status !== "approved") {
        return false;
      }
      const createdTs = new Date(comment.createdAt || 0).getTime();
      return Number.isFinite(createdTs) && createdTs >= approvedSince;
    }).length;
    if (approvedRecent > 0) {
      const ts = new Date().toISOString();
      items.push({
        id: toDashboardNotificationId(`comments:approved:${approvedRecent}`),
        kind: "approval",
        source: "comments",
        severity: "info",
        title: "Aprovações recentes",
        description:
          approvedRecent === 1
            ? "1 comentário foi aprovado nas últimas 24h."
            : `${approvedRecent} comentários foram aprovados nas últimas 24h.`,
        href: "/dashboard/comentarios",
        ts,
      });
    }
  }

  if (canManageSettings(userId)) {
    try {
      const snapshot = await evaluateOperationalMonitoring();
      const operationalAlerts = Array.isArray(snapshot?.alerts?.alerts)
        ? snapshot.alerts.alerts
        : [];
      operationalAlerts.forEach((alert) => {
        if (!alert || (alert.severity !== "critical" && alert.severity !== "warning")) {
          return;
        }
        items.push({
          id: toDashboardNotificationId(`ops:${alert.code}:${alert.since || snapshot.ts}`),
          kind: "error",
          source: "operations",
          severity: alert.severity,
          title: alert.title || "Alerta operacional",
          description: alert.description || "Falha operacional detectada.",
          href: "/dashboard",
          ts: alert.since || snapshot.ts || new Date().toISOString(),
        });
      });
    } catch {
      // ignore transient monitoring errors in notifications endpoint
    }
  }

  if (canManageIntegrations(userId)) {
    const webhookFailures = loadAuditLog()
      .filter((entry) =>
        ["editorial_webhook.failed", "ops_alerts.webhook.failed"].includes(entry.action),
      )
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 10);
    webhookFailures.forEach((entry) => {
      items.push({
        id: toDashboardNotificationId(`webhook:${entry.id}:${entry.ts}`),
        kind: "error",
        source: "webhooks",
        severity: "warning",
        title: "Falha em webhook",
        description:
          String(entry?.meta?.code || "").trim() ||
          String(entry?.meta?.error || "").trim() ||
          "Entrega falhou.",
        href: "/dashboard/webhooks",
        ts: entry.ts || new Date().toISOString(),
      });
    });
  }

  const sorted = items
    .slice()
    .sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime())
    .slice(0, limit);
  const summary = sorted.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.kind === "pending") acc.pending += 1;
      if (item.kind === "error") acc.error += 1;
      if (item.kind === "approval") acc.approval += 1;
      return acc;
    },
    { total: 0, pending: 0, error: 0, approval: 0 },
  );

  return res.json({
    generatedAt: new Date().toISOString(),
    items: sorted,
    summary,
  });
});

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

const toUserApiResponse = (user, ownerIdsInput = null) =>
  applyOwnerRole(userWithAccessForResponse(user, ownerIdsInput));

const diffUserFields = (beforeUser, afterUser, fields) => {
  const before = beforeUser || {};
  const after = afterUser || {};
  const keys = Array.isArray(fields) ? fields : [];
  const changes = {};
  keys.forEach((field) => {
    const beforeValue = before[field];
    const afterValue = after[field];
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[field] = {
        from: beforeValue,
        to: afterValue,
      };
    }
  });
  return changes;
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

app.get("/api/users", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (isRbacV2Enabled) {
    const canReadUsers =
      canManageUsersBasic(sessionUser?.id) || canManageUsersAccess(sessionUser?.id);
    if (!canReadUsers) {
      return res.status(403).json({ error: "forbidden" });
    }
  }
  ensureOwnerUser(sessionUser);
  let users = enforceUserAccessInvariants(normalizeUsers(loadUsers()));
  users.sort((a, b) => a.order - b.order);
  writeUsers(users);
  syncAllowedUsers(users);
  const ownerIds = loadOwnerIds().map((id) => String(id));
  const uploads = loadUploads();
  const responseUsers = users.map((user) => {
    const apiUser = applyOwnerRole(userWithAccessForResponse(user, ownerIds));
    return withUserProfileRevision(apiUser, uploads);
  });
  appendAuditLog(req, "users.read", "users", {});
  res.json({
    users: responseUsers,
    ownerIds,
    primaryOwnerId: ownerIds[0] || null,
  });
});

app.get("/api/owners", requirePrimaryOwner, (req, res) => {
  appendAuditLog(req, "owners.read", "owners", {});
  const ownerIds = loadOwnerIds().map((id) => String(id));
  return res.json({ ownerIds, primaryOwnerId: ownerIds[0] || null });
});

app.put("/api/owners", requirePrimaryOwner, (req, res) => {
  const ownerIds = req.body?.ownerIds;
  if (!Array.isArray(ownerIds)) {
    return res.status(400).json({ error: "owner_ids_required" });
  }
  const previousOwnerIds = loadOwnerIds().map((id) => String(id));
  const primaryOwnerId = getPrimaryOwnerId();
  const nextIds = Array.isArray(ownerIds) ? ownerIds.map((id) => String(id)) : [];
  const unique = Array.from(new Set(nextIds.filter(Boolean)));
  if (primaryOwnerId) {
    const normalizedPrimary = String(primaryOwnerId);
    const filtered = unique.filter((id) => id !== normalizedPrimary);
    unique.length = 0;
    unique.push(normalizedPrimary, ...filtered);
  }
  const users = normalizeUsers(loadUsers());
  const activeUserIds = new Set(
    users.filter((user) => user.status === "active").map((user) => user.id),
  );
  const unknownOrInactiveIds = unique.filter((id) => !activeUserIds.has(id));
  if (unknownOrInactiveIds.length > 0) {
    return res
      .status(400)
      .json({ error: "owner_ids_must_be_active_users", ids: unknownOrInactiveIds });
  }
  writeOwnerIds(unique);
  const promotedOwnerIds = unique.filter((id) => !previousOwnerIds.includes(id));
  const usersWithPromotedDefaults = users.map((user) => {
    if (!promotedOwnerIds.includes(user.id)) {
      return user;
    }
    return {
      ...user,
      status: "active",
      accessRole: AccessRole.OWNER_SECONDARY,
      permissions: [...defaultPermissionsForRole(AccessRole.OWNER_SECONDARY)],
    };
  });
  const normalizedUsers = enforceUserAccessInvariants(usersWithPromotedDefaults);
  writeUsers(normalizedUsers);
  syncAllowedUsers(normalizedUsers);
  appendAuditLog(req, "owners.update", "owners", {
    count: unique.length,
    before: previousOwnerIds,
    after: unique,
  });
  return res.json({ ownerIds: loadOwnerIds(), primaryOwnerId: loadOwnerIds()[0] || null });
});

app.post("/api/owners/transfer-primary", requirePrimaryOwner, (req, res) => {
  const targetId = String(req.body?.targetId || "").trim();
  const confirmTargetId = String(req.body?.confirmTargetId || "").trim();
  const confirmTransfer = req.body?.confirmTransfer === true;
  if (!targetId) {
    return res.status(400).json({ error: "target_id_required" });
  }
  if (!confirmTransfer || confirmTargetId !== targetId) {
    return res.status(400).json({ error: "transfer_confirmation_required" });
  }
  const ownerIds = loadOwnerIds().map((id) => String(id));
  const previousPrimaryOwnerId = ownerIds[0] ? String(ownerIds[0]) : null;
  if (!ownerIds.includes(targetId)) {
    return res.status(404).json({ error: "target_owner_not_found" });
  }
  const users = normalizeUsers(loadUsers());
  const targetUser = users.find((user) => user.id === targetId);
  if (!targetUser || targetUser.status !== "active") {
    return res.status(400).json({ error: "target_owner_must_be_active" });
  }
  if (previousPrimaryOwnerId && targetId === previousPrimaryOwnerId) {
    return res.json({
      ok: true,
      ownerIds,
      primaryOwnerId: previousPrimaryOwnerId,
    });
  }
  const nextOwnerIds = [targetId, ...ownerIds.filter((id) => id !== targetId)];
  writeOwnerIds(nextOwnerIds);
  const normalizedUsers = enforceUserAccessInvariants(users);
  writeUsers(normalizedUsers);
  syncAllowedUsers(normalizedUsers);
  appendAuditLog(req, "owners.transfer_primary", "owners", {
    targetId,
    fromPrimaryId: previousPrimaryOwnerId,
    toPrimaryId: targetId,
    before: ownerIds,
    after: nextOwnerIds,
    changes: {
      primaryOwnerId: {
        from: previousPrimaryOwnerId,
        to: targetId,
      },
    },
  });
  emitSecurityEvent({
    req,
    type: "owner_transfer_critical",
    severity: SecurityEventSeverity.CRITICAL,
    riskScore: 95,
    actorUserId: req.session?.user?.id || null,
    targetUserId: targetId,
    data: {
      fromPrimaryId: previousPrimaryOwnerId,
      toPrimaryId: targetId,
    },
  });
  return res.json({
    ok: true,
    ownerIds: nextOwnerIds,
    primaryOwnerId: targetId,
  });
});

app.post("/api/bootstrap-owner", requireAuth, async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!(await canBootstrap(ip))) {
    appendAuditLog(req, "auth.bootstrap.rate_limited", "owners", {});
    return res.status(429).json({ error: "rate_limited" });
  }
  if (!BOOTSTRAP_TOKEN) {
    appendAuditLog(req, "auth.bootstrap.disabled", "owners", {});
    return res.status(403).json({ error: "bootstrap_disabled" });
  }
  const currentOwners = loadOwnerIds();
  if (currentOwners.length) {
    appendAuditLog(req, "auth.bootstrap.denied", "owners", { error: "owner_exists" });
    return res.status(409).json({ error: "owner_exists" });
  }
  const token = String(req.body?.token || req.headers["x-bootstrap-token"] || "");
  if (!token || token !== BOOTSTRAP_TOKEN) {
    appendAuditLog(req, "auth.bootstrap.denied", "owners", { error: "invalid_token" });
    return res.status(403).json({ error: "invalid_token" });
  }
  const sessionUser = req.session?.user;
  if (!sessionUser?.id) {
    appendAuditLog(req, "auth.bootstrap.denied", "owners", { error: "unauthorized" });
    return res.status(401).json({ error: "unauthorized" });
  }
  writeOwnerIds([sessionUser.id]);
  ensureOwnerUser(sessionUser);
  const users = enforceUserAccessInvariants(normalizeUsers(loadUsers()));
  writeUsers(users);
  syncAllowedUsers(users);
  appendAuditLog(req, "auth.bootstrap.success", "owners", { ownerId: sessionUser.id });
  const ownerIds = loadOwnerIds().map((id) => String(id));
  return res.json({ ok: true, ownerIds, primaryOwnerId: ownerIds[0] || null });
});

app.get("/api/public/users", (req, res) => {
  const users = buildPublicTeamMembers();
  const teamAvatarUrls = users.map((user) => user?.avatarUrl).filter(Boolean);

  res.json({
    users,
    mediaVariants: buildPublicMediaVariants([users], {
      allowPrivateUrls: teamAvatarUrls,
    }),
  });
});

app.get("/api/link-types", (req, res) => {
  const items = loadLinkTypes();
  const revision = createRevisionToken(items);
  res.json({ items, revision });
});

app.put("/api/link-types", requireAuth, (req, res) => {
  if (!canManageSettings(req.session?.user?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const options = parseEditRevisionOptions(req.body);
  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items_required" });
  }
  const previousLinkTypes = loadLinkTypes();
  const currentRevision = createRevisionToken(previousLinkTypes);
  const noConflict = ensureNoEditConflict({
    req,
    res,
    resourceType: "link_types",
    resourceId: "global",
    current: previousLinkTypes,
    currentRevision,
    options,
  });
  if (!noConflict) {
    return noConflict;
  }
  const previousIcons = collectLinkTypeIconUploads(previousLinkTypes);
  const normalized = normalizeLinkTypes(items);
  writeLinkTypes(normalized);
  const nextIcons = collectLinkTypeIconUploads(normalized);
  const removedIcons = Array.from(previousIcons).filter((url) => !nextIcons.has(url));
  removedIcons.forEach((url) => deletePrivateUploadByUrl(url));
  return res.json({ items: normalized, revision: createRevisionToken(normalized) });
});

app.get("/api/posts", requireAuth, (req, res) => {
  const posts = normalizePosts(loadPosts())
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .map((post) => ({
      ...post,
      revision: createRevisionToken(post),
    }));
  const resolvedCoverSources = posts.map((post) => {
    const resolvedCover = resolvePostCover(post);
    return { coverImageUrl: resolvedCover.coverImageUrl };
  });
  res.json({
    posts,
    mediaVariants: buildPublicMediaVariants(resolvedCoverSources),
  });
});

app.get("/api/public/posts", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const cached = readPublicCachedJson(req);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    return res.status(cached.statusCode).json(cached.payload);
  }
  const limitRaw = Number(req.query.limit);
  const pageRaw = Number(req.query.page);
  const usePagination = Number.isFinite(limitRaw) || Number.isFinite(pageRaw);
  const limit = usePagination ? Math.min(Math.max(limitRaw || 10, 1), 100) : null;
  const page = usePagination ? Math.max(pageRaw || 1, 1) : null;
  const now = Date.now();
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
        views: post.views,
        commentsCount: post.commentsCount,
        projectId: post.projectId || "",
        tags: Array.isArray(post.tags) ? post.tags : [],
      };
    });
  let payload = null;
  if (!usePagination) {
    payload = { posts };
  } else {
    const start = (page - 1) * limit;
    const paged = posts.slice(start, start + limit);
    payload = { posts: paged, page, limit, total: posts.length };
  }
  payload = {
    ...payload,
    mediaVariants: buildPublicMediaVariants(payload.posts),
  };
  writePublicCachedJson(req, payload, {
    ttlMs: PUBLIC_READ_CACHE_TTL_MS,
    tags: [PUBLIC_READ_CACHE_TAGS.POSTS],
  });
  res.setHeader("X-Cache", "MISS");
  return res.json(payload);
});

app.get("/api/public/posts/:slug", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const now = Date.now();
  const slug = String(req.params.slug || "");
  const posts = normalizePosts(loadPosts());
  const post = posts.find((item) => item.slug === slug);
  if (!post) {
    return res.status(404).json({ error: "not_found" });
  }
  if (post.deletedAt) {
    return res.status(404).json({ error: "not_found" });
  }
  const publishTime = new Date(post.publishedAt).getTime();
  if (publishTime > now || (post.status !== "published" && post.status !== "scheduled")) {
    return res.status(404).json({ error: "not_found" });
  }
  const resolvedCover = resolvePostCover(post);
  const publicPost = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    coverImageUrl: resolvedCover.coverImageUrl,
    coverAlt: resolvedCover.coverAlt,
    excerpt: post.excerpt,
    content: post.content,
    contentFormat: post.contentFormat,
    author: post.author,
    publishedAt: post.publishedAt,
    views: post.views,
    commentsCount: post.commentsCount,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    projectId: post.projectId || "",
    tags: Array.isArray(post.tags) ? post.tags : [],
  };
  return res.json({
    post: publicPost,
    mediaVariants: buildPublicMediaVariants({ coverImageUrl: publicPost.coverImageUrl }),
  });
});

app.post("/api/public/posts/:slug/view", async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!(await canRegisterView(ip))) {
    return res.status(429).json({ error: "rate_limited" });
  }
  const now = Date.now();
  const slug = String(req.params.slug || "");
  const posts = normalizePosts(loadPosts());
  const post = posts.find((item) => item.slug === slug);
  if (!post) {
    return res.status(404).json({ error: "not_found" });
  }
  if (post.deletedAt) {
    return res.status(404).json({ error: "not_found" });
  }
  const publishTime = new Date(post.publishedAt).getTime();
  if (publishTime > now || (post.status !== "published" && post.status !== "scheduled")) {
    return res.status(404).json({ error: "not_found" });
  }
  const updated = incrementPostViews(slug);
  appendAnalyticsEvent(req, {
    eventType: "view",
    resourceType: "post",
    resourceId: post.slug,
    meta: {
      action: "view",
      resourceType: "post",
      resourceId: post.slug,
    },
  });
  return res.json({ views: updated?.views ?? post.views ?? 0 });
});

app.post("/api/public/posts/:slug/polls/vote", async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!(await canRegisterPollVote(ip))) {
    return res.status(429).json({ error: "rate_limited" });
  }
  const slug = String(req.params.slug || "");
  const { optionUid, voterId, checked, question } = req.body || {};
  if (!optionUid || !voterId) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  const posts = normalizePosts(loadPosts());
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const post = posts[index];
  const result = updateLexicalPollVotes(post.content, {
    question,
    optionUid,
    voterId,
    checked,
  });
  if (!result.updated || !result.content) {
    return res.status(404).json({ error: "poll_not_found" });
  }
  posts[index] = {
    ...post,
    content: result.content,
  };
  writePosts(posts);
  return res.json({ ok: true });
});

app.get("/api/public/comments", (req, res) => {
  const type = String(req.query.type || "").toLowerCase();
  const id = String(req.query.id || "").trim();
  if (!type || !id) {
    return res.status(400).json({ error: "target_required" });
  }
  const chapterNumber = Number(req.query.chapter);
  const volume = Number(req.query.volume);
  const comments = loadComments()
    .filter((comment) => comment.status === "approved")
    .filter((comment) => comment.targetType === type && comment.targetId === id)
    .filter((comment) => {
      if (type !== "chapter") {
        return true;
      }
      if (!Number.isFinite(chapterNumber)) {
        return false;
      }
      const targetChapter = Number(comment.targetMeta?.chapterNumber);
      if (targetChapter !== chapterNumber) {
        return false;
      }
      if (Number.isFinite(volume)) {
        return Number(comment.targetMeta?.volume || 0) === volume;
      }
      return true;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((comment) => ({
      id: comment.id,
      parentId: comment.parentId || null,
      name: comment.name,
      content: comment.content,
      createdAt: comment.createdAt,
      avatarUrl:
        comment.avatarUrl || (comment.emailHash ? buildGravatarUrl(comment.emailHash) : ""),
    }));

  return res.json({ comments });
});

app.post("/api/public/comments", async (req, res) => {
  const sessionUser = req.session?.user || null;
  const isStaff = sessionUser?.id ? canManageComments(sessionUser.id) : false;
  const { targetType, targetId, parentId, name, email, content, chapterNumber, volume, website } =
    req.body || {};
  if (website) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!(await canSubmitComment(ip))) {
    return res.status(429).json({ error: "rate_limited" });
  }
  const normalizedTargetType = String(targetType || "").toLowerCase();
  const normalizedTargetId = String(targetId || "").trim();
  const normalizedName = isStaff
    ? String(sessionUser?.name || "Equipe").trim()
    : String(name || "").trim();
  const normalizedEmail = isStaff ? normalizeEmail(sessionUser?.email) : normalizeEmail(email);
  const normalizedContent = String(content || "")
    .trim()
    .slice(0, 2000);

  if (!normalizedTargetType || !normalizedTargetId) {
    return res.status(400).json({ error: "target_required" });
  }
  if (!["post", "project", "chapter"].includes(normalizedTargetType)) {
    return res.status(400).json({ error: "invalid_target" });
  }
  if (!normalizedName || !normalizedContent) {
    return res.status(400).json({ error: "fields_required" });
  }
  if (!isStaff && normalizedEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: "invalid_email" });
  }
  if (normalizedContent.length > 2000) {
    return res.status(400).json({ error: "content_too_long" });
  }

  const posts = normalizePosts(loadPosts());
  const projects = normalizeProjects(loadProjects());
  const nowEpoch = Date.now();
  if (normalizedTargetType === "post") {
    const post = posts.find((item) => item.slug === normalizedTargetId);
    if (!post || post.deletedAt) {
      return res.status(404).json({ error: "target_not_found" });
    }
    const publishTime = new Date(post.publishedAt).getTime();
    if (publishTime > nowEpoch || (post.status !== "published" && post.status !== "scheduled")) {
      return res.status(404).json({ error: "target_not_found" });
    }
  } else if (normalizedTargetType === "project") {
    const project = projects.find((item) => item.id === normalizedTargetId);
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: "target_not_found" });
    }
  } else if (normalizedTargetType === "chapter") {
    const chapter = Number(chapterNumber);
    if (!Number.isFinite(chapter)) {
      return res.status(400).json({ error: "chapter_required" });
    }
    const project = projects.find((item) => item.id === normalizedTargetId);
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: "target_not_found" });
    }
    const volumeNumber = Number.isFinite(volume) ? Number(volume) : null;
    const lookup = resolveEpisodeLookup(project, chapter, volumeNumber, {
      requirePublished: true,
    });
    if (!lookup.ok) {
      return res.status(lookup.code === "volume_required" ? 400 : 404).json({
        error: lookup.code === "volume_required" ? "volume_required" : "target_not_found",
      });
    }
  }

  const comments = loadComments();
  if (parentId) {
    const parent = comments.find((comment) => comment.id === String(parentId));
    if (
      !parent ||
      parent.targetType !== normalizedTargetType ||
      parent.targetId !== normalizedTargetId
    ) {
      return res.status(400).json({ error: "invalid_parent" });
    }
  }

  const emailHash = normalizedEmail ? createGravatarHash(normalizedEmail) : "";
  const avatarUrl = isStaff
    ? String(sessionUser?.avatarUrl || "")
    : emailHash
      ? await resolveGravatarAvatarUrl(emailHash)
      : "";
  const now = new Date().toISOString();
  const newComment = {
    id: crypto.randomUUID(),
    targetType: normalizedTargetType,
    targetId: normalizedTargetId,
    targetMeta:
      normalizedTargetType === "chapter"
        ? {
            chapterNumber: Number(chapterNumber),
            volume: Number.isFinite(Number(volume)) ? Number(volume) : undefined,
          }
        : {},
    parentId: parentId ? String(parentId) : null,
    name: normalizedName,
    emailHash,
    content: normalizedContent,
    status: isStaff ? "approved" : "pending",
    createdAt: now,
    approvedAt: isStaff ? now : null,
    avatarUrl,
  };

  comments.push(newComment);
  writeComments(comments);
  appendAnalyticsEvent(req, {
    eventType: "comment_created",
    resourceType: "comment",
    resourceId: newComment.id,
    meta: {
      targetType: normalizedTargetType,
      targetId: normalizedTargetId,
      status: newComment.status,
    },
  });
  if (newComment.status === "approved") {
    appendAnalyticsEvent(req, {
      eventType: "comment_approved",
      resourceType: "comment",
      resourceId: newComment.id,
      meta: {
        targetType: normalizedTargetType,
        targetId: normalizedTargetId,
        status: newComment.status,
      },
    });
  }
  return res.json({ comment: { id: newComment.id, status: newComment.status } });
});

const buildCommentTargetInfo = (comment, posts, projects) => {
  if (comment.targetType === "post") {
    const post = posts.find((item) => item.slug === comment.targetId);
    if (!post) {
      return { label: "Postagem", url: PRIMARY_APP_ORIGIN };
    }
    return {
      label: post.title,
      url: `${PRIMARY_APP_ORIGIN}/postagem/${post.slug}#comment-${comment.id}`,
    };
  }
  if (comment.targetType === "project") {
    const project = projects.find((item) => item.id === comment.targetId);
    if (!project) {
      return { label: "Projeto", url: PRIMARY_APP_ORIGIN };
    }
    return {
      label: project.title,
      url: `${PRIMARY_APP_ORIGIN}/projeto/${project.id}#comment-${comment.id}`,
    };
  }
  if (comment.targetType === "chapter") {
    const project = projects.find((item) => item.id === comment.targetId);
    const chapterNumber = comment.targetMeta?.chapterNumber;
    const volume = comment.targetMeta?.volume;
    const chapterLabel = chapterNumber ? `Capítulo ${chapterNumber}` : "Capítulo";
    const projectLabel = project?.title ? `${project.title} • ${chapterLabel}` : chapterLabel;
    const volumeQuery = Number.isFinite(volume) ? `?volume=${volume}` : "";
    const url = project
      ? `${PRIMARY_APP_ORIGIN}/projeto/${project.id}/leitura/${chapterNumber}${volumeQuery}#comment-${comment.id}`
      : PRIMARY_APP_ORIGIN;
    return { label: projectLabel, url };
  }
  return { label: "Comentário", url: PRIMARY_APP_ORIGIN };
};

app.get("/api/comments/pending", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageComments(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const posts = normalizePosts(loadPosts());
  const projects = normalizeProjects(loadProjects());
  const comments = loadComments()
    .filter((comment) => comment.status === "pending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((comment) => {
      const target = buildCommentTargetInfo(comment, posts, projects);
      return {
        id: comment.id,
        targetType: comment.targetType,
        targetId: comment.targetId,
        parentId: comment.parentId || null,
        name: comment.name,
        content: comment.content,
        createdAt: comment.createdAt,
        avatarUrl:
          comment.avatarUrl || (comment.emailHash ? buildGravatarUrl(comment.emailHash) : ""),
        targetLabel: target.label,
        targetUrl: target.url,
      };
    });
  return res.json({ comments });
});

app.get("/api/comments/recent", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageComments(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 10) : 4;
  const posts = normalizePosts(loadPosts());
  const projects = normalizeProjects(loadProjects());
  const comments = loadComments();
  const pendingCount = comments.filter((comment) => comment.status === "pending").length;
  const recent = comments
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .map((comment) => {
      const target = buildCommentTargetInfo(comment, posts, projects);
      return {
        id: comment.id,
        status: comment.status,
        targetType: comment.targetType,
        targetId: comment.targetId,
        name: comment.name,
        content: comment.content,
        createdAt: comment.createdAt,
        avatarUrl:
          comment.avatarUrl || (comment.emailHash ? buildGravatarUrl(comment.emailHash) : ""),
        targetLabel: target.label,
        targetUrl: target.url,
      };
    });
  return res.json({ comments: recent, pendingCount, totalCount: comments.length });
});

app.post("/api/comments/pending/bulk", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageComments(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const comments = loadComments();
  const result = bulkModeratePendingComments(comments, {
    action: req.body?.action,
    confirmText: req.body?.confirmText,
  });

  if (!result.ok) {
    if (result.error === "invalid_action") {
      return res.status(400).json({ error: "invalid_action" });
    }
    if (result.error === "confirmation_required") {
      return res.status(400).json({ error: "confirmation_required" });
    }
    return res.status(500).json({ error: "bulk_moderation_failed" });
  }

  writeComments(result.comments);

  if (
    result.action === "approve_all" &&
    Array.isArray(result.processedComments) &&
    result.processedComments.length > 0
  ) {
    const affectedPostIds = new Set();
    const affectedProjectIds = new Set();

    result.processedComments.forEach((comment) => {
      if (comment?.targetType === "post" && comment.targetId) {
        affectedPostIds.add(String(comment.targetId));
      }
      if (comment?.targetType === "project" && comment.targetId) {
        affectedProjectIds.add(String(comment.targetId));
      }
      appendAnalyticsEvent(req, {
        eventType: "comment_approved",
        resourceType: "comment",
        resourceId: String(comment.id || ""),
        meta: {
          targetType: comment.targetType,
          targetId: comment.targetId,
          status: "approved",
        },
      });
    });

    if (affectedPostIds.size > 0) {
      let updatedPosts = normalizePosts(loadPosts());
      affectedPostIds.forEach((targetId) => {
        updatedPosts = applyCommentCountToPosts(updatedPosts, result.comments, targetId);
      });
      writePosts(updatedPosts);
    }

    if (affectedProjectIds.size > 0) {
      let updatedProjects = normalizeProjects(loadProjects());
      affectedProjectIds.forEach((targetId) => {
        updatedProjects = applyCommentCountToProjects(updatedProjects, result.comments, targetId);
      });
      writeProjects(updatedProjects);
    }

    appendAuditLog(req, "comments.bulk.approve", "comments", {
      processedCount: result.processedCount,
      totalPendingBefore: result.totalPendingBefore,
    });
  }

  if (result.action === "delete_all") {
    appendAuditLog(req, "comments.bulk.delete", "comments", {
      processedCount: result.processedCount,
      totalPendingBefore: result.totalPendingBefore,
    });
  }

  return res.json({
    ok: true,
    action: result.action,
    totalPendingBefore: result.totalPendingBefore,
    processedCount: result.processedCount,
    remainingPending: result.remainingPending,
  });
});

app.post("/api/comments/:id/approve", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageComments(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  const comments = loadComments();
  const index = comments.findIndex((comment) => comment.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const existing = comments[index];
  if (existing.status === "approved") {
    return res.json({ ok: true });
  }
  comments[index] = {
    ...existing,
    status: "approved",
    approvedAt: new Date().toISOString(),
  };
  writeComments(comments);

  if (existing.targetType === "post") {
    const updatedPosts = applyCommentCountToPosts(
      normalizePosts(loadPosts()),
      comments,
      existing.targetId,
    );
    writePosts(updatedPosts);
  }
  if (existing.targetType === "project") {
    const updatedProjects = applyCommentCountToProjects(
      normalizeProjects(loadProjects()),
      comments,
      existing.targetId,
    );
    writeProjects(updatedProjects);
  }
  appendAnalyticsEvent(req, {
    eventType: "comment_approved",
    resourceType: "comment",
    resourceId: existing.id,
    meta: {
      targetType: existing.targetType,
      targetId: existing.targetId,
      status: "approved",
    },
  });

  return res.json({ ok: true });
});

app.delete("/api/comments/:id", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageComments(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  const comments = loadComments();
  const index = comments.findIndex((comment) => comment.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const [removed] = comments.splice(index, 1);
  writeComments(comments);

  if (removed.status === "approved") {
    if (removed.targetType === "post") {
      const updatedPosts = applyCommentCountToPosts(
        normalizePosts(loadPosts()),
        comments,
        removed.targetId,
      );
      writePosts(updatedPosts);
    }
    if (removed.targetType === "project") {
      const updatedProjects = applyCommentCountToProjects(
        normalizeProjects(loadProjects()),
        comments,
        removed.targetId,
      );
      writeProjects(updatedProjects);
    }
  }

  return res.json({ ok: true });
});

app.post("/api/posts", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const {
    title,
    slug,
    coverImageUrl,
    coverAlt,
    excerpt,
    content,
    contentFormat,
    author,
    publishedAt,
    scheduledAt,
    status,
    seoTitle,
    seoDescription,
    projectId,
    tags,
  } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: "title_required" });
  }

  let posts = normalizePosts(loadPosts());
  const baseSlug = createSlug(slug || title);
  if (!baseSlug) {
    return res.status(400).json({ error: "slug_required" });
  }
  const normalizedSlug = createUniqueSlug(
    baseSlug,
    posts.map((post) => post.slug),
  );

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const requestedStatus =
    status === "draft" || status === "scheduled" || status === "published" ? status : "draft";
  const normalizedPublishedAt =
    requestedStatus === "published"
      ? publishedAt || now
      : requestedStatus === "scheduled"
        ? publishedAt || scheduledAt || now
        : publishedAt || now;
  const normalizedStatus = resolvePostStatus(requestedStatus, normalizedPublishedAt, nowMs);
  const newPost = {
    id: crypto.randomUUID(),
    title: String(title),
    slug: normalizedSlug,
    coverImageUrl: coverImageUrl || null,
    coverAlt: coverAlt || "",
    excerpt: excerpt || "",
    content: content || "",
    contentFormat:
      contentFormat === "html" || contentFormat === "lexical" ? contentFormat : "markdown",
    author: author || sessionUser?.name || "Autor",
    publishedAt: normalizedPublishedAt,
    scheduledAt: scheduledAt || null,
    status: normalizedStatus,
    seoTitle: seoTitle || "",
    seoDescription: seoDescription || "",
    projectId: projectId || "",
    tags: normalizeTags(tags),
    views: 0,
    commentsCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  posts.push(newPost);
  writePosts(posts);
  await runAutoUploadReorganization({ trigger: "post-save", req });
  const persistedPost =
    normalizePosts(loadPosts()).find((post) => post.id === newPost.id) || newPost;
  appendPostVersion({
    post: persistedPost,
    reason: "create",
    actor: req.session?.user || null,
  });
  appendAuditLog(req, "posts.create", "posts", { id: newPost.id, slug: newPost.slug });
  if (persistedPost.status === "published" || persistedPost.status === "scheduled") {
    await dispatchEditorialWebhookEvent({
      eventKey: "post_create",
      post: persistedPost,
      req,
    });
  }
  return res.json({ post: persistedPost });
});

app.put("/api/posts/:id", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const options = parseEditRevisionOptions(req.body);

  const { id } = req.params;
  const {
    title,
    slug,
    coverImageUrl,
    coverAlt,
    excerpt,
    content,
    contentFormat,
    author,
    publishedAt,
    scheduledAt,
    status,
    seoTitle,
    seoDescription,
    projectId,
    tags,
  } = req.body || {};
  let posts = normalizePosts(loadPosts());
  const index = posts.findIndex((post) => post.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const existing = posts[index];
  const currentRevision = createRevisionToken(existing);
  const noConflict = ensureNoEditConflict({
    req,
    res,
    resourceType: "post",
    resourceId: existing.id,
    current: existing,
    currentRevision,
    options,
  });
  if (!noConflict) {
    return noConflict;
  }

  const normalizedSlug = slug ? createSlug(slug) : "";
  if (
    normalizedSlug &&
    posts.some((post) => post.slug === normalizedSlug && post.id !== String(id))
  ) {
    return res.status(409).json({ error: "slug_exists" });
  }

  const statusCandidate =
    status === "draft" || status === "scheduled" || status === "published"
      ? status
      : existing.status;
  const nextPublishedAt = publishedAt || existing.publishedAt;
  const normalizedStatus = resolvePostStatus(statusCandidate, nextPublishedAt, Date.now());
  const updated = {
    ...existing,
    title: title ? String(title) : existing.title,
    slug: normalizedSlug || existing.slug,
    coverImageUrl: coverImageUrl === "" ? null : (coverImageUrl ?? existing.coverImageUrl),
    coverAlt: typeof coverAlt === "string" ? coverAlt : existing.coverAlt,
    excerpt: typeof excerpt === "string" ? excerpt : existing.excerpt,
    content: typeof content === "string" ? content : existing.content,
    contentFormat:
      contentFormat === "html"
        ? "html"
        : contentFormat === "markdown"
          ? "markdown"
          : contentFormat === "lexical"
            ? "lexical"
            : existing.contentFormat,
    author: typeof author === "string" ? author : existing.author,
    publishedAt: nextPublishedAt,
    scheduledAt: scheduledAt || existing.scheduledAt,
    status: normalizedStatus,
    seoTitle: typeof seoTitle === "string" ? seoTitle : existing.seoTitle,
    seoDescription: typeof seoDescription === "string" ? seoDescription : existing.seoDescription,
    projectId: typeof projectId === "string" ? projectId : existing.projectId,
    tags: normalizeTags(tags).length ? normalizeTags(tags) : existing.tags,
    updatedAt: new Date().toISOString(),
  };

  posts[index] = updated;
  writePosts(posts);
  await runAutoUploadReorganization({ trigger: "post-save", req });
  const persistedPost =
    normalizePosts(loadPosts()).find((post) => post.id === updated.id) || updated;
  appendPostVersion({
    post: persistedPost,
    reason: "update",
    actor: req.session?.user || null,
  });
  appendAuditLog(req, "posts.update", "posts", { id: updated.id, slug: updated.slug });
  if (persistedPost.status === "published" || persistedPost.status === "scheduled") {
    await dispatchEditorialWebhookEvent({
      eventKey: "post_update",
      post: persistedPost,
      req,
    });
  }
  return res.json({
    post: {
      ...persistedPost,
      revision: createRevisionToken(persistedPost),
    },
  });
});

app.delete("/api/posts/:id", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const { id } = req.params;
  let posts = normalizePosts(loadPosts());
  const index = posts.findIndex((post) => post.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const existing = posts[index];
  if (existing.deletedAt && !isWithinRestoreWindow(existing.deletedAt)) {
    const next = posts.filter((post) => post.id !== String(id));
    writePosts(next);
    appendAuditLog(req, "posts.delete.final", "posts", { id });
    return res.json({ ok: true });
  }
  if (!existing.deletedAt) {
    posts[index] = {
      ...existing,
      deletedAt: new Date().toISOString(),
      deletedBy: sessionUser?.id || null,
      updatedAt: new Date().toISOString(),
    };
    writePosts(posts);
    appendAuditLog(req, "posts.delete", "posts", { id });
  }
  return res.json({ ok: true });
});

app.post("/api/posts/:id/restore", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  let posts = normalizePosts(loadPosts());
  const index = posts.findIndex((post) => post.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const existing = posts[index];
  if (!existing.deletedAt) {
    return res.json({ post: existing });
  }
  if (!isWithinRestoreWindow(existing.deletedAt)) {
    return res.status(410).json({ error: "restore_window_expired" });
  }
  const restored = {
    ...existing,
    deletedAt: null,
    deletedBy: null,
    updatedAt: new Date().toISOString(),
  };
  posts[index] = restored;
  writePosts(posts);
  appendAuditLog(req, "posts.restore", "posts", { id });
  return res.json({ post: restored });
});

app.get("/api/admin/content/post/:id/versions", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const postId = String(req.params.id || "").trim();
  if (!postId) {
    return res.status(400).json({ error: "post_id_required" });
  }
  const posts = normalizePosts(loadPosts());
  const post = posts.find((item) => item.id === postId);
  if (!post) {
    return res.status(404).json({ error: "not_found" });
  }
  const limit = Number(req.query.limit);
  const cursor = req.query.cursor ? String(req.query.cursor) : "";
  const result = listPostVersions(postId, { limit, cursor });
  return res.json({
    postId,
    versions: result.versions.map((version) => ({
      ...version,
      reasonLabel: postVersionReasonLabel(version.reason),
    })),
    nextCursor: result.nextCursor || null,
  });
});

app.post("/api/admin/content/post/:id/version", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const postId = String(req.params.id || "").trim();
  if (!postId) {
    return res.status(400).json({ error: "post_id_required" });
  }
  const posts = normalizePosts(loadPosts());
  const post = posts.find((item) => item.id === postId);
  if (!post) {
    return res.status(404).json({ error: "not_found" });
  }
  const label =
    typeof req.body?.label === "string" && req.body.label.trim()
      ? String(req.body.label).trim()
      : null;
  const version = appendPostVersion({
    post,
    reason: "manual",
    label,
    actor: req.session?.user || null,
  });
  appendAuditLog(req, "posts.version.create", "posts", {
    id: post.id,
    slug: post.slug,
    versionId: version?.id || null,
    reason: "manual",
    label,
  });
  return res.json({
    ok: true,
    version: version
      ? {
          ...version,
          reasonLabel: postVersionReasonLabel(version.reason),
        }
      : null,
  });
});

app.post("/api/admin/content/post/:id/rollback", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const postId = String(req.params.id || "").trim();
  const versionId = String(req.body?.versionId || "").trim();
  if (!postId || !versionId) {
    return res.status(400).json({ error: "version_id_required" });
  }
  const posts = normalizePosts(loadPosts());
  const index = posts.findIndex((item) => item.id === postId);
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const targetVersion = loadPostVersions().find(
    (item) => item.postId === postId && item.id === versionId,
  );
  if (!targetVersion) {
    return res.status(404).json({ error: "version_not_found" });
  }

  const existing = posts[index];
  const backupVersion = appendPostVersion({
    post: existing,
    reason: "manual",
    label: "backup pré-rollback",
    actor: req.session?.user || null,
  });

  const rolledBack = applyPostSnapshotForRollback({
    existingPost: existing,
    snapshot: targetVersion.snapshot,
    allPosts: posts,
  });
  if (!rolledBack) {
    return res.status(400).json({ error: "rollback_failed" });
  }
  posts[index] = rolledBack;
  writePosts(posts);
  await runAutoUploadReorganization({ trigger: "post-save", req });
  const persistedPost =
    normalizePosts(loadPosts()).find((item) => item.id === postId) || rolledBack;
  const rollbackVersion = appendPostVersion({
    post: persistedPost,
    reason: "rollback",
    label: `rollback de ${targetVersion.versionNumber}`,
    actor: req.session?.user || null,
  });

  appendAuditLog(req, "posts.rollback", "posts", {
    id: persistedPost.id,
    slug: persistedPost.slug,
    versionId,
    targetVersionId: targetVersion.id,
    backupVersionId: backupVersion?.id || null,
    rollbackVersionId: rollbackVersion?.id || null,
    slugAdjusted: targetVersion.slug !== persistedPost.slug,
  });

  return res.json({
    ok: true,
    post: persistedPost,
    rollback: {
      targetVersionId: targetVersion.id,
      backupVersionId: backupVersion?.id || null,
      rollbackVersionId: rollbackVersion?.id || null,
      slugAdjusted: targetVersion.slug !== persistedPost.slug,
      targetSlug: targetVersion.slug,
      resultingSlug: persistedPost.slug,
    },
  });
});

app.get("/api/admin/editorial/calendar", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const fromRaw = String(req.query.from || "").trim();
  const toRaw = String(req.query.to || "").trim();
  if (!fromRaw || !toRaw) {
    return res.status(400).json({ error: "from_to_required" });
  }
  const fromDate = new Date(`${fromRaw}T00:00:00.000Z`);
  const toDate = new Date(`${toRaw}T23:59:59.999Z`);
  if (
    !Number.isFinite(fromDate.getTime()) ||
    !Number.isFinite(toDate.getTime()) ||
    fromDate > toDate
  ) {
    return res.status(400).json({ error: "invalid_range" });
  }
  const tz = String(
    req.query.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
  );
  const items = buildEditorialCalendarItems(normalizePosts(loadPosts()), {
    fromMs: fromDate.getTime(),
    toMs: toDate.getTime(),
  });
  return res.json({ from: fromRaw, to: toRaw, tz, items });
});

app.get("/api/projects", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const projects = normalizeProjects(loadProjects())
    .sort((a, b) => a.order - b.order)
    .map((project) => ({
      ...project,
      revision: createRevisionToken(project),
    }));
  res.json({ projects });
});

app.get("/api/projects/:id", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const projectId = String(req.params.id || "").trim();
  const project = normalizeProjects(loadProjects()).find((item) => item.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "not_found" });
  }
  return res.json({
    project: {
      ...project,
      revision: createRevisionToken(project),
    },
  });
});

app.get("/api/project-types", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const types = getActiveProjectTypes({ includeDefaults: true });
  return res.json({ types });
});

app.post(
  "/api/projects/epub/import/jobs",
  requireAuth,
  parseEpubImportRequestBody,
  async (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageProjects(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    if (!isEpubImportJobStorageAvailable()) {
      return res.status(404).json({ error: "not_found" });
    }

    let requestInput;
    try {
      requestInput = resolveEpubImportRequestInput(req);
    } catch (error) {
      if (error?.code === "duplicate_episode_key") {
        return res.status(400).json({ error: "duplicate_episode_key", key: error.key });
      }
      if (error?.code === "duplicate_volume_cover_key") {
        return res.status(400).json({ error: "duplicate_volume_cover_key", key: error.key });
      }
      return res.status(400).json({ error: "invalid_project_snapshot" });
    }

    if (requestInput.isMultipartRequest && !req.file) {
      return res.status(400).json({ error: "file_required" });
    }

    if (!requestInput.buffer.length) {
      return res.status(400).json({ error: "empty_epub_upload" });
    }

    let project = requestInput.project;
    const rawProjectId = requestInput.rawProjectId;
    if (!project && rawProjectId) {
      project =
        normalizeProjects(loadProjects()).find(
          (item) => item.id === rawProjectId && !item.deletedAt,
        ) || null;
      if (!project) {
        return res.status(404).json({ error: "project_not_found" });
      }
    }

    const job = upsertEpubImportJob({
      id: crypto.randomUUID(),
      projectId: String(project?.id || rawProjectId || "").trim(),
      requestedBy: String(sessionUser?.id || ""),
      status: "queued",
      summary: {},
      resultPath: null,
      error: null,
      createdAt: new Date().toISOString(),
    });
    if (!job) {
      return res.status(500).json({ error: "job_create_failed" });
    }
    void enqueueEpubImportJob(job.id, {
      buffer: requestInput.buffer,
      project,
      rawProjectId,
      targetVolume: requestInput.targetVolume,
      defaultStatus: requestInput.defaultStatus,
      uploadUserId: sessionUser?.id,
    }).catch((error) => {
      console.error(
        `[epub-import-job] failed to enqueue job ${job.id}: ${String(error?.message || error)}`,
      );
    });
    return res.status(202).json({ job: toEpubImportJobApiResponse(job) });
  },
);

app.get("/api/projects/epub/import/jobs/:id", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  if (!isEpubImportJobStorageAvailable()) {
    return res.status(404).json({ error: "not_found" });
  }

  let job = findEpubImportJobForUser(req.params.id, sessionUser?.id);
  if (!job) {
    return res.status(404).json({ error: "not_found" });
  }

  if (
    String(job.status || "")
      .trim()
      .toLowerCase() === "completed"
  ) {
    const expiresAtTs = new Date(job.expiresAt || 0).getTime();
    if (Number.isFinite(expiresAtTs) && Date.now() > expiresAtTs) {
      job = expireEpubImportJob(job) || job;
      return res.json({ job: toEpubImportJobApiResponse(job) });
    }
    const result = readEpubImportJobResult(job.resultPath);
    if (!result) {
      job =
        expireEpubImportJob(job, {
          error:
            "O resultado da importacao EPUB nao esta mais disponivel. Envie o arquivo novamente.",
        }) || job;
      return res.json({ job: toEpubImportJobApiResponse(job) });
    }
    return res.json({ job: toEpubImportJobApiResponse(job, { result }) });
  }

  return res.json({ job: toEpubImportJobApiResponse(job) });
});

app.post("/api/projects/epub/import", requireAuth, parseEpubImportRequestBody, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  let requestInput;
  try {
    requestInput = resolveEpubImportRequestInput(req);
  } catch (error) {
    if (error?.code === "duplicate_episode_key") {
      return res.status(400).json({ error: "duplicate_episode_key", key: error.key });
    }
    if (error?.code === "duplicate_volume_cover_key") {
      return res.status(400).json({ error: "duplicate_volume_cover_key", key: error.key });
    }
    return res.status(400).json({ error: "invalid_project_snapshot" });
  }

  if (requestInput.isMultipartRequest && !req.file) {
    return res.status(400).json({ error: "file_required" });
  }

  if (!requestInput.buffer.length) {
    return res.status(400).json({ error: "empty_epub_upload" });
  }

  let project = requestInput.project;
  const rawProjectId = requestInput.rawProjectId;
  if (!project && rawProjectId) {
    project =
      normalizeProjects(loadProjects()).find(
        (item) => item.id === rawProjectId && !item.deletedAt,
      ) || null;
    if (!project) {
      return res.status(404).json({ error: "project_not_found" });
    }
  }

  try {
    const preview = await importProjectEpub({
      buffer: requestInput.buffer,
      project,
      targetVolume: requestInput.targetVolume,
      defaultStatus: requestInput.defaultStatus,
      uploadsDir: path.join(__dirname, "..", "public", "uploads"),
      loadUploads,
      writeUploads,
      uploadUserId: sessionUser?.id,
    });
    return res.json(preview);
  } catch (error) {
    const mappedError = mapEpubImportExecutionError(error);
    return res.status(mappedError.status).json(mappedError.body);
  }
});

app.post("/api/projects/epub/import/cleanup", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const cleanup = cleanupProjectEpubImportTempUploads({
    importIds: req.body?.importIds,
    uploadUserId: sessionUser?.id,
    uploads: loadUploads(),
    uploadsDir: path.join(__dirname, "..", "public", "uploads"),
    usedUploadUrls: getUsedUploadUrls(),
  });

  if (cleanup.changed) {
    writeUploads(cleanup.uploadsNext, { reason: "epub_import_cleanup" });
  }

  return res.json({
    requestedImportIds: cleanup.requestedImportIds,
    matchedUploads: cleanup.matchedUploads,
    deletedUploads: cleanup.deletedUploads,
    skippedInUse: cleanup.skippedInUse,
    skippedNotOwned: cleanup.skippedNotOwned,
    failed: cleanup.failed,
  });
});

app.post("/api/projects/epub/export", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const projectPayload = req.body?.project;
  if (!projectPayload || typeof projectPayload !== "object") {
    return res.status(400).json({ error: "project_required" });
  }

  const normalizedProject = normalizeProjects([projectPayload])[0];
  const duplicateEpisodeKey = findDuplicateEpisodeKey(normalizedProject.episodeDownloads);
  if (duplicateEpisodeKey) {
    return res.status(400).json({ error: "duplicate_episode_key", key: duplicateEpisodeKey.key });
  }
  const duplicateVolumeCoverKey = findDuplicateVolumeCover(normalizedProject.volumeEntries);
  if (duplicateVolumeCoverKey) {
    return res
      .status(400)
      .json({ error: "duplicate_volume_cover_key", key: duplicateVolumeCoverKey.key });
  }

  try {
    const { buffer, filename } = await exportProjectEpub({
      project: normalizedProject,
      volume: req.body?.volume,
      includeDrafts: Boolean(req.body?.includeDrafts),
      origin: PRIMARY_APP_ORIGIN,
      siteName: loadSiteSettings()?.site?.name,
    });
    res.setHeader("Content-Type", "application/epub+zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    if (error?.code === "no_eligible_chapters" || error?.message === "no_eligible_chapters") {
      return res.status(422).json({ error: "no_eligible_chapters" });
    }
    return res.status(400).json({
      error: "epub_export_failed",
      detail: String(error?.message || error || "epub_export_failed"),
    });
  }
});

app.post(
  "/api/projects/:id/manga-import/preview",
  requireAuth,
  parseProjectImageImportRequestBody,
  async (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageProjects(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    let requestInput;
    try {
      requestInput = resolveProjectImageImportRequestInput(req);
    } catch {
      return res.status(400).json({ error: "invalid_import_request" });
    }

    const routeProjectId = String(req.params.id || "").trim();
    let project = null;
    try {
      project = requestInput.rawProject
        ? normalizeProjectSnapshotForEpubImport(requestInput.rawProject)
        : null;
    } catch (error) {
      if (error?.code === "duplicate_episode_key") {
        return res.status(400).json({ error: "duplicate_episode_key", key: error.key });
      }
      if (error?.code === "duplicate_volume_cover_key") {
        return res.status(400).json({ error: "duplicate_volume_cover_key", key: error.key });
      }
      return res.status(400).json({ error: "invalid_project_snapshot" });
    }

    if (!project) {
      project =
        normalizeProjects(loadProjects()).find(
          (item) => item.id === routeProjectId && !item.deletedAt,
        ) || null;
    }
    if (!project) {
      return res.status(404).json({ error: "project_not_found" });
    }
    if (
      !requestInput.archiveBuffer &&
      (!Array.isArray(requestInput.files) || requestInput.files.length === 0)
    ) {
      return res.status(400).json({ error: "file_required" });
    }

    try {
      const preview = previewProjectImageImport({
        project,
        files: requestInput.files,
        manifestEntries: requestInput.manifestEntries,
        archiveBuffer: requestInput.archiveBuffer,
        archiveName: requestInput.archiveName,
        targetVolume: requestInput.targetVolume,
        targetChapterNumber: requestInput.targetChapterNumber,
      });
      return res.json(preview);
    } catch (error) {
      const mappedError = mapProjectImageImportExecutionError(error);
      return res.status(mappedError.status).json(mappedError.body);
    }
  },
);

app.post(
  "/api/projects/:id/manga-import/jobs",
  requireAuth,
  parseProjectImageImportRequestBody,
  async (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageProjects(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    if (!isProjectImageImportJobStorageAvailable()) {
      return res.status(404).json({ error: "not_found" });
    }

    let requestInput;
    try {
      requestInput = resolveProjectImageImportRequestInput(req);
    } catch {
      return res.status(400).json({ error: "invalid_import_request" });
    }

    const routeProjectId = String(req.params.id || "").trim();
    let project = null;
    try {
      project = requestInput.rawProject
        ? normalizeProjectSnapshotForEpubImport(requestInput.rawProject)
        : null;
    } catch (error) {
      if (error?.code === "duplicate_episode_key") {
        return res.status(400).json({ error: "duplicate_episode_key", key: error.key });
      }
      if (error?.code === "duplicate_volume_cover_key") {
        return res.status(400).json({ error: "duplicate_volume_cover_key", key: error.key });
      }
      return res.status(400).json({ error: "invalid_project_snapshot" });
    }

    if (!project) {
      project =
        normalizeProjects(loadProjects()).find(
          (item) => item.id === routeProjectId && !item.deletedAt,
        ) || null;
    }
    if (!project) {
      return res.status(404).json({ error: "project_not_found" });
    }
    if (
      !requestInput.archiveBuffer &&
      (!Array.isArray(requestInput.files) || requestInput.files.length === 0)
    ) {
      return res.status(400).json({ error: "file_required" });
    }

    const job = upsertProjectImageImportJob({
      id: crypto.randomUUID(),
      projectId: project.id,
      requestedBy: String(sessionUser?.id || ""),
      status: "queued",
      summary: {},
      resultPath: null,
      error: null,
      createdAt: new Date().toISOString(),
    });
    if (!job) {
      return res.status(500).json({ error: "job_create_failed" });
    }
    void enqueueProjectImageImportJob(job.id, {
      project,
      files: requestInput.files,
      manifestEntries: requestInput.manifestEntries,
      archiveBuffer: requestInput.archiveBuffer,
      archiveName: requestInput.archiveName,
      targetVolume: requestInput.targetVolume,
      targetChapterNumber: requestInput.targetChapterNumber,
      defaultStatus: requestInput.defaultStatus,
    }).catch((error) => {
      console.error(
        `[project-image-import-job] failed to enqueue job ${job.id}: ${String(error?.message || error)}`,
      );
    });
    return res.status(202).json({ job: toProjectImageImportJobApiResponse(job) });
  },
);

app.get("/api/projects/:id/manga-import/jobs/:jobId", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  if (!isProjectImageImportJobStorageAvailable()) {
    return res.status(404).json({ error: "not_found" });
  }

  let job = findProjectImageImportJobForUser(req.params.jobId, sessionUser?.id);
  if (!job || String(job.projectId || "") !== String(req.params.id || "").trim()) {
    return res.status(404).json({ error: "not_found" });
  }

  if (
    String(job.status || "")
      .trim()
      .toLowerCase() === "completed"
  ) {
    const expiresAtTs = new Date(job.expiresAt || 0).getTime();
    if (Number.isFinite(expiresAtTs) && Date.now() > expiresAtTs) {
      job = expireProjectImageImportJob(job) || job;
      return res.json({ job: toProjectImageImportJobApiResponse(job) });
    }
    const result = readProjectImageImportJobResult(job.resultPath);
    if (!result) {
      job =
        expireProjectImageImportJob(job, {
          error:
            "O resultado da importacao de imagens nao esta mais disponivel. Envie o lote novamente.",
        }) || job;
      return res.json({ job: toProjectImageImportJobApiResponse(job) });
    }
    return res.json({ job: toProjectImageImportJobApiResponse(job, { result }) });
  }

  return res.json({ job: toProjectImageImportJobApiResponse(job) });
});

app.post("/api/projects/:id/manga-export/chapter", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const routeProjectId = String(req.params.id || "").trim();
  const chapterNumber = Number(req.body?.chapterNumber ?? req.body?.number);
  const volumeRaw = req.body?.volume;
  const volume =
    volumeRaw !== undefined &&
    volumeRaw !== null &&
    String(volumeRaw).trim() !== "" &&
    Number.isFinite(Number(volumeRaw))
      ? Number(volumeRaw)
      : undefined;
  const format =
    String(req.body?.format || "zip")
      .trim()
      .toLowerCase() === "cbz"
      ? "cbz"
      : "zip";

  if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
    return res.status(400).json({ error: "invalid_chapter" });
  }

  let project = null;
  try {
    project = req.body?.project ? normalizeProjectSnapshotForEpubImport(req.body.project) : null;
  } catch (error) {
    if (error?.code === "duplicate_episode_key") {
      return res.status(400).json({ error: "duplicate_episode_key", key: error.key });
    }
    if (error?.code === "duplicate_volume_cover_key") {
      return res.status(400).json({ error: "duplicate_volume_cover_key", key: error.key });
    }
    return res.status(400).json({ error: "invalid_project_snapshot" });
  }
  if (!project) {
    project =
      normalizeProjects(loadProjects()).find(
        (item) => item.id === routeProjectId && !item.deletedAt,
      ) || null;
  }
  if (!project) {
    return res.status(404).json({ error: "project_not_found" });
  }

  try {
    const result = exportProjectImageChapter({
      project,
      chapterNumber,
      volume,
      format,
      uploadsDir: path.join(__dirname, "..", "public", "uploads"),
    });
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  } catch (error) {
    if (error?.code === "no_eligible_chapters" || error?.message === "no_eligible_chapters") {
      return res.status(422).json({ error: "no_eligible_chapters" });
    }
    return res.status(400).json({
      error: "project_image_export_failed",
      detail: String(error?.message || error || "project_image_export_failed"),
    });
  }
});

app.post("/api/projects/:id/manga-export/jobs", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  if (!isProjectImageExportJobStorageAvailable()) {
    return res.status(404).json({ error: "not_found" });
  }

  const routeProjectId = String(req.params.id || "").trim();
  const volumeRaw = req.body?.volume;
  const volume =
    volumeRaw !== undefined &&
    volumeRaw !== null &&
    String(volumeRaw).trim() !== "" &&
    Number.isFinite(Number(volumeRaw))
      ? Number(volumeRaw)
      : undefined;

  let project = null;
  try {
    project = req.body?.project ? normalizeProjectSnapshotForEpubImport(req.body.project) : null;
  } catch (error) {
    if (error?.code === "duplicate_episode_key") {
      return res.status(400).json({ error: "duplicate_episode_key", key: error.key });
    }
    if (error?.code === "duplicate_volume_cover_key") {
      return res.status(400).json({ error: "duplicate_volume_cover_key", key: error.key });
    }
    return res.status(400).json({ error: "invalid_project_snapshot" });
  }
  if (!project) {
    project =
      normalizeProjects(loadProjects()).find(
        (item) => item.id === routeProjectId && !item.deletedAt,
      ) || null;
  }
  if (!project) {
    return res.status(404).json({ error: "project_not_found" });
  }

  const job = upsertProjectImageExportJob({
    id: crypto.randomUUID(),
    projectId: project.id,
    requestedBy: String(sessionUser?.id || ""),
    status: "queued",
    summary: {
      scope: volume !== undefined ? "volume" : "project",
      volume: volume ?? null,
      includeDrafts: Boolean(req.body?.includeDrafts),
      format: "zip",
    },
    resultPath: null,
    error: null,
    createdAt: new Date().toISOString(),
  });
  if (!job) {
    return res.status(500).json({ error: "job_create_failed" });
  }
  void enqueueProjectImageExportJob(job.id, {
    project,
    volume,
    includeDrafts: Boolean(req.body?.includeDrafts),
  }).catch((error) => {
    console.error(
      `[project-image-export-job] failed to enqueue job ${job.id}: ${String(error?.message || error)}`,
    );
  });
  return res.status(202).json({ job: toProjectImageExportJobApiResponse(job) });
});

app.get("/api/projects/:id/manga-export/jobs/:jobId", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  if (!isProjectImageExportJobStorageAvailable()) {
    return res.status(404).json({ error: "not_found" });
  }

  let job = findProjectImageExportJobForUser(req.params.jobId, sessionUser?.id);
  if (!job || String(job.projectId || "") !== String(req.params.id || "").trim()) {
    return res.status(404).json({ error: "not_found" });
  }

  if (
    String(job.status || "")
      .trim()
      .toLowerCase() === "completed"
  ) {
    const expiresAtTs = new Date(job.expiresAt || 0).getTime();
    if (Number.isFinite(expiresAtTs) && Date.now() > expiresAtTs) {
      job = expireProjectImageExportJob(job) || job;
      return res.json({ job: toProjectImageExportJobApiResponse(job) });
    }
    return res.json({
      job: toProjectImageExportJobApiResponse(job, {
        downloadPath: buildProjectImageExportDownloadPath(req.params.id, job.id),
      }),
    });
  }

  return res.json({ job: toProjectImageExportJobApiResponse(job) });
});

app.get("/api/projects/:id/manga-export/jobs/:jobId/download", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  if (!isProjectImageExportJobStorageAvailable()) {
    return res.status(404).json({ error: "not_found" });
  }

  let job = findProjectImageExportJobForUser(req.params.jobId, sessionUser?.id);
  if (!job || String(job.projectId || "") !== String(req.params.id || "").trim()) {
    return res.status(404).json({ error: "not_found" });
  }
  if (
    String(job.status || "")
      .trim()
      .toLowerCase() !== "completed"
  ) {
    return res.status(409).json({ error: "job_not_completed" });
  }

  const expiresAtTs = new Date(job.expiresAt || 0).getTime();
  if (Number.isFinite(expiresAtTs) && Date.now() > expiresAtTs) {
    job = expireProjectImageExportJob(job) || job;
    return res.status(410).json({ error: "expired" });
  }
  if (!job.resultPath || !fs.existsSync(job.resultPath)) {
    job =
      expireProjectImageExportJob(job, {
        error: "O arquivo exportado nao esta mais disponivel. Gere a exportacao novamente.",
      }) || job;
    return res.status(410).json({ error: "expired" });
  }

  const summary =
    job.summary && typeof job.summary === "object" && !Array.isArray(job.summary)
      ? job.summary
      : {};
  const fileName =
    String(summary.filename || "").trim() || path.basename(String(job.resultPath || "export.zip"));
  const contentType = String(summary.contentType || "").trim() || "application/zip";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  return res.sendFile(path.resolve(job.resultPath));
});

app.post("/api/projects", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const payload = req.body || {};
  const title = String(payload.title || "").trim();
  const id = String(payload.id || "").trim();
  if (!title || !id) {
    return res.status(400).json({ error: "title_and_id_required" });
  }

  let projects = normalizeProjects(loadProjects());
  if (projects.some((project) => project.id === id)) {
    return res.status(409).json({ error: "id_exists" });
  }

  const now = new Date().toISOString();
  const nextProjectRaw = normalizeProjects([
    {
      ...payload,
      id,
      title,
      createdAt: now,
      updatedAt: now,
      order: projects.length,
    },
  ])[0];
  const localizedCreate = await localizeProjectImageFields({
    project: nextProjectRaw,
    importRemoteImage: ({ remoteUrl, folder, ...options }) =>
      importRemoteImageFile({
        remoteUrl,
        folder,
        ...options,
        uploadsDir: path.join(__dirname, "..", "public", "uploads"),
      }),
    maxConcurrent: 4,
  });
  const nextProjectNormalized = normalizeProjects([localizedCreate.project])[0];
  upsertUploadEntries(localizedCreate.uploadsToUpsert);
  const duplicateEpisodeKey = findDuplicateEpisodeKey(nextProjectNormalized.episodeDownloads);
  if (duplicateEpisodeKey) {
    return res.status(400).json({ error: "duplicate_episode_key", key: duplicateEpisodeKey.key });
  }
  const duplicateVolumeCoverKey = findDuplicateVolumeCover(nextProjectNormalized.volumeEntries);
  if (duplicateVolumeCoverKey) {
    return res
      .status(400)
      .json({ error: "duplicate_volume_cover_key", key: duplicateVolumeCoverKey.key });
  }
  const nextProject = applyEpisodePublicationMetadata(null, nextProjectNormalized, now);

  projects.push(nextProject);
  writeProjects(projects);
  appendAuditLog(req, "projects.create", "projects", {
    id: nextProject.id,
    count: localizedCreate.summary.downloaded,
    failures: localizedCreate.summary.failed,
  });

  const updates = loadUpdates();
  const episodeWebhookUpdates = collectEpisodeUpdatesByVisibility(null, nextProject, now).map(
    (item) => ({
      ...item,
      updatedAt: item.updatedAt || now,
    }),
  );
  const episodeUpdateRecords = episodeWebhookUpdates.map((item) => ({
    id: crypto.randomUUID(),
    projectId: nextProject.id,
    projectTitle: nextProject.title,
    episodeNumber: item.episodeNumber,
    volume: item.volume,
    kind: item.kind,
    reason: item.reason,
    unit: item.unit,
    updatedAt: item.updatedAt,
    image: nextProject.cover || "",
  }));
  let nextUpdates =
    episodeUpdateRecords.length > 0 ? [...updates, ...episodeUpdateRecords] : updates;
  const webhookUpdates = [...episodeWebhookUpdates];
  if (
    false &&
    (String(nextProject.type || "")
      .toLowerCase()
      .includes("light") ||
      String(nextProject.type || "")
        .toLowerCase()
        .includes("novel"))
  ) {
    const existingKeys = new Set(
      nextUpdates
        .filter((item) => item.projectId === nextProject.id)
        .map((item) => `${item.episodeNumber}`),
    );
    const fallbackSource = (nextProject.episodeDownloads || [])
      .filter((episode) => typeof episode.content === "string" && episode.content.trim().length > 0)
      .filter((episode) => !existingKeys.has(`${episode.number}`))
      .sort((a, b) => Number(b.number) - Number(a.number));
    const fallbackRecords = fallbackSource.map((episode, index) => ({
      id: crypto.randomUUID(),
      projectId: nextProject.id,
      projectTitle: nextProject.title,
      episodeNumber: episode.number,
      kind: "Lançamento",
      reason: `Capítulo ${episode.number} disponível`,
      unit: "Capítulo",
      updatedAt: new Date(Date.now() - index * 1000).toISOString(),
      image: nextProject.cover || "",
    }));
    if (fallbackRecords.length > 0) {
      nextUpdates = [...nextUpdates, ...fallbackRecords];
      fallbackRecords.forEach((item) => {
        webhookUpdates.push({
          kind: item.kind,
          reason: item.reason,
          unit: item.unit,
          episodeNumber: item.episodeNumber,
          updatedAt: item.updatedAt,
        });
      });
    }
  }
  if (nextUpdates.length !== updates.length) {
    writeUpdates(nextUpdates);
  }

  await runAutoUploadReorganization({ trigger: "project-save", req });
  const persistedProject =
    normalizeProjects(loadProjects()).find((project) => project.id === nextProject.id) ||
    nextProject;
  void enqueueProjectOgPrewarm({
    reason: "project-create",
    projectIds: [persistedProject.id],
  }).catch(() => undefined);

  for (const update of webhookUpdates) {
    const eventKey = resolveProjectWebhookEventKey(update.kind);
    if (!eventKey) {
      continue;
    }
    await dispatchEditorialWebhookEvent({
      eventKey,
      project: persistedProject,
      update,
      chapter: findProjectChapterByEpisodeNumber(
        persistedProject,
        update.episodeNumber,
        update.volume,
      ),
      req,
    });
  }

  return res.status(201).json({ project: persistedProject });
});

app.put("/api/projects/:id/chapters/:number", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const options = parseEditRevisionOptions(req.body);
  const projectId = String(req.params.id || "").trim();
  const chapterNumber = Number(req.params.number);
  const volumeRaw = req.query.volume;
  const volume =
    volumeRaw !== undefined &&
    volumeRaw !== null &&
    String(volumeRaw).trim() !== "" &&
    Number.isFinite(Number(volumeRaw))
      ? Number(volumeRaw)
      : undefined;

  if (!Number.isFinite(chapterNumber)) {
    return res.status(400).json({ error: "invalid_chapter" });
  }

  let projects = normalizeProjects(loadProjects());
  const index = projects.findIndex((project) => project.id === projectId);
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }

  const existing = projects[index];
  const currentRevision = createRevisionToken(existing);
  const noConflict = ensureNoEditConflict({
    req,
    res,
    resourceType: "project",
    resourceId: existing.id,
    current: existing,
    currentRevision,
    options,
  });
  if (!noConflict) {
    return noConflict;
  }

  const chapterPayload =
    req.body?.chapter && typeof req.body.chapter === "object" ? req.body.chapter : null;
  if (!chapterPayload) {
    return res.status(400).json({ error: "chapter_required" });
  }

  const chapterDraft = applyProjectChapterUpdate({
    project: existing,
    targetNumber: chapterNumber,
    targetVolume: volume,
    chapter: chapterPayload,
  });
  if (!chapterDraft.ok) {
    return res
      .status(chapterDraft.code === "volume_required" ? 400 : 404)
      .json({ error: chapterDraft.code });
  }

  const now = new Date().toISOString();
  const mergedRaw = normalizeProjects([
    {
      ...chapterDraft.project,
      id: existing.id,
      updatedAt: now,
    },
  ])[0];
  const localizedUpdate = await localizeProjectImageFields({
    project: mergedRaw,
    importRemoteImage: ({ remoteUrl, folder, ...importOptions }) =>
      importRemoteImageFile({
        remoteUrl,
        folder,
        ...importOptions,
        uploadsDir: path.join(__dirname, "..", "public", "uploads"),
      }),
    maxConcurrent: 4,
  });
  const mergedNormalized = normalizeProjects([localizedUpdate.project])[0];
  upsertUploadEntries(localizedUpdate.uploadsToUpsert);
  const duplicateEpisodeKey = findDuplicateEpisodeKey(mergedNormalized.episodeDownloads);
  if (duplicateEpisodeKey) {
    return res.status(400).json({ error: "duplicate_episode_key", key: duplicateEpisodeKey.key });
  }
  const duplicateVolumeCoverKey = findDuplicateVolumeCover(mergedNormalized.volumeEntries);
  if (duplicateVolumeCoverKey) {
    return res
      .status(400)
      .json({ error: "duplicate_volume_cover_key", key: duplicateVolumeCoverKey.key });
  }
  const publishedImageEpisodeWithoutPages = findPublishedImageEpisodeWithoutPages(
    mergedNormalized.episodeDownloads,
  );
  if (publishedImageEpisodeWithoutPages) {
    return res.status(400).json({
      error: "image_pages_required_for_publication",
      key: publishedImageEpisodeWithoutPages.key,
    });
  }
  const merged = applyEpisodePublicationMetadata(existing, mergedNormalized, now);

  projects[index] = merged;
  writeProjects(projects);
  appendAuditLog(req, "projects.chapter.update", "projects", {
    id: merged.id,
    chapterNumber,
    volume: Number.isFinite(Number(volume)) ? Number(volume) : null,
    count: localizedUpdate.summary.downloaded,
    failures: localizedUpdate.summary.failed,
  });

  const updates = loadUpdates();
  const episodeWebhookUpdates = collectEpisodeUpdatesByVisibility(existing, merged, now).map(
    (item) => ({
      ...item,
      updatedAt: item.updatedAt || now,
    }),
  );
  const episodeUpdateRecords = episodeWebhookUpdates.map((item) => ({
    id: crypto.randomUUID(),
    projectId: merged.id,
    projectTitle: merged.title,
    episodeNumber: item.episodeNumber,
    volume: item.volume,
    kind: item.kind,
    reason: item.reason,
    unit: item.unit,
    updatedAt: item.updatedAt,
    image: merged.cover || "",
  }));
  const nextUpdates =
    episodeUpdateRecords.length > 0 ? [...updates, ...episodeUpdateRecords] : updates;
  if (nextUpdates.length !== updates.length) {
    writeUpdates(nextUpdates);
  }

  await runAutoUploadReorganization({ trigger: "project-save", req });
  const persistedProject =
    normalizeProjects(loadProjects()).find((project) => project.id === merged.id) || merged;
  void enqueueProjectOgPrewarm({
    reason: "project-chapter-update",
    projectIds: [persistedProject.id],
  }).catch(() => undefined);
  for (const update of episodeWebhookUpdates) {
    const eventKey = resolveProjectWebhookEventKey(update.kind);
    if (!eventKey) {
      continue;
    }
    await dispatchEditorialWebhookEvent({
      eventKey,
      project: persistedProject,
      update,
      chapter: findProjectChapterByEpisodeNumber(
        persistedProject,
        update.episodeNumber,
        update.volume,
      ),
      req,
    });
  }

  const persistedChapterLookup = resolveEpisodeLookup(
    persistedProject,
    chapterDraft.chapter.number,
    chapterDraft.chapter.volume,
  );

  return res.json({
    project: {
      ...persistedProject,
      revision: createRevisionToken(persistedProject),
    },
    chapter: persistedChapterLookup.ok ? persistedChapterLookup.episode : null,
  });
});

app.put("/api/projects/:id", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const options = parseEditRevisionOptions(req.body);

  const { id } = req.params;
  let projects = normalizeProjects(loadProjects());
  const index = projects.findIndex((project) => project.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }

  const existing = projects[index];
  const currentRevision = createRevisionToken(existing);
  const noConflict = ensureNoEditConflict({
    req,
    res,
    resourceType: "project",
    resourceId: existing.id,
    current: existing,
    currentRevision,
    options,
  });
  if (!noConflict) {
    return noConflict;
  }
  const payload = req.body || {};
  const now = new Date().toISOString();
  const mergedRaw = normalizeProjects([
    {
      ...existing,
      ...payload,
      id: existing.id,
      updatedAt: now,
    },
  ])[0];
  const localizedUpdate = await localizeProjectImageFields({
    project: mergedRaw,
    importRemoteImage: ({ remoteUrl, folder, ...options }) =>
      importRemoteImageFile({
        remoteUrl,
        folder,
        ...options,
        uploadsDir: path.join(__dirname, "..", "public", "uploads"),
      }),
    maxConcurrent: 4,
  });
  const mergedNormalized = normalizeProjects([localizedUpdate.project])[0];
  upsertUploadEntries(localizedUpdate.uploadsToUpsert);
  const duplicateEpisodeKey = findDuplicateEpisodeKey(mergedNormalized.episodeDownloads);
  if (duplicateEpisodeKey) {
    return res.status(400).json({ error: "duplicate_episode_key", key: duplicateEpisodeKey.key });
  }
  const duplicateVolumeCoverKey = findDuplicateVolumeCover(mergedNormalized.volumeEntries);
  if (duplicateVolumeCoverKey) {
    return res
      .status(400)
      .json({ error: "duplicate_volume_cover_key", key: duplicateVolumeCoverKey.key });
  }
  const publishedImageEpisodeWithoutPages = findPublishedImageEpisodeWithoutPages(
    mergedNormalized.episodeDownloads,
  );
  if (publishedImageEpisodeWithoutPages) {
    return res.status(400).json({
      error: "image_pages_required_for_publication",
      key: publishedImageEpisodeWithoutPages.key,
    });
  }
  const merged = applyEpisodePublicationMetadata(existing, mergedNormalized, now);

  projects[index] = merged;
  writeProjects(projects);
  appendAuditLog(req, "projects.update", "projects", {
    id: merged.id,
    count: localizedUpdate.summary.downloaded,
    failures: localizedUpdate.summary.failed,
  });

  const updates = loadUpdates();
  const episodeWebhookUpdates = collectEpisodeUpdatesByVisibility(existing, merged, now).map(
    (item) => ({
      ...item,
      updatedAt: item.updatedAt || now,
    }),
  );
  const episodeUpdateRecords = episodeWebhookUpdates.map((item) => ({
    id: crypto.randomUUID(),
    projectId: merged.id,
    projectTitle: merged.title,
    episodeNumber: item.episodeNumber,
    volume: item.volume,
    kind: item.kind,
    reason: item.reason,
    unit: item.unit,
    updatedAt: item.updatedAt,
    image: merged.cover || "",
  }));
  let nextUpdates =
    episodeUpdateRecords.length > 0 ? [...updates, ...episodeUpdateRecords] : updates;
  const webhookUpdates = [...episodeWebhookUpdates];
  if (
    false &&
    (String(merged.type || "")
      .toLowerCase()
      .includes("light") ||
      String(merged.type || "")
        .toLowerCase()
        .includes("novel"))
  ) {
    const existingKeys = new Set(
      nextUpdates
        .filter((item) => item.projectId === merged.id)
        .map((item) => `${item.episodeNumber}`),
    );
    const fallbackSource = (merged.episodeDownloads || [])
      .filter((episode) => typeof episode.content === "string" && episode.content.trim().length > 0)
      .filter((episode) => !existingKeys.has(`${episode.number}`))
      .sort((a, b) => Number(b.number) - Number(a.number));
    const fallbackRecords = fallbackSource.map((episode, index) => ({
      id: crypto.randomUUID(),
      projectId: merged.id,
      projectTitle: merged.title,
      episodeNumber: episode.number,
      kind: "Lançamento",
      reason: `Capítulo ${episode.number} disponível`,
      unit: "Capítulo",
      updatedAt: new Date(Date.now() - index * 1000).toISOString(),
      image: merged.cover || "",
    }));
    if (fallbackRecords.length > 0) {
      nextUpdates = [...nextUpdates, ...fallbackRecords];
      fallbackRecords.forEach((item) => {
        webhookUpdates.push({
          kind: item.kind,
          reason: item.reason,
          unit: item.unit,
          episodeNumber: item.episodeNumber,
          updatedAt: item.updatedAt,
        });
      });
    }
  }
  if (nextUpdates.length !== updates.length) {
    writeUpdates(nextUpdates);
  }

  await runAutoUploadReorganization({ trigger: "project-save", req });
  const persistedProject =
    normalizeProjects(loadProjects()).find((project) => project.id === merged.id) || merged;
  void enqueueProjectOgPrewarm({
    reason: "project-update",
    projectIds: [persistedProject.id],
  }).catch(() => undefined);
  for (const update of webhookUpdates) {
    const eventKey = resolveProjectWebhookEventKey(update.kind);
    if (!eventKey) {
      continue;
    }
    await dispatchEditorialWebhookEvent({
      eventKey,
      project: persistedProject,
      update,
      chapter: findProjectChapterByEpisodeNumber(
        persistedProject,
        update.episodeNumber,
        update.volume,
      ),
      req,
    });
  }
  return res.json({
    project: {
      ...persistedProject,
      revision: createRevisionToken(persistedProject),
    },
  });
});

app.delete("/api/projects/:id", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  const projects = normalizeProjects(loadProjects());
  const index = projects.findIndex((project) => project.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const existing = projects[index];
  if (existing.deletedAt && !isWithinRestoreWindow(existing.deletedAt)) {
    const next = projects.filter((project) => project.id !== String(id));
    writeProjects(next);
    appendAuditLog(req, "projects.delete.final", "projects", { id });
    return res.json({ ok: true });
  }
  if (!existing.deletedAt) {
    projects[index] = {
      ...existing,
      deletedAt: new Date().toISOString(),
      deletedBy: sessionUser?.id || null,
      updatedAt: new Date().toISOString(),
    };
    writeProjects(projects);
    appendAuditLog(req, "projects.delete", "projects", { id });
  }
  return res.json({ ok: true });
});

app.post("/api/projects/:id/restore", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  const projects = normalizeProjects(loadProjects());
  const index = projects.findIndex((project) => project.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const existing = projects[index];
  if (!existing.deletedAt) {
    return res.json({ project: existing });
  }
  if (!isWithinRestoreWindow(existing.deletedAt)) {
    return res.status(410).json({ error: "restore_window_expired" });
  }
  const restored = {
    ...existing,
    deletedAt: null,
    deletedBy: null,
    updatedAt: new Date().toISOString(),
  };
  projects[index] = restored;
  writeProjects(projects);
  appendAuditLog(req, "projects.restore", "projects", { id });
  void enqueueProjectOgPrewarm({
    reason: "project-restore",
    projectIds: [restored.id],
  }).catch(() => undefined);
  return res.json({ project: restored });
});

app.put("/api/projects/reorder", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { orderedIds } = req.body || {};
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "orderedIds_required" });
  }
  const projects = normalizeProjects(loadProjects());
  const orderMap = new Map(orderedIds.map((projectId, index) => [String(projectId), index]));
  const next = projects.map((project) =>
    orderMap.has(project.id) ? { ...project, order: orderMap.get(project.id) } : project,
  );
  writeProjects(next);
  appendAuditLog(req, "projects.reorder", "projects", { count: next.length });
  return res.json({ ok: true });
});

app.post("/api/projects/:id/rebuild-updates", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const id = String(req.params.id || "");
  const projects = normalizeProjects(loadProjects());
  const project = projects.find((item) => item.id === id);
  if (!project) {
    return res.status(404).json({ error: "not_found" });
  }
  const updates = loadUpdates().filter((item) => item.projectId !== id);
  const episodeUpdates = collectEpisodeUpdatesByVisibility(null, project, new Date().toISOString())
    .map((item) => ({
      id: crypto.randomUUID(),
      projectId: project.id,
      projectTitle: project.title,
      episodeNumber: item.episodeNumber,
      volume: item.volume,
      kind: item.kind,
      reason: item.reason,
      unit: item.unit,
      updatedAt: item.updatedAt || new Date().toISOString(),
      image: project.cover || "",
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const rebuilt = [...updates, ...episodeUpdates];
  writeUpdates(rebuilt);
  appendAuditLog(req, "projects.rebuild_updates", "projects", { id });
  return res.json({ ok: true, updates: episodeUpdates.length });
});

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

app.get("/sitemap.xml", (_req, res) => {
  const xml = buildSitemapXml(buildPublicSitemapEntries());
  return sendXmlResponse(res, xml, "application/xml; charset=utf-8");
});

app.get("/api/public/sitemap.xml", (_req, res) => {
  const xml = buildSitemapXml(buildPublicSitemapEntries());
  return sendXmlResponse(res, xml, "application/xml; charset=utf-8");
});

app.get("/rss/posts.xml", (_req, res) => {
  const settings = loadSiteSettings();
  const xml = buildRssXml({
    title: `${settings?.site?.name || "Nekomata"} • Posts`,
    link: PRIMARY_APP_ORIGIN,
    description: "Feed de postagens publicadas",
    selfUrl: `${PRIMARY_APP_ORIGIN}/rss/posts.xml`,
    items: buildPostsRssItems(),
  });
  return sendXmlResponse(res, xml, "application/rss+xml; charset=utf-8");
});

app.get("/rss/lancamentos.xml", (_req, res) => {
  const settings = loadSiteSettings();
  const xml = buildRssXml({
    title: `${settings?.site?.name || "Nekomata"} • Lançamentos`,
    link: `${PRIMARY_APP_ORIGIN}/projetos`,
    description: "Feed de lançamentos e ajustes de projetos",
    selfUrl: `${PRIMARY_APP_ORIGIN}/rss/lancamentos.xml`,
    items: buildLaunchesRssItems(),
  });
  return sendXmlResponse(res, xml, "application/rss+xml; charset=utf-8");
});

app.get("/api/public/rss.xml", (req, res) => {
  const feed = String(req.query.feed || "posts")
    .trim()
    .toLowerCase();
  if (feed === "lancamentos") {
    const settings = loadSiteSettings();
    const xml = buildRssXml({
      title: `${settings?.site?.name || "Nekomata"} • Lançamentos`,
      link: `${PRIMARY_APP_ORIGIN}/projetos`,
      description: "Feed de lançamentos e ajustes de projetos",
      selfUrl: `${PRIMARY_APP_ORIGIN}/api/public/rss.xml?feed=lancamentos`,
      items: buildLaunchesRssItems(),
    });
    return sendXmlResponse(res, xml, "application/rss+xml; charset=utf-8");
  }
  const settings = loadSiteSettings();
  const xml = buildRssXml({
    title: `${settings?.site?.name || "Nekomata"} • Posts`,
    link: PRIMARY_APP_ORIGIN,
    description: "Feed de postagens publicadas",
    selfUrl: `${PRIMARY_APP_ORIGIN}/api/public/rss.xml?feed=posts`,
    items: buildPostsRssItems(),
  });
  return sendXmlResponse(res, xml, "application/rss+xml; charset=utf-8");
});

app.get("/api/public/bootstrap", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const cached = readPublicCachedJson(req);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    return res.status(cached.statusCode).json(cached.payload);
  }
  const payload = buildPublicBootstrapResponsePayload({
    payloadMode: PUBLIC_BOOTSTRAP_MODE_FULL,
  });
  writePublicCachedJson(req, payload, {
    ttlMs: 30000,
    tags: [PUBLIC_READ_CACHE_TAGS.BOOTSTRAP],
  });
  res.setHeader("X-Cache", "MISS");
  return res.json(payload);
});

app.get("/api/public/search/suggest", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const cached = readPublicCachedJson(req);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    return res.status(cached.statusCode).json(cached.payload);
  }
  const q = normalizeSearchQuery(req.query.q);
  const scope = parseSearchScope(req.query.scope);
  const limit = parseSearchLimit(req.query.limit);

  if (q.length < publicSearchConfig.minQueryLength) {
    const payload = { q, scope, suggestions: [] };
    writePublicCachedJson(req, payload, {
      ttlMs: Math.min(PUBLIC_READ_CACHE_TTL_MS, 10000),
      tags: [PUBLIC_READ_CACHE_TAGS.SEARCH],
    });
    res.setHeader("X-Cache", "MISS");
    return res.json(payload);
  }

  const now = Date.now();
  const projects = normalizeProjects(loadProjects()).filter((project) => !project.deletedAt);
  const posts = normalizePosts(loadPosts())
    .filter((post) => !post.deletedAt)
    .filter((post) => {
      const publishTime = new Date(post.publishedAt).getTime();
      return publishTime <= now && (post.status === "published" || post.status === "scheduled");
    })
    .map((post) => {
      const resolvedCover = resolvePostCover(post);
      return {
        ...post,
        coverImageUrl: resolvedCover.coverImageUrl,
      };
    });

  const loadedTagTranslations = loadTagTranslations();
  const tagTranslations =
    loadedTagTranslations?.tags && typeof loadedTagTranslations.tags === "object"
      ? loadedTagTranslations.tags
      : {};
  const suggestions = buildPublicSearchSuggestions({
    query: q,
    scope,
    limit,
    projects,
    posts,
  }).map(({ score: _score, ...item }) => {
    const translatedTags = Array.isArray(item.tags)
      ? item.tags
          .map((tag) => {
            const rawTag = String(tag || "").trim();
            if (!rawTag) {
              return "";
            }
            const exact = tagTranslations[rawTag];
            const lowered = tagTranslations[rawTag.toLowerCase()];
            return String(exact || lowered || rawTag).trim();
          })
          .filter(Boolean)
          .slice(0, 4)
      : [];
    return {
      ...item,
      tags: translatedTags,
    };
  });

  const payload = {
    q,
    scope,
    suggestions,
    mediaVariants: buildPublicMediaVariants(suggestions),
  };
  writePublicCachedJson(req, payload, {
    ttlMs: Math.min(PUBLIC_READ_CACHE_TTL_MS, 15000),
    tags: [PUBLIC_READ_CACHE_TAGS.SEARCH],
  });
  res.setHeader("X-Cache", "MISS");
  return res.json(payload);
});

app.get("/api/public/projects", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const cached = readPublicCachedJson(req);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    return res.status(cached.statusCode).json(cached.payload);
  }
  const limitRaw = Number(req.query.limit);
  const pageRaw = Number(req.query.page);
  const usePagination = Number.isFinite(limitRaw) || Number.isFinite(pageRaw);
  const limit = usePagination ? Math.min(Math.max(limitRaw || 20, 1), 200) : null;
  const page = usePagination ? Math.max(pageRaw || 1, 1) : null;
  const projects = getPublicVisibleProjects().map((project) => ({
    id: project.id,
    title: project.title,
    titleOriginal: project.titleOriginal,
    titleEnglish: project.titleEnglish,
    synopsis: project.synopsis,
    description: project.description,
    type: project.type,
    status: project.status,
    year: project.year,
    studio: project.studio,
    animationStudios: project.animationStudios,
    episodes: project.episodes,
    tags: project.tags,
    genres: project.genres,
    cover: project.cover,
    banner: project.banner,
    season: project.season,
    schedule: project.schedule,
    rating: project.rating,
    country: project.country,
    source: project.source,
    producers: project.producers,
    score: project.score,
    startDate: project.startDate,
    endDate: project.endDate,
    relations: project.relations,
    staff: project.staff,
    animeStaff: project.animeStaff,
    trailerUrl: project.trailerUrl,
    forceHero: project.forceHero,
    heroImageUrl: project.heroImageUrl,
    volumeEntries: project.volumeEntries,
    volumeCovers: project.volumeCovers,
    episodeDownloads: project.episodeDownloads,
    views: project.views,
    commentsCount: project.commentsCount,
  }));
  let payload = null;
  if (!usePagination) {
    payload = { projects };
  } else {
    const start = (page - 1) * limit;
    const paged = projects.slice(start, start + limit);
    payload = { projects: paged, page, limit, total: projects.length };
  }
  payload = {
    ...payload,
    mediaVariants: buildPublicMediaVariants(payload.projects),
  };
  writePublicCachedJson(req, payload, {
    ttlMs: PUBLIC_READ_CACHE_TTL_MS,
    tags: [PUBLIC_READ_CACHE_TAGS.PROJECTS],
  });
  res.setHeader("X-Cache", "MISS");
  return res.json(payload);
});

app.get("/api/public/projects/:id", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const id = String(req.params.id || "");
  const projects = getPublicVisibleProjects();
  const project = projects.find((item) => item.id === id);
  if (!project) {
    return res.status(404).json({ error: "not_found" });
  }
  const settings = loadSiteSettings();
  const { discordRoleId: _discordRoleId, ...projectWithoutDiscordRoleId } = project;
  const projectPayload = {
    ...projectWithoutDiscordRoleId,
    readerConfig: resolveProjectReaderConfig({
      projectType: project?.type,
      siteSettings: settings,
      projectReaderConfig: project?.readerConfig,
    }),
  };
  const translations = loadTagTranslations();
  return res.json({
    project: projectPayload,
    revision: buildProjectOgRevision({
      project: projectPayload,
      settings,
      translations,
      origin: PRIMARY_APP_ORIGIN,
      resolveVariantUrl: resolveMetaImageVariantUrl,
    }),
    mediaVariants: buildPublicMediaVariants(projectPayload),
  });
});

app.post("/api/public/projects/:id/view", async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!(await canRegisterView(ip))) {
    return res.status(429).json({ error: "rate_limited" });
  }
  const id = String(req.params.id || "");
  const projects = normalizeProjects(loadProjects());
  const project = projects.find((item) => item.id === id);
  if (!project) {
    return res.status(404).json({ error: "not_found" });
  }
  if (project.deletedAt) {
    return res.status(404).json({ error: "not_found" });
  }
  const updated = incrementProjectViews(id);
  appendAnalyticsEvent(req, {
    eventType: "view",
    resourceType: "project",
    resourceId: project.id,
    meta: {
      action: "view",
      resourceType: "project",
      resourceId: project.id,
    },
  });
  return res.json({ views: updated?.views ?? project.views ?? 0 });
});

app.post("/api/public/analytics/event", async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!(await canRegisterView(ip))) {
    return res.status(429).json({ error: "rate_limited" });
  }
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const eventType = String(payload.eventType || "")
    .trim()
    .toLowerCase();
  const resourceType = String(payload.resourceType || "")
    .trim()
    .toLowerCase();
  const resourceId = String(payload.resourceId || "").trim();
  if (!PUBLIC_ANALYTICS_EVENT_TYPE_SET.has(eventType)) {
    return res.status(400).json({ error: "invalid_event_type" });
  }
  if (!PUBLIC_ANALYTICS_RESOURCE_TYPE_SET.has(resourceType)) {
    return res.status(400).json({ error: "invalid_resource_type" });
  }
  if (!resourceId) {
    return res.status(400).json({ error: "invalid_resource_id" });
  }
  const result = appendAnalyticsEvent(req, {
    eventType,
    resourceType,
    resourceId,
    meta:
      payload.meta && typeof payload.meta === "object" && !Array.isArray(payload.meta)
        ? payload.meta
        : {},
  });
  if (result.ok || result.reason === "cooldown") {
    return res.json({ ok: true, deduped: result.reason === "cooldown" });
  }
  return res.status(500).json({ error: "event_write_failed" });
});

app.get("/api/public/projects/:id/chapters/:number", (req, res) => {
  const id = String(req.params.id || "");
  const chapterNumber = Number(req.params.number);
  const volume = req.query.volume ? Number(req.query.volume) : null;
  if (!Number.isFinite(chapterNumber)) {
    return res.status(400).json({ error: "invalid_chapter" });
  }
  const projects = getPublicReadableProjects();
  const project = projects.find((item) => item.id === id);
  if (!project) {
    return res.status(404).json({ error: "not_found" });
  }
  const chapterLookup = resolveEpisodeLookup(project, chapterNumber, volume, {
    requirePublished: true,
  });
  if (!chapterLookup.ok) {
    return res.status(chapterLookup.code === "volume_required" ? 400 : 404).json({
      error: chapterLookup.code,
    });
  }
  const chapter = chapterLookup.episode;
  const normalizedPages = normalizeProjectEpisodePages(chapter?.pages);
  const contentFormat = normalizeProjectEpisodeContentFormat(
    chapter?.contentFormat,
    normalizedPages.length > 0 ? "images" : "lexical",
  );
  const pageCount = getProjectEpisodePageCount({
    ...chapter,
    contentFormat,
    pages: normalizedPages,
  });
  const settings = loadSiteSettings();
  return res.json({
    chapter: {
      number: chapter.number,
      volume: chapter.volume,
      title: chapter.title,
      entryKind:
        String(chapter.entryKind || "")
          .trim()
          .toLowerCase() === "extra"
          ? "extra"
          : "main",
      entrySubtype: String(chapter.entrySubtype || "").trim(),
      readingOrder: Number.isFinite(Number(chapter.readingOrder))
        ? Number(chapter.readingOrder)
        : undefined,
      displayLabel: String(chapter.displayLabel || "").trim(),
      synopsis: deriveChapterSynopsis(chapter),
      releaseDate: chapter.releaseDate || "",
      updatedAt: chapter.chapterUpdatedAt || chapter.updatedAt || "",
      coverImageUrl: chapter.coverImageUrl || normalizedPages[0]?.imageUrl || "",
      coverImageAlt: chapter.coverImageAlt || "",
      content: contentFormat === "lexical" ? chapter.content || "" : "",
      contentFormat,
      pages: normalizedPages,
      pageCount,
      hasPages: hasProjectEpisodePages({
        ...chapter,
        contentFormat,
        pages: normalizedPages,
        pageCount,
      }),
    },
    readerConfig: resolveProjectReaderConfig({
      projectType: project?.type,
      siteSettings: settings,
      projectReaderConfig: project?.readerConfig,
    }),
  });
});

app.post("/api/public/projects/:id/chapters/:number/polls/vote", async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!(await canRegisterPollVote(ip))) {
    return res.status(429).json({ error: "rate_limited" });
  }
  const id = String(req.params.id || "");
  const chapterNumber = Number(req.params.number);
  const volume = req.query.volume ? Number(req.query.volume) : null;
  const { optionUid, voterId, checked, question } = req.body || {};
  if (!Number.isFinite(chapterNumber)) {
    return res.status(400).json({ error: "invalid_chapter" });
  }
  if (!optionUid || !voterId) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  const projects = normalizeProjects(loadProjects());
  const projectIndex = projects.findIndex((item) => item.id === id);
  if (projectIndex === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const project = projects[projectIndex];
  const chapterLookup = resolveEpisodeLookup(project, chapterNumber, volume, {
    requirePublished: true,
  });
  if (!chapterLookup.ok) {
    return res.status(chapterLookup.code === "volume_required" ? 400 : 404).json({
      error: chapterLookup.code,
    });
  }
  const chapterIndex = chapterLookup.index;
  const chapter = chapterLookup.episode;
  const result = updateLexicalPollVotes(chapter.content, {
    question,
    optionUid,
    voterId,
    checked,
  });
  if (!result.updated || !result.content) {
    return res.status(404).json({ error: "poll_not_found" });
  }
  const updatedChapter = {
    ...chapter,
    content: result.content,
  };
  const updatedEpisodes = [...project.episodeDownloads];
  updatedEpisodes[chapterIndex] = updatedChapter;
  projects[projectIndex] = {
    ...project,
    episodeDownloads: updatedEpisodes,
  };
  writeProjects(projects);
  return res.json({ ok: true });
});

app.get("/api/public/updates", (req, res) => {
  const limitRaw = Number(req.query.limit);
  const pageRaw = Number(req.query.page);
  const usePagination = Number.isFinite(limitRaw) || Number.isFinite(pageRaw);
  const limit = usePagination ? Math.min(Math.max(limitRaw || 10, 1), 50) : 10;
  const page = usePagination ? Math.max(pageRaw || 1, 1) : 1;
  const updates = getPublicVisibleUpdates();
  if (!usePagination) {
    return res.json({ updates: updates.slice(0, limit) });
  }
  const start = (page - 1) * limit;
  const paged = updates.slice(start, start + limit);
  return res.json({ updates: paged, page, limit, total: updates.length });
});

app.get("/api/integrations/webhooks/editorial", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageIntegrations(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const projectTypes = getActiveProjectTypes({ includeDefaults: true });
  const loadedSettings = loadIntegrationSettings();
  const normalized = normalizeEditorialWebhookSettings(loadedSettings, { projectTypes });
  const settings = migrateEditorialMentionPlaceholdersInSettings(normalized);
  if (JSON.stringify(loadedSettings) !== JSON.stringify(settings)) {
    writeIntegrationSettings(settings);
  }
  appendAuditLog(req, "integrations.webhooks_editorial.read", "integrations", {
    channel: "all",
  });
  return res.json({ settings, projectTypes, revision: createRevisionToken(settings) });
});

app.put("/api/integrations/webhooks/editorial", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageIntegrations(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const options = parseEditRevisionOptions(req.body);
  const payload = req.body?.settings ?? req.body;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const projectTypes = getActiveProjectTypes({ includeDefaults: true });
  const currentSettings = migrateEditorialMentionPlaceholdersInSettings(
    normalizeEditorialWebhookSettings(loadIntegrationSettings(), { projectTypes }),
  );
  const currentRevision = createRevisionToken(currentSettings);
  const noConflict = ensureNoEditConflict({
    req,
    res,
    resourceType: "editorial_webhooks",
    resourceId: "global",
    current: currentSettings,
    currentRevision,
    options,
  });
  if (!noConflict) {
    return noConflict;
  }
  const normalized = normalizeEditorialWebhookSettings(payload, { projectTypes });
  const migrated = migrateEditorialMentionPlaceholdersInSettings(normalized);
  const validation = validateEditorialWebhookSettingsPlaceholders(migrated);
  if (!validation.ok) {
    return res.status(400).json({
      error: "invalid_placeholders",
      placeholders: validation.errors,
    });
  }

  const persisted = writeIntegrationSettings(migrated);
  const settings = migrateEditorialMentionPlaceholdersInSettings(
    normalizeEditorialWebhookSettings(persisted, { projectTypes }),
  );
  appendAuditLog(req, "integrations.webhooks_editorial.update", "integrations", {
    count: Array.isArray(settings?.typeRoles) ? settings.typeRoles.length : 0,
  });
  return res.json({ settings, projectTypes, revision: createRevisionToken(settings) });
});

app.post("/api/integrations/webhooks/editorial/test", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageIntegrations(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const eventKey = String(req.body?.eventKey || "").trim();
  const channelKey = resolveEditorialEventChannel(eventKey);
  if (!channelKey) {
    return res.status(400).json({ error: "invalid_event_key" });
  }

  try {
    const now = new Date().toISOString();
    const placeholderImage = toAbsoluteUrl("/placeholder.svg") || "/placeholder.svg";
    const projects = normalizeProjects(loadProjects()).filter((project) => !project.deletedAt);
    const posts = normalizePosts(loadPosts()).filter((post) => !post.deletedAt);
    const requestedProjectId = String(req.body?.projectId || "").trim();
    const requestedPostId = String(req.body?.postId || "").trim();

    let sampleProject =
      projects.find((project) => project.id === requestedProjectId) ||
      projects.find((project) => String(project.id || "").trim().length > 0) ||
      null;
    let samplePost =
      posts.find((post) => post.id === requestedPostId) ||
      posts.find((post) => String(post.slug || "").trim().length > 0) ||
      null;

    if (!sampleProject && samplePost?.projectId) {
      sampleProject =
        projects.find((project) => project.id === String(samplePost.projectId)) || null;
    }

    if (!sampleProject) {
      sampleProject = {
        id: "sample-project",
        title: "Projeto de teste",
        type: "Anime",
        cover: placeholderImage,
        banner: placeholderImage,
        heroImageUrl: "",
        discordRoleId: "",
        episodeDownloads: [
          {
            number: 1,
            volume: 1,
            title: "Capítulo piloto",
            releaseDate: now.slice(0, 10),
            chapterUpdatedAt: now,
            coverImageUrl: placeholderImage,
          },
        ],
        updatedAt: now,
      };
    }

    if (!samplePost) {
      samplePost = {
        id: "sample-post",
        title: "Post de teste",
        slug: "post-de-teste",
        status: "published",
        author: sessionUser?.name || "Editor",
        publishedAt: now,
        excerpt: "Mensagem de teste para o webhook editorial.",
        tags: ["Teste"],
        coverImageUrl: sampleProject.cover || placeholderImage,
        projectId: String(sampleProject.id || ""),
        updatedAt: now,
      };
    }

    const chapterSource = Array.isArray(sampleProject?.episodeDownloads)
      ? sampleProject.episodeDownloads.find((episode) =>
          Number.isFinite(Number(episode?.number)),
        ) || sampleProject.episodeDownloads[0]
      : null;
    const chapterNumber = Number(chapterSource?.number);
    const safeChapterNumber = Number.isFinite(chapterNumber) ? Number(chapterNumber) : 1;
    const sampleChapter = {
      number: safeChapterNumber,
      volume: Number.isFinite(Number(chapterSource?.volume)) ? Number(chapterSource.volume) : "",
      title: String(chapterSource?.title || ""),
      synopsis: deriveChapterSynopsis(chapterSource),
      releaseDate: String(chapterSource?.releaseDate || ""),
      updatedAt: String(chapterSource?.chapterUpdatedAt || chapterSource?.updatedAt || now),
      coverImageUrl: String(chapterSource?.coverImageUrl || ""),
    };
    const sampleUpdateUnit = resolveProjectUpdateUnitLabel(
      sampleProject?.type || "",
      chapterSource,
    );
    const sampleUpdate = {
      kind: eventKey === "project_adjust" ? "Ajuste" : "Lançamento",
      reason:
        eventKey === "project_adjust"
          ? `Conteúdo ajustado no ${sampleUpdateUnit.toLowerCase()} ${safeChapterNumber}`
          : `${sampleUpdateUnit} ${safeChapterNumber} disponível`,
      unit: sampleUpdateUnit,
      episodeNumber: safeChapterNumber,
      volume: sampleChapter.volume,
      updatedAt: now,
    };

    const prepared = prepareEditorialWebhookDispatch({
      eventKey,
      post: samplePost,
      project: sampleProject,
      update: sampleUpdate,
      chapter: sampleChapter,
      settings: loadIntegrationSettings(),
      allowDisabled: true,
    });
    if (!prepared.ok) {
      appendAuditLog(req, "integrations.webhooks_editorial.test", "integrations", {
        eventKey,
        channel: prepared.channel || channelKey,
        status: prepared.status || "failed",
        code: prepared.code || "prepare_failed",
        postId: samplePost?.id || null,
        projectId: sampleProject?.id || null,
      });
      return res.status(400).json({
        ok: false,
        error: prepared.code || "prepare_failed",
        channel: prepared.channel || channelKey,
      });
    }

    const result = await dispatchWebhookMessage({
      provider: "discord",
      webhookUrl: prepared.webhookUrl,
      message: prepared.payload,
      timeoutMs: prepared.timeoutMs,
      retries: prepared.retries,
    });
    const errorDetail = result.ok
      ? ""
      : String(result.bodyText || result.message || "")
          .trim()
          .slice(0, 500);

    appendAuditLog(req, "integrations.webhooks_editorial.test", "integrations", {
      eventKey,
      channel: prepared.channel,
      status: result.status,
      code: result.code || null,
      statusCode: result.statusCode || null,
      attempt: result.attempt || null,
      postId: samplePost?.id || null,
      projectId: sampleProject?.id || null,
      error: errorDetail || null,
    });

    return res.json({
      ok: result.ok,
      eventKey,
      channel: prepared.channel,
      status: result.status,
      code: result.code || null,
      statusCode: result.statusCode || null,
      attempt: result.attempt || null,
      ...(errorDetail ? { errorDetail } : {}),
    });
  } catch (error) {
    appendAuditLog(req, "integrations.webhooks_editorial.test", "integrations", {
      eventKey,
      channel: channelKey,
      status: "failed",
      code: "test_dispatch_failed",
      error: String(error?.message || error || "").slice(0, 200),
    });
    return res.status(500).json({
      ok: false,
      error: "test_dispatch_failed",
      channel: channelKey,
    });
  }
});

app.get("/api/public/settings", (req, res) => {
  const settings = loadSiteSettings();
  return res.json({ settings, revision: createRevisionToken(settings) });
});

app.get("/api/public/tag-translations", (req, res) => {
  const translations = loadTagTranslations();
  const revision = createRevisionToken(translations);
  res.json({
    tags: translations.tags,
    genres: translations.genres,
    staffRoles: translations.staffRoles,
    revision,
  });
});

app.post("/api/tag-translations/anilist-sync", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageIntegrations(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const query = `
      query {
        GenreCollection
        MediaTagCollection {
          name
        }
      }
    `;
    const response = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      return res.status(502).json({ error: "anilist_failed" });
    }
    const data = await response.json();
    const rawGenres = Array.isArray(data?.data?.GenreCollection) ? data.data.GenreCollection : [];
    const rawTags = Array.isArray(data?.data?.MediaTagCollection)
      ? data.data.MediaTagCollection
      : [];
    const genres = rawGenres.map((genre) => String(genre || "").trim()).filter(Boolean);
    const tags = rawTags.map((tag) => String(tag?.name || "").trim()).filter(Boolean);
    const current = loadTagTranslations();
    const nextTags = { ...current.tags };
    const nextGenres = { ...current.genres };
    const nextStaffRoles = { ...current.staffRoles };
    tags.forEach((tag) => {
      if (typeof nextTags[tag] !== "string") {
        nextTags[tag] = "";
      }
    });
    genres.forEach((genre) => {
      if (typeof nextGenres[genre] !== "string") {
        nextGenres[genre] = "";
      }
    });
    const payload = { tags: nextTags, genres: nextGenres, staffRoles: nextStaffRoles };
    writeTagTranslations(payload);
    void enqueueProjectOgPrewarm({
      reason: "tag-translations-anilist-sync",
    }).catch(() => undefined);
    return res.json(payload);
  } catch {
    return res.status(502).json({ error: "anilist_failed" });
  }
});

app.get("/api/public/pages", (req, res) => {
  const pages = loadPages();
  const settings = loadSiteSettings();
  return res.json({
    pages,
    mediaVariants: buildPublicMediaVariants([
      pages,
      { image: settings?.site?.defaultShareImage || "" },
    ]),
    revision: createRevisionToken(pages),
  });
});

app.get("/api/settings", requireAuth, (req, res) => {
  const userId = req.session?.user?.id;
  if (!canManageSettings(userId)) {
    return res.status(403).json({ error: "Sem permissão para gerenciar configurações." });
  }
  const settings = loadSiteSettings();
  return res.json({ settings, revision: createRevisionToken(settings) });
});

app.put("/api/settings", requireAuth, (req, res) => {
  const userId = req.session?.user?.id;
  const options = parseEditRevisionOptions(req.body);
  if (!canManageSettings(userId)) {
    return res.status(403).json({ error: "Sem permissão para gerenciar configurações." });
  }
  const currentSettings = loadSiteSettings();
  const currentRevision = createRevisionToken(currentSettings);
  const noConflict = ensureNoEditConflict({
    req,
    res,
    resourceType: "settings",
    resourceId: "global",
    current: currentSettings,
    currentRevision,
    options,
  });
  if (!noConflict) {
    return noConflict;
  }
  const settings = req.body?.settings;
  if (!settings || typeof settings !== "object") {
    return res.status(400).json({ error: "Payload inválido." });
  }
  const previousSettings = currentSettings;
  const previousDownloadIcons = collectDownloadIconUploads(previousSettings);
  const normalized = normalizeSiteSettings(settings);
  writeSiteSettings(normalized);
  const nextDownloadIcons = collectDownloadIconUploads(normalized);
  const removedIcons = Array.from(previousDownloadIcons).filter(
    (url) => !nextDownloadIcons.has(url),
  );
  removedIcons.forEach((url) => deletePrivateUploadByUrl(url));
  appendAuditLog(req, "settings.update", "settings", {});
  void enqueueProjectOgPrewarm({
    reason: "settings-update",
  }).catch(() => undefined);
  return res.json({ settings: normalized, revision: createRevisionToken(normalized) });
});

app.get("/api/pages", requireAuth, (req, res) => {
  const userId = req.session?.user?.id;
  if (!canManagePages(userId)) {
    return res.status(403).json({ error: "Sem permissão para gerenciar páginas." });
  }
  const pages = loadPages();
  return res.json({ pages, revision: createRevisionToken(pages) });
});

app.put("/api/pages", requireAuth, (req, res) => {
  const userId = req.session?.user?.id;
  const options = parseEditRevisionOptions(req.body);
  if (!canManagePages(userId)) {
    return res.status(403).json({ error: "Sem permissão para gerenciar páginas." });
  }
  const currentPages = loadPages();
  const currentRevision = createRevisionToken(currentPages);
  const noConflict = ensureNoEditConflict({
    req,
    res,
    resourceType: "pages",
    resourceId: "global",
    current: currentPages,
    currentRevision,
    options,
  });
  if (!noConflict) {
    return noConflict;
  }
  const pages = req.body?.pages;
  if (!pages || typeof pages !== "object") {
    return res.status(400).json({ error: "Payload inválido." });
  }
  writePages(pages);
  appendAuditLog(req, "pages.update", "pages", {});
  return res.json({ pages, revision: createRevisionToken(pages) });
});

app.post("/api/tag-translations/sync", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageIntegrations(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { tags, genres, staffRoles } = req.body || {};
  const current = loadTagTranslations();
  const nextTags = { ...current.tags };
  const nextGenres = { ...current.genres };
  const nextStaffRoles = { ...current.staffRoles };

  const tagList = Array.isArray(tags) ? tags : [];
  tagList.forEach((tag) => {
    const key = String(tag || "").trim();
    if (key && typeof nextTags[key] !== "string") {
      nextTags[key] = "";
    }
  });

  const genreList = Array.isArray(genres) ? genres : [];
  genreList.forEach((genre) => {
    const key = String(genre || "").trim();
    if (key && typeof nextGenres[key] !== "string") {
      nextGenres[key] = "";
    }
  });

  const staffRoleList = Array.isArray(staffRoles) ? staffRoles : [];
  staffRoleList.forEach((role) => {
    const key = String(role || "").trim();
    if (key && typeof nextStaffRoles[key] !== "string") {
      nextStaffRoles[key] = "";
    }
  });

  const payload = { tags: nextTags, genres: nextGenres, staffRoles: nextStaffRoles };
  writeTagTranslations(payload);
  void enqueueProjectOgPrewarm({
    reason: "tag-translations-sync",
  }).catch(() => undefined);
  return res.json(payload);
});

app.put("/api/tag-translations", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageSettings(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const options = parseEditRevisionOptions(req.body);
  const tags = req.body?.tags;
  const genres = req.body?.genres;
  const staffRoles = req.body?.staffRoles;
  if (
    (!tags || typeof tags !== "object") &&
    (!genres || typeof genres !== "object") &&
    (!staffRoles || typeof staffRoles !== "object")
  ) {
    return res.status(400).json({ error: "translations_required" });
  }
  const current = loadTagTranslations();
  const currentRevision = createRevisionToken(current);
  const noConflict = ensureNoEditConflict({
    req,
    res,
    resourceType: "tag_translations",
    resourceId: "global",
    current,
    currentRevision,
    options,
  });
  if (!noConflict) {
    return noConflict;
  }
  const normalizedTags =
    tags && typeof tags === "object"
      ? Object.fromEntries(
          Object.entries(tags).map(([key, value]) => [String(key), String(value || "")]),
        )
      : current.tags;
  const normalizedGenres =
    genres && typeof genres === "object"
      ? Object.fromEntries(
          Object.entries(genres).map(([key, value]) => [String(key), String(value || "")]),
        )
      : current.genres;
  const normalizedStaffRoles =
    staffRoles && typeof staffRoles === "object"
      ? Object.fromEntries(
          Object.entries(staffRoles).map(([key, value]) => [String(key), String(value || "")]),
        )
      : current.staffRoles;
  const payload = {
    tags: normalizedTags,
    genres: normalizedGenres,
    staffRoles: normalizedStaffRoles,
  };
  writeTagTranslations(payload);
  void enqueueProjectOgPrewarm({
    reason: "tag-translations-update",
  }).catch(() => undefined);
  return res.json({ ...payload, revision: createRevisionToken(payload) });
});

app.get("/api/anilist/:id", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageIntegrations(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "invalid_id" });
  }
  try {
    const result = await fetchAniListMediaById(id);
    if (!result.ok) {
      return res.status(result.error === "invalid_id" ? 400 : 502).json({ error: result.error });
    }
    const media = result.media
      ? {
          ...result.media,
          organization: deriveAniListMediaOrganization(result.media),
        }
      : null;
    return res.json({
      ...(result.data && typeof result.data === "object" ? result.data : {}),
      data: {
        ...(result.data?.data && typeof result.data.data === "object" ? result.data.data : {}),
        Media: media,
      },
    });
  } catch {
    return res.status(502).json({ error: "anilist_failed" });
  }
});

app.post("/api/uploads/image", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  const { dataUrl, filename, folder, slot, scopeUserId } = req.body || {};
  const safeFolder = sanitizeUploadFolder(folder);
  const uploadAccessScope = resolveRequestUploadAccessScope({
    sessionUser,
    folder: safeFolder,
    scopeUserId,
  });
  if (!uploadAccessScope.allowed) {
    return res.status(403).json({ error: "forbidden" });
  }
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!(await canUploadImage(ip))) {
    return res.status(429).json({ error: "rate_limited" });
  }

  if (!dataUrl || typeof dataUrl !== "string") {
    return res.status(400).json({ error: "data_url_required" });
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: "invalid_data_url" });
  }

  let mime = normalizeUploadMime(match[1]);
  if (!/^(image\/(png|jpe?g|gif|webp|svg\+xml))$/i.test(mime)) {
    return res.status(400).json({ error: "unsupported_image_type" });
  }
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    return res.status(400).json({ error: "empty_upload" });
  }
  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    return res.status(400).json({ error: "file_too_large" });
  }
  const validation = validateUploadImageBuffer(buffer, mime, { strictRequestedMime: true });
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  mime = validation.mime;
  if (mime === "image/svg+xml" && buffer.length > MAX_SVG_SIZE_BYTES) {
    return res.status(400).json({ error: "svg_too_large" });
  }
  const uploadsDir = path.join(__dirname, "..", "public", "uploads");
  const activeStorageProvider = uploadStorageService.activeProvider;
  const sourceBuffer =
    mime === "image/svg+xml" ? Buffer.from(sanitizeSvg(buffer.toString("utf-8")), "utf-8") : buffer;
  const hashSha256 = computeBufferSha256(sourceBuffer);
  const uploads = loadUploads();
  const dedupeEntry = findUploadByHash(
    uploads.filter((item) => shouldIncludeUploadInHashDedupe(item, uploadAccessScope)),
    hashSha256,
  );
  if (dedupeEntry) {
    const dedupeResolution = await ensureUploadEntryHasRequiredVariants({
      uploads,
      uploadsDir,
      entry: dedupeEntry,
      sourceMime: mime,
      hashSha256,
      requiredVariantPresetKeys: resolveUploadVariantPresetKeysForArea(safeFolder),
    });
    const resolvedDedupeEntry = dedupeResolution.entry;
    const dedupeFocalState = readUploadFocalState(resolvedDedupeEntry);
    appendAuditLog(req, "uploads.image", "uploads", {
      uploadId: resolvedDedupeEntry.id,
      fileName: resolvedDedupeEntry.fileName,
      folder: resolvedDedupeEntry.folder || "",
      url: resolvedDedupeEntry.url,
      hashSha256,
      dedupeHit: true,
      variantBytes: Number(resolvedDedupeEntry?.variantBytes || 0),
    });
    return res.json({
      uploadId: resolvedDedupeEntry.id,
      url: resolvedDedupeEntry.url,
      fileName: resolvedDedupeEntry.fileName,
      hashSha256,
      dedupeHit: true,
      focalCrops: dedupeFocalState.focalCrops,
      focalPoints: dedupeFocalState.focalPoints,
      focalPoint: dedupeFocalState.focalPoint,
      variants: normalizeVariants(resolvedDedupeEntry.variants),
      area: resolvedDedupeEntry.area || "",
      variantsGenerated: true,
    });
  }

  const ext = getUploadExtFromMime(mime);
  const safeName = sanitizeUploadBaseName(filename || "upload");
  const safeSlot = sanitizeUploadSlot(slot);
  const useSlotName = Boolean(safeSlot && isPrivateUploadFolder(safeFolder));
  const fileName = useSlotName
    ? `${safeSlot}.${ext}`
    : `${safeName || "imagem"}-${Date.now()}.${ext}`;
  const relativeUrl = `/uploads/${safeFolder ? `${safeFolder}/` : ""}${fileName}`;
  const existingIndex = uploads.findIndex((item) => item.url === relativeUrl);
  const existingEntry = existingIndex >= 0 ? uploads[existingIndex] : null;
  const requestedFocalPayload = extractRequestedUploadFocalPayload(req.body);
  const variantsVersion = Math.max(1, Number(existingEntry?.variantsVersion || 0) + 1);
  const uploadEntryBase = {
    id: existingEntry?.id || crypto.randomUUID(),
    url: relativeUrl,
    fileName,
    folder: safeFolder || "",
    size: sourceBuffer.length,
    mime,
    width: validation.dimensions?.width || null,
    height: validation.dimensions?.height || null,
    area: safeFolder ? String(safeFolder).split("/")[0] : "root",
    createdAt: new Date().toISOString(),
    altText: readUploadAltText(existingEntry),
    slot: safeSlot || readUploadSlot(existingEntry) || undefined,
    slotManaged: useSlotName ? true : readUploadSlotManaged(existingEntry),
    storageProvider: activeStorageProvider,
  };
  const requestedFocalState = resolveIncomingUploadFocalState(requestedFocalPayload, {
    ...(existingEntry || {}),
    ...uploadEntryBase,
  });
  let uploadEntry = uploadEntryBase;
  let variantsGenerated = true;
  let variantGenerationError = "";
  const stagingWorkspace = createUploadStagingWorkspace();
  try {
    const filePath = writeUploadBufferToStaging({
      uploadsDir: stagingWorkspace.uploadsDir,
      uploadUrl: relativeUrl,
      buffer: sourceBuffer,
    });
    uploadEntry = await attachUploadMediaMetadata({
      uploadsDir: stagingWorkspace.uploadsDir,
      entry: {
        ...uploadEntryBase,
        storageProvider: activeStorageProvider,
      },
      sourcePath: filePath,
      sourceMime: mime,
      hashSha256,
      focalCrops: hasOwnField(requestedFocalPayload, "focalCrops")
        ? requestedFocalState.focalCrops
        : undefined,
      focalPoints: requestedFocalState.focalPoints,
      variantsVersion,
      regenerateVariants: true,
    });
    await persistUploadEntryFromStaging({
      storageService: uploadStorageService,
      entry: uploadEntry,
      uploadsDir: stagingWorkspace.uploadsDir,
      provider: activeStorageProvider,
      cacheControl: STATIC_DEFAULT_CACHE_CONTROL,
    });
  } catch (error) {
    variantsGenerated = false;
    variantGenerationError = String(error?.message || "variant_generation_failed");
    appendAuditLog(req, "uploads.image.variant_generation_failed", "uploads", {
      uploadId: uploadEntryBase.id,
      url: relativeUrl,
      fileName,
      error: variantGenerationError,
    });
    uploadEntry = {
      ...uploadEntryBase,
      hashSha256,
      focalCrops: requestedFocalState.focalCrops,
      focalPoints: requestedFocalState.focalPoints,
      focalPoint: requestedFocalState.focalPoint,
      variantsVersion,
      variants: {},
      variantBytes: 0,
      area: safeFolder ? String(safeFolder).split("/")[0] : "root",
      storageProvider: activeStorageProvider,
    };
    try {
      await uploadStorageService.putUploadUrl({
        provider: activeStorageProvider,
        uploadUrl: relativeUrl,
        buffer: sourceBuffer,
        contentType: mime,
        cacheControl: STATIC_DEFAULT_CACHE_CONTROL,
      });
    } catch {
      return res.status(500).json({ error: "upload_persist_failed" });
    }
  } finally {
    cleanupUploadStagingWorkspace(stagingWorkspace);
  }

  if (
    existingEntry &&
    readUploadStorageProvider(existingEntry, "local") !== activeStorageProvider
  ) {
    void deleteManagedUploadEntryAssets(existingEntry).catch(() => undefined);
  }

  if (existingIndex >= 0) {
    uploads[existingIndex] = uploadEntry;
  } else {
    uploads.push(uploadEntry);
  }
  writeUploads(uploads);

  appendAuditLog(req, "uploads.image", "uploads", {
    uploadId: uploadEntry.id,
    fileName,
    folder: safeFolder || "",
    url: relativeUrl,
    hashSha256,
    dedupeHit: false,
    variantBytes: Number(uploadEntry?.variantBytes || 0),
  });
  const uploadFocalState = readUploadFocalState(uploadEntry);
  return res.json({
    uploadId: uploadEntry.id,
    url: relativeUrl,
    fileName,
    hashSha256,
    dedupeHit: false,
    focalCrops: uploadFocalState.focalCrops,
    focalPoints: uploadFocalState.focalPoints,
    focalPoint: uploadFocalState.focalPoint,
    variants: normalizeVariants(uploadEntry.variants),
    area: uploadEntry.area || "",
    variantsGenerated,
    ...(variantGenerationError ? { variantGenerationError } : {}),
  });
});

app.get("/api/uploads/list", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  const folder = typeof req.query.folder === "string" ? req.query.folder.trim() : "";
  const scopeUserId = normalizeUploadScopeUserId(req.query.scopeUserId);
  const listAll = folder === "__all__";
  const safeFolder = listAll ? "" : sanitizeUploadFolder(folder);
  const uploadAccessScope = resolveRequestUploadAccessScope({
    sessionUser,
    folder: safeFolder,
    listAll,
    scopeUserId,
  });
  if (!uploadAccessScope.allowed) {
    return res.status(403).json({ error: "forbidden" });
  }
  const uploadsDir = path.join(__dirname, "..", "public", "uploads");
  const recursive = String(req.query.recursive || "")
    .trim()
    .toLowerCase();
  const listRecursively =
    listAll || (Boolean(folder) && (recursive === "1" || recursive === "true"));
  try {
    const usedUrls = getUsedUploadUrls();
    const uploadMeta = loadUploads();
    const uploadMetaMap = new Map(
      uploadMeta
        .map((item) => [normalizeUploadUrl(item?.url), item])
        .filter(([key]) => Boolean(key)),
    );
    const matchesFolder = (resolvedFolder) => {
      const normalizedFolder = String(resolvedFolder || "").trim();
      if (listAll) {
        return true;
      }
      if (listRecursively) {
        if (!safeFolder) {
          return true;
        }
        return normalizedFolder === safeFolder || normalizedFolder.startsWith(`${safeFolder}/`);
      }
      return normalizedFolder === safeFolder;
    };
    const metadataFiles = uploadMeta
      .map((meta) => {
        const normalizedUrl = normalizeUploadUrl(meta?.url);
        if (!normalizedUrl) {
          return null;
        }
        const relative = normalizedUrl.replace(/^\/uploads\//, "");
        const resolvedFolder =
          meta?.folder ?? path.dirname(relative).replace(/\\/g, "/").replace(/^\.$/, "");
        if (
          !matchesFolder(resolvedFolder) ||
          !isUploadFolderAllowedInScope(resolvedFolder, uploadAccessScope)
        ) {
          return null;
        }
        const inUse = usedUrls.has(normalizedUrl);
        const focalState = readUploadFocalState(meta);
        return {
          id: meta?.id || null,
          name: meta?.fileName || path.basename(relative),
          url: normalizedUrl,
          source: "upload",
          folder: resolvedFolder,
          fileName: meta?.fileName || path.basename(relative),
          mime:
            meta?.mime ||
            getUploadMimeFromExtension(path.extname(path.basename(relative)).replace(".", "")),
          size: typeof meta?.size === "number" ? meta.size : null,
          createdAt: meta?.createdAt || null,
          width: typeof meta?.width === "number" ? meta.width : null,
          height: typeof meta?.height === "number" ? meta.height : null,
          hashSha256: typeof meta?.hashSha256 === "string" ? meta.hashSha256 : "",
          focalCrops: focalState.focalCrops,
          focalPoints: focalState.focalPoints,
          focalPoint: focalState.focalPoint,
          variantsVersion: Number.isFinite(Number(meta?.variantsVersion))
            ? Number(meta.variantsVersion)
            : 1,
          variants: normalizeVariants(meta?.variants),
          variantBytes: Number.isFinite(Number(meta?.variantBytes)) ? Number(meta.variantBytes) : 0,
          area:
            typeof meta?.area === "string" && meta.area
              ? meta.area
              : String((resolvedFolder || "").split("/")[0] || "root"),
          altText: readUploadAltText(meta),
          slot: readUploadSlot(meta) || undefined,
          slotManaged: readUploadSlotManaged(meta),
          storageProvider: readUploadStorageProvider(meta, "local"),
          inUse,
          canDelete: !inUse,
        };
      })
      .filter(Boolean);
    const seenUrls = new Set(metadataFiles.map((item) => String(item?.url || "")));
    const collectLooseLocalFiles = (dir, base) => {
      if (!fs.existsSync(dir)) {
        return [];
      }
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        const nextBase = path.join(base, entry.name);
        const normalizedBase = nextBase.split(path.sep).join("/");
        if (normalizedBase === "_variants" || normalizedBase.startsWith("_variants/")) {
          return [];
        }
        if (entry.isDirectory()) {
          if (!isUploadFolderAllowedInScope(normalizedBase, uploadAccessScope)) {
            return [];
          }
          return collectLooseLocalFiles(fullPath, nextBase);
        }
        if (!/\.(png|jpe?g|gif|webp|svg(\+xml)?)$/i.test(entry.name)) {
          return [];
        }
        const relative = normalizedBase;
        const url = `/uploads/${relative}`;
        const normalizedUrl = normalizeUploadUrl(url) || url;
        if (seenUrls.has(normalizedUrl) || uploadMetaMap.has(normalizedUrl)) {
          return [];
        }
        const resolvedFolder = path.dirname(relative).replace(/\\/g, "/").replace(/^\.$/, "");
        if (
          !matchesFolder(resolvedFolder) ||
          !isUploadFolderAllowedInScope(resolvedFolder, uploadAccessScope)
        ) {
          return [];
        }
        const stat = fs.statSync(fullPath);
        const inUse = usedUrls.has(normalizedUrl);
        return [
          {
            id: null,
            name: entry.name,
            url: normalizedUrl,
            source: "upload",
            folder: resolvedFolder,
            fileName: entry.name,
            mime: getUploadMimeFromExtension(path.extname(entry.name).replace(".", "")),
            size: stat.size,
            createdAt: stat.mtime.toISOString(),
            width: null,
            height: null,
            hashSha256: "",
            focalCrops: undefined,
            focalPoints: undefined,
            focalPoint: undefined,
            variantsVersion: 1,
            variants: {},
            variantBytes: 0,
            area: String((resolvedFolder || "").split("/")[0] || "root"),
            altText: "",
            slot: undefined,
            slotManaged: false,
            storageProvider: "local",
            inUse,
            canDelete: !inUse,
          },
        ];
      });
    };
    const looseLocalFiles = collectLooseLocalFiles(uploadsDir, "");
    const files = [...metadataFiles, ...looseLocalFiles].sort((left, right) =>
      String(left.url || "").localeCompare(String(right.url || ""), "en"),
    );
    return res.json({ files });
  } catch {
    return res.json({ files: [] });
  }
});

app.patch("/api/uploads/:id/focal-point", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const uploadId = String(req.params?.id || "").trim();
  if (!uploadId) {
    return res.status(400).json({ error: "invalid_upload_id" });
  }
  const uploads = loadUploads();
  const targetIndex = uploads.findIndex((item) => String(item?.id || "") === uploadId);
  if (targetIndex < 0) {
    return res.status(404).json({ error: "upload_not_found" });
  }
  const current = uploads[targetIndex];
  const uploadsDir = path.join(__dirname, "..", "public", "uploads");
  const currentProvider = readUploadStorageProvider(current, "local");
  const stagingWorkspace = createUploadStagingWorkspace();
  let sourcePath = "";
  let sourceBuffer = null;
  try {
    if (currentProvider === "local") {
      const localSourcePath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl: current?.url });
      if (!localSourcePath || !fs.existsSync(localSourcePath)) {
        cleanupUploadStagingWorkspace(stagingWorkspace);
        return res.status(404).json({ error: "upload_file_not_found" });
      }
      sourceBuffer = fs.readFileSync(localSourcePath);
      sourcePath = writeUploadBufferToStaging({
        uploadsDir: stagingWorkspace.uploadsDir,
        uploadUrl: current?.url,
        buffer: sourceBuffer,
      });
    } else {
      const materialized = await materializeUploadEntrySourceToStaging({
        storageService: uploadStorageService,
        entry: current,
        uploadsDir: stagingWorkspace.uploadsDir,
      });
      sourceBuffer = materialized.buffer;
      sourcePath = materialized.sourcePath;
    }
  } catch {
    cleanupUploadStagingWorkspace(stagingWorkspace);
    return res.status(404).json({ error: "upload_file_not_found" });
  }
  let hashSha256 = String(current?.hashSha256 || "")
    .trim()
    .toLowerCase();
  if (!hashSha256) {
    try {
      hashSha256 = computeBufferSha256(sourceBuffer);
    } catch {
      cleanupUploadStagingWorkspace(stagingWorkspace);
      return res.status(500).json({ error: "upload_file_read_failed" });
    }
  }
  const requestedFocalPayload = extractRequestedUploadFocalPayload(req.body);
  if (
    !hasOwnField(requestedFocalPayload, "focalCrops") &&
    !hasOwnField(requestedFocalPayload, "focalPoints") &&
    !hasOwnField(requestedFocalPayload, "focalPoint")
  ) {
    return res.status(400).json({ error: "invalid_focal_point" });
  }
  const nextFocalState = resolveIncomingUploadFocalState(requestedFocalPayload, current);
  const nextVersion = Math.max(1, Number(current?.variantsVersion || 0) + 1);
  let updated = null;
  try {
    updated = await attachUploadMediaMetadata({
      uploadsDir: stagingWorkspace.uploadsDir,
      entry: {
        ...current,
        storageProvider: currentProvider,
      },
      sourcePath,
      sourceMime: current?.mime,
      hashSha256,
      focalCrops: hasOwnField(requestedFocalPayload, "focalCrops")
        ? nextFocalState.focalCrops
        : undefined,
      focalPoints: nextFocalState.focalPoints,
      variantsVersion: nextVersion,
      regenerateVariants: true,
    });
    await persistUploadEntryFromStaging({
      storageService: uploadStorageService,
      entry: updated,
      uploadsDir: stagingWorkspace.uploadsDir,
      provider: currentProvider,
      cacheControl: STATIC_DEFAULT_CACHE_CONTROL,
    });
  } catch {
    cleanupUploadStagingWorkspace(stagingWorkspace);
    return res.status(500).json({ error: "focal_point_update_failed" });
  }
  cleanupUploadStagingWorkspace(stagingWorkspace);

  uploads[targetIndex] = updated;
  writeUploads(uploads);
  appendAuditLog(req, "uploads.focal_point.update", "uploads", {
    id: uploadId,
    url: updated.url,
    focalPresets: Object.keys(nextFocalState.focalPoints),
  });

  return res.json({
    ok: true,
    item: {
      id: updated.id,
      url: updated.url,
      fileName: updated.fileName,
      folder: updated.folder,
      mime: updated.mime,
      size: updated.size,
      width: updated.width,
      height: updated.height,
      hashSha256: updated.hashSha256 || "",
      focalCrops: updated.focalCrops || nextFocalState.focalCrops,
      focalPoints: updated.focalPoints || nextFocalState.focalPoints,
      focalPoint: updated.focalPoint || nextFocalState.focalPoint,
      variantsVersion: Number.isFinite(Number(updated.variantsVersion))
        ? Number(updated.variantsVersion)
        : 1,
      variants: normalizeVariants(updated.variants),
      variantBytes: Number.isFinite(Number(updated.variantBytes))
        ? Number(updated.variantBytes)
        : 0,
      area: updated.area || "",
      altText: readUploadAltText(updated),
      createdAt: updated.createdAt || null,
    },
  });
});

app.patch("/api/uploads/:id/alt-text", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const uploadId = String(req.params?.id || "").trim();
  if (!uploadId) {
    return res.status(400).json({ error: "invalid_upload_id" });
  }
  const uploads = loadUploads();
  const targetIndex = uploads.findIndex((item) => String(item?.id || "") === uploadId);
  if (targetIndex < 0) {
    return res.status(404).json({ error: "upload_not_found" });
  }
  const current = uploads[targetIndex];
  const nextAltText = String(req.body?.altText || "").trim();
  const updated = {
    ...current,
    altText: nextAltText,
  };
  uploads[targetIndex] = updated;
  writeUploads(uploads);
  appendAuditLog(req, "uploads.alt_text.update", "uploads", {
    uploadId,
    altTextLength: nextAltText.length,
  });
  return res.json({
    ok: true,
    item: {
      id: updated.id,
      url: updated.url,
      fileName: updated.fileName,
      folder: updated.folder,
      altText: readUploadAltText(updated),
      createdAt: updated.createdAt || null,
    },
  });
});

app.get("/api/uploads/storage/areas", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const summary = buildManagedStorageAreaSummary(loadUploads());
  return res.json(summary);
});

app.get("/api/uploads/storage/cleanup", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const report = await loadCachedUploadsCleanupPreview(async () =>
    runUploadsCleanup({
      datasets: loadUploadsCleanupDatasets(),
      uploadsDir: path.join(__dirname, "..", "public", "uploads"),
      applyChanges: false,
      exampleLimit: 8,
      storageService: uploadStorageService,
    }),
  );

  return res.json({
    generatedAt: report.generatedAt,
    unusedCount: report.unusedCount,
    unusedUploadCount: report.unusedUploadCount,
    orphanedVariantFilesCount: report.orphanedVariantFilesCount,
    orphanedVariantDirsCount: report.orphanedVariantDirsCount,
    looseOriginalFilesCount: report.looseOriginalFilesCount,
    looseOriginalTotals: report.looseOriginalTotals,
    quarantinePendingDeleteCount: report.quarantinePendingDeleteCount,
    quarantinePendingDeleteTotals: report.quarantinePendingDeleteTotals,
    totals: report.totals,
    areas: report.areas,
    examples: report.examples,
  });
});

app.post("/api/uploads/storage/cleanup", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  if (String(req.body?.confirm || "").trim() !== "EXCLUIR") {
    return res.status(400).json({ error: "confirm_required" });
  }

  try {
    invalidateUploadsCleanupPreviewCache();
    const report = await runUploadsCleanup({
      datasets: loadUploadsCleanupDatasets(),
      uploadsDir: path.join(__dirname, "..", "public", "uploads"),
      applyChanges: true,
      exampleLimit: 8,
      storageService: uploadStorageService,
    });

    if (report.changed) {
      writeUploads(report.rewritten.uploads);
    }

    appendAuditLog(req, "uploads.cleanup_unused", "uploads", {
      deletedCount: report.deletedCount,
      deletedUnusedUploadsCount: report.deletedUnusedUploadsCount,
      deletedOrphanedVariantFilesCount: report.deletedOrphanedVariantFilesCount,
      deletedOrphanedVariantDirsCount: report.deletedOrphanedVariantDirsCount,
      quarantinedLooseOriginalFilesCount: report.quarantinedLooseOriginalFilesCount,
      deletedQuarantineFilesCount: report.deletedQuarantineFilesCount,
      deletedQuarantineDirsCount: report.deletedQuarantineDirsCount,
      failedCount: report.failedCount,
      freedBytes: Number(report.deletedTotals?.totalBytes || 0),
      quarantinedBytes: Number(report.quarantinedTotals?.totalBytes || 0),
      purgedQuarantineBytes: Number(report.purgedQuarantineTotals?.totalBytes || 0),
      failures: report.failures,
    });
    invalidateUploadsCleanupPreviewCache();

    return res.json({
      ok: report.failedCount === 0,
      deletedCount: report.deletedCount,
      deletedUnusedUploadsCount: report.deletedUnusedUploadsCount,
      deletedOrphanedVariantFilesCount: report.deletedOrphanedVariantFilesCount,
      deletedOrphanedVariantDirsCount: report.deletedOrphanedVariantDirsCount,
      quarantinedLooseOriginalFilesCount: report.quarantinedLooseOriginalFilesCount,
      deletedQuarantineFilesCount: report.deletedQuarantineFilesCount,
      deletedQuarantineDirsCount: report.deletedQuarantineDirsCount,
      failedCount: report.failedCount,
      deletedTotals: report.deletedTotals,
      quarantinedTotals: report.quarantinedTotals,
      purgedQuarantineTotals: report.purgedQuarantineTotals,
      failures: report.failures,
    });
  } catch {
    return res.status(500).json({ error: "cleanup_failed" });
  }
});

const sanitizeProjectFolderSegment = (value) =>
  String(createSlug(String(value || "").trim()) || "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const resolveProjectLibraryFolders = (project) => {
  const normalizedId = String(project?.id || "").trim();
  const normalizedSlug = sanitizeProjectFolderSegment(project?.title || "");
  const projectKey = normalizedId || normalizedSlug || "draft";
  const projectRootFolder = `projects/${projectKey}`;
  return {
    projectRootFolder,
    projectEpisodesFolder: `${projectRootFolder}/episodes`,
    projectRelationsFolder: `${projectRootFolder}/relations`,
    projectVolumeCoversFolder: `${projectRootFolder}/volumes`,
    projectChaptersFolder: `${projectRootFolder}/capitulos`,
  };
};

const resolveVolumeFolderSegment = (volume) => {
  const normalizedVolume = Number.isFinite(Number(volume)) ? Number(volume) : null;
  return normalizedVolume === null ? "volume-sem-volume" : `volume-${normalizedVolume}`;
};

const resolveEpisodeCoverFolder = ({ project, episode, index, folders }) => {
  if (!isChapterBasedType(project?.type || "")) {
    return folders.projectEpisodesFolder;
  }
  const chapterNumber = Number.isFinite(Number(episode?.number))
    ? Number(episode.number)
    : index + 1;
  const safeChapterNumber =
    Number.isFinite(chapterNumber) && chapterNumber > 0 ? Math.floor(chapterNumber) : index + 1;
  const volumeSegment = resolveVolumeFolderSegment(episode?.volume);
  return `${folders.projectChaptersFolder}/${volumeSegment}/capitulo-${safeChapterNumber}`;
};

const collectProjectImageItems = (projects) => {
  const dedupe = new Set();
  const items = [];

  const push = (project, url, kind, label, folder = "") => {
    const normalizedUrl = normalizeUploadUrl(url) || String(url || "").trim();
    if (!normalizedUrl) {
      return;
    }
    const projectKey =
      String(project?.id || "").trim() || String(project?.title || "").trim() || "__draft__";
    const dedupeKey = `${projectKey}\u0001${normalizedUrl}`;
    if (dedupe.has(dedupeKey)) {
      return;
    }
    dedupe.add(dedupeKey);
    const resolvedFolder = String(
      folder || getUploadFolderFromUrlValue(normalizedUrl) || "",
    ).trim();
    items.push({
      source: "project",
      url: normalizedUrl,
      label,
      projectId: project.id,
      projectTitle: project.title,
      kind,
      folder: resolvedFolder,
    });
  };

  const pushFromText = (project, value, kind, label, folder = "") => {
    extractUploadPathsFromText(value).forEach((uploadUrl) => {
      push(project, uploadUrl, kind, label, folder);
    });
  };

  projects.forEach((project) => {
    const folders = resolveProjectLibraryFolders(project);
    push(project, project.cover, "cover", `${project.title} (Capa)`, folders.projectRootFolder);
    push(project, project.banner, "banner", `${project.title} (Banner)`, folders.projectRootFolder);
    push(
      project,
      project.heroImageUrl,
      "hero",
      `${project.title} (Carrossel)`,
      folders.projectRootFolder,
    );

    const volumeEntries =
      Array.isArray(project.volumeEntries) && project.volumeEntries.length > 0
        ? project.volumeEntries
        : Array.isArray(project.volumeCovers)
          ? project.volumeCovers
          : [];
    volumeEntries.forEach((cover) => {
      const suffix =
        typeof cover?.volume === "number" && Number.isFinite(cover.volume)
          ? `Volume ${cover.volume}`
          : "Sem volume";
      const volumeFolder = `${folders.projectVolumeCoversFolder}/${resolveVolumeFolderSegment(
        cover?.volume,
      )}`;
      push(
        project,
        cover?.coverImageUrl,
        "volume-cover",
        `${project.title} (${suffix})`,
        volumeFolder,
      );
    });

    (Array.isArray(project.relations) ? project.relations : []).forEach((relation, index) => {
      const relationLabel = relation?.title
        ? `${project.title} (Relacao: ${relation.title})`
        : `${project.title} (Relacao ${index + 1})`;
      push(project, relation?.image, "relation", relationLabel, folders.projectRelationsFolder);
    });

    pushFromText(
      project,
      project.description,
      "description-content",
      `${project.title} (Descricao)`,
      folders.projectRootFolder,
    );
    pushFromText(
      project,
      project.synopsis,
      "synopsis-content",
      `${project.title} (Sinopse)`,
      folders.projectRootFolder,
    );

    (Array.isArray(project.episodeDownloads) ? project.episodeDownloads : []).forEach(
      (episode, index) => {
        const suffix = episode?.number ? `Cap/Ep ${episode.number}` : `Cap/Ep ${index + 1}`;
        const episodeFolder = resolveEpisodeCoverFolder({ project, episode, index, folders });
        push(
          project,
          episode?.coverImageUrl,
          "episode-cover",
          `${project.title} (${suffix})`,
          episodeFolder,
        );
        const episodeLabel = String(episode?.title || "").trim();
        const episodeContext = episodeLabel
          ? `${project.title} (${episodeLabel})`
          : `${project.title} (${suffix})`;
        pushFromText(
          project,
          episode?.content,
          "episode-content",
          `${episodeContext} (Conteudo)`,
          episodeFolder,
        );
      },
    );
  });

  return items;
};
app.get("/api/uploads/project-images", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const projects = normalizeProjects(loadProjects());
  return res.json({ items: collectProjectImageItems(projects) });
});

app.post("/api/uploads/image-from-url", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  const safeFolder = sanitizeUploadFolder(req.body?.folder || "");
  const uploadAccessScope = resolveRequestUploadAccessScope({
    sessionUser,
    folder: safeFolder,
    scopeUserId: req.body?.scopeUserId,
  });
  if (!uploadAccessScope.allowed) {
    return res.status(403).json({ error: "forbidden" });
  }
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!(await canUploadImage(ip))) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const remoteUrl = String(req.body?.url || "").trim();
  const uploadsDir = path.join(__dirname, "..", "public", "uploads");
  const activeStorageProvider = uploadStorageService.activeProvider;
  const stagingWorkspace = createUploadStagingWorkspace();
  const importResult = await importRemoteImageFile({
    remoteUrl,
    folder: safeFolder,
    uploadsDir: stagingWorkspace.uploadsDir,
    timeoutMs: 20_000,
  });
  if (!importResult.ok) {
    cleanupUploadStagingWorkspace(stagingWorkspace);
    const code = String(importResult.error?.code || "fetch_failed");
    if (code === "url_required") {
      return res.status(400).json({ error: "url_required" });
    }
    if (code === "invalid_url" || code === "invalid_url_credentials") {
      return res.status(400).json({ error: "invalid_url" });
    }
    if (code === "host_not_allowed") {
      return res.status(400).json({ error: "host_not_allowed" });
    }
    if (code === "redirect_not_allowed") {
      return res.status(400).json({ error: "redirect_not_allowed" });
    }
    const fetchLikeErrors = new Set(["fetch_failed", "fetch_unavailable"]);
    if (fetchLikeErrors.has(code)) {
      return res.status(502).json({ error: "fetch_failed" });
    }
    return res.status(400).json({ error: code });
  }
  const entry = importResult.entry;
  const requestedFocalPayload = extractRequestedUploadFocalPayload(req.body);
  const requestedFocalState = resolveIncomingUploadFocalState(requestedFocalPayload, entry);
  const sourcePath = resolveUploadAbsolutePath({
    uploadsDir: stagingWorkspace.uploadsDir,
    uploadUrl: entry?.url,
  });
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    cleanupUploadStagingWorkspace(stagingWorkspace);
    return res.status(500).json({ error: "imported_file_not_found" });
  }

  let hashSha256 = "";
  try {
    const importedBuffer = fs.readFileSync(sourcePath);
    hashSha256 = computeBufferSha256(importedBuffer);
  } catch {
    cleanupUploadStagingWorkspace(stagingWorkspace);
    return res.status(500).json({ error: "imported_file_read_failed" });
  }

  const uploads = loadUploads();
  const dedupeEntry = (Array.isArray(uploads) ? uploads : []).find(
    (item) =>
      shouldIncludeUploadInHashDedupe(item, uploadAccessScope) &&
      String(item?.url || "") !== String(entry?.url || "") &&
      String(item?.hashSha256 || "")
        .trim()
        .toLowerCase() === hashSha256,
  );
  if (dedupeEntry) {
    const dedupeResolution = await ensureUploadEntryHasRequiredVariants({
      uploads,
      uploadsDir,
      entry: dedupeEntry,
      sourceMime: entry?.mime,
      hashSha256,
      requiredVariantPresetKeys: resolveUploadVariantPresetKeysForArea(safeFolder),
    });
    const resolvedDedupeEntry = dedupeResolution.entry;
    const dedupeFocalState = readUploadFocalState(resolvedDedupeEntry);
    cleanupUploadStagingWorkspace(stagingWorkspace);
    appendAuditLog(req, "uploads.image_from_url", "uploads", {
      uploadId: resolvedDedupeEntry.id,
      url: resolvedDedupeEntry.url,
      remoteUrl,
      folder: resolvedDedupeEntry.folder || "",
      hashSha256,
      dedupeHit: true,
      variantBytes: Number(resolvedDedupeEntry?.variantBytes || 0),
    });
    return res.json({
      uploadId: resolvedDedupeEntry.id,
      url: resolvedDedupeEntry.url,
      fileName: resolvedDedupeEntry.fileName,
      hashSha256,
      dedupeHit: true,
      focalCrops: dedupeFocalState.focalCrops,
      focalPoints: dedupeFocalState.focalPoints,
      focalPoint: dedupeFocalState.focalPoint,
      variants: normalizeVariants(resolvedDedupeEntry.variants),
      area: resolvedDedupeEntry.area || "",
      variantsGenerated: true,
    });
  }

  let enrichedEntry = entry;
  let variantsGenerated = true;
  let variantGenerationError = "";
  try {
    enrichedEntry = await attachUploadMediaMetadata({
      uploadsDir: stagingWorkspace.uploadsDir,
      entry: {
        ...entry,
        area: String(String(entry?.folder || "").split("/")[0] || "root"),
        storageProvider: activeStorageProvider,
      },
      sourcePath,
      sourceMime: entry?.mime,
      hashSha256,
      focalCrops: hasOwnField(requestedFocalPayload, "focalCrops")
        ? requestedFocalState.focalCrops
        : undefined,
      focalPoints: requestedFocalState.focalPoints,
      variantsVersion: Math.max(1, Number(entry?.variantsVersion || 1)),
      regenerateVariants: true,
    });
    await persistUploadEntryFromStaging({
      storageService: uploadStorageService,
      entry: enrichedEntry,
      uploadsDir: stagingWorkspace.uploadsDir,
      provider: activeStorageProvider,
      cacheControl: STATIC_DEFAULT_CACHE_CONTROL,
    });
  } catch (error) {
    variantsGenerated = false;
    variantGenerationError = String(error?.message || "variant_generation_failed");
    appendAuditLog(req, "uploads.image_from_url.variant_generation_failed", "uploads", {
      uploadId: entry?.id || null,
      url: entry?.url || null,
      remoteUrl,
      error: variantGenerationError,
    });
    enrichedEntry = {
      ...entry,
      hashSha256,
      focalCrops: requestedFocalState.focalCrops,
      focalPoints: requestedFocalState.focalPoints,
      focalPoint: requestedFocalState.focalPoint,
      variantsVersion: 1,
      variants: {},
      variantBytes: 0,
      area: String(String(entry?.folder || "").split("/")[0] || "root"),
      storageProvider: activeStorageProvider,
    };
    try {
      const originalBuffer = fs.readFileSync(sourcePath);
      await uploadStorageService.putUploadUrl({
        provider: activeStorageProvider,
        uploadUrl: enrichedEntry.url,
        buffer: originalBuffer,
        contentType: enrichedEntry.mime,
        cacheControl: STATIC_DEFAULT_CACHE_CONTROL,
      });
    } catch {
      cleanupUploadStagingWorkspace(stagingWorkspace);
      return res.status(500).json({ error: "upload_persist_failed" });
    }
  }
  cleanupUploadStagingWorkspace(stagingWorkspace);

  upsertUploadEntries([enrichedEntry]);
  appendAuditLog(req, "uploads.image_from_url", "uploads", {
    uploadId: enrichedEntry.id,
    url: enrichedEntry.url,
    remoteUrl,
    folder: enrichedEntry.folder || "",
    hashSha256,
    dedupeHit: false,
    variantBytes: Number(enrichedEntry?.variantBytes || 0),
  });
  const enrichedFocalState = readUploadFocalState(enrichedEntry);
  return res.json({
    uploadId: enrichedEntry.id,
    url: enrichedEntry.url,
    fileName: enrichedEntry.fileName,
    hashSha256,
    dedupeHit: false,
    focalCrops: enrichedFocalState.focalCrops,
    focalPoints: enrichedFocalState.focalPoints,
    focalPoint: enrichedFocalState.focalPoint,
    variants: normalizeVariants(enrichedEntry.variants),
    area: enrichedEntry.area || "",
    variantsGenerated,
    ...(variantGenerationError ? { variantGenerationError } : {}),
  });
});

const toUploadPath = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }
  if (value.startsWith("/uploads/")) {
    return value.split("?")[0].split("#")[0];
  }
  try {
    const parsed = new URL(value, PRIMARY_APP_ORIGIN);
    if (parsed.pathname && parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // ignore
  }
  return null;
};

const extractUploadPathsFromText = (value) => {
  if (!value || typeof value !== "string") {
    return [];
  }
  if (!value.includes("/uploads/")) {
    return [];
  }
  const matches = new Set();
  const absolutePattern = /https?:\/\/[^\s"'()<>]+/gi;
  const relativePattern = /\/uploads\/[^\s"'()<>]+/gi;
  const absoluteMatches = value.match(absolutePattern) || [];
  absoluteMatches.forEach((match) => {
    const normalized = toUploadPath(match);
    if (normalized) {
      matches.add(normalized);
    }
  });
  const relativeMatches = value.match(relativePattern) || [];
  relativeMatches.forEach((match) => {
    const normalized = toUploadPath(match);
    if (normalized) {
      matches.add(normalized);
    }
  });
  return Array.from(matches);
};

const normalizeUploadUrl = (value) => {
  if (!value || typeof value !== "string") return null;
  const direct = toUploadPath(value);
  if (direct) {
    return direct;
  }
  const extracted = extractUploadPathsFromText(value);
  return extracted[0] || null;
};

const collectUploadUrls = (value, urls) => {
  if (!value) return;
  if (typeof value === "string") {
    extractUploadPathsFromText(value).forEach((item) => urls.add(item));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUploadUrls(item, urls));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectUploadUrls(item, urls));
  }
};

const getUsedUploadUrls = () => {
  const urls = new Set();
  collectUploadUrls(loadSiteSettings(), urls);
  collectUploadUrls(loadPosts(), urls);
  collectUploadUrls(loadProjects(), urls);
  collectUploadUrls(loadUsers(), urls);
  collectUploadUrls(loadPages(), urls);
  collectUploadUrls(loadComments(), urls);
  collectUploadUrls(loadUpdates(), urls);
  collectUploadUrls(loadLinkTypes(), urls);
  return urls;
};

const loadUploadsCleanupDatasets = () => ({
  siteSettings: loadSiteSettings(),
  posts: loadPosts(),
  projects: loadProjects(),
  users: loadUsers(),
  pages: loadPages(),
  comments: loadComments(),
  updates: loadUpdates(),
  linkTypes: loadLinkTypes(),
  uploads: loadUploads(),
});

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceUploadReferencesInText = (value, oldUrl, newUrl) => {
  if (!value || typeof value !== "string") {
    return { value, count: 0 };
  }
  let next = value;
  let count = 0;
  const directRegex = new RegExp(escapeRegExp(oldUrl), "g");
  const directMatches = next.match(directRegex);
  if (directMatches?.length) {
    count += directMatches.length;
    next = next.replace(directRegex, newUrl);
  }
  const absolutePattern = /https?:\/\/[^\s"'()<>]+/gi;
  next = next.replace(absolutePattern, (match) => {
    const normalized = toUploadPath(match);
    if (normalized !== oldUrl) {
      return match;
    }
    count += 1;
    try {
      const parsed = new URL(match);
      parsed.pathname = newUrl;
      return parsed.toString();
    } catch {
      return match.replace(oldUrl, newUrl);
    }
  });
  return { value: next, count };
};

const replaceUploadReferencesDeep = (value, oldUrl, newUrl) => {
  if (typeof value === "string") {
    return replaceUploadReferencesInText(value, oldUrl, newUrl);
  }
  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((item) => {
      const result = replaceUploadReferencesDeep(item, oldUrl, newUrl);
      count += result.count;
      return result.value;
    });
    return { value: next, count };
  }
  if (value && typeof value === "object") {
    let count = 0;
    const next = { ...value };
    Object.keys(next).forEach((key) => {
      const result = replaceUploadReferencesDeep(next[key], oldUrl, newUrl);
      count += result.count;
      next[key] = result.value;
    });
    return { value: next, count };
  }
  return { value, count: 0 };
};

app.put("/api/uploads/rename", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const normalized = normalizeUploadUrl(req.body?.url);
  const requestedName = String(req.body?.newName || "").trim();
  if (!normalized) {
    return res.status(400).json({ error: "invalid_url" });
  }
  if (!requestedName) {
    return res.status(400).json({ error: "invalid_name" });
  }

  try {
    const parsed = new URL(normalized, PRIMARY_APP_ORIGIN);
    const pathname = decodeURIComponent(parsed.pathname || "");
    if (!pathname.startsWith("/uploads/")) {
      return res.status(400).json({ error: "invalid_path" });
    }
    const relativePath = pathname.replace(/^\/uploads\//, "");
    const oldFileName = path.basename(relativePath);
    const oldExt = path.extname(oldFileName).replace(".", "").toLowerCase();
    const oldFolder = path.dirname(relativePath).replace(/\\/g, "/").replace(/^\.$/, "");
    const safeBaseName = sanitizeUploadBaseName(requestedName);
    if (!safeBaseName) {
      return res.status(400).json({ error: "invalid_name" });
    }
    const nextFileName = `${safeBaseName}.${oldExt || "png"}`;
    if (nextFileName === oldFileName) {
      return res.json({ ok: true, oldUrl: normalized, newUrl: normalized, updatedReferences: 0 });
    }

    const nextRelativePath = `${oldFolder ? `${oldFolder}/` : ""}${nextFileName}`;
    const nextUrl = `/uploads/${nextRelativePath}`;
    const uploads = loadUploads();
    const currentEntry = uploads.find((item) => item.url === normalized) || null;
    const provider = readUploadStorageProvider(currentEntry, "local");
    const sourceHead = await uploadStorageService.headUpload({
      provider,
      uploadUrl: normalized,
    });
    if (!sourceHead?.exists) {
      return res.status(404).json({ error: "not_found" });
    }
    const targetHead = await uploadStorageService.headUpload({
      provider,
      uploadUrl: nextUrl,
    });
    if (targetHead?.exists) {
      return res.status(409).json({ error: "name_conflict" });
    }
    await uploadStorageService.copyUpload({
      provider,
      sourceUrl: normalized,
      targetUrl: nextUrl,
    });
    await uploadStorageService.deleteUpload({
      provider,
      uploadUrl: normalized,
    });
    const uploadsNext = uploads.map((item) =>
      item.url === normalized
        ? {
            ...item,
            url: nextUrl,
            fileName: nextFileName,
            folder: oldFolder,
            area: String((oldFolder || "").split("/")[0] || "root"),
            storageProvider: provider,
          }
        : item,
    );
    writeUploads(uploadsNext);

    const replacements = [];
    const pushResult = (key, result) => {
      if (result.count > 0) {
        replacements.push(`${key}:${result.count}`);
      }
    };

    const settingsResult = replaceUploadReferencesDeep(loadSiteSettings(), normalized, nextUrl);
    pushResult("settings", settingsResult);
    if (settingsResult.count > 0) {
      writeSiteSettings(settingsResult.value);
    }

    const postsResult = replaceUploadReferencesDeep(loadPosts(), normalized, nextUrl);
    pushResult("posts", postsResult);
    if (postsResult.count > 0) {
      writePosts(postsResult.value);
    }

    const projectsResult = replaceUploadReferencesDeep(loadProjects(), normalized, nextUrl);
    pushResult("projects", projectsResult);
    if (projectsResult.count > 0) {
      writeProjects(projectsResult.value);
    }

    const usersResult = replaceUploadReferencesDeep(loadUsers(), normalized, nextUrl);
    pushResult("users", usersResult);
    if (usersResult.count > 0) {
      writeUsers(usersResult.value);
    }

    const pagesResult = replaceUploadReferencesDeep(loadPages(), normalized, nextUrl);
    pushResult("pages", pagesResult);
    if (pagesResult.count > 0) {
      writePages(pagesResult.value);
    }

    const commentsResult = replaceUploadReferencesDeep(loadComments(), normalized, nextUrl);
    pushResult("comments", commentsResult);
    if (commentsResult.count > 0) {
      writeComments(commentsResult.value);
    }

    const updatesResult = replaceUploadReferencesDeep(loadUpdates(), normalized, nextUrl);
    pushResult("updates", updatesResult);
    if (updatesResult.count > 0) {
      writeUpdates(updatesResult.value);
    }

    const linkTypesResult = replaceUploadReferencesDeep(loadLinkTypes(), normalized, nextUrl);
    pushResult("link_types", linkTypesResult);
    if (linkTypesResult.count > 0) {
      writeLinkTypes(linkTypesResult.value);
    }

    const updatedReferences = [
      settingsResult.count,
      postsResult.count,
      projectsResult.count,
      usersResult.count,
      pagesResult.count,
      commentsResult.count,
      updatesResult.count,
      linkTypesResult.count,
    ].reduce((sum, value) => sum + value, 0);

    appendAuditLog(req, "uploads.rename", "uploads", {
      oldUrl: normalized,
      newUrl: nextUrl,
      updatedReferences,
      replacements,
    });

    return res.json({
      ok: true,
      oldUrl: normalized,
      newUrl: nextUrl,
      updatedReferences,
    });
  } catch {
    return res.status(500).json({ error: "rename_failed" });
  }
});

app.delete("/api/uploads/delete", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const { url } = req.body || {};
  const normalized = normalizeUploadUrl(url);
  if (!normalized) {
    return res.status(400).json({ error: "invalid_url" });
  }

  const usedUrls = getUsedUploadUrls();
  if (usedUrls.has(normalized)) {
    return res.status(409).json({ error: "in_use" });
  }

  try {
    const parsed = new URL(normalized, PRIMARY_APP_ORIGIN);
    const pathname = decodeURIComponent(parsed.pathname || "");
    if (!pathname.startsWith("/uploads/")) {
      return res.status(400).json({ error: "invalid_path" });
    }
    const uploads = loadUploads();
    const targetEntry = uploads.find((item) => item.url === normalized) || null;
    const provider = readUploadStorageProvider(targetEntry, "local");
    await uploadStorageService.deleteUpload({
      provider,
      uploadUrl: normalized,
    });
    const nextUploads = uploads.filter((item) => item.url !== normalized);
    if (nextUploads.length !== uploads.length) {
      writeUploads(nextUploads);
    }
    const variantPrefix = getUploadVariantUrlPrefix(targetEntry);
    if (variantPrefix) {
      try {
        await uploadStorageService.deleteUploadPrefix({
          provider,
          uploadUrlPrefix: variantPrefix,
        });
      } catch {
        // ignore variant cleanup failure
      }
    }
    appendAuditLog(req, "uploads.delete", "uploads", { url: normalized });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "delete_failed" });
  }
});

app.post("/api/users", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  const {
    id,
    name,
    phrase,
    bio,
    avatarUrl,
    avatarDisplay,
    socials,
    favoriteWorks,
    status,
    permissions,
    roles,
    accessRole,
  } = req.body || {};
  if (!id || !name) {
    return res.status(400).json({ error: "id_and_name_required" });
  }

  if (!isRbacV2Enabled) {
    if (!isOwner(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    let users = normalizeUsers(loadUsers());
    if (users.some((user) => user.id === String(id))) {
      return res.status(409).json({ error: "user_exists" });
    }

    const newUser = {
      id: String(id),
      name,
      phrase: phrase || "",
      bio: bio || "",
      avatarUrl: avatarUrl || null,
      avatarDisplay: normalizeAvatarDisplay(avatarDisplay),
      socials: sanitizeSocials(socials),
      favoriteWorks: sanitizeFavoriteWorksByCategory(favoriteWorks),
      status: status === "retired" ? "retired" : "active",
      permissions: Array.isArray(permissions) ? permissions : [],
      roles: Array.isArray(roles) ? roles.filter(Boolean) : [],
      order: users.length,
    };

    users.push(newUser);
    users = normalizeUsers(users).map((user) =>
      isOwner(user.id) ? { ...user, status: "active", permissions: ["*"] } : user,
    );
    writeUsers(users);
    syncAllowedUsers(users);
    appendAuditLog(req, "users.create", "users", { id: newUser.id });
    return res.status(201).json({ user: withUserProfileRevision(newUser, loadUploads()) });
  }

  const actorContext = getUserAccessContextById(sessionUser?.id);
  const canCreateUsers =
    (actorContext.accessRole === AccessRole.OWNER_PRIMARY ||
      actorContext.accessRole === AccessRole.OWNER_SECONDARY) &&
    can({ grants: actorContext.grants, permissionId: PermissionId.USUARIOS_ACESSO });
  if (!canCreateUsers) {
    return res.status(403).json({ error: "forbidden" });
  }

  let users = normalizeUsers(loadUsers());
  const targetId = String(id);
  if (users.some((user) => user.id === targetId)) {
    return res.status(409).json({ error: "user_exists" });
  }

  const normalizedAccessRole = normalizeAccessRole(accessRole, AccessRole.NORMAL);
  if (
    normalizedAccessRole === AccessRole.OWNER_PRIMARY ||
    normalizedAccessRole === AccessRole.OWNER_SECONDARY
  ) {
    return res.status(403).json({ error: "owner_role_requires_owner_governance" });
  }

  const nextAccessRole =
    normalizedAccessRole === AccessRole.ADMIN ? AccessRole.ADMIN : AccessRole.NORMAL;
  const sanitizedPermissions = Array.isArray(permissions)
    ? sanitizePermissionsForStorage(permissions, {
        acceptLegacyStar: false,
        keepUnknown: true,
      })
    : [...defaultPermissionsForRole(nextAccessRole)];

  const newUser = {
    id: targetId,
    name: String(name || "Sem nome"),
    phrase: phrase || "",
    bio: bio || "",
    avatarUrl: avatarUrl || null,
    avatarDisplay: normalizeAvatarDisplay(avatarDisplay),
    socials: sanitizeSocials(socials),
    favoriteWorks: sanitizeFavoriteWorksByCategory(favoriteWorks),
    status: status === "retired" ? "retired" : "active",
    permissions: sanitizedPermissions,
    roles: removeOwnerRoleLabel(Array.isArray(roles) ? roles.filter(Boolean) : []),
    accessRole: nextAccessRole,
    order: users.length,
  };

  users.push(newUser);
  users = enforceUserAccessInvariants(users);
  users.sort((a, b) => a.order - b.order);
  writeUsers(users);
  syncAllowedUsers(users);
  const ownerIds = loadOwnerIds().map((entry) => String(entry));
  const createdUser = users.find((user) => user.id === targetId) || newUser;
  appendAuditLog(req, "users.create", "users", {
    id: createdUser.id,
    after: toUserApiResponse(createdUser, ownerIds),
  });
  return res.status(201).json({
    user: withUserProfileRevision(toUserApiResponse(createdUser, ownerIds), loadUploads()),
  });
});

app.put("/api/users/reorder", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  const { orderedIds, retiredIds } = req.body || {};
  if (!Array.isArray(orderedIds) && !Array.isArray(retiredIds)) {
    return res.status(400).json({ error: "orderedIds_required" });
  }

  if (!isRbacV2Enabled) {
    if (!isAdminUser(sessionUser)) {
      return res.status(403).json({ error: "forbidden" });
    }
    let users = normalizeUsers(loadUsers());
    const activeUsers = users
      .filter((user) => user.status === "active")
      .sort((a, b) => a.order - b.order);
    const retiredUsers = users
      .filter((user) => user.status === "retired")
      .sort((a, b) => a.order - b.order);

    const activeOrder = Array.isArray(orderedIds)
      ? orderedIds.map(String)
      : activeUsers.map((user) => user.id);
    const retiredOrder = Array.isArray(retiredIds)
      ? retiredIds.map(String)
      : retiredUsers.map((user) => user.id);

    const activeOrderMap = new Map(activeOrder.map((id, index) => [String(id), index]));
    const retiredOrderMap = new Map(retiredOrder.map((id, index) => [String(id), index]));

    users = users.map((user) => {
      if (user.status === "active" && activeOrderMap.has(user.id)) {
        return { ...user, order: activeOrderMap.get(user.id) };
      }
      if (user.status === "retired" && retiredOrderMap.has(user.id)) {
        return { ...user, order: activeOrder.length + retiredOrderMap.get(user.id) };
      }
      return user;
    });

    users = normalizeUsers(users).map((user) =>
      isOwner(user.id) ? { ...user, status: "active", permissions: ["*"] } : user,
    );
    users.sort((a, b) => a.order - b.order);
    writeUsers(users);
    syncAllowedUsers(users);
    appendAuditLog(req, "users.reorder", "users", {});
    return res.json({ ok: true });
  }

  const actorContext = getUserAccessContextById(sessionUser?.id);
  const canReorderUsers =
    (actorContext.accessRole === AccessRole.OWNER_PRIMARY ||
      actorContext.accessRole === AccessRole.OWNER_SECONDARY) &&
    can({ grants: actorContext.grants, permissionId: PermissionId.USUARIOS_ACESSO });
  if (!canReorderUsers) {
    return res.status(403).json({ error: "forbidden" });
  }

  let users = normalizeUsers(loadUsers());
  const activeUsers = users
    .filter((user) => user.status === "active")
    .sort((a, b) => a.order - b.order);
  const retiredUsers = users
    .filter((user) => user.status === "retired")
    .sort((a, b) => a.order - b.order);

  const activeOrder = Array.isArray(orderedIds)
    ? orderedIds.map(String)
    : activeUsers.map((user) => user.id);
  const retiredOrder = Array.isArray(retiredIds)
    ? retiredIds.map(String)
    : retiredUsers.map((user) => user.id);

  const activeOrderMap = new Map(activeOrder.map((id, index) => [String(id), index]));
  const retiredOrderMap = new Map(retiredOrder.map((id, index) => [String(id), index]));

  users = users.map((user) => {
    if (user.status === "active" && activeOrderMap.has(user.id)) {
      return { ...user, order: activeOrderMap.get(user.id) };
    }
    if (user.status === "retired" && retiredOrderMap.has(user.id)) {
      return { ...user, order: activeOrder.length + retiredOrderMap.get(user.id) };
    }
    return user;
  });

  if (actorContext.accessRole === AccessRole.OWNER_SECONDARY) {
    const ownerIds = new Set(loadOwnerIds().map((id) => String(id)));
    const previousOrderById = new Map(
      normalizeUsers(loadUsers()).map((user) => [user.id, user.order]),
    );
    const changedOwnerOrder = users.some((user) => {
      if (!ownerIds.has(user.id)) {
        return false;
      }
      return user.order !== previousOrderById.get(user.id);
    });
    if (changedOwnerOrder) {
      return res.status(403).json({ error: "owner_reorder_forbidden" });
    }
  }

  users = enforceUserAccessInvariants(users);
  users.sort((a, b) => a.order - b.order);
  writeUsers(users);
  syncAllowedUsers(users);
  appendAuditLog(req, "users.reorder", "users", {});
  return res.json({ ok: true });
});

app.put("/api/users/:id", (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const options = parseEditRevisionOptions(req.body);
  const targetId = String(req.params.id);
  let users = normalizeUsers(loadUsers());
  const index = users.findIndex((user) => user.id === targetId);
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }

  const sessionUser = req.session.user;
  const update = req.body || {};
  const existing = users[index];
  const ownerIds = loadOwnerIds().map((id) => String(id));
  const currentUserSnapshot = toUserApiResponse(existing, ownerIds);
  const responseUploads = loadUploads();
  const currentRevision = buildUserProfileRevisionToken(currentUserSnapshot, responseUploads);

  if (!isRbacV2Enabled) {
    const isOwnerRequest = isOwner(sessionUser.id);
    const canManageBadges = isAdminUser(sessionUser);

    if (!isOwnerRequest && !canManageBadges) {
      return res.status(403).json({ error: "forbidden" });
    }

    if (!isOwnerRequest && canManageBadges) {
      const onlyRoles = Object.keys(update).length === 1 && Array.isArray(update.roles);
      if (!onlyRoles) {
        return res.status(403).json({ error: "roles_only" });
      }
    }
    const noConflict = ensureNoEditConflict({
      req,
      res,
      resourceType: "user",
      resourceId: targetId,
      current: currentUserSnapshot,
      currentRevision,
      options,
    });
    if (!noConflict) {
      return noConflict;
    }

    const updated = {
      ...existing,
      name: update.name ?? existing.name,
      phrase: update.phrase ?? existing.phrase,
      bio: update.bio ?? existing.bio,
      avatarUrl: update.avatarUrl ?? existing.avatarUrl,
      avatarDisplay:
        update.avatarDisplay !== undefined
          ? normalizeAvatarDisplay(update.avatarDisplay)
          : normalizeAvatarDisplay(existing.avatarDisplay),
      socials: Array.isArray(update.socials) ? sanitizeSocials(update.socials) : existing.socials,
      favoriteWorks: Object.prototype.hasOwnProperty.call(update, "favoriteWorks")
        ? sanitizeFavoriteWorksByCategory(update.favoriteWorks)
        : existing.favoriteWorks,
      status: update.status === "retired" ? "retired" : "active",
      permissions: Array.isArray(update.permissions) ? update.permissions : existing.permissions,
      roles: Array.isArray(update.roles) ? update.roles : existing.roles,
    };

    users[index] = updated;
    users = normalizeUsers(users).map((user) =>
      isOwner(user.id) ? { ...user, status: "active", permissions: ["*"] } : user,
    );
    writeUsers(users);
    syncAllowedUsers(users);
    const permissionsChanged =
      JSON.stringify(existing.permissions || []) !== JSON.stringify(updated.permissions || []);
    if (
      permissionsChanged &&
      shouldEmitSecurityRuleEvent("privilege_escalation_warning", `${sessionUser.id}:${targetId}`)
    ) {
      emitSecurityEvent({
        req,
        type: "privilege_escalation_warning",
        severity: SecurityEventSeverity.WARNING,
        riskScore: 75,
        actorUserId: sessionUser.id,
        targetUserId: targetId,
        data: {
          mode: "legacy",
          permissionsBefore: existing.permissions || [],
          permissionsAfter: updated.permissions || [],
        },
      });
    }
    appendAuditLog(req, "users.update", "users", { id: targetId });
    const responseUser = applyOwnerRole(updated);
    if (targetId === String(sessionUser?.id || "")) {
      syncSessionUserDisplayProfile(req, responseUser, responseUploads);
    }
    return res.json({
      user:
        targetId === String(sessionUser?.id || "")
          ? withUserProfileRevision(
              withEffectiveAvatarUrl(
                responseUser,
                resolveDiscordAvatarFallbackUrl(req.session?.user?.avatarUrl),
              ),
              responseUploads,
            )
          : withUserProfileRevision(responseUser, responseUploads),
    });
  }

  const actorContext = getUserAccessContextById(sessionUser.id, users);
  const targetContext = getUserAccessContextById(targetId, users);
  const updateKeys = Object.keys(update);
  const actorIsPrimary = actorContext.accessRole === AccessRole.OWNER_PRIMARY;
  const actorIsSecondary = actorContext.accessRole === AccessRole.OWNER_SECONDARY;
  const actorIsAdmin = actorContext.accessRole === AccessRole.ADMIN;
  const actorCanUsersBasic = can({
    grants: actorContext.grants,
    permissionId: PermissionId.USUARIOS_BASICO,
  });
  const actorCanUsersAccess = can({
    grants: actorContext.grants,
    permissionId: PermissionId.USUARIOS_ACESSO,
  });
  const touchesBasicFields = updateKeys.some((field) => isBasicProfileField(field));
  const touchesAccessFields = updateKeys.some((field) => !isBasicProfileField(field));

  if (!actorIsPrimary && !actorIsSecondary && !actorIsAdmin) {
    return res.status(403).json({ error: "forbidden" });
  }

  if (targetContext.isOwner && !actorIsPrimary) {
    return res.status(403).json({ error: "owner_update_forbidden" });
  }

  if (actorIsAdmin) {
    if (!actorCanUsersBasic) {
      return res.status(403).json({ error: "users_basic_permission_required" });
    }
    const invalidAdminFields = updateKeys.filter((field) => !isBasicProfileField(field));
    if (invalidAdminFields.length > 0) {
      return res.status(403).json({ error: "basic_fields_only" });
    }
  }

  if ((actorIsPrimary || actorIsSecondary) && touchesBasicFields && !actorCanUsersBasic) {
    return res.status(403).json({ error: "users_basic_permission_required" });
  }

  if ((actorIsPrimary || actorIsSecondary) && touchesAccessFields && !actorCanUsersAccess) {
    return res.status(403).json({ error: "users_access_permission_required" });
  }

  if (targetContext.isPrimaryOwner) {
    const immutableFields = ["permissions", "status", "accessRole"].filter((field) =>
      Object.prototype.hasOwnProperty.call(update, field),
    );
    if (immutableFields.length > 0) {
      return res.status(403).json({ error: "primary_owner_immutable" });
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(update, "accessRole") &&
    String(update.accessRole || "").includes("owner")
  ) {
    return res.status(403).json({ error: "owner_role_requires_owner_governance" });
  }
  const noConflict = ensureNoEditConflict({
    req,
    res,
    resourceType: "user",
    resourceId: targetId,
    current: currentUserSnapshot,
    currentRevision,
    options,
  });
  if (!noConflict) {
    return noConflict;
  }

  const basicPatch = pickBasicProfilePatch(update);
  const updated = {
    ...existing,
    ...basicPatch,
    avatarDisplay:
      basicPatch.avatarDisplay !== undefined
        ? normalizeAvatarDisplay(basicPatch.avatarDisplay)
        : normalizeAvatarDisplay(existing.avatarDisplay),
    socials: Array.isArray(basicPatch.socials)
      ? sanitizeSocials(basicPatch.socials)
      : existing.socials,
    favoriteWorks: Object.prototype.hasOwnProperty.call(basicPatch, "favoriteWorks")
      ? sanitizeFavoriteWorksByCategory(basicPatch.favoriteWorks)
      : existing.favoriteWorks,
    roles: Array.isArray(update.roles) ? removeOwnerRoleLabel(update.roles) : existing.roles,
    status:
      update.status === "retired"
        ? "retired"
        : update.status === "active"
          ? "active"
          : existing.status,
    accessRole: Object.prototype.hasOwnProperty.call(update, "accessRole")
      ? normalizeAccessRole(update.accessRole, existing.accessRole || AccessRole.NORMAL)
      : existing.accessRole || AccessRole.NORMAL,
    permissions: Array.isArray(update.permissions)
      ? sanitizePermissionsForStorage(update.permissions, {
          acceptLegacyStar: false,
          keepUnknown: true,
        })
      : existing.permissions,
  };

  if (
    Object.prototype.hasOwnProperty.call(update, "accessRole") &&
    !Array.isArray(update.permissions) &&
    !targetContext.isOwner
  ) {
    updated.permissions = [...defaultPermissionsForRole(updated.accessRole)];
  }

  if (actorIsSecondary && targetContext.isOwner) {
    return res.status(403).json({ error: "owner_update_forbidden" });
  }

  if ((actorIsPrimary || actorIsSecondary) && targetContext.isOwner) {
    updated.accessRole = existing.accessRole;
  }

  if (
    updated.accessRole === AccessRole.OWNER_PRIMARY ||
    updated.accessRole === AccessRole.OWNER_SECONDARY
  ) {
    updated.accessRole = existing.accessRole;
  }
  if (!actorIsPrimary && !actorIsSecondary) {
    updated.permissions = existing.permissions;
    updated.accessRole = existing.accessRole;
    updated.status = existing.status;
    updated.roles = existing.roles;
  }

  const beforeSnapshot = toUserApiResponse(existing, ownerIds);
  users[index] = updated;
  users = enforceUserAccessInvariants(users);
  users.sort((a, b) => a.order - b.order);
  writeUsers(users);
  syncAllowedUsers(users);
  const persisted = users.find((user) => user.id === targetId) || updated;
  const afterSnapshot = toUserApiResponse(persisted, ownerIds);
  appendAuditLog(req, "users.update", "users", {
    id: targetId,
    before: beforeSnapshot,
    after: afterSnapshot,
    changes: diffUserFields(beforeSnapshot, afterSnapshot, [
      ...BASIC_PROFILE_FIELDS,
      "status",
      "permissions",
      "roles",
      "accessRole",
    ]),
  });
  const hasPrivilegeEscalation =
    JSON.stringify(beforeSnapshot.permissions || []) !==
      JSON.stringify(afterSnapshot.permissions || []) ||
    String(beforeSnapshot.accessRole || "") !== String(afterSnapshot.accessRole || "") ||
    String(beforeSnapshot.status || "") !== String(afterSnapshot.status || "");
  if (
    hasPrivilegeEscalation &&
    shouldEmitSecurityRuleEvent("privilege_escalation_warning", `${sessionUser.id}:${targetId}`)
  ) {
    emitSecurityEvent({
      req,
      type: "privilege_escalation_warning",
      severity: SecurityEventSeverity.WARNING,
      riskScore: 78,
      actorUserId: sessionUser.id,
      targetUserId: targetId,
      data: {
        accessRoleBefore: beforeSnapshot.accessRole || null,
        accessRoleAfter: afterSnapshot.accessRole || null,
        permissionsBefore: beforeSnapshot.permissions || [],
        permissionsAfter: afterSnapshot.permissions || [],
        statusBefore: beforeSnapshot.status || null,
        statusAfter: afterSnapshot.status || null,
      },
    });
  }
  if (targetId === String(sessionUser?.id || "")) {
    syncSessionUserDisplayProfile(req, afterSnapshot, responseUploads);
  }
  return res.json({
    user:
      targetId === String(sessionUser?.id || "")
        ? withUserProfileRevision(
            withEffectiveAvatarUrl(
              afterSnapshot,
              resolveDiscordAvatarFallbackUrl(req.session?.user?.avatarUrl),
            ),
            responseUploads,
          )
        : withUserProfileRevision(afterSnapshot, responseUploads),
  });
});

app.delete("/api/users/:id", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  const targetId = String(req.params.id || "");
  const primaryOwnerId = getPrimaryOwnerId();

  if (!targetId) {
    return res.status(400).json({ error: "invalid_id" });
  }
  if (sessionUser?.id && String(sessionUser.id) === targetId) {
    return res.status(400).json({ error: "cannot_delete_self" });
  }
  if (!isRbacV2Enabled) {
    if (!isOwner(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    if (primaryOwnerId && String(primaryOwnerId) === targetId) {
      return res.status(403).json({ error: "cannot_delete_primary_owner" });
    }
    if (isOwner(targetId) && !isPrimaryOwner(sessionUser?.id)) {
      return res.status(403).json({ error: "owner_delete_forbidden" });
    }

    let users = normalizeUsers(loadUsers());
    const index = users.findIndex((user) => user.id === targetId);
    if (index === -1) {
      return res.status(404).json({ error: "not_found" });
    }

    const removed = users[index];
    users = users.filter((user) => user.id !== targetId);

    const activeUsers = users
      .filter((user) => user.status === "active")
      .sort((a, b) => a.order - b.order);
    const retiredUsers = users
      .filter((user) => user.status === "retired")
      .sort((a, b) => a.order - b.order);
    let orderIndex = 0;
    const reordered = [
      ...activeUsers.map((user) => ({ ...user, order: orderIndex++ })),
      ...retiredUsers.map((user) => ({ ...user, order: orderIndex++ })),
    ];

    let nextOwnerIds = loadOwnerIds();
    if (nextOwnerIds.includes(targetId)) {
      nextOwnerIds = nextOwnerIds.filter((id) => id !== targetId);
      if (nextOwnerIds.length === 0 && primaryOwnerId) {
        nextOwnerIds = [String(primaryOwnerId)];
      }
      writeOwnerIds(nextOwnerIds);
    }

    const normalizedUsers = normalizeUsers(reordered).map((user) =>
      isOwner(user.id) ? { ...user, status: "active", permissions: ["*"] } : user,
    );
    normalizedUsers.sort((a, b) => a.order - b.order);
    writeUsers(normalizedUsers);
    syncAllowedUsers(normalizedUsers);
    appendAuditLog(req, "users.delete", "users", { id: targetId, wasOwner: isOwner(removed.id) });
    return res.json({ ok: true, ownerIds: loadOwnerIds() });
  }

  let users = normalizeUsers(loadUsers());
  const index = users.findIndex((user) => user.id === targetId);
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const removed = users[index];
  const actorContext = getUserAccessContextById(sessionUser?.id, users);
  const targetContext = getUserAccessContextById(targetId, users);
  const actorIsPrimary = actorContext.accessRole === AccessRole.OWNER_PRIMARY;
  const actorIsSecondary = actorContext.accessRole === AccessRole.OWNER_SECONDARY;
  const actorCanUsersAccess = can({
    grants: actorContext.grants,
    permissionId: PermissionId.USUARIOS_ACESSO,
  });
  if ((!actorIsPrimary && !actorIsSecondary) || !actorCanUsersAccess) {
    return res.status(403).json({ error: "forbidden" });
  }
  if (targetContext.isPrimaryOwner || (primaryOwnerId && String(primaryOwnerId) === targetId)) {
    return res.status(403).json({ error: "cannot_delete_primary_owner" });
  }
  if (targetContext.isOwner && !actorIsPrimary) {
    return res.status(403).json({ error: "owner_delete_forbidden" });
  }

  users = users.filter((user) => user.id !== targetId);

  const activeUsers = users
    .filter((user) => user.status === "active")
    .sort((a, b) => a.order - b.order);
  const retiredUsers = users
    .filter((user) => user.status === "retired")
    .sort((a, b) => a.order - b.order);
  let orderIndex = 0;
  const reordered = [
    ...activeUsers.map((user) => ({ ...user, order: orderIndex++ })),
    ...retiredUsers.map((user) => ({ ...user, order: orderIndex++ })),
  ];

  let nextOwnerIds = loadOwnerIds().map((id) => String(id));
  if (nextOwnerIds.includes(targetId)) {
    nextOwnerIds = nextOwnerIds.filter((id) => id !== targetId);
    if (nextOwnerIds.length === 0 && primaryOwnerId) {
      nextOwnerIds = [String(primaryOwnerId)];
    }
    writeOwnerIds(nextOwnerIds);
  }

  const normalizedUsers = enforceUserAccessInvariants(reordered);
  normalizedUsers.sort((a, b) => a.order - b.order);
  writeUsers(normalizedUsers);
  syncAllowedUsers(normalizedUsers);
  appendAuditLog(req, "users.delete", "users", {
    id: targetId,
    wasOwner: targetContext.isOwner,
    before: toUserApiResponse(removed, nextOwnerIds),
  });
  return res.json({
    ok: true,
    ownerIds: loadOwnerIds().map((id) => String(id)),
    primaryOwnerId: getPrimaryOwnerId() || null,
  });
});

app.put("/api/users/self", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  const options = parseEditRevisionOptions(req.body);
  let users = normalizeUsers(loadUsers());
  const index = users.findIndex((user) => user.id === String(sessionUser.id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }

  const update = req.body || {};
  const existing = users[index];
  const ownerIds = loadOwnerIds().map((id) => String(id));
  const currentUserSnapshot = toUserApiResponse(existing, ownerIds);
  const responseUploads = loadUploads();
  const currentRevision = buildUserProfileRevisionToken(currentUserSnapshot, responseUploads);
  const noConflict = ensureNoEditConflict({
    req,
    res,
    resourceType: "user",
    resourceId: existing.id,
    current: currentUserSnapshot,
    currentRevision,
    options,
  });
  if (!noConflict) {
    return noConflict;
  }
  const basicPatch = pickBasicProfilePatch(update);
  const updated = {
    ...existing,
    name: basicPatch.name ?? existing.name,
    phrase: basicPatch.phrase ?? existing.phrase,
    bio: basicPatch.bio ?? existing.bio,
    avatarUrl: basicPatch.avatarUrl ?? existing.avatarUrl,
    avatarDisplay:
      basicPatch.avatarDisplay !== undefined
        ? normalizeAvatarDisplay(basicPatch.avatarDisplay)
        : normalizeAvatarDisplay(existing.avatarDisplay),
    socials: Array.isArray(basicPatch.socials)
      ? sanitizeSocials(basicPatch.socials)
      : existing.socials,
    favoriteWorks: Object.prototype.hasOwnProperty.call(basicPatch, "favoriteWorks")
      ? sanitizeFavoriteWorksByCategory(basicPatch.favoriteWorks)
      : existing.favoriteWorks,
  };

  const beforeSnapshot = toUserApiResponse(existing, ownerIds);
  users[index] = updated;
  users = isRbacV2Enabled
    ? enforceUserAccessInvariants(users)
    : normalizeUsers(users).map((user) =>
        isOwner(user.id) ? { ...user, status: "active", permissions: ["*"] } : user,
      );
  writeUsers(users);
  syncAllowedUsers(users);
  const persisted = users.find((user) => user.id === String(sessionUser.id)) || updated;
  const afterSnapshot = toUserApiResponse(persisted, ownerIds);
  appendAuditLog(req, "users.update_self", "users", {
    id: sessionUser.id,
    before: beforeSnapshot,
    after: afterSnapshot,
    changes: diffUserFields(beforeSnapshot, afterSnapshot, BASIC_PROFILE_FIELDS),
  });
  syncSessionUserDisplayProfile(req, persisted, responseUploads);
  return res.json({
    user: withUserProfileRevision(
      withEffectiveAvatarUrl(
        afterSnapshot,
        resolveDiscordAvatarFallbackUrl(req.session?.user?.avatarUrl),
      ),
      responseUploads,
    ),
  });
});

app.get("/api/og/institutional/:pageKey", async (req, res) => {
  const pageKey = String(req.params.pageKey || "").trim();
  if (!resolveInstitutionalOgPageTitle(pageKey)) {
    return res.status(404).type("text/plain").send("not_found");
  }

  try {
    const settings = loadSiteSettings();
    const pages = loadPages();
    const rendered = await getInstitutionalOgCachedRender({
      pageKey,
      pages,
      settings,
      origin: PRIMARY_APP_ORIGIN,
      resolveVariantUrl: resolveMetaImageVariantUrl,
      ogRenderCache,
    });
    if (!rendered) {
      return res.status(404).type("text/plain").send("not_found");
    }

    const deliveryHeaders = buildInstitutionalOgDeliveryHeaders({
      cacheHit: rendered.cacheHit,
      timings: rendered.timings,
    });

    res.setHeader("Content-Type", rendered.contentType || "image/png");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.setHeader("X-OG-Cache", deliveryHeaders.cache);
    if (deliveryHeaders.serverTiming) {
      res.setHeader("Server-Timing", deliveryHeaders.serverTiming);
    }
    return res.status(200).send(Buffer.from(rendered.buffer));
  } catch {
    return res.status(500).type("text/plain").send("image_generation_failed");
  }
});

app.get("/api/og/project/:id/reading/:chapter", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const chapterNumber = Number(req.params.chapter);
  const volume = Number(req.query?.volume);
  const project = getPublicVisibleProjects().find((item) => String(item?.id || "").trim() === id);
  if (!project || !Number.isFinite(chapterNumber)) {
    return res.status(404).type("text/plain").send("not_found");
  }

  try {
    const settings = loadSiteSettings();
    const translations = loadTagTranslations();
    const rendered = await getProjectReadingOgCachedRender({
      project,
      chapterNumber,
      volume: Number.isFinite(volume) ? volume : undefined,
      settings,
      translations,
      origin: PRIMARY_APP_ORIGIN,
      resolveVariantUrl: resolveMetaImageVariantUrl,
      ogRenderCache,
    });
    if (!rendered) {
      return res.status(404).type("text/plain").send("not_found");
    }

    const deliveryHeaders = buildProjectReadingOgDeliveryHeaders({
      cacheHit: rendered.cacheHit,
      timings: rendered.timings,
    });

    res.setHeader("Content-Type", rendered.contentType || "image/png");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.setHeader("X-OG-Cache", deliveryHeaders.cache);
    if (deliveryHeaders.serverTiming) {
      res.setHeader("Server-Timing", deliveryHeaders.serverTiming);
    }
    return res.status(200).send(Buffer.from(rendered.buffer));
  } catch {
    return res.status(500).type("text/plain").send("image_generation_failed");
  }
});

app.get("/api/og/project/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const project = getPublicVisibleProjects().find((item) => String(item?.id || "").trim() === id);
  if (!project) {
    return res.status(404).type("text/plain").send("not_found");
  }

  try {
    const settings = loadSiteSettings();
    const translations = loadTagTranslations();
    const rendered = await getProjectOgCachedRender({
      project,
      settings,
      translations,
      origin: PRIMARY_APP_ORIGIN,
      resolveVariantUrl: resolveMetaImageVariantUrl,
      ogRenderCache,
    });
    const deliveryHeaders = buildProjectOgDeliveryHeaders({
      cacheHit: rendered.cacheHit,
      timings: rendered.timings,
    });

    res.setHeader("Content-Type", rendered.contentType || "image/png");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.setHeader("X-OG-Cache", deliveryHeaders.cache);
    if (deliveryHeaders.serverTiming) {
      res.setHeader("Server-Timing", deliveryHeaders.serverTiming);
    }
    logProjectOgDelivery({
      projectId: id,
      cacheHit: rendered.cacheHit,
      timings: rendered.timings,
      userAgent: req.headers["user-agent"],
    });
    return res.status(200).send(Buffer.from(rendered.buffer));
  } catch {
    return res.status(500).type("text/plain").send("image_generation_failed");
  }
});

app.get("/api/og/post/:slug", async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  const now = Date.now();
  const post = normalizePosts(loadPosts()).find((item) => item.slug === slug);
  if (!post || post.deletedAt) {
    return res.status(404).type("text/plain").send("not_found");
  }
  const publishTime = new Date(post.publishedAt).getTime();
  if (publishTime > now || (post.status !== "published" && post.status !== "scheduled")) {
    return res.status(404).type("text/plain").send("not_found");
  }

  try {
    const settings = loadSiteSettings();
    const translations = loadTagTranslations();
    const resolvedCover = resolvePostCover(post);
    const firstPostImage = extractFirstImageFromPostContent(post.content, post.contentFormat);
    const relatedProjectId = String(post.projectId || "").trim();
    const relatedProject = relatedProjectId
      ? getPublicVisibleProjects().find(
          (item) => String(item?.id || "").trim() === relatedProjectId,
        ) || null
      : null;
    const resolvedAuthor = resolveEditorialAuthorFromPost(post);
    const rendered = await getPostOgCachedRender({
      post,
      relatedProject,
      resolvedCover,
      firstPostImage,
      resolvedAuthor,
      defaultBackdropUrl: settings.site?.defaultShareImage || "",
      settings,
      translations,
      origin: PRIMARY_APP_ORIGIN,
      resolveVariantUrl: resolveMetaImageVariantUrl,
      ogRenderCache,
    });

    res.setHeader("Content-Type", rendered.contentType || "image/png");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    return res.status(200).send(Buffer.from(rendered.buffer));
  } catch {
    return res.status(500).type("text/plain").send("image_generation_failed");
  }
});

app.use((req, res, next) => {
  const method = String(req.method || "").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return next();
  }
  let search = "";
  try {
    const parsedUrl = new URL(req.originalUrl || req.url || req.path || "/", PRIMARY_APP_ORIGIN);
    search = parsedUrl.search || "";
  } catch {
    search = "";
  }
  const settings = loadSiteSettings();
  const redirect = resolvePublicRedirect({
    redirects: settings?.seo?.redirects,
    pathname: req.path,
    search,
  });
  if (!redirect?.location) {
    return next();
  }
  return res.redirect(301, redirect.location);
});

app.get(
  [
    "/",
    "/projeto/:id",
    "/projeto/:id/leitura/:chapter",
    "/projetos/:id",
    "/projetos/:id/leitura/:chapter",
    "/postagem/:slug",
  ],
  async (req, res) => {
    try {
      const settings = loadSiteSettings();
      const translations = loadTagTranslations();
      const pages = loadPages();
      const canonicalUrl = `${PRIMARY_APP_ORIGIN}${req.path}`;
      const themeColor = resolveThemeColor(settings?.theme?.accent);
      if (req.path.startsWith("/postagem/")) {
        const slug = String(req.params.slug || "");
        const post = normalizePosts(loadPosts()).find((item) => item.slug === slug);
        const meta = post ? buildPostMeta(post) : buildSiteMetaWithSettings(settings);
        const structuredData = buildSchemaOrgPayload({
          origin: PRIMARY_APP_ORIGIN,
          pathname: req.path,
          canonicalUrl,
          settings,
          pages,
          post: post || null,
        });
        const html = injectPublicBootstrapHtml({
          html: renderMetaHtml({
            ...meta,
            url: canonicalUrl,
            structuredData,
            themeColor,
          }),
          req,
          settings,
          pages,
          bootstrapMode: PUBLIC_BOOTSTRAP_MODE_FULL,
        });
        return await sendHtml(req, res, html);
      }
      if (req.path.startsWith("/projeto/") || req.path.startsWith("/projetos/")) {
        const id = String(req.params.id || "");
        const project = normalizeProjects(loadProjects()).find((item) => String(item.id) === id);
        const isReadingRoute = /^\/projeto(?:s)?\/.+\/leitura\/.+/.test(String(req.path || ""));
        const chapterNumber = Number(req.params.chapter);
        const routeVolume = Number(req.query?.volume);
        const meta = project
          ? isReadingRoute
            ? buildProjectReadingMeta(project, {
                chapterNumber,
                volume: Number.isFinite(routeVolume) ? routeVolume : undefined,
                settings,
                translations,
              }) ||
              buildProjectMeta(project, {
                settings,
                translations,
              })
            : buildProjectMeta(project, {
                settings,
                translations,
              })
          : buildSiteMetaWithSettings(settings);
        const structuredData = buildSchemaOrgPayload({
          origin: PRIMARY_APP_ORIGIN,
          pathname: req.path,
          canonicalUrl,
          settings,
          pages,
          project: project || null,
        });
        const html = injectPublicBootstrapHtml({
          html: renderMetaHtml({
            ...meta,
            url: canonicalUrl,
            structuredData,
            themeColor,
          }),
          req,
          settings,
          pages,
          bootstrapMode: PUBLIC_BOOTSTRAP_MODE_FULL,
        });
        return await sendHtml(req, res, html);
      }
      const meta = buildSiteMetaWithSettings(settings);
      const structuredData = buildSchemaOrgPayload({
        origin: PRIMARY_APP_ORIGIN,
        pathname: req.path,
        canonicalUrl,
        settings,
        pages,
      });
      const html = injectPublicBootstrapHtml({
        html: renderMetaHtml({
          ...meta,
          url: canonicalUrl,
          structuredData,
          themeColor,
        }),
        req,
        settings,
        pages,
        includeHeroImagePreload: req.path === "/",
        bootstrapMode:
          req.path === "/" ? PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME : PUBLIC_BOOTSTRAP_MODE_FULL,
        includeHomeHeroShell: req.path === "/" && isHomeHeroShellEnabled,
      });
      return await sendHtml(req, res, html);
    } catch {
      return await sendHtml(req, res, getIndexHtml());
    }
  },
);

app.get("/{*path}", async (req, res) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/auth")) {
    return res.status(404).json({ error: "not_found" });
  }
  try {
    const settings = loadSiteSettings();
    const pages = loadPages();
    const institutionalPageKey = resolveInstitutionalOgPageKeyFromPath(req.path);
    const meta = institutionalPageKey
      ? buildInstitutionalPageMeta(institutionalPageKey, {
          settings,
          pages,
        })
      : buildSiteMetaWithSettings(settings);
    const themeColor = resolveThemeColor(settings?.theme?.accent);
    const siteName = settings.site?.name || "Nekomata";
    const separator = settings.site?.titleSeparator ?? "";
    const pageTitle = getPageTitleFromPath(req.path);
    const title = institutionalPageKey
      ? meta.title
      : pageTitle
        ? `${pageTitle}${separator}${siteName}`
        : siteName;
    const canonicalUrl = `${PRIMARY_APP_ORIGIN}${req.path}`;
    const structuredData = buildSchemaOrgPayload({
      origin: PRIMARY_APP_ORIGIN,
      pathname: req.path,
      canonicalUrl,
      settings,
      pages,
    });
    const shouldInjectPublicBootstrap = !/^\/dashboard(?:\/|$)/.test(req.path);
    const renderedHtml = renderMetaHtml({
      ...meta,
      title,
      url: canonicalUrl,
      structuredData,
      themeColor,
    });
    const html = shouldInjectPublicBootstrap
      ? injectPublicBootstrapHtml({
          html: renderedHtml,
          req,
          settings,
          pages,
          includeHeroImagePreload: req.path === "/",
          includeProjectsImagePreloads: req.path === "/projetos",
          bootstrapMode:
            req.path === "/" ? PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME : PUBLIC_BOOTSTRAP_MODE_FULL,
          includeHomeHeroShell: req.path === "/" && isHomeHeroShellEnabled,
        })
      : injectDashboardBootstrapHtml({
          html: renderedHtml,
          req,
          settings,
        });
    return await sendHtml(req, res, html);
  } catch {
    return await sendHtml(req, res, getIndexHtml());
  }
});

const runStartupMaintenance = async () => {
  try {
    runStartupSecuritySanitization();
  } catch {
    // ignore startup sanitization failures on boot
  }

  try {
    await enqueueAnalyticsCompactionJob({ trigger: "startup" });
  } catch {
    // ignore analytics compaction failures on boot
  }

  if (isAutoUploadReorganizationOnStartupEnabled) {
    try {
      await runAutoUploadReorganization({ trigger: "startup" });
    } catch {
      // ignore auto-reorganization failures on boot
    }
  }
};

const listenPort = Number(PORT);
httpServer.listen(listenPort, () => {
  console.log(
    `[server] listening on :${listenPort} (data_source=db, maintenance=${isMaintenanceMode})`,
  );
  setImmediate(() => {
    void runStartupMaintenance();
  });
  analyticsCompactionState.timer = setInterval(() => {
    void enqueueAnalyticsCompactionJob({ trigger: "interval" }).catch(() => undefined);
  }, ANALYTICS_COMPACTION_INTERVAL_MS);
  analyticsCompactionState.timer.unref?.();
  if (isOpsAlertsWebhookEnabled) {
    operationalAlertsWebhookState.timer = setInterval(() => {
      void runOperationalAlertsWebhookTick();
    }, OPS_ALERTS_WEBHOOK_INTERVAL_MS);
    operationalAlertsWebhookState.timer.unref?.();
    setImmediate(() => {
      void runOperationalAlertsWebhookTick();
    });
  }
});

httpServer.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(
      `[server] Port ${listenPort} is already in use. Stop the existing process or run "npm run dev" to perform automatic cleanup.`,
    );
    process.exit(1);
    return;
  }
  console.error(
    `[server] Failed to start HTTP server on :${listenPort}. ${String(error?.message || "Unknown error")}`,
  );
  process.exit(1);
});

httpServer.on("close", () => {
  if (analyticsCompactionState.timer) {
    clearInterval(analyticsCompactionState.timer);
    analyticsCompactionState.timer = null;
  }
  if (operationalAlertsWebhookState.timer) {
    clearInterval(operationalAlertsWebhookState.timer);
    operationalAlertsWebhookState.timer = null;
  }
  void rateLimiter.close();
});
