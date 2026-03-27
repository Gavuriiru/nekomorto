import {
  buildProjectOgCardModel,
  buildProjectOgImageResponse,
  buildProjectOgScene,
  getDiagonalXAtY,
  measureTextWidth,
} from "./project-og.js";
import { POST_OG_SCENE_VERSION, buildPostOgImagePath } from "../../shared/post-og-seo.js";
import { finalizeVariantUrl, normalizeText } from "./og-shared.js";
const POST_OG_SUBTITLE_FONT_WEIGHT = 500;
const POST_OG_SUBTITLE_DIAGONAL_INSET = 48;

const measurePostSubtitleWidth = (text, fontSize) =>
  measureTextWidth({
    text: String(text || ""),
    fontSize,
    fontWeight: POST_OG_SUBTITLE_FONT_WEIGHT,
  });

const fitPostSubtitleText = ({ text, maxWidth, fontSize }) => {
  const normalizedText = normalizeText(text);
  const safeMaxWidth = Number(maxWidth);
  if (!normalizedText || !Number.isFinite(safeMaxWidth) || safeMaxWidth <= 0) {
    return "";
  }

  const fullWidth = measurePostSubtitleWidth(normalizedText, fontSize);
  if (fullWidth <= safeMaxWidth) {
    return normalizedText;
  }

  const words = normalizedText.split(/\s+/).filter(Boolean);
  while (words.length > 0) {
    const candidate = `${words.join(" ")}...`;
    if (measurePostSubtitleWidth(candidate, fontSize) <= safeMaxWidth) {
      return candidate;
    }
    words.pop();
  }

  if (measurePostSubtitleWidth("...", fontSize) <= safeMaxWidth) {
    return "...";
  }
  return "";
};

const getPostSubtitleMaxWidth = ({ layout, subtitleTop }) => {
  const safeLayout = layout && typeof layout === "object" ? layout : {};
  const subtitleHeight = Number(safeLayout.subtitleFontSize) * 1.2;
  const centerY = Number(subtitleTop) + subtitleHeight / 2;
  const diagonalX = getDiagonalXAtY({ layout: safeLayout, y: centerY });
  return Math.max(0, diagonalX - Number(safeLayout.subtitleLeft) - POST_OG_SUBTITLE_DIAGONAL_INSET);
};

const resolvePostSubtitleLayout = ({ text, layout, subtitleTop, hasAvatar }) => {
  const safeLayout = layout && typeof layout === "object" ? layout : {};
  const subtitleFontSize = Number(safeLayout.subtitleFontSize) || 0;
  const subtitleMaxWidth = getPostSubtitleMaxWidth({
    layout: safeLayout,
    subtitleTop,
  });
  const avatarSize = hasAvatar ? Number(safeLayout.subtitleAvatarSize) || 27 : 0;
  const avatarGap = hasAvatar ? Number(safeLayout.subtitleAvatarGap) || 8 : 0;
  const avatarFootprint = hasAvatar ? avatarSize + avatarGap : 0;
  const subtitleTextMaxWidth = Math.max(0, subtitleMaxWidth - avatarFootprint);
  const subtitle = fitPostSubtitleText({
    text,
    maxWidth: subtitleTextMaxWidth,
    fontSize: subtitleFontSize,
  });
  const subtitleTextRenderWidth = subtitle
    ? measurePostSubtitleWidth(subtitle, subtitleFontSize)
    : 0;
  const subtitleRenderWidth = subtitleTextRenderWidth + (hasAvatar ? avatarFootprint : 0);

  return {
    subtitle,
    subtitleMaxWidth,
    subtitleTextMaxWidth,
    subtitleTextRenderWidth,
    subtitleRenderWidth,
    subtitleHeight: subtitleFontSize * 1.2,
  };
};

const pickPostOgImageCandidate = (candidates) => {
  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  for (const candidate of safeCandidates) {
    const url = normalizeText(candidate?.url);
    if (!url) {
      continue;
    }
    return {
      source: normalizeText(candidate?.source) || "unknown",
      url,
      coverLike: Boolean(candidate?.coverLike),
    };
  }
  return {
    source: "none",
    url: "",
    coverLike: false,
  };
};

const resolvePostOgArtworkSelection = ({
  post,
  resolvedCover,
  firstPostImage,
  relatedProject,
} = {}) => {
  const manualPostCoverUrl =
    normalizeText(resolvedCover?.source) === "manual"
      ? normalizeText(resolvedCover?.coverImageUrl)
      : "";
  return pickPostOgImageCandidate([
    {
      source: "post-cover",
      url: manualPostCoverUrl,
      coverLike: true,
    },
    {
      source: "post-first-image",
      url: normalizeText(firstPostImage?.coverImageUrl),
      coverLike: false,
    },
    {
      source: "project-cover",
      url: normalizeText(relatedProject?.cover),
      coverLike: true,
    },
  ]);
};

const resolvePostOgBackdropSelection = ({
  resolvedCover,
  firstPostImage,
  relatedProject,
  defaultBackdropUrl,
} = {}) => {
  const manualPostCoverUrl =
    normalizeText(resolvedCover?.source) === "manual"
      ? normalizeText(resolvedCover?.coverImageUrl)
      : "";
  return pickPostOgImageCandidate([
    {
      source: "post-first-image",
      url: normalizeText(firstPostImage?.coverImageUrl),
      coverLike: false,
    },
    {
      source: "post-cover",
      url: manualPostCoverUrl,
      coverLike: true,
    },
    {
      source: "project-banner",
      url: normalizeText(relatedProject?.banner),
      coverLike: false,
    },
    {
      source: "project-cover",
      url: normalizeText(relatedProject?.cover),
      coverLike: true,
    },
    {
      source: "site-default-share-image",
      url: normalizeText(defaultBackdropUrl),
      coverLike: false,
    },
  ]);
};

