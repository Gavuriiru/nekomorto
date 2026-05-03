import {
  getProjectEpisodeCompleteDownloadSources,
  isProjectEpisodePublic,
  resolveProjectEpisodePublicationState,
} from "../../shared/project-publication.js";
import {
  hasProjectEpisodePages,
  hasProjectEpisodeReadableContent,
  normalizeProjectEpisodeContentFormat,
} from "../../shared/project-reader.js";

export const getEpisodeNumberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getEpisodeReadingOrderValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getEpisodeVolumeValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getEpisodeEntryKind = (episode) =>
  String(episode?.entryKind || "")
    .trim()
    .toLowerCase() === "extra"
    ? "extra"
    : "main";

const getLookupVolumeValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const buildEpisodeKey = (number, volume) => {
  const safeNumber = getEpisodeNumberValue(number);
  if (safeNumber === null) {
    return "";
  }
  return `${safeNumber}:${getEpisodeVolumeValue(volume)}`;
};

export const getEpisodeSourceUrls = (episode) =>
  getProjectEpisodeCompleteDownloadSources(episode).map((source) => source.url);

export const hasEpisodeSources = (episode) => getEpisodeSourceUrls(episode).length > 0;

export const getEpisodeContentFormat = (episode) =>
  normalizeProjectEpisodeContentFormat(episode?.contentFormat);

export const hasEpisodePages = (episode) => hasProjectEpisodePages(episode);

export const hasEpisodeContent = (episode) => hasProjectEpisodeReadableContent(episode);

export const getEpisodePublicationStatus = (episode) =>
  String(episode?.publicationStatus || "")
    .trim()
    .toLowerCase() === "draft"
    ? "draft"
    : "published";

export const isPublishedEpisode = (episode) => getEpisodePublicationStatus(episode) === "published";

export const findDuplicateEpisodeKey = (episodes) => {
  const seen = new Map();
  const list = Array.isArray(episodes) ? episodes : [];
  for (let index = 0; index < list.length; index += 1) {
    const key = buildEpisodeKey(list[index]?.number, list[index]?.volume);
    if (!key) {
      continue;
    }
    if (seen.has(key)) {
      return {
        key,
        firstIndex: seen.get(key),
        secondIndex: index,
      };
    }
    seen.set(key, index);
  }
  return null;
};

export const findPublishedImageEpisodeWithoutPages = (episodes) => {
  const list = Array.isArray(episodes) ? episodes : [];
  for (let index = 0; index < list.length; index += 1) {
    const episode = list[index];
    if (getEpisodePublicationStatus(episode) !== "published") {
      continue;
    }
    if (getEpisodeContentFormat(episode) !== "images") {
      continue;
    }
    if (hasEpisodePages(episode)) {
      continue;
    }
    return {
      index,
      key: buildEpisodeKey(episode?.number, episode?.volume),
      episode,
    };
  }
  return null;
};

export const findPublishedEpisodeWithoutPublicAccess = (
  projectType,
  episodes,
  { existingEpisodes = null } = {},
) => {
  const list = Array.isArray(episodes) ? episodes : [];
  const priorList = Array.isArray(existingEpisodes) ? existingEpisodes : null;
  for (let index = 0; index < list.length; index += 1) {
    const episode = list[index];
    const publicationState = resolveProjectEpisodePublicationState(projectType, episode);
    if (!publicationState.errorCode) {
      continue;
    }
    // If we have a prior snapshot, skip episodes that were already broken before this edit.
    // Only block episodes that are newly broken (newly published without sources, or new episodes
    // added already published without sources). This lets users fix one episode at a time
    // without being blocked by pre-existing issues in other episodes.
    if (priorList !== null) {
      const key = buildEpisodeKey(episode?.number, episode?.volume);
      const priorEpisode = priorList.find((ep) => buildEpisodeKey(ep?.number, ep?.volume) === key);
      if (priorEpisode) {
        const priorState = resolveProjectEpisodePublicationState(projectType, priorEpisode);
        if (priorState.errorCode) {
          // Was already broken before this save — skip, don't block.
          continue;
        }
      }
    }
    return {
      index,
      key: buildEpisodeKey(episode?.number, episode?.volume),
      episode,
      errorCode: publicationState.errorCode,
    };
  }
  return null;
};

export const resolveEpisodeLookup = (
  project,
  episodeNumber,
  volume,
  { requirePublished = false, episodeFilter = null } = {},
) => {
  const safeNumber = getEpisodeNumberValue(episodeNumber);
  if (safeNumber === null) {
    return { ok: false, code: "invalid_episode_number" };
  }
  const safeVolume = getLookupVolumeValue(volume);
  const episodes = Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : [];
  const matches = episodes
    .map((episode, index) => ({ episode, index }))
    .filter(({ episode }) => getEpisodeNumberValue(episode?.number) === safeNumber)
    .filter(({ episode }) => {
      if (requirePublished && !isPublishedEpisode(episode)) {
        return false;
      }
      if (typeof episodeFilter === "function" && !episodeFilter(episode)) {
        return false;
      }
      return true;
    });

  if (matches.length === 0) {
    return { ok: false, code: "not_found" };
  }

  if (safeVolume !== null) {
    const exact = matches.find(
      ({ episode }) => getEpisodeVolumeValue(episode?.volume) === getEpisodeVolumeValue(safeVolume),
    );
    if (!exact) {
      return { ok: false, code: "not_found" };
    }
    return {
      ok: true,
      code: "ok",
      ...exact,
      key: buildEpisodeKey(exact.episode?.number, exact.episode?.volume),
    };
  }

  if (matches.length > 1) {
    return { ok: false, code: "volume_required", matches };
  }

  return {
    ok: true,
    code: "ok",
    ...matches[0],
    key: buildEpisodeKey(matches[0].episode?.number, matches[0].episode?.volume),
  };
};

export const resolvePublishedEpisodeLookup = (
  project,
  episodeNumber,
  volume,
  { notFoundError = "not_found", volumeRequiredError = "volume_required" } = {},
) => {
  const lookup = resolveEpisodeLookup(project, episodeNumber, volume, {
    requirePublished: true,
    episodeFilter: (episode) => isProjectEpisodePublic(project?.type || "", episode),
  });

  if (lookup.ok) {
    return {
      ...lookup,
      error: null,
      statusCode: 200,
    };
  }

  if (lookup.code === "volume_required") {
    return {
      ...lookup,
      error: volumeRequiredError,
      statusCode: 400,
    };
  }

  return {
    ...lookup,
    error: notFoundError,
    statusCode: 404,
  };
};
