import { isReservedPublicPath } from "../../shared/public-paths.js";

export const registerAppRoutes = ({
  app,
  PRIMARY_APP_ORIGIN,
  loadSiteSettings,
  loadPages,
  resolveInstitutionalOgPageKeyFromPath,
  buildInstitutionalPageMeta,
  buildSiteMetaWithSettings,
  resolveThemeColor,
  getPageTitleFromPath,
  buildSchemaOrgPayload,
  renderMetaHtml,
  injectPublicBootstrapHtml,
  injectDashboardBootstrapHtml,
  sendHtml,
  getIndexHtml,
  PUBLIC_BOOTSTRAP_MODE_FULL,
  PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME,
  isHomeHeroShellEnabled,
} = {}) => {
  app.get("/{*path}", async (req, res) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/auth")) {
      return res.status(404).json({ error: "not_found" });
    }
    if (isReservedPublicPath(req.path)) {
      return res.status(404).end();
    }
    try {
      const settings = loadSiteSettings();
      const pages = loadPages();
      const institutionalPageKey = resolveInstitutionalOgPageKeyFromPath(req.path);
      const meta = institutionalPageKey
        ? buildInstitutionalPageMeta(institutionalPageKey, {
            settings,
            pages,
          })
        : buildSiteMetaWithSettings(settings);
      const themeColor = resolveThemeColor(settings?.theme?.accent);
      const siteName = settings.site?.name || "Nekomata";
      const separator = settings.site?.titleSeparator ?? "";
      const pageTitle = getPageTitleFromPath(req.path);
      const title = institutionalPageKey
        ? meta.title
        : pageTitle
          ? `${pageTitle}${separator}${siteName}`
          : siteName;
      const canonicalUrl = `${PRIMARY_APP_ORIGIN}${req.path}`;
      const structuredData = buildSchemaOrgPayload({
        origin: PRIMARY_APP_ORIGIN,
        pathname: req.path,
        canonicalUrl,
        settings,
        pages,
      });
      const shouldInjectPublicBootstrap = !/^\/dashboard(?:\/|$)/.test(req.path);
      const renderedHtml = renderMetaHtml({
        ...meta,
        title,
        url: canonicalUrl,
        structuredData,
        themeColor,
      });
      const html = shouldInjectPublicBootstrap
        ? injectPublicBootstrapHtml({
            html: renderedHtml,
            req,
            settings,
            pages,
            includeHeroImagePreload: req.path === "/",
            includeProjectsImagePreloads: req.path === "/projetos",
            bootstrapMode:
              req.path === "/" ? PUBLIC_BOOTSTRAP_MODE_CRITICAL_HOME : PUBLIC_BOOTSTRAP_MODE_FULL,
            includeHomeHeroShell: req.path === "/" && isHomeHeroShellEnabled,
          })
        : injectDashboardBootstrapHtml({
            html: renderedHtml,
            req,
            settings,
          });
      return await sendHtml(req, res, html);
    } catch {
      return await sendHtml(req, res, getIndexHtml());
    }
  });
};
