import { unzipSync } from "fflate";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  FileArchive,
  FolderOpen,
  ImagePlus,
  Loader2,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { useAccessibilityAnnouncer } from "@/hooks/accessibility-announcer";
import type { Project, ProjectEpisode, ProjectEpisodePage } from "@/data/projects";
import { apiFetch } from "@/lib/api-client";
import {
  buildReorderAnnouncement,
  getReorderLayoutTransition,
  buildPreviewReorderList,
  handleAltArrowReorder,
  reorderList,
  resolvePageDisplayName,
  setDragPreviewFromElement,
} from "@/components/project-reader/page-reorder";
import { exportMangaChapter } from "@/components/project-reader/manga-chapter-export";
import { normalizeProjectEpisodePages } from "../../../shared/project-reader.js";

type MangaChapterPagesEditorProps = {
  apiBase: string;
  projectSnapshot: Project;
  chapter: ProjectEpisode;
  uploadFolder: string;
  onChange: (nextChapter: ProjectEpisode) => void;
};

const NATURAL_COLLATOR = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});

const compareNatural = (left: string, right: string) => NATURAL_COLLATOR.compare(left, right);

const fileToDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });

const normalizePagesForEditor = (pages: ProjectEpisodePage[]) =>
  normalizeProjectEpisodePages(pages).map((page, index) => ({
    position: index + 1,
    imageUrl: page.imageUrl,
    displayName: resolvePageDisplayName({
      imageUrl: page.imageUrl,
      fallback: `Imagem ${index + 1}`,
    }),
  }));

const serializePagesForChange = (pages: ProjectEpisodePage[]) =>
  (Array.isArray(pages) ? pages : [])
    .map((page, index) => ({
      position: index + 1,
      imageUrl: String(page.imageUrl || "").trim(),
    }))
    .filter((page) => page.imageUrl);

const archiveEntriesToFiles = async (file: File) => {
  const archiveBuffer = new Uint8Array(await file.arrayBuffer());
  const extracted = unzipSync(archiveBuffer);
  return Object.entries(extracted)
    .map(([relativePath, content]) => ({
      relativePath,
      blob: new Blob([content]),
    }))
    .filter((entry) => /\.(png|jpe?g|gif|webp)$/i.test(entry.relativePath))
    .filter(
      (entry) =>
        !/\/__MACOSX\//i.test(`/${entry.relativePath}`) &&
        !/(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|._)/i.test(entry.relativePath),
    )
    .sort((left, right) => compareNatural(left.relativePath, right.relativePath));
};

