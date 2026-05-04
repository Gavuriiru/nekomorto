import type {
  ProjectEpisode,
  ProjectReaderConfig,
  ProjectVolumeCover,
  ProjectVolumeEntry,
} from "@/data/projects";

export type ProjectRelation = {
  relation: string;
  title: string;
  format: string;
  status: string;
  image: string;
  anilistId?: number;
  projectId?: string;
};

export type ProjectStaff = {
  role: string;
  members: string[];
};

export type TaxonomySuggestionOption = {
  value: string;
  label: string;
  normalizedValue: string;
  normalizedLabel: string;
};

export type EditorProjectEpisode = ProjectEpisode & {
  _editorKey?: string;
};

export type ProjectRecord = {
  id: string;
  anilistId?: number | null;
  title: string;
  titleOriginal?: string;
  titleEnglish?: string;
  synopsis: string;
  description: string;
  type: string;
  status: string;
  year: string;
  studio: string;
  animationStudios: string[];
  episodes: string;
  tags: string[];
  genres: string[];
  cover: string;
  coverAlt: string;
  banner: string;
  bannerAlt: string;
  season: string;
  schedule: string;
  rating: string;
  country: string;
  source: string;
  discordRoleId?: string;
  producers: string[];
  score: number | null;
  startDate: string;
  endDate: string;
  relations: ProjectRelation[];
  staff: ProjectStaff[];
  animeStaff: ProjectStaff[];
  trailerUrl: string;
  forceHero?: boolean;
  heroImageUrl: string;
  heroImageAlt: string;
  heroLogoUrl: string;
  heroLogoAlt: string;
  readerConfig?: ProjectReaderConfig;
  volumeEntries: ProjectVolumeEntry[];
  volumeCovers: ProjectVolumeCover[];
  episodeDownloads: EditorProjectEpisode[];
  views: number;
  commentsCount: number;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
};

export type ProjectForm = Omit<
  ProjectRecord,
  "views" | "commentsCount" | "order" | "episodeDownloads"
> & {
  episodeDownloads: EditorProjectEpisode[];
};

export type SortedEpisodeItem = {
  episode: EditorProjectEpisode;
  index: number;
};

export type EpisodeVolumeGroup = {
  key: string;
  volume?: number;
  hasNumericVolume: boolean;
  volumeEntryIndex: number | null;
  episodeItems: SortedEpisodeItem[];
};

export type AniListMedia = {
  id: number;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  description?: string | null;
  episodes?: number | null;
  genres?: string[] | null;
  format?: string | null;
  status?: string | null;
  countryOfOrigin?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  endDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  source?: string | null;
  averageScore?: number | null;
  bannerImage?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
  studios?: {
    edges?: Array<{
      isMain?: boolean | null;
      node?: {
        id?: number | string | null;
        name?: string | null;
        isAnimationStudio?: boolean | null;
      } | null;
    }>;
  } | null;
  organization?: {
    studio?: string | null;
    animationStudios?: string[] | null;
    producers?: string[] | null;
  } | null;
  tags?: Array<{ name: string; rank?: number | null; isMediaSpoiler?: boolean | null }> | null;
  trailer?: { id?: string | null; site?: string | null } | null;
  relations?: {
    edges?: Array<{ relationType?: string | null }>;
    nodes?: Array<{
      id: number;
      title?: { romaji?: string | null } | null;
      format?: string | null;
      status?: string | null;
      coverImage?: { large?: string | null } | null;
    }>;
  } | null;
  staff?: {
    edges?: Array<{ role?: string | null }>;
    nodes?: Array<{ name?: { full?: string | null } | null }>;
  } | null;
};
