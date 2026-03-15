import { unzipSync } from "fflate";
import {
  ExternalLink,
  FileArchive,
  FolderOpen,
  ImagePlus,
  Loader2,
  Plus,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type SetStateAction,
} from "react";

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
import { useAccessibilityAnnouncer } from "@/hooks/accessibility-announcer";
import type { Project, ProjectEpisode } from "@/data/projects";
import { apiFetch } from "@/lib/api-client";
import { downloadBinaryResponse } from "@/lib/project-epub";
import { buildEpisodeKey } from "@/lib/project-episode-key";
import { buildChapterFolder, resolveProjectImageFolders } from "@/lib/project-image-folders";
import {
  buildReorderAnnouncement,
  handleAltArrowReorder,
  reorderList,
} from "@/components/project-reader/page-reorder";
import {
  buildProjectSnapshotForMangaExport,
  mergeImportedImageChaptersIntoProject,
  normalizeProjectImageExportJob,
} from "@/lib/project-manga";

type ProjectRecord = Project & { revision?: string };
type ChapterFilterMode = "all" | "draft" | "published" | "with-content" | "without-content";

export type StagePage = {
  id: string;
  file: File;
  previewUrl: string;
  relativePath: string;
  name: string;
};

export type StageChapter = {
  id: string;
  number: number;
  volume: number | null;
  title: string;
  titleDetected: string;
  sourceLabel: string;
  pages: StagePage[];
  coverPageId: string | null;
  publicationStatus: "draft" | "published";
  operation: "create" | "update";
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
  stagedChapters: StageChapter[];
  setStagedChapters: Dispatch<SetStateAction<StageChapter[]>>;
  selectedStageChapterId: string | null;
  setSelectedStageChapterId: Dispatch<SetStateAction<string | null>>;
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

export const revokeStagePages = (chapters: StageChapter[]) =>
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

export const buildStageChapterLabel = (chapter: Pick<StageChapter, "number" | "volume" | "title">) => {
  const title = normalizeText(chapter.title);
  const baseLabel = `${buildVolumeLabel(chapter.volume)} - Capitulo ${chapter.number}`;
  return title ? `${baseLabel} - ${title}` : baseLabel;
};

const buildExistingChapterLabel = (chapter: ProjectEpisode) => {
  const title = normalizeText(chapter.title);
  const baseLabel = `${buildVolumeLabel(
    Number.isFinite(Number(chapter.volume)) ? Number(chapter.volume) : null,
  )} - Capitulo ${Number(chapter.number) || 1}`;
  return title ? `${baseLabel} - ${title}` : baseLabel;
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
        operation: existing ? "update" : "create",
        warnings: [],
      } satisfies StageChapter;
    });
};

