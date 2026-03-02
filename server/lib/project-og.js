import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { ImageResponse } from "@vercel/og";
import { resolveUploadAbsolutePath } from "./upload-media.js";

export const OG_PROJECT_WIDTH = 1200;
export const OG_PROJECT_HEIGHT = 630;

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_OG_ASSET_DIR = path.join(MODULE_DIR, "..", "assets", "og", "project-card");

const DEFAULT_ACCENT_HEX = "#9667e0";
const DEFAULT_BACKGROUND = "#02050b";
const EYEBROW_SEPARATOR = "\u2022";

const FONT_FAMILY_TITLE = "Geist";
const FONT_FAMILY_EYEBROW = "Geist Light";
const FONT_FAMILY_SUBTITLE = "Geist Medium";
const FONT_FAMILY_CHIP = "Geist ExtraLight";

const STATIC_ASSET_FILES = Object.freeze({
  overlayShadow: "overlay-shadow.png",
  overlayAccentMask: "overlay-accent-mask.png",
  overlayDepth: "overlay-depth.png",
  chipDrama: "chip-drama.png",
  chipMisterio: "chip-misterio.png",
  chipPsicologico: "chip-psicologico.png",
  chipSobrenatural: "chip-sobrenatural.png",
});

const FONT_FILES = Object.freeze({
  title: { fileName: "Geist-Bold.otf", name: FONT_FAMILY_TITLE, weight: 700 },
  eyebrow: { fileName: "Geist-Light.otf", name: FONT_FAMILY_EYEBROW, weight: 300 },
  subtitle: { fileName: "Geist-Medium.otf", name: FONT_FAMILY_SUBTITLE, weight: 500 },
  chip: { fileName: "Geist-ExtraLight.otf", name: FONT_FAMILY_CHIP, weight: 200 },
});

const DEFAULT_LAYOUT = Object.freeze({
  artworkLeft: 780,
  artworkTop: 0,
  artworkWidth: 420,
  artworkHeight: 630,
  eyebrowLeft: 45.878,
  eyebrowTop: 62.972,
  titleLeft: 45.878,
  titleTop: 106.199,
  titleWidth: 620,
  subtitleLeft: 45.878,
  subtitleTop: 209.329,
  subtitleWidth: 420,
  dividerLeft: 776,
  dividerTop: -10,
  dividerWidth: 8,
  dividerHeight: 650,
  dividerSkewDeg: 0,
});

const staticAssetDataUrlCache = new Map();
const fontBufferCache = new Map();
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
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

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
  const chroma =
    (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
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

const guessMimeType = (value, fallback = "image/png") => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return fallback;
  }
  try {
    const parsed = normalized.startsWith("http://") || normalized.startsWith("https://")
      ? new URL(normalized)
      : new URL(normalized, "https://nekomata.local");
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.endsWith(".png")) {
      return "image/png";
    }
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
      return "image/jpeg";
    }
    if (pathname.endsWith(".webp")) {
      return "image/webp";
    }
    if (pathname.endsWith(".gif")) {
      return "image/gif";
    }
    if (pathname.endsWith(".avif")) {
      return "image/avif";
    }
    if (pathname.endsWith(".svg")) {
      return "image/svg+xml";
    }
  } catch {
    return fallback;
  }
  return fallback;
};

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

