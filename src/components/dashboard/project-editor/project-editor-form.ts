import type { ProjectVolumeCover, ProjectVolumeEntry } from "@/data/projects";
import {
  buildProjectVolumeCoversFromEntries as buildNormalizedProjectVolumeCoversFromEntries,
  resolveProjectAssetAltText,
  resolveProjectEpisodeAssetAltText,
  resolveProjectVolumeAssetAltText,
} from "@/lib/dashboard-image-library";
import { parseHumanSizeToBytes } from "@/lib/file-size";
import {
  generateEpisodeEditorLocalId,
  resolveEpisodeEditorLocalKey,
} from "@/lib/project-anime-episodes";
import { buildEpisodeKey, findDuplicateEpisodeKey } from "@/lib/project-episode-key";
import { getProjectProgressStateForEditor } from "@/lib/project-progress";
import { resolveProjectEpisodePublicationState } from "@/lib/project-publication";
import { isChapterBasedType, isLightNovelType, isMangaType } from "@/lib/project-utils";
import { buildVolumeCoverKey, findDuplicateVolumeCover } from "@/lib/project-volume-cover-key";
import { normalizeProjectVolumeEntries } from "@/lib/project-volume-entries";

import type {
  EditorProjectEpisode,
  EpisodeVolumeGroup,
  ProjectForm,
  ProjectRecord,
  ProjectStaff,
  SortedEpisodeItem,
} from "./dashboard-projects-editor-types";

export const buildEmptyProjectForm = (): ProjectForm => ({
  id: "",
  anilistId: null,
  title: "",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "",
  description: "",
  type: "Anime",
  status: "Em andamento",
  year: "",
  studio: "",
  animationStudios: [],
  episodes: "",
  tags: [],
  genres: [],
  cover: "",
  coverAlt: "",
  banner: "",
  bannerAlt: "",
  season: "",
  schedule: "",
  rating: "",
  country: "",
  source: "",
  discordRoleId: "",
  producers: [],
  score: null,
  startDate: "",
  endDate: "",
  relations: [],
  staff: [],
  animeStaff: [],
  trailerUrl: "",
  forceHero: false,
  heroImageUrl: "",
  heroImageAlt: "",
  readerConfig: {},
  volumeEntries: [],
  volumeCovers: [],
  episodeDownloads: [],
});

export const normalizeUniqueStringList = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  return values.reduce<string[]>((acc, value) => {
    const normalized = String(value || "").trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      return acc;
    }
    seen.add(key);
    acc.push(normalized);
    return acc;
  }, []);
};

const normalizeProjectRecordEpisode = (
  episode: EditorProjectEpisode,
  projectType: string,
): EditorProjectEpisode => ({
  ...episode,
  synopsis: String(episode.synopsis || "").trim(),
  _editorKey: resolveEpisodeEditorLocalKey(episode),
  entryKind: episode.entryKind === "extra" ? "extra" : "main",
  entrySubtype: String(episode.entrySubtype || "").trim() || undefined,
  readingOrder: Number.isFinite(Number(episode.readingOrder))
    ? Number(episode.readingOrder)
    : undefined,
  displayLabel:
    episode.entryKind === "extra"
      ? String(episode.displayLabel || "").trim() || undefined
      : undefined,
  content: episode.content || "",
  contentFormat: "lexical",
  publicationStatus: episode.publicationStatus === "draft" ? "draft" : "published",
  coverImageAlt: episode.coverImageUrl
    ? resolveProjectEpisodeAssetAltText({
        altText: episode.coverImageAlt,
        isChapterBased: isChapterBasedType(projectType || ""),
      })
    : "",
});

export const supportsProjectVolumeEntries = (projectType?: string | null) =>
  isLightNovelType(projectType || "") || isMangaType(projectType || "");

export const buildProjectVolumeCoversFromEntries = (
  entries: ProjectVolumeEntry[],
): ProjectVolumeCover[] =>
  buildNormalizedProjectVolumeCoversFromEntries(entries).map((entry) => ({
    ...entry,
    coverImageAlt:
      entry.coverImageAlt || resolveProjectVolumeAssetAltText(entry.volume, entry.coverImageAlt),
  }));

