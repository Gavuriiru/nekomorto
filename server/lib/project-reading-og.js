import {
  buildProjectReadingOgImagePath,
  PROJECT_READING_OG_SCENE_VERSION,
  resolveProjectReadingOgSnapshot,
} from "../../shared/project-reading-og-seo.js";
import { finalizeVariantUrl, normalizeText } from "./og-shared.js";
import {
  buildProjectOgCardModel,
  buildProjectOgImageResponse,
  buildProjectOgScene,
  getDiagonalXAtY,
  measureTextWidth,
} from "./project-og.js";

const READING_SUBTITLE_FONT_WEIGHT = 500;
const READING_SUBTITLE_DIAGONAL_INSET = 48;
const READING_SUBTITLE_MAX_LINES = 2;
const READING_MODEL_MAX_PASSES = 4;

const measureReadingSubtitleWidth = (text, fontSize) =>
  measureTextWidth({
    text: String(text || ""),
    fontSize,
    fontWeight: READING_SUBTITLE_FONT_WEIGHT,
  });

const getReadingSubtitleLineMaxWidth = ({ layout, subtitleTop, lineIndex }) => {
  const safeLayout = layout && typeof layout === "object" ? layout : {};
  const safeLineIndex = Math.max(0, Math.floor(Number(lineIndex) || 0));
  const subtitleLineHeight = Number(safeLayout.subtitleFontSize) * 1.2;
  const centerY = Number(subtitleTop) + safeLineIndex * subtitleLineHeight + subtitleLineHeight / 2;
  const diagonalX = getDiagonalXAtY({ layout: safeLayout, y: centerY });
  return Math.max(
    0,
    Math.min(
      diagonalX - Number(safeLayout.subtitleLeft) - READING_SUBTITLE_DIAGONAL_INSET,
      1200 - Number(safeLayout.subtitleLeft),
    ),
  );
};

const fitReadingSubtitleWordsWithEllipsis = ({ words, maxWidth, fontSize }) => {
  const safeWords = Array.isArray(words)
    ? words.map((word) => normalizeText(word)).filter(Boolean)
    : [];
  const safeMaxWidth = Number(maxWidth);
  if (safeWords.length === 0 || !Number.isFinite(safeMaxWidth) || safeMaxWidth <= 0) {
    return {
      text: "",
      width: 0,
      truncated: false,
      usable: false,
    };
  }

  const fullText = safeWords.join(" ");
  const fullWidth = measureReadingSubtitleWidth(fullText, fontSize);
  if (fullWidth <= safeMaxWidth) {
    return {
      text: fullText,
      width: fullWidth,
      truncated: false,
      usable: true,
    };
  }

  for (let wordCount = safeWords.length - 1; wordCount >= 1; wordCount -= 1) {
    const candidate = `${safeWords.slice(0, wordCount).join(" ")}...`;
    const candidateWidth = measureReadingSubtitleWidth(candidate, fontSize);
    if (candidateWidth <= safeMaxWidth) {
      return {
        text: candidate,
        width: candidateWidth,
        truncated: true,
        usable: true,
      };
    }
  }

  const ellipsisWidth = measureReadingSubtitleWidth("...", fontSize);
  if (ellipsisWidth <= safeMaxWidth) {
    return {
      text: "...",
      width: ellipsisWidth,
      truncated: true,
      usable: true,
    };
  }

  return {
    text: "",
    width: 0,
    truncated: true,
    usable: false,
  };
};

const resolveReadingSubtitleFittingWordCount = ({ words, maxWidth, fontSize }) => {
  const safeWords = Array.isArray(words) ? words : [];
  if (safeWords.length === 0) {
    return 0;
  }

  let bestCount = 1;
  for (let wordCount = 1; wordCount <= safeWords.length; wordCount += 1) {
    const candidate = safeWords.slice(0, wordCount).join(" ");
    if (measureReadingSubtitleWidth(candidate, fontSize) <= maxWidth) {
      bestCount = wordCount;
      continue;
    }
    break;
  }

  return bestCount;
};

const buildReadingSubtitleLayout = ({ text, layout, subtitleTop }) => {
  const normalizedText = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
  const safeLayout = layout && typeof layout === "object" ? layout : {};
  const subtitleFontSize = Number(safeLayout.subtitleFontSize) || 0;
  const subtitleLineHeight = subtitleFontSize * 1.2;
  const subtitleBottomLimit = Number(safeLayout.tagsTop) - Number(safeLayout.subtitleLimitGap);

  if (!normalizedText || subtitleFontSize <= 0) {
    return {
      text: "",
      lines: [],
      lineLayouts: [],
      maxWidth: 0,
      height: 0,
      bottom: Number(subtitleTop) || 0,
      bottomLimit: subtitleBottomLimit,
      truncated: false,
    };
  }

  const words = normalizedText.split(/\s+/).filter(Boolean);
  const lines = [];
  const lineLayouts = [];
  let remainingWords = words.slice();
  let truncated = false;

  for (
    let lineIndex = 0;
    lineIndex < READING_SUBTITLE_MAX_LINES && remainingWords.length > 0;
    lineIndex += 1
  ) {
    const maxWidth = getReadingSubtitleLineMaxWidth({
      layout: safeLayout,
      subtitleTop,
      lineIndex,
    });

    if (lineIndex === READING_SUBTITLE_MAX_LINES - 1) {
      const fittedLine = fitReadingSubtitleWordsWithEllipsis({
        words: remainingWords,
        maxWidth,
        fontSize: subtitleFontSize,
      });
      if (fittedLine.usable) {
        lines.push(fittedLine.text);
        lineLayouts.push({
          text: fittedLine.text,
          maxWidth,
          width: fittedLine.width,
          lineIndex,
        });
        truncated = fittedLine.truncated;
      }
      break;
    }

    const fittingWordCount = resolveReadingSubtitleFittingWordCount({
      words: remainingWords,
      maxWidth,
      fontSize: subtitleFontSize,
    });
    const lineText = remainingWords.slice(0, fittingWordCount).join(" ");
    const lineWidth = measureReadingSubtitleWidth(lineText, subtitleFontSize);
    lines.push(lineText);
    lineLayouts.push({
      text: lineText,
      maxWidth,
      width: lineWidth,
      lineIndex,
    });
    remainingWords = remainingWords.slice(fittingWordCount);
  }

  const height = lines.length * subtitleLineHeight;
  return {
    text: lines.join(" ").trim(),
    lines,
    lineLayouts,
    maxWidth: Math.max(0, ...lineLayouts.map((line) => Number(line.maxWidth) || 0)),
    height,
    bottom: Number(subtitleTop) + height,
    bottomLimit: subtitleBottomLimit,
    truncated,
  };
};

