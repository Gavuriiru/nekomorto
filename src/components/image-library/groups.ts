import type {
  LibraryImageItem,
  ProjectImageFolderGroup,
  ProjectImageGroup,
  UploadFolderGroup,
} from "@/components/image-library/types";
import { toComparableSelectionKey } from "@/components/image-library/selection";
import {
  compareProjectFolderGroupsRootFirst,
  compareNaturalTextPtBr,
  isFolderWithinSelection,
  isProjectsNamespaceFolder,
  listFolderAncestors,
  resolveClosestFolderGroupKey,
  resolveItemFolder,
  resolveProjectRootFromFolder,
  resolveUploadFolderGroupTitle,
  sanitizeUploadFolderForComparison,
  toRelativeProjectFolderLabel,
} from "@/components/image-library/utils";

export const shouldCollapseProjectFoldersInUploadFilter = ({
  normalizedListFolders,
  resolvedUploadFolderForFilter,
  shouldExcludeProjectFoldersFromUploadFilter,
}: {
  normalizedListFolders: string[];
  resolvedUploadFolderForFilter: string;
  shouldExcludeProjectFoldersFromUploadFilter: boolean;
}) => {
  if (shouldExcludeProjectFoldersFromUploadFilter) {
    return false;
  }
  if (resolveProjectRootFromFolder(resolvedUploadFolderForFilter)) {
    return false;
  }
  return !normalizedListFolders.some((folder) => Boolean(resolveProjectRootFromFolder(folder)));
};

