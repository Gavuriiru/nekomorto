const ICON_KEY_PATTERN = /^[a-z0-9_-]+$/;
const FAVORITE_WORK_CATEGORIES = Object.freeze(["manga", "anime"]);
const MAX_FAVORITE_WORKS = 3;
const MAX_FAVORITE_WORK_LENGTH = 80;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;
const CONTROL_OR_SPACE_PATTERN = /[\u0000-\u0020\u007F]+/g;

const normalizeString = (value) => String(value || "").trim();

const toAbsoluteUrl = (value) => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }
  try {
    return new URL(normalized);
  } catch {
    return null;
  }
};

const hasUnsafeUrlCodepoints = (value) => {
  const normalized = String(value || "");
  if (CONTROL_CHAR_PATTERN.test(normalized)) {
    return true;
  }
  try {
    return CONTROL_CHAR_PATTERN.test(decodeURIComponent(normalized));
  } catch {
    return false;
  }
};

export const hasBlockedProtocol = (value) => {
  const normalized = normalizeString(value).replace(CONTROL_OR_SPACE_PATTERN, "").toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("file:") ||
    normalized.startsWith("blob:")
  );
};

export const parseSafeUrlValue = (value, { baseUrl } = {}) => {
  const normalized = normalizeString(value);
  if (!normalized || hasUnsafeUrlCodepoints(normalized) || hasBlockedProtocol(normalized)) {
    return null;
  }
  try {
    return baseUrl ? new URL(normalized, baseUrl) : new URL(normalized);
  } catch {
    return null;
  }
};

export const sanitizeLocalAssetHref = (value, { allowedPrefixes = ["/assets/"] } = {}) => {
  const parsed = parseSafeUrlValue(value, { baseUrl: "https://assets.local/" });
  if (!parsed || parsed.origin !== "https://assets.local") {
    return null;
  }
  const normalizedPath = `${parsed.pathname || ""}${parsed.search || ""}${parsed.hash || ""}`;
  if (
    allowedPrefixes.some(
      (prefix) => normalizedPath === prefix.slice(0, -1) || normalizedPath.startsWith(prefix),
    )
  ) {
    return normalizedPath;
  }
  return null;
};

export const sanitizePublicHref = (value) => {
  const normalized = normalizeString(value);
  if (!normalized || hasUnsafeUrlCodepoints(normalized) || hasBlockedProtocol(normalized)) {
    return null;
  }
  if (normalized.startsWith("/")) {
    if (normalized.startsWith("//")) {
      return null;
    }
    return normalized;
  }
  const parsed = toAbsoluteUrl(normalized);
  if (!parsed) {
    return null;
  }
  const protocol = String(parsed.protocol || "").toLowerCase();
  if (["http:", "https:", "mailto:", "tel:"].includes(protocol)) {
    return parsed.toString();
  }
  return null;
};

export const sanitizeAssetUrl = (value) => {
  const normalized = normalizeString(value);
  if (!normalized || hasUnsafeUrlCodepoints(normalized) || hasBlockedProtocol(normalized)) {
    return null;
  }
  if (normalized.startsWith("/")) {
    if (normalized.startsWith("//")) {
      return null;
    }
    return normalized;
  }
  const parsed = toAbsoluteUrl(normalized);
  if (!parsed) {
    return null;
  }
  const protocol = String(parsed.protocol || "").toLowerCase();
  if (protocol === "http:" || protocol === "https:") {
    return parsed.toString();
  }
  return null;
};

export const sanitizeIconSource = (value) => {
  const normalized = normalizeString(value);
  if (!normalized || hasUnsafeUrlCodepoints(normalized) || hasBlockedProtocol(normalized)) {
    return null;
  }
  const iconKeyCandidate = normalized.toLowerCase();
  if (ICON_KEY_PATTERN.test(iconKeyCandidate)) {
    return iconKeyCandidate;
  }
  if (normalized.startsWith("/uploads/")) {
    return normalized;
  }
  const parsed = toAbsoluteUrl(normalized);
  if (!parsed) {
    return null;
  }
  if (String(parsed.protocol || "").toLowerCase() === "https:") {
    return parsed.toString();
  }
  return null;
};

const sanitizeFavoriteWorksList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  const dedupe = new Set();
  const output = [];
  value.forEach((entry) => {
    const title = normalizeString(entry).slice(0, MAX_FAVORITE_WORK_LENGTH);
    if (!title) {
      return;
    }
    const dedupeKey = title.toLowerCase();
    if (dedupe.has(dedupeKey)) {
      return;
    }
    dedupe.add(dedupeKey);
    output.push(title);
  });
  return output.slice(0, MAX_FAVORITE_WORKS);
};

const emptyFavoriteWorksByCategory = () => ({
  manga: [],
  anime: [],
});

export const sanitizeFavoriteWorksByCategory = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyFavoriteWorksByCategory();
  }
  const source = value;
  const output = {};
  FAVORITE_WORK_CATEGORIES.forEach((category) => {
    output[category] = sanitizeFavoriteWorksList(source?.[category]);
  });
  return output;
};

export const sanitizeSocials = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  const dedupe = new Set();
  const output = [];
  value.forEach((entry) => {
    const label = normalizeString(entry?.label);
    const href = sanitizePublicHref(entry?.href);
    if (!label || !href) {
      return;
    }
    const dedupeKey = `${label.toLowerCase()}::${href}`;
    if (dedupe.has(dedupeKey)) {
      return;
    }
    dedupe.add(dedupeKey);
    output.push({
      label,
      href,
    });
  });
  return output;
};
