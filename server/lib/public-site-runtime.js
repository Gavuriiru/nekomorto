export const PUBLIC_BOOTSTRAP_MODE_FULL = "full";
export const PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME = "critical-home";

const REQUIRED_DEPENDENCY_KEYS = [
  "buildPublicBootstrapPayload",
  "buildPublicMediaVariants",
  "buildPublicTeamMembers",
  "buildUserPayload",
  "createGuid",
  "createSlug",
  "extractLocalStylesheetHrefs",
  "getPublicVisiblePosts",
  "getPublicVisibleProjects",
  "getPublicVisibleUpdates",
  "injectBootstrapGlobals",
  "injectHomeHeroShell",
  "injectPreloadLinks",
  "loadLinkTypes",
  "loadPages",
  "loadSiteSettings",
  "loadTagTranslations",
  "primaryAppOrigin",
  "resolveHomeHeroPreloadFromSlide",
  "resolveMetaImageVariantUrl",
  "resolvePostCover",
  "resolvePublicPostCoverPreload",
  "resolvePublicProjectsListPreloads",
  "resolvePublicReaderHeroPreload",
  "resolvePublicTeamAvatarPreload",
  "sitemapStaticPublicPaths",
  "stripHtml",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `[public-site-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
    );
  }
  if (
    dependencies.bootstrapPwaEnabled === undefined &&
    typeof dependencies.resolveBootstrapPwaEnabled !== "function"
  ) {
    throw new Error(
      "[public-site-runtime] missing required dependencies: bootstrapPwaEnabled or resolveBootstrapPwaEnabled",
    );
  }
};

export const createPublicSiteRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    bootstrapPwaEnabled,
    buildPublicBootstrapPayload,
    buildPublicMediaVariants,
    buildPublicTeamMembers,
    buildUserPayload,
    createGuid,
    createSlug,
    extractLocalStylesheetHrefs,
    getPublicVisiblePosts,
    getPublicVisibleProjects,
    getPublicVisibleUpdates,
    injectBootstrapGlobals,
    injectHomeHeroShell,
    injectPreloadLinks,
    loadLinkTypes,
    loadPages,
    loadSiteSettings,
    loadTagTranslations,
    primaryAppOrigin,
    resolveHomeHeroPreloadFromSlide,
    resolveMetaImageVariantUrl,
    resolvePostCover,
    resolveBootstrapPwaEnabled,
    resolvePublicPostCoverPreload,
    resolvePublicProjectsListPreloads,
    resolvePublicReaderHeroPreload,
    resolvePublicTeamAvatarPreload,
    sitemapStaticPublicPaths,
    stripHtml,
  } = dependencies;
  const resolveBootstrapPwaEnabledForRequest =
    typeof resolveBootstrapPwaEnabled === "function"
      ? resolveBootstrapPwaEnabled
      : () => bootstrapPwaEnabled === true;

  const stripAndTruncateRssText = (value, max = 280) => {
    const text = stripHtml(String(value || ""))
      .replace(/\s+/g, " ")
      .trim();
    if (!text) {
      return "";
    }
    if (text.length <= max) {
      return text;
    }
    return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
  };

  const buildPublicSitemapEntries = () => {
    const settings = loadSiteSettings();
    const siteUpdatedAt = String(settings?.updatedAt || "").trim();
    const entries = [
      ...sitemapStaticPublicPaths.map((pathname) => ({
        loc: `${primaryAppOrigin}${pathname}`,
        lastmod: siteUpdatedAt || null,
        changefreq: pathname === "/" ? "hourly" : "daily",
        priority: pathname === "/" ? 1 : pathname === "/projetos" ? 0.9 : 0.7,
      })),
      ...getPublicVisibleProjects().map((project) => ({
        loc: `${primaryAppOrigin}/projeto/${project.id}`,
        lastmod: project.updatedAt || project.createdAt || null,
        changefreq: "weekly",
        priority: 0.8,
      })),
      ...getPublicVisiblePosts().map((post) => ({
        loc: `${primaryAppOrigin}/postagem/${post.slug}`,
        lastmod: post.updatedAt || post.publishedAt || null,
        changefreq: "monthly",
        priority: 0.7,
      })),
    ];
    const seen = new Set();
    return entries.filter((entry) => {
      if (!entry.loc || seen.has(entry.loc)) {
        return false;
      }
      seen.add(entry.loc);
      return true;
    });
  };

  const buildPostsRssItems = () =>
    getPublicVisiblePosts()
      .slice(0, 50)
      .map((post) => {
        const link = `${primaryAppOrigin}/postagem/${post.slug}`;
        return {
          title: post.title || "Postagem",
          link,
          guid: link,
          pubDate: post.publishedAt,
          description: stripAndTruncateRssText(
            post.seoDescription || post.excerpt || post.content || "",
          ),
          categories: Array.isArray(post.tags) ? post.tags.slice(0, 5) : [],
        };
      });

  const buildLaunchesRssItems = () => {
    const publicProjects = new Map(
      getPublicVisibleProjects().map((project) => [String(project.id), project]),
    );
    return getPublicVisibleUpdates()
      .filter((update) => {
        const kind = String(update?.kind || "")
          .trim()
          .toLowerCase();
        return kind.startsWith("lan") || kind === "ajuste";
      })
      .slice(0, 50)
      .map((update) => {
        const projectId = String(update?.projectId || "").trim();
        const project = publicProjects.get(projectId);
        const projectTitle = String(update?.projectTitle || project?.title || "Projeto");
        const unit = String(update?.unit || "Capítulo").trim() || "Capítulo";
        const isExtraUnit = unit.toLowerCase() === "extra";
        const episodeNumber = Number.isFinite(Number(update?.episodeNumber))
          ? Number(update.episodeNumber)
          : null;
        const kind = String(update?.kind || "Atualização").trim() || "Atualização";
        const link = project ? `${primaryAppOrigin}/projeto/${project.id}` : primaryAppOrigin;
        return {
          title: `${kind}: ${projectTitle}${episodeNumber !== null ? ` - ${unit}${isExtraUnit ? "" : ` ${episodeNumber}`}` : ""}`,
          link,
          guid: `${link}#update-${String(update?.id || createGuid())}`,
          pubDate: String(update?.updatedAt || new Date().toISOString()),
          description: stripAndTruncateRssText(
            String(update?.reason || `${kind} em ${projectTitle}`),
            320,
          ),
          categories: [kind],
        };
      });
  };

  const sendXmlResponse = (res, xml, contentType) => {
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    return res.status(200).send(xml);
  };

  const sortPublicLaunchUpdates = (updates) =>
    [...(Array.isArray(updates) ? updates : [])]
      .filter((update) => {
        const kind = String(update?.kind || "")
          .trim()
          .toLowerCase();
        return kind === "lançamento" || kind === "lancamento";
      })
      .sort(
        (a, b) => new Date(b?.updatedAt || 0).getTime() - new Date(a?.updatedAt || 0).getTime(),
      );

  const buildPublicHeroSlides = (projects, updates) => {
    const projectList = Array.isArray(projects) ? projects : [];
    const launchUpdates = sortPublicLaunchUpdates(updates);
    const latestLaunchByProject = new Map();
    launchUpdates.forEach((update) => {
      const projectId = String(update?.projectId || "").trim();
      if (!projectId || latestLaunchByProject.has(projectId)) {
        return;
      }
      latestLaunchByProject.set(projectId, String(update?.updatedAt || ""));
    });

    const projectsById = new Map(
      projectList.map((project) => [String(project?.id || ""), project]),
    );
    const resultIds = new Set();
    const slides = [];
    const maxSlides = 5;
    const epoch = "1970-01-01T00:00:00.000Z";
    const createSlide = (project, updatedAt) => {
      const projectId = String(project?.id || "");
      if (!projectId || resultIds.has(projectId)) {
        return null;
      }
      const image =
        String(project?.heroImageUrl || "").trim() ||
        String(project?.banner || "").trim() ||
        String(project?.cover || "").trim() ||
        "";
      if (!image) {
        return null;
      }
      return {
        id: projectId,
        image,
        updatedAt: updatedAt || epoch,
      };
    };

    const orderedProjects = projectList
      .map((project, index) => {
        const projectId = String(project?.id || "");
        const updatedAt = latestLaunchByProject.get(projectId) || "";
        const time = updatedAt ? new Date(updatedAt).getTime() : 0;
        return { project, index, updatedAt, time };
      })
      .sort((a, b) => {
        if (b.time !== a.time) {
          return b.time - a.time;
        }
        return a.index - b.index;
      });

    orderedProjects.forEach((item) => {
      const slide = createSlide(item.project, item.updatedAt);
      if (!slide) {
        return;
      }
      if (slides.length < maxSlides) {
        slides.push(slide);
        resultIds.add(slide.id);
        return;
      }
      if (item.project?.forceHero !== true) {
        return;
      }
      slides.push(slide);
      resultIds.add(slide.id);
      const removeIndexFromEnd = [...slides]
        .reverse()
        .findIndex((candidate) => projectsById.get(candidate.id)?.forceHero !== true);
      if (removeIndexFromEnd === -1) {
        const removed = slides.shift();
        if (removed) {
          resultIds.delete(removed.id);
        }
        return;
      }
      const removeIndex = slides.length - 1 - removeIndexFromEnd;
      const [removed] = slides.splice(removeIndex, 1);
      if (removed) {
        resultIds.delete(removed.id);
      }
    });

    return slides;
  };

  const toCriticalHomeProjectPayload = (project) => ({
    id: String(project?.id || "").trim(),
    title: String(project?.title || "").trim(),
    synopsis: String(project?.synopsis || ""),
    description: String(project?.description || ""),
    type: String(project?.type || ""),
    status: String(project?.status || ""),
    tags: Array.isArray(project?.tags) ? project.tags : [],
    cover: String(project?.cover || ""),
    coverAlt: String(project?.coverAlt || ""),
    banner: String(project?.banner || ""),
    bannerAlt: String(project?.bannerAlt || ""),
    heroImageUrl: String(project?.heroImageUrl || ""),
    heroImageAlt: String(project?.heroImageAlt || ""),
    forceHero: project?.forceHero === true,
    trailerUrl: String(project?.trailerUrl || ""),
    volumeEntries: [],
    volumeCovers: [],
    episodeDownloads: [],
    views: Number.isFinite(Number(project?.views)) ? Math.max(0, Number(project.views)) : 0,
    viewsDaily:
      project?.viewsDaily && typeof project.viewsDaily === "object" ? project.viewsDaily : {},
  });

  const toCriticalHomeUpdatePayload = (update) => ({
    id: String(update?.id || "").trim(),
    projectId: String(update?.projectId || "").trim(),
    projectTitle: String(update?.projectTitle || ""),
    episodeNumber: Number.isFinite(Number(update?.episodeNumber))
      ? Number(update.episodeNumber)
      : 0,
    volume: Number.isFinite(Number(update?.volume)) ? Number(update.volume) : undefined,
    kind: String(update?.kind || ""),
    reason: String(update?.reason || ""),
    updatedAt: String(update?.updatedAt || ""),
    image: String(update?.image || ""),
    unit: String(update?.unit || ""),
  });

  const toCriticalHomePagesPayload = (pages) => ({
    home:
      pages?.home && typeof pages.home === "object"
        ? {
            shareImage: String(pages.home.shareImage || ""),
            shareImageAlt: String(pages.home.shareImageAlt || ""),
          }
        : { shareImage: "", shareImageAlt: "" },
  });

  const buildCriticalHomeBootstrapPayload = ({ settings, pages, projects, updates, generatedAt }) => {
    const heroSlides = buildPublicHeroSlides(projects, updates);
    const heroProjectIds = new Set(heroSlides.map((slide) => String(slide?.id || "").trim()));
    const criticalProjects = projects
      .filter((project) => heroProjectIds.has(String(project?.id || "").trim()))
      .map((project) => toCriticalHomeProjectPayload(project));
    const criticalUpdates = sortPublicLaunchUpdates(updates)
      .filter((update) => heroProjectIds.has(String(update?.projectId || "").trim()))
      .slice(0, Math.max(1, heroProjectIds.size))
      .map((update) => toCriticalHomeUpdatePayload(update));

    const payload = buildPublicBootstrapPayload({
      settings,
      pages: toCriticalHomePagesPayload(pages),
      projects: criticalProjects,
      posts: [],
      updates: criticalUpdates,
      tagTranslations: {
        tags: {},
        genres: {},
        staffRoles: {},
      },
      generatedAt,
      payloadMode: PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME,
    });
    payload.mediaVariants = buildPublicMediaVariants([
      payload.projects,
      payload.updates,
      payload.pages,
      { image: settings?.site?.defaultShareImage || "" },
    ]);
    return payload;
  };

  const buildPublicBootstrapResponsePayload = ({
    settings = loadSiteSettings(),
    pages = loadPages(),
    generatedAt = new Date().toISOString(),
    payloadMode = PUBLIC_BOOTSTRAP_MODE_FULL,
  } = {}) => {
    const projects = getPublicVisibleProjects();
    const posts = getPublicVisiblePosts().map((post) => {
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
        projectId: post.projectId || "",
        tags: Array.isArray(post.tags) ? post.tags : [],
      };
    });
    const updates = getPublicVisibleUpdates().slice(0, 10);
    const safePayloadMode =
      payloadMode === PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME
        ? PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME
        : PUBLIC_BOOTSTRAP_MODE_FULL;

    if (safePayloadMode === PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME) {
      return buildCriticalHomeBootstrapPayload({
        settings,
        pages,
        projects,
        updates,
        generatedAt,
      });
    }

    const teamMembers = buildPublicTeamMembers();
    const teamLinkTypes = loadLinkTypes();
    const payload = buildPublicBootstrapPayload({
      settings,
      pages,
      projects,
      posts,
      updates,
      teamMembers,
      teamLinkTypes,
      tagTranslations: loadTagTranslations(),
      generatedAt,
      payloadMode: PUBLIC_BOOTSTRAP_MODE_FULL,
    });
    payload.mediaVariants = buildPublicMediaVariants(
      [
        payload.projects,
        payload.posts,
        payload.updates,
        payload.teamMembers,
        payload.teamLinkTypes,
        payload.pages,
        { image: settings?.site?.defaultShareImage || "" },
      ],
      {
        allowPrivateUrls: payload.teamMembers.map((member) => member?.avatarUrl).filter(Boolean),
      },
    );
    return payload;
  };

  const resolveHomeHeroPreload = (publicBootstrap) => {
    const slides = buildPublicHeroSlides(publicBootstrap?.projects, publicBootstrap?.updates);
    const firstSlide = slides[0];
    return resolveHomeHeroPreloadFromSlide({
      imageUrl: firstSlide?.image || "",
      mediaVariants: publicBootstrap?.mediaVariants,
      resolveVariantUrl: resolveMetaImageVariantUrl,
    });
  };

  const findBootstrapProjectByRouteSlug = (projects, routeSlug) => {
    const rawRouteSlug = String(routeSlug || "").trim();
    if (!rawRouteSlug) {
      return null;
    }
    const normalizedRouteSlug = createSlug(rawRouteSlug);
    return (
      (Array.isArray(projects) ? projects : []).find((candidate) => {
        const candidateId = String(candidate?.id || "").trim();
        return (
          candidateId === rawRouteSlug ||
          createSlug(candidateId) === normalizedRouteSlug ||
          createSlug(candidate?.title || "") === normalizedRouteSlug
        );
      }) || null
    );
  };

  const resolveBootstrapReadingHeroImageUrl = ({ project, chapterNumber, volume }) => {
    if (!project || !Number.isFinite(chapterNumber)) {
      return "";
    }
    const episodes = Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : [];
    const matchingEpisode =
      episodes.find((episode) => {
        if (Number(episode?.number) !== chapterNumber) {
          return false;
        }
        if (!Number.isFinite(volume)) {
          return true;
        }
        return Number(episode?.volume) === volume;
      }) || null;
    const resolvedVolume = Number.isFinite(volume)
      ? volume
      : Number.isFinite(Number(matchingEpisode?.volume))
        ? Number(matchingEpisode.volume)
        : undefined;
    const volumeEntry =
      Number.isFinite(resolvedVolume) && Array.isArray(project?.volumeEntries)
        ? project.volumeEntries.find((entry) => Number(entry?.volume) === resolvedVolume) || null
        : null;
    const volumeCover =
      Number.isFinite(resolvedVolume) && Array.isArray(project?.volumeCovers)
        ? project.volumeCovers.find((entry) => Number(entry?.volume) === resolvedVolume) || null
        : null;

    return (
      String(matchingEpisode?.coverImageUrl || "").trim() ||
      String(volumeEntry?.coverImageUrl || "").trim() ||
      String(volumeCover?.coverImageUrl || "").trim() ||
      String(project?.cover || "").trim() ||
      String(project?.heroImageUrl || "").trim() ||
      String(project?.banner || "").trim()
    );
  };

  const escapeHtmlAttribute = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const buildHomeHeroShellMarkup = (publicBootstrap) => {
    const heroPreload = resolveHomeHeroPreload(publicBootstrap);
    const heroSrc = String(heroPreload?.href || "").trim();
    if (!heroSrc) {
      return "";
    }
    const heroSrcSet = String(heroPreload?.imagesrcset || "").trim();
    const heroSizes = String(heroPreload?.imagesizes || "100vw").trim() || "100vw";

    const attrs = [
      `src="${escapeHtmlAttribute(heroSrc)}"`,
      'alt=""',
      'aria-hidden="true"',
      'fetchpriority="high"',
      'decoding="async"',
      'style="position:absolute;inset:0;height:100%;width:100%;object-fit:cover;object-position:center;"',
    ];
    if (heroSrcSet) {
      attrs.push(`srcset="${escapeHtmlAttribute(heroSrcSet)}"`);
      attrs.push(`sizes="${escapeHtmlAttribute(heroSizes)}"`);
    }

    return [
      '<div id="home-hero-shell" aria-hidden="true" style="position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0;background:#05070a;">',
      `  <img ${attrs.join(" ")} />`,
      '  <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,7,10,0.95) 0%,rgba(5,7,10,0.72) 44%,rgba(5,7,10,0.18) 100%);"></div>',
      '  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,10,0.06) 0%,rgba(5,7,10,0.68) 100%);"></div>',
      "</div>",
    ].join("\n");
  };

  const injectPublicBootstrapHtml = ({
    html,
    req,
    settings,
    pages,
    includeHeroImagePreload = false,
    includeProjectsImagePreloads = false,
    bootstrapMode = PUBLIC_BOOTSTRAP_MODE_FULL,
    includeHomeHeroShell = false,
  }) => {
    const publicBootstrap = buildPublicBootstrapResponsePayload({
      settings,
      pages,
      payloadMode: bootstrapMode,
    });
    const publicMe = req?.session?.user ? buildUserPayload(req.session.user) : null;
    const pwaEnabled = resolveBootstrapPwaEnabledForRequest(req) === true;
    let nextHtml = injectBootstrapGlobals({
      html,
      publicBootstrap,
      settings,
      publicMe,
      pwaEnabled,
    });
    const preloads = extractLocalStylesheetHrefs(nextHtml).map((href) => ({
      href,
      as: "style",
      crossorigin: "anonymous",
    }));
    if (includeHeroImagePreload && !includeHomeHeroShell) {
      const heroPreload = resolveHomeHeroPreload(publicBootstrap);
      if (heroPreload) {
        preloads.push(heroPreload);
      }
    }
    if (includeProjectsImagePreloads) {
      preloads.push(
        ...resolvePublicProjectsListPreloads({
          projects: publicBootstrap?.projects,
          mediaVariants: publicBootstrap?.mediaVariants,
          resolveVariantUrl: resolveMetaImageVariantUrl,
        }),
      );
    }
    if (req?.path === "/equipe") {
      const teamAvatarPreload = resolvePublicTeamAvatarPreload({
        teamMembers: publicBootstrap?.teamMembers,
        mediaVariants: publicBootstrap?.mediaVariants,
        resolveVariantUrl: resolveMetaImageVariantUrl,
      });
      if (teamAvatarPreload) {
        preloads.push(teamAvatarPreload);
      }
    }
    if (req?.path?.startsWith("/postagem/")) {
      const routeSlug = String(req?.params?.slug || "").trim();
      const bootstrapPost =
        (Array.isArray(publicBootstrap?.posts) ? publicBootstrap.posts : []).find(
          (candidate) => String(candidate?.slug || "").trim() === routeSlug,
        ) || null;
      const postCoverPreload = resolvePublicPostCoverPreload({
        coverUrl: bootstrapPost?.coverImageUrl || "",
        mediaVariants: publicBootstrap?.mediaVariants,
        resolveVariantUrl: resolveMetaImageVariantUrl,
      });
      if (postCoverPreload) {
        preloads.push(postCoverPreload);
      }
    }
    if (/^\/projeto(?:s)?\/.+\/leitura\/.+/.test(String(req?.path || ""))) {
      const routeProjectId = String(req?.params?.id || "").trim();
      const chapterNumber = Number(req?.params?.chapter);
      const routeVolume = Number(req?.query?.volume);
      const bootstrapProject = findBootstrapProjectByRouteSlug(
        publicBootstrap?.projects,
        routeProjectId,
      );
      const readingHeroImageUrl = resolveBootstrapReadingHeroImageUrl({
        project: bootstrapProject,
        chapterNumber,
        volume: Number.isFinite(routeVolume) ? routeVolume : undefined,
      });
      const readerHeroPreload = resolvePublicReaderHeroPreload({
        imageUrl: readingHeroImageUrl,
        mediaVariants: publicBootstrap?.mediaVariants,
        resolveVariantUrl: resolveMetaImageVariantUrl,
      });
      if (readerHeroPreload) {
        preloads.push(readerHeroPreload);
      }
    }
    if (preloads.length > 0) {
      nextHtml = injectPreloadLinks({
        html: nextHtml,
        preloads,
      });
    }
    if (includeHomeHeroShell) {
      nextHtml = injectHomeHeroShell({
        html: nextHtml,
        shellMarkup: buildHomeHeroShellMarkup(publicBootstrap),
      });
    }
    return nextHtml;
  };

  const injectDashboardBootstrapHtml = ({ html, req, settings }) => {
    const publicMe = req?.session?.user ? buildUserPayload(req.session.user) : null;
    const pwaEnabled = resolveBootstrapPwaEnabledForRequest(req) === true;
    let nextHtml = injectBootstrapGlobals({
      html,
      publicBootstrap: null,
      settings,
      publicMe,
      pwaEnabled,
      skipPublicFetch: true,
    });
    const preloads = extractLocalStylesheetHrefs(nextHtml).map((href) => ({
      href,
      as: "style",
      crossorigin: "anonymous",
    }));
    if (preloads.length > 0) {
      nextHtml = injectPreloadLinks({
        html: nextHtml,
        preloads,
      });
    }
    return nextHtml;
  };

  return {
    buildLaunchesRssItems,
    buildPostsRssItems,
    buildPublicBootstrapResponsePayload,
    buildPublicSitemapEntries,
    injectDashboardBootstrapHtml,
    injectPublicBootstrapHtml,
    sendXmlResponse,
  };
};

export default createPublicSiteRuntime;