export const buildProjectFormFromRecord = (project: ProjectRecord): ProjectForm => {
  const normalizedEpisodes = Array.isArray(project.episodeDownloads)
    ? project.episodeDownloads.map((episode) =>
        normalizeProjectRecordEpisode(episode, project.type),
      )
    : [];
  const mergedSynopsis = project.synopsis || project.description || "";
  const normalizedVolumeEntries = normalizeProjectVolumeEntries(
    Array.isArray(project.volumeEntries)
      ? project.volumeEntries
      : Array.isArray(project.volumeCovers)
        ? project.volumeCovers
        : [],
  );

  return {
    id: project.id,
    anilistId: project.anilistId ?? null,
    title: project.title || "",
    titleOriginal: project.titleOriginal || "",
    titleEnglish: project.titleEnglish || "",
    synopsis: mergedSynopsis,
    description: mergedSynopsis,
    type: project.type || "",
    status: project.status || "",
    year: project.year || "",
    studio: project.studio || "",
    animationStudios: Array.isArray(project.animationStudios) ? project.animationStudios : [],
    episodes: project.episodes || "",
    tags: Array.isArray(project.tags) ? project.tags : [],
    genres: Array.isArray(project.genres) ? project.genres : [],
    cover: project.cover || "",
    coverAlt: project.cover ? resolveProjectAssetAltText("cover", project.coverAlt) : "",
    banner: project.banner || "",
    bannerAlt: project.banner ? resolveProjectAssetAltText("banner", project.bannerAlt) : "",
    season: project.season || "",
    schedule: project.schedule || "",
    rating: project.rating || "",
    country: project.country || "",
    source: project.source || "",
    discordRoleId: project.discordRoleId || "",
    producers: Array.isArray(project.producers) ? project.producers : [],
    score: project.score ?? null,
    startDate: project.startDate || "",
    endDate: project.endDate || "",
    relations: Array.isArray(project.relations) ? project.relations : [],
    staff: Array.isArray(project.staff) ? project.staff : [],
    animeStaff: Array.isArray(project.animeStaff) ? project.animeStaff : [],
    trailerUrl: project.trailerUrl || "",
    forceHero: Boolean(project.forceHero),
    heroImageUrl: project.heroImageUrl || "",
    heroImageAlt: project.heroImageUrl
      ? resolveProjectAssetAltText("hero", project.heroImageAlt)
      : "",
    readerConfig:
      project.readerConfig && typeof project.readerConfig === "object" ? project.readerConfig : {},
    volumeEntries: normalizedVolumeEntries,
    volumeCovers: buildProjectVolumeCoversFromEntries(normalizedVolumeEntries),
    episodeDownloads: normalizedEpisodes,
  };
};

export const normalizeProjectEpisodesForSave = (formState: ProjectForm): EditorProjectEpisode[] =>
  formState.episodeDownloads.map((episode) => {
    const parsedNumber = Number(episode.number);
    const parsedVolume = Number(episode.volume);
    const parsedReadingOrder = Number(episode.readingOrder);
    const entryKind: "main" | "extra" = episode.entryKind === "extra" ? "extra" : "main";
    return {
      ...episode,
      number: Number.isFinite(parsedNumber) ? parsedNumber : 0,
      volume: Number.isFinite(parsedVolume) ? parsedVolume : undefined,
      entryKind,
      entrySubtype:
        String(episode.entrySubtype || "").trim() || (entryKind === "extra" ? "extra" : "chapter"),
      readingOrder: Number.isFinite(parsedReadingOrder)
        ? Math.round(parsedReadingOrder)
        : undefined,
      displayLabel:
        entryKind === "extra" ? String(episode.displayLabel || "").trim() || undefined : undefined,
      contentFormat: "lexical" as const,
      publicationStatus: episode.publicationStatus === "draft" ? "draft" : "published",
      sources: Array.isArray(episode.sources)
        ? episode.sources.map((source) => ({ ...source }))
        : [],
    };
  });

export const normalizeProjectVolumeEntriesForSave = (
  formState: ProjectForm,
): ProjectVolumeEntry[] => {
  if (!supportsProjectVolumeEntries(formState.type)) {
    return [];
  }

  return formState.volumeEntries
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
          ? resolveProjectVolumeAssetAltText(parsedVolume, entry.coverImageAlt)
          : "",
      };
    })
    .filter((entry): entry is ProjectVolumeEntry => Boolean(entry))
    .sort((left, right) => left.volume - right.volume);
};

export const resolveProjectVolumeEntryIndexByVolume = <
  TEntry extends { volume?: number | null | undefined },
>(
  entries: TEntry[],
  volume?: number,
) => {
  if (!Number.isFinite(Number(volume))) {
    return -1;
  }
  const normalizedVolume = Number(volume);
  return entries.findIndex(
    (entry) => buildVolumeCoverKey(entry?.volume) === buildVolumeCoverKey(normalizedVolume),
  );
};

