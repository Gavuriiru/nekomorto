import {
  ensurePostManagerSessionUser,
  normalizeRequestedPostContentFormat,
  normalizeRequestedPostStatus,
} from "./shared.js";

export const registerContentPostCreateRoute = ({
  app,
  appendAuditLog,
  appendPostVersion,
  canManagePosts,
  createSlug,
  createUniqueSlug,
  dispatchEditorialWebhookEvent,
  loadPosts,
  normalizePosts,
  normalizeTags,
  requireAuth,
  resolvePostStatus,
  runAutoUploadReorganization,
  writePosts,
} = {}) => {
  app.post("/api/posts", requireAuth, async (req, res) => {
    const sessionUser = ensurePostManagerSessionUser({ canManagePosts, req, res });
    if (!sessionUser) {
      return;
    }

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
    if (!title) {
      return res.status(400).json({ error: "title_required" });
    }

    const posts = normalizePosts(loadPosts());
    const baseSlug = createSlug(slug || title);
    if (!baseSlug) {
      return res.status(400).json({ error: "slug_required" });
    }
    const normalizedSlug = createUniqueSlug(
      baseSlug,
      posts.map((post) => post.slug),
    );

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const requestedStatus = normalizeRequestedPostStatus(status);
    const normalizedPublishedAt =
      requestedStatus === "published"
        ? publishedAt || now
        : requestedStatus === "scheduled"
          ? publishedAt || scheduledAt || now
          : publishedAt || now;
    const normalizedStatus = resolvePostStatus(requestedStatus, normalizedPublishedAt, nowMs);
    const newPost = {
      id: crypto.randomUUID(),
      title: String(title),
      slug: normalizedSlug,
      coverImageUrl: coverImageUrl || null,
      coverAlt: coverAlt || "",
      excerpt: excerpt || "",
      content: content || "",
      contentFormat: normalizeRequestedPostContentFormat(contentFormat),
      author: author || sessionUser?.name || "Autor",
      publishedAt: normalizedPublishedAt,
      scheduledAt: scheduledAt || null,
      status: normalizedStatus,
      seoTitle: seoTitle || "",
      seoDescription: seoDescription || "",
      projectId: projectId || "",
      tags: normalizeTags(tags),
      views: 0,
      commentsCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    posts.push(newPost);
    writePosts(posts);
    await runAutoUploadReorganization({ trigger: "post-save", req });
    const persistedPost =
      normalizePosts(loadPosts()).find((post) => post.id === newPost.id) || newPost;
    appendPostVersion({
      post: persistedPost,
      reason: "create",
      actor: req.session?.user || null,
    });
    appendAuditLog(req, "posts.create", "posts", { id: newPost.id, slug: newPost.slug });
    if (persistedPost.status === "published" || persistedPost.status === "scheduled") {
      await dispatchEditorialWebhookEvent({
        eventKey: "post_create",
        post: persistedPost,
        req,
      });
    }
    return res.json({ post: persistedPost });
  });
};

export default registerContentPostCreateRoute;
