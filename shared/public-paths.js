const RESERVED_PUBLIC_PREFIXES = [
  "/api",
  "/auth",
  "/uploads",
  "/assets",
  "/pwa",
  "/src",
  "/@vite",
  "/@vite-plugin-pwa",
  "/@react-refresh",
  "/@id",
  "/@fs",
  "/node_modules/.vite",
];

const RESERVED_PUBLIC_EXACT_PATHS = new Set([
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/rss/posts.xml",
  "/rss/lancamentos.xml",
  "/api/public/sitemap.xml",
  "/api/public/rss.xml",
]);

const RESERVED_PUBLIC_PATH_PATTERNS = [
  /^\/workbox-[a-z0-9_-]+\.js$/i,
  /\.(?:js|mjs|cjs|css|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot|json|xml|webmanifest|wasm)$/i,
];

const asTrimmedString = (value) => String(value || "").trim();

const stripTrailingSlash = (value) => {
  if (value === "/") {
    return value;
  }
  return value.replace(/\/+$/, "");
};

export const normalizePublicPath = (value) => {
  const raw = asTrimmedString(value);
  if (!raw) {
    return "";
  }
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return "";
  }

  let normalized = raw;
  const hashIndex = normalized.indexOf("#");
  if (hashIndex >= 0) {
    normalized = normalized.slice(0, hashIndex);
  }
  const queryIndex = normalized.indexOf("?");
  if (queryIndex >= 0) {
    normalized = normalized.slice(0, queryIndex);
  }
  normalized = normalized.replace(/\/{2,}/g, "/");
  normalized = stripTrailingSlash(normalized || "/");
  if (!normalized.startsWith("/")) {
    return "";
  }
  return normalized || "/";
};

export const isReservedPublicPath = (value) => {
  const normalized = normalizePublicPath(value);
  if (!normalized) {
    return false;
  }

  const lower = normalized.toLowerCase();
  if (RESERVED_PUBLIC_EXACT_PATHS.has(lower)) {
    return true;
  }
  if (
    RESERVED_PUBLIC_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`))
  ) {
    return true;
  }
  return RESERVED_PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(lower));
};