export const buildProjectEpisodeVolumeGroups = ({
  isChapterBased,
  sortedEpisodeDownloads,
  supportsVolumeEntries,
  volumeEntries,
}: {
  isChapterBased: boolean;
  sortedEpisodeDownloads: SortedEpisodeItem[];
  supportsVolumeEntries: boolean;
  volumeEntries: ProjectVolumeEntry[];
}): EpisodeVolumeGroup[] => {
  if (!isChapterBased || !supportsVolumeEntries) {
    return [];
  }

  const groups = new Map<string, EpisodeVolumeGroup>();
  const ensureGroup = (volume?: number) => {
    const key = buildVolumeCoverKey(volume);
    const existing = groups.get(key);
    if (existing) {
      return existing;
    }
    const hasNumericVolume = Number.isFinite(Number(volume));
    const nextGroup: EpisodeVolumeGroup = {
      key,
      volume: hasNumericVolume ? Number(volume) : undefined,
      hasNumericVolume,
      volumeEntryIndex: null,
      episodeItems: [],
    };
    groups.set(key, nextGroup);
    return nextGroup;
  };

  sortedEpisodeDownloads.forEach((item) => {
    ensureGroup(item.episode.volume).episodeItems.push(item);
  });

  volumeEntries.forEach((entry, index) => {
    const parsedVolume = Number(entry?.volume);
    if (!Number.isFinite(parsedVolume)) {
      return;
    }
    const group = ensureGroup(parsedVolume);
    group.volumeEntryIndex = index;
  });

  return [...groups.values()].sort((left, right) => {
    if (left.hasNumericVolume && right.hasNumericVolume) {
      return Number(left.volume || 0) - Number(right.volume || 0);
    }
    if (left.hasNumericVolume) {
      return -1;
    }
    if (right.hasNumericVolume) {
      return 1;
    }
    return 0;
  });
};

export const buildProjectEpisodeGroupsForRender = ({
  isChapterBased,
  sortedEpisodeDownloads,
  supportsVolumeEntries,
  volumeGroups,
}: {
  isChapterBased: boolean;
  sortedEpisodeDownloads: SortedEpisodeItem[];
  supportsVolumeEntries: boolean;
  volumeGroups: EpisodeVolumeGroup[];
}): EpisodeVolumeGroup[] => {
  if (isChapterBased && supportsVolumeEntries) {
    return volumeGroups;
  }
  return [
    {
      key: "all",
      volume: undefined,
      hasNumericVolume: false,
      volumeEntryIndex: null,
      episodeItems: sortedEpisodeDownloads,
    },
  ];
};

type ProjectEpisodeFocusTarget = Pick<EditorProjectEpisode, "number" | "volume">;

const matchesProjectEpisodeFocus = (
  episode: EditorProjectEpisode,
  pendingEpisodeFocus: ProjectEpisodeFocusTarget,
) => {
  if (Number(episode.number) !== pendingEpisodeFocus.number) {
    return false;
  }
  if (!Number.isFinite(pendingEpisodeFocus.volume)) {
    return true;
  }
  return (
    buildEpisodeKey(episode.number, episode.volume) ===
    buildEpisodeKey(pendingEpisodeFocus.number, pendingEpisodeFocus.volume)
  );
};

export const resolveProjectEpisodeFocusIndex = (
  episodes: EditorProjectEpisode[],
  pendingEpisodeFocus: ProjectEpisodeFocusTarget | null | undefined,
) => {
  if (!pendingEpisodeFocus) {
    return -1;
  }

  const matches = episodes
    .map((episode, index) => ({ episode, index }))
    .filter(({ episode }) => matchesProjectEpisodeFocus(episode, pendingEpisodeFocus));

  if (!matches.length) {
    return -1;
  }
  if (!Number.isFinite(pendingEpisodeFocus.volume) && matches.length !== 1) {
    return -1;
  }
  return matches[0]?.index ?? -1;
};

export const resolveSortedProjectEpisodeFocusIndex = (
  episodes: SortedEpisodeItem[],
  pendingEpisodeFocus: ProjectEpisodeFocusTarget | null | undefined,
) => {
  if (!pendingEpisodeFocus) {
    return -1;
  }

  const matches = episodes.filter(({ episode }) =>
    matchesProjectEpisodeFocus(episode, pendingEpisodeFocus),
  );

  if (!matches.length) {
    return -1;
  }
  if (!Number.isFinite(pendingEpisodeFocus.volume) && matches.length !== 1) {
    return -1;
  }
  return matches[0]?.index ?? -1;
};

