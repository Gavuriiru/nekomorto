import type { Project, ProjectEpisode, ProjectVolumeEntry } from "@/data/projects";
import { buildEpisodeKey } from "@/lib/project-episode-key";

export type ProjectImageImportPreviewItem = {
  key: string;
  order: number;
  number: number;
  volume: number | null;
  titleDetected: string;
  sourceLabel: string;
  pageCount: number;
  action: "create" | "update" | "ignore";
  warnings: string[];
};

export type ProjectImageImportPreviewPayload = {
  items: ProjectImageImportPreviewItem[];
  warnings: string[];
  summary: {
    chapters: number;
    pages: number;
    created: number;
    updated: number;
    ignored: number;
    warnings: number;
  };
  chapters?: ProjectEpisode[];
};

export type ProjectImageImportJob = {
  id: string;
  projectId: string;
  requestedBy: string;
  status: "queued" | "processing" | "completed" | "failed" | "expired";
  summary: Record<string, unknown>;
  error: string | null;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  expiresAt: string | null;
  hasResult: boolean;
  result?: ProjectImageImportPreviewPayload;
};

export type ProjectImageExportJob = {
  id: string;
  projectId: string;
  requestedBy: string;
  status: "queued" | "processing" | "completed" | "failed" | "expired";
  summary: Record<string, unknown>;
  error: string | null;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  expiresAt: string | null;
  hasFile: boolean;
  downloadPath?: string;
};

const normalizeObjectRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const toNullableIso = (value: unknown) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
};

const normalizeImportJobStatus = (value: unknown): ProjectImageImportJob["status"] => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    normalized === "queued" ||
    normalized === "processing" ||
    normalized === "completed" ||
    normalized === "failed" ||
    normalized === "expired"
  ) {
    return normalized;
  }
  return "queued";
};

const normalizeExportJobStatus = (value: unknown): ProjectImageExportJob["status"] => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    normalized === "queued" ||
    normalized === "processing" ||
    normalized === "completed" ||
    normalized === "failed" ||
    normalized === "expired"
  ) {
    return normalized;
  }
  return "queued";
};

export const normalizeProjectImageImportPreviewPayload = (
  value: unknown,
): ProjectImageImportPreviewPayload | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const source = value as Record<string, unknown>;
  const summary = normalizeObjectRecord(source.summary);
  return {
    items: Array.isArray(source.items)
      ? source.items
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return null;
            }
            const record = item as Record<string, unknown>;
            return {
              key: String(record.key || "").trim(),
              order: Number(record.order || 0),
              number: Number(record.number || 0),
              volume:
                record.volume === null || record.volume === undefined || record.volume === ""
                  ? null
                  : Number(record.volume),
              titleDetected: String(record.titleDetected || "").trim(),
              sourceLabel: String(record.sourceLabel || "").trim(),
              pageCount: Number(record.pageCount || 0),
              action:
                String(record.action || "")
                  .trim()
                  .toLowerCase() === "update"
                  ? "update"
                  : String(record.action || "")
                        .trim()
                        .toLowerCase() === "ignore"
                    ? "ignore"
                    : "create",
              warnings: Array.isArray(record.warnings)
                ? record.warnings.map((warning) => String(warning || "").trim()).filter(Boolean)
                : [],
            } satisfies ProjectImageImportPreviewItem;
          })
          .filter((item): item is ProjectImageImportPreviewItem => Boolean(item))
      : [],
    warnings: Array.isArray(source.warnings)
      ? source.warnings.map((warning) => String(warning || "").trim()).filter(Boolean)
      : [],
    summary: {
      chapters: Number(summary.chapters || 0),
      pages: Number(summary.pages || 0),
      created: Number(summary.created || 0),
      updated: Number(summary.updated || 0),
      ignored: Number(summary.ignored || 0),
      warnings: Number(summary.warnings || 0),
    },
    chapters: Array.isArray(source.chapters) ? (source.chapters as ProjectEpisode[]) : undefined,
  };
};

export const normalizeProjectImageImportJob = (value: unknown): ProjectImageImportJob | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const source = value as Record<string, unknown>;
  return {
    id: String(source.id || "").trim(),
    projectId: String(source.projectId || "").trim(),
    requestedBy: String(source.requestedBy || "").trim(),
    status: normalizeImportJobStatus(source.status),
    summary: normalizeObjectRecord(source.summary),
    error: source.error ? String(source.error) : null,
    createdAt: toNullableIso(source.createdAt),
    startedAt: toNullableIso(source.startedAt),
    finishedAt: toNullableIso(source.finishedAt),
    expiresAt: toNullableIso(source.expiresAt),
    hasResult: Boolean(source.hasResult),
    result: normalizeProjectImageImportPreviewPayload(source.result),
  };
};

