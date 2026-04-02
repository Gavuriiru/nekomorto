import { ensurePostVersionManagerSessionUser } from "./shared.js";

export const registerContentPostVersionListRoute = ({
  app,
  canManagePosts,
  listPostVersions,
  loadPosts,
  normalizePosts,
  postVersionReasonLabel,
  requireAuth,
} = {}) => {
  app.get("/api/admin/content/post/:id/versions", requireAuth, (req, res) => {
    const sessionUser = ensurePostVersionManagerSessionUser({ canManagePosts, req, res });
    if (!sessionUser) {
      return;
    }
    const postId = String(req.params.id || "").trim();
    if (!postId) {
      return res.status(400).json({ error: "post_id_required" });
    }
    const posts = normalizePosts(loadPosts());
    const post = posts.find((item) => item.id === postId);
    if (!post) {
      return res.status(404).json({ error: "not_found" });
    }
    const limit = Number(req.query.limit);
    const cursor = req.query.cursor ? String(req.query.cursor) : "";
    const result = listPostVersions(postId, { limit, cursor });
    return res.json({
      postId,
      versions: result.versions.map((version) => ({
        ...version,
        reasonLabel: postVersionReasonLabel(version.reason),
      })),
      nextCursor: result.nextCursor || null,
    });
  });
};

export default registerContentPostVersionListRoute;
