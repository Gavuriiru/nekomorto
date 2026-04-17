import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react";

import { assignLibraryCardRef } from "@/components/image-library/avatar-selection";
import {
  resolvePendingProjectRevealStep,
  resolvePendingUploadRevealStep,
} from "@/components/image-library/groups";
import { toComparableSelectionKey } from "@/components/image-library/selection";
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

type UseImageLibraryRevealOrchestrationParams = {
  filteredProjectImages: LibraryImageItem[];
  filteredUploads: LibraryImageItem[];
  hasInitializedProjectAccordionStateForOpenRef: MutableRefObject<boolean>;
  hasInitializedUploadAccordionStateForOpenRef: MutableRefObject<boolean>;
  initialUploadAccordionState: {
    groupKeys: string[];
    folderKeysByGroup: Record<string, string[]>;
  };
  initialProjectAccordionState: {
    groupKeys: string[];
    folderKeysByGroup: Record<string, string[]>;
  };
  isLibraryHydratedForOpen: boolean;
  isUploadsFilterReadyForInitialExpansion: boolean;
  matchesSearch: (item: LibraryImageItem) => boolean;
  normalizedSearch: string;
  open: boolean;
  openUploadFolderKeysByGroup: Record<string, string[]>;
  openProjectFolderKeysByGroup: Record<string, string[]>;
  openProjectGroupKeys: string[];
  openUploadGroupKeys: string[];
  pendingRevealRequest: PendingRevealRequest | null;
  projectImageGroups: ProjectImageGroup[];
  projectImages: LibraryImageItem[];
  projectImagesView: "flat" | "by-project";
  renderableUploads: LibraryImageItem[];
  setIsCropDialogOpen: Dispatch<SetStateAction<boolean>>;
  setOpenUploadFolderKeysByGroup: Dispatch<SetStateAction<Record<string, string[]>>>;
  setOpenProjectFolderKeysByGroup: Dispatch<SetStateAction<Record<string, string[]>>>;
  setOpenProjectGroupKeys: Dispatch<SetStateAction<string[]>>;
  setOpenUploadGroupKeys: Dispatch<SetStateAction<string[]>>;
  setPendingRevealRequest: Dispatch<SetStateAction<PendingRevealRequest | null>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setUploadsFolderFilter: Dispatch<SetStateAction<string>>;
  resolveUploadsFolderFilterValue: (folder: string | null | undefined) => string;
  shouldAutoOpenAvatarCrop: (url: string) => boolean;
  uploadFolderGroups: UploadFolderGroup[];
  uploads: LibraryImageItem[];
  uploadsFolderFilter: string;
};

type UseImageLibraryRevealOrchestrationResult = {
  setProjectCardRef: (url: string, node: HTMLButtonElement | null) => void;
  setUploadCardRef: (url: string, node: HTMLButtonElement | null) => void;
};

