import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createJobQueue } from "./job-queue.js";
import { sanitizeLocalAssetHref } from "./url-safety.js";
import { PUBLIC_STATIC_PATHS } from "./public-visibility-runtime.js";

export const PUBLIC_PRERENDER_BYPASS_HEADER = "x-nekomorto-prerender-bypass";
export const PUBLIC_PRERENDER_MANIFEST_FILE = "manifest.json";

const PROJECT_DETAIL_PATH_REGEX = /^\/projeto\/[^/]+$/;
const POST_DETAIL_PATH_REGEX = /^\/postagem\/[^/]+$/;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const serializeInlineJson = (value) =>
  JSON.stringify(value ?? null)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export const normalizePublicPrerenderPathname = (value) => {
  const pathname = String(value || "").trim();
  if (!pathname) {
    return "/";
  }
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return normalized === "/" ? normalized : normalized.replace(/\/+$/, "");
};

export const isSupportedPublicPrerenderPathname = (value) => {
  const pathname = normalizePublicPrerenderPathname(value);
  if (PUBLIC_STATIC_PATHS.includes(pathname)) {
    return true;
  }
  return PROJECT_DETAIL_PATH_REGEX.test(pathname) || POST_DETAIL_PATH_REGEX.test(pathname);
};

const normalizeArtifactSegment = (value) => {
  const normalizedValue = String(value || "");
  try {
    return encodeURIComponent(decodeURIComponent(normalizedValue));
  } catch {
    return encodeURIComponent(normalizedValue);
  }
};

export const buildPublicPrerenderArtifactRelativePath = (value) => {
  const pathname = normalizePublicPrerenderPathname(value);
  if (pathname === "/") {
    return "index.html";
  }
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => normalizeArtifactSegment(segment));
  return path.join(...segments, "index.html");
};

export const buildPublicPrerenderOutputPath = ({ outputDir, pathname }) =>
  path.join(outputDir, buildPublicPrerenderArtifactRelativePath(pathname));

export const extractPublicPrerenderPathnamesFromSitemap = ({
  primaryAppOrigin = "",
  xml = "",
} = {}) => {
  const origin = String(primaryAppOrigin || "").trim();
  const seen = new Set();
  const pathnames = [];
  const matches = String(xml || "").matchAll(/<loc>([^<]+)<\/loc>/gi);
  for (const match of matches) {
    const rawValue = String(match[1] || "").trim();
    if (!rawValue) {
      continue;
    }
    let pathname = "";
    try {
      pathname = new URL(rawValue, origin || "https://localhost").pathname;
    } catch {
      pathname = rawValue;
    }
    const normalizedPathname = normalizePublicPrerenderPathname(pathname);
    if (!isSupportedPublicPrerenderPathname(normalizedPathname) || seen.has(normalizedPathname)) {
      continue;
    }
    seen.add(normalizedPathname);
    pathnames.push(normalizedPathname);
  }
  return pathnames;
};

const extractInlineJsonBlock = ({ html, startMarker, endMarker }) => {
  const pattern = new RegExp(
    `${escapeRegExp(startMarker)}\\s*(.+?)\\s*${escapeRegExp(endMarker)}`,
    "s",
  );
  const match = String(html || "").match(pattern);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(String(match[1] || "").replace(/;\s*$/, ""));
  } catch {
    return null;
  }
};

const replaceInlineJsonBlock = ({ html, startMarker, endMarker, value }) => {
  const replacement = `${startMarker} ${serializeInlineJson(value)};\n${endMarker}`;
  const pattern = new RegExp(
    `${escapeRegExp(startMarker)}\\s*.+?\\s*${escapeRegExp(endMarker)}`,
    "s",
  );
  return String(html || "").replace(pattern, replacement);
};

const stripHomeHeroShellArtifacts = (html) =>
  String(html || "")
    .replace(/<style data-home-hero-shell-critical>[\s\S]*?<\/style>\s*/i, "")
    .replace(/<div id="home-hero-shell"[\s\S]*?<\/div>\s*/i, "");

const injectPrerenderedRootHtml = (html, appHtml) =>
  String(html || "").replace('<div id="root"></div>', `<div id="root">${String(appHtml || "")}</div>`);

const computeArtifactRevision = (value) =>
  crypto.createHash("sha1").update(String(value || "")).digest("hex");

const normalizeBuildFingerprint = (value) => String(value || "").trim();

