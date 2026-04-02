export const registerPublicBootstrapSearchRoutes = ({
  PUBLIC_BOOTSTRAP_MODE_FULL,
  PUBLIC_READ_CACHE_TAGS,
  PUBLIC_READ_CACHE_TTL_MS,
  app,
  buildPublicBootstrapResponsePayload,
  buildPublicMediaVariants,
  buildPublicSearchSuggestions,
  loadPosts,
  loadProjects,
  loadTagTranslations,
  normalizePosts,
  normalizeProjects,
  normalizeSearchQuery,
  parseSearchLimit,
  parseSearchScope,
  publicSearchConfig,
  readPublicCachedJson,
  resolvePostCover,
  writePublicCachedJson,
} = {}) => {
  app.get("/api/public/bootstrap", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const cached = readPublicCachedJson(req);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(cached.statusCode).json(cached.payload);
    }
    const payload = buildPublicBootstrapResponsePayload({
      payloadMode: PUBLIC_BOOTSTRAP_MODE_FULL,
    });
    writePublicCachedJson(req, payload, {
      ttlMs: 30000,
      tags: [PUBLIC_READ_CACHE_TAGS.BOOTSTRAP],
    });
    res.setHeader("X-Cache", "MISS");
    return res.json(payload);
  });

  app.get("/api/public/search/suggest", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const cached = readPublicCachedJson(req);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(cached.statusCode).json(cached.payload);
    }
    const q = normalizeSearchQuery(req.query.q);
    const scope = parseSearchScope(req.query.scope);
    const limit = parseSearchLimit(req.query.limit);

    if (q.length < publicSearchConfig.minQueryLength) {
      const payload = { q, scope, suggestions: [] };
      writePublicCachedJson(req, payload, {
        ttlMs: Math.min(PUBLIC_READ_CACHE_TTL_MS, 10000),
        tags: [PUBLIC_READ_CACHE_TAGS.SEARCH],
      });
      res.setHeader("X-Cache", "MISS");
      return res.json(payload);
    }

    const now = Date.now();
    const projects = normalizeProjects(loadProjects()).filter((project) => !project.deletedAt);
    const posts = normalizePosts(loadPosts())
      .filter((post) => !post.deletedAt)
      .filter((post) => {
        const publishTime = new Date(post.publishedAt).getTime();
        return publishTime <= now && (post.status === "published" || post.status === "scheduled");
      })
      .map((post) => {
        const resolvedCover = resolvePostCover(post);
        return {
          ...post,
          coverImageUrl: resolvedCover.coverImageUrl,
        };
      });

    const loadedTagTranslations = loadTagTranslations();
    const tagTranslations =
      loadedTagTranslations?.tags && typeof loadedTagTranslations.tags === "object"
        ? loadedTagTranslations.tags
        : {};
    const suggestions = buildPublicSearchSuggestions({
      query: q,
      scope,
      limit,
      projects,
      posts,
    }).map(({ score: _score, ...item }) => {
      const translatedTags = Array.isArray(item.tags)
        ? item.tags
            .map((tag) => {
              const rawTag = String(tag || "").trim();
              if (!rawTag) {
                return "";
              }
              const exact = tagTranslations[rawTag];
              const lowered = tagTranslations[rawTag.toLowerCase()];
              return String(exact || lowered || rawTag).trim();
            })
            .filter(Boolean)
            .slice(0, 4)
        : [];
      return {
        ...item,
        tags: translatedTags,
      };
    });

    const payload = {
      q,
      scope,
      suggestions,
      mediaVariants: buildPublicMediaVariants(suggestions),
    };
    writePublicCachedJson(req, payload, {
      ttlMs: Math.min(PUBLIC_READ_CACHE_TTL_MS, 15000),
      tags: [PUBLIC_READ_CACHE_TAGS.SEARCH],
    });
    res.setHeader("X-Cache", "MISS");
    return res.json(payload);
  });
};

export default registerPublicBootstrapSearchRoutes;
