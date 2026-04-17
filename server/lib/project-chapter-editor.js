import {
  getProjectEpisodePageCount,
  normalizeProjectEpisodeContentFormat,
  normalizeProjectEpisodePages,
} from "../../shared/project-reader.js";
import { resolveEpisodeLookup } from "./project-episodes.js";

const hasOwn = (value, key) =>
  Boolean(value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key));

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
};

const normalizeOptionalTrimmedString = (value) => String(value || "").trim();

const normalizeOptionalNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.floor(parsed);
};

const normalizeOptionalVolume = (value, fallbackValue) => {
  if (value === undefined) {
    return fallbackValue;
  }
  if (value === null || String(value).trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }
  return Math.floor(parsed);
};

const normalizePublicationStatus = (value, fallbackValue) =>
  String(value || "")
    .trim()
    .toLowerCase() === "draft"
    ? "draft"
    : String(value || "")
          .trim()
          .toLowerCase() === "published"
      ? "published"
      : fallbackValue;

const normalizeEntryKind = (value, fallbackValue) =>
  String(value || "")
    .trim()
    .toLowerCase() === "extra"
    ? "extra"
    : fallbackValue || "main";

const normalizeSourceType = (value, fallbackValue) => {
  if (value === "TV" || value === "Web" || value === "Blu-ray") {
    return value;
  }
  return fallbackValue || "TV";
};

const normalizeSources = (value, fallbackValue) => {
  if (!Array.isArray(value)) {
    return Array.isArray(fallbackValue) ? fallbackValue : [];
  }
  return value
    .map((source) => ({
      label: normalizeOptionalTrimmedString(source?.label),
      url: normalizeOptionalTrimmedString(source?.url),
    }))
    .filter((source) => source.label || source.url);
};

const normalizeCompletedStages = (value, fallbackValue) => {
  if (!Array.isArray(value)) {
    return Array.isArray(fallbackValue) ? fallbackValue : [];
  }
  return Array.from(
    new Set(value.map((item) => normalizeOptionalTrimmedString(item)).filter(Boolean)),
  );
};

const normalizePages = (value, fallbackValue) => {
  if (value === undefined) {
    return normalizeProjectEpisodePages(fallbackValue);
  }
  return normalizeProjectEpisodePages(value);
};

export const applyProjectChapterUpdate = ({ project, targetNumber, targetVolume, chapter }) => {
  const lookup = resolveEpisodeLookup(project, targetNumber, targetVolume);
  if (!lookup.ok) {
    return lookup;
  }

  const nextChapterInput = chapter && typeof chapter === "object" ? chapter : {};
  const currentChapter = lookup.episode || {};
  const nextNumber =
    normalizeOptionalNumber(nextChapterInput.number) ?? Number(currentChapter.number) ?? 1;
  const nextEntryKind = normalizeEntryKind(nextChapterInput.entryKind, currentChapter.entryKind);
  const nextPages = normalizePages(nextChapterInput.pages, currentChapter.pages);
  const nextContentFormat = normalizeProjectEpisodeContentFormat(
    nextChapterInput.contentFormat,
    normalizeProjectEpisodeContentFormat(
      currentChapter.contentFormat,
      nextPages.length > 0 ? "images" : "lexical",
    ),
  );
  const nextPageCount = hasOwn(nextChapterInput, "pageCount")
    ? Math.max(0, normalizeOptionalNumber(nextChapterInput.pageCount) ?? nextPages.length)
    : getProjectEpisodePageCount({
        ...currentChapter,
        contentFormat: nextContentFormat,
        pages: nextPages,
      });
  const requestedCoverImageUrl = hasOwn(nextChapterInput, "coverImageUrl")
    ? normalizeOptionalTrimmedString(nextChapterInput.coverImageUrl)
    : normalizeOptionalTrimmedString(currentChapter.coverImageUrl);
  const resolvedCoverImageUrl =
    requestedCoverImageUrl ||
    (nextContentFormat === "images" ? normalizeOptionalTrimmedString(nextPages[0]?.imageUrl) : "");

  const nextChapter = {
    ...currentChapter,
    number: nextNumber,
    volume: normalizeOptionalVolume(nextChapterInput.volume, currentChapter.volume),
    title: hasOwn(nextChapterInput, "title")
      ? normalizeOptionalString(nextChapterInput.title)
      : currentChapter.title,
    entryKind: nextEntryKind,
    entrySubtype: hasOwn(nextChapterInput, "entrySubtype")
      ? normalizeOptionalTrimmedString(nextChapterInput.entrySubtype) || undefined
      : currentChapter.entrySubtype,
    readingOrder: hasOwn(nextChapterInput, "readingOrder")
      ? normalizeOptionalNumber(nextChapterInput.readingOrder)
      : currentChapter.readingOrder,
    displayLabel:
      nextEntryKind === "extra"
        ? hasOwn(nextChapterInput, "displayLabel")
          ? normalizeOptionalTrimmedString(nextChapterInput.displayLabel) || undefined
          : currentChapter.displayLabel
        : undefined,
    synopsis: hasOwn(nextChapterInput, "synopsis")
      ? normalizeOptionalString(nextChapterInput.synopsis)
      : currentChapter.synopsis,
    releaseDate: hasOwn(nextChapterInput, "releaseDate")
      ? normalizeOptionalTrimmedString(nextChapterInput.releaseDate)
      : currentChapter.releaseDate,
    duration: hasOwn(nextChapterInput, "duration")
      ? normalizeOptionalTrimmedString(nextChapterInput.duration)
      : currentChapter.duration,
    coverImageUrl: resolvedCoverImageUrl || undefined,
    coverImageAlt: hasOwn(nextChapterInput, "coverImageAlt")
      ? normalizeOptionalString(nextChapterInput.coverImageAlt)
      : currentChapter.coverImageAlt,
    sourceType: normalizeSourceType(nextChapterInput.sourceType, currentChapter.sourceType),
    sources: normalizeSources(nextChapterInput.sources, currentChapter.sources),
    hash: hasOwn(nextChapterInput, "hash")
      ? normalizeOptionalTrimmedString(nextChapterInput.hash) || undefined
      : currentChapter.hash,
    sizeBytes: hasOwn(nextChapterInput, "sizeBytes")
      ? normalizeOptionalNumber(nextChapterInput.sizeBytes)
      : currentChapter.sizeBytes,
    progressStage: hasOwn(nextChapterInput, "progressStage")
      ? normalizeOptionalTrimmedString(nextChapterInput.progressStage)
      : currentChapter.progressStage,
    completedStages: normalizeCompletedStages(
      nextChapterInput.completedStages,
      currentChapter.completedStages,
    ),
    content: hasOwn(nextChapterInput, "content")
      ? normalizeOptionalString(nextChapterInput.content)
      : currentChapter.content,
    contentFormat: nextContentFormat,
    pages: nextPages,
    pageCount: nextPageCount,
    publicationStatus: normalizePublicationStatus(
      nextChapterInput.publicationStatus,
      currentChapter.publicationStatus || "draft",
    ),
  };

  const nextEpisodes = [
    ...(Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : []),
  ];
  nextEpisodes[lookup.index] = nextChapter;

  return {
    ok: true,
    code: "ok",
    index: lookup.index,
    chapter: nextChapter,
    project: {
      ...project,
      episodeDownloads: nextEpisodes,
    },
  };
};
