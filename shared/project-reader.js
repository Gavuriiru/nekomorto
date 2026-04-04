const normalizeText = (value) => String(value || "").trim();

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const PROJECT_EPISODE_CONTENT_FORMATS = Object.freeze({
  LEXICAL: "lexical",
  IMAGES: "images",
});

export const PROJECT_READER_DIRECTIONS = Object.freeze({
  RTL: "rtl",
  LTR: "ltr",
});

export const PROJECT_READER_LAYOUTS = Object.freeze({
  SINGLE: "single",
  DOUBLE: "double",
  SCROLL_VERTICAL: "scroll-vertical",
  SCROLL_HORIZONTAL: "scroll-horizontal",
});

export const PROJECT_READER_IMAGE_FITS = Object.freeze({
  BOTH: "both",
  NONE: "none",
  WIDTH: "width",
  HEIGHT: "height",
});

export const PROJECT_READER_BACKGROUNDS = Object.freeze({
  THEME: "theme",
  BLACK: "black",
  WHITE: "white",
});

export const PROJECT_READER_PROGRESS_STYLES = Object.freeze({
  DEFAULT: "default",
  HIDDEN: "hidden",
});

export const PROJECT_READER_PROGRESS_POSITIONS = Object.freeze({
  BOTTOM: "bottom",
  LEFT: "left",
  RIGHT: "right",
});

export const PROJECT_READER_CHROME_MODES = Object.freeze({
  DEFAULT: "default",
  CINEMA: "cinema",
});

export const PROJECT_READER_VIEWPORT_MODES = Object.freeze({
  VIEWPORT: "viewport",
  NATURAL: "natural",
});

export const PROJECT_READER_SITE_HEADER_VARIANTS = Object.freeze({
  FIXED: "fixed",
  STATIC: "static",
});

export const PROJECT_READER_VIEW_MODES = Object.freeze({
  PAGE: "page",
  SCROLL: "scroll",
});

export const PROJECT_READER_TYPE_KEYS = Object.freeze({
  MANGA: "manga",
  WEBTOON: "webtoon",
  DEFAULT: "default",
});

export const normalizeProjectEpisodeContentFormat = (value, fallback = "lexical") => {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === PROJECT_EPISODE_CONTENT_FORMATS.IMAGES) {
    return PROJECT_EPISODE_CONTENT_FORMATS.IMAGES;
  }
  if (normalized === PROJECT_EPISODE_CONTENT_FORMATS.LEXICAL) {
    return PROJECT_EPISODE_CONTENT_FORMATS.LEXICAL;
  }
  return fallback === PROJECT_EPISODE_CONTENT_FORMATS.IMAGES
    ? PROJECT_EPISODE_CONTENT_FORMATS.IMAGES
    : PROJECT_EPISODE_CONTENT_FORMATS.LEXICAL;
};

