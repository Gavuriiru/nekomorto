import crypto from "crypto";
import fs from "fs";
import path from "path";
import { extractUploadUrlsFromText, normalizeUploadUrl } from "../lib/uploads-reorganizer.js";

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

const collectProjectImageItems = ({
  createSlug,
  getUploadFolderFromUrlValue,
  isChapterBasedType,
  projects,
}) => {
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
    extractUploadUrlsFromText(value).forEach((uploadUrl) => {
      push(project, uploadUrl, kind, label, folder);
    });
  };

  projects.forEach((project) => {
    const folders = resolveProjectLibraryFolders({ createSlug, project });
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
        const episodeFolder = resolveEpisodeCoverFolder({
          isChapterBasedType,
          project,
          episode,
          index,
          folders,
        });
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

const loadUploadsCleanupDatasets = ({
  loadComments,
  loadLinkTypes,
  loadPages,
  loadPosts,
  loadProjects,
  loadSiteSettings,
  loadUpdates,
  loadUploads,
  loadUsers,
}) => ({
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
    const uploadsDir = PUBLIC_UPLOADS_DIR;
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
    const uploadsDir = PUBLIC_UPLOADS_DIR;
    const recursive = String(req.query.recursive || "")
      .trim()
      .toLowerCase();
    const listRecursively =
      listAll || (Boolean(folder) && (recursive === "1" || recursive === "true"));
    try {
      const normalizedProjects = normalizeProjects(loadProjects());
      const projectTitleByRoot = new Map(
        normalizedProjects
          .map((project) => {
            const projectRootFolder = resolveProjectLibraryFolders({
              createSlug,
              project,
            }).projectRootFolder;
            return [projectRootFolder, String(project?.title || "").trim()];
          })
          .filter(([projectRootFolder, projectTitle]) => Boolean(projectRootFolder && projectTitle)),
      );
      const usedUrls = getUsedUploadUrls({
        loadComments,
        loadLinkTypes,
        loadPages,
        loadPosts,
        loadProjects: () => normalizedProjects,
        loadSiteSettings,
        loadUpdates,
        loadUsers,
      });
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
          const projectRootFolder = resolveProjectRootFolder(resolvedFolder);
          const projectId = projectRootFolder ? String(projectRootFolder.split("/")[1] || "") : "";
          const projectTitle = projectTitleByRoot.get(projectRootFolder) || "";
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
            projectId,
            projectTitle,
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
          const projectRootFolder = resolveProjectRootFolder(resolvedFolder);
          const projectId = projectRootFolder ? String(projectRootFolder.split("/")[1] || "") : "";
          const projectTitle = projectTitleByRoot.get(projectRootFolder) || "";
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
              projectId,
              projectTitle,
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
    const uploadsDir = PUBLIC_UPLOADS_DIR;
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
        datasets: loadUploadsCleanupDatasets({
          loadComments,
          loadLinkTypes,
          loadPages,
          loadPosts,
          loadProjects,
          loadSiteSettings,
          loadUpdates,
          loadUploads,
          loadUsers,
        }),
        uploadsDir: PUBLIC_UPLOADS_DIR,
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
        datasets: loadUploadsCleanupDatasets({
          loadComments,
          loadLinkTypes,
          loadPages,
          loadPosts,
          loadProjects,
          loadSiteSettings,
          loadUpdates,
          loadUploads,
          loadUsers,
        }),
        uploadsDir: PUBLIC_UPLOADS_DIR,
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

  app.get("/api/uploads/project-images", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageUploads(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const projects = normalizeProjects(loadProjects());
    return res.json({
      items: collectProjectImageItems({
        createSlug,
        getUploadFolderFromUrlValue,
        isChapterBasedType,
        projects,
      }),
    });
  });

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
      if (settingsResult.count > 0) writeSiteSettings(settingsResult.value);

      const postsResult = replaceUploadReferencesDeep(loadPosts(), normalized, nextUrl);
      pushResult("posts", postsResult);
      if (postsResult.count > 0) writePosts(postsResult.value);

      const projectsResult = replaceUploadReferencesDeep(loadProjects(), normalized, nextUrl);
      pushResult("projects", projectsResult);
      if (projectsResult.count > 0) writeProjects(projectsResult.value);

      const usersResult = replaceUploadReferencesDeep(loadUsers(), normalized, nextUrl);
      pushResult("users", usersResult);
      if (usersResult.count > 0) writeUsers(usersResult.value);

      const pagesResult = replaceUploadReferencesDeep(loadPages(), normalized, nextUrl);
      pushResult("pages", pagesResult);
      if (pagesResult.count > 0) writePages(pagesResult.value);

      const commentsResult = replaceUploadReferencesDeep(loadComments(), normalized, nextUrl);
      pushResult("comments", commentsResult);
      if (commentsResult.count > 0) writeComments(commentsResult.value);

      const updatesResult = replaceUploadReferencesDeep(loadUpdates(), normalized, nextUrl);
      pushResult("updates", updatesResult);
      if (updatesResult.count > 0) writeUpdates(updatesResult.value);

      const linkTypesResult = replaceUploadReferencesDeep(loadLinkTypes(), normalized, nextUrl);
      pushResult("link_types", linkTypesResult);
      if (linkTypesResult.count > 0) writeLinkTypes(linkTypesResult.value);

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

    const usedUrls = getUsedUploadUrls({
      loadComments,
      loadLinkTypes,
      loadPages,
      loadPosts,
      loadProjects,
      loadSiteSettings,
      loadUpdates,
      loadUsers,
    });
    if (usedUrls.has(normalized)) {
      return res.status(409).json({ error: "in_use" });
    }

    try {
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
    const uploadsDir = PUBLIC_UPLOADS_DIR;
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
};
