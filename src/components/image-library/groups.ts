import type {
  LibraryImageItem,
  ProjectImageFolderGroup,
  ProjectImageGroup,
  UploadFolderGroup,
} from "@/components/image-library/types";
import {
  compareProjectFolderGroupsRootFirst,
  compareNaturalTextPtBr,
  isProjectsNamespaceFolder,
  listFolderAncestors,
  resolveClosestFolderGroupKey,
  resolveItemFolder,
  resolveProjectRootFromFolder,
  resolveUploadFolderGroupTitle,
  sanitizeUploadFolderForComparison,
  toRelativeProjectFolderLabel,
} from "@/components/image-library/utils";

export const buildProjectScopeFolders = ({
  normalizedListFolders,
  resolvedUploadFolderForFilter,
}: {
  normalizedListFolders: string[];
  resolvedUploadFolderForFilter: string;
}) => {
  const set = new Set<string>();
  normalizedListFolders
    .map((folder) => sanitizeUploadFolderForComparison(folder))
    .filter(Boolean)
    .forEach((folder) => set.add(folder));
  if (resolvedUploadFolderForFilter) {
    set.add(resolvedUploadFolderForFilter);
  }
  return Array.from(set);
};

export const buildScopedProjectRoots = (projectScopeFolders: string[]) => {
  const set = new Set<string>();
  projectScopeFolders.forEach((folder) => {
    const projectRoot = resolveProjectRootFromFolder(folder);
    if (projectRoot) {
      set.add(projectRoot);
    }
  });
  return Array.from(set);
};

export const buildFolders = ({
  listAll,
  normalizedListFolders,
  resolvedUploadFolderForFilter,
}: {
  listAll: boolean;
  normalizedListFolders: string[];
  resolvedUploadFolderForFilter: string;
}) => {
  const set = new Set<string>();
  normalizedListFolders
    .map((folder) => sanitizeUploadFolderForComparison(folder))
    .filter(Boolean)
    .forEach((folder) => set.add(folder));
  if (resolvedUploadFolderForFilter) {
    set.add(resolvedUploadFolderForFilter);
  }
  if (listAll) {
    set.add("__all__");
  }
  if (set.size === 0) {
    set.add("");
  }
  return Array.from(set);
};

export const buildFoldersToRequest = (folders: string[]) => {
  const unique = Array.from(new Set(folders.map((item) => String(item || "").trim())));
  return unique.filter((folder) => {
    if (!folder || folder === "__all__") {
      return true;
    }
    return !unique.some((candidate) => {
      if (!candidate || candidate === "__all__" || candidate === folder) {
        return false;
      }
      return folder.startsWith(`${candidate}/`);
    });
  });
};

export const buildUploadFolderGroups = ({
  filteredUploads,
  isBroadProjectLibraryContext,
  resolvedUploadFolderForFilter,
  sortItems,
}: {
  filteredUploads: LibraryImageItem[];
  isBroadProjectLibraryContext: boolean;
  resolvedUploadFolderForFilter: string;
  sortItems: (items: LibraryImageItem[]) => LibraryImageItem[];
}) => {
  const groupMap = new Map<string, LibraryImageItem[]>();
  filteredUploads.forEach((item) => {
    const folder = resolveItemFolder(item);
    const key = folder || "__sem-pasta__";
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)?.push(item);
  });

  const scopedProjectRoot = isBroadProjectLibraryContext
    ? ""
    : resolveProjectRootFromFolder(resolvedUploadFolderForFilter);

  return Array.from(groupMap.entries())
    .map(([key, items]) => {
      const folder = key === "__sem-pasta__" ? "" : key;
      return {
        key: `upload-folder:${key}`,
        folder,
        title: resolveUploadFolderGroupTitle({
          folder,
          scopedProjectRoot,
          preferFullProjectPath: isBroadProjectLibraryContext,
        }),
        items: sortItems(items),
      } satisfies UploadFolderGroup;
    })
    .sort(compareProjectFolderGroupsRootFirst);
};