export const normalizeProjectEpisodePages = (value) =>
  (() => {
    const normalizedPages = (Array.isArray(value) ? value : [])
      .map((entry, index) => {
        const position = toFiniteNumber(entry?.position);
        const imageUrl = normalizeText(entry?.imageUrl);
        if (!imageUrl) {
          return null;
        }
        const spreadPairId = normalizeText(entry?.spreadPairId);
        const width = toFiniteNumber(entry?.width);
        const height = toFiniteNumber(entry?.height);
        return {
          position: position !== null && position >= 0 ? Math.floor(position) : index,
          imageUrl,
          spreadPairId: spreadPairId || undefined,
          width: width !== null && width > 0 ? Math.round(width) : undefined,
          height: height !== null && height > 0 ? Math.round(height) : undefined,
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.position - right.position)
      .map((entry, index) => ({
        position: index,
        imageUrl: entry.imageUrl,
        ...(typeof entry.width === "number" ? { width: entry.width } : {}),
        ...(typeof entry.height === "number" ? { height: entry.height } : {}),
        spreadPairId: entry.spreadPairId,
      }));

    const spreadPairIndices = new Map();
    normalizedPages.forEach((page, index) => {
      if (!page.spreadPairId) {
        return;
      }
      const bucket = spreadPairIndices.get(page.spreadPairId) || [];
      bucket.push(index);
      spreadPairIndices.set(page.spreadPairId, bucket);
    });

    const validSpreadPairIds = new Set(
      [...spreadPairIndices.entries()]
        .filter(([, indices]) => indices.length === 2 && indices[1] - indices[0] === 1)
        .map(([spreadPairId]) => spreadPairId),
    );

    return normalizedPages.map((page) => ({
      position: page.position,
      imageUrl: page.imageUrl,
      ...(typeof page.width === "number" ? { width: page.width } : {}),
      ...(typeof page.height === "number" ? { height: page.height } : {}),
      ...(page.spreadPairId && validSpreadPairIds.has(page.spreadPairId)
        ? { spreadPairId: page.spreadPairId }
        : {}),
    }));
  })();

export const getProjectEpisodePageCount = (episode) => {
  const explicit = toFiniteNumber(episode?.pageCount);
  if (explicit !== null && explicit >= 0) {
    return Math.floor(explicit);
  }
  return normalizeProjectEpisodePages(episode?.pages).length;
};

export const hasProjectEpisodePages = (episode) => getProjectEpisodePageCount(episode) > 0;

export const hasProjectEpisodeLexicalContent = (episode) =>
  typeof episode?.content === "string" && episode.content.trim().length > 0;

export const hasProjectEpisodeReadableContent = (episode) => {
  const contentFormat = normalizeProjectEpisodeContentFormat(episode?.contentFormat);
  if (contentFormat === PROJECT_EPISODE_CONTENT_FORMATS.IMAGES) {
    return hasProjectEpisodePages(episode);
  }
  return hasProjectEpisodeLexicalContent(episode);
};

const normalizeProjectTypeKey = (value) =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const LEGACY_THEME_PRESET_TO_BACKGROUND = Object.freeze({
  black: PROJECT_READER_BACKGROUNDS.BLACK,
  dark: PROJECT_READER_BACKGROUNDS.BLACK,
  white: PROJECT_READER_BACKGROUNDS.WHITE,
  light: PROJECT_READER_BACKGROUNDS.WHITE,
  manga: PROJECT_READER_BACKGROUNDS.THEME,
  webtoon: PROJECT_READER_BACKGROUNDS.THEME,
  default: PROJECT_READER_BACKGROUNDS.THEME,
});

const normalizeReaderLayout = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized === PROJECT_READER_LAYOUTS.SINGLE ||
    normalized === PROJECT_READER_LAYOUTS.DOUBLE ||
    normalized === PROJECT_READER_LAYOUTS.SCROLL_VERTICAL ||
    normalized === PROJECT_READER_LAYOUTS.SCROLL_HORIZONTAL
  ) {
    return normalized;
  }
  return "";
};

const normalizeReaderImageFit = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized === PROJECT_READER_IMAGE_FITS.BOTH ||
    normalized === PROJECT_READER_IMAGE_FITS.NONE ||
    normalized === PROJECT_READER_IMAGE_FITS.WIDTH ||
    normalized === PROJECT_READER_IMAGE_FITS.HEIGHT
  ) {
    return normalized;
  }
  return "";
};

const normalizeReaderBackground = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized === PROJECT_READER_BACKGROUNDS.THEME ||
    normalized === PROJECT_READER_BACKGROUNDS.BLACK ||
    normalized === PROJECT_READER_BACKGROUNDS.WHITE
  ) {
    return normalized;
  }
  return "";
};

const normalizeReaderProgressStyle = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === PROJECT_READER_PROGRESS_STYLES.HIDDEN) {
    return PROJECT_READER_PROGRESS_STYLES.HIDDEN;
  }
  if (
    normalized === PROJECT_READER_PROGRESS_STYLES.DEFAULT ||
    normalized === "bar" ||
    normalized === "glow"
  ) {
    return PROJECT_READER_PROGRESS_STYLES.DEFAULT;
  }
  return "";
};

const normalizeReaderProgressPosition = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized === PROJECT_READER_PROGRESS_POSITIONS.BOTTOM ||
    normalized === PROJECT_READER_PROGRESS_POSITIONS.LEFT ||
    normalized === PROJECT_READER_PROGRESS_POSITIONS.RIGHT
  ) {
    return normalized;
  }
  return "";
};

const normalizeReaderChromeMode = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized === PROJECT_READER_CHROME_MODES.DEFAULT ||
    normalized === PROJECT_READER_CHROME_MODES.CINEMA
  ) {
    return normalized;
  }
  return "";
};

const normalizeReaderViewportMode = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized === PROJECT_READER_VIEWPORT_MODES.VIEWPORT ||
    normalized === PROJECT_READER_VIEWPORT_MODES.NATURAL
  ) {
    return normalized;
  }
  return "";
};

