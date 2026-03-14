import { createStableRevisionToken } from "./stable-revision-token.js";
import {
  hasProjectEpisodeReadableContent,
  normalizeProjectEpisodePages,
} from "./project-reader.js";

export const PROJECT_READING_OG_SCENE_VERSION = "project-reading-og-v2";

const normalizeText = (value) => String(value || "").trim();
const normalizeKey = (value) => normalizeText(value).toLowerCase();

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isExtraChapter = (chapter) => normalizeKey(chapter?.entryKind) === "extra";

const hasReadableChapterContent = (chapter) =>
  Boolean(chapter?.hasContent) ||
  Boolean(chapter?.hasPages) ||
  hasProjectEpisodeReadableContent(chapter);

const buildEpisodeKey = (number, volume) => {
  const safeNumber = toFiniteNumber(number);
  if (safeNumber === null) {
    return "";
  }
  const safeVolume = toFiniteNumber(volume);
  return `${safeNumber}:${safeVolume === null ? 0 : safeVolume}`;
};

const sortReadableChapters = (chapters) =>
  (Array.isArray(chapters) ? chapters : [])
    .filter((chapter) => hasReadableChapterContent(chapter))
    .slice()
    .sort((left, right) => {
      const leftReadingOrder = toFiniteNumber(left?.readingOrder);
      const rightReadingOrder = toFiniteNumber(right?.readingOrder);
      const hasLeftReadingOrder = leftReadingOrder !== null;
      const hasRightReadingOrder = rightReadingOrder !== null;
      if (hasLeftReadingOrder || hasRightReadingOrder) {
        if (!hasLeftReadingOrder) {
          return 1;
        }
        if (!hasRightReadingOrder) {
          return -1;
        }
        if (leftReadingOrder !== rightReadingOrder) {
          return leftReadingOrder - rightReadingOrder;
        }
      }

      const numberDelta = (toFiniteNumber(left?.number) || 0) - (toFiniteNumber(right?.number) || 0);
      if (numberDelta !== 0) {
        return numberDelta;
      }
      return (toFiniteNumber(left?.volume) || 0) - (toFiniteNumber(right?.volume) || 0);
    });

const findChapterByRoute = ({ project, chapterNumber, volume }) => {
  const safeChapterNumber = toFiniteNumber(chapterNumber);
  if (!project || safeChapterNumber === null) {
    return null;
  }

  const sortedChapters = sortReadableChapters(project?.episodeDownloads);
  if (sortedChapters.length === 0) {
    return null;
  }

  const safeVolume = toFiniteNumber(volume);
  const lookupKey = buildEpisodeKey(safeChapterNumber, safeVolume);
  return (
    sortedChapters.find((chapter) => {
      if (safeVolume === null) {
        return toFiniteNumber(chapter?.number) === safeChapterNumber;
      }
      return buildEpisodeKey(chapter?.number, chapter?.volume) === lookupKey;
    }) || null
  );
};

const findVolumeByNumber = (entries, volume) => {
  const safeVolume = toFiniteNumber(volume);
  if (safeVolume === null) {
    return null;
  }
  return (
    (Array.isArray(entries) ? entries : []).find((entry) => toFiniteNumber(entry?.volume) === safeVolume) ||
    null
  );
};

const toTranslationMap = (record) => {
  const map = new Map();
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return map;
  }
  Object.entries(record).forEach(([key, value]) => {
    const normalized = normalizeKey(key);
    const translated = normalizeText(value);
    if (!normalized || !translated) {
      return;
    }
    map.set(normalized, translated);
  });
  return map;
};

const translateValue = (value, translationMap) => {
  const normalized = normalizeKey(value);
  if (!normalized) {
    return "";
  }
  return translationMap.get(normalized) || normalizeText(value);
};

