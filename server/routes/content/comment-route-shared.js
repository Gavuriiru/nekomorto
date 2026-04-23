import { buildCommentTargetInfo } from "../../lib/comment-target-info.js";
import { resolvePublishedEpisodeLookup } from "../../lib/project-episodes.js";

export const buildCommentAvatarUrl = (comment, buildGravatarUrl) =>
  comment.avatarUrl || (comment.emailHash ? buildGravatarUrl(comment.emailHash) : "");

export const serializePublicComment = (comment, { buildGravatarUrl } = {}) => ({
  id: comment.id,
  parentId: comment.parentId || null,
  name: comment.name,
  content: comment.content,
  createdAt: comment.createdAt,
  avatarUrl: buildCommentAvatarUrl(comment, buildGravatarUrl),
});

export const serializeAdminComment = (
  comment,
  { buildGravatarUrl, includeStatus = true, posts, primaryAppOrigin, projects } = {},
) => {
  const target = buildCommentTargetInfo(comment, posts, projects, primaryAppOrigin);

  return {
    id: comment.id,
    ...(includeStatus ? { status: comment.status } : {}),
    targetType: comment.targetType,
    targetId: comment.targetId,
    parentId: comment.parentId || null,
    name: comment.name,
    content: comment.content,
    createdAt: comment.createdAt,
    avatarUrl: buildCommentAvatarUrl(comment, buildGravatarUrl),
    targetLabel: target.label,
    targetUrl: target.url,
  };
};

export const listPublicCommentsForTarget = ({
  comments,
  type,
  id,
  chapterNumber,
  volume,
  buildGravatarUrl,
} = {}) =>
  (Array.isArray(comments) ? comments : [])
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
    .map((comment) => ({ comment, _createdAtTs: new Date(comment.createdAt).getTime() }))
    .sort((left, right) => left._createdAtTs - right._createdAtTs)
    .map(({ comment }) => serializePublicComment(comment, { buildGravatarUrl }));

export const listAdminComments = ({
  comments,
  status,
  limit,
  posts,
  projects,
  primaryAppOrigin,
  buildGravatarUrl,
  includeStatus = true,
} = {}) => {
  const normalizedComments = Array.isArray(comments) ? comments : [];
  const filteredComments =
    typeof status === "string" && status
      ? normalizedComments.filter((comment) => comment.status === status)
      : normalizedComments.slice();
  const sortedComments = filteredComments
    .map((comment) => ({ comment, _createdAtTs: new Date(comment.createdAt).getTime() }))
    .sort((left, right) => right._createdAtTs - left._createdAtTs)
    .map(({ comment }) => comment);
  const limitedComments =
    Number.isFinite(Number(limit)) && Number(limit) > 0
      ? sortedComments.slice(0, Math.min(Number(limit), sortedComments.length))
      : sortedComments;

  return limitedComments.map((comment) =>
    serializeAdminComment(comment, {
      buildGravatarUrl,
      includeStatus,
      posts,
      primaryAppOrigin,
      projects,
    }),
  );
};

export const validatePublicCommentTarget = ({
  chapterNumber,
  posts,
  projects,
  targetId,
  targetType,
  volume,
  nowTs = Date.now(),
} = {}) => {
  if (targetType === "post") {
    const post = posts.find((item) => item.slug === targetId);
    if (!post || post.deletedAt) {
      return { ok: false, error: "target_not_found", statusCode: 404 };
    }
    const publishTime = new Date(post.publishedAt).getTime();
    if (publishTime > nowTs || (post.status !== "published" && post.status !== "scheduled")) {
      return { ok: false, error: "target_not_found", statusCode: 404 };
    }
    return { ok: true, targetMeta: {} };
  }

  if (targetType === "project") {
    const project = projects.find((item) => item.id === targetId);
    if (!project || project.deletedAt) {
      return { ok: false, error: "target_not_found", statusCode: 404 };
    }
    return { ok: true, targetMeta: {} };
  }

  if (targetType !== "chapter") {
    return { ok: false, error: "invalid_target", statusCode: 400 };
  }

  const normalizedChapterNumber = Number(chapterNumber);
  if (!Number.isFinite(normalizedChapterNumber)) {
    return { ok: false, error: "chapter_required", statusCode: 400 };
  }

  const project = projects.find((item) => item.id === targetId);
  if (!project || project.deletedAt) {
    return { ok: false, error: "target_not_found", statusCode: 404 };
  }

  const normalizedVolume = Number.isFinite(volume) ? Number(volume) : null;
  const lookup = resolvePublishedEpisodeLookup(project, normalizedChapterNumber, normalizedVolume, {
    notFoundError: "target_not_found",
  });
  if (!lookup.ok) {
    return {
      ok: false,
      error: lookup.error,
      statusCode: lookup.statusCode,
    };
  }

  return {
    ok: true,
    targetMeta: {
      chapterNumber: normalizedChapterNumber,
      volume: normalizedVolume ?? undefined,
    },
  };
};

export const normalizePublicCommentRequest = ({
  body,
  isStaff = false,
  normalizeEmail,
  sessionUser,
} = {}) => {
  const requestBody = body || {};

  return {
    chapterNumber: requestBody.chapterNumber,
    normalizedContent: String(requestBody.content || "")
      .trim()
      .slice(0, 2000),
    normalizedEmail: isStaff
      ? normalizeEmail?.(sessionUser?.email)
      : normalizeEmail?.(requestBody.email),
    normalizedName: isStaff
      ? String(sessionUser?.name || "Equipe").trim()
      : String(requestBody.name || "").trim(),
    normalizedTargetId: String(requestBody.targetId || "").trim(),
    normalizedTargetType: String(requestBody.targetType || "").toLowerCase(),
    parentId: requestBody.parentId,
    volume: requestBody.volume,
    website: requestBody.website,
  };
};

