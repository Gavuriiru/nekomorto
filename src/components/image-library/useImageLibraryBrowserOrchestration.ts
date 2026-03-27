import {
  useEffect,
  useRef,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from "react";

import useImageLibraryBrowserDerivedState from "@/components/image-library/useImageLibraryBrowserDerivedState";
import useImageLibraryBrowserInteractions from "@/components/image-library/useImageLibraryBrowserInteractions";
import useImageLibraryRevealOrchestration from "@/components/image-library/useImageLibraryRevealOrchestration";
import useImageLibrarySelectionLifecycle from "@/components/image-library/useImageLibrarySelectionLifecycle";
import type {
  LibraryImageItem,
  ProjectImageGroup,
  UploadFolderGroup,
} from "@/components/image-library/types";

type PendingRevealRequest = {
  url: string;
  token: number;
  openCrop: boolean;
};

type UseImageLibraryBrowserOrchestrationParams = {
  allItems: Map<string, LibraryImageItem>;
  allItemsByComparableKey: Map<string, LibraryImageItem>;
  allowDeselect: boolean;
  cropAvatar: boolean;
  currentSelectionUrl?: string;
  currentSelectionUrls?: string[];
  handleUploadFiles: (files: File[] | FileList | null | undefined) => Promise<void>;
  includeProjectImages: boolean;
  isBroadProjectLibraryContext: boolean;
  isLibraryHydratedForOpen: boolean;
  isProjectLibraryContext: boolean;
  isUploading: boolean;
  listAll: boolean;
  mode: "single" | "multiple";
  normalizedListFolders: string[];
  open: boolean;
  openProjectFolderKeysByGroup: Record<string, string[]>;
  openProjectGroupKeys: string[];
  openUploadGroupKeys: string[];
  pendingRevealRequest: PendingRevealRequest | null;
  primarySelectedUrl: string;
  projectImages: LibraryImageItem[];
  projectImagesView: "flat" | "by-project";
  resolvedContextProjectId: string;
  resolvedUploadFolderForFilter: string;
  searchQuery: string;
  selectedResolvedUrlSet: Set<string>;
  setIsCropDialogOpen: Dispatch<SetStateAction<boolean>>;
  setIsDragActive: Dispatch<SetStateAction<boolean>>;
  setOpenProjectFolderKeysByGroup: Dispatch<SetStateAction<Record<string, string[]>>>;
  setOpenProjectGroupKeys: Dispatch<SetStateAction<string[]>>;
  setOpenUploadGroupKeys: Dispatch<SetStateAction<string[]>>;
  setPendingRevealRequest: Dispatch<SetStateAction<PendingRevealRequest | null>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setSelectedUrls: Dispatch<SetStateAction<string[]>>;
  setUploadsFolderFilter: Dispatch<SetStateAction<string>>;
  shouldAutoOpenAvatarCrop: (url: string) => boolean;
  sortMode: "recent" | "oldest" | "name";
  uploads: LibraryImageItem[];
  uploadsFolderFilter: string;
};

type UseImageLibraryBrowserOrchestrationResult = {
  filteredProjectImages: LibraryImageItem[];
  handleDrop: (event: DragEvent<HTMLDivElement>) => void;
  normalizedSearch: string;
  projectImageGroups: ProjectImageGroup[];
  setProjectCardRef: (url: string, node: HTMLButtonElement | null) => void;
  setSelection: (url: string, options?: { openCrop?: boolean }) => void;
  setUploadCardRef: (url: string, node: HTMLButtonElement | null) => void;
  shouldRenderUploadsFolderFilter: boolean;
  shouldShowAllFoldersFilterOption: boolean;
  uploadFolderFilterOptions: string[];
  uploadFolderGroups: UploadFolderGroup[];
};

export const useImageLibraryBrowserOrchestration = ({
  allItems,
  allItemsByComparableKey,
  allowDeselect,
  cropAvatar,
  currentSelectionUrl,
  currentSelectionUrls,
  handleUploadFiles,
  includeProjectImages,
  isBroadProjectLibraryContext,
  isLibraryHydratedForOpen,
  isProjectLibraryContext,
  isUploading,
  listAll,
  mode,
  normalizedListFolders,
  open,
  openProjectFolderKeysByGroup,
  openProjectGroupKeys,
  openUploadGroupKeys,
  pendingRevealRequest,
  primarySelectedUrl,
  projectImages,
  projectImagesView,
  resolvedContextProjectId,
  resolvedUploadFolderForFilter,
  searchQuery,
  selectedResolvedUrlSet,
  setIsCropDialogOpen,
  setIsDragActive,
  setOpenProjectFolderKeysByGroup,
  setOpenProjectGroupKeys,
  setOpenUploadGroupKeys,
  setPendingRevealRequest,
  setSearchQuery,
  setSelectedUrls,
  setUploadsFolderFilter,
  shouldAutoOpenAvatarCrop,
  sortMode,
  uploads,
  uploadsFolderFilter,
}: UseImageLibraryBrowserOrchestrationParams): UseImageLibraryBrowserOrchestrationResult => {
  const hasInitializedUploadAccordionStateForOpenRef = useRef(false);
  const hasInitializedProjectAccordionStateForOpenRef = useRef(false);

  const {
    filteredProjectImages,
    filteredUploads,
    hasUploadsInResolvedFolderContext,
    initialOpenUploadGroupKeys,
    initialProjectAccordionState,
    isUploadsFilterReadyForInitialExpansion,
    matchesSearch,
    normalizedSearch,
    projectImageGroups,
    renderableUploads,
    resolvedUploadFolderForFilterOption,
    shouldRenderUploadsFolderFilter,
    shouldShowAllFoldersFilterOption,
    uploadFolderFilterOptions,
    uploadFolderGroups,
  } = useImageLibraryBrowserDerivedState({
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
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    setUploadsFolderFilter(resolvedUploadFolderForFilterOption || "__all__");
  }, [open, resolvedUploadFolderForFilterOption, setUploadsFolderFilter]);

  useEffect(() => {
    const fallbackFilter =
      resolvedUploadFolderForFilterOption || uploadFolderFilterOptions[0] || "__all__";
    const shouldFallbackMissingContextToAll =
      !hasInitializedUploadAccordionStateForOpenRef.current &&
      resolvedUploadFolderForFilterOption &&
      uploads.length > 0 &&
      shouldShowAllFoldersFilterOption &&
      !hasUploadsInResolvedFolderContext;
    if (
      shouldFallbackMissingContextToAll &&
      uploadsFolderFilter === resolvedUploadFolderForFilterOption
    ) {
      setUploadsFolderFilter("__all__");
      return;
    }
    if (uploadsFolderFilter === "__all__") {
      if (!shouldShowAllFoldersFilterOption && fallbackFilter !== "__all__") {
        setUploadsFolderFilter(fallbackFilter);
      }
      return;
    }
    if (uploadFolderFilterOptions.length === 0) {
      if (
        !shouldShowAllFoldersFilterOption &&
        fallbackFilter !== "__all__" &&
        uploadsFolderFilter !== fallbackFilter
      ) {
        setUploadsFolderFilter(fallbackFilter);
      }
      return;
    }
    if (!uploadFolderFilterOptions.includes(uploadsFolderFilter)) {
      setUploadsFolderFilter(shouldShowAllFoldersFilterOption ? "__all__" : fallbackFilter);
    }
  }, [
    hasUploadsInResolvedFolderContext,
    resolvedUploadFolderForFilterOption,
    setUploadsFolderFilter,
    shouldShowAllFoldersFilterOption,
    uploads.length,
    uploadFolderFilterOptions,
    uploadsFolderFilter,
  ]);

  useImageLibrarySelectionLifecycle({
    allItems,
    allItemsByComparableKey,
    currentSelectionUrl,
    currentSelectionUrls,
    isLibraryHydratedForOpen,
    mode,
    open,
    setIsCropDialogOpen,
    setIsDragActive,
    setSelectedUrls,
  });

  const { setProjectCardRef, setUploadCardRef } = useImageLibraryRevealOrchestration({
    filteredProjectImages,
    filteredUploads,
    hasInitializedProjectAccordionStateForOpenRef,
    hasInitializedUploadAccordionStateForOpenRef,
    initialOpenUploadGroupKeys,
    initialProjectAccordionState,
    isLibraryHydratedForOpen,
    isUploadsFilterReadyForInitialExpansion,
    matchesSearch,
    normalizedSearch,
    open,
    openProjectFolderKeysByGroup,
    openProjectGroupKeys,
    openUploadGroupKeys,
    pendingRevealRequest,
    projectImageGroups,
    projectImages,
    projectImagesView,
    renderableUploads,
    setIsCropDialogOpen,
    setOpenProjectFolderKeysByGroup,
    setOpenProjectGroupKeys,
    setOpenUploadGroupKeys,
    setPendingRevealRequest,
    setSearchQuery,
    setUploadsFolderFilter,
    shouldAutoOpenAvatarCrop,
    uploadFolderGroups,
    uploads,
    uploadsFolderFilter,
  });

  const { handleDrop, setSelection } = useImageLibraryBrowserInteractions({
    allowDeselect,
    cropAvatar,
    handleUploadFiles,
    isUploading,
    mode,
    open,
    primarySelectedUrl,
    setIsCropDialogOpen,
    setIsDragActive,
    setSelectedUrls,
  });

  return {
    filteredProjectImages,
    handleDrop,
    normalizedSearch,
    projectImageGroups,
    setProjectCardRef,
    setSelection,
    setUploadCardRef,
    shouldRenderUploadsFolderFilter,
    shouldShowAllFoldersFilterOption,
    uploadFolderFilterOptions,
    uploadFolderGroups,
  };
};

export default useImageLibraryBrowserOrchestration;
