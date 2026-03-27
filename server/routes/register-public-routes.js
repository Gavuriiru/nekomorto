export const registerPublicRoutes = ({
  app,
  PRIMARY_APP_ORIGIN,
  PUBLIC_BOOTSTRAP_MODE_FULL,
  PUBLIC_READ_CACHE_TAGS,
  PUBLIC_READ_CACHE_TTL_MS,
  PUBLIC_ANALYTICS_EVENT_TYPE_SET,
  PUBLIC_ANALYTICS_RESOURCE_TYPE_SET,
  appendAnalyticsEvent,
  buildLaunchesRssItems,
  buildPostsRssItems,
  buildProjectOgRevision,
  buildPublicBootstrapResponsePayload,
  buildPublicMediaVariants,
  buildPublicSearchSuggestions,
  buildPublicSitemapEntries,
  buildRssXml,
  canRegisterPollVote,
  canRegisterView,
  deriveChapterSynopsis,
  getProjectEpisodePageCount,
  getPublicReadableProjects,
  getPublicVisibleProjects,
  getPublicVisibleUpdates,
  hasProjectEpisodePages,
  incrementProjectViews,
  loadPosts,
  loadProjects,
  loadSiteSettings,
  loadTagTranslations,
  normalizeProjectEpisodeContentFormat,
  normalizeProjectEpisodePages,
  normalizePosts,
  normalizeProjects,
  normalizeSearchQuery,
  parseSearchLimit,
  parseSearchScope,
  publicSearchConfig,
  readPublicCachedJson,
  resolveEpisodeLookup,
  resolveMetaImageVariantUrl,
  resolvePostCover,
  resolveProjectReaderConfig,
  sendXmlResponse,
  updateLexicalPollVotes,
  writeProjects,
  writePublicCachedJson,
  buildSitemapXml,
} = {}) => {
  app.get("/sitemap.xml", (_req, res) => {
    const xml = buildSitemapXml(buildPublicSitemapEntries());
    return sendXmlResponse(res, xml, "application/xml; charset=utf-8");
  });

  app.get("/api/public/sitemap.xml", (_req, res) => {
    const xml = buildSitemapXml(buildPublicSitemapEntries());
    return sendXmlResponse(res, xml, "application/xml; charset=utf-8");
  });

  app.get("/rss/posts.xml", (_req, res) => {
    const settings = loadSiteSettings();
    const xml = buildRssXml({
      title: `${settings?.site?.name || "Nekomata"} • Posts`,
      link: PRIMARY_APP_ORIGIN,
      description: "Feed de postagens publicadas",
      selfUrl: `${PRIMARY_APP_ORIGIN}/rss/posts.xml`,
      items: buildPostsRssItems(),
    });
    return sendXmlResponse(res, xml, "application/rss+xml; charset=utf-8");
  });

  app.get("/rss/lancamentos.xml", (_req, res) => {
    const settings = loadSiteSettings();
    const xml = buildRssXml({
      title: `${settings?.site?.name || "Nekomata"} • Lançamentos`,
      link: `${PRIMARY_APP_ORIGIN}/projetos`,
      description: "Feed de lançamentos e ajustes de projetos",
      selfUrl: `${PRIMARY_APP_ORIGIN}/rss/lancamentos.xml`,
      items: buildLaunchesRssItems(),
    });
    return sendXmlResponse(res, xml, "application/rss+xml; charset=utf-8");
  });

  app.get("/api/public/rss.xml", (req, res) => {
    const feed = String(req.query.feed || "posts")
      .trim()
      .toLowerCase();
    if (feed === "lancamentos") {
      const settings = loadSiteSettings();
      const xml = buildRssXml({
        title: `${settings?.site?.name || "Nekomata"} • Lançamentos`,
        link: `${PRIMARY_APP_ORIGIN}/projetos`,
        description: "Feed de lançamentos e ajustes de projetos",
        selfUrl: `${PRIMARY_APP_ORIGIN}/api/public/rss.xml?feed=lancamentos`,
        items: buildLaunchesRssItems(),
      });
      return sendXmlResponse(res, xml, "application/rss+xml; charset=utf-8");
    }
    const settings = loadSiteSettings();
    const xml = buildRssXml({
      title: `${settings?.site?.name || "Nekomata"} • Posts`,
      link: PRIMARY_APP_ORIGIN,
      description: "Feed de postagens publicadas",
      selfUrl: `${PRIMARY_APP_ORIGIN}/api/public/rss.xml?feed=posts`,
      items: buildPostsRssItems(),
    });
    return sendXmlResponse(res, xml, "application/rss+xml; charset=utf-8");
  });

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

  app.get("/api/public/projects", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const cached = readPublicCachedJson(req);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(cached.statusCode).json(cached.payload);
    }
    const limitRaw = Number(req.query.limit);
    const pageRaw = Number(req.query.page);
    const usePagination = Number.isFinite(limitRaw) || Number.isFinite(pageRaw);
    const limit = usePagination ? Math.min(Math.max(limitRaw || 20, 1), 200) : null;
    const page = usePagination ? Math.max(pageRaw || 1, 1) : null;
    const projects = getPublicVisibleProjects().map((project) => ({
      id: project.id,
      title: project.title,
      titleOriginal: project.titleOriginal,
      titleEnglish: project.titleEnglish,
      synopsis: project.synopsis,
      description: project.description,
      type: project.type,
      status: project.status,
      year: project.year,
      studio: project.studio,
      animationStudios: project.animationStudios,
      episodes: project.episodes,
      tags: project.tags,
      genres: project.genres,
      cover: project.cover,
      banner: project.banner,
      season: project.season,
      schedule: project.schedule,
      rating: project.rating,
      country: project.country,
      source: project.source,
      producers: project.producers,
      score: project.score,
      startDate: project.startDate,
      endDate: project.endDate,
      relations: project.relations,
      staff: project.staff,
      animeStaff: project.animeStaff,
      trailerUrl: project.trailerUrl,
      forceHero: project.forceHero,
      heroImageUrl: project.heroImageUrl,
      volumeEntries: project.volumeEntries,
      volumeCovers: project.volumeCovers,
      episodeDownloads: project.episodeDownloads,
      views: project.views,
      commentsCount: project.commentsCount,
    }));
    let payload = null;
    if (!usePagination) {
      payload = { projects };
    } else {
      const start = (page - 1) * limit;
      const paged = projects.slice(start, start + limit);
      payload = { projects: paged, page, limit, total: projects.length };
    }
    payload = {
      ...payload,
      mediaVariants: buildPublicMediaVariants(payload.projects),
    };
    writePublicCachedJson(req, payload, {
      ttlMs: PUBLIC_READ_CACHE_TTL_MS,
      tags: [PUBLIC_READ_CACHE_TAGS.PROJECTS],
    });
    res.setHeader("X-Cache", "MISS");
    return res.json(payload);
  });

  app.get("/api/public/projects/:id", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const id = String(req.params.id || "");
    const projects = getPublicVisibleProjects();
    const project = projects.find((item) => item.id === id);
    if (!project) {
      return res.status(404).json({ error: "not_found" });
    }
    const settings = loadSiteSettings();
    const { discordRoleId: _discordRoleId, ...projectWithoutDiscordRoleId } = project;
    const projectPayload = {
      ...projectWithoutDiscordRoleId,
      readerConfig: resolveProjectReaderConfig({
        projectType: project?.type,
        siteSettings: settings,
        projectReaderConfig: project?.readerConfig,
      }),
    };
    const translations = loadTagTranslations();
    return res.json({
      project: projectPayload,
      revision: buildProjectOgRevision({
        project: projectPayload,
        settings,
        translations,
        origin: PRIMARY_APP_ORIGIN,
        resolveVariantUrl: resolveMetaImageVariantUrl,
      }),
      mediaVariants: buildPublicMediaVariants(projectPayload),
    });
  });

  app.post("/api/public/projects/:id/view", async (req, res) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    if (!(await canRegisterView(ip))) {
      return res.status(429).json({ error: "rate_limited" });
    }
    const id = String(req.params.id || "");
    const projects = normalizeProjects(loadProjects());
    const project = projects.find((item) => item.id === id);
    if (!project) {
      return res.status(404).json({ error: "not_found" });
    }
    if (project.deletedAt) {
      return res.status(404).json({ error: "not_found" });
    }
    const updated = incrementProjectViews(id);
    appendAnalyticsEvent(req, {
      eventType: "view",
      resourceType: "project",
      resourceId: project.id,
      meta: {
        action: "view",
        resourceType: "project",
        resourceId: project.id,
      },
    });
    return res.json({ views: updated?.views ?? project.views ?? 0 });
  });

  app.post("/api/public/analytics/event", async (req, res) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    if (!(await canRegisterView(ip))) {
      return res.status(429).json({ error: "rate_limited" });
    }
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const eventType = String(payload.eventType || "")
      .trim()
      .toLowerCase();
    const resourceType = String(payload.resourceType || "")
      .trim()
      .toLowerCase();
    const resourceId = String(payload.resourceId || "").trim();
    if (!PUBLIC_ANALYTICS_EVENT_TYPE_SET.has(eventType)) {
      return res.status(400).json({ error: "invalid_event_type" });
    }
    if (!PUBLIC_ANALYTICS_RESOURCE_TYPE_SET.has(resourceType)) {
      return res.status(400).json({ error: "invalid_resource_type" });
    }
    if (!resourceId) {
      return res.status(400).json({ error: "invalid_resource_id" });
    }
    const result = appendAnalyticsEvent(req, {
      eventType,
      resourceType,
      resourceId,
      meta:
        payload.meta && typeof payload.meta === "object" && !Array.isArray(payload.meta)
          ? payload.meta
          : {},
    });
    if (result.ok || result.reason === "cooldown") {
      return res.json({ ok: true, deduped: result.reason === "cooldown" });
    }
    return res.status(500).json({ error: "event_write_failed" });
  });

  app.get("/api/public/projects/:id/chapters/:number", (req, res) => {
    const id = String(req.params.id || "");
    const chapterNumber = Number(req.params.number);
    const volume = req.query.volume ? Number(req.query.volume) : null;
    if (!Number.isFinite(chapterNumber)) {
      return res.status(400).json({ error: "invalid_chapter" });
    }
    const projects = getPublicReadableProjects();
    const project = projects.find((item) => item.id === id);
    if (!project) {
      return res.status(404).json({ error: "not_found" });
    }
    const chapterLookup = resolveEpisodeLookup(project, chapterNumber, volume, {
      requirePublished: true,
    });
    if (!chapterLookup.ok) {
      return res.status(chapterLookup.code === "volume_required" ? 400 : 404).json({
        error: chapterLookup.code,
      });
    }
    const chapter = chapterLookup.episode;
    const normalizedPages = normalizeProjectEpisodePages(chapter?.pages);
    const contentFormat = normalizeProjectEpisodeContentFormat(
      chapter?.contentFormat,
      normalizedPages.length > 0 ? "images" : "lexical",
    );
    const pageCount = getProjectEpisodePageCount({
      ...chapter,
      contentFormat,
      pages: normalizedPages,
    });
    const settings = loadSiteSettings();
    return res.json({
      chapter: {
        number: chapter.number,
        volume: chapter.volume,
        title: chapter.title,
        entryKind:
          String(chapter.entryKind || "")
            .trim()
            .toLowerCase() === "extra"
            ? "extra"
            : "main",
        entrySubtype: String(chapter.entrySubtype || "").trim(),
        readingOrder: Number.isFinite(Number(chapter.readingOrder))
          ? Number(chapter.readingOrder)
          : undefined,
        displayLabel: String(chapter.displayLabel || "").trim(),
        synopsis: deriveChapterSynopsis(chapter),
        releaseDate: chapter.releaseDate || "",
        updatedAt: chapter.chapterUpdatedAt || chapter.updatedAt || "",
        coverImageUrl: chapter.coverImageUrl || normalizedPages[0]?.imageUrl || "",
        coverImageAlt: chapter.coverImageAlt || "",
        content: contentFormat === "lexical" ? chapter.content || "" : "",
        contentFormat,
        pages: normalizedPages,
        pageCount,
        hasPages: hasProjectEpisodePages({
          ...chapter,
          contentFormat,
          pages: normalizedPages,
          pageCount,
        }),
      },
      readerConfig: resolveProjectReaderConfig({
        projectType: project?.type,
        siteSettings: settings,
        projectReaderConfig: project?.readerConfig,
      }),
    });
  });

  app.post("/api/public/projects/:id/chapters/:number/polls/vote", async (req, res) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    if (!(await canRegisterPollVote(ip))) {
      return res.status(429).json({ error: "rate_limited" });
    }
    const id = String(req.params.id || "");
    const chapterNumber = Number(req.params.number);
    const volume = req.query.volume ? Number(req.query.volume) : null;
    const { optionUid, voterId, checked, question } = req.body || {};
    if (!Number.isFinite(chapterNumber)) {
      return res.status(400).json({ error: "invalid_chapter" });
    }
    if (!optionUid || !voterId) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    const projects = normalizeProjects(loadProjects());
    const projectIndex = projects.findIndex((item) => item.id === id);
    if (projectIndex === -1) {
      return res.status(404).json({ error: "not_found" });
    }
    const project = projects[projectIndex];
    const chapterLookup = resolveEpisodeLookup(project, chapterNumber, volume, {
      requirePublished: true,
    });
    if (!chapterLookup.ok) {
      return res.status(chapterLookup.code === "volume_required" ? 400 : 404).json({
        error: chapterLookup.code,
      });
    }
    const chapterIndex = chapterLookup.index;
    const chapter = chapterLookup.episode;
    const result = updateLexicalPollVotes(chapter.content, {
      question,
      optionUid,
      voterId,
      checked,
    });
    if (!result.updated || !result.content) {
      return res.status(404).json({ error: "poll_not_found" });
    }
    const updatedChapter = {
      ...chapter,
      content: result.content,
    };
    const updatedEpisodes = [...project.episodeDownloads];
    updatedEpisodes[chapterIndex] = updatedChapter;
    projects[projectIndex] = {
      ...project,
      episodeDownloads: updatedEpisodes,
    };
    writeProjects(projects);
    return res.json({ ok: true });
  });

  app.get("/api/public/updates", (req, res) => {
    const limitRaw = Number(req.query.limit);
    const pageRaw = Number(req.query.page);
    const usePagination = Number.isFinite(limitRaw) || Number.isFinite(pageRaw);
    const limit = usePagination ? Math.min(Math.max(limitRaw || 10, 1), 50) : 10;
    const page = usePagination ? Math.max(pageRaw || 1, 1) : 1;
    const updates = getPublicVisibleUpdates();
    if (!usePagination) {
      return res.json({ updates: updates.slice(0, limit) });
    }
    const start = (page - 1) * limit;
    const paged = updates.slice(start, start + limit);
    return res.json({ updates: paged, page, limit, total: updates.length });
  });
};
