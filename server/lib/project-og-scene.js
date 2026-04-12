import React from "react";
import { ImageResponse } from "@vercel/og";
import { mixHexColors } from "./og-color.js";
import {
  OG_PROJECT_HEIGHT,
  OG_PROJECT_WIDTH,
  PROJECT_OG_CHIP_FONT_WEIGHT,
  PROJECT_OG_EYEBROW_FONT_WEIGHT,
  PROJECT_OG_SUBTITLE_FONT_WEIGHT,
  PROJECT_OG_TITLE_FONT_WEIGHT,
  buildProjectOgFonts,
  measureTextWidth,
} from "./project-og-assets.js";
import {
  PROJECT_OG_TITLE_LINE_HEIGHT,
  buildProjectOgChipLayouts,
  cloneProjectOgLayout,
} from "./project-og-layout.js";
import { normalizeProjectOgKey, resolveProjectOgPalette } from "./project-og-text.js";

const createElement = React.createElement;

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
        fontWeight: PROJECT_OG_TITLE_FONT_WEIGHT,
        lineHeight: model.titleLineHeight,
        letterSpacing: 0,
      },
    },
    ...(Array.isArray(model.titleLineLayouts) && model.titleLineLayouts.length > 0
      ? model.titleLineLayouts
      : (Array.isArray(model.titleLines)
          ? model.titleLines
          : [String(model.title || "Projeto")]
        ).map((line) => ({
          text: line,
          maxWidth: model.layout.titleWidth,
        }))
    ).map((line, index) =>
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
        fontWeight: PROJECT_OG_EYEBROW_FONT_WEIGHT,
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
    const lineHeightPx = (Number(model.layout?.subtitleFontSize) || 0) * 1.2;
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
          fontWeight: PROJECT_OG_SUBTITLE_FONT_WEIGHT,
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
  const subtitleAvatarSrc = resolveRenderableImageSrc({
    dataUrl: model.subtitleAvatarDataUrl,
    url: model.subtitleAvatarUrl,
  });
  const hasSubtitleAvatar = Boolean(subtitleAvatarSrc);
  const shouldNoWrap = Boolean(model.subtitleNoWrap);
  const subtitleWidth = Number(model.layout?.subtitleMaxWidth) || 0;
  const subtitleAvatarSize = hasSubtitleAvatar ? Number(model.layout?.subtitleAvatarSize) || 27 : 0;
  const subtitleAvatarGap = hasSubtitleAvatar ? Number(model.layout?.subtitleAvatarGap) || 8 : 0;
  const subtitleTextMaxWidth =
    shouldNoWrap && subtitleWidth > 0
      ? Math.max(
          0,
          Number(model.subtitleTextMaxWidth) ||
            subtitleWidth - subtitleAvatarSize - subtitleAvatarGap,
        )
      : 0;
  const measuredSubtitleWidth = measureTextWidth({
    text: subtitle,
    fontSize: Number(model.layout?.subtitleFontSize) || 0,
    fontWeight: PROJECT_OG_SUBTITLE_FONT_WEIGHT,
  });
  const subtitleTextRenderWidth =
    shouldNoWrap && subtitleWidth > 0
      ? Math.min(
          Number(model.subtitleTextRenderWidth) || measuredSubtitleWidth,
          subtitleTextMaxWidth || subtitleWidth,
        )
      : 0;
  const subtitleRenderWidth =
    shouldNoWrap && subtitleWidth > 0
      ? Number(model.subtitleRenderWidth) ||
        subtitleTextRenderWidth + (hasSubtitleAvatar ? subtitleAvatarSize + subtitleAvatarGap : 0)
      : 0;
  const subtitleContainerWidth =
    shouldNoWrap && subtitleWidth > 0
      ? Math.min(subtitleWidth, subtitleRenderWidth + (hasSubtitleAvatar ? 8 : 0))
      : 0;

  if (hasSubtitleAvatar) {
    return createElement(
      "div",
      {
        style: {
          position: "absolute",
          left: model.layout.subtitleLeft,
          top: model.subtitleTop,
          width: subtitleContainerWidth || subtitleRenderWidth || undefined,
          maxWidth: model.layout.subtitleMaxWidth,
          display: "flex",
          alignItems: "center",
          gap: subtitleAvatarGap,
          color: model.palette.accentPrimary,
          fontFamily: "Geist",
          fontSize: model.layout.subtitleFontSize,
          fontWeight: PROJECT_OG_SUBTITLE_FONT_WEIGHT,
          lineHeight: 1.2,
        },
      },
      createElement(
        "div",
        {
          style: {
            minWidth: 0,
            maxWidth: subtitleTextMaxWidth || undefined,
            display: "block",
            flexShrink: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
        },
        subtitle,
      ),
      createElement(
        "div",
        {
          "data-og-part": "subtitle-avatar",
          style: {
            width: subtitleAvatarSize,
            height: subtitleAvatarSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: subtitleAvatarSize / 2,
            overflow: "hidden",
            backgroundColor: "rgba(255, 255, 255, 0.12)",
            flexShrink: 0,
          },
        },
        createElement("img", {
          src: subtitleAvatarSrc,
          alt: "",
          width: subtitleAvatarSize,
          height: subtitleAvatarSize,
          style: {
            display: "block",
            width: subtitleAvatarSize,
            height: subtitleAvatarSize,
            borderRadius: subtitleAvatarSize / 2,
            objectFit: "cover",
          },
        }),
      ),
    );
  }

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
              width: subtitleRenderWidth || subtitleWidth,
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
        fontWeight: PROJECT_OG_SUBTITLE_FONT_WEIGHT,
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
      : buildProjectOgChipLayouts(model.chips, model.layout);
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
          key: `chip-${normalizeProjectOgKey(chip.text)}-${index}`,
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
            fontWeight: PROJECT_OG_CHIP_FONT_WEIGHT,
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

export const buildLegacyProjectOgScene = (model) => buildProjectOgScene(model);

export const buildProjectOgScene = (model = {}) => {
  const layout = {
    ...cloneProjectOgLayout(),
    ...(model?.layout && typeof model.layout === "object" ? model.layout : {}),
  };
  const palette =
    model?.palette && typeof model.palette === "object" ? model.palette : resolveProjectOgPalette();
  const safeModel = {
    ...model,
    layout,
    palette,
    title: String(model?.title || "").trim() || "Projeto",
    titleLines:
      Array.isArray(model?.titleLines) && model.titleLines.length > 0
        ? model.titleLines
        : ["Projeto"],
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
    titleLineHeight: Number(model?.titleLineHeight) || PROJECT_OG_TITLE_LINE_HEIGHT,
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
