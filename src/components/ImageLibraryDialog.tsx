import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import { CircleStencil, FixedCropper, type FixedCropperRef } from "react-advanced-cropper";
import { drawCroppedArea, ImageRestriction } from "advanced-cropper";
import "react-advanced-cropper/dist/style.css";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  ImageLibraryDialogLoadingGrid,
} from "@/components/ImageLibraryDialogLoading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Search } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import {
  computeUploadContainFitRect,
  UPLOAD_FOCAL_PRESET_KEYS,
  UPLOAD_VARIANT_PRESET_DIMENSIONS,
  deriveUploadFocalPointsFromCrops,
  normalizeUploadFocalCropRect,
  normalizeUploadFocalCrops,
  type UploadFocalPresetKey,
  type UploadFocalCropRect,
  type UploadFocalCrops,
  type UploadFocalPoints,
} from "@/lib/upload-focal-points";

export type LibraryImageSource = "upload" | "project";

export type LibraryImageItem = {
  id?: string | null;
  name: string;
  url: string;
  source: LibraryImageSource;
  label?: string;
  folder?: string;
  fileName?: string;
  mime?: string;
  size?: number;
  createdAt?: string;
  width?: number | null;
  height?: number | null;
  inUse?: boolean;
  canDelete?: boolean;
  projectId?: string;
  projectTitle?: string;
  kind?: string;
  hashSha256?: string;
  focalCrops?: UploadFocalCrops;
  focalPoints?: UploadFocalPoints;
  focalPoint?: { x: number; y: number };
  variantsVersion?: number;
  variants?: Record<string, unknown>;
  variantBytes?: number;
  area?: string;
  altText?: string;
  slot?: string;
  slotManaged?: boolean;
};

export type ImageLibrarySavePayload = {
  urls: string[];
  items: LibraryImageItem[];
};

export type ImageLibraryOptions = {
  uploadFolder?: string;
  listFolders?: string[];
  listAll?: boolean;
  includeProjectImages?: boolean;
  projectImageProjectIds?: string[];
  projectImagesView?: "flat" | "by-project";
  currentSelectionUrls?: string[];
  scopeUserId?: string;
};

type ImageLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBase: string;
  title?: string;
  description?: string;
  uploadFolder?: string;
  listFolders?: string[];
  listAll?: boolean;
  includeProjectImages?: boolean;
  projectImageProjectIds?: string[];
  mode?: "single" | "multiple";
  allowDeselect?: boolean;
  showUrlImport?: boolean;
  currentSelectionUrls?: string[];
  currentSelectionUrl?: string;
  projectImagesView?: "flat" | "by-project";
  cropAvatar?: boolean;
  cropTargetFolder?: string;
  cropSlot?: string;
  scopeUserId?: string;
  allowUploadManagementActions?: boolean;
  onSave: (payload: ImageLibrarySavePayload) => void;
};

const CROPPER_BOUNDARY_SIZE = 320;
const CROPPER_OUTPUT_SIZE = 512;
type AvatarCropperHandle = Pick<FixedCropperRef, "getCoordinates" | "getImage" | "getState">;

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });

const loadAvatarCropSourceImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const handleLoad = () => {
      image.onload = null;
      image.onerror = null;
      resolve(image);
    };
    const handleError = () => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("cropper_image_load_failed"));
    };
    image.onload = handleLoad;
    image.onerror = handleError;
    image.src = src;
  });

export const resolveAvatarCropStencilSize = (state?: {
  boundary?: { width?: number; height?: number };
}) => {
  const boundaryWidth = Number(state?.boundary?.width);
  const boundaryHeight = Number(state?.boundary?.height);
  const size = Math.max(
    1,
    Math.min(
      CROPPER_BOUNDARY_SIZE,
      Number.isFinite(boundaryWidth) && boundaryWidth > 0 ? boundaryWidth : CROPPER_BOUNDARY_SIZE,
      Number.isFinite(boundaryHeight) && boundaryHeight > 0
        ? boundaryHeight
        : CROPPER_BOUNDARY_SIZE,
    ),
  );
  return {
    width: size,
    height: size,
  };
};

export const renderAvatarCropDataUrl = async (
  cropper: AvatarCropperHandle | null,
  fallbackSrc = "",
) => {
  const state = cropper?.getState();
  const coordinates = cropper?.getCoordinates();
  const cropperImage = cropper?.getImage();
  const imageSrc = String(cropperImage?.src || fallbackSrc || "").trim();
  if (!state || !coordinates || !cropperImage || !imageSrc) {
    throw new Error("cropper_state_unavailable");
  }
  if (coordinates.width <= 0 || coordinates.height <= 0) {
    throw new Error("cropper_coordinates_invalid");
  }
  const sourceImage = await loadAvatarCropSourceImage(imageSrc);
  const resultCanvas = document.createElement("canvas");
  const spareCanvas = document.createElement("canvas");
  const renderedCanvas = drawCroppedArea(
    {
      ...state,
      coordinates,
      transforms: state.transforms || cropperImage.transforms,
    },
    sourceImage,
    resultCanvas,
    spareCanvas,
    {
      width: CROPPER_OUTPUT_SIZE,
      height: CROPPER_OUTPUT_SIZE,
      fillColor: "transparent",
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    },
  );
  const normalizedDataUrl = String(renderedCanvas?.toDataURL("image/png") || "").trim();
  if (!normalizedDataUrl) {
    throw new Error("empty_crop_result");
  }
  return normalizedDataUrl;
};

const toEffectiveName = (item: LibraryImageItem) =>
  item.name || item.fileName || item.label || "Imagem";

const stripUrlQueryAndHash = (value: string) => value.split(/[?#]/)[0] || "";

const normalizeComparableUploadUrl = (value: string | null | undefined) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("/uploads/")) {
    return stripUrlQueryAndHash(trimmed);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // Ignore invalid absolute URLs and keep original value.
  }
  return trimmed;
};

const sanitizeUploadFolderForComparison = (value: string | null | undefined) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value
    .trim()
    .replace(/[^a-z0-9/_-]+/gi, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
};

const sanitizeUploadSlotForComparison = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const escapeRegexPattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const AVATAR_UPLOAD_FILENAME_PATTERN = /^avatar-[a-z0-9-]+\.(png|jpe?g|gif|webp|svg)$/i;
const UPLOADER_TIMESTAMP_SUFFIX_PATTERN = /-\d{13}$/;

const getUploadsListErrorMessage = (status?: number | null) =>
  status === 403
    ? "Você não tem permissão para visualizar uploads neste contexto."
    : "Não foi possível carregar os uploads agora.";

const getUploadPermissionToastTitle = () =>
  "Você não tem permissão para enviar imagens neste contexto.";

const getImportPermissionToastTitle = () =>
  "Você não tem permissão para importar imagens neste contexto.";

const toLibraryItemRenderVersion = (item: LibraryImageItem) => {
  const variantVersion = Number(item.variantsVersion);
  if (Number.isFinite(variantVersion) && variantVersion > 0) {
    return `variant-${variantVersion}`;
  }
  const createdAt = String(item.createdAt || "").trim();
  if (!createdAt) {
    return "variant-1";
  }
  const createdAtTimestamp = new Date(createdAt).getTime();
  if (Number.isFinite(createdAtTimestamp) && createdAtTimestamp > 0) {
    return `created-${createdAtTimestamp}`;
  }
  return `created-${createdAt}`;
};

const appendRenderVersionToUrl = (value: string, version: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed || !version) {
    return trimmed;
  }
  try {
    const isRelativeUrl = trimmed.startsWith("/");
    const parsed = isRelativeUrl ? new URL(trimmed, "http://localhost") : new URL(trimmed);
    parsed.searchParams.set("v", version);
    if (isRelativeUrl) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    const [withoutHash, hashFragment = ""] = trimmed.split("#", 2);
    const [basePath, search = ""] = withoutHash.split("?", 2);
    const params = new URLSearchParams(search);
    params.set("v", version);
    const nextSearch = params.toString();
    return `${basePath}${nextSearch ? `?${nextSearch}` : ""}${hashFragment ? `#${hashFragment}` : ""}`;
  }
};

const toLibraryItemRenderUrl = (item: LibraryImageItem) => {
  if (item.source !== "upload") {
    return item.url;
  }
  return appendRenderVersionToUrl(item.url, toLibraryItemRenderVersion(item));
};

const getUploadRootSegment = (value: string | null | undefined) => {
  const normalizedFolder = sanitizeUploadFolderForComparison(value);
  return String(normalizedFolder.split("/")[0] || "").toLowerCase();
};

