import {
  buildEpisodeKey,
  getEpisodeEntryKind,
  getEpisodePublicationStatus,
  getEpisodeSourceUrls,
  hasEpisodeContent,
} from "./project-episodes.js";

const sortStrings = (values) => [...values].sort((a, b) => a.localeCompare(b, "en"));

const normalizeType = (type) => String(type || "").toLowerCase();

const isLightNovelType = (type) => {
  const normalized = normalizeType(type);
  return normalized.includes("light") || normalized.includes("novel");
};

const isChapterBasedType = (type) => {
  const normalized = normalizeType(type);
  return (
    normalized.includes("mang") ||
    normalized.includes("webtoon") ||
    normalized.includes("light") ||
    normalized.includes("novel")
  );
};

export const isEpisodePublic = (projectType, episode) => {
  if (getEpisodePublicationStatus(episode) !== "published") {
    return false;
  }
  if (!isLightNovelType(projectType || "")) {
    return getEpisodeSourceUrls(episode).length > 0;
  }
  return hasEpisodeContent(episode) || getEpisodeSourceUrls(episode).length > 0;
};

export const getEpisodePublicSignature = (episode) =>
  [
    getEpisodePublicationStatus(episode),
    String(episode?.title || ""),
    String(episode?.releaseDate || ""),
    String(episode?.content || "").trim(),
    sortStrings(getEpisodeSourceUrls(episode)).join("|"),
  ].join("||");

export const stampEpisodePublicUpdatedAt = (prevEpisode, nextEpisode, now, projectType) => {
  const wasPublic = isEpisodePublic(projectType, prevEpisode);
  const isPublic = isEpisodePublic(projectType, nextEpisode);
  const prevStamp = String(prevEpisode?.chapterUpdatedAt || "").trim();
  if (!isPublic) {
    return prevStamp || String(nextEpisode?.chapterUpdatedAt || "").trim();
  }
  if (!wasPublic) {
    return now;
  }
  return getEpisodePublicSignature(prevEpisode) !== getEpisodePublicSignature(nextEpisode)
    ? now
    : prevStamp || String(nextEpisode?.chapterUpdatedAt || "").trim();
};

export const applyEpisodePublicationMetadata = (prevProject, nextProject, now) => {
  const prevEpisodes = Array.isArray(prevProject?.episodeDownloads) ? prevProject.episodeDownloads : [];
  const prevMap = new Map(
    prevEpisodes.map((episode) => [buildEpisodeKey(episode?.number, episode?.volume), episode]),
  );
  const nextEpisodes = Array.isArray(nextProject?.episodeDownloads) ? nextProject.episodeDownloads : [];

  return {
    ...nextProject,
    episodeDownloads: nextEpisodes.map((episode) => {
      const key = buildEpisodeKey(episode?.number, episode?.volume);
      const prevEpisode = prevMap.get(key) || null;
      return {
        ...episode,
        chapterUpdatedAt: stampEpisodePublicUpdatedAt(
          prevEpisode,
          episode,
          now,
          nextProject?.type || prevProject?.type || "",
        ),
      };
    }),
  };
};

export const collectEpisodeUpdates = (prevProject, nextProject, now) => {
  const updates = [];
  const nextEpisodes = Array.isArray(nextProject?.episodeDownloads) ? nextProject.episodeDownloads : [];
  const prevEpisodes = Array.isArray(prevProject?.episodeDownloads) ? prevProject.episodeDownloads : [];
  const prevMap = new Map(
    prevEpisodes.map((episode) => [buildEpisodeKey(episode?.number, episode?.volume), episode]),
  );
  const isChapterBased = isChapterBasedType(nextProject?.type || "");

  nextEpisodes.forEach((episode) => {
    const key = buildEpisodeKey(episode?.number, episode?.volume);
    const prevEpisode = prevMap.get(key) || null;
    const wasPublic = isEpisodePublic(prevProject?.type || nextProject?.type || "", prevEpisode);
    const isPublic = isEpisodePublic(nextProject?.type || "", episode);
    if (!isPublic) {
      return;
    }

    const isExtra = getEpisodeEntryKind(episode) === "extra";
    const safeTitle = String(episode?.title || "").trim() || "Extra";
    const unitLabel = isExtra ? "Extra" : isChapterBased ? "Capitulo" : "Episodio";
    const updatedAt = String(episode?.chapterUpdatedAt || now).trim() || now;

    if (!wasPublic) {
      updates.push({
        kind: "Lancamento",
        reason: isExtra ? `${safeTitle} disponivel` : `${unitLabel} ${episode.number} disponivel`,
        episodeNumber: Number(episode.number),
        volume: Number.isFinite(Number(episode?.volume)) ? Number(episode.volume) : undefined,
        unit: unitLabel,
        updatedAt,
      });
      return;
    }

    if (getEpisodePublicSignature(prevEpisode) !== getEpisodePublicSignature(episode)) {
      updates.push({
        kind: "Ajuste",
        reason: isExtra
          ? `Conteudo ajustado no extra "${safeTitle}"`
          : isLightNovelType(nextProject?.type || "")
            ? `Conteudo ajustado no ${unitLabel.toLowerCase()} ${episode.number}`
            : `Links ajustados no ${unitLabel.toLowerCase()} ${episode.number}`,
        episodeNumber: Number(episode.number),
        volume: Number.isFinite(Number(episode?.volume)) ? Number(episode.volume) : undefined,
        unit: unitLabel,
        updatedAt,
      });
    }
  });

  return updates;
};
