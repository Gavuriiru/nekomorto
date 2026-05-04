import type { ImageLibraryOptions } from "@/components/ImageLibraryDialog";
import type { ProjectEpisode } from "@/data/projects";
import {
  DEFAULT_PROJECT_BANNER_ALT,
  DEFAULT_PROJECT_COVER_ALT,
  DEFAULT_PROJECT_HERO_ALT,
  DEFAULT_PROJECT_HERO_LOGO_ALT,
  getEpisodeCoverAltFallback,
  resolveAssetAltText,
} from "@/lib/image-alt";
import { filterImageLibraryFoldersByAccess } from "@/lib/image-library-scope";
import { buildChapterFolder, resolveProjectImageFolders } from "@/lib/project-image-folders";

type ProjectImageFolders = ReturnType<typeof resolveProjectImageFolders>;

type EpisodeLike = Pick<ProjectEpisode, "number" | "volume"> & Partial<ProjectEpisode>;

type BaseProjectLibraryOptionsArgs = {
  uploadFolder: string;
  listFolders: string[];
  projectId?: string | null;
  canManageProjects?: boolean;
  onRequestNavigateToUploads?: () => boolean | Promise<boolean>;
  currentSelectionUrls?: string[];
};

export const buildScopedProjectImageIds = (projectId?: string | null) => {
  const normalizedProjectId = String(projectId || "").trim();
  return normalizedProjectId ? [normalizedProjectId] : [];
};

export const filterProjectLibraryFolders = (folders: string[], canManageProjects = true) =>
  filterImageLibraryFoldersByAccess(folders, {
    grants: { projetos: canManageProjects },
  });

export const buildProjectScopedLibraryOptions = ({
  uploadFolder,
  listFolders,
  projectId,
  canManageProjects = true,
  onRequestNavigateToUploads,
  currentSelectionUrls,
}: BaseProjectLibraryOptionsArgs): ImageLibraryOptions => ({
  uploadFolder,
  listFolders: filterProjectLibraryFolders(listFolders, canManageProjects),
  listAll: false,
  includeProjectImages: true,
  projectImageProjectIds: buildScopedProjectImageIds(projectId),
  projectImagesView: "by-project",
  ...(onRequestNavigateToUploads ? { onRequestNavigateToUploads } : {}),
  ...(currentSelectionUrls ? { currentSelectionUrls } : {}),
});

export const resolveProjectAssetAltText = (
  target: "cover" | "banner" | "hero" | "heroLogo",
  altText?: string | null,
) => {
  if (target === "banner") {
    return resolveAssetAltText(altText, DEFAULT_PROJECT_BANNER_ALT);
  }
  if (target === "hero") {
    return resolveAssetAltText(altText, DEFAULT_PROJECT_HERO_ALT);
  }
  if (target === "heroLogo") {
    return resolveAssetAltText(altText, DEFAULT_PROJECT_HERO_LOGO_ALT);
  }
  return resolveAssetAltText(altText, DEFAULT_PROJECT_COVER_ALT);
};

export const resolveProjectEpisodeAssetAltText = ({
  altText,
  isChapterBased = false,
}: {
  altText?: string | null;
  isChapterBased?: boolean;
}) => resolveAssetAltText(altText, getEpisodeCoverAltFallback(isChapterBased));

export const resolveProjectVolumeAssetAltText = (volume: number, altText?: string | null) =>
  resolveAssetAltText(altText, `Capa do volume ${volume}`);

export const buildProjectVolumeCoversFromEntries = (
  entries: Array<{ volume: number; coverImageUrl?: string | null; coverImageAlt?: string | null }>,
) =>
  entries
    .filter((entry) => String(entry.coverImageUrl || "").trim())
    .map((entry) => ({
      volume: entry.volume,
      coverImageUrl: String(entry.coverImageUrl || "").trim(),
      coverImageAlt: resolveProjectVolumeAssetAltText(entry.volume, entry.coverImageAlt),
    }));

export const buildProjectAssetLibraryOptions = ({
  projectFolders,
  projectId,
  canManageProjects = true,
}: {
  projectFolders: ProjectImageFolders;
  projectId?: string | null;
  canManageProjects?: boolean;
}) =>
  buildProjectScopedLibraryOptions({
    uploadFolder: projectFolders.projectRootFolder,
    listFolders: [projectFolders.projectRootFolder, projectFolders.projectEpisodesFolder],
    projectId,
    canManageProjects,
  });

export const buildProjectEpisodeAssetLibraryOptions = ({
  projectFolders,
  projectId,
  canManageProjects = true,
  isChapterBased = false,
  episode,
  index = 0,
  currentSelectionUrls,
}: {
  projectFolders: ProjectImageFolders;
  projectId?: string | null;
  canManageProjects?: boolean;
  isChapterBased?: boolean;
  episode?: EpisodeLike | null;
  index?: number;
  currentSelectionUrls?: string[];
}) => {
  if (isChapterBased && episode) {
    const chapterFolder = buildChapterFolder({
      projectChaptersFolder: projectFolders.projectChaptersFolder,
      episode,
      index,
    });
    return buildProjectScopedLibraryOptions({
      uploadFolder: chapterFolder,
      listFolders: [
        chapterFolder,
        projectFolders.projectChaptersFolder,
        projectFolders.projectEpisodesFolder,
        projectFolders.projectRootFolder,
      ],
      projectId,
      canManageProjects,
      currentSelectionUrls,
    });
  }

  return buildProjectScopedLibraryOptions({
    uploadFolder: projectFolders.projectEpisodesFolder,
    listFolders: [projectFolders.projectEpisodesFolder, projectFolders.projectRootFolder],
    projectId,
    canManageProjects,
    currentSelectionUrls,
  });
};

export const buildProjectVolumeAssetLibraryOptions = ({
  projectFolders,
  projectId,
  canManageProjects = true,
}: {
  projectFolders: ProjectImageFolders;
  projectId?: string | null;
  canManageProjects?: boolean;
}) =>
  buildProjectScopedLibraryOptions({
    uploadFolder: projectFolders.projectVolumeCoversFolder,
    listFolders: [
      projectFolders.projectVolumeCoversFolder,
      projectFolders.projectRootFolder,
      projectFolders.projectEpisodesFolder,
    ],
    projectId,
    canManageProjects,
  });

export const buildProjectChapterAssetLibraryOptions = ({
  projectFolders,
  projectId,
  episode,
  index,
  canManageProjects = true,
  onRequestNavigateToUploads,
}: {
  projectFolders: ProjectImageFolders;
  projectId?: string | null;
  episode: EpisodeLike;
  index: number;
  canManageProjects?: boolean;
  onRequestNavigateToUploads?: () => boolean | Promise<boolean>;
}) => {
  const chapterFolder = buildChapterFolder({
    projectChaptersFolder: projectFolders.projectChaptersFolder,
    episode,
    index,
  });
  return buildProjectScopedLibraryOptions({
    uploadFolder: chapterFolder,
    listFolders: [
      chapterFolder,
      projectFolders.projectChaptersFolder,
      projectFolders.projectEpisodesFolder,
      projectFolders.projectRootFolder,
    ],
    projectId,
    canManageProjects,
    onRequestNavigateToUploads,
  });
};
