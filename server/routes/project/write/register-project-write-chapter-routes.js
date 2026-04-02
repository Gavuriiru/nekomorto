import {
  finalizeProjectMutation,
  prepareLocalizedProjectMutation,
  writeProjectMutationUpdates,
} from "./shared.js";

export const registerProjectWriteChapterRoutes = ({
  PUBLIC_UPLOADS_DIR,
  app,
  appendAuditLog,
  applyEpisodePublicationMetadata,
  applyProjectChapterUpdate,
  canManageProjects,
  collectEpisodeUpdatesByVisibility,
  createRevisionToken,
  dispatchEditorialWebhookEvent,
  enqueueProjectOgPrewarm,
  ensureNoEditConflict,
  findDuplicateEpisodeKey,
  findDuplicateVolumeCover,
  findProjectChapterByEpisodeNumber,
  findPublishedImageEpisodeWithoutPages,
  importRemoteImageFile,
  loadProjects,
  loadUpdates,
  localizeProjectImageFields,
  normalizeProjects,
  parseEditRevisionOptions,
  requireAuth,
  resolveEpisodeLookup,
  resolveProjectWebhookEventKey,
  runAutoUploadReorganization,
  upsertUploadEntries,
  writeProjects,
  writeUpdates,
} = {}) => {
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
    const localizedUpdate = await prepareLocalizedProjectMutation({
      PUBLIC_UPLOADS_DIR,
      findDuplicateEpisodeKey,
      findDuplicateVolumeCover,
      findPublishedImageEpisodeWithoutPages,
      importRemoteImageFile,
      localizeProjectImageFields,
      normalizeProjects,
      project: mergedRaw,
      requireImagePagesForPublication: true,
      upsertUploadEntries,
    });
    if (!localizedUpdate.ok) {
      return res.status(localizedUpdate.status).json(localizedUpdate.body);
    }
    const merged = applyEpisodePublicationMetadata(existing, localizedUpdate.project, now);

    projects[index] = merged;
    writeProjects(projects);
    appendAuditLog(req, "projects.chapter.update", "projects", {
      id: merged.id,
      chapterNumber,
      volume: Number.isFinite(Number(volume)) ? Number(volume) : null,
      count: localizedUpdate.summary.downloaded,
      failures: localizedUpdate.summary.failed,
    });

    const webhookUpdates = writeProjectMutationUpdates({
      collectEpisodeUpdatesByVisibility,
      currentProject: merged,
      loadUpdates,
      now,
      previousProject: existing,
      writeUpdates,
    });
    const persistedProject = await finalizeProjectMutation({
      dispatchEditorialWebhookEvent,
      enqueueProjectOgPrewarm,
      findProjectChapterByEpisodeNumber,
      loadProjects,
      mutationReason: "project-chapter-update",
      normalizeProjects,
      project: merged,
      req,
      resolveProjectWebhookEventKey,
      runAutoUploadReorganization,
      updates: webhookUpdates,
    });

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
};

export default registerProjectWriteChapterRoutes;
