export const normalizeAssetUrl = (rawUrl?: string | null) => {
  if (!rawUrl) {
    return rawUrl || "";
  }
  if (typeof window === "undefined") {
    return rawUrl;
  }
  const trimmed = String(rawUrl).trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("/")) {
    return `${window.location.origin}${trimmed}`;
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
};
