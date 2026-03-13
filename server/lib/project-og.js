import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "@shuding/opentype.js/dist/opentype.module.js";
import React from "react";
import { ImageResponse } from "@vercel/og";
import sharp from "sharp";

export const OG_PROJECT_WIDTH = 1200;
export const OG_PROJECT_HEIGHT = 630;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT_DIR = path.join(__dirname, "..", "..");
const PUBLIC_DIR = path.join(PROJECT_ROOT_DIR, "public");

const DEFAULT_ACCENT_HEX = "#9667e0";
const DEFAULT_BACKGROUND = "#02050b";
const EYEBROW_SEPARATOR = "\u2022";
const TRANSPARENT_PIXEL_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
export const TITLE_DIAGONAL_INSET = 64;
const TITLE_FONT_SIZE_STEP = 0.5;
const TITLE_EMERGENCY_MIN_FONT_SIZE = 28;
const TITLE_VISUAL_MIN_REFERENCE_TEXT =
  "Rekishi ni Nokoru Akujo ni Naruzo: Akuyaku Reijou ni Naru hodo Ouji no Dekiai wa Kasoku Suru you desu!";
export const PROJECT_OG_SCENE_VERSION = "project-og-v3";
const PROJECT_OG_BACKDROP_BLUR = 10;

const TITLE_FONT_WEIGHT = 700;
const EYEBROW_FONT_WEIGHT = 300;
const SUBTITLE_FONT_WEIGHT = 500;
const CHIP_FONT_WEIGHT = 200;
const TITLE_LINE_HEIGHT = 1.2;

const FONT_FILES = Object.freeze({
  200: path.join(
    PROJECT_ROOT_DIR,
    "node_modules",
    "geist",
    "dist",
    "fonts",
    "geist-sans",
    "Geist-UltraLight.ttf",
  ),
  300: path.join(
    PROJECT_ROOT_DIR,
    "node_modules",
    "geist",
    "dist",
    "fonts",
    "geist-sans",
    "Geist-Light.ttf",
  ),
  500: path.join(
    PROJECT_ROOT_DIR,
    "node_modules",
    "geist",
    "dist",
    "fonts",
    "geist-sans",
    "Geist-Medium.ttf",
  ),
  700: path.join(
    PROJECT_ROOT_DIR,
    "node_modules",
    "geist",
    "dist",
    "fonts",
    "geist-sans",
    "Geist-Bold.ttf",
  ),
});

const DEFAULT_LAYOUT = Object.freeze({
  artworkLeft: 747,
  artworkTop: -3,
  artworkWidth: 453,
  artworkHeight: 641,
  backdropLeft: 0,
  backdropTop: 0,
  backdropWidth: 803,
  backdropHeight: 630,
  eyebrowLeft: 57.57,
  eyebrowTop: 55,
  eyebrowFontSize: 28.636211395263672,
  eyebrowDotLeftInset: 7.97,
  eyebrowDotSize: 6.94,
  eyebrowDotGap: 7.81,
  titleLeft: 53,
  titleTop: 93.83402252197266,
  titleWidth: 493.2709655761719,
  titleMaxLines: 4,
  titleBaseFontSize: 72.0604476928711,
  titleMinFontSize: 46,
  subtitleLeft: 55.284423828125,
  subtitleBaseTop: 193.2034454345703,
  subtitleFontSize: 30.654399871826172,
  subtitleGap: 18,
  subtitleLimitGap: 24,
  subtitleMaxWidth: 360,
  tagsLeft: 56,
  tagsTop: 560,
  tagsMaxWidth: 564,
  tagGap: 24,
  tagHeight: 29,
  tagRadius: 15.84,
  tagFontSize: 22.17411994934082,
  tagPaddingX: 14.5,
  dividerLeft: 744,
  dividerTop: 0,
  dividerWidth: 59,
  dividerHeight: 631,
  dividerStrokeWidth: 9,
  panelPoints: "0,0 803,0 744,630 0,630",
});

const fontBufferCache = new Map();
const fontParserCache = new Map();
let projectOgFontsCache = null;
let projectOgTitleVisualMinFontSizeCache = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeFontSizeValue = (value) => Number(Number(value).toFixed(4));

const buildDescendingFontSizes = ({ maxFontSize, minFontSize, step = TITLE_FONT_SIZE_STEP }) => {
  const sizes = [];
  const push = (value) => {
    const normalized = normalizeFontSizeValue(value);
    if (!Number.isFinite(normalized)) {
      return;
    }
    if (sizes.some((entry) => Math.abs(entry - normalized) < 0.0001)) {
      return;
    }
    sizes.push(normalized);
  };

  const safeMax = Number(maxFontSize);
  const safeMin = Number(minFontSize);
  const safeStep = Number(step);
  if (!Number.isFinite(safeMax) || !Number.isFinite(safeMin) || !Number.isFinite(safeStep) || safeStep <= 0) {
    return sizes;
  }

  push(safeMax);
  for (
    let candidate = Math.floor(safeMax / safeStep) * safeStep;
    candidate >= safeMin - safeStep / 2;
    candidate -= safeStep
  ) {
    push(candidate);
  }
  return sizes.filter((value) => value >= safeMin - 0.0001);
};

const cloneLayout = () => {
  const layout = { ...DEFAULT_LAYOUT };
  layout.titleMinFontSize = resolveProjectOgTitleVisualMinFontSize(layout);
  return layout;
};

const truncateText = (value, maxLength) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const PROJECT_OG_AUTHOR_ROLE_PRIORITY = [
  "original creator",
  "autor original",
  "original story",
  "historia original",
  "story",
  "historia",
];

const normalizeProjectOgRoleKey = (value) =>
  normalizeKey(
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  );

const resolveProjectOgSubtitle = (project) => {
  const studio = String(project?.studio || "").trim();
  if (studio) {
    return studio;
  }

  const animeStaff = Array.isArray(project?.animeStaff) ? project.animeStaff : [];
  for (const roleKey of PROJECT_OG_AUTHOR_ROLE_PRIORITY) {
    const staffEntry = animeStaff.find((entry) => normalizeProjectOgRoleKey(entry?.role) === roleKey);
    if (!staffEntry) {
      continue;
    }
    const authorName = (Array.isArray(staffEntry?.members) ? staffEntry.members : [])
      .map((member) => String(member || "").trim())
      .find(Boolean);
    if (authorName) {
      return authorName;
    }
  }

  return "";
};

const normalizeHex = (value) => {
  const cleaned = String(value || "")
    .trim()
    .replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return "";
  }
  if (cleaned.length === 3) {
    return `#${cleaned
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }
  return `#${cleaned.toLowerCase()}`;
};

const hexToRgb = (value) => {
  const normalized = normalizeHex(value);
  if (!normalized) {
    return null;
  }
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
};

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

const mixRgb = (start, end, amount) => ({
  r: start.r + (end.r - start.r) * amount,
  g: start.g + (end.g - start.g) * amount,
  b: start.b + (end.b - start.b) * amount,
});

const mixHexColors = (startHex, endHex, amount) => {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  if (!start || !end) {
    return normalizeHex(startHex) || normalizeHex(endHex) || DEFAULT_BACKGROUND;
  }
  return rgbToHex(mixRgb(start, end, clamp(Number(amount), 0, 1)));
};

