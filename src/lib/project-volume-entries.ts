import type { ProjectVolumeCover, ProjectVolumeEntry } from "@/data/projects";

export type ProjectVolumeEntryLike = ProjectVolumeEntry | ProjectVolumeCover;

const hasSynopsis = (entry: ProjectVolumeEntryLike): entry is ProjectVolumeEntry =>
  Object.prototype.hasOwnProperty.call(entry, "synopsis");

export const normalizeProjectVolumeEntries = (
  entries: ProjectVolumeEntryLike[] | null | undefined,
): ProjectVolumeEntry[] =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const volume = Number(entry?.volume);
      if (!Number.isFinite(volume)) {
        return null;
      }
      const coverImageUrl = String(entry?.coverImageUrl || "").trim();
      return {
        volume,
        synopsis: hasSynopsis(entry) ? String(entry.synopsis || "").trim() : "",
        coverImageUrl,
        coverImageAlt: coverImageUrl
          ? String(entry?.coverImageAlt || `Capa do volume ${volume}`).trim()
          : "",
      };
    })
    .filter((entry): entry is ProjectVolumeEntry => Boolean(entry))
    .sort((left, right) => left.volume - right.volume);
