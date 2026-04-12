const normalizeText = (value) => String(value || "").trim();

export const DEFAULT_PROJECT_FOLDER_FALLBACK_KEY = "draft";

export const sanitizeProjectFolderSegment = (createSlug, value) =>
  String(typeof createSlug === "function" ? createSlug(normalizeText(value)) : normalizeText(value))
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const buildProjectFolderKey = ({
  createSlug,
  projectId,
  projectTitle,
  fallbackKey = DEFAULT_PROJECT_FOLDER_FALLBACK_KEY,
} = {}) => {
  const normalizedId = normalizeText(projectId);
  const normalizedSlug = sanitizeProjectFolderSegment(createSlug, projectTitle);
  return normalizedId || normalizedSlug || fallbackKey;
};

export const buildProjectFolderSet = ({
  createSlug,
  includeRelations = false,
  projectId,
  projectTitle,
} = {}) => {
  const projectKey = buildProjectFolderKey({
    createSlug,
    projectId,
    projectTitle,
  });
  const projectRootFolder = `projects/${projectKey}`;
  const folderSet = {
    projectKey,
    projectRootFolder,
    projectEpisodesFolder: `${projectRootFolder}/episodes`,
    projectVolumeCoversFolder: `${projectRootFolder}/volumes`,
    projectChaptersFolder: `${projectRootFolder}/capitulos`,
  };
  if (includeRelations) {
    folderSet.projectRelationsFolder = `${projectRootFolder}/relations`;
  }
  return folderSet;
};

export const resolveProjectRootFolder = (folder) => {
  const normalized = normalizeText(folder)
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

export const buildProjectChapterFolder = ({ episode, index = 0, projectChaptersFolder } = {}) => {
  const parsedNumber = Number(episode?.number);
  const chapterNumber =
    Number.isFinite(parsedNumber) && parsedNumber > 0 ? Math.floor(parsedNumber) : index + 1;
  const volumeSegment = resolveVolumeFolderSegment(episode?.volume);
  return `${normalizeText(projectChaptersFolder)}/${volumeSegment}/capitulo-${chapterNumber}`;
};

export const buildProjectChapterPagesFolder = (options = {}) =>
  `${buildProjectChapterFolder(options)}/paginas`;

export const resolveEpisodeCoverFolder = ({
  episode,
  folders,
  index = 0,
  isChapterBasedType,
  project,
} = {}) => {
  if (!isChapterBasedType(project?.type || "")) {
    return folders.projectEpisodesFolder;
  }
  return buildProjectChapterFolder({
    episode,
    index,
    projectChaptersFolder: folders.projectChaptersFolder,
  });
};
