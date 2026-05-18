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

const toBuffer = (chunk, encoding) => {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }
  if (typeof chunk === "string") {
    return Buffer.from(chunk, encoding || "utf8");
  }
  return Buffer.from(String(chunk ?? ""), encoding || "utf8");
};

const shouldInjectNonceIntoAstroHtml = (res, bodyBuffer) => {
  const contentTypeHeader =
    typeof res.getHeader === "function" ? String(res.getHeader("Content-Type") || "") : "";
  if (contentTypeHeader.toLowerCase().includes("text/html")) {
    return true;
  }
  const bodyPreview = bodyBuffer.toString("utf8", 0, Math.min(bodyBuffer.length, 512)).toLowerCase();
  return bodyPreview.includes("<!doctype html") || bodyPreview.includes("<html");
};

export const attachAstroHtmlNonceInjection = ({ res, injectNonceIntoHtmlScripts } = {}) => {
  if (!res || typeof injectNonceIntoHtmlScripts !== "function") {
    return () => { };
  }

  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  const bodyChunks = [];

  res.write = (chunk, encoding, callback) => {
    if (chunk !== undefined && chunk !== null) {
      bodyChunks.push(toBuffer(chunk, encoding));
    }
    if (typeof callback === "function") {
      callback();
    }
    return true;
  };

  res.end = (chunk, encoding, callback) => {
    if (chunk !== undefined && chunk !== null) {
      bodyChunks.push(toBuffer(chunk, encoding));
    }

    const cspNonce = typeof res.locals?.cspNonce === "string" ? res.locals.cspNonce.trim() : "";
    const bodyBuffer = Buffer.concat(bodyChunks);
    const nextChunk =
      cspNonce && shouldInjectNonceIntoAstroHtml(res, bodyBuffer)
        ? Buffer.from(injectNonceIntoHtmlScripts(bodyBuffer.toString("utf8"), cspNonce), "utf8")
        : bodyBuffer;

    if (typeof res.removeHeader === "function") {
      res.removeHeader("Content-Length");
    }

    res.write = originalWrite;
    res.end = originalEnd;
    return originalEnd(nextChunk, undefined, callback);
  };

  return () => {
    res.write = originalWrite;
    res.end = originalEnd;
  };
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
        String(siteSettings?.site?.name || siteSettings?.footer?.brandName || "Nekomata").trim() ||
        "Nekomata";
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
  injectNonceIntoHtmlScripts,
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
    const restoreAstroResponse = attachAstroHtmlNonceInjection({
      res,
      injectNonceIntoHtmlScripts,
    });
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
    try {
      return await handler(req, res, next, {
        nekomata: {
          currentUser: req?.session?.user ?? null,
          pages,
          primaryAppOrigin: String(primaryAppOrigin || "").trim(),
          publicBootstrap,
          routePayload,
          siteSettings,
        },
      });
    } catch (error) {
      restoreAstroResponse();
      throw error;
    }
  };
};

export default createAstroPublicRequestHandler;
