import React from "react";
import { ImageResponse } from "@vercel/og";

export const OG_PROJECT_WIDTH = 1200;
export const OG_PROJECT_HEIGHT = 630;

const DEFAULT_ACCENT_HEX = "#9667e0";
const DEFAULT_BACKGROUND = "#02050b";
const EYEBROW_SEPARATOR = "\u2022";
const TRANSPARENT_PIXEL_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const FONT_FAMILY_TITLE = "Geist";
const FONT_FAMILY_EYEBROW = "Geist Light";
const FONT_FAMILY_SUBTITLE = "Geist Medium";
const FONT_FAMILY_CHIP = "Geist ExtraLight";

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

const buildTransparentOgScene = () =>
  React.createElement("div", {
    "data-og-layer": "og-zero-baseline",
    style: {
      display: "flex",
      width: OG_PROJECT_WIDTH,
      height: OG_PROJECT_HEIGHT,
      backgroundColor: "rgba(0, 0, 0, 0)",
    },
  });

export const buildProjectOgImagePath = (projectId) =>
  `/api/og/project/${encodeURIComponent(String(projectId || "").trim())}`;

export const loadProjectOgStaticAssetDataUrl = (_name) => {
  // TODO(og-redesign): replace with real asset loader when the new visual system is implemented.
  return TRANSPARENT_PIXEL_DATA_URL;
};

export const loadProjectOgFontBuffers = () => {
  // TODO(og-redesign): add branded font loading for the new OG compositions.
  return {};
};

export const buildProjectOgFonts = () => {
  // TODO(og-redesign): return @vercel/og font declarations for the final templates.
  return [];
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

export const loadProjectOgArtworkDataUrl = async ({ artworkUrl } = {}) => {
  const normalized = String(artworkUrl || "").trim();
  if (normalized.startsWith("data:")) {
    return normalized;
  }
  // TODO(og-redesign): restore full artwork resolution (uploads/public/remote) for the final templates.
  return TRANSPARENT_PIXEL_DATA_URL;
};

export const buildLegacyProjectOgScene = (_model) => buildTransparentOgScene();

export const buildProjectOgScene = (_model) => buildTransparentOgScene();

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
