import type { DownloadSource, ProjectEpisode } from "@/data/projects";
import { isLightNovelType, isMangaType } from "@/lib/project-utils";

import {
  getProjectEpisodeCompleteDownloadSources as getProjectEpisodeCompleteDownloadSourcesBase,
  isProjectEpisodeDownloadSourceComplete as isProjectEpisodeDownloadSourceCompleteBase,
  resolveProjectEpisodePublicationState as resolveProjectEpisodePublicationStateBase,
} from "../../shared/project-publication.js";

export type ProjectEpisodePublicationRule = "download_only" | "reader_content_or_download";
export type ProjectEpisodePublicationErrorCode =
  | "download_sources_required_for_publication"
  | "reader_content_or_download_required_for_publication";

export type ProjectEpisodePublicationState = {
  publicationStatus: "draft" | "published";
  publicationRule: ProjectEpisodePublicationRule;
  hasDownloadSource: boolean;
  hasReadableContent: boolean;
  isPublicationReady: boolean;
  errorCode: ProjectEpisodePublicationErrorCode | null;
};

export const DOWNLOAD_SOURCES_REQUIRED_FOR_PUBLICATION_MESSAGE =
  "Epis\u00f3dios publicados precisam ter pelo menos uma fonte de download completa.";

export const READER_CONTENT_OR_DOWNLOAD_REQUIRED_FOR_PUBLICATION_MESSAGE =
  "Cap\u00edtulos publicados precisam ter conte\u00fado no leitor ou pelo menos uma fonte de download completa.";

const buildReaderContentOrDownloadMessage = (projectType?: string | null) => {
  if (isMangaType(projectType)) {
    return "Cap\u00edtulos publicados precisam ter p\u00e1ginas no leitor ou pelo menos uma fonte de download completa.";
  }
  if (isLightNovelType(projectType)) {
    return "Cap\u00edtulos publicados precisam ter conte\u00fado leg\u00edvel no leitor ou pelo menos uma fonte de download completa.";
  }
  return READER_CONTENT_OR_DOWNLOAD_REQUIRED_FOR_PUBLICATION_MESSAGE;
};

export const getProjectEpisodeCompleteDownloadSources = (
  episode: Partial<ProjectEpisode> | null | undefined,
): DownloadSource[] => getProjectEpisodeCompleteDownloadSourcesBase(episode) as DownloadSource[];

export const isProjectEpisodeDownloadSourceComplete = (
  source: Partial<DownloadSource> | null | undefined,
): boolean => isProjectEpisodeDownloadSourceCompleteBase(source);

export const resolveProjectEpisodePublicationState = (
  projectType: string,
  episode: Partial<ProjectEpisode> | null | undefined,
): ProjectEpisodePublicationState =>
  resolveProjectEpisodePublicationStateBase(
    projectType,
    episode,
  ) as ProjectEpisodePublicationState;

export const resolveProjectEpisodePublicationErrorState = (
  projectType: string,
  errorCode: string,
): { title: string; description: string } | null => {
  if (errorCode === "download_sources_required_for_publication") {
    return {
      title: "N\u00e3o foi poss\u00edvel publicar o epis\u00f3dio",
      description: DOWNLOAD_SOURCES_REQUIRED_FOR_PUBLICATION_MESSAGE,
    };
  }

  if (errorCode === "reader_content_or_download_required_for_publication") {
    return {
      title: "N\u00e3o foi poss\u00edvel publicar o cap\u00edtulo",
      description: buildReaderContentOrDownloadMessage(projectType),
    };
  }

  return null;
};