const MangaChapterPagesEditor = ({
  apiBase,
  projectSnapshot,
  chapter,
  uploadFolder,
  onChange,
}: MangaChapterPagesEditorProps) => {
  const pages = useMemo(() => normalizePagesForEditor(chapter.pages || []), [chapter.pages]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const { announce } = useAccessibilityAnnouncer();
  const shouldReduceMotion = useReducedMotion();
  const [isUploading, setIsUploading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"zip" | "cbz" | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const reorderTransition = useMemo(
    () => getReorderLayoutTransition(!!shouldReduceMotion),
    [shouldReduceMotion],
  );
  const previewPages = useMemo(
    () => buildPreviewReorderList(pages, dragIndex, dragOverIndex),
    [dragIndex, dragOverIndex, pages],
  );
  const draggedPage = dragIndex !== null ? pages[dragIndex] : null;

  const setChapterState = (
    overrides: Partial<ProjectEpisode>,
    nextPagesInput: ProjectEpisodePage[] = pages,
  ) => {
    const normalizedPages = serializePagesForChange(nextPagesInput);
    const fallbackCoverImageUrl = normalizedPages[0]?.imageUrl || "";
    const coverImageUrl =
      overrides.coverImageUrl !== undefined ? overrides.coverImageUrl : chapter.coverImageUrl;
    const coverImageAlt =
      overrides.coverImageAlt !== undefined ? overrides.coverImageAlt : chapter.coverImageAlt;
    onChange({
      ...chapter,
      ...overrides,
      content: "",
      contentFormat: normalizedPages.length > 0 ? "images" : chapter.contentFormat || "images",
      pages: normalizedPages,
      pageCount: normalizedPages.length,
      hasPages: normalizedPages.length > 0,
      coverImageUrl: String(coverImageUrl || "").trim() || fallbackCoverImageUrl,
      coverImageAlt:
        String(coverImageAlt || "").trim() ||
        (fallbackCoverImageUrl ? `Capa do capitulo ${Number(chapter.number) || 1}` : ""),
    });
  };

  const setNextChapter = (
    nextPages: ProjectEpisodePage[],
    options?: { coverImageUrl?: string },
  ) => {
    const normalizedPages = serializePagesForChange(nextPages);
    setChapterState(
      {
        coverImageUrl: options?.coverImageUrl,
      },
      normalizedPages,
    );
  };

  const uploadBlob = async (blob: Blob, filename: string) => {
    const dataUrl = await fileToDataUrl(blob);
    const response = await apiFetch(apiBase, "/api/uploads/image", {
      method: "POST",
      auth: true,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dataUrl,
        filename,
        folder: uploadFolder,
      }),
    });
    if (!response.ok) {
      throw new Error("page_upload_failed");
    }
    const data = (await response.json().catch(() => null)) as { url?: string } | null;
    const url = String(data?.url || "").trim();
    if (!url) {
      throw new Error("page_upload_missing_url");
    }
    return url;
  };

  const appendUploadedUrls = (uploadedUrls: string[]) => {
    if (!uploadedUrls.length) {
      return;
    }
    const currentPages = normalizePagesForEditor(chapter.pages || []);
    const nextPages = [
      ...currentPages,
      ...uploadedUrls.map((imageUrl, index) => ({
        position: currentPages.length + index + 1,
        imageUrl,
      })),
    ];
    setNextChapter(nextPages, {
      coverImageUrl: currentPages.length === 0 ? uploadedUrls[0] : undefined,
    });
  };

  const handleFiles = async (files: File[]) => {
    if (!files.length) {
      return;
    }
    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [];
      const sortedFiles = [...files].sort((left, right) =>
        compareNatural(
          String((left as File & { webkitRelativePath?: string }).webkitRelativePath || left.name),
          String(
            (right as File & { webkitRelativePath?: string }).webkitRelativePath || right.name,
          ),
        ),
      );
      for (const file of sortedFiles) {
        uploadedUrls.push(await uploadBlob(file, file.name));
      }
      appendUploadedUrls(uploadedUrls);
      toast({
        title:
          uploadedUrls.length === 1 ? "Pagina enviada" : `${uploadedUrls.length} paginas enviadas`,
        intent: "success",
      });
    } catch {
      toast({
        title: "Nao foi possivel enviar as paginas",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleArchive = async (file: File) => {
    setIsUploading(true);
    try {
      const entries = await archiveEntriesToFiles(file);
      if (!entries.length) {
        toast({
          title: "Nenhuma imagem encontrada no arquivo",
          variant: "destructive",
        });
        return;
      }
      const uploadedUrls: string[] = [];
      for (const entry of entries) {
        uploadedUrls.push(
          await uploadBlob(entry.blob, entry.relativePath.split("/").pop() || "pagina"),
        );
      }
      appendUploadedUrls(uploadedUrls);
      toast({
        title: "Arquivo importado",
        description: `${uploadedUrls.length} pagina(s) adicionada(s).`,
        intent: "success",
      });
    } catch {
      toast({
        title: "Nao foi possivel importar o arquivo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (archiveInputRef.current) {
        archiveInputRef.current.value = "";
      }
    }
  };

  const clearDragState = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const movePage = (fromIndex: number, toIndex: number) => {
    const nextPages = reorderList(pages, fromIndex, toIndex);
    if (nextPages === pages) {
      return;
    }
    setNextChapter(nextPages);
    announce(buildReorderAnnouncement(`Pagina ${fromIndex + 1}`, toIndex));
  };

  const handlePageDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (isUploading) {
      event.preventDefault();
      return;
    }
    setDragIndex(index);
    setDragOverIndex(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      setDragPreviewFromElement(event, event.currentTarget);
      try {
        event.dataTransfer.setData("text/plain", String(index));
      } catch {
        // Ignore browser/test environments that block custom drag payloads.
      }
    }
  };

  const handlePageDragOver = (event: DragEvent<HTMLElement>, index: number) => {
    if (isUploading || dragIndex === null) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handlePageDrop = (event: DragEvent<HTMLElement>, index: number) => {
    event.preventDefault();
    const fromIndex = dragIndex;
    clearDragState();
    if (isUploading || fromIndex === null || fromIndex === index) {
      return;
    }
    movePage(fromIndex, index);
  };

  const handlePageKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    handleAltArrowReorder({
      event,
      index,
      total: pages.length,
      label: `Pagina ${index + 1}`,
      disabled: isUploading,
      onMove: (targetIndex) => {
        const nextPages = reorderList(pages, index, targetIndex);
        if (nextPages !== pages) {
          setNextChapter(nextPages);
        }
      },
      onAnnounce: announce,
    });
  };

  const removePage = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    event.stopPropagation();
    const nextPages = pages.filter((_, pageIndex) => pageIndex !== index);
    setNextChapter(nextPages, {
      coverImageUrl:
        chapter.coverImageUrl === pages[index]?.imageUrl ? nextPages[0]?.imageUrl || "" : undefined,
    });
  };

  const setPageAsCover = (event: MouseEvent<HTMLButtonElement>, imageUrl: string) => {
    event.stopPropagation();
    setNextChapter(pages, { coverImageUrl: imageUrl });
    toast({
      title: "Capa atualizada",
      intent: "success",
    });
  };

  const handleExport = async (format: "zip" | "cbz") => {
    setExportingFormat(format);
    try {
      await exportMangaChapter({
        apiBase,
        projectId: String(projectSnapshot.id || ""),
        projectSnapshot,
        chapter,
        format,
      });
      toast({
        title: format === "cbz" ? "CBZ exportado" : "ZIP exportado",
        intent: "success",
      });
    } catch {
      toast({
        title: "Nao foi possivel exportar o capitulo",
        variant: "destructive",
      });
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="space-y-4" data-testid="manga-chapter-pages-editor">
      <div className="flex flex-wrap items-center gap-2" data-testid="manga-pages-actions">
        <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
          {pages.length} pagina(s)
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <ImagePlus className="h-4 w-4" />
          <span>Imagens</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => folderInputRef.current?.click()}
          disabled={isUploading}
        >
          <FolderOpen className="h-4 w-4" />
          <span>Pasta</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => archiveInputRef.current?.click()}
          disabled={isUploading}
        >
          <FileArchive className="h-4 w-4" />
          <span>ZIP / CBZ</span>
        </Button>
        {isUploading ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Enviando paginas...</span>
          </div>
        ) : null}
      </div>

      <div className="hidden">
        <Input
          ref={fileInputRef}
          data-testid="manga-pages-file-input"
          type="file"
          multiple
          accept="image/*"
          onChange={(event) => void handleFiles(Array.from(event.target.files || []))}
        />
        <input
          ref={folderInputRef}
          data-testid="manga-pages-folder-input"
          type="file"
          multiple
          accept="image/*"
          onChange={(event) => void handleFiles(Array.from(event.target.files || []))}
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        />
        <Input
          ref={archiveInputRef}
          data-testid="manga-pages-archive-input"
          type="file"
          accept=".zip,.cbz,application/zip,application/x-cbz"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleArchive(file);
            }
          }}
        />
      </div>

      {pages.length > 0 ? (
        <LayoutGroup
          id={`manga-pages-${projectSnapshot.id}-${chapter.number}-${chapter.volume ?? "none"}`}
        >
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            data-testid="manga-pages-grid"
          >
            {previewPages.map((page, index) => {
              const isCover = chapter.coverImageUrl === page.imageUrl;
              const isDragged = draggedPage === page;
              const isPreviewTarget = dragIndex !== null && dragOverIndex === index;
              return (
                <motion.article
                  key={`${page.imageUrl}-${page.position}`}
                  layout={!isDragged}
                  transition={reorderTransition}
                  className="group"
                  data-testid={`manga-page-card-${index}`}
                  data-reorder-layout={!isDragged ? "animated" : "static"}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    draggable={!isUploading}
                    onDragStart={(event) => handlePageDragStart(event, index)}
                    onDragEnd={clearDragState}
                    onDragOver={(event) => handlePageDragOver(event, index)}
                    onDrop={(event) => handlePageDrop(event, index)}
                    onKeyDown={(event) => handlePageKeyDown(event, index)}
                    aria-label={`Arrastar pagina ${index + 1} para reordenar. Use Alt+Seta para mover pelo teclado.`}
                    title={page.displayName}
                    data-testid={`manga-page-surface-${index}`}
                    data-reorder-motion={shouldReduceMotion ? "reduced" : "spring"}
                    data-reorder-state={
                      isDragged ? "dragging" : isPreviewTarget ? "preview-target" : "idle"
                    }
                    className={`relative aspect-[3/4] overflow-hidden rounded-[22px] border bg-card/75 transition ${
                      isDragged
                        ? "z-10 cursor-grabbing border-primary/60 opacity-85 ring-2 ring-primary/25 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.45)]"
                        : isPreviewTarget
                          ? "cursor-grab border-primary/60 ring-2 ring-primary/15"
                          : "cursor-grab border-border/50"
                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`}
                  >
                    <UploadPicture
                      src={page.imageUrl}
                      alt={`Pagina ${index + 1}`}
                      preset="poster"
                      className="h-full w-full"
                      imgClassName="h-full w-full object-cover object-top"
                    />
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
                      <span className="rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="pointer-events-auto flex items-center gap-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                        {isCover ? (
                          <Badge className="rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em]">
                            Capa
                          </Badge>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            onClick={(event) => setPageAsCover(event, page.imageUrl)}
                            disabled={isUploading}
                            className="h-9 w-9 rounded-full border border-border/60 bg-background/90 shadow-sm"
                          >
                            <Star className="h-4 w-4" />
                            <span className="sr-only">Usar capa</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={(event) => removePage(event, index)}
                          disabled={isUploading}
                          className="h-9 w-9 rounded-full border border-border/60 bg-background/90 text-destructive shadow-sm hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remover</span>
                        </Button>
                      </div>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-3 pb-3 pt-12 opacity-0 transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                      <span
                        className="block truncate text-xs font-medium text-white"
                        title={page.displayName}
                        data-testid={`manga-page-filename-${index}`}
                      >
                        {page.displayName}
                      </span>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </LayoutGroup>
      ) : (
        <div
          className="rounded-[20px] border border-dashed border-border/60 bg-background/35 px-4 py-8 text-center text-sm text-muted-foreground"
          data-testid="manga-pages-empty-state"
        >
          <p>Nenhuma pagina adicionada ainda.</p>
        </div>
      )}

      <section
        className="overflow-hidden rounded-[22px] border border-border/50 bg-card/55"
        data-testid="manga-pages-utilities"
      >
        <button
          type="button"
          data-testid="manga-pages-utilities-trigger"
          aria-expanded={isAdvancedOpen ? "true" : "false"}
          onClick={() => setIsAdvancedOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-background/25"
        >
          <div className="space-y-1">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Utilitarios do capitulo
            </p>
            <p className="text-xs text-muted-foreground">
              Exportacao rapida e fontes opcionais no mesmo contexto das paginas.
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
              isAdvancedOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isAdvancedOpen ? (
          <div
            className="grid gap-3 border-t border-border/50 px-4 py-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]"
            data-testid="manga-pages-utilities-panel"
          >
            <div
              className="rounded-[20px] border border-dashed border-border/50 bg-background/30 p-4"
              data-testid="manga-pages-export"
            >
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm">Exportacao do capitulo</Label>
                  <p className="text-xs text-muted-foreground">
                    Gere um ZIP ou CBZ com as paginas do capitulo atual.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleExport("zip")}
                    disabled={pages.length === 0 || exportingFormat !== null}
                  >
                    {exportingFormat === "zip" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    <span>Exportar ZIP</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleExport("cbz")}
                    disabled={pages.length === 0 || exportingFormat !== null}
                  >
                    {exportingFormat === "cbz" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    <span>Exportar CBZ</span>
                  </Button>
                </div>
              </div>
            </div>

            <div
              className="rounded-[20px] border border-border/50 bg-background/35 p-4"
              data-testid="manga-pages-sources"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Fontes de download</Label>
                  <p className="text-xs text-muted-foreground">
                    Links opcionais para leitura externa ou downloads adicionais.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setChapterState({
                      sources: [...(chapter.sources || []), { label: "", url: "" }],
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  <span>Adicionar</span>
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {(chapter.sources || []).map((source, sourceIndex) => (
                  <div
                    key={`chapter-source-${sourceIndex}`}
                    className="grid gap-2 rounded-xl border border-border/60 bg-card/70 p-3"
                  >
                    <Input
                      value={source.label}
                      onChange={(event) =>
                        setChapterState({
                          sources: (chapter.sources || []).map((item, index) =>
                            index === sourceIndex ? { ...item, label: event.target.value } : item,
                          ),
                        })
                      }
                      placeholder="Fonte"
                    />
                    <Input
                      value={source.url}
                      onChange={(event) =>
                        setChapterState({
                          sources: (chapter.sources || []).map((item, index) =>
                            index === sourceIndex ? { ...item, url: event.target.value } : item,
                          ),
                        })
                      }
                      placeholder="URL"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setChapterState({
                            sources: (chapter.sources || []).filter(
                              (_, index) => index !== sourceIndex,
                            ),
                          })
                        }
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}

                {(chapter.sources || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default MangaChapterPagesEditor;
