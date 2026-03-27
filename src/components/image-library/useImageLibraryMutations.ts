import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { toast } from "@/components/ui/use-toast";
import { isAvatarSlotSelection } from "@/components/image-library/avatar-selection";
import { getImportPermissionToastTitle, getUploadPermissionToastTitle } from "@/components/image-library/messages";
import {
  dedupeUrlsByComparableKey,
  toComparableSelectionKey,
} from "@/components/image-library/selection";
import type {
  ImageLibrarySavePayload,
  LibraryImageItem,
} from "@/components/image-library/types";
import { toEffectiveName } from "@/components/image-library/utils";
import { apiFetch } from "@/lib/api-client";
import { fileToDataUrl } from "@/lib/file-data-url";
import {
  normalizeUploadFocalCrops,
  type UploadFocalCrops,
  type UploadFocalPresetKey,
} from "@/lib/upload-focal-points";

type UseImageLibraryMutationsParams = {
  allItems: Map<string, LibraryImageItem>;
  allItemsByComparableKey: Map<string, LibraryImageItem>;
  apiBase: string;
  cropAvatar: boolean;
  cropSlot?: string;
  cropTargetFolder?: string;
  loadLibrary: () => Promise<void>;
  loadUploads: () => Promise<LibraryImageItem[]>;
  mode: "single" | "multiple";
  onOpenChange: (open: boolean) => void;
  onRequestNavigateToUploads?: () => boolean | Promise<boolean>;
  onSave: (payload: ImageLibrarySavePayload) => void;
  open: boolean;
  requestRevealUpload: (url: string, options?: { openCrop?: boolean }) => void;
  scopeUserId?: string;
  selectedUrls: string[];
  setIsCropDialogOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedUrls: Dispatch<SetStateAction<string[]>>;
  shouldAutoOpenAvatarCrop: (url: string) => boolean;
  uploadFolder?: string;
};

