import { useCallback, useState } from "react";

import { getImportPermissionToastTitle, getUploadPermissionToastTitle } from "@/components/image-library/messages";
import { toast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";
import { fileToDataUrl } from "@/lib/file-data-url";

type UseImageLibraryUploadMutationsParams = {
  apiBase: string;
  cropAvatar: boolean;
  cropSlot?: string;
  cropTargetFolder?: string;
  loadUploads: () => Promise<unknown>;
  mode: "single" | "multiple";
  onRequestRevealUpload: (url: string, options?: { openCrop?: boolean }) => void;
  scopeUserId?: string;
  setSelectedUrls: (value: string[] | ((prev: string[]) => string[])) => void;
  shouldAutoOpenAvatarCrop: (url: string) => boolean;
  uploadFolder?: string;
};

type UseImageLibraryUploadMutationsResult = {
  handleImportFromUrl: () => Promise<void>;
  handleUploadFiles: (files: File[] | FileList | null | undefined) => Promise<void>;
  isUploading: boolean;
  setUrlInput: (value: string) => void;
  urlInput: string;
};

export const useImageLibraryUploadMutations = ({
  apiBase,
  cropAvatar,
  cropSlot,
  cropTargetFolder,
  loadUploads,
  mode,
  onRequestRevealUpload,
  scopeUserId,
  setSelectedUrls,
  shouldAutoOpenAvatarCrop,
  uploadFolder,
}: UseImageLibraryUploadMutationsParams): UseImageLibraryUploadMutationsResult => {
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

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
        if (uploadedUrls.length === 0) {
          return;
        }

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
          onRequestRevealUpload(lastUploadedUrl, {
            openCrop: cropAvatar && mode === "single" && shouldAutoOpenAvatarCrop(lastUploadedUrl),
          });
        }
        toast({
          title:
            uploadedUrls.length === 1 ? "Imagem enviada" : `${uploadedUrls.length} imagens enviadas`,
          description:
            uploadedUrls.length === 1
              ? "Upload concluído com sucesso."
              : "Os uploads concluídos com sucesso.",
          intent: "success",
        });
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
      onRequestRevealUpload,
      scopeUserId,
      setSelectedUrls,
      shouldAutoOpenAvatarCrop,
      uploadFolder,
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
      onRequestRevealUpload(createdUrl, {
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
    onRequestRevealUpload,
    scopeUserId,
    setSelectedUrls,
    shouldAutoOpenAvatarCrop,
    uploadFolder,
    urlInput,
  ]);

  return {
    handleImportFromUrl,
    handleUploadFiles,
    isUploading,
    setUrlInput,
    urlInput,
  };
};

export default useImageLibraryUploadMutations;