export const buildProjectReadingOgCardModel = ({
  project,
  chapterNumber,
  volume,
  settings,
  tagTranslations,
  genreTranslations,
  origin,
  resolveVariantUrl,
} = {}) => {
  const snapshot = resolveProjectReadingOgSnapshot({
    project,
    chapterNumber,
    volume,
    settings,
    tagTranslations,
    genreTranslations,
    sceneVersion: PROJECT_READING_OG_SCENE_VERSION,
  });
  if (!snapshot) {
    return null;
  }

  const pseudoProject = {
    title: snapshot.chapterTitle,
    studio: "",
    type: snapshot.eyebrowParts[0] || "",
    status: snapshot.eyebrowParts[1] || "",
    genres: snapshot.chips,
    tags: [],
    cover: "",
    heroImageUrl: "",
    banner: "",
  };

  let reservedSubtitleHeight = 0;
  let baseModel = null;

  for (let passIndex = 0; passIndex < READING_MODEL_MAX_PASSES; passIndex += 1) {
    baseModel = buildProjectOgCardModel({
      project: pseudoProject,
      settings,
      tagTranslations: {},
      genreTranslations: {},
      origin,
      resolveVariantUrl,
      titleLayoutOptions:
        reservedSubtitleHeight > 0
          ? {
              subtitleHeightOverride: reservedSubtitleHeight,
            }
          : undefined,
    });

    const subtitleLayoutCandidate = buildReadingSubtitleLayout({
      text: snapshot.subtitle,
      layout: baseModel.layout,
      subtitleTop: baseModel.subtitleTop,
    });
    const singleLineSubtitleHeight = (Number(baseModel.layout?.subtitleFontSize) || 0) * 1.2;
    const nextReservedSubtitleHeight = Math.max(
      singleLineSubtitleHeight,
      Number(subtitleLayoutCandidate.height) || 0,
    );
    if (Math.abs(nextReservedSubtitleHeight - reservedSubtitleHeight) < 0.01) {
      break;
    }
    reservedSubtitleHeight = nextReservedSubtitleHeight;
  }

  if (!baseModel) {
    return null;
  }

  const subtitleLayout = buildReadingSubtitleLayout({
    text: snapshot.subtitle,
    layout: baseModel.layout,
    subtitleTop: baseModel.subtitleTop,
  });
  const artworkPreset = snapshot.artworkCoverLike ? "poster" : "hero";
  const artworkUrl = finalizeVariantUrl({
    url: snapshot.artworkUrl,
    preset: artworkPreset,
    resolveVariantUrl,
    origin,
  });
  const backdropUrl =
    finalizeVariantUrl({
      url: snapshot.backdropUrl,
      preset: "hero",
      resolveVariantUrl,
      origin,
    }) || artworkUrl;

  return {
    ...baseModel,
    layout: {
      ...baseModel.layout,
      subtitleMaxWidth: subtitleLayout.maxWidth,
    },
    eyebrowParts: snapshot.eyebrowParts,
    eyebrow: snapshot.eyebrowParts.join(` ${baseModel.eyebrowSeparator || "•"} `),
    title: snapshot.chapterTitle,
    subtitle: subtitleLayout.text,
    subtitleLines: subtitleLayout.lines,
    subtitleLineLayouts: subtitleLayout.lineLayouts,
    subtitleHeight: subtitleLayout.height,
    subtitleBottom: subtitleLayout.bottom,
    subtitleBottomLimit: subtitleLayout.bottomLimit,
    subtitleTruncated: subtitleLayout.truncated,
    seoTitle: snapshot.seoTitle,
    seoDescription: snapshot.seoDescription,
    imageAlt: snapshot.imageAlt,
    artworkUrl,
    artworkSource: snapshot.artworkSource || "none",
    backdropUrl,
    backdropSource: snapshot.backdropSource || "none",
    sceneVersion: PROJECT_READING_OG_SCENE_VERSION,
    chapterNumberResolved: snapshot.chapterNumberResolved,
    volumeResolved: snapshot.volumeResolved,
    chapterLabel: snapshot.chapterLabel,
    volumeLabel: snapshot.volumeLabel,
    projectTitle: snapshot.projectTitle,
    artworkSelectedUrl: snapshot.artworkUrl,
    artworkSelectedSource: snapshot.artworkSource,
    backdropSelectedUrl: snapshot.backdropUrl,
    backdropSelectedSource: snapshot.backdropSource,
  };
};

export const buildProjectReadingOgScene = (model) => buildProjectOgScene(model);

export const buildProjectReadingOgImageResponse = (model) => buildProjectOgImageResponse(model);

export {
  buildProjectReadingOgImagePath,
  PROJECT_READING_OG_SCENE_VERSION,
  resolveProjectReadingOgSnapshot,
};
