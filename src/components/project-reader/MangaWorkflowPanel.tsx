import { unzipSync } from "fflate";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileArchive,
  FolderOpen,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MangaViewerAdapter from "@/components/project-reader/MangaViewerAdapter";
import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Project, ProjectEpisode, ProjectReaderConfig } from "@/data/projects";
import {
  buildDashboardProjectChapterEditorHref,
  buildProjectPublicReadingHref,
} from "@/lib/project-editor-routes";
import { apiFetch } from "@/lib/api-client";
import { downloadBinaryResponse } from "@/lib/project-epub";
import { buildEpisodeKey } from "@/lib/project-episode-key";
import { buildChapterFolder, resolveProjectImageFolders } from "@/lib/project-image-folders";
import {
  buildProjectSnapshotForMangaExport,
  mergeImportedImageChaptersIntoProject,
  normalizeProjectImageExportJob,
} from "@/lib/project-manga";

type ProjectRecord = Project & { revision?: string };
type ChapterFilterMode = "all" | "draft" | "published" | "with-content" | "without-content";
type StageAction = "create" | "update" | "ignore";

type StagePage = {
  id: string;
  file: File;
  previewUrl: string;
  relativePath: string;
  name: string;
};

type StageChapter = {
  id: string;
  number: number;
  volume: number | null;
  title: string;
  titleDetected: string;
  sourceLabel: string;
  pages: StagePage[];
  coverPageId: string | null;
  publicationStatus: "draft" | "published";
  action: StageAction;
  suggestedAction: "create" | "update";
  warnings: string[];
};

type ImportEntry = {
  relativePath: string;
  file: File;
};

type MangaWorkflowPanelProps = {
  apiBase: string;
  project: ProjectRecord;
  projectSnapshot: ProjectRecord;
  selectedVolume: number | null;
  filterMode: ChapterFilterMode;
  filteredChapters: ProjectEpisode[];
  readerConfig: ProjectReaderConfig;
  onPersistProjectSnapshot: (
    snapshot: ProjectRecord,
    options: { context: "manga-import" | "manga-publication" },
  ) => Promise<ProjectRecord | null>;
  onProjectChange: (nextProject: ProjectRecord) => void;
  onNavigateToChapter: (chapter: ProjectEpisode) => void;
};

const CHAPTER_FILTER_MODE_LABELS: Record<ChapterFilterMode, string> = {
  all: "Todos",
  draft: "Rascunhos",
  published: "Publicados",
  "with-content": "Com paginas",
  "without-content": "Sem paginas",
};

const NATURAL_COLLATOR = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});

const compareNatural = (left: string, right: string) => NATURAL_COLLATOR.compare(left, right);
const normalizeText = (value: unknown) => String(value || "").trim();
const normalizeRelativeImportPath = (value: unknown) =>
  String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .trim();
