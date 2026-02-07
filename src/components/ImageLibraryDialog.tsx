import { useCallback, useEffect, useMemo, useState } from "react";
import { ImageCropper, ImageCropperProvider, useImageCropper } from "@wordpress/image-cropper";

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
  cropTargetFolder?: string;
  cropSlot?: string;
  onSave: (payload: ImageLibrarySavePayload) => void;
};

const CROPPER_PREVIEW_SIZE = 320;
const CROPPER_EDGE_PADDING = 0;
const CROPPER_CROP_SIZE = CROPPER_PREVIEW_SIZE - CROPPER_EDGE_PADDING * 2;
const CROPPER_MIN_ZOOM = 1;
const CROPPER_MAX_ZOOM = 5;
const CROPPER_INITIAL_ZOOM = 1.1;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("blob_read_failed"));
    reader.readAsDataURL(blob);
  });

const blobUrlToDataUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("blob_fetch_failed");
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
};

const toEffectiveName = (item: LibraryImageItem) => item.name || item.fileName || item.label || "Imagem";

type AvatarCropWorkspaceProps = {
  src: string;
  isApplyingCrop: boolean;
  onCancel: () => void;
  onApplyCrop: (dataUrl: string) => Promise<void>;
};

type ImageCropperRuntimeProps = {
  src: string;
  minZoom?: number;
  maxZoom?: number;
  onLoad?: (mediaSize: unknown) => void;
  cropSize?: { width: number; height: number };
  zoomWithScroll?: boolean;
  objectFit?: "contain" | "cover" | "horizontal-cover" | "vertical-cover";
};

const RuntimeImageCropper = ImageCropper as unknown as (props: ImageCropperRuntimeProps) => ReturnType<typeof ImageCropper>;