export type PrepareProjectSaveStateResult =
  | {
      ok: true;
      nextEpisodeSizeDrafts: Record<number, string>;
      nextEpisodeSizeErrors: Record<number, string>;
      normalizedDiscordRoleId: string;
      normalizedEpisodesForSave: EditorProjectEpisode[];
      normalizedTitle: string;
      normalizedVolumeEntriesForSave: ProjectVolumeEntry[];
    }
  | {
      ok: false;
      code:
        | "title_required"
        | "discord_role_invalid"
        | "duplicate_episode"
        | "duplicate_volume"
        | "invalid_episode_size"
        | "download_sources_required_for_publication"
        | "reader_content_or_download_required_for_publication";
      duplicateEpisodeIndex?: number;
      invalidPublishedEpisodeIndex?: number;
      firstInvalidEpisodeSizeIndex?: number | null;
      nextEpisodeSizeDrafts: Record<number, string>;
      nextEpisodeSizeErrors: Record<number, string>;
      normalizedDiscordRoleId: string;
      normalizedTitle: string;
    };

export const prepareProjectSaveState = ({
  episodeSizeDrafts,
  episodeSizeErrors,
  formState,
}: {
  episodeSizeDrafts: Record<number, string>;
  episodeSizeErrors: Record<number, string>;
  formState: ProjectForm;
}): PrepareProjectSaveStateResult => {
  const normalizedTitle = formState.title.trim();
  const normalizedDiscordRoleId = String(formState.discordRoleId || "").trim();

  if (!normalizedTitle) {
    return {
      ok: false,
      code: "title_required",
      nextEpisodeSizeDrafts: episodeSizeDrafts,
      nextEpisodeSizeErrors: episodeSizeErrors,
      normalizedDiscordRoleId,
      normalizedTitle,
    };
  }

  if (normalizedDiscordRoleId && !/^\d+$/.test(normalizedDiscordRoleId)) {
    return {
      ok: false,
      code: "discord_role_invalid",
      nextEpisodeSizeDrafts: episodeSizeDrafts,
      nextEpisodeSizeErrors: episodeSizeErrors,
      normalizedDiscordRoleId,
      normalizedTitle,
    };
  }

  const normalizedEpisodesForSave = normalizeProjectEpisodesForSave(formState);
  const duplicateEpisode = findDuplicateEpisodeKey(normalizedEpisodesForSave);
  if (duplicateEpisode) {
    return {
      ok: false,
      code: "duplicate_episode",
      duplicateEpisodeIndex: normalizedEpisodesForSave.findIndex(
        (episode) => buildEpisodeKey(episode.number, episode.volume) === duplicateEpisode.key,
      ),
      nextEpisodeSizeDrafts: episodeSizeDrafts,
      nextEpisodeSizeErrors: episodeSizeErrors,
      normalizedDiscordRoleId,
      normalizedTitle,
    };
  }

  const supportsVolumeEntriesForSave = supportsProjectVolumeEntries(formState.type);
  const normalizedVolumeEntriesForSave = normalizeProjectVolumeEntriesForSave(formState);
  const duplicateVolumeEntry = findDuplicateVolumeCover(normalizedVolumeEntriesForSave);
  if (supportsVolumeEntriesForSave && duplicateVolumeEntry) {
    return {
      ok: false,
      code: "duplicate_volume",
      nextEpisodeSizeDrafts: episodeSizeDrafts,
      nextEpisodeSizeErrors: episodeSizeErrors,
      normalizedDiscordRoleId,
      normalizedTitle,
    };
  }

  const nextEpisodeSizeDrafts = { ...episodeSizeDrafts };
  const nextEpisodeSizeErrors = { ...episodeSizeErrors };
  let firstInvalidEpisodeSizeIndex: number | null = null;

  Object.entries(episodeSizeDrafts).forEach(([key, draftValue]) => {
    const episodeIndex = Number(key);
    if (!Number.isFinite(episodeIndex)) {
      delete nextEpisodeSizeDrafts[episodeIndex];
      delete nextEpisodeSizeErrors[episodeIndex];
      return;
    }
    const episode = normalizedEpisodesForSave[episodeIndex];
    if (!episode) {
      delete nextEpisodeSizeDrafts[episodeIndex];
      delete nextEpisodeSizeErrors[episodeIndex];
      return;
    }
    const trimmedSize = String(draftValue || "").trim();
    if (!trimmedSize) {
      episode.sizeBytes = undefined;
      delete nextEpisodeSizeDrafts[episodeIndex];
      delete nextEpisodeSizeErrors[episodeIndex];
      return;
    }
    const parsedSize = parseHumanSizeToBytes(trimmedSize);
    if (!parsedSize) {
      nextEpisodeSizeErrors[episodeIndex] = "Use formatos como 700 MB ou 1.4 GB.";
      if (firstInvalidEpisodeSizeIndex === null) {
        firstInvalidEpisodeSizeIndex = episodeIndex;
      }
      return;
    }
    episode.sizeBytes = parsedSize;
    delete nextEpisodeSizeDrafts[episodeIndex];
    delete nextEpisodeSizeErrors[episodeIndex];
  });

  const hasInvalidEpisodeSize = Object.keys(nextEpisodeSizeErrors).some((key) => {
    const index = Number(key);
    return Number.isFinite(index) && String(nextEpisodeSizeErrors[index] || "").trim().length > 0;
  });

  if (hasInvalidEpisodeSize) {
    return {
      ok: false,
      code: "invalid_episode_size",
      firstInvalidEpisodeSizeIndex,
      nextEpisodeSizeDrafts,
      nextEpisodeSizeErrors,
      normalizedDiscordRoleId,
      normalizedTitle,
    };
  }

  const invalidPublishedEpisodeIndex = normalizedEpisodesForSave.findIndex((episode) => {
    const publicationState = resolveProjectEpisodePublicationState(formState.type || "", episode);
    return episode.publicationStatus === "published" && Boolean(publicationState.errorCode);
  });

  if (invalidPublishedEpisodeIndex >= 0) {
    const invalidPublicationState = resolveProjectEpisodePublicationState(
      formState.type || "",
      normalizedEpisodesForSave[invalidPublishedEpisodeIndex],
    );
    return {
      ok: false,
      code:
        invalidPublicationState.errorCode || "reader_content_or_download_required_for_publication",
      invalidPublishedEpisodeIndex,
      nextEpisodeSizeDrafts,
      nextEpisodeSizeErrors: {},
      normalizedDiscordRoleId,
      normalizedTitle,
    };
  }

  return {
    ok: true,
    nextEpisodeSizeDrafts,
    nextEpisodeSizeErrors: {},
    normalizedDiscordRoleId,
    normalizedEpisodesForSave,
    normalizedTitle,
    normalizedVolumeEntriesForSave,
  };
};

