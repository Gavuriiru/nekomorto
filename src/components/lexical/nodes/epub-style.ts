const BLOCK_STYLE_KEYS = [
  "font-size",
  "text-indent",
  "margin-top",
  "margin-bottom",
  "line-height",
  "font-family",
] as const;

const IMAGE_STYLE_KEYS = [
  "width",
  "height",
  "max-width",
  "display",
  "margin-left",
  "margin-right",
  "margin-top",
  "margin-bottom",
  "vertical-align",
] as const;

type StyleKey = (typeof BLOCK_STYLE_KEYS)[number] | (typeof IMAGE_STYLE_KEYS)[number];

const ZERO_LIKE_VALUES = new Set([
  "",
  "0",
  "0px",
  "0em",
  "0rem",
  "0%",
  "normal",
  "auto",
  "none",
  "initial",
  "inherit",
]);

const toCamelCase = (value: string) =>
  value.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

const normalizeValue = (value: string) => String(value || "").trim().replace(/\s+/g, " ");

const getStyleRecord = (style: CSSStyleDeclaration | string) => {
  if (typeof style === "string") {
    return parseStyleDeclaration(style);
  }
  const record: Record<string, string> = {};
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    if (!property) {
      continue;
    }
    record[property.toLowerCase()] = normalizeValue(style.getPropertyValue(property));
  }
  return record;
};

export const parseStyleDeclaration = (cssText: string) => {
  const record: Record<string, string> = {};
  String(cssText || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex === -1) {
        return;
      }
      const property = normalizeValue(entry.slice(0, separatorIndex)).toLowerCase();
      const value = normalizeValue(entry.slice(separatorIndex + 1));
      if (!property || !value) {
        return;
      }
      record[property] = value;
    });
  return record;
};

export const buildStyleDeclaration = (
  entries: Array<readonly [StyleKey | string, string | null | undefined]>,
) =>
  entries
    .map(([property, value]) => [String(property).trim().toLowerCase(), normalizeValue(String(value || ""))] as const)
    .filter(([property, value]) => property && value)
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");

const isMeaningfulValue = (value: string) => !ZERO_LIKE_VALUES.has(normalizeValue(value).toLowerCase());

export const normalizeFontFamilyBucket = (value: string) => {
  const normalized = normalizeValue(value).toLowerCase();
  if (!normalized) {
    return "";
  }
  if (
    normalized.includes("mono") ||
    normalized.includes("consolas") ||
    normalized.includes("courier") ||
    normalized.includes("fira code") ||
    normalized.includes("jetbrains mono")
  ) {
    return "monospace";
  }
  if (
    normalized.includes("sans") ||
    normalized.includes("arial") ||
    normalized.includes("helvetica") ||
    normalized.includes("verdana") ||
    normalized.includes("tahoma") ||
    normalized.includes("gothic") ||
    normalized.includes("meiryo") ||
    normalized.includes("yu gothic")
  ) {
    return "sans-serif";
  }
  return "serif";
};

export const extractBlockEditorialStyle = (style: CSSStyleDeclaration | string) => {
  const record = getStyleRecord(style);
  const textAlign = normalizeValue(record["text-align"]).toLowerCase();
  const editorialStyle = buildStyleDeclaration([
    ["font-size", isMeaningfulValue(record["font-size"]) ? record["font-size"] : ""],
    ["text-indent", isMeaningfulValue(record["text-indent"]) ? record["text-indent"] : ""],
    ["margin-top", isMeaningfulValue(record["margin-top"]) ? record["margin-top"] : ""],
    ["margin-bottom", isMeaningfulValue(record["margin-bottom"]) ? record["margin-bottom"] : ""],
    ["line-height", isMeaningfulValue(record["line-height"]) ? record["line-height"] : ""],
    [
      "font-family",
      isMeaningfulValue(record["font-family"])
        ? normalizeFontFamilyBucket(record["font-family"])
        : "",
    ],
  ]);

  return {
    format: ["left", "right", "center", "justify"].includes(textAlign) ? textAlign : "",
    editorialStyle,
  };
};

export const extractImageEditorialStyle = (style: CSSStyleDeclaration | string) => {
  const record = getStyleRecord(style);
  return buildStyleDeclaration(
    IMAGE_STYLE_KEYS.map((property) => [
      property,
      isMeaningfulValue(record[property]) ? record[property] : "",
    ]),
  );
};

export const hasEditorialBlockStyle = (style: CSSStyleDeclaration | string) => {
  const { editorialStyle } = extractBlockEditorialStyle(style);
  return Boolean(editorialStyle);
};

export const hasEditorialImageStyle = (style: CSSStyleDeclaration | string) =>
  Boolean(extractImageEditorialStyle(style));

export const applyEditorialStyleToElement = (element: HTMLElement, style: string) => {
  if (!style) {
    element.removeAttribute("style");
    return;
  }
  element.style.cssText = style;
};

export const styleDeclarationToReactStyle = (style: string) => {
  const record = parseStyleDeclaration(style);
  return Object.entries(record).reduce<Record<string, string>>((styles, [property, value]) => {
    styles[toCamelCase(property)] = value;
    return styles;
  }, {});
};
