import path from "path";
import fs from "fs";
import { getUsedUploadUrls, replaceUploadReferencesDeep } from "./upload-route-utils.js";
import { normalizeUploadUrl } from "../../lib/uploads-reorganizer.js";

export const registerUploadManagementRoutes = (deps) => {
  const {
    app,
    appendAuditLog,
    canManageUploads,
    computeBufferSha256,
    createUploadStagingWorkspace,
    deleteManagedUploadEntryAssets,
    ensureUploadEntryHasRequiredVariants,
    extractRequestedUploadFocalPayload,
    getUploadVariantUrlPrefix,
    hasOwnField,
    importRemoteImageFile,
    isPrivateUploadFolder,
    loadComments,
    loadLinkTypes,
    loadPages,
    loadPosts,
    loadProjects,
    loadSiteSettings,
    loadUpdates,
    loadUploads,
    loadUsers,
    normalizeUploadUrl,
    normalizeUploadBaseName,
    normalizeUploadFolder,
    normalizeUploadMime,
    normalizeUploadScopeUserId,
    normalizeVariants,
    readUploadAltText,
    readUploadFocalState,
    readUploadSlot,
    readUploadSlotManaged,
    readUploadStorageProvider,
    getRequestIp,
    resolveIncomingUploadFocalState,
    resolveProjectImageImportRequestInput,
    resolveRequestUploadAccessScope,
    resolveUploadAbsolutePath,
    resolveUploadVariantPresetKeysForArea,
    sanitizeUploadBaseName,
    sanitizeUploadFolder,
    shouldIncludeUploadInHashDedupe,
    uploadStorageService,
    writeComments,
    writeLinkTypes,
    writePages,
    writePosts,
    writeProjects,
    writeSiteSettings,
    writeUpdates,
    writeUploads,
    writeUsers,
  } = deps;

  app.put("/api/uploads/rename", deps.requireAuth, async (req, res) => {
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
      const parsed = new URL(normalized, deps.PRIMARY_APP_ORIGIN);
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

  app.delete("/api/uploads/delete", deps.requireAuth, async (req, res) => {
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

  app.post("/api/uploads/image-from-url", deps.requireAuth, async (req, res) => {
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
    const ip = typeof getRequestIp === "function" ? getRequestIp(req) : String(req?.ip || "");
    if (!(await deps.canUploadImage(ip))) {
      return res.status(429).json({ error: "rate_limited" });
    }

    const remoteUrl = String(req.body?.url || "").trim();
    const uploadsDir = deps.PUBLIC_UPLOADS_DIR;
    const activeStorageProvider = uploadStorageService.activeProvider;
    const stagingWorkspace = createUploadStagingWorkspace();
    const importResult = await importRemoteImageFile({
      remoteUrl,
      folder: safeFolder,
      uploadsDir: stagingWorkspace.uploadsDir,
      timeoutMs: 20_000,
    });
    if (!importResult.ok) {
      deps.cleanupUploadStagingWorkspace(stagingWorkspace);
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
      deps.cleanupUploadStagingWorkspace(stagingWorkspace);
      return res.status(500).json({ error: "imported_file_not_found" });
    }

    let hashSha256 = "";
    try {
      const importedBuffer = fs.readFileSync(sourcePath);
      hashSha256 = computeBufferSha256(importedBuffer);
    } catch {
      deps.cleanupUploadStagingWorkspace(stagingWorkspace);
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
        requiredVariantPresetKeys: deps.resolveUploadVariantPresetKeysForArea(safeFolder),
      });
      const resolvedDedupeEntry = dedupeResolution.entry;
      const dedupeFocalState = readUploadFocalState(resolvedDedupeEntry);
      deps.cleanupUploadStagingWorkspace(stagingWorkspace);
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

    let enrichedEntry;
    let variantsGenerated = true;
    let variantGenerationError = "";
    try {
      enrichedEntry = await deps.attachUploadMediaMetadata({
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
      await deps.persistUploadEntryFromStaging({
        storageService: uploadStorageService,
        entry: enrichedEntry,
        uploadsDir: stagingWorkspace.uploadsDir,
        provider: activeStorageProvider,
        cacheControl: deps.STATIC_DEFAULT_CACHE_CONTROL,
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
          cacheControl: deps.STATIC_DEFAULT_CACHE_CONTROL,
        });
      } catch {
        deps.cleanupUploadStagingWorkspace(stagingWorkspace);
        return res.status(500).json({ error: "upload_persist_failed" });
      }
    }

    deps.cleanupUploadStagingWorkspace(stagingWorkspace);

    const nextUploads = uploads.filter(
      (item) => String(item?.url || "") !== String(entry?.url || ""),
    );
    nextUploads.push(enrichedEntry);
    writeUploads(nextUploads);
    appendAuditLog(req, "uploads.image_from_url", "uploads", {
      uploadId: enrichedEntry.id,
      url: enrichedEntry.url,
      remoteUrl,
      folder: enrichedEntry.folder || "",
      hashSha256,
      dedupeHit: false,
      variantBytes: Number(enrichedEntry?.variantBytes || 0),
    });
    const uploadFocalState = readUploadFocalState(enrichedEntry);
    return res.json({
      uploadId: enrichedEntry.id,
      url: enrichedEntry.url,
      fileName: enrichedEntry.fileName,
      hashSha256,
      dedupeHit: false,
      focalCrops: uploadFocalState.focalCrops,
      focalPoints: uploadFocalState.focalPoints,
      focalPoint: uploadFocalState.focalPoint,
      variants: normalizeVariants(enrichedEntry.variants),
      area: enrichedEntry.area || "",
      variantsGenerated,
      ...(variantGenerationError ? { variantGenerationError } : {}),
    });
  });
};
