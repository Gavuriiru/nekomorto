import { buildPublicPostListItem, listPublishedPublicPosts } from "./shared.js";

export const registerContentPostPublicListRoute = ({
  PUBLIC_READ_CACHE_TAGS,
  PUBLIC_READ_CACHE_TTL_MS,
  app,
  buildPublicMediaVariants,
  loadPosts,
  normalizePosts,
  readPublicCachedJson,
  resolvePostCover,
  writePublicCachedJson,
} = {}) => {
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
    const posts = listPublishedPublicPosts({
      loadPosts,
      normalizePosts,
    }).map((post) => buildPublicPostListItem({ post, resolvePostCover }));
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
};

export default registerContentPostPublicListRoute;