export const normalizeProjectImageExportJob = (value: unknown): ProjectImageExportJob | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const source = value as Record<string, unknown>;
  return {
    id: String(source.id || "").trim(),
    projectId: String(source.projectId || "").trim(),
    requestedBy: String(source.requestedBy || "").trim(),
    status: normalizeExportJobStatus(source.status),
    summary: normalizeObjectRecord(source.summary),
    error: source.error ? String(source.error) : null,
    createdAt: toNullableIso(source.createdAt),
    startedAt: toNullableIso(source.startedAt),
    finishedAt: toNullableIso(source.finishedAt),
    expiresAt: toNullableIso(source.expiresAt),
    hasFile: Boolean(source.hasFile),
    downloadPath: String(source.downloadPath || "").trim() || undefined,
  };
};

export const buildProjectImageImportFormData = ({
  project,
  archiveFile,
  files,
  targetVolume,
  targetChapterNumber,
  defaultStatus = "draft",
}: {
  project: Project;
  archiveFile?: File | null;
  files?: File[] | null;
  targetVolume?: number | null;
  targetChapterNumber?: number | null;
  defaultStatus?: "draft" | "published";
}) => {
  const formData = new FormData();
  formData.set("project", JSON.stringify(buildProjectSnapshotForMangaExport(project)));
  if (archiveFile) {
    formData.set("archive", archiveFile);
  }
  const manifest: Array<{ relativePath: string }> = [];
  (Array.isArray(files) ? files : []).forEach((file) => {
    formData.append("files", file);
    manifest.push({
      relativePath: String(
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      ),
    });
  });
  if (manifest.length > 0) {
    formData.set("manifest", JSON.stringify(manifest));
  }
  if (Number.isFinite(Number(targetVolume))) {
    formData.set("targetVolume", String(Number(targetVolume)));
  }
  if (Number.isFinite(Number(targetChapterNumber))) {
    formData.set("targetChapterNumber", String(Number(targetChapterNumber)));
  }
  formData.set("defaultStatus", defaultStatus);
  return formData;
};

export const mergeImportedImageChaptersIntoProject = <
  T extends { episodeDownloads?: ProjectEpisode[] },
>(
  project: T,
  chapters: ProjectEpisode[],
): T => {
  const nextEpisodes = Array.isArray(project.episodeDownloads) ? [...project.episodeDownloads] : [];
  const episodeIndexByKey = new Map(
    nextEpisodes.map((episode, index) => [buildEpisodeKey(episode.number, episode.volume), index]),
  );
  chapters.forEach((chapter) => {
    const key = buildEpisodeKey(chapter.number, chapter.volume);
    const existingIndex = episodeIndexByKey.get(key);
    if (existingIndex === undefined) {
      nextEpisodes.push({
        ...chapter,
        contentFormat: "images",
      });
      episodeIndexByKey.set(key, nextEpisodes.length - 1);
      return;
    }
    nextEpisodes[existingIndex] = {
      ...nextEpisodes[existingIndex],
      ...chapter,
      content: "",
      contentFormat: "images",
    };
  });
  return {
    ...project,
    episodeDownloads: nextEpisodes,
  };
};

export const buildProjectSnapshotForMangaExport = <T extends Project>(project: T): T => {
  const normalizedVolumeEntries = (
    Array.isArray(project.volumeEntries) ? project.volumeEntries : []
  )
    .map((entry) => {
      const parsedVolume = Number(entry.volume);
      if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
        return null;
      }
      return {
        volume: parsedVolume,
        synopsis: String(entry.synopsis || "").trim(),
        coverImageUrl: String(entry.coverImageUrl || "").trim(),
        coverImageAlt: String(entry.coverImageAlt || "").trim(),
      } satisfies ProjectVolumeEntry;
    })
    .filter((entry): entry is ProjectVolumeEntry => Boolean(entry))
    .sort((left, right) => left.volume - right.volume);
  return {
    ...project,
    volumeEntries: normalizedVolumeEntries,
  };
};
