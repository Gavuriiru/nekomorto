export const sanitizeProjectFolderSegment = (createSlug, value) =>
  String(createSlug(String(value || "").trim()) || "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const resolveProjectLibraryFolders = ({ createSlug, project }) => {
  const normalizedId = String(project?.id || "").trim();
  const normalizedSlug = sanitizeProjectFolderSegment(createSlug, project?.title || "");
  const projectKey = normalizedId || normalizedSlug || "draft";
  const projectRootFolder = `projects/${projectKey}`;
  return {
    projectRootFolder,
    projectEpisodesFolder: `${projectRootFolder}/episodes`,
    projectRelationsFolder: `${projectRootFolder}/relations`,
    projectVolumeCoversFolder: `${projectRootFolder}/volumes`,
    projectChaptersFolder: `${projectRootFolder}/capitulos`,
  };
};

export const resolveProjectRootFolder = (folder) => {
  const normalized = String(folder || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!normalized.startsWith("projects/")) {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 2) {
    return "";
  }
  return `${segments[0]}/${segments[1]}`;
};

export const resolveVolumeFolderSegment = (volume) => {
  const normalizedVolume = Number.isFinite(Number(volume)) ? Number(volume) : null;
  return normalizedVolume === null ? "volume-sem-volume" : `volume-${normalizedVolume}`;
};

export const resolveEpisodeCoverFolder = ({
  isChapterBasedType,
  project,
  episode,
  index,
  folders,
}) => {
  if (!isChapterBasedType(project?.type || "")) {
    return folders.projectEpisodesFolder;
  }
  const chapterNumber = Number.isFinite(Number(episode?.number)) ? Number(episode.number) : index + 1;
  const safeChapterNumber =
    Number.isFinite(chapterNumber) && chapterNumber > 0 ? Math.floor(chapterNumber) : index + 1;
  const volumeSegment = resolveVolumeFolderSegment(episode?.volume);
  return `${folders.projectChaptersFolder}/${volumeSegment}/capitulo-${safeChapterNumber}`;
};
