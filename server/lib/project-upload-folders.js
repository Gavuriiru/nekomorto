import {
  buildProjectFolderSet,
  resolveEpisodeCoverFolder as resolveEpisodeCoverFolderShared,
  resolveProjectRootFolder,
  resolveVolumeFolderSegment,
  sanitizeProjectFolderSegment,
} from "../../shared/project-upload-folders.js";

export { resolveProjectRootFolder, resolveVolumeFolderSegment, sanitizeProjectFolderSegment };

export const resolveProjectLibraryFolders = ({ createSlug, project }) =>
  buildProjectFolderSet({
    createSlug,
    includeRelations: true,
    projectId: project?.id,
    projectTitle: project?.title,
  });

export const resolveEpisodeCoverFolder = (options) => resolveEpisodeCoverFolderShared(options);
