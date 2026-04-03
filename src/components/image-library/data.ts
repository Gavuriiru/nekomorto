import {
  deriveUploadFocalPointsFromCrops,
  normalizeUploadFocalCrops,
} from "@/lib/upload-focal-points";
import type { LibraryImageItem } from "@/components/image-library/types";
import {
  normalizeComparableUploadUrl,
  parseUploadUrlPath,
  sanitizeUploadFolderForComparison,
} from "@/components/image-library/utils";

type UploadListResponseFile = {
  altText?: unknown;
  area?: unknown;
  canDelete?: unknown;
  createdAt?: unknown;
  fileName?: unknown;
  focalCrop?: unknown;
  focalCrops?: unknown;
  focalPoint?: unknown;
  focalPoints?: unknown;
  folder?: unknown;
  hashSha256?: unknown;
  height?: unknown;
  id?: unknown;
  inUse?: unknown;
  label?: unknown;
  mime?: unknown;
  name?: unknown;
  projectId?: unknown;
  projectTitle?: unknown;
  size?: unknown;
  slot?: unknown;
  slotManaged?: unknown;
  url?: unknown;
  variantBytes?: unknown;
  variants?: unknown;
  variantsVersion?: unknown;
  width?: unknown;
};

type ProjectImageResponseItem = {
  folder?: unknown;
  kind?: unknown;
  label?: unknown;
  projectId?: unknown;
  projectTitle?: unknown;
  url?: unknown;
};

const normalizeUnknownString = (value: unknown) =>
  typeof value === "string" ? value : undefined;

export const buildUploadsListPath = (
  folder: string,
  scopeUserId?: string,
  includeUrls: string[] = [],
) => {
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
  includeUrls.forEach((value) => {
    params.append("includeUrl", value);
  });
  const query = params.toString();
  return `/api/uploads/list${query ? `?${query}` : ""}`;
};

export const dedupeLibraryItemsByUrl = (items: LibraryImageItem[]) => {
  const unique = new Map<string, LibraryImageItem>();
  items.forEach((item) => {
    unique.set(item.url, item);
  });
  return Array.from(unique.values());
};

export const mapUploadsListFilesToLibraryItems = (files: unknown): LibraryImageItem[] =>
  (Array.isArray(files) ? files : []).flatMap((file) => {
    const candidate = file as UploadListResponseFile;
    if (!candidate?.url) {
      return [];
    }
    const focalCrops = normalizeUploadFocalCrops(candidate.focalCrops, undefined, {
      sourceWidth: typeof candidate.width === "number" ? candidate.width : null,
      sourceHeight: typeof candidate.height === "number" ? candidate.height : null,
      fallbackPoints: candidate.focalPoints,
      fallbackPoint: candidate.focalPoint,
    });
    const focalPoints = deriveUploadFocalPointsFromCrops(focalCrops);
    return [
      {
        id: typeof candidate.id === "string" ? candidate.id : null,
        source: "upload",
        url: String(candidate.url),
        name: String(candidate.name || candidate.fileName || ""),
        label: String(candidate.label || candidate.name || candidate.fileName || ""),
        folder: typeof candidate.folder === "string" ? candidate.folder : "",
        fileName:
          typeof candidate.fileName === "string"
            ? candidate.fileName
            : String(candidate.name || ""),
        mime: typeof candidate.mime === "string" ? candidate.mime : "",
        size: typeof candidate.size === "number" ? candidate.size : undefined,
        createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : undefined,
        width: typeof candidate.width === "number" ? candidate.width : null,
        height: typeof candidate.height === "number" ? candidate.height : null,
        inUse: Boolean(candidate.inUse),
        canDelete:
          typeof candidate.canDelete === "boolean" ? candidate.canDelete : !candidate.inUse,
        hashSha256: typeof candidate.hashSha256 === "string" ? candidate.hashSha256 : "",
        focalCrops,
        focalPoints,
        focalPoint: focalPoints.card,
        variantsVersion: Number.isFinite(Number(candidate.variantsVersion))
          ? Number(candidate.variantsVersion)
          : 1,
        variants:
          candidate.variants && typeof candidate.variants === "object"
            ? (candidate.variants as Record<string, unknown>)
            : {},
        variantBytes: Number.isFinite(Number(candidate.variantBytes))
          ? Number(candidate.variantBytes)
          : 0,
        area: typeof candidate.area === "string" ? candidate.area : "",
        altText: typeof candidate.altText === "string" ? candidate.altText : "",
        slot: typeof candidate.slot === "string" ? candidate.slot : undefined,
        slotManaged:
          typeof candidate.slotManaged === "boolean" ? candidate.slotManaged : undefined,
        projectId: typeof candidate.projectId === "string" ? candidate.projectId : "",
        projectTitle:
          typeof candidate.projectTitle === "string" ? candidate.projectTitle : "",
      },
    ];
  });

export const mapProjectImageItemsToLibraryItems = (
  items: unknown,
  allowedProjectImageIdSet: Set<string>,
) => {
  const mapped = (Array.isArray(items) ? items : []).map((item) => {
    const candidate = item as ProjectImageResponseItem;
    const normalizedProjectUrl = normalizeComparableUploadUrl(
      normalizeUnknownString(candidate?.url),
    );
    if (!normalizedProjectUrl.startsWith("/uploads/projects/")) {
      return null;
    }
    const parsedProjectPath = parseUploadUrlPath(normalizedProjectUrl);
    const normalizedFolder =
      sanitizeUploadFolderForComparison(normalizeUnknownString(candidate?.folder)) ||
      sanitizeUploadFolderForComparison(parsedProjectPath.folder);
    return {
      source: "project",
      url: normalizedProjectUrl,
      name: String(candidate.label || normalizedProjectUrl),
      label: String(candidate.label || normalizedProjectUrl),
      folder: normalizedFolder,
      projectId: candidate.projectId ? String(candidate.projectId) : "",
      projectTitle: candidate.projectTitle ? String(candidate.projectTitle) : "",
      kind: candidate.kind ? String(candidate.kind) : "",
      inUse: true,
      canDelete: false,
    } as LibraryImageItem;
  });

  const filtered =
    allowedProjectImageIdSet.size > 0
      ? mapped.filter(
          (item): item is LibraryImageItem =>
            item !== null &&
            Boolean(item.projectId) &&
            allowedProjectImageIdSet.has(String(item.projectId)),
        )
      : mapped.filter((item): item is LibraryImageItem => Boolean(item));

  return dedupeLibraryItemsByUrl(filtered);
};