const normalizeReaderSiteHeaderVariant = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized === PROJECT_READER_SITE_HEADER_VARIANTS.FIXED ||
    normalized === PROJECT_READER_SITE_HEADER_VARIANTS.STATIC
  ) {
    return normalized;
  }
  return "";
};

const resolveLegacyReaderLayout = ({ rawLayout, rawViewMode, rawAllowSpread, presetLayout }) => {
  if (rawLayout) {
    return rawLayout;
  }
  if (rawViewMode === PROJECT_READER_VIEW_MODES.SCROLL) {
    return PROJECT_READER_LAYOUTS.SCROLL_VERTICAL;
  }
  if (rawViewMode === PROJECT_READER_VIEW_MODES.PAGE) {
    return rawAllowSpread === true ? PROJECT_READER_LAYOUTS.DOUBLE : PROJECT_READER_LAYOUTS.SINGLE;
  }
  return presetLayout;
};

const resolveLegacyReaderBackground = ({ rawBackground, rawThemePreset, presetBackground }) => {
  if (rawBackground) {
    return rawBackground;
  }
  return LEGACY_THEME_PRESET_TO_BACKGROUND[rawThemePreset] || presetBackground;
};

const resolveLegacyReaderProgressStyle = ({
  rawProgressStyle,
  rawShowFooter,
  presetProgressStyle,
}) => {
  if (rawProgressStyle) {
    return rawProgressStyle;
  }
  if (rawShowFooter === false) {
    return PROJECT_READER_PROGRESS_STYLES.HIDDEN;
  }
  return presetProgressStyle;
};

export const normalizeProjectReaderTypeKey = (projectType) => {
  const normalized = normalizeProjectTypeKey(projectType);
  if (normalized.includes("webtoon")) {
    return PROJECT_READER_TYPE_KEYS.WEBTOON;
  }
  if (normalized.includes("mang")) {
    return PROJECT_READER_TYPE_KEYS.MANGA;
  }
  return PROJECT_READER_TYPE_KEYS.DEFAULT;
};

const PROJECT_READER_BASE_PRESET = Object.freeze({
  direction: PROJECT_READER_DIRECTIONS.LTR,
  layout: PROJECT_READER_LAYOUTS.SINGLE,
  imageFit: PROJECT_READER_IMAGE_FITS.BOTH,
  background: PROJECT_READER_BACKGROUNDS.THEME,
  progressStyle: PROJECT_READER_PROGRESS_STYLES.DEFAULT,
  progressPosition: PROJECT_READER_PROGRESS_POSITIONS.BOTTOM,
  firstPageSingle: true,
  chromeMode: PROJECT_READER_CHROME_MODES.DEFAULT,
  viewportMode: PROJECT_READER_VIEWPORT_MODES.VIEWPORT,
  siteHeaderVariant: PROJECT_READER_SITE_HEADER_VARIANTS.FIXED,
  showSiteFooter: true,
  previewLimit: null,
  purchaseUrl: "",
  purchasePrice: "",
});

export const getProjectReaderPresetByType = (projectType) => {
  const typeKey = normalizeProjectReaderTypeKey(projectType);
  if (typeKey === PROJECT_READER_TYPE_KEYS.WEBTOON) {
    return {
      ...PROJECT_READER_BASE_PRESET,
      direction: PROJECT_READER_DIRECTIONS.LTR,
      layout: PROJECT_READER_LAYOUTS.SCROLL_VERTICAL,
      imageFit: PROJECT_READER_IMAGE_FITS.WIDTH,
      firstPageSingle: false,
      chromeMode: PROJECT_READER_CHROME_MODES.CINEMA,
      viewportMode: PROJECT_READER_VIEWPORT_MODES.NATURAL,
      siteHeaderVariant: PROJECT_READER_SITE_HEADER_VARIANTS.STATIC,
      showSiteFooter: false,
    };
  }
  if (typeKey === PROJECT_READER_TYPE_KEYS.MANGA) {
    return {
      ...PROJECT_READER_BASE_PRESET,
      direction: PROJECT_READER_DIRECTIONS.RTL,
      layout: PROJECT_READER_LAYOUTS.SINGLE,
      imageFit: PROJECT_READER_IMAGE_FITS.BOTH,
      firstPageSingle: true,
      chromeMode: PROJECT_READER_CHROME_MODES.DEFAULT,
      viewportMode: PROJECT_READER_VIEWPORT_MODES.VIEWPORT,
      siteHeaderVariant: PROJECT_READER_SITE_HEADER_VARIANTS.FIXED,
      showSiteFooter: true,
    };
  }
  return { ...PROJECT_READER_BASE_PRESET };
};

