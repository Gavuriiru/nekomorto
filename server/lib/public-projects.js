import { hasEpisodeContent, hasEpisodePages, isPublishedEpisode } from "./project-episodes.js";

export const getPubliclyVisibleEpisodes = (project) =>
  (Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : []).filter((episode) =>
    isPublishedEpisode(episode),
  );

export const toPublicEpisode = (episode) => {
  const { content: _content, pages: _pages, ...rest } = episode || {};
  return {
    ...rest,
    hasContent: hasEpisodeContent(episode),
    hasPages: hasEpisodePages(episode),
  };
};

export const toPublicReadableProject = (project) => ({
  ...project,
  episodeDownloads: getPubliclyVisibleEpisodes(project),
});

export const toPublicProject = (project) => ({
  ...project,
  episodeDownloads: getPubliclyVisibleEpisodes(project).map(toPublicEpisode),
});

export const buildPublicReadableProjects = (projects) =>
  (Array.isArray(projects) ? projects : [])
    .filter((project) => !project?.deletedAt)
    .sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0))
    .map(toPublicReadableProject);

export const buildPublicVisibleProjects = (projects) =>
  buildPublicReadableProjects(projects).map(toPublicProject);
