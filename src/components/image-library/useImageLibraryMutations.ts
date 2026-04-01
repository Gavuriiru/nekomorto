import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { isAvatarSlotSelection } from "@/components/image-library/avatar-selection";
import { toComparableSelectionKey } from "@/components/image-library/selection";
import type { ImageLibrarySavePayload, LibraryImageItem } from "@/components/image-library/types";
import { toast } from "@/components/ui/use-toast";
import useImageLibraryCropMutations from "@/components/image-library/useImageLibraryCropMutations";
import useImageLibraryMetadataMutations from "@/components/image-library/useImageLibraryMetadataMutations";
import useImageLibraryUploadMutations from "@/components/image-library/useImageLibraryUploadMutations";

type UseImageLibraryMutationsParams = {
  allItems: Map<string, LibraryImageItem>;
  allItemsByComparableKey: Map<string, LibraryImageItem>;
  apiBase: string;
  cropAvatar: boolean;
  cropSlot?: string;
  cropTargetFolder?: string;
  loadLibrary: () => Promise<void>;
  loadUploads: (options?: { includeUrls?: string[] }) => Promise<LibraryImageItem[]>;
  mode: "single" | "multiple";
  onOpenChange: (open: boolean) => void;
  onRequestNavigateToUploads?: () => boolean | Promise<boolean>;
  onSave: (payload: ImageLibrarySavePayload) => void;
  open: boolean;
  pinIncludedUploadUrls: (urls: string[]) => void;
  requestRevealUpload: (url: string, options?: { openCrop?: boolean }) => void;
  scopeUserId?: string;
  selectedUrls: string[];
  setIsCropDialogOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedUrls: Dispatch<SetStateAction<string[]>>;
  shouldAutoOpenAvatarCrop: (url: string) => boolean;
  uploadFolder?: string;
};

type UseImageLibraryMutationsResult = {
  activeFocalPreset: ReturnType<typeof useImageLibraryCropMutations>["activeFocalPreset"];
  altTextTarget: LibraryImageItem | null;
  altTextValue: string;
  applyCrop: (dataUrl: string) => Promise<void>;
  beginAltTextEdit: (item: LibraryImageItem) => void;
  beginFocalPointEdit: (item: LibraryImageItem) => void;
  clearSelection: () => void;
  closeDialog: () => void;
  deleteTarget: LibraryImageItem | null;
  focalCropDraft: ReturnType<typeof useImageLibraryCropMutations>["focalCropDraft"];
  focalTarget: LibraryImageItem | null;
  handleAltTextConfirm: () => Promise<void>;
  handleDelete: (item: LibraryImageItem) => Promise<void>;
  handleImportFromUrl: () => Promise<void>;
  handleNavigateToUploads: () => Promise<void>;
  handleRenameConfirm: () => Promise<void>;
  handleSave: () => void;
  handleUploadFiles: (files: File[] | FileList | null | undefined) => Promise<void>;
  isApplyingCrop: boolean;
  isDeleting: boolean;
  isNavigatingToUploads: boolean;
  isRenaming: boolean;
  isSavingAltText: boolean;
  isSavingFocal: boolean;
  isUploading: boolean;
  renameTarget: LibraryImageItem | null;
  renameValue: string;
  requestRename: (item: LibraryImageItem) => void;
  saveFocalPoint: () => Promise<void>;
  setActiveFocalPreset: ReturnType<typeof useImageLibraryCropMutations>["setActiveFocalPreset"];
  setAltTextTarget: Dispatch<SetStateAction<LibraryImageItem | null>>;
  setAltTextValue: Dispatch<SetStateAction<string>>;
  setDeleteTarget: Dispatch<SetStateAction<LibraryImageItem | null>>;
  setFocalCropDraft: ReturnType<typeof useImageLibraryCropMutations>["setFocalCropDraft"];
  setFocalTarget: Dispatch<SetStateAction<LibraryImageItem | null>>;
  setRenameTarget: Dispatch<SetStateAction<LibraryImageItem | null>>;
  setRenameValue: Dispatch<SetStateAction<string>>;
  setUrlInput: (value: string) => void;
  urlInput: string;
};

