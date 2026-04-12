import { hasProjectEpisodeLexicalContent, hasProjectEpisodePages } from "./project-reader.js";

const normalizeText = (value) => String(value || "").trim();

const normalizeProjectTypeKey = (value) =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const PROJECT_EPISODE_PUBLICATION_RULES = Object.freeze({
  DOWNLOAD_ONLY: "download_only",
  READER_CONTENT_OR_DOWNLOAD: "reader_content_or_download",
});

export const PROJECT_EPISODE_PUBLICATION_ERRORS = Object.freeze({
  DOWNLOAD_SOURCES_REQUIRED: "download_sources_required_for_publication",
  READER_CONTENT_OR_DOWNLOAD_REQUIRED: "reader_content_or_download_required_for_publication",
});

export const getProjectEpisodePublicationStatus = (episode) =>
  normalizeText(episode?.publicationStatus).toLowerCase() === "draft" ? "draft" : "published";

export const isProjectEpisodeLightNovelType = (projectType) => {
  const normalized = normalizeProjectTypeKey(projectType);
  return normalized.includes("light") || normalized.includes("novel");
};

export const isProjectEpisodeMangaType = (projectType) => {
  const normalized = normalizeProjectTypeKey(projectType);
  return normalized.includes("mang") || normalized.includes("webtoon");
};

export const isProjectEpisodeChapterBasedType = (projectType) =>
  isProjectEpisodeLightNovelType(projectType) || isProjectEpisodeMangaType(projectType);

export const isProjectEpisodeDownloadSourceComplete = (source) => {
  const label = normalizeText(source?.label);
  const url = normalizeText(source?.url);
  return Boolean(label && url);
};

export const getProjectEpisodeCompleteDownloadSources = (episode) =>
  (Array.isArray(episode?.sources) ? episode.sources : [])
    .map((source) => ({
      label: normalizeText(source?.label),
      url: normalizeText(source?.url),
    }))
    .filter(isProjectEpisodeDownloadSourceComplete);

export const hasProjectEpisodePublicationDownloadSources = (episode) =>
  getProjectEpisodeCompleteDownloadSources(episode).length > 0;

export const hasProjectEpisodePublicationReadableContent = (projectType, episode) => {
  if (isProjectEpisodeLightNovelType(projectType)) {
    return hasProjectEpisodeLexicalContent(episode);
  }
  if (isProjectEpisodeMangaType(projectType)) {
    return hasProjectEpisodePages(episode);
  }
  return false;
};

export const getProjectEpisodePublicationRule = (projectType) =>
  isProjectEpisodeChapterBasedType(projectType)
    ? PROJECT_EPISODE_PUBLICATION_RULES.READER_CONTENT_OR_DOWNLOAD
    : PROJECT_EPISODE_PUBLICATION_RULES.DOWNLOAD_ONLY;

export const resolveProjectEpisodePublicationState = (projectType, episode) => {
  const publicationStatus = getProjectEpisodePublicationStatus(episode);
  const publicationRule = getProjectEpisodePublicationRule(projectType);
  const hasDownloadSource = hasProjectEpisodePublicationDownloadSources(episode);
  const hasReadableContent = hasProjectEpisodePublicationReadableContent(projectType, episode);
  const isPublicationReady =
    publicationRule === PROJECT_EPISODE_PUBLICATION_RULES.DOWNLOAD_ONLY
      ? hasDownloadSource
      : hasDownloadSource || hasReadableContent;
  const errorCode =
    publicationStatus === "published" && !isPublicationReady
      ? publicationRule === PROJECT_EPISODE_PUBLICATION_RULES.DOWNLOAD_ONLY
        ? PROJECT_EPISODE_PUBLICATION_ERRORS.DOWNLOAD_SOURCES_REQUIRED
        : PROJECT_EPISODE_PUBLICATION_ERRORS.READER_CONTENT_OR_DOWNLOAD_REQUIRED
      : null;

  return {
    publicationStatus,
    publicationRule,
    hasDownloadSource,
    hasReadableContent,
    isPublicationReady,
    errorCode,
  };
};

export const isProjectEpisodePublic = (projectType, episode) => {
  const publicationState = resolveProjectEpisodePublicationState(projectType, episode);
  return publicationState.publicationStatus === "published" && publicationState.isPublicationReady;
};
