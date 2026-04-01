import { useCallback, useEffect, useMemo, useState } from "react";

import type { ImageLibraryBrowserPaneProps } from "@/components/image-library/ImageLibraryBrowserPane";
import type { ImageLibraryDialogsProps } from "@/components/image-library/ImageLibraryDialogs";
import type { ImageLibraryUploadPanelProps } from "@/components/image-library/ImageLibraryUploadPanel";
import { isAvatarSlotSelection } from "@/components/image-library/avatar-selection";
import {
  parseSelectionSignature,
  toSelectionSignature,
} from "@/components/image-library/selection";
import { dedupeUrlsByComparableKey } from "@/components/image-library/utils";
import useImageLibraryBrowserOrchestration from "@/components/image-library/useImageLibraryBrowserOrchestration";
import useImageLibraryData from "@/components/image-library/useImageLibraryData";
import useImageLibraryMutations from "@/components/image-library/useImageLibraryMutations";
import useImageLibrarySelectionState from "@/components/image-library/useImageLibrarySelectionState";
import useImageLibraryScope from "@/components/image-library/useImageLibraryScope";
import type { ImageLibraryDialogProps } from "@/components/image-library/types";

export type ImageLibraryDialogFooterProps = {
  allowDeselect: boolean;
  isNavigatingToUploads: boolean;
  isUploading: boolean;
  onClearSelection: () => void;
  onClose: () => void;
  onNavigateToUploads?: () => Promise<void> | void;
  onSave: () => void;
};

export type ImageLibraryDialogController = {
  uploadPanelProps: ImageLibraryUploadPanelProps;
  browserProps: ImageLibraryBrowserPaneProps;
  dialogsProps: ImageLibraryDialogsProps;
  footerProps: ImageLibraryDialogFooterProps;
};

