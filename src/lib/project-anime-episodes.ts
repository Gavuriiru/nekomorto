import type { DownloadSource, ProjectEpisode } from "@/data/projects";
import { resolveNextMainEpisodeNumber } from "@/lib/project-episode-key";
import { getProjectEpisodeCompleteDownloadSources } from "@/lib/project-publication";

export type AnimeEpisodeQuickFilter =
  | "all"
  | "published"
  | "draft"
  | "missing-links"
  | "missing-date"
  | "incomplete";

export type AnimeEpisodeCompletionIssue =
  | "missing-date"
  | "missing-links"
  | "missing-cover"
  | "missing-file-metadata";

const DAY_MS = 24 * 60 * 60 * 1000;

const cloneSource = (source: DownloadSource): DownloadSource => ({
  label: String(source.label || ""),
  url: String(source.url || ""),
});

export const cloneEpisodeSources = (sources: DownloadSource[] | null | undefined) =>
  Array.isArray(sources) ? sources.map(cloneSource) : [];

export const generateEpisodeEditorLocalId = () => {
  const alpha = String.fromCharCode(97 + Math.floor(Math.random() * 26));
  const random = Math.random().toString(36).slice(2, 9);
  const stamp = Date.now().toString(36).slice(-3);
  return `${alpha}${random}${stamp}`;
};

export const resolveEpisodeEditorLocalKey = (
  episode: Partial<ProjectEpisode> & { _editorKey?: string } | null | undefined,
) => {
  const currentKey = String(episode?._editorKey || "").trim();
  return currentKey || generateEpisodeEditorLocalId();
};

export const getAnimeEpisodeCompletionIssues = (
  episode: Partial<ProjectEpisode> | null | undefined,
): AnimeEpisodeCompletionIssue[] => {
  const issues: AnimeEpisodeCompletionIssue[] = [];
  const hasDate = String(episode?.releaseDate || "").trim().length > 0;
  const hasLinks = getProjectEpisodeCompleteDownloadSources(episode).length > 0;
  const hasCover = String(episode?.coverImageUrl || "").trim().length > 0;
  const hasFileSize = Number(episode?.sizeBytes) > 0;
  const hasHash = String(episode?.hash || "").trim().length > 0;

  if (!hasDate) {
    issues.push("missing-date");
  }
  if (!hasLinks) {
    issues.push("missing-links");
  }
  if (!hasCover) {
    issues.push("missing-cover");
  }
  if (!hasFileSize || !hasHash) {
    issues.push("missing-file-metadata");
  }

  return issues;
};

export const getAnimeEpisodeCompletionLabel = (issue: AnimeEpisodeCompletionIssue) => {
  switch (issue) {
    case "missing-date":
      return "Sem data";
    case "missing-links":
      return "Sem links";
    case "missing-cover":
      return "Sem capa";
    case "missing-file-metadata":
      return "Arquivo pendente";
    default:
      return "Pendente";
  }
};

export const matchesAnimeEpisodeQuickFilter = (
  episode: Partial<ProjectEpisode> | null | undefined,
  filterMode: AnimeEpisodeQuickFilter,
) => {
  if (filterMode === "published") {
    return episode?.publicationStatus !== "draft";
  }
  if (filterMode === "draft") {
    return episode?.publicationStatus === "draft";
  }

  const issues = getAnimeEpisodeCompletionIssues(episode);
  if (filterMode === "missing-links") {
    return issues.includes("missing-links");
  }
  if (filterMode === "missing-date") {
    return issues.includes("missing-date");
  }
  if (filterMode === "incomplete") {
    return issues.length > 0;
  }
  return true;
};

export const shiftIsoDateByDays = (value: string | null | undefined, days: number) => {
  const trimmed = String(value || "").trim();
  if (!trimmed || !Number.isFinite(days) || days === 0) {
    return trimmed;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const baseDate = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(baseDate.getTime())) {
    return trimmed;
  }
  const shifted = new Date(baseDate.getTime() + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
};

export const buildDuplicatedAnimeEpisode = <
  TEpisode extends ProjectEpisode & { _editorKey?: string },
>(
  sourceEpisode: TEpisode,
  existingEpisodes: Array<Pick<ProjectEpisode, "number" | "entryKind">>,
) => ({
  ...sourceEpisode,
  _editorKey: generateEpisodeEditorLocalId(),
  number: resolveNextMainEpisodeNumber(existingEpisodes, {
    isExtra: (episode) => episode.entryKind === "extra",
  }),
  hash: undefined,
  sizeBytes: undefined,
  releaseDate: "",
  sources: cloneEpisodeSources(sourceEpisode.sources),
  completedStages: Array.isArray(sourceEpisode.completedStages)
    ? [...sourceEpisode.completedStages]
    : [],
});
