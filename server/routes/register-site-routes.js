export const registerSiteRoutes = ({
  app,
  PRIMARY_APP_ORIGIN,
  loadSiteSettings,
  resolvePublicRedirect,
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
};
