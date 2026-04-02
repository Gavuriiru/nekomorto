export const registerPublicUpdateRoutes = ({
  app,
  getPublicVisibleUpdates,
} = {}) => {
  app.get("/api/public/updates", (req, res) => {
    const limitRaw = Number(req.query.limit);
    const pageRaw = Number(req.query.page);
    const usePagination = Number.isFinite(limitRaw) || Number.isFinite(pageRaw);
    const limit = usePagination ? Math.min(Math.max(limitRaw || 10, 1), 50) : 10;
    const page = usePagination ? Math.max(pageRaw || 1, 1) : 1;
    const updates = getPublicVisibleUpdates();
    if (!usePagination) {
      return res.json({ updates: updates.slice(0, limit) });
    }
    const start = (page - 1) * limit;
    const paged = updates.slice(start, start + limit);
    return res.json({ updates: paged, page, limit, total: updates.length });
  });
};

export default registerPublicUpdateRoutes;
