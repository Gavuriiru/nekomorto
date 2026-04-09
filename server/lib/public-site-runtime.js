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

  const clampHomeHeroText = (value, limit = 100) => {
    const cleaned = String(value || "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length <= limit) {
      return cleaned;
    }
    const nextSpace = cleaned.indexOf(" ", limit);
    const upperBound = limit + 12;
    if (nextSpace > -1 && nextSpace <= upperBound) {
      return `${cleaned.slice(0, nextSpace)}...`;
    }
    const slice = cleaned.slice(0, limit);
    const lastSpace = slice.lastIndexOf(" ");
    const trimmed = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
    return `${trimmed}...`;
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
      [16, 32, 64, 128, 256, 512, 1024, 2048, 4096].find((candidate) => candidate >= size) ||
      4096
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

  const buildShellAvatarRenderUrl = (avatarUrl, requestedSize = 64, revision = "") =>
    appendAvatarRevision(resolveDiscordAvatarRenderUrl(avatarUrl, requestedSize), revision);

  const resolveShellNavbarBranding = (settings) => {
    const siteName = trimValue(settings?.site?.name) || "Nekomata";
    const branding = settings?.branding || {};
    const symbolAssetUrl = trimValue(branding?.assets?.symbolUrl) || trimValue(settings?.site?.logoUrl);
    const navbarSymbolOverride = trimValue(branding?.overrides?.navbarSymbolUrl);
    const navbarWordmarkOverride = trimValue(branding?.overrides?.navbarWordmarkUrl);
    const wordmarkAssetUrl =
      trimValue(branding?.assets?.wordmarkUrl) ||
      trimValue(branding?.wordmarkUrlNavbar) ||
      trimValue(branding?.wordmarkUrl) ||
      trimValue(branding?.wordmarkUrlFooter);
    const legacyPlacement = trimValue(branding?.wordmarkPlacement) || "both";
    const defaultMode =
      branding?.wordmarkEnabled === true &&
      (legacyPlacement === "navbar" || legacyPlacement === "both")
        ? "wordmark"
        : "symbol-text";
    const allowedModes = new Set(["wordmark", "symbol-text", "symbol", "text"]);
    const mode = allowedModes.has(trimValue(branding?.display?.navbar))
      ? trimValue(branding?.display?.navbar)
      : defaultMode;
    return {
      siteName,
      siteLabel: siteName.toUpperCase(),
      mode,
      symbolUrl: navbarSymbolOverride || symbolAssetUrl,
      wordmarkUrl: navbarWordmarkOverride || wordmarkAssetUrl || symbolAssetUrl,
      showWordmark: mode === "wordmark" && Boolean(navbarWordmarkOverride || wordmarkAssetUrl),
      showSymbol: mode === "symbol-text" || mode === "symbol",
      showText:
        mode === "symbol-text" ||
        mode === "text" ||
        (mode === "wordmark" && !Boolean(navbarWordmarkOverride || wordmarkAssetUrl)),
    };
  };

  const resolveShellNavbarLinks = (settings) =>
    (Array.isArray(settings?.navbar?.links) ? settings.navbar.links : [])
      .map((link) => ({
        label: trimValue(link?.label),
        href: trimValue(link?.href),
      }))
      .filter((link) => link.label)
      .slice(0, 6);

  const buildHomeHeroShellCriticalCss = () => `
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter/InterLatin.woff2") format("woff2");
  font-weight: 300 900;
  font-style: normal;
  font-display: swap;
}
:root {
  --public-home-shell-bg: hsl(220 12% 7%);
  --public-home-shell-fg: hsl(0 0% 100%);
  --public-home-shell-muted: hsl(220 10% 82%);
  --public-home-shell-border: hsl(220 8% 28% / 0.52);
  --public-home-shell-veil-primary: linear-gradient(90deg, hsl(220 12% 7% / 0.94) 0%, hsl(220 12% 7% / 0.78) 48%, hsl(220 12% 7% / 0.1) 100%);
  --public-home-shell-veil-secondary: linear-gradient(0deg, hsl(220 12% 7% / 0.98) 0%, hsl(220 12% 7% / 0.36) 54%, transparent 100%);
  --public-home-shell-navbar-bg: linear-gradient(180deg, hsl(220 12% 7% / 0.92) 0%, hsl(220 12% 7% / 0.58) 56%, transparent 100%);
  --public-home-shell-accent: hsl(263 66% 60%);
  --public-home-shell-accent-fg: hsl(0 0% 100%);
  --public-home-shell-badge-bg: hsl(263 66% 60% / 0.2);
  --public-home-shell-badge-fg: hsl(263 86% 74%);
  --public-home-shell-badge-border: hsl(263 66% 60% / 0.28);
  --public-home-shell-glass-bg: hsl(220 10% 11% / 0.46);
}
:root[data-theme-mode="light"] {
  --public-home-shell-bg: hsl(210 33% 98%);
  --public-home-shell-fg: hsl(224 41% 12%);
  --public-home-shell-muted: hsl(220 20% 34%);
  --public-home-shell-border: hsl(216 24% 76% / 0.7);
  --public-home-shell-veil-primary: radial-gradient(84% 110% at 18% 28%, hsl(210 33% 98% / 0.96) 0%, hsl(210 33% 98% / 0.84) 42%, hsl(210 33% 98% / 0.16) 100%), linear-gradient(90deg, hsl(210 33% 98% / 0.92) 0%, hsl(210 33% 98% / 0.72) 40%, hsl(210 33% 98% / 0.08) 100%);
  --public-home-shell-veil-secondary: linear-gradient(0deg, hsl(210 33% 98% / 0.94) 0%, hsl(210 33% 98% / 0.36) 52%, transparent 100%);
  --public-home-shell-navbar-bg: linear-gradient(180deg, hsl(210 33% 98% / 0.96) 0%, hsl(210 33% 98% / 0.74) 56%, transparent 100%);
  --public-home-shell-accent: hsl(223 87% 54%);
  --public-home-shell-accent-fg: hsl(0 0% 100%);
  --public-home-shell-badge-bg: hsl(223 87% 54% / 0.14);
  --public-home-shell-badge-fg: hsl(223 87% 54%);
  --public-home-shell-badge-border: hsl(223 87% 54% / 0.24);
  --public-home-shell-glass-bg: hsl(0 0% 100% / 0.52);
}
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
  background: var(--public-home-shell-bg);
  color: var(--public-home-shell-fg);
  font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.public-home-hero-shell--exiting {
  opacity: 0;
}
.public-home-hero-shell__image,
.public-home-hero-shell__veil {
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
.public-home-hero-shell__veil--primary {
  background: var(--public-home-shell-veil-primary);
}
.public-home-hero-shell__veil--secondary {
  background: var(--public-home-shell-veil-secondary);
}
.public-home-hero-shell__navbar-overlay {
  position: absolute;
  inset: 0 0 auto;
  height: 8rem;
  background: var(--public-home-shell-navbar-bg);
}
.public-home-hero-shell__header,
.public-home-hero-shell__content-wrap,
.public-home-hero-shell__controls {
  position: relative;
  z-index: 2;
}
.public-home-hero-shell__header {
  padding: 1.25rem 1.5rem 0;
}
.public-home-hero-shell__header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.public-home-hero-shell__brand,
.public-home-hero-shell__nav,
.public-home-hero-shell__actions,
.public-home-hero-shell__user-pill,
.public-home-hero-shell__icon-button,
.public-home-hero-shell__control {
  display: flex;
  align-items: center;
}
.public-home-hero-shell__brand {
  min-width: 0;
  gap: 0.875rem;
  font-size: 2rem;
  font-weight: 900;
  letter-spacing: 0.06em;
}
.public-home-hero-shell__wordmark {
  display: block;
  height: 2rem;
  width: auto;
  max-width: min(15rem, 42vw);
  object-fit: contain;
}
.public-home-hero-shell__symbol {
  display: inline-flex;
  height: 2.4rem;
  width: 2.4rem;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 9999px;
  border: 1px solid var(--public-home-shell-border);
  background: var(--public-home-shell-glass-bg);
  object-fit: cover;
  font-size: 0.95rem;
  font-weight: 700;
}
.public-home-hero-shell__brand-text {
  white-space: nowrap;
  color: var(--public-home-shell-fg);
}
.public-home-hero-shell__nav {
  display: none;
  gap: 1.5rem;
  color: color-mix(in srgb, var(--public-home-shell-fg) 78%, transparent);
  font-size: 0.95rem;
  font-weight: 600;
}
.public-home-hero-shell__nav-link--active {
  color: var(--public-home-shell-fg);
}
.public-home-hero-shell__actions {
  gap: 0.75rem;
  justify-content: flex-end;
  min-width: 11rem;
}
.public-home-hero-shell__icon-button,
.public-home-hero-shell__control {
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid var(--public-home-shell-border);
  background: var(--public-home-shell-glass-bg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.public-home-hero-shell__icon-button {
  height: 2.5rem;
  width: 2.5rem;
}
.public-home-hero-shell__icon-button::before {
  content: "";
  display: block;
  height: 0.95rem;
  width: 0.95rem;
  border-radius: 9999px;
  border: 1px solid color-mix(in srgb, var(--public-home-shell-fg) 44%, transparent);
}
.public-home-hero-shell__user-pill {
  min-width: 8.5rem;
  gap: 0.65rem;
  padding: 0.28rem 0.68rem 0.28rem 0.28rem;
  border-radius: 9999px;
  border: 1px solid var(--public-home-shell-border);
  background: var(--public-home-shell-glass-bg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.public-home-hero-shell__avatar {
  display: inline-flex;
  height: 2rem;
  width: 2rem;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--public-home-shell-fg) 14%, transparent);
  object-fit: cover;
  font-size: 0.75rem;
  font-weight: 700;
}
.public-home-hero-shell__avatar-label {
  max-width: 7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--public-home-shell-fg);
  font-size: 0.92rem;
  font-weight: 600;
}
.public-home-hero-shell__content-wrap {
  display: flex;
  height: calc(100% - 5.5rem);
  align-items: flex-end;
  padding: 0 1.5rem 3.75rem;
}
.public-home-hero-shell__content {
  max-width: 42rem;
}
.public-home-hero-shell__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.95rem;
  color: var(--public-home-shell-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.public-home-hero-shell__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.42rem 0.78rem;
  border-radius: 9999px;
  border: 1px solid var(--public-home-shell-badge-border);
  background: var(--public-home-shell-badge-bg);
  color: var(--public-home-shell-badge-fg);
  letter-spacing: 0.18em;
}
.public-home-hero-shell__separator {
  color: color-mix(in srgb, var(--public-home-shell-muted) 74%, transparent);
}
.public-home-hero-shell__title {
  margin: 0 0 1.4rem;
  color: var(--public-home-shell-fg);
  font-size: clamp(2.4rem, 7vw, 5.5rem);
  font-weight: 900;
  line-height: 0.96;
  letter-spacing: -0.04em;
  text-wrap: balance;
}
.public-home-hero-shell__description {
  max-width: 39rem;
  margin: 0;
  color: var(--public-home-shell-muted);
  font-size: clamp(1.05rem, 2vw, 1.45rem);
  line-height: 1.62;
}
.public-home-hero-shell__cta-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 2rem;
}
.public-home-hero-shell__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.92rem 1.35rem;
  border-radius: 0.85rem;
  background: var(--public-home-shell-accent);
  color: var(--public-home-shell-accent-fg);
  font-size: 0.98rem;
  font-weight: 700;
  box-shadow: 0 24px 56px -30px color-mix(in srgb, var(--public-home-shell-accent) 72%, transparent);
}
.public-home-hero-shell__controls {
  position: absolute;
  right: 2rem;
  bottom: 2rem;
  display: none;
  gap: 0.75rem;
}
.public-home-hero-shell__control {
  height: 2.5rem;
  width: 2.5rem;
  color: color-mix(in srgb, var(--public-home-shell-fg) 70%, transparent);
  font-size: 1.05rem;
}
.public-home-hero-shell__control::before {
  content: "\\2039";
}
.public-home-hero-shell__control--next::before {
  content: "\\203A";
}
@media (min-width: 768px) {
  .public-home-hero-shell__header {
    padding: 1.4rem 3rem 0;
  }
  .public-home-hero-shell__content-wrap {
    padding: 0 3rem 5.5rem;
  }
  .public-home-hero-shell__navbar-overlay {
    height: 9rem;
  }
  .public-home-hero-shell__controls {
    display: flex;
  }
}
@media (min-width: 1024px) {
  .public-home-hero-shell__nav {
    display: flex;
  }
}
@media (max-width: 767px) {
  .public-home-hero-shell__actions {
    min-width: 0;
  }
  .public-home-hero-shell__icon-button:nth-child(2) {
    display: none;
  }
  .public-home-hero-shell__avatar-label {
    display: none;
  }
  .public-home-hero-shell__title {
    font-size: clamp(2.8rem, 13vw, 4rem);
    line-height: 0.98;
  }
  .public-home-hero-shell__description {
    max-width: 31rem;
    font-size: 1rem;
  }
}
`;

  const buildHomeHeroShellMarkup = (publicBootstrap, publicMe = null) => {
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
    const settings = publicBootstrap?.settings || {};
    const branding = resolveShellNavbarBranding(settings);
    const navbarLinks = resolveShellNavbarLinks(settings);
    const isLatestSlide = String(homeHero?.latestSlideId || "") === String(firstSlide.id || "");
    const description = clampHomeHeroText(firstSlide.description || "", 118);
    const resolvedUserName =
      trimValue(publicMe?.name) || trimValue(publicMe?.username) || "Visitante";
    const resolvedUserAvatar = buildShellAvatarRenderUrl(publicMe?.avatarUrl, 64, publicMe?.revision);
    const userInitials = resolvedUserName.slice(0, 2).toUpperCase() || "NK";

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

    const brandMarkup = branding.showWordmark && branding.wordmarkUrl
      ? `<img class="public-home-hero-shell__wordmark" src="${escapeHtmlAttribute(branding.wordmarkUrl)}" alt="${escapeHtmlAttribute(branding.siteLabel)}" />`
      : [
          branding.showSymbol
            ? branding.symbolUrl
              ? `<img class="public-home-hero-shell__symbol" src="${escapeHtmlAttribute(branding.symbolUrl)}" alt="" />`
              : `<span class="public-home-hero-shell__symbol">${escapeHtmlText(branding.siteLabel.slice(0, 1))}</span>`
            : "",
          branding.showText
            ? `<span class="public-home-hero-shell__brand-text">${escapeHtmlText(branding.siteLabel)}</span>`
            : "",
        ].join("");

    const navbarMarkup = navbarLinks
      .map((item) => {
        const isActive = trimValue(item.href) === "/";
        return `<span class="public-home-hero-shell__nav-link${isActive ? " public-home-hero-shell__nav-link--active" : ""}">${escapeHtmlText(item.label)}</span>`;
      })
      .join("");

    const userAvatarMarkup = resolvedUserAvatar
      ? `<img class="public-home-hero-shell__avatar" src="${escapeHtmlAttribute(resolvedUserAvatar)}" alt="" />`
      : `<span class="public-home-hero-shell__avatar">${escapeHtmlText(userInitials)}</span>`;

    const heroMeta = [
      isLatestSlide ? '<span class="public-home-hero-shell__badge">Último Lançamento</span>' : "",
      firstSlide.format ? `<span>${escapeHtmlText(firstSlide.format)}</span>` : "",
      firstSlide.format && firstSlide.status
        ? '<span class="public-home-hero-shell__separator">•</span>'
        : "",
      firstSlide.status ? `<span>${escapeHtmlText(firstSlide.status)}</span>` : "",
    ]
      .filter(Boolean)
      .join("");

    const shellMarkup = [
      '<div id="home-hero-shell" class="public-home-hero-shell public-home-hero-viewport" aria-hidden="true">',
      `  <img class="public-home-hero-shell__image" ${attrs.join(" ")} />`,
      '  <div class="public-home-hero-shell__veil public-home-hero-shell__veil--primary"></div>',
      '  <div class="public-home-hero-shell__veil public-home-hero-shell__veil--secondary"></div>',
      '  <div class="public-home-hero-shell__navbar-overlay"></div>',
      '  <header class="public-home-hero-shell__header">',
      '    <div class="public-home-hero-shell__header-inner">',
      `      <div class="public-home-hero-shell__brand">${brandMarkup}</div>`,
      `      <nav class="public-home-hero-shell__nav">${navbarMarkup}</nav>`,
      '      <div class="public-home-hero-shell__actions">',
      '        <span class="public-home-hero-shell__icon-button"></span>',
      '        <span class="public-home-hero-shell__icon-button"></span>',
      `        <span class="public-home-hero-shell__user-pill">${userAvatarMarkup}<span class="public-home-hero-shell__avatar-label">${escapeHtmlText(resolvedUserName)}</span></span>`,
      "      </div>",
      "    </div>",
      "  </header>",
      '  <div class="public-home-hero-shell__content-wrap">',
      '    <div class="public-home-hero-shell__content">',
      `      <div class="public-home-hero-shell__meta">${heroMeta}</div>`,
      `      <h1 class="public-home-hero-shell__title">${escapeHtmlText(firstSlide.title || "")}</h1>`,
      `      <p class="public-home-hero-shell__description">${escapeHtmlText(description)}</p>`,
      '      <div class="public-home-hero-shell__cta-row">',
      '        <span class="public-home-hero-shell__cta">Acessar Página</span>',
      "      </div>",
      "    </div>",
      "  </div>",
      homeHero?.hasMultipleSlides
        ? '  <div class="public-home-hero-shell__controls"><span class="public-home-hero-shell__control"></span><span class="public-home-hero-shell__control public-home-hero-shell__control--next"></span></div>'
        : "",
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
      const shellSnapshot = buildHomeHeroShellMarkup(publicBootstrap, publicMe);
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