export const normalizeProjectReaderConfig = (value, { projectType } = {}) => {
  const preset = PROJECT_READER_BASE_PRESET;
  const raw = isPlainObject(value) ? value : {};
  const direction = normalizeText(raw.direction).toLowerCase();
  const layout = normalizeReaderLayout(raw.layout);
  const imageFit = normalizeReaderImageFit(raw.imageFit);
  const background = normalizeReaderBackground(raw.background);
  const progressStyle = normalizeReaderProgressStyle(raw.progressStyle);
  const progressPosition = normalizeReaderProgressPosition(raw.progressPosition);
  const chromeMode = normalizeReaderChromeMode(raw.chromeMode);
  const viewportMode = normalizeReaderViewportMode(raw.viewportMode);
  const siteHeaderVariant =
    typeof raw.showSiteHeader === "boolean"
      ? raw.showSiteHeader
        ? PROJECT_READER_SITE_HEADER_VARIANTS.FIXED
        : PROJECT_READER_SITE_HEADER_VARIANTS.STATIC
      : normalizeReaderSiteHeaderVariant(raw.siteHeaderVariant);
  const showSiteFooter =
    typeof raw.showSiteFooter === "boolean"
      ? raw.showSiteFooter
      : typeof raw.showFooter === "boolean"
        ? raw.showFooter
        : null;
  const viewMode = normalizeText(raw.viewMode).toLowerCase();
  const themePreset = normalizeText(raw.themePreset).toLowerCase();
  const previewLimit = toFiniteNumber(raw.previewLimit);
  const allowSpread = typeof raw.allowSpread === "boolean" ? raw.allowSpread : null;
  const showFooter = typeof raw.showFooter === "boolean" ? raw.showFooter : null;

  return {
    direction:
      direction === PROJECT_READER_DIRECTIONS.LTR || direction === PROJECT_READER_DIRECTIONS.RTL
        ? direction
        : preset.direction,
    layout: resolveLegacyReaderLayout({
      rawLayout: layout,
      rawViewMode: viewMode,
      rawAllowSpread: allowSpread,
      presetLayout: preset.layout,
    }),
    imageFit: imageFit || preset.imageFit,
    background: resolveLegacyReaderBackground({
      rawBackground: background,
      rawThemePreset: themePreset,
      presetBackground: preset.background,
    }),
    progressStyle: resolveLegacyReaderProgressStyle({
      rawProgressStyle: progressStyle,
      rawShowFooter: showFooter,
      presetProgressStyle: preset.progressStyle,
    }),
    progressPosition: progressPosition || preset.progressPosition,
    firstPageSingle:
      typeof raw.firstPageSingle === "boolean" ? raw.firstPageSingle : preset.firstPageSingle,
    chromeMode: chromeMode || preset.chromeMode,
    viewportMode: viewportMode || preset.viewportMode,
    siteHeaderVariant: siteHeaderVariant || preset.siteHeaderVariant,
    showSiteFooter: typeof showSiteFooter === "boolean" ? showSiteFooter : preset.showSiteFooter,
    previewLimit:
      previewLimit !== null && previewLimit > 0 ? Math.floor(previewLimit) : preset.previewLimit,
    purchaseUrl: normalizeText(raw.purchaseUrl) || preset.purchaseUrl,
    purchasePrice: normalizeText(raw.purchasePrice) || preset.purchasePrice,
  };
};