const parseUploadUrlPath = (value: string | null | undefined) => {
  const normalizedUrl = normalizeComparableUploadUrl(value);
  if (!normalizedUrl.startsWith("/uploads/")) {
    return { folder: "", fileName: "" };
  }
  const relativePath = normalizedUrl.replace(/^\/uploads\//, "");
  const segments = relativePath.split("/").filter(Boolean);
  const fileName = segments.length > 0 ? segments[segments.length - 1] : "";
  const folder = segments.length > 1 ? segments.slice(0, -1).join("/") : "";
  return { folder, fileName };
};

const resolveItemFolder = (item: LibraryImageItem) => {
  const explicitFolder = sanitizeUploadFolderForComparison(item.folder);
  if (explicitFolder) {
    return explicitFolder;
  }
  return sanitizeUploadFolderForComparison(parseUploadUrlPath(item.url).folder);
};

const isFolderWithinSelection = ({
  itemFolder,
  selectedFolder,
}: {
  itemFolder: string | null | undefined;
  selectedFolder: string | null | undefined;
}) => {
  const normalizedItem = sanitizeUploadFolderForComparison(itemFolder);
  const normalizedSelected = sanitizeUploadFolderForComparison(selectedFolder);
  if (!normalizedSelected) {
    return normalizedItem === "";
  }
  return (
    normalizedItem === normalizedSelected || normalizedItem.startsWith(`${normalizedSelected}/`)
  );
};

const listFolderAncestors = (value: string | null | undefined) => {
  const normalized = sanitizeUploadFolderForComparison(value);
  if (!normalized) {
    return [] as string[];
  }
  const segments = normalized.split("/").filter(Boolean);
  const ancestors: string[] = [];
  for (let index = 1; index <= segments.length; index += 1) {
    ancestors.push(segments.slice(0, index).join("/"));
  }
  return ancestors;
};

const listFolderSelfAndAncestors = (value: string | null | undefined) => {
  const ancestors = listFolderAncestors(value);
  if (ancestors.length === 0) {
    return [] as string[];
  }
  return [...ancestors].reverse();
};

const resolveProjectRootFromFolder = (folder: string) => {
  const normalized = sanitizeUploadFolderForComparison(folder);
  if (!normalized.startsWith("projects/")) {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 2) {
    return "";
  }
  return `${segments[0]}/${segments[1]}`;
};

const toRelativeProjectFolderLabel = ({
  folder,
  projectRoot,
}: {
  folder: string;
  projectRoot: string;
}) => {
  const normalizedFolder = sanitizeUploadFolderForComparison(folder);
  const normalizedRoot = sanitizeUploadFolderForComparison(projectRoot);
  if (!normalizedFolder) {
    return "Sem pasta";
  }
  if (!normalizedRoot) {
    return normalizedFolder;
  }
  if (normalizedFolder === normalizedRoot) {
    return "Raiz do projeto";
  }
  if (normalizedFolder.startsWith(`${normalizedRoot}/`)) {
    return normalizedFolder.slice(normalizedRoot.length + 1);
  }
  return normalizedFolder;
};

const compareProjectFolderGroupsRootFirst = <T extends { folder: string; title: string }>(
  left: T,
  right: T,
) => {
  const leftFolder = sanitizeUploadFolderForComparison(left.folder);
  const rightFolder = sanitizeUploadFolderForComparison(right.folder);
  const leftProjectRoot = resolveProjectRootFromFolder(leftFolder);
  const rightProjectRoot = resolveProjectRootFromFolder(rightFolder);

  if (leftProjectRoot && leftProjectRoot === rightProjectRoot) {
    const leftIsProjectRoot = leftFolder === leftProjectRoot;
    const rightIsProjectRoot = rightFolder === rightProjectRoot;
    if (leftIsProjectRoot !== rightIsProjectRoot) {
      return leftIsProjectRoot ? -1 : 1;
    }
  }

  const titleComparison = left.title.localeCompare(right.title, "pt-BR");
  if (titleComparison !== 0) {
    return titleComparison;
  }
  return leftFolder.localeCompare(rightFolder, "pt-BR");
};

const resolveContextProjectIdFromFolder = (folder: string | null | undefined) => {
  const normalized = sanitizeUploadFolderForComparison(folder);
  if (!normalized.startsWith("projects/")) {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 2) {
    return "";
  }
  return String(segments[1] || "").trim();
};

const resolveClosestFolderGroupKey = <T extends { key: string; folder: string }>(
  groups: T[],
  contextFolder: string | null | undefined,
) => {
  const candidates = listFolderSelfAndAncestors(contextFolder);
  if (candidates.length === 0) {
    return "";
  }
  const groupsByFolder = new Map<string, string>();
  groups.forEach((group) => {
    const normalizedFolder = sanitizeUploadFolderForComparison(group.folder);
    if (!normalizedFolder || groupsByFolder.has(normalizedFolder)) {
      return;
    }
    groupsByFolder.set(normalizedFolder, group.key);
  });
  for (const candidate of candidates) {
    const match = groupsByFolder.get(candidate);
    if (match) {
      return match;
    }
  }
  return "";
};

const isLegacyGeneratedAvatarFileName = (value: string | null | undefined) => {
  const fileName = String(value || "").trim();
  if (!AVATAR_UPLOAD_FILENAME_PATTERN.test(fileName)) {
    return false;
  }
  const stem = fileName.replace(/\.[^.]+$/, "");
  return !UPLOADER_TIMESTAMP_SUFFIX_PATTERN.test(stem);
};

const isAvatarGeneratedUsersUpload = (item: LibraryImageItem) => {
  const parsedPath = parseUploadUrlPath(item.url);
  const folder = sanitizeUploadFolderForComparison(item.folder) || parsedPath.folder;
  if (getUploadRootSegment(folder) !== "users") {
    return false;
  }
  if (typeof item.slotManaged === "boolean") {
    return item.slotManaged;
  }
  const fileName = String(item.fileName || "").trim() || parsedPath.fileName;
  return isLegacyGeneratedAvatarFileName(fileName);
};

const isAvatarSlotSelection = ({
  url,
  folder,
  slot,
}: {
  url: string;
  folder: string;
  slot: string;
}) => {
  const normalizedUrl = normalizeComparableUploadUrl(url);
  if (!normalizedUrl.startsWith("/uploads/")) {
    return false;
  }
  const safeSlot = sanitizeUploadSlotForComparison(slot);
  if (!safeSlot) {
    return false;
  }
  const safeFolder = sanitizeUploadFolderForComparison(folder);
  const relativePrefix = safeFolder ? `${safeFolder}/` : "";
  const pattern = new RegExp(
    `^/uploads/${escapeRegexPattern(relativePrefix)}${escapeRegexPattern(safeSlot)}\\.[a-z0-9]+$`,
    "i",
  );
  return pattern.test(normalizedUrl);
};

const toComparableSelectionKey = (value: string | null | undefined) => {
  const normalized = normalizeComparableUploadUrl(value);
  return normalized || String(value || "").trim();
};

const dedupeUrlsByComparableKey = (urls: string[]) => {
  const unique: string[] = [];
  const seen = new Set<string>();
  urls.forEach((url) => {
    const trimmed = String(url || "").trim();
    if (!trimmed) {
      return;
    }
    const key = toComparableSelectionKey(trimmed);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(trimmed);
  });
  return unique;
};

const areSelectionsSemanticallyEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (toComparableSelectionKey(left[index]) !== toComparableSelectionKey(right[index])) {
      return false;
    }
  }
  return true;
};

const toSelectionSignature = (urls: string[]) =>
  urls.map((url) => toComparableSelectionKey(url)).join("\u0001");

const normalizeProjectIdList = (value: unknown) => {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item ?? "").trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
};

const normalizeFolderList = (value: unknown) => {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item ?? "").trim())
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
};

const toStableProjectIdSignature = (value: unknown) => normalizeProjectIdList(value).join("\u0001");

const toStableFolderSignature = (value: unknown) => JSON.stringify(normalizeFolderList(value));

const parseStableFolderSignature = (value: string) => {
  if (!value) {
    return [] as string[];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item ?? "")) : [];
  } catch {
    return [] as string[];
  }
};

const buildSelectionSeed = ({
  currentSelectionUrls,
  currentSelectionUrl,
  mode,
}: {
  currentSelectionUrls?: string[];
  currentSelectionUrl?: string;
  mode: "single" | "multiple";
}) => {
  const fromArray =
    Array.isArray(currentSelectionUrls) && currentSelectionUrls.length > 0
      ? currentSelectionUrls
      : undefined;
  const baseUrls = fromArray ?? (currentSelectionUrl ? [currentSelectionUrl] : []);
  const deduped = dedupeUrlsByComparableKey(baseUrls);
  if (mode === "multiple") {
    return deduped;
  }
  return deduped.length > 0 ? [deduped[0]] : [];
};

type ProjectImageGroup = {
  key: string;
  projectId: string;
  title: string;
  items: LibraryImageItem[];
  folders: ProjectImageFolderGroup[];
};

type ProjectImageFolderGroup = {
  key: string;
  folder: string;
  title: string;
  items: LibraryImageItem[];
};

type UploadFolderGroup = {
  key: string;
  folder: string;
  title: string;
  items: LibraryImageItem[];
};

type AvatarCropWorkspaceProps = {
  src: string;
  isApplyingCrop: boolean;
  onCancel: () => void;
  onApplyCrop: (dataUrl: string) => Promise<void>;
};

