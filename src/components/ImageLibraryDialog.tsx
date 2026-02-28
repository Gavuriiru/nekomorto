import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleStencil, FixedCropper, type FixedCropperRef } from "react-advanced-cropper";
import { ImageRestriction } from "advanced-cropper";
import "react-advanced-cropper/dist/style.css";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";

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
  inUse?: boolean;
  canDelete?: boolean;
  projectId?: string;
  projectTitle?: string;
  kind?: string;
  hashSha256?: string;
  focalPoint?: { x: number; y: number };
  variantsVersion?: number;
  variants?: Record<string, unknown>;
  variantBytes?: number;
  area?: string;
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
  onSave: (payload: ImageLibrarySavePayload) => void;
};

const CROPPER_BOUNDARY_SIZE = 320;
const CROPPER_OUTPUT_SIZE = 512;

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });

const toEffectiveName = (item: LibraryImageItem) => item.name || item.fileName || item.label || "Imagem";

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

const normalizeFocalPointForUi = (value: unknown) => {
  const source = value && typeof value === "object" ? value : {};
  const x = Number((source as { x?: number }).x);
  const y = Number((source as { y?: number }).y);
  return {
    x: Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5,
    y: Number.isFinite(y) ? Math.min(1, Math.max(0, y)) : 0.5,
  };
};

const escapeRegexPattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const AVATAR_UPLOAD_FILENAME_PATTERN = /^avatar-[a-z0-9-]+\.(png|jpe?g|gif|webp|svg)$/i;

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

const isAvatarGeneratedUsersUpload = (item: LibraryImageItem) => {
  const parsedPath = parseUploadUrlPath(item.url);
  const folder = sanitizeUploadFolderForComparison(item.folder) || parsedPath.folder;
  if (getUploadRootSegment(folder) !== "users") {
    return false;
  }
  const fileName = String(item.fileName || "").trim() || parsedPath.fileName;
  return AVATAR_UPLOAD_FILENAME_PATTERN.test(fileName);
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

const toSelectionSignature = (urls: string[]) => urls.map((url) => toComparableSelectionKey(url)).join("\u0001");

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
    Array.isArray(currentSelectionUrls) && currentSelectionUrls.length > 0 ? currentSelectionUrls : undefined;
  const baseUrls = fromArray ?? (currentSelectionUrl ? [currentSelectionUrl] : []);
  const deduped = dedupeUrlsByComparableKey(baseUrls);
  if (mode === "multiple") {
    return deduped;
  }
  return deduped.length > 0 ? [deduped[0]] : [];
};

type ProjectImageGroup = {
  key: string;
  title: string;
  items: LibraryImageItem[];
};

type AvatarCropWorkspaceProps = {
  src: string;
  isApplyingCrop: boolean;
  onCancel: () => void;
  onApplyCrop: (dataUrl: string) => Promise<void>;
};

