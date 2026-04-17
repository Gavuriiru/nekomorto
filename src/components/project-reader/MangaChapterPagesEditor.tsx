import { unzipSync } from "fflate";
import { LayoutGroup, useReducedMotion } from "framer-motion";
import { FileArchive, FolderOpen, ImagePlus, Loader2, Plus } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import DownloadSourceSelect from "@/components/project-reader/DownloadSourceSelect";
import MangaPageTile from "@/components/project-reader/MangaPageTile";
import { exportMangaChapter } from "@/components/project-reader/manga-chapter-export";
import {
  buildPreviewReorderList,
  buildReorderAnnouncement,
  getReorderLayoutTransition,
  handleAltArrowReorder,
  reorderList,
  resolvePageDisplayName,
  usePointerReorder,
} from "@/components/project-reader/page-reorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import type { Project, ProjectEpisode, ProjectEpisodePage } from "@/data/projects";
import { useAccessibilityAnnouncer } from "@/hooks/accessibility-announcer";
import { apiFetch } from "@/lib/api-client";
import { fileToDataUrl } from "@/lib/file-data-url";
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
const toBlobPart = (bytes: Uint8Array<ArrayBufferLike>) => Uint8Array.from(bytes);

const buildSpreadPairId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `spread-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getSpreadPairIds = (pages: ProjectEpisodePage[]) =>
  new Set(
    normalizeProjectEpisodePages(
      (Array.isArray(pages) ? pages : []).map((page, index) => ({
        ...page,
        position: index,
      })),
    )
      .map((page) => String(page?.spreadPairId || "").trim())
      .filter(Boolean),
  );

const getRemovedSpreadPairIds = (
  previousPages: ProjectEpisodePage[],
  nextPages: ProjectEpisodePage[],
) => {
  const previousIds = getSpreadPairIds(previousPages);
  const nextIds = getSpreadPairIds(nextPages);
  return [...previousIds].filter((spreadPairId) => !nextIds.has(spreadPairId));
};

const normalizePagesForEditor = (pages: ProjectEpisodePage[]) =>
  normalizeProjectEpisodePages(pages).map((page, index) => ({
    position: index + 1,
    imageUrl: page.imageUrl,
    spreadPairId: page.spreadPairId,
    displayName: resolvePageDisplayName({
      imageUrl: page.imageUrl,
      fallback: `Imagem ${index + 1}`,
    }),
  }));

const serializePagesForChange = (pages: ProjectEpisodePage[]) =>
  normalizeProjectEpisodePages(
    (Array.isArray(pages) ? pages : []).map((page, index) => ({
      position: index,
      imageUrl: String(page.imageUrl || "").trim(),
      spreadPairId: String(page.spreadPairId || "").trim() || undefined,
    })),
  ).map((page, index) => ({
    position: index + 1,
    imageUrl: page.imageUrl,
    ...(page.spreadPairId ? { spreadPairId: page.spreadPairId } : {}),
  }));

const archiveEntriesToFiles = async (file: File) => {
  const archiveBuffer = new Uint8Array(await file.arrayBuffer());
  const extracted = unzipSync(archiveBuffer);
  return Object.entries(extracted)
    .map(([relativePath, content]) => {
      const ext = (relativePath.split(".").pop() || "").toLowerCase();
      let type = "image/jpeg";
      if (ext === "png") type = "image/png";
      else if (ext === "gif") type = "image/gif";
      else if (ext === "webp") type = "image/webp";

      return {
        relativePath,
        blob: new Blob([toBlobPart(content)], { type }),
      };
    })
    .filter((entry) => /\.(png|jpe?g|gif|webp)$/i.test(entry.relativePath))
    .filter(
      (entry) =>
        !/\/__MACOSX\//i.test(`/${entry.relativePath}`) &&
        !/(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|._)/i.test(entry.relativePath),
    )
    .sort((left, right) => compareNatural(left.relativePath, right.relativePath));
};

type MangaEditorPage = ReturnType<typeof normalizePagesForEditor>[number];

type MangaChapterPagesGridProps = {
  layoutGroupId: string;
  pages: MangaEditorPage[];
  coverImageUrl: string;
  isUploading: boolean;
  shouldReduceMotion: boolean;
  reorderTransition: ReturnType<typeof getReorderLayoutTransition>;
  onMovePage: (fromIndex: number, toIndex: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>, index: number) => void;
  onJoinSpread: (event: MouseEvent<HTMLButtonElement>, index: number) => void;
  onUnsetSpread: (
    event: MouseEvent<HTMLButtonElement>,
    index: number,
    spreadPairId: string,
  ) => void;
  onSetCover: (event: MouseEvent<HTMLButtonElement>, index: number, imageUrl: string) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>, index: number) => void;
};

const MangaChapterPagesGrid = memo(
  ({
    layoutGroupId,
    pages,
    coverImageUrl,
    isUploading,
    shouldReduceMotion,
    reorderTransition,
    onMovePage,
    onKeyDown,
    onJoinSpread,
    onUnsetSpread,
    onSetCover,
    onRemove,
  }: MangaChapterPagesGridProps) => {
    const gridRef = useRef<HTMLDivElement | null>(null);
    const {
      cancelPointerReorder,
      pointerDragState,
      startPointerReorder,
    } = usePointerReorder({
      containerRef: gridRef,
      disabled: isUploading,
      itemCount: pages.length,
      onCommit: onMovePage,
      scope: "manga-page",
    });
    const dragIndex = pointerDragState?.isDragging ? pointerDragState.sourceIndex : null;
    const dragOverIndex = pointerDragState?.isDragging ? pointerDragState.overIndex : null;
    const previewPages = useMemo(
      () => buildPreviewReorderList(pages, dragIndex, dragOverIndex),
      [dragIndex, dragOverIndex, pages],
    );
    const draggedPage = dragIndex !== null ? pages[dragIndex] : null;
    const pressedPage =
      pointerDragState?.sourceIndex !== undefined ? pages[pointerDragState.sourceIndex] : null;
    const shouldUseAnimatedLayout = dragIndex !== null || dragOverIndex !== null;

    const renderTile = (page: MangaEditorPage, index: number) => {
      const isCover = coverImageUrl === page.imageUrl;
      const isSpread = Boolean(page.spreadPairId);
      const isDragged = draggedPage === page;
      const isPreviewTarget = dragIndex !== null && dragOverIndex === index;
      const pageList = shouldUseAnimatedLayout ? previewPages : pages;
      const canJoinWithNext = Boolean(
        !page.spreadPairId && pageList[index + 1] && !pageList[index + 1]?.spreadPairId,
      );

      return (
        <MangaPageTile
          key={`${page.imageUrl}-${page.position}`}
          testIdPrefix="manga-page"
          src={page.imageUrl}
          alt={`Página ${index + 1}`}
          displayName={page.displayName}
          index={index}
          spreadPairId={page.spreadPairId}
          isCover={isCover}
          isSpread={isSpread}
          isDragged={isDragged}
          isPreviewTarget={isPreviewTarget}
          isPressed={pressedPage === page}
          disabled={isUploading}
          canJoinWithNext={canJoinWithNext}
          reorderMotion={shouldReduceMotion ? "reduced" : "spring"}
          reorderTransition={reorderTransition}
          onPointerDown={startPointerReorder}
          onPointerCancel={cancelPointerReorder}
          onKeyDown={onKeyDown}
          onJoinSpread={canJoinWithNext ? onJoinSpread : undefined}
          onUnsetSpread={isSpread && page.spreadPairId ? onUnsetSpread : undefined}
          onSetCover={isCover ? undefined : onSetCover}
          onRemove={onRemove}
        />
      );
    };

    const grid = (
      <div
        ref={gridRef}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        data-testid="manga-pages-grid"
      >
        {(shouldUseAnimatedLayout ? previewPages : pages).map(renderTile)}
      </div>
    );

    return <LayoutGroup id={layoutGroupId}>{grid}</LayoutGroup>;
  },
);

MangaChapterPagesGrid.displayName = "MangaChapterPagesGrid";

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
  const [isExportingZip, setIsExportingZip] = useState(false);
  const reorderTransition = useMemo(
    () => getReorderLayoutTransition(!!shouldReduceMotion),
    [shouldReduceMotion],
  );

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
        (fallbackCoverImageUrl ? `Capa do capítulo ${Number(chapter.number) || 1}` : ""),
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
          uploadedUrls.length === 1 ? "Página enviada" : `${uploadedUrls.length} páginas enviadas`,
        intent: "success",
      });
    } catch {
      toast({
        title: "Não foi possível enviar as páginas",
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
        description: `${uploadedUrls.length} página(s) adicionada(s).`,
        intent: "success",
      });
    } catch {
      toast({
        title: "Não foi possível importar o arquivo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (archiveInputRef.current) {
        archiveInputRef.current.value = "";
      }
    }
  };

  const movePage = (fromIndex: number, toIndex: number) => {
    const nextPages = reorderList(pages, fromIndex, toIndex);
    if (nextPages === pages) {
      return;
    }
    setNextChapter(nextPages);
    const removedSpreadPairIds = getRemovedSpreadPairIds(pages, nextPages);
    announce(
      removedSpreadPairIds.length > 0
        ? `${buildReorderAnnouncement(`Pagina ${fromIndex + 1}`, toIndex)} Spread desfeito porque as paginas deixaram de ficar juntas.`
        : buildReorderAnnouncement(`Pagina ${fromIndex + 1}`, toIndex),
    );
  };

  const handlePageKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    handleAltArrowReorder({
      event,
      index,
      total: pages.length,
      label: `Página ${index + 1}`,
      disabled: isUploading,
      onMove: (targetIndex) => {
        const nextPages = reorderList(pages, index, targetIndex);
        if (nextPages !== pages) {
          setNextChapter(nextPages);
          const removedSpreadPairIds = getRemovedSpreadPairIds(pages, nextPages);
          announce(
            removedSpreadPairIds.length > 0
              ? `${buildReorderAnnouncement(`Pagina ${index + 1}`, targetIndex)} Spread desfeito porque as paginas deixaram de ficar juntas.`
              : buildReorderAnnouncement(`Pagina ${index + 1}`, targetIndex),
          );
        }
      },
      onAnnounce: undefined,
    });
  };

  const removePage = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    event.stopPropagation();
    const nextPages = pages.filter((_, pageIndex) => pageIndex !== index);
    const normalizedNextPages = serializePagesForChange(nextPages);
    setChapterState(
      {
        coverImageUrl:
          chapter.coverImageUrl === pages[index]?.imageUrl
            ? nextPages[0]?.imageUrl || ""
            : undefined,
      },
      normalizedNextPages,
    );
    if (getRemovedSpreadPairIds(pages, normalizedNextPages).length > 0) {
      announce("Spread desfeito após remover a página.");
    }
  };

  const joinSpreadPair = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    event.stopPropagation();
    const nextPage = pages[index + 1];
    if (!pages[index] || !nextPage || pages[index].spreadPairId || nextPage.spreadPairId) {
      return;
    }
    const spreadPairId = buildSpreadPairId();
    const nextPages = pages.map((page, pageIndex) =>
      pageIndex === index || pageIndex === index + 1 ? { ...page, spreadPairId } : page,
    );
    setNextChapter(nextPages);
    announce(`Spread criado entre as paginas ${index + 1} e ${index + 2}.`);
  };

  const unsetSpreadPair = (
    event: MouseEvent<HTMLButtonElement>,
    _index: number,
    spreadPairId: string,
  ) => {
    event.stopPropagation();
    if (!spreadPairId) {
      return;
    }
    const pairedPageIndexes = pages.reduce<number[]>((result, page, index) => {
      if (page.spreadPairId === spreadPairId) {
        result.push(index + 1);
      }
      return result;
    }, []);
    const nextPages = pages.map((page) =>
      page.spreadPairId === spreadPairId ? { ...page, spreadPairId: undefined } : page,
    );
    setNextChapter(nextPages);
    if (pairedPageIndexes.length >= 2) {
      announce(`Spread removido das paginas ${pairedPageIndexes[0]} e ${pairedPageIndexes[1]}.`);
    }
  };

  const setPageAsCover = (
    event: MouseEvent<HTMLButtonElement>,
    _index: number,
    imageUrl: string,
  ) => {
    event.stopPropagation();
    setNextChapter(pages, { coverImageUrl: imageUrl });
    toast({
      title: "Capa atualizada",
      intent: "success",
    });
  };

  const handleExport = async () => {
    setIsExportingZip(true);
    try {
      await exportMangaChapter({
        apiBase,
        projectId: String(projectSnapshot.id || ""),
        projectSnapshot,
        chapter,
      });
      toast({
        title: "ZIP exportado",
        intent: "success",
      });
    } catch {
      toast({
        title: "Não foi possível exportar o capítulo",
        variant: "destructive",
      });
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="manga-chapter-pages-editor">
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid="manga-pages-actions"
      >
        <div className="flex flex-wrap items-center gap-2" data-testid="manga-pages-upload-actions">
          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
            {pages.length} página(s)
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
            <span>ZIP</span>
          </Button>
          {isUploading ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Enviando páginas...</span>
            </div>
          ) : null}
        </div>

        <div
          className="flex flex-wrap items-center gap-2 sm:justify-end"
          data-testid="manga-pages-export-actions"
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleExport()}
            disabled={pages.length === 0 || isExportingZip}
          >
            {isExportingZip ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>ZIP</span>
          </Button>
        </div>
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
        <MangaChapterPagesGrid
          layoutGroupId={`manga-pages-${projectSnapshot.id}-${chapter.number}-${chapter.volume ?? "none"}`}
          pages={pages}
          coverImageUrl={chapter.coverImageUrl || ""}
          isUploading={isUploading}
          shouldReduceMotion={!!shouldReduceMotion}
          reorderTransition={reorderTransition}
          onMovePage={movePage}
          onKeyDown={handlePageKeyDown}
          onJoinSpread={joinSpreadPair}
          onUnsetSpread={unsetSpreadPair}
          onSetCover={setPageAsCover}
          onRemove={removePage}
        />
      ) : (
        <div
          className="rounded-[20px] border border-dashed border-border/60 bg-background/35 px-4 py-8 text-center text-sm text-muted-foreground"
          data-testid="manga-pages-empty-state"
        >
          <p>Nenhuma página adicionada ainda.</p>
        </div>
      )}

      <section
        className="rounded-[22px] border border-border/50 bg-card/55 p-4"
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
              <DownloadSourceSelect
                value={source.label}
                ariaLabel={`Fonte ${sourceIndex + 1}`}
                legacyLabels={(chapter.sources || []).map((item) => item.label)}
                onValueChange={(value) =>
                  setChapterState({
                    sources: (chapter.sources || []).map((item, index) =>
                      index === sourceIndex ? { ...item, label: value } : item,
                    ),
                  })
                }
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
                disabled={!String(source.label || "").trim()}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setChapterState({
                      sources: (chapter.sources || []).filter((_, index) => index !== sourceIndex),
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
      </section>
    </div>
  );
};

export default MangaChapterPagesEditor;
