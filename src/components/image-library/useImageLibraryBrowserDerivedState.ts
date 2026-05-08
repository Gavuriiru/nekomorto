import { useCallback, useMemo } from "react";

import { isAvatarGeneratedUsersUpload } from "@/components/image-library/avatar-selection";
import {
  buildInitialProjectAccordionState,
  buildInitialUploadAccordionState,
  buildProjectImageGroups,
  buildUploadFolderFilterOptionLabels,
  buildUploadFolderFilterOptions,
  buildUploadFolderGroups,
  hasHiddenProjectUploadsInTopSection,
  hasProjectFolderContextExcludedFromUploadFilter,
  resolveUploadFolderForFilterOption,
  shouldCollapseProjectFoldersInUploadFilter,
} from "@/components/image-library/groups";
import { toComparableSelectionKey } from "@/components/image-library/selection";
import type {
  LibraryImageItem,
  ProjectImageGroup,
  UploadFolderGroup,
} from "@/components/image-library/types";
import {
  compareNaturalTextPtBr,
  isFolderWithinSelection,
  resolveItemFolder,
  resolveProjectRootFromFolder,
  toEffectiveName,
} from "@/components/image-library/utils";

type UseImageLibraryBrowserDerivedStateParams = {
  cropAvatar: boolean;
  includeProjectImages: boolean;
  isBroadProjectLibraryContext: boolean;
  isProjectLibraryContext: boolean;
  listAll: boolean;
  normalizedListFolders: string[];
  projectImages: LibraryImageItem[];
  resolvedContextProjectId: string;
  resolvedUploadFolderForFilter: string;
  searchQuery: string;
  selectedResolvedUrlSet: Set<string>;
  sortMode: "recent" | "oldest" | "name";
  uploads: LibraryImageItem[];
  uploadsFolderFilter: string;
};

type UseImageLibraryBrowserDerivedStateResult = {
  collapseProjectFoldersInUploadFilter: boolean;
  filteredProjectImages: LibraryImageItem[];
  filteredUploads: LibraryImageItem[];
  hasUploadsInResolvedFolderContext: boolean;
  initialUploadAccordionState: {
    groupKeys: string[];
    folderKeysByGroup: Record<string, string[]>;
  };
  initialProjectAccordionState: {
    groupKeys: string[];
    folderKeysByGroup: Record<string, string[]>;
  };
  isUploadsFilterReadyForInitialExpansion: boolean;
  matchesSearch: (item: LibraryImageItem) => boolean;
  normalizedSearch: string;
  projectImageGroups: ProjectImageGroup[];
  renderableUploads: LibraryImageItem[];
  resolvedUploadFolderForFilterOption: string;
  shouldRenderUploadsFolderFilter: boolean;
  shouldShowAllFoldersFilterOption: boolean;
  uploadFolderFilterOptionLabels: Record<string, string>;
  uploadFolderFilterOptions: string[];
  uploadFolderGroups: UploadFolderGroup[];
};

