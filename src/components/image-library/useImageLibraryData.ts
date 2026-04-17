import {
  buildUploadsListPath,
  dedupeLibraryItemsByUrl,
  mapProjectImageItemsToLibraryItems,
  mapUploadsListFilesToLibraryItems,
} from "@/components/image-library/data";
import { getUploadsListErrorMessage } from "@/components/image-library/messages";
import {
  buildStableUploadSelectionState,
  parseSelectionSignature,
} from "@/components/image-library/selection";
import type { LibraryImageItem } from "@/components/image-library/types";
import { dedupeUrlsByComparableKey } from "@/components/image-library/utils";
import { apiFetch } from "@/lib/api-client";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseImageLibraryDataParams = {
  allowedProjectImageIdSet: Set<string>;
  apiBase: string;
  foldersToRequest: string[];
  includeProjectImages: boolean;
  open: boolean;
  persistentIncludeUrls?: string[];
  scopeUserId?: string;
};

type UseImageLibraryDataResult = {
  isLibraryHydratedForOpen: boolean;
  isLoading: boolean;
  loadLibrary: () => Promise<void>;
  loadProjectImages: () => Promise<void>;
  loadUploads: (options?: { includeUrls?: string[] }) => Promise<LibraryImageItem[]>;
  projectImages: LibraryImageItem[];
  uploads: LibraryImageItem[];
  uploadsLoadError: string;
};

export const useImageLibraryData = ({
  allowedProjectImageIdSet,
  apiBase,
  foldersToRequest,
  includeProjectImages,
  open,
  persistentIncludeUrls,
  scopeUserId,
}: UseImageLibraryDataParams): UseImageLibraryDataResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadsLoadError, setUploadsLoadError] = useState("");
  const [uploads, setUploads] = useState<LibraryImageItem[]>([]);
  const [projectImages, setProjectImages] = useState<LibraryImageItem[]>([]);
  const [isLibraryHydratedForOpen, setIsLibraryHydratedForOpen] = useState(false);
  const stablePersistentIncludeUrlsSignature = useMemo(
    () => buildStableUploadSelectionState(persistentIncludeUrls || []).signature,
    [persistentIncludeUrls],
  );
  const stablePersistentIncludeUrls = useMemo(
    () => parseSelectionSignature(stablePersistentIncludeUrlsSignature),
    [stablePersistentIncludeUrlsSignature],
  );

  const loadUploads = useCallback(
    async ({ includeUrls = [] }: { includeUrls?: string[] } = {}): Promise<LibraryImageItem[]> => {
      const resolvedIncludeUrls = dedupeUrlsByComparableKey([
        ...stablePersistentIncludeUrls,
        ...includeUrls,
      ]);
      setIsLoading(true);
      setUploadsLoadError("");
      try {
        const responses = await Promise.all(
          foldersToRequest.map((folder) =>
            apiFetch(apiBase, buildUploadsListPath(folder, scopeUserId, resolvedIncludeUrls), {
              auth: true,
            }),
          ),
        );
        const files: LibraryImageItem[] = [];
        let successfulResponses = 0;
        let firstErrorStatus: number | null = null;
        for (const response of responses) {
          if (!response.ok) {
            if (firstErrorStatus === null) {
              firstErrorStatus = response.status;
            }
            continue;
          }
          successfulResponses += 1;
          const data = await response.json();
          files.push(...mapUploadsListFilesToLibraryItems(data.files));
        }
        if (successfulResponses === 0 && firstErrorStatus !== null) {
          setUploads([]);
          setUploadsLoadError(getUploadsListErrorMessage(firstErrorStatus));
          return [];
        }
        const nextUploads = dedupeLibraryItemsByUrl(files);
        setUploadsLoadError("");
        setUploads(nextUploads);
        return nextUploads;
      } catch {
        setUploads([]);
        setUploadsLoadError(getUploadsListErrorMessage());
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [apiBase, foldersToRequest, scopeUserId, stablePersistentIncludeUrlsSignature],
  );

  const loadProjectImages = useCallback(async () => {
    if (!includeProjectImages) {
      setProjectImages([]);
      return;
    }
    try {
      const response = await apiFetch(apiBase, "/api/uploads/project-images", { auth: true });
      if (!response.ok) {
        setProjectImages([]);
        return;
      }
      const data = await response.json();
      if (!Array.isArray(data.items)) {
        setProjectImages([]);
        return;
      }
      setProjectImages(mapProjectImageItemsToLibraryItems(data.items, allowedProjectImageIdSet));
    } catch {
      setProjectImages([]);
    }
  }, [allowedProjectImageIdSet, apiBase, includeProjectImages]);

  const loadLibrary = useCallback(async () => {
    await Promise.all([loadUploads(), loadProjectImages()]);
  }, [loadProjectImages, loadUploads]);

  useEffect(() => {
    let isActive = true;
    if (!open) {
      setIsLibraryHydratedForOpen(false);
      setUploadsLoadError("");
      return;
    }
    setIsLibraryHydratedForOpen(false);
    void (async () => {
      try {
        await loadLibrary();
      } finally {
        if (isActive) {
          setIsLibraryHydratedForOpen(true);
        }
      }
    })();
    return () => {
      isActive = false;
    };
  }, [loadLibrary, open]);

  return {
    isLibraryHydratedForOpen,
    isLoading,
    loadLibrary,
    loadProjectImages,
    loadUploads,
    projectImages,
    uploads,
    uploadsLoadError,
  };
};

export default useImageLibraryData;
