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

export const listPublishedPublicPosts = ({ loadPosts, normalizePosts, now = Date.now() } = {}) =>
  normalizePosts(loadPosts())
    .filter((post) => !post.deletedAt)
    .filter((post) => {
      const publishTime = new Date(post.publishedAt).getTime();
      return publishTime <= now && (post.status === "published" || post.status === "scheduled");
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

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

export const resolveClientIp = (req) => req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