export const resolveUploadFolderForFilterOption = ({
  resolvedUploadFolderForFilter,
  shouldExcludeProjectFoldersFromUploadFilter,
}: {
  resolvedUploadFolderForFilter: string;
  shouldExcludeProjectFoldersFromUploadFilter: boolean;
}) => {
  if (
    shouldExcludeProjectFoldersFromUploadFilter &&
    isProjectsNamespaceFolder(resolvedUploadFolderForFilter)
  ) {
    return "";
  }
  return resolvedUploadFolderForFilter;
};

export const hasHiddenProjectUploadsInTopSection = ({
  renderableUploads,
  shouldExcludeProjectFoldersFromUploadFilter,
}: {
  renderableUploads: LibraryImageItem[];
  shouldExcludeProjectFoldersFromUploadFilter: boolean;
}) =>
  shouldExcludeProjectFoldersFromUploadFilter &&
  renderableUploads.some((item) => isProjectsNamespaceFolder(resolveItemFolder(item)));

export const hasProjectFolderContextExcludedFromUploadFilter = ({
  hasHiddenProjectUploads,
  normalizedListFolders,
  resolvedUploadFolderForFilter,
  shouldExcludeProjectFoldersFromUploadFilter,
}: {
  hasHiddenProjectUploads: boolean;
  normalizedListFolders: string[];
  resolvedUploadFolderForFilter: string;
  shouldExcludeProjectFoldersFromUploadFilter: boolean;
}) =>
  shouldExcludeProjectFoldersFromUploadFilter &&
  (isProjectsNamespaceFolder(resolvedUploadFolderForFilter) ||
    normalizedListFolders.some((folder) => isProjectsNamespaceFolder(folder)) ||
    hasHiddenProjectUploads);

export const buildUploadFolderFilterOptions = ({
  normalizedListFolders,
  renderableUploads,
  resolvedUploadFolderForFilter,
  shouldExcludeProjectFoldersFromUploadFilter,
}: {
  normalizedListFolders: string[];
  renderableUploads: LibraryImageItem[];
  resolvedUploadFolderForFilter: string;
  shouldExcludeProjectFoldersFromUploadFilter: boolean;
}) => {
  const set = new Set<string>();

  const registerFolderCandidates = (folder: string | null | undefined) => {
    listFolderAncestors(folder).forEach((candidate) => {
      if (shouldExcludeProjectFoldersFromUploadFilter && isProjectsNamespaceFolder(candidate)) {
        return;
      }
      set.add(candidate);
    });
  };

  normalizedListFolders.forEach((folder) => {
    registerFolderCandidates(folder);
  });
  registerFolderCandidates(resolvedUploadFolderForFilter);
  renderableUploads.forEach((item) => {
    registerFolderCandidates(resolveItemFolder(item));
  });

  return Array.from(set).sort(compareNaturalTextPtBr);
};

