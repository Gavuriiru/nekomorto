import { createGravatarRuntime } from "../lib/gravatar-runtime.js";
import { createPublicMediaRuntime } from "../lib/public-media-runtime.js";
import { createRateLimitRuntime } from "../lib/rate-limit-runtime.js";
import { createStartupSecuritySanitizationRuntime } from "../lib/startup-security-sanitization-runtime.js";
import { createUploadEntriesRuntime } from "../lib/upload-entries-runtime.js";
import { assertRequiredDependencies } from "./assert-required-dependencies.js";

const MEDIA_SUPPORT_RUNTIME_DEPENDENCY_KEYS = [
  "PRIMARY_APP_ORIGIN",
  "PUBLIC_UPLOADS_DIR",
  "STATIC_DEFAULT_CACHE_CONTROL",
  "appendAuditLog",
  "attachUploadMediaMetadata",
  "backgroundJobQueue",
  "buildDiskStorageAreaSummary",
  "buildStorageAreaSummary",
  "cleanupUploadStagingWorkspace",
  "createSystemAuditReq",
  "createUploadStagingWorkspace",
  "crypto",
  "dataRepository",
  "deriveFocalPointsFromCrops",
  "extractUploadUrlsFromText",
  "fs",
  "getPrimaryFocalPoint",
  "getPublicVisibleProjects",
  "getUploadVariantUrlPrefix",
  "isProduction",
  "loadComments",
  "loadIntegrationSettings",
  "loadLinkTypes",
  "loadPages",
  "loadPosts",
  "loadProjects",
  "loadSiteSettings",
  "loadTagTranslations",
  "loadUpdates",
  "loadUploads",
  "loadUsers",
  "materializeUploadEntrySourceToStaging",
  "mergeUploadVariantPresetKeys",
  "metricsRegistry",
  "normalizeFocalCrops",
  "normalizeFocalPoints",
  "normalizeUploadStorageProvider",
  "normalizeUploadUrl",
  "normalizeUploadVariantPresetKeys",
  "normalizeVariants",
  "ogRenderCache",
  "path",
  "persistUploadEntryFromStaging",
  "prewarmProjectOgCache",
  "rateLimiter",
  "readUploadStorageProvider",
  "resolveExistingPublicVariantUrl",
  "resolveUploadAbsolutePath",
  "sanitizeIconSource",
  "sanitizePublicHref",
  "sanitizeSocials",
  "sanitizePublicMediaVariantEntry",
  "sanitizeUploadSlot",
  "shouldExposePublicUploadInMediaVariants",
  "uploadStorageService",
  "writeUploads",
];

