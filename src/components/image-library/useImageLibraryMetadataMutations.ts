import { useCallback, useState } from "react";

import type { LibraryImageItem } from "@/components/image-library/types";
import { dedupeUrlsByComparableKey, toComparableSelectionKey } from "@/components/image-library/selection";
import { toEffectiveName } from "@/components/image-library/utils";
import { toast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";

type UseImageLibraryMetadataMutationsParams = {
  apiBase: string;
  loadLibrary: () => Promise<void>;
  loadUploads: () => Promise<unknown>;
  setSelectedUrls: (value: string[] | ((prev: string[]) => string[])) => void;
};

type UseImageLibraryMetadataMutationsResult = {
  altTextTarget: LibraryImageItem | null;
  altTextValue: string;
  beginAltTextEdit: (item: LibraryImageItem) => void;
  deleteTarget: LibraryImageItem | null;
  handleAltTextConfirm: () => Promise<void>;
  handleDelete: (item: LibraryImageItem) => Promise<void>;
  handleRenameConfirm: () => Promise<void>;
  isDeleting: boolean;
  isRenaming: boolean;
  isSavingAltText: boolean;
  renameTarget: LibraryImageItem | null;
  renameValue: string;
  requestRename: (item: LibraryImageItem) => void;
  setAltTextTarget: (value: LibraryImageItem | null) => void;
  setAltTextValue: (value: string) => void;
  setDeleteTarget: (value: LibraryImageItem | null) => void;
  setRenameTarget: (value: LibraryImageItem | null) => void;
  setRenameValue: (value: string) => void;
};

export const useImageLibraryMetadataMutations = ({
  apiBase,
  loadLibrary,
  loadUploads,
  setSelectedUrls,
}: UseImageLibraryMetadataMutationsParams): UseImageLibraryMetadataMutationsResult => {
  const [renameTarget, setRenameTarget] = useState<LibraryImageItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [altTextTarget, setAltTextTarget] = useState<LibraryImageItem | null>(null);
  const [altTextValue, setAltTextValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LibraryImageItem | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSavingAltText, setIsSavingAltText] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const requestRename = useCallback((item: LibraryImageItem) => {
    setRenameTarget(item);
    setRenameValue(toEffectiveName(item));
  }, []);

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

  return {
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
  };
};

export default useImageLibraryMetadataMutations;
