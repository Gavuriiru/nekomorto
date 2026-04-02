import { buildCommentTargetInfo } from "../../lib/comment-target-info.js";

export const registerContentCommentRoutes = ({
  PRIMARY_APP_ORIGIN,
  app,
  appendAnalyticsEvent,
  appendAuditLog,
  applyCommentCountToPosts,
  applyCommentCountToProjects,
  buildGravatarUrl,
  bulkModeratePendingComments,
  canManageComments,
  canSubmitComment,
  createGravatarHash,
  loadComments,
  loadPosts,
  loadProjects,
  normalizeEmail,
  normalizePosts,
  normalizeProjects,
  requireAuth,
  resolveEpisodeLookup,
  resolveGravatarAvatarUrl,
  writeComments,
  writePosts,
  writeProjects,
} = {}) => {
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
};

export default registerContentCommentRoutes;