export const reconcileStageChapters = (project: ProjectRecord, chapters: StageChapter[]) => {
  const existingByKey = buildExistingChapterLookup(project);
  const seenKeys = new Set<string>();
  return chapters.map((chapter) => {
    const warnings: string[] = [];
    const volume = chapter.volume !== null ? chapter.volume : undefined;
    const key = buildEpisodeKey(chapter.number, volume);
    const existing = existingByKey.get(key);
    if (!parsePositiveInteger(chapter.number)) {
      warnings.push("Numero de capitulo invalido.");
    }
    if (chapter.pages.length === 0) {
      warnings.push("Sem paginas para importar.");
    }
    if (seenKeys.has(key)) {
      warnings.push("Outra entrada do lote ja usa esse numero + volume.");
    }
    seenKeys.add(key);
    return {
      ...chapter,
      coverPageId: chapter.pages.some((page) => page.id === chapter.coverPageId)
        ? chapter.coverPageId
        : chapter.pages[0]?.id || null,
      operation: existing ? "update" : "create",
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
  stagedChapters,
  setStagedChapters,
  selectedStageChapterId,
  setSelectedStageChapterId,
  onPersistProjectSnapshot,
  onProjectChange,
  onNavigateToChapter,
}: MangaWorkflowPanelProps) => {
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const appendInputRef = useRef<HTMLInputElement | null>(null);
  const { announce } = useAccessibilityAnnouncer();
  const [targetVolumeInput, setTargetVolumeInput] = useState(
    selectedVolume !== null ? String(selectedVolume) : "",
  );
  const [defaultImportStatus, setDefaultImportStatus] = useState<"draft" | "published">("draft");
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
  const [stagePageDragState, setStagePageDragState] = useState<{
    chapterId: string;
    index: number;
    overIndex: number | null;
  } | null>(null);

  useEffect(() => {
    setTargetVolumeInput(selectedVolume !== null ? String(selectedVolume) : "");
    setExportVolume(selectedVolume !== null ? String(selectedVolume) : "");
  }, [selectedVolume]);

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

  const stageSummary = useMemo(
    () => ({
      chapters: reconciledStagedChapters.length,
      pages: reconciledStagedChapters.reduce((total, chapter) => total + chapter.pages.length, 0),
      ready: reconciledStagedChapters.filter((chapter) => chapter.warnings.length === 0).length,
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

  const updateStageChapter = useCallback(
    (chapterId: string, updater: (chapter: StageChapter) => StageChapter) => {
      setStagedChapters((current) =>
        current.map((chapter) => (chapter.id === chapterId ? updater(chapter) : chapter)),
      );
    },
    [setStagedChapters],
  );

  const clearStage = useCallback(() => {
    revokeStagePages(stagedChapters);
    setStagedChapters([]);
    setSelectedStageChapterId(null);
    setStagePageDragState(null);
  }, [setSelectedStageChapterId, setStagedChapters, stagedChapters]);

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
        description: `${nextChapters.length} capitulo(s) detectado(s).`,
        intent: "success",
      });
    },
    [
      clearStage,
      defaultImportStatus,
      projectSnapshot,
      setSelectedStageChapterId,
      setStagedChapters,
      targetVolumeInput,
    ],
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
      operation: "create",
      warnings: [],
    };
    setStagedChapters((current) => [...current, nextChapter]);
    setSelectedStageChapterId(nextChapter.id);
  }, [
    defaultImportStatus,
    projectSnapshot,
    reconciledStagedChapters,
    selectedVolume,
    setSelectedStageChapterId,
    setStagedChapters,
    targetVolumeInput,
  ]);

  const removeStageChapter = useCallback(
    (chapterId: string) => {
      setStagedChapters((current) => {
        const next = current.filter((chapter) => chapter.id !== chapterId);
        const removed = current.find((chapter) => chapter.id === chapterId);
        if (removed) {
          revokeStagePages([removed]);
        }
        return next;
      });
      setSelectedStageChapterId((current) => (current === chapterId ? null : current));
    },
    [setSelectedStageChapterId, setStagedChapters],
  );

  const clearStagePageDragState = useCallback(() => {
    setStagePageDragState(null);
  }, []);

  const reorderStagePages = useCallback(
    (chapterId: string, fromIndex: number, toIndex: number) => {
      const sourceChapter = reconciledStagedChapters.find((chapter) => chapter.id === chapterId);
      const currentPages = sourceChapter?.pages || [];
      const nextPages = reorderList(currentPages, fromIndex, toIndex);
      if (nextPages === currentPages) {
        return;
      }
      updateStageChapter(chapterId, (chapter) => ({
        ...chapter,
        pages: reorderList(chapter.pages, fromIndex, toIndex),
      }));
      announce(buildReorderAnnouncement(`Pagina ${fromIndex + 1}`, toIndex));
    },
    [announce, reconciledStagedChapters, updateStageChapter],
  );

  const handleStagePageDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, chapterId: string, index: number) => {
      if (isImporting) {
        event.preventDefault();
        return;
      }
      setStagePageDragState({ chapterId, index, overIndex: index });
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        try {
          event.dataTransfer.setData("text/plain", `${chapterId}:${index}`);
        } catch {
          // Ignore environments without drag payload support.
        }
      }
    },
    [isImporting],
  );

  const handleStagePageDragOver = useCallback(
    (event: DragEvent<HTMLElement>, chapterId: string, index: number) => {
      if (isImporting || !stagePageDragState || stagePageDragState.chapterId !== chapterId) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      if (stagePageDragState.overIndex !== index) {
        setStagePageDragState((current) =>
          current && current.chapterId === chapterId ? { ...current, overIndex: index } : current,
        );
      }
    },
    [isImporting, stagePageDragState],
  );

  const handleStagePageDrop = useCallback(
    (event: DragEvent<HTMLElement>, chapterId: string, index: number) => {
      event.preventDefault();
      const dragState = stagePageDragState;
      clearStagePageDragState();
      if (
        isImporting ||
        !dragState ||
        dragState.chapterId !== chapterId ||
        dragState.index === index
      ) {
        return;
      }
      reorderStagePages(chapterId, dragState.index, index);
    },
    [clearStagePageDragState, isImporting, reorderStagePages, stagePageDragState],
  );

  const handleStagePageKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, chapterId: string, index: number) => {
      const total = selectedStageChapter?.pages.length || 0;
      handleAltArrowReorder({
        event,
        index,
        total,
        label: `Pagina ${index + 1}`,
        disabled: isImporting,
        onMove: (targetIndex) => reorderStagePages(chapterId, index, targetIndex),
        onAnnounce: announce,
      });
    },
    [announce, isImporting, reorderStagePages, selectedStageChapter?.pages.length],
  );

  const removeStagePage = useCallback(
    (event: MouseEvent<HTMLButtonElement>, chapterId: string, pageId: string) => {
      event.stopPropagation();
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

  const setStagePageAsCover = useCallback(
    (event: MouseEvent<HTMLButtonElement>, chapterId: string, pageId: string) => {
      event.stopPropagation();
      updateStageChapter(chapterId, (chapter) => ({
        ...chapter,
        coverPageId: pageId,
      }));
    },
    [updateStageChapter],
  );

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
        description: `${entries.length} pagina(s) anexada(s).`,
        intent: "success",
      });
      if (appendInputRef.current) {
        appendInputRef.current.value = "";
      }
    },
    [setSelectedStageChapterId, updateStageChapter],
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
      const pages = uploadedPageUrls.map((imageUrl, index) => ({ position: index + 1, imageUrl }));
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
    const chaptersToImport = reconciledStagedChapters.filter((chapter) => chapter.warnings.length === 0);
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

  useEffect(() => {
    if (
      selectedStageChapterId &&
      !reconciledStagedChapters.some((chapter) => chapter.id === selectedStageChapterId)
    ) {
      setSelectedStageChapterId(reconciledStagedChapters[0]?.id || null);
    }
  }, [reconciledStagedChapters, selectedStageChapterId, setSelectedStageChapterId]);

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
        await downloadBinaryResponse(response, `capitulo-${Number(chapter.number) || 1}.${format}`);
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
            data-testid="manga-stage-file-input"
            type="file"
            multiple
            accept="image/*"
            onChange={(event) => void prepareStageFromFiles(Array.from(event.target.files || []), "files")}
          />
          <input
            ref={folderInputRef}
            data-testid="manga-stage-folder-input"
            type="file"
            multiple
            accept="image/*"
            onChange={(event) => void prepareStageFromFiles(Array.from(event.target.files || []), "folder")}
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          />
          <Input
            ref={archiveInputRef}
            data-testid="manga-stage-archive-input"
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
            data-testid="manga-stage-append-input"
            type="file"
            multiple
            accept="image/*"
            onChange={(event) => {
              if (!selectedStageChapter) {
                return;
              }
              appendPagesToStageChapter(selectedStageChapter.id, Array.from(event.target.files || []));
            }}
          />
        </div>

        <Card className="border-border/60 bg-background/40" data-testid="manga-workflow-import-card">
          <CardContent className="space-y-5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Importacao em lote
                </h2>
                <p className="text-sm text-muted-foreground">
                  Traga paginas, ajuste o lote e importe sem telas extras.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{stageSummary.chapters} capitulo(s)</Badge>
                <Badge variant="outline">{stageSummary.pages} pagina(s)</Badge>
                {stageSummary.warnings > 0 ? (
                  <Badge variant="destructive">{stageSummary.warnings} aviso(s)</Badge>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => folderInputRef.current?.click()}
                disabled={isPreparingStage || isImporting}
              >
                {isPreparingStage ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
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

            <div
              className="flex flex-wrap items-end gap-3"
              data-testid="manga-workflow-import-fields"
            >
              <div className="space-y-2">
                <Label htmlFor="manga-stage-volume">Volume base</Label>
                <Input
                  id="manga-stage-volume"
                  type="number"
                  min={1}
                  value={targetVolumeInput}
                  onChange={(event) => setTargetVolumeInput(event.target.value)}
                  placeholder="Sem volume"
                  className="w-full sm:w-[132px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manga-stage-status">Status inicial</Label>
                <Select
                  value={defaultImportStatus}
                  onValueChange={(value) =>
                    setDefaultImportStatus(value === "published" ? "published" : "draft")
                  }
                >
                  <SelectTrigger id="manga-stage-status" className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-[240px] flex-1 flex-wrap items-end gap-2">
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
                  disabled={isImporting || reconciledStagedChapters.length === 0}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Limpar lote</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleConfirmImport()}
                  disabled={isImporting || stageSummary.ready === 0}
                >
                  {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>Importar lote</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/40" data-testid="manga-workflow-review-card">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                  Revisao do lote
                </h3>
                <p className="text-sm text-muted-foreground">
                  Capitulo, volume, titulo, status e paginas do item selecionado.
                </p>
              </div>
              {selectedStageChapter ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={selectedStageChapter.operation === "update" ? "secondary" : "outline"}>
                    {selectedStageChapter.operation === "update" ? "Atualiza existente" : "Novo capitulo"}
                  </Badge>
                  <Badge variant="outline">{selectedStageChapter.pages.length} pagina(s)</Badge>
                </div>
              ) : null}
            </div>

            {selectedStageChapter ? (
              <div className="space-y-4" data-testid="manga-workflow-review-layout">
                <div className="space-y-2">
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
                    placeholder="Opcional"
                    className="w-full"
                  />
                </div>

                <div
                  className="flex flex-wrap items-end gap-3"
                  data-testid="manga-workflow-review-fields"
                >
                  <div className="space-y-2">
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
                      className="w-full sm:w-[132px]"
                    />
                  </div>
                  <div className="space-y-2">
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
                      className="w-full sm:w-[132px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stage-chapter-publication-status">Status</Label>
                    <Select
                      value={selectedStageChapter.publicationStatus}
                      onValueChange={(value) =>
                        updateStageChapter(selectedStageChapter.id, (chapter) => ({
                          ...chapter,
                          publicationStatus: value === "published" ? "published" : "draft",
                        }))
                      }
                    >
                      <SelectTrigger
                        id="stage-chapter-publication-status"
                        className="w-full sm:w-[160px]"
                      >
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="published">Publicado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div
                  className="flex flex-wrap items-end justify-between gap-2 rounded-[18px] border border-border/50 bg-background/35 px-4 py-3 text-xs text-muted-foreground"
                  data-testid="manga-workflow-review-secondary-fields"
                >
                  <span>
                    {selectedStageChapter.sourceLabel
                      ? `Origem: ${selectedStageChapter.sourceLabel}`
                      : "Item manual do lote"}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => appendInputRef.current?.click()}
                      disabled={isImporting}
                    >
                      <ImagePlus className="h-4 w-4" />
                      <span>Adicionar paginas</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeStageChapter(selectedStageChapter.id)}
                      disabled={isImporting}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Remover do lote</span>
                    </Button>
                  </div>
                </div>

                {selectedStageChapter.warnings.length > 0 ? (
                  <div className="rounded-[18px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    <p className="font-medium text-amber-200">Ajuste antes de importar</p>
                    <ul className="mt-2 space-y-1">
                      {selectedStageChapter.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {selectedStageChapter.pages.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {selectedStageChapter.pages.map((page, index) => {
                      const isCover = page.id === selectedStageChapter.coverPageId;
                      const isDragged =
                        stagePageDragState?.chapterId === selectedStageChapter.id &&
                        stagePageDragState.index === index;
                      const isDropTarget =
                        stagePageDragState?.chapterId === selectedStageChapter.id &&
                        stagePageDragState.overIndex === index;
                      return (
                        <div
                          key={page.id}
                          className="group relative"
                          data-testid={`manga-stage-page-card-${index}`}
                          onDragOver={(event) =>
                            handleStagePageDragOver(event, selectedStageChapter.id, index)
                          }
                          onDrop={(event) =>
                            handleStagePageDrop(event, selectedStageChapter.id, index)
                          }
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            draggable={!isImporting}
                            aria-label={`Arrastar pagina ${index + 1} para reordenar. Use Alt+Seta para mover pelo teclado.`}
                            data-testid={`manga-stage-page-surface-${index}`}
                            className={[
                              "relative overflow-hidden rounded-[22px] border border-border/50 bg-background/45 transition focus:outline-none focus:ring-2 focus:ring-primary/50",
                              isDragged ? "scale-[0.99] opacity-80" : "",
                              isDropTarget ? "border-primary/60 ring-1 ring-primary/40" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onDragStart={(event) =>
                              handleStagePageDragStart(event, selectedStageChapter.id, index)
                            }
                            onDragEnd={clearStagePageDragState}
                            onKeyDown={(event) =>
                              handleStagePageKeyDown(event, selectedStageChapter.id, index)
                            }
                          >
                            <div className="aspect-[3/4] bg-muted/30">
                              <UploadPicture
                                src={page.previewUrl}
                                alt={`Pagina ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            {isCover ? (
                              <Badge className="absolute left-3 top-3">Capa</Badge>
                            ) : null}
                            <div
                              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3 pb-3 pt-10 text-[11px] font-medium text-white opacity-0 transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                              data-testid={`manga-stage-page-actions-${index}`}
                            >
                              <span>Pagina {index + 1}</span>
                              <div className="pointer-events-auto flex items-center gap-1">
                                {!isCover ? (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="secondary"
                                    className="h-8 w-8 rounded-full"
                                    aria-label="Usar capa"
                                    onClick={(event) =>
                                      setStagePageAsCover(event, selectedStageChapter.id, page.id)
                                    }
                                  >
                                    <Star className="h-4 w-4" />
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="destructive"
                                  className="h-8 w-8 rounded-full"
                                  aria-label="Remover"
                                  onClick={(event) =>
                                    removeStagePage(event, selectedStageChapter.id, page.id)
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-dashed border-border/60 bg-background/30 px-4 py-6 text-sm text-muted-foreground">
                    Nenhuma pagina neste capitulo. Adicione imagens para continuar.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-border/60 bg-background/30 px-4 py-6 text-sm text-muted-foreground">
                Selecione um capitulo do lote na sidebar ou importe novas paginas para comecar.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="border-border/60 bg-background/40" data-testid="manga-workflow-existing-card">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">
                    Capitulos em imagem
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {filteredImageChapters.length
                      ? `${CHAPTER_FILTER_MODE_LABELS[filterMode]} no filtro atual.`
                      : "Nenhum capitulo em imagem neste recorte."}
                  </p>
                </div>
                <Badge variant="outline">{filteredImageChapters.length} item(ns)</Badge>
              </div>

              {filteredImageChapters.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredImageChapters.map((chapter) => {
                    const chapterKey = buildEpisodeKey(chapter.number, chapter.volume);
                    const isExportingChapter = chapterExportState?.key === chapterKey;
                    return (
                      <div
                        key={chapterKey}
                        className="rounded-[18px] border border-border/50 bg-background/35 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => onNavigateToChapter(chapter)}
                          >
                            <p className="text-sm font-semibold text-foreground">
                              {buildExistingChapterLabel(chapter)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {Number(chapter.pageCount || 0)} pagina(s)
                            </p>
                          </button>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={chapter.publicationStatus === "draft" ? "outline" : "secondary"}
                            >
                              {chapter.publicationStatus === "draft" ? "Rascunho" : "Publicado"}
                            </Badge>
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
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label={`Abrir capitulo ${chapter.number}`}
                              onClick={() => onNavigateToChapter(chapter)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[18px] border border-dashed border-border/60 bg-background/30 px-4 py-6 text-sm text-muted-foreground">
                  Nenhum capitulo em imagem disponivel para este filtro.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/40" data-testid="manga-workflow-publication-card">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                  Publicacao e exportacao
                </h3>
                <p className="text-sm text-muted-foreground">
                  Atualize status em massa e exporte o recorte atual.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{publicationSummary.published} publicado(s)</Badge>
                <Badge variant="outline">{publicationSummary.draft} rascunho(s)</Badge>
                <Badge variant="outline">{publicationSummary.withPages} com paginas</Badge>
              </div>

              <div className="grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void applyPublicationStatus("filtered", "draft")}
                  disabled={isPublishing || filteredImageChapters.length === 0}
                >
                  {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Salvar filtrados como rascunho</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => void applyPublicationStatus("filtered", "published")}
                  disabled={isPublishing || filteredImageChapters.length === 0}
                >
                  {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>Publicar filtrados</span>
                </Button>
                {selectedVolume !== null ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void applyPublicationStatus("volume", "published")}
                    disabled={isPublishing}
                  >
                    {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    <span>Publicar volume {selectedVolume}</span>
                  </Button>
                ) : null}
              </div>

              <div className="space-y-3 rounded-[18px] border border-border/50 bg-background/35 p-4">
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
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

export default MangaWorkflowPanel;
