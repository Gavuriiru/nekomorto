import type { Project, ProjectEpisode, ProjectVolumeCover, ProjectVolumeEntry } from "@/data/projects";
import { resolveAssetAltText } from "@/lib/image-alt";
import { buildEpisodeKey } from "@/lib/project-episode-key";
import { isLightNovelType, isMangaType } from "@/lib/project-utils";
import type {
  ApiContractBuildMetadata,
  ApiContractCapabilities,
  ApiContractV1,
} from "@/types/api-contract";

export const DEFAULT_API_CAPABILITIES: ApiContractCapabilities = {
  project_epub_import: false,
  project_epub_export: false,
  project_epub_import_async: false,
};

export const EPUB_CAPABILITY_UNAVAILABLE_MESSAGE =
  "Este ambiente está com backend desatualizado e ainda não suporta EPUB.";
export const EPUB_CAPABILITY_UNKNOWN_MESSAGE =
  "Não foi possível confirmar o suporte EPUB deste ambiente. Os botões ficam desabilitados até o contrato da API responder.";
export const EPUB_IMPORT_ROUTE_MISSING_MESSAGE =
  "A origem atual não está alcançando a rota EPUB deste backend. Verifique túnel, proxy ou host aberto no navegador.";
export const EPUB_EXPORT_ROUTE_MISSING_MESSAGE =
  "A origem atual não está alcançando a rota EPUB deste backend. Verifique túnel, proxy ou host aberto no navegador.";
export const EPUB_IMPORT_PROCESSING_MESSAGE = "Não foi possível processar o arquivo informado.";
export const EPUB_NETWORK_ERROR_MESSAGE =
  "Não foi possível contatar o backend deste ambiente. Verifique a conectividade e tente novamente.";
export const EPUB_IMPORT_LEGACY_PROJECT_MISSING_MESSAGE =
  "O backend tentou resolver um projeto salvo que não existe mais. Recarregue o editor e tente novamente.";
export const EPUB_IMPORT_INVALID_SNAPSHOT_MESSAGE =
  "Não foi possível enviar o snapshot atual do projeto para a importação EPUB.";
export const EPUB_IMPORT_SNAPSHOT_TOO_LARGE_MESSAGE =
  "O snapshot atual do projeto excedeu o limite da importação EPUB. Salve o projeto e tente novamente.";
export const EPUB_IMPORT_DUPLICATE_EPISODE_MESSAGE =
  "O formulário possui capítulos duplicados por número + volume. Corrija antes de importar.";
export const EPUB_EXPORT_GENERIC_MESSAGE = "Não foi possível gerar o arquivo EPUB.";

export type EpubRouteStatus =
  | "unknown"
  | "ok"
  | "route_unreachable_for_current_origin"
  | "network_unreachable"
  | "forbidden"
  | "legacy_project_not_found";

export type EpubImportProjectSnapshot = {
  id: string;
  title: string;
  type: string;
  episodeDownloads: Array<{
    number: number;
    volume?: number;
    title: string;
    entryKind?: "main" | "extra";
    entrySubtype?: string;
    readingOrder?: number;
    displayLabel?: string;
    publicationStatus?: "draft" | "published";
  }>;
  volumeEntries: Array<{
    volume: number;
    coverImageUrl: string;
    coverImageAlt: string;
  }>;
  volumeCovers: Array<{
    volume?: number;
    coverImageUrl: string;
    coverImageAlt: string;
  }>;
};

export type EpubImportPreviewSummary = {
  chapters?: number;
  mainImported?: number;
  extrasImported?: number;
  created?: number;
  updated?: number;
  volume?: number | null;
  imagesImported?: number;
  imageImportFailures?: number;
  boilerplatePromoted?: number;
  boilerplateDiscarded?: number;
  unresolvedTocEntries?: number;
  volumeCoverImported?: boolean;
  volumeCoverSkipped?: boolean;
};

export type EpubImportPreviewPayload = {
  chapters?: ProjectEpisode[];
  volumeCovers?: ImportedVolumeCover[];
  warnings?: string[];
  summary?: EpubImportPreviewSummary;
};

export type EpubImportJobStatus = "queued" | "processing" | "completed" | "failed" | "expired";

