import { ensurePostVersionManagerSessionUser } from "./shared.js";

export const registerContentPostManualVersionRoute = ({
  app,
  appendAuditLog,
  appendPostVersion,
  canManagePosts,
  loadPosts,
  normalizePosts,
  postVersionReasonLabel,
  requireAuth,
} = {}) => {
  app.post("/api/admin/content/post/:id/version", requireAuth, (req, res) => {
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
    const label =
      typeof req.body?.label === "string" && req.body.label.trim()
        ? String(req.body.label).trim()
        : null;
    const version = appendPostVersion({
      post,
      reason: "manual",
      label,
      actor: req.session?.user || null,
    });
    appendAuditLog(req, "posts.version.create", "posts", {
      id: post.id,
      slug: post.slug,
      versionId: version?.id || null,
      reason: "manual",
      label,
    });
    return res.json({
      ok: true,
      version: version
        ? {
            ...version,
            reasonLabel: postVersionReasonLabel(version.reason),
          }
        : null,
    });
  });
};

export default registerContentPostManualVersionRoute;
