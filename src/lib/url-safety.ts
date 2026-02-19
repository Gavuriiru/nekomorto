const ICON_KEY_PATTERN = /^[a-z0-9_-]+$/;

const normalizeValue = (value: unknown) => String(value || "").trim();

const hasBlockedProtocol = (value: string) => {
  const normalized = value.toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("file:") ||
    normalized.startsWith("blob:")
  );
};

const parseAbsoluteUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

export const sanitizePublicHref = (value: unknown): string | null => {
  const normalized = normalizeValue(value);
  if (!normalized || hasBlockedProtocol(normalized)) {
    return null;
  }
  if (normalized.startsWith("/")) {
    if (normalized.startsWith("//")) {
      return null;
    }
    return normalized;
  }
  const parsed = parseAbsoluteUrl(normalized);
  if (!parsed) {
    return null;
  }
  const protocol = String(parsed.protocol || "").toLowerCase();
  if (protocol === "http:" || protocol === "https:" || protocol === "mailto:" || protocol === "tel:") {
    return parsed.toString();
  }
  return null;
};

export const sanitizeIconSource = (value: unknown): string | null => {
  const normalized = normalizeValue(value);
  if (!normalized || hasBlockedProtocol(normalized)) {
    return null;
  }
  const iconKeyCandidate = normalized.toLowerCase();
  if (ICON_KEY_PATTERN.test(iconKeyCandidate)) {
    return iconKeyCandidate;
  }
  if (normalized.startsWith("/uploads/")) {
    return normalized;
  }
  const parsed = parseAbsoluteUrl(normalized);
  if (!parsed) {
    return null;
  }
  if (String(parsed.protocol || "").toLowerCase() === "https:") {
    return parsed.toString();
  }
  return null;
};

export const isIconUrlSource = (value: unknown): boolean => {
  const sanitized = sanitizeIconSource(value);
  if (!sanitized) {
    return false;
  }
  return sanitized.startsWith("/uploads/") || sanitized.startsWith("https://");
};
