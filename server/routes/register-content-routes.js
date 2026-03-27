const buildCommentTargetInfo = (comment, posts, projects, PRIMARY_APP_ORIGIN) => {
  if (comment.targetType === "post") {
    const post = posts.find((item) => item.slug === comment.targetId);
    if (!post) {
      return { label: "Postagem", url: PRIMARY_APP_ORIGIN };
    }
    return {
      label: post.title,
      url: `${PRIMARY_APP_ORIGIN}/postagem/${post.slug}#comment-${comment.id}`,
    };
  }
  if (comment.targetType === "project") {
    const project = projects.find((item) => item.id === comment.targetId);
    if (!project) {
      return { label: "Projeto", url: PRIMARY_APP_ORIGIN };
    }
    return {
      label: project.title,
      url: `${PRIMARY_APP_ORIGIN}/projeto/${project.id}#comment-${comment.id}`,
    };
  }
  if (comment.targetType === "chapter") {
    const project = projects.find((item) => item.id === comment.targetId);
    const chapterNumber = comment.targetMeta?.chapterNumber;
    const volume = comment.targetMeta?.volume;
    const chapterLabel = chapterNumber ? `CapÃ­tulo ${chapterNumber}` : "CapÃ­tulo";
    const projectLabel = project?.title ? `${project.title} â€¢ ${chapterLabel}` : chapterLabel;
    const volumeQuery = Number.isFinite(volume) ? `?volume=${volume}` : "";
    const url = project
      ? `${PRIMARY_APP_ORIGIN}/projeto/${project.id}/leitura/${chapterNumber}${volumeQuery}#comment-${comment.id}`
      : PRIMARY_APP_ORIGIN;
    return { label: projectLabel, url };
  }
  return { label: "ComentÃ¡rio", url: PRIMARY_APP_ORIGIN };
};

