export const MAX_META_DESCRIPTION_CHARS = 160;

const normalizeLimit = (value: number) => {
  if (!Number.isFinite(value)) {
    return MAX_META_DESCRIPTION_CHARS;
  }
  return Math.min(Math.max(Math.floor(value), 10), 1000);
};

const stripHtmlTags = (value: string) => String(value || "").replace(/<[^>]*>/g, " ");

const normalizeWhitespace = (value: string) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

export const truncateMetaDescription = (
  value: string | null | undefined,
  max = MAX_META_DESCRIPTION_CHARS,
) => {
  const limit = normalizeLimit(max);
  const normalized = normalizeWhitespace(stripHtmlTags(String(value || "")));
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
