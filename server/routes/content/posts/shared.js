const POST_STATUSES = new Set(["draft", "scheduled", "published"]);
const POST_CONTENT_FORMATS = new Set(["html", "markdown", "lexical"]);

export const ensurePostManagerSessionUser = ({ canManagePosts, req, res } = {}) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    res.status(403).json({ error: "forbidden" });
    return null;
  }
  return sessionUser;
};

export const findPostIndexById = (posts, id) => posts.findIndex((post) => post.id === String(id));

export const normalizeRequestedPostStatus = (status, fallback = "draft") =>
  POST_STATUSES.has(status) ? status : fallback;

export const normalizeRequestedPostContentFormat = (contentFormat, fallback = "markdown") =>
  POST_CONTENT_FORMATS.has(contentFormat) ? contentFormat : fallback;
