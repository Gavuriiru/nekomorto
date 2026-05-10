import { isReservedPublicPath } from "../../shared/public-paths.js";
import { resolvePublicPathIndexability } from "../lib/public-indexability.js";

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
      const pages = resolvePublicPathIndexability({
        pathname: req.path,
        pages: loadPages(),
      }).pages;
      const institutionalPageKey = resolveInstitutionalOgPageKeyFromPath(req.path);
      const meta = institutionalPageKey
        ? buildInstitutionalPageMeta(institutionalPageKey, {
            settings,
            pages,
          })
        : buildSiteMetaWithSettings(settings);
      const themeColor = resolveThemeColor(settings?.theme?.accent);
      const siteName = settings.site?.name || "Nekomata";
      const separator = settings.site?.titleSeparator || " | ";
      const pageTitle = getPageTitleFromPath(req.path);
      const title = institutionalPageKey
        ? meta.title
        : pageTitle
          ? `${pageTitle}${separator}${siteName}`
          : siteName;
      const canonicalUrl = `${PRIMARY_APP_ORIGIN}${req.path}`;
      const isDashboardPath = /^\/dashboard(?:\/|$)/.test(req.path);
      const isLoginPath = req.path === "/login" || req.path.startsWith("/login/");
      const indexability = resolvePublicPathIndexability({
        pathname: req.path,
        pages,
        isDashboardPath,
        isLoginPath,
      });
      const structuredData = !indexability.shouldIndex
        ? []
        : buildSchemaOrgPayload({
            origin: PRIMARY_APP_ORIGIN,
            pathname: req.path,
            canonicalUrl,
            settings,
            pages,
          });
      const shouldInjectPublicBootstrap = !isDashboardPath;
      const renderedHtml = renderMetaHtml({
        ...meta,
        title,
        url: canonicalUrl,
        robots: indexability.robots,
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
