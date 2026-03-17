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
  (Array.isArray(value) ? value : [])
    .map((entry, index) => {
      const position = toFiniteNumber(entry?.position);
      const imageUrl = normalizeText(entry?.imageUrl);
      if (!imageUrl) {
        return null;
      }
      return {
        position: position !== null && position >= 0 ? Math.floor(position) : index,
        imageUrl,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.position - right.position)
    .map((entry, index) => ({
      position: index,
      imageUrl: entry.imageUrl,
    }));

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

export const getProjectReaderPresetByType = (projectType) => {
  const typeKey = normalizeProjectReaderTypeKey(projectType);
  if (typeKey === PROJECT_READER_TYPE_KEYS.WEBTOON) {
    return {
      direction: PROJECT_READER_DIRECTIONS.LTR,
      viewMode: PROJECT_READER_VIEW_MODES.SCROLL,
      firstPageSingle: false,
      allowSpread: false,
      showFooter: true,
      previewLimit: null,
      purchaseUrl: "",
      purchasePrice: "",
      themePreset: "webtoon",
    };
  }
  if (typeKey === PROJECT_READER_TYPE_KEYS.MANGA) {
    return {
      direction: PROJECT_READER_DIRECTIONS.RTL,
      viewMode: PROJECT_READER_VIEW_MODES.PAGE,
      firstPageSingle: true,
      allowSpread: true,
      showFooter: true,
      previewLimit: null,
      purchaseUrl: "",
      purchasePrice: "",
      themePreset: "manga",
    };
  }
  return {
    direction: PROJECT_READER_DIRECTIONS.LTR,
    viewMode: PROJECT_READER_VIEW_MODES.PAGE,
    firstPageSingle: true,
    allowSpread: false,
    showFooter: true,
    previewLimit: null,
    purchaseUrl: "",
    purchasePrice: "",
    themePreset: "default",
  };
};

export const normalizeProjectReaderConfig = (value, { projectType } = {}) => {
  const preset = getProjectReaderPresetByType(projectType);
  const raw = isPlainObject(value) ? value : {};
  const direction = normalizeText(raw.direction).toLowerCase();
  const viewMode = normalizeText(raw.viewMode).toLowerCase();
  const previewLimit = toFiniteNumber(raw.previewLimit);

  return {
    direction:
      direction === PROJECT_READER_DIRECTIONS.LTR || direction === PROJECT_READER_DIRECTIONS.RTL
        ? direction
        : preset.direction,
    viewMode:
      viewMode === PROJECT_READER_VIEW_MODES.SCROLL || viewMode === PROJECT_READER_VIEW_MODES.PAGE
        ? viewMode
        : preset.viewMode,
    firstPageSingle:
      typeof raw.firstPageSingle === "boolean" ? raw.firstPageSingle : preset.firstPageSingle,
    allowSpread: typeof raw.allowSpread === "boolean" ? raw.allowSpread : preset.allowSpread,
    showFooter: typeof raw.showFooter === "boolean" ? raw.showFooter : preset.showFooter,
    previewLimit:
      previewLimit !== null && previewLimit > 0 ? Math.floor(previewLimit) : preset.previewLimit,
    purchaseUrl: normalizeText(raw.purchaseUrl) || preset.purchaseUrl,
    purchasePrice: normalizeText(raw.purchasePrice) || preset.purchasePrice,
    themePreset: normalizeText(raw.themePreset) || preset.themePreset,
  };
};

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
  if (isPlainObject(siteReaderConfig) && Object.keys(siteReaderConfig).length > 0) {
    return normalizeProjectReaderConfig(siteReaderConfig, { projectType });
  }

  const sitePreset = getSiteProjectReaderConfig(siteSettings, projectType);
  if (sitePreset) {
    return normalizeProjectReaderConfig(sitePreset, { projectType });
  }

  if (isPlainObject(projectReaderConfig) && Object.keys(projectReaderConfig).length > 0) {
    return normalizeProjectReaderConfig(projectReaderConfig, { projectType });
  }

  return normalizeProjectReaderConfig({}, { projectType });
};
