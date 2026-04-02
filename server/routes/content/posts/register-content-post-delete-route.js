import { ensurePostManagerSessionUser, findPostIndexById } from "./shared.js";

export const registerContentPostDeleteRoute = ({
  app,
  appendAuditLog,
  canManagePosts,
  isWithinRestoreWindow,
  loadPosts,
  normalizePosts,
  requireAuth,
  writePosts,
} = {}) => {
  app.delete("/api/posts/:id", requireAuth, (req, res) => {
    const sessionUser = ensurePostManagerSessionUser({ canManagePosts, req, res });
    if (!sessionUser) {
      return;
    }

    const { id } = req.params;
    const posts = normalizePosts(loadPosts());
    const index = findPostIndexById(posts, id);
    if (index === -1) {
      return res.status(404).json({ error: "not_found" });
    }
    const existing = posts[index];
    if (existing.deletedAt && !isWithinRestoreWindow(existing.deletedAt)) {
      const next = posts.filter((post) => post.id !== String(id));
      writePosts(next);
      appendAuditLog(req, "posts.delete.final", "posts", { id });
      return res.json({ ok: true });
    }
    if (!existing.deletedAt) {
      posts[index] = {
        ...existing,
        deletedAt: new Date().toISOString(),
        deletedBy: sessionUser?.id || null,
        updatedAt: new Date().toISOString(),
      };
      writePosts(posts);
      appendAuditLog(req, "posts.delete", "posts", { id });
    }
    return res.json({ ok: true });
  });
};

export default registerContentPostDeleteRoute;
