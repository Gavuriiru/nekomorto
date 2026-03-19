import { createSlug } from "@/lib/post-content";

const normalizeChapterNumber = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.floor(parsed);
};

const normalizeVolume = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.floor(parsed);
};

const normalizeProjectPublicSlug = (value: unknown) => createSlug(String(value || "").trim());

export const buildDashboardProjectEditorHref = (projectId: string) => {
  const normalizedProjectId = String(projectId || "").trim();
  if (!normalizedProjectId) {
    return "/dashboard/projetos";
  }
  return `/dashboard/projetos?edit=${encodeURIComponent(normalizedProjectId)}`;
};

export const buildDashboardProjectChaptersEditorHref = (projectId: string) => {
  const normalizedProjectId = String(projectId || "").trim();
  if (!normalizedProjectId) {
    return buildDashboardProjectEditorHref(projectId);
  }
  return `/dashboard/projetos/${encodeURIComponent(normalizedProjectId)}/capitulos`;
};

export const buildDashboardProjectEpisodesEditorHref = (projectId: string) => {
  const normalizedProjectId = String(projectId || "").trim();
  if (!normalizedProjectId) {
    return buildDashboardProjectEditorHref(projectId);
  }
  return `/dashboard/projetos/${encodeURIComponent(normalizedProjectId)}/episodios`;
};

export const buildDashboardProjectChapterEditorHref = (
  projectId: string,
  chapterNumber: unknown,
  volume?: unknown,
) => {
  const normalizedProjectId = String(projectId || "").trim();
  const normalizedChapterNumber = normalizeChapterNumber(chapterNumber);
  if (!normalizedProjectId || normalizedChapterNumber === null) {
    return buildDashboardProjectEditorHref(projectId);
  }
  const params = new URLSearchParams();
  const normalizedVolume = normalizeVolume(volume);
  if (normalizedVolume !== null) {
    params.set("volume", String(normalizedVolume));
  }
  const query = params.toString();
  return `/dashboard/projetos/${encodeURIComponent(normalizedProjectId)}/capitulos/${normalizedChapterNumber}${query ? `?${query}` : ""}`;
};

export const buildDashboardProjectEpisodeEditorHref = (
  projectId: string,
  episodeNumber: unknown,
) => {
  const normalizedProjectId = String(projectId || "").trim();
  const normalizedEpisodeNumber = normalizeChapterNumber(episodeNumber);
  if (!normalizedProjectId || normalizedEpisodeNumber === null) {
    return buildDashboardProjectEditorHref(projectId);
  }
  return `/dashboard/projetos/${encodeURIComponent(normalizedProjectId)}/episodios/${normalizedEpisodeNumber}`;
};

export const buildProjectPublicHref = (projectIdOrSlug: string) => {
  const normalizedProjectSlug = normalizeProjectPublicSlug(projectIdOrSlug);
  if (!normalizedProjectSlug) {
    return "/projetos";
  }
  return `/projeto/${encodeURIComponent(normalizedProjectSlug)}`;
};

export const buildProjectPublicReadingHref = (
  projectIdOrSlug: string,
  chapterNumber: unknown,
  volume?: unknown,
) => {
  const normalizedProjectSlug = normalizeProjectPublicSlug(projectIdOrSlug);
  const normalizedChapterNumber = normalizeChapterNumber(chapterNumber);
  if (!normalizedProjectSlug || normalizedChapterNumber === null) {
    return "/projetos";
  }
  const params = new URLSearchParams();
  const normalizedVolume = normalizeVolume(volume);
  if (normalizedVolume !== null) {
    params.set("volume", String(normalizedVolume));
  }
  const query = params.toString();
  return `/projeto/${encodeURIComponent(normalizedProjectSlug)}/leitura/${normalizedChapterNumber}${query ? `?${query}` : ""}`;
};
