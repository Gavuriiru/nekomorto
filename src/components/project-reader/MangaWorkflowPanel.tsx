import { unzipSync } from "fflate";
import { LayoutGroup, useReducedMotion } from "framer-motion";
import { FileArchive, FolderOpen, ImagePlus, Loader2, Plus, Trash2, Upload } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type SetStateAction,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAccessibilityAnnouncer } from "@/hooks/accessibility-announcer";
import type { Project, ProjectEpisode } from "@/data/projects";
import { apiFetch } from "@/lib/api-client";
import { fileToDataUrl } from "@/lib/file-data-url";
import { buildEpisodeKey } from "@/lib/project-episode-key";
import { buildChapterFolder, resolveProjectImageFolders } from "@/lib/project-image-folders";
import { cn } from "@/lib/utils";
import ProjectEditorSectionCard from "@/components/project-reader/ProjectEditorSectionCard";
import {
  buildReorderAnnouncement,
  buildPreviewReorderList,
  getReorderLayoutTransition,
  handleAltArrowReorder,
  hasExceededPointerDragThreshold,
  reorderList,
  resolvePointerReorderIndex,
  resolvePageDisplayName,
} from "@/components/project-reader/page-reorder";
import MangaPageTile from "@/components/project-reader/MangaPageTile";
import { mergeImportedImageChaptersIntoProject } from "@/lib/project-manga";
import { getProjectProgressState, syncProjectProgress } from "@/lib/project-progress";

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
  synopsis: string;
  titleDetected: string;
  sourceLabel: string;
  pages: StagePage[];
  coverPageId: string | null;
  entryKind: "main" | "extra";
  entrySubtype: string;
  displayLabel?: string;
  publicationStatus: "draft" | "published";
  progressStage?: string;
  completedStages: string[];
  operation: "create" | "update";
  warnings: string[];
  leaveGuardPristine?: boolean;
};

type StagePagePointerDragState = {
  chapterId: string;
  sourceIndex: number;
  overIndex: number;
  pointerId: number;
  startX: number;
  startY: number;
  isDragging: boolean;
};

export type MangaWorkflowPanelHandle = {
  hasUnsavedChanges: () => boolean;
  savePreparedChaptersAsDraft: () => Promise<boolean>;
  discardPreparedChapters: () => void;
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
  onSelectedStageChapterChange?: (chapter: StageChapter | null) => void;
  onOpenImportedChapter?: (nextProject: ProjectRecord, importedChapters: ProjectEpisode[]) => void;
};

const NATURAL_COLLATOR = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});

const compareNatural = (left: string, right: string) => NATURAL_COLLATOR.compare(left, right);
const normalizeText = (value: unknown) => String(value || "").trim();
const resolveStageEntrySubtype = (entryKind: StageChapter["entryKind"]) =>
  entryKind === "extra" ? "extra" : "chapter";
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