const buildReadingChips = ({ project, tagTranslations, genreTranslations }) => {
  const genreMap = toTranslationMap(genreTranslations);
  const tagMap = toTranslationMap(tagTranslations);
  const sourceValues = [
    ...(Array.isArray(project?.genres) ? project.genres.map((value) => translateValue(value, genreMap)) : []),
    ...(Array.isArray(project?.tags) ? project.tags.map((value) => translateValue(value, tagMap)) : []),
  ];

  const seen = new Set();
  const chips = [];
  sourceValues.forEach((value) => {
    const normalized = normalizeKey(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    chips.push(normalizeText(value));
  });
  return chips;
};

const resolveChapterLabel = ({ chapter, chapterNumber }) => {
  const safeChapter = chapter && typeof chapter === "object" ? chapter : {};
  if (isExtraChapter(safeChapter)) {
    return normalizeText(safeChapter.displayLabel) || "Extra";
  }
  const safeNumber = toFiniteNumber(safeChapter.number) ?? toFiniteNumber(chapterNumber);
  return safeNumber === null ? "Capítulo" : `Capítulo ${safeNumber}`;
};

const resolveVolumeCoverImage = ({ volumeEntry, volumeCover }) =>
  [
    {
      source: "volume-entry-cover",
      url: normalizeText(volumeEntry?.coverImageUrl),
      coverLike: true,
    },
    {
      source: "volume-cover",
      url: normalizeText(volumeCover?.coverImageUrl),
      coverLike: true,
    },
  ].find((candidate) => candidate.url) || null;

const resolveArtworkReadingImage = ({ chapter, volumeEntry, volumeCover, project }) => {
  const volumeCandidate = resolveVolumeCoverImage({ volumeEntry, volumeCover });
  const chapterPages = normalizeProjectEpisodePages(chapter?.pages);
  const candidates = [
    {
      source: "chapter-cover",
      url: normalizeText(chapter?.coverImageUrl),
      coverLike: true,
    },
    {
      source: "chapter-page",
      url: normalizeText(chapterPages[0]?.imageUrl),
      coverLike: false,
    },
    volumeCandidate,
    {
      source: "project-cover",
      url: normalizeText(project?.cover),
      coverLike: true,
    },
  ];
  return candidates.find((candidate) => candidate?.url) || null;
};

const resolveBackdropReadingImage = ({ volumeEntry, volumeCover, project }) => {
  const volumeCandidate = resolveVolumeCoverImage({ volumeEntry, volumeCover });
  const candidates = [
    {
      source: "project-banner",
      url: normalizeText(project?.banner),
      coverLike: false,
    },
    volumeCandidate,
    {
      source: "project-cover",
      url: normalizeText(project?.cover),
      coverLike: true,
    },
  ];
  return candidates.find((candidate) => candidate?.url) || null;
};

export const resolveProjectReadingOgSnapshot = ({
  project,
  chapterNumber,
  volume,
  settings,
  tagTranslations,
  genreTranslations,
  sceneVersion = PROJECT_READING_OG_SCENE_VERSION,
} = {}) => {
  const safeProject = project && typeof project === "object" ? project : null;
  const chapter = findChapterByRoute({
    project: safeProject,
    chapterNumber,
    volume,
  });
  if (!safeProject || !chapter) {
    return null;
  }

  const activeVolume = toFiniteNumber(volume) ?? toFiniteNumber(chapter?.volume);
  const normalizedVolumeEntries =
    Array.isArray(safeProject?.volumeEntries) && safeProject.volumeEntries.length > 0
      ? safeProject.volumeEntries
      : Array.isArray(safeProject?.volumeCovers)
        ? safeProject.volumeCovers
        : [];
  const volumeEntry = findVolumeByNumber(normalizedVolumeEntries, activeVolume);
  const volumeCover = findVolumeByNumber(safeProject?.volumeCovers, activeVolume);
  const chapterLabel = resolveChapterLabel({ chapter, chapterNumber });
  const volumeLabel = activeVolume === null ? "" : `Volume ${activeVolume}`;
  const projectTitle = normalizeText(safeProject?.title) || "Projeto";
  const chapterTitle = normalizeText(chapter?.title) || chapterLabel;
  const seoTitle =
    chapterTitle && chapterTitle !== chapterLabel
      ? `${chapterLabel} - ${chapterTitle} - ${projectTitle}`
      : `${chapterLabel} - ${projectTitle}`;
  const seoDescription =
    normalizeText(chapter?.synopsis) ||
    normalizeText(volumeEntry?.synopsis) ||
    normalizeText(safeProject?.synopsis) ||
    normalizeText(safeProject?.description);
  const titleFragment =
    chapterTitle && chapterTitle !== chapterLabel ? `${chapterLabel} - ${chapterTitle}` : chapterLabel;
  const artworkImage = resolveArtworkReadingImage({
    chapter,
    volumeEntry,
    volumeCover,
    project: safeProject,
  });
  const backdropImage = resolveBackdropReadingImage({
    volumeEntry,
    volumeCover,
    project: safeProject,
  });

  return {
    sceneVersion: normalizeText(sceneVersion) || PROJECT_READING_OG_SCENE_VERSION,
    accentHex: normalizeText(settings?.theme?.accent),
    projectId: normalizeText(safeProject?.id),
    projectTitle,
    chapterNumberResolved: toFiniteNumber(chapter?.number) ?? toFiniteNumber(chapterNumber),
    volumeResolved: activeVolume,
    chapterLabel,
    volumeLabel,
    chapterTitle,
    subtitle: projectTitle,
    eyebrowParts: [volumeLabel, chapterLabel].filter(Boolean),
    seoTitle,
    seoDescription,
    imageAlt: `Card de compartilhamento da leitura ${titleFragment} de ${projectTitle}`,
    chips: buildReadingChips({
      project: safeProject,
      tagTranslations,
      genreTranslations,
    }),
    artworkSource: artworkImage?.source || "",
    artworkUrl: artworkImage?.url || "",
    artworkCoverLike: Boolean(artworkImage?.coverLike),
    backdropSource: backdropImage?.source || "",
    backdropUrl: backdropImage?.url || "",
  };
};

export const buildProjectReadingOgRevision = (args = {}) => {
  const snapshot = resolveProjectReadingOgSnapshot(args);
  if (!snapshot) {
    return "";
  }
  return createStableRevisionToken(snapshot);
};

export const buildProjectReadingOgImagePath = ({
  projectId,
  chapterNumber,
  volume,
  revision,
} = {}) => {
  const safeProjectId = encodeURIComponent(normalizeText(projectId));
  const safeChapterNumber = encodeURIComponent(normalizeText(chapterNumber));
  let path = `/api/og/project/${safeProjectId}/reading/${safeChapterNumber}`;
  const query = new URLSearchParams();
  const safeVolume = toFiniteNumber(volume);
  if (safeVolume !== null) {
    query.set("volume", String(safeVolume));
  }
  const safeRevision = normalizeText(revision);
  if (safeRevision) {
    query.set("v", safeRevision);
  }
  const serializedQuery = query.toString();
  if (serializedQuery) {
    path += `?${serializedQuery}`;
  }
  return path;
};
