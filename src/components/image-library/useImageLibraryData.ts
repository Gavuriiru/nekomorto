import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import {
  deriveUploadFocalPointsFromCrops,
  normalizeUploadFocalCrops,
} from "@/lib/upload-focal-points";
import { getUploadsListErrorMessage } from "@/components/image-library/messages";
import type { LibraryImageItem } from "@/components/image-library/types";
import {
  normalizeComparableUploadUrl,
  parseUploadUrlPath,
  sanitizeUploadFolderForComparison,
} from "@/components/image-library/utils";

type UseImageLibraryDataParams = {
  allowedProjectImageIdSet: Set<string>;
  apiBase: string;
  foldersToRequest: string[];
  includeProjectImages: boolean;
  open: boolean;
  scopeUserId?: string;
};

type UseImageLibraryDataResult = {
  isLibraryHydratedForOpen: boolean;
  isLoading: boolean;
  loadLibrary: () => Promise<void>;
  loadProjectImages: () => Promise<void>;
  loadUploads: () => Promise<LibraryImageItem[]>;
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
  scopeUserId,
}: UseImageLibraryDataParams): UseImageLibraryDataResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadsLoadError, setUploadsLoadError] = useState("");
  const [uploads, setUploads] = useState<LibraryImageItem[]>([]);
  const [projectImages, setProjectImages] = useState<LibraryImageItem[]>([]);
  const [isLibraryHydratedForOpen, setIsLibraryHydratedForOpen] = useState(false);

  const loadUploads = useCallback(async (): Promise<LibraryImageItem[]> => {
    setIsLoading(true);
    setUploadsLoadError("");
    try {
      const responses = await Promise.all(
        foldersToRequest.map((folder) => {
          const params = new URLSearchParams();
          if (folder) {
            params.set("folder", folder);
            if (folder !== "__all__") {
              params.set("recursive", "1");
            }
          }
          if (scopeUserId) {
            params.set("scopeUserId", scopeUserId);
          }
          const query = params.toString();
          return apiFetch(apiBase, `/api/uploads/list${query ? `?${query}` : ""}`, { auth: true });
        }),
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
        if (!Array.isArray(data.files)) {
          continue;
        }
        for (const file of data.files) {
          if (!file?.url) {
            continue;
          }
          const focalCrops = normalizeUploadFocalCrops(file.focalCrops, undefined, {
            sourceWidth: typeof file.width === "number" ? file.width : null,
            sourceHeight: typeof file.height === "number" ? file.height : null,
            fallbackPoints: file.focalPoints,
            fallbackPoint: file.focalPoint,
          });
          const focalPoints = deriveUploadFocalPointsFromCrops(focalCrops);
          files.push({
            id: typeof file.id === "string" ? file.id : null,
            source: "upload",
            url: String(file.url),
            name: String(file.name || file.fileName || ""),
            label: String(file.label || file.name || file.fileName || ""),
            folder: typeof file.folder === "string" ? file.folder : "",
            fileName: typeof file.fileName === "string" ? file.fileName : String(file.name || ""),
            mime: typeof file.mime === "string" ? file.mime : "",
            size: typeof file.size === "number" ? file.size : undefined,
            createdAt: typeof file.createdAt === "string" ? file.createdAt : undefined,
            width: typeof file.width === "number" ? file.width : null,
            height: typeof file.height === "number" ? file.height : null,
            inUse: Boolean(file.inUse),
            canDelete: typeof file.canDelete === "boolean" ? file.canDelete : !file.inUse,
            hashSha256: typeof file.hashSha256 === "string" ? file.hashSha256 : "",
            focalCrops,
            focalPoints,
            focalPoint: focalPoints.card,
            variantsVersion: Number.isFinite(Number(file.variantsVersion))
              ? Number(file.variantsVersion)
              : 1,
            variants: file.variants && typeof file.variants === "object" ? file.variants : {},
            variantBytes: Number.isFinite(Number(file.variantBytes))
              ? Number(file.variantBytes)
              : 0,
            area: typeof file.area === "string" ? file.area : "",
            altText: typeof file.altText === "string" ? file.altText : "",
            slot: typeof file.slot === "string" ? file.slot : undefined,
            slotManaged: typeof file.slotManaged === "boolean" ? file.slotManaged : undefined,
          });
        }
      }
      const unique = new Map<string, LibraryImageItem>();
      files.forEach((item) => {
        unique.set(item.url, item);
      });
      if (successfulResponses === 0 && firstErrorStatus !== null) {
        setUploads([]);
        setUploadsLoadError(getUploadsListErrorMessage(firstErrorStatus));
        return [];
      }
      const nextUploads = Array.from(unique.values());
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
  }, [apiBase, foldersToRequest, scopeUserId]);

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
      const mapped = data.items.map(
        (item: {
          folder?: string;
          kind?: string;
          label?: string;
          projectId?: string;
          projectTitle?: string;
          source?: string;
          url: string;
        }) => {
          const normalizedProjectUrl = normalizeComparableUploadUrl(item?.url);
          if (!normalizedProjectUrl.startsWith("/uploads/projects/")) {
            return null;
          }
          const parsedProjectPath = parseUploadUrlPath(normalizedProjectUrl);
          const normalizedFolder =
            sanitizeUploadFolderForComparison(item?.folder) ||
            sanitizeUploadFolderForComparison(parsedProjectPath.folder);
          return {
            source: "project",
            url: normalizedProjectUrl,
            name: String(item.label || normalizedProjectUrl),
            label: String(item.label || normalizedProjectUrl),
            folder: normalizedFolder,
            projectId: item.projectId ? String(item.projectId) : "",
            projectTitle: item.projectTitle ? String(item.projectTitle) : "",
            kind: item.kind ? String(item.kind) : "",
            inUse: true,
            canDelete: false,
          } as LibraryImageItem;
        },
      );
      const filtered =
        allowedProjectImageIdSet.size > 0
          ? mapped.filter(
              (item): item is LibraryImageItem =>
                Boolean(item?.projectId) && allowedProjectImageIdSet.has(String(item.projectId)),
            )
          : mapped.filter((item): item is LibraryImageItem => Boolean(item));
      const unique = new Map<string, LibraryImageItem>();
      filtered.forEach((item) => {
        unique.set(item.url, item);
      });
      setProjectImages(Array.from(unique.values()));
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