export const getPublicCommentRequestError = ({
  isStaff = false,
  normalizedContent,
  normalizedEmail,
  normalizedName,
  normalizedTargetId,
  normalizedTargetType,
  website,
} = {}) => {
  if (website) {
    return "invalid_payload";
  }
  if (!normalizedTargetType || !normalizedTargetId) {
    return "target_required";
  }
  if (!["post", "project", "chapter"].includes(normalizedTargetType)) {
    return "invalid_target";
  }
  if (!normalizedName || !normalizedContent) {
    return "fields_required";
  }
  if (!isStaff && normalizedEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    return "invalid_email";
  }
  if (String(normalizedContent).length > 2000) {
    return "content_too_long";
  }
  return null;
};

export const hasValidCommentParent = ({ comments, parentId, targetId, targetType } = {}) => {
  if (!parentId) {
    return true;
  }

  const parent = (Array.isArray(comments) ? comments : []).find(
    (comment) => comment.id === String(parentId),
  );
  return Boolean(parent && parent.targetType === targetType && parent.targetId === targetId);
};

export const resolveStoredCommentIdentity = async ({
  createGravatarHash,
  isStaff = false,
  normalizedEmail,
  resolveGravatarAvatarUrl,
  sessionUser,
} = {}) => {
  const emailHash = normalizedEmail ? createGravatarHash(normalizedEmail) : "";
  const avatarUrl = isStaff
    ? String(sessionUser?.avatarUrl || "")
    : emailHash
      ? await resolveGravatarAvatarUrl(emailHash)
      : "";

  return {
    avatarUrl,
    emailHash,
  };
};

export const buildStoredComment = ({
  avatarUrl,
  content,
  emailHash,
  isStaff = false,
  name,
  now = new Date().toISOString(),
  parentId,
  targetId,
  targetMeta = {},
  targetType,
} = {}) => ({
  id: crypto.randomUUID(),
  targetType,
  targetId,
  targetMeta,
  parentId: parentId ? String(parentId) : null,
  name,
  emailHash,
  content,
  status: isStaff ? "approved" : "pending",
  createdAt: now,
  approvedAt: isStaff ? now : null,
  avatarUrl,
});

export const buildApprovedComment = (comment, { now = new Date().toISOString() } = {}) => ({
  ...comment,
  status: "approved",
  approvedAt: now,
});

export const appendApprovedCommentAnalytics = ({ appendAnalyticsEvent, comment, req } = {}) => {
  appendAnalyticsEvent?.(req, {
    eventType: "comment_approved",
    resourceType: "comment",
    resourceId: String(comment?.id || ""),
    meta: {
      targetType: comment?.targetType,
      targetId: comment?.targetId,
      status: "approved",
    },
  });
};

export const appendCommentCreatedAnalytics = ({ appendAnalyticsEvent, comment, req } = {}) => {
  appendAnalyticsEvent?.(req, {
    eventType: "comment_created",
    resourceType: "comment",
    resourceId: comment?.id,
    meta: {
      targetType: comment?.targetType,
      targetId: comment?.targetId,
      status: comment?.status,
    },
  });

  if (comment?.status === "approved") {
    appendApprovedCommentAnalytics({
      appendAnalyticsEvent,
      comment,
      req,
    });
  }
};

export const syncCommentTargetCounts = ({
  affectedComments,
  applyCommentCountToPosts,
  applyCommentCountToProjects,
  comments,
  loadPosts,
  loadProjects,
  normalizePosts,
  normalizeProjects,
  writePosts,
  writeProjects,
} = {}) => {
  const affectedPostIds = new Set();
  const affectedProjectIds = new Set();

  (Array.isArray(affectedComments) ? affectedComments : []).forEach((comment) => {
    if (comment?.targetType === "post" && comment.targetId) {
      affectedPostIds.add(String(comment.targetId));
    }
    if (comment?.targetType === "project" && comment.targetId) {
      affectedProjectIds.add(String(comment.targetId));
    }
  });

  if (affectedPostIds.size > 0) {
    let updatedPosts = normalizePosts(loadPosts());
    affectedPostIds.forEach((targetId) => {
      updatedPosts = applyCommentCountToPosts(updatedPosts, comments, targetId);
    });
    writePosts(updatedPosts);
  }

  if (affectedProjectIds.size > 0) {
    let updatedProjects = normalizeProjects(loadProjects());
    affectedProjectIds.forEach((targetId) => {
      updatedProjects = applyCommentCountToProjects(updatedProjects, comments, targetId);
    });
    writeProjects(updatedProjects);
  }

  return {
    affectedPostIds,
    affectedProjectIds,
  };
};

export default {
  appendApprovedCommentAnalytics,
  appendCommentCreatedAnalytics,
  buildApprovedComment,
  buildStoredComment,
  getPublicCommentRequestError,
  hasValidCommentParent,
  listAdminComments,
  listPublicCommentsForTarget,
  normalizePublicCommentRequest,
  resolveStoredCommentIdentity,
  serializeAdminComment,
  serializePublicComment,
  syncCommentTargetCounts,
  validatePublicCommentTarget,
};
