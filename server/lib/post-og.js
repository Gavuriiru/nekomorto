import {
  OG_PROJECT_HEIGHT,
  OG_PROJECT_WIDTH,
  buildProjectOgImageResponse,
  resolveProjectOgPalette,
} from "./project-og.js";

const EYEBROW_SEPARATOR = "\u2022";

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

export const buildPostOgImagePath = (slug) =>
  `/api/og/post/${encodeURIComponent(String(slug || "").trim())}`;

export const buildPostOgCardModel = ({ post, settings, resolvedCover, resolveVariantUrl }) => {
  const safePost = post && typeof post === "object" ? post : {};
  const title = truncateText(safePost.title || "Postagem", 46) || "Postagem";
  const subtitle = truncateText(safePost.author || "", 38);
  const eyebrowParts = ["Postagem"];
  const imageAlt = `Card de compartilhamento da postagem ${String(safePost.title || "Postagem").trim() || "Postagem"}`;
  const baseArtworkUrl = String(
    resolvedCover?.coverImageUrl || safePost.coverImageUrl || "",
  ).trim();
  const variantArtworkUrl =
    typeof resolveVariantUrl === "function"
      ? String(resolveVariantUrl(baseArtworkUrl, "og") || "").trim()
      : "";
  const artworkUrl = variantArtworkUrl || baseArtworkUrl;

  return {
    width: OG_PROJECT_WIDTH,
    height: OG_PROJECT_HEIGHT,
    eyebrow: eyebrowParts.join(` ${EYEBROW_SEPARATOR} `),
    eyebrowParts,
    eyebrowSeparator: EYEBROW_SEPARATOR,
    title,
    subtitle,
    chips: [],
    imageAlt,
    artworkUrl,
    artworkSource: artworkUrl ? "coverImageUrl" : "none",
    artworkDataUrl: "",
    palette: resolveProjectOgPalette(settings?.theme?.accent),
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

export const buildPostOgImageResponse = (model) => buildProjectOgImageResponse(model);
