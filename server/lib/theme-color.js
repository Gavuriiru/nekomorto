export const DEFAULT_THEME_COLOR = "#9667e0";

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

export const resolveThemeColor = (value) => {
  const normalized = String(value || "").trim();
  if (!HEX_COLOR_PATTERN.test(normalized)) {
    return DEFAULT_THEME_COLOR;
  }
  const raw = normalized.slice(1);
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : raw;
  return `#${expanded.toLowerCase()}`;
};
