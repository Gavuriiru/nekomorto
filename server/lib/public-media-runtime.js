import {
  collectUploadUrlsDeep,
  collectUploadUrlsFromDatasets,
} from "./upload-reference-utils.js";

export const createPublicMediaRuntime = ({
  backgroundJobQueue,
  extractUploadUrlsFromText,
  getPublicVisibleProjects,
  getUploadFolderFromUrlValue,
  isPrivateUploadFolder,
  loadComments,
  loadLinkTypes,
  loadPages,
  loadPosts,
  loadProjects,
  loadSiteSettings,
  loadTagTranslations,
  loadUpdates,
  loadUploads,
  loadUsers,
  normalizeUploadUrl,
  normalizeUploadUrlValue,
  normalizeVariants,
  ogRenderCache,
  prewarmProjectOgCache,
  primaryAppOrigin,
  publicUploadsDir,
  readUploadFocalState,
  readUploadStorageProvider,
  resolveExistingPublicVariantUrl,
  sanitizePublicMediaVariantEntry,
  shouldExposePublicUploadInMediaVariants,
} = {}) => {
  const collectPublicUploadUrls = (value, urls, seen = new WeakSet()) => {
    return collectUploadUrlsDeep(value, urls, {
      normalizeDirectUrl: normalizeUploadUrlValue,
      trackObjects: true,
      seen,
    });
  };

  const getUsedUploadUrls = () => {
    return collectUploadUrlsFromDatasets(
      {
        loadComments,
        loadLinkTypes,
        loadPages,
        loadPosts,
        loadProjects,
        loadSiteSettings,
        loadUpdates,
        loadUsers,
      },
      {
        normalizeDirectUrl: normalizeUploadUrl,
        extractTextUrls: extractUploadUrlsFromText,
      },
    );
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
          uploadsDir: publicUploadsDir,
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
      uploadsDir: publicUploadsDir,
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
          origin: primaryAppOrigin,
          resolveVariantUrl: resolveMetaImageVariantUrl,
          ogRenderCache,
        });
      },
    });

  const MAX_PROJECT_OG_LOG_USER_AGENT_LENGTH = 200;

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

  return {
    buildPublicMediaVariants,
    collectDownloadIconUploads,
    collectLinkTypeIconUploads,
    enqueueProjectOgPrewarm,
    getUsedUploadUrls,
    logProjectOgDelivery,
    resolveMetaImageVariantUrl,
  };
};
