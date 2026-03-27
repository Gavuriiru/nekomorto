import crypto from "crypto";
import fs from "fs";
import path from "path";

export const registerProjectRoutes = ({
  PRIMARY_APP_ORIGIN,
  PUBLIC_UPLOADS_DIR,
  app,
  appendAuditLog,
  applyEpisodePublicationMetadata,
  applyProjectChapterUpdate,
  buildProjectImageExportDownloadPath,
  canManageIntegrations,
  canManageProjects,
  cleanupProjectEpubImportTempUploads,
  collectEpisodeUpdatesByVisibility,
  createRevisionToken,
  deriveAniListMediaOrganization,
  dispatchEditorialWebhookEvent,
  enqueueEpubImportJob,
  enqueueProjectImageExportJob,
  enqueueProjectImageImportJob,
  enqueueProjectOgPrewarm,
  ensureNoEditConflict,
  expireEpubImportJob,
  expireProjectImageExportJob,
  expireProjectImageImportJob,
  exportProjectEpub,
  exportProjectImageChapter,
  fetchAniListMediaById,
  findDuplicateEpisodeKey,
  findDuplicateVolumeCover,
  findEpubImportJobForUser,
  findProjectChapterByEpisodeNumber,
  findProjectImageExportJobForUser,
  findProjectImageImportJobForUser,
  findPublishedImageEpisodeWithoutPages,
  getActiveProjectTypes,
  getUsedUploadUrls,
  importProjectEpub,
  importRemoteImageFile,
  isEpubImportJobStorageAvailable,
  isProjectImageExportJobStorageAvailable,
  isProjectImageImportJobStorageAvailable,
  isWithinRestoreWindow,
  localizeProjectImageFields,
  loadProjects,
  loadSiteSettings,
  loadUpdates,
  loadUploads,
  mapEpubImportExecutionError,
  mapProjectImageImportExecutionError,
  normalizeProjectSnapshotForEpubImport,
  normalizeProjects,
  parseEditRevisionOptions,
  parseEpubImportRequestBody,
  parseProjectImageImportRequestBody,
  previewProjectImageImport,
  readEpubImportJobResult,
  readProjectImageImportJobResult,
  requireAuth,
  resolveEpisodeLookup,
  resolveEpubImportRequestInput,
  resolveProjectImageImportRequestInput,
  resolveProjectWebhookEventKey,
  runAutoUploadReorganization,
  toEpubImportJobApiResponse,
  toProjectImageExportJobApiResponse,
  toProjectImageImportJobApiResponse,
  upsertEpubImportJob,
  upsertProjectImageExportJob,
  upsertProjectImageImportJob,
  upsertUploadEntries,
  writeProjects,
  writeUpdates,
  writeUploads,
} = {}) => {
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
        uploadsDir: PUBLIC_UPLOADS_DIR,
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
      uploadsDir: PUBLIC_UPLOADS_DIR,
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
      res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
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
        uploadsDir: PUBLIC_UPLOADS_DIR,
      });
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename=\"${result.filename}\"`);
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
    res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
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
          uploadsDir: PUBLIC_UPLOADS_DIR,
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
    const nextUpdates =
      episodeUpdateRecords.length > 0 ? [...updates, ...episodeUpdateRecords] : updates;
    const webhookUpdates = [...episodeWebhookUpdates];
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
          uploadsDir: PUBLIC_UPLOADS_DIR,
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
          uploadsDir: PUBLIC_UPLOADS_DIR,
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
    const nextUpdates =
      episodeUpdateRecords.length > 0 ? [...updates, ...episodeUpdateRecords] : updates;
    const webhookUpdates = [...episodeWebhookUpdates];
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
};
