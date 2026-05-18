import { EventEmitter } from "node:events";
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
  const bodyPreview = bodyBuffer
    .toString("utf8", 0, Math.min(bodyBuffer.length, 512))
    .toLowerCase();
  return bodyPreview.includes("<!doctype html") || bodyPreview.includes("<html");
};

const normalizeBufferedAstroHeaderEntries = (headers) =>
  Object.entries(headers || {}).map(([name, value]) => [String(name), value]);

const normalizeBufferedAstroWriteArgs = (chunk, encoding, callback) => {
  let nextChunk = chunk;
  let nextEncoding = encoding;
  let nextCallback = callback;

  if (typeof nextChunk === "function") {
    nextCallback = nextChunk;
    nextChunk = undefined;
    nextEncoding = undefined;
  } else if (typeof nextEncoding === "function") {
    nextCallback = nextEncoding;
    nextEncoding = undefined;
  }

  return {
    callback: typeof nextCallback === "function" ? nextCallback : undefined,
    chunk: nextChunk,
    encoding: typeof nextEncoding === "string" ? nextEncoding : undefined,
  };
};

export const createBufferedAstroResponse = ({ req, locals } = {}) => {
  const headers = new Map();
  const bodyChunks = [];

  class BufferedAstroResponse extends EventEmitter {}

  const res = new BufferedAstroResponse();
  res.headersSent = false;
  res.locals = locals ?? {};
  res.req = req ?? null;
  res.statusCode = 200;
  res.statusMessage = "";
  res.writableEnded = false;

  res.setHeader = (name, value) => {
    const headerName = String(name || "");
    if (!headerName) {
      return res;
    }
    headers.set(headerName.toLowerCase(), {
      name: headerName,
      value,
    });
    return res;
  };

  res.getHeader = (name) => headers.get(String(name || "").toLowerCase())?.value;

  res.removeHeader = (name) => {
    headers.delete(String(name || "").toLowerCase());
    return res;
  };

  res.writeHead = (statusCode, statusMessageOrHeaders, maybeHeaders) => {
    res.statusCode = Number(statusCode || 200) || 200;
    res.headersSent = true;

    let nextHeaders = maybeHeaders;
    if (typeof statusMessageOrHeaders === "string") {
      res.statusMessage = statusMessageOrHeaders;
    } else if (statusMessageOrHeaders && typeof statusMessageOrHeaders === "object") {
      nextHeaders = statusMessageOrHeaders;
    }

    normalizeBufferedAstroHeaderEntries(nextHeaders).forEach(([name, value]) => {
      res.setHeader(name, value);
    });

    return res;
  };

  res.write = (chunk, encoding, callback) => {
    const normalized = normalizeBufferedAstroWriteArgs(chunk, encoding, callback);
    if (normalized.chunk !== undefined && normalized.chunk !== null) {
      bodyChunks.push(toBuffer(normalized.chunk, normalized.encoding));
    }
    normalized.callback?.();
    return true;
  };

  res.end = (chunk, encoding, callback) => {
    const normalized = normalizeBufferedAstroWriteArgs(chunk, encoding, callback);
    if (normalized.chunk !== undefined && normalized.chunk !== null) {
      bodyChunks.push(toBuffer(normalized.chunk, normalized.encoding));
    }
    if (!res.headersSent) {
      res.headersSent = true;
    }
    res.writableEnded = true;
    normalized.callback?.();
    res.emit("finish");
    return res;
  };

  return {
    getBodyBuffer: () => Buffer.concat(bodyChunks),
    getHeaders: () =>
      Array.from(headers.values()).reduce((result, entry) => {
        result[entry.name] = entry.value;
        return result;
      }, {}),
    res,
  };
};

export const sendBufferedAstroResponse = async ({ destination, rewriteHtml, source } = {}) => {
  if (!destination || !source) {
    return undefined;
  }

  const sourceResponse = source.res ?? null;
  const cspNonce =
    typeof destination.locals?.cspNonce === "string" ? destination.locals.cspNonce.trim() : "";
  const bodyBuffer =
    typeof source.getBodyBuffer === "function" ? source.getBodyBuffer() : Buffer.alloc(0);
  const shouldRewriteHtml =
    typeof rewriteHtml === "function" && shouldInjectNonceIntoAstroHtml(sourceResponse, bodyBuffer);
  const nextChunk = shouldRewriteHtml
    ? Buffer.from(await rewriteHtml(bodyBuffer.toString("utf8"), cspNonce), "utf8")
    : bodyBuffer;
  const sourceHeaders = typeof source.getHeaders === "function" ? source.getHeaders() : {};
  const statusCode = Number(sourceResponse?.statusCode || 200) || 200;
  const statusMessage = String(sourceResponse?.statusMessage || "");

  if (typeof destination.status === "function") {
    destination.status(statusCode);
  } else {
    destination.statusCode = statusCode;
  }
  if (statusMessage) {
    destination.statusMessage = statusMessage;
  }

  normalizeBufferedAstroHeaderEntries(sourceHeaders).forEach(([name, value]) => {
    if (shouldRewriteHtml && name.toLowerCase() === "content-length") {
      return;
    }
    destination.setHeader?.(name, value);
  });

  if (shouldRewriteHtml) {
    destination.removeHeader?.("Content-Length");
  }

  return destination.end(nextChunk);
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
  injectAstroPublicHtml,
  injectNonceIntoHtmlScripts,
  isProduction,
  loadAstroFallbackRoutePayload,
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
    const bufferedAstroResponse = createBufferedAstroResponse({
      locals: res.locals,
      req,
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
    const resolvedRoutePayload =
      typeof loadAstroFallbackRoutePayload === "function"
        ? await loadAstroFallbackRoutePayload({
            pages,
            pathname: req?.path,
            req,
            routePayload,
            siteSettings,
          })
        : routePayload;
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
      await handler(req, bufferedAstroResponse.res, next, {
        nekomata: {
          currentUser: req?.session?.user ?? null,
          pages,
          primaryAppOrigin: String(primaryAppOrigin || "").trim(),
          publicBootstrap,
          routePayload: resolvedRoutePayload,
          siteSettings,
        },
      });
      return sendBufferedAstroResponse({
        destination: res,
        rewriteHtml: async (html, cspNonce) => {
          let nextHtml = String(html || "");
          if (typeof injectAstroPublicHtml === "function") {
            nextHtml = await injectAstroPublicHtml({
              html: nextHtml,
              pathname: req?.path,
              publicBootstrap,
              publicMe: req?.session?.user ?? null,
              publicRoutePayload: resolvedRoutePayload,
              routeParams: req?.params,
              routeQuery: req?.query,
              settings: siteSettings,
            });
          }
          if (cspNonce && typeof injectNonceIntoHtmlScripts === "function") {
            nextHtml = injectNonceIntoHtmlScripts(nextHtml, cspNonce);
          }
          return nextHtml;
        },
        source: bufferedAstroResponse,
      });
    } catch (error) {
      throw error;
    }
  };
};

export default createAstroPublicRequestHandler;
