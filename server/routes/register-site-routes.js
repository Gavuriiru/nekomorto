export const registerSiteRoutes = ({
  app,
  PRIMARY_APP_ORIGIN,
  loadSiteSettings,
  loadTagTranslations,
  loadPages,
  resolvePublicRedirect,
  buildPostMeta,
  buildSiteMetaWithSettings,
  buildProjectReadingMeta,
  buildProjectMeta,
  buildSchemaOrgPayload,
  resolveThemeColor,
  injectPublicBootstrapHtml,
  renderMetaHtml,
  sendHtml,
  getIndexHtml,
  normalizePosts,
  loadPosts,
  normalizeProjects,
  loadProjects,
  PUBLIC_BOOTSTRAP_MODE_FULL,
  PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME,
  isHomeHeroShellEnabled,
} = {}) => {
  app.use((req, res, next) => {
    const method = String(req.method || "").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return next();
    }
    let search = "";
    try {
      const parsedUrl = new URL(req.originalUrl || req.url || req.path || "/", PRIMARY_APP_ORIGIN);
      search = parsedUrl.search || "";
    } catch {
      search = "";
    }
    if (req.path.startsWith("/projetos/")) {
      return res.redirect(301, `${req.path.replace(/^\/projetos\//, "/projeto/")}${search}`);
    }
    const settings = loadSiteSettings();
    const redirect = resolvePublicRedirect({
      redirects: settings?.seo?.redirects,
      pathname: req.path,
      search,
    });
    if (!redirect?.location) {
      return next();
    }
    return res.redirect(301, redirect.location);
  });

  app.get(
    [
      "/",
      "/projeto/:id",
      "/projeto/:id/leitura/:chapter",
      "/projetos/:id",
      "/projetos/:id/leitura/:chapter",
      "/postagem/:slug",
    ],
    async (req, res) => {
      try {
        const settings = loadSiteSettings();
        const translations = loadTagTranslations();
        const pages = loadPages();
        const isReadingRoute = /^\/projeto(?:s)?\/.+\/leitura\/.+/.test(String(req.path || ""));
        const canonicalPath = req.path.replace(/^\/projetos\//, "/projeto/");
        const canonicalUrl = `${PRIMARY_APP_ORIGIN}${canonicalPath}`;
        const themeColor = resolveThemeColor(settings?.theme?.accent);
        if (req.path.startsWith("/postagem/")) {
          const slug = String(req.params.slug || "");
          const post = normalizePosts(loadPosts()).find((item) => item.slug === slug);
          const meta = post ? buildPostMeta(post) : buildSiteMetaWithSettings(settings);
          const shouldNoIndexPost = !post;
          const structuredData = shouldNoIndexPost
            ? []
            : buildSchemaOrgPayload({
                origin: PRIMARY_APP_ORIGIN,
                pathname: req.path,
                canonicalUrl,
                settings,
                pages,
                post,
              });
          const html = injectPublicBootstrapHtml({
            html: renderMetaHtml({
              ...meta,
              url: canonicalUrl,
              robots: shouldNoIndexPost ? "noindex, nofollow" : meta.robots,
              structuredData,
              themeColor,
            }),
            req,
            settings,
            pages,
            bootstrapMode: PUBLIC_BOOTSTRAP_MODE_FULL,
          });
          return await sendHtml(req, res, html);
        }
        if (req.path.startsWith("/projeto/") || req.path.startsWith("/projetos/")) {
          const id = String(req.params.id || "");
          const project = normalizeProjects(loadProjects()).find((item) => String(item.id) === id);
          const shouldNoIndexProject = !project || isReadingRoute;
          const chapterNumber = Number(req.params.chapter);
          const routeVolume = Number(req.query?.volume);
          const meta = project
            ? isReadingRoute
              ? buildProjectReadingMeta(project, {
                  chapterNumber,
                  volume: Number.isFinite(routeVolume) ? routeVolume : undefined,
                  settings,
                  translations,
                }) ||
                buildProjectMeta(project, {
                  settings,
                  translations,
                })
              : buildProjectMeta(project, {
                  settings,
                  translations,
                })
            : buildSiteMetaWithSettings(settings);
          const structuredData = shouldNoIndexProject
            ? []
            : buildSchemaOrgPayload({
                origin: PRIMARY_APP_ORIGIN,
                pathname: canonicalPath,
                canonicalUrl,
                settings,
                pages,
                project: project || null,
              });
          const html = injectPublicBootstrapHtml({
            html: renderMetaHtml({
              ...meta,
              url: canonicalUrl,
              robots: shouldNoIndexProject ? "noindex, nofollow" : meta.robots,
              structuredData,
              themeColor,
            }),
            req,
            settings,
            pages,
            bootstrapMode: PUBLIC_BOOTSTRAP_MODE_FULL,
          });
          return await sendHtml(req, res, html);
        }
        const meta = buildSiteMetaWithSettings(settings);
        const structuredData = buildSchemaOrgPayload({
          origin: PRIMARY_APP_ORIGIN,
          pathname: req.path,
          canonicalUrl,
          settings,
          pages,
        });
        const html = injectPublicBootstrapHtml({
          html: renderMetaHtml({
            ...meta,
            url: canonicalUrl,
            structuredData,
            themeColor,
          }),
          req,
          settings,
          pages,
          includeHeroImagePreload: req.path === "/",
          bootstrapMode:
            req.path === "/" ? PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME : PUBLIC_BOOTSTRAP_MODE_FULL,
          includeHomeHeroShell: req.path === "/" && isHomeHeroShellEnabled,
        });
        return await sendHtml(req, res, html);
      } catch {
        return await sendHtml(req, res, getIndexHtml());
      }
    },
  );
};
