export const HTML_CACHE_CONTROL_NO_STORE = "no-store";
export const HTML_CACHE_CONTROL_PRIVATE_REVALIDATE =
  "private, no-cache, max-age=0, must-revalidate";
export const HTML_VARY_COOKIE = "Cookie";

const normalizePathname = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    if (trimmed.startsWith("/")) {
      const parsed = new URL(trimmed, "http://localhost");
      return parsed.pathname || "/";
    }
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      return parsed.pathname || "/";
    }
    return null;
  } catch {
    return null;
  }
};

const isDashboardPath = (pathname) =>
  pathname === "/dashboard" || pathname.startsWith("/dashboard/");

export const resolveHtmlCacheControl = ({ pathname, isAuthenticated } = {}) => {
  if (isAuthenticated === true) {
    return HTML_CACHE_CONTROL_NO_STORE;
  }

  const normalizedPathname = normalizePathname(pathname);
  if (!normalizedPathname) {
    return HTML_CACHE_CONTROL_NO_STORE;
  }

  if (isDashboardPath(normalizedPathname)) {
    return HTML_CACHE_CONTROL_NO_STORE;
  }

  return HTML_CACHE_CONTROL_NO_STORE;
};

const normalizeVaryTokens = (value) =>
  String(value || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

export const resolveHtmlVaryHeader = (currentValue) => {
  const tokens = normalizeVaryTokens(currentValue);
  if (tokens.some((token) => token.toLowerCase() === HTML_VARY_COOKIE.toLowerCase())) {
    return tokens.join(", ");
  }
  return [...tokens, HTML_VARY_COOKIE].join(", ");
};

export const applyHtmlCachingHeaders = (res, options = {}) => {
  if (!res || typeof res.setHeader !== "function") {
    return;
  }
  res.setHeader("Cache-Control", resolveHtmlCacheControl(options));
  const currentVary = typeof res.getHeader === "function" ? res.getHeader("Vary") : "";
  res.setHeader("Vary", resolveHtmlVaryHeader(currentVary));
};