const resolvePostOgChipPayload = ({ post, relatedProject }) => {
  const safePost = post && typeof post === "object" ? post : {};
  const safeProject = relatedProject && typeof relatedProject === "object" ? relatedProject : null;
  const projectGenres = Array.isArray(safeProject?.genres)
    ? safeProject.genres.map((value) => normalizeText(value)).filter(Boolean)
    : [];
  const projectTags = Array.isArray(safeProject?.tags)
    ? safeProject.tags.map((value) => normalizeText(value)).filter(Boolean)
    : [];
  if (projectGenres.length > 0 || projectTags.length > 0) {
    return {
      genres: projectGenres,
      tags: projectTags,
      source: "related-project",
    };
  }
  return {
    genres: [],
    tags: Array.isArray(safePost?.tags)
      ? safePost.tags.map((value) => normalizeText(value)).filter(Boolean)
      : [],
    source: "post-tags",
  };
};

export const buildPostOgCardModel = ({
  post,
  relatedProject,
  resolvedCover,
  firstPostImage,
  resolvedAuthor,
  defaultBackdropUrl,
  settings,
  tagTranslations,
  genreTranslations,
  origin,
  resolveVariantUrl,
} = {}) => {
  const safePost = post && typeof post === "object" ? post : {};
  const authorName = normalizeText(resolvedAuthor?.name) || normalizeText(safePost.author);
  const authorAvatarUrl =
    normalizeText(resolvedAuthor?.avatarUrl) || normalizeText(safePost.authorAvatarUrl);
  const chipPayload = resolvePostOgChipPayload({
    post: safePost,
    relatedProject,
  });

  const pseudoProject = {
    title: normalizeText(safePost.title) || "Postagem",
    studio: authorName,
    type: "Postagem",
    status: "",
    genres: chipPayload.genres,
    tags: chipPayload.tags,
    cover: "",
    heroImageUrl: "",
    banner: "",
  };

  const baseModel = buildProjectOgCardModel({
    project: pseudoProject,
    settings,
    tagTranslations: tagTranslations && typeof tagTranslations === "object" ? tagTranslations : {},
    genreTranslations:
      genreTranslations && typeof genreTranslations === "object" ? genreTranslations : {},
    origin,
    resolveVariantUrl,
  });

  const artworkSelection = resolvePostOgArtworkSelection({
    post: safePost,
    resolvedCover,
    firstPostImage,
    relatedProject,
  });
  const backdropSelection = resolvePostOgBackdropSelection({
    resolvedCover,
    firstPostImage,
    relatedProject,
    defaultBackdropUrl,
  });
  const artworkPreset = artworkSelection.coverLike ? "poster" : "hero";
  const artworkUrl = finalizeVariantUrl({
    url: artworkSelection.url,
    preset: artworkPreset,
    resolveVariantUrl,
    origin,
  });
  const backdropUrl = finalizeVariantUrl({
    url: backdropSelection.url,
    preset: "hero",
    resolveVariantUrl,
    origin,
  });
  const subtitleLayout = resolvePostSubtitleLayout({
    text: authorName,
    layout: {
      ...baseModel.layout,
      subtitleAvatarSize: 27,
      subtitleAvatarGap: 8,
    },
    subtitleTop: baseModel.subtitleTop,
    hasAvatar: Boolean(authorAvatarUrl),
  });

  return {
    ...baseModel,
    eyebrow: "Postagem",
    eyebrowParts: ["Postagem"],
    subtitle: subtitleLayout.subtitle,
    subtitleNoWrap: true,
    subtitleRenderWidth: subtitleLayout.subtitleRenderWidth,
    subtitleTextRenderWidth: subtitleLayout.subtitleTextRenderWidth,
    subtitleTextMaxWidth: subtitleLayout.subtitleTextMaxWidth,
    subtitleHeight: subtitleLayout.subtitleHeight,
    subtitleBottom: baseModel.subtitleTop + subtitleLayout.subtitleHeight,
    chips: baseModel.chips,
    imageAlt: `Card de compartilhamento da postagem ${normalizeText(safePost.title) || "Postagem"}`,
    artworkUrl,
    artworkSource: artworkSelection.source,
    artworkCoverLike: artworkSelection.coverLike,
    artworkDataUrl: "",
    backdropUrl,
    backdropSource: backdropSelection.source,
    backdropDataUrl: "",
    subtitleAvatarUrl: authorAvatarUrl,
    subtitleAvatarDataUrl: "",
    sceneVersion: POST_OG_SCENE_VERSION,
    chipSource: chipPayload.source,
    layout: {
      ...baseModel.layout,
      subtitleMaxWidth: subtitleLayout.subtitleMaxWidth,
      subtitleAvatarSize: 27,
      subtitleAvatarGap: 8,
    },
  };
};

export const buildPostOgScene = (model) => buildProjectOgScene(model);

export const buildPostOgImageResponse = (model) => buildProjectOgImageResponse(model);

export { POST_OG_SCENE_VERSION, buildPostOgImagePath };
