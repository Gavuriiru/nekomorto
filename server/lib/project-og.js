import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "@shuding/opentype.js/dist/opentype.module.js";
import React from "react";
import { ImageResponse } from "@vercel/og";

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
  eyebrowLeft: 57.57,
  eyebrowTop: 55,
  eyebrowFontSize: 28.636211395263672,
  eyebrowDotLeftInset: 7.97,
  eyebrowDotSize: 6.94,
  eyebrowDotGap: 7.81,
  titleLeft: 53,
  titleTop: 93.83402252197266,
  titleWidth: 493.2709655761719,
  titleMaxLines: 3,
  titleBaseFontSize: 72.0604476928711,
  titleMinFontSize: 46,
  subtitleLeft: 55.284423828125,
  subtitleBaseTop: 193.2034454345703,
  subtitleFontSize: 30.654399871826172,
  subtitleGap: 12.9,
  subtitleMaxWidth: 360,
  tagsLeft: 56,
  tagsTop: 560,
  tagsMaxWidth: 564,
  tagGap: 24,
  tagHeight: 29,
  tagRadius: 15.84,
  tagFontSize: 22.17411994934082,
  tagPaddingX: 12,
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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const cloneLayout = () => ({ ...DEFAULT_LAYOUT });

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

const measureTextWidth = ({ text, fontSize, fontWeight }) => {
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

const buildTitleLayout = (title, layout = DEFAULT_LAYOUT) => {
  const normalizedTitle = String(title || "").trim() || "Projeto";
  const fontSizes = [
    layout.titleBaseFontSize,
    68,
    64,
    60,
    56,
    52,
    layout.titleMinFontSize,
  ];

  for (const fontSize of fontSizes) {
    const lines = wrapTextLines({
      text: normalizedTitle,
      maxWidth: layout.titleWidth,
      fontSize,
      fontWeight: TITLE_FONT_WEIGHT,
      maxLines: layout.titleMaxLines,
    });
    const longestLine = Math.max(
      ...lines.map((line) =>
        measureTextWidth({
          text: line,
          fontSize,
          fontWeight: TITLE_FONT_WEIGHT,
        }),
      ),
    );
    if (lines.length <= layout.titleMaxLines && longestLine <= layout.titleWidth) {
      const titleHeight = lines.length * fontSize * TITLE_LINE_HEIGHT;
      return {
        text: normalizedTitle,
        lines,
        fontSize,
        lineHeight: TITLE_LINE_HEIGHT,
        height: titleHeight,
        subtitleTop: layout.titleTop + titleHeight + layout.subtitleGap,
      };
    }
  }

  const fallbackFontSize = layout.titleMinFontSize;
  const lines = wrapTextLines({
    text: normalizedTitle,
    maxWidth: layout.titleWidth,
    fontSize: fallbackFontSize,
    fontWeight: TITLE_FONT_WEIGHT,
    maxLines: layout.titleMaxLines,
  });
  const titleHeight = lines.length * fallbackFontSize * TITLE_LINE_HEIGHT;
  return {
    text: normalizedTitle,
    lines,
    fontSize: fallbackFontSize,
    lineHeight: TITLE_LINE_HEIGHT,
    height: titleHeight,
    subtitleTop: layout.titleTop + titleHeight + layout.subtitleGap,
  };
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

const loadLocalArtworkDataUrl = (artworkUrl) => {
  const normalized = String(artworkUrl || "").trim();
  if (!normalized.startsWith("/")) {
    return "";
  }

  const filePath = path.join(PUBLIC_DIR, normalized.replace(/^\/+/, "").replace(/\//g, path.sep));
  try {
    if (!fs.existsSync(filePath)) {
      return "";
    }
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return "";
    }
    const buffer = fs.readFileSync(filePath);
    return bufferToDataUrl(buffer, guessMimeType(filePath));
  } catch {
    return "";
  }
};

const loadRemoteArtworkDataUrl = async (artworkUrl) => {
  const normalized = String(artworkUrl || "").trim();
  if (!normalized) {
    return "";
  }
  try {
    const response = await fetch(normalized);
    if (!response.ok) {
      return "";
    }
    const mimeType = String(response.headers.get("content-type") || guessMimeType(normalized))
      .split(";")[0]
      .trim();
    const arrayBuffer = await response.arrayBuffer();
    return bufferToDataUrl(Buffer.from(arrayBuffer), mimeType || guessMimeType(normalized));
  } catch {
    return "";
  }
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
        width: model.layout.titleWidth,
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
    ...(Array.isArray(model.titleLines) ? model.titleLines : [String(model.title || "Projeto")]).map(
      (line, index) =>
        createElement(
          "div",
          {
            key: `title-line-${index}`,
            style: {
              display: "flex",
            },
          },
          line,
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
  const subtitle = String(model.subtitle || "").trim();
  if (!subtitle) {
    return null;
  }
  return createElement(
    "div",
    {
      style: {
        position: "absolute",
        left: model.layout.subtitleLeft,
        top: model.subtitleTop,
        maxWidth: model.layout.subtitleMaxWidth,
        display: "flex",
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
  const chips = Array.isArray(model.chips) ? model.chips.filter(Boolean) : [];
  if (chips.length === 0) {
    return null;
  }

  return createElement(
    "div",
    {
      style: {
        position: "absolute",
        left: model.layout.tagsLeft,
        top: model.layout.tagsTop,
        maxWidth: model.layout.tagsMaxWidth,
        display: "flex",
        alignItems: "center",
      },
    },
    ...chips.map((chip, index) =>
      createElement(
        "div",
        {
          key: `chip-${normalizeKey(chip)}-${index}`,
          style: {
            height: model.layout.tagHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(141, 141, 141, 0.09)",
            borderRadius: model.layout.tagRadius,
            paddingLeft: model.layout.tagPaddingX,
            paddingRight: model.layout.tagPaddingX,
            marginRight: index === chips.length - 1 ? 0 : model.layout.tagGap,
            color: "#9b9b9b",
            fontFamily: "Geist",
            fontSize: model.layout.tagFontSize,
            fontWeight: CHIP_FONT_WEIGHT,
            lineHeight: 1.2,
          },
        },
        chip,
      ),
    ),
  );
};

const buildBackgroundSvgNode = (model, artworkSrc) =>
  createElement(
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
        createElement("stop", {
          offset: "0%",
          stopColor: model.palette.accentDarkStart,
          stopOpacity: "1",
        }),
        createElement("stop", {
          offset: "100%",
          stopColor: model.palette.accentDarkEnd,
          stopOpacity: "1",
        }),
      ),
      createElement(
        "linearGradient",
        {
          id: "project-panel-overlay",
          x1: "0%",
          y1: "0%",
          x2: "100%",
          y2: "0%",
        },
        createElement("stop", {
          offset: "0%",
          stopColor: "#000407",
          stopOpacity: "0.08",
        }),
        createElement("stop", {
          offset: "65%",
          stopColor: "#000407",
          stopOpacity: "0.4",
        }),
        createElement("stop", {
          offset: "100%",
          stopColor: "#000407",
          stopOpacity: "0.7",
        }),
      ),
      createElement(
        "filter",
        {
          id: "project-panel-banner-blur",
          x: "-40%",
          y: "-40%",
          width: "180%",
          height: "180%",
        },
        createElement("feGaussianBlur", {
          stdDeviation: "42",
        }),
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
      artworkSrc
        ? createElement("image", {
            href: artworkSrc,
            x: "-180",
            y: "-70",
            width: "1080",
            height: "760",
            opacity: "0.24",
            preserveAspectRatio: "xMidYMid slice",
            filter: "url(#project-panel-banner-blur)",
          })
        : null,
      createElement("ellipse", {
        cx: "480",
        cy: "210",
        rx: "360",
        ry: "240",
        fill: model.palette.accentGlow,
        filter: "url(#project-panel-glow-blur)",
        opacity: "0.85",
      }),
      createElement("ellipse", {
        cx: "685",
        cy: "580",
        rx: "190",
        ry: "150",
        fill: model.palette.accentGlow,
        filter: "url(#project-panel-glow-blur)",
        opacity: "0.3",
      }),
      createElement("rect", {
        x: "0",
        y: "0",
        width: "840",
        height: "630",
        fill: "url(#project-panel-overlay)",
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
}) => {
  const safeProject = project && typeof project === "object" ? project : {};
  const layout = cloneLayout();
  const title = String(safeProject.title || "").trim() || "Projeto";
  const titleLayout = buildTitleLayout(title, layout);
  const subtitle = truncateText(safeProject.studio || "", 42);
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
    if (!normalized || seenChips.has(normalized) || chips.length >= 4) {
      return;
    }
    seenChips.add(normalized);
    chips.push(truncateText(value, 24));
  });

  const palette = resolveProjectOgPalette(settings?.theme?.accent);
  const artwork = pickArtworkCandidate(safeProject, resolveVariantUrl, origin);
  const backdrop = pickBackdropCandidate(safeProject, resolveVariantUrl, origin);

  return {
    width: OG_PROJECT_WIDTH,
    height: OG_PROJECT_HEIGHT,
    eyebrow: eyebrowParts.join(` ${EYEBROW_SEPARATOR} `),
    eyebrowParts,
    eyebrowSeparator: EYEBROW_SEPARATOR,
    title,
    titleLines: titleLayout.lines,
    subtitle,
    subtitleTop: titleLayout.subtitleTop,
    chips,
    imageAlt,
    artworkUrl: artwork.artworkUrl,
    artworkSource: artwork.artworkSource,
    artworkDataUrl: "",
    backdropUrl: backdrop.artworkUrl,
    backdropSource: backdrop.artworkSource,
    backdropDataUrl: "",
    palette,
    titleFontSize: titleLayout.fontSize,
    titleLineHeight: titleLayout.lineHeight,
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

  const localDataUrl = loadLocalArtworkDataUrl(normalized);
  if (localDataUrl) {
    return localDataUrl;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return "";
  }

  if (normalized.startsWith("/") && origin) {
    return loadRemoteArtworkDataUrl(`${String(origin).replace(/\/+$/, "")}${normalized}`);
  }

  return "";
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
    titleFontSize: Number(model?.titleFontSize) || layout.titleBaseFontSize,
    titleLineHeight: Number(model?.titleLineHeight) || TITLE_LINE_HEIGHT,
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
    artworkSrc
      ? createElement("img", {
          src: artworkSrc,
          alt: "",
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
      : createElement("div", {
          style: {
            position: "absolute",
            left: safeModel.layout.artworkLeft,
            top: safeModel.layout.artworkTop,
            width: safeModel.layout.artworkWidth,
            height: safeModel.layout.artworkHeight,
            background: `linear-gradient(180deg, ${safeModel.palette.accentDarkStart} 0%, ${safeModel.palette.accentDarkEnd} 100%)`,
          },
        }),
    buildBackgroundSvgNode(safeModel, backdropSrc),
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
