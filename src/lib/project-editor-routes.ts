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

export const buildProjectPublicReadingHref = (
  projectIdOrSlug: string,
  chapterNumber: unknown,
  volume?: unknown,
) => {
  const normalizedProjectId = String(projectIdOrSlug || "").trim();
  const normalizedProjectSlug = createSlug(normalizedProjectId);
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
