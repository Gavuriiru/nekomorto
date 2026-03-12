import type { SiteSettings } from "@/types/site-settings";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import {
  emptyPublicPagesConfig,
  type PublicPagesConfig,
} from "@/types/public-pages";
import type { PublicTeamLinkType, PublicTeamMember } from "@/types/public-team";

export type PublicBootstrapEpisode = {
  number: number;
  volume?: number;
  title: string;
  releaseDate: string;
  duration: string;
  coverImageUrl: string;
  coverImageAlt: string;
  sourceType: string;
  sources: Array<{ label: string; url: string }>;
  progressStage: string;
  completedStages: string[];
  chapterUpdatedAt: string;
  hasContent: boolean;
};

export type PublicBootstrapVolumeCover = {
  volume?: number;
  coverImageUrl: string;
  coverImageAlt: string;
};

export type PublicBootstrapVolumeEntry = {
  volume: number;
  synopsis: string;
  coverImageUrl: string;
  coverImageAlt: string;
};

export type PublicBootstrapProject = {
  id: string;
  title: string;
  titleOriginal: string;
  titleEnglish: string;
  synopsis: string;
  description: string;
  type: string;
  status: string;
  tags: string[];
  genres: string[];
  cover: string;
  coverAlt: string;
  banner: string;
  bannerAlt: string;
  heroImageUrl: string;
  heroImageAlt: string;
  forceHero: boolean;
  trailerUrl: string;
  studio: string;
  animationStudios: string[];
  episodes: string;
  producers: string[];
  volumeEntries?: PublicBootstrapVolumeEntry[];
  volumeCovers: PublicBootstrapVolumeCover[];
  episodeDownloads: PublicBootstrapEpisode[];
  views: number;
  viewsDaily: Record<string, number>;
};

export type PublicBootstrapPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  coverImageUrl: string;
  coverAlt: string;
  projectId: string;
  tags: string[];
};

export type PublicBootstrapUpdate = {
  id: string;
  projectId: string;
  projectTitle: string;
  episodeNumber: number;
  volume?: number;
  kind: string;
  reason: string;
  updatedAt: string;
  image: string;
  unit: string;
};

export type PublicBootstrapPayloadMode = "full" | "critical-home";

export type PublicBootstrapPayload = {
  settings: SiteSettings;
  pages: PublicPagesConfig;
  projects: PublicBootstrapProject[];
  posts: PublicBootstrapPost[];
  updates: PublicBootstrapUpdate[];
  teamMembers: PublicTeamMember[];
  teamLinkTypes: PublicTeamLinkType[];
  mediaVariants?: UploadMediaVariantsMap;
  tagTranslations: {
    tags: Record<string, string>;
    genres: Record<string, string>;
    staffRoles: Record<string, string>;
  };
  generatedAt: string;
  payloadMode?: PublicBootstrapPayloadMode;
};

export const emptyPublicBootstrapPayload: PublicBootstrapPayload = {
  settings: {} as SiteSettings,
  pages: emptyPublicPagesConfig,
  projects: [],
  posts: [],
  updates: [],
  teamMembers: [],
  teamLinkTypes: [],
  mediaVariants: {},
  tagTranslations: {
    tags: {},
    genres: {},
    staffRoles: {},
  },
  generatedAt: "",
  payloadMode: "full",
};
