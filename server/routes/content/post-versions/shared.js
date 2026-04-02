export const ensurePostVersionManagerSessionUser = ({ canManagePosts, req, res } = {}) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    res.status(403).json({ error: "forbidden" });
    return null;
  }
  return sessionUser;
};
