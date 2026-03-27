import type { ProjectEpisode, ProjectVolumeEntry } from "@/data/projects";
import type { ProjectProgressKind } from "@/lib/project-progress";
import { buildVolumeCoverKey } from "@/lib/project-volume-cover-key";
import { normalizeProjectVolumeEntries } from "@/lib/project-volume-entries";
import { isLightNovelType, isMangaType } from "@/lib/project-utils";
import type { EpubImportPreviewPayload } from "@/lib/project-epub";
import { hasProjectEpisodeReadableContent } from "../../shared/project-reader.js";
import type { StageChapter } from "@/components/project-reader/MangaWorkflowPanel";

export type ChapterFilterMode = "all" | "draft" | "published" | "with-content" | "without-content";

export type EditableVolumeOption = {
  volume: number;
  chapterCount: number;
  hasMetadata: boolean;
};

export const chapterHasContent = (episode: ProjectEpisode | null | undefined) =>
  hasProjectEpisodeReadableContent(episode);

export const chapterStatusLabel = (episode: ProjectEpisode | null | undefined) =>
  episode?.publicationStatus === "draft" ? "Rascunho" : "Publicado";

export const sortChapters = (episodes: ProjectEpisode[]) =>
  [...episodes].sort((left, right) => {
    const leftReadingOrder = Number(left.readingOrder);
    const rightReadingOrder = Number(right.readingOrder);
    const hasLeftReadingOrder = Number.isFinite(leftReadingOrder);
    const hasRightReadingOrder = Number.isFinite(rightReadingOrder);
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
    const volumeDelta = (Number(left.volume) || 0) - (Number(right.volume) || 0);
    if (volumeDelta !== 0) {
      return volumeDelta;
    }
    const numberDelta = (Number(left.number) || 0) - (Number(right.number) || 0);
    if (numberDelta !== 0) {
      return numberDelta;
    }
    return String(left.title || "").localeCompare(String(right.title || ""), "pt-BR");
  });

export const buildChapterVolumeLabel = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "Sem volume";
  }
  return `Volume ${Math.floor(parsed)}`;
};

export const buildChapterStructureGroupKey = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(Math.floor(parsed)) : "none";
};

export const groupChaptersByStructureKey = (episodes: ProjectEpisode[]) => {
  const groups = new Map<string, ProjectEpisode[]>();
  (Array.isArray(episodes) ? episodes : []).forEach((episode) => {
    const key = buildChapterStructureGroupKey(episode.volume);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(episode);
  });
  return groups;
};

export const groupStageChaptersByStructureKey = (chapters: StageChapter[]) => {
  const groups = new Map<string, StageChapter[]>();
  (Array.isArray(chapters) ? chapters : []).forEach((chapter) => {
    const key = buildChapterStructureGroupKey(chapter.volume);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(chapter);
  });
  return groups;
};

export const matchesFilter = (episode: ProjectEpisode, mode: ChapterFilterMode) => {
  if (mode === "draft") {
    return episode.publicationStatus === "draft";
  }
  if (mode === "published") {
    return episode.publicationStatus !== "draft";
  }
  if (mode === "with-content") {
    return chapterHasContent(episode);
  }
  if (mode === "without-content") {
    return !chapterHasContent(episode);
  }
  return true;
};

export const matchesChapterSearch = (episode: ProjectEpisode, query: string) => {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  const haystack = [episode.number, episode.volume, episode.title, episode.displayLabel, episode.synopsis]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return haystack.includes(normalizedQuery);
};

export const matchesStageChapterFilter = (chapter: StageChapter, mode: ChapterFilterMode) => {
  if (mode === "draft") {
    return chapter.publicationStatus === "draft";
  }
  if (mode === "published") {
    return chapter.publicationStatus !== "draft";
  }
  if (mode === "with-content") {
    return chapter.pages.length > 0;
  }
  if (mode === "without-content") {
    return chapter.pages.length === 0;
  }
  return true;
};

export const matchesStageChapterSearch = (chapter: StageChapter, query: string) => {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  const haystack = [chapter.number, chapter.volume, chapter.title, chapter.sourceLabel, chapter.titleDetected]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return haystack.includes(normalizedQuery);
};

export const normalizeEpubImportPreviewPayload = (value: unknown): EpubImportPreviewPayload | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as EpubImportPreviewPayload)
    : null;

export const resolveImportedChapterCount = (
  payload: EpubImportPreviewPayload | null | undefined,
  chapters: ProjectEpisode[],
) => {
  const summaryChapterCount = Number(payload?.summary?.chapters);
  return Number.isFinite(summaryChapterCount) ? summaryChapterCount : chapters.length;
};

export const supportsStructureChapterReordering = (projectType?: string | null) =>
  isLightNovelType(projectType) || isMangaType(projectType);

export const compareChapterStructureGroupKeys = (leftKey: string, rightKey: string) => {
  if (leftKey === rightKey) {
    return 0;
  }
  if (leftKey === "none") {
    return 1;
  }
  if (rightKey === "none") {
    return -1;
  }
  return (Number(leftKey) || 0) - (Number(rightKey) || 0);
};

export const buildEditableVolumeOptions = (
  snapshot: Pick<{ episodeDownloads?: ProjectEpisode[] }, "episodeDownloads"> | null | undefined,
  entries: ProjectVolumeEntry[] | null | undefined,
): EditableVolumeOption[] => {
  if (!snapshot) {
    return [];
  }
  const chapterCountByVolume = new Map<number, number>();
  const metadataVolumeKeys = new Set(
    normalizeProjectVolumeEntries(entries).map((entry) => buildVolumeCoverKey(entry.volume)),
  );
  (Array.isArray(snapshot.episodeDownloads) ? snapshot.episodeDownloads : []).forEach((episode) => {
    const parsedVolume = Number(episode?.volume);
    if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
      return;
    }
    chapterCountByVolume.set(parsedVolume, (chapterCountByVolume.get(parsedVolume) || 0) + 1);
  });
  normalizeProjectVolumeEntries(entries).forEach((entry) => {
    if (!chapterCountByVolume.has(entry.volume)) {
      chapterCountByVolume.set(entry.volume, 0);
    }
  });
  return Array.from(chapterCountByVolume.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([volume, chapterCount]) => ({
      volume,
      chapterCount,
      hasMetadata: metadataVolumeKeys.has(buildVolumeCoverKey(volume)),
    }));
};
