import {
  getEpisodeEntryKind,
  getEpisodePublicationStatus,
  hasEpisodeContent,
  hasEpisodePages,
} from "./project-episodes.js";
import {
  getProjectEpisodeCompleteDownloadSources,
  isProjectEpisodePublic,
} from "../../shared/project-publication.js";

export const getPubliclyVisibleEpisodes = (project) =>
  (Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : []).filter((episode) =>
    isProjectEpisodePublic(project?.type || "", episode),
  );

const toPublicReadableEpisode = (episode) => ({
  ...(episode || {}),
  sources: getProjectEpisodeCompleteDownloadSources(episode),
});

export const toPublicEpisode = (episode) => {
  const { content: _content, pages: _pages, ...rest } = episode || {};
  return {
    ...toPublicReadableEpisode(rest),
    hasContent: hasEpisodeContent(episode),
    hasPages: hasEpisodePages(episode),
  };
};

export const toPublicReadableProject = (project) => ({
  ...project,
  episodeDownloads: getPubliclyVisibleEpisodes(project).map(toPublicReadableEpisode),
});

export const toPublicProject = (project) => ({
  ...project,
  episodeDownloads: getPubliclyVisibleEpisodes(project).map(toPublicEpisode),
});

export const buildPublicInProgressItems = (projects) =>
  (Array.isArray(projects) ? projects : [])
    .filter((project) => !project?.deletedAt)
    .sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0))
    .flatMap((project) =>
      (Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : [])
        .filter((episode) => getEpisodePublicationStatus(episode) === "draft")
        .map((episode) => ({
          projectId: String(project?.id || "").trim(),
          projectTitle: String(project?.title || "").trim(),
          projectType: String(project?.type || "").trim(),
          number: Number.isFinite(Number(episode?.number)) ? Number(episode.number) : 0,
          volume: Number.isFinite(Number(episode?.volume)) ? Number(episode.volume) : undefined,
          entryKind: getEpisodeEntryKind(episode),
          displayLabel: String(episode?.displayLabel || "").trim() || undefined,
          progressStage: String(episode?.progressStage || "").trim(),
          completedStages: Array.isArray(episode?.completedStages)
            ? episode.completedStages.map((stageId) => String(stageId || "").trim()).filter(Boolean)
            : [],
        })),
    );

export const buildPublicReadableProjects = (projects) =>
  (Array.isArray(projects) ? projects : [])
    .filter((project) => !project?.deletedAt)
    .sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0))
    .map(toPublicReadableProject);

export const buildPublicVisibleProjects = (projects) =>
  buildPublicReadableProjects(projects).map(toPublicProject);
