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
  try {
    const parsed = new URL(trimmed);
    const isHttpUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
    if (isHttpUrl && parsed.pathname.startsWith("/uploads/")) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
};