export type EpubImportJob = {
  id: string;
  projectId: string;
  requestedBy: string;
  status: EpubImportJobStatus;
  summary?: EpubImportPreviewSummary;
  error?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  expiresAt?: string | null;
  hasResult?: boolean;
  result?: EpubImportPreviewPayload;
};

type EpubProjectShape = Pick<
  Project,
  "id" | "title" | "type" | "episodeDownloads" | "volumeEntries" | "volumeCovers"
>;

type ImportedVolumeCover = ProjectVolumeCover & {
  mergeMode?: "create" | "update" | "preserve_existing";
};

export const normalizeApiContractCapabilities = (
  capabilities: ApiContractV1["capabilities"],
): ApiContractCapabilities => ({
  project_epub_import: capabilities?.project_epub_import === true,
  project_epub_export: capabilities?.project_epub_export === true,
  project_epub_import_async: capabilities?.project_epub_import_async === true,
});

export const normalizeApiContractBuildMetadata = (
  build: ApiContractV1["build"],
): ApiContractBuildMetadata | null => {
  if (!build || typeof build !== "object") {
    return null;
  }
  return {
    commitSha:
      typeof build.commitSha === "string" && build.commitSha.trim().length > 0
        ? build.commitSha.trim()
        : null,
    builtAt:
      typeof build.builtAt === "string" && build.builtAt.trim().length > 0
        ? build.builtAt.trim()
        : null,
  };
};

export const buildEpubImportProjectSnapshot = (
  project: Partial<EpubProjectShape>,
): EpubImportProjectSnapshot => {
  const episodeDownloads = (Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : [])
    .map((episode): EpubImportProjectSnapshot["episodeDownloads"][number] | null => {
      const number = Number(episode?.number);
      if (!Number.isFinite(number)) {
        return null;
      }
      const parsedVolume = Number(episode?.volume);
      const parsedReadingOrder = Number(episode?.readingOrder);
      const entryKind: "main" | "extra" = episode?.entryKind === "extra" ? "extra" : "main";
      return {
        number,
        volume: Number.isFinite(parsedVolume) ? parsedVolume : undefined,
        title: String(episode?.title || "").trim(),
        entryKind,
        entrySubtype: String(episode?.entrySubtype || "").trim() || undefined,
        readingOrder: Number.isFinite(parsedReadingOrder)
          ? Math.round(parsedReadingOrder)
          : undefined,
        displayLabel:
          entryKind === "extra"
            ? String(episode?.displayLabel || "").trim() || undefined
            : undefined,
        publicationStatus: episode?.publicationStatus === "published" ? "published" : "draft",
      };
    })
    .filter((episode): episode is EpubImportProjectSnapshot["episodeDownloads"][number] =>
      Boolean(episode),
    );

  const volumeEntries = (Array.isArray(project?.volumeEntries) ? project.volumeEntries : [])
    .map((entry) => {
      const volume = Number(entry?.volume);
      if (!Number.isFinite(volume)) {
        return null;
      }
      return {
        volume,
        coverImageUrl: String(entry?.coverImageUrl || "").trim(),
        coverImageAlt: String(entry?.coverImageAlt || "").trim(),
      };
    })
    .filter((entry): entry is EpubImportProjectSnapshot["volumeEntries"][number] => Boolean(entry));

  const volumeCovers = (Array.isArray(project?.volumeCovers) ? project.volumeCovers : [])
    .map((cover) => {
      const parsedVolume = Number(cover?.volume);
      return {
        volume: Number.isFinite(parsedVolume) ? parsedVolume : undefined,
        coverImageUrl: String(cover?.coverImageUrl || "").trim(),
        coverImageAlt: String(cover?.coverImageAlt || "").trim(),
      };
    })
    .filter((cover) => cover.coverImageUrl.length > 0 || cover.coverImageAlt.length > 0);

  return {
    id: String(project?.id || "").trim(),
    title: String(project?.title || "").trim(),
    type: String(project?.type || "").trim(),
    episodeDownloads,
    volumeEntries,
    volumeCovers,
  };
};

export const isLegacyMultipartSnapshotTooLargeError = (errorCode: unknown, detail: unknown) =>
  String(errorCode || "").trim() === "invalid_multipart_upload" &&
  /field value too long/i.test(String(detail || ""));

