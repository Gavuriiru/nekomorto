import {
  DEFAULT_PROJECT_OG_LAYOUT,
  measureTextWidth,
  OG_PROJECT_HEIGHT,
  OG_PROJECT_WIDTH,
  PROJECT_OG_CHIP_FONT_WEIGHT,
  PROJECT_OG_TITLE_FONT_WEIGHT,
  parseProjectOgPolygonPoints,
} from "./project-og-assets.js";

export const TITLE_DIAGONAL_INSET = 64;
export const PROJECT_OG_TITLE_LINE_HEIGHT = 1.2;

const TITLE_FONT_SIZE_STEP = 0.5;
const TITLE_EMERGENCY_MIN_FONT_SIZE = 28;
const TITLE_VISUAL_MIN_REFERENCE_TEXT =
  "Rekishi ni Nokoru Akujo ni Naruzo: Akuyaku Reijou ni Naru hodo Ouji no Dekiai wa Kasoku Suru you desu!";

let projectOgTitleVisualMinFontSizeCache = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeFontSizeValue = (value) => Number(Number(value).toFixed(4));

const buildDescendingFontSizes = ({ maxFontSize, minFontSize, step = TITLE_FONT_SIZE_STEP }) => {
  const sizes = [];
  const push = (candidate) => {
    const normalized = normalizeFontSizeValue(candidate);
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
  if (
    !Number.isFinite(safeMax) ||
    !Number.isFinite(safeMin) ||
    !Number.isFinite(safeStep) ||
    safeStep <= 0
  ) {
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

export const cloneProjectOgLayout = () => {
  const layout = { ...DEFAULT_PROJECT_OG_LAYOUT };
  layout.titleMinFontSize = resolveProjectOgTitleVisualMinFontSize(layout);
  return layout;
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

const getPanelDiagonalSegment = (layout = DEFAULT_PROJECT_OG_LAYOUT) => {
  const points = parseProjectOgPolygonPoints(layout.panelPoints);
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

export const getDiagonalXAtY = ({ layout = DEFAULT_PROJECT_OG_LAYOUT, y }) => {
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

const getTitleLineMaxWidth = ({ layout = DEFAULT_PROJECT_OG_LAYOUT, fontSize, lineIndex }) => {
  const safeLineIndex = Math.max(0, Math.floor(Number(lineIndex) || 0));
  const lineHeightPx = Number(fontSize) * PROJECT_OG_TITLE_LINE_HEIGHT;
  const centerY = Number(layout.titleTop) + safeLineIndex * lineHeightPx + lineHeightPx / 2;
  const diagonalX = getDiagonalXAtY({ layout, y: centerY });
  const rawWidth = diagonalX - Number(layout.titleLeft) - TITLE_DIAGONAL_INSET;
  return clamp(
    rawWidth,
    Number(layout.titleWidth) || 0,
    OG_PROJECT_WIDTH - Number(layout.titleLeft),
  );
};

const getTagRowMaxWidth = ({ layout = DEFAULT_PROJECT_OG_LAYOUT, rowIndex }) => {
  void rowIndex;
  const rowTop = Number(layout.tagsTop);
  const centerY = rowTop + Number(layout.tagHeight) / 2;
  const diagonalX = getDiagonalXAtY({ layout, y: centerY });
  const rawWidth = diagonalX - Number(layout.tagsLeft) - TITLE_DIAGONAL_INSET;
  return clamp(
    rawWidth,
    Number(layout.tagsMaxWidth) || 0,
    OG_PROJECT_WIDTH - Number(layout.tagsLeft),
  );
};

const buildTitleLineLayouts = ({ lines, layout = DEFAULT_PROJECT_OG_LAYOUT, fontSize }) =>
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
  layout = DEFAULT_PROJECT_OG_LAYOUT,
  fontSize,
  lines,
  truncated,
  subtitleHeightOverride,
}) => {
  const titleHeight = lines.length * fontSize * PROJECT_OG_TITLE_LINE_HEIGHT;
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
    lineHeight: PROJECT_OG_TITLE_LINE_HEIGHT,
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

const buildUnlimitedTitleLines = ({ text, layout = DEFAULT_PROJECT_OG_LAYOUT, fontSize }) =>
  wrapTextLinesByLineWidths({
    text,
    getLineMaxWidth: (lineIndex) =>
      getTitleLineMaxWidth({
        layout,
        fontSize,
        lineIndex,
      }),
    fontSize,
    fontWeight: PROJECT_OG_TITLE_FONT_WEIGHT,
    maxLines: 999,
  });

const resolveTechnicalTitleMaxLines = ({
  layout = DEFAULT_PROJECT_OG_LAYOUT,
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
  const lineHeightPx = Number(fontSize) * PROJECT_OG_TITLE_LINE_HEIGHT;
  if (!Number.isFinite(availableHeight) || !Number.isFinite(lineHeightPx) || lineHeightPx <= 0) {
    return Math.max(1, Math.floor(Number(layout.titleMaxLines) || 1));
  }
  return Math.max(1, Math.floor(availableHeight / lineHeightPx));
};

const resolveProjectOgTitleVisualMinFontSize = (layout = DEFAULT_PROJECT_OG_LAYOUT) => {
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

  projectOgTitleVisualMinFontSizeCache = Number(DEFAULT_PROJECT_OG_LAYOUT.titleMinFontSize);
  return projectOgTitleVisualMinFontSizeCache;
};

const wrapTextLinesByLineWidths = ({ text, getLineMaxWidth, fontSize, fontWeight, maxLines }) => {
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

export const buildProjectOgTitleLayout = (
  title,
  layout = DEFAULT_PROJECT_OG_LAYOUT,
  { subtitleHeightOverride } = {},
) => {
  const normalizedTitle = String(title || "").trim() || "Projeto";
  const visualMinFontSize =
    Number(layout.titleMinFontSize) || resolveProjectOgTitleVisualMinFontSize(layout);
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
    fontWeight: PROJECT_OG_TITLE_FONT_WEIGHT,
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
      fontWeight: PROJECT_OG_CHIP_FONT_WEIGHT,
    }),
    12,
  );
  const safeMaxTextWidth = Math.max(maxTextWidth, fallbackWidth);
  const text = measureEllipsizedChipLine(
    normalizedChip,
    safeMaxTextWidth,
    layout.tagFontSize,
    PROJECT_OG_CHIP_FONT_WEIGHT,
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
    fontWeight: PROJECT_OG_CHIP_FONT_WEIGHT,
  });
  return {
    text,
    textWidth,
    width: textWidth + layout.tagPaddingX * 2,
    truncated: text !== normalizedChip,
    usable: true,
  };
};

export const buildProjectOgChipLayouts = (chips, layout = DEFAULT_PROJECT_OG_LAYOUT) => {
  const safeChips = Array.isArray(chips) ? chips.filter(Boolean) : [];
  if (safeChips.length === 0) {
    return [];
  }
  const minTextWidth = measureTextWidth({
    text: "...",
    fontSize: layout.tagFontSize,
    fontWeight: PROJECT_OG_CHIP_FONT_WEIGHT,
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
      fontWeight: PROJECT_OG_CHIP_FONT_WEIGHT,
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