const pickArtworkCandidate = (project, resolveVariantUrl, origin) => {
  const candidates = [
    { source: "cover", url: String(project?.cover || "").trim(), preset: "poster" },
    { source: "heroImageUrl", url: String(project?.heroImageUrl || "").trim(), preset: "hero" },
    { source: "banner", url: String(project?.banner || "").trim(), preset: "hero" },
  ];

  for (const candidate of candidates) {
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

const getTitleFontSize = (title) => {
  const length = String(title || "").length;
  if (length <= 18) {
    return 84;
  }
  if (length <= 32) {
    return 72;
  }
  return 60;
};

const resolveStaticAssetPath = (name) => {
  const resolvedName = STATIC_ASSET_FILES[name] || String(name || "").trim();
  if (!resolvedName) {
    throw new Error("missing_project_og_asset_name");
  }
  return path.join(PROJECT_OG_ASSET_DIR, resolvedName);
};

const readStaticAssetBuffer = (name) => fs.readFileSync(resolveStaticAssetPath(name));

const toDataUrl = (buffer, mime) => `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;

const createLayer = (layerName, style) =>
  React.createElement("div", {
    "data-og-layer": layerName,
    style: {
      position: "absolute",
      ...style,
    },
  });

const renderEyebrow = (model, fontFamilies) => {
  const eyebrowParts = Array.isArray(model.eyebrowParts) ? model.eyebrowParts.filter(Boolean) : [];
  const separator = model.eyebrowSeparator || EYEBROW_SEPARATOR;

  if (eyebrowParts.length === 2) {
    return React.createElement(
      "div",
      {
        "data-og-layer": "eyebrow-row",
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 28,
          lineHeight: 1,
          color: "#8d8d8d",
          fontFamily: fontFamilies.eyebrow,
          fontWeight: 300,
        },
      },
      React.createElement("span", null, eyebrowParts[0]),
      React.createElement(
        "span",
        {
          style: {
            color: model.palette.accentDivider,
            fontFamily: fontFamilies.eyebrow,
            fontWeight: 300,
          },
        },
        separator,
      ),
      React.createElement("span", null, eyebrowParts[1]),
    );
  }

  return React.createElement(
    "div",
    {
      "data-og-layer": "eyebrow-row",
      style: {
        display: "flex",
        alignItems: "center",
        fontSize: 28,
        lineHeight: 1,
        color: "#8d8d8d",
        fontFamily: fontFamilies.eyebrow,
        fontWeight: 300,
      },
    },
    model.eyebrow || "Projeto",
  );
};

export const buildProjectOgImagePath = (projectId) =>
  `/api/og/project/${encodeURIComponent(String(projectId || "").trim())}`;

export const loadProjectOgStaticAssetDataUrl = (name) => {
  const resolvedName = STATIC_ASSET_FILES[name] || String(name || "").trim();
  if (!resolvedName) {
    throw new Error("missing_project_og_asset_name");
  }
  if (staticAssetDataUrlCache.has(resolvedName)) {
    return staticAssetDataUrlCache.get(resolvedName);
  }
  const buffer = readStaticAssetBuffer(resolvedName);
  const dataUrl = toDataUrl(buffer, guessMimeType(resolvedName));
  staticAssetDataUrlCache.set(resolvedName, dataUrl);
  return dataUrl;
};

export const loadProjectOgFontBuffers = () => {
  const result = {};
  Object.values(FONT_FILES).forEach((fontConfig) => {
    if (!fontBufferCache.has(fontConfig.fileName)) {
      fontBufferCache.set(
        fontConfig.fileName,
        fs.readFileSync(path.join(PROJECT_OG_ASSET_DIR, fontConfig.fileName)),
      );
    }
    result[fontConfig.name] = fontBufferCache.get(fontConfig.fileName);
  });
  return result;
};

export const buildProjectOgFonts = () => {
  if (projectOgFontsCache) {
    return projectOgFontsCache;
  }
  const buffers = loadProjectOgFontBuffers();
  projectOgFontsCache = [
    {
      name: FONT_FAMILY_TITLE,
      data: buffers[FONT_FAMILY_TITLE],
      style: "normal",
      weight: 700,
    },
    {
      name: FONT_FAMILY_EYEBROW,
      data: buffers[FONT_FAMILY_EYEBROW],
      style: "normal",
      weight: 300,
    },
    {
      name: FONT_FAMILY_SUBTITLE,
      data: buffers[FONT_FAMILY_SUBTITLE],
      style: "normal",
      weight: 500,
    },
    {
      name: FONT_FAMILY_CHIP,
      data: buffers[FONT_FAMILY_CHIP],
      style: "normal",
      weight: 200,
    },
  ];
  return projectOgFontsCache;
};

export const resolveProjectOgPalette = (accentHex) => {
  const rgb = hexToRgb(accentHex) || hexToRgb(DEFAULT_ACCENT_HEX);
  const hsl = rgbToHsl(rgb);
  const accentPrimary = hslToHex({
    h: hsl.h,
    s: clamp(Math.max(hsl.s, 72), 0, 100),
    l: clamp(Math.max(hsl.l, 54), 0, 100),
  });
  const accentDivider = hslToHex({
    h: hsl.h,
    s: clamp(Math.max(hsl.s, 82), 0, 100),
    l: clamp(Math.max(hsl.l + 4, 58), 0, 100),
  });
  const accentLine = hslToHex({
    h: hsl.h,
    s: clamp(Math.max(hsl.s, 88), 0, 100),
    l: clamp(Math.max(hsl.l + 10, 66), 0, 100),
  });
  const accentDarkStart = hslToHex({
    h: hsl.h,
    s: clamp(Math.max(hsl.s - 4, 58), 0, 100),
    l: 9,
  });
  const accentDarkEnd = hslToHex({
    h: hsl.h,
    s: clamp(Math.max(hsl.s - 14, 44), 0, 100),
    l: 5,
  });
  const accentPrimaryRgb = hexToRgb(accentPrimary) || rgb;

  return {
    accentPrimary,
    accentDivider,
    accentLine,
    accentGlow: rgba(accentPrimaryRgb, 0.34),
    accentDarkStart,
    accentDarkEnd,
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
  const eyebrowParts = [safeProject.type, safeProject.status]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const title = truncateText(safeProject.title || "Projeto", 46) || "Projeto";
  const subtitle = truncateText(safeProject.studio || "", 38);
  const imageAlt = `Card de compartilhamento do projeto ${String(safeProject.title || "Projeto").trim() || "Projeto"}`;
  const genreMap = toTranslationMap(genreTranslations);
  const tagMap = toTranslationMap(tagTranslations);
  const sourceValues =
    Array.isArray(safeProject.genres) && safeProject.genres.length > 0
      ? safeProject.genres.map((value) => translateValue(value, genreMap))
      : Array.isArray(safeProject.tags)
        ? safeProject.tags.map((value) => translateValue(value, tagMap))
        : [];
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

  return {
    width: OG_PROJECT_WIDTH,
    height: OG_PROJECT_HEIGHT,
    eyebrow: eyebrowParts.join(` ${EYEBROW_SEPARATOR} `),
    eyebrowParts,
    eyebrowSeparator: EYEBROW_SEPARATOR,
    title,
    subtitle,
    chips,
    imageAlt,
    artworkUrl: artwork.artworkUrl,
    artworkSource: artwork.artworkSource,
    artworkDataUrl: "",
    palette,
    titleFontSize: getTitleFontSize(title),
    layout: cloneLayout(),
    fontFamilies: {
      title: FONT_FAMILY_TITLE,
      eyebrow: FONT_FAMILY_EYEBROW,
      subtitle: FONT_FAMILY_SUBTITLE,
      chip: FONT_FAMILY_CHIP,
    },
  };
};

export const loadProjectOgArtworkDataUrl = async ({ artworkUrl, uploadsDir }) => {
  const normalizedUrl = String(artworkUrl || "").trim();
  if (!normalizedUrl) {
    return "";
  }
  if (normalizedUrl.startsWith("data:")) {
    return normalizedUrl;
  }

  try {
    if (normalizedUrl.startsWith("/uploads/")) {
      const absolutePath = resolveUploadAbsolutePath({
        uploadsDir,
        uploadUrl: normalizedUrl,
      });
      if (!absolutePath) {
        return "";
      }
      const bytes = await fsPromises.readFile(absolutePath);
      const mime = guessMimeType(normalizedUrl);
      return toDataUrl(bytes, mime);
    }

    if (/^https?:\/\//i.test(normalizedUrl)) {
      const response = await fetch(normalizedUrl);
      if (!response.ok) {
        return "";
      }
      const arrayBuffer = await response.arrayBuffer();
      const mime =
        String(response.headers.get("content-type") || "").split(";")[0].trim() ||
        guessMimeType(normalizedUrl);
      return toDataUrl(arrayBuffer, mime);
    }
  } catch {
    return "";
  }

  return "";
};

export const buildProjectOgScene = (model) => {
  const safeModel = model && typeof model === "object" ? model : {};
  const palette =
    safeModel.palette && typeof safeModel.palette === "object"
      ? safeModel.palette
      : resolveProjectOgPalette(DEFAULT_ACCENT_HEX);
  const title = String(safeModel.title || "Projeto");
  const subtitle = String(safeModel.subtitle || "");
  const artworkDataUrl = String(safeModel.artworkDataUrl || "").trim();
  const titleFontSize = Number.isFinite(Number(safeModel.titleFontSize))
    ? Number(safeModel.titleFontSize)
    : getTitleFontSize(title);
  const layout =
    safeModel.layout && typeof safeModel.layout === "object"
      ? { ...cloneLayout(), ...safeModel.layout }
      : cloneLayout();
  const fontFamilies =
    safeModel.fontFamilies && typeof safeModel.fontFamilies === "object"
      ? {
          title: safeModel.fontFamilies.title || FONT_FAMILY_TITLE,
          eyebrow: safeModel.fontFamilies.eyebrow || FONT_FAMILY_EYEBROW,
          subtitle: safeModel.fontFamilies.subtitle || FONT_FAMILY_SUBTITLE,
          chip: safeModel.fontFamilies.chip || FONT_FAMILY_CHIP,
        }
      : {
          title: FONT_FAMILY_TITLE,
          eyebrow: FONT_FAMILY_EYEBROW,
          subtitle: FONT_FAMILY_SUBTITLE,
          chip: FONT_FAMILY_CHIP,
        };
  const accentPrimaryRgb = hexToRgb(palette.accentPrimary) || hexToRgb(DEFAULT_ACCENT_HEX);
  const accentLineRgb = hexToRgb(palette.accentLine) || accentPrimaryRgb;
  const artworkFillWidth = 456;
  const artworkFillHeight = 654;

  return React.createElement(
    "div",
    {
      style: {
        position: "relative",
        display: "flex",
        width: OG_PROJECT_WIDTH,
        height: OG_PROJECT_HEIGHT,
        overflow: "hidden",
        background: palette.bgBase,
        color: "#ffffff",
        fontFamily: fontFamilies.title,
      },
    },
    createLayer("bg-base", {
      inset: 0,
      background: palette.bgBase,
    }),
    createLayer("bg-gradient-main", {
      left: 0,
      top: 0,
      width: layout.artworkLeft,
      height: OG_PROJECT_HEIGHT,
      backgroundImage: `linear-gradient(90deg, #01040a 0%, #020913 22%, ${palette.accentDarkEnd} 56%, ${palette.accentDarkStart} 82%, #08192f 100%)`,
    }),
    createLayer("bg-gradient-soft", {
      left: 0,
      top: 0,
      width: layout.artworkLeft,
      height: OG_PROJECT_HEIGHT,
      backgroundImage: `radial-gradient(circle at 73% 48%, ${rgba(
        accentPrimaryRgb,
        0.16,
      )} 0%, ${rgba(accentPrimaryRgb, 0.08)} 18%, rgba(0,0,0,0) 58%)`,
    }),
    React.createElement(
      "div",
      {
        "data-og-layer": "artwork-image",
        style: {
          position: "absolute",
          display: "flex",
          left: layout.artworkLeft,
          top: layout.artworkTop,
          width: layout.artworkWidth,
          height: layout.artworkHeight,
          overflow: "hidden",
          background:
            "linear-gradient(180deg, rgba(10,18,33,0.98) 0%, rgba(5,9,17,1) 100%)",
        },
      },
      artworkDataUrl
        ? React.createElement("img", {
            src: artworkDataUrl,
            alt: "",
            style: {
              position: "absolute",
              left: -18,
              top: -12,
              width: artworkFillWidth,
              height: artworkFillHeight,
              objectFit: "cover",
            },
          })
        : null,
    ),
    createLayer("divider-line", {
      left: layout.dividerLeft,
      top: layout.dividerTop,
      width: layout.dividerWidth,
      height: layout.dividerHeight,
      background: palette.accentLine,
      boxShadow: `0 0 18px ${rgba(accentLineRgb, 0.42)}, 0 0 42px ${rgba(
        accentPrimaryRgb,
        0.18,
      )}`,
    }),
    React.createElement("div", {
      "data-og-layer": "content",
      style: {
        position: "absolute",
        display: "flex",
        inset: 0,
        color: "#ffffff",
      },
      children: [
        React.createElement(
          "div",
          {
            key: "eyebrow-wrap",
            style: {
              position: "absolute",
              display: "flex",
              left: layout.eyebrowLeft,
              top: layout.eyebrowTop,
            },
          },
          renderEyebrow(
            {
              eyebrow: safeModel.eyebrow,
              eyebrowParts: safeModel.eyebrowParts,
              eyebrowSeparator: safeModel.eyebrowSeparator,
              palette,
            },
            fontFamilies,
          ),
        ),
        React.createElement(
          "div",
          {
            key: "title",
            "data-og-layer": "title-text",
            style: {
              position: "absolute",
              display: "flex",
              left: layout.titleLeft,
              top: layout.titleTop,
              width: layout.titleWidth,
              maxHeight: Math.ceil(titleFontSize * 2.02),
            },
          },
          React.createElement(
            "div",
            {
              style: {
                color: "#ffffff",
                fontFamily: fontFamilies.title,
                fontSize: titleFontSize,
                lineHeight: 0.94,
                fontWeight: 700,
                letterSpacing: "-0.042em",
                textShadow: "0 10px 28px rgba(0,0,0,0.34)",
              },
            },
            title,
          ),
        ),
        subtitle
          ? React.createElement(
              "div",
              {
                key: "subtitle",
                "data-og-layer": "subtitle-text",
                style: {
                  position: "absolute",
                  display: "flex",
                  left: layout.subtitleLeft,
                  top: layout.subtitleTop,
                  width: layout.subtitleWidth,
                },
              },
              React.createElement(
                "div",
                {
                  style: {
                    color: palette.accentDivider,
                    fontFamily: fontFamilies.subtitle,
                    fontSize: 34,
                    lineHeight: 1,
                    fontWeight: 500,
                    textShadow: `0 0 18px ${rgba(accentPrimaryRgb, 0.16)}`,
                  },
                },
                subtitle,
              ),
            )
          : null,
      ],
    }),
  );
};

export const buildProjectOgImageResponse = (model) =>
  new ImageResponse(buildProjectOgScene(model), {
    width: OG_PROJECT_WIDTH,
    height: OG_PROJECT_HEIGHT,
    fonts: buildProjectOgFonts(),
  });
