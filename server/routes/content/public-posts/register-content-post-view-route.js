import { findPublishedPublicPostBySlug, resolveClientIp } from "./shared.js";

export const registerContentPostViewRoute = ({
  app,
  appendAnalyticsEvent,
  canRegisterView,
  getRequestIp,
  incrementPostViews,
  loadPosts,
  normalizePosts,
} = {}) => {
  app.post("/api/public/posts/:slug/view", async (req, res) => {
    const ip = resolveClientIp({ getRequestIp, req });
    if (!(await canRegisterView(ip))) {
      return res.status(429).json({ error: "rate_limited" });
    }
    const slug = String(req.params.slug || "");
    const post = findPublishedPublicPostBySlug({
      loadPosts,
      normalizePosts,
      slug,
    });
    if (!post) {
      return res.status(404).json({ error: "not_found" });
    }
    const updated = incrementPostViews(slug);
    appendAnalyticsEvent(req, {
      eventType: "view",
      resourceType: "post",
      resourceId: post.slug,
      meta: {
        action: "view",
        resourceType: "post",
        resourceId: post.slug,
      },
    });
    return res.json({ views: updated?.views ?? post.views ?? 0 });
  });
};

export default registerContentPostViewRoute;
