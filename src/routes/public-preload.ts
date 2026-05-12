const normalizePublicPrefetchPath = (value: string) => {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/")) {
    return "";
  }
  return normalized;
};

export const preloadPublicRoute = (path: string) => {
  const normalizedPath = normalizePublicPrefetchPath(path);
  if (!normalizedPath) {
    return;
  }
  // Public HTML responses are served with `cache-control: no-store`, and the current
  // production edge rejects browser-issued `sec-purpose: prefetch` document requests
  // with a synthetic 503. Keep the helper as a stable no-op so hover handlers do not
  // spam the console with speculation/preload noise.
};
