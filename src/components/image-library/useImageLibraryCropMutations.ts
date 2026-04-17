import { type Dispatch, type SetStateAction, useCallback, useState } from "react";

import { isAvatarSlotSelection } from "@/components/image-library/avatar-selection";
import { getUploadPermissionToastTitle } from "@/components/image-library/messages";
import type { LibraryImageItem } from "@/components/image-library/types";
import { toast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";
import {
  normalizeUploadFocalCrops,
  type UploadFocalCrops,
  type UploadFocalPresetKey,
} from "@/lib/upload-focal-points";

type UseImageLibraryCropMutationsParams = {
  apiBase: string;
  cropAvatar: boolean;
  cropSlot?: string;
  cropTargetFolder?: string;
  loadUploads: (options?: { includeUrls?: string[] }) => Promise<unknown>;
  onRequestRevealUpload: (url: string, options?: { openCrop?: boolean }) => void;
  scopeUserId?: string;
  setIsCropDialogOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedUrls: Dispatch<SetStateAction<string[]>>;
  uploadFolder?: string;
};

type UseImageLibraryCropMutationsResult = {
  activeFocalPreset: UploadFocalPresetKey;
  applyCrop: (dataUrl: string) => Promise<void>;
  beginFocalPointEdit: (item: LibraryImageItem) => void;
  focalCropDraft: UploadFocalCrops;
  focalTarget: LibraryImageItem | null;
  isApplyingCrop: boolean;
  isSavingFocal: boolean;
  saveFocalPoint: () => Promise<void>;
  setActiveFocalPreset: Dispatch<SetStateAction<UploadFocalPresetKey>>;
  setFocalCropDraft: Dispatch<SetStateAction<UploadFocalCrops>>;
  setFocalTarget: Dispatch<SetStateAction<LibraryImageItem | null>>;
};

export const useImageLibraryCropMutations = ({
  apiBase,
  cropAvatar,
  cropSlot,
  cropTargetFolder,
  loadUploads,
  onRequestRevealUpload,
  scopeUserId,
  setIsCropDialogOpen,
  setSelectedUrls,
  uploadFolder,
}: UseImageLibraryCropMutationsParams): UseImageLibraryCropMutationsResult => {
  const [focalTarget, setFocalTarget] = useState<LibraryImageItem | null>(null);
  const [focalCropDraft, setFocalCropDraft] = useState<UploadFocalCrops>(() =>
    normalizeUploadFocalCrops(),
  );
  const [activeFocalPreset, setActiveFocalPreset] = useState<UploadFocalPresetKey>("card");
  const [isSavingFocal, setIsSavingFocal] = useState(false);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);

  const beginFocalPointEdit = useCallback((item: LibraryImageItem) => {
    if (item.source !== "upload" || !item.id) {
      return;
    }
    setFocalTarget(item);
    setFocalCropDraft(
      normalizeUploadFocalCrops(item.focalCrops, undefined, {
        sourceWidth: item.width,
        sourceHeight: item.height,
        fallbackPoints: item.focalPoints,
        fallbackPoint: item.focalPoint,
      }),
    );
    setActiveFocalPreset("card");
  }, []);

  const saveFocalPoint = useCallback(async () => {
    if (!focalTarget?.id) {
      return;
    }
    setIsSavingFocal(true);
    try {
      const response = await apiFetch(
        apiBase,
        `/api/uploads/${encodeURIComponent(focalTarget.id)}/focal-point`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          auth: true,
          body: JSON.stringify({
            focalCrops: focalCropDraft,
          }),
        },
      );
      if (!response.ok) {
        toast({
          title: "Não foi possível salvar o ponto focal.",
          variant: "destructive",
        });
        return;
      }
      setFocalTarget(null);
      await loadUploads();
      toast({
        title: "Ponto focal atualizado",
        description: "As variantes foram regeneradas com o novo enquadramento.",
        intent: "success",
      });
    } catch {
      toast({
        title: "Não foi possível salvar o ponto focal.",
        variant: "destructive",
      });
    } finally {
      setIsSavingFocal(false);
    }
  }, [apiBase, focalCropDraft, focalTarget?.id, loadUploads]);

  const applyCrop = useCallback(
    async (dataUrl: string) => {
      const nextDataUrl = dataUrl.trim();
      if (!nextDataUrl) {
        toast({
          title: "Não foi possível gerar a imagem recortada.",
          description: "Tente novamente em alguns instantes.",
        });
        return;
      }
      const normalizedCropSlot = String(cropSlot || "").trim();
      if (cropAvatar && !normalizedCropSlot) {
        toast({ title: "Preencha o ID do usuário antes de aplicar o recorte." });
        return;
      }
      const targetFolder = cropAvatar
        ? cropTargetFolder || "users"
        : cropTargetFolder || uploadFolder || undefined;
      const targetFilename = cropAvatar
        ? `${normalizedCropSlot}.png`
        : `avatar-crop-${Date.now()}.png`;

      setIsApplyingCrop(true);
      try {
        const response = await apiFetch(apiBase, "/api/uploads/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          auth: true,
          body: JSON.stringify({
            dataUrl: nextDataUrl,
            filename: targetFilename,
            folder: targetFolder,
            slot: cropAvatar ? normalizedCropSlot : undefined,
            scopeUserId: scopeUserId || undefined,
          }),
        });
        if (!response.ok) {
          if (response.status === 403) {
            toast({ title: getUploadPermissionToastTitle() });
            return;
          }
          throw new Error("apply_crop_upload_failed");
        }
        const data = await response.json();
        const nextUrl = String(data.url || "");
        if (!nextUrl) {
          throw new Error("apply_crop_upload_missing_url");
        }

        await loadUploads();
        setSelectedUrls([nextUrl]);
        onRequestRevealUpload(nextUrl, { openCrop: false });
        setIsCropDialogOpen(false);
        toast({
          title: "Avatar atualizado",
          description: "A imagem recortada foi aplicada com sucesso.",
          intent: "success",
        });
      } catch {
        toast({
          title: "Não foi possível gerar a imagem recortada.",
          description: "Tente novamente em alguns instantes.",
        });
      } finally {
        setIsApplyingCrop(false);
      }
    },
    [
      apiBase,
      cropAvatar,
      cropSlot,
      cropTargetFolder,
      loadUploads,
      onRequestRevealUpload,
      scopeUserId,
      setIsCropDialogOpen,
      setSelectedUrls,
      uploadFolder,
    ],
  );

  return {
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
  };
};

export default useImageLibraryCropMutations;