export const isEpubCssEngineFailureDetail = (detail: unknown) => {
  const normalized = String(detail || "").trim();
  if (!normalized) {
    return false;
  }
  return (
    /specificity\.max/i.test(normalized) ||
    /cannot destructure property\s+['"]value['"]/i.test(normalized) ||
    /@bramus\/specificity/i.test(normalized)
  );
};

const EPUB_TEMP_IMPORT_ID_PATTERN = /\/uploads\/tmp\/epub-imports\/[^/]+\/([^/?#"'\s/]+)/gi;

const collectEpubTempImportIds = (value: unknown, bucket: Set<string>) => {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    const matches = String(value).matchAll(EPUB_TEMP_IMPORT_ID_PATTERN);
    for (const match of matches) {
      const importId = String(match[1] || "").trim();
      if (importId) {
        bucket.add(importId);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectEpubTempImportIds(item, bucket));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectEpubTempImportIds(item, bucket));
  }
};

export const extractEpubTempImportIdsFromPayload = (payload: unknown) => {
  const bucket = new Set<string>();
  collectEpubTempImportIds(payload, bucket);
  return Array.from(bucket);
};

export const normalizeEpubImportJobStatus = (value: unknown): EpubImportJobStatus => {
  const normalized = String(value || "").trim().toLowerCase();
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

export const normalizeEpubImportJob = (value: unknown): EpubImportJob | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const job = value as Record<string, unknown>;
  const id = String(job.id || "").trim();
  if (!id) {
    return null;
  }
  return {
    id,
    projectId: String(job.projectId || "").trim(),
    requestedBy: String(job.requestedBy || "").trim(),
    status: normalizeEpubImportJobStatus(job.status),
    summary:
      job.summary && typeof job.summary === "object" && !Array.isArray(job.summary)
        ? (job.summary as EpubImportPreviewSummary)
        : undefined,
    error: typeof job.error === "string" && job.error.trim().length > 0 ? job.error.trim() : null,
    createdAt: typeof job.createdAt === "string" ? job.createdAt : null,
    startedAt: typeof job.startedAt === "string" ? job.startedAt : null,
    finishedAt: typeof job.finishedAt === "string" ? job.finishedAt : null,
    expiresAt: typeof job.expiresAt === "string" ? job.expiresAt : null,
    hasResult: job.hasResult === true,
    result:
      job.result && typeof job.result === "object" && !Array.isArray(job.result)
        ? (job.result as EpubImportPreviewPayload)
        : undefined,
  };
};

export const overlayDraftOnProject = <T extends { episodeDownloads?: ProjectEpisode[] }>(
  project: T,
  targetChapterKey: string | null | undefined,
  draft: ProjectEpisode | null | undefined,
): T => {
  if (!targetChapterKey || !draft) {
    return project;
  }
  const episodes = Array.isArray(project.episodeDownloads) ? [...project.episodeDownloads] : [];
  const episodeIndex = episodes.findIndex(
    (episode) => buildEpisodeKey(episode.number, episode.volume) === targetChapterKey,
  );
  if (episodeIndex < 0) {
    return project;
  }
  episodes[episodeIndex] = { ...draft };
  return {
    ...project,
    episodeDownloads: episodes,
  };
};

export const mergeImportedChaptersIntoProject = <T extends { episodeDownloads?: ProjectEpisode[] }>(
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
        synopsis: String(chapter.synopsis || "").trim(),
        entryKind: chapter.entryKind === "extra" ? "extra" : "main",
        entrySubtype: String(chapter.entrySubtype || "").trim() || undefined,
        readingOrder: Number.isFinite(Number(chapter.readingOrder))
          ? Number(chapter.readingOrder)
          : undefined,
        displayLabel:
          chapter.entryKind === "extra"
            ? String(chapter.displayLabel || "").trim() || undefined
            : undefined,
      });
      episodeIndexByKey.set(key, nextEpisodes.length - 1);
      return;
    }
    const currentEpisode = nextEpisodes[existingIndex];
    nextEpisodes[existingIndex] = {
      ...currentEpisode,
      title: chapter.title,
      synopsis: String(chapter.synopsis || currentEpisode.synopsis || "").trim(),
      entryKind: chapter.entryKind === "extra" ? "extra" : "main",
      entrySubtype: String(chapter.entrySubtype || "").trim() || currentEpisode.entrySubtype,
      readingOrder: Number.isFinite(Number(chapter.readingOrder))
        ? Number(chapter.readingOrder)
        : currentEpisode.readingOrder,
      displayLabel:
        chapter.entryKind === "extra"
          ? String(chapter.displayLabel || "").trim() || currentEpisode.displayLabel
          : undefined,
      content: chapter.content,
      contentFormat: "lexical",
      publicationStatus:
        currentEpisode.publicationStatus === "published"
          ? "published"
          : chapter.publicationStatus || "draft",
    };
  });
  return {
    ...project,
    episodeDownloads: nextEpisodes,
  };
};