const normalizeProjectReaderPreferenceEntry = (value) => {
  const raw = isPlainObject(value) ? value : {};
  const direction = normalizeText(raw.direction).toLowerCase();
  const layout = normalizeReaderLayout(raw.layout);
  const imageFit = normalizeReaderImageFit(raw.imageFit);
  const background = normalizeReaderBackground(raw.background);
  const progressStyle = normalizeReaderProgressStyle(raw.progressStyle);
  const progressPosition = normalizeReaderProgressPosition(raw.progressPosition);
  const siteHeaderVariant = normalizeReaderSiteHeaderVariant(raw.siteHeaderVariant);
  const viewMode = normalizeText(raw.viewMode).toLowerCase();
  const themePreset = normalizeText(raw.themePreset).toLowerCase();
  const allowSpread = typeof raw.allowSpread === "boolean" ? raw.allowSpread : null;
  const showFooter = typeof raw.showFooter === "boolean" ? raw.showFooter : null;
  const next = {};

  if (direction === PROJECT_READER_DIRECTIONS.LTR || direction === PROJECT_READER_DIRECTIONS.RTL) {
    next.direction = direction;
  }

  if (layout) {
    next.layout = layout;
  } else if (viewMode === PROJECT_READER_VIEW_MODES.SCROLL) {
    next.layout = PROJECT_READER_LAYOUTS.SCROLL_VERTICAL;
  } else if (viewMode === PROJECT_READER_VIEW_MODES.PAGE) {
    next.layout =
      allowSpread === true ? PROJECT_READER_LAYOUTS.DOUBLE : PROJECT_READER_LAYOUTS.SINGLE;
  }

  if (imageFit) {
    next.imageFit = imageFit;
  }

  if (background) {
    next.background = background;
  } else if (themePreset && LEGACY_THEME_PRESET_TO_BACKGROUND[themePreset]) {
    next.background = LEGACY_THEME_PRESET_TO_BACKGROUND[themePreset];
  }

  if (progressStyle) {
    next.progressStyle = progressStyle;
  } else if (showFooter === false) {
    next.progressStyle = PROJECT_READER_PROGRESS_STYLES.HIDDEN;
  }

  if (progressPosition) {
    next.progressPosition = progressPosition;
  }

  if (typeof raw.firstPageSingle === "boolean") {
    next.firstPageSingle = raw.firstPageSingle;
  }

  if (typeof raw.showSiteHeader === "boolean") {
    next.siteHeaderVariant = raw.showSiteHeader
      ? PROJECT_READER_SITE_HEADER_VARIANTS.FIXED
      : PROJECT_READER_SITE_HEADER_VARIANTS.STATIC;
  } else if (siteHeaderVariant) {
    next.siteHeaderVariant = siteHeaderVariant;
  }

  return next;
};

export const mergeProjectReaderConfig = (baseConfig, overrideConfig, { projectType } = {}) =>
  normalizeProjectReaderConfig(
    {
      ...normalizeProjectReaderConfig(baseConfig, { projectType }),
      ...(isPlainObject(overrideConfig) ? overrideConfig : {}),
    },
    { projectType },
  );

export const getSiteProjectReaderConfig = (siteSettings, projectType) => {
  const typeKey = normalizeProjectReaderTypeKey(projectType);
  if (
    typeKey === PROJECT_READER_TYPE_KEYS.DEFAULT ||
    !isPlainObject(siteSettings?.reader?.projectTypes)
  ) {
    return null;
  }
  const entry = siteSettings.reader.projectTypes[typeKey];
  if (!isPlainObject(entry) || Object.keys(entry).length === 0) {
    return null;
  }
  return entry;
};

export const resolveProjectReaderConfig = ({
  projectType,
  siteSettings,
  siteReaderConfig,
  projectReaderConfig,
} = {}) => {
  const sitePreset = getSiteProjectReaderConfig(siteSettings, projectType);
  return normalizeProjectReaderConfig(
    {
      ...(sitePreset || {}),
      ...(isPlainObject(projectReaderConfig) ? projectReaderConfig : {}),
      ...(isPlainObject(siteReaderConfig) ? siteReaderConfig : {}),
    },
    { projectType },
  );
};

export const normalizeProjectReaderPreferences = (value) => {
  if (!isPlainObject(value)) {
    return {};
  }

  const rawProjectTypes = isPlainObject(value.projectTypes) ? value.projectTypes : {};
  const projectTypes = {};

  [PROJECT_READER_TYPE_KEYS.MANGA, PROJECT_READER_TYPE_KEYS.WEBTOON].forEach((typeKey) => {
    if (!isPlainObject(rawProjectTypes[typeKey])) {
      return;
    }
    const normalizedEntry = normalizeProjectReaderPreferenceEntry(rawProjectTypes[typeKey]);
    if (Object.keys(normalizedEntry).length === 0) {
      return;
    }
    projectTypes[typeKey] = normalizedEntry;
  });

  if (Object.keys(projectTypes).length === 0) {
    return {};
  }

  return { projectTypes };
};

export const getProjectReaderPreferenceByType = (value, projectType) => {
  const typeKey = normalizeProjectReaderTypeKey(projectType);
  if (typeKey === PROJECT_READER_TYPE_KEYS.DEFAULT) {
    return null;
  }
  const normalized = normalizeProjectReaderPreferences(value);
  const projectTypes = isPlainObject(normalized.projectTypes) ? normalized.projectTypes : {};
  return isPlainObject(projectTypes[typeKey]) ? projectTypes[typeKey] : null;
};