const appendPendingStaffMembers = (
  staff: ProjectStaff[],
  staffMemberInput: Record<number, string>,
): ProjectStaff[] =>
  staff.map((item, index) => {
    const pendingName = String(staffMemberInput[index] || "").trim();
    if (!pendingName) {
      return item;
    }
    const members = item.members || [];
    return {
      ...item,
      members: members.includes(pendingName) ? members : [...members, pendingName],
    };
  });

type BuildProjectSavePayloadArgs = {
  anilistIdInput: string;
  editingProject: ProjectRecord | null;
  formState: ProjectForm;
  normalizedEpisodesForSave: EditorProjectEpisode[];
  normalizedVolumeEntriesForSave: ProjectVolumeEntry[];
  staffMemberInput: Record<number, string>;
};

export const buildProjectSavePayload = ({
  anilistIdInput,
  editingProject,
  formState,
  normalizedEpisodesForSave,
  normalizedVolumeEntriesForSave,
  staffMemberInput,
}: BuildProjectSavePayloadArgs): ProjectForm => {
  const prevEpisodesMap = new Map<string, EditorProjectEpisode>();
  if (editingProject?.episodeDownloads?.length) {
    editingProject.episodeDownloads.forEach((episode) => {
      prevEpisodesMap.set(buildEpisodeKey(episode.number, episode.volume), episode);
    });
  }

  const staffWithPending = appendPendingStaffMembers(formState.staff, staffMemberInput);
  const normalizedVolumeCoversForSave = buildProjectVolumeCoversFromEntries(
    normalizedVolumeEntriesForSave,
  );
  const normalizedAniListInput = String(anilistIdInput || "").trim();
  const parsedAniListId = normalizedAniListInput ? Number(normalizedAniListInput) : NaN;
  const resolvedAniListId =
    typeof formState.anilistId === "number" &&
    Number.isInteger(formState.anilistId) &&
    formState.anilistId > 0
      ? formState.anilistId
      : Number.isInteger(parsedAniListId) && parsedAniListId > 0
        ? parsedAniListId
        : null;
  const baseId = String(formState.id || "").trim();
  const normalizedId = editingProject?.id
    ? editingProject.id
    : resolvedAniListId
      ? String(resolvedAniListId)
      : baseId || generateEpisodeEditorLocalId();

  return {
    ...formState,
    anilistId: resolvedAniListId,
    id: normalizedId,
    title: formState.title.trim(),
    titleOriginal: formState.titleOriginal?.trim() || "",
    titleEnglish: formState.titleEnglish?.trim() || "",
    synopsis: formState.synopsis?.trim() || "",
    description: formState.synopsis?.trim() || "",
    type: formState.type?.trim() || "",
    status: formState.status?.trim() || "",
    year: formState.year?.trim() || "",
    studio: formState.studio?.trim() || "",
    animationStudios: normalizeUniqueStringList(formState.animationStudios),
    episodes: formState.episodes?.trim() || "",
    tags: formState.tags.filter(Boolean),
    genres: formState.genres.filter(Boolean),
    cover: formState.cover?.trim() || "",
    coverAlt: formState.cover?.trim()
      ? resolveProjectAssetAltText("cover", formState.coverAlt)
      : "",
    banner: formState.banner?.trim() || "",
    bannerAlt: formState.banner?.trim()
      ? resolveProjectAssetAltText("banner", formState.bannerAlt)
      : "",
    season: formState.season?.trim() || "",
    schedule: formState.schedule?.trim() || "",
    rating: formState.rating?.trim() || "",
    country: formState.country?.trim() || "",
    source: formState.source?.trim() || "",
    discordRoleId: String(formState.discordRoleId || "").trim() || "",
    producers: normalizeUniqueStringList(formState.producers),
    startDate: formState.startDate || "",
    endDate: formState.endDate || "",
    trailerUrl: formState.trailerUrl?.trim() || "",
    forceHero: Boolean(formState.forceHero),
    heroImageUrl: formState.heroImageUrl?.trim() || "",
    heroImageAlt: formState.heroImageUrl?.trim()
      ? resolveProjectAssetAltText("hero", formState.heroImageAlt)
      : "",
    relations: formState.relations
      .filter((item) => item.title || item.relation || item.projectId)
      .filter((item, index, arr) => {
        const key = item.projectId || item.anilistId || item.title;
        if (!key) {
          return true;
        }
        return (
          arr.findIndex((rel) => (rel.projectId || rel.anilistId || rel.title) === key) === index
        );
      }),
    staff: staffWithPending.filter((item) => item.role || item.members.length > 0),
    animeStaff: formState.animeStaff.filter((item) => item.role || item.members.length > 0),
    volumeEntries: normalizedVolumeEntriesForSave,
    volumeCovers: normalizedVolumeCoversForSave,
    episodeDownloads: normalizedEpisodesForSave.map((episode) => {
      const { _editorKey: _ignoredEditorKey, ...episodePayload } = episode;
      const prev = prevEpisodesMap.get(buildEpisodeKey(episode.number, episode.volume));
      const hash = String(episode.hash || "").trim();
      const coverImageUrl = String(episode.coverImageUrl || "").trim();
      const parsedSize = Number(episode.sizeBytes);
      const sizeBytes =
        Number.isFinite(parsedSize) && parsedSize > 0 ? Math.round(parsedSize) : undefined;
      const progressState = getProjectProgressStateForEditor(
        formState.type || "",
        episode.completedStages,
      );
      return {
        ...episodePayload,
        coverImageUrl,
        coverImageAlt: coverImageUrl
          ? resolveProjectEpisodeAssetAltText({
              altText: episode.coverImageAlt,
              isChapterBased: isChapterBasedType(formState.type || ""),
            })
          : "",
        hash: hash || undefined,
        sizeBytes,
        sources: (episode.sources || [])
          .map((source) => ({
            label: String(source.label || "").trim(),
            url: String(source.url || "").trim(),
          }))
          .filter((source) => source.url || source.label),
        completedStages: progressState.completedStages,
        progressStage: progressState.currentStageId,
        contentFormat: "lexical",
        publicationStatus: episode.publicationStatus === "draft" ? "draft" : "published",
        chapterUpdatedAt: prev?.chapterUpdatedAt || episode.chapterUpdatedAt || "",
      };
    }),
  };
};