export const mergeImportedVolumeCoversIntoProject = <
  T extends {
    volumeEntries?: ProjectVolumeEntry[];
  },
>(
  project: T,
  importedVolumeCovers: ImportedVolumeCover[],
): T => {
  if (!importedVolumeCovers.length) {
    return project;
  }
  const nextVolumeEntries = Array.isArray(project.volumeEntries) ? [...project.volumeEntries] : [];
  importedVolumeCovers.forEach((cover) => {
    const parsedVolume = Number(cover.volume);
    if (!Number.isFinite(parsedVolume)) {
      return;
    }
    const existingIndex = nextVolumeEntries.findIndex((item) => item.volume === parsedVolume);
    if (cover.mergeMode === "preserve_existing" && existingIndex >= 0) {
      return;
    }
    if (existingIndex >= 0) {
      nextVolumeEntries[existingIndex] = {
        ...nextVolumeEntries[existingIndex],
        volume: parsedVolume,
        coverImageUrl: String(cover.coverImageUrl || "").trim(),
        coverImageAlt: String(cover.coverImageAlt || "").trim(),
      };
      return;
    }
    nextVolumeEntries.push({
      volume: parsedVolume,
      synopsis: "",
      coverImageUrl: String(cover.coverImageUrl || "").trim(),
      coverImageAlt: String(cover.coverImageAlt || "").trim(),
    });
  });
  nextVolumeEntries.sort((left, right) => left.volume - right.volume);
  return {
    ...project,
    volumeEntries: nextVolumeEntries,
  };
};

export const buildProjectSnapshotForEpubExport = <T extends Project>(project: T): T => {
  const supportsVolumeEntriesForExport =
    isLightNovelType(project.type || "") || isMangaType(project.type || "");
  const normalizedVolumeEntriesForExport = supportsVolumeEntriesForExport
    ? (Array.isArray(project.volumeEntries) ? project.volumeEntries : [])
        .map((entry) => {
          const parsedVolume = Number(entry.volume);
          if (!Number.isFinite(parsedVolume)) {
            return null;
          }
          const coverImageUrl = String(entry.coverImageUrl || "").trim();
          return {
            volume: parsedVolume,
            synopsis: String(entry.synopsis || "").trim(),
            coverImageUrl,
            coverImageAlt: coverImageUrl
              ? resolveAssetAltText(entry.coverImageAlt, `Capa do volume ${parsedVolume}`)
              : "",
          };
        })
        .filter((entry): entry is ProjectVolumeEntry => Boolean(entry))
        .sort((left, right) => left.volume - right.volume)
    : [];
  const normalizedVolumeCoversForExport = normalizedVolumeEntriesForExport
    .filter((entry) => String(entry.coverImageUrl || "").trim())
    .map((entry) => ({
      volume: entry.volume,
      coverImageUrl: entry.coverImageUrl,
      coverImageAlt: entry.coverImageAlt || `Capa do volume ${entry.volume}`,
    }));

  return {
    ...project,
    volumeEntries: normalizedVolumeEntriesForExport,
    volumeCovers: normalizedVolumeCoversForExport,
  };
};

export const downloadBinaryResponse = async (response: Response, fallbackName: string) => {
  const disposition = String(response.headers.get("Content-Disposition") || "");
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const fileName = match?.[1] ? decodeURIComponent(match[1]) : fallbackName;
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};
