import { pathToFileURL } from "node:url";
import { buildPublicRoutePayload } from "./public-bootstrap.js";

const toAstroModuleSpecifier = (entryFilePath, isProduction) => {
  const baseUrl = pathToFileURL(entryFilePath).href;
  if (isProduction) {
    return baseUrl;
  }
  return `${baseUrl}?t=${Date.now()}`;
};

const normalizePathname = (value) => {
  const pathname = String(value || "").trim();
  if (!pathname) {
    return "/";
  }
  return pathname.replace(/\/+$/, "") || "/";
};

export const resolveAstroPublicRoutePayload = async ({
  pathname,
  pages,
  siteSettings,
  req,
  buildPublicMediaVariants,
  buildPublicTeamMembers,
  loadAstroPublicRoutePayload,
  loadLinkTypes,
  resolvePublicDonationsRoutePayload,
} = {}) => {
  if (typeof loadAstroPublicRoutePayload === "function") {
    const customPayload = await loadAstroPublicRoutePayload({
      pathname,
      pages,
      req,
      siteSettings,
    });
    if (customPayload !== undefined) {
      return customPayload ?? null;
    }
  }

  const normalizedPathname = normalizePathname(pathname);

  switch (normalizedPathname) {
    case "/equipe": {
      if (
        typeof buildPublicMediaVariants !== "function" ||
        typeof buildPublicTeamMembers !== "function" ||
        typeof loadLinkTypes !== "function"
      ) {
        return null;
      }
      const teamMembers = buildPublicTeamMembers();
      const teamLinkTypes = loadLinkTypes();
      return buildPublicRoutePayload({
        kind: "team",
        teamMembers,
        teamLinkTypes,
        mediaVariants: buildPublicMediaVariants([teamMembers, teamLinkTypes], {
          allowPrivateUrls: teamMembers.map((member) => member?.avatarUrl).filter(Boolean),
        }),
      });
    }
    case "/doacoes": {
      if (typeof resolvePublicDonationsRoutePayload !== "function") {
        return null;
      }
      const merchantName =
        String(siteSettings?.site?.name || siteSettings?.footer?.brandName || "NEKOMATA").trim() ||
        "NEKOMATA";
      const donationsRoutePayload = await resolvePublicDonationsRoutePayload({
        donationsPage: pages?.donations,
        merchantName,
      });
      return buildPublicRoutePayload({
        kind: "donations",
        pixQrCodeUrl: donationsRoutePayload?.pixQrCodeUrl || "",
        cryptoQrCodeUrls: donationsRoutePayload?.cryptoQrCodeUrls || {},
      });
    }
    default:
      return null;
  }
};

export const createAstroPublicRequestHandler = ({
  entryFilePath,
  fs,
  isProduction,
  loadAstroPublicBootstrap,
  loadAstroRoutePayload,
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
    const pages = typeof loadPages === "function" ? loadPages() : null;
    const siteSettings = typeof loadSiteSettings === "function" ? loadSiteSettings() : null;
    const routePayload =
      typeof loadAstroRoutePayload === "function"
        ? await loadAstroRoutePayload({
            pages,
            pathname: req?.path,
            req,
            siteSettings,
          })
        : null;
    const publicBootstrap =
      typeof loadAstroPublicBootstrap === "function"
        ? await loadAstroPublicBootstrap({
            pages,
            pathname: req?.path,
            req,
            siteSettings,
          })
        : null;
    return handler(req, res, next, {
      nekomata: {
        pages,
        primaryAppOrigin: String(primaryAppOrigin || "").trim(),
        publicBootstrap,
        routePayload,
        siteSettings,
      },
    });
  };
};

export default createAstroPublicRequestHandler;
