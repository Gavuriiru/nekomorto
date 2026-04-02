import { buildEpisodeUpdateRecords } from "./shared.js";

export const registerProjectWriteManagementRoutes = ({
  app,
  appendAuditLog,
  canManageProjects,
  collectEpisodeUpdatesByVisibility,
  enqueueProjectOgPrewarm,
  isWithinRestoreWindow,
  loadProjects,
  loadUpdates,
  normalizeProjects,
  requireAuth,
  writeProjects,
  writeUpdates,
} = {}) => {
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
        ...item,
        updatedAt: item.updatedAt || new Date().toISOString(),
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const episodeUpdateRecords = buildEpisodeUpdateRecords({
      project,
      updates: episodeUpdates,
    });
    const rebuilt = [...updates, ...episodeUpdateRecords];
    writeUpdates(rebuilt);
    appendAuditLog(req, "projects.rebuild_updates", "projects", { id });
    return res.json({ ok: true, updates: episodeUpdates.length });
  });
};

export default registerProjectWriteManagementRoutes;
