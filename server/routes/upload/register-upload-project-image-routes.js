import { collectProjectImageItems } from "./upload-route-utils.js";

export const registerUploadProjectImageRoutes = (deps) => {
  const { app, canManageUploads, createSlug, getUploadFolderFromUrlValue, isChapterBasedType, loadProjects, normalizeProjects } = deps;

  app.get("/api/uploads/project-images", deps.requireAuth, (req, res) => {
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
};