const AvatarCropWorkspace = ({ src, isApplyingCrop, onCancel, onApplyCrop }: AvatarCropWorkspaceProps) => {
  const { setResetState, reset, getCroppedImage } = useImageCropper();
  const [isCropReady, setIsCropReady] = useState(false);

  useEffect(() => {
    setIsCropReady(false);
    setResetState({
      crop: { x: 0, y: 0, width: 100, height: 100 },
      zoom: clamp(CROPPER_INITIAL_ZOOM, CROPPER_MIN_ZOOM, CROPPER_MAX_ZOOM),
      rotation: 0,
      aspectRatio: 1,
      flip: { horizontal: false, vertical: false },
    });
  }, [setResetState, src]);

  const handleApply = useCallback(async () => {
    if (!isCropReady) {
      return;
    }
    const croppedUrl = await getCroppedImage(src);
    if (!croppedUrl) {
      toast({
        title: "Não foi possível gerar a imagem recortada.",
        description: "Tente novamente em alguns segundos.",
      });
      return;
    }

    try {
      const dataUrl = await blobUrlToDataUrl(croppedUrl);
      if (!dataUrl) {
        throw new Error("crop_data_url_empty");
      }
      await onApplyCrop(dataUrl);
    } finally {
      if (croppedUrl.startsWith("blob:")) {
        URL.revokeObjectURL(croppedUrl);
      }
    }
  }, [getCroppedImage, isCropReady, onApplyCrop, src]);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3">
          <p className="mb-1 text-sm font-medium text-foreground">Área de recorte</p>
          <p className="mb-3 text-xs text-muted-foreground">Mova e ajuste o enquadramento direto na imagem.</p>
          <div
            className="avatar-cropper-preview relative mx-auto overflow-hidden rounded-xl bg-black/20"
            style={{ width: CROPPER_PREVIEW_SIZE, height: CROPPER_PREVIEW_SIZE }}
          >
            <RuntimeImageCropper
              src={src}
              minZoom={CROPPER_MIN_ZOOM}
              maxZoom={CROPPER_MAX_ZOOM}
              cropSize={{ width: CROPPER_CROP_SIZE, height: CROPPER_CROP_SIZE }}
              zoomWithScroll
              objectFit="cover"
              onLoad={() => setIsCropReady(true)}
            />
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-4">
          <p className="text-sm font-medium text-foreground">Como ajustar</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Arraste a imagem para posicionar o avatar.</p>
            <p>Use o scroll para aproximar ou afastar.</p>
            <p>Quando estiver satisfeito com o enquadramento, clique em Aplicar avatar.</p>
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={reset}
          disabled={!isCropReady}
        >
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
  mode = "single",
  allowDeselect = true,
  showUrlImport = true,
  currentSelectionUrls,
  currentSelectionUrl,
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
  const [renameTarget, setRenameTarget] = useState<LibraryImageItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LibraryImageItem | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);

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
    setIsCropDialogOpen(false);
  }, [currentSelectionUrl, currentSelectionUrls, mode, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (cropAvatar && mode === "single") {
      return;
    }
    setSelectedUrls((prev) => prev.filter((url) => allItems.has(url)));
  }, [allItems, cropAvatar, mode, open]);

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
        }
      } catch {
        toast({ title: "Não foi possível enviar a imagem." });
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
            description: "Remova referências antes de excluir.",
          });
          return;
        }
        if (!response.ok) {
          toast({ title: "Não foi possível excluir a imagem." });
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
        toast({ title: "Conflito de nome", description: "Já existe um arquivo com esse nome." });
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
    });
    onOpenChange(false);
  };

  const applyCrop = useCallback(async (dataUrl: string) => {
    const nextDataUrl = dataUrl.trim();
    if (!nextDataUrl) {
      toast({
        title: "Não foi possível gerar a imagem recortada.",
        description: "Tente novamente em alguns segundos.",
      });
      return;
    }
    if (cropAvatar && (!cropSlot || !cropSlot.trim())) {
      toast({ title: "Preencha o ID do usuário antes de aplicar o recorte." });
      return;
    }

    setIsApplyingCrop(true);
    try {
      const response = await apiFetch(apiBase, "/api/uploads/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({
          dataUrl: nextDataUrl,
          filename: cropSlot ? `${cropSlot}.jpg` : `avatar-crop-${Date.now()}.jpg`,
          folder: cropTargetFolder || uploadFolder || undefined,
          slot: cropSlot || undefined,
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

      setSelectedUrls([nextUrl]);
      setIsCropDialogOpen(false);
    } catch {
      toast({
        title: "Não foi possível gerar a imagem recortada.",
        description: "Tente novamente em alguns segundos.",
      });
    } finally {
      setIsApplyingCrop(false);
    }
  }, [apiBase, cropAvatar, cropSlot, cropTargetFolder, uploadFolder]);

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
                    Editar avatar
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
                          ? "Exclusão bloqueada: imagem em uso."
                          : "Ações indisponíveis."}
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
                      Limpar seleção
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Selecionadas: {selectedUrls.length}</p>
              {renderGrid(
                filteredUploads,
                normalizedSearch ? "Nenhum upload encontrado para essa pesquisa." : "Nenhum upload disponível.",
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
          setIsCropDialogOpen(false);
        }}
      >
        <DialogContent
          className="max-h-[92vh] max-w-5xl overflow-auto z-[240] data-[state=open]:animate-none data-[state=closed]:animate-none"
          overlayClassName="z-[230] data-[state=open]:animate-none data-[state=closed]:animate-none"
        >
          <DialogHeader>
            <DialogTitle>Editor de avatar</DialogTitle>
            <DialogDescription>
              Defina o enquadramento final do avatar e clique em Aplicar avatar.
            </DialogDescription>
          </DialogHeader>
          {primarySelectedUrl ? (
            <ImageCropperProvider key={primarySelectedUrl}>
              <AvatarCropWorkspace
                src={primarySelectedUrl}
                isApplyingCrop={isApplyingCrop}
                onCancel={() => setIsCropDialogOpen(false)}
                onApplyCrop={applyCrop}
              />
            </ImageCropperProvider>
          ) : (
            <p className="text-sm text-muted-foreground">Selecione um avatar na biblioteca antes de abrir o editor.</p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <DialogContent className="max-w-md z-[240]" overlayClassName="z-[230]">
          <DialogHeader>
            <DialogTitle>Excluir imagem?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `A imagem "${toEffectiveName(deleteTarget)}" será removida permanentemente.`
                : "Confirme a exclusão da imagem."}
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