const extractLocalClientAssetHrefs = (html) => {
  const source = String(html || "");
  const hrefs = new Set();
  const assetAttributePattern = /<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  for (const match of source.matchAll(assetAttributePattern)) {
    const rawValue = String(match[1] || match[2] || match[3] || "").trim();
    const href = sanitizeLocalAssetHref(rawValue, {
      allowedPrefixes: ["/assets/", "/fonts/", "/pwa/"],
    });
    if (href) {
      hrefs.add(href);
    }
  }
  return Array.from(hrefs);
};

const hasAllLocalClientAssetsAvailable = ({ clientDistDir, html }) => {
  const resolvedClientDistDir = String(clientDistDir || "").trim();
  if (!resolvedClientDistDir) {
    return true;
  }
  const assetHrefs = extractLocalClientAssetHrefs(html);
  return assetHrefs.every((href) => {
    const pathname = String(href).split(/[?#]/, 1)[0] || "";
    if (!pathname.startsWith("/")) {
      return true;
    }
    return fs.existsSync(path.join(resolvedClientDistDir, pathname.slice(1)));
  });
};

const loadRendererFromModule = (() => {
  const cache = new Map();
  return async (rendererModulePath) => {
    const modulePath = path.resolve(String(rendererModulePath || ""));
    if (!modulePath) {
      throw new Error("public_prerender_renderer_path_required");
    }
    if (!cache.has(modulePath)) {
      cache.set(modulePath, import(pathToFileURL(modulePath).href));
    }
    const loaded = await cache.get(modulePath);
    const renderPublicApp = loaded?.renderPublicApp || loaded?.default;
    if (typeof renderPublicApp !== "function") {
      throw new Error("public_prerender_renderer_export_missing");
    }
    return renderPublicApp;
  };
})();

const fetchText = async ({ baseUrl, fetchImpl, pathname }) => {
  const response = await fetchImpl(`${String(baseUrl || "").replace(/\/+$/, "")}${pathname}`, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      [PUBLIC_PRERENDER_BYPASS_HEADER]: "1",
    },
  });
  if (!response.ok) {
    throw new Error(`public_prerender_fetch_failed:${pathname}:${response.status}`);
  }
  return response.text();
};

const fetchFullBootstrap = async ({ baseUrl, fetchImpl }) => {
  const response = await fetchImpl(
    `${String(baseUrl || "").replace(/\/+$/, "")}/api/public/bootstrap`,
    {
      headers: {
        accept: "application/json",
        [PUBLIC_PRERENDER_BYPASS_HEADER]: "1",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`public_prerender_bootstrap_fetch_failed:${response.status}`);
  }
  return response.json();
};

export const buildPublicPrerenderPathnames = ({
  getPublicVisiblePosts,
  getPublicVisibleProjects,
} = {}) => {
  const staticPaths = [...PUBLIC_STATIC_PATHS];
  const projectPaths = (typeof getPublicVisibleProjects === "function" ? getPublicVisibleProjects() : [])
    .map((project) => String(project?.id || "").trim())
    .filter(Boolean)
    .map((id) => `/projeto/${id}`);
  const postPaths = (typeof getPublicVisiblePosts === "function" ? getPublicVisiblePosts() : [])
    .map((post) => String(post?.slug || "").trim())
    .filter(Boolean)
    .map((slug) => `/postagem/${slug}`);
  return [...new Set([...staticPaths, ...projectPaths, ...postPaths])];
};

export const generatePublicPrerenderArtifact = async ({
  baseUrl,
  fetchImpl = fetch,
  outputDir,
  pathname,
  renderPublicApp,
  rendererModulePath,
} = {}) => {
  const normalizedPathname = normalizePublicPrerenderPathname(pathname);
  if (!isSupportedPublicPrerenderPathname(normalizedPathname)) {
    throw new Error(`public_prerender_path_not_supported:${normalizedPathname}`);
  }

  let html = await fetchText({
    baseUrl,
    fetchImpl,
    pathname: normalizedPathname,
  });
  let publicBootstrap = extractInlineJsonBlock({
    html,
    startMarker: "window.__BOOTSTRAP_PUBLIC__ =",
    endMarker: "window.__BOOTSTRAP_ROUTE__ =",
  });
  const publicRoutePayload = extractInlineJsonBlock({
    html,
    startMarker: "window.__BOOTSTRAP_ROUTE__ =",
    endMarker: "window.__BOOTSTRAP_SETTINGS__ =",
  });
  const currentUser = extractInlineJsonBlock({
    html,
    startMarker: "window.__BOOTSTRAP_PUBLIC_ME__ =",
    endMarker: "window.__BOOTSTRAP_PWA_ENABLED__ =",
  });
  if (!publicBootstrap || typeof publicBootstrap !== "object") {
    throw new Error(`public_prerender_bootstrap_missing:${normalizedPathname}`);
  }

  if (normalizedPathname === "/" && String(publicBootstrap?.payloadMode || "") === "critical-home") {
    const fullBootstrap = await fetchFullBootstrap({ baseUrl, fetchImpl });
    if (fullBootstrap && typeof fullBootstrap === "object") {
      publicBootstrap = fullBootstrap;
      html = replaceInlineJsonBlock({
        html,
        startMarker: "window.__BOOTSTRAP_PUBLIC__ =",
        endMarker: "window.__BOOTSTRAP_ROUTE__ =",
        value: publicBootstrap,
      });
    }
  }

  const renderRouteToString =
    typeof renderPublicApp === "function"
      ? renderPublicApp
      : await loadRendererFromModule(rendererModulePath);
  const appHtml = await renderRouteToString({
    initialCurrentUser: currentUser,
    initialPublicBootstrap: publicBootstrap,
    initialPublicRoutePayload: publicRoutePayload,
    pathname: normalizedPathname,
  });
  const documentHtml = injectPrerenderedRootHtml(stripHomeHeroShellArtifacts(html), appHtml);
  const relativeFilePath = buildPublicPrerenderArtifactRelativePath(normalizedPathname);
  const absoluteFilePath = path.join(outputDir, relativeFilePath);
  fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true });
  fs.writeFileSync(absoluteFilePath, documentHtml, "utf8");

  return {
    filePath: relativeFilePath,
    generatedAt: new Date().toISOString(),
    pathname: normalizedPathname,
    revision: computeArtifactRevision(documentHtml),
  };
};