const AvatarCropWorkspace = ({
  src,
  isApplyingCrop,
  onCancel,
  onApplyCrop,
}: AvatarCropWorkspaceProps) => {
  const cropperRef = useRef<FixedCropperRef | null>(null);
  const [isCropReady, setIsCropReady] = useState(false);
  const [cropperRevision, setCropperRevision] = useState(0);

  useEffect(() => {
    setIsCropReady(false);
  }, [cropperRevision, src]);

  const handleReset = useCallback(() => {
    setCropperRevision((prev) => prev + 1);
  }, []);

  const handleApply = useCallback(async () => {
    const cropper = cropperRef.current;
    if (!cropper || !isCropReady) {
      return;
    }

    try {
      const normalizedDataUrl = await renderAvatarCropDataUrl(cropper, src);
      await onApplyCrop(normalizedDataUrl);
    } catch {
      toast({
        title: "Não foi possível gerar a imagem recortada.",
        description: "Tente novamente em alguns instantes.",
      });
    }
  }, [isCropReady, onApplyCrop, src]);

  return (
    <>
      <div className="grid gap-4">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3">
          <p className="mb-1 text-sm font-medium text-foreground">Área de recorte</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Arraste a imagem e use scroll para ajustar o zoom.
          </p>
          <div
            className="avatar-cropper-preview relative mx-auto overflow-hidden rounded-xl bg-background/40"
            style={{ width: CROPPER_BOUNDARY_SIZE, height: CROPPER_BOUNDARY_SIZE }}
          >
            <div className="avatar-cropper-shell">
              <FixedCropper
                key={`${src}:${cropperRevision}`}
                ref={cropperRef}
                src={src}
                className="avatar-cropper-root"
                stencilComponent={CircleStencil}
                stencilSize={(state) => resolveAvatarCropStencilSize(state)}
                imageRestriction={ImageRestriction.stencil}
                transformImage={{ adjustStencil: false }}
                transitions={false}
                onReady={() => setIsCropReady(true)}
                onError={() => {
                  setIsCropReady(false);
                  toast({
                    title: "Não foi possível carregar a imagem para recorte.",
                    description: "Tente selecionar outra imagem.",
                  });
                }}
                stencilProps={{
                  movable: false,
                  resizable: false,
                  grid: false,
                  handlers: {
                    eastNorth: false,
                    westNorth: false,
                    westSouth: false,
                    eastSouth: false,
                  },
                  lines: {
                    west: false,
                    north: false,
                    east: false,
                    south: false,
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" variant="outline" onClick={handleReset} disabled={!isCropReady}>
          Resetar
        </Button>
        <Button
          type="button"
          onClick={() => void handleApply()}
          disabled={isApplyingCrop || !isCropReady}
        >
          {isApplyingCrop ? "Aplicando..." : "Aplicar avatar"}
        </Button>
      </div>
    </>
  );
};

const buildFocalPreviewImageStyle = ({
  rect,
}: {
  rect: UploadFocalCropRect;
}) => ({
  width: `${(1 / Math.max(rect.width, Number.EPSILON)) * 100}%`,
  height: `${(1 / Math.max(rect.height, Number.EPSILON)) * 100}%`,
  left: `-${(rect.left / Math.max(rect.width, Number.EPSILON)) * 100}%`,
  top: `-${(rect.top / Math.max(rect.height, Number.EPSILON)) * 100}%`,
});

const areFocalCropRectsEqual = (left: UploadFocalCropRect, right: UploadFocalCropRect) =>
  Math.abs(left.left - right.left) < 0.0001 &&
  Math.abs(left.top - right.top) < 0.0001 &&
  Math.abs(left.width - right.width) < 0.0001 &&
  Math.abs(left.height - right.height) < 0.0001;

const MIN_FOCAL_CROP_DISPLAY_PX = 32;
const FOCAL_CROP_BORDER_OFFSET_PX = 2;
const FOCAL_CROP_HANDLE_KEYS = ["nw", "ne", "sw", "se"] as const;

type FocalCropHandle = (typeof FOCAL_CROP_HANDLE_KEYS)[number];

type FocalCropInteraction =
  | {
      mode: "move";
      pointerId: number | null;
      startClientX: number;
      startClientY: number;
      startCrop: UploadFocalCropRect;
    }
  | {
      mode: "resize";
      pointerId: number | null;
      handle: FocalCropHandle;
      startCrop: UploadFocalCropRect;
    };

const getFocalCropHandleStyle = (handle: FocalCropHandle): CSSProperties => {
  if (handle === "nw") {
    return {
      left: -FOCAL_CROP_BORDER_OFFSET_PX,
      top: -FOCAL_CROP_BORDER_OFFSET_PX,
      cursor: "nwse-resize",
      transform: "translate(-50%, -50%)",
    };
  }
  if (handle === "ne") {
    return {
      right: -FOCAL_CROP_BORDER_OFFSET_PX,
      top: -FOCAL_CROP_BORDER_OFFSET_PX,
      cursor: "nesw-resize",
      transform: "translate(50%, -50%)",
    };
  }
  if (handle === "sw") {
    return {
      left: -FOCAL_CROP_BORDER_OFFSET_PX,
      bottom: -FOCAL_CROP_BORDER_OFFSET_PX,
      cursor: "nesw-resize",
      transform: "translate(-50%, 50%)",
    };
  }
  return {
    right: -FOCAL_CROP_BORDER_OFFSET_PX,
    bottom: -FOCAL_CROP_BORDER_OFFSET_PX,
    cursor: "nwse-resize",
    transform: "translate(50%, 50%)",
  };
};

type FocalPointWorkspaceProps = {
  item: LibraryImageItem;
  renderUrl: string;
  draft: UploadFocalCrops;
  activePreset: UploadFocalPresetKey;
  onDraftChange: (next: UploadFocalCrops) => void;
  onActivePresetChange: (preset: UploadFocalPresetKey) => void;
};

const FocalPointWorkspace = ({
  item,
  renderUrl,
  draft,
  activePreset,
  onDraftChange,
  onActivePresetChange,
}: FocalPointWorkspaceProps) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState(() => ({
    width: typeof item.width === "number" ? Math.max(0, item.width) : 0,
    height: typeof item.height === "number" ? Math.max(0, item.height) : 0,
  }));
  const [interaction, setInteraction] = useState<FocalCropInteraction | null>(null);
  const activeCrop = draft[activePreset];
  const activePresetDimensions = UPLOAD_VARIANT_PRESET_DIMENSIONS[activePreset];
  const activeAspectRatio = activePresetDimensions.width / activePresetDimensions.height;

  const syncStageMetrics = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    const frameRect = frame.getBoundingClientRect();
    const nextSize = {
      width: Math.max(0, frameRect.width),
      height: Math.max(0, frameRect.height),
    };
    setStageSize((prev) =>
      prev.width === nextSize.width && prev.height === nextSize.height
        ? prev
        : nextSize,
    );
  }, []);

  const handleImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      const naturalWidth = Number(image.naturalWidth || 0);
      const naturalHeight = Number(image.naturalHeight || 0);
      if (naturalWidth > 0 && naturalHeight > 0) {
        setNaturalSize((prev) =>
          prev.width === naturalWidth && prev.height === naturalHeight
            ? prev
            : { width: naturalWidth, height: naturalHeight },
        );
      }
      syncStageMetrics();
    },
    [syncStageMetrics],
  );

  useEffect(() => {
    setNaturalSize({
      width: typeof item.width === "number" ? Math.max(0, item.width) : 0,
      height: typeof item.height === "number" ? Math.max(0, item.height) : 0,
    });
  }, [item.height, item.width, renderUrl]);

  useEffect(() => {
    setInteraction(null);
  }, [activePreset, renderUrl]);

  useEffect(() => {
    const frame = frameRef.current;
    const rafId = window.requestAnimationFrame(() => {
      syncStageMetrics();
    });
    if (!frame) {
      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => {
        syncStageMetrics();
      });
      observer.observe(frame);
      return () => {
        window.cancelAnimationFrame(rafId);
        observer.disconnect();
      };
    }

    window.addEventListener("resize", syncStageMetrics);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", syncStageMetrics);
    };
  }, [renderUrl, syncStageMetrics]);

  const updateActivePresetCrop = useCallback(
    (nextCrop: UploadFocalCropRect) => {
      const normalizedCrop = normalizeUploadFocalCropRect(nextCrop, draft[activePreset]);
      if (areFocalCropRectsEqual(draft[activePreset], normalizedCrop)) {
        return;
      }
      onDraftChange({
        ...draft,
        [activePreset]: normalizedCrop,
      });
    },
    [activePreset, draft, onDraftChange],
  );

  const sourceWidth = naturalSize.width > 0 ? naturalSize.width : 1;
  const sourceHeight = naturalSize.height > 0 ? naturalSize.height : 1;
  const fitRect = useMemo(
    () =>
      computeUploadContainFitRect({
        stageWidth: stageSize.width,
        stageHeight: stageSize.height,
        sourceWidth,
        sourceHeight,
      }),
    [sourceHeight, sourceWidth, stageSize.height, stageSize.width],
  );

  const activeCropDisplayRect = useMemo(() => {
    if (fitRect.width <= 0 || fitRect.height <= 0) {
      return null;
    }
    return {
      left: activeCrop.left * fitRect.width,
      top: activeCrop.top * fitRect.height,
      width: activeCrop.width * fitRect.width,
      height: activeCrop.height * fitRect.height,
    };
  }, [activeCrop.height, activeCrop.left, activeCrop.top, activeCrop.width, fitRect.height, fitRect.width]);

  const syncInteractionFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!interaction || fitRect.width <= 0 || fitRect.height <= 0) {
        return;
      }

      if (interaction.mode === "move") {
        const deltaXNorm = (clientX - interaction.startClientX) / fitRect.width;
        const deltaYNorm = (clientY - interaction.startClientY) / fitRect.height;
        updateActivePresetCrop({
          left: Math.min(1 - interaction.startCrop.width, Math.max(0, interaction.startCrop.left + deltaXNorm)),
          top: Math.min(1 - interaction.startCrop.height, Math.max(0, interaction.startCrop.top + deltaYNorm)),
          width: interaction.startCrop.width,
          height: interaction.startCrop.height,
        });
        return;
      }

      const frame = frameRef.current;
      if (!frame) {
        return;
      }

      const frameRect = frame.getBoundingClientRect();
      const localX = Math.min(fitRect.width, Math.max(0, clientX - frameRect.left - fitRect.left));
      const localY = Math.min(
        fitRect.height,
        Math.max(0, clientY - frameRect.top - fitRect.top),
      );
      const startLeftPx = interaction.startCrop.left * fitRect.width;
      const startTopPx = interaction.startCrop.top * fitRect.height;
      const startWidthPx = interaction.startCrop.width * fitRect.width;
      const startHeightPx = interaction.startCrop.height * fitRect.height;
      const startRightPx = startLeftPx + startWidthPx;
      const startBottomPx = startTopPx + startHeightPx;
      const anchorX =
        interaction.handle === "nw" || interaction.handle === "sw" ? startRightPx : startLeftPx;
      const anchorY =
        interaction.handle === "nw" || interaction.handle === "ne" ? startBottomPx : startTopPx;
      const maxWidthPx =
        interaction.handle === "nw" || interaction.handle === "sw" ? anchorX : fitRect.width - anchorX;
      const maxHeightPx =
        interaction.handle === "nw" || interaction.handle === "ne" ? anchorY : fitRect.height - anchorY;
      const minWidthPx = Math.min(fitRect.width, MIN_FOCAL_CROP_DISPLAY_PX);
      const minHeightPx = Math.min(fitRect.height, MIN_FOCAL_CROP_DISPLAY_PX);
      const maxAllowedWidthPx = Math.max(0, Math.min(maxWidthPx, maxHeightPx * activeAspectRatio));
      const minAllowedWidthPx = Math.min(
        maxAllowedWidthPx,
        Math.max(minWidthPx, minHeightPx * activeAspectRatio),
      );
      const rawWidthPx = Math.abs(localX - anchorX);
      const rawHeightPx = Math.abs(localY - anchorY);
      const requestedWidthPx = Math.min(rawWidthPx, rawHeightPx * activeAspectRatio, maxAllowedWidthPx);
      const nextWidthPx = Math.max(minAllowedWidthPx, requestedWidthPx);
      const nextHeightPx = nextWidthPx / activeAspectRatio;
      let nextLeftPx = anchorX;
      let nextTopPx = anchorY;

      if (interaction.handle === "nw") {
        nextLeftPx = anchorX - nextWidthPx;
        nextTopPx = anchorY - nextHeightPx;
      } else if (interaction.handle === "ne") {
        nextTopPx = anchorY - nextHeightPx;
      } else if (interaction.handle === "sw") {
        nextLeftPx = anchorX - nextWidthPx;
      }

      updateActivePresetCrop({
        left: nextLeftPx / fitRect.width,
        top: nextTopPx / fitRect.height,
        width: nextWidthPx / fitRect.width,
        height: nextHeightPx / fitRect.height,
      });
    },
    [activeAspectRatio, fitRect.height, fitRect.left, fitRect.top, fitRect.width, interaction, updateActivePresetCrop],
  );

  const handleStagePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        !interaction ||
        (interaction.pointerId !== null &&
          event.pointerId > 0 &&
          event.pointerId !== interaction.pointerId)
      ) {
        return;
      }
      event.preventDefault();
      syncInteractionFromPointer(event.clientX, event.clientY);
    },
    [interaction, syncInteractionFromPointer],
  );

  const handleStagePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        !interaction ||
        (interaction.pointerId !== null &&
          event.pointerId > 0 &&
          event.pointerId !== interaction.pointerId)
      ) {
        return;
      }
      event.preventDefault();
      const frame = frameRef.current;
      if (frame && interaction.pointerId !== null && interaction.pointerId > 0) {
        try {
          frame.releasePointerCapture(interaction.pointerId);
        } catch {
          // Ignore unsupported pointer-capture environments.
        }
      }
      setInteraction(null);
    },
    [interaction],
  );

  const beginMoveInteraction = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (fitRect.width <= 0 || fitRect.height <= 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const frame = frameRef.current;
      if (frame && event.pointerId > 0) {
        try {
          frame.setPointerCapture(event.pointerId);
        } catch {
          // Ignore unsupported pointer-capture environments.
        }
      }
      setInteraction({
        mode: "move",
        pointerId: event.pointerId > 0 ? event.pointerId : null,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCrop: activeCrop,
      });
    },
    [activeCrop, fitRect.height, fitRect.width],
  );

  const beginResizeInteraction = useCallback(
    (handle: FocalCropHandle, event: ReactPointerEvent<HTMLDivElement>) => {
      if (fitRect.width <= 0 || fitRect.height <= 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const frame = frameRef.current;
      if (frame && event.pointerId > 0) {
        try {
          frame.setPointerCapture(event.pointerId);
        } catch {
          // Ignore unsupported pointer-capture environments.
        }
      }
      setInteraction({
        mode: "resize",
        handle,
        pointerId: event.pointerId > 0 ? event.pointerId : null,
        startCrop: activeCrop,
      });
    },
    [activeCrop, fitRect.height, fitRect.width],
  );

  return (
    <div
      data-testid="focal-layout"
      className="grid min-h-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]"
    >
      <aside
        data-testid="focal-sidebar"
        className="flex min-h-0 flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-3"
      >
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Presets</p>
          <p className="text-xs text-muted-foreground">
            Selecione um preset para editar. OG e CARDWIDE continuam derivados de CARD.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {UPLOAD_FOCAL_PRESET_KEYS.map((preset) => {
            const dimensions = UPLOAD_VARIANT_PRESET_DIMENSIONS[preset];
            const isActive = preset === activePreset;
            return (
              <button
                key={preset}
                type="button"
                className={`w-full rounded-xl border p-2 text-left transition ${
                  isActive
                    ? "border-primary/60 bg-primary/10 ring-2 ring-primary/40"
                    : "border-border/60 bg-card/60 hover:border-primary/40"
                }`}
                onClick={() => onActivePresetChange(preset)}
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold uppercase text-foreground">{preset}</span>
                  <span>
                    {dimensions.width}x{dimensions.height}
                  </span>
                </div>
                <div
                  data-testid={`focal-preview-${preset}`}
                  className="relative overflow-hidden rounded-lg border border-border/40 bg-background/60"
                  style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
                >
                  <img
                    src={renderUrl}
                    alt=""
                    aria-hidden="true"
                    data-testid={`focal-preview-${preset}-image`}
                    className="pointer-events-none absolute max-w-none select-none"
                    style={buildFocalPreviewImageStyle({ rect: draft[preset] })}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section
        data-testid="focal-editor-panel"
        className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border/60 bg-card/60 p-3 lg:p-4"
      >
        <p className="mb-1 text-sm font-medium text-foreground">
          Preset ativo: {activePreset.toUpperCase()}
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Arraste e redimensione a caixa para definir o enquadramento final.
        </p>
        <div
          ref={frameRef}
          data-testid="focal-stage"
          className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-background/40"
          style={{ height: "min(68vh, 46rem)" }}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerEnd}
          onPointerCancel={handleStagePointerEnd}
        >
          <div
            data-testid="focal-image-shell"
            className="absolute"
            style={{
              left: `${fitRect.left}px`,
              top: `${fitRect.top}px`,
              width: `${fitRect.width}px`,
              height: `${fitRect.height}px`,
            }}
          >
            <img
              src={renderUrl}
              alt={toEffectiveName(item)}
              data-testid="focal-stage-image"
              className="pointer-events-none block h-full w-full select-none object-contain object-center"
              draggable={false}
              onLoad={handleImageLoad}
            />
            {activeCropDisplayRect ? (
              <div
                data-testid="focal-crop-body"
                className="absolute border-2 border-primary/70 bg-primary/10"
                style={{
                  left: `${activeCropDisplayRect.left}px`,
                  top: `${activeCropDisplayRect.top}px`,
                  width: `${activeCropDisplayRect.width}px`,
                  height: `${activeCropDisplayRect.height}px`,
                  cursor: interaction?.mode === "move" ? "grabbing" : "grab",
                  touchAction: "none",
                }}
                onPointerDown={beginMoveInteraction}
              >
                {FOCAL_CROP_HANDLE_KEYS.map((handle) => {
                  return (
                    <div
                      key={handle}
                      data-testid={`focal-crop-handle-${handle}`}
                      className="absolute z-10 h-4 w-4 rounded-full border-2 border-background bg-primary shadow"
                      style={{
                        ...getFocalCropHandleStyle(handle),
                        touchAction: "none",
                      }}
                      onPointerDown={(event) => beginResizeInteraction(handle, event)}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
};

const ImageLibraryDialog = ({
  open,
  onOpenChange,
  apiBase,
  title = "Biblioteca de imagens",
  description = "Selecione imagens do servidor ou dos projetos, depois confirme em Salvar.",
  uploadFolder,
  listFolders,
  listAll = true,
  includeProjectImages = false,
  projectImageProjectIds,
  mode = "single",
  allowDeselect = true,
  showUrlImport = true,
  currentSelectionUrls,
  currentSelectionUrl,
  projectImagesView = "flat",
  cropAvatar = false,
  cropTargetFolder,
  cropSlot,
  scopeUserId,
  allowUploadManagementActions = true,
  onSave,
}: ImageLibraryDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadsLoadError, setUploadsLoadError] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploads, setUploads] = useState<LibraryImageItem[]>([]);
  const [projectImages, setProjectImages] = useState<LibraryImageItem[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "oldest" | "name">("recent");
  const [uploadsFolderFilter, setUploadsFolderFilter] = useState<string>("__all__");
  const [openUploadGroupKeys, setOpenUploadGroupKeys] = useState<string[]>([]);
  const [openProjectGroupKeys, setOpenProjectGroupKeys] = useState<string[]>([]);
  const [openProjectFolderKeysByGroup, setOpenProjectFolderKeysByGroup] = useState<
    Record<string, string[]>
  >({});
  const [renameTarget, setRenameTarget] = useState<LibraryImageItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [altTextTarget, setAltTextTarget] = useState<LibraryImageItem | null>(null);
  const [altTextValue, setAltTextValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LibraryImageItem | null>(null);
  const [focalTarget, setFocalTarget] = useState<LibraryImageItem | null>(null);
  const [focalCropDraft, setFocalCropDraft] = useState<UploadFocalCrops>(() => normalizeUploadFocalCrops());
  const [activeFocalPreset, setActiveFocalPreset] = useState<UploadFocalPresetKey>("card");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSavingAltText, setIsSavingAltText] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingFocal, setIsSavingFocal] = useState(false);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [isLibraryHydratedForOpen, setIsLibraryHydratedForOpen] = useState(false);
  const [pendingRevealRequest, setPendingRevealRequest] = useState<{
    url: string;
    token: number;
    openCrop: boolean;
  } | null>(null);
  const hasInitializedUploadAccordionStateForOpenRef = useRef(false);
  const hasInitializedProjectAccordionStateForOpenRef = useRef(false);
  const revealRequestTokenRef = useRef(0);
  const uploadCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const resolvedUploadFolderForFilter = useMemo(
    () => sanitizeUploadFolderForComparison(uploadFolder),
    [uploadFolder],
  );
  const projectImageProjectIdsSignature = useMemo(
    () => toStableProjectIdSignature(projectImageProjectIds),
    [projectImageProjectIds],
  );
  const normalizedProjectImageProjectIds = useMemo(
    () => (projectImageProjectIdsSignature ? projectImageProjectIdsSignature.split("\u0001") : []),
    [projectImageProjectIdsSignature],
  );
  const resolvedContextProjectId = useMemo(() => {
    const preferredProjectId = String(normalizedProjectImageProjectIds[0] || "").trim();
    if (preferredProjectId) {
      return preferredProjectId;
    }
    return resolveContextProjectIdFromFolder(resolvedUploadFolderForFilter);
  }, [normalizedProjectImageProjectIds, resolvedUploadFolderForFilter]);
  const listFoldersSignature = useMemo(() => toStableFolderSignature(listFolders), [listFolders]);
  const normalizedListFolders = useMemo(
    () => parseStableFolderSignature(listFoldersSignature),
    [listFoldersSignature],
  );
  const allowedProjectImageIdSet = useMemo(
    () => new Set(normalizedProjectImageProjectIds),
    [normalizedProjectImageProjectIds],
  );

  const folders = useMemo(() => {
    const set = new Set<string>();
    normalizedListFolders
      .map((folder) => sanitizeUploadFolderForComparison(folder))
      .filter(Boolean)
      .forEach((folder) => set.add(folder));
    if (resolvedUploadFolderForFilter) {
      set.add(resolvedUploadFolderForFilter);
    }
    if (listAll) {
      set.add("__all__");
    }
    if (set.size === 0) {
      set.add("");
    }
    return Array.from(set);
  }, [listAll, normalizedListFolders, resolvedUploadFolderForFilter]);
  const foldersToRequest = useMemo(() => {
    const unique = Array.from(
      new Set(
        folders.map((item) => String(item || "").trim()),
      ),
    );
    return unique.filter((folder) => {
      if (!folder || folder === "__all__") {
        return true;
      }
      return !unique.some((candidate) => {
        if (!candidate || candidate === "__all__" || candidate === folder) {
          return false;
        }
        return folder.startsWith(`${candidate}/`);
      });
    });
  }, [folders]);

  const allItems = useMemo(() => {
    const map = new Map<string, LibraryImageItem>();
    uploads.forEach((item) => {
      map.set(item.url, item);
    });
    projectImages.forEach((item) => {
      if (!map.has(item.url)) {
        map.set(item.url, item);
      }
    });
    return map;
  }, [projectImages, uploads]);

  const allItemsByComparableKey = useMemo(() => {
    const map = new Map<string, LibraryImageItem>();
    allItems.forEach((item) => {
      const key = toComparableSelectionKey(item.url);
      if (!map.has(key)) {
        map.set(key, item);
      }
    });
    return map;
  }, [allItems]);

  const selectedResolvedUrlSet = useMemo(() => {
    const set = new Set<string>();
    selectedUrls.forEach((url) => {
      const trimmed = String(url || "").trim();
      if (!trimmed) {
        return;
      }
      const matchedItem =
        allItems.get(trimmed) ?? allItemsByComparableKey.get(toComparableSelectionKey(trimmed));
      if (!matchedItem?.url) {
        return;
      }
      set.add(matchedItem.url);
    });
    return set;
  }, [allItems, allItemsByComparableKey, selectedUrls]);

  const primarySelectedUrl = selectedUrls[0] || "";
  const primarySelectedItem = useMemo(() => {
    const trimmed = String(primarySelectedUrl || "").trim();
    if (!trimmed) {
      return null;
    }
    return allItems.get(trimmed) ?? allItemsByComparableKey.get(toComparableSelectionKey(trimmed)) ?? null;
  }, [allItems, allItemsByComparableKey, primarySelectedUrl]);
  const primarySelectedRenderUrl = useMemo(() => {
    if (primarySelectedItem) {
      return toLibraryItemRenderUrl(primarySelectedItem);
    }
    return primarySelectedUrl;
  }, [primarySelectedItem, primarySelectedUrl]);
  const primarySelectedRenderKey = useMemo(() => {
    if (primarySelectedItem) {
      return `${primarySelectedItem.url}:${toLibraryItemRenderVersion(primarySelectedItem)}`;
    }
    return primarySelectedRenderUrl;
  }, [primarySelectedItem, primarySelectedRenderUrl]);
  const requestRevealUpload = useCallback((url: string, options?: { openCrop?: boolean }) => {
    const trimmedUrl = String(url || "").trim();
    if (!trimmedUrl) {
      return;
    }
    revealRequestTokenRef.current += 1;
    setPendingRevealRequest({
      url: trimmedUrl,
      token: revealRequestTokenRef.current,
      openCrop: options?.openCrop === true,
    });
  }, []);
  const shouldAutoOpenAvatarCrop = useCallback(
    (url: string) => {
      if (!cropAvatar || mode !== "single") {
        return false;
      }
      const normalizedCropSlot = String(cropSlot || "").trim();
      if (!normalizedCropSlot) {
        return true;
      }
      return !isAvatarSlotSelection({
        url,
        slot: normalizedCropSlot,
        folder: cropTargetFolder || "users",
      });
    },
    [cropAvatar, cropSlot, cropTargetFolder, mode],
  );
  const setUploadCardRef = useCallback((url: string, node: HTMLButtonElement | null) => {
    const key = toComparableSelectionKey(url);
    if (!key) {
      return;
    }
    if (node) {
      uploadCardRefs.current[key] = node;
      return;
    }
    delete uploadCardRefs.current[key];
  }, []);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const sortLibraryItems = useCallback(
    (items: LibraryImageItem[]) => {
      const next = [...items];
      next.sort((left, right) => {
        if (sortMode === "name") {
          return toEffectiveName(left).localeCompare(toEffectiveName(right), "pt-BR");
        }
        const leftTs = new Date(left.createdAt || 0).getTime();
        const rightTs = new Date(right.createdAt || 0).getTime();
        const safeLeftTs = Number.isFinite(leftTs) ? leftTs : 0;
        const safeRightTs = Number.isFinite(rightTs) ? rightTs : 0;
        if (sortMode === "oldest") {
          if (safeLeftTs !== safeRightTs) {
            return safeLeftTs - safeRightTs;
          }
        } else if (safeLeftTs !== safeRightTs) {
          return safeRightTs - safeLeftTs;
        }
        return toEffectiveName(left).localeCompare(toEffectiveName(right), "pt-BR");
      });
      return next;
    },
    [sortMode],
  );

  const matchesSearch = useCallback(
    (item: LibraryImageItem) => {
      if (!normalizedSearch) {
        return true;
      }
      const haystack = [
        item.name,
        item.label,
        item.fileName,
        item.projectTitle,
        item.projectId,
        item.kind,
        item.url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    },
    [normalizedSearch],
  );

  const visibleUploads = useMemo(() => {
    if (!cropAvatar) {
      return uploads;
    }
    return uploads.filter((item) => {
      if (!isAvatarGeneratedUsersUpload(item)) {
        return true;
      }
      return selectedResolvedUrlSet.has(item.url);
    });
  }, [cropAvatar, selectedResolvedUrlSet, uploads]);

  const filteredUploads = useMemo(() => {
    const bySearch = visibleUploads.filter(matchesSearch);
    const byFolder =
      uploadsFolderFilter === "__all__"
        ? bySearch
        : bySearch.filter(
            (item) =>
              isFolderWithinSelection({
                itemFolder: resolveItemFolder(item),
                selectedFolder: uploadsFolderFilter,
              }),
          );
    return sortLibraryItems(byFolder);
  }, [matchesSearch, sortLibraryItems, uploadsFolderFilter, visibleUploads]);
  const filteredProjectImages = useMemo(
    () => sortLibraryItems(projectImages.filter(matchesSearch)),
    [matchesSearch, projectImages, sortLibraryItems],
  );
  const uploadFolderGroups = useMemo<UploadFolderGroup[]>(() => {
    const groupMap = new Map<string, LibraryImageItem[]>();
    filteredUploads.forEach((item) => {
      const folder = resolveItemFolder(item);
      const key = folder || "__sem-pasta__";
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)?.push(item);
    });

    const scopedProjectRoot = resolveProjectRootFromFolder(resolvedUploadFolderForFilter);
    return Array.from(groupMap.entries())
      .map(([key, items]) => {
        const folder = key === "__sem-pasta__" ? "" : key;
        const folderProjectRoot = resolveProjectRootFromFolder(folder);
        const projectRoot = scopedProjectRoot || folderProjectRoot;
        return {
          key: `upload-folder:${key}`,
          folder,
          title: toRelativeProjectFolderLabel({
            folder,
            projectRoot,
          }),
          items: sortLibraryItems(items),
        } satisfies UploadFolderGroup;
      })
      .sort(compareProjectFolderGroupsRootFirst);
  }, [filteredUploads, resolvedUploadFolderForFilter, sortLibraryItems]);
  const uploadFolderFilterOptions = useMemo(() => {
    const set = new Set<string>();
    normalizedListFolders.forEach((folder) => {
      listFolderAncestors(folder).forEach((candidate) => set.add(candidate));
    });
    listFolderAncestors(resolvedUploadFolderForFilter).forEach((candidate) => set.add(candidate));
    uploads.forEach((item) => {
      listFolderAncestors(resolveItemFolder(item)).forEach((candidate) => set.add(candidate));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [normalizedListFolders, resolvedUploadFolderForFilter, uploads]);
  const shouldShowAllFoldersFilterOption = useMemo(
    () => listAll || uploadFolderFilterOptions.length > 1,
    [listAll, uploadFolderFilterOptions.length],
  );
  const isUploadsFilterReadyForInitialExpansion = useMemo(() => {
    if (uploads.length === 0) {
      return true;
    }
    if (uploadsFolderFilter === "__all__") {
      return true;
    }
    if (uploadFolderFilterOptions.length === 0) {
      return false;
    }
    return uploadFolderFilterOptions.includes(uploadsFolderFilter);
  }, [uploadFolderFilterOptions, uploads, uploadsFolderFilter]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setUploadsFolderFilter(resolvedUploadFolderForFilter || "__all__");
  }, [open, resolvedUploadFolderForFilter]);

  useEffect(() => {
    const fallbackFilter = resolvedUploadFolderForFilter || uploadFolderFilterOptions[0] || "__all__";
    if (uploadsFolderFilter === "__all__") {
      if (!shouldShowAllFoldersFilterOption && fallbackFilter !== "__all__") {
        setUploadsFolderFilter(fallbackFilter);
      }
      return;
    }
    if (uploadFolderFilterOptions.length === 0) {
      if (
        !shouldShowAllFoldersFilterOption &&
        fallbackFilter !== "__all__" &&
        uploadsFolderFilter !== fallbackFilter
      ) {
        setUploadsFolderFilter(fallbackFilter);
      }
      return;
    }
    if (!uploadFolderFilterOptions.includes(uploadsFolderFilter)) {
      setUploadsFolderFilter(shouldShowAllFoldersFilterOption ? "__all__" : fallbackFilter);
    }
  }, [
    resolvedUploadFolderForFilter,
    shouldShowAllFoldersFilterOption,
    uploadFolderFilterOptions,
    uploadsFolderFilter,
  ]);

  const selectionSeed = useMemo(
    () =>
      buildSelectionSeed({
        currentSelectionUrls,
        currentSelectionUrl,
        mode,
      }),
    [currentSelectionUrl, currentSelectionUrls, mode],
  );
  const selectionSeedSignature = useMemo(
    () => toSelectionSignature(selectionSeed),
    [selectionSeed],
  );
  const selectionSeedRef = useRef<string[]>(selectionSeed);

  useEffect(() => {
    selectionSeedRef.current = selectionSeed;
  }, [selectionSeed, selectionSeedSignature]);

  const reconcileSelectionWithLibrary = useCallback(
    (urls: string[]) => {
      const reconciled: string[] = [];
      const seen = new Set<string>();
      urls.forEach((url) => {
        const trimmed = String(url || "").trim();
        if (!trimmed) {
          return;
        }
        const matched =
          allItems.get(trimmed) ?? allItemsByComparableKey.get(toComparableSelectionKey(trimmed));
        if (!matched) {
          return;
        }
        const matchedKey = toComparableSelectionKey(matched.url);
        if (seen.has(matchedKey)) {
          return;
        }
        seen.add(matchedKey);
        reconciled.push(matched.url);
      });
      if (mode === "multiple") {
        return reconciled;
      }
      return reconciled.length > 0 ? [reconciled[0]] : [];
    },
    [allItems, allItemsByComparableKey, mode],
  );

  const projectImageGroups = useMemo<ProjectImageGroup[]>(() => {
    const groupMap = new Map<
      string,
      ProjectImageGroup & { folderMap: Map<string, ProjectImageFolderGroup>; rootCandidates: string[] }
    >();
    filteredProjectImages.forEach((item) => {
      const projectId = String(item.projectId || "").trim();
      const projectTitle = String(item.projectTitle || "").trim();
      const key = projectId
        ? `project:${projectId}`
        : projectTitle
          ? `title:${projectTitle.toLowerCase()}`
          : "__no-project__";
      const title = projectTitle || (projectId ? `Projeto ${projectId}` : "Sem projeto");
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          projectId,
          title,
          items: [],
          folders: [],
          folderMap: new Map<string, ProjectImageFolderGroup>(),
          rootCandidates: [],
        });
      }
      const group = groupMap.get(key);
      if (!group) {
        return;
      }
      group.items.push(item);
      const resolvedFolder = resolveItemFolder(item);
      const folderKey = resolvedFolder || "__sem-pasta__";
      if (!group.folderMap.has(folderKey)) {
        group.folderMap.set(folderKey, {
          key: `${key}:folder:${folderKey}`,
          folder: resolvedFolder,
          title: resolvedFolder || "Sem pasta",
          items: [],
        });
      }
      group.folderMap.get(folderKey)?.items.push(item);
      const projectRootCandidate = resolveProjectRootFromFolder(resolvedFolder);
      if (projectRootCandidate) {
        group.rootCandidates.push(projectRootCandidate);
      }
    });
    return Array.from(groupMap.values())
      .map((group) => {
        const rootCounts = new Map<string, number>();
        group.rootCandidates
          .map((candidate) => candidate.trim())
          .filter(Boolean)
          .forEach((candidate) => {
            rootCounts.set(candidate, (rootCounts.get(candidate) || 0) + 1);
          });
        let projectRoot = "";
        let projectRootCount = 0;
        rootCounts.forEach((count, candidate) => {
          if (count > projectRootCount) {
            projectRoot = candidate;
            projectRootCount = count;
          }
        });
        const folders = Array.from(group.folderMap.values())
          .map((folderGroup) => {
            const resolvedFolder = folderGroup.items[0] ? resolveItemFolder(folderGroup.items[0]) : "";
            return {
              ...folderGroup,
              title: toRelativeProjectFolderLabel({
                folder: resolvedFolder,
                projectRoot,
              }),
            };
          })
          .sort(compareProjectFolderGroupsRootFirst);
        return {
          key: group.key,
          projectId: group.projectId,
          title: group.title,
          items: group.items,
          folders,
        } satisfies ProjectImageGroup;
      })
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  }, [filteredProjectImages]);

  const initialOpenUploadGroupKeys = useMemo(() => {
    const contextGroupKey = resolveClosestFolderGroupKey(
      uploadFolderGroups,
      resolvedUploadFolderForFilter,
    );
    return contextGroupKey ? [contextGroupKey] : [];
  }, [resolvedUploadFolderForFilter, uploadFolderGroups]);

  const initialProjectAccordionState = useMemo(() => {
    const emptyState = {
      groupKeys: [] as string[],
      folderKeysByGroup: {} as Record<string, string[]>,
    };
    if (projectImageGroups.length === 0) {
      return emptyState;
    }

    let contextGroup: ProjectImageGroup | undefined;
    if (resolvedContextProjectId) {
      contextGroup = projectImageGroups.find((group) => group.projectId === resolvedContextProjectId);
    }

    if (!contextGroup) {
      const contextRoot = resolveProjectRootFromFolder(resolvedUploadFolderForFilter);
      if (contextRoot) {
        contextGroup = projectImageGroups.find((group) =>
          group.folders.some((folderGroup) => {
            const normalizedFolder = sanitizeUploadFolderForComparison(folderGroup.folder);
            return (
              normalizedFolder === contextRoot ||
              normalizedFolder.startsWith(`${contextRoot}/`)
            );
          }),
        );
      }
    }

    if (!contextGroup) {
      return emptyState;
    }

    const contextFolderKey = resolveClosestFolderGroupKey(
      contextGroup.folders,
      resolvedUploadFolderForFilter,
    );

    return {
      groupKeys: [contextGroup.key],
      folderKeysByGroup: contextFolderKey
        ? {
            [contextGroup.key]: [contextFolderKey],
          }
        : {},
    };
  }, [projectImageGroups, resolvedContextProjectId, resolvedUploadFolderForFilter]);

  useEffect(() => {
    if (!open) {
      hasInitializedUploadAccordionStateForOpenRef.current = false;
      hasInitializedProjectAccordionStateForOpenRef.current = false;
      setOpenUploadGroupKeys([]);
      setOpenProjectGroupKeys([]);
      setOpenProjectFolderKeysByGroup({});
      setPendingRevealRequest(null);
      setUploadsLoadError("");
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!isLibraryHydratedForOpen) {
      return;
    }
    if (!isUploadsFilterReadyForInitialExpansion) {
      return;
    }
    if (hasInitializedUploadAccordionStateForOpenRef.current) {
      return;
    }
    if (uploadFolderGroups.length === 0) {
      return;
    }
    hasInitializedUploadAccordionStateForOpenRef.current = true;
    setOpenUploadGroupKeys(initialOpenUploadGroupKeys);
  }, [
    initialOpenUploadGroupKeys,
    isLibraryHydratedForOpen,
    isUploadsFilterReadyForInitialExpansion,
    open,
    uploadFolderGroups.length,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!isLibraryHydratedForOpen) {
      return;
    }
    if (projectImagesView !== "by-project") {
      return;
    }
    if (hasInitializedProjectAccordionStateForOpenRef.current) {
      return;
    }
    if (projectImageGroups.length === 0) {
      return;
    }
    hasInitializedProjectAccordionStateForOpenRef.current = true;
    setOpenProjectGroupKeys(initialProjectAccordionState.groupKeys);
    setOpenProjectFolderKeysByGroup(initialProjectAccordionState.folderKeysByGroup);
  }, [
    initialProjectAccordionState,
    isLibraryHydratedForOpen,
    open,
    projectImageGroups.length,
    projectImagesView,
  ]);

  useEffect(() => {
    if (!open || !cropAvatar || !pendingRevealRequest?.url) {
      return;
    }
    const targetKey = toComparableSelectionKey(pendingRevealRequest.url);
    const matchedUpload =
      uploads.find((item) => toComparableSelectionKey(item.url) === targetKey) ??
      allItemsByComparableKey.get(targetKey);
    if (!matchedUpload || matchedUpload.source !== "upload") {
      return;
    }
    if (normalizedSearch && !matchesSearch(matchedUpload)) {
      setSearchQuery("");
      return;
    }
    const targetFolder = resolveItemFolder(matchedUpload);
    const matchesCurrentFolderFilter =
      uploadsFolderFilter === "__all__" ||
      isFolderWithinSelection({
        itemFolder: targetFolder,
        selectedFolder: uploadsFolderFilter,
      });
    if (!matchesCurrentFolderFilter) {
      setUploadsFolderFilter(targetFolder || "__all__");
      return;
    }
    const isVisibleInFilteredUploads = filteredUploads.some(
      (item) => toComparableSelectionKey(item.url) === targetKey,
    );
    if (!isVisibleInFilteredUploads) {
      return;
    }
    const targetGroup = uploadFolderGroups.find((group) =>
      group.items.some((item) => toComparableSelectionKey(item.url) === targetKey),
    );
    if (targetGroup && !openUploadGroupKeys.includes(targetGroup.key)) {
      setOpenUploadGroupKeys([targetGroup.key]);
      return;
    }
    const targetCard = uploadCardRefs.current[targetKey];
    if (!targetCard) {
      return;
    }
    if (typeof targetCard.scrollIntoView === "function") {
      targetCard.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
    }
    if (pendingRevealRequest.openCrop && shouldAutoOpenAvatarCrop(matchedUpload.url)) {
      setIsCropDialogOpen(true);
    }
    setPendingRevealRequest(null);
  }, [
    allItemsByComparableKey,
    cropAvatar,
    filteredUploads,
    matchesSearch,
    normalizedSearch,
    open,
    openUploadGroupKeys,
    pendingRevealRequest,
    shouldAutoOpenAvatarCrop,
    uploadFolderGroups,
    uploads,
    uploadsFolderFilter,
  ]);

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
          url: string;
          label?: string;
          projectId?: string;
          projectTitle?: string;
          kind?: string;
          source?: string;
          folder?: string;
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
      filtered.forEach((item: LibraryImageItem) => {
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

  useEffect(() => {
    if (!open) {
      setIsDragActive(false);
      setAltTextTarget(null);
      setAltTextValue("");
      setFocalTarget(null);
      return;
    }
    setSelectedUrls([...selectionSeedRef.current]);
    setIsCropDialogOpen(false);
  }, [open, selectionSeedSignature]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!isLibraryHydratedForOpen) {
      return;
    }
    setSelectedUrls((prev) => {
      const reconciled = reconcileSelectionWithLibrary(prev);
      return areSelectionsSemanticallyEqual(prev, reconciled) ? prev : reconciled;
    });
  }, [isLibraryHydratedForOpen, open, reconcileSelectionWithLibrary]);

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
      if (cropAvatar && mode === "single") {
        if (options?.openCrop) {
          setIsCropDialogOpen(true);
        }
      }
    },
    [allowDeselect, cropAvatar, mode],
  );

  useEffect(() => {
    if (!primarySelectedUrl) {
      setIsCropDialogOpen(false);
    }
  }, [primarySelectedUrl]);

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
          if (cropAvatar && mode === "single" && lastUploadedUrl) {
            requestRevealUpload(lastUploadedUrl, {
              openCrop: shouldAutoOpenAvatarCrop(lastUploadedUrl),
            });
          }
          toast({
            title:
              uploadedUrls.length === 1
                ? "Imagem enviada"
                : `${uploadedUrls.length} imagens enviadas`,
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
      if (cropAvatar && mode === "single") {
        requestRevealUpload(createdUrl, {
          openCrop: shouldAutoOpenAvatarCrop(createdUrl),
        });
      }
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
  ]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    void handleUploadFiles(event.dataTransfer?.files);
  };

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
    [apiBase, loadUploads],
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
  }, [apiBase, loadLibrary, renameTarget, renameValue]);

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

  const handleSave = () => {
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
  };

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
      uploadFolder,
    ],
  );

  const renderGrid = (items: LibraryImageItem[], emptyText: string) => {
    if (isLoading) {
      return <ImageLibraryDialogLoadingGrid className="mt-3" testId="image-library-loading-grid" />;
    }
    if (items.length === 0) {
      return <p className="mt-3 text-xs text-muted-foreground">{emptyText}</p>;
    }
    return (
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const isSelected = selectedResolvedUrlSet.has(item.url);
          const itemRenderUrl = toLibraryItemRenderUrl(item);
          const canRename = allowUploadManagementActions && item.source === "upload";
          const canDelete =
            allowUploadManagementActions && item.source === "upload" && Boolean(item.canDelete);
          const canEditFocal =
            allowUploadManagementActions && item.source === "upload" && Boolean(item.id);
          const canEditAltText =
            allowUploadManagementActions && item.source === "upload" && Boolean(item.id);
          const hasManagementActions = canRename || canDelete || canEditFocal || canEditAltText;
          return (
            <ContextMenu key={`${item.source}:${item.url}`}>
              <ContextMenuTrigger asChild>
                <button
                  ref={(node) => setUploadCardRef(item.url, node)}
                  type="button"
                  className={`group overflow-hidden rounded-xl border border-border/60 bg-card/60 text-left transition hover:border-primary/40 ${
                    isSelected ? "ring-2 ring-inset ring-primary/60 border-primary/60" : ""
                  }`}
                  onClick={() =>
                    setSelection(item.url, {
                      openCrop: cropAvatar && mode === "single",
                    })
                  }
                  >
                    <img
                      src={itemRenderUrl}
                      alt={toEffectiveName(item)}
                      className="h-28 w-full object-cover"
                    />
                  <div className="p-2 text-xs text-muted-foreground line-clamp-2">
                    {item.label || toEffectiveName(item)}
                  </div>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56 z-230">
                <ContextMenuLabel>
                  {item.source === "upload" ? "Upload do servidor" : "Imagem de projeto"}
                </ContextMenuLabel>
                <ContextMenuSeparator />
                {cropAvatar && mode === "single" ? (
                  <ContextMenuItem
                    onSelect={() => {
                      setSelection(item.url, { openCrop: true });
                    }}
                  >
                    Editar avatar
                  </ContextMenuItem>
                ) : null}
                {cropAvatar && mode === "single" && hasManagementActions ? (
                  <ContextMenuSeparator />
                ) : null}
                {hasManagementActions ? (
                  <>
                    <ContextMenuItem
                      disabled={!canEditFocal}
                      onSelect={() => {
                        if (!canEditFocal) {
                          return;
                        }
                        beginFocalPointEdit(item);
                      }}
                    >
                      Definir ponto focal
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!canEditAltText}
                      onSelect={() => {
                        if (!canEditAltText) {
                          return;
                        }
                        beginAltTextEdit(item);
                      }}
                    >
                      Editar texto alternativo
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!canRename}
                      onSelect={() => {
                        if (!canRename) {
                          return;
                        }
                        setRenameTarget(item);
                        setRenameValue(toEffectiveName(item));
                      }}
                    >
                      Renomear
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!canDelete || isDeleting}
                      onSelect={() => {
                        if (!canDelete) {
                          return;
                        }
                        setDeleteTarget(item);
                      }}
                    >
                      Excluir
                    </ContextMenuItem>
                    {!canRename || !canDelete || !canEditFocal || !canEditAltText ? (
                      <>
                        <ContextMenuSeparator />
                        <ContextMenuLabel className="text-xs font-normal text-muted-foreground">
                          {item.inUse
                            ? "Exclusão bloqueada: imagem em uso."
                            : "Ações indisponíveis."}
                        </ContextMenuLabel>
                      </>
                    ) : null}
                  </>
                ) : null}
                {item.source === "project" ? (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuLabel className="text-xs font-normal text-muted-foreground">
                      Item somente leitura (projeto). Texto alternativo editável apenas em uploads.
                    </ContextMenuLabel>
                  </>
                ) : null}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
    );
  };

  const renderProjectGroups = (groups: ProjectImageGroup[], emptyText: string) => {
    if (isLoading) {
      return <ImageLibraryDialogLoadingGrid className="mt-3" testId="image-library-loading-grid" />;
    }
    if (groups.length === 0) {
      return <p className="mt-3 text-xs text-muted-foreground">{emptyText}</p>;
    }
    if (groups.some((group) => group.folders.length > 0)) {
      return (
        <Accordion
          type="multiple"
          value={openProjectGroupKeys}
          onValueChange={setOpenProjectGroupKeys}
          className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card/40 px-3"
        >
          {groups.map((group) => (
            <AccordionItem key={group.key} value={group.key} className="border-border/50">
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{group.title}</span>
                  <span className="text-xs text-muted-foreground">{group.items.length}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="[&>div]:mt-0">
                <Accordion
                  type="multiple"
                  value={openProjectFolderKeysByGroup[group.key] || []}
                  onValueChange={(nextOpenFolderKeys) =>
                    setOpenProjectFolderKeysByGroup((prev) => ({
                      ...prev,
                      [group.key]: nextOpenFolderKeys,
                    }))
                  }
                  className="rounded-lg border border-border/40 bg-background/40 px-2"
                >
                  {group.folders.map((folder) => (
                    <AccordionItem key={folder.key} value={folder.key} className="border-border/40">
                      <AccordionTrigger className="py-2 text-xs hover:no-underline">
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-foreground/90">{folder.title}</span>
                          <span className="text-[11px] text-muted-foreground">{folder.items.length}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="[&>div]:mt-0">
                        {renderGrid(folder.items, "Nenhuma imagem disponivel nesta pasta.")}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      );
    }
    return (
      <Accordion
        type="multiple"
        value={openProjectGroupKeys}
        onValueChange={setOpenProjectGroupKeys}
        className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card/40 px-3"
      >
        {groups.map((group) => (
          <AccordionItem key={group.key} value={group.key} className="border-border/50">
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2">
                <span className="font-medium text-foreground">{group.title}</span>
                <span className="text-xs text-muted-foreground">{group.items.length}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="[&>div]:mt-0">
              {renderGrid(group.items, "Nenhuma imagem disponível neste projeto.")}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  const renderUploadGroups = (groups: UploadFolderGroup[], emptyText: string) => {
    if (isLoading) {
      return <ImageLibraryDialogLoadingGrid className="mt-3" testId="image-library-loading-grid" />;
    }
    if (uploadsLoadError) {
      return (
        <p data-testid="image-library-uploads-error" className="mt-3 text-xs text-destructive">
          {uploadsLoadError}
        </p>
      );
    }
    if (groups.length === 0) {
      return <p className="mt-3 text-xs text-muted-foreground">{emptyText}</p>;
    }
    return (
      <Accordion
        type="multiple"
        value={openUploadGroupKeys}
        onValueChange={setOpenUploadGroupKeys}
        className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card/40 px-3"
      >
        {groups.map((group) => (
          <AccordionItem key={group.key} value={group.key} className="border-border/50">
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2">
                <span className="font-medium text-foreground">{group.title}</span>
                <span className="text-xs text-muted-foreground">{group.items.length}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="[&>div]:mt-0">
              {renderGrid(group.items, "Nenhuma imagem disponivel nesta pasta.")}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="z-200 flex h-[92vh] w-[96vw] max-w-5xl flex-col overflow-hidden p-3 data-[state=open]:animate-none data-[state=closed]:animate-none sm:h-[90vh] sm:w-[92vw] sm:p-6 [&>button]:hidden"
          overlayClassName="z-190 data-[state=open]:animate-none data-[state=closed]:animate-none"
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader className="space-y-1">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="text-xs leading-snug sm:text-sm">
              {description}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid gap-2 sm:gap-3 lg:grid-cols-[1.25fr_0.95fr]">
            <div
              className={`flex h-full flex-col rounded-2xl border border-dashed border-border/70 bg-card/50 p-3 text-sm text-muted-foreground transition sm:p-4 ${
                isDragActive ? "ring-2 ring-inset ring-primary/60 border-primary/60" : ""
              }`}
              aria-busy={isUploading}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragActive(true);
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragActive(false);
              }}
              onDrop={handleDrop}
            >
              <div className="flex flex-1 flex-col justify-center">
                <p className="font-medium text-foreground">
                  Arraste, cole (Ctrl+V) ou escolha arquivos
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload direto para o servidor.
                </p>
              </div>
              <div className="mt-3">
                <Input
                  type="file"
                  accept="image/*"
                  multiple={mode === "multiple"}
                  disabled={isUploading}
                  onChange={(event) => {
                    void handleUploadFiles(event.target.files);
                  }}
                />
                {isUploading ? (
                  <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Processando upload...
                  </p>
                ) : null}
              </div>
              <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
                <Label htmlFor="image-library-search-input" className="text-xs font-medium">
                  Pesquisar na biblioteca
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/80" />
                  <Input
                    id="image-library-search-input"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Pesquisar por nome, projeto ou URL..."
                    className="h-9 w-full border-border/60 bg-background/80 pl-9 text-sm transition-colors"
                  />
                </div>
              </div>
            </div>
            <div
              className="rounded-2xl border border-border/60 bg-card/70 p-3 space-y-3 sm:p-4"
              aria-busy={isUploading}
            >
              {showUrlImport ? (
                <div className="space-y-2">
                  <Label>Importar por URL</Label>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <Input
                      value={urlInput}
                      onChange={(event) => setUrlInput(event.target.value)}
                      placeholder="https://site.com/imagem.png"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 px-3"
                      onClick={() => void handleImportFromUrl()}
                      disabled={isUploading || !urlInput.trim()}
                      aria-busy={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        "Importar URL"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Importação por URL desativada.</p>
              )}
              <p className="text-xs text-muted-foreground">
                {mode === "multiple"
                  ? "Clique para alternar seleção. A ordem de clique vira a ordem de inserção."
                  : cropAvatar
                    ? "Clique na imagem para selecionar e abrir o editor de avatar."
                    : "Clique para selecionar. A imagem só será aplicada ao clicar em Salvar."}
              </p>
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-6 overflow-auto no-scrollbar sm:mt-4 sm:space-y-8">
            <div>
              <div
                data-testid="image-library-uploads-controls"
                className="mb-3 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <Select
                    value={uploadsFolderFilter}
                    onValueChange={setUploadsFolderFilter}
                  >
                    <SelectTrigger
                      aria-label="Filtrar por pasta"
                      className="h-9 min-w-0 w-full flex-1 basis-[11rem] bg-card/70 transition-[border-color,box-shadow] focus:border-primary/60 focus:ring-2 focus:ring-inset focus:ring-primary/60 focus:ring-offset-0 data-[state=open]:border-primary/60 data-[state=open]:ring-2 data-[state=open]:ring-inset data-[state=open]:ring-primary/60 data-[state=open]:ring-offset-0 sm:flex-none sm:w-[220px]"
                    >
                      <SelectValue placeholder="Todas as pastas" />
                    </SelectTrigger>
                    <SelectContent
                      align="start"
                      className="z-[210] origin-[var(--radix-select-content-transform-origin)]"
                    >
                      {shouldShowAllFoldersFilterOption ? (
                        <SelectItem value="__all__">Todas as pastas</SelectItem>
                      ) : null}
                      {uploadFolderFilterOptions.map((folder) => (
                        <SelectItem key={folder} value={folder}>
                          {folder}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={sortMode}
                    onValueChange={(value) => setSortMode(value as "recent" | "oldest" | "name")}
                  >
                    <SelectTrigger
                      aria-label="Ordenar biblioteca"
                      className="h-9 min-w-0 w-full flex-1 basis-[9.5rem] bg-card/70 transition-[border-color,box-shadow] focus:border-primary/60 focus:ring-2 focus:ring-inset focus:ring-primary/60 focus:ring-offset-0 data-[state=open]:border-primary/60 data-[state=open]:ring-2 data-[state=open]:ring-inset data-[state=open]:ring-primary/60 data-[state=open]:ring-offset-0 sm:flex-none sm:w-[180px]"
                    >
                      <SelectValue placeholder="Mais recentes" />
                    </SelectTrigger>
                    <SelectContent
                      align="start"
                      className="z-[210] origin-[var(--radix-select-content-transform-origin)]"
                    >
                      <SelectItem value="recent">Mais recentes</SelectItem>
                      <SelectItem value="oldest">Mais antigos</SelectItem>
                      <SelectItem value="name">Nome</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p
                  data-testid="image-library-selection-count"
                  className="inline-flex items-center rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  Selecionadas: {selectedUrls.length}
                </p>
              </div>
              {renderUploadGroups(
                uploadFolderGroups,
                normalizedSearch || uploadsFolderFilter !== "__all__"
                  ? "Nenhum upload corresponde aos filtros atuais."
                  : "Nenhum upload disponivel.",
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Imagens dos projetos</h3>
                <span className="text-xs text-muted-foreground">
                  Ordenação:{" "}
                  {sortMode === "recent"
                    ? "mais recentes"
                    : sortMode === "oldest"
                      ? "mais antigos"
                      : "nome"}
                </span>
              </div>
              {includeProjectImages ? (
                projectImagesView === "by-project" ? (
                  renderProjectGroups(
                    projectImageGroups,
                    normalizedSearch
                      ? "Nenhuma imagem de projeto encontrada para essa pesquisa."
                      : "Nenhuma imagem de projeto encontrada.",
                  )
                ) : (
                  renderGrid(
                    filteredProjectImages,
                    normalizedSearch
                      ? "Nenhuma imagem de projeto encontrada para essa pesquisa."
                      : "Nenhuma imagem de projeto encontrada.",
                  )
                )
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Imagens de projeto ocultas neste contexto.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
            {allowDeselect ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setSelectedUrls([])}
              >
                Limpar seleção
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCropDialogOpen}
        onOpenChange={(next) => {
          if (next) {
            setIsCropDialogOpen(true);
            return;
          }
          setIsCropDialogOpen(false);
        }}
      >
        <DialogContent
          className="max-h-[92vh] max-w-xl overflow-auto z-240 data-[state=open]:animate-none data-[state=closed]:animate-none"
          overlayClassName="z-230 data-[state=open]:animate-none data-[state=closed]:animate-none"
        >
          <DialogHeader>
            <DialogTitle>Editor de avatar</DialogTitle>
            <DialogDescription>
              Defina o enquadramento final do avatar e clique em Aplicar avatar para liberar o
              salvamento.
            </DialogDescription>
          </DialogHeader>
          {primarySelectedUrl ? (
            <AvatarCropWorkspace
              key={primarySelectedRenderKey}
              src={primarySelectedRenderUrl}
              isApplyingCrop={isApplyingCrop}
              onCancel={() => setIsCropDialogOpen(false)}
              onApplyCrop={applyCrop}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Selecione um avatar na biblioteca antes de abrir o editor.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(focalTarget)}
        onOpenChange={(next) => {
          if (!next && !isSavingFocal) {
            setFocalTarget(null);
          }
        }}
      >
        <DialogContent
          className="flex h-[92vh] w-[96vw] max-w-[96vw] flex-col overflow-hidden z-240 data-[state=open]:animate-none data-[state=closed]:animate-none"
          overlayClassName="z-230 data-[state=open]:animate-none data-[state=closed]:animate-none"
        >
          <DialogHeader>
            <DialogTitle>Definir ponto focal</DialogTitle>
            <DialogDescription>
              Ajuste o enquadramento por preset e regenere as variantes automáticas com uma
              prévia fiel ao recorte final.
            </DialogDescription>
          </DialogHeader>
          {focalTarget ? (
            <>
              <div className="min-h-0 flex-1 overflow-auto pr-1">
                <FocalPointWorkspace
                  item={focalTarget}
                  renderUrl={toLibraryItemRenderUrl(focalTarget)}
                  draft={focalCropDraft}
                  activePreset={activeFocalPreset}
                  onDraftChange={setFocalCropDraft}
                  onActivePresetChange={setActiveFocalPreset}
                />
              </div>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSavingFocal}
                  onClick={() => setFocalTarget(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={isSavingFocal}
                  onClick={() => void saveFocalPoint()}
                >
                  {isSavingFocal ? "Salvando..." : "Salvar ponto focal"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <DialogContent className="max-w-md z-240" overlayClassName="z-230">
          <DialogHeader>
            <DialogTitle>Excluir imagem?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `A imagem "${toEffectiveName(deleteTarget)}" será removida permanentemente.`
                : "Confirme a exclusão da imagem."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                if (!deleteTarget) {
                  return;
                }
                void (async () => {
                  await handleDelete(deleteTarget);
                  setDeleteTarget(null);
                })();
              }}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(altTextTarget)}
        onOpenChange={(next) => {
          if (!next) {
            setAltTextTarget(null);
            setAltTextValue("");
          }
        }}
      >
        <DialogContent className="max-w-md z-240" overlayClassName="z-230">
          <DialogHeader>
            <DialogTitle>Editar texto alternativo</DialogTitle>
            <DialogDescription>
              Esse texto fica salvo no upload e pode ser reutilizado ao selecionar a imagem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="edit-image-alt-text">Texto alternativo</Label>
            <Input
              id="edit-image-alt-text"
              value={altTextValue}
              onChange={(event) => setAltTextValue(event.target.value)}
              placeholder="Descreva a imagem, se quiser"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAltTextTarget(null);
                  setAltTextValue("");
                }}
                disabled={isSavingAltText}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={isSavingAltText}
                onClick={() => void handleAltTextConfirm()}
              >
                {isSavingAltText ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameTarget)} onOpenChange={(next) => !next && setRenameTarget(null)}>
        <DialogContent className="max-w-md z-240" overlayClassName="z-230">
          <DialogHeader>
            <DialogTitle>Renomear imagem</DialogTitle>
            <DialogDescription>
              O nome novo atualiza o caminho da imagem onde ela estiver sendo usada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="rename-image-file-name">Novo nome do arquivo</Label>
            <Input
              id="rename-image-file-name"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={isRenaming || !renameValue.trim()}
                onClick={() => void handleRenameConfirm()}
              >
                {isRenaming ? "Renomeando..." : "Renomear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageLibraryDialog;
