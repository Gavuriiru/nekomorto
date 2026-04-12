const REQUIRED_DEPENDENCY_KEYS = [
  "createSlug",
  "getLoadPosts",
  "getLoadProjects",
  "getWritePosts",
  "getWriteProjects",
  "getProjectEpisodePageCount",
  "normalizeProjectEpisodeContentFormat",
  "normalizeProjectEpisodePages",
  "normalizeProjectReaderConfig",
  "normalizeUploadsDeep",
  "resolvePostStatus",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[content-collections-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

const resolveLazyDependency = (dependencyName, getter) => {
  if (typeof getter !== "function") {
    throw new Error(`[content-collections-runtime] ${dependencyName} getter must be a function`);
  }
  const value = getter();
  if (typeof value === "function") {
    return value;
  }
  throw new Error(
    `[content-collections-runtime] ${dependencyName} getter must resolve to a function`,
  );
};

export const createContentCollectionsRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    createSlug,
    getLoadPosts,
    getLoadProjects,
    getProjectEpisodePageCount,
    getWritePosts,
    getWriteProjects,
    normalizeProjectEpisodeContentFormat,
    normalizeProjectEpisodePages,
    normalizeProjectReaderConfig,
    normalizeUploadsDeep,
    resolvePostStatus,
  } = dependencies;

  const buildSearchText = (...parts) =>
    parts
      .flat()
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const normalizePosts = (posts) => {
    const now = Date.now();
    return (Array.isArray(posts) ? posts : []).map((post, index) => {
      const id = String(post?.id || `${Date.now()}-${index}`);
      const title = String(post?.title || "Sem título");
      const slug = String(post?.slug || createSlug(title) || id);
      const publishedAt = post?.publishedAt || post?.createdAt || new Date().toISOString();
      const scheduledAt = post?.scheduledAt || null;
      const status = resolvePostStatus(post?.status, publishedAt, now);
      const normalized = {
        id,
        title,
        slug,
        coverImageUrl: post?.coverImageUrl || null,
        coverAlt: post?.coverAlt || "",
        excerpt: post?.excerpt || "",
        content: post?.content || "",
        contentFormat:
          post?.contentFormat === "html" || post?.contentFormat === "lexical"
            ? post.contentFormat
            : "markdown",
        author: post?.author || "",
        publishedAt,
        scheduledAt,
        status,
        seoTitle: post?.seoTitle || "",
        seoDescription: post?.seoDescription || "",
        projectId: post?.projectId || "",
        tags: Array.isArray(post?.tags) ? post.tags.filter(Boolean) : [],
        views: Number.isFinite(post?.views) ? post.views : 0,
        viewsDaily: post?.viewsDaily && typeof post.viewsDaily === "object" ? post.viewsDaily : {},
        commentsCount: Number.isFinite(post?.commentsCount) ? post.commentsCount : 0,
        deletedAt: post?.deletedAt || null,
        deletedBy: post?.deletedBy || null,
        createdAt: post?.createdAt || new Date().toISOString(),
        updatedAt: post?.updatedAt || post?.createdAt || new Date().toISOString(),
      };
      normalized.searchText = buildSearchText(
        normalized.title,
        normalized.excerpt,
        normalized.author,
        ...(Array.isArray(normalized.tags) ? normalized.tags : []),
      );
      return normalizeUploadsDeep(normalized);
    });
  };

  const normalizeProjects = (projects) =>
    (Array.isArray(projects) ? projects : []).map((project, index) => {
      const sourceVolumeEntries = Array.isArray(project?.volumeEntries)
        ? project.volumeEntries
        : Array.isArray(project?.volumeCovers)
          ? project.volumeCovers
          : [];
      const normalizedVolumeEntries = sourceVolumeEntries
        .map((entry) => {
          const volume = Number.isFinite(Number(entry?.volume)) ? Number(entry.volume) : null;
          if (volume === null) {
            return null;
          }
          const coverImageUrl = String(entry?.coverImageUrl || "").trim();
          return {
            volume,
            synopsis: String(entry?.synopsis || "").trim(),
            coverImageUrl,
            coverImageAlt: coverImageUrl
              ? String(entry?.coverImageAlt || `Capa do volume ${volume}`).trim()
              : "",
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.volume - right.volume);
      const normalizedVolumeCovers = normalizedVolumeEntries
        .filter((entry) => String(entry?.coverImageUrl || "").trim())
        .map((entry) => ({
          volume: entry.volume,
          coverImageUrl: String(entry.coverImageUrl || "").trim(),
          coverImageAlt: String(entry.coverImageAlt || `Capa do volume ${entry.volume}`).trim(),
        }));
      const normalizedEpisodeDownloads = Array.isArray(project?.episodeDownloads)
        ? project.episodeDownloads.map((episode) => {
            const episodeObject = episode && typeof episode === "object" ? episode : {};
            const { synopsis: _episodeSynopsis, ...episodeWithoutSynopsis } = episodeObject;
            const normalizedSources = Array.isArray(episode?.sources)
              ? episode.sources.map((source) => ({
                  label: String(source?.label || ""),
                  url: String(source?.url || ""),
                }))
              : [];
            const legacyHash = Array.isArray(episode?.sources)
              ? String(
                  episode.sources.find((source) => String(source?.hash || "").trim())?.hash || "",
                ).trim()
              : "";
            const legacyRawSizeBytes = Array.isArray(episode?.sources)
              ? Number(
                  episode.sources.find((source) => {
                    const parsed = Number(source?.sizeBytes);
                    return Number.isFinite(parsed) && parsed > 0;
                  })?.sizeBytes,
                )
              : Number.NaN;
            const hash = String(episode?.hash || "").trim() || legacyHash;
            const rawSizeBytes = Number(episode?.sizeBytes);
            const resolvedRawSizeBytes =
              Number.isFinite(rawSizeBytes) && rawSizeBytes > 0 ? rawSizeBytes : legacyRawSizeBytes;
            const sizeBytes =
              Number.isFinite(resolvedRawSizeBytes) && resolvedRawSizeBytes > 0
                ? Math.round(resolvedRawSizeBytes)
                : undefined;
            const entryKind =
              String(episodeObject?.entryKind || "")
                .trim()
                .toLowerCase() === "extra"
                ? "extra"
                : "main";
            const readingOrderRaw = Number(episodeObject?.readingOrder);
            const readingOrder = Number.isFinite(readingOrderRaw)
              ? Math.round(readingOrderRaw)
              : undefined;
            const completedStages = Array.from(
              new Set(
                (Array.isArray(episodeObject?.completedStages) ? episodeObject.completedStages : [])
                  .map((stageId) => String(stageId || "").trim())
                  .filter(Boolean),
              ),
            );
            const normalizedPages = normalizeProjectEpisodePages(episodeObject?.pages);
            const contentFormat = normalizeProjectEpisodeContentFormat(
              episode?.contentFormat,
              normalizedPages.length > 0 ? "images" : "lexical",
            );
            const pageCount = getProjectEpisodePageCount({
              ...episodeObject,
              contentFormat,
              pages: normalizedPages,
            });
            const requestedCoverImageUrl = String(episode?.coverImageUrl || "").trim();
            const coverImageUrl =
              requestedCoverImageUrl ||
              (contentFormat === "images" ? String(normalizedPages[0]?.imageUrl || "").trim() : "");
            return {
              ...episodeWithoutSynopsis,
              number: Number.isFinite(Number(episode?.number)) ? Number(episode.number) : 0,
              volume: Number.isFinite(Number(episode?.volume)) ? Number(episode.volume) : undefined,
              title: String(episode?.title || ""),
              entryKind,
              entrySubtype: String(episodeObject?.entrySubtype || "").trim() || undefined,
              readingOrder,
              displayLabel:
                entryKind === "extra"
                  ? String(episodeObject?.displayLabel || "").trim() || undefined
                  : undefined,
              releaseDate: String(episode?.releaseDate || ""),
              duration: String(episode?.duration || ""),
              sourceType:
                episodeObject?.sourceType === "Blu-ray" || episodeObject?.sourceType === "Web"
                  ? episodeObject.sourceType
                  : episodeObject?.sourceType === "Blu-Ray"
                    ? "Blu-ray"
                    : "TV",
              coverImageUrl: coverImageUrl || undefined,
              content: typeof episode?.content === "string" ? episode.content : "",
              contentFormat,
              pages: normalizedPages,
              pageCount,
              hasPages: pageCount > 0,
              publicationStatus:
                String(episodeObject?.publicationStatus || "")
                  .trim()
                  .toLowerCase() === "draft"
                  ? "draft"
                  : "published",
              sources: normalizedSources,
              completedStages,
              progressStage: String(episodeObject?.progressStage || "").trim() || undefined,
              coverImageAlt: String(episode?.coverImageAlt || episode?.title || "").trim(),
              hash: hash || undefined,
              sizeBytes,
              chapterUpdatedAt: episodeObject.chapterUpdatedAt || "",
            };
          })
        : [];

      const normalized = {
        id: String(project?.id || `project-${Date.now()}-${index}`),
        anilistId: project?.anilistId ? Number(project.anilistId) : null,
        title: String(project?.title || "Sem título"),
        titleOriginal: String(project?.titleOriginal || ""),
        titleEnglish: String(project?.titleEnglish || ""),
        synopsis: String(project?.synopsis || ""),
        description: String(project?.description || ""),
        type: String(project?.type || project?.format || ""),
        status: String(project?.status || ""),
        year: String(project?.year || ""),
        studio: String(project?.studio || ""),
        animationStudios: Array.isArray(project?.animationStudios)
          ? project.animationStudios.filter(Boolean)
          : [],
        episodes: String(project?.episodes || ""),
        tags: Array.isArray(project?.tags) ? project.tags.filter(Boolean) : [],
        genres: Array.isArray(project?.genres) ? project.genres.filter(Boolean) : [],
        cover: project?.cover || "/placeholder.svg",
        coverAlt: String(project?.coverAlt || project?.title || "Capa do projeto").trim(),
        banner: project?.banner || "/placeholder.svg",
        bannerAlt: String(project?.bannerAlt || `${project?.title || "Projeto"} (banner)`).trim(),
        season: String(project?.season || ""),
        schedule: String(project?.schedule || ""),
        rating: String(project?.rating || ""),
        country: String(project?.country || ""),
        source: String(project?.source || ""),
        discordRoleId: /^\d+$/.test(String(project?.discordRoleId || "").trim())
          ? String(project?.discordRoleId || "").trim()
          : "",
        producers: Array.isArray(project?.producers) ? project.producers.filter(Boolean) : [],
        score: Number.isFinite(project?.score) ? project.score : null,
        startDate: project?.startDate || "",
        endDate: project?.endDate || "",
        relations: Array.isArray(project?.relations) ? project.relations : [],
        staff: Array.isArray(project?.fansubStaff)
          ? project.fansubStaff
          : Array.isArray(project?.staff)
            ? project.staff
            : [],
        animeStaff: Array.isArray(project?.animeStaff) ? project.animeStaff : [],
        trailerUrl: project?.trailerUrl || "",
        forceHero: Boolean(project?.forceHero),
        heroImageUrl: String(project?.heroImageUrl || ""),
        heroImageAlt: String(
          project?.heroImageAlt || `${project?.title || "Projeto"} (hero)`,
        ).trim(),
        readerConfig: normalizeProjectReaderConfig(project?.readerConfig, {
          projectType: project?.type || project?.format || "",
        }),
        volumeEntries: normalizedVolumeEntries,
        volumeCovers: normalizedVolumeCovers,
        episodeDownloads: normalizedEpisodeDownloads,
        views: Number.isFinite(project?.views) ? project.views : 0,
        viewsDaily:
          project?.viewsDaily && typeof project.viewsDaily === "object" ? project.viewsDaily : {},
        commentsCount: Number.isFinite(project?.commentsCount) ? project.commentsCount : 0,
        order: Number.isFinite(project?.order) ? project.order : index,
        deletedAt: project?.deletedAt || null,
        deletedBy: project?.deletedBy || null,
        createdAt: project?.createdAt || new Date().toISOString(),
        updatedAt: project?.updatedAt || project?.createdAt || new Date().toISOString(),
      };
      normalized.searchText = buildSearchText(
        normalized.title,
        normalized.titleOriginal,
        normalized.titleEnglish,
        normalized.synopsis,
        normalized.description,
        normalized.type,
        normalized.status,
        normalized.studio,
        ...(Array.isArray(normalized.animationStudios) ? normalized.animationStudios : []),
        ...(Array.isArray(normalized.producers) ? normalized.producers : []),
        ...(Array.isArray(normalized.tags) ? normalized.tags : []),
        ...(Array.isArray(normalized.genres) ? normalized.genres : []),
      );
      return normalizeUploadsDeep(normalized);
    });

  const getTodayKey = () => new Date().toISOString().slice(0, 10);

  const incrementPostViews = (slug) => {
    const loadPosts = resolveLazyDependency("getLoadPosts", getLoadPosts);
    const writePosts = resolveLazyDependency("getWritePosts", getWritePosts);
    const posts = normalizePosts(loadPosts());
    const index = posts.findIndex((post) => post.slug === String(slug));
    if (index === -1) {
      return null;
    }
    const existing = posts[index];
    const nextViews = Number.isFinite(existing.views) ? existing.views + 1 : 1;
    const todayKey = getTodayKey();
    const nextViewsDaily = {
      ...(existing.viewsDaily || {}),
      [todayKey]: Number.isFinite(existing.viewsDaily?.[todayKey])
        ? existing.viewsDaily[todayKey] + 1
        : 1,
    };
    posts[index] = {
      ...existing,
      views: nextViews,
      viewsDaily: nextViewsDaily,
    };
    writePosts(posts);
    return posts[index];
  };

  const incrementProjectViews = (id) => {
    const loadProjects = resolveLazyDependency("getLoadProjects", getLoadProjects);
    const writeProjects = resolveLazyDependency("getWriteProjects", getWriteProjects);
    const projects = normalizeProjects(loadProjects());
    const index = projects.findIndex((project) => project.id === String(id));
    if (index === -1) {
      return null;
    }
    const existing = projects[index];
    const nextViews = Number.isFinite(existing.views) ? existing.views + 1 : 1;
    const todayKey = getTodayKey();
    const nextViewsDaily = {
      ...(existing.viewsDaily || {}),
      [todayKey]: Number.isFinite(existing.viewsDaily?.[todayKey])
        ? existing.viewsDaily[todayKey] + 1
        : 1,
    };
    projects[index] = {
      ...existing,
      views: nextViews,
      viewsDaily: nextViewsDaily,
    };
    writeProjects(projects);
    return projects[index];
  };

  const countApprovedComments = (comments, targetType, targetId) =>
    (Array.isArray(comments) ? comments : []).filter(
      (comment) =>
        comment?.status === "approved" &&
        comment?.targetType === targetType &&
        comment?.targetId === targetId,
    ).length;

  const applyCommentCountToPosts = (posts, comments, targetId) => {
    const next = [...(Array.isArray(posts) ? posts : [])];
    const index = next.findIndex((post) => post.slug === targetId || post.id === targetId);
    if (index === -1) {
      return next;
    }
    next[index] = {
      ...next[index],
      commentsCount: countApprovedComments(comments, "post", next[index].slug),
      updatedAt: new Date().toISOString(),
    };
    return next;
  };

  const applyCommentCountToProjects = (projects, comments, targetId) => {
    const next = [...(Array.isArray(projects) ? projects : [])];
    const index = next.findIndex((project) => project.id === targetId);
    if (index === -1) {
      return next;
    }
    next[index] = {
      ...next[index],
      commentsCount: countApprovedComments(comments, "project", next[index].id),
      updatedAt: new Date().toISOString(),
    };
    return next;
  };

  return {
    applyCommentCountToPosts,
    applyCommentCountToProjects,
    incrementPostViews,
    incrementProjectViews,
    normalizePosts,
    normalizeProjects,
  };
};

export default createContentCollectionsRuntime;
