export const registerProjectCatalogRoutes = ({
  app,
  canManageProjects,
  createRevisionToken,
  getActiveProjectTypes,
  loadProjects,
  normalizeProjects,
  requireAuth,
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
};