const rgbToHsl = ({ r, g, b }) => {
  const normalizedR = r / 255;
  const normalizedG = g / 255;
  const normalizedB = b / 255;
  const max = Math.max(normalizedR, normalizedG, normalizedB);
  const min = Math.min(normalizedR, normalizedG, normalizedB);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === normalizedR) {
      hue = ((normalizedG - normalizedB) / delta) % 6;
    } else if (max === normalizedG) {
      hue = (normalizedB - normalizedR) / delta + 2;
    } else {
      hue = (normalizedR - normalizedG) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return {
    h: Math.round(hue),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
};

const hslToRgb = ({ h, s, l }) => {
  const normalizedHue = ((Number(h) % 360) + 360) % 360;
  const normalizedSaturation = clamp(Number(s), 0, 100) / 100;
  const normalizedLightness = clamp(Number(l), 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const hueSegment = normalizedHue / 60;
  const x = chroma * (1 - Math.abs((hueSegment % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSegment >= 0 && hueSegment < 1) {
    red = chroma;
    green = x;
  } else if (hueSegment >= 1 && hueSegment < 2) {
    red = x;
    green = chroma;
  } else if (hueSegment >= 2 && hueSegment < 3) {
    green = chroma;
    blue = x;
  } else if (hueSegment >= 3 && hueSegment < 4) {
    green = x;
    blue = chroma;
  } else if (hueSegment >= 4 && hueSegment < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = normalizedLightness - chroma / 2;
  return {
    r: (red + match) * 255,
    g: (green + match) * 255,
    b: (blue + match) * 255,
  };
};

const hslToHex = (value) => rgbToHex(hslToRgb(value));

const rgba = (rgb, alpha) =>
  `rgba(${clamp(Math.round(rgb.r), 0, 255)}, ${clamp(Math.round(rgb.g), 0, 255)}, ${clamp(
    Math.round(rgb.b),
    0,
    255,
  )}, ${alpha})`;

const buildPanelGradientStops = (palette) => [
  {
    offset: "0%",
    stopColor: palette.accentDarkStart,
    stopOpacity: "0.86",
  },
  {
    offset: "12%",
    stopColor: mixHexColors(palette.accentDarkStart, palette.accentDarkEnd, 0.12),
    stopOpacity: "0.867",
  },
  {
    offset: "28%",
    stopColor: mixHexColors(palette.accentDarkStart, palette.accentDarkEnd, 0.28),
    stopOpacity: "0.874",
  },
  {
    offset: "46%",
    stopColor: mixHexColors(palette.accentDarkStart, palette.accentDarkEnd, 0.46),
    stopOpacity: "0.881",
  },
  {
    offset: "66%",
    stopColor: mixHexColors(palette.accentDarkStart, palette.accentDarkEnd, 0.66),
    stopOpacity: "0.888",
  },
  {
    offset: "84%",
    stopColor: mixHexColors(palette.accentDarkStart, palette.accentDarkEnd, 0.84),
    stopOpacity: "0.894",
  },
  {
    offset: "100%",
    stopColor: palette.accentDarkEnd,
    stopOpacity: "0.90",
  },
];

const toTranslationMap = (record) => {
  const map = new Map();
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return map;
  }
  Object.entries(record).forEach(([key, value]) => {
    const normalized = normalizeKey(key);
    if (!normalized) {
      return;
    }
    map.set(normalized, String(value || "").trim());
  });
  return map;
};

const translateValue = (value, map) => {
  const normalized = normalizeKey(value);
  if (!normalized) {
    return "";
  }
  const translated = map.get(normalized);
  return translated && translated.trim() ? translated : String(value || "").trim();
};

const pickProjectImageCandidate = (project, candidates, resolveVariantUrl, origin) => {
  const safeCandidates = Array.isArray(candidates) ? candidates : [];

  for (const candidate of safeCandidates) {
    if (!candidate.url) {
      continue;
    }
    const resolvedUrl =
      typeof resolveVariantUrl === "function"
        ? String(resolveVariantUrl(candidate.url, candidate.preset) || "").trim()
        : candidate.url;
    const finalUrl = resolvedUrl || candidate.url;
    if (!finalUrl) {
      continue;
    }
    if (finalUrl.startsWith("/") && !finalUrl.startsWith("/uploads/") && origin) {
      return {
        artworkSource: candidate.source,
        artworkUrl: `${String(origin).replace(/\/+$/, "")}${finalUrl}`,
      };
    }
    return {
      artworkSource: candidate.source,
      artworkUrl: finalUrl,
    };
  }

  return {
    artworkSource: "none",
    artworkUrl: "",
  };
};

const pickArtworkCandidate = (project, resolveVariantUrl, origin) =>
  pickProjectImageCandidate(
    project,
    [
      { source: "cover", url: String(project?.cover || "").trim(), preset: "poster" },
      { source: "heroImageUrl", url: String(project?.heroImageUrl || "").trim(), preset: "hero" },
      { source: "banner", url: String(project?.banner || "").trim(), preset: "hero" },
    ],
    resolveVariantUrl,
    origin,
  );

const pickBackdropCandidate = (project, resolveVariantUrl, origin) =>
  pickProjectImageCandidate(
    project,
    [
      { source: "banner", url: String(project?.banner || "").trim(), preset: "hero" },
      { source: "heroImageUrl", url: String(project?.heroImageUrl || "").trim(), preset: "hero" },
      { source: "cover", url: String(project?.cover || "").trim(), preset: "poster" },
    ],
    resolveVariantUrl,
    origin,
  );

const getFontBufferByWeight = (weight) => {
  const normalizedWeight = Number(weight);
  if (fontBufferCache.has(normalizedWeight)) {
    return fontBufferCache.get(normalizedWeight) || null;
  }
  const filePath = FONT_FILES[normalizedWeight];
  let buffer = null;
  try {
    if (filePath && fs.existsSync(filePath)) {
      buffer = fs.readFileSync(filePath);
    }
  } catch {
    buffer = null;
  }
  fontBufferCache.set(normalizedWeight, buffer);
  return buffer;
};

const getFontParserByWeight = (weight) => {
  const normalizedWeight = Number(weight);
  if (fontParserCache.has(normalizedWeight)) {
    return fontParserCache.get(normalizedWeight) || null;
  }
  const buffer = getFontBufferByWeight(normalizedWeight);
  if (!buffer) {
    fontParserCache.set(normalizedWeight, null);
    return null;
  }
  try {
    const parsed = opentype.parse(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    );
    fontParserCache.set(normalizedWeight, parsed);
    return parsed;
  } catch {
    fontParserCache.set(normalizedWeight, null);
    return null;
  }
};

export const measureTextWidth = ({ text, fontSize, fontWeight }) => {
  const normalizedText = String(text || "");
  if (!normalizedText) {
    return 0;
  }
  const font = getFontParserByWeight(fontWeight);
  if (!font?.getAdvanceWidth) {
    return normalizedText.length * fontSize * 0.56;
  }
  try {
    return font.getAdvanceWidth(normalizedText, fontSize);
  } catch {
    return normalizedText.length * fontSize * 0.56;
  }
};

const countWords = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const measureEllipsizedLine = (text, maxWidth, fontSize, fontWeight) => {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return "";
  }
  if (measureTextWidth({ text: normalized, fontSize, fontWeight }) <= maxWidth) {
    return normalized;
  }

  const words = normalized.split(/\s+/);
  while (words.length > 0) {
    const candidate = `${words.join(" ")}...`;
    if (measureTextWidth({ text: candidate, fontSize, fontWeight }) <= maxWidth) {
      return candidate;
    }
    words.pop();
  }

  let fallback = normalized;
  while (fallback.length > 1) {
    const candidate = `${fallback.slice(0, -1).trimEnd()}...`;
    if (measureTextWidth({ text: candidate, fontSize, fontWeight }) <= maxWidth) {
      return candidate;
    }
    fallback = fallback.slice(0, -1);
  }
  return "...";
};

const wrapTextLines = ({ text, maxWidth, fontSize, fontWeight, maxLines }) => {
  const normalizedText = String(text || "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!normalizedText) {
    return [""];
  }

  const paragraphs = normalizedText.split("\n");
  const lines = [];

  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      return;
    }

    let currentLine = "";
    words.forEach((word) => {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      const nextWidth = measureTextWidth({
        text: nextLine,
        fontSize,
        fontWeight,
      });

      if (!currentLine || nextWidth <= maxWidth) {
        currentLine = nextLine;
        return;
      }

      lines.push(currentLine);
      currentLine = word;
    });

    if (currentLine) {
      lines.push(currentLine);
    }
  });

  const safeMaxLines = Math.max(1, Math.floor(Number(maxLines) || 1));
  if (lines.length <= safeMaxLines) {
    return lines;
  }

  const trimmed = lines.slice(0, safeMaxLines);
  const overflowRemainder = lines.slice(safeMaxLines - 1).join(" ");
  trimmed[safeMaxLines - 1] = measureEllipsizedLine(
    overflowRemainder,
    maxWidth,
    fontSize,
    fontWeight,
  );
  return trimmed;
};

