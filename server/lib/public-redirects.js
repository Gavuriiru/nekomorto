const DEFAULT_MAX_REDIRECTS = 200;

const RESERVED_PREFIXES = ["/api", "/auth", "/uploads", "/assets", "/pwa"];
const RESERVED_EXACT_PATHS = new Set([
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
const RESERVED_PATH_PATTERNS = [
  /^\/workbox-[a-z0-9_-]+\.js$/i,
  /\.(?:js|mjs|cjs|css|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|json|xml|webmanifest)$/i,
];

const asTrimmedString = (value) => String(value || "").trim();

const clampMaxEntries = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MAX_REDIRECTS;
  }
  return Math.min(Math.floor(parsed), 1000);
};

const stripTrailingSlash = (value) => {
  if (value === "/") {
    return value;
  }
  return value.replace(/\/+$/, "");
};

export const normalizeRedirectFromPath = (value) => {
  const raw = asTrimmedString(value);
  if (!raw) {
    return "";
  }
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return "";
  }

  let path = raw;
  const hashIndex = path.indexOf("#");
  if (hashIndex >= 0) {
    path = path.slice(0, hashIndex);
  }
  const queryIndex = path.indexOf("?");
  if (queryIndex >= 0) {
    path = path.slice(0, queryIndex);
  }
  path = path.replace(/\/{2,}/g, "/");
  path = stripTrailingSlash(path || "/");
  if (!path.startsWith("/")) {
    return "";
  }
  return path || "/";
};

const normalizeRedirectTarget = (value) => {
  const raw = asTrimmedString(value);
  if (!raw) {
    return "";
  }
  if (raw.startsWith("/")) {
    if (raw.startsWith("//")) {
      return "";
    }
    try {
      const parsed = new URL(raw, "http://localhost");
      const pathname = stripTrailingSlash(parsed.pathname.replace(/\/{2,}/g, "/") || "/");
      return `${pathname || "/"}${parsed.search || ""}${parsed.hash || ""}`;
    } catch {
      return "";
    }
  }
  try {
    const parsed = new URL(raw);
    const protocol = String(parsed.protocol || "").toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
};

const normalizeRuleId = (value, index) => {
  const raw = asTrimmedString(value);
  if (raw) {
    return raw.slice(0, 120);
  }
  return `redirect-${index + 1}`;
};

const splitTargetHash = (target) => {
  const raw = String(target || "");
  const hashIndex = raw.indexOf("#");
  if (hashIndex < 0) {
    return { base: raw, hash: "" };
  }
  return {
    base: raw.slice(0, hashIndex),
    hash: raw.slice(hashIndex),
  };
};

const normalizeSearchString = (value) => {
  const raw = asTrimmedString(value);
  if (!raw) {
    return "";
  }
  return raw.startsWith("?") ? raw.slice(1) : raw;
};

const appendSearchToTarget = (target, search) => {
  const normalizedSearch = normalizeSearchString(search);
  if (!normalizedSearch) {
    return String(target || "");
  }
  const { base, hash } = splitTargetHash(target);
  const delimiter = base.includes("?") ? "&" : "?";
  return `${base}${delimiter}${normalizedSearch}${hash}`;
};

export const isReservedRedirectPath = (value) => {
  const normalized = normalizeRedirectFromPath(value);
  if (!normalized) {
    return false;
  }
  const lower = normalized.toLowerCase();
  if (RESERVED_EXACT_PATHS.has(lower)) {
    return true;
  }
  if (
    RESERVED_PREFIXES.some(
      (prefix) => lower === prefix || lower.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }
  return RESERVED_PATH_PATTERNS.some((pattern) => pattern.test(lower));
};

export const normalizePublicRedirects = (value, options = {}) => {
  const items = Array.isArray(value) ? value : [];
  const maxEntries = clampMaxEntries(options.maxEntries);
  const seenFromPaths = new Set();
  const output = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const from = normalizeRedirectFromPath(item.from);
    if (!from || isReservedRedirectPath(from)) {
      continue;
    }
    const to = normalizeRedirectTarget(item.to);
    if (!to) {
      continue;
    }
    if (to.startsWith("/") && normalizeRedirectFromPath(to) === from && !to.includes("?") && !to.includes("#")) {
      continue;
    }
    if (seenFromPaths.has(from)) {
      continue;
    }
    seenFromPaths.add(from);
    output.push({
      id: normalizeRuleId(item.id, index),
      from,
      to,
      enabled: item.enabled !== false,
    });
    if (output.length >= maxEntries) {
      break;
    }
  }

  return output;
};

export const resolvePublicRedirect = ({ redirects, pathname, search = "" } = {}) => {
  const normalizedPath = normalizeRedirectFromPath(pathname);
  if (!normalizedPath || isReservedRedirectPath(normalizedPath)) {
    return null;
  }

  const rules = Array.isArray(redirects) ? redirects : [];
  const matchedRule = rules.find(
    (rule) =>
      rule &&
      typeof rule === "object" &&
      rule.enabled !== false &&
      normalizeRedirectFromPath(rule.from) === normalizedPath,
  );
  if (!matchedRule) {
    return null;
  }
  const target = normalizeRedirectTarget(matchedRule.to);
  if (!target) {
    return null;
  }
  const location = appendSearchToTarget(target, search);
  return {
    statusCode: 301,
    location,
    rule: {
      id: normalizeRuleId(matchedRule.id, 0),
      from: normalizedPath,
      to: target,
      enabled: true,
    },
  };
};
