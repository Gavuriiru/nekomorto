import {
  buildStoredComment,
  listAdminComments,
  listPublicCommentsForTarget,
  syncCommentTargetCounts,
  validatePublicCommentTarget,
} from "./comment-route-shared.js";

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
    const comments = listPublicCommentsForTarget({
      comments: loadComments(),
      type,
      id,
      chapterNumber,
      volume,
      buildGravatarUrl,
    });

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
    const targetValidation = validatePublicCommentTarget({
      chapterNumber,
      posts,
      projects,
      targetId: normalizedTargetId,
      targetType: normalizedTargetType,
      volume,
    });
    if (!targetValidation.ok) {
      return res.status(targetValidation.statusCode).json({
        error: targetValidation.error,
      });
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
    const newComment = buildStoredComment({
      avatarUrl,
      content: normalizedContent,
      emailHash,
      isStaff,
      name: normalizedName,
      now,
      parentId,
      targetId: normalizedTargetId,
      targetMeta: targetValidation.targetMeta,
      targetType: normalizedTargetType,
    });

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
    const comments = listAdminComments({
      comments: loadComments(),
      status: "pending",
      posts,
      projects,
      primaryAppOrigin: PRIMARY_APP_ORIGIN,
      buildGravatarUrl,
      includeStatus: false,
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
    const recent = listAdminComments({
      comments,
      limit,
      posts,
      projects,
      primaryAppOrigin: PRIMARY_APP_ORIGIN,
      buildGravatarUrl,
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
      result.processedComments.forEach((comment) => {
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

      syncCommentTargetCounts({
        affectedComments: result.processedComments,
        applyCommentCountToPosts,
        applyCommentCountToProjects,
        comments: result.comments,
        loadPosts,
        loadProjects,
        normalizePosts,
        normalizeProjects,
        writePosts,
        writeProjects,
      });

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

    syncCommentTargetCounts({
      affectedComments: [existing],
      applyCommentCountToPosts,
      applyCommentCountToProjects,
      comments,
      loadPosts,
      loadProjects,
      normalizePosts,
      normalizeProjects,
      writePosts,
      writeProjects,
    });
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
      syncCommentTargetCounts({
        affectedComments: [removed],
        applyCommentCountToPosts,
        applyCommentCountToProjects,
        comments,
        loadPosts,
        loadProjects,
        normalizePosts,
        normalizeProjects,
        writePosts,
        writeProjects,
      });
    }

    return res.json({ ok: true });
  });
};

export default registerContentCommentRoutes;
