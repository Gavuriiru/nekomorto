const ICON_KEY_PATTERN = /^[a-z0-9_-]+$/;

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

const hasBlockedProtocol = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("file:") ||
    normalized.startsWith("blob:")
  );
};

export const sanitizePublicHref = (value) => {
  const normalized = normalizeString(value);
  if (!normalized || hasBlockedProtocol(normalized)) {
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
  if (!normalized || hasBlockedProtocol(normalized)) {
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
  const parsed = toAbsoluteUrl(normalized);
  if (!parsed) {
    return null;
  }
  if (String(parsed.protocol || "").toLowerCase() === "https:") {
    return parsed.toString();
  }
  return null;
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
