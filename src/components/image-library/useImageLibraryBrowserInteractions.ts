import { useCallback, useEffect, type Dispatch, type DragEvent, type SetStateAction } from "react";

import { toComparableSelectionKey } from "@/components/image-library/selection";

type UseImageLibraryBrowserInteractionsParams = {
  allowDeselect: boolean;
  cropAvatar: boolean;
  handleUploadFiles: (files: File[] | FileList | null | undefined) => Promise<void>;
  isUploading: boolean;
  mode: "single" | "multiple";
  open: boolean;
  primarySelectedUrl: string;
  setIsCropDialogOpen: Dispatch<SetStateAction<boolean>>;
  setIsDragActive: Dispatch<SetStateAction<boolean>>;
  setSelectedUrls: Dispatch<SetStateAction<string[]>>;
};

type UseImageLibraryBrowserInteractionsResult = {
  handleDrop: (event: DragEvent<HTMLDivElement>) => void;
  setSelection: (url: string, options?: { openCrop?: boolean }) => void;
};

export const useImageLibraryBrowserInteractions = ({
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
}: UseImageLibraryBrowserInteractionsParams): UseImageLibraryBrowserInteractionsResult => {
  const setSelection = useCallback(
    (url: string, options?: { openCrop?: boolean }) => {
      let isSameSelection = false;
      const selectedKey = toComparableSelectionKey(url);
      setSelectedUrls((prev) => {
        if (mode === "multiple") {
          const hasUrl = prev.some((item) => toComparableSelectionKey(item) === selectedKey);
          if (hasUrl) {
            return prev.filter((item) => toComparableSelectionKey(item) !== selectedKey);
          }
          return [...prev, url];
        }
        isSameSelection = toComparableSelectionKey(prev[0] || "") === selectedKey;
        if (cropAvatar) {
          return [url];
        }
        if (isSameSelection) {
          return allowDeselect ? [] : prev;
        }
        return [url];
      });
      if (cropAvatar && mode === "single" && options?.openCrop) {
        setIsCropDialogOpen(true);
      }
    },
    [allowDeselect, cropAvatar, mode, setIsCropDialogOpen, setSelectedUrls],
  );

  useEffect(() => {
    if (!primarySelectedUrl) {
      setIsCropDialogOpen(false);
    }
  }, [primarySelectedUrl, setIsCropDialogOpen]);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragActive(false);
      void handleUploadFiles(event.dataTransfer?.files);
    },
    [handleUploadFiles, setIsDragActive],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      if (!open || isUploading) {
        return;
      }
      const items = Array.from(event.clipboardData?.items || []).filter((item) =>
        item.type.startsWith("image/"),
      );
      if (items.length === 0) {
        return;
      }
      const files = items.map((item) => item.getAsFile()).filter(Boolean) as File[];
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      void handleUploadFiles(files);
    },
    [handleUploadFiles, isUploading, open],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste, open]);

  return {
    handleDrop,
    setSelection,
  };
};

export default useImageLibraryBrowserInteractions;
