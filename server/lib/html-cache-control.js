export const HTML_CACHE_CONTROL_NO_STORE = "no-store";
export const HTML_CACHE_CONTROL_PRIVATE_REVALIDATE =
  "private, no-cache, max-age=0, must-revalidate";

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

  return HTML_CACHE_CONTROL_PRIVATE_REVALIDATE;
};