export const createMediaSupportRuntimeBundle = (dependencies = {}) => {
  assertRequiredDependencies(
    "createMediaSupportRuntimeBundle",
    dependencies,
    MEDIA_SUPPORT_RUNTIME_DEPENDENCY_KEYS,
  );

  const uploadEntriesRuntime = createUploadEntriesRuntime({
    STATIC_DEFAULT_CACHE_CONTROL: dependencies.STATIC_DEFAULT_CACHE_CONTROL,
    attachUploadMediaMetadata: dependencies.attachUploadMediaMetadata,
    buildDiskStorageAreaSummary: dependencies.buildDiskStorageAreaSummary,
    buildStorageAreaSummary: dependencies.buildStorageAreaSummary,
    cleanupUploadStagingWorkspace: dependencies.cleanupUploadStagingWorkspace,
    createUploadStagingWorkspace: dependencies.createUploadStagingWorkspace,
    crypto: dependencies.crypto,
    deriveFocalPointsFromCrops: dependencies.deriveFocalPointsFromCrops,
    fs: dependencies.fs,
    getLoadUploads: () => dependencies.loadUploads,
    getPrimaryFocalPoint: dependencies.getPrimaryFocalPoint,
    getUploadVariantUrlPrefix: dependencies.getUploadVariantUrlPrefix,
    getWriteUploads: () => dependencies.writeUploads,
    materializeUploadEntrySourceToStaging: dependencies.materializeUploadEntrySourceToStaging,
    mergeUploadVariantPresetKeys: dependencies.mergeUploadVariantPresetKeys,
    normalizeFocalCrops: dependencies.normalizeFocalCrops,
    normalizeFocalPoints: dependencies.normalizeFocalPoints,
    normalizeUploadStorageProvider: dependencies.normalizeUploadStorageProvider,
    normalizeUploadVariantPresetKeys: dependencies.normalizeUploadVariantPresetKeys,
    normalizeVariants: dependencies.normalizeVariants,
    path: dependencies.path,
    persistUploadEntryFromStaging: dependencies.persistUploadEntryFromStaging,
    primaryAppOrigin: dependencies.PRIMARY_APP_ORIGIN,
    publicUploadsDir: dependencies.PUBLIC_UPLOADS_DIR,
    readUploadStorageProvider: dependencies.readUploadStorageProvider,
    resolveUploadAbsolutePath: dependencies.resolveUploadAbsolutePath,
    sanitizeUploadSlot: dependencies.sanitizeUploadSlot,
    uploadStorageService: dependencies.uploadStorageService,
  });

  const publicMediaRuntime = createPublicMediaRuntime({
    backgroundJobQueue: dependencies.backgroundJobQueue,
    extractUploadUrlsFromText: dependencies.extractUploadUrlsFromText,
    getPublicVisibleProjects: dependencies.getPublicVisibleProjects,
    getUploadFolderFromUrlValue: uploadEntriesRuntime.getUploadFolderFromUrlValue,
    isPrivateUploadFolder: uploadEntriesRuntime.isPrivateUploadFolder,
    loadComments: () => dependencies.loadComments(),
    loadLinkTypes: () => dependencies.loadLinkTypes(),
    loadPages: () => dependencies.loadPages(),
    loadPosts: () => dependencies.loadPosts(),
    loadProjects: () => dependencies.loadProjects(),
    loadSiteSettings: () => dependencies.loadSiteSettings(),
    loadTagTranslations: () => dependencies.loadTagTranslations(),
    loadUpdates: () => dependencies.loadUpdates(),
    loadUploads: () => dependencies.loadUploads(),
    loadUsers: () => dependencies.loadUsers(),
    normalizeUploadUrl: dependencies.normalizeUploadUrl,
    normalizeUploadUrlValue: uploadEntriesRuntime.normalizeUploadUrlValue,
    normalizeVariants: dependencies.normalizeVariants,
    ogRenderCache: dependencies.ogRenderCache,
    prewarmProjectOgCache: dependencies.prewarmProjectOgCache,
    primaryAppOrigin: dependencies.PRIMARY_APP_ORIGIN,
    publicUploadsDir: dependencies.PUBLIC_UPLOADS_DIR,
    readUploadFocalState: uploadEntriesRuntime.readUploadFocalState,
    readUploadStorageProvider: dependencies.readUploadStorageProvider,
    resolveExistingPublicVariantUrl: dependencies.resolveExistingPublicVariantUrl,
    sanitizePublicMediaVariantEntry: dependencies.sanitizePublicMediaVariantEntry,
    shouldExposePublicUploadInMediaVariants: dependencies.shouldExposePublicUploadInMediaVariants,
  });

  const startupSecuritySanitizationRuntime = createStartupSecuritySanitizationRuntime({
    appendAuditLog: dependencies.appendAuditLog,
    createSystemAuditReq: dependencies.createSystemAuditReq,
    dataRepository: dependencies.dataRepository,
    loadIntegrationSettings: dependencies.loadIntegrationSettings,
    loadLinkTypes: dependencies.loadLinkTypes,
    loadSiteSettings: dependencies.loadSiteSettings,
    loadUsers: dependencies.loadUsers,
    sanitizeIconSource: dependencies.sanitizeIconSource,
    sanitizePublicHref: dependencies.sanitizePublicHref,
    sanitizeSocials: dependencies.sanitizeSocials,
  });

  const gravatarRuntime = createGravatarRuntime({
    crypto: dependencies.crypto,
  });

  const rateLimitRuntime = createRateLimitRuntime({
    isProduction: dependencies.isProduction,
    metricsRegistry: dependencies.metricsRegistry,
    rateLimiter: dependencies.rateLimiter,
  });

  return {
    ...uploadEntriesRuntime,
    ...publicMediaRuntime,
    ...startupSecuritySanitizationRuntime,
    ...gravatarRuntime,
    ...rateLimitRuntime,
  };
};

export default createMediaSupportRuntimeBundle;
