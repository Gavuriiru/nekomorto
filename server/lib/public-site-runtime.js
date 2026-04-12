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
  "getPublicInProgressItems",
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
};

export const createPublicSiteRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    buildPublicBootstrapPayload,
    buildPublicMediaVariants,
    buildPublicTeamMembers,
    buildUserPayload,
    createGuid,
    createSlug,
    extractLocalStylesheetHrefs,
    getPublicInProgressItems,
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
    resolvePublicPostCoverPreload,
    resolvePublicProjectsListPreloads,
    resolvePublicReaderHeroPreload,
    resolvePublicTeamAvatarPreload,
    sitemapStaticPublicPaths,
    stripHtml,
  } = dependencies;

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
        title: String(project?.title || "").trim(),
        description: String(project?.synopsis || project?.description || ""),
        image,
        projectId,
        trailerUrl: String(project?.trailerUrl || "").trim(),
        format: String(project?.type || "").trim(),
        status: String(project?.status || "").trim(),
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

  const buildPublicHomeHeroPayload = (projects, updates) => {
    const slides = buildPublicHeroSlides(projects, updates);
    if (slides.length === 0) {
      return null;
    }
    const latestSlide = slides.reduce((latest, current) => {
      if (!latest) {
        return current;
      }
      return new Date(current.updatedAt || 0).getTime() > new Date(latest.updatedAt || 0).getTime()
        ? current
        : latest;
    }, slides[0]);
    return {
      initialSlideId: String(slides[0]?.id || "").trim(),
      latestSlideId: String(latestSlide?.id || slides[0]?.id || "").trim(),
      hasMultipleSlides: slides.length > 1,
      slides: slides.map((slide) => ({
        id: String(slide?.id || "").trim(),
        title: String(slide?.title || "").trim(),
        description: String(slide?.description || ""),
        updatedAt: String(slide?.updatedAt || ""),
        image: String(slide?.image || "").trim(),
        projectId: String(slide?.projectId || slide?.id || "").trim(),
        trailerUrl: String(slide?.trailerUrl || "").trim(),
        format: String(slide?.format || "").trim(),
        status: String(slide?.status || "").trim(),
      })),
    };
  };

  const resolveBootstrapHomeHero = (publicBootstrap) => {
    const candidate = publicBootstrap?.homeHero;
    if (candidate && Array.isArray(candidate.slides) && candidate.slides.length > 0) {
      return candidate;
    }
    return buildPublicHomeHeroPayload(publicBootstrap?.projects, publicBootstrap?.updates);
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

  const buildCriticalHomeBootstrapPayload = ({
    settings,
    pages,
    projects,
    inProgressItems,
    updates,
    generatedAt,
  }) => {
    const heroSlides = buildPublicHeroSlides(projects, updates);
    const homeHero = buildPublicHomeHeroPayload(projects, updates);
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
      inProgressItems,
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
    payload.homeHero = homeHero;
    return payload;
  };

  const buildPublicBootstrapResponsePayload = ({
    settings = loadSiteSettings(),
    pages = loadPages(),
    generatedAt = new Date().toISOString(),
    payloadMode = PUBLIC_BOOTSTRAP_MODE_FULL,
  } = {}) => {
    const projects = getPublicVisibleProjects();
    const inProgressItems = getPublicInProgressItems();
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
        inProgressItems,
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
      inProgressItems,
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
    payload.homeHero = buildPublicHomeHeroPayload(payload.projects, payload.updates);
    return payload;
  };

  const resolveHomeHeroPreload = (publicBootstrap) => {
    const homeHero = resolveBootstrapHomeHero(publicBootstrap);
    const firstSlide = homeHero?.slides?.[0];
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

  const escapeHtmlText = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const trimValue = (value) => String(value || "").trim();

  const resolveDiscordAvatarSize = (requestedSize) => {
    const size = Math.max(16, Math.floor(Number(requestedSize) || 0));
    return (
      [16, 32, 64, 128, 256, 512, 1024, 2048, 4096].find((candidate) => candidate >= size) || 4096
    );
  };

  const parseDiscordAvatarUrl = (url) => {
    const safeUrl = trimValue(url);
    if (!safeUrl) {
      return null;
    }
    try {
      const parsed = new URL(safeUrl, "http://localhost");
      if (!/^https?:$/i.test(parsed.protocol) || parsed.hostname !== "cdn.discordapp.com") {
        return null;
      }
      const match = parsed.pathname.match(
        /^\/avatars\/(?<userId>\d+)\/(?<avatarFile>[A-Za-z0-9_]+\.(?:png|jpe?g|webp|gif))$/i,
      );
      if (!match?.groups?.userId || !match.groups.avatarFile) {
        return null;
      }
      return {
        userId: match.groups.userId,
        avatarFile: match.groups.avatarFile,
      };
    } catch {
      return null;
    }
  };

  const resolveDiscordAvatarRenderUrl = (url, requestedSize) => {
    const safeUrl = trimValue(url);
    if (!safeUrl) {
      return "";
    }
    const parsed = parseDiscordAvatarUrl(safeUrl);
    if (!parsed) {
      return safeUrl;
    }
    const params = new URLSearchParams({
      size: String(resolveDiscordAvatarSize(requestedSize)),
    });
    return `/api/public/discord-avatar/${encodeURIComponent(parsed.userId)}/${encodeURIComponent(parsed.avatarFile)}?${params.toString()}`;
  };

  const appendAvatarRevision = (avatarUrl, revision) => {
    const resolvedAvatarUrl = trimValue(avatarUrl);
    const resolvedRevision = trimValue(revision);
    if (!resolvedAvatarUrl || !resolvedRevision) {
      return resolvedAvatarUrl;
    }
    try {
      const isRelativeUrl = resolvedAvatarUrl.startsWith("/");
      const parsed = isRelativeUrl
        ? new URL(resolvedAvatarUrl, "http://localhost")
        : new URL(resolvedAvatarUrl);
      parsed.searchParams.set("v", resolvedRevision);
      if (isRelativeUrl) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return parsed.toString();
    } catch {
      return resolvedAvatarUrl;
    }
  };

  const buildHomeHeroShellCriticalCss = () => `
@supports (height: 1svh) {
  :root {
    --public-home-hero-height: 78svh;
  }
}
@supports not (height: 1svh) {
  :root {
    --public-home-hero-height: 78vh;
  }
}
@media (min-width: 768px) {
  @supports (height: 1svh) {
    :root {
      --public-home-hero-height: 100svh;
    }
  }
  @supports not (height: 1svh) {
    :root {
      --public-home-hero-height: 100vh;
    }
  }
}
.public-home-hero-shell.public-home-hero-viewport {
  min-height: var(--public-home-hero-height);
}
.public-home-hero-shell {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  height: var(--public-home-hero-height);
  min-height: var(--public-home-hero-height);
  overflow: hidden;
  pointer-events: none;
  z-index: 70;
  opacity: 1;
  transition: opacity 180ms ease-out;
  will-change: opacity;
  background: hsl(220 12% 7%);
}
.public-home-hero-shell--exiting {
  opacity: 0;
}
.public-home-hero-shell__image {
  position: absolute;
  inset: 0;
}
.public-home-hero-shell__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
`;

  const buildHomeHeroShellMarkup = (publicBootstrap) => {
    const homeHero = resolveBootstrapHomeHero(publicBootstrap);
    const firstSlide = homeHero?.slides?.[0] || null;
    if (!firstSlide) {
      return {
        markup: "",
        criticalCss: "",
      };
    }
    const heroPreload = resolveHomeHeroPreload(publicBootstrap);
    const heroSrc = String(heroPreload?.href || "").trim();
    if (!heroSrc) {
      return {
        markup: "",
        criticalCss: "",
      };
    }
    const heroSrcSet = String(heroPreload?.imagesrcset || "").trim();
    const heroSizes = String(heroPreload?.imagesizes || "100vw").trim() || "100vw";

    const attrs = [
      `src="${escapeHtmlAttribute(heroSrc)}"`,
      'alt=""',
      'aria-hidden="true"',
      'fetchpriority="high"',
      'decoding="async"',
    ];
    if (heroSrcSet) {
      attrs.push(`srcset="${escapeHtmlAttribute(heroSrcSet)}"`);
      attrs.push(`sizes="${escapeHtmlAttribute(heroSizes)}"`);
    }

    const shellMarkup = [
      '<div id="home-hero-shell" class="public-home-hero-shell public-home-hero-viewport" aria-hidden="true">',
      `  <img class="public-home-hero-shell__image" ${attrs.join(" ")} />`,
      "</div>",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      markup: shellMarkup,
      criticalCss: buildHomeHeroShellCriticalCss(),
    };
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
    let nextHtml = injectBootstrapGlobals({
      html,
      publicBootstrap,
      settings,
      publicMe,
      pwaEnabled: false,
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
    if (includeHomeHeroShell && req?.path === "/") {
      const shellSnapshot = buildHomeHeroShellMarkup(publicBootstrap);
      nextHtml = injectHomeHeroShell({
        html: nextHtml,
        shellMarkup: shellSnapshot.markup,
        criticalCss: shellSnapshot.criticalCss,
      });
    }
    return nextHtml;
  };

  const injectDashboardBootstrapHtml = ({ html, req, settings }) => {
    const publicMe = req?.session?.user ? buildUserPayload(req.session.user) : null;
    let nextHtml = injectBootstrapGlobals({
      html,
      publicBootstrap: null,
      settings,
      publicMe,
      pwaEnabled: false,
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