const AvatarCropWorkspace = ({ src, isApplyingCrop, onCancel, onApplyCrop }: AvatarCropWorkspaceProps) => {
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
      const canvas = cropper.getCanvas({
        width: CROPPER_OUTPUT_SIZE,
        height: CROPPER_OUTPUT_SIZE,
      });
      const normalizedDataUrl = String(canvas?.toDataURL("image/png") || "").trim();
      if (!normalizedDataUrl) {
        throw new Error("empty_crop_result");
      }
      await onApplyCrop(normalizedDataUrl);
    } catch {
      toast({
        title: "N\u00E3o foi poss\u00EDvel gerar a imagem recortada.",
        description: "Tente novamente em alguns segundos.",
      });
    }
  }, [isCropReady, onApplyCrop]);

  return (
    <>
      <div className="grid gap-4">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3">
          <p className="mb-1 text-sm font-medium text-foreground">Área de recorte</p>
          <p className="mb-3 text-xs text-muted-foreground">Arraste a imagem e use scroll para ajustar o zoom.</p>
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
                stencilSize={() => ({
                  width: CROPPER_BOUNDARY_SIZE,
                  height: CROPPER_BOUNDARY_SIZE,
                })}
                imageRestriction={ImageRestriction.stencil}
                transitions={false}
                onReady={() => setIsCropReady(true)}
                onError={() => {
                  setIsCropReady(false);
                  toast({
                    title: "N\u00E3o foi poss\u00EDvel carregar a imagem para recorte.",
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
        <Button type="button" onClick={() => void handleApply()} disabled={isApplyingCrop || !isCropReady}>
          {isApplyingCrop ? "Aplicando..." : "Aplicar avatar"}
        </Button>
      </div>
    </>
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
  onSave,
}: ImageLibraryDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploads, setUploads] = useState<LibraryImageItem[]>([]);
  const [projectImages, setProjectImages] = useState<LibraryImageItem[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "oldest" | "name">("recent");
  const [uploadsFolderFilter, setUploadsFolderFilter] = useState<string>("__all__");
  const [renameTarget, setRenameTarget] = useState<LibraryImageItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LibraryImageItem | null>(null);
  const [focalTarget, setFocalTarget] = useState<LibraryImageItem | null>(null);
  const [focalDraft, setFocalDraft] = useState<{ x: number; y: number }>(() => normalizeFocalPointForUi(null));
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingFocal, setIsSavingFocal] = useState(false);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [isLibraryHydratedForOpen, setIsLibraryHydratedForOpen] = useState(false);
  const projectImageProjectIdsSignature = useMemo(
    () => toStableProjectIdSignature(projectImageProjectIds),
    [projectImageProjectIds],
  );
  const normalizedProjectImageProjectIds = useMemo(
    () => (projectImageProjectIdsSignature ? projectImageProjectIdsSignature.split("\u0001") : []),
    [projectImageProjectIdsSignature],
  );
  const listFoldersSignature = useMemo(() => toStableFolderSignature(listFolders), [listFolders]);
  const normalizedListFolders = useMemo(() => parseStableFolderSignature(listFoldersSignature), [listFoldersSignature]);
  const allowedProjectImageIdSet = useMemo(
    () => new Set(normalizedProjectImageProjectIds),
    [normalizedProjectImageProjectIds],
  );

  const folders = useMemo(() => {
    const set = new Set<string>();
    normalizedListFolders.forEach((folder) => set.add(folder));
    if (uploadFolder) {
      set.add(uploadFolder);
    }
    if (listAll) {
      set.add("__all__");
    }
    if (set.size === 0) {
      set.add("");
    }
    return Array.from(set);
  }, [listAll, normalizedListFolders, uploadFolder]);

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
      const matchedItem = allItems.get(trimmed) ?? allItemsByComparableKey.get(toComparableSelectionKey(trimmed));
      if (!matchedItem?.url) {
        return;
      }
      set.add(matchedItem.url);
    });
    return set;
  }, [allItems, allItemsByComparableKey, selectedUrls]);

  const primarySelectedUrl = selectedUrls[0] || "";
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
    return uploads.filter((item) => !isAvatarGeneratedUsersUpload(item));
  }, [cropAvatar, uploads]);

  const filteredUploads = useMemo(() => {
    const bySearch = visibleUploads.filter(matchesSearch);
    const byFolder =
      uploadsFolderFilter === "__all__"
        ? bySearch
        : bySearch.filter(
            (item) => sanitizeUploadFolderForComparison(item.folder) === sanitizeUploadFolderForComparison(uploadsFolderFilter),
          );
    return sortLibraryItems(byFolder);
  }, [matchesSearch, sortLibraryItems, uploadsFolderFilter, visibleUploads]);
  const filteredProjectImages = useMemo(
    () => sortLibraryItems(projectImages.filter(matchesSearch)),
    [matchesSearch, projectImages, sortLibraryItems],
  );
  const uploadFolderFilterOptions = useMemo(() => {
    const set = new Set<string>();
    uploads.forEach((item) => {
      const normalized = sanitizeUploadFolderForComparison(item.folder);
      if (normalized) {
        set.add(normalized);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [uploads]);

  useEffect(() => {
    if (uploadsFolderFilter === "__all__") {
      return;
    }
    if (!uploadFolderFilterOptions.includes(uploadsFolderFilter)) {
      setUploadsFolderFilter("__all__");
    }
  }, [uploadFolderFilterOptions, uploadsFolderFilter]);

  const selectionSeed = useMemo(
    () =>
      buildSelectionSeed({
        currentSelectionUrls,
        currentSelectionUrl,
        mode,
      }),
    [currentSelectionUrl, currentSelectionUrls, mode],
  );
  const selectionSeedSignature = useMemo(() => toSelectionSignature(selectionSeed), [selectionSeed]);
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
        const matched = allItems.get(trimmed) ?? allItemsByComparableKey.get(toComparableSelectionKey(trimmed));
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
    const groupMap = new Map<string, ProjectImageGroup>();
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
        groupMap.set(key, { key, title, items: [] });
      }
      groupMap.get(key)?.items.push(item);
    });
    return Array.from(groupMap.values()).sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  }, [filteredProjectImages]);

  const loadUploads = useCallback(async () => {
    setIsLoading(true);
    try {
      const responses = await Promise.all(
        folders.map((folder) => {
          const query = folder ? `?folder=${encodeURIComponent(folder)}` : "";
          return apiFetch(apiBase, `/api/uploads/list${query}`, { auth: true });
        }),
      );
      const files: LibraryImageItem[] = [];
      for (const response of responses) {
        if (!response.ok) {
          continue;
        }
        const data = await response.json();
        if (!Array.isArray(data.files)) {
          continue;
        }
        for (const file of data.files) {
          if (!file?.url) {
            continue;
          }
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
            inUse: Boolean(file.inUse),
            canDelete: typeof file.canDelete === "boolean" ? file.canDelete : !file.inUse,
            hashSha256: typeof file.hashSha256 === "string" ? file.hashSha256 : "",
            focalPoint: normalizeFocalPointForUi(file.focalPoint),
            variantsVersion: Number.isFinite(Number(file.variantsVersion))
              ? Number(file.variantsVersion)
              : 1,
            variants: file.variants && typeof file.variants === "object" ? file.variants : {},
            variantBytes: Number.isFinite(Number(file.variantBytes)) ? Number(file.variantBytes) : 0,
            area: typeof file.area === "string" ? file.area : "",
          });
        }
      }
      const unique = new Map<string, LibraryImageItem>();
      files.forEach((item) => {
        unique.set(item.url, item);
      });
      setUploads(Array.from(unique.values()));
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, folders]);

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
      const mapped = data.items
        .map(
          (item: {
            url: string;
            label?: string;
            projectId?: string;
            projectTitle?: string;
            kind?: string;
            source?: string;
          }) => {
            const normalizedProjectUrl = normalizeComparableUploadUrl(item?.url);
            if (!normalizedProjectUrl.startsWith("/uploads/projects/")) {
              return null;
            }
            return {
              source: "project",
              url: normalizedProjectUrl,
              name: String(item.label || normalizedProjectUrl),
              label: String(item.label || normalizedProjectUrl),
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
            }),
          });
          if (!response.ok) {
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
            setSelectedUrls([uploadedUrls[uploadedUrls.length - 1]]);
          }
          toast({
            title: uploadedUrls.length === 1 ? "Imagem enviada" : `${uploadedUrls.length} imagens enviadas`,
            description:
              uploadedUrls.length === 1
                ? "Upload concluído com sucesso."
                : "Os uploads foram concluídos com sucesso.",
            intent: "success",
          });
        }
      } catch {
        toast({ title: "N\u00E3o foi poss\u00EDvel enviar a imagem." });
      } finally {
        setIsUploading(false);
      }
    },
    [apiBase, loadUploads, mode, uploadFolder],
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
        }),
      });
      if (!response.ok) {
        toast({ title: "N\u00E3o foi poss\u00EDvel importar a imagem por URL." });
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
      toast({
        title: "Imagem importada",
        description: "A imagem foi importada por URL com sucesso.",
        intent: "success",
      });
    } finally {
      setIsUploading(false);
    }
  }, [apiBase, loadUploads, mode, uploadFolder, urlInput]);

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
            description: "Remova refer\u00EAncias antes de excluir.",
          });
          return;
        }
        if (!response.ok) {
          toast({ title: "N\u00E3o foi poss\u00EDvel excluir a imagem." });
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
        toast({ title: "Conflito de nome", description: "J\u00E1 existe um arquivo com esse nome." });
        return;
      }
      if (!response.ok) {
        toast({ title: "N\u00E3o foi poss\u00EDvel renomear a imagem." });
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

  const beginFocalPointEdit = useCallback((item: LibraryImageItem) => {
    if (item.source !== "upload" || !item.id) {
      return;
    }
    setFocalTarget(item);
    setFocalDraft(normalizeFocalPointForUi(item.focalPoint));
  }, []);

  const saveFocalPoint = useCallback(async () => {
    if (!focalTarget?.id) {
      return;
    }
    setIsSavingFocal(true);
    try {
      const response = await apiFetch(apiBase, `/api/uploads/${encodeURIComponent(focalTarget.id)}/focal-point`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({
          x: focalDraft.x,
          y: focalDraft.y,
        }),
      });
      if (!response.ok) {
        toast({
          title: "Nao foi possivel salvar o ponto focal.",
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
        title: "Nao foi possivel salvar o ponto focal.",
        variant: "destructive",
      });
    } finally {
      setIsSavingFocal(false);
    }
  }, [apiBase, focalDraft.x, focalDraft.y, focalTarget?.id, loadUploads]);

  const handleSave = () => {
    if (cropAvatar && selectedUrls.length > 0) {
      const normalizedCropSlot = String(cropSlot || "").trim();
      if (!normalizedCropSlot) {
        toast({ title: "Preencha o ID do usu\u00E1rio antes de salvar o avatar." });
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

  const applyCrop = useCallback(async (dataUrl: string) => {
    const nextDataUrl = dataUrl.trim();
    if (!nextDataUrl) {
      toast({
        title: "N\u00E3o foi poss\u00EDvel gerar a imagem recortada.",
        description: "Tente novamente em alguns segundos.",
      });
      return;
    }
    const normalizedCropSlot = String(cropSlot || "").trim();
    if (cropAvatar && !normalizedCropSlot) {
      toast({ title: "Preencha o ID do usu\u00E1rio antes de aplicar o recorte." });
      return;
    }
    const targetFolder = cropAvatar ? (cropTargetFolder || "users") : (cropTargetFolder || uploadFolder || undefined);
    const targetFilename = cropAvatar ? `${normalizedCropSlot}.png` : `avatar-crop-${Date.now()}.png`;

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
        }),
      });
      if (!response.ok) {
        throw new Error("apply_crop_upload_failed");
      }
      const data = await response.json();
      const nextUrl = String(data.url || "");
      if (!nextUrl) {
        throw new Error("apply_crop_upload_missing_url");
      }

      await loadUploads();
      setSelectedUrls([nextUrl]);
      setIsCropDialogOpen(false);
      toast({
        title: "Avatar atualizado",
        description: "A imagem recortada foi aplicada com sucesso.",
        intent: "success",
      });
    } catch {
      toast({
        title: "N\u00E3o foi poss\u00EDvel gerar a imagem recortada.",
        description: "Tente novamente em alguns segundos.",
      });
    } finally {
      setIsApplyingCrop(false);
    }
  }, [apiBase, cropAvatar, cropSlot, cropTargetFolder, loadUploads, uploadFolder]);

  const renderGrid = (items: LibraryImageItem[], emptyText: string) => {
    if (isLoading) {
      return <p className="mt-3 text-xs text-muted-foreground">Carregando...</p>;
    }
    if (items.length === 0) {
      return <p className="mt-3 text-xs text-muted-foreground">{emptyText}</p>;
    }
    return (
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const isSelected = selectedResolvedUrlSet.has(item.url);
          const canRename = item.source === "upload";
          const canDelete = item.source === "upload" && Boolean(item.canDelete);
          const canEditFocal = item.source === "upload" && Boolean(item.id);
          return (
            <ContextMenu key={`${item.source}:${item.url}`}>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  className={`group overflow-hidden rounded-xl border border-border/60 bg-card/60 text-left transition hover:border-primary/40 ${
                    isSelected ? "ring-2 ring-primary/60 border-primary/60" : ""
                  }`}
                  onClick={() =>
                    setSelection(item.url, {
                      openCrop: cropAvatar && mode === "single",
                    })
                  }
                >
                  <img src={item.url} alt={toEffectiveName(item)} className="h-28 w-full object-cover" />
                  <div className="p-2 text-xs text-muted-foreground line-clamp-2">
                    {item.label || toEffectiveName(item)}
                  </div>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56 z-230">
                <ContextMenuLabel>{item.source === "upload" ? "Upload do servidor" : "Imagem de projeto"}</ContextMenuLabel>
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
                {cropAvatar && mode === "single" ? <ContextMenuSeparator /> : null}
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
                {!canRename || !canDelete || !canEditFocal ? (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuLabel className="text-xs font-normal text-muted-foreground">
                      {item.source === "project"
                        ? "Item somente leitura (projeto)."
                        : item.inUse
                          ? "Exclus\u00E3o bloqueada: imagem em uso."
                          : "A\u00E7\u00F5es indispon\u00EDveis."}
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
      return <p className="mt-3 text-xs text-muted-foreground">Carregando...</p>;
    }
    if (groups.length === 0) {
      return <p className="mt-3 text-xs text-muted-foreground">{emptyText}</p>;
    }
    return (
      <Accordion type="multiple" className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card/40 px-3">
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex h-[90vh] w-[92vw] max-w-5xl flex-col overflow-hidden z-200 data-[state=open]:animate-none data-[state=closed]:animate-none [&>button]:hidden"
          overlayClassName="z-190 data-[state=open]:animate-none data-[state=closed]:animate-none"
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid gap-3 lg:grid-cols-[1.25fr_0.95fr]">
            <div
              className={`flex h-full flex-col justify-center rounded-2xl border border-dashed border-border/70 bg-card/50 p-4 text-sm text-muted-foreground transition ${
                isDragActive ? "ring-2 ring-primary/60 border-primary/60" : ""
              }`}
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
              <p className="font-medium text-foreground">Arraste, cole (Ctrl+V) ou escolha arquivos</p>
              <p className="mt-1 text-xs text-muted-foreground">Upload direto para o servidor.</p>
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
                {isUploading ? <p className="text-xs text-muted-foreground">Processando...</p> : null}
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4 space-y-3">
              {showUrlImport ? (
                <div className="space-y-2">
                  <Label>Importar por URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={urlInput}
                      onChange={(event) => setUrlInput(event.target.value)}
                      placeholder="https://site.com/imagem.png"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleImportFromUrl()}
                      disabled={isUploading || !urlInput.trim()}
                    >
                      Importar URL
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Importação por URL desativada.</p>
              )}
              <p className="text-xs text-muted-foreground">
                {mode === "multiple"
                  ? "Clique para alternar sele\u00E7\u00E3o. A ordem de clique vira a ordem de inser\u00E7\u00E3o."
                  : cropAvatar
                    ? "Clique na imagem para selecionar e abrir o editor de avatar."
                    : "Clique para selecionar. A imagem s\u00F3 ser\u00E1 aplicada ao clicar em Salvar."}
              </p>
            </div>
          </div>

          <div className="mt-4 min-h-0 flex-1 space-y-8 overflow-auto no-scrollbar">
            <div>
              <div className="sticky top-0 z-10 -mx-1 mb-2 rounded-xl border border-border/60 bg-background/95 px-3 py-3 backdrop-blur">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Uploads do servidor</h3>
                    <p className="text-xs text-muted-foreground">Selecionadas: {selectedUrls.length}</p>
                  </div>
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Pesquisar por nome, projeto ou URL..."
                      className="h-9 lg:w-80"
                    />
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <select
                        value={uploadsFolderFilter}
                        onChange={(event) => setUploadsFolderFilter(event.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="__all__">Todas as pastas</option>
                        {uploadFolderFilterOptions.map((folder) => (
                          <option key={folder} value={folder}>
                            {folder}
                          </option>
                        ))}
                      </select>
                      <select
                        value={sortMode}
                        onChange={(event) => setSortMode(event.target.value as "recent" | "oldest" | "name")}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="recent">Mais recentes</option>
                        <option value="oldest">Mais antigos</option>
                        <option value="name">Nome</option>
                      </select>
                      {allowDeselect ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => setSelectedUrls([])}>
                          Limpar seleção
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-foreground">Uploads do servidor</h3>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Pesquisar por nome ou projeto..."
                    className="h-9 sm:w-72"
                  />
                  {allowDeselect ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setSelectedUrls([])}>
                      Limpar seleção
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="hidden mt-2 text-xs text-muted-foreground" aria-hidden="true" />
              {renderGrid(
                filteredUploads,
                normalizedSearch || uploadsFolderFilter !== "__all__"
                  ? "Nenhum upload corresponde aos filtros atuais."
                  : "Nenhum upload disponível.",
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Imagens dos projetos</h3>
                <span className="text-xs text-muted-foreground">
                  Ordenação: {sortMode === "recent" ? "mais recentes" : sortMode === "oldest" ? "mais antigos" : "nome"}
                </span>
              </div>
              {includeProjectImages
                ? projectImagesView === "by-project"
                  ? renderProjectGroups(
                      projectImageGroups,
                      normalizedSearch
                        ? "Nenhuma imagem de projeto encontrada para essa pesquisa."
                        : "Nenhuma imagem de projeto encontrada.",
                    )
                  : renderGrid(
                      filteredProjectImages,
                      normalizedSearch
                        ? "Nenhuma imagem de projeto encontrada para essa pesquisa."
                        : "Nenhuma imagem de projeto encontrada.",
                    )
                : <p className="mt-3 text-xs text-muted-foreground">Imagens de projeto ocultas neste contexto.</p>}
            </div>
          </div>

          <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
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
              Defina o enquadramento final do avatar e clique em Aplicar avatar para liberar o salvamento.
            </DialogDescription>
          </DialogHeader>
          {primarySelectedUrl ? (
            <AvatarCropWorkspace
              key={primarySelectedUrl}
              src={primarySelectedUrl}
              isApplyingCrop={isApplyingCrop}
              onCancel={() => setIsCropDialogOpen(false)}
              onApplyCrop={applyCrop}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Selecione um avatar na biblioteca antes de abrir o editor.</p>
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
        <DialogContent className="max-w-xl z-240" overlayClassName="z-230">
          <DialogHeader>
            <DialogTitle>Definir ponto focal</DialogTitle>
            <DialogDescription>
              Clique na imagem para posicionar o foco principal e regenerar as variantes automáticas.
            </DialogDescription>
          </DialogHeader>
          {focalTarget ? (
            <div className="space-y-4">
              <div
                className="relative cursor-crosshair overflow-hidden rounded-xl border border-border/60 bg-background/40"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const nextX = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
                  const nextY = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
                  setFocalDraft({
                    x: Math.min(1, Math.max(0, nextX)),
                    y: Math.min(1, Math.max(0, nextY)),
                  });
                }}
              >
                <img src={focalTarget.url} alt={toEffectiveName(focalTarget)} className="h-72 w-full object-cover" />
                <div
                  className="pointer-events-none absolute h-5 w-5 rounded-full border-2 border-primary bg-primary/40 shadow"
                  style={{
                    left: `${focalDraft.x * 100}%`,
                    top: `${focalDraft.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-xs text-muted-foreground">
                  Eixo X ({Math.round(focalDraft.x * 100)}%)
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(focalDraft.x * 100)}
                    onChange={(event) =>
                      setFocalDraft((prev) => ({
                        ...prev,
                        x: Math.min(1, Math.max(0, Number(event.target.value) / 100)),
                      }))
                    }
                    className="w-full accent-primary"
                  />
                </label>
                <label className="space-y-2 text-xs text-muted-foreground">
                  Eixo Y ({Math.round(focalDraft.y * 100)}%)
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(focalDraft.y * 100)}
                    onChange={(event) =>
                      setFocalDraft((prev) => ({
                        ...prev,
                        y: Math.min(1, Math.max(0, Number(event.target.value) / 100)),
                      }))
                    }
                    className="w-full accent-primary"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSavingFocal}
                  onClick={() => setFocalTarget(null)}
                >
                  Cancelar
                </Button>
                <Button type="button" disabled={isSavingFocal} onClick={() => void saveFocalPoint()}>
                  {isSavingFocal ? "Salvando..." : "Salvar ponto focal"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <DialogContent className="max-w-md z-240" overlayClassName="z-230">
          <DialogHeader>
            <DialogTitle>Excluir imagem?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `A imagem "${toEffectiveName(deleteTarget)}" ser\u00E1 removida permanentemente.`
                : "Confirme a exclus\u00E3o da imagem."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
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
              <Button type="button" disabled={isRenaming || !renameValue.trim()} onClick={() => void handleRenameConfirm()}>
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



