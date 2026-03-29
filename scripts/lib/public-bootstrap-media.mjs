import { normalizeUploadUrl } from "../../server/lib/uploads-reorganizer.js";

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 12;
  }
  return Math.max(1, Math.floor(parsed));
};

const toCandidate = (label, value) => {
  const url = normalizeUploadUrl(value);
  if (!url) {
    return null;
  }
  return { label, url };
};

const pushCandidate = (items, label, value) => {
  const candidate = toCandidate(label, value);
  if (!candidate) {
    return;
  }
  items.push(candidate);
};

const appendUniqueCandidates = (target, seen, candidates, limit) => {
  for (const candidate of candidates) {
    if (target.length >= limit) {
      return;
    }
    if (!candidate?.url || seen.has(candidate.url)) {
      continue;
    }
    seen.add(candidate.url);
    target.push(candidate);
  }
};

export const collectBootstrapPublicMediaUrls = (payload, options = {}) => {
  const limit = normalizeLimit(options.limit);
  const projects = Array.isArray(payload?.projects) ? payload.projects : [];
  const posts = Array.isArray(payload?.posts) ? payload.posts : [];

  const projectCovers = [];
  const firstEpisodeCovers = [];
  const projectBanners = [];
  const projectHeroes = [];
  const remainingEpisodeCovers = [];
  const postCovers = [];
  const pageShareImages = [];

  projects.forEach((project, projectIndex) => {
    pushCandidate(projectCovers, `projects[${projectIndex}].cover`, project?.cover);
  });

  projects.forEach((project, projectIndex) => {
    const episodeDownloads = Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : [];
    if (episodeDownloads.length > 0) {
      pushCandidate(
        firstEpisodeCovers,
        `projects[${projectIndex}].episodeDownloads[0].coverImageUrl`,
        episodeDownloads[0]?.coverImageUrl,
      );
    }
  });

  projects.forEach((project, projectIndex) => {
    pushCandidate(projectBanners, `projects[${projectIndex}].banner`, project?.banner);
  });

  projects.forEach((project, projectIndex) => {
    pushCandidate(projectHeroes, `projects[${projectIndex}].heroImageUrl`, project?.heroImageUrl);
  });

  projects.forEach((project, projectIndex) => {
    const episodeDownloads = Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : [];
    episodeDownloads.forEach((episode, episodeIndex) => {
      if (episodeIndex === 0) {
        return;
      }
      pushCandidate(
        remainingEpisodeCovers,
        `projects[${projectIndex}].episodeDownloads[${episodeIndex}].coverImageUrl`,
        episode?.coverImageUrl,
      );
    });
  });

  posts.forEach((post, postIndex) => {
    pushCandidate(postCovers, `posts[${postIndex}].coverImageUrl`, post?.coverImageUrl);
  });

  pushCandidate(pageShareImages, "pages.home.shareImage", payload?.pages?.home?.shareImage);

  const items = [];
  const seen = new Set();
  const primaryQuota = Math.max(1, Math.ceil(limit / 2));

  appendUniqueCandidates(items, seen, projectCovers.slice(0, primaryQuota), limit);
  appendUniqueCandidates(items, seen, firstEpisodeCovers.slice(0, primaryQuota), limit);
  appendUniqueCandidates(items, seen, projectCovers.slice(primaryQuota), limit);
  appendUniqueCandidates(items, seen, firstEpisodeCovers.slice(primaryQuota), limit);
  appendUniqueCandidates(items, seen, projectBanners, limit);
  appendUniqueCandidates(items, seen, projectHeroes, limit);
  appendUniqueCandidates(items, seen, remainingEpisodeCovers, limit);
  appendUniqueCandidates(items, seen, postCovers, limit);
  appendUniqueCandidates(items, seen, pageShareImages, limit);

  return items;
};