const readManifest = ({ outputDir }) => {
  const manifestPath = path.join(outputDir, PUBLIC_PRERENDER_MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    return { buildFingerprint: "", generatedAt: "", routes: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return {
      buildFingerprint: normalizeBuildFingerprint(parsed?.buildFingerprint),
      generatedAt: String(parsed?.generatedAt || ""),
      routes: Array.isArray(parsed?.routes) ? parsed.routes : [],
    };
  } catch {
    return { buildFingerprint: "", generatedAt: "", routes: [] };
  }
};

export const writePublicPrerenderManifest = ({ buildFingerprint = "", outputDir, routes }) => {
  fs.mkdirSync(outputDir, { recursive: true });
  const manifestPath = path.join(outputDir, PUBLIC_PRERENDER_MANIFEST_FILE);
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        buildFingerprint: normalizeBuildFingerprint(buildFingerprint),
        generatedAt: new Date().toISOString(),
        routes: routes
          .map((route) => ({
            filePath: String(route?.filePath || ""),
            generatedAt: String(route?.generatedAt || ""),
            pathname: normalizePublicPrerenderPathname(route?.pathname),
            revision: String(route?.revision || ""),
          }))
          .filter((route) => route.pathname && route.filePath),
      },
      null,
      2,
    ),
    "utf8",
  );
};