const getPanelDiagonalSegment = (layout = DEFAULT_LAYOUT) => {
  const points = parsePolygonPoints(layout.panelPoints);
  if (points.length >= 3) {
    return {
      start: points[1],
      end: points[2],
    };
  }

  return {
    start: {
      x: Number(layout.backdropWidth) || 803,
      y: 0,
    },
    end: {
      x: Number(layout.dividerLeft) || Number(layout.backdropWidth) || 803,
      y: Number(layout.backdropHeight) || OG_PROJECT_HEIGHT,
    },
  };
};

export const getDiagonalXAtY = ({ layout = DEFAULT_LAYOUT, y }) => {
  const segment = getPanelDiagonalSegment(layout);
  const startY = Number(segment?.start?.y);
  const endY = Number(segment?.end?.y);
  const startX = Number(segment?.start?.x);
  const endX = Number(segment?.end?.x);

  if (
    !Number.isFinite(startX) ||
    !Number.isFinite(endX) ||
    !Number.isFinite(startY) ||
    !Number.isFinite(endY) ||
    startY === endY
  ) {
    return Number(layout.dividerLeft) || Number(layout.backdropWidth) || OG_PROJECT_WIDTH;
  }

  const progress = (Number(y) - startY) / (endY - startY);
  return startX + (endX - startX) * progress;
};

const getTitleLineMaxWidth = ({ layout = DEFAULT_LAYOUT, fontSize, lineIndex }) => {
  const safeLineIndex = Math.max(0, Math.floor(Number(lineIndex) || 0));
  const lineHeightPx = Number(fontSize) * TITLE_LINE_HEIGHT;
  const centerY = Number(layout.titleTop) + safeLineIndex * lineHeightPx + lineHeightPx / 2;
  const diagonalX = getDiagonalXAtY({ layout, y: centerY });
  const rawWidth = diagonalX - Number(layout.titleLeft) - TITLE_DIAGONAL_INSET;
  return clamp(rawWidth, Number(layout.titleWidth) || 0, OG_PROJECT_WIDTH - Number(layout.titleLeft));
};

const getTagRowMaxWidth = ({ layout = DEFAULT_LAYOUT, rowIndex }) => {
  void rowIndex;
  const rowTop = Number(layout.tagsTop);
  const centerY = rowTop + Number(layout.tagHeight) / 2;
  const diagonalX = getDiagonalXAtY({ layout, y: centerY });
  const rawWidth = diagonalX - Number(layout.tagsLeft) - TITLE_DIAGONAL_INSET;
  return clamp(rawWidth, Number(layout.tagsMaxWidth) || 0, OG_PROJECT_WIDTH - Number(layout.tagsLeft));
};

const buildTitleLineLayouts = ({ lines, layout = DEFAULT_LAYOUT, fontSize }) =>
  (Array.isArray(lines) ? lines : []).map((text, index) => ({
    text: String(text || ""),
    maxWidth: getTitleLineMaxWidth({
      layout,
      fontSize,
      lineIndex: index,
    }),
  }));

const buildTitleCandidate = ({
  text,
  layout = DEFAULT_LAYOUT,
  fontSize,
  lines,
  truncated,
  subtitleHeightOverride,
}) => {
  const titleHeight = lines.length * fontSize * TITLE_LINE_HEIGHT;
  const lineLayouts = buildTitleLineLayouts({
    lines,
    layout,
    fontSize,
  });
  const renderWidth = Math.max(
    Number(layout.titleWidth) || 0,
    ...lineLayouts.map((entry) => Number(entry.maxWidth) || 0),
  );
  const subtitleTop =
    lines.length <= 1 ? layout.subtitleBaseTop : layout.titleTop + titleHeight + layout.subtitleGap;
  const subtitleHeight =
    Number.isFinite(Number(subtitleHeightOverride)) && Number(subtitleHeightOverride) > 0
      ? Number(subtitleHeightOverride)
      : layout.subtitleFontSize * 1.2;
  const subtitleBottom = subtitleTop + subtitleHeight;
  const subtitleBottomLimit = layout.tagsTop - layout.subtitleLimitGap;
  return {
    text,
    lines,
    lineLayouts,
    renderWidth,
    fontSize,
    lineHeight: TITLE_LINE_HEIGHT,
    height: titleHeight,
    lineCount: lines.length,
    singleWordLineCount: lines.filter((line) => countWords(line) <= 1).length,
    truncated,
    subtitleTop,
    subtitleBottom,
    subtitleBottomLimit,
    fitsWithinSubtitleLimit: subtitleBottom <= subtitleBottomLimit,
  };
};

const buildUnlimitedTitleLines = ({ text, layout = DEFAULT_LAYOUT, fontSize }) =>
  wrapTextLinesByLineWidths({
    text,
    getLineMaxWidth: (lineIndex) =>
      getTitleLineMaxWidth({
        layout,
        fontSize,
        lineIndex,
      }),
    fontSize,
    fontWeight: TITLE_FONT_WEIGHT,
    maxLines: 999,
  });

const resolveTechnicalTitleMaxLines = ({
  layout = DEFAULT_LAYOUT,
  fontSize,
  subtitleHeightOverride,
}) => {
  const subtitleHeight =
    Number.isFinite(Number(subtitleHeightOverride)) && Number(subtitleHeightOverride) > 0
      ? Number(subtitleHeightOverride)
      : Number(layout.subtitleFontSize) * 1.2;
  const availableHeight =
    Number(layout.tagsTop) -
    Number(layout.subtitleLimitGap) -
    Number(layout.titleTop) -
    Number(layout.subtitleGap) -
    subtitleHeight;
  const lineHeightPx = Number(fontSize) * TITLE_LINE_HEIGHT;
  if (!Number.isFinite(availableHeight) || !Number.isFinite(lineHeightPx) || lineHeightPx <= 0) {
    return Math.max(1, Math.floor(Number(layout.titleMaxLines) || 1));
  }
  return Math.max(1, Math.floor(availableHeight / lineHeightPx));
};