type UseImageLibraryMutationsResult = {
  activeFocalPreset: UploadFocalPresetKey;
  altTextTarget: LibraryImageItem | null;
  altTextValue: string;
  applyCrop: (dataUrl: string) => Promise<void>;
  beginAltTextEdit: (item: LibraryImageItem) => void;
  beginFocalPointEdit: (item: LibraryImageItem) => void;
  clearSelection: () => void;
  closeDialog: () => void;
  deleteTarget: LibraryImageItem | null;
  focalCropDraft: UploadFocalCrops;
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
  setActiveFocalPreset: Dispatch<SetStateAction<UploadFocalPresetKey>>;
  setAltTextTarget: Dispatch<SetStateAction<LibraryImageItem | null>>;
  setAltTextValue: Dispatch<SetStateAction<string>>;
  setDeleteTarget: Dispatch<SetStateAction<LibraryImageItem | null>>;
  setFocalCropDraft: Dispatch<SetStateAction<UploadFocalCrops>>;
  setFocalTarget: Dispatch<SetStateAction<LibraryImageItem | null>>;
  setRenameTarget: Dispatch<SetStateAction<LibraryImageItem | null>>;
  setRenameValue: Dispatch<SetStateAction<string>>;
  setUrlInput: Dispatch<SetStateAction<string>>;
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
  requestRevealUpload,
  scopeUserId,
  selectedUrls,
  setIsCropDialogOpen,
  setSelectedUrls,
  shouldAutoOpenAvatarCrop,
  uploadFolder,
}: UseImageLibraryMutationsParams): UseImageLibraryMutationsResult => {
  const [urlInput, setUrlInput] = useState("");
  const [renameTarget, setRenameTarget] = useState<LibraryImageItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [altTextTarget, setAltTextTarget] = useState<LibraryImageItem | null>(null);
  const [altTextValue, setAltTextValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LibraryImageItem | null>(null);
  const [focalTarget, setFocalTarget] = useState<LibraryImageItem | null>(null);
  const [focalCropDraft, setFocalCropDraft] = useState<UploadFocalCrops>(() =>
    normalizeUploadFocalCrops(),
  );
  const [activeFocalPreset, setActiveFocalPreset] = useState<UploadFocalPresetKey>("card");
  const [isUploading, setIsUploading] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSavingAltText, setIsSavingAltText] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingFocal, setIsSavingFocal] = useState(false);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [isNavigatingToUploads, setIsNavigatingToUploads] = useState(false);

  useEffect(() => {
    if (!open) {
      setAltTextTarget(null);
      setAltTextValue("");
      setFocalTarget(null);
      setIsNavigatingToUploads(false);
    }
  }, [open]);

  const handleUploadFiles = useCallback(
    async (files: File[] | FileList | null | undefined) => {
      if (!files || files.length === 0) {
        return;
      }
      const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
      if (list.length === 0) {
        toast({ title: "Envie apenas arquivos de imagem." });
        return;
      }
      setIsUploading(true);
      try {
        const uploadedUrls: string[] = [];
        for (const file of list) {
          const dataUrl = await fileToDataUrl(file);
          const response = await apiFetch(apiBase, "/api/uploads/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            auth: true,
            body: JSON.stringify({
              dataUrl,
              filename: file.name,
              folder: uploadFolder || undefined,
              scopeUserId: scopeUserId || undefined,
            }),
          });
          if (!response.ok) {
            if (response.status === 403) {
              toast({ title: getUploadPermissionToastTitle() });
              return;
            }
            throw new Error("upload_failed");
          }
          const data = await response.json();
          const url = String(data.url || "");
          if (url) {
            uploadedUrls.push(url);
          }
        }
        await loadUploads();
        if (uploadedUrls.length > 0) {
          const lastUploadedUrl = uploadedUrls[uploadedUrls.length - 1] || "";
          if (mode === "multiple") {
            setSelectedUrls((prev) => {
              const next = [...prev];
              uploadedUrls.forEach((url) => {
                if (!next.includes(url)) {
                  next.push(url);
                }
              });
              return next;
            });
          } else {
            setSelectedUrls([lastUploadedUrl]);
          }
          if (lastUploadedUrl) {
            requestRevealUpload(lastUploadedUrl, {
              openCrop: cropAvatar && mode === "single" && shouldAutoOpenAvatarCrop(lastUploadedUrl),
            });
          }
          toast({
            title:
              uploadedUrls.length === 1 ? "Imagem enviada" : `${uploadedUrls.length} imagens enviadas`,
            description:
              uploadedUrls.length === 1
                ? "Upload concluído com sucesso."
                : "Os uploads foram concluídos com sucesso.",
            intent: "success",
          });
        }
      } catch {
        toast({ title: "Não foi possível enviar a imagem." });
      } finally {
        setIsUploading(false);
      }
    },
    [
      apiBase,
      cropAvatar,
      loadUploads,
      mode,
      requestRevealUpload,
      scopeUserId,
      shouldAutoOpenAvatarCrop,
      uploadFolder,
      setSelectedUrls,
    ],
  );

  const handleImportFromUrl = useCallback(async () => {
    const value = urlInput.trim();
    if (!value) {
      return;
    }
    setIsUploading(true);
    try {
      const response = await apiFetch(apiBase, "/api/uploads/image-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({
          url: value,
          folder: uploadFolder || undefined,
          scopeUserId: scopeUserId || undefined,
        }),
      });
      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: getImportPermissionToastTitle() });
          return;
        }
        toast({ title: "Não foi possível importar a imagem por URL." });
        return;
      }
      const data = await response.json();
      const createdUrl = String(data.url || "");
      setUrlInput("");
      await loadUploads();
      if (!createdUrl) {
        return;
      }
      if (mode === "multiple") {
        setSelectedUrls((prev) => (prev.includes(createdUrl) ? prev : [...prev, createdUrl]));
      } else {
        setSelectedUrls([createdUrl]);
      }
      requestRevealUpload(createdUrl, {
        openCrop: cropAvatar && mode === "single" && shouldAutoOpenAvatarCrop(createdUrl),
      });
      toast({
        title: "Imagem importada",
        description: "A imagem foi importada por URL com sucesso.",
        intent: "success",
      });
    } finally {
      setIsUploading(false);
    }
  }, [
    apiBase,
    cropAvatar,
    loadUploads,
    mode,
    requestRevealUpload,
    scopeUserId,
    shouldAutoOpenAvatarCrop,
    uploadFolder,
    urlInput,
    setSelectedUrls,
  ]);

  const handleDelete = useCallback(
    async (item: LibraryImageItem) => {
      if (item.source !== "upload") {
        return;
      }
      setIsDeleting(true);
      try {
        const response = await apiFetch(apiBase, "/api/uploads/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          auth: true,
          body: JSON.stringify({ url: item.url }),
        });
        if (response.status === 409) {
          toast({
            title: "Imagem em uso",
            description: "Remova referências antes de excluir.",
          });
          return;
        }
        if (!response.ok) {
          toast({ title: "Não foi possível excluir a imagem." });
          return;
        }
        const itemKey = toComparableSelectionKey(item.url);
        setSelectedUrls((prev) => prev.filter((url) => toComparableSelectionKey(url) !== itemKey));
        await loadUploads();
        toast({
          title: "Imagem excluída",
          description: "A imagem foi removida com sucesso.",
          intent: "success",
        });
      } finally {
        setIsDeleting(false);
      }
    },
    [apiBase, loadUploads, setSelectedUrls],
  );

  const handleRenameConfirm = useCallback(async () => {
    if (!renameTarget || renameTarget.source !== "upload") {
      setRenameTarget(null);
      return;
    }
    const nextName = renameValue.trim();
    if (!nextName) {
      return;
    }
    setIsRenaming(true);
    try {
      const response = await apiFetch(apiBase, "/api/uploads/rename", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({
          url: renameTarget.url,
          newName: nextName,
        }),
      });
      if (response.status === 409) {
        toast({
          title: "Conflito de nome",
          description: "Já existe um arquivo com esse nome.",
        });
        return;
      }
      if (!response.ok) {
        toast({ title: "Não foi possível renomear a imagem." });
        return;
      }
      const data = await response.json();
      const oldUrl = String(data.oldUrl || renameTarget.url);
      const newUrl = String(data.newUrl || "");
      if (newUrl) {
        const oldKey = toComparableSelectionKey(oldUrl);
        setSelectedUrls((prev) =>
          dedupeUrlsByComparableKey(
            prev.map((url) => (toComparableSelectionKey(url) === oldKey ? newUrl : url)),
          ),
        );
      }
      setRenameTarget(null);
      setRenameValue("");
      await loadLibrary();
      toast({
        title: "Imagem renomeada",
        description: "O arquivo foi renomeado com sucesso.",
        intent: "success",
      });
    } finally {
      setIsRenaming(false);
    }
  }, [apiBase, loadLibrary, renameTarget, renameValue, setSelectedUrls]);

  const beginAltTextEdit = useCallback((item: LibraryImageItem) => {
    if (item.source !== "upload" || !item.id) {
      return;
    }
    setAltTextTarget(item);
    setAltTextValue(String(item.altText || ""));
  }, []);

  const handleAltTextConfirm = useCallback(async () => {
    if (!altTextTarget?.id || altTextTarget.source !== "upload") {
      setAltTextTarget(null);
      setAltTextValue("");
      return;
    }
    setIsSavingAltText(true);
    try {
      const response = await apiFetch(
        apiBase,
        `/api/uploads/${encodeURIComponent(altTextTarget.id)}/alt-text`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          auth: true,
          body: JSON.stringify({
            altText: altTextValue,
          }),
        },
      );
      if (!response.ok) {
        toast({
          title: "Não foi possível salvar o texto alternativo.",
          variant: "destructive",
        });
        return;
      }
      setAltTextTarget(null);
      setAltTextValue("");
      await loadUploads();
      toast({
        title: "Texto alternativo atualizado",
        intent: "success",
      });
    } catch {
      toast({
        title: "Não foi possível salvar o texto alternativo.",
        variant: "destructive",
      });
    } finally {
      setIsSavingAltText(false);
    }
  }, [altTextTarget, altTextValue, apiBase, loadUploads]);

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
        requestRevealUpload(nextUrl, { openCrop: false });
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
      requestRevealUpload,
      scopeUserId,
      setIsCropDialogOpen,
      setSelectedUrls,
      uploadFolder,
    ],
  );

  const requestRename = useCallback((item: LibraryImageItem) => {
    setRenameTarget(item);
    setRenameValue(toEffectiveName(item));
  }, []);

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
