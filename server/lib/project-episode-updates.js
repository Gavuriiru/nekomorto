import {
  buildEpisodeKey,
  getEpisodeContentFormat,
  getEpisodeEntryKind,
  getEpisodePublicationStatus,
  getEpisodeSourceUrls,
  hasEpisodeContent,
} from "./project-episodes.js";
import { normalizeProjectEpisodePages } from "../../shared/project-reader.js";

const sortStrings = (values) => [...values].sort((a, b) => a.localeCompare(b, "en"));

const normalizeType = (type) =>
  String(type || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const isSpecialProjectType = (type) => {
  const normalized = normalizeType(type);
  return normalized === "especial" || normalized === "special";
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

export const resolveProjectUpdateUnitLabel = (projectType, episode) => {
  if (getEpisodeEntryKind(episode) === "extra") {
    return "Extra";
  }
  if (isSpecialProjectType(projectType)) {
    return "Especial";
  }
  return isChapterBasedType(projectType) ? "Cap\u00edtulo" : "Epis\u00f3dio";
};

const getEpisodeSourceSignature = (episode) => sortStrings(getEpisodeSourceUrls(episode)).join("|");

const getEpisodePageSignature = (episode) =>
  normalizeProjectEpisodePages(episode?.pages)
    .map((page) => {
      const imageUrl = String(page?.imageUrl || "").trim();
      const spreadPairId = String(page?.spreadPairId || "").trim();
      return spreadPairId ? `${imageUrl}@${spreadPairId}` : imageUrl;
    })
    .filter(Boolean)
    .join("|");

const hasEpisodeReadableContent = (episode) =>
  hasEpisodeContent(episode) || getEpisodePageSignature(episode).length > 0;

const getEpisodeReadableSignature = (episode) => {
  const pageSignature = getEpisodePageSignature(episode);
  if (!hasEpisodeContent(episode) && !pageSignature) {
    return "";
  }
  return [
    String(episode?.title || "").trim(),
    String(episode?.releaseDate || "").trim(),
    pageSignature ? "images" : String(getEpisodeContentFormat(episode) || "").trim(),
    String(episode?.content || "").trim(),
    Number.isFinite(Number(episode?.pageCount)) ? String(Number(episode.pageCount)) : "",
    pageSignature,
  ].join("||");
};

export const isEpisodePublic = (projectType, episode) => {
  if (getEpisodePublicationStatus(episode) !== "published") {
    return false;
  }
  if (!isChapterBasedType(projectType || "")) {
    return getEpisodeSourceSignature(episode).length > 0;
  }
  return hasEpisodeReadableContent(episode) || getEpisodeSourceSignature(episode).length > 0;
};

export const getEpisodePublicSignature = (projectType, episode) =>
  [
    getEpisodePublicationStatus(episode),
    isChapterBasedType(projectType || "") ? getEpisodeReadableSignature(episode) : "",
    getEpisodeSourceSignature(episode),
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
  return getEpisodePublicSignature(projectType, prevEpisode) !==
    getEpisodePublicSignature(projectType, nextEpisode)
    ? now
    : prevStamp || String(nextEpisode?.chapterUpdatedAt || "").trim();
};

export const applyEpisodePublicationMetadata = (prevProject, nextProject, now) => {
  const prevEpisodes = Array.isArray(prevProject?.episodeDownloads)
    ? prevProject.episodeDownloads
    : [];
  const prevMap = new Map(
    prevEpisodes.map((episode) => [buildEpisodeKey(episode?.number, episode?.volume), episode]),
  );
  const nextEpisodes = Array.isArray(nextProject?.episodeDownloads)
    ? nextProject.episodeDownloads
    : [];

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
  const nextEpisodes = Array.isArray(nextProject?.episodeDownloads)
    ? nextProject.episodeDownloads
    : [];
  const prevEpisodes = Array.isArray(prevProject?.episodeDownloads)
    ? prevProject.episodeDownloads
    : [];
  const prevMap = new Map(
    prevEpisodes.map((episode) => [buildEpisodeKey(episode?.number, episode?.volume), episode]),
  );
  nextEpisodes.forEach((episode) => {
    const key = buildEpisodeKey(episode?.number, episode?.volume);
    const prevEpisode = prevMap.get(key) || null;
    const projectType = nextProject?.type || prevProject?.type || "";
    const wasPublic = isEpisodePublic(prevProject?.type || projectType, prevEpisode);
    const isPublic = isEpisodePublic(projectType, episode);
    if (!isPublic) {
      return;
    }

    const isExtra = getEpisodeEntryKind(episode) === "extra";
    const safeTitle = String(episode?.title || "").trim() || "Extra";
    const unitLabel = resolveProjectUpdateUnitLabel(projectType, episode);
    const updatedAt = String(episode?.chapterUpdatedAt || now).trim() || now;

    if (!wasPublic) {
      updates.push({
        kind: "Lan\u00e7amento",
        reason: isExtra ? `${safeTitle} dispon\u00edvel` : `${unitLabel} ${episode.number} dispon\u00edvel`,
        episodeNumber: Number(episode.number),
        volume: Number.isFinite(Number(episode?.volume)) ? Number(episode.volume) : undefined,
        unit: unitLabel,
        updatedAt,
      });
      return;
    }

    const previousPublicSignature = getEpisodePublicSignature(projectType, prevEpisode);
    const nextPublicSignature = getEpisodePublicSignature(projectType, episode);
    if (previousPublicSignature !== nextPublicSignature) {
      const previousReadableSignature = getEpisodeReadableSignature(prevEpisode);
      const nextReadableSignature = getEpisodeReadableSignature(episode);
      const readableChanged =
        previousReadableSignature !== nextReadableSignature &&
        Boolean(previousReadableSignature || nextReadableSignature);
      const sourceChanged =
        getEpisodeSourceSignature(prevEpisode) !== getEpisodeSourceSignature(episode);
      const adjustmentReason = isExtra
        ? `Conte\u00fado ajustado no extra "${safeTitle}"`
        : readableChanged
          ? `Conte\u00fado ajustado no ${unitLabel.toLowerCase()} ${episode.number}`
          : sourceChanged
            ? `Links ajustados no ${unitLabel.toLowerCase()} ${episode.number}`
            : `Conte\u00fado ajustado no ${unitLabel.toLowerCase()} ${episode.number}`;
      updates.push({
        kind: "Ajuste",
        reason: adjustmentReason,
        episodeNumber: Number(episode.number),
        volume: Number.isFinite(Number(episode?.volume)) ? Number(episode.volume) : undefined,
        unit: unitLabel,
        updatedAt,
      });
    }
  });

  return updates;
};
