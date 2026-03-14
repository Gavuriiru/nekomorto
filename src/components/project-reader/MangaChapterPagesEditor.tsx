import { unzipSync } from "fflate";
import { ArrowDown, ArrowUp, ExternalLink, FileArchive, FolderOpen, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import type { Project, ProjectEpisode, ProjectEpisodePage, ProjectReaderConfig } from "@/data/projects";
import { apiFetch } from "@/lib/api-client";
import MangaViewerAdapter from "@/components/project-reader/MangaViewerAdapter";
import { downloadBinaryResponse } from "@/lib/project-epub";
import { buildProjectSnapshotForMangaExport } from "@/lib/project-manga";
import {
  normalizeProjectEpisodePages,
  normalizeProjectReaderConfig,
} from "../../../shared/project-reader.js";

type MangaChapterPagesEditorProps = {
  apiBase: string;
  projectSnapshot: Project;
  chapter: ProjectEpisode;
  uploadFolder: string;
  onChange: (nextChapter: ProjectEpisode) => void;
  previewHref?: string | null;
  readerConfig?: ProjectReaderConfig | null;
};

type PendingReplaceState = {
  index: number;
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
  }));

const buildChapterLabel = (chapter: ProjectEpisode) => {
  if (chapter.entryKind === "extra") {
    return String(chapter.displayLabel || "Extra").trim() || "Extra";
  }
  return `Capitulo ${Number(chapter.number) || 1}`;
};