export const registerContentRoutes = ({
  PRIMARY_APP_ORIGIN,
  PUBLIC_READ_CACHE_TAGS,
  PUBLIC_READ_CACHE_TTL_MS,
  app,
  appendAnalyticsEvent,
  appendAuditLog,
  appendPostVersion,
  applyCommentCountToPosts,
  applyCommentCountToProjects,
  applyPostSnapshotForRollback,
  buildEditorialCalendarItems,
  buildGravatarUrl,
  buildPublicMediaVariants,
  bulkModeratePendingComments,
  canManageComments,
  canManagePosts,
  canRegisterPollVote,
  canRegisterView,
  canSubmitComment,
  canManageSettings,
  collectLinkTypeIconUploads,
  createGravatarHash,
  createRevisionToken,
  createSlug,
  createUniqueSlug,
  deletePrivateUploadByUrl,
  dispatchEditorialWebhookEvent,
  ensureNoEditConflict,
  incrementPostViews,
  listPostVersions,
  loadComments,
  loadLinkTypes,
  loadPostVersions,
  loadPosts,
  loadProjects,
  normalizeEmail,
  normalizeLinkTypes,
  normalizePosts,
  normalizeProjects,
  normalizeTags,
  parseEditRevisionOptions,
  postVersionReasonLabel,
  readPublicCachedJson,
  resolveEpisodeLookup,
  resolveGravatarAvatarUrl,
  resolvePostCover,
  resolvePostStatus,
  isWithinRestoreWindow,
  runAutoUploadReorganization,
  updateLexicalPollVotes,
  writeComments,
  writeLinkTypes,
  writePosts,
  writeProjects,
  writePublicCachedJson,
  requireAuth,
} = {}) => {
  app.get("/api/link-types", (req, res) => {
    const items = loadLinkTypes();
    const revision = createRevisionToken(items);
    res.json({ items, revision });
  });

  app.put("/api/link-types", requireAuth, (req, res) => {
    if (!canManageSettings(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const options = parseEditRevisionOptions(req.body);
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items_required" });
    }
    const previousLinkTypes = loadLinkTypes();
    const currentRevision = createRevisionToken(previousLinkTypes);
    const noConflict = ensureNoEditConflict({
      req,
      res,
      resourceType: "link_types",
      resourceId: "global",
      current: previousLinkTypes,
      currentRevision,
      options,
    });
    if (!noConflict) {
      return noConflict;
    }
    const previousIcons = collectLinkTypeIconUploads(previousLinkTypes);
    const normalized = normalizeLinkTypes(items);
    writeLinkTypes(normalized);
    const nextIcons = collectLinkTypeIconUploads(normalized);
    const removedIcons = Array.from(previousIcons).filter((url) => !nextIcons.has(url));
    removedIcons.forEach((url) => deletePrivateUploadByUrl(url));
    return res.json({ items: normalized, revision: createRevisionToken(normalized) });
  });

  app.get("/api/posts", requireAuth, (req, res) => {
    const posts = normalizePosts(loadPosts())
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .map((post) => ({
        ...post,
        revision: createRevisionToken(post),
      }));
    const resolvedCoverSources = posts.map((post) => {
      const resolvedCover = resolvePostCover(post);
      return { coverImageUrl: resolvedCover.coverImageUrl };
    });
    res.json({
      posts,
      mediaVariants: buildPublicMediaVariants(resolvedCoverSources),
    });
  });

  app.get("/api/public/posts", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const cached = readPublicCachedJson(req);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(cached.statusCode).json(cached.payload);
    }
    const limitRaw = Number(req.query.limit);
    const pageRaw = Number(req.query.page);
    const usePagination = Number.isFinite(limitRaw) || Number.isFinite(pageRaw);
    const limit = usePagination ? Math.min(Math.max(limitRaw || 10, 1), 100) : null;
    const page = usePagination ? Math.max(pageRaw || 1, 1) : null;
    const now = Date.now();
    const posts = normalizePosts(loadPosts())
      .filter((post) => !post.deletedAt)
      .filter((post) => {
        const publishTime = new Date(post.publishedAt).getTime();
        return publishTime <= now && (post.status === "published" || post.status === "scheduled");
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .map((post) => {
        const resolvedCover = resolvePostCover(post);
        return {
          id: post.id,
          title: post.title,
          slug: post.slug,
          coverImageUrl: resolvedCover.coverImageUrl,
          coverAlt: resolvedCover.coverAlt,
          excerpt: post.excerpt,
          author: post.author,
          publishedAt: post.publishedAt,
          views: post.views,
          commentsCount: post.commentsCount,
          projectId: post.projectId || "",
          tags: Array.isArray(post.tags) ? post.tags : [],
        };
      });
    let payload = null;
    if (!usePagination) {
      payload = { posts };
    } else {
      const start = (page - 1) * limit;
      const paged = posts.slice(start, start + limit);
      payload = { posts: paged, page, limit, total: posts.length };
    }
    payload = {
      ...payload,
      mediaVariants: buildPublicMediaVariants(payload.posts),
    };
    writePublicCachedJson(req, payload, {
      ttlMs: PUBLIC_READ_CACHE_TTL_MS,
      tags: [PUBLIC_READ_CACHE_TAGS.POSTS],
    });
    res.setHeader("X-Cache", "MISS");
    return res.json(payload);
  });

  app.get("/api/public/posts/:slug", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const now = Date.now();
    const slug = String(req.params.slug || "");
    const posts = normalizePosts(loadPosts());
    const post = posts.find((item) => item.slug === slug);
    if (!post) {
      return res.status(404).json({ error: "not_found" });
    }
    if (post.deletedAt) {
      return res.status(404).json({ error: "not_found" });
    }
    const publishTime = new Date(post.publishedAt).getTime();
    if (publishTime > now || (post.status !== "published" && post.status !== "scheduled")) {
      return res.status(404).json({ error: "not_found" });
    }
    const resolvedCover = resolvePostCover(post);
    const publicPost = {
      id: post.id,
      title: post.title,
      slug: post.slug,
      coverImageUrl: resolvedCover.coverImageUrl,
      coverAlt: resolvedCover.coverAlt,
      excerpt: post.excerpt,
      content: post.content,
      contentFormat: post.contentFormat,
      author: post.author,
      publishedAt: post.publishedAt,
      views: post.views,
      commentsCount: post.commentsCount,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      projectId: post.projectId || "",
      tags: Array.isArray(post.tags) ? post.tags : [],
    };
    return res.json({
      post: publicPost,
      mediaVariants: buildPublicMediaVariants({ coverImageUrl: publicPost.coverImageUrl }),
    });
  });

  app.post("/api/public/posts/:slug/view", async (req, res) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    if (!(await canRegisterView(ip))) {
      return res.status(429).json({ error: "rate_limited" });
    }
    const now = Date.now();
    const slug = String(req.params.slug || "");
    const posts = normalizePosts(loadPosts());
    const post = posts.find((item) => item.slug === slug);
    if (!post) {
      return res.status(404).json({ error: "not_found" });
    }
    if (post.deletedAt) {
      return res.status(404).json({ error: "not_found" });
    }
    const publishTime = new Date(post.publishedAt).getTime();
    if (publishTime > now || (post.status !== "published" && post.status !== "scheduled")) {
      return res.status(404).json({ error: "not_found" });
    }
    const updated = incrementPostViews(slug);
    appendAnalyticsEvent(req, {
      eventType: "view",
      resourceType: "post",
      resourceId: post.slug,
      meta: {
        action: "view",
        resourceType: "post",
        resourceId: post.slug,
      },
    });
    return res.json({ views: updated?.views ?? post.views ?? 0 });
  });

  app.post("/api/public/posts/:slug/polls/vote", async (req, res) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    if (!(await canRegisterPollVote(ip))) {
      return res.status(429).json({ error: "rate_limited" });
    }
    const slug = String(req.params.slug || "");
    const { optionUid, voterId, checked, question } = req.body || {};
    if (!optionUid || !voterId) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    const posts = normalizePosts(loadPosts());
    const index = posts.findIndex((post) => post.slug === slug);
    if (index === -1) {
      return res.status(404).json({ error: "not_found" });
    }
    const post = posts[index];
    const result = updateLexicalPollVotes(post.content, {
      question,
      optionUid,
      voterId,
      checked,
    });
    if (!result.updated || !result.content) {
      return res.status(404).json({ error: "poll_not_found" });
    }
    posts[index] = {
      ...post,
      content: result.content,
    };
    writePosts(posts);
    return res.json({ ok: true });
  });

  app.get("/api/public/comments", (req, res) => {
    const type = String(req.query.type || "").toLowerCase();
    const id = String(req.query.id || "").trim();
    if (!type || !id) {
      return res.status(400).json({ error: "target_required" });
    }
    const chapterNumber = Number(req.query.chapter);
    const volume = Number(req.query.volume);
    const comments = loadComments()
      .filter((comment) => comment.status === "approved")
      .filter((comment) => comment.targetType === type && comment.targetId === id)
      .filter((comment) => {
        if (type !== "chapter") {
          return true;
        }
        if (!Number.isFinite(chapterNumber)) {
          return false;
        }
        const targetChapter = Number(comment.targetMeta?.chapterNumber);
        if (targetChapter !== chapterNumber) {
          return false;
        }
        if (Number.isFinite(volume)) {
          return Number(comment.targetMeta?.volume || 0) === volume;
        }
        return true;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((comment) => ({
        id: comment.id,
        parentId: comment.parentId || null,
        name: comment.name,
        content: comment.content,
        createdAt: comment.createdAt,
        avatarUrl:
          comment.avatarUrl || (comment.emailHash ? buildGravatarUrl(comment.emailHash) : ""),
      }));

    return res.json({ comments });
  });

  app.post("/api/public/comments", async (req, res) => {
    const sessionUser = req.session?.user || null;
    const isStaff = sessionUser?.id ? canManageComments(sessionUser.id) : false;
    const { targetType, targetId, parentId, name, email, content, chapterNumber, volume, website } =
      req.body || {};
    if (website) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    if (!(await canSubmitComment(ip))) {
      return res.status(429).json({ error: "rate_limited" });
    }
    const normalizedTargetType = String(targetType || "").toLowerCase();
    const normalizedTargetId = String(targetId || "").trim();
    const normalizedName = isStaff
      ? String(sessionUser?.name || "Equipe").trim()
      : String(name || "").trim();
    const normalizedEmail = isStaff ? normalizeEmail(sessionUser?.email) : normalizeEmail(email);
    const normalizedContent = String(content || "")
      .trim()
      .slice(0, 2000);

    if (!normalizedTargetType || !normalizedTargetId) {
      return res.status(400).json({ error: "target_required" });
    }
    if (!["post", "project", "chapter"].includes(normalizedTargetType)) {
      return res.status(400).json({ error: "invalid_target" });
    }
    if (!normalizedName || !normalizedContent) {
      return res.status(400).json({ error: "fields_required" });
    }
    if (!isStaff && normalizedEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: "invalid_email" });
    }
    if (normalizedContent.length > 2000) {
      return res.status(400).json({ error: "content_too_long" });
    }

    const posts = normalizePosts(loadPosts());
    const projects = normalizeProjects(loadProjects());
    const nowEpoch = Date.now();
    if (normalizedTargetType === "post") {
      const post = posts.find((item) => item.slug === normalizedTargetId);
      if (!post || post.deletedAt) {
        return res.status(404).json({ error: "target_not_found" });
      }
      const publishTime = new Date(post.publishedAt).getTime();
      if (publishTime > nowEpoch || (post.status !== "published" && post.status !== "scheduled")) {
        return res.status(404).json({ error: "target_not_found" });
      }
    } else if (normalizedTargetType === "project") {
      const project = projects.find((item) => item.id === normalizedTargetId);
      if (!project || project.deletedAt) {
        return res.status(404).json({ error: "target_not_found" });
      }
    } else if (normalizedTargetType === "chapter") {
      const chapter = Number(chapterNumber);
      if (!Number.isFinite(chapter)) {
        return res.status(400).json({ error: "chapter_required" });
      }
      const project = projects.find((item) => item.id === normalizedTargetId);
      if (!project || project.deletedAt) {
        return res.status(404).json({ error: "target_not_found" });
      }
      const volumeNumber = Number.isFinite(volume) ? Number(volume) : null;
      const lookup = resolveEpisodeLookup(project, chapter, volumeNumber, {
        requirePublished: true,
      });
      if (!lookup.ok) {
        return res.status(lookup.code === "volume_required" ? 400 : 404).json({
          error: lookup.code === "volume_required" ? "volume_required" : "target_not_found",
        });
      }
    }

    const comments = loadComments();
    if (parentId) {
      const parent = comments.find((comment) => comment.id === String(parentId));
      if (
        !parent ||
        parent.targetType !== normalizedTargetType ||
        parent.targetId !== normalizedTargetId
      ) {
        return res.status(400).json({ error: "invalid_parent" });
      }
    }

    const emailHash = normalizedEmail ? createGravatarHash(normalizedEmail) : "";
    const avatarUrl = isStaff
      ? String(sessionUser?.avatarUrl || "")
      : emailHash
        ? await resolveGravatarAvatarUrl(emailHash)
        : "";
    const now = new Date().toISOString();
    const newComment = {
      id: crypto.randomUUID(),
      targetType: normalizedTargetType,
      targetId: normalizedTargetId,
      targetMeta:
        normalizedTargetType === "chapter"
          ? {
              chapterNumber: Number(chapterNumber),
              volume: Number.isFinite(Number(volume)) ? Number(volume) : undefined,
            }
          : {},
      parentId: parentId ? String(parentId) : null,
      name: normalizedName,
      emailHash,
      content: normalizedContent,
      status: isStaff ? "approved" : "pending",
      createdAt: now,
      approvedAt: isStaff ? now : null,
      avatarUrl,
    };

    comments.push(newComment);
    writeComments(comments);
    appendAnalyticsEvent(req, {
      eventType: "comment_created",
      resourceType: "comment",
      resourceId: newComment.id,
      meta: {
        targetType: normalizedTargetType,
        targetId: normalizedTargetId,
        status: newComment.status,
      },
    });
    if (newComment.status === "approved") {
      appendAnalyticsEvent(req, {
        eventType: "comment_approved",
        resourceType: "comment",
        resourceId: newComment.id,
        meta: {
          targetType: normalizedTargetType,
          targetId: normalizedTargetId,
          status: newComment.status,
        },
      });
    }
    return res.json({ comment: { id: newComment.id, status: newComment.status } });
  });

  app.get("/api/comments/pending", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageComments(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const posts = normalizePosts(loadPosts());
    const projects = normalizeProjects(loadProjects());
    const comments = loadComments()
      .filter((comment) => comment.status === "pending")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((comment) => {
        const target = buildCommentTargetInfo(comment, posts, projects, PRIMARY_APP_ORIGIN);
        return {
          id: comment.id,
          targetType: comment.targetType,
          targetId: comment.targetId,
          parentId: comment.parentId || null,
          name: comment.name,
          content: comment.content,
          createdAt: comment.createdAt,
          avatarUrl:
            comment.avatarUrl || (comment.emailHash ? buildGravatarUrl(comment.emailHash) : ""),
          targetLabel: target.label,
          targetUrl: target.url,
        };
      });
    return res.json({ comments });
  });

  app.get("/api/comments/recent", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageComments(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 10) : 4;
    const posts = normalizePosts(loadPosts());
    const projects = normalizeProjects(loadProjects());
    const comments = loadComments();
    const pendingCount = comments.filter((comment) => comment.status === "pending").length;
    const recent = comments
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((comment) => {
        const target = buildCommentTargetInfo(comment, posts, projects, PRIMARY_APP_ORIGIN);
        return {
          id: comment.id,
          status: comment.status,
          targetType: comment.targetType,
          targetId: comment.targetId,
          name: comment.name,
          content: comment.content,
          createdAt: comment.createdAt,
          avatarUrl:
            comment.avatarUrl || (comment.emailHash ? buildGravatarUrl(comment.emailHash) : ""),
          targetLabel: target.label,
          targetUrl: target.url,
        };
      });
    return res.json({ comments: recent, pendingCount, totalCount: comments.length });
  });

  app.post("/api/comments/pending/bulk", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageComments(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const comments = loadComments();
    const result = bulkModeratePendingComments(comments, {
      action: req.body?.action,
      confirmText: req.body?.confirmText,
    });

    if (!result.ok) {
      if (result.error === "invalid_action") {
        return res.status(400).json({ error: "invalid_action" });
      }
      if (result.error === "confirmation_required") {
        return res.status(400).json({ error: "confirmation_required" });
      }
      return res.status(500).json({ error: "bulk_moderation_failed" });
    }

    writeComments(result.comments);

    if (
      result.action === "approve_all" &&
      Array.isArray(result.processedComments) &&
      result.processedComments.length > 0
    ) {
      const affectedPostIds = new Set();
      const affectedProjectIds = new Set();

      result.processedComments.forEach((comment) => {
        if (comment?.targetType === "post" && comment.targetId) {
          affectedPostIds.add(String(comment.targetId));
        }
        if (comment?.targetType === "project" && comment.targetId) {
          affectedProjectIds.add(String(comment.targetId));
        }
        appendAnalyticsEvent(req, {
          eventType: "comment_approved",
          resourceType: "comment",
          resourceId: String(comment.id || ""),
          meta: {
            targetType: comment.targetType,
            targetId: comment.targetId,
            status: "approved",
          },
        });
      });

      if (affectedPostIds.size > 0) {
        let updatedPosts = normalizePosts(loadPosts());
        affectedPostIds.forEach((targetId) => {
          updatedPosts = applyCommentCountToPosts(updatedPosts, result.comments, targetId);
        });
        writePosts(updatedPosts);
      }

      if (affectedProjectIds.size > 0) {
        let updatedProjects = normalizeProjects(loadProjects());
        affectedProjectIds.forEach((targetId) => {
          updatedProjects = applyCommentCountToProjects(updatedProjects, result.comments, targetId);
        });
        writeProjects(updatedProjects);
      }

      appendAuditLog(req, "comments.bulk.approve", "comments", {
        processedCount: result.processedCount,
        totalPendingBefore: result.totalPendingBefore,
      });
    }

    if (result.action === "delete_all") {
      appendAuditLog(req, "comments.bulk.delete", "comments", {
        processedCount: result.processedCount,
        totalPendingBefore: result.totalPendingBefore,
      });
    }

    return res.json({
      ok: true,
      action: result.action,
      totalPendingBefore: result.totalPendingBefore,
      processedCount: result.processedCount,
      remainingPending: result.remainingPending,
    });
  });

  app.post("/api/comments/:id/approve", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageComments(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const { id } = req.params;
    const comments = loadComments();
    const index = comments.findIndex((comment) => comment.id === String(id));
    if (index === -1) {
      return res.status(404).json({ error: "not_found" });
    }
    const existing = comments[index];
    if (existing.status === "approved") {
      return res.json({ ok: true });
    }
    comments[index] = {
      ...existing,
      status: "approved",
      approvedAt: new Date().toISOString(),
    };
    writeComments(comments);

    if (existing.targetType === "post") {
      const updatedPosts = applyCommentCountToPosts(
        normalizePosts(loadPosts()),
        comments,
        existing.targetId,
      );
      writePosts(updatedPosts);
    }
    if (existing.targetType === "project") {
      const updatedProjects = applyCommentCountToProjects(
        normalizeProjects(loadProjects()),
        comments,
        existing.targetId,
      );
      writeProjects(updatedProjects);
    }
    appendAnalyticsEvent(req, {
      eventType: "comment_approved",
      resourceType: "comment",
      resourceId: existing.id,
      meta: {
        targetType: existing.targetType,
        targetId: existing.targetId,
        status: "approved",
      },
    });

    return res.json({ ok: true });
  });

  app.delete("/api/comments/:id", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageComments(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const { id } = req.params;
    const comments = loadComments();
    const index = comments.findIndex((comment) => comment.id === String(id));
    if (index === -1) {
      return res.status(404).json({ error: "not_found" });
    }
    const [removed] = comments.splice(index, 1);
    writeComments(comments);

    if (removed.status === "approved") {
      if (removed.targetType === "post") {
        const updatedPosts = applyCommentCountToPosts(
          normalizePosts(loadPosts()),
          comments,
          removed.targetId,
        );
        writePosts(updatedPosts);
      }
      if (removed.targetType === "project") {
        const updatedProjects = applyCommentCountToProjects(
          normalizeProjects(loadProjects()),
          comments,
          removed.targetId,
        );
        writeProjects(updatedProjects);
      }
    }

    return res.json({ ok: true });
  });

  app.post("/api/posts", requireAuth, async (req, res) => {
    const sessionUser = req.session.user;
    if (!canManagePosts(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
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

    let posts = normalizePosts(loadPosts());
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
    const requestedStatus =
      status === "draft" || status === "scheduled" || status === "published" ? status : "draft";
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
      contentFormat:
        contentFormat === "html" || contentFormat === "lexical" ? contentFormat : "markdown",
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

  app.put("/api/posts/:id", requireAuth, async (req, res) => {
    const sessionUser = req.session.user;
    if (!canManagePosts(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
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
    let posts = normalizePosts(loadPosts());
    const index = posts.findIndex((post) => post.id === String(id));
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

    const statusCandidate =
      status === "draft" || status === "scheduled" || status === "published"
        ? status
        : existing.status;
    const nextPublishedAt = publishedAt || existing.publishedAt;
    const normalizedStatus = resolvePostStatus(statusCandidate, nextPublishedAt, Date.now());
    const updated = {
      ...existing,
      title: title ? String(title) : existing.title,
      slug: normalizedSlug || existing.slug,
      coverImageUrl: coverImageUrl === "" ? null : (coverImageUrl ?? existing.coverImageUrl),
      coverAlt: typeof coverAlt === "string" ? coverAlt : existing.coverAlt,
      excerpt: typeof excerpt === "string" ? excerpt : existing.excerpt,
      content: typeof content === "string" ? content : existing.content,
      contentFormat:
        contentFormat === "html"
          ? "html"
          : contentFormat === "markdown"
            ? "markdown"
            : contentFormat === "lexical"
              ? "lexical"
              : existing.contentFormat,
      author: typeof author === "string" ? author : existing.author,
      publishedAt: nextPublishedAt,
      scheduledAt: scheduledAt || existing.scheduledAt,
      status: normalizedStatus,
      seoTitle: typeof seoTitle === "string" ? seoTitle : existing.seoTitle,
      seoDescription: typeof seoDescription === "string" ? seoDescription : existing.seoDescription,
      projectId: typeof projectId === "string" ? projectId : existing.projectId,
      tags: normalizeTags(tags).length ? normalizeTags(tags) : existing.tags,
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

  app.delete("/api/posts/:id", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManagePosts(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const { id } = req.params;
    let posts = normalizePosts(loadPosts());
    const index = posts.findIndex((post) => post.id === String(id));
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

  app.post("/api/posts/:id/restore", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManagePosts(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const { id } = req.params;
    let posts = normalizePosts(loadPosts());
    const index = posts.findIndex((post) => post.id === String(id));
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

  app.get("/api/admin/content/post/:id/versions", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManagePosts(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
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

  app.post("/api/admin/content/post/:id/version", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManagePosts(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
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

  app.post("/api/admin/content/post/:id/rollback", requireAuth, async (req, res) => {
    const sessionUser = req.session.user;
    if (!canManagePosts(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
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
      label: "backup prÃ©-rollback",
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