export const useImageLibraryMutations = ({
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
}: UseImageLibraryMutationsParams): UseImageLibraryMutationsResult => {
  const uploadMutations = useImageLibraryUploadMutations({
    apiBase,
    cropAvatar,
    cropSlot,
    cropTargetFolder,
    loadUploads,
    mode,
    onRequestRevealUpload: requestRevealUpload,
    pinIncludedUploadUrls,
    scopeUserId,
    setSelectedUrls,
    shouldAutoOpenAvatarCrop,
    uploadFolder,
  });
  const metadataMutations = useImageLibraryMetadataMutations({
    apiBase,
    loadLibrary,
    loadUploads,
    setSelectedUrls,
  });
  const cropMutations = useImageLibraryCropMutations({
    apiBase,
    cropAvatar,
    cropSlot,
    cropTargetFolder,
    loadUploads,
    onRequestRevealUpload: requestRevealUpload,
    scopeUserId,
    setIsCropDialogOpen,
    setSelectedUrls,
    uploadFolder,
  });
  const [isNavigatingToUploads, setIsNavigatingToUploads] = useState(false);
  const {
    altTextTarget,
    altTextValue,
    beginAltTextEdit,
    deleteTarget,
    handleAltTextConfirm,
    handleDelete,
    handleRenameConfirm,
    isDeleting,
    isRenaming,
    isSavingAltText,
    renameTarget,
    renameValue,
    requestRename,
    setAltTextTarget,
    setAltTextValue,
    setDeleteTarget,
    setRenameTarget,
    setRenameValue,
  } = metadataMutations;
  const {
    activeFocalPreset,
    applyCrop,
    beginFocalPointEdit,
    focalCropDraft,
    focalTarget,
    isApplyingCrop,
    isSavingFocal,
    saveFocalPoint,
    setActiveFocalPreset,
    setFocalCropDraft,
    setFocalTarget,
  } = cropMutations;
  const { handleImportFromUrl, handleUploadFiles, isUploading, setUrlInput, urlInput } =
    uploadMutations;

  useEffect(() => {
    if (open) {
      return;
    }
    setAltTextTarget(null);
    setAltTextValue("");
    setFocalTarget(null);
    setIsNavigatingToUploads(false);
  }, [open, setAltTextTarget, setAltTextValue, setFocalTarget]);

  const handleSave = useCallback(() => {
    if (cropAvatar && selectedUrls.length > 0) {
      const normalizedCropSlot = String(cropSlot || "").trim();
      if (!normalizedCropSlot) {
        toast({ title: "Preencha o ID do usuário antes de salvar o avatar." });
        return;
      }
      const selectedUrl = String(selectedUrls[0] || "").trim();
      const matchesAvatarSlot = isAvatarSlotSelection({
        url: selectedUrl,
        slot: normalizedCropSlot,
        folder: cropTargetFolder || "users",
      });
      if (!matchesAvatarSlot) {
        toast({
          title: "Aplique o recorte do avatar antes de salvar.",
          description: "Clique em Editar avatar e depois em Aplicar avatar.",
        });
        return;
      }
    }

    const items = selectedUrls
      .map((url) => allItems.get(url) ?? allItemsByComparableKey.get(toComparableSelectionKey(url)))
      .filter((item): item is LibraryImageItem => Boolean(item));
    onSave({
      urls: selectedUrls,
      items,
    });
    onOpenChange(false);
  }, [
    allItems,
    allItemsByComparableKey,
    cropAvatar,
    cropSlot,
    cropTargetFolder,
    onOpenChange,
    onSave,
    selectedUrls,
  ]);

  const handleNavigateToUploads = useCallback(async () => {
    if (!onRequestNavigateToUploads || isNavigatingToUploads) {
      return;
    }
    setIsNavigatingToUploads(true);
    try {
      const shouldClose = await onRequestNavigateToUploads();
      if (shouldClose === false) {
        return;
      }
      onOpenChange(false);
    } finally {
      setIsNavigatingToUploads(false);
    }
  }, [isNavigatingToUploads, onOpenChange, onRequestNavigateToUploads]);

  const clearSelection = useCallback(() => {
    setSelectedUrls([]);
  }, [setSelectedUrls]);

  const closeDialog = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return {
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
  };
};

export default useImageLibraryMutations;
