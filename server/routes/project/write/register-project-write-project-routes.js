import {
  finalizeProjectMutation,
  prepareLocalizedProjectMutation,
  writeProjectMutationUpdates,
} from "./shared.js";

export const registerProjectWriteProjectRoutes = ({
  PUBLIC_UPLOADS_DIR,
  app,
  appendAuditLog,
  applyEpisodePublicationMetadata,
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
  resolveProjectWebhookEventKey,
  runAutoUploadReorganization,
  upsertUploadEntries,
  writeProjects,
  writeUpdates,
} = {}) => {
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
    const localizedUpdate = await prepareLocalizedProjectMutation({
      PUBLIC_UPLOADS_DIR,
      existingProject: existing,
      findDuplicateEpisodeKey,
      findDuplicateVolumeCover,
      findPublishedImageEpisodeWithoutPages,
      importRemoteImageFile,
      localizeProjectImageFields,
      normalizeProjects,
      project: mergedRaw,
      requirePublicContentForPublication: true,
      requireImagePagesForPublication: true,
      upsertUploadEntries,
    });
    if (!localizedUpdate.ok) {
      return res.status(localizedUpdate.status).json(localizedUpdate.body);
    }
    const merged = applyEpisodePublicationMetadata(existing, localizedUpdate.project, now);

    projects[index] = merged;
    writeProjects(projects);
    appendAuditLog(req, "projects.update", "projects", {
      id: merged.id,
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
      mutationReason: "project-update",
      normalizeProjects,
      project: merged,
      req,
      resolveProjectWebhookEventKey,
      runAutoUploadReorganization,
      updates: webhookUpdates,
    });
    return res.json({
      project: {
        ...persistedProject,
        revision: createRevisionToken(persistedProject),
      },
    });
  });
};

export default registerProjectWriteProjectRoutes;
