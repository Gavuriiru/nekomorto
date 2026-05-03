export const buildPublicPostListItem = ({ post, resolvePostCover } = {}) => {
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
};

export const buildPublicPostDetail = ({ post, resolvePostCover } = {}) => ({
  ...buildPublicPostListItem({ post, resolvePostCover }),
  content: post.content,
  contentFormat: post.contentFormat,
  seoTitle: post.seoTitle,
  seoDescription: post.seoDescription,
});

export const listPublishedPublicPosts = ({ loadPosts, normalizePosts, now = Date.now() } = {}) => {
  const posts = normalizePosts(loadPosts())
    .filter((post) => !post.deletedAt)
    .filter((post) => {
      const publishTime = new Date(post.publishedAt).getTime();
      return publishTime <= now && (post.status === "published" || post.status === "scheduled");
    });

  return posts
    .map((post) => ({
      post,
      publishTime: new Date(post.publishedAt).getTime(),
    }))
    .sort((a, b) => b.publishTime - a.publishTime)
    .map(({ post }) => post);
};

export const findPublishedPublicPostBySlug = ({
  loadPosts,
  normalizePosts,
  now = Date.now(),
  slug,
} = {}) => {
  const posts = normalizePosts(loadPosts());
  const post = posts.find((item) => item.slug === slug);
  if (!post || post.deletedAt) {
    return null;
  }
  const publishTime = new Date(post.publishedAt).getTime();
  if (publishTime > now || (post.status !== "published" && post.status !== "scheduled")) {
    return null;
  }
  return post;
};

export const resolveClientIp = ({ getRequestIp, req } = {}) => {
  if (typeof getRequestIp === "function") {
    return getRequestIp(req);
  }
  return String(req?.ip || "").trim();
};