const resolveProjectOgTitleVisualMinFontSize = (layout = DEFAULT_LAYOUT) => {
  if (projectOgTitleVisualMinFontSizeCache !== null) {
    return projectOgTitleVisualMinFontSizeCache;
  }

  const fontSizes = buildDescendingFontSizes({
    maxFontSize: Number(layout.titleBaseFontSize),
    minFontSize: TITLE_EMERGENCY_MIN_FONT_SIZE,
  });
  for (const fontSize of fontSizes) {
    const lines = buildUnlimitedTitleLines({
      text: TITLE_VISUAL_MIN_REFERENCE_TEXT,
      layout,
      fontSize,
    });
    const candidate = buildTitleCandidate({
      text: TITLE_VISUAL_MIN_REFERENCE_TEXT,
      layout,
      fontSize,
      lines,
      truncated: false,
    });
    if (candidate.fitsWithinSubtitleLimit) {
      projectOgTitleVisualMinFontSizeCache = fontSize;
      return fontSize;
    }
  }

  projectOgTitleVisualMinFontSizeCache = Number(DEFAULT_LAYOUT.titleMinFontSize);
  return projectOgTitleVisualMinFontSizeCache;
};

const wrapTextLinesByLineWidths = ({
  text,
  getLineMaxWidth,
  fontSize,
  fontWeight,
  maxLines,
}) => {
  const normalizedText = String(text || "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!normalizedText) {
    return [""];
  }

  const resolveMaxWidth = (lineIndex) => {
    const value = Number(getLineMaxWidth(lineIndex));
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const paragraphs = normalizedText.split("\n");
  const lines = [];

  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      return;
    }

    let currentLine = "";
    words.forEach((word) => {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      const nextWidth = measureTextWidth({
        text: nextLine,
        fontSize,
        fontWeight,
      });
      const lineMaxWidth = resolveMaxWidth(lines.length);

      if (!currentLine || nextWidth <= lineMaxWidth) {
        currentLine = nextLine;
        return;
      }

      lines.push(currentLine);
      currentLine = word;
    });

    if (currentLine) {
      lines.push(currentLine);
    }
  });

  const safeMaxLines = Math.max(1, Math.floor(Number(maxLines) || 1));
  if (lines.length <= safeMaxLines) {
    return lines;
  }

  const trimmed = lines.slice(0, safeMaxLines);
  const overflowRemainder = lines.slice(safeMaxLines - 1).join(" ");
  trimmed[safeMaxLines - 1] = measureEllipsizedLine(
    overflowRemainder,
    resolveMaxWidth(safeMaxLines - 1),
    fontSize,
    fontWeight,
  );
  return trimmed;
};

const buildTitleLayout = (title, layout = DEFAULT_LAYOUT, { subtitleHeightOverride } = {}) => {
  const normalizedTitle = String(title || "").trim() || "Projeto";
  const visualMinFontSize = Number(layout.titleMinFontSize) || resolveProjectOgTitleVisualMinFontSize(layout);
  const regularFontSizes = buildDescendingFontSizes({
    maxFontSize: Number(layout.titleBaseFontSize),
    minFontSize: visualMinFontSize,
  });
  const emergencyFontSizes =
    visualMinFontSize - TITLE_FONT_SIZE_STEP >= TITLE_EMERGENCY_MIN_FONT_SIZE
      ? buildDescendingFontSizes({
          maxFontSize: visualMinFontSize - TITLE_FONT_SIZE_STEP,
          minFontSize: TITLE_EMERGENCY_MIN_FONT_SIZE,
        })
      : [];

  const fullFontSizes = [...regularFontSizes, ...emergencyFontSizes];
  for (const fontSize of fullFontSizes) {
    const fullLines = buildUnlimitedTitleLines({
      text: normalizedTitle,
      layout,
      fontSize,
    });
    const completeCandidate = buildTitleCandidate({
      text: normalizedTitle,
      layout,
      fontSize,
      lines: fullLines,
      truncated: false,
      subtitleHeightOverride,
    });
    if (completeCandidate.fitsWithinSubtitleLimit) {
      return {
        text: completeCandidate.text,
        lines: completeCandidate.lines,
        lineLayouts: completeCandidate.lineLayouts,
        renderWidth: completeCandidate.renderWidth,
        fontSize: completeCandidate.fontSize,
        lineHeight: completeCandidate.lineHeight,
        height: completeCandidate.height,
        subtitleTop: completeCandidate.subtitleTop,
        subtitleBottom: completeCandidate.subtitleBottom,
        subtitleBottomLimit: completeCandidate.subtitleBottomLimit,
        truncated: false,
      };
    }
  }

  const technicalFallbackFontSize = Math.min(
    visualMinFontSize,
    emergencyFontSizes[emergencyFontSizes.length - 1] || TITLE_EMERGENCY_MIN_FONT_SIZE,
  );
  const technicalMaxLines = resolveTechnicalTitleMaxLines({
    layout,
    fontSize: technicalFallbackFontSize,
    subtitleHeightOverride,
  });
  const technicalFallbackLines = wrapTextLinesByLineWidths({
    text: normalizedTitle,
    getLineMaxWidth: (lineIndex) =>
      getTitleLineMaxWidth({
        layout,
        fontSize: technicalFallbackFontSize,
        lineIndex,
      }),
    fontSize: technicalFallbackFontSize,
    fontWeight: TITLE_FONT_WEIGHT,
    maxLines: technicalMaxLines,
  });
  const resolvedCandidate = buildTitleCandidate({
    text: normalizedTitle,
    layout,
    fontSize: technicalFallbackFontSize,
    lines: technicalFallbackLines,
    truncated: true,
    subtitleHeightOverride,
  });
  return {
    text: resolvedCandidate.text,
    lines: resolvedCandidate.lines,
    lineLayouts: resolvedCandidate.lineLayouts,
    renderWidth: resolvedCandidate.renderWidth,
    fontSize: resolvedCandidate.fontSize,
    lineHeight: resolvedCandidate.lineHeight,
    height: resolvedCandidate.height,
    subtitleTop: resolvedCandidate.subtitleTop,
    subtitleBottom: resolvedCandidate.subtitleBottom,
    subtitleBottomLimit: resolvedCandidate.subtitleBottomLimit,
    truncated: resolvedCandidate.truncated,
  };
};

const measureEllipsizedChipLine = (
  text,
  maxWidth,
  fontSize,
  fontWeight,
  { allowCharacterFallback = false } = {},
) => {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return "";
  }
  if (measureTextWidth({ text: normalized, fontSize, fontWeight }) <= maxWidth) {
    return normalized;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    for (let wordCount = words.length - 1; wordCount >= 1; wordCount -= 1) {
      const candidate = `${words.slice(0, wordCount).join(" ")}...`;
      if (measureTextWidth({ text: candidate, fontSize, fontWeight }) <= maxWidth) {
        return candidate;
      }
    }
  }

  if (!allowCharacterFallback) {
    return "";
  }

  let fallback = normalized;
  while (fallback.length > 1) {
    const candidate = `${fallback.slice(0, -1).trimEnd()}...`;
    if (measureTextWidth({ text: candidate, fontSize, fontWeight }) <= maxWidth) {
      return candidate;
    }
    fallback = fallback.slice(0, -1);
  }

  return measureTextWidth({ text: "...", fontSize, fontWeight }) <= maxWidth ? "..." : "";
};

const buildChipTextLayout = (chip, maxTextWidth, layout, options = {}) => {
  const normalizedChip = String(chip || "").trim();
  const fallbackWidth = Math.max(
    measureTextWidth({
      text: "...",
      fontSize: layout.tagFontSize,
      fontWeight: CHIP_FONT_WEIGHT,
    }),
    12,
  );
  const safeMaxTextWidth = Math.max(maxTextWidth, fallbackWidth);
  const text = measureEllipsizedChipLine(
    normalizedChip,
    safeMaxTextWidth,
    layout.tagFontSize,
    CHIP_FONT_WEIGHT,
    options,
  );
  if (!text || text === "...") {
    return {
      text: "",
      textWidth: 0,
      width: 0,
      truncated: false,
      usable: false,
    };
  }
  const textWidth = measureTextWidth({
    text,
    fontSize: layout.tagFontSize,
    fontWeight: CHIP_FONT_WEIGHT,
  });
  return {
    text,
    textWidth,
    width: textWidth + layout.tagPaddingX * 2,
    truncated: text !== normalizedChip,
    usable: true,
  };
};

