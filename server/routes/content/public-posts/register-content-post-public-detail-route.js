import { buildPublicPostDetail, findPublishedPublicPostBySlug } from "./shared.js";

export const registerContentPostPublicDetailRoute = ({
  app,
  buildPublicMediaVariants,
  loadPosts,
  normalizePosts,
  resolvePostCover,
} = {}) => {
  app.get("/api/public/posts/:slug", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const slug = String(req.params.slug || "");
    const post = findPublishedPublicPostBySlug({
      loadPosts,
      normalizePosts,
      slug,
    });
    if (!post) {
      return res.status(404).json({ error: "not_found" });
    }
    const publicPost = buildPublicPostDetail({ post, resolvePostCover });
    return res.json({
      post: publicPost,
      mediaVariants: buildPublicMediaVariants({ coverImageUrl: publicPost.coverImageUrl }),
    });
  });
};

export default registerContentPostPublicDetailRoute;