const createStageId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `stage-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const getFileExtension = (value: string) => {
  const index = value.lastIndexOf(".");
  return index >= 0 ? value.slice(index).toLowerCase() : "";
};
const parsePositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
};
const revokeStagePages = (chapters: StageChapter[]) =>
  chapters.forEach((chapter) =>
    chapter.pages.forEach((page) => URL.revokeObjectURL(page.previewUrl)),
  );
const createStagePage = (file: File, relativePath: string): StagePage => ({
  id: createStageId(),
  file,
  previewUrl: URL.createObjectURL(file),
  relativePath,
  name: file.name,
});

const isIgnoredImportPath = (relativePath: string) => {
  const normalized = normalizeRelativeImportPath(relativePath);
  if (!normalized) {
    return true;
  }
  const baseName = normalized.split("/").pop()?.toLowerCase() || "";
  if (
    baseName === ".ds_store" ||
    baseName === "thumbs.db" ||
    baseName === "desktop.ini" ||
    baseName.startsWith("._") ||
    baseName.startsWith(".")
  ) {
    return true;
  }
  return normalized
    .split("/")
    .map((segment) => segment.trim().toLowerCase())
    .some((segment) => segment === "__macosx");
};

const isSupportedImagePath = (relativePath: string) =>
  [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(getFileExtension(relativePath));

const stripCommonPrefix = (value: string, pattern: RegExp) =>
  value
    .replace(pattern, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseVolumeNumber = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  const explicitMatch = normalized.match(/\b(?:vol(?:ume)?|tomo|book|livro)\s*[-_ ]*(\d+)\b/i);
  if (explicitMatch?.[1]) {
    return parsePositiveInteger(explicitMatch[1]);
  }
  const genericMatch = normalized.match(/(\d+)/);
  return genericMatch?.[1] ? parsePositiveInteger(genericMatch[1]) : null;
};

const parseChapterNumber = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  const explicitMatch = normalized.match(
    /\b(?:cap(?:itulo|itulo)?|chapter|chap|ch|episode|episodio|ep)\s*[-_ ]*(\d+)\b/i,
  );
  if (explicitMatch?.[1]) {
    return parsePositiveInteger(explicitMatch[1]);
  }
  const genericMatch = normalized.match(/(\d+)/);
  return genericMatch?.[1] ? parsePositiveInteger(genericMatch[1]) : null;
};

const detectChapterTitle = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }
  const withoutPrefix = stripCommonPrefix(
    normalized,
    /^\s*(?:cap(?:itulo|itulo)?|chapter|chap|ch|episode|episodio|ep)\s*[-_ ]*\d+\s*[-_:]?\s*/i,
  );
  return stripCommonPrefix(withoutPrefix, /^\s*\d+\s*[-_:]?\s*/);
};

const fileToDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const buildVolumeLabel = (value: number | null | undefined) =>
  Number.isFinite(Number(value)) && Number(value) > 0 ? `Volume ${Number(value)}` : "Sem volume";

const buildStageChapterLabel = (chapter: Pick<StageChapter, "number" | "volume" | "title">) => {
  const title = normalizeText(chapter.title);
  const baseLabel = `${buildVolumeLabel(chapter.volume)} • Capitulo ${chapter.number}`;
  return title ? `${baseLabel} • ${title}` : baseLabel;
};

const buildExistingChapterLabel = (chapter: ProjectEpisode) => {
  const title = normalizeText(chapter.title);
  const baseLabel = `${buildVolumeLabel(
    Number.isFinite(Number(chapter.volume)) ? Number(chapter.volume) : null,
  )} • Capitulo ${Number(chapter.number) || 1}`;
  return title ? `${baseLabel} • ${title}` : baseLabel;
};

const readArchiveEntries = async (archiveFile: File): Promise<ImportEntry[]> => {
  const archiveBuffer = new Uint8Array(await archiveFile.arrayBuffer());
  const extracted = unzipSync(archiveBuffer);
  return Object.entries(extracted)
    .map(([relativePath, content]) => {
      const normalizedPath = normalizeRelativeImportPath(relativePath);
      const name = normalizedPath.split("/").pop() || "pagina";
      const file = new File([content], name, {
        type:
          getFileExtension(name) === ".png"
            ? "image/png"
            : getFileExtension(name) === ".gif"
              ? "image/gif"
              : getFileExtension(name) === ".webp"
                ? "image/webp"
                : "image/jpeg",
      });
      return { relativePath: normalizedPath, file };
    })
    .filter((entry) => entry.file.size > 0)
    .filter((entry) => !isIgnoredImportPath(entry.relativePath))
    .filter((entry) => isSupportedImagePath(entry.relativePath))
    .sort((left, right) => compareNatural(left.relativePath, right.relativePath));
};

const readDirectEntries = (files: File[]) =>
  files
    .map((file) => ({
      relativePath: normalizeRelativeImportPath(
        String((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name),
      ),
      file,
    }))
    .filter((entry) => entry.file.size > 0)
    .filter((entry) => !isIgnoredImportPath(entry.relativePath))
    .filter((entry) => isSupportedImagePath(entry.relativePath))
    .sort((left, right) => compareNatural(left.relativePath, right.relativePath));

const detectImportLayout = (entries: ImportEntry[]) => {
  const hasRootFiles = entries.some(
    (entry) => entry.relativePath.split("/").filter(Boolean).length === 1,
  );
  if (hasRootFiles) {
    return "single" as const;
  }
  const hasSecondLevel = entries.some(
    (entry) => entry.relativePath.split("/").filter(Boolean).length >= 3,
  );
  return hasSecondLevel ? ("volumes" as const) : ("chapters" as const);
};

const buildExistingChapterLookup = (project: ProjectRecord) =>
  new Map(
    (Array.isArray(project.episodeDownloads) ? project.episodeDownloads : []).map((episode) => [
      buildEpisodeKey(episode.number, episode.volume),
      episode,
    ]),
  );

const buildNextChapterNumberByVolume = (project: ProjectRecord, staged: StageChapter[] = []) => {
  const nextByVolume = new Map<string, number>();
  (Array.isArray(project.episodeDownloads) ? project.episodeDownloads : []).forEach((episode) => {
    const volumeKey = Number.isFinite(Number(episode.volume)) ? String(Number(episode.volume)) : "none";
    const current = nextByVolume.get(volumeKey) || 1;
    const chapterNumber = parsePositiveInteger(episode.number) || 0;
    if (chapterNumber >= current) {
      nextByVolume.set(volumeKey, chapterNumber + 1);
    }
  });
  staged.forEach((chapter) => {
    const volumeKey = chapter.volume !== null ? String(chapter.volume) : "none";
    const current = nextByVolume.get(volumeKey) || 1;
    if (chapter.number >= current) {
      nextByVolume.set(volumeKey, chapter.number + 1);
    }
  });
  return nextByVolume;
};

const buildStageChaptersFromEntries = ({
  project,
  entries,
  targetVolume,
  defaultStatus,
}: {
  project: ProjectRecord;
  entries: ImportEntry[];
  targetVolume: number | null;
  defaultStatus: "draft" | "published";
}) => {
  const layout = detectImportLayout(entries);
  const groups = new Map<
    string,
    {
      volumeHint: number | null;
      chapterHint: number | null;
      titleHint: string;
      sourceLabel: string;
      entries: ImportEntry[];
    }
  >();

  entries.forEach((entry) => {
    const segments = entry.relativePath.split("/").filter(Boolean);
    const volumeLabel = layout === "volumes" ? segments[0] || "" : "";
    const chapterLabel = layout === "volumes" ? segments[1] || "" : segments[0] || "";
    const groupKey =
      layout === "single"
        ? "single"
        : layout === "volumes"
          ? `${volumeLabel}\u0001${chapterLabel}`
          : chapterLabel;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        volumeHint:
          layout === "volumes"
            ? parseVolumeNumber(volumeLabel)
            : targetVolume && targetVolume > 0
              ? targetVolume
              : null,
        chapterHint: parseChapterNumber(chapterLabel),
        titleHint: detectChapterTitle(chapterLabel),
        sourceLabel:
          chapterLabel ||
          entry.file.name.replace(getFileExtension(entry.file.name), "") ||
          "Capitulo",
        entries: [],
      });
    }
    groups.get(groupKey)?.entries.push(entry);
  });

  const existingByKey = buildExistingChapterLookup(project);
  const nextByVolume = buildNextChapterNumberByVolume(project);
  return Array.from(groups.values())
    .sort((left, right) => {
      const leftVolume = left.volumeHint || 0;
      const rightVolume = right.volumeHint || 0;
      if (leftVolume !== rightVolume) {
        return leftVolume - rightVolume;
      }
      if (left.chapterHint && right.chapterHint && left.chapterHint !== right.chapterHint) {
        return left.chapterHint - right.chapterHint;
      }
      return compareNatural(left.sourceLabel, right.sourceLabel);
    })
    .map((group) => {
      const volume = group.volumeHint || null;
      const volumeKey = volume !== null ? String(volume) : "none";
      const chapterNumber = group.chapterHint || nextByVolume.get(volumeKey) || 1;
      nextByVolume.set(volumeKey, chapterNumber + 1);
      const key = buildEpisodeKey(chapterNumber, volume ?? undefined);
      const existing = existingByKey.get(key);
      const suggestedAction = existing ? "update" : "create";
      const pages = group.entries
        .slice()
        .sort((left, right) => compareNatural(left.relativePath, right.relativePath))
        .map((entry) => createStagePage(entry.file, entry.relativePath));
      return {
        id: createStageId(),
        number: chapterNumber,
        volume,
        title: group.titleHint || normalizeText(existing?.title),
        titleDetected: group.titleHint,
        sourceLabel: group.sourceLabel,
        pages,
        coverPageId: pages[0]?.id || null,
        publicationStatus:
          existing?.publicationStatus === "published" ? "published" : defaultStatus,
        action: suggestedAction,
        suggestedAction,
        warnings: [],
      } satisfies StageChapter;
    });
};

const reconcileStageChapters = (project: ProjectRecord, chapters: StageChapter[]) => {
  const existingByKey = buildExistingChapterLookup(project);
  const seenKeys = new Set<string>();
  return chapters.map((chapter) => {
    const warnings: string[] = [];
    const volume = chapter.volume !== null ? chapter.volume : undefined;
    const key = buildEpisodeKey(chapter.number, volume);
    const existing = existingByKey.get(key);
    const suggestedAction: "create" | "update" = existing ? "update" : "create";
    let action = chapter.action === "ignore" ? "ignore" : suggestedAction;
    if (!parsePositiveInteger(chapter.number)) {
      warnings.push("Numero de capitulo invalido.");
      action = "ignore";
    }
    if (chapter.pages.length === 0) {
      warnings.push("Sem paginas para importar.");
      action = "ignore";
    }
    if (seenKeys.has(key)) {
      warnings.push("Outra entrada do lote ja usa esse numero + volume.");
      action = "ignore";
    }
    seenKeys.add(key);
    return {
      ...chapter,
      coverPageId: chapter.pages.some((page) => page.id === chapter.coverPageId)
        ? chapter.coverPageId
        : chapter.pages[0]?.id || null,
      suggestedAction,
      action,
      warnings,
    };
  });
};

const MangaWorkflowPanel = ({
  apiBase,
  project,
  projectSnapshot,
  selectedVolume,
  filterMode,
  filteredChapters,
  readerConfig,
  onPersistProjectSnapshot,
  onProjectChange,
  onNavigateToChapter,
}: MangaWorkflowPanelProps) => {
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const appendInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [stagedChapters, setStagedChapters] = useState<StageChapter[]>([]);
  const [selectedStageChapterId, setSelectedStageChapterId] = useState<string | null>(null);
  const [targetVolumeInput, setTargetVolumeInput] = useState(
    selectedVolume !== null ? String(selectedVolume) : "",
  );
  const [defaultImportStatus, setDefaultImportStatus] = useState<"draft" | "published">("draft");
  const [replaceTarget, setReplaceTarget] = useState<{ chapterId: string; pageId: string } | null>(
    null,
  );
  const [isPreparingStage, setIsPreparingStage] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportVolume, setExportVolume] = useState(selectedVolume !== null ? String(selectedVolume) : "");
  const [exportIncludeDrafts, setExportIncludeDrafts] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [chapterExportState, setChapterExportState] = useState<{
    key: string;
    format: "zip" | "cbz";
  } | null>(null);

  useEffect(() => {
    setTargetVolumeInput(selectedVolume !== null ? String(selectedVolume) : "");
    setExportVolume(selectedVolume !== null ? String(selectedVolume) : "");
  }, [selectedVolume]);

  useEffect(() => () => revokeStagePages(stagedChapters), [stagedChapters]);

  const filteredImageChapters = useMemo(
    () =>
      filteredChapters.filter(
        (chapter) => String(chapter.contentFormat || "").trim().toLowerCase() === "images",
      ),
    [filteredChapters],
  );

  const reconciledStagedChapters = useMemo(
    () => reconcileStageChapters(projectSnapshot, stagedChapters),
    [projectSnapshot, stagedChapters],
  );

  const selectedStageChapter = useMemo(
    () =>
      reconciledStagedChapters.find((chapter) => chapter.id === selectedStageChapterId) ||
      reconciledStagedChapters[0] ||
      null,
    [reconciledStagedChapters, selectedStageChapterId],
  );

  const selectedStagePreviewPages = useMemo(
    () =>
      (selectedStageChapter?.pages || []).map((page, index) => ({
        position: index + 1,
        imageUrl: page.previewUrl,
      })),
    [selectedStageChapter],
  );

  const stageSummary = useMemo(
    () => ({
      chapters: reconciledStagedChapters.length,
      pages: reconciledStagedChapters.reduce((total, chapter) => total + chapter.pages.length, 0),
      ready: reconciledStagedChapters.filter((chapter) => chapter.action !== "ignore").length,
      warnings: reconciledStagedChapters.reduce((total, chapter) => total + chapter.warnings.length, 0),
    }),
    [reconciledStagedChapters],
  );

  const publicationSummary = useMemo(
    () => ({
      published: filteredImageChapters.filter((chapter) => chapter.publicationStatus !== "draft").length,
      draft: filteredImageChapters.filter((chapter) => chapter.publicationStatus === "draft").length,
      withPages: filteredImageChapters.filter((chapter) => Number(chapter.pageCount || 0) > 0).length,
    }),
    [filteredImageChapters],
  );

  useEffect(() => {
    if (!selectedStageChapterId && reconciledStagedChapters[0]?.id) {
      setSelectedStageChapterId(reconciledStagedChapters[0].id);
      return;
    }
    if (
      selectedStageChapterId &&
      !reconciledStagedChapters.some((chapter) => chapter.id === selectedStageChapterId)
    ) {
      setSelectedStageChapterId(reconciledStagedChapters[0]?.id || null);
    }
  }, [reconciledStagedChapters, selectedStageChapterId]);

  const clearStage = useCallback(() => {
    revokeStagePages(stagedChapters);
    setStagedChapters([]);
    setSelectedStageChapterId(null);
    setReplaceTarget(null);
  }, [stagedChapters]);

  const updateStageChapter = useCallback(
    (chapterId: string, updater: (chapter: StageChapter) => StageChapter) => {
      setStagedChapters((current) =>
        current.map((chapter) => (chapter.id === chapterId ? updater(chapter) : chapter)),
      );
    },
    [],
  );

  const applyEntriesToStage = useCallback(
    (entries: ImportEntry[]) => {
      if (!entries.length) {
        toast({ title: "Nenhuma imagem valida encontrada", variant: "destructive" });
        return;
      }
      clearStage();
      const nextChapters = buildStageChaptersFromEntries({
        project: projectSnapshot,
        entries,
        targetVolume: parsePositiveInteger(targetVolumeInput),
        defaultStatus: defaultImportStatus,
      });
      setStagedChapters(nextChapters);
      setSelectedStageChapterId(nextChapters[0]?.id || null);
      toast({
        title: "Lote preparado",
        description: `${nextChapters.length} capitulo(s) detectado(s) para revisao.`,
        intent: "success",
      });
    },
    [clearStage, defaultImportStatus, projectSnapshot, targetVolumeInput],
  );

  const prepareStageFromFiles = useCallback(
    async (files: File[], source: "files" | "folder" | "archive") => {
      setIsPreparingStage(true);
      try {
        const entries =
          source === "archive" ? await readArchiveEntries(files[0]) : readDirectEntries(files);
        applyEntriesToStage(entries);
      } catch {
        toast({ title: "Nao foi possivel preparar o lote", variant: "destructive" });
      } finally {
        setIsPreparingStage(false);
        if (archiveInputRef.current) archiveInputRef.current.value = "";
        if (folderInputRef.current) folderInputRef.current.value = "";
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [applyEntriesToStage],
  );

  const addManualStageChapter = useCallback(() => {
    const nextByVolume = buildNextChapterNumberByVolume(projectSnapshot, reconciledStagedChapters);
    const volume = parsePositiveInteger(targetVolumeInput) || selectedVolume || null;
    const volumeKey = volume !== null ? String(volume) : "none";
    const chapterNumber = nextByVolume.get(volumeKey) || 1;
    const nextChapter: StageChapter = {
      id: createStageId(),
      number: chapterNumber,
      volume,
      title: "",
      titleDetected: "",
      sourceLabel: "Capitulo manual",
      pages: [],
      coverPageId: null,
      publicationStatus: defaultImportStatus,
      action: "create",
      suggestedAction: "create",
      warnings: [],
    };
    setStagedChapters((current) => [...current, nextChapter]);
    setSelectedStageChapterId(nextChapter.id);
  }, [defaultImportStatus, projectSnapshot, reconciledStagedChapters, selectedVolume, targetVolumeInput]);

  const removeStageChapter = useCallback((chapterId: string) => {
    setStagedChapters((current) => {
      const next = current.filter((chapter) => chapter.id !== chapterId);
      const removed = current.find((chapter) => chapter.id === chapterId);
      if (removed) {
        revokeStagePages([removed]);
      }
      return next;
    });
  }, []);

  const moveStageChapter = useCallback((chapterId: string, direction: -1 | 1) => {
    setStagedChapters((current) => {
      const index = current.findIndex((chapter) => chapter.id === chapterId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  }, []);

  const moveStagePage = useCallback(
    (chapterId: string, pageId: string, direction: -1 | 1) => {
      updateStageChapter(chapterId, (chapter) => {
        const index = chapter.pages.findIndex((page) => page.id === pageId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= chapter.pages.length) {
          return chapter;
        }
        const nextPages = [...chapter.pages];
        const [moved] = nextPages.splice(index, 1);
        nextPages.splice(nextIndex, 0, moved);
        return { ...chapter, pages: nextPages };
      });
    },
    [updateStageChapter],
  );

  const removeStagePage = useCallback(
    (chapterId: string, pageId: string) => {
      updateStageChapter(chapterId, (chapter) => {
        const page = chapter.pages.find((item) => item.id === pageId);
        if (page) {
          URL.revokeObjectURL(page.previewUrl);
        }
        const nextPages = chapter.pages.filter((item) => item.id !== pageId);
        return {
          ...chapter,
          pages: nextPages,
          coverPageId: chapter.coverPageId === pageId ? nextPages[0]?.id || null : chapter.coverPageId,
        };
      });
    },
    [updateStageChapter],
  );

  const moveStagePageToChapter = useCallback((sourceChapterId: string, pageId: string, targetChapterId: string) => {
    if (!targetChapterId || sourceChapterId === targetChapterId) {
      return;
    }
    let movedPage: StagePage | null = null;
    setStagedChapters((current) => {
      const next = current.map((chapter) => {
        if (chapter.id !== sourceChapterId) {
          return chapter;
        }
        movedPage = chapter.pages.find((page) => page.id === pageId) || null;
        return {
          ...chapter,
          pages: chapter.pages.filter((page) => page.id !== pageId),
          coverPageId:
            chapter.coverPageId === pageId
              ? chapter.pages.find((page) => page.id !== pageId)?.id || null
              : chapter.coverPageId,
        };
      });
      if (!movedPage) {
        return current;
      }
      return next.map((chapter) =>
        chapter.id === targetChapterId
          ? {
              ...chapter,
              pages: [...chapter.pages, movedPage as StagePage],
              coverPageId: chapter.coverPageId || (movedPage as StagePage).id,
            }
          : chapter,
      );
    });
  }, []);

  const appendPagesToStageChapter = useCallback(
    (chapterId: string, files: File[]) => {
      const entries = readDirectEntries(files);
      if (!entries.length) {
        toast({ title: "Nenhuma imagem valida encontrada", variant: "destructive" });
        return;
      }
      updateStageChapter(chapterId, (chapter) => {
        const nextPages = entries.map((entry) => createStagePage(entry.file, entry.relativePath));
        return {
          ...chapter,
          pages: [...chapter.pages, ...nextPages],
          coverPageId: chapter.coverPageId || nextPages[0]?.id || null,
        };
      });
      setSelectedStageChapterId(chapterId);
      toast({
        title: "Paginas adicionadas",
        description: `${entries.length} pagina(s) anexada(s) ao capitulo em staging.`,
        intent: "success",
      });
      if (appendInputRef.current) {
        appendInputRef.current.value = "";
      }
    },
    [updateStageChapter],
  );

  const replaceStagePage = useCallback(
    (chapterId: string, pageId: string, file: File) => {
      updateStageChapter(chapterId, (chapter) => {
        const pageIndex = chapter.pages.findIndex((page) => page.id === pageId);
        if (pageIndex < 0) {
          return chapter;
        }
        URL.revokeObjectURL(chapter.pages[pageIndex].previewUrl);
        const replacement = createStagePage(file, file.name);
        const nextPages = [...chapter.pages];
        nextPages[pageIndex] = replacement;
        return {
          ...chapter,
          pages: nextPages,
          coverPageId: chapter.coverPageId === pageId ? replacement.id : chapter.coverPageId,
        };
      });
      setReplaceTarget(null);
      toast({ title: "Pagina substituida", intent: "success" });
      if (replaceInputRef.current) {
        replaceInputRef.current.value = "";
      }
    },
    [updateStageChapter],
  );

  const uploadStagePage = useCallback(
    async (folder: string, page: StagePage) => {
      const dataUrl = await fileToDataUrl(page.file);
      const response = await apiFetch(apiBase, "/api/uploads/image", {
        method: "POST",
        auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl,
          filename: page.file.name,
          folder,
        }),
      });
      if (!response.ok) {
        throw new Error("page_upload_failed");
      }
      const data = (await response.json().catch(() => null)) as { url?: string } | null;
      const url = normalizeText(data?.url);
      if (!url) {
        throw new Error("page_upload_missing_url");
      }
      return url;
    },
    [apiBase],
  );

  const buildImportedChapter = useCallback(
    (stageChapter: StageChapter, uploadedPageUrls: string[]) => {
      const key = buildEpisodeKey(stageChapter.number, stageChapter.volume ?? undefined);
      const existing =
        (Array.isArray(projectSnapshot.episodeDownloads) ? projectSnapshot.episodeDownloads : []).find(
          (episode) => buildEpisodeKey(episode.number, episode.volume) === key,
        ) || null;
      const pages = uploadedPageUrls.map((imageUrl, index) => ({ position: index, imageUrl }));
      const coverIndex = Math.max(
        0,
        stageChapter.pages.findIndex((page) => page.id === stageChapter.coverPageId),
      );
      return {
        ...(existing || {}),
        number: stageChapter.number,
        volume: stageChapter.volume ?? undefined,
        title: normalizeText(stageChapter.title) || normalizeText(existing?.title),
        synopsis: normalizeText(existing?.synopsis),
        entryKind: existing?.entryKind === "extra" ? "extra" : "main",
        entrySubtype: normalizeText(existing?.entrySubtype) || "chapter",
        readingOrder: Number.isFinite(Number(existing?.readingOrder))
          ? Number(existing?.readingOrder)
          : undefined,
        displayLabel: normalizeText(existing?.displayLabel) || undefined,
        releaseDate: normalizeText(existing?.releaseDate),
        duration: normalizeText(existing?.duration),
        sourceType:
          existing?.sourceType === "Web" || existing?.sourceType === "Blu-ray"
            ? existing.sourceType
            : "Web",
        sources: Array.isArray(existing?.sources) ? existing.sources : [],
        progressStage: normalizeText(existing?.progressStage) || undefined,
        completedStages: Array.isArray(existing?.completedStages) ? existing.completedStages : [],
        content: "",
        contentFormat: "images" as const,
        pages,
        pageCount: pages.length,
        hasPages: pages.length > 0,
        coverImageUrl: uploadedPageUrls[coverIndex] || uploadedPageUrls[0] || "",
        coverImageAlt:
          normalizeText(existing?.coverImageAlt) ||
          (uploadedPageUrls[0] ? `Capa do capitulo ${stageChapter.number}` : ""),
        publicationStatus: stageChapter.publicationStatus,
      } satisfies ProjectEpisode;
    },
    [projectSnapshot.episodeDownloads],
  );

  const handleConfirmImport = useCallback(async () => {
    const chaptersToImport = reconciledStagedChapters.filter((chapter) => chapter.action !== "ignore");
    if (!chaptersToImport.length) {
      toast({ title: "Nenhum capitulo pronto para importar", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    try {
      const { projectChaptersFolder } = resolveProjectImageFolders(projectSnapshot.id, projectSnapshot.title);
      const importedChapters: ProjectEpisode[] = [];
      for (const chapter of chaptersToImport) {
        const folder = `${buildChapterFolder({
          projectChaptersFolder,
          episode: { number: chapter.number, volume: chapter.volume ?? undefined },
          index: Math.max(chapter.number - 1, 0),
        })}/paginas`;
        const uploadedPageUrls: string[] = [];
        for (const page of chapter.pages) {
          uploadedPageUrls.push(await uploadStagePage(folder, page));
        }
        importedChapters.push(buildImportedChapter(chapter, uploadedPageUrls));
      }
      const nextSnapshot = mergeImportedImageChaptersIntoProject(projectSnapshot, importedChapters);
      const persistedProject = await onPersistProjectSnapshot(nextSnapshot, { context: "manga-import" });
      if (!persistedProject) {
        return;
      }
      onProjectChange(persistedProject);
      const firstImported = importedChapters
        .map((chapter) =>
          (Array.isArray(persistedProject.episodeDownloads) ? persistedProject.episodeDownloads : []).find(
            (episode) =>
              buildEpisodeKey(episode.number, episode.volume) ===
              buildEpisodeKey(chapter.number, chapter.volume),
          ) || null,
        )
        .find(Boolean);
      clearStage();
      toast({
        title: "Importacao concluida",
        description: `${importedChapters.length} capitulo(s) persistido(s) no projeto.`,
        intent: "success",
      });
      if (firstImported) {
        onNavigateToChapter(firstImported);
      }
    } catch {
      toast({ title: "Nao foi possivel concluir a importacao", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  }, [
    buildImportedChapter,
    clearStage,
    onNavigateToChapter,
    onPersistProjectSnapshot,
    onProjectChange,
    projectSnapshot,
    reconciledStagedChapters,
    uploadStagePage,
  ]);

  const applyPublicationStatus = useCallback(
    async (scope: "filtered" | "volume", publicationStatus: "draft" | "published") => {
      const sourceChapters =
        scope === "volume" && selectedVolume !== null
          ? (Array.isArray(projectSnapshot.episodeDownloads) ? projectSnapshot.episodeDownloads : []).filter(
              (chapter) =>
                String(chapter.contentFormat || "").trim().toLowerCase() === "images" &&
                Number(chapter.volume) === Number(selectedVolume),
            )
          : filteredImageChapters;
      if (!sourceChapters.length) {
        toast({ title: "Nenhum capitulo elegivel encontrado", variant: "destructive" });
        return;
      }
      setIsPublishing(true);
      try {
        const keys = new Set(sourceChapters.map((chapter) => buildEpisodeKey(chapter.number, chapter.volume)));
        const nextSnapshot: ProjectRecord = {
          ...projectSnapshot,
          episodeDownloads: (Array.isArray(projectSnapshot.episodeDownloads)
            ? projectSnapshot.episodeDownloads
            : []
          ).map((chapter) =>
            keys.has(buildEpisodeKey(chapter.number, chapter.volume))
              ? { ...chapter, publicationStatus }
              : chapter,
          ),
        };
        const persistedProject = await onPersistProjectSnapshot(nextSnapshot, {
          context: "manga-publication",
        });
        if (!persistedProject) {
          return;
        }
        onProjectChange(persistedProject);
        toast({
          title:
            publicationStatus === "published"
              ? "Capitulos publicados"
              : "Capitulos movidos para rascunho",
          intent: "success",
        });
      } finally {
        setIsPublishing(false);
      }
    },
    [filteredImageChapters, onPersistProjectSnapshot, onProjectChange, projectSnapshot, selectedVolume],
  );

  const pollExportJob = useCallback(
    async (jobId: string) => {
      while (true) {
        const response = await apiFetch(
          apiBase,
          `/api/projects/${encodeURIComponent(project.id)}/manga-export/jobs/${encodeURIComponent(jobId)}`,
          { auth: true, cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error("export_job_failed");
        }
        const data = (await response.json().catch(() => null)) as { job?: unknown } | null;
        const job = normalizeProjectImageExportJob(data?.job);
        if (!job) {
          throw new Error("export_job_invalid");
        }
        if (job.status === "queued" || job.status === "processing") {
          await sleep(2000);
          continue;
        }
        return job;
      }
    },
    [apiBase, project.id],
  );

  const handleExportCollection = useCallback(async () => {
    setIsExporting(true);
    try {
      const response = await apiFetch(
        apiBase,
        `/api/projects/${encodeURIComponent(project.id)}/manga-export/jobs`,
        {
          method: "POST",
          auth: true,
          json: {
            project: buildProjectSnapshotForMangaExport(projectSnapshot),
            volume: exportVolume.trim() ? Number(exportVolume) : null,
            includeDrafts: exportIncludeDrafts,
          },
        },
      );
      if (!response.ok) {
        throw new Error("export_start_failed");
      }
      const data = (await response.json().catch(() => null)) as { job?: unknown } | null;
      const initialJob = normalizeProjectImageExportJob(data?.job);
      if (!initialJob) {
        throw new Error("export_job_invalid");
      }
      const finalJob =
        initialJob.status === "queued" || initialJob.status === "processing"
          ? await pollExportJob(initialJob.id)
          : initialJob;
      if (!finalJob || finalJob.status !== "completed" || !finalJob.downloadPath) {
        throw new Error(finalJob?.error || "export_failed");
      }
      const downloadResponse = await apiFetch(apiBase, finalJob.downloadPath, { auth: true });
      if (!downloadResponse.ok) {
        throw new Error("export_download_failed");
      }
      await downloadBinaryResponse(downloadResponse, "manga-export.zip");
      toast({ title: "Exportacao pronta", intent: "success" });
    } catch {
      toast({ title: "Nao foi possivel exportar a colecao", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }, [
    apiBase,
    exportIncludeDrafts,
    exportVolume,
    pollExportJob,
    project.id,
    projectSnapshot,
  ]);

  const exportExistingChapter = useCallback(
    async (chapter: ProjectEpisode, format: "zip" | "cbz") => {
      const chapterKey = buildEpisodeKey(chapter.number, chapter.volume);
      setChapterExportState({ key: chapterKey, format });
      try {
        const response = await apiFetch(
          apiBase,
          `/api/projects/${encodeURIComponent(project.id)}/manga-export/chapter`,
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
        toast({ title: "Nao foi possivel exportar o capitulo", variant: "destructive" });
      } finally {
        setChapterExportState(null);
      }
    },
    [apiBase, project.id, projectSnapshot],
  );

  return (
    <Card className="border-border/60 bg-card/80" data-testid="manga-workflow-panel">
      <CardContent className="space-y-6 p-4 md:p-6">
        <div className="hidden">
          <Input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(event) =>
              void prepareStageFromFiles(Array.from(event.target.files || []), "files")
            }
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(event) =>
              void prepareStageFromFiles(Array.from(event.target.files || []), "folder")
            }
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          />
          <Input
            ref={archiveInputRef}
            type="file"
            accept=".zip,.cbz,application/zip,application/x-cbz"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void prepareStageFromFiles([file], "archive");
              }
            }}
          />
          <Input
            ref={appendInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(event) => {
              if (!selectedStageChapter) {
                return;
              }
              appendPagesToStageChapter(
                selectedStageChapter.id,
                Array.from(event.target.files || []),
              );
            }}
          />
          <Input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && replaceTarget) {
                replaceStagePage(replaceTarget.chapterId, replaceTarget.pageId, file);
              }
            }}
          />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                Fluxo editorial
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                Filtro: {CHAPTER_FILTER_MODE_LABELS[filterMode]}
              </Badge>
            </div>
            <h2 className="mt-2 text-lg font-semibold">Importacao, revisao e disponibilizacao</h2>
            <p className="text-xs text-muted-foreground">
              Faca staging local do lote, revise thumbs e ordem de leitura, publique em lote e exporte o acervo sem sair desta pagina.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-background/45 px-3 py-2">
              <p className="font-medium text-foreground">{stageSummary.chapters}</p>
              <p>Capitulos</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/45 px-3 py-2">
              <p className="font-medium text-foreground">{stageSummary.pages}</p>
              <p>Paginas</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/45 px-3 py-2">
              <p className="font-medium text-foreground">{stageSummary.ready}</p>
              <p>Prontos</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/45 px-3 py-2">
              <p className="font-medium text-foreground">{filteredImageChapters.length}</p>
              <p>No filtro</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="rounded-[22px] border border-border/60 bg-background/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">1. Selecionar origem</h3>
                <p className="text-xs text-muted-foreground">
                  Pasta, imagens soltas, ZIP ou CBZ. O lote e preparado localmente antes do upload final.
                </p>
              </div>
              {isPreparingStage ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Preparando lote...</span>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => folderInputRef.current?.click()}
                disabled={isPreparingStage || isImporting}
              >
                <FolderOpen className="h-4 w-4" />
                <span>Pasta</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPreparingStage || isImporting}
              >
                <ImagePlus className="h-4 w-4" />
                <span>Imagens</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => archiveInputRef.current?.click()}
                disabled={isPreparingStage || isImporting}
              >
                <FileArchive className="h-4 w-4" />
                <span>ZIP / CBZ</span>
              </Button>
            </div>
            <div className="mt-4 grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-card/55 px-3 py-3">
                <p className="font-medium text-foreground">2. Revisar deteccao</p>
                <p>Volume, capitulo, titulo detectado, acao sugerida e warnings.</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/55 px-3 py-3">
                <p className="font-medium text-foreground">3. Organizar paginas</p>
                <p>Reordene, mova entre capitulos, troque arquivos e defina a capa.</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/55 px-3 py-3">
                <p className="font-medium text-foreground">4. Importar</p>
                <p>Uploads e persistencia so acontecem ao confirmar o staging.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-border/60 bg-background/40 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Parametros do lote</h3>
              <p className="text-xs text-muted-foreground">
                Defaults aplicados na deteccao inicial. Voce ainda pode ajustar por capitulo.
              </p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manga-stage-target-volume">Volume base</Label>
                <Input
                  id="manga-stage-target-volume"
                  type="number"
                  min={1}
                  value={targetVolumeInput}
                  onChange={(event) => setTargetVolumeInput(event.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label>Status inicial</Label>
                <Select
                  value={defaultImportStatus}
                  onValueChange={(value) =>
                    setDefaultImportStatus(value === "published" ? "published" : "draft")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Importar como rascunho</SelectItem>
                    <SelectItem value="published">Importar publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={addManualStageChapter}
                disabled={isPreparingStage || isImporting}
              >
                <Plus className="h-4 w-4" />
                <span>Novo capitulo no lote</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={clearStage}
                disabled={stagedChapters.length === 0 || isImporting}
              >
                <Trash2 className="h-4 w-4" />
                <span>Limpar staging</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)]">
          <div className="space-y-4">
            <div className="rounded-[22px] border border-border/60 bg-background/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Capitulos em staging</h3>
                  <p className="text-xs text-muted-foreground">
                    Revise a estrutura detectada e escolha qual capitulo editar.
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                  {reconciledStagedChapters.length} item(ns)
                </Badge>
              </div>
              <div className="mt-4 space-y-3">
                {reconciledStagedChapters.length > 0 ? (
                  reconciledStagedChapters.map((chapter, index) => {
                    const isSelected = chapter.id === selectedStageChapter?.id;
                    return (
                      <article
                        key={chapter.id}
                        className={`rounded-[18px] border p-3 transition ${
                          isSelected
                            ? "border-primary/60 bg-primary/5"
                            : "border-border/60 bg-card/60"
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => setSelectedStageChapterId(chapter.id)}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">
                                {buildStageChapterLabel(chapter)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {chapter.sourceLabel || "Capitulo detectado"} • {chapter.pages.length} pagina(s)
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <Badge
                                variant={chapter.action === "ignore" ? "outline" : "secondary"}
                                className="text-[10px] uppercase tracking-[0.12em]"
                              >
                                {chapter.action === "update"
                                  ? "Atualizar"
                                  : chapter.action === "ignore"
                                    ? "Ignorar"
                                    : "Criar"}
                              </Badge>
                              <Badge
                                variant={chapter.publicationStatus === "draft" ? "outline" : "default"}
                                className="text-[10px] uppercase tracking-[0.12em]"
                              >
                                {chapter.publicationStatus === "draft" ? "Rascunho" : "Publicado"}
                              </Badge>
                            </div>
                          </div>
                        </button>
                        {chapter.warnings.length > 0 ? (
                          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                            {chapter.warnings.join(" • ")}
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => moveStageChapter(chapter.id, -1)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                            <span>Subir</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => moveStageChapter(chapter.id, 1)}
                            disabled={index === reconciledStagedChapters.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                            <span>Descer</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeStageChapter(chapter.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Remover</span>
                          </Button>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-[18px] border border-dashed border-border/60 bg-background/35 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum lote em staging. Escolha uma origem acima ou crie um capitulo manual para começar.
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-[22px] border border-border/60 bg-background/40 p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Disponibilizacao em lote</h3>
                <p className="text-xs text-muted-foreground">
                  Gerencie publicacao e exportacao do acervo filtrado nesta pagina.
                </p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="rounded-xl border border-border/60 bg-card/55 px-3 py-2">
                  <p className="font-medium text-foreground">{publicationSummary.published}</p>
                  <p>Publicados</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/55 px-3 py-2">
                  <p className="font-medium text-foreground">{publicationSummary.draft}</p>
                  <p>Rascunhos</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/55 px-3 py-2">
                  <p className="font-medium text-foreground">{publicationSummary.withPages}</p>
                  <p>Com paginas</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void applyPublicationStatus("filtered", "published")}
                  disabled={isPublishing || filteredImageChapters.length === 0}
                >
                  {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Publicar filtro</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void applyPublicationStatus("filtered", "draft")}
                  disabled={isPublishing || filteredImageChapters.length === 0}
                >
                  {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Mandar filtro para rascunho</span>
                </Button>
                {selectedVolume !== null ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void applyPublicationStatus("volume", "published")}
                      disabled={isPublishing}
                    >
                      <span>Publicar {buildVolumeLabel(selectedVolume)}</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void applyPublicationStatus("volume", "draft")}
                      disabled={isPublishing}
                    >
                      <span>Rascunho {buildVolumeLabel(selectedVolume)}</span>
                    </Button>
                  </>
                ) : null}
              </div>
              <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="manga-export-volume">Volume para exportacao</Label>
                  <Input
                    id="manga-export-volume"
                    type="number"
                    min={1}
                    value={exportVolume}
                    onChange={(event) => setExportVolume(event.target.value)}
                    placeholder="Vazio para projeto inteiro"
                  />
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/55 px-3 py-3 text-sm">
                  <Checkbox
                    checked={exportIncludeDrafts}
                    onCheckedChange={(checked) => setExportIncludeDrafts(checked === true)}
                  />
                  <span className="space-y-1">
                    <span className="block font-medium text-foreground">Incluir rascunhos</span>
                    <span className="block text-xs text-muted-foreground">
                      Exporta tambem capitulos draft com paginas.
                    </span>
                  </span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleExportCollection()}
                  disabled={isExporting}
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Exportar colecao</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[22px] border border-border/60 bg-background/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Revisao do capitulo selecionado</h3>
                  <p className="text-xs text-muted-foreground">
                    Ajuste metadados, ordem das paginas, capa, acao final e preview antes de importar.
                  </p>
                </div>
                {selectedStageChapter ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                    {selectedStageChapter.pages.length} pagina(s)
                  </Badge>
                ) : null}
              </div>

              {selectedStageChapter ? (
                <div className="mt-4 space-y-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="space-y-2 xl:col-span-1">
                      <Label htmlFor="stage-chapter-number">Capitulo</Label>
                      <Input
                        id="stage-chapter-number"
                        type="number"
                        min={1}
                        value={selectedStageChapter.number}
                        onChange={(event) =>
                          updateStageChapter(selectedStageChapter.id, (chapter) => ({
                            ...chapter,
                            number: Math.max(1, Number(event.target.value) || chapter.number),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2 xl:col-span-1">
                      <Label htmlFor="stage-chapter-volume">Volume</Label>
                      <Input
                        id="stage-chapter-volume"
                        type="number"
                        min={1}
                        value={selectedStageChapter.volume ?? ""}
                        onChange={(event) =>
                          updateStageChapter(selectedStageChapter.id, (chapter) => ({
                            ...chapter,
                            volume: event.target.value.trim()
                              ? Math.max(1, Number(event.target.value) || 1)
                              : null,
                          }))
                        }
                        placeholder="Sem volume"
                      />
                    </div>
                    <div className="space-y-2 xl:col-span-1">
                      <Label>Acao</Label>
                      <Select
                        value={selectedStageChapter.action}
                        onValueChange={(value) =>
                          updateStageChapter(selectedStageChapter.id, (chapter) => ({
                            ...chapter,
                            action:
                              value === "update"
                                ? "update"
                                : value === "ignore"
                                  ? "ignore"
                                  : "create",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="create">Criar</SelectItem>
                          <SelectItem value="update">Atualizar</SelectItem>
                          <SelectItem value="ignore">Ignorar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 xl:col-span-1">
                      <Label>Status</Label>
                      <Select
                        value={selectedStageChapter.publicationStatus}
                        onValueChange={(value) =>
                          updateStageChapter(selectedStageChapter.id, (chapter) => ({
                            ...chapter,
                            publicationStatus: value === "published" ? "published" : "draft",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="published">Publicado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 xl:col-span-1">
                      <Label htmlFor="stage-chapter-title">Titulo</Label>
                      <Input
                        id="stage-chapter-title"
                        value={selectedStageChapter.title}
                        onChange={(event) =>
                          updateStageChapter(selectedStageChapter.id, (chapter) => ({
                            ...chapter,
                            title: event.target.value,
                          }))
                        }
                        placeholder={selectedStageChapter.titleDetected || "Opcional"}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card/55 px-3 py-3 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Origem:</span>{" "}
                      {selectedStageChapter.sourceLabel || "Capitulo detectado"}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium text-foreground">Titulo detectado:</span>{" "}
                      {selectedStageChapter.titleDetected || "Nenhum"}
                    </p>
                  </div>

                  {selectedStageChapter.warnings.length > 0 ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                      {selectedStageChapter.warnings.join(" • ")}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendInputRef.current?.click()}
                      disabled={isImporting}
                    >
                      <ImagePlus className="h-4 w-4" />
                      <span>Adicionar paginas</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addManualStageChapter}
                      disabled={isImporting}
                    >
                      <Plus className="h-4 w-4" />
                      <span>Novo capitulo vazio</span>
                    </Button>
                  </div>

                  <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-4">
                      {selectedStageChapter.pages.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {selectedStageChapter.pages.map((page, pageIndex) => (
                            <article
                              key={page.id}
                              className="overflow-hidden rounded-[18px] border border-border/60 bg-card/65"
                            >
                              <div className="relative aspect-[3/4] overflow-hidden bg-background/50">
                                <UploadPicture
                                  src={page.previewUrl}
                                  alt={`Pagina ${pageIndex + 1}`}
                                  preset="poster"
                                  className="h-full w-full"
                                  imgClassName="h-full w-full object-cover object-top"
                                />
                                <div className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
                                  Pagina {pageIndex + 1}
                                </div>
                                {selectedStageChapter.coverPageId === page.id ? (
                                  <div className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground shadow-sm">
                                    Capa
                                  </div>
                                ) : null}
                              </div>
                              <div className="space-y-3 p-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => moveStagePage(selectedStageChapter.id, page.id, -1)}
                                    disabled={pageIndex === 0}
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                    <span>Subir</span>
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => moveStagePage(selectedStageChapter.id, page.id, 1)}
                                    disabled={pageIndex === selectedStageChapter.pages.length - 1}
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                    <span>Descer</span>
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setReplaceTarget({
                                        chapterId: selectedStageChapter.id,
                                        pageId: page.id,
                                      });
                                      replaceInputRef.current?.click();
                                    }}
                                  >
                                    <ImagePlus className="h-4 w-4" />
                                    <span>Trocar</span>
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateStageChapter(selectedStageChapter.id, (chapter) => ({
                                        ...chapter,
                                        coverPageId: page.id,
                                      }))
                                    }
                                  >
                                    <span>Usar capa</span>
                                  </Button>
                                </div>
                                {reconciledStagedChapters.length > 1 ? (
                                  <Select
                                    defaultValue={selectedStageChapter.id}
                                    onValueChange={(targetChapterId) =>
                                      moveStagePageToChapter(
                                        selectedStageChapter.id,
                                        page.id,
                                        targetChapterId,
                                      )
                                    }
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Mover para..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {reconciledStagedChapters.map((chapter) => (
                                        <SelectItem key={chapter.id} value={chapter.id}>
                                          {buildStageChapterLabel(chapter)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeStagePage(selectedStageChapter.id, page.id)}
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
                        <div className="rounded-[18px] border border-dashed border-border/60 bg-background/35 px-4 py-8 text-center text-sm text-muted-foreground">
                          Nenhuma pagina neste capitulo em staging. Adicione imagens para continuar.
                        </div>
                      )}
                    </div>

                    <aside className="space-y-4">
                      <div className="rounded-[18px] border border-border/60 bg-card/60 p-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-foreground">Preview do leitor</h4>
                          <p className="text-xs text-muted-foreground">
                            Inspecao do lote com o mesmo viewer publico configurado para o tipo deste projeto.
                          </p>
                        </div>
                        <div className="mt-4">
                          {selectedStagePreviewPages.length > 0 ? (
                            <MangaViewerAdapter
                              title={buildStageChapterLabel(selectedStageChapter)}
                              backUrl={buildDashboardProjectChapterEditorHref(
                                project.id,
                                selectedStageChapter.number,
                                selectedStageChapter.volume ?? undefined,
                              )}
                              shareUrl=""
                              pages={selectedStagePreviewPages}
                              direction={readerConfig.direction || "rtl"}
                              viewMode={readerConfig.viewMode || "page"}
                              firstPageSingle={readerConfig.firstPageSingle !== false}
                              allowSpread={readerConfig.allowSpread !== false}
                              showFooter={readerConfig.showFooter !== false}
                              previewLimit={readerConfig.previewLimit ?? null}
                              purchaseUrl={readerConfig.purchaseUrl || ""}
                              purchasePrice={readerConfig.purchasePrice || ""}
                              className="min-h-[520px]"
                            />
                          ) : (
                            <div className="rounded-[18px] border border-dashed border-border/60 bg-background/35 px-4 py-10 text-center text-sm text-muted-foreground">
                              O preview aparece quando houver pelo menos uma pagina.
                            </div>
                          )}
                        </div>
                      </div>
                    </aside>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-card/55 px-4 py-3">
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>
                        {stageSummary.ready} capitulo(s) prontos para importar • {stageSummary.warnings} warning(s)
                      </p>
                      <p>Uploads e persistencia so acontecem ao confirmar o staging.</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void handleConfirmImport()}
                      disabled={isImporting || stageSummary.ready === 0}
                    >
                      {isImporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span>Confirmar importacao</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-[18px] border border-dashed border-border/60 bg-background/35 px-4 py-10 text-center text-sm text-muted-foreground">
                  Selecione um capitulo em staging para revisar paginas, reorder e preview.
                </div>
              )}
            </div>

            <div className="rounded-[22px] border border-border/60 bg-background/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Capitulos ja disponiveis</h3>
                  <p className="text-xs text-muted-foreground">
                    Acoes rapidas por capitulo no recorte atual da pagina.
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                  {filteredImageChapters.length} no recorte
                </Badge>
              </div>
              <div className="mt-4 space-y-3">
                {filteredImageChapters.length > 0 ? (
                  filteredImageChapters.map((chapter) => {
                    const chapterKey = buildEpisodeKey(chapter.number, chapter.volume);
                    const isExportingChapter = chapterExportState?.key === chapterKey;
                    const previewHref = buildProjectPublicReadingHref(
                      project.id,
                      chapter.number,
                      chapter.volume,
                    );
                    return (
                      <article
                        key={chapterKey}
                        className="rounded-[18px] border border-border/60 bg-card/60 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {buildExistingChapterLabel(chapter)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {Number(chapter.pageCount || 0)} pagina(s)
                            </p>
                          </div>
                          <Badge
                            variant={chapter.publicationStatus === "draft" ? "outline" : "default"}
                            className="text-[10px] uppercase tracking-[0.12em]"
                          >
                            {chapter.publicationStatus === "draft" ? "Rascunho" : "Publicado"}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onNavigateToChapter(chapter)}
                          >
                            <span>Abrir editor</span>
                          </Button>
                          <Button type="button" size="sm" variant="outline" asChild>
                            <a href={previewHref} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                              <span>Preview</span>
                            </a>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void exportExistingChapter(chapter, "zip")}
                            disabled={Boolean(isExportingChapter)}
                          >
                            {isExportingChapter && chapterExportState?.format === "zip" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            <span>ZIP</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void exportExistingChapter(chapter, "cbz")}
                            disabled={Boolean(isExportingChapter)}
                          >
                            {isExportingChapter && chapterExportState?.format === "cbz" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            <span>CBZ</span>
                          </Button>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-[18px] border border-dashed border-border/60 bg-background/35 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum capitulo em imagem combina com o filtro atual.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MangaWorkflowPanel;
