export const registerContentLinkTypeRoutes = ({
  app,
  canManageSettings,
  collectLinkTypeIconUploads,
  createRevisionToken,
  deletePrivateUploadByUrl,
  ensureNoEditConflict,
  loadLinkTypes,
  normalizeLinkTypes,
  parseEditRevisionOptions,
  requireAuth,
  writeLinkTypes,
} = {}) => {
  app.get("/api/link-types", (_req, res) => {
    const items = loadLinkTypes();
    const revision = createRevisionToken(items);
    res.json({ items, revision });
  });

  app.put("/api/link-types", requireAuth, (req, res) => {
    if (!canManageSettings(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const options = parseEditRevisionOptions(req.body);
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items_required" });
    }
    const previousLinkTypes = loadLinkTypes();
    const currentRevision = createRevisionToken(previousLinkTypes);
    const noConflict = ensureNoEditConflict({
      req,
      res,
      resourceType: "link_types",
      resourceId: "global",
      current: previousLinkTypes,
      currentRevision,
      options,
    });
    if (!noConflict) {
      return noConflict;
    }
    const previousIcons = collectLinkTypeIconUploads(previousLinkTypes);
    const normalized = normalizeLinkTypes(items);
    writeLinkTypes(normalized);
    const nextIcons = collectLinkTypeIconUploads(normalized);
    const removedIcons = Array.from(previousIcons).filter((url) => !nextIcons.has(url));
    removedIcons.forEach((url) => deletePrivateUploadByUrl(url));
    return res.json({ items: normalized, revision: createRevisionToken(normalized) });
  });
};

export default registerContentLinkTypeRoutes;