const buildChipLayouts = (chips, layout = DEFAULT_LAYOUT) => {
  const safeChips = Array.isArray(chips) ? chips.filter(Boolean) : [];
  if (safeChips.length === 0) {
    return [];
  }
  const minTextWidth = measureTextWidth({
    text: "...",
    fontSize: layout.tagFontSize,
    fontWeight: CHIP_FONT_WEIGHT,
  });
  const minChipWidth = minTextWidth + layout.tagPaddingX * 2;
  const rowMaxWidth = getTagRowMaxWidth({ layout, rowIndex: 0 });
  const chipLayouts = [];
  const deferredCandidates = [];
  let usedWidth = 0;

  safeChips.forEach((chip, sourceIndex) => {
    const chipText = String(chip || "").trim();
    if (!chipText) {
      return;
    }

    const naturalTextWidth = measureTextWidth({
      text: chipText,
      fontSize: layout.tagFontSize,
      fontWeight: CHIP_FONT_WEIGHT,
    });
    const naturalWidth = naturalTextWidth + layout.tagPaddingX * 2;
    const gapBefore = usedWidth > 0 ? layout.tagGap : 0;
    const remainingWidth = rowMaxWidth - usedWidth - gapBefore;
    if (naturalWidth <= remainingWidth) {
      chipLayouts.push({
        text: chipText,
        width: naturalWidth,
        row: 0,
        x: usedWidth + gapBefore,
        y: 0,
        maxWidth: rowMaxWidth,
        truncated: false,
        sourceIndex,
        fallbackDeferred: false,
      });
      usedWidth += gapBefore + naturalWidth;
      return;
    }
    deferredCandidates.push({
      text: chipText,
      sourceIndex,
    });
  });

  const gapBefore = usedWidth > 0 ? layout.tagGap : 0;
  const remainingWidth = rowMaxWidth - usedWidth - gapBefore;
  if (remainingWidth < minChipWidth) {
    return chipLayouts;
  }

  for (const candidate of deferredCandidates) {
    const chipLayout = buildChipTextLayout(
      candidate.text,
      Math.max(remainingWidth - layout.tagPaddingX * 2, minTextWidth),
      layout,
      { allowCharacterFallback: false },
    );
    if (!chipLayout.usable || !chipLayout.truncated) {
      continue;
    }
    chipLayouts.push({
      text: chipLayout.text,
      width: Math.min(chipLayout.width, remainingWidth),
      row: 0,
      x: usedWidth + gapBefore,
      y: 0,
      maxWidth: rowMaxWidth,
      truncated: true,
      sourceIndex: candidate.sourceIndex,
      fallbackDeferred: true,
    });
    break;
  }

  return chipLayouts;
};

const guessMimeType = (value) => {
  const lower = String(value || "").toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  if (lower.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (lower.endsWith(".avif")) {
    return "image/avif";
  }
  return "application/octet-stream";
};

const bufferToDataUrl = (buffer, mimeType) =>
  `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;

const parseDataUrlAsset = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("data:")) {
    return null;
  }
  const separatorIndex = normalized.indexOf(",");
  if (separatorIndex <= 5) {
    return null;
  }
  const header = normalized.slice(5, separatorIndex);
  const body = normalized.slice(separatorIndex + 1);
  const mimeType = header.split(";")[0] || "application/octet-stream";
  const isBase64 = /(?:^|;)base64(?:;|$)/i.test(header);

  try {
    return {
      buffer: isBase64 ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body), "utf8"),
      mimeType,
    };
  } catch {
    return null;
  }
};

const loadLocalArtworkAsset = (artworkUrl) => {
  const normalized = String(artworkUrl || "").trim();
  if (!normalized.startsWith("/")) {
    return null;
  }

  const filePath = path.join(PUBLIC_DIR, normalized.replace(/^\/+/, "").replace(/\//g, path.sep));
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return null;
    }
    return {
      buffer: fs.readFileSync(filePath),
      mimeType: guessMimeType(filePath),
    };
  } catch {
    return null;
  }
};

const loadRemoteArtworkAsset = async (artworkUrl) => {
  const normalized = String(artworkUrl || "").trim();
  if (!normalized) {
    return null;
  }
  try {
    const response = await fetch(normalized);
    if (!response.ok) {
      return null;
    }
    const mimeType = String(response.headers.get("content-type") || guessMimeType(normalized))
      .split(";")[0]
      .trim();
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: mimeType || guessMimeType(normalized),
    };
  } catch {
    return null;
  }
};

const loadProjectOgArtworkAsset = async ({ artworkUrl, artworkDataUrl, origin } = {}) => {
  const inlineAsset = parseDataUrlAsset(artworkDataUrl);
  if (inlineAsset?.buffer) {
    return inlineAsset;
  }

  const normalized = String(artworkUrl || "").trim();
  if (!normalized) {
    return null;
  }

  const embeddedUrlAsset = parseDataUrlAsset(normalized);
  if (embeddedUrlAsset?.buffer) {
    return embeddedUrlAsset;
  }

  const localAsset = loadLocalArtworkAsset(normalized);
  if (localAsset?.buffer) {
    return localAsset;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return loadRemoteArtworkAsset(normalized);
  }

  if (normalized.startsWith("/") && origin) {
    return loadRemoteArtworkAsset(`${String(origin).replace(/\/+$/, "")}${normalized}`);
  }

  return null;
};

const toRoundedPositiveNumber = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return Math.round(numeric);
};

const parsePolygonPoints = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",");
      const parsedX = Number(x);
      const parsedY = Number(y);
      if (!Number.isFinite(parsedX) || !Number.isFinite(parsedY)) {
        return null;
      }
      return {
        x: Math.round(parsedX),
        y: Math.round(parsedY),
      };
    })
    .filter(Boolean);

const buildBackdropMaskPoints = (layout = DEFAULT_LAYOUT) => {
  const points = parsePolygonPoints(layout.panelPoints);
  if (points.length > 0) {
    return points.map((point) => `${point.x},${point.y}`).join(" ");
  }

  const backdropWidth = toRoundedPositiveNumber(layout.backdropWidth, 803);
  const backdropHeight = toRoundedPositiveNumber(layout.backdropHeight, OG_PROJECT_HEIGHT);
  const dividerLeft = toRoundedPositiveNumber(layout.dividerLeft, backdropWidth);
  return `0,0 ${backdropWidth},0 ${dividerLeft},${backdropHeight} 0,${backdropHeight}`;
};

const buildBackdropMaskSvg = (layout = DEFAULT_LAYOUT) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_PROJECT_WIDTH}" height="${OG_PROJECT_HEIGHT}" viewBox="0 0 ${OG_PROJECT_WIDTH} ${OG_PROJECT_HEIGHT}"><polygon fill="#ffffff" points="${buildBackdropMaskPoints(layout)}"/></svg>`,
    "utf8",
  );