export const resolveUploadFolderFilterValue = ({
  collapseProjectFoldersToRoots,
  folder,
}: {
  collapseProjectFoldersToRoots: boolean;
  folder: string | null | undefined;
}) => {
  const normalizedFolder = sanitizeUploadFolderForComparison(folder);
  if (!normalizedFolder) {
    return "";
  }
  if (!collapseProjectFoldersToRoots) {
    return normalizedFolder;
  }
  return resolveProjectRootFromFolder(normalizedFolder) || normalizedFolder;
};

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
  collapseProjectFoldersToRoots,
  filteredUploads,
  preferFullProjectPath,
  resolvedUploadFolderForFilter,
  sortItems,
}: {
  collapseProjectFoldersToRoots: boolean;
  filteredUploads: LibraryImageItem[];
  preferFullProjectPath: boolean;
  resolvedUploadFolderForFilter: string;
  sortItems: (items: LibraryImageItem[]) => LibraryImageItem[];
}) => {
  const projectTitleByRoot = new Map<string, string>();
  filteredUploads.forEach((item) => {
    const projectRoot = resolveProjectRootFromFolder(resolveItemFolder(item));
    const projectTitle = String(item.projectTitle || "").trim();
    if (projectRoot && projectTitle && !projectTitleByRoot.has(projectRoot)) {
      projectTitleByRoot.set(projectRoot, projectTitle);
    }
  });

  const groupMap = new Map<string, LibraryImageItem[]>();
  filteredUploads.forEach((item) => {
    const resolvedFolder = resolveItemFolder(item);
    const folder = collapseProjectFoldersToRoots
      ? resolveProjectRootFromFolder(resolvedFolder) || resolvedFolder
      : resolvedFolder;
    const key = folder || "__sem-pasta__";
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)?.push(item);
  });

  const scopedProjectRoot = collapseProjectFoldersToRoots
    ? ""
    : resolveProjectRootFromFolder(resolvedUploadFolderForFilter);

  return Array.from(groupMap.entries())
    .map(([key, items]) => {
      const folder = key === "__sem-pasta__" ? "" : key;
      const projectRoot = resolveProjectRootFromFolder(folder);
      const projectTitle =
        collapseProjectFoldersToRoots && projectRoot && projectRoot === folder
          ? projectTitleByRoot.get(projectRoot) || ""
          : "";
      const folders =
        collapseProjectFoldersToRoots && projectRoot && projectRoot === folder
          ? Array.from(
              items.reduce<Map<string, ProjectImageFolderGroup>>((folderMap, item) => {
                const itemFolder = resolveItemFolder(item);
                const folderKey = itemFolder || "__sem-pasta__";
                if (!folderMap.has(folderKey)) {
                  folderMap.set(folderKey, {
                    key: `upload-folder:${key}:folder:${folderKey}`,
                    folder: itemFolder,
                    title: toRelativeProjectFolderLabel({
                      folder: itemFolder,
                      projectRoot,
                    }),
                    items: [],
                  });
                }
                folderMap.get(folderKey)?.items.push(item);
                return folderMap;
              }, new Map()).values(),
            ).sort(compareProjectFolderGroupsRootFirst)
          : [];
      return {
        key: `upload-folder:${key}`,
        folder,
        title:
          projectTitle ||
          resolveUploadFolderGroupTitle({
            folder,
            scopedProjectRoot,
            preferFullProjectPath: !collapseProjectFoldersToRoots && preferFullProjectPath,
          }),
        items: sortItems(items),
        folders: folders.map((childGroup) => ({
          ...childGroup,
          items: sortItems(childGroup.items),
        })),
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

export const shouldFallbackUploadFolderFilterToAll = ({
  hasInitializedUploadAccordionStateForOpen,
  hasUploadsInResolvedFolderContext,
  resolvedUploadFolderForFilterOption,
  shouldShowAllFoldersFilterOption,
  uploadsCount,
  uploadsFolderFilter,
}: {
  hasInitializedUploadAccordionStateForOpen: boolean;
  hasUploadsInResolvedFolderContext: boolean;
  resolvedUploadFolderForFilterOption: string;
  shouldShowAllFoldersFilterOption: boolean;
  uploadsCount: number;
  uploadsFolderFilter: string;
}) =>
  !hasInitializedUploadAccordionStateForOpen &&
  Boolean(resolvedUploadFolderForFilterOption) &&
  uploadsCount > 0 &&
  shouldShowAllFoldersFilterOption &&
  !hasUploadsInResolvedFolderContext &&
  uploadsFolderFilter === resolvedUploadFolderForFilterOption;

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
  collapseProjectFoldersToRoots,
  normalizedListFolders,
  renderableUploads,
  resolvedUploadFolderForFilter,
  shouldExcludeProjectFoldersFromUploadFilter,
}: {
  collapseProjectFoldersToRoots: boolean;
  normalizedListFolders: string[];
  renderableUploads: LibraryImageItem[];
  resolvedUploadFolderForFilter: string;
  shouldExcludeProjectFoldersFromUploadFilter: boolean;
}) => {
  const set = new Set<string>();
  let hasProjectsNamespaceCandidate = false;
  let hasConcreteProjectRoot = false;

  const registerFolderCandidates = (folder: string | null | undefined) => {
    listFolderAncestors(folder).forEach((candidate) => {
      const normalizedCandidate = sanitizeUploadFolderForComparison(candidate);
      if (!normalizedCandidate) {
        return;
      }
      if (
        shouldExcludeProjectFoldersFromUploadFilter &&
        isProjectsNamespaceFolder(normalizedCandidate)
      ) {
        return;
      }
      if (collapseProjectFoldersToRoots && isProjectsNamespaceFolder(normalizedCandidate)) {
        const projectRoot = resolveProjectRootFromFolder(normalizedCandidate);
        if (projectRoot) {
          hasConcreteProjectRoot = true;
          set.add(projectRoot);
          return;
        }
        if (normalizedCandidate === "projects") {
          hasProjectsNamespaceCandidate = true;
        }
        return;
      }
      set.add(normalizedCandidate);
    });
  };

  normalizedListFolders.forEach((folder) => {
    registerFolderCandidates(folder);
  });
  registerFolderCandidates(resolvedUploadFolderForFilter);
  renderableUploads.forEach((item) => {
    registerFolderCandidates(resolveItemFolder(item));
  });

  if (collapseProjectFoldersToRoots && hasProjectsNamespaceCandidate && !hasConcreteProjectRoot) {
    set.add("projects");
  }

  return Array.from(set).sort(compareNaturalTextPtBr);
};

export const buildUploadFolderFilterOptionLabels = ({
  preferProjectTitles,
  renderableUploads,
  uploadFolderFilterOptions,
}: {
  preferProjectTitles: boolean;
  renderableUploads: LibraryImageItem[];
  uploadFolderFilterOptions: string[];
}) => {
  const projectTitleByRoot = new Map<string, string>();

  renderableUploads.forEach((item) => {
    const projectRoot = resolveProjectRootFromFolder(resolveItemFolder(item));
    const projectTitle = String(item.projectTitle || "").trim();
    if (projectRoot && projectTitle && !projectTitleByRoot.has(projectRoot)) {
      projectTitleByRoot.set(projectRoot, projectTitle);
    }
  });

  return uploadFolderFilterOptions.reduce<Record<string, string>>((labels, folder) => {
    const normalizedFolder = sanitizeUploadFolderForComparison(folder);
    const projectRoot = resolveProjectRootFromFolder(normalizedFolder);
    if (preferProjectTitles && projectRoot && projectRoot === normalizedFolder) {
      labels[folder] = projectTitleByRoot.get(projectRoot) || folder;
      return labels;
    }
    labels[folder] = folder;
    return labels;
  }, {});
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

export const buildInitialUploadAccordionState = ({
  resolvedUploadFolderForFilter,
  uploadFolderGroups,
}: {
  resolvedUploadFolderForFilter: string;
  uploadFolderGroups: UploadFolderGroup[];
}) => {
  const groupKey = resolveClosestFolderGroupKey(uploadFolderGroups, resolvedUploadFolderForFilter);
  if (!groupKey) {
    return {
      groupKeys: uploadFolderGroups[0]?.key ? [uploadFolderGroups[0].key] : [],
      folderKeysByGroup: {} as Record<string, string[]>,
    };
  }

  const targetGroup = uploadFolderGroups.find((group) => group.key === groupKey);
  const targetFolderKey =
    targetGroup && targetGroup.folders.length > 0
      ? resolveClosestFolderGroupKey(targetGroup.folders, resolvedUploadFolderForFilter)
      : "";

  return {
    groupKeys: [groupKey],
    folderKeysByGroup: targetFolderKey
      ? {
          [groupKey]: [targetFolderKey],
        }
      : ({} as Record<string, string[]>),
  };
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

const hasComparableItemKey = (items: LibraryImageItem[], targetKey: string) =>
  items.some((item) => toComparableSelectionKey(item.url) === targetKey);

const findUploadGroupByComparableKey = (
  uploadFolderGroups: UploadFolderGroup[],
  targetKey: string,
) => uploadFolderGroups.find((group) => hasComparableItemKey(group.items, targetKey));

const findProjectGroupByComparableKey = (
  projectImageGroups: ProjectImageGroup[],
  targetKey: string,
) => projectImageGroups.find((group) => hasComparableItemKey(group.items, targetKey));

const findFolderGroupByComparableKey = (
  folders: ProjectImageFolderGroup[],
  targetKey: string,
) => folders.find((folderGroup) => hasComparableItemKey(folderGroup.items, targetKey));

export type PendingUploadRevealStep =
  | { type: "wait" }
  | { type: "set_filter"; value: string }
  | { type: "open_group"; groupKey: string }
  | { type: "open_folder"; groupKey: string; folderKey: string }
  | { type: "scroll" };

export const resolvePendingUploadRevealStep = ({
  filteredUploads,
  matchedUpload,
  openUploadFolderKeysByGroup,
  openUploadGroupKeys,
  resolveUploadsFolderFilterValue,
  uploadFolderGroups,
  uploadsFolderFilter,
}: {
  filteredUploads: LibraryImageItem[];
  matchedUpload: LibraryImageItem;
  openUploadFolderKeysByGroup: Record<string, string[]>;
  openUploadGroupKeys: string[];
  resolveUploadsFolderFilterValue: (folder: string | null | undefined) => string;
  uploadFolderGroups: UploadFolderGroup[];
  uploadsFolderFilter: string;
}): PendingUploadRevealStep => {
  const targetKey = toComparableSelectionKey(matchedUpload.url);
  const targetFolder = resolveItemFolder(matchedUpload);
  const targetFilterFolder = resolveUploadsFolderFilterValue(targetFolder);
  const shouldFocusExactFolder =
    Boolean(targetFilterFolder) &&
    (uploadsFolderFilter === "__all__" ||
      !isFolderWithinSelection({
        itemFolder: targetFolder,
        selectedFolder: uploadsFolderFilter,
      }) ||
      uploadsFolderFilter !== targetFilterFolder);
  if (shouldFocusExactFolder) {
    return { type: "set_filter", value: targetFilterFolder || "__all__" };
  }

  if (!hasComparableItemKey(filteredUploads, targetKey)) {
    return { type: "wait" };
  }

  const targetUploadGroup = findUploadGroupByComparableKey(uploadFolderGroups, targetKey);
  if (targetUploadGroup && !openUploadGroupKeys.includes(targetUploadGroup.key)) {
    return { type: "open_group", groupKey: targetUploadGroup.key };
  }

  if (targetUploadGroup?.folders.length) {
    const targetUploadFolder = findFolderGroupByComparableKey(targetUploadGroup.folders, targetKey);
    if (targetUploadFolder) {
      const openUploadFolderKeys = openUploadFolderKeysByGroup[targetUploadGroup.key] || [];
      if (!openUploadFolderKeys.includes(targetUploadFolder.key)) {
        return {
          type: "open_folder",
          groupKey: targetUploadGroup.key,
          folderKey: targetUploadFolder.key,
        };
      }
    }
  }

  return { type: "scroll" };
};

export type PendingProjectRevealStep =
  | { type: "wait" }
  | { type: "open_group"; groupKey: string }
  | { type: "open_folder"; groupKey: string; folderKey: string }
  | { type: "scroll" };

export const resolvePendingProjectRevealStep = ({
  filteredProjectImages,
  matchedProjectItem,
  openProjectFolderKeysByGroup,
  openProjectGroupKeys,
  projectImageGroups,
  projectImagesView,
}: {
  filteredProjectImages: LibraryImageItem[];
  matchedProjectItem: LibraryImageItem;
  openProjectFolderKeysByGroup: Record<string, string[]>;
  openProjectGroupKeys: string[];
  projectImageGroups: ProjectImageGroup[];
  projectImagesView: "flat" | "by-project";
}): PendingProjectRevealStep => {
  const targetKey = toComparableSelectionKey(matchedProjectItem.url);
  if (!hasComparableItemKey(filteredProjectImages, targetKey)) {
    return { type: "wait" };
  }

  if (projectImagesView === "by-project") {
    const targetProjectGroup = findProjectGroupByComparableKey(projectImageGroups, targetKey);
    if (!targetProjectGroup) {
      return { type: "wait" };
    }
    if (!openProjectGroupKeys.includes(targetProjectGroup.key)) {
      return { type: "open_group", groupKey: targetProjectGroup.key };
    }

    const targetProjectFolder = findFolderGroupByComparableKey(
      targetProjectGroup.folders,
      targetKey,
    );
    if (targetProjectFolder) {
      const openProjectFolderKeys = openProjectFolderKeysByGroup[targetProjectGroup.key] || [];
      if (!openProjectFolderKeys.includes(targetProjectFolder.key)) {
        return {
          type: "open_folder",
          groupKey: targetProjectGroup.key,
          folderKey: targetProjectFolder.key,
        };
      }
    }
  }

  return { type: "scroll" };
};
