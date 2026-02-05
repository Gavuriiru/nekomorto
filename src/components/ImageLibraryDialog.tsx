import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";

type LibraryImage = {
  name: string;
  url: string;
};

type LibrarySectionItem = {
  key: string;
  label: string;
  url: string;
};

type LibrarySection = {
  title: string;
  items: LibrarySectionItem[];
  description?: string;
  onSelect?: (url: string, alt?: string, item?: LibrarySectionItem) => void;
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
  allowUrlInput?: boolean;
  showAltInput?: boolean;
  allowDeleteUploads?: boolean;
  allowDeselect?: boolean;
  selectOnUpload?: boolean;
  highlightOnUpload?: boolean;
  applyHighlightedOnClose?: boolean;
  onApplyHighlighted?: (urls: string[]) => void;
  currentSelectionUrl?: string;
  sections?: LibrarySection[];
  onSelect: (url: string, alt?: string) => void;
};

const getAltFromName = (name: string) =>
  name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();

const ImageLibraryDialog = ({
  open,
  onOpenChange,
  apiBase,
  title = "Biblioteca de imagens",
  description = "Selecione uma imagem ja enviada ou envie novos arquivos.",
  uploadFolder,
  listFolders,
  listAll = true,
  allowUrlInput = true,
  showAltInput = true,
  allowDeleteUploads = true,
  allowDeselect = true,
  selectOnUpload = false,
  highlightOnUpload = false,
  applyHighlightedOnClose = false,
  onApplyHighlighted,
  currentSelectionUrl,
  sections = [],
  onSelect,
}: ImageLibraryDialogProps) => {
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [libraryUrl, setLibraryUrl] = useState("");
  const [libraryAlt, setLibraryAlt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [lastUploadedUrls, setLastUploadedUrls] = useState<string[]>([]);
  const [confirmDeleteUrls, setConfirmDeleteUrls] = useState<string[] | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const folders = useMemo(() => {
    const set = new Set<string>();
    if (listFolders && listFolders.length > 0) {
      listFolders.forEach((folder) => set.add(folder));
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

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    try {
      const responses = await Promise.all(
        folders.map((folder) => {
          const query = folder ? `?folder=${encodeURIComponent(folder)}` : "";
          return apiFetch(apiBase, `/api/uploads/list${query}`, { auth: true });
        }),
      );
      const files: LibraryImage[] = [];
      for (const response of responses) {
        if (!response.ok) {
          continue;
        }
        const data = await response.json();
        if (Array.isArray(data.files)) {
          files.push(...data.files);
        }
      }
      const seen = new Set<string>();
      const unique = files.filter((file) => {
        if (!file?.url || seen.has(file.url)) {
          return false;
        }
        seen.add(file.url);
        return true;
      });
      setLibraryImages(unique);
    } catch {
      setLibraryImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, folders]);

  useEffect(() => {
    if (open) {
      void loadLibrary();
    }
  }, [open, loadLibrary]);

  useEffect(() => {
    if (!open) {
      setLibraryUrl("");
      setLibraryAlt("");
      setIsDragActive(false);
      setLastUploadedUrls([]);
      setIsSelectionMode(false);
    }
  }, [open]);

  const toggleSelection = useCallback((url: string) => {
    setLastUploadedUrls((prev) => {
      if (prev.includes(url)) {
        return prev.filter((item) => item !== url);
      }
      return [url, ...prev];
    });
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && applyHighlightedOnClose && lastUploadedUrls.length > 0 && onApplyHighlighted) {
        onApplyHighlighted([...lastUploadedUrls]);
        setLastUploadedUrls([]);
      }
      onOpenChange(next);
    },
    [applyHighlightedOnClose, lastUploadedUrls, onApplyHighlighted, onOpenChange],
  );

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("file_read_failed"));
      reader.readAsDataURL(file);
    });

  const uploadImage = useCallback(
    async (file: File) => {
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
      return String(data.url || "");
    },
    [apiBase, uploadFolder],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      const url = await uploadImage(file);
      if (url && selectOnUpload) {
        const alt = getAltFromName(file.name) || "Imagem";
        onSelect(url, alt);
      }
      if (url && (selectOnUpload || highlightOnUpload)) {
        setLastUploadedUrls((prev) => {
          const next = [url, ...prev];
          const seen = new Set<string>();
          return next.filter((item) => {
            if (!item || seen.has(item)) {
              return false;
            }
            seen.add(item);
            return true;
          });
        });
      }
      if (url) {
        setLibraryImages((prev) => {
          const next = [{ name: file.name, url }, ...prev];
          const seen = new Set<string>();
          return next.filter((item) => {
            if (!item?.url || seen.has(item.url)) {
              return false;
            }
            seen.add(item.url);
            return true;
          });
        });
      }
      return url;
    },
    [highlightOnUpload, onSelect, selectOnUpload, uploadImage],
  );

  const handleUploadFiles = useCallback(
    async (files: File[] | FileList | null | undefined) => {
      if (!files || files.length === 0) {
        return;
      }
      const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
      if (list.length === 0) {
        toast({ title: "Envie apenas imagens para a biblioteca." });
        return;
      }
      setIsUploading(true);
      try {
        for (const file of list) {
          await handleUpload(file);
        }
        await loadLibrary();
      } catch {
        toast({ title: "Nao foi possivel enviar a imagem." });
      } finally {
        setIsUploading(false);
      }
    },
    [handleUpload, loadLibrary],
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const files = event.dataTransfer?.files;
    void handleUploadFiles(files);
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
    [open, isUploading, handleUploadFiles],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [open, handlePaste]);

  const handleAddUrl = () => {
    const url = libraryUrl.trim();
    if (!url) {
      return;
    }
    onSelect(url, libraryAlt.trim() || "Imagem");
    if (selectOnUpload || highlightOnUpload) {
      setLastUploadedUrls((prev) => {
        const next = [url, ...prev];
        const seen = new Set<string>();
        return next.filter((item) => {
          if (!item || seen.has(item)) {
            return false;
          }
          seen.add(item);
          return true;
        });
      });
    }
    handleOpenChange(false);
  };

  const handleSelectUpload = (item: LibraryImage) => {
    const alt = item.name ? getAltFromName(item.name) : "Imagem";
    const effectiveSelectionUrl = currentSelectionUrl;
    const selectionModeActive = isSelectionMode || applyHighlightedOnClose;
    if (selectionModeActive) {
      toggleSelection(item.url);
      return;
    }
    if (allowDeselect && effectiveSelectionUrl && item.url === effectiveSelectionUrl) {
      onSelect("", alt || "Imagem");
      setLastUploadedUrls([]);
      handleOpenChange(false);
      return;
    }
    onSelect(item.url, alt || "Imagem");
    if (selectOnUpload || (highlightOnUpload && !applyHighlightedOnClose)) {
      setLastUploadedUrls((prev) => {
        const next = [item.url, ...prev];
        const seen = new Set<string>();
        return next.filter((value) => {
          if (!value || seen.has(value)) {
            return false;
          }
          seen.add(value);
          return true;
        });
      });
    } else if (applyHighlightedOnClose) {
      // keep highlights from uploads only
    } else if (lastUploadedUrls.length > 0) {
      setLastUploadedUrls([]);
    }
    handleOpenChange(false);
  };

  const handleDeleteMany = async (urls: string[]) => {
    if (!urls.length) {
      return;
    }
    setIsBulkDeleting(true);
    let inUseCount = 0;
    let failedCount = 0;
    try {
      for (const url of urls) {
        const response = await apiFetch(apiBase, "/api/uploads/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          auth: true,
          body: JSON.stringify({ url }),
        });
        if (response.status === 409) {
          inUseCount += 1;
          continue;
        }
        if (!response.ok) {
          failedCount += 1;
        }
      }
      await loadLibrary();
      setLastUploadedUrls([]);
      if (inUseCount > 0) {
        toast({
          title: "Algumas imagens estao em uso",
          description: "Remova as referencias antes de excluir esses arquivos.",
        });
      } else if (failedCount > 0) {
        toast({ title: "Nao foi possivel excluir algumas imagens." });
      }
    } catch {
      toast({ title: "Nao foi possivel excluir as imagens." });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, url: string) => {
    event.dataTransfer.setData("text/plain", url);
    event.dataTransfer.setData("text/uri-list", url);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <div
              className={`flex h-full flex-col justify-center rounded-2xl border border-dashed border-border/70 bg-card/50 p-5 text-sm text-muted-foreground transition ${
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
              <p className="font-medium text-foreground">Arraste ou cole (Ctrl+V) uma imagem para enviar</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Solte aqui ou use o seletor para adicionar na biblioteca.
              </p>
              <div className="mt-4 space-y-3">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isUploading}
                  onChange={(event) => {
                    void handleUploadFiles(event.target.files);
                  }}
                />
                {isUploading ? <p className="text-xs text-muted-foreground">Enviando...</p> : null}
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
              {allowUrlInput ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>URL da imagem</Label>
                    <Input value={libraryUrl} onChange={(event) => setLibraryUrl(event.target.value)} />
                  </div>
                  {showAltInput ? (
                    <div className="space-y-2">
                      <Label>Texto alternativo</Label>
                      <Input value={libraryAlt} onChange={(event) => setLibraryAlt(event.target.value)} />
                    </div>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-2">
                    {allowDeselect && currentSelectionUrl ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onSelect("", "");
                          handleOpenChange(false);
                        }}
                      >
                        Remover imagem
                      </Button>
                    ) : null}
                    {allowDeleteUploads ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={isSelectionMode ? "secondary" : "outline"}
                        onClick={() => setIsSelectionMode((prev) => !prev)}
                      >
                        {isSelectionMode ? "Selecionando" : "Selecionar"}
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" onClick={handleAddUrl} disabled={!libraryUrl.trim()}>
                      Usar imagem
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Selecione um item abaixo para reutilizar na sua configuracao.
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 max-h-[420px] space-y-8 overflow-auto no-scrollbar">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Uploads</h3>
                {allowDeleteUploads ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={lastUploadedUrls.length === 0 || isBulkDeleting}
                    onClick={() => setConfirmDeleteUrls([...lastUploadedUrls])}
                  >
                    {isBulkDeleting ? "Excluindo..." : "Excluir selecionadas"}
                  </Button>
                ) : null}
              </div>
              {isLoading ? (
                <p className="mt-3 text-xs text-muted-foreground">Carregando biblioteca...</p>
              ) : libraryImages.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">Nenhuma imagem enviada ainda.</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {libraryImages.map((item) => {
                    const effectiveSelectionUrl = currentSelectionUrl;
                    const isHighlighted = lastUploadedUrls.includes(item.url);
                    return (
                    <div
                      key={item.url}
                      className={`group overflow-hidden rounded-xl border border-border/60 bg-card/60 text-left transition hover:border-primary/40 ${
                        (effectiveSelectionUrl && item.url === effectiveSelectionUrl) || isHighlighted
                          ? "ring-2 ring-primary/60 border-primary/60"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="block w-full text-left"
                        draggable
                        onDragStart={(event) => handleDragStart(event, item.url)}
                        onClick={() => handleSelectUpload(item)}
                      >
                        <img src={item.url} alt={item.name} className="h-32 w-full object-cover" />
                        <div className="p-2 text-xs text-muted-foreground">{item.name}</div>
                      </button>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
            {sections.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                {section.description ? (
                  <p className="mt-2 text-xs text-muted-foreground">{section.description}</p>
                ) : null}
                {section.items.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">Nenhuma imagem disponivel.</p>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {section.items.map((item) => {
                      const effectiveSelectionUrl = currentSelectionUrl;
                      const isHighlighted = lastUploadedUrls.includes(item.url);
                      return (
                      <button
                        key={item.key}
                        type="button"
                        draggable
                        className={`group overflow-hidden rounded-xl border border-border/60 bg-card/60 text-left transition hover:border-primary/40 ${
                          (effectiveSelectionUrl && item.url === effectiveSelectionUrl) || isHighlighted
                            ? "ring-2 ring-primary/60 border-primary/60"
                            : ""
                        }`}
                        onDragStart={(event) => handleDragStart(event, item.url)}
                        onClick={() => {
                          const alt = getAltFromName(item.label);
                          const handler = section.onSelect || onSelect;
                          if (isSelectionMode || applyHighlightedOnClose) {
                            toggleSelection(item.url);
                            return;
                          }
                          if (allowDeselect && effectiveSelectionUrl && item.url === effectiveSelectionUrl) {
                            handler("", alt || "Imagem", item);
                            setLastUploadedUrls([]);
                          } else {
                            handler(item.url, alt || "Imagem", item);
                            if (selectOnUpload || highlightOnUpload) {
                              setLastUploadedUrls((prev) => {
                                const next = [item.url, ...prev];
                                const seen = new Set<string>();
                                return next.filter((value) => {
                                  if (!value || seen.has(value)) {
                                    return false;
                                  }
                                  seen.add(value);
                                  return true;
                                });
                              });
                            }
                          }
                          handleOpenChange(false);
                        }}
                      >
                        <img src={item.url} alt={item.label} className="h-32 w-full object-cover" />
                        <div className="p-2 text-xs text-muted-foreground">{item.label}</div>
                      </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(confirmDeleteUrls)} onOpenChange={(next) => !next && setConfirmDeleteUrls(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir imagens</DialogTitle>
            <DialogDescription>
              Esta ação remove os arquivos selecionados da biblioteca. A exclusão só é permitida se as imagens não
              estiverem em uso.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmDeleteUrls(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (confirmDeleteUrls?.length) {
                  void handleDeleteMany(confirmDeleteUrls);
                }
                setConfirmDeleteUrls(null);
              }}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageLibraryDialog;