export const createPublicPrerenderRuntime = ({
  baseUrl,
  buildFingerprint = "",
  clientDistDir = "",
  enabled = false,
  fetchImpl = fetch,
  getPublicVisiblePosts,
  getPublicVisibleProjects,
  outputDir,
  rendererModulePath,
  sendHtml,
} = {}) => {
  const runtimeEnabled =
    enabled === true &&
    Boolean(String(baseUrl || "").trim()) &&
    Boolean(String(outputDir || "").trim()) &&
    Boolean(String(rendererModulePath || "").trim()) &&
    fs.existsSync(path.resolve(String(rendererModulePath || "")));
  const queue = createJobQueue({
    name: "public-prerender",
    concurrency: 1,
    historySize: 100,
    onError: ({ error, type }) => {
      console.error(
        `[public-prerender:${String(type || "job")}] ${String(error?.message || error || "failed")}`,
      );
    },
  });
  const queuedReasons = new Set();
  let hasPendingFlush = false;
  const runtimeBuildFingerprint = normalizeBuildFingerprint(buildFingerprint);

  const syncRoutes = async (pathnames) => {
    const supportedPathnames = [...new Set(pathnames.map(normalizePublicPrerenderPathname))].filter(
      isSupportedPublicPrerenderPathname,
    );
    const manifest = readManifest({ outputDir });
    const nextRoutes = [];
    for (const pathname of supportedPathnames) {
      nextRoutes.push(
        await generatePublicPrerenderArtifact({
          baseUrl,
          fetchImpl,
          outputDir,
          pathname,
          rendererModulePath,
        }),
      );
    }

    const nextPathSet = new Set(supportedPathnames);
    for (const route of manifest.routes) {
      const routePathname = normalizePublicPrerenderPathname(route?.pathname);
      if (!isSupportedPublicPrerenderPathname(routePathname) || nextPathSet.has(routePathname)) {
        continue;
      }
      const absoluteFilePath = path.join(outputDir, String(route?.filePath || ""));
      if (fs.existsSync(absoluteFilePath)) {
        fs.unlinkSync(absoluteFilePath);
      }
    }
    writePublicPrerenderManifest({
      buildFingerprint: runtimeBuildFingerprint,
      outputDir,
      routes: nextRoutes,
    });
    return nextRoutes;
  };

  const enqueueFullRegeneration = ({ reason = "manual" } = {}) => {
    if (!runtimeEnabled) {
      return Promise.resolve([]);
    }
    queuedReasons.add(String(reason || "manual"));
    if (hasPendingFlush) {
      return Promise.resolve([]);
    }
    hasPendingFlush = true;
    return queue
      .enqueue({
        payload: { reasons: Array.from(queuedReasons) },
        type: "full-regeneration",
        run: async () => {
          hasPendingFlush = false;
          queuedReasons.clear();
          return syncRoutes(
            buildPublicPrerenderPathnames({
              getPublicVisiblePosts,
              getPublicVisibleProjects,
            }),
          );
        },
      })
      .catch(() => [])
      .finally(() => {
        hasPendingFlush = false;
      });
  };

  const seedMissingStaticRoutes = async () => {
    if (!runtimeEnabled) {
      return [];
    }
    const manifest = readManifest({ outputDir });
    const manifestPaths = new Set(
      manifest.routes.map((route) => normalizePublicPrerenderPathname(route?.pathname)),
    );
    const missingStaticPaths = PUBLIC_STATIC_PATHS.filter((pathname) => {
      if (!manifestPaths.has(pathname)) {
        return true;
      }
      const filePath = buildPublicPrerenderOutputPath({ outputDir, pathname });
      return !fs.existsSync(filePath);
    });
    if (missingStaticPaths.length === 0) {
      return [];
    }
    return syncRoutes([
      ...new Set([
        ...manifest.routes.map((route) => normalizePublicPrerenderPathname(route?.pathname)),
        ...missingStaticPaths,
      ]),
    ]);
  };

  const middleware = async (req, res, next) => {
    if (!runtimeEnabled) {
      return next();
    }
    const method = String(req.method || "").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return next();
    }
    if (String(req.get?.(PUBLIC_PRERENDER_BYPASS_HEADER) || "").trim() === "1") {
      return next();
    }
    if (Object.keys(req.query || {}).length > 0) {
      return next();
    }
    const pathname = normalizePublicPrerenderPathname(req.path);
    if (!isSupportedPublicPrerenderPathname(pathname)) {
      return next();
    }
    const artifactPath = buildPublicPrerenderOutputPath({
      outputDir,
      pathname,
    });
    const manifest = readManifest({ outputDir });
    const manifestRoute = manifest.routes.find(
      (route) => normalizePublicPrerenderPathname(route?.pathname) === pathname,
    );
    if (
      (runtimeBuildFingerprint && manifest.buildFingerprint !== runtimeBuildFingerprint) ||
      !manifestRoute
    ) {
      void enqueueFullRegeneration({ reason: `stale-artifact:${pathname}` });
      return next();
    }
    if (!fs.existsSync(artifactPath)) {
      void enqueueFullRegeneration({ reason: `cache-miss:${pathname}` });
      return next();
    }
    try {
      const html = fs.readFileSync(artifactPath, "utf8");
      if (!hasAllLocalClientAssetsAvailable({ clientDistDir, html })) {
        void enqueueFullRegeneration({ reason: `missing-client-asset:${pathname}` });
        return next();
      }
      return await sendHtml(req, res, html);
    } catch {
      return next();
    }
  };

  return {
    buildAllPathnames: () =>
      buildPublicPrerenderPathnames({
        getPublicVisiblePosts,
        getPublicVisibleProjects,
      }),
    enqueueFullRegeneration,
    isEnabled: runtimeEnabled,
    middleware,
    queue,
    readManifest: () => readManifest({ outputDir }),
    seedMissingStaticRoutes,
    syncRoutes,
  };
};

export default createPublicPrerenderRuntime;
