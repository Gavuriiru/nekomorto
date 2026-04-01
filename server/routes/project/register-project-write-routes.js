import crypto from "crypto";
import fs from "fs";
import path from "path";

export const registerProjectWriteRoutes = ({ app, PUBLIC_UPLOADS_DIR, appendAuditLog, applyEpisodePublicationMetadata, applyProjectChapterUpdate, canManageIntegrations, canManageProjects, collectEpisodeUpdatesByVisibility, createRevisionToken, deriveAniListMediaOrganization, dispatchEditorialWebhookEvent, enqueueProjectOgPrewarm, ensureNoEditConflict, fetchAniListMediaById, findDuplicateEpisodeKey, findDuplicateVolumeCover, findProjectChapterByEpisodeNumber, findPublishedImageEpisodeWithoutPages, importRemoteImageFile, isWithinRestoreWindow, localizeProjectImageFields, loadProjects, loadUpdates, loadUploads, mapProjectImageImportExecutionError, normalizeProjectSnapshotForEpubImport, normalizeProjects, parseEditRevisionOptions, requireAuth, resolveEpisodeLookup, resolveProjectWebhookEventKey, runAutoUploadReorganization, writeProjects, writeUpdates, upsertUploadEntries } = {}) => {
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
          ...(result.data?.data && typeof result.data.data === "object"
            ? result.data.data
            : {}),
          Media: media,
        },
      });
    } catch {
      return res.status(502).json({ error: "anilist_failed" });
    }
  });
};