const buildProcessedBackdropBuffer = async ({ buffer, layout = DEFAULT_LAYOUT } = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return Buffer.alloc(0);
  }

  const backdropLeft = Math.round(Number(layout.backdropLeft) || 0);
  const backdropTop = Math.round(Number(layout.backdropTop) || 0);
  const backdropWidth = toRoundedPositiveNumber(layout.backdropWidth, 803);
  const backdropHeight = toRoundedPositiveNumber(layout.backdropHeight, OG_PROJECT_HEIGHT);
  const overscan = Math.max(
    toRoundedPositiveNumber(layout.dividerWidth, 0),
    Math.round(PROJECT_OG_BACKDROP_BLUR * 2),
  );
  const maskedBackdrop = await sharp(buffer)
    .resize({
      width: backdropWidth + overscan,
      height: backdropHeight,
      fit: "cover",
      position: "centre",
    })
    .ensureAlpha()
    .blur(PROJECT_OG_BACKDROP_BLUR)
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: OG_PROJECT_WIDTH,
      height: OG_PROJECT_HEIGHT,
      channels: 4,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    },
  })
    .composite([
      {
        input: maskedBackdrop,
        left: backdropLeft,
        top: backdropTop,
      },
      {
        input: buildBackdropMaskSvg(layout),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
};

const resolveRenderableImageSrc = ({ dataUrl, url }) => {
  const normalizedDataUrl = String(dataUrl || "").trim();
  if (normalizedDataUrl) {
    return normalizedDataUrl;
  }

  const normalizedUrl = String(url || "").trim();
  if (/^https?:\/\//i.test(normalizedUrl) || normalizedUrl.startsWith("data:")) {
    return normalizedUrl;
  }
  return "";
};

const createElement = React.createElement;

const buildTitleNode = (model) =>
  createElement(
    "div",
    {
      style: {
        position: "absolute",
        left: model.layout.titleLeft,
        top: model.layout.titleTop,
        width: model.titleRenderWidth,
        display: "flex",
        flexDirection: "column",
        color: "#ffffff",
        fontFamily: "Geist",
        fontSize: model.titleFontSize,
        fontWeight: TITLE_FONT_WEIGHT,
        lineHeight: model.titleLineHeight,
        letterSpacing: 0,
      },
    },
    ...(
      Array.isArray(model.titleLineLayouts) && model.titleLineLayouts.length > 0
        ? model.titleLineLayouts
        : (Array.isArray(model.titleLines) ? model.titleLines : [String(model.title || "Projeto")]).map(
            (line) => ({
              text: line,
              maxWidth: model.layout.titleWidth,
            }),
          )
    ).map(
      (line, index) =>
        createElement(
          "div",
          {
            key: `title-line-${index}`,
            style: {
              display: "flex",
              width: line.maxWidth,
              maxWidth: line.maxWidth,
              whiteSpace: "nowrap",
            },
          },
          line.text,
        ),
    ),
  );

const buildEyebrowNode = (model) => {
  const parts = Array.isArray(model.eyebrowParts)
    ? model.eyebrowParts.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  if (parts.length === 0) {
    return null;
  }

  const layout = model.layout;
  const firstWidth = measureTextWidth({
    text: parts[0],
    fontSize: layout.eyebrowFontSize,
    fontWeight: EYEBROW_FONT_WEIGHT,
  });
  const showSeparator = parts.length > 1;

  return createElement(
    "div",
    {
      style: {
        position: "absolute",
        left: layout.eyebrowLeft,
        top: layout.eyebrowTop,
        display: "flex",
        alignItems: "center",
        color: "#8d8d8d",
        fontFamily: "Geist",
        fontSize: layout.eyebrowFontSize,
        fontWeight: EYEBROW_FONT_WEIGHT,
        lineHeight: 1.2,
      },
    },
    createElement(
      "div",
      {
        style: {
          display: "flex",
        },
      },
      parts[0],
    ),
    showSeparator
      ? createElement("div", {
          style: {
            width: layout.eyebrowDotSize,
            height: layout.eyebrowDotSize,
            borderRadius: layout.eyebrowDotSize / 2,
            backgroundColor: "#8d8d8d",
            marginLeft: Math.max(layout.eyebrowDotLeftInset, 0),
            marginRight: Math.max(layout.eyebrowDotGap, 0),
            marginTop: 1,
          },
        })
      : null,
    showSeparator
      ? createElement(
          "div",
          {
            style: {
              display: "flex",
            },
          },
          parts[1],
        )
      : null,
  );
};

const buildSubtitleNode = (model) => {
  const subtitleLineLayouts =
    Array.isArray(model.subtitleLineLayouts) && model.subtitleLineLayouts.length > 0
      ? model.subtitleLineLayouts
      : null;
  if (subtitleLineLayouts) {
    const lineHeightPx =
      (Number(model.layout?.subtitleFontSize) || 0) * 1.2;
    const subtitleHeight =
      Number(model.subtitleHeight) || subtitleLineLayouts.length * lineHeightPx;
    const subtitleRenderWidth = Math.max(
      0,
      ...subtitleLineLayouts.map((line) => Number(line.maxWidth) || 0),
    );

    return createElement(
      "div",
      {
        style: {
          position: "absolute",
          left: model.layout.subtitleLeft,
          top: model.subtitleTop,
          width: subtitleRenderWidth,
          height: subtitleHeight,
          display: "flex",
          flexDirection: "column",
          color: model.palette.accentPrimary,
          fontFamily: "Geist",
          fontSize: model.layout.subtitleFontSize,
          fontWeight: SUBTITLE_FONT_WEIGHT,
          lineHeight: 1.2,
        },
      },
      ...subtitleLineLayouts.map((line, index) =>
        createElement(
          "div",
          {
            key: `subtitle-line-${index}`,
            style: {
              width: Number(line.maxWidth) || subtitleRenderWidth,
              maxWidth: Number(line.maxWidth) || subtitleRenderWidth,
              height: lineHeightPx,
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
            },
          },
          String(line.text || ""),
        ),
      ),
    );
  }

  const subtitle = String(model.subtitle || "").trim();
  if (!subtitle) {
    return null;
  }
  const shouldNoWrap = Boolean(model.subtitleNoWrap);
  const subtitleWidth = Number(model.layout?.subtitleMaxWidth) || 0;
  return createElement(
    "div",
    {
      style: {
        position: "absolute",
        left: model.layout.subtitleLeft,
        top: model.subtitleTop,
        maxWidth: model.layout.subtitleMaxWidth,
        ...(shouldNoWrap && subtitleWidth > 0
          ? {
              width: subtitleWidth,
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }
          : {
              display: "flex",
            }),
        color: model.palette.accentPrimary,
        fontFamily: "Geist",
        fontSize: model.layout.subtitleFontSize,
        fontWeight: SUBTITLE_FONT_WEIGHT,
        lineHeight: 1.2,
      },
    },
    subtitle,
  );
};

const buildTagsNode = (model) => {
  const chipLayouts =
    Array.isArray(model.chipLayouts) && model.chipLayouts.length > 0
      ? model.chipLayouts
      : buildChipLayouts(model.chips, model.layout);
  if (chipLayouts.length === 0) {
    return null;
  }

  return createElement(
    "div",
    {
      style: {
        position: "absolute",
        left: model.layout.tagsLeft,
        top: model.layout.tagsTop,
        display: "flex",
        width: Math.max(0, ...chipLayouts.map((chip) => Number(chip.x) + Number(chip.width))),
        height: model.layout.tagHeight,
      },
    },
    ...chipLayouts.map((chip, index) =>
      createElement(
        "div",
        {
          key: `chip-${normalizeKey(chip.text)}-${index}`,
          style: {
            position: "absolute",
            left: chip.x,
            top: chip.y,
            width: chip.width,
            maxWidth: chip.width,
            height: model.layout.tagHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(141, 141, 141, 0.09)",
            borderRadius: model.layout.tagRadius,
            paddingLeft: model.layout.tagPaddingX,
            paddingRight: model.layout.tagPaddingX,
            color: "#9b9b9b",
            fontFamily: "Geist",
            fontSize: model.layout.tagFontSize,
            fontWeight: CHIP_FONT_WEIGHT,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
          },
        },
        chip.text,
      ),
    ),
  );
};

const buildBackdropNode = (model, backdropSrc) => {
  if (!backdropSrc) {
    return null;
  }
  const processed = String(model.backdropDataUrl || "").trim().length > 0;
  return createElement("img", {
    src: backdropSrc,
    alt: "",
    "data-og-part": "backdrop",
    "data-og-processed": processed ? "true" : "false",
    width: processed ? OG_PROJECT_WIDTH : model.layout.backdropWidth,
    height: processed ? OG_PROJECT_HEIGHT : model.layout.backdropHeight,
    style: {
      position: "absolute",
      left: processed ? 0 : model.layout.backdropLeft,
      top: processed ? 0 : model.layout.backdropTop,
      width: processed ? OG_PROJECT_WIDTH : model.layout.backdropWidth,
      height: processed ? OG_PROJECT_HEIGHT : model.layout.backdropHeight,
      objectFit: processed ? "fill" : "cover",
    },
  });
};

const buildArtworkFallbackNode = (model) =>
  createElement("div", {
    "data-og-part": "artwork-fallback",
    style: {
      position: "absolute",
      left: model.layout.artworkLeft,
      top: model.layout.artworkTop,
      width: model.layout.artworkWidth,
      height: model.layout.artworkHeight,
      backgroundColor: model.palette.bgBase,
      background: `linear-gradient(180deg, ${model.palette.accentDarkStart} 0%, ${model.palette.accentDarkEnd} 100%)`,
    },
  });

const buildBackgroundSvgNode = (model) => {
  const panelGradientStops = buildPanelGradientStops(model.palette);
  return createElement(
    "svg",
    {
      width: OG_PROJECT_WIDTH,
      height: OG_PROJECT_HEIGHT,
      viewBox: `0 0 ${OG_PROJECT_WIDTH} ${OG_PROJECT_HEIGHT}`,
      style: {
        position: "absolute",
        inset: 0,
      },
    },
    createElement(
      "defs",
      null,
      createElement(
        "linearGradient",
        {
          id: "project-panel-gradient",
          x1: "0%",
          y1: "0%",
          x2: "100%",
          y2: "100%",
        },
        ...panelGradientStops.map((stop) => createElement("stop", stop)),
      ),
      createElement(
        "filter",
        {
          id: "project-panel-glow-blur",
          x: "-40%",
          y: "-40%",
          width: "180%",
          height: "180%",
        },
        createElement("feGaussianBlur", {
          stdDeviation: "90",
        }),
      ),
      createElement(
        "clipPath",
        {
          id: "project-panel-clip",
        },
        createElement("polygon", {
          points: model.layout.panelPoints,
        }),
      ),
    ),
    createElement("polygon", {
      points: model.layout.panelPoints,
      fill: "url(#project-panel-gradient)",
    }),
    createElement(
      "g",
      {
        clipPath: "url(#project-panel-clip)",
      },
      createElement("ellipse", {
        cx: "480",
        cy: "210",
        rx: "360",
        ry: "240",
        fill: model.palette.accentGlow,
        filter: "url(#project-panel-glow-blur)",
        opacity: "0.28",
      }),
      createElement("ellipse", {
        cx: "685",
        cy: "580",
        rx: "190",
        ry: "150",
        fill: model.palette.accentGlow,
        filter: "url(#project-panel-glow-blur)",
        opacity: "0.14",
      }),
    ),
    createElement("line", {
      x1: String(model.layout.dividerLeft),
      y1: String(model.layout.dividerHeight),
      x2: String(model.layout.dividerLeft + model.layout.dividerWidth),
      y2: "0",
      stroke: model.palette.accentLine,
      strokeWidth: String(model.layout.dividerStrokeWidth),
    }),
  );
};

export const buildProjectOgImagePath = (projectId) =>
  `/api/og/project/${encodeURIComponent(String(projectId || "").trim())}`;

export const loadProjectOgStaticAssetDataUrl = (_name) => TRANSPARENT_PIXEL_DATA_URL;

export const loadProjectOgFontBuffers = () => ({
  title: getFontBufferByWeight(TITLE_FONT_WEIGHT),
  eyebrow: getFontBufferByWeight(EYEBROW_FONT_WEIGHT),
  subtitle: getFontBufferByWeight(SUBTITLE_FONT_WEIGHT),
  chip: getFontBufferByWeight(CHIP_FONT_WEIGHT),
});

export const buildProjectOgFonts = () => {
  if (projectOgFontsCache) {
    return projectOgFontsCache;
  }

  const fonts = [
    { weight: CHIP_FONT_WEIGHT, data: getFontBufferByWeight(CHIP_FONT_WEIGHT) },
    { weight: EYEBROW_FONT_WEIGHT, data: getFontBufferByWeight(EYEBROW_FONT_WEIGHT) },
    { weight: SUBTITLE_FONT_WEIGHT, data: getFontBufferByWeight(SUBTITLE_FONT_WEIGHT) },
    { weight: TITLE_FONT_WEIGHT, data: getFontBufferByWeight(TITLE_FONT_WEIGHT) },
  ]
    .filter((entry) => entry.data)
    .map((entry) => ({
      name: "Geist",
      data: entry.data,
      weight: entry.weight,
      style: "normal",
    }));

  projectOgFontsCache = fonts;
  return projectOgFontsCache;
};

export const resolveProjectOgPalette = (accentHex) => {
  const accentPrimary = normalizeHex(accentHex) || DEFAULT_ACCENT_HEX;
  const rgb = hexToRgb(accentPrimary) || hexToRgb(DEFAULT_ACCENT_HEX);
  const hsl = rgbToHsl(rgb);

  return {
    accentPrimary,
    accentDivider: accentPrimary,
    accentLine: accentPrimary,
    accentGlow: rgba(rgb, 0.28),
    accentDarkStart: hslToHex({
      h: hsl.h,
      s: clamp(Math.max(hsl.s - 6, 46), 0, 100),
      l: 9,
    }),
    accentDarkEnd: hslToHex({
      h: hsl.h,
      s: clamp(Math.max(hsl.s - 18, 34), 0, 100),
      l: 4,
    }),
    bgBase: DEFAULT_BACKGROUND,
  };
};

export const buildProjectOgCardModel = ({
  project,
  settings,
  tagTranslations,
  genreTranslations,
  origin,
  resolveVariantUrl,
  titleLayoutOptions,
}) => {
  const safeProject = project && typeof project === "object" ? project : {};
  const layout = cloneLayout();
  const title = String(safeProject.title || "").trim() || "Projeto";
  const titleLayout = buildTitleLayout(title, layout, titleLayoutOptions);
  const subtitle = truncateText(resolveProjectOgSubtitle(safeProject), 42);
  const eyebrowParts = [safeProject.type, safeProject.status]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const imageAlt = `Card de compartilhamento do projeto ${title}`;

  const genreMap = toTranslationMap(genreTranslations);
  const tagMap = toTranslationMap(tagTranslations);
  const sourceValues = [
    ...(Array.isArray(safeProject.genres)
      ? safeProject.genres.map((value) => translateValue(value, genreMap))
      : []),
    ...(Array.isArray(safeProject.tags)
      ? safeProject.tags.map((value) => translateValue(value, tagMap))
      : []),
  ];

  const seenChips = new Set();
  const chips = [];
  sourceValues.forEach((value) => {
    const normalized = normalizeKey(value);
    if (!normalized || seenChips.has(normalized)) {
      return;
    }
    seenChips.add(normalized);
    chips.push(String(value || "").trim());
  });

  const palette = resolveProjectOgPalette(settings?.theme?.accent);
  const artwork = pickArtworkCandidate(safeProject, resolveVariantUrl, origin);
  const backdrop = pickBackdropCandidate(safeProject, resolveVariantUrl, origin);
  const chipLayouts = buildChipLayouts(chips, layout);

  return {
    width: OG_PROJECT_WIDTH,
    height: OG_PROJECT_HEIGHT,
    eyebrow: eyebrowParts.join(` ${EYEBROW_SEPARATOR} `),
    eyebrowParts,
    eyebrowSeparator: EYEBROW_SEPARATOR,
    title,
    titleLines: titleLayout.lines,
    titleLineLayouts: titleLayout.lineLayouts,
    subtitle,
    subtitleTop: titleLayout.subtitleTop,
    subtitleBottom: titleLayout.subtitleBottom,
    subtitleBottomLimit: titleLayout.subtitleBottomLimit,
    titleTruncated: titleLayout.truncated,
    chips,
    chipLayouts,
    imageAlt,
    artworkUrl: artwork.artworkUrl,
    artworkSource: artwork.artworkSource,
    artworkDataUrl: "",
    backdropUrl: backdrop.artworkUrl,
    backdropSource: backdrop.artworkSource,
    backdropDataUrl: "",
    sceneVersion: PROJECT_OG_SCENE_VERSION,
    palette,
    titleFontSize: titleLayout.fontSize,
    titleLineHeight: titleLayout.lineHeight,
    titleRenderWidth: titleLayout.renderWidth,
    titleHeight: titleLayout.height,
    layout,
    fontFamilies: {
      title: "Geist",
      eyebrow: "Geist",
      subtitle: "Geist",
      chip: "Geist",
    },
  };
};

export const loadProjectOgArtworkDataUrl = async ({ artworkUrl, origin } = {}) => {
  const normalized = String(artworkUrl || "").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("data:")) {
    return normalized;
  }

  const localAsset = loadLocalArtworkAsset(normalized);
  if (localAsset?.buffer) {
    return bufferToDataUrl(localAsset.buffer, localAsset.mimeType || guessMimeType(artworkUrl));
  }

  if (/^https?:\/\//i.test(normalized)) {
    return "";
  }

  if (normalized.startsWith("/") && origin) {
    const remoteAsset = await loadRemoteArtworkAsset(
      `${String(origin).replace(/\/+$/, "")}${normalized}`,
    );
    if (remoteAsset?.buffer) {
      return bufferToDataUrl(remoteAsset.buffer, remoteAsset.mimeType || guessMimeType(artworkUrl));
    }
  }

  return "";
};

export const loadProjectOgProcessedBackdropDataUrl = async ({
  artworkUrl,
  artworkDataUrl,
  origin,
  layout,
} = {}) => {
  const asset = await loadProjectOgArtworkAsset({
    artworkUrl,
    artworkDataUrl,
    origin,
  });
  if (!asset?.buffer) {
    return "";
  }
  try {
    const processedBuffer = await buildProcessedBackdropBuffer({
      buffer: asset.buffer,
      layout,
    });
    if (!Buffer.isBuffer(processedBuffer) || processedBuffer.length === 0) {
      return "";
    }
    return bufferToDataUrl(processedBuffer, "image/png");
  } catch {
    return "";
  }
};

export const buildLegacyProjectOgScene = (model) => buildProjectOgScene(model);

export const buildProjectOgScene = (model = {}) => {
  const layout = {
    ...cloneLayout(),
    ...(model?.layout && typeof model.layout === "object" ? model.layout : {}),
  };
  const palette =
    model?.palette && typeof model.palette === "object"
      ? model.palette
      : resolveProjectOgPalette(DEFAULT_ACCENT_HEX);
  const safeModel = {
    ...model,
    layout,
    palette,
    title: String(model?.title || "").trim() || "Projeto",
    titleLines:
      Array.isArray(model?.titleLines) && model.titleLines.length > 0 ? model.titleLines : ["Projeto"],
    titleLineLayouts:
      Array.isArray(model?.titleLineLayouts) && model.titleLineLayouts.length > 0
        ? model.titleLineLayouts
        : (Array.isArray(model?.titleLines) && model.titleLines.length > 0
            ? model.titleLines
            : ["Projeto"]
          ).map((line) => ({
            text: String(line || ""),
            maxWidth: layout.titleWidth,
          })),
    titleFontSize: Number(model?.titleFontSize) || layout.titleBaseFontSize,
    titleLineHeight: Number(model?.titleLineHeight) || TITLE_LINE_HEIGHT,
    titleRenderWidth: Number(model?.titleRenderWidth) || layout.titleWidth,
    subtitleTop: Number(model?.subtitleTop) || layout.subtitleBaseTop,
    eyebrowParts: Array.isArray(model?.eyebrowParts) ? model.eyebrowParts : [],
    chips: Array.isArray(model?.chips) ? model.chips : [],
  };

  const artworkSrc = resolveRenderableImageSrc({
    dataUrl: safeModel.artworkDataUrl,
    url: safeModel.artworkUrl,
  });
  const backdropSrc =
    resolveRenderableImageSrc({
      dataUrl: safeModel.backdropDataUrl,
      url: safeModel.backdropUrl,
    }) || artworkSrc;
  const hasProcessedBackdrop = String(safeModel.backdropDataUrl || "").trim().length > 0;

  return createElement(
    "div",
    {
      "data-og-layer": "project-og-card",
      style: {
        position: "relative",
        display: "flex",
        width: OG_PROJECT_WIDTH,
        height: OG_PROJECT_HEIGHT,
        overflow: "hidden",
        backgroundColor: safeModel.palette.bgBase,
        fontFamily: "Geist",
      },
    },
    hasProcessedBackdrop ? null : buildBackdropNode(safeModel, backdropSrc),
    artworkSrc
      ? createElement("img", {
          src: artworkSrc,
          alt: "",
          "data-og-part": "artwork",
          width: safeModel.layout.artworkWidth,
          height: safeModel.layout.artworkHeight,
          style: {
            position: "absolute",
            left: safeModel.layout.artworkLeft,
            top: safeModel.layout.artworkTop,
            width: safeModel.layout.artworkWidth,
            height: safeModel.layout.artworkHeight,
            objectFit: "cover",
          },
        })
      : buildArtworkFallbackNode(safeModel),
    hasProcessedBackdrop ? buildBackdropNode(safeModel, backdropSrc) : null,
    buildBackgroundSvgNode(safeModel),
    buildEyebrowNode(safeModel),
    buildTitleNode(safeModel),
    buildSubtitleNode(safeModel),
    buildTagsNode(safeModel),
  );
};

export const buildLegacyProjectOgImageResponse = (model) =>
  new ImageResponse(buildLegacyProjectOgScene(model), {
    width: OG_PROJECT_WIDTH,
    height: OG_PROJECT_HEIGHT,
    fonts: buildProjectOgFonts(),
  });

export const buildProjectOgImageResponse = (model) =>
  new ImageResponse(buildProjectOgScene(model), {
    width: OG_PROJECT_WIDTH,
    height: OG_PROJECT_HEIGHT,
    fonts: buildProjectOgFonts(),
  });
