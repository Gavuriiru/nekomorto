import crypto from "crypto";

export const registerProjectEpubRoutes = ({ app, PUBLIC_UPLOADS_DIR, canManageProjects, cleanupProjectEpubImportTempUploads, enqueueEpubImportJob, exportProjectEpub, findDuplicateEpisodeKey, findDuplicateVolumeCover, findEpubImportJobForUser, importProjectEpub, isEpubImportJobStorageAvailable, loadProjects, loadSiteSettings, loadUploads, mapEpubImportExecutionError, normalizeProjectSnapshotForEpubImport, normalizeProjects, parseEpubImportRequestBody, readEpubImportJobResult, requireAuth, resolveEpubImportRequestInput, toEpubImportJobApiResponse, upsertEpubImportJob, writeUploads, getUsedUploadUrls } = {}) => {
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
};