const syncStageChapterProgress = (chapter: StageChapter): StageChapter =>
  syncProjectProgress(chapter, "manga");

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
  value.replace(pattern, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

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

const buildVolumeLabel = (value: number | null | undefined) =>
  Number.isFinite(Number(value)) && Number(value) > 0 ? `Volume ${Number(value)}` : "Sem volume";

export const buildStageChapterLabel = (
  chapter: Pick<StageChapter, "number" | "volume" | "title">,
) => {
  const title = normalizeText(chapter.title);
  const baseLabel = `${buildVolumeLabel(chapter.volume)} - Capítulo ${chapter.number}`;
  return title ? `${baseLabel} - ${title}` : baseLabel;
};

const readArchiveEntries = async (archiveFile: File): Promise<ImportEntry[]> => {
  const archiveBuffer = new Uint8Array(await archiveFile.arrayBuffer());
  const extracted = unzipSync(archiveBuffer);
  return Object.entries(extracted)
    .map(([relativePath, content]) => {
      const normalizedPath = normalizeRelativeImportPath(relativePath);
      const name = normalizedPath.split("/").pop() || "pagina";
      const file = new File([Uint8Array.from(content)], name, {
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
    const volumeKey = Number.isFinite(Number(episode.volume))
      ? String(Number(episode.volume))
      : "none";
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
  targetChapter,
  defaultStatus,
}: {
  project: ProjectRecord;
  entries: ImportEntry[];
  targetVolume: number | null;
  targetChapter: number | null;
  defaultStatus: "draft" | "published";
}): StageChapter[] => {
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
          "Capítulo",
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
    .map((group, index) => {
      const volume = group.volumeHint || null;
      const volumeKey = volume !== null ? String(volume) : "none";
      const chapterNumber =
        (index === 0 ? targetChapter : null) ||
        group.chapterHint ||
        nextByVolume.get(volumeKey) ||
        1;
      nextByVolume.set(volumeKey, chapterNumber + 1);
      const key = buildEpisodeKey(chapterNumber, volume ?? undefined);
      const existing = existingByKey.get(key);
      const pages = group.entries
        .slice()
        .sort((left, right) => compareNatural(left.relativePath, right.relativePath))
        .map((entry) => createStagePage(entry.file, entry.relativePath));
      return syncStageChapterProgress({
        id: createStageId(),
        number: chapterNumber,
        volume,
        title: group.titleHint || normalizeText(existing?.title),
        synopsis: normalizeText(existing?.synopsis),
        titleDetected: group.titleHint,
        sourceLabel: group.sourceLabel,
        pages,
        coverPageId: pages[0]?.id || null,
        entryKind: existing?.entryKind === "extra" ? "extra" : "main",
        entrySubtype:
          normalizeText(existing?.entrySubtype) ||
          resolveStageEntrySubtype(existing?.entryKind === "extra" ? "extra" : "main"),
        displayLabel:
          existing?.entryKind === "extra"
            ? normalizeText(existing?.displayLabel) || "Extra"
            : undefined,
        publicationStatus:
          existing?.publicationStatus === "published" ? "published" : defaultStatus,
        progressStage: normalizeText(existing?.progressStage) || undefined,
        completedStages: Array.isArray(existing?.completedStages) ? existing.completedStages : [],
        operation: existing ? "update" : "create",
        warnings: [],
        leaveGuardPristine: false,
      } satisfies StageChapter);
    });
};

export const reconcileStageChapters = (
  project: ProjectRecord,
  chapters: StageChapter[],
): StageChapter[] => {
  const existingByKey = buildExistingChapterLookup(project);
  const seenKeys = new Set<string>();
  return chapters.map((chapter) => {
    const warnings: string[] = [];
    const volume = chapter.volume !== null ? chapter.volume : undefined;
    const key = buildEpisodeKey(chapter.number, volume);
    const existing = existingByKey.get(key);
    if (!parsePositiveInteger(chapter.number)) {
      warnings.push("Número de capítulo inválido.");
    }
    if (seenKeys.has(key)) {
      warnings.push("Já existe outro capítulo preparado com esse número + volume.");
    }
    seenKeys.add(key);
    return syncStageChapterProgress({
      ...chapter,
      coverPageId: chapter.pages.some((page) => page.id === chapter.coverPageId)
        ? chapter.coverPageId
        : chapter.pages[0]?.id || null,
      operation: existing ? "update" : "create",
      warnings,
      leaveGuardPristine: chapter.leaveGuardPristine === true,
    });
  });
};

const markStageChapterAsEdited = (chapter: StageChapter): StageChapter =>
  chapter.leaveGuardPristine === true ? { ...chapter, leaveGuardPristine: false } : chapter;

const MangaWorkflowPanel = forwardRef<MangaWorkflowPanelHandle, MangaWorkflowPanelProps>(
  (
    {
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
      onSelectedStageChapterChange,
      onOpenImportedChapter,
    },
    ref,
  ) => {
    const shouldReduceMotion = useReducedMotion();
    const archiveInputRef = useRef<HTMLInputElement | null>(null);
    const folderInputRef = useRef<HTMLInputElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const appendInputRef = useRef<HTMLInputElement | null>(null);
    const { announce } = useAccessibilityAnnouncer();
    const [targetVolumeInput, setTargetVolumeInput] = useState(
      selectedVolume !== null ? String(selectedVolume) : "",
    );
    const [targetChapterInput, setTargetChapterInput] = useState("");
    const [defaultImportStatus, setDefaultImportStatus] = useState<"draft" | "published">("draft");
    const [isPreparingStage, setIsPreparingStage] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [reviewImportStatus, setReviewImportStatus] = useState<"draft" | "published" | null>(
      null,
    );
    const stagePageDragStateRef = useRef<StagePagePointerDragState | null>(null);
    const [stagePageDragState, setStagePageDragState] = useState<StagePagePointerDragState | null>(
      null,
    );
    const reorderTransition = useMemo(
      () => getReorderLayoutTransition(!!shouldReduceMotion),
      [shouldReduceMotion],
    );

    useEffect(() => {
      setTargetVolumeInput(selectedVolume !== null ? String(selectedVolume) : "");
    }, [selectedVolume]);

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
    const previewStagePages = useMemo(() => {
      if (!selectedStageChapter) {
        return [];
      }
      if (
        stagePageDragState?.chapterId !== selectedStageChapter.id ||
        !stagePageDragState.isDragging
      ) {
        return selectedStageChapter.pages;
      }
      return buildPreviewReorderList(
        selectedStageChapter.pages,
        stagePageDragState.sourceIndex,
        stagePageDragState.overIndex,
      );
    }, [selectedStageChapter, stagePageDragState]);
    const draggedStagePage =
      selectedStageChapter &&
      stagePageDragState?.chapterId === selectedStageChapter.id &&
      stagePageDragState.isDragging
        ? selectedStageChapter.pages[stagePageDragState.sourceIndex] || null
        : null;

    useEffect(() => {
      onSelectedStageChapterChange?.(selectedStageChapter);
    }, [onSelectedStageChapterChange, selectedStageChapter]);

    const stageSummary = useMemo(
      () => ({
        chapters: reconciledStagedChapters.length,
        pages: reconciledStagedChapters.reduce((total, chapter) => total + chapter.pages.length, 0),
        warnings: reconciledStagedChapters.reduce(
          (total, chapter) => total + chapter.warnings.length,
          0,
        ),
      }),
      [reconciledStagedChapters],
    );
    const selectedStageProgressState = useMemo(
      () =>
        selectedStageChapter && selectedStageChapter.publicationStatus === "draft"
          ? getProjectProgressState({
              kind: "manga",
              completedStages: selectedStageChapter.completedStages,
            })
          : null,
      [selectedStageChapter],
    );
    const hasUnsavedStageChanges = useMemo(
      () => reconciledStagedChapters.some((chapter) => chapter.leaveGuardPristine !== true),
      [reconciledStagedChapters],
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
          toast({ title: "Nenhuma imagem válida encontrada", variant: "destructive" });
          return;
        }
        clearStage();
        const nextChapters = buildStageChaptersFromEntries({
          project: projectSnapshot,
          entries,
          targetVolume: parsePositiveInteger(targetVolumeInput),
          targetChapter: parsePositiveInteger(targetChapterInput),
          defaultStatus: defaultImportStatus,
        });
        setStagedChapters(nextChapters);
        setSelectedStageChapterId(nextChapters[0]?.id || null);
        toast({
          title: "Importação preparada",
          description: `${nextChapters.length} capítulo(s) detectado(s).`,
          intent: "success",
        });
      },
      [
        clearStage,
        defaultImportStatus,
        projectSnapshot,
        setSelectedStageChapterId,
        setStagedChapters,
        targetChapterInput,
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
          toast({ title: "Não foi possível preparar a importação", variant: "destructive" });
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
      const nextByVolume = buildNextChapterNumberByVolume(
        projectSnapshot,
        reconciledStagedChapters,
      );
      const volume = parsePositiveInteger(targetVolumeInput) || selectedVolume || null;
      const volumeKey = volume !== null ? String(volume) : "none";
      const chapterNumber =
        parsePositiveInteger(targetChapterInput) || nextByVolume.get(volumeKey) || 1;
      const nextChapter: StageChapter = {
        id: createStageId(),
        number: chapterNumber,
        volume,
        title: "",
        synopsis: "",
        titleDetected: "",
        sourceLabel: "Capítulo manual",
        pages: [],
        coverPageId: null,
        entryKind: "main",
        entrySubtype: "chapter",
        displayLabel: undefined,
        publicationStatus: defaultImportStatus,
        progressStage: "aguardando-raw",
        completedStages: [],
        operation: "create",
        warnings: [],
        leaveGuardPristine: true,
      };
      setStagedChapters((current) => [...current, syncStageChapterProgress(nextChapter)]);
      setSelectedStageChapterId(nextChapter.id);
    }, [
      defaultImportStatus,
      projectSnapshot,
      reconciledStagedChapters,
      selectedVolume,
      setSelectedStageChapterId,
      setStagedChapters,
      targetChapterInput,
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
    const handleToggleStageProgressStage = useCallback(
      (stageId: string) => {
        if (!selectedStageChapter) {
          return;
        }
        updateStageChapter(selectedStageChapter.id, (chapter) => {
          const completedSet = new Set(
            getProjectProgressState({
              kind: "manga",
              completedStages: chapter.completedStages,
            }).completedStages,
          );
          if (completedSet.has(stageId)) {
            completedSet.delete(stageId);
          } else {
            completedSet.add(stageId);
          }
          return syncStageChapterProgress({
            ...markStageChapterAsEdited(chapter),
            completedStages: Array.from(completedSet),
          });
        });
      },
      [selectedStageChapter, updateStageChapter],
    );

    const removeStageChapters = useCallback(
      (chapterIds: string[]) => {
        const chapterIdSet = new Set(chapterIds);
        setStagedChapters((current) => {
          const removed = current.filter((chapter) => chapterIdSet.has(chapter.id));
          if (removed.length > 0) {
            revokeStagePages(removed);
          }
          return current.filter((chapter) => !chapterIdSet.has(chapter.id));
        });
        setSelectedStageChapterId((current) =>
          current && chapterIdSet.has(current) ? null : current,
        );
      },
      [setSelectedStageChapterId, setStagedChapters],
    );

    const clearStagePageDragState = useCallback(() => {
      stagePageDragStateRef.current = null;
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
          ...markStageChapterAsEdited(chapter),
          pages: reorderList(chapter.pages, fromIndex, toIndex),
        }));
        announce(buildReorderAnnouncement(`Página ${fromIndex + 1}`, toIndex));
      },
      [announce, reconciledStagedChapters, updateStageChapter],
    );

    const handleStagePagePointerDown = useCallback(
      (event: PointerEvent<HTMLDivElement>, chapterId: string, index: number) => {
        if (isImporting) {
          return;
        }
        if (event.pointerType === "mouse" && event.button !== 0) {
          return;
        }
        const nextState = {
          chapterId,
          sourceIndex: index,
          overIndex: index,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          isDragging: false,
        };
        stagePageDragStateRef.current = nextState;
        setStagePageDragState(nextState);
      },
      [isImporting],
    );

    const handleStagePagePointerMove = useCallback(
      (event: PointerEvent<HTMLDivElement>) => {
        if (isImporting) {
          return;
        }
        setStagePageDragState((current) => {
          if (
            !current ||
            (Number.isFinite(event.pointerId) && current.pointerId !== event.pointerId)
          ) {
            return current;
          }

          const resolvedIndex = resolvePointerReorderIndex({
            clientX: event.clientX,
            clientY: event.clientY,
            scope: "manga-stage-page",
          });
          const nextIsDragging =
            current.isDragging ||
            hasExceededPointerDragThreshold({
              startX: current.startX,
              startY: current.startY,
              clientX: event.clientX,
              clientY: event.clientY,
            }) ||
            (resolvedIndex !== null && resolvedIndex !== current.sourceIndex);

          if (!nextIsDragging) {
            return current;
          }

          const nextOverIndex = resolvedIndex ?? current.overIndex;

          if (current.isDragging === nextIsDragging && current.overIndex === nextOverIndex) {
            return current;
          }

          const nextState = {
            ...current,
            isDragging: nextIsDragging,
            overIndex: nextOverIndex,
          };
          stagePageDragStateRef.current = nextState;
          return nextState;
        });
      },
      [isImporting],
    );

    const handleStagePagePointerUp = useCallback(
      (event: PointerEvent<HTMLDivElement>, chapterId: string) => {
        const dragState = stagePageDragStateRef.current;
        clearStagePageDragState();
        if (
          isImporting ||
          !dragState ||
          (Number.isFinite(event.pointerId) && dragState.pointerId !== event.pointerId) ||
          dragState.chapterId !== chapterId ||
          !dragState.isDragging
        ) {
          return;
        }

        const resolvedIndex = resolvePointerReorderIndex({
          clientX: event.clientX,
          clientY: event.clientY,
          scope: "manga-stage-page",
        });
        const targetIndex = resolvedIndex ?? dragState.overIndex;
        if (dragState.sourceIndex === targetIndex) {
          return;
        }
        reorderStagePages(chapterId, dragState.sourceIndex, targetIndex);
      },
      [clearStagePageDragState, isImporting, reorderStagePages],
    );

    const handleStagePageKeyDown = useCallback(
      (event: KeyboardEvent<HTMLDivElement>, chapterId: string, index: number) => {
        const total = selectedStageChapter?.pages.length || 0;
        handleAltArrowReorder({
          event,
          index,
          total,
          label: `Página ${index + 1}`,
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
            ...markStageChapterAsEdited(chapter),
            pages: nextPages,
            coverPageId:
              chapter.coverPageId === pageId ? nextPages[0]?.id || null : chapter.coverPageId,
          };
        });
      },
      [updateStageChapter],
    );

    const setStagePageAsCover = useCallback(
      (event: MouseEvent<HTMLButtonElement>, chapterId: string, pageId: string) => {
        event.stopPropagation();
        updateStageChapter(chapterId, (chapter) => ({
          ...markStageChapterAsEdited(chapter),
          coverPageId: pageId,
        }));
      },
      [updateStageChapter],
    );

    const appendPagesToStageChapter = useCallback(
      (chapterId: string, files: File[]) => {
        const entries = readDirectEntries(files);
        if (!entries.length) {
          toast({ title: "Nenhuma imagem válida encontrada", variant: "destructive" });
          return;
        }
        updateStageChapter(chapterId, (chapter) => {
          const nextPages = entries.map((entry) => createStagePage(entry.file, entry.relativePath));
          return {
            ...markStageChapterAsEdited(chapter),
            pages: [...chapter.pages, ...nextPages],
            coverPageId: chapter.coverPageId || nextPages[0]?.id || null,
          };
        });
        setSelectedStageChapterId(chapterId);
        toast({
          title: "Páginas adicionadas",
          description: `${entries.length} página(s) anexada(s).`,
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
      (
        stageChapter: StageChapter,
        uploadedPageUrls: string[],
        publicationStatusOverride?: "draft" | "published",
      ) => {
        const key = buildEpisodeKey(stageChapter.number, stageChapter.volume ?? undefined);
        const existing =
          (Array.isArray(projectSnapshot.episodeDownloads)
            ? projectSnapshot.episodeDownloads
            : []
          ).find((episode) => buildEpisodeKey(episode.number, episode.volume) === key) || null;
        const stageEntryKind = stageChapter.entryKind === "extra" ? "extra" : "main";
        const stageSynopsis = normalizeText(stageChapter.synopsis);
        const pages = uploadedPageUrls.map((imageUrl, index) => ({
          position: index + 1,
          imageUrl,
        }));
        const coverIndex = Math.max(
          0,
          stageChapter.pages.findIndex((page) => page.id === stageChapter.coverPageId),
        );
        return {
          ...(existing || {}),
          number: stageChapter.number,
          volume: stageChapter.volume ?? undefined,
          title: normalizeText(stageChapter.title) || normalizeText(existing?.title),
          synopsis: stageSynopsis || normalizeText(existing?.synopsis),
          entryKind: stageEntryKind,
          entrySubtype:
            normalizeText(stageChapter.entrySubtype) || resolveStageEntrySubtype(stageEntryKind),
          readingOrder: Number.isFinite(Number(existing?.readingOrder))
            ? Number(existing?.readingOrder)
            : undefined,
          displayLabel:
            stageEntryKind === "extra"
              ? normalizeText(stageChapter.displayLabel) ||
                normalizeText(existing?.displayLabel) ||
                "Extra"
              : undefined,
          releaseDate: normalizeText(existing?.releaseDate),
          duration: normalizeText(existing?.duration),
          sourceType:
            existing?.sourceType === "Web" || existing?.sourceType === "Blu-ray"
              ? existing.sourceType
              : "Web",
          sources: Array.isArray(existing?.sources) ? existing.sources : [],
          progressStage:
            normalizeText(stageChapter.progressStage) ||
            normalizeText(existing?.progressStage) ||
            undefined,
          completedStages: Array.isArray(stageChapter.completedStages)
            ? stageChapter.completedStages
            : Array.isArray(existing?.completedStages)
              ? existing.completedStages
              : [],
          content: "",
          contentFormat: "images" as const,
          pages,
          pageCount: pages.length,
          hasPages: pages.length > 0,
          coverImageUrl: uploadedPageUrls[coverIndex] || uploadedPageUrls[0] || "",
          coverImageAlt:
            normalizeText(existing?.coverImageAlt) ||
            (uploadedPageUrls[0] ? `Capa do capítulo ${stageChapter.number}` : ""),
          publicationStatus: publicationStatusOverride ?? stageChapter.publicationStatus,
        } satisfies ProjectEpisode;
      },
      [projectSnapshot.episodeDownloads],
    );

    const importStageChapters = useCallback(
      async (
        chaptersToImport: StageChapter[],
        options?: {
          publicationStatusOverride?: "draft" | "published";
          successTitle?: string;
          successDescription?: string;
          openImportedChapter?: boolean;
        },
      ) => {
        if (!chaptersToImport.length) {
          toast({ title: "Nenhum capítulo pronto para importar", variant: "destructive" });
          return false;
        }

        setIsImporting(true);
        try {
          const { projectChaptersFolder } = resolveProjectImageFolders(
            projectSnapshot.id,
            projectSnapshot.title,
          );
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
            importedChapters.push(
              buildImportedChapter(chapter, uploadedPageUrls, options?.publicationStatusOverride),
            );
          }

          const nextSnapshot = mergeImportedImageChaptersIntoProject(
            projectSnapshot,
            importedChapters,
          );
          const persistedProject = await onPersistProjectSnapshot(nextSnapshot, {
            context: "manga-import",
          });
          if (!persistedProject) {
            return false;
          }

          const firstImported = importedChapters
            .map(
              (chapter) =>
                (Array.isArray(persistedProject.episodeDownloads)
                  ? persistedProject.episodeDownloads
                  : []
                ).find(
                  (episode) =>
                    buildEpisodeKey(episode.number, episode.volume) ===
                    buildEpisodeKey(chapter.number, chapter.volume),
                ) || null,
            )
            .find(Boolean);

          removeStageChapters(chaptersToImport.map((chapter) => chapter.id));
          if (options?.openImportedChapter !== false && onOpenImportedChapter) {
            onOpenImportedChapter(persistedProject, importedChapters);
          } else {
            onProjectChange(persistedProject);
          }

          toast({
            title: options?.successTitle || "Importação concluída",
            description:
              options?.successDescription ||
              `${importedChapters.length} capítulo(s) persistido(s) no projeto.`,
            intent: "success",
          });

          if (firstImported && options?.openImportedChapter !== false && !onOpenImportedChapter) {
            onNavigateToChapter(firstImported);
          }
          return true;
        } catch {
          toast({ title: "Não foi possível concluir a importação", variant: "destructive" });
          return false;
        } finally {
          setIsImporting(false);
        }
      },
      [
        buildImportedChapter,
        onNavigateToChapter,
        onOpenImportedChapter,
        onPersistProjectSnapshot,
        onProjectChange,
        projectSnapshot,
        removeStageChapters,
        uploadStagePage,
      ],
    );

    const handleImportSelectedStageChapter = useCallback(
      async (publicationStatus: "draft" | "published") => {
        if (!selectedStageChapter) {
          return;
        }
        if (publicationStatus === "published" && !selectedStageChapter.pages.length) {
          toast({
            title: "Adicione imagens antes de publicar o capítulo",
            variant: "destructive",
          });
          return;
        }
        if (selectedStageChapter.warnings.length > 0) {
          return;
        }

        setReviewImportStatus(publicationStatus);
        try {
          await importStageChapters([selectedStageChapter], {
            publicationStatusOverride: publicationStatus,
            successTitle:
              publicationStatus === "published"
                ? "Capítulo publicado"
                : "Capítulo salvo como rascunho",
            successDescription: "O capítulo selecionado já abriu no editor.",
          });
        } finally {
          setReviewImportStatus(null);
        }
      },
      [importStageChapters, selectedStageChapter],
    );

    const savePreparedChaptersAsDraft = useCallback(async () => {
      if (!hasUnsavedStageChanges) {
        return true;
      }
      if (reconciledStagedChapters.some((chapter) => chapter.warnings.length > 0)) {
        toast({
          title: "Ajuste os capítulos preparados antes de sair",
          description: "Corrija os avisos pendentes ou descarte o lote preparado.",
          variant: "destructive",
        });
        return false;
      }
      return await importStageChapters(reconciledStagedChapters, {
        publicationStatusOverride: "draft",
        successTitle: "Rascunhos salvos",
        successDescription: `${reconciledStagedChapters.length} capítulo(s) preparado(s) salvo(s) como rascunho.`,
        openImportedChapter: false,
      });
    }, [hasUnsavedStageChanges, importStageChapters, reconciledStagedChapters]);

    useImperativeHandle(
      ref,
      () => ({
        hasUnsavedChanges: () => hasUnsavedStageChanges,
        savePreparedChaptersAsDraft,
        discardPreparedChapters: clearStage,
      }),
      [clearStage, hasUnsavedStageChanges, savePreparedChaptersAsDraft],
    );

    useEffect(() => {
      if (
        selectedStageChapterId &&
        !reconciledStagedChapters.some((chapter) => chapter.id === selectedStageChapterId)
      ) {
        setSelectedStageChapterId(reconciledStagedChapters[0]?.id || null);
      }
    }, [reconciledStagedChapters, selectedStageChapterId, setSelectedStageChapterId]);

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
              onChange={(event) =>
                void prepareStageFromFiles(Array.from(event.target.files || []), "files")
              }
            />
            <input
              ref={folderInputRef}
              data-testid="manga-stage-folder-input"
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
                appendPagesToStageChapter(
                  selectedStageChapter.id,
                  Array.from(event.target.files || []),
                );
              }}
            />
          </div>

          {reconciledStagedChapters.length === 0 ? (
            <Card
              className="border-border/60 bg-background/40"
              data-testid="manga-workflow-import-card"
            >
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      Importação
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Traga páginas, ajuste os dados iniciais e importe sem telas extras.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{stageSummary.chapters} capítulo(s)</Badge>
                    <Badge variant="outline">{stageSummary.pages} página(s)</Badge>
                    {stageSummary.warnings > 0 ? (
                      <Badge variant="destructive">{stageSummary.warnings} aviso(s)</Badge>
                    ) : null}
                  </div>
                </div>

                <div
                  className="space-y-3 rounded-xl border border-border/50 bg-background/30 p-3"
                  data-testid="manga-workflow-import-sources"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-foreground">Adicionar arquivos</h3>
                    <p className="text-xs text-muted-foreground">
                      Pasta, imagens avulsas, ZIP ou um capítulo manual.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start"
                      onClick={() => folderInputRef.current?.click()}
                      disabled={isPreparingStage || isImporting}
                    >
                      {isPreparingStage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FolderOpen className="h-4 w-4" />
                      )}
                      <span>Pasta</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isPreparingStage || isImporting}
                    >
                      <ImagePlus className="h-4 w-4" />
                      <span>Imagens</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start"
                      onClick={() => archiveInputRef.current?.click()}
                      disabled={isPreparingStage || isImporting}
                    >
                      <FileArchive className="h-4 w-4" />
                      <span>ZIP</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start"
                      onClick={addManualStageChapter}
                      disabled={isPreparingStage || isImporting}
                    >
                      <Plus className="h-4 w-4" />
                      <span>Novo capítulo</span>
                    </Button>
                  </div>
                </div>

                <div
                  className="space-y-3 rounded-xl border border-border/50 bg-background/30 p-3"
                  data-testid="manga-workflow-import-fields"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-foreground">Dados iniciais</h3>
                    <p className="text-xs text-muted-foreground">
                      Defina volume, capítulo e status inicial antes de preparar os arquivos.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="manga-stage-volume">Volume</Label>
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
                      <Label htmlFor="manga-stage-chapter">Capítulo</Label>
                      <Input
                        id="manga-stage-chapter"
                        type="number"
                        min={1}
                        value={targetChapterInput}
                        onChange={(event) => setTargetChapterInput(event.target.value)}
                        placeholder="Automático"
                        className="w-full sm:w-[132px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manga-stage-status">Status inicial</Label>
                      <Combobox
                        id="manga-stage-status"
                        value={defaultImportStatus}
                        onValueChange={(value) =>
                          setDefaultImportStatus(value === "published" ? "published" : "draft")
                        }
                        ariaLabel="Status inicial"
                        options={[
                          { value: "draft", label: "Rascunho" },
                          { value: "published", label: "Publicado" },
                        ]}
                        placeholder="Status"
                        searchable={false}
                        className="w-full sm:w-[160px]"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-4" data-testid="manga-workflow-review-card">
            {selectedStageChapter ? (
              <div className="space-y-4" data-testid="manga-workflow-review-layout">
                <div
                  className={cn(
                    "grid gap-4",
                    selectedStageProgressState
                      ? "xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
                      : "xl:grid-cols-1",
                  )}
                  data-testid="manga-workflow-review-top-row"
                >
                  <ProjectEditorSectionCard
                    title="Dados do capítulo"
                    subtitle="Volume, capítulo, tipo de entrada, título e sinopse."
                    eyebrow="Ficha editorial"
                    testId="manga-workflow-review-data-card"
                    actions={
                      <>
                        <Badge
                          variant="secondary"
                          className="text-[10px] uppercase tracking-[0.12em]"
                        >
                          {selectedStageChapter.entryKind === "extra" ? "Extra" : "Capítulo"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-[0.12em]"
                        >
                          {selectedStageChapter.volume !== null
                            ? `Volume ${selectedStageChapter.volume}`
                            : "Sem volume"}
                        </Badge>
                      </>
                    }
                  >
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="stage-chapter-title">Título</Label>
                        <Input
                          id="stage-chapter-title"
                          value={selectedStageChapter.title}
                          onChange={(event) =>
                            updateStageChapter(selectedStageChapter.id, (chapter) => ({
                              ...markStageChapterAsEdited(chapter),
                              title: event.target.value,
                            }))
                          }
                          placeholder="Opcional"
                          className="w-full"
                        />
                      </div>

                      <div
                        className="grid gap-3 md:grid-cols-3"
                        data-testid="manga-workflow-review-fields"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="stage-chapter-volume">Volume</Label>
                          <Input
                            id="stage-chapter-volume"
                            type="number"
                            min={1}
                            value={selectedStageChapter.volume ?? ""}
                            onChange={(event) =>
                              updateStageChapter(selectedStageChapter.id, (chapter) => ({
                                ...markStageChapterAsEdited(chapter),
                                volume: event.target.value.trim()
                                  ? Math.max(1, Number(event.target.value) || 1)
                                  : null,
                              }))
                            }
                            placeholder="Sem volume"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stage-chapter-number">Capítulo</Label>
                          <Input
                            id="stage-chapter-number"
                            type="number"
                            min={1}
                            value={selectedStageChapter.number}
                            onChange={(event) =>
                              updateStageChapter(selectedStageChapter.id, (chapter) => ({
                                ...markStageChapterAsEdited(chapter),
                                number: Math.max(1, Number(event.target.value) || chapter.number),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stage-chapter-entry-kind">Tipo de entrada</Label>
                          <Combobox
                            id="stage-chapter-entry-kind"
                            value={selectedStageChapter.entryKind === "extra" ? "extra" : "main"}
                            onValueChange={(value) =>
                              updateStageChapter(selectedStageChapter.id, (chapter) => {
                                const nextEntryKind = value === "extra" ? "extra" : "main";
                                return {
                                  ...markStageChapterAsEdited(chapter),
                                  entryKind: nextEntryKind,
                                  entrySubtype: resolveStageEntrySubtype(nextEntryKind),
                                  displayLabel:
                                    nextEntryKind === "extra"
                                      ? chapter.displayLabel || "Extra"
                                      : undefined,
                                };
                              })
                            }
                            ariaLabel="Tipo de entrada"
                            options={[
                              { value: "main", label: "Capítulo" },
                              { value: "extra", label: "Extra" },
                            ]}
                            placeholder="Tipo"
                            searchable={false}
                          />
                        </div>
                      </div>

                      {selectedStageChapter.entryKind === "extra" ? (
                        <div className="space-y-2">
                          <Label htmlFor="stage-chapter-display-label">Rótulo do extra</Label>
                          <Input
                            id="stage-chapter-display-label"
                            value={selectedStageChapter.displayLabel || ""}
                            onChange={(event) =>
                              updateStageChapter(selectedStageChapter.id, (chapter) => ({
                                ...markStageChapterAsEdited(chapter),
                                displayLabel: event.target.value,
                              }))
                            }
                            placeholder="Ex.: Side Story"
                          />
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <Label htmlFor="stage-chapter-synopsis">Sinopse</Label>
                        <Textarea
                          id="stage-chapter-synopsis"
                          value={selectedStageChapter.synopsis || ""}
                          onChange={(event) =>
                            updateStageChapter(selectedStageChapter.id, (chapter) => ({
                              ...markStageChapterAsEdited(chapter),
                              synopsis: event.target.value,
                            }))
                          }
                          rows={4}
                        />
                      </div>
                    </div>
                  </ProjectEditorSectionCard>

                  {selectedStageProgressState ? (
                    <ProjectEditorSectionCard
                      title="Em progresso"
                      subtitle="Acompanhe o pipeline editorial do capítulo atual."
                      eyebrow="Fluxo editorial"
                      testId="manga-workflow-progress-section"
                      bodyClassName="space-y-3 py-4"
                      actions={
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-[0.12em]"
                        >
                          <span data-testid="manga-workflow-progress-percent">
                            {selectedStageProgressState.progress}%
                          </span>
                        </Badge>
                      }
                    >
                      <div className="space-y-3">
                        <div
                          className="flex flex-wrap items-center gap-1.5"
                          data-testid="manga-workflow-progress-stage-track"
                          role="list"
                          aria-label="Resumo visual das etapas editoriais"
                        >
                          {selectedStageProgressState.stages.map((stage) => {
                            const isCompleted = selectedStageProgressState.completedStages.includes(
                              stage.id,
                            );
                            const isCurrentStage =
                              stage.id === selectedStageProgressState.currentStageId;
                            return (
                              <span
                                key={stage.id}
                                role="listitem"
                                title={stage.label}
                                aria-label={`${stage.label}: ${
                                  isCompleted ? "concluída" : isCurrentStage ? "atual" : "pendente"
                                }`}
                                data-testid={`manga-workflow-progress-stage-chip-${stage.id}`}
                                className={cn(
                                  "block h-2.5 rounded-full transition-colors",
                                  isCompleted
                                    ? "w-6 bg-primary"
                                    : isCurrentStage
                                      ? cn(
                                          "w-10 border border-border/60 bg-background/80",
                                          stage.indicatorClassName,
                                        )
                                      : "w-2.5 bg-muted/55",
                                )}
                              />
                            );
                          })}
                        </div>

                        <div
                          className="space-y-2"
                          data-testid="manga-workflow-progress-stage-list"
                          role="group"
                          aria-label="Etapas concluídas"
                        >
                          {selectedStageProgressState.stages.map((stage) => {
                            const isCompleted = selectedStageProgressState.completedStages.includes(
                              stage.id,
                            );
                            const isCurrentStage =
                              stage.id === selectedStageProgressState.currentStageId;
                            return (
                              <label
                                key={stage.id}
                                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/35 px-3 py-2.5"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <Checkbox
                                    checked={isCompleted}
                                    onCheckedChange={() => handleToggleStageProgressStage(stage.id)}
                                    data-testid={`manga-workflow-progress-toggle-${stage.id}`}
                                    aria-label={stage.label}
                                  />
                                  <span className="truncate text-sm font-medium text-foreground">
                                    {stage.label}
                                  </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {isCompleted
                                      ? "Concluída"
                                      : isCurrentStage
                                        ? "Atual"
                                        : "Pendente"}
                                  </span>
                                  {isCurrentStage ? (
                                    <Badge variant="info" className="shrink-0">
                                      Atual
                                    </Badge>
                                  ) : null}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </ProjectEditorSectionCard>
                  ) : null}
                </div>

                <ProjectEditorSectionCard
                  title="Páginas"
                  subtitle="Upload, ordem de leitura e capa em um fluxo simples para capítulos em imagem."
                  eyebrow="Leitura em imagem"
                  testId="manga-workflow-pages-card"
                  bodyClassName="space-y-4 py-5"
                >
                  <div
                    className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
                    data-testid="manga-workflow-pages-toolbar"
                  >
                    <div
                      className="flex flex-wrap items-center gap-2"
                      data-testid="manga-workflow-pages-badges"
                    >
                      <Badge
                        variant={
                          selectedStageChapter.operation === "update" ? "secondary" : "outline"
                        }
                      >
                        {selectedStageChapter.operation === "update"
                          ? "Atualiza existente"
                          : "Novo capítulo"}
                      </Badge>
                      <Badge
                        variant={
                          selectedStageChapter.publicationStatus === "draft"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {selectedStageChapter.publicationStatus === "draft"
                          ? "Rascunho"
                          : "Publicado"}
                      </Badge>
                      <Badge variant="outline">{selectedStageChapter.pages.length} página(s)</Badge>
                    </div>

                    <div
                      className="flex flex-wrap items-center gap-2 xl:justify-end"
                      data-testid="manga-workflow-review-actions"
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleImportSelectedStageChapter("draft")}
                        disabled={isImporting || selectedStageChapter.warnings.length > 0}
                      >
                        {reviewImportStatus === "draft" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        <span>Salvar como rascunho</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleImportSelectedStageChapter("published")}
                        disabled={
                          isImporting ||
                          selectedStageChapter.warnings.length > 0 ||
                          selectedStageChapter.pages.length === 0
                        }
                      >
                        {reviewImportStatus === "published" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        <span>Publicar</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => appendInputRef.current?.click()}
                        disabled={isImporting}
                      >
                        <ImagePlus className="h-4 w-4" />
                        <span>Adicionar páginas</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeStageChapter(selectedStageChapter.id)}
                        disabled={isImporting}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Remover</span>
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

                  {previewStagePages.length > 0 ? (
                    <LayoutGroup id={`manga-stage-pages-${selectedStageChapter.id}`}>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {previewStagePages.map((page, index) => {
                          const isCover = page.id === selectedStageChapter.coverPageId;
                          const isDragged = draggedStagePage === page;
                          const isDropTarget =
                            stagePageDragState?.chapterId === selectedStageChapter.id &&
                            stagePageDragState.isDragging &&
                            stagePageDragState.overIndex === index;
                          const pageDisplayName = resolvePageDisplayName({
                            name: page.name,
                            relativePath: page.relativePath,
                            fallback: `Imagem ${index + 1}`,
                          });
                          return (
                            <MangaPageTile
                              key={page.id}
                              testIdPrefix="manga-stage-page"
                              src={page.previewUrl}
                              alt={`Página ${index + 1}`}
                              displayName={pageDisplayName}
                              index={index}
                              isCover={isCover}
                              isSpread={false}
                              isDragged={isDragged}
                              isPreviewTarget={isDropTarget}
                              isPressed={
                                stagePageDragState?.chapterId === selectedStageChapter.id &&
                                stagePageDragState.sourceIndex === index
                              }
                              disabled={isImporting}
                              reorderMotion={shouldReduceMotion ? "reduced" : "spring"}
                              reorderTransition={reorderTransition}
                              onPointerDown={(event) =>
                                handleStagePagePointerDown(event, selectedStageChapter.id, index)
                              }
                              onPointerMove={handleStagePagePointerMove}
                              onPointerUp={(event) =>
                                handleStagePagePointerUp(event, selectedStageChapter.id)
                              }
                              onPointerCancel={() => clearStagePageDragState()}
                              onLostPointerCapture={() => clearStagePageDragState()}
                              onKeyDown={(event) =>
                                handleStagePageKeyDown(event, selectedStageChapter.id, index)
                              }
                              onSetCover={
                                isCover
                                  ? undefined
                                  : (event) =>
                                      setStagePageAsCover(event, selectedStageChapter.id, page.id)
                              }
                              onRemove={(event) =>
                                removeStagePage(event, selectedStageChapter.id, page.id)
                              }
                            />
                          );
                        })}
                      </div>
                    </LayoutGroup>
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-border/60 bg-background/30 px-4 py-6 text-sm text-muted-foreground">
                      Nenhuma página neste capítulo. Adicione imagens para continuar.
                    </div>
                  )}
                </ProjectEditorSectionCard>
              </div>
            ) : (
              <ProjectEditorSectionCard
                title="Revisão"
                subtitle="Capítulo, volume, título e páginas do item selecionado."
                testId="manga-workflow-review-empty-card"
              >
                <div className="rounded-[18px] border border-dashed border-border/60 bg-background/30 px-4 py-6 text-sm text-muted-foreground">
                  Selecione um capítulo na sidebar ou importe novas páginas para começar.
                </div>
              </ProjectEditorSectionCard>
            )}
          </div>
        </CardContent>
      </Card>
    );
  },
);

MangaWorkflowPanel.displayName = "MangaWorkflowPanel";

export default MangaWorkflowPanel;
