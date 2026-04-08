import {
  finalizeProjectMutation,
  prepareLocalizedProjectMutation,
  writeProjectMutationUpdates,
} from "./shared.js";

export const registerProjectWriteCreateRoutes = ({
  PUBLIC_UPLOADS_DIR,
  app,
  appendAuditLog,
  applyEpisodePublicationMetadata,
  canManageProjects,
  collectEpisodeUpdatesByVisibility,
  dispatchEditorialWebhookEvent,
  enqueueProjectOgPrewarm,
  findDuplicateEpisodeKey,
  findDuplicateVolumeCover,
  findProjectChapterByEpisodeNumber,
  importRemoteImageFile,
  loadProjects,
  loadUpdates,
  localizeProjectImageFields,
  normalizeProjects,
  requireAuth,
  resolveProjectWebhookEventKey,
  runAutoUploadReorganization,
  upsertUploadEntries,
  writeProjects,
  writeUpdates,
} = {}) => {
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
    const localizedCreate = await prepareLocalizedProjectMutation({
      PUBLIC_UPLOADS_DIR,
      findDuplicateEpisodeKey,
      findDuplicateVolumeCover,
      importRemoteImageFile,
      localizeProjectImageFields,
      normalizeProjects,
      project: nextProjectRaw,
      requirePublicContentForPublication: true,
      upsertUploadEntries,
    });
    if (!localizedCreate.ok) {
      return res.status(localizedCreate.status).json(localizedCreate.body);
    }
    const nextProject = applyEpisodePublicationMetadata(null, localizedCreate.project, now);

    projects.push(nextProject);
    writeProjects(projects);
    appendAuditLog(req, "projects.create", "projects", {
      id: nextProject.id,
      count: localizedCreate.summary.downloaded,
      failures: localizedCreate.summary.failed,
    });

    const webhookUpdates = writeProjectMutationUpdates({
      collectEpisodeUpdatesByVisibility,
      currentProject: nextProject,
      loadUpdates,
      now,
      previousProject: null,
      writeUpdates,
    });
    const persistedProject = await finalizeProjectMutation({
      dispatchEditorialWebhookEvent,
      enqueueProjectOgPrewarm,
      findProjectChapterByEpisodeNumber,
      loadProjects,
      mutationReason: "project-create",
      normalizeProjects,
      project: nextProject,
      req,
      resolveProjectWebhookEventKey,
      runAutoUploadReorganization,
      updates: webhookUpdates,
    });

    return res.status(201).json({ project: persistedProject });
  });
};

export default registerProjectWriteCreateRoutes;
