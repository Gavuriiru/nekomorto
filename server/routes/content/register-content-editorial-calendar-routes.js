export const registerContentEditorialCalendarRoutes = ({
  app,
  buildEditorialCalendarItems,
  canManagePosts,
  loadPosts,
  normalizePosts,
  requireAuth,
} = {}) => {
  app.get("/api/admin/editorial/calendar", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManagePosts(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const fromRaw = String(req.query.from || "").trim();
    const toRaw = String(req.query.to || "").trim();
    if (!fromRaw || !toRaw) {
      return res.status(400).json({ error: "from_to_required" });
    }
    const fromDate = new Date(`${fromRaw}T00:00:00.000Z`);
    const toDate = new Date(`${toRaw}T23:59:59.999Z`);
    if (
      !Number.isFinite(fromDate.getTime()) ||
      !Number.isFinite(toDate.getTime()) ||
      fromDate > toDate
    ) {
      return res.status(400).json({ error: "invalid_range" });
    }
    const tz = String(
      req.query.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
    );
    const items = buildEditorialCalendarItems(normalizePosts(loadPosts()), {
      fromMs: fromDate.getTime(),
      toMs: toDate.getTime(),
    });
    return res.json({ from: fromRaw, to: toRaw, tz, items });
  });
};

export default registerContentEditorialCalendarRoutes;
