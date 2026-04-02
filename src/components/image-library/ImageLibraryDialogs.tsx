import type { Dispatch, SetStateAction } from "react";

import {
  ImageLibraryAltTextDialog,
  ImageLibraryAvatarCropDialog,
  ImageLibraryDeleteDialog,
  ImageLibraryFocalPointDialog,
  ImageLibraryRenameDialog,
} from "@/components/image-library/image-library-dialog-parts";
import type { LibraryImageItem } from "@/components/image-library/types";
import type { UploadFocalCrops, UploadFocalPresetKey } from "@/lib/upload-focal-points";

export type ImageLibraryDialogsProps = {
  activeFocalPreset: UploadFocalPresetKey;
  altTextTarget: LibraryImageItem | null;
  altTextValue: string;
  applyCrop: (dataUrl: string) => Promise<void>;
  deleteTarget: LibraryImageItem | null;
  focalCropDraft: UploadFocalCrops;
  focalTarget: LibraryImageItem | null;
  handleAltTextConfirm: () => Promise<void>;
  handleDelete: (item: LibraryImageItem) => Promise<void>;
  handleRenameConfirm: () => Promise<void>;
  isApplyingCrop: boolean;
  isCropDialogOpen: boolean;
  isDeleting: boolean;
  isRenaming: boolean;
  isSavingAltText: boolean;
  isSavingFocal: boolean;
  primarySelectedRenderKey: string;
  primarySelectedRenderUrl: string;
  primarySelectedUrl: string;
  renameTarget: LibraryImageItem | null;
  renameValue: string;
  saveFocalPoint: () => Promise<void>;
  setActiveFocalPreset: (value: UploadFocalPresetKey) => void;
  setAltTextTarget: (value: LibraryImageItem | null) => void;
  setAltTextValue: (value: string) => void;
  setDeleteTarget: (value: LibraryImageItem | null) => void;
  setFocalCropDraft: Dispatch<SetStateAction<UploadFocalCrops>>;
  setFocalTarget: (value: LibraryImageItem | null) => void;
  setIsCropDialogOpen: (value: boolean) => void;
  setRenameTarget: (value: LibraryImageItem | null) => void;
  setRenameValue: (value: string) => void;
};

const ImageLibraryDialogs = ({
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
}: ImageLibraryDialogsProps) => (
  <>
    <ImageLibraryAvatarCropDialog
      applyCrop={applyCrop}
      isApplyingCrop={isApplyingCrop}
      isCropDialogOpen={isCropDialogOpen}
      primarySelectedRenderKey={primarySelectedRenderKey}
      primarySelectedRenderUrl={primarySelectedRenderUrl}
      primarySelectedUrl={primarySelectedUrl}
      setIsCropDialogOpen={setIsCropDialogOpen}
    />
    <ImageLibraryFocalPointDialog
      activeFocalPreset={activeFocalPreset}
      focalCropDraft={focalCropDraft}
      focalTarget={focalTarget}
      isSavingFocal={isSavingFocal}
      saveFocalPoint={saveFocalPoint}
      setActiveFocalPreset={setActiveFocalPreset}
      setFocalCropDraft={setFocalCropDraft}
      setFocalTarget={setFocalTarget}
    />
    <ImageLibraryDeleteDialog
      deleteTarget={deleteTarget}
      handleDelete={handleDelete}
      isDeleting={isDeleting}
      setDeleteTarget={setDeleteTarget}
    />
    <ImageLibraryAltTextDialog
      altTextTarget={altTextTarget}
      altTextValue={altTextValue}
      handleAltTextConfirm={handleAltTextConfirm}
      isSavingAltText={isSavingAltText}
      setAltTextTarget={setAltTextTarget}
      setAltTextValue={setAltTextValue}
    />
    <ImageLibraryRenameDialog
      handleRenameConfirm={handleRenameConfirm}
      isRenaming={isRenaming}
      renameTarget={renameTarget}
      renameValue={renameValue}
      setRenameTarget={setRenameTarget}
      setRenameValue={setRenameValue}
    />
  </>
);

export default ImageLibraryDialogs;
