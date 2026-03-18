import {
  hasProjectEpisodePages,
  hasProjectEpisodeReadableContent,
} from "../../shared/project-reader.js";

type PublicEpisodeLike = {
  hasContent?: boolean;
  hasPages?: boolean;
  content?: string;
  contentFormat?: "lexical" | "images";
  pages?: Array<{ position?: number; imageUrl?: string; spreadPairId?: string }>;
  pageCount?: number;
} | null | undefined;

export const hasPublicEpisodePages = (episode: PublicEpisodeLike) =>
  Boolean(episode?.hasPages) || hasProjectEpisodePages(episode);

export const hasPublicEpisodeReadableContent = (episode: PublicEpisodeLike) =>
  Boolean(episode?.hasContent) ||
  hasPublicEpisodePages(episode) ||
  hasProjectEpisodeReadableContent(episode);
