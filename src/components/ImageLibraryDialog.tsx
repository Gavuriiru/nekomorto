import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";

export type AvatarDisplay = {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
};

export type LibraryImageSource = "upload" | "project";

export type LibraryImageItem = {
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
};

export type ImageLibrarySavePayload = {
  urls: string[];
  items: LibraryImageItem[];
  avatarDisplay?: AvatarDisplay;
};

type CropMediaFit = "horizontal-cover" | "vertical-cover";
type AvatarOffsetBounds = {
  maxX: number;
  maxY: number;
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
  mode?: "single" | "multiple";
  allowDeselect?: boolean;
  showUrlImport?: boolean;
  currentSelectionUrls?: string[];
  currentSelectionUrl?: string;
  cropAvatar?: boolean;
  initialAvatarDisplay?: AvatarDisplay;
  onSave: (payload: ImageLibrarySavePayload) => void;
};

const DEFAULT_AVATAR_DISPLAY: AvatarDisplay = {
  x: 0,
  y: 0,
  zoom: 1,
  rotation: 0,
};
const LEGACY_AVATAR_OFFSET_THRESHOLD = 20;
const MIN_AVATAR_ZOOM = 0.25;
const MAX_AVATAR_ZOOM = 5;
const DEFAULT_AVATAR_MEDIA_RATIO = 1;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toAvatarOffsetStyle = (display: AvatarDisplay): CSSProperties => ({
  transform: `translate(${display.x * 100}%, ${display.y * 100}%)`,
  transformOrigin: "center center",
});

const toAvatarMediaStyle = (display: AvatarDisplay): CSSProperties => ({
  transform: `rotate(${display.rotation}deg) scale(${display.zoom})`,
  transformOrigin: "center center",
});

const getCropMediaFit = (mediaRatio: number): CropMediaFit =>
  mediaRatio >= 1 ? "vertical-cover" : "horizontal-cover";

const getAvatarMediaStyleByFit = (fit: CropMediaFit): CSSProperties =>
  fit === "horizontal-cover"
    ? {
        width: "100%",
        height: "auto",
        maxWidth: "none",
        maxHeight: "none",
      }
    : {
        width: "auto",
        height: "100%",
        maxWidth: "none",
        maxHeight: "none",
      };

const getAvatarOffsetBounds = (mediaRatio: number, zoom: number): AvatarOffsetBounds => {
  const safeRatio =
    Number.isFinite(mediaRatio) && mediaRatio > 0 ? mediaRatio : DEFAULT_AVATAR_MEDIA_RATIO;
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : DEFAULT_AVATAR_DISPLAY.zoom;
  const baseWidth = safeRatio >= 1 ? safeRatio : 1;
  const baseHeight = safeRatio >= 1 ? 1 : 1 / safeRatio;
  return {
    maxX: Math.max(0, (baseWidth * safeZoom - 1) / 2),
    maxY: Math.max(0, (baseHeight * safeZoom - 1) / 2),
  };
};

const clampAvatarOffsets = (display: AvatarDisplay, mediaRatio: number): AvatarDisplay => {
  const bounds = getAvatarOffsetBounds(mediaRatio, display.zoom);
  return {
    ...display,
    x: clamp(display.x, -bounds.maxX, bounds.maxX),
    y: clamp(display.y, -bounds.maxY, bounds.maxY),
  };
};

const normalizeAvatarDisplay = (value?: Partial<AvatarDisplay> | null): AvatarDisplay => {
  const x = Number(value?.x);
  const y = Number(value?.y);
  const zoom = Number(value?.zoom);
  const rotation = Number(value?.rotation);
  const normalizedZoom =
    Number.isFinite(zoom) && zoom > 0
      ? clamp(zoom, MIN_AVATAR_ZOOM, MAX_AVATAR_ZOOM)
      : DEFAULT_AVATAR_DISPLAY.zoom;
  const normalizeOffset = (offset: number, fallback: number) => {
    if (!Number.isFinite(offset)) {
      return fallback;
    }
    if (Math.abs(offset) > LEGACY_AVATAR_OFFSET_THRESHOLD) {
      return offset / 360;
    }
    return offset;
  };
  const normalizedX = normalizeOffset(x, DEFAULT_AVATAR_DISPLAY.x);
  const normalizedY = normalizeOffset(y, DEFAULT_AVATAR_DISPLAY.y);
  return {
    x: normalizedX,
    y: normalizedY,
    zoom: normalizedZoom,
    rotation: Number.isFinite(rotation) ? rotation : DEFAULT_AVATAR_DISPLAY.rotation,
  };
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });

const toEffectiveName = (item: LibraryImageItem) => item.name || item.fileName || item.label || "Imagem";

const ImageLibraryDialog = ({
  open,
  onOpenChange,
  apiBase,
  title = "Biblioteca de imagens",
  description = "Selecione imagens do servidor ou dos projetos, depois confirme em Salvar.",
  uploadFolder,
  listFolders,
  listAll = true,
  mode = "single",
  allowDeselect = true,
  showUrlImport = true,
  currentSelectionUrls,
  currentSelectionUrl,
  cropAvatar = false,
  initialAvatarDisplay,
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
  const [renameTarget, setRenameTarget] = useState<LibraryImageItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LibraryImageItem | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [avatarDisplay, setAvatarDisplay] = useState<AvatarDisplay>(normalizeAvatarDisplay(initialAvatarDisplay));
  const [cropDraft, setCropDraft] = useState<AvatarDisplay>(normalizeAvatarDisplay(initialAvatarDisplay));
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [cropViewportSize, setCropViewportSize] = useState(360);
  const [cropMediaRatio, setCropMediaRatio] = useState(DEFAULT_AVATAR_MEDIA_RATIO);
  const cropViewportRef = useRef<HTMLDivElement | null>(null);

  const folders = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(listFolders) && listFolders.length > 0) {
      listFolders.forEach((folder) => {
        if (folder != null) {
          set.add(String(folder));
        }
      });
    }
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
  }, [listAll, listFolders, uploadFolder]);

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

  const primarySelectedUrl = selectedUrls[0] || "";
  const normalizedSearch = searchQuery.trim().toLowerCase();

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

  const filteredUploads = useMemo(() => uploads.filter(matchesSearch), [matchesSearch, uploads]);
  const filteredProjectImages = useMemo(
    () => projectImages.filter(matchesSearch),
    [matchesSearch, projectImages],
  );

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
        .filter((item: { url?: string }) => Boolean(item?.url))
        .map(
          (item: {
            url: string;
            label?: string;
            projectId?: string;
            projectTitle?: string;
            kind?: string;
            source?: string;
          }) =>
            ({
              source: "project",
              url: String(item.url),
              name: String(item.label || item.url),
              label: String(item.label || item.url),
              projectId: item.projectId ? String(item.projectId) : "",
              projectTitle: item.projectTitle ? String(item.projectTitle) : "",
              kind: item.kind ? String(item.kind) : "",
              inUse: true,
              canDelete: false,
            }) as LibraryImageItem,
        );
      const unique = new Map<string, LibraryImageItem>();
      mapped.forEach((item: LibraryImageItem) => {
        unique.set(item.url, item);
      });
      setProjectImages(Array.from(unique.values()));
    } catch {
      setProjectImages([]);
    }
  }, [apiBase]);

  const loadLibrary = useCallback(async () => {
    await Promise.all([loadUploads(), loadProjectImages()]);
  }, [loadProjectImages, loadUploads]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadLibrary();
  }, [loadLibrary, open]);

  useEffect(() => {
    if (!open) {
      setIsDragActive(false);
      return;
    }
    const fromArray =
      Array.isArray(currentSelectionUrls) && currentSelectionUrls.length > 0 ? currentSelectionUrls : undefined;
    const baseUrls = fromArray ?? (currentSelectionUrl ? [currentSelectionUrl] : []);
    if (mode === "multiple") {
      setSelectedUrls(baseUrls.filter(Boolean));
    } else {
      setSelectedUrls(baseUrls.length > 0 ? [baseUrls[0]] : []);
    }
    const normalizedDisplay = normalizeAvatarDisplay(initialAvatarDisplay);
    setAvatarDisplay(normalizedDisplay);
    setCropDraft(normalizedDisplay);
    setIsCropDialogOpen(false);
  }, [currentSelectionUrl, currentSelectionUrls, initialAvatarDisplay, mode, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedUrls((prev) => prev.filter((url) => allItems.has(url)));
  }, [allItems, open]);

  const setSelection = useCallback(
    (url: string, options?: { openCrop?: boolean }) => {
      let isSameSelection = false;
      setSelectedUrls((prev) => {
        if (mode === "multiple") {
          if (prev.includes(url)) {
            return prev.filter((item) => item !== url);
          }
          return [...prev, url];
        }
        isSameSelection = prev[0] === url;
        if (cropAvatar) {
          return [url];
        }
        if (isSameSelection) {
          return allowDeselect ? [] : prev;
        }
        return [url];
      });
      if (cropAvatar && mode === "single") {
        const nextDisplay = isSameSelection ? avatarDisplay : DEFAULT_AVATAR_DISPLAY;
        if (!isSameSelection) {
          setAvatarDisplay(DEFAULT_AVATAR_DISPLAY);
        }
        setCropDraft(normalizeAvatarDisplay(nextDisplay));
        if (options?.openCrop) {
          setIsCropDialogOpen(true);
        }
      }
    },
    [allowDeselect, avatarDisplay, cropAvatar, mode],
  );

  useEffect(() => {
    if (!primarySelectedUrl) {
      setIsCropDialogOpen(false);
    }
  }, [primarySelectedUrl]);

  useEffect(() => {
    setCropMediaRatio(DEFAULT_AVATAR_MEDIA_RATIO);
  }, [primarySelectedUrl]);

  useEffect(() => {
    if (!isCropDialogOpen || !cropViewportRef.current || typeof ResizeObserver === "undefined") {
      return;
    }
    const element = cropViewportRef.current;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const next = Math.max(1, Math.min(rect.width, rect.height));
      setCropViewportSize((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
    };
    updateSize();
    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [isCropDialogOpen]);

  const cropMediaFit = useMemo(() => getCropMediaFit(cropMediaRatio), [cropMediaRatio]);
  const cropMediaStyle = useMemo<CSSProperties>(
    () => getAvatarMediaStyleByFit(cropMediaFit),
    [cropMediaFit],
  );
  const cropBounds = useMemo(
    () => getAvatarOffsetBounds(cropMediaRatio, cropDraft.zoom),
    [cropDraft.zoom, cropMediaRatio],
  );

  useEffect(() => {
    setCropDraft((prev) => {
      const next = clampAvatarOffsets(prev, cropMediaRatio);
      if (next.x === prev.x && next.y === prev.y) {
        return prev;
      }
      return next;
    });
  }, [cropDraft.zoom, cropMediaRatio]);

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
        }
      } catch {
        toast({ title: "Nao foi possivel enviar a imagem." });
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
        toast({ title: "Nao foi possivel importar a imagem por URL." });
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
            description: "Remova referencias antes de excluir.",
          });
          return;
        }
        if (!response.ok) {
          toast({ title: "Nao foi possivel excluir a imagem." });
          return;
        }
        setSelectedUrls((prev) => prev.filter((url) => url !== item.url));
        await loadUploads();
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
        toast({ title: "Conflito de nome", description: "Ja existe um arquivo com esse nome." });
        return;
      }
      if (!response.ok) {
        toast({ title: "Nao foi possivel renomear a imagem." });
        return;
      }
      const data = await response.json();
      const oldUrl = String(data.oldUrl || renameTarget.url);
      const newUrl = String(data.newUrl || "");
      if (newUrl) {
        setSelectedUrls((prev) => prev.map((url) => (url === oldUrl ? newUrl : url)));
      }
      setRenameTarget(null);
      setRenameValue("");
      await loadLibrary();
    } finally {
      setIsRenaming(false);
    }
  }, [apiBase, loadLibrary, renameTarget, renameValue]);

  const handleSave = () => {
    const items = selectedUrls
      .map((url) => allItems.get(url))
      .filter((item): item is LibraryImageItem => Boolean(item));
    onSave({
      urls: selectedUrls,
      items,
      avatarDisplay:
        cropAvatar && items.length > 0 ? clampAvatarOffsets(avatarDisplay, cropMediaRatio) : undefined,
    });
    onOpenChange(false);
  };

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
          const isSelected = selectedUrls.includes(item.url);
          const canRename = item.source === "upload";
          const canDelete = item.source === "upload" && Boolean(item.canDelete);
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
              <ContextMenuContent className="w-56 z-[230]">
                <ContextMenuLabel>{item.source === "upload" ? "Upload do servidor" : "Imagem de projeto"}</ContextMenuLabel>
                <ContextMenuSeparator />
                {cropAvatar && mode === "single" ? (
                  <ContextMenuItem
                    onSelect={() => {
                      setSelection(item.url, { openCrop: true });
                    }}
                  >
                    Editar crop do avatar
                  </ContextMenuItem>
                ) : null}
                {cropAvatar && mode === "single" ? <ContextMenuSeparator /> : null}
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
                {!canRename || !canDelete ? (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuLabel className="text-xs font-normal text-muted-foreground">
                      {item.source === "project"
                        ? "Item somente leitura (projeto)."
                        : item.inUse
                          ? "Exclusao bloqueada: imagem em uso."
                          : "Acoes indisponiveis."}
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex h-[90vh] w-[92vw] max-w-5xl flex-col overflow-hidden z-[200] data-[state=open]:animate-none data-[state=closed]:animate-none [&>button]:hidden"
          overlayClassName="z-[190] data-[state=open]:animate-none data-[state=closed]:animate-none"
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
                <p className="text-sm text-muted-foreground">Importacao por URL desativada.</p>
              )}
              <p className="text-xs text-muted-foreground">
                {mode === "multiple"
                  ? "Clique para alternar selecao. A ordem de clique vira a ordem de insercao."
                  : cropAvatar
                    ? "Clique na imagem para selecionar e abrir o editor de crop."
                    : "Clique para selecionar. A imagem so sera aplicada ao clicar em Salvar."}
              </p>
            </div>
          </div>

          <div className="mt-4 min-h-0 flex-1 space-y-8 overflow-auto no-scrollbar">
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                      Limpar selecao
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Selecionadas: {selectedUrls.length}</p>
              {renderGrid(
                filteredUploads,
                normalizedSearch ? "Nenhum upload encontrado para essa pesquisa." : "Nenhum upload disponivel.",
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Imagens dos projetos</h3>
              {renderGrid(
                filteredProjectImages,
                normalizedSearch
                  ? "Nenhuma imagem de projeto encontrada para essa pesquisa."
                  : "Nenhuma imagem de projeto encontrada.",
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" onClick={handleSave}>
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
          setCropDraft(avatarDisplay);
          setIsCropDialogOpen(false);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-auto z-[240]" overlayClassName="z-[230]">
          <DialogHeader>
            <DialogTitle>Ajuste do avatar</DialogTitle>
            <DialogDescription>
              Ajuste posicao, zoom e rotacao. O arquivo nao e recortado no servidor.
            </DialogDescription>
          </DialogHeader>
          {primarySelectedUrl ? (
            <>
              <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
                <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                  <div
                    ref={cropViewportRef}
                    className="relative mx-auto w-full max-w-[360px] aspect-square overflow-hidden rounded-lg border border-border/60 bg-black/20"
                  >
                    <Cropper
                      image={primarySelectedUrl}
                      crop={{
                        x: cropDraft.x * cropViewportSize,
                        y: cropDraft.y * cropViewportSize,
                      }}
                      zoom={cropDraft.zoom}
                      rotation={cropDraft.rotation}
                      aspect={1}
                      cropShape="round"
                      showGrid
                      objectFit={cropMediaFit}
                      minZoom={MIN_AVATAR_ZOOM}
                      maxZoom={MAX_AVATAR_ZOOM}
                      onMediaLoaded={(mediaSize) => {
                        const width = Number(mediaSize?.naturalWidth || mediaSize?.width || 0);
                        const height = Number(mediaSize?.naturalHeight || mediaSize?.height || 0);
                        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
                          setCropMediaRatio(DEFAULT_AVATAR_MEDIA_RATIO);
                          return;
                        }
                        setCropMediaRatio(width / height);
                      }}
                      onCropChange={(crop) => {
                        const rawX = crop.x / cropViewportSize;
                        const rawY = crop.y / cropViewportSize;
                        const bounds = getAvatarOffsetBounds(cropMediaRatio, cropDraft.zoom);
                        setCropDraft((prev) => ({
                          ...prev,
                          x: clamp(rawX, -bounds.maxX, bounds.maxX),
                          y: clamp(rawY, -bounds.maxY, bounds.maxY),
                        }));
                      }}
                      onZoomChange={(zoom) => {
                        setCropDraft((prev) => ({ ...prev, zoom: clamp(zoom, MIN_AVATAR_ZOOM, MAX_AVATAR_ZOOM) }));
                      }}
                      onRotationChange={(rotation) => {
                        setCropDraft((prev) => ({ ...prev, rotation: clamp(rotation, -180, 180) }));
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Preview circular</p>
                    <div className="mt-3 flex justify-center">
                      <div className="relative h-28 w-28 overflow-hidden rounded-full border border-border/70 bg-muted/30">
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={toAvatarOffsetStyle(cropDraft)}
                        >
                          <img
                            src={primarySelectedUrl}
                            alt="Preview do avatar publico"
                            className="block max-h-none max-w-none"
                            style={{
                              ...cropMediaStyle,
                              ...toAvatarMediaStyle(cropDraft),
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Zoom</Label>
                      <Input
                        type="range"
                        min={MIN_AVATAR_ZOOM}
                        max={MAX_AVATAR_ZOOM}
                        step={0.01}
                        value={cropDraft.zoom}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value)) {
                            return;
                          }
                          setCropDraft((prev) => ({
                            ...prev,
                            zoom: clamp(value, MIN_AVATAR_ZOOM, MAX_AVATAR_ZOOM),
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rotacao</Label>
                      <Input
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        value={cropDraft.rotation}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value)) {
                            return;
                          }
                          setCropDraft((prev) => ({ ...prev, rotation: clamp(value, -180, 180) }));
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Posicao X</Label>
                      <Input
                        type="range"
                        min={-cropBounds.maxX}
                        max={cropBounds.maxX}
                        step={0.005}
                        value={cropDraft.x}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value)) {
                            return;
                          }
                          setCropDraft((prev) => ({
                            ...prev,
                            x: clamp(value, -cropBounds.maxX, cropBounds.maxX),
                          }));
                        }}
                        disabled={cropBounds.maxX <= 0}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Posicao Y</Label>
                      <Input
                        type="range"
                        min={-cropBounds.maxY}
                        max={cropBounds.maxY}
                        step={0.005}
                        value={cropDraft.y}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value)) {
                            return;
                          }
                          setCropDraft((prev) => ({
                            ...prev,
                            y: clamp(value, -cropBounds.maxY, cropBounds.maxY),
                          }));
                        }}
                        disabled={cropBounds.maxY <= 0}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCropDraft((prev) => ({
                          ...prev,
                          y: clamp(prev.y - 0.03, -cropBounds.maxY, cropBounds.maxY),
                        }))
                      }
                      disabled={cropBounds.maxY <= 0}
                    >
                      Mover cima
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCropDraft((prev) => ({
                          ...prev,
                          y: clamp(prev.y + 0.03, -cropBounds.maxY, cropBounds.maxY),
                        }))
                      }
                      disabled={cropBounds.maxY <= 0}
                    >
                      Mover baixo
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCropDraft((prev) => ({
                          ...prev,
                          x: clamp(prev.x - 0.03, -cropBounds.maxX, cropBounds.maxX),
                        }))
                      }
                      disabled={cropBounds.maxX <= 0}
                    >
                      Mover esquerda
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCropDraft((prev) => ({
                          ...prev,
                          x: clamp(prev.x + 0.03, -cropBounds.maxX, cropBounds.maxX),
                        }))
                      }
                      disabled={cropBounds.maxX <= 0}
                    >
                      Mover direita
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCropDraft(avatarDisplay);
                    setIsCropDialogOpen(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCropDraft(DEFAULT_AVATAR_DISPLAY);
                  }}
                >
                  Resetar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setAvatarDisplay(clampAvatarOffsets(normalizeAvatarDisplay(cropDraft), cropMediaRatio));
                    setIsCropDialogOpen(false);
                  }}
                >
                  Aplicar crop
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Selecione um avatar na biblioteca antes de ajustar o crop.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <DialogContent className="max-w-md z-[240]" overlayClassName="z-[230]">
          <DialogHeader>
            <DialogTitle>Excluir imagem?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `A imagem "${toEffectiveName(deleteTarget)}" sera removida permanentemente.`
                : "Confirme a exclusao da imagem."}
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
        <DialogContent className="max-w-md z-[240]" overlayClassName="z-[230]">
          <DialogHeader>
            <DialogTitle>Renomear imagem</DialogTitle>
            <DialogDescription>
              O nome novo atualiza o caminho da imagem onde ela estiver sendo usada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Novo nome do arquivo</Label>
            <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
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
