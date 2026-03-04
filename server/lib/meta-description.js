export const MAX_META_DESCRIPTION_CHARS = 160;

const normalizeLimit = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return MAX_META_DESCRIPTION_CHARS;
  }
  return Math.min(Math.max(Math.floor(numeric), 10), 1000);
};

const stripHtmlTags = (value) => String(value || "").replace(/<[^>]*>/g, " ");

const normalizeWhitespace = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

export const truncateMetaDescription = (value, max = MAX_META_DESCRIPTION_CHARS) => {
  const limit = normalizeLimit(max);
  const normalized = normalizeWhitespace(stripHtmlTags(value));
  if (!normalized) {
    return "";
  }
  if (normalized.length <= limit) {
    return normalized;
  }

  const fallbackText = normalized.slice(0, Math.max(0, limit - 1)).trim();
  if (!fallbackText) {
    return "…";
  }

  const lastSpace = fallbackText.lastIndexOf(" ");
  const wordSafe =
    lastSpace >= Math.floor(limit * 0.6) ? fallbackText.slice(0, lastSpace).trim() : fallbackText;

  return `${wordSafe || fallbackText}…`;
};
