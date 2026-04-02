import { ensurePostManagerSessionUser, findPostIndexById } from "./shared.js";

export const registerContentPostRestoreRoute = ({
  app,
  appendAuditLog,
  canManagePosts,
  isWithinRestoreWindow,
  loadPosts,
  normalizePosts,
  requireAuth,
  writePosts,
} = {}) => {
  app.post("/api/posts/:id/restore", requireAuth, (req, res) => {
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
    if (!existing.deletedAt) {
      return res.json({ post: existing });
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
    posts[index] = restored;
    writePosts(posts);
    appendAuditLog(req, "posts.restore", "posts", { id });
    return res.json({ post: restored });
  });
};

export default registerContentPostRestoreRoute;
