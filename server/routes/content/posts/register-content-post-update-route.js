import {
  ensurePostManagerSessionUser,
  findPostIndexById,
  normalizeRequestedPostContentFormat,
  normalizeRequestedPostStatus,
} from "./shared.js";

export const registerContentPostUpdateRoute = ({
  app,
  appendAuditLog,
  appendPostVersion,
  canManagePosts,
  createRevisionToken,
  createSlug,
  dispatchEditorialWebhookEvent,
  ensureNoEditConflict,
  loadPosts,
  normalizePosts,
  normalizeTags,
  parseEditRevisionOptions,
  requireAuth,
  resolvePostStatus,
  runAutoUploadReorganization,
  writePosts,
} = {}) => {
  app.put("/api/posts/:id", requireAuth, async (req, res) => {
    const sessionUser = ensurePostManagerSessionUser({ canManagePosts, req, res });
    if (!sessionUser) {
      return;
    }
    const options = parseEditRevisionOptions(req.body);

    const { id } = req.params;
    const {
      title,
      slug,
      coverImageUrl,
      coverAlt,
      excerpt,
      content,
      contentFormat,
      author,
      publishedAt,
      scheduledAt,
      status,
      seoTitle,
      seoDescription,
      projectId,
      tags,
    } = req.body || {};
    const posts = normalizePosts(loadPosts());
    const index = findPostIndexById(posts, id);
    if (index === -1) {
      return res.status(404).json({ error: "not_found" });
    }
    const existing = posts[index];
    const currentRevision = createRevisionToken(existing);
    const noConflict = ensureNoEditConflict({
      req,
      res,
      resourceType: "post",
      resourceId: existing.id,
      current: existing,
      currentRevision,
      options,
    });
    if (!noConflict) {
      return noConflict;
    }

    const normalizedSlug = slug ? createSlug(slug) : "";
    if (
      normalizedSlug &&
      posts.some((post) => post.slug === normalizedSlug && post.id !== String(id))
    ) {
      return res.status(409).json({ error: "slug_exists" });
    }

    const statusCandidate = normalizeRequestedPostStatus(status, existing.status);
    const nextPublishedAt = publishedAt || existing.publishedAt;
    const normalizedStatus = resolvePostStatus(statusCandidate, nextPublishedAt, Date.now());
    const normalizedTags = normalizeTags(tags);
    const updated = {
      ...existing,
      title: title ? String(title) : existing.title,
      slug: normalizedSlug || existing.slug,
      coverImageUrl: coverImageUrl === "" ? null : (coverImageUrl ?? existing.coverImageUrl),
      coverAlt: typeof coverAlt === "string" ? coverAlt : existing.coverAlt,
      excerpt: typeof excerpt === "string" ? excerpt : existing.excerpt,
      content: typeof content === "string" ? content : existing.content,
      contentFormat: normalizeRequestedPostContentFormat(contentFormat, existing.contentFormat),
      author: typeof author === "string" ? author : existing.author,
      publishedAt: nextPublishedAt,
      scheduledAt: scheduledAt || existing.scheduledAt,
      status: normalizedStatus,
      seoTitle: typeof seoTitle === "string" ? seoTitle : existing.seoTitle,
      seoDescription: typeof seoDescription === "string" ? seoDescription : existing.seoDescription,
      projectId: typeof projectId === "string" ? projectId : existing.projectId,
      tags: normalizedTags.length ? normalizedTags : existing.tags,
      updatedAt: new Date().toISOString(),
    };

    posts[index] = updated;
    writePosts(posts);
    await runAutoUploadReorganization({ trigger: "post-save", req });
    const persistedPost =
      normalizePosts(loadPosts()).find((post) => post.id === updated.id) || updated;
    appendPostVersion({
      post: persistedPost,
      reason: "update",
      actor: req.session?.user || null,
    });
    appendAuditLog(req, "posts.update", "posts", { id: updated.id, slug: updated.slug });
    if (persistedPost.status === "published" || persistedPost.status === "scheduled") {
      await dispatchEditorialWebhookEvent({
        eventKey: "post_update",
        post: persistedPost,
        req,
      });
    }
    return res.json({
      post: {
        ...persistedPost,
        revision: createRevisionToken(persistedPost),
      },
    });
  });
};

export default registerContentPostUpdateRoute;