export const useImageLibraryDialogController = ({
  open,
  onOpenChange,
  apiBase,
  uploadFolder,
  listFolders,
  listAll = true,
  includeProjectImages = false,
  projectImageProjectIds,
  mode = "single",
  allowDeselect = true,
  showUrlImport = true,
  currentSelectionUrls,
  currentSelectionUrl,
  projectImagesView = "flat",
  cropAvatar = false,
  cropTargetFolder,
  cropSlot,
  scopeUserId,
  allowUploadManagementActions = true,
  onRequestNavigateToUploads,
  onSave,
}: ImageLibraryDialogProps): ImageLibraryDialogController => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "oldest" | "name">("recent");
  const [uploadsFolderFilter, setUploadsFolderFilter] = useState<string>("__all__");
  const [openUploadGroupKeys, setOpenUploadGroupKeys] = useState<string[]>([]);
  const [openUploadFolderKeysByGroup, setOpenUploadFolderKeysByGroup] = useState<
    Record<string, string[]>
  >({});
  const [openProjectGroupKeys, setOpenProjectGroupKeys] = useState<string[]>([]);
  const [openProjectFolderKeysByGroup, setOpenProjectFolderKeysByGroup] = useState<
    Record<string, string[]>
  >({});
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [pinnedIncludeUrls, setPinnedIncludeUrls] = useState<string[]>([]);
  const currentSelectionUrlsSignature = useMemo(
    () => toSelectionSignature(Array.isArray(currentSelectionUrls) ? currentSelectionUrls : []),
    [currentSelectionUrls],
  );
  const stableCurrentSelectionUrls = useMemo(
    () => parseSelectionSignature(currentSelectionUrlsSignature),
    [currentSelectionUrlsSignature],
  );
  const currentSelectionUrlSignature = useMemo(
    () => toSelectionSignature(currentSelectionUrl ? [currentSelectionUrl] : []),
    [currentSelectionUrl],
  );
  const stableCurrentSelectionUrl = useMemo(
    () => parseSelectionSignature(currentSelectionUrlSignature)[0] || "",
    [currentSelectionUrlSignature],
  );
  const pinnedIncludeUrlsSignature = useMemo(
    () => toSelectionSignature(pinnedIncludeUrls),
    [pinnedIncludeUrls],
  );
  const stablePinnedIncludeUrls = useMemo(
    () => parseSelectionSignature(pinnedIncludeUrlsSignature),
    [pinnedIncludeUrlsSignature],
  );
  const persistentIncludeUrls = useMemo(
    () =>
      dedupeUrlsByComparableKey([
        ...stableCurrentSelectionUrls,
        ...(stableCurrentSelectionUrl ? [stableCurrentSelectionUrl] : []),
        ...stablePinnedIncludeUrls,
      ]),
    [stableCurrentSelectionUrl, stableCurrentSelectionUrls, stablePinnedIncludeUrls],
  );
  const {
    allowedProjectImageIdSet,
    foldersToRequest,
    isBroadProjectLibraryContext,
    isProjectLibraryContext,
    normalizedListFolders,
    resolvedContextProjectId,
    resolvedUploadFolderForFilter,
  } = useImageLibraryScope({
    includeProjectImages,
    listAll,
    listFolders,
    projectImageProjectIds,
    uploadFolder,
  });
  const {
    isLibraryHydratedForOpen,
    isLoading,
    loadLibrary,
    loadUploads,
    projectImages,
    uploads,
    uploadsLoadError,
  } = useImageLibraryData({
    allowedProjectImageIdSet,
    apiBase,
    foldersToRequest,
    includeProjectImages,
    open,
    persistentIncludeUrls,
    scopeUserId,
  });
  const {
    allItems,
    allItemsByComparableKey,
    pendingRevealRequest,
    primarySelectedRenderKey,
    primarySelectedRenderUrl,
    primarySelectedUrl,
    requestRevealUpload,
    selectedResolvedUrlSet,
    setPendingRevealRequest,
  } = useImageLibrarySelectionState({
    projectImages,
    selectedUrls,
    uploads,
  });
  const pinIncludedUploadUrls = useCallback((urls: string[]) => {
    const normalizedUrls = dedupeUrlsByComparableKey(urls);
    if (normalizedUrls.length === 0) {
      return;
    }
    setPinnedIncludeUrls((prev) => {
      const next = dedupeUrlsByComparableKey([...prev, ...normalizedUrls]);
      return toSelectionSignature(prev) === toSelectionSignature(next) ? prev : next;
    });
  }, []);
  const shouldAutoOpenAvatarCrop = useCallback(
    (url: string) => {
      if (!cropAvatar || mode !== "single") {
        return false;
      }
      const normalizedCropSlot = String(cropSlot || "").trim();
      if (!normalizedCropSlot) {
        return true;
      }
      return !isAvatarSlotSelection({
        url,
        slot: normalizedCropSlot,
        folder: cropTargetFolder || "users",
      });
    },
    [cropAvatar, cropSlot, cropTargetFolder, mode],
  );
  const {
    activeFocalPreset,
    altTextTarget,
    altTextValue,
    applyCrop,
    beginAltTextEdit,
    beginFocalPointEdit,
    clearSelection,
    closeDialog,
    deleteTarget,
    focalCropDraft,
    focalTarget,
    handleAltTextConfirm,
    handleDelete,
    handleImportFromUrl,
    handleNavigateToUploads,
    handleRenameConfirm,
    handleSave,
    handleUploadFiles,
    isApplyingCrop,
    isDeleting,
    isNavigatingToUploads,
    isRenaming,
    isSavingAltText,
    isSavingFocal,
    isUploading,
    renameTarget,
    renameValue,
    requestRename,
    saveFocalPoint,
    setActiveFocalPreset,
    setAltTextTarget,
    setAltTextValue,
    setDeleteTarget,
    setFocalCropDraft,
    setFocalTarget,
    setRenameTarget,
    setRenameValue,
    setUrlInput,
    urlInput,
  } = useImageLibraryMutations({
    allItems,
    allItemsByComparableKey,
    apiBase,
    cropAvatar,
    cropSlot,
    cropTargetFolder,
    loadLibrary,
    loadUploads,
    mode,
    onOpenChange,
    onRequestNavigateToUploads,
    onSave,
    open,
    pinIncludedUploadUrls,
    requestRevealUpload,
    scopeUserId,
    selectedUrls,
    setIsCropDialogOpen,
    setSelectedUrls,
    shouldAutoOpenAvatarCrop,
    uploadFolder,
  });
  const {
    filteredProjectImages,
    handleDrop,
    normalizedSearch,
    projectImageGroups,
    setProjectCardRef,
    setSelection,
    setUploadCardRef,
    shouldRenderUploadsFolderFilter,
    shouldShowAllFoldersFilterOption,
    uploadFolderFilterOptionLabels,
    uploadFolderFilterOptions,
    uploadFolderGroups,
  } = useImageLibraryBrowserOrchestration({
    allItems,
    allItemsByComparableKey,
    allowDeselect,
    cropAvatar,
    currentSelectionUrl: stableCurrentSelectionUrl,
    currentSelectionUrls: stableCurrentSelectionUrls,
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
    openUploadFolderKeysByGroup,
    openProjectFolderKeysByGroup,
    openProjectGroupKeys,
    openUploadGroupKeys,
    pendingRevealRequest,
    primarySelectedUrl,
    projectImages,
    projectImagesView,
    requestRevealUpload,
    resolvedContextProjectId,
    resolvedUploadFolderForFilter,
    searchQuery,
    selectedResolvedUrlSet,
    setIsCropDialogOpen,
    setIsDragActive,
    setOpenUploadFolderKeysByGroup,
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
  });

  useEffect(() => {
    if (open) {
      return;
    }
    setPinnedIncludeUrls([]);
  }, [open]);

  const uploadPanelProps = useMemo<ImageLibraryUploadPanelProps>(
    () => ({
      cropAvatar,
      handleDrop,
      handleImportFromUrl,
      handleUploadFiles,
      isDragActive,
      isUploading,
      mode,
      searchQuery,
      setIsDragActive,
      setSearchQuery,
      setUrlInput,
      showUrlImport,
      urlInput,
    }),
    [
      cropAvatar,
      handleDrop,
      handleImportFromUrl,
      handleUploadFiles,
      isDragActive,
      isUploading,
      mode,
      searchQuery,
      showUrlImport,
      urlInput,
    ],
  );
  const browserProps = useMemo<ImageLibraryBrowserPaneProps>(
    () => ({
      allowUploadManagementActions,
      beginAltTextEdit,
      beginFocalPointEdit,
      cropAvatar,
      filteredProjectImages,
      includeProjectImages,
      isDeleting,
      isLoading,
      mode,
      normalizedSearch,
      openUploadFolderKeysByGroup,
      onRequestDelete: setDeleteTarget,
      onRequestRename: requestRename,
      openProjectFolderKeysByGroup,
      openProjectGroupKeys,
      openUploadGroupKeys,
      projectImageGroups,
      projectImagesView,
      selectedResolvedUrlSet,
      selectedUrlsCount: selectedUrls.length,
      setOpenUploadFolderKeysByGroup,
      setOpenProjectFolderKeysByGroup,
      setOpenProjectGroupKeys,
      setOpenUploadGroupKeys,
      setProjectCardRef,
      setSelection,
      setSortMode,
      setUploadCardRef,
      setUploadsFolderFilter,
      shouldRenderUploadsFolderFilter,
      shouldShowAllFoldersFilterOption,
      sortMode,
      uploadFolderFilterOptionLabels,
      uploadFolderFilterOptions,
      uploadFolderGroups,
      uploadsFolderFilter,
      uploadsLoadError,
    }),
    [
      allowUploadManagementActions,
      beginAltTextEdit,
      beginFocalPointEdit,
      cropAvatar,
      filteredProjectImages,
      includeProjectImages,
      isDeleting,
      isLoading,
      mode,
      normalizedSearch,
      openUploadFolderKeysByGroup,
      openProjectFolderKeysByGroup,
      openProjectGroupKeys,
      openUploadGroupKeys,
      projectImageGroups,
      projectImagesView,
      requestRename,
      selectedResolvedUrlSet,
      selectedUrls.length,
      setOpenUploadFolderKeysByGroup,
      setProjectCardRef,
      setSelection,
      setUploadCardRef,
      shouldRenderUploadsFolderFilter,
      shouldShowAllFoldersFilterOption,
      sortMode,
      uploadFolderFilterOptionLabels,
      uploadFolderFilterOptions,
      uploadFolderGroups,
      uploadsFolderFilter,
      uploadsLoadError,
    ],
  );
  const dialogsProps = useMemo<ImageLibraryDialogsProps>(
    () => ({
      activeFocalPreset,
      altTextTarget,
      altTextValue,
      applyCrop,
      deleteTarget,
      focalCropDraft,
      focalTarget,
      handleAltTextConfirm,
      handleDelete,
      handleRenameConfirm,
      isApplyingCrop,
      isCropDialogOpen,
      isDeleting,
      isRenaming,
      isSavingAltText,
      isSavingFocal,
      primarySelectedRenderKey,
      primarySelectedRenderUrl,
      primarySelectedUrl,
      renameTarget,
      renameValue,
      saveFocalPoint,
      setActiveFocalPreset,
      setAltTextTarget,
      setAltTextValue,
      setDeleteTarget,
      setFocalCropDraft,
      setFocalTarget,
      setIsCropDialogOpen,
      setRenameTarget,
      setRenameValue,
    }),
    [
      activeFocalPreset,
      altTextTarget,
      altTextValue,
      applyCrop,
      deleteTarget,
      focalCropDraft,
      focalTarget,
      handleAltTextConfirm,
      handleDelete,
      handleRenameConfirm,
      isApplyingCrop,
      isCropDialogOpen,
      isDeleting,
      isRenaming,
      isSavingAltText,
      isSavingFocal,
      primarySelectedRenderKey,
      primarySelectedRenderUrl,
      primarySelectedUrl,
      renameTarget,
      renameValue,
      saveFocalPoint,
    ],
  );
  const footerProps = useMemo<ImageLibraryDialogFooterProps>(
    () => ({
      allowDeselect,
      isNavigatingToUploads,
      isUploading,
      onClearSelection: clearSelection,
      onClose: closeDialog,
      onNavigateToUploads: onRequestNavigateToUploads ? handleNavigateToUploads : undefined,
      onSave: handleSave,
    }),
    [
      allowDeselect,
      clearSelection,
      closeDialog,
      handleNavigateToUploads,
      handleSave,
      isNavigatingToUploads,
      isUploading,
      onRequestNavigateToUploads,
    ],
  );

  return {
    uploadPanelProps,
    browserProps,
    dialogsProps,
    footerProps,
  };
};

export default useImageLibraryDialogController;
