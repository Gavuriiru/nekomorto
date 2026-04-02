export const registerContentPostAdminListRoute = ({
  app,
  buildPublicMediaVariants,
  createRevisionToken,
  loadPosts,
  normalizePosts,
  requireAuth,
  resolvePostCover,
} = {}) => {
  app.get("/api/posts", requireAuth, (_req, res) => {
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
};

export default registerContentPostAdminListRoute;
