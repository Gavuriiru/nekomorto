export const registerProjectWriteAniListRoutes = ({
  app,
  canManageIntegrations,
  deriveAniListMediaOrganization,
  fetchAniListMediaById,
  requireAuth,
} = {}) => {
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

export default registerProjectWriteAniListRoutes;
