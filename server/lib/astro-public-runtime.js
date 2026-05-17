import { pathToFileURL } from "node:url";

const toAstroModuleSpecifier = (entryFilePath, isProduction) => {
  const baseUrl = pathToFileURL(entryFilePath).href;
  if (isProduction) {
    return baseUrl;
  }
  return `${baseUrl}?t=${Date.now()}`;
};

export const createAstroPublicRequestHandler = ({
  entryFilePath,
  fs,
  isProduction,
  loadPages,
  loadSiteSettings,
  primaryAppOrigin,
} = {}) => {
  let cachedHandlerPromise = null;

  const loadHandler = async () => {
    if (!entryFilePath || !fs?.existsSync?.(entryFilePath)) {
      return null;
    }
    if (isProduction && cachedHandlerPromise) {
      return cachedHandlerPromise;
    }
    const handlerPromise = import(toAstroModuleSpecifier(entryFilePath, Boolean(isProduction)))
      .then((module) => (typeof module?.handler === "function" ? module.handler : null))
      .catch((error) => {
        if (isProduction) {
          cachedHandlerPromise = null;
        }
        throw error;
      });
    if (isProduction) {
      cachedHandlerPromise = handlerPromise;
    }
    return handlerPromise;
  };

  return async (req, res, next) => {
    const handler = await loadHandler();
    if (!handler) {
      return next();
    }
    return handler(req, res, next, {
      nekomata: {
        pages: typeof loadPages === "function" ? loadPages() : null,
        primaryAppOrigin: String(primaryAppOrigin || "").trim(),
        siteSettings: typeof loadSiteSettings === "function" ? loadSiteSettings() : null,
      },
    });
  };
};

export default createAstroPublicRequestHandler;
