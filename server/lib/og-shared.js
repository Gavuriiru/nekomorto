export const normalizeText = (value) => String(value || "").trim();

export const finalizeVariantUrl = ({ url, preset, resolveVariantUrl, origin } = {}) => {
  const normalizedUrl = normalizeText(url);
  if (!normalizedUrl) {
    return "";
  }

  const resolvedVariant =
    typeof resolveVariantUrl === "function"
      ? normalizeText(resolveVariantUrl(normalizedUrl, preset))
      : "";
  const finalUrl = resolvedVariant || normalizedUrl;
  if (finalUrl.startsWith("/") && !finalUrl.startsWith("/uploads/") && origin) {
    return `${String(origin).replace(/\/+$/, "")}${finalUrl}`;
  }
  return finalUrl;
};
