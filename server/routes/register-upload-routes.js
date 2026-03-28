import crypto from "crypto";
import fs from "fs";
import path from "path";
import { extractUploadUrlsFromText, normalizeUploadUrl } from "../lib/uploads-reorganizer.js";
import { registerUploadMetadataRoutes } from "./upload/register-upload-metadata-routes.js";
import { registerUploadListingRoutes } from "./upload/register-upload-list-routes.js";
import { registerUploadManagementRoutes } from "./upload/register-upload-management-routes.js";
import { registerUploadProjectImageRoutes } from "./upload/register-upload-project-image-routes.js";
import { registerUploadStorageRoutes } from "./upload/register-upload-storage-routes.js";

const sanitizeProjectFolderSegment = (createSlug, value) =>
  String(createSlug(String(value || "").trim()) || "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const resolveProjectLibraryFolders = ({ createSlug, project }) => {
  const normalizedId = String(project?.id || "").trim();
  const normalizedSlug = sanitizeProjectFolderSegment(createSlug, project?.title || "");
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

const resolveProjectRootFolder = (folder) => {
  const normalized = String(folder || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!normalized.startsWith("projects/")) {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 2) {
    return "";
  }
  return `${segments[0]}/${segments[1]}`;
};

const resolveVolumeFolderSegment = (volume) => {
  const normalizedVolume = Number.isFinite(Number(volume)) ? Number(volume) : null;
  return normalizedVolume === null ? "volume-sem-volume" : `volume-${normalizedVolume}`;
};

const resolveEpisodeCoverFolder = ({ isChapterBasedType, project, episode, index, folders }) => {
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

const collectUploadUrls = (value, urls) => {
  if (!value) return;
  if (typeof value === "string") {
    extractUploadUrlsFromText(value).forEach((item) => urls.add(item));
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

const getUsedUploadUrls = ({
  loadComments,
  loadLinkTypes,
  loadPages,
  loadPosts,
  loadProjects,
  loadSiteSettings,
  loadUpdates,
  loadUsers,
}) => {
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
    const normalized = normalizeUploadUrl(match);
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

export const registerUploadRoutes = ({
  MAX_SVG_SIZE_BYTES,
  MAX_UPLOAD_SIZE_BYTES,
  PRIMARY_APP_ORIGIN,
  PUBLIC_UPLOADS_DIR,
  STATIC_DEFAULT_CACHE_CONTROL,
  app,
  attachUploadMediaMetadata,
  appendAuditLog,
  buildManagedStorageAreaSummary,
  canManageUploads,
  canUploadImage,
  cleanupUploadStagingWorkspace,
  computeBufferSha256,
  createSlug,
  createUploadStagingWorkspace,
  deleteManagedUploadEntryAssets,
  ensureUploadEntryHasRequiredVariants,
  extractRequestedUploadFocalPayload,
  findUploadByHash,
  getUploadFolderFromUrlValue,
  getUploadExtFromMime,
  getUploadMimeFromExtension,
  getUploadVariantUrlPrefix,
  hasOwnField,
  importRemoteImageFile,
  invalidateUploadsCleanupPreviewCache,
  isChapterBasedType,
  isPrivateUploadFolder,
  isUploadFolderAllowedInScope,
  loadCachedUploadsCleanupPreview,
  loadComments,
  loadLinkTypes,
  loadPages,
  loadPosts,
  loadProjects,
  loadSiteSettings,
  loadUpdates,
  loadUploads,
  loadUsers,
  materializeUploadEntrySourceToStaging,
  normalizeProjects,
  normalizeUploadMime,
  normalizeUploadScopeUserId,
  normalizeVariants,
  persistUploadEntryFromStaging,
  readUploadAltText,
  readUploadFocalState,
  readUploadSlot,
  readUploadSlotManaged,
  readUploadStorageProvider,
  requireAuth,
  resolveIncomingUploadFocalState,
  resolveRequestUploadAccessScope,
  resolveUploadAbsolutePath,
  resolveUploadVariantPresetKeysForArea,
  runUploadsCleanup,
  sanitizeSvg,
  sanitizeUploadBaseName,
  sanitizeUploadFolder,
  sanitizeUploadSlot,
  shouldIncludeUploadInHashDedupe,
  upsertUploadEntries,
  uploadStorageService,
  validateUploadImageBuffer,
  writeComments,
  writeLinkTypes,
  writePages,
  writePosts,
  writeProjects,
  writeSiteSettings,
  writeUploadBufferToStaging,
  writeUpdates,
  writeUploads,
  writeUsers,
} = {}) => {
  registerUploadMetadataRoutes({
    MAX_SVG_SIZE_BYTES,
    MAX_UPLOAD_SIZE_BYTES,
    PRIMARY_APP_ORIGIN,
    PUBLIC_UPLOADS_DIR,
    STATIC_DEFAULT_CACHE_CONTROL,
    app,
    appendAuditLog,
    attachUploadMediaMetadata,
    canManageUploads,
    canUploadImage,
    cleanupUploadStagingWorkspace,
    computeBufferSha256,
    createUploadStagingWorkspace,
    deleteManagedUploadEntryAssets,
    ensureUploadEntryHasRequiredVariants,
    extractRequestedUploadFocalPayload,
    findUploadByHash,
    getUploadExtFromMime,
    hasOwnField,
    isPrivateUploadFolder,
    includeImageRoute: true,
    includeFocalPointRoute: false,
    includeAltTextRoute: false,
    loadUploads,
    materializeUploadEntrySourceToStaging,
    normalizeUploadMime,
    normalizeVariants,
    persistUploadEntryFromStaging,
    readUploadAltText,
    readUploadFocalState,
    readUploadSlot,
    readUploadSlotManaged,
    readUploadStorageProvider,
    requireAuth,
    resolveIncomingUploadFocalState,
    resolveRequestUploadAccessScope,
    resolveUploadVariantPresetKeysForArea,
    sanitizeSvg,
    sanitizeUploadBaseName,
    sanitizeUploadFolder,
    sanitizeUploadSlot,
    shouldIncludeUploadInHashDedupe,
    uploadStorageService,
    validateUploadImageBuffer,
    writeUploadBufferToStaging,
    writeUploads,
  });

  registerUploadListingRoutes({
    app,
    canManageUploads,
    createSlug,
    getUploadMimeFromExtension,
    isUploadFolderAllowedInScope,
    loadComments,
    loadLinkTypes,
    loadPages,
    loadPosts,
    loadProjects,
    loadSiteSettings,
    loadUpdates,
    loadUploads,
    loadUsers,
    normalizeProjects,
    normalizeVariants,
    normalizeUploadScopeUserId,
    readUploadAltText,
    readUploadFocalState,
    readUploadSlot,
    readUploadSlotManaged,
    readUploadStorageProvider,
    requireAuth,
    resolveRequestUploadAccessScope,
    sanitizeUploadFolder,
    PUBLIC_UPLOADS_DIR,
  });

  registerUploadMetadataRoutes({
    MAX_SVG_SIZE_BYTES,
    MAX_UPLOAD_SIZE_BYTES,
    app,
    appendAuditLog,
    attachUploadMediaMetadata,
    canManageUploads,
    canUploadImage,
    cleanupUploadStagingWorkspace,
    computeBufferSha256,
    createUploadStagingWorkspace,
    deleteManagedUploadEntryAssets,
    ensureUploadEntryHasRequiredVariants,
    extractRequestedUploadFocalPayload,
    findUploadByHash,
    getUploadExtFromMime,
    hasOwnField,
    isPrivateUploadFolder,
    includeImageRoute: false,
    includeFocalPointRoute: true,
    includeAltTextRoute: true,
    loadUploads,
    materializeUploadEntrySourceToStaging,
    normalizeUploadMime,
    normalizeVariants,
    persistUploadEntryFromStaging,
    readUploadAltText,
    readUploadFocalState,
    readUploadSlot,
    readUploadSlotManaged,
    readUploadStorageProvider,
    requireAuth,
    resolveIncomingUploadFocalState,
    resolveRequestUploadAccessScope,
    resolveUploadVariantPresetKeysForArea,
    sanitizeSvg,
    sanitizeUploadBaseName,
    sanitizeUploadFolder,
    sanitizeUploadSlot,
    shouldIncludeUploadInHashDedupe,
    uploadStorageService,
    validateUploadImageBuffer,
    writeUploadBufferToStaging,
    writeUploads,
    PUBLIC_UPLOADS_DIR,
    STATIC_DEFAULT_CACHE_CONTROL,
  });

  registerUploadStorageRoutes({
    app,
    appendAuditLog,
    buildManagedStorageAreaSummary,
    canManageUploads,
    invalidateUploadsCleanupPreviewCache,
    loadCachedUploadsCleanupPreview,
    loadComments,
    loadLinkTypes,
    loadPages,
    loadPosts,
    loadProjects,
    loadSiteSettings,
    loadUpdates,
    loadUploads,
    loadUsers,
    requireAuth,
    runUploadsCleanup,
    uploadStorageService,
    writeUploads,
    PUBLIC_UPLOADS_DIR,
  });

  registerUploadProjectImageRoutes({
    app,
    canManageUploads,
    createSlug,
    getUploadFolderFromUrlValue,
    isChapterBasedType,
    loadProjects,
    normalizeProjects,
    requireAuth,
  });

  registerUploadManagementRoutes({
    app,
    appendAuditLog,
    attachUploadMediaMetadata,
    cleanupUploadStagingWorkspace,
    canManageUploads,
    computeBufferSha256,
    createUploadStagingWorkspace,
    deleteManagedUploadEntryAssets,
    ensureUploadEntryHasRequiredVariants,
    extractRequestedUploadFocalPayload,
    getUploadVariantUrlPrefix,
    hasOwnField,
    importRemoteImageFile,
    loadComments,
    loadLinkTypes,
    loadPages,
    loadPosts,
    loadProjects,
    loadSiteSettings,
    loadUpdates,
    loadUploads,
    loadUsers,
    persistUploadEntryFromStaging,
    PRIMARY_APP_ORIGIN,
    normalizeUploadUrl,
    normalizeVariants,
    readUploadFocalState,
    readUploadStorageProvider,
    resolveIncomingUploadFocalState,
    resolveRequestUploadAccessScope,
    resolveUploadAbsolutePath,
    resolveUploadVariantPresetKeysForArea,
    sanitizeUploadBaseName,
    sanitizeUploadFolder,
    shouldIncludeUploadInHashDedupe,
    uploadStorageService,
    requireAuth,
    STATIC_DEFAULT_CACHE_CONTROL,
    PUBLIC_UPLOADS_DIR,
    canUploadImage,
    writeUploads,
  });
};