export const buildProjectImageGroups = ({
  filteredProjectImages,
}: {
  filteredProjectImages: LibraryImageItem[];
}) => {
  const groupMap = new Map<
    string,
    ProjectImageGroup & {
      folderMap: Map<string, ProjectImageFolderGroup>;
      rootCandidates: string[];
    }
  >();

  filteredProjectImages.forEach((item) => {
    const projectId = String(item.projectId || "").trim();
    const projectTitle = String(item.projectTitle || "").trim();
    const key = projectId
      ? `project:${projectId}`
      : projectTitle
        ? `title:${projectTitle.toLowerCase()}`
        : "__no-project__";
    const title = projectTitle || (projectId ? `Projeto ${projectId}` : "Sem projeto");

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        projectId,
        title,
        items: [],
        folders: [],
        folderMap: new Map<string, ProjectImageFolderGroup>(),
        rootCandidates: [],
      });
    }

    const group = groupMap.get(key);
    if (!group) {
      return;
    }

    group.items.push(item);
    const resolvedFolder = resolveItemFolder(item);
    const folderKey = resolvedFolder || "__sem-pasta__";
    if (!group.folderMap.has(folderKey)) {
      group.folderMap.set(folderKey, {
        key: `${key}:folder:${folderKey}`,
        folder: resolvedFolder,
        title: resolvedFolder || "Sem pasta",
        items: [],
      });
    }
    group.folderMap.get(folderKey)?.items.push(item);
    const projectRootCandidate = resolveProjectRootFromFolder(resolvedFolder);
    if (projectRootCandidate) {
      group.rootCandidates.push(projectRootCandidate);
    }
  });

  return Array.from(groupMap.values())
    .map((group) => {
      const rootCounts = new Map<string, number>();
      group.rootCandidates
        .map((candidate) => candidate.trim())
        .filter(Boolean)
        .forEach((candidate) => {
          rootCounts.set(candidate, (rootCounts.get(candidate) || 0) + 1);
        });

      let projectRoot = "";
      let projectRootCount = 0;
      rootCounts.forEach((count, candidate) => {
        if (count > projectRootCount) {
          projectRoot = candidate;
          projectRootCount = count;
        }
      });

      const folders = Array.from(group.folderMap.values())
        .map((folderGroup) => {
          const resolvedFolder = folderGroup.items[0]
            ? resolveItemFolder(folderGroup.items[0])
            : "";
          return {
            ...folderGroup,
            title: toRelativeProjectFolderLabel({
              folder: resolvedFolder,
              projectRoot,
            }),
          };
        })
        .sort(compareProjectFolderGroupsRootFirst);

      return {
        key: group.key,
        projectId: group.projectId,
        title: group.title,
        items: group.items,
        folders,
      } satisfies ProjectImageGroup;
    })
    .sort((left, right) => compareNaturalTextPtBr(left.title, right.title));
};

export const buildInitialOpenUploadGroupKeys = ({
  uploadFolderGroups,
  resolvedUploadFolderForFilter,
}: {
  uploadFolderGroups: UploadFolderGroup[];
  resolvedUploadFolderForFilter: string;
}) => {
  const contextGroupKey = resolveClosestFolderGroupKey(
    uploadFolderGroups,
    resolvedUploadFolderForFilter,
  );
  if (contextGroupKey) {
    return [contextGroupKey];
  }
  return uploadFolderGroups[0]?.key ? [uploadFolderGroups[0].key] : [];
};

export const buildInitialProjectAccordionState = ({
  projectImageGroups,
  resolvedContextProjectId,
  resolvedUploadFolderForFilter,
}: {
  projectImageGroups: ProjectImageGroup[];
  resolvedContextProjectId: string;
  resolvedUploadFolderForFilter: string;
}) => {
  const emptyState = {
    groupKeys: [] as string[],
    folderKeysByGroup: {} as Record<string, string[]>,
  };

  if (projectImageGroups.length === 0) {
    return emptyState;
  }

  let contextGroup: ProjectImageGroup | undefined;
  if (resolvedContextProjectId) {
    contextGroup = projectImageGroups.find((group) => group.projectId === resolvedContextProjectId);
  }

  if (!contextGroup) {
    const contextRoot = resolveProjectRootFromFolder(resolvedUploadFolderForFilter);
    if (contextRoot) {
      contextGroup = projectImageGroups.find((group) =>
        group.folders.some((folderGroup) => {
          const normalizedFolder = sanitizeUploadFolderForComparison(folderGroup.folder);
          return normalizedFolder === contextRoot || normalizedFolder.startsWith(`${contextRoot}/`);
        }),
      );
    }
  }

  if (!contextGroup) {
    return emptyState;
  }

  const contextFolderKey = resolveClosestFolderGroupKey(
    contextGroup.folders,
    resolvedUploadFolderForFilter,
  );

  return {
    groupKeys: [contextGroup.key],
    folderKeysByGroup: contextFolderKey
      ? {
          [contextGroup.key]: [contextFolderKey],
        }
      : {},
  };
};