export const useImageLibraryBrowserDerivedState = ({
  cropAvatar,
  includeProjectImages,
  isBroadProjectLibraryContext,
  isProjectLibraryContext,
  listAll,
  normalizedListFolders,
  projectImages,
  resolvedContextProjectId,
  resolvedUploadFolderForFilter,
  searchQuery,
  selectedResolvedUrlSet,
  sortMode,
  uploads,
  uploadsFolderFilter,
}: UseImageLibraryBrowserDerivedStateParams): UseImageLibraryBrowserDerivedStateResult => {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const sortLibraryItems = useCallback(
    (items: LibraryImageItem[]) => {
      if (sortMode === "name") {
        const next = [...items];
        next.sort((left, right) =>
          compareNaturalTextPtBr(toEffectiveName(left), toEffectiveName(right)),
        );
        return next;
      }

      // ⚡ Bolt Performance Optimization:
      // Precompute timestamps in a single O(N) pass to avoid expensive
      // O(N log N) `new Date().getTime()` allocations inside the `.sort()` comparator.
      const mapped = items.map((item) => {
        const ts = new Date(item.createdAt || 0).getTime();
        return {
          item,
          timestamp: Number.isFinite(ts) ? ts : 0,
        };
      });

      mapped.sort((leftWrapper, rightWrapper) => {
        if (sortMode === "oldest") {
          if (leftWrapper.timestamp !== rightWrapper.timestamp) {
            return leftWrapper.timestamp - rightWrapper.timestamp;
          }
        } else if (leftWrapper.timestamp !== rightWrapper.timestamp) {
          return rightWrapper.timestamp - leftWrapper.timestamp;
        }
        return compareNaturalTextPtBr(
          toEffectiveName(leftWrapper.item),
          toEffectiveName(rightWrapper.item),
        );
      });

      return mapped.map((wrapper) => wrapper.item);
    },
    [sortMode],
  );

  const matchesSearch = useCallback(
    (item: LibraryImageItem) => {
      if (!normalizedSearch) {
        return true;
      }
      const haystack = [
        item.name,
        item.label,
        item.fileName,
        item.projectTitle,
        item.projectId,
        item.kind,
        item.url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    },
    [normalizedSearch],
  );

  const visibleUploads = useMemo(() => {
    if (!cropAvatar) {
      return uploads;
    }
    return uploads.filter((item) => {
      if (!isAvatarGeneratedUsersUpload(item)) {
        return true;
      }
      return selectedResolvedUrlSet.has(item.url);
    });
  }, [cropAvatar, selectedResolvedUrlSet, uploads]);

  const projectImageComparableKeySet = useMemo(() => {
    const set = new Set<string>();
    projectImages.forEach((item) => {
      set.add(toComparableSelectionKey(item.url));
    });
    return set;
  }, [projectImages]);

  const renderableUploads = useMemo(() => {
    if (!isProjectLibraryContext) {
      return visibleUploads;
    }
    return visibleUploads.filter((item) => {
      const folder = resolveItemFolder(item);
      if (!resolveProjectRootFromFolder(folder)) {
        return true;
      }
      return !projectImageComparableKeySet.has(toComparableSelectionKey(item.url));
    });
  }, [isProjectLibraryContext, projectImageComparableKeySet, visibleUploads]);

  const filteredUploads = useMemo(() => {
    const bySearch = renderableUploads.filter(matchesSearch);
    const byFolder =
      uploadsFolderFilter === "__all__"
        ? bySearch
        : bySearch.filter((item) =>
            isFolderWithinSelection({
              itemFolder: resolveItemFolder(item),
              selectedFolder: uploadsFolderFilter,
            }),
          );
    return sortLibraryItems(byFolder);
  }, [matchesSearch, renderableUploads, sortLibraryItems, uploadsFolderFilter]);

  const filteredProjectImages = useMemo(
    () => sortLibraryItems(projectImages.filter(matchesSearch)),
    [matchesSearch, projectImages, sortLibraryItems],
  );

  const shouldExcludeProjectFoldersFromUploadFilter = includeProjectImages;

  const collapseProjectFoldersInUploadFilter = useMemo(
    () =>
      shouldCollapseProjectFoldersInUploadFilter({
        normalizedListFolders,
        resolvedUploadFolderForFilter,
        shouldExcludeProjectFoldersFromUploadFilter,
      }),
    [
      normalizedListFolders,
      resolvedUploadFolderForFilter,
      shouldExcludeProjectFoldersFromUploadFilter,
    ],
  );

  const uploadFolderGroups = useMemo(
    () =>
      buildUploadFolderGroups({
        collapseProjectFoldersToRoots: collapseProjectFoldersInUploadFilter,
        filteredUploads,
        preferFullProjectPath: isBroadProjectLibraryContext,
        resolvedUploadFolderForFilter,
        sortItems: sortLibraryItems,
      }),
    [
      collapseProjectFoldersInUploadFilter,
      filteredUploads,
      isBroadProjectLibraryContext,
      resolvedUploadFolderForFilter,
      sortLibraryItems,
    ],
  );

  const resolvedUploadFolderForFilterOption = useMemo(
    () =>
      resolveUploadFolderForFilterOption({
        resolvedUploadFolderForFilter,
        shouldExcludeProjectFoldersFromUploadFilter,
      }),
    [resolvedUploadFolderForFilter, shouldExcludeProjectFoldersFromUploadFilter],
  );

  const hasHiddenProjectUploads = useMemo(
    () =>
      hasHiddenProjectUploadsInTopSection({
        renderableUploads,
        shouldExcludeProjectFoldersFromUploadFilter,
      }),
    [renderableUploads, shouldExcludeProjectFoldersFromUploadFilter],
  );

  const hasExcludedProjectFolderContext = useMemo(
    () =>
      hasProjectFolderContextExcludedFromUploadFilter({
        hasHiddenProjectUploads,
        normalizedListFolders,
        resolvedUploadFolderForFilter,
        shouldExcludeProjectFoldersFromUploadFilter,
      }),
    [
      hasHiddenProjectUploads,
      normalizedListFolders,
      resolvedUploadFolderForFilter,
      shouldExcludeProjectFoldersFromUploadFilter,
    ],
  );

  const uploadFolderFilterOptions = useMemo(
    () =>
      buildUploadFolderFilterOptions({
        collapseProjectFoldersToRoots: collapseProjectFoldersInUploadFilter,
        normalizedListFolders,
        renderableUploads,
        resolvedUploadFolderForFilter,
        shouldExcludeProjectFoldersFromUploadFilter,
      }),
    [
      collapseProjectFoldersInUploadFilter,
      normalizedListFolders,
      renderableUploads,
      resolvedUploadFolderForFilter,
      shouldExcludeProjectFoldersFromUploadFilter,
    ],
  );

  const uploadFolderFilterOptionLabels = useMemo(
    () =>
      buildUploadFolderFilterOptionLabels({
        preferProjectTitles: collapseProjectFoldersInUploadFilter,
        renderableUploads,
        uploadFolderFilterOptions,
      }),
    [collapseProjectFoldersInUploadFilter, renderableUploads, uploadFolderFilterOptions],
  );

  const shouldShowAllFoldersFilterOption = useMemo(() => {
    if (!shouldExcludeProjectFoldersFromUploadFilter) {
      return listAll || uploadFolderFilterOptions.length > 1;
    }
    if (uploadFolderFilterOptions.length === 0) {
      return false;
    }
    return listAll || uploadFolderFilterOptions.length > 1 || hasExcludedProjectFolderContext;
  }, [
    hasExcludedProjectFolderContext,
    listAll,
    shouldExcludeProjectFoldersFromUploadFilter,
    uploadFolderFilterOptions.length,
  ]);

  const shouldRenderUploadsFolderFilter = useMemo(() => {
    if (shouldExcludeProjectFoldersFromUploadFilter && uploadFolderFilterOptions.length === 0) {
      return false;
    }
    return shouldShowAllFoldersFilterOption || uploadFolderFilterOptions.length > 0;
  }, [
    shouldExcludeProjectFoldersFromUploadFilter,
    shouldShowAllFoldersFilterOption,
    uploadFolderFilterOptions.length,
  ]);

  const hasUploadsInResolvedFolderContext = useMemo(() => {
    if (!resolvedUploadFolderForFilterOption) {
      return false;
    }
    return uploads.some((item) =>
      isFolderWithinSelection({
        itemFolder: resolveItemFolder(item),
        selectedFolder: resolvedUploadFolderForFilterOption,
      }),
    );
  }, [resolvedUploadFolderForFilterOption, uploads]);

  const isUploadsFilterReadyForInitialExpansion = useMemo(() => {
    if (uploads.length === 0) {
      return true;
    }
    if (uploadsFolderFilter === "__all__") {
      return true;
    }
    if (uploadFolderFilterOptions.length === 0) {
      return false;
    }
    return uploadFolderFilterOptions.includes(uploadsFolderFilter);
  }, [uploadFolderFilterOptions, uploads, uploadsFolderFilter]);

  const projectImageGroups = useMemo(
    () =>
      buildProjectImageGroups({
        filteredProjectImages,
      }),
    [filteredProjectImages],
  );

  const initialUploadAccordionState = useMemo(
    () =>
      buildInitialUploadAccordionState({
        resolvedUploadFolderForFilter,
        uploadFolderGroups,
      }),
    [resolvedUploadFolderForFilter, uploadFolderGroups],
  );

  const initialProjectAccordionState = useMemo(
    () =>
      buildInitialProjectAccordionState({
        projectImageGroups,
        resolvedContextProjectId,
        resolvedUploadFolderForFilter,
      }),
    [projectImageGroups, resolvedContextProjectId, resolvedUploadFolderForFilter],
  );

  return {
    collapseProjectFoldersInUploadFilter,
    filteredProjectImages,
    filteredUploads,
    hasUploadsInResolvedFolderContext,
    initialUploadAccordionState,
    initialProjectAccordionState,
    isUploadsFilterReadyForInitialExpansion,
    matchesSearch,
    normalizedSearch,
    projectImageGroups,
    renderableUploads,
    resolvedUploadFolderForFilterOption,
    shouldRenderUploadsFolderFilter,
    shouldShowAllFoldersFilterOption,
    uploadFolderFilterOptionLabels,
    uploadFolderFilterOptions,
    uploadFolderGroups,
  };
};

export default useImageLibraryBrowserDerivedState;
