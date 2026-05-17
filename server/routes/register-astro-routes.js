export const ASTRO_PUBLIC_ROUTE_PATHS = Object.freeze([
  "/termos-de-uso",
  "/politica-de-privacidade",
]);

const normalizePathname = (value) => {
  const pathname = String(value || "").trim();
  if (!pathname) {
    return "";
  }
  const stripped = pathname.replace(/\/+$/, "");
  return stripped || "/";
};

export const isAstroPublicRoute = (pathname) => {
  const normalized = normalizePathname(pathname);
  return ASTRO_PUBLIC_ROUTE_PATHS.includes(normalized);
};

export const registerAstroRoutes = ({ app, handleAstroPublicRequest } = {}) => {
  app.get(ASTRO_PUBLIC_ROUTE_PATHS, async (req, res, next) => {
    if (typeof handleAstroPublicRequest !== "function") {
      return next();
    }
    try {
      return await handleAstroPublicRequest(req, res, next);
    } catch (error) {
      return next(error);
    }
  });
};

export default registerAstroRoutes;
