import crypto from "crypto";

export const registerProjectMangaRoutes = ({
  app,
  PUBLIC_UPLOADS_DIR,
  appendAuditLog,
  applyEpisodePublicationMetadata,
  applyProjectChapterUpdate,
  buildProjectImageExportDownloadPath,
  canManageIntegrations,
  canManageProjects,
  createRevisionToken,
  deriveAniListMediaOrganization,
  dispatchEditorialWebhookEvent,
  enqueueProjectImageExportJob,
  enqueueProjectImageImportJob,
  enqueueProjectOgPrewarm,
  ensureNoEditConflict,
  expireProjectImageExportJob,
  expireProjectImageImportJob,
  exportProjectImageChapter,
  fetchAniListMediaById,
  findDuplicateEpisodeKey,
  findDuplicateVolumeCover,
  findProjectChapterByEpisodeNumber,
  findProjectImageExportJobForUser,
  findProjectImageImportJobForUser,
  findPublishedImageEpisodeWithoutPages,
  getActiveProjectTypes,
  importRemoteImageFile,
  isProjectImageExportJobStorageAvailable,
  isProjectImageImportJobStorageAvailable,
  isWithinRestoreWindow,
  localizeProjectImageFields,
  loadProjects,
  loadSiteSettings,
  loadUpdates,
  loadUploads,
  mapProjectImageImportExecutionError,
  normalizeProjectSnapshotForEpubImport,
  normalizeProjects,
  parseEditRevisionOptions,
  parseProjectImageImportRequestBody,
  previewProjectImageImport,
  readProjectImageImportJobResult,
  requireAuth,
  resolveEpisodeLookup,
  resolveProjectImageImportRequestInput,
  resolveProjectWebhookEventKey,
  runAutoUploadReorganization,
  toProjectImageExportJobApiResponse,
  toProjectImageImportJobApiResponse,
  upsertProjectImageExportJob,
  upsertProjectImageImportJob,
  upsertUploadEntries,
  writeProjects,
  writeUpdates,
  writeUploads,
} = {}) => {
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
      String(summary.filename || "").trim() ||
      path.basename(String(job.resultPath || "export.zip"));
    const contentType = String(summary.contentType || "").trim() || "application/zip";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
    return res.sendFile(path.resolve(job.resultPath));
  });
};
