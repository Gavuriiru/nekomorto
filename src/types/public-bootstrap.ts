import type { SiteSettings } from "@/types/site-settings";

export type PublicBootstrapEpisode = {
  number: number;
  volume?: number;
  title: string;
  releaseDate: string;
  duration: string;
  coverImageUrl: string;
  sourceType: string;
  sources: Array<{ label: string; url: string }>;
  progressStage: string;
  completedStages: string[];
  chapterUpdatedAt: string;
  hasContent: boolean;
};

export type PublicBootstrapProject = {
  id: string;
  title: string;
  synopsis: string;
  description: string;
  type: string;
  status: string;
  tags: string[];
  cover: string;
  banner: string;
  heroImageUrl: string;
  forceHero: boolean;
  trailerUrl: string;
  episodeDownloads: PublicBootstrapEpisode[];
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
  kind: string;
  reason: string;
  updatedAt: string;
  image: string;
  unit: string;
};

export type PublicBootstrapPayload = {
  settings: SiteSettings;
  projects: PublicBootstrapProject[];
  posts: PublicBootstrapPost[];
  updates: PublicBootstrapUpdate[];
  tagTranslations: {
    tags: Record<string, string>;
    genres: Record<string, string>;
    staffRoles: Record<string, string>;
  };
  generatedAt: string;
};

export const emptyPublicBootstrapPayload: PublicBootstrapPayload = {
  settings: {} as SiteSettings,
  projects: [],
  posts: [],
  updates: [],
  tagTranslations: {
    tags: {},
    genres: {},
    staffRoles: {},
  },
  generatedAt: "",
};
