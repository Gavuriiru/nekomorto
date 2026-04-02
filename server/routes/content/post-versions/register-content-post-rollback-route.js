import { ensurePostVersionManagerSessionUser } from "./shared.js";

export const registerContentPostRollbackRoute = ({
  app,
  appendAuditLog,
  appendPostVersion,
  applyPostSnapshotForRollback,
  canManagePosts,
  loadPostVersions,
  loadPosts,
  normalizePosts,
  requireAuth,
  runAutoUploadReorganization,
  writePosts,
} = {}) => {
  app.post("/api/admin/content/post/:id/rollback", requireAuth, async (req, res) => {
    const sessionUser = ensurePostVersionManagerSessionUser({ canManagePosts, req, res });
    if (!sessionUser) {
      return;
    }
    const postId = String(req.params.id || "").trim();
    const versionId = String(req.body?.versionId || "").trim();
    if (!postId || !versionId) {
      return res.status(400).json({ error: "version_id_required" });
    }
    const posts = normalizePosts(loadPosts());
    const index = posts.findIndex((item) => item.id === postId);
    if (index === -1) {
      return res.status(404).json({ error: "not_found" });
    }
    const targetVersion = loadPostVersions().find(
      (item) => item.postId === postId && item.id === versionId,
    );
    if (!targetVersion) {
      return res.status(404).json({ error: "version_not_found" });
    }

    const existing = posts[index];
    const backupVersion = appendPostVersion({
      post: existing,
      reason: "manual",
      label: "backup prÃƒÆ’Ã‚Â©-rollback",
      actor: req.session?.user || null,
    });

    const rolledBack = applyPostSnapshotForRollback({
      existingPost: existing,
      snapshot: targetVersion.snapshot,
      allPosts: posts,
    });
    if (!rolledBack) {
      return res.status(400).json({ error: "rollback_failed" });
    }
    posts[index] = rolledBack;
    writePosts(posts);
    await runAutoUploadReorganization({ trigger: "post-save", req });
    const persistedPost =
      normalizePosts(loadPosts()).find((item) => item.id === postId) || rolledBack;
    const rollbackVersion = appendPostVersion({
      post: persistedPost,
      reason: "rollback",
      label: `rollback de ${targetVersion.versionNumber}`,
      actor: req.session?.user || null,
    });

    appendAuditLog(req, "posts.rollback", "posts", {
      id: persistedPost.id,
      slug: persistedPost.slug,
      versionId,
      targetVersionId: targetVersion.id,
      backupVersionId: backupVersion?.id || null,
      rollbackVersionId: rollbackVersion?.id || null,
      slugAdjusted: targetVersion.slug !== persistedPost.slug,
    });

    return res.json({
      ok: true,
      post: persistedPost,
      rollback: {
        targetVersionId: targetVersion.id,
        backupVersionId: backupVersion?.id || null,
        rollbackVersionId: rollbackVersion?.id || null,
        slugAdjusted: targetVersion.slug !== persistedPost.slug,
        targetSlug: targetVersion.slug,
        resultingSlug: persistedPost.slug,
      },
    });
  });
};

export default registerContentPostRollbackRoute;