export const useImageLibraryRevealOrchestration = ({
  filteredProjectImages,
  filteredUploads,
  hasInitializedProjectAccordionStateForOpenRef,
  hasInitializedUploadAccordionStateForOpenRef,
  initialUploadAccordionState,
  initialProjectAccordionState,
  isLibraryHydratedForOpen,
  isUploadsFilterReadyForInitialExpansion,
  matchesSearch,
  normalizedSearch,
  open,
  openUploadFolderKeysByGroup,
  openProjectFolderKeysByGroup,
  openProjectGroupKeys,
  openUploadGroupKeys,
  pendingRevealRequest,
  projectImageGroups,
  projectImages,
  projectImagesView,
  renderableUploads,
  setIsCropDialogOpen,
  setOpenUploadFolderKeysByGroup,
  setOpenProjectFolderKeysByGroup,
  setOpenProjectGroupKeys,
  setOpenUploadGroupKeys,
  setPendingRevealRequest,
  setSearchQuery,
  setUploadsFolderFilter,
  resolveUploadsFolderFilterValue,
  shouldAutoOpenAvatarCrop,
  uploadFolderGroups,
  uploads,
  uploadsFolderFilter,
}: UseImageLibraryRevealOrchestrationParams): UseImageLibraryRevealOrchestrationResult => {
  const uploadCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const projectCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const setUploadCardRef = useCallback((url: string, node: HTMLButtonElement | null) => {
    assignLibraryCardRef(uploadCardRefs, url, node);
  }, []);

  const setProjectCardRef = useCallback((url: string, node: HTMLButtonElement | null) => {
    assignLibraryCardRef(projectCardRefs, url, node);
  }, []);

  useEffect(() => {
    if (!open) {
      hasInitializedUploadAccordionStateForOpenRef.current = false;
      hasInitializedProjectAccordionStateForOpenRef.current = false;
      setOpenUploadGroupKeys([]);
      setOpenUploadFolderKeysByGroup({});
      setOpenProjectGroupKeys([]);
      setOpenProjectFolderKeysByGroup({});
      setPendingRevealRequest(null);
    }
  }, [
    open,
    setOpenUploadFolderKeysByGroup,
    setOpenProjectFolderKeysByGroup,
    setOpenProjectGroupKeys,
    setOpenUploadGroupKeys,
    setPendingRevealRequest,
  ]);

  useEffect(() => {
    if (!open || !isLibraryHydratedForOpen || !isUploadsFilterReadyForInitialExpansion) {
      return;
    }
    if (hasInitializedUploadAccordionStateForOpenRef.current) {
      return;
    }
    if (uploadFolderGroups.length === 0) {
      return;
    }
    hasInitializedUploadAccordionStateForOpenRef.current = true;
    setOpenUploadGroupKeys(initialUploadAccordionState.groupKeys);
    setOpenUploadFolderKeysByGroup(initialUploadAccordionState.folderKeysByGroup);
  }, [
    initialUploadAccordionState,
    isLibraryHydratedForOpen,
    isUploadsFilterReadyForInitialExpansion,
    open,
    setOpenUploadFolderKeysByGroup,
    setOpenUploadGroupKeys,
    uploadFolderGroups.length,
  ]);

  useEffect(() => {
    if (!open || !isLibraryHydratedForOpen || projectImagesView !== "by-project") {
      return;
    }
    if (hasInitializedProjectAccordionStateForOpenRef.current) {
      return;
    }
    if (projectImageGroups.length === 0) {
      return;
    }
    hasInitializedProjectAccordionStateForOpenRef.current = true;
    setOpenProjectGroupKeys(initialProjectAccordionState.groupKeys);
    setOpenProjectFolderKeysByGroup(initialProjectAccordionState.folderKeysByGroup);
  }, [
    initialProjectAccordionState,
    isLibraryHydratedForOpen,
    open,
    projectImageGroups.length,
    projectImagesView,
    setOpenProjectFolderKeysByGroup,
    setOpenProjectGroupKeys,
  ]);

  useEffect(() => {
    if (!open || !pendingRevealRequest?.url) {
      return;
    }
    const targetKey = toComparableSelectionKey(pendingRevealRequest.url);
    const matchedUpload = uploads.find((item) => toComparableSelectionKey(item.url) === targetKey);
    const matchedProjectItem = projectImages.find(
      (item) => toComparableSelectionKey(item.url) === targetKey,
    );
    if (!matchedUpload && !matchedProjectItem) {
      return;
    }
    const searchHidesTarget =
      normalizedSearch &&
      ![matchedUpload, matchedProjectItem]
        .filter((item): item is LibraryImageItem => Boolean(item))
        .some((item) => matchesSearch(item));
    if (searchHidesTarget) {
      setSearchQuery("");
      return;
    }
    const isUploadRenderable = renderableUploads.some(
      (item) => toComparableSelectionKey(item.url) === targetKey,
    );
    if (matchedUpload && isUploadRenderable) {
      const uploadRevealStep = resolvePendingUploadRevealStep({
        filteredUploads,
        matchedUpload,
        openUploadFolderKeysByGroup,
        openUploadGroupKeys,
        resolveUploadsFolderFilterValue,
        uploadFolderGroups,
        uploadsFolderFilter,
      });
      if (uploadRevealStep.type === "wait") {
        return;
      }
      if (uploadRevealStep.type === "set_filter") {
        setUploadsFolderFilter(uploadRevealStep.value);
        return;
      }
      if (uploadRevealStep.type === "open_group") {
        setOpenUploadGroupKeys([uploadRevealStep.groupKey]);
        return;
      }
      if (uploadRevealStep.type === "open_folder") {
        setOpenUploadFolderKeysByGroup((prev) => ({
          ...prev,
          [uploadRevealStep.groupKey]: [uploadRevealStep.folderKey],
        }));
        return;
      }

      const targetUploadCard = uploadCardRefs.current[targetKey];
      if (!targetUploadCard) {
        return;
      }
      if (typeof targetUploadCard.scrollIntoView === "function") {
        targetUploadCard.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });
      }
      if (pendingRevealRequest.openCrop && shouldAutoOpenAvatarCrop(matchedUpload.url)) {
        setIsCropDialogOpen(true);
      }
      setPendingRevealRequest(null);
      return;
    }
    if (!matchedProjectItem) {
      return;
    }
    const projectRevealStep = resolvePendingProjectRevealStep({
      filteredProjectImages,
      matchedProjectItem,
      openProjectFolderKeysByGroup,
      openProjectGroupKeys,
      projectImageGroups,
      projectImagesView,
    });
    if (projectRevealStep.type === "wait") {
      return;
    }
    if (projectRevealStep.type === "open_group") {
      setOpenProjectGroupKeys([projectRevealStep.groupKey]);
      return;
    }
    if (projectRevealStep.type === "open_folder") {
      setOpenProjectFolderKeysByGroup((prev) => ({
        ...prev,
        [projectRevealStep.groupKey]: [projectRevealStep.folderKey],
      }));
      return;
    }

    const targetProjectCard = projectCardRefs.current[targetKey];
    if (!targetProjectCard) {
      return;
    }
    if (typeof targetProjectCard.scrollIntoView === "function") {
      targetProjectCard.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
    }
    if (
      pendingRevealRequest.openCrop &&
      matchedUpload &&
      shouldAutoOpenAvatarCrop(matchedUpload.url)
    ) {
      setIsCropDialogOpen(true);
    }
    setPendingRevealRequest(null);
  }, [
    filteredProjectImages,
    filteredUploads,
    matchesSearch,
    normalizedSearch,
    open,
    openUploadFolderKeysByGroup,
    openProjectFolderKeysByGroup,
    openProjectGroupKeys,
    openUploadGroupKeys,
    pendingRevealRequest,
    projectImageGroups,
    projectImages,
    projectImagesView,
    renderableUploads,
    setIsCropDialogOpen,
    setOpenUploadFolderKeysByGroup,
    setOpenProjectFolderKeysByGroup,
    setOpenProjectGroupKeys,
    setOpenUploadGroupKeys,
    setPendingRevealRequest,
    setSearchQuery,
    setUploadsFolderFilter,
    resolveUploadsFolderFilterValue,
    shouldAutoOpenAvatarCrop,
    uploadFolderGroups,
    uploads,
    uploadsFolderFilter,
  ]);

  return {
    setProjectCardRef,
    setUploadCardRef,
  };
};

export default useImageLibraryRevealOrchestration;