const buildPreviewTitle = (chapter: ProjectEpisode) => {
  const label = buildChapterLabel(chapter);
  const title = String(chapter.title || "").trim();
  return title ? `${label} - ${title}` : label;
};

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
  previewHref,
  readerConfig,
}: MangaChapterPagesEditorProps) => {
  const pages = useMemo(() => normalizePagesForEditor(chapter.pages || []), [chapter.pages]);
  const resolvedReaderConfig = useMemo(
    () =>
      normalizeProjectReaderConfig(readerConfig, {
        projectType: "Manga",
      }),
    [readerConfig],
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"zip" | "cbz" | null>(null);
  const [pendingReplace, setPendingReplace] = useState<PendingReplaceState | null>(null);

  const setNextChapter = (nextPages: ProjectEpisodePage[], options?: { coverImageUrl?: string }) => {
    const normalizedPages = normalizePagesForEditor(nextPages);
    const fallbackCoverImageUrl = normalizedPages[0]?.imageUrl || "";
    onChange({
      ...chapter,
      content: "",
      contentFormat: normalizedPages.length > 0 ? "images" : chapter.contentFormat || "images",
      pages: normalizedPages,
      pageCount: normalizedPages.length,
      hasPages: normalizedPages.length > 0,
      coverImageUrl:
        String(options?.coverImageUrl || "").trim() ||
        String(chapter.coverImageUrl || "").trim() ||
        fallbackCoverImageUrl,
      coverImageAlt:
        String(chapter.coverImageAlt || "").trim() ||
        (fallbackCoverImageUrl ? `Capa do capitulo ${Number(chapter.number) || 1}` : ""),
    });
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

  const appendUploadedUrls = (uploadedUrls: string[], replaceIndex?: number | null) => {
    if (!uploadedUrls.length) {
      return;
    }
    const currentPages = normalizePagesForEditor(chapter.pages || []);
    const nextPages =
      Number.isFinite(Number(replaceIndex)) && replaceIndex !== null
        ? currentPages.map((page, index) =>
            index === replaceIndex ? { ...page, imageUrl: uploadedUrls[0] } : page,
          )
        : [
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

  const handleFiles = async (files: File[], options?: { replaceIndex?: number | null }) => {
    if (!files.length) {
      return;
    }
    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [];
      const sortedFiles = [...files].sort((left, right) =>
        compareNatural(
          String((left as File & { webkitRelativePath?: string }).webkitRelativePath || left.name),
          String((right as File & { webkitRelativePath?: string }).webkitRelativePath || right.name),
        ),
      );
      for (const file of sortedFiles) {
        uploadedUrls.push(await uploadBlob(file, file.name));
      }
      appendUploadedUrls(uploadedUrls, options?.replaceIndex ?? null);
      toast({
        title: uploadedUrls.length === 1 ? "Pagina enviada" : `${uploadedUrls.length} paginas enviadas`,
        intent: "success",
      });
    } catch {
      toast({
        title: "Nao foi possivel enviar as paginas",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setPendingReplace(null);
      if (replaceInputRef.current) {
        replaceInputRef.current.value = "";
      }
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
        uploadedUrls.push(await uploadBlob(entry.blob, entry.relativePath.split("/").pop() || "pagina"));
      }
      appendUploadedUrls(uploadedUrls, null);
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

  const movePage = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= pages.length) {
      return;
    }
    const nextPages = [...pages];
    const [movedPage] = nextPages.splice(index, 1);
    nextPages.splice(nextIndex, 0, movedPage);
    setNextChapter(nextPages);
  };

  const removePage = (index: number) => {
    const nextPages = pages.filter((_, pageIndex) => pageIndex !== index);
    setNextChapter(nextPages, {
      coverImageUrl:
        chapter.coverImageUrl === pages[index]?.imageUrl ? nextPages[0]?.imageUrl || "" : undefined,
    });
  };

  const setPageAsCover = (imageUrl: string) => {
    setNextChapter(pages, { coverImageUrl: imageUrl });
    toast({
      title: "Capa atualizada",
      intent: "success",
    });
  };

  const replacePage = (index: number) => {
    setPendingReplace({ index });
    replaceInputRef.current?.click();
  };

  const handleExport = async (format: "zip" | "cbz") => {
    setExportingFormat(format);
    try {
      const response = await apiFetch(
        apiBase,
        `/api/projects/${encodeURIComponent(projectSnapshot.id)}/manga-export/chapter`,
        {
          method: "POST",
          auth: true,
          json: {
            project: buildProjectSnapshotForMangaExport(projectSnapshot),
            chapterNumber: chapter.number,
            volume: chapter.volume,
            format,
          },
        },
      );
      if (!response.ok) {
        throw new Error("chapter_export_failed");
      }
      await downloadBinaryResponse(
        response,
        `capitulo-${Number(chapter.number) || 1}.${format}`,
      );
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
    <div className="space-y-5" data-testid="manga-chapter-pages-editor">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-border/50 bg-background/35 px-4 py-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
              Leitura em imagem
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
              {pages.length} pagina(s)
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Importe imagens soltas, uma pasta inteira ou um arquivo ZIP/CBZ. A ordem pode ser ajustada aqui.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            <ImagePlus className="h-4 w-4" />
            <span>Imagens</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => folderInputRef.current?.click()} disabled={isUploading}>
            <FolderOpen className="h-4 w-4" />
            <span>Pasta</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => archiveInputRef.current?.click()} disabled={isUploading}>
            <FileArchive className="h-4 w-4" />
            <span>ZIP / CBZ</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="hidden">
            <Input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => handleFiles(Array.from(event.target.files || []))}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => handleFiles(Array.from(event.target.files || []))}
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            />
            <Input
              ref={archiveInputRef}
              type="file"
              accept=".zip,.cbz,application/zip,application/x-cbz"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleArchive(file);
                }
              }}
            />
            <Input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFiles([file], { replaceIndex: pendingReplace?.index ?? null });
                }
              }}
            />
          </div>

          {pages.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pages.map((page, index) => (
                <article
                  key={`${page.imageUrl}-${page.position}`}
                  className="overflow-hidden rounded-[20px] border border-border/50 bg-card/70"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-background/60">
                    <UploadPicture
                      src={page.imageUrl}
                      alt={`Pagina ${index + 1}`}
                      preset="poster"
                      className="h-full w-full"
                      imgClassName="h-full w-full object-cover object-top"
                    />
                    <div className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
                      Pagina {index + 1}
                    </div>
                  </div>
                  <div className="space-y-3 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => movePage(index, -1)}
                        disabled={isUploading || index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                        <span>Subir</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => movePage(index, 1)}
                        disabled={isUploading || index === pages.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                        <span>Descer</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => replacePage(index)}
                        disabled={isUploading}
                      >
                        <ImagePlus className="h-4 w-4" />
                        <span>Trocar</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPageAsCover(page.imageUrl)}
                        disabled={isUploading}
                      >
                        <span>Usar capa</span>
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePage(index)}
                      disabled={isUploading}
                      className="w-full justify-center text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Remover</span>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-border/60 bg-background/35 px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma pagina adicionada. Use os botoes acima para importar o capitulo em imagem.
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-[22px] border border-border/50 bg-card/65 p-4">
            <div className="space-y-2">
              <Label className="text-sm">Preview do leitor</Label>
              <p className="text-xs text-muted-foreground">
                O preview usa o mesmo viewer publico configurado para manga/webtoon.
              </p>
            </div>
            <div className="mt-4">
              {pages.length > 0 ? (
                <MangaViewerAdapter
                  title={buildPreviewTitle(chapter)}
                  backUrl={previewHref || "#"}
                  shareUrl={previewHref || ""}
                  pages={pages}
                  direction={resolvedReaderConfig.direction || "rtl"}
                  viewMode={resolvedReaderConfig.viewMode || "page"}
                  firstPageSingle={resolvedReaderConfig.firstPageSingle !== false}
                  allowSpread={resolvedReaderConfig.allowSpread !== false}
                  showFooter={resolvedReaderConfig.showFooter !== false}
                  previewLimit={resolvedReaderConfig.previewLimit ?? null}
                  purchaseUrl={resolvedReaderConfig.purchaseUrl || ""}
                  purchasePrice={resolvedReaderConfig.purchasePrice || ""}
                  className="min-h-[520px]"
                />
              ) : (
                <div className="rounded-[18px] border border-dashed border-border/60 bg-background/35 px-4 py-10 text-center text-sm text-muted-foreground">
                  O preview aparece assim que a primeira pagina for adicionada.
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {previewHref ? (
                <Button asChild type="button" size="sm" variant="outline">
                  <a href={previewHref} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    <span>Abrir preview publico</span>
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleExport("zip")}
                disabled={pages.length === 0 || exportingFormat !== null}
              >
                {exportingFormat === "zip" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>Exportar ZIP</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleExport("cbz")}
                disabled={pages.length === 0 || exportingFormat !== null}
              >
                {exportingFormat === "cbz" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>Exportar CBZ</span>
              </Button>
              {isUploading ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Enviando paginas...</span>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MangaChapterPagesEditor;
