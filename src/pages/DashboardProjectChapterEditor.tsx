import DashboardShell from "@/components/DashboardShell";
import type { ImageLibraryOptions } from "@/components/ImageLibraryDialog";
import { ImageLibraryDialogLoadingFallback } from "@/components/ImageLibraryDialogLoading";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import type { LexicalEditorHandle } from "@/components/lexical/LexicalEditor";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AsyncState from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import type { Project, ProjectEpisode, ProjectVolumeCover, ProjectVolumeEntry } from "@/data/projects";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { logOriginApiBaseMismatchOnce } from "@/lib/dev-diagnostics";
import { formatBuildMetadataLabel, getFrontendBuildMetadata } from "@/lib/frontend-build";
import {
  DEFAULT_PROJECT_COVER_ALT,
  getEpisodeCoverAltFallback,
  resolveAssetAltText,
} from "@/lib/image-alt";
import { filterImageLibraryFoldersByAccess } from "@/lib/image-library-scope";
import { createSlug } from "@/lib/post-content";
import {
  DEFAULT_API_CAPABILITIES,
  EPUB_CAPABILITY_UNKNOWN_MESSAGE,
  EPUB_CAPABILITY_UNAVAILABLE_MESSAGE,
  EPUB_EXPORT_GENERIC_MESSAGE,
  EPUB_EXPORT_ROUTE_MISSING_MESSAGE,
  EPUB_IMPORT_DUPLICATE_EPISODE_MESSAGE,
  EPUB_IMPORT_INVALID_SNAPSHOT_MESSAGE,
  EPUB_IMPORT_LEGACY_PROJECT_MISSING_MESSAGE,
  EPUB_IMPORT_PROCESSING_MESSAGE,
  EPUB_IMPORT_ROUTE_MISSING_MESSAGE,
  EPUB_IMPORT_SNAPSHOT_TOO_LARGE_MESSAGE,
  EPUB_NETWORK_ERROR_MESSAGE,
  type EpubRouteStatus,
  buildEpubImportProjectSnapshot,
  buildProjectSnapshotForEpubExport,
  downloadBinaryResponse,
  extractEpubTempImportIdsFromPayload,
  isEpubCssEngineFailureDetail,
  isLegacyMultipartSnapshotTooLargeError,
  mergeImportedChaptersIntoProject,
  mergeImportedVolumeCoversIntoProject,
  normalizeApiContractBuildMetadata,
  normalizeApiContractCapabilities,
  overlayDraftOnProject,
} from "@/lib/project-epub";
import {
  buildDashboardProjectChapterEditorHref,
  buildDashboardProjectChaptersEditorHref,
  buildDashboardProjectEditorHref,
  buildProjectPublicReadingHref,
} from "@/lib/project-editor-routes";
import {
  buildEpisodeKey,
  resolveEpisodeLookup,
  resolveNextMainEpisodeNumber,
} from "@/lib/project-episode-key";
import { buildChapterFolder, resolveProjectImageFolders } from "@/lib/project-image-folders";
import { isLightNovelType } from "@/lib/project-utils";
import { buildVolumeCoverKey, findDuplicateVolumeCover } from "@/lib/project-volume-cover-key";
import { normalizeProjectVolumeEntries } from "@/lib/project-volume-entries";
import type {
  ApiContractBuildMetadata,
  ApiContractCapabilities,
  ApiContractV1,
} from "@/types/api-contract";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import type { ChangeEvent, RefObject } from "react";
import {
  Suspense,
  forwardRef,
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import NotFound from "./NotFound";

const LexicalEditor = lazy(() => import("@/components/lexical/LexicalEditor"));
const ImageLibraryDialog = lazy(() => import("@/components/ImageLibraryDialog"));

const LexicalEditorFallback = () => (
  <div
    className="min-h-[380px] w-full rounded-2xl border border-border/60 bg-card/60 p-4"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="h-8 w-20 rounded-lg bg-muted/60" />
        <div className="h-8 w-24 rounded-lg bg-muted/60" />
        <div className="h-8 w-32 rounded-lg bg-muted/60" />
      </div>
      <div className="h-10 w-full rounded-xl bg-muted/60" />
      <div className="h-24 w-full rounded-xl bg-muted/60" />
      <div className="h-4 w-full rounded bg-muted/60" />
      <div className="h-4 w-10/12 rounded bg-muted/60" />
      <div className="h-40 w-full rounded-xl bg-muted/60" />
    </div>
    <span className="sr-only">Carregando editor...</span>
  </div>
);

type ChapterFilterMode = "all" | "draft" | "published" | "with-content" | "without-content";

type ChapterStructureGroup = {
  key: string;
  label: string;
  volume: number | null;
  hasMetadata: boolean;
  chapterCount: number;
  allItems: ProjectEpisode[];
  visibleItems: ProjectEpisode[];
};

type EditableVolumeOption = {
  volume: number;
  chapterCount: number;
  hasMetadata: boolean;
};

type ProjectRecord = Project & {
  revision?: string;
};

type CurrentUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  permissions?: string[];
};

type ChapterEditorPaneHandle = {
  requestLeave: () => Promise<boolean>;
};

type EpubCapabilityState = {
  message: string;
  variant: "destructive" | "warning";
} | null;

type ChapterEditorPaneProps = {
  project: ProjectRecord;
  activeChapter: ProjectEpisode | null;
  activeDraft: ProjectEpisode | null;
  onDraftChange: (nextChapter: ProjectEpisode) => void;
  volumeEntriesDraft: ProjectVolumeEntry[];
  selectedVolume: number | null;
  availableVolumes: EditableVolumeOption[];
  selectedVolumeChapterCount: number;
  onSelectedVolumeChange: (nextVolume: number) => void | Promise<void>;
  onAddVolume: () => void;
  onAddChapter: (targetVolume: number | null) => void | Promise<void>;
  onRemoveVolume: (volume: number) => void;
  onUpdateVolumeEntry: (
    volume: number,
    updater: (entry: ProjectVolumeEntry) => ProjectVolumeEntry,
  ) => void;
  activeChapterKey: string | null;
  chapterCount: number;
  chapterIndex: number;
  structureGroups: ChapterStructureGroup[];
  chapterSearchQuery: string;
  onChapterSearchQueryChange: (nextValue: string) => void;
  filterMode: ChapterFilterMode;
  onFilterModeChange: (nextValue: ChapterFilterMode) => void;
  previousChapterHref: string | null;
  nextChapterHref: string | null;
  neutralHref: string;
  onNavigateToHref: (href: string) => void;
  onChapterSaved: (project: ProjectRecord, chapter: ProjectEpisode) => void;
  isVolumeDirty: boolean;
  isSavingVolumes: boolean;
  onSaveVolumes: () => void | Promise<boolean>;
  backendSupportsEpubImport: boolean;
  backendSupportsEpubExport: boolean;
  backendBuildLabel: string | null;
  frontendBuildLabel: string | null;
  epubCapabilityState: EpubCapabilityState;
  epubImportInputRef: RefObject<HTMLInputElement | null>;
  epubImportFile: File | null;
  epubImportTargetVolume: string;
  onEpubImportTargetVolumeChange: (nextValue: string) => void;
  epubImportAsDraft: boolean;
  onEpubImportAsDraftChange: (nextValue: boolean) => void;
  isImportingEpub: boolean;
  onOpenEpubPicker: (options: { autoImportAfterSelect: boolean }) => void;
  onEpubImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onEpubImportFileCancel: () => void;
  onImportEpub: () => void | Promise<void>;
  epubExportVolume: string;
  onEpubExportVolumeChange: (nextValue: string) => void;
  epubExportIncludeDrafts: boolean;
  onEpubExportIncludeDraftsChange: (nextValue: boolean) => void;
  isExportingEpub: boolean;
  onExportEpub: () => void | Promise<void>;
};

const EMPTY_CHAPTER_DRAFT: ProjectEpisode = {
  number: 1,
  title: "",
  synopsis: "",
  releaseDate: "",
  duration: "",
  sourceType: "TV",
  sources: [],
  completedStages: [],
  content: "",
  contentFormat: "lexical",
  publicationStatus: "draft",
  coverImageUrl: "",
  coverImageAlt: "",
};

const editorSectionClassName =
  "project-editor-section rounded-2xl border border-border/60 bg-card/70 px-4";
const editorSectionHeaderClassName =
  "project-editor-section-trigger flex w-full items-center justify-between gap-4 py-2 text-left";
const editorAccordionTriggerClassName =
  "project-editor-section-trigger flex w-full items-start gap-4 py-3.5 text-left hover:no-underline md:py-4";
const editorSectionContentClassName = "project-editor-section-content px-1 pb-2.5";
const editorAccordionHeaderTextClassName = "min-w-0 flex-1 space-y-1 text-left";
const editorAccordionTitleClassName =
  "block text-[15px] font-semibold leading-tight md:text-base";
const editorAccordionSubtitleClassName = "block text-xs leading-5 text-muted-foreground";

const EditorAccordionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className={editorAccordionHeaderTextClassName}>
    <span className={editorAccordionTitleClassName}>{title}</span>
    <span className={editorAccordionSubtitleClassName}>{subtitle}</span>
  </div>
);

const chapterHasContent = (episode: ProjectEpisode | null | undefined) =>
  typeof episode?.content === "string" && episode.content.trim().length > 0;

const chapterStatusLabel = (episode: ProjectEpisode | null | undefined) =>
  episode?.publicationStatus === "draft" ? "Rascunho" : "Publicado";

const sortChapters = (episodes: ProjectEpisode[]) =>
  [...episodes].sort((left, right) => {
    const leftReadingOrder = Number(left.readingOrder);
    const rightReadingOrder = Number(right.readingOrder);
    const hasLeftReadingOrder = Number.isFinite(leftReadingOrder);
    const hasRightReadingOrder = Number.isFinite(rightReadingOrder);
    if (hasLeftReadingOrder || hasRightReadingOrder) {
      if (!hasLeftReadingOrder) {
        return 1;
      }
      if (!hasRightReadingOrder) {
        return -1;
      }
      if (leftReadingOrder !== rightReadingOrder) {
        return leftReadingOrder - rightReadingOrder;
      }
    }
    const volumeDelta = (Number(left.volume) || 0) - (Number(right.volume) || 0);
    if (volumeDelta !== 0) {
      return volumeDelta;
    }
    const numberDelta = (Number(left.number) || 0) - (Number(right.number) || 0);
    if (numberDelta !== 0) {
      return numberDelta;
    }
    return String(left.title || "").localeCompare(String(right.title || ""), "pt-BR");
  });

const buildChapterVolumeLabel = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "Sem volume";
  }
  return `Volume ${Math.floor(parsed)}`;
};

const buildChapterStructureGroupKey = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(Math.floor(parsed)) : "none";
};

const groupChaptersByStructureKey = (episodes: ProjectEpisode[]) => {
  const groups = new Map<string, ProjectEpisode[]>();
  (Array.isArray(episodes) ? episodes : []).forEach((episode) => {
    const key = buildChapterStructureGroupKey(episode.volume);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(episode);
  });
  return groups;
};

const matchesFilter = (episode: ProjectEpisode, mode: ChapterFilterMode) => {
  if (mode === "draft") {
    return episode.publicationStatus === "draft";
  }
  if (mode === "published") {
    return episode.publicationStatus !== "draft";
  }
  if (mode === "with-content") {
    return chapterHasContent(episode);
  }
  if (mode === "without-content") {
    return !chapterHasContent(episode);
  }
  return true;
};

const matchesChapterSearch = (episode: ProjectEpisode, query: string) => {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  const haystack = [
    episode.number,
    episode.volume,
    episode.title,
    episode.displayLabel,
    episode.synopsis,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return haystack.includes(normalizedQuery);
};

const normalizeChapterForSave = (chapter: ProjectEpisode): ProjectEpisode => {
  const parsedNumber = Number(chapter.number);
  const parsedVolume = Number(chapter.volume);
  const parsedReadingOrder = Number(chapter.readingOrder);
  const parsedSizeBytes = Number(chapter.sizeBytes);
  const entryKind =
    String(chapter.entryKind || "")
      .trim()
      .toLowerCase() === "extra"
      ? "extra"
      : "main";
  return {
    ...chapter,
    number: Number.isFinite(parsedNumber) ? Math.floor(parsedNumber) : 1,
    volume: Number.isFinite(parsedVolume) ? Math.floor(parsedVolume) : undefined,
    title: String(chapter.title || ""),
    entryKind,
    entrySubtype: String(chapter.entrySubtype || "").trim() || undefined,
    readingOrder: Number.isFinite(parsedReadingOrder) ? Math.floor(parsedReadingOrder) : undefined,
    displayLabel:
      entryKind === "extra" ? String(chapter.displayLabel || "").trim() || undefined : undefined,
    synopsis: String(chapter.synopsis || ""),
    releaseDate: String(chapter.releaseDate || "").trim(),
    duration: String(chapter.duration || "").trim(),
    coverImageUrl: String(chapter.coverImageUrl || "").trim(),
    coverImageAlt: String(chapter.coverImageAlt || ""),
    sourceType:
      chapter.sourceType === "Web" || chapter.sourceType === "Blu-ray" ? chapter.sourceType : "TV",
    sources: (Array.isArray(chapter.sources) ? chapter.sources : [])
      .map((source) => ({
        label: String(source.label || "").trim(),
        url: String(source.url || "").trim(),
      }))
      .filter((source) => source.label || source.url),
    hash: String(chapter.hash || "").trim() || undefined,
    sizeBytes:
      Number.isFinite(parsedSizeBytes) && parsedSizeBytes > 0
        ? Math.floor(parsedSizeBytes)
        : undefined,
    progressStage: String(chapter.progressStage || "").trim() || undefined,
    completedStages: Array.isArray(chapter.completedStages)
      ? Array.from(
          new Set(chapter.completedStages.map((item) => String(item || "").trim()).filter(Boolean)),
        )
      : [],
    content: String(chapter.content || ""),
    contentFormat: "lexical",
    publicationStatus: chapter.publicationStatus === "draft" ? "draft" : "published",
    chapterUpdatedAt: String(chapter.chapterUpdatedAt || "").trim() || undefined,
  };
};

const buildNewChapterDraft = (episodes: ProjectEpisode[], volume?: number) =>
  normalizeChapterForSave({
    ...EMPTY_CHAPTER_DRAFT,
    number: resolveNextMainEpisodeNumber(
      volume === undefined
        ? episodes.map((episode) => ({
            ...episode,
            volume: undefined,
          }))
        : episodes,
      { volume },
    ),
    volume,
    title: "",
    synopsis: "",
    entryKind: "main",
    entrySubtype: "chapter",
    releaseDate: "",
    duration: "",
    coverImageUrl: "",
    coverImageAlt: "",
    sourceType: "TV",
    sources: [],
    progressStage: "aguardando-raw",
    completedStages: [],
    content: "",
    contentFormat: "lexical",
    publicationStatus: "draft",
  });

const normalizeOriginLabel = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized || "indisponivel";
};

const buildChapterSnapshot = (chapter: ProjectEpisode | null) =>
  chapter ? JSON.stringify(normalizeChapterForSave(chapter)) : "";

const buildVolumeCoverAltFallback = (volume: number) => `Capa do volume ${volume}`;

const normalizeVolumeEntriesForSave = (entries: ProjectVolumeEntry[] | null | undefined) =>
  normalizeProjectVolumeEntries(entries).map((entry) => {
    const coverImageUrl = String(entry.coverImageUrl || "").trim();
    return {
      volume: entry.volume,
      synopsis: String(entry.synopsis || "").trim(),
      coverImageUrl,
      coverImageAlt: coverImageUrl
        ? resolveAssetAltText(entry.coverImageAlt, buildVolumeCoverAltFallback(entry.volume))
        : "",
    };
  });

const buildVolumeEntriesSnapshot = (entries: ProjectVolumeEntry[] | null | undefined) =>
  JSON.stringify(normalizeProjectVolumeEntries(entries));

const buildProjectSnapshotWithVolumeEntries = <T extends ProjectRecord>(
  project: T,
  entries: ProjectVolumeEntry[] | null | undefined,
): T => {
  const volumeEntries = normalizeVolumeEntriesForSave(entries);
  const volumeCovers = volumeEntries
    .filter((entry) => String(entry.coverImageUrl || "").trim())
    .map((entry) => ({
      volume: entry.volume,
      coverImageUrl: entry.coverImageUrl,
      coverImageAlt: entry.coverImageAlt || buildVolumeCoverAltFallback(entry.volume),
    }));
  return {
    ...project,
    volumeEntries,
    volumeCovers,
  };
};

const ChapterEditorPane = forwardRef<ChapterEditorPaneHandle, ChapterEditorPaneProps>(
  (
    {
      project,
      activeChapter,
      activeDraft,
      onDraftChange,
      volumeEntriesDraft,
      selectedVolume,
      availableVolumes,
      selectedVolumeChapterCount,
      onSelectedVolumeChange,
      onAddVolume,
      onAddChapter,
      onRemoveVolume,
      onUpdateVolumeEntry,
      activeChapterKey,
      chapterCount,
      chapterIndex,
      structureGroups,
      chapterSearchQuery,
      onChapterSearchQueryChange,
      filterMode,
      onFilterModeChange,
      previousChapterHref,
      nextChapterHref,
      neutralHref,
      onNavigateToHref,
      onChapterSaved,
      isVolumeDirty,
      isSavingVolumes,
      onSaveVolumes,
      backendSupportsEpubImport,
      backendSupportsEpubExport,
      backendBuildLabel,
      frontendBuildLabel,
      epubCapabilityState,
      epubImportInputRef,
      epubImportFile,
      epubImportTargetVolume,
      onEpubImportTargetVolumeChange,
      epubImportAsDraft,
      onEpubImportAsDraftChange,
      isImportingEpub,
      onOpenEpubPicker,
      onEpubImportFileChange,
      onEpubImportFileCancel,
      onImportEpub,
      epubExportVolume,
      onEpubExportVolumeChange,
      epubExportIncludeDrafts,
      onEpubExportIncludeDraftsChange,
      isExportingEpub,
      onExportEpub,
    },
    ref,
  ) => {
    const apiBase = getApiBase();
    const editorRef = useRef<LexicalEditorHandle | null>(null);
    const [identityError, setIdentityError] = useState<string | null>(null);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [libraryTarget, setLibraryTarget] = useState<"chapter-cover" | "volume-cover" | null>(
      null,
    );
    const [isSavingChapter, setIsSavingChapter] = useState(false);
    const hasActiveChapter = Boolean(activeChapter && activeChapterKey);
    const draft =
      activeDraft || (activeChapter ? normalizeChapterForSave(activeChapter) : EMPTY_CHAPTER_DRAFT);
    const activeChapterSnapshot = useMemo(() => buildChapterSnapshot(activeChapter), [activeChapter]);
    const draftSnapshot = useMemo(
      () => (hasActiveChapter ? buildChapterSnapshot(draft) : ""),
      [draft, hasActiveChapter],
    );
    const isDirty = hasActiveChapter && draftSnapshot !== activeChapterSnapshot;

    const scopedProjectImageIds = useMemo(() => {
      const normalizedProjectId = String(project.id || "").trim();
      return normalizedProjectId ? [normalizedProjectId] : [];
    }, [project.id]);
    const { projectRootFolder, projectEpisodesFolder, projectVolumeCoversFolder, projectChaptersFolder } =
      useMemo(
      () => resolveProjectImageFolders(project.id, project.title),
      [project.id, project.title],
    );
    const filterProjectLibraryFolders = useCallback(
      (folders: string[]) =>
        filterImageLibraryFoldersByAccess(folders, {
          grants: { projetos: true },
        }),
      [],
    );
    const chapterFolder = useMemo(
      () =>
        buildChapterFolder({
          projectChaptersFolder,
          episode: draft,
          index: Math.max(chapterIndex, 0),
        }),
      [chapterIndex, draft, projectChaptersFolder],
    );
    const chapterImageLibraryOptions = useMemo(
      (): ImageLibraryOptions => ({
        uploadFolder: chapterFolder,
        listFolders: filterProjectLibraryFolders([
          chapterFolder,
          projectChaptersFolder,
          projectEpisodesFolder,
          projectRootFolder,
        ]),
        listAll: false,
        includeProjectImages: true,
        projectImageProjectIds: scopedProjectImageIds,
        projectImagesView: "by-project",
      }),
      [
        chapterFolder,
        filterProjectLibraryFolders,
        projectChaptersFolder,
        projectEpisodesFolder,
        projectRootFolder,
        scopedProjectImageIds,
      ],
    );
    const volumeImageLibraryOptions = useMemo(
      (): ImageLibraryOptions => ({
        uploadFolder: projectVolumeCoversFolder,
        listFolders: filterProjectLibraryFolders([
          projectVolumeCoversFolder,
          projectRootFolder,
          projectEpisodesFolder,
        ]),
        listAll: false,
        includeProjectImages: true,
        projectImageProjectIds: scopedProjectImageIds,
        projectImagesView: "by-project",
      }),
      [
        filterProjectLibraryFolders,
        projectEpisodesFolder,
        projectRootFolder,
        projectVolumeCoversFolder,
        scopedProjectImageIds,
      ],
    );
    const selectedVolumeEntry = useMemo(() => {
      if (selectedVolume === null || !Number.isFinite(Number(selectedVolume))) {
        return null;
      }
      const normalizedVolume = Number(selectedVolume);
      return (
        normalizeProjectVolumeEntries(volumeEntriesDraft).find(
          (entry) => buildVolumeCoverKey(entry.volume) === buildVolumeCoverKey(normalizedVolume),
        ) || null
      );
    }, [selectedVolume, volumeEntriesDraft]);
    const selectedVolumeNumber =
      selectedVolume !== null && Number.isFinite(Number(selectedVolume))
        ? Number(selectedVolume)
        : null;
    const selectedVolumeLabel =
      selectedVolumeNumber !== null ? buildChapterVolumeLabel(selectedVolumeNumber) : "Volumes";
    const showVolumeSaveControls = isVolumeDirty || isSavingVolumes;
    const openChapterCoverLibrary = useCallback(() => {
      setLibraryTarget("chapter-cover");
      setIsLibraryOpen(true);
    }, []);
    const openVolumeCoverLibrary = useCallback(() => {
      if (selectedVolumeNumber === null) {
        return;
      }
      setLibraryTarget("volume-cover");
      setIsLibraryOpen(true);
    }, [selectedVolumeNumber]);

    const saveChapter = useCallback(
      async (snapshot: ProjectEpisode) => {
        if (!activeChapter) {
          return snapshot;
        }
        setIdentityError(null);
        const response = await apiFetch(
          apiBase,
          `/api/projects/${project.id}/chapters/${activeChapter.number}${
            Number.isFinite(Number(activeChapter.volume))
              ? `?volume=${Number(activeChapter.volume)}`
              : ""
          }`,
          {
            method: "PUT",
            auth: true,
            json: {
              ifRevision: project.revision || "",
              chapter: {
                ...normalizeChapterForSave(snapshot),
                coverImageAlt: snapshot.coverImageUrl
                  ? resolveAssetAltText(snapshot.coverImageAlt, getEpisodeCoverAltFallback(true))
                  : "",
              },
            },
          },
        );

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const errorCode = String(data?.error || "").trim();
          if (errorCode === "duplicate_episode_key") {
            setIdentityError("Já existe um capítulo com essa combinação de número e volume.");
          } else if (errorCode === "volume_required") {
            setIdentityError("Informe o volume para salvar um capítulo com número ambíguo.");
          } else if (errorCode === "not_found") {
            toast({
              title: "Capítulo não encontrado",
              description: "Recarregue o projeto antes de continuar editando.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Não foi possível salvar o capítulo",
              description: "Tente novamente em alguns instantes.",
              variant: "destructive",
            });
          }
          throw new Error(errorCode || "chapter_save_failed");
        }

        const data = (await response.json()) as {
          project?: ProjectRecord;
          chapter?: ProjectEpisode;
        };
        if (!data?.project || !data?.chapter) {
          throw new Error("chapter_save_missing_payload");
        }

        const normalizedSavedChapter = normalizeChapterForSave(data.chapter);
        onChapterSaved(data.project, normalizedSavedChapter);
        return normalizedSavedChapter;
      },
      [activeChapter, apiBase, onChapterSaved, project.id, project.revision],
    );

    const handleManualSave = useCallback(async () => {
      if (!hasActiveChapter || !isDirty || isSavingChapter) {
        return true;
      }
      setIsSavingChapter(true);
      try {
        await saveChapter(draft);
        return true;
      } catch {
        return false;
      } finally {
        setIsSavingChapter(false);
      }
    }, [draft, hasActiveChapter, isDirty, isSavingChapter, saveChapter]);

    const requestLeave = useCallback(async () => {
      if (!isVolumeDirty && (!hasActiveChapter || !isDirty)) {
        return true;
      }
      return window.confirm(
        "Você tem alterações não salvas neste editor. Deseja sair mesmo assim?",
      );
    }, [hasActiveChapter, isDirty, isVolumeDirty]);

    useImperativeHandle(
      ref,
      () => ({
        requestLeave,
      }),
      [requestLeave],
    );

    useEffect(() => {
      if ((!hasActiveChapter || !isDirty) && !isVolumeDirty) {
        return;
      }
      const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = "";
      };
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasActiveChapter, isDirty, isVolumeDirty]);

    useEffect(() => {
      if (!hasActiveChapter && !isVolumeDirty) {
        return;
      }
      const handleHotkeys = (event: KeyboardEvent) => {
        const isSaveShortcut =
          (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "s";
        if (isSaveShortcut) {
          if (!hasActiveChapter && !isVolumeDirty) {
            return;
          }
          event.preventDefault();
          if (hasActiveChapter && isDirty) {
            void handleManualSave();
            return;
          }
          if (isVolumeDirty) {
            void onSaveVolumes();
          }
          return;
        }
        if (!hasActiveChapter) {
          return;
        }
        if (event.altKey && !event.metaKey && !event.ctrlKey && event.key === "ArrowUp") {
          if (previousChapterHref) {
            event.preventDefault();
            onNavigateToHref(previousChapterHref);
          }
          return;
        }
        if (event.altKey && !event.metaKey && !event.ctrlKey && event.key === "ArrowDown") {
          if (nextChapterHref) {
            event.preventDefault();
            onNavigateToHref(nextChapterHref);
          }
        }
      };
      window.addEventListener("keydown", handleHotkeys);
      return () => window.removeEventListener("keydown", handleHotkeys);
    }, [
      handleManualSave,
      hasActiveChapter,
      isDirty,
      isVolumeDirty,
      nextChapterHref,
      onNavigateToHref,
      onSaveVolumes,
      previousChapterHref,
    ]);

    const publicReadingHref = useMemo(
      () =>
        hasActiveChapter ? buildProjectPublicReadingHref(project.id, draft.number, draft.volume) : "",
      [draft.number, draft.volume, hasActiveChapter, project.id],
    );
    const chapterTitle = hasActiveChapter
      ? String(draft.title || "").trim() || `Capítulo ${draft.number}`
      : "Nenhum capítulo aberto";
    const chapterSummaryLabel =
      hasActiveChapter && draft.entryKind === "extra" ? "Extra em edição" : "Capítulo em edição";
    const chapterPositionLabel = `${Math.max(chapterIndex + 1, 1)} de ${Math.max(chapterCount, 1)}`;
    const activeStructureGroupKey = useMemo(() => {
      const activeGroup = activeChapterKey
        ? structureGroups.find((group) =>
            group.allItems.some(
              (episode) => buildEpisodeKey(episode.number, episode.volume) === activeChapterKey,
            ),
          )
        : null;
      if (activeGroup?.key) {
        return activeGroup.key;
      }
      if (selectedVolumeNumber !== null) {
        return (
          structureGroups.find((group) => group.volume === selectedVolumeNumber)?.key ||
          structureGroups[0]?.key ||
          ""
        );
      }
      return structureGroups[0]?.key || "";
    }, [activeChapterKey, selectedVolumeNumber, structureGroups]);
    const [openStructureGroupKey, setOpenStructureGroupKey] = useState(activeStructureGroupKey);

    useEffect(() => {
      setOpenStructureGroupKey((currentValue) => {
        if (activeStructureGroupKey && currentValue !== activeStructureGroupKey) {
          return activeStructureGroupKey;
        }
        if (currentValue && structureGroups.some((group) => group.key === currentValue)) {
          return currentValue;
        }
        return structureGroups[0]?.key || "";
      });
    }, [activeStructureGroupKey, structureGroups]);

    const firstChapterHref = useMemo(() => {
      const firstEpisode = structureGroups.flatMap((group) => group.visibleItems)[0];
      if (!firstEpisode) {
        return null;
      }
      return buildDashboardProjectChapterEditorHref(project.id, firstEpisode.number, firstEpisode.volume);
    }, [project.id, structureGroups]);

    const updateDraft = useCallback(
      (recipe: (current: ProjectEpisode) => ProjectEpisode) => {
        if (!hasActiveChapter) {
          return;
        }
        onDraftChange(normalizeChapterForSave(recipe(draft)));
      },
      [draft, hasActiveChapter, onDraftChange],
    );
    const updateSelectedVolumeEntry = useCallback(
      (updater: (entry: ProjectVolumeEntry) => ProjectVolumeEntry) => {
        if (selectedVolumeNumber === null) {
          return;
        }
        onUpdateVolumeEntry(selectedVolumeNumber, updater);
      },
      [onUpdateVolumeEntry, selectedVolumeNumber],
    );

    const epubToolsAccordion = (
      <Accordion
        type="single"
        collapsible
        defaultValue="epub-tools"
        className="project-editor-accordion space-y-2.5"
        data-testid="chapter-epub-tools"
      >
        <AccordionItem value="epub-tools" className={editorSectionClassName}>
          <AccordionTrigger className={editorAccordionTriggerClassName}>
            <EditorAccordionHeader
              title="Ferramentas EPUB"
              subtitle="Importação e exportação por volume"
            />
          </AccordionTrigger>
          <AccordionContent className={editorSectionContentClassName}>
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Importe capítulos para o editor Lexical e exporte o snapshot atual da página.
                </p>
                {epubCapabilityState ? (
                  <p
                    className={
                      epubCapabilityState.variant === "destructive"
                        ? "text-xs text-destructive"
                        : "text-xs text-amber-700"
                    }
                  >
                    {epubCapabilityState.message}
                  </p>
                ) : null}
                {backendBuildLabel ? (
                  <p className="text-[11px] text-muted-foreground">
                    Contrato da API: {backendBuildLabel}
                  </p>
                ) : null}
                {frontendBuildLabel ? (
                  <p className="text-[11px] text-muted-foreground">Frontend: {frontendBuildLabel}</p>
                ) : null}
              </div>

              <div className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-foreground">Importar EPUB</h4>
                  <p className="text-xs text-muted-foreground">
                    O arquivo é convertido para Lexical, mergeado no projeto e salvo imediatamente.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chapter-editor-epub-import-file">Arquivo .epub</Label>
                  <Input
                    ref={epubImportInputRef}
                    id="chapter-editor-epub-import-file"
                    type="file"
                    accept=".epub,application/epub+zip"
                    className="sr-only"
                    onChange={onEpubImportFileChange}
                    onCancel={onEpubImportFileCancel}
                  />
                  {epubImportFile ? (
                    <button
                      type="button"
                      onClick={() => onOpenEpubPicker({ autoImportAfterSelect: false })}
                      disabled={isImportingEpub || !backendSupportsEpubImport}
                      className="w-full rounded-xl border border-border/60 bg-background/50 px-3 py-3 text-left transition hover:bg-background/70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="block truncate text-sm font-medium text-foreground">
                        {epubImportFile.name}
                      </span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenEpubPicker({ autoImportAfterSelect: false })}
                        disabled={isImportingEpub || !backendSupportsEpubImport}
                      >
                        Escolher arquivo
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Nenhum arquivo selecionado
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chapter-editor-epub-import-volume">Volume de destino</Label>
                  <Input
                    id="chapter-editor-epub-import-volume"
                    type="number"
                    value={epubImportTargetVolume}
                    onChange={(event) => onEpubImportTargetVolumeChange(event.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm">
                  <Checkbox
                    checked={epubImportAsDraft}
                    onCheckedChange={(checked) => onEpubImportAsDraftChange(checked === true)}
                  />
                  <span className="space-y-1">
                    <span className="block font-medium text-foreground">Importar como rascunho</span>
                    <span className="block text-xs text-muted-foreground">
                      Capítulos importados ficam ocultos ao público até a publicação.
                    </span>
                  </span>
                </label>
                <Button
                  type="button"
                  onClick={onImportEpub}
                  disabled={isImportingEpub || !backendSupportsEpubImport}
                  className="gap-2"
                >
                  {isImportingEpub ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Importar EPUB
                </Button>
              </div>

              <div className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-foreground">Exportar EPUB</h4>
                  <p className="text-xs text-muted-foreground">
                    Usa o estado atual da página, inclusive alterações ainda não salvas no capítulo
                    aberto.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chapter-editor-epub-export-volume">Volume para exportação</Label>
                  <Input
                    id="chapter-editor-epub-export-volume"
                    type="number"
                    value={epubExportVolume}
                    onChange={(event) => onEpubExportVolumeChange(event.target.value)}
                    placeholder="Deixe vazio para Sem volume"
                  />
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm">
                  <Checkbox
                    checked={epubExportIncludeDrafts}
                    onCheckedChange={(checked) =>
                      onEpubExportIncludeDraftsChange(checked === true)
                    }
                  />
                  <span className="space-y-1">
                    <span className="block font-medium text-foreground">Incluir rascunhos</span>
                    <span className="block text-xs text-muted-foreground">
                      Exporta também capítulos em draft que tenham conteúdo.
                    </span>
                  </span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onExportEpub}
                  disabled={isExportingEpub || !backendSupportsEpubExport}
                  className="gap-2"
                >
                  {isExportingEpub ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Exportar volume em EPUB
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const structureAccordion = (
      <Accordion
        type="single"
        collapsible
        defaultValue="structure"
        className="project-editor-accordion space-y-2.5"
      >
        <AccordionItem
          value="structure"
          className={editorSectionClassName}
          data-testid="chapter-structure-section"
        >
          <AccordionTrigger className={editorAccordionTriggerClassName}>
            <EditorAccordionHeader
              title="Estrutura"
              subtitle="Volumes, filtros, navegação e criação de capítulos"
            />
          </AccordionTrigger>
          <AccordionContent className={editorSectionContentClassName}>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] 2xl:grid-cols-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={chapterSearchQuery}
                    onChange={(event) => onChapterSearchQueryChange(event.target.value)}
                    placeholder="Buscar capítulo..."
                    className="pl-9"
                  />
                </div>
                <Select
                  value={filterMode}
                  onValueChange={(value) => onFilterModeChange(value as ChapterFilterMode)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="draft">Rascunhos</SelectItem>
                    <SelectItem value="published">Publicados</SelectItem>
                    <SelectItem value="with-content">Com conteúdo</SelectItem>
                    <SelectItem value="without-content">Sem conteúdo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button type="button" size="sm" variant="outline" onClick={onAddVolume}>
                  <Plus className="h-4 w-4" />
                  <span>Adicionar volume</span>
                </Button>
              </div>

              <div className="space-y-2.5">
                {structureGroups.map((group) => {
                  const isSelected =
                    group.volume !== null && selectedVolumeNumber === Number(group.volume);
                  const isOpen = openStructureGroupKey === group.key;
                  const emptyMessage =
                    group.chapterCount > 0
                      ? "Nenhum capítulo corresponde ao filtro atual neste grupo."
                      : group.volume !== null
                        ? "Nenhum capítulo vinculado a este volume ainda."
                        : "Nenhum capítulo sem volume ainda.";
                  return (
                    <section
                      key={group.key}
                      className={`overflow-hidden rounded-2xl border bg-background/45 ${
                        isSelected ? "border-primary/40" : "border-border/60"
                      }`}
                      data-testid={`chapter-structure-group-${group.key}`}
                    >
                      <div
                        className={`space-y-2.5 border-b border-border/50 px-3 py-3 ${
                          isSelected ? "bg-primary/5" : ""
                        }`}
                        data-testid={`chapter-structure-group-header-${group.key}`}
                      >
                        <div className="flex items-start gap-3">
                        {group.volume !== null ? (
                          <button
                            type="button"
                            data-testid={`chapter-structure-select-${group.key}`}
                            onClick={() => {
                              void onSelectedVolumeChange(group.volume as number);
                              setOpenStructureGroupKey(group.key);
                            }}
                            className="min-w-0 flex-1 self-stretch text-left"
                          >
                            <div
                              className="min-w-0 space-y-2"
                              data-testid={`chapter-structure-group-main-${group.key}`}
                            >
                              <div className="min-w-0 space-y-1">
                                <p className="text-sm font-semibold text-foreground">
                                  {group.label}
                                </p>
                                <p className="text-xs leading-5 text-muted-foreground">
                                  {group.chapterCount > 0
                                    ? `${group.chapterCount} capítulo(s) vinculado(s)`
                                    : "Nenhum capítulo vinculado"}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={group.hasMetadata ? "secondary" : "outline"}>
                                  {group.hasMetadata ? "Metadados" : "Sem metadados"}
                                </Badge>
                              </div>
                            </div>
                          </button>
                        ) : (
                          <div
                            className="min-w-0 flex-1 self-stretch text-left"
                            data-testid={`chapter-structure-group-main-${group.key}`}
                          >
                            <p className="text-sm font-semibold text-foreground">{group.label}</p>
                            <p className="text-xs leading-5 text-muted-foreground">
                              {group.chapterCount > 0
                                ? `${group.chapterCount} capítulo(s) sem volume`
                                : "Agrupe aqui capítulos fora de volume"}
                            </p>
                          </div>
                        )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            data-testid={`chapter-structure-group-toggle-${group.key}`}
                            aria-label={`Alternar ${group.label}`}
                            aria-expanded={isOpen}
                            onClick={() =>
                              setOpenStructureGroupKey((currentValue) =>
                                currentValue === group.key ? "" : group.key,
                              )
                            }
                            className="mt-0.5 shrink-0 self-start"
                          >
                            <ChevronRight
                              className={`h-4 w-4 transition-transform ${
                                isOpen ? "rotate-90" : ""
                              }`}
                            />
                          </Button>
                        </div>
                        <div
                          className="flex"
                          data-testid={`chapter-structure-group-actions-${group.key}`}
                        >
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            data-testid={`chapter-structure-add-chapter-${group.key}`}
                            onClick={() => {
                              void onAddChapter(group.volume);
                            }}
                            className="w-full justify-center"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Adicionar capítulo</span>
                          </Button>
                        </div>
                      </div>
                      {isOpen ? (
                        <div className="space-y-2 p-3">
                          {group.visibleItems.length > 0 ? (
                            group.visibleItems.map((episode) => {
                              const episodeKey = buildEpisodeKey(episode.number, episode.volume);
                              const href = buildDashboardProjectChapterEditorHref(
                                project.id,
                                episode.number,
                                episode.volume,
                              );
                              const isActive = episodeKey === activeChapterKey;
                              return (
                                <button
                                  key={episodeKey}
                                  type="button"
                                  onClick={() => void onNavigateToHref(href)}
                                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                                    isActive
                                      ? "border-primary/50 bg-primary/5 shadow-sm"
                                      : "border-border/60 bg-background/50 hover:bg-background/80"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                        Capítulo {episode.number}
                                      </p>
                                      <p className="line-clamp-2 text-sm font-semibold text-foreground">
                                        {String(episode.title || "").trim() ||
                                          `Capítulo ${episode.number}`}
                                      </p>
                                    </div>
                                    <Badge
                                      variant={
                                        episode.publicationStatus === "draft"
                                          ? "outline"
                                          : "secondary"
                                      }
                                    >
                                      {chapterStatusLabel(episode)}
                                    </Badge>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span>
                                      {chapterHasContent(episode) ? "Com leitura" : "Sem leitura"}
                                    </span>
                                    {episode.sources?.length ? (
                                      <span>- {episode.sources.length} fonte(s)</span>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="rounded-2xl border border-dashed border-border/60 bg-background/30 px-4 py-4 text-sm text-muted-foreground">
                              {emptyMessage}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const volumeEditorSection = (
      <section className={`${editorSectionClassName} min-w-0`} data-testid="chapter-volume-editor">
        <div className={editorSectionHeaderClassName}>
          <div className="flex w-full items-start justify-between gap-4 text-left">
            <div className="min-w-0 space-y-1">
              <span className="text-sm font-semibold">
                {selectedVolumeNumber !== null ? selectedVolumeLabel : "Editor de volume"}
              </span>
              <span className="block text-xs text-muted-foreground">
                {selectedVolumeNumber !== null
                  ? "Capa, texto alternativo e sinopse do volume selecionado"
                  : "Selecione um volume na sidebar ou crie um novo para editar seus metadados"}
              </span>
            </div>
            {selectedVolumeNumber !== null ? (
              <Badge variant="outline" className="shrink-0">
                {selectedVolumeChapterCount} capítulo(s)
              </Badge>
            ) : null}
          </div>
        </div>
        <div className={editorSectionContentClassName}>
          {selectedVolumeNumber !== null ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 p-4">
                <div>
                  <Label className="text-sm">Imagem do volume</Label>
                  <p className="text-xs text-muted-foreground">
                    Usa a pasta dedicada de volumes deste projeto na biblioteca.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedVolumeEntry ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemoveVolume(selectedVolumeNumber)}
                    >
                      Remover volume
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openVolumeCoverLibrary}
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span>Biblioteca</span>
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)]">
                {selectedVolumeEntry?.coverImageUrl ? (
                  <img
                    src={selectedVolumeEntry.coverImageUrl}
                    alt={
                      selectedVolumeEntry.coverImageAlt ||
                      buildVolumeCoverAltFallback(selectedVolumeNumber)
                    }
                    className="h-40 w-28 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-28 items-center justify-center rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                    Sem capa
                  </div>
                )}
                <div className="space-y-3">
                  <Input
                    value={selectedVolumeEntry?.coverImageUrl || ""}
                    onChange={(event) =>
                      updateSelectedVolumeEntry((entry) => ({
                        ...entry,
                        coverImageUrl: event.target.value,
                      }))
                    }
                    placeholder="URL da capa do volume"
                  />
                  <div className="space-y-2">
                    <Label htmlFor="chapter-volume-cover-alt">Texto alternativo</Label>
                    <Input
                      id="chapter-volume-cover-alt"
                      value={selectedVolumeEntry?.coverImageAlt || ""}
                      onChange={(event) =>
                        updateSelectedVolumeEntry((entry) => ({
                          ...entry,
                          coverImageAlt: event.target.value,
                        }))
                      }
                      placeholder={buildVolumeCoverAltFallback(selectedVolumeNumber)}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="chapter-volume-synopsis">Sinopse do volume</Label>
                <Textarea
                  id="chapter-volume-synopsis"
                  value={selectedVolumeEntry?.synopsis || ""}
                  onChange={(event) =>
                    updateSelectedVolumeEntry((entry) => ({
                      ...entry,
                      synopsis: event.target.value,
                    }))
                  }
                  rows={5}
                  placeholder="Resumo exibido nas páginas públicas para este volume"
                />
              </div>
              {selectedVolumeChapterCount === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                  Nenhum capítulo vinculado a este volume.
                </div>
              ) : null}
            </div>
          ) : (
            <div
              className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-4 py-8"
              data-testid="chapter-volume-empty-state"
            >
              <AsyncState
                kind="empty"
                title="Nenhum volume selecionado"
                description="Crie um volume na sidebar para configurar capa e sinopse deste projeto."
                action={
                  <Button type="button" onClick={onAddVolume}>
                    Adicionar volume
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </section>
    );

    return (
      <>
        <div
          className="sticky top-3 z-20 overflow-hidden rounded-[28px] border border-border/60 bg-background/90 shadow-[0_28px_90px_-60px_rgba(0,0,0,0.82)] backdrop-blur supports-backdrop-filter:bg-background/75"
          data-testid="chapter-editor-header-shell"
        >
          <div
            className="project-editor-top border-b border-border/60 bg-transparent shadow-none [clip-path:none]"
            data-testid="chapter-editor-sticky-top"
          >
            <div className="space-y-0 px-4 pb-2.5 pt-3.5 text-left md:px-6 lg:px-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {hasActiveChapter ? (
                      <>
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                          {chapterSummaryLabel}
                        </Badge>
                        <Badge
                          variant={draft.publicationStatus === "draft" ? "outline" : "default"}
                          className="text-[10px] uppercase tracking-[0.12em]"
                        >
                          {chapterStatusLabel(draft)}
                        </Badge>
                        {Number.isFinite(Number(draft.volume)) ? (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                            {buildChapterVolumeLabel(draft.volume)}
                          </Badge>
                        ) : null}
                      </>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                        Seleção de capítulo
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-xl font-semibold md:text-2xl">
                      Gerenciamento de Conteúdo
                    </h1>
                    <p className="max-w-3xl text-xs text-muted-foreground md:text-sm">
                      Edição de capítulos e volumes para light novels.
                    </p>
                  </div>
                </div>

                <div className="flex w-full max-w-full flex-col gap-3 lg:w-auto lg:min-w-[320px] lg:max-w-[440px]">
                  <div className="rounded-xl border border-border/60 bg-card/65 px-3 py-2 text-left lg:text-right">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      Projeto
                    </p>
                    <p className="truncate text-sm font-medium text-foreground">{project.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {hasActiveChapter
                        ? `${chapterTitle} - ${chapterPositionLabel}`
                        : `${chapterCount} capítulo(s) disponível(is)`}
                    </p>
                  </div>
                  {hasActiveChapter ? (
                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-end">
                      <Badge
                        variant={isDirty ? "outline" : "secondary"}
                        className="text-[10px] uppercase tracking-[0.12em]"
                      >
                        {isSavingChapter
                          ? "Salvando..."
                          : isDirty
                            ? "Alterações pendentes"
                            : "Sem alterações pendentes"}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          void handleManualSave();
                        }}
                        disabled={isSavingChapter || !isDirty}
                        className="gap-2"
                      >
                        {isSavingChapter ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Salvar capítulo
                      </Button>
                      {showVolumeSaveControls ? (
                        <>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                            {isSavingVolumes ? "Salvando volumes..." : "Volumes pendentes"}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void onSaveVolumes();
                            }}
                            disabled={isSavingVolumes || !isVolumeDirty}
                            className="gap-2"
                          >
                            {isSavingVolumes ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Salvar volumes
                          </Button>
                        </>
                      ) : null}
                    </div>
                  ) : showVolumeSaveControls ? (
                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-end">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                        {isSavingVolumes ? "Salvando volumes..." : "Volumes pendentes"}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void onSaveVolumes();
                        }}
                        disabled={isSavingVolumes || !isVolumeDirty}
                        className="gap-2"
                      >
                        {isSavingVolumes ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Salvar volumes
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div
            className="project-editor-status-bar flex flex-wrap items-center gap-2 px-4 py-1.5 md:px-6 lg:px-8"
            data-testid="chapter-editor-status-bar"
          >
            {hasActiveChapter ? (
              <>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                  {chapterPositionLabel}
                </Badge>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                  Capítulo {draft.number}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {chapterHasContent(draft) ? "Com leitura" : "Sem leitura"}
                </span>
                {draft.sources?.length ? (
                  <span className="text-[11px] text-muted-foreground">
                    {draft.sources.length} fonte(s)
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                  Nenhum capítulo aberto
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  Escolha um capítulo na sidebar, edite um volume na coluna principal ou use as
                  ferramentas EPUB logo abaixo.
                </span>
              </>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={buildDashboardProjectEditorHref(project.id)}>
                  <ArrowLeft className="h-4 w-4" />
                  <span>Voltar ao projeto</span>
                </Link>
              </Button>
              {hasActiveChapter ? (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={publicReadingHref} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      <span>Abrir leitura</span>
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onNavigateToHref(neutralHref)}>
                    <span>Fechar capítulo</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (previousChapterHref) {
                        onNavigateToHref(previousChapterHref);
                      }
                    }}
                    disabled={!previousChapterHref}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Anterior</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (nextChapterHref) {
                        onNavigateToHref(nextChapterHref);
                      }
                    }}
                    disabled={!nextChapterHref}
                  >
                    <span>Próximo</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="project-editor-layout mx-auto grid w-full gap-5 pb-8 pt-4 md:pb-10 2xl:grid-cols-[minmax(0,1fr)_340px] 2xl:items-start"
          data-testid="chapter-editor-upper-layout"
        >
          <div
            className="order-1 min-w-0 w-full space-y-4 2xl:col-start-1 2xl:row-start-1"
            data-testid="chapter-editor-main-column"
          >
            {hasActiveChapter ? (
              <Accordion
                type="multiple"
                defaultValue={["identity"]}
                className="project-editor-accordion space-y-2.5"
              >
                <AccordionItem value="identity" className={editorSectionClassName}>
                  <AccordionTrigger className={editorAccordionTriggerClassName}>
                    <EditorAccordionHeader
                      title="Identidade do capítulo"
                      subtitle="Título, numeração, tipo e resumo"
                    />
                  </AccordionTrigger>
                  <AccordionContent className={editorSectionContentClassName}>
                    <div className="space-y-5">
                      {identityError ? (
                        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          {identityError}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <Label htmlFor="chapter-title">Título</Label>
                        <Input
                          id="chapter-title"
                          value={draft.title || ""}
                          onChange={(event) =>
                            updateDraft((current) => ({ ...current, title: event.target.value }))
                          }
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2">
                          <Label htmlFor="chapter-number">Número</Label>
                          <Input
                            id="chapter-number"
                            type="number"
                            value={draft.number}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                number: Number(event.target.value || current.number),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chapter-volume">Volume</Label>
                          <Input
                            id="chapter-volume"
                            type="number"
                            value={draft.volume ?? ""}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                volume:
                                  event.target.value.trim() === ""
                                    ? undefined
                                    : Number(event.target.value),
                              }))
                            }
                            placeholder="Sem volume"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo de entrada</Label>
                          <Select
                            value={draft.entryKind === "extra" ? "extra" : "main"}
                            onValueChange={(value) =>
                              updateDraft((current) => ({
                                ...current,
                                entryKind: value === "extra" ? "extra" : "main",
                                displayLabel:
                                  value === "extra" ? current.displayLabel || "Extra" : undefined,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="main">Capítulo</SelectItem>
                              <SelectItem value="extra">Extra</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chapter-reading-order">Ordem de leitura</Label>
                          <Input
                            id="chapter-reading-order"
                            type="number"
                            value={draft.readingOrder ?? ""}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                readingOrder:
                                  event.target.value.trim() === ""
                                    ? undefined
                                    : Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {draft.entryKind === "extra" ? (
                          <div className="space-y-2">
                            <Label htmlFor="chapter-display-label">Rótulo do extra</Label>
                            <Input
                              id="chapter-display-label"
                              value={draft.displayLabel || ""}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  displayLabel: event.target.value,
                                }))
                              }
                              placeholder="Ex.: Side Story"
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor="chapter-entry-subtype">Subtipo</Label>
                            <Input
                              id="chapter-entry-subtype"
                              value={draft.entrySubtype || ""}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  entrySubtype: event.target.value,
                                }))
                              }
                              placeholder="Ex.: capítulo, prólogo, epílogo"
                            />
                          </div>
                        )}

                        {draft.entryKind === "extra" ? (
                          <div className="space-y-2">
                            <Label htmlFor="chapter-entry-subtype-extra">Subtipo</Label>
                            <Input
                              id="chapter-entry-subtype-extra"
                              value={draft.entrySubtype || ""}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  entrySubtype: event.target.value,
                                }))
                              }
                              placeholder="Ex.: capítulo, prólogo, epílogo"
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="chapter-synopsis">Sinopse</Label>
                        <Textarea
                          id="chapter-synopsis"
                          value={draft.synopsis || ""}
                          onChange={(event) =>
                            updateDraft((current) => ({ ...current, synopsis: event.target.value }))
                          }
                          rows={5}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : null}
            {volumeEditorSection}
            {!hasActiveChapter ? (
              <>
                <section className={`${editorSectionClassName} min-w-0`} data-testid="chapter-neutral-state">
                  <div className={editorSectionHeaderClassName}>
                    <div className="flex w-full items-center justify-between gap-4 text-left">
                      <span className="text-sm font-semibold">Conteúdo</span>
                      <span className="text-xs text-muted-foreground">
                        Selecione um capítulo para começar a editar
                      </span>
                    </div>
                  </div>
                  <div className={editorSectionContentClassName}>
                    <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-4 py-8">
                      <AsyncState
                        kind="empty"
                        title="Nenhum capítulo aberto"
                        description="Escolha um capítulo na sidebar para editar o conteúdo. Você também pode configurar volumes nesta coluna e usar as ferramentas EPUB logo abaixo."
                        action={
                          <Button
                            type="button"
                            onClick={() => {
                              if (firstChapterHref) {
                                onNavigateToHref(firstChapterHref);
                              }
                            }}
                            disabled={!firstChapterHref}
                          >
                            Abrir primeiro capítulo
                          </Button>
                        }
                      />
                    </div>
                  </div>
                </section>
                {epubToolsAccordion}
              </>
            ) : null}
          </div>

          <aside
            className="order-2 min-w-0 space-y-4 2xl:col-start-2 2xl:row-span-2 2xl:w-[340px] 2xl:shrink-0"
            data-testid="chapter-editor-sidebar"
          >
            {hasActiveChapter ? (
              <Accordion
                type="multiple"
                defaultValue={["publication", "cover", "sources"]}
                className="project-editor-accordion space-y-2.5"
                data-testid="chapter-metadata-accordion"
              >
                <AccordionItem value="publication" className={editorSectionClassName}>
                  <AccordionTrigger className={editorAccordionTriggerClassName}>
                    <EditorAccordionHeader
                      title="Publicação"
                      subtitle="Release e visibilidade do capítulo"
                    />
                  </AccordionTrigger>
                  <AccordionContent className={editorSectionContentClassName}>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="chapter-release-date">Data de release</Label>
                        <Input
                          id="chapter-release-date"
                          type="date"
                          value={draft.releaseDate || ""}
                          onChange={(event) =>
                            updateDraft((current) => ({ ...current, releaseDate: event.target.value }))
                          }
                        />
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <Label className="text-sm">Publicado</Label>
                            <p className="text-xs text-muted-foreground">
                              Controle se o capítulo fica visível ao público.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Publicado</span>
                            <Switch
                              checked={draft.publicationStatus !== "draft"}
                              onCheckedChange={(checked) =>
                                updateDraft((current) => ({
                                  ...current,
                                  publicationStatus: checked ? "published" : "draft",
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="cover" className={editorSectionClassName}>
                  <AccordionTrigger className={editorAccordionTriggerClassName}>
                    <EditorAccordionHeader
                      title="Capa do capítulo"
                      subtitle="Biblioteca dedicada e texto alternativo"
                    />
                  </AccordionTrigger>
                  <AccordionContent className={editorSectionContentClassName}>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 p-4">
                        <div>
                          <Label className="text-sm">Imagem de capa</Label>
                          <p className="text-xs text-muted-foreground">
                            Usa a pasta dedicada do capítulo na biblioteca.
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={openChapterCoverLibrary}>
                          <ImagePlus className="h-4 w-4" />
                          <span>Biblioteca</span>
                        </Button>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)] 2xl:grid-cols-1">
                        {draft.coverImageUrl ? (
                          <img
                            src={draft.coverImageUrl}
                            alt={draft.coverImageAlt || DEFAULT_PROJECT_COVER_ALT}
                            className="h-40 w-28 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-40 w-28 items-center justify-center rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                            Sem capa
                          </div>
                        )}
                        <div className="space-y-3">
                          <Input
                            value={draft.coverImageUrl || ""}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                coverImageUrl: event.target.value,
                              }))
                            }
                            placeholder="URL da capa"
                          />
                          <Input
                            value={draft.coverImageAlt || ""}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                coverImageAlt: event.target.value,
                              }))
                            }
                            placeholder="Texto alternativo da capa"
                          />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="sources" className={editorSectionClassName}>
                  <AccordionTrigger className={editorAccordionTriggerClassName}>
                    <EditorAccordionHeader
                      title="Fontes de download"
                      subtitle="Links opcionais para capítulos híbridos"
                    />
                  </AccordionTrigger>
                  <AccordionContent className={editorSectionContentClassName}>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 p-4">
                        <div>
                          <Label className="text-sm">Fontes</Label>
                          <p className="text-xs text-muted-foreground">
                            Opcional para capítulos com leitura e download.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateDraft((current) => ({
                              ...current,
                              sources: [...(current.sources || []), { label: "", url: "" }],
                            }))
                          }
                        >
                          <Plus className="h-4 w-4" />
                          <span>Adicionar</span>
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {(draft.sources || []).map((source, sourceIndex) => (
                          <div
                            key={`chapter-source-${sourceIndex}`}
                            className="grid gap-2 rounded-xl border border-border/60 bg-card/70 p-3"
                          >
                            <Input
                              value={source.label}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  sources: (current.sources || []).map((item, index) =>
                                    index === sourceIndex
                                      ? { ...item, label: event.target.value }
                                      : item,
                                  ),
                                }))
                              }
                              placeholder="Fonte"
                            />
                            <Input
                              value={source.url}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  sources: (current.sources || []).map((item, index) =>
                                    index === sourceIndex
                                      ? { ...item, url: event.target.value }
                                      : item,
                                  ),
                                }))
                              }
                              placeholder="URL"
                            />
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  updateDraft((current) => ({
                                    ...current,
                                    sources: (current.sources || []).filter(
                                      (_, index) => index !== sourceIndex,
                                    ),
                                  }))
                                }
                              >
                                Remover
                              </Button>
                            </div>
                          </div>
                        ))}
                        {(draft.sources || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada.</p>
                        ) : null}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : null}
            {structureAccordion}
          </aside>

          {hasActiveChapter ? (
            <section
              className={`${editorSectionClassName} order-3 mt-1 min-w-0 2xl:col-start-1 2xl:row-start-2 2xl:mt-0`}
              data-state="open"
              data-testid="chapter-content-section"
            >
              <div className={editorSectionHeaderClassName}>
                <div className="flex w-full items-center justify-between gap-4 text-left">
                  <span className="text-sm font-semibold">Conteúdo</span>
                  <span className="text-xs text-muted-foreground">
                    Lexical com largura ampliada para a escrita do capítulo
                  </span>
                </div>
              </div>
              <div className={editorSectionContentClassName}>
                <div
                  className="chapter-editor-lexical-wrapper min-w-0"
                  data-testid="chapter-lexical-wrapper"
                >
                  <Suspense fallback={<LexicalEditorFallback />}>
                    <LexicalEditor
                      ref={editorRef}
                      value={draft.content || ""}
                      onChange={(nextValue) =>
                        updateDraft((current) => ({
                          ...current,
                          content: nextValue,
                          contentFormat: "lexical",
                        }))
                      }
                      placeholder="Escreva o capítulo..."
                      className="lexical-playground--modal lexical-playground--stretch lexical-playground--chapter-editor min-w-0 w-full"
                      imageLibraryOptions={chapterImageLibraryOptions}
                      autoFocus={false}
                    />
                  </Suspense>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        {libraryTarget ? (
          <Suspense
            fallback={
              isLibraryOpen ? (
                <ImageLibraryDialogLoadingFallback
                  open={isLibraryOpen}
                  onOpenChange={setIsLibraryOpen}
                  description={
                    libraryTarget === "volume-cover"
                      ? "Selecione uma capa para o volume."
                      : "Selecione uma capa para o capítulo."
                  }
                />
              ) : null
            }
          >
            <ImageLibraryDialog
              open={isLibraryOpen}
              onOpenChange={(nextOpen) => {
                setIsLibraryOpen(nextOpen);
                if (!nextOpen) {
                  setLibraryTarget(null);
                }
              }}
              apiBase={apiBase}
              uploadFolder={
                libraryTarget === "volume-cover"
                  ? volumeImageLibraryOptions.uploadFolder
                  : chapterImageLibraryOptions.uploadFolder
              }
              listFolders={
                libraryTarget === "volume-cover"
                  ? volumeImageLibraryOptions.listFolders
                  : chapterImageLibraryOptions.listFolders
              }
              listAll={
                libraryTarget === "volume-cover"
                  ? volumeImageLibraryOptions.listAll
                  : chapterImageLibraryOptions.listAll
              }
              includeProjectImages={
                libraryTarget === "volume-cover"
                  ? volumeImageLibraryOptions.includeProjectImages
                  : chapterImageLibraryOptions.includeProjectImages
              }
              projectImageProjectIds={
                libraryTarget === "volume-cover"
                  ? volumeImageLibraryOptions.projectImageProjectIds
                  : chapterImageLibraryOptions.projectImageProjectIds
              }
              projectImagesView={
                libraryTarget === "volume-cover"
                  ? volumeImageLibraryOptions.projectImagesView
                  : chapterImageLibraryOptions.projectImagesView
              }
              allowDeselect
              mode="single"
              currentSelectionUrls={
                libraryTarget === "volume-cover"
                  ? selectedVolumeEntry?.coverImageUrl
                    ? [selectedVolumeEntry.coverImageUrl]
                    : []
                  : draft.coverImageUrl
                    ? [draft.coverImageUrl]
                    : []
              }
              onSave={({ urls, items }) => {
                const nextUrl = String(urls[0] || "").trim();
                if (libraryTarget === "volume-cover" && selectedVolumeNumber !== null) {
                  updateSelectedVolumeEntry((entry) => ({
                    ...entry,
                    coverImageUrl: nextUrl,
                    coverImageAlt: nextUrl
                      ? resolveAssetAltText(
                          items[0]?.altText,
                          buildVolumeCoverAltFallback(selectedVolumeNumber),
                        )
                      : "",
                  }));
                } else {
                  updateDraft((current) => ({
                    ...current,
                    coverImageUrl: nextUrl,
                    coverImageAlt: nextUrl
                      ? resolveAssetAltText(items[0]?.altText, getEpisodeCoverAltFallback(true))
                      : "",
                  }));
                }
                setIsLibraryOpen(false);
                setLibraryTarget(null);
              }}
            />
          </Suspense>
        ) : null}
      </>
    );
  },
);

ChapterEditorPane.displayName = "ChapterEditorPane";

const DashboardProjectChapterEditor = () => {
  usePageMeta({ title: "Gerenciamento de Conteúdo", noIndex: true });
  const apiBase = getApiBase();
  const navigate = useNavigate();
  const { projectId, chapterNumber } = useParams<{ projectId: string; chapterNumber?: string }>();
  const [searchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [hasLoadedCurrentUser, setHasLoadedCurrentUser] = useState(false);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [chapterSearchQuery, setChapterSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<ChapterFilterMode>("all");
  const [activeDraft, setActiveDraft] = useState<ProjectEpisode | null>(null);
  const [volumeEntriesDraft, setVolumeEntriesDraft] = useState<ProjectVolumeEntry[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<number | null>(null);
  const [isSavingVolumes, setIsSavingVolumes] = useState(false);
  const editorPaneRef = useRef<ChapterEditorPaneHandle | null>(null);
  const [backendCapabilities, setBackendCapabilities] = useState<ApiContractCapabilities | null>(
    null,
  );
  const [backendBuildMetadata, setBackendBuildMetadata] =
    useState<ApiContractBuildMetadata | null>(null);
  const [backendCapabilitiesError, setBackendCapabilitiesError] = useState<string | null>(null);
  const [epubRouteStatus, setEpubRouteStatus] = useState<EpubRouteStatus>("unknown");
  const [epubImportFile, setEpubImportFile] = useState<File | null>(null);
  const [epubImportTargetVolume, setEpubImportTargetVolume] = useState("");
  const [epubImportAsDraft, setEpubImportAsDraft] = useState(true);
  const [isImportingEpub, setIsImportingEpub] = useState(false);
  const [epubExportVolume, setEpubExportVolume] = useState("");
  const [epubExportIncludeDrafts, setEpubExportIncludeDrafts] = useState(false);
  const [isExportingEpub, setIsExportingEpub] = useState(false);
  const epubImportInputRef = useRef<HTMLInputElement | null>(null);
  const pendingEpubAutoImportRef = useRef(false);
  const pendingEpubImportIdsRef = useRef<Set<string>>(new Set());
  const pendingNeutralSelectedVolumeRef = useRef<number | null>(null);

  const canManageProjects = useMemo(() => {
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    return permissions.includes("*") || permissions.includes("projetos");
  }, [currentUser]);
  const frontendBuildMetadata = useMemo(() => getFrontendBuildMetadata(), []);
  const locationOrigin = useMemo(
    () => (typeof window !== "undefined" && window.location ? window.location.origin : ""),
    [],
  );
  const backendSupportsEpubImport = backendCapabilities?.project_epub_import === true;
  const backendSupportsEpubExport = backendCapabilities?.project_epub_export === true;
  const epubCapabilityState = useMemo(() => {
    if (backendCapabilitiesError) {
      return {
        message: EPUB_CAPABILITY_UNKNOWN_MESSAGE,
        variant: "destructive" as const,
      };
    }
    if (
      backendCapabilities &&
      (!backendCapabilities.project_epub_import || !backendCapabilities.project_epub_export)
    ) {
      return {
        message: EPUB_CAPABILITY_UNAVAILABLE_MESSAGE,
        variant: "warning" as const,
      };
    }
    return null;
  }, [backendCapabilities, backendCapabilitiesError]);
  const backendBuildLabel = useMemo(
    () => formatBuildMetadataLabel(backendBuildMetadata),
    [backendBuildMetadata],
  );
  const frontendBuildLabel = useMemo(
    () => formatBuildMetadataLabel(frontendBuildMetadata),
    [frontendBuildMetadata],
  );

  const logEpubParityIssue = useCallback(
    ({
      path,
      status,
      reason,
    }: {
      path: string;
      status: number | "network" | "blocked";
      reason: string;
    }) => {
      console.warn("epub_backend_parity_mismatch", {
        reason,
        path,
        status,
        locationOrigin,
        apiBase,
        contractVersion: "v1",
        frontend: frontendBuildMetadata,
        backend: backendBuildMetadata,
      });
    },
    [apiBase, backendBuildMetadata, frontendBuildMetadata, locationOrigin],
  );

  const clearPendingEpubImportIds = useCallback(() => {
    pendingEpubImportIdsRef.current.clear();
  }, []);
  const registerPendingEpubImportIds = useCallback((payload: unknown) => {
    extractEpubTempImportIdsFromPayload(payload).forEach((importId) => {
      pendingEpubImportIdsRef.current.add(importId);
    });
  }, []);
  const cleanupPendingEpubImports = useCallback(() => {
    const importIds = Array.from(pendingEpubImportIdsRef.current)
      .map((importId) => String(importId || "").trim())
      .filter(Boolean);
    if (!importIds.length) {
      return;
    }
    pendingEpubImportIdsRef.current.clear();
    void apiFetch(apiBase, "/api/projects/epub/import/cleanup", {
      method: "POST",
      auth: true,
      keepalive: true,
      json: { importIds },
    });
  }, [apiBase]);

  useEffect(() => {
    return () => {
      cleanupPendingEpubImports();
    };
  }, [cleanupPendingEpubImports]);

  const volumeParam = searchParams.get("volume");
  const parsedVolume = Number(volumeParam);
  const resolvedVolume =
    volumeParam !== null && Number.isFinite(parsedVolume) ? parsedVolume : undefined;

  useEffect(() => {
    let isMounted = true;
    const loadCurrentUser = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/me", { auth: true });
        if (!response.ok) {
          if (isMounted) {
            setCurrentUser(null);
          }
          return;
        }
        const data = await response.json();
        const nextUser =
          data && typeof data === "object" && "user" in data
            ? (data.user as CurrentUser | null | undefined)
            : (data as CurrentUser | null | undefined);
        if (isMounted) {
          setCurrentUser(nextUser ?? null);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setHasLoadedCurrentUser(true);
        }
      }
    };
    void loadCurrentUser();
    return () => {
      isMounted = false;
    };
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const loadApiContract = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/contracts/v1.json", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`api_contract_${response.status}`);
        }
        const data = (await response.json()) as ApiContractV1;
        if (!isActive) {
          return;
        }
        setBackendCapabilities(normalizeApiContractCapabilities(data?.capabilities));
        setBackendBuildMetadata(normalizeApiContractBuildMetadata(data?.build));
        setBackendCapabilitiesError(null);
        setEpubRouteStatus("ok");
      } catch {
        if (!isActive) {
          return;
        }
        setBackendCapabilities(DEFAULT_API_CAPABILITIES);
        setBackendBuildMetadata(null);
        setBackendCapabilitiesError("api_contract_unavailable");
        setEpubRouteStatus("unknown");
      }
    };
    void loadApiContract();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    const normalizedLocationOrigin = normalizeOriginLabel(locationOrigin);
    const normalizedApiBase = normalizeOriginLabel(apiBase);
    if (
      normalizedLocationOrigin === "indisponivel" ||
      normalizedApiBase === "indisponivel" ||
      normalizedLocationOrigin === normalizedApiBase
    ) {
      return;
    }
    logOriginApiBaseMismatchOnce({
      locationOrigin: normalizedLocationOrigin,
      apiBase: normalizedApiBase,
      frontend: frontendBuildMetadata,
      backend: backendBuildMetadata,
    });
  }, [apiBase, backendBuildMetadata, frontendBuildMetadata, locationOrigin]);

  const loadProject = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setHasLoadError(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setHasLoadError(false);
    try {
      const response = await apiFetch(apiBase, `/api/projects/${projectId}`, { auth: true });
      if (!response.ok) {
        setProject(null);
        setVolumeEntriesDraft([]);
        setSelectedVolume(null);
        pendingNeutralSelectedVolumeRef.current = null;
        setHasLoadError(response.status !== 404);
        return;
      }
      const data = (await response.json()) as { project?: ProjectRecord };
      setProject(data?.project || null);
      setVolumeEntriesDraft(normalizeProjectVolumeEntries(data?.project?.volumeEntries));
      setSelectedVolume(null);
      pendingNeutralSelectedVolumeRef.current = null;
    } catch {
      setProject(null);
      setVolumeEntriesDraft([]);
      setSelectedVolume(null);
      pendingNeutralSelectedVolumeRef.current = null;
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const isLightNovel = isLightNovelType(project?.type || "");
  const chapters = useMemo(
    () => sortChapters(Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : []),
    [project?.episodeDownloads],
  );

  const activeChapterLookup = useMemo(() => {
    if (!chapterNumber) {
      return { ok: false as const, code: "neutral" as const };
    }
    return resolveEpisodeLookup(chapters, chapterNumber, resolvedVolume);
  }, [chapterNumber, chapters, resolvedVolume]);
  const activeChapter =
    activeChapterLookup.ok && "episode" in activeChapterLookup ? activeChapterLookup.episode : null;
  const activeChapterIndex =
    activeChapterLookup.ok && "index" in activeChapterLookup ? activeChapterLookup.index : -1;
  const activeChapterKey =
    activeChapter && chapterNumber ? buildEpisodeKey(activeChapter.number, activeChapter.volume) : null;
  const activeChapterSnapshot = useMemo(() => buildChapterSnapshot(activeChapter), [activeChapter]);

  useEffect(() => {
    if (!activeChapter || !activeChapterKey) {
      setActiveDraft(null);
      return;
    }
    const nextDraft = normalizeChapterForSave(activeChapter);
    setActiveDraft((current) => {
      if (!current) {
        return nextDraft;
      }
      const currentKey = buildEpisodeKey(current.number, current.volume);
      if (currentKey !== activeChapterKey) {
        return nextDraft;
      }
      const currentSnapshot = buildChapterSnapshot(current);
      if (currentSnapshot === activeChapterSnapshot) {
        return nextDraft;
      }
      return current;
    });
  }, [activeChapter, activeChapterKey, activeChapterSnapshot]);

  const normalizedProjectVolumeEntries = useMemo(
    () => normalizeProjectVolumeEntries(project?.volumeEntries),
    [project?.volumeEntries],
  );
  const projectVolumeEntriesSnapshot = useMemo(
    () => buildVolumeEntriesSnapshot(normalizedProjectVolumeEntries),
    [normalizedProjectVolumeEntries],
  );
  const volumeEntriesDraftSnapshot = useMemo(
    () => buildVolumeEntriesSnapshot(volumeEntriesDraft),
    [volumeEntriesDraft],
  );
  const isVolumeDirty = volumeEntriesDraftSnapshot !== projectVolumeEntriesSnapshot;
  const projectWithVolumeDraft = useMemo(() => {
    if (!project) {
      return null;
    }
    return buildProjectSnapshotWithVolumeEntries(project, volumeEntriesDraft);
  }, [project, volumeEntriesDraft]);
  const projectSnapshot = useMemo(() => {
    if (!projectWithVolumeDraft) {
      return null;
    }
    return overlayDraftOnProject(projectWithVolumeDraft, activeChapterKey, activeDraft);
  }, [activeChapterKey, activeDraft, projectWithVolumeDraft]);

  const availableVolumes = useMemo<EditableVolumeOption[]>(() => {
    if (!projectSnapshot) {
      return [];
    }
    const chapterCountByVolume = new Map<number, number>();
    const metadataVolumeKeys = new Set(
      normalizeProjectVolumeEntries(volumeEntriesDraft).map((entry) => buildVolumeCoverKey(entry.volume)),
    );
    (Array.isArray(projectSnapshot.episodeDownloads) ? projectSnapshot.episodeDownloads : []).forEach(
      (episode) => {
        const parsedVolume = Number(episode?.volume);
        if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
          return;
        }
        chapterCountByVolume.set(
          parsedVolume,
          (chapterCountByVolume.get(parsedVolume) || 0) + 1,
        );
      },
    );
    normalizeProjectVolumeEntries(volumeEntriesDraft).forEach((entry) => {
      if (!chapterCountByVolume.has(entry.volume)) {
        chapterCountByVolume.set(entry.volume, 0);
      }
    });
    return Array.from(chapterCountByVolume.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([volume, chapterCount]) => ({
        volume,
        chapterCount,
        hasMetadata: metadataVolumeKeys.has(buildVolumeCoverKey(volume)),
      }));
  }, [projectSnapshot, volumeEntriesDraft]);

  useEffect(() => {
    if (!chapterNumber) {
      if (pendingNeutralSelectedVolumeRef.current !== null) {
        setSelectedVolume(pendingNeutralSelectedVolumeRef.current);
        pendingNeutralSelectedVolumeRef.current = null;
        return;
      }
      setSelectedVolume(null);
    }
  }, [chapterNumber]);

  useEffect(() => {
    if (!chapterNumber) {
      return;
    }
    const activeVolume = Number.isFinite(Number(activeChapter?.volume))
      ? Number(activeChapter?.volume)
      : null;
    if (
      activeVolume !== null &&
      availableVolumes.some((volumeOption) => volumeOption.volume === activeVolume)
    ) {
      setSelectedVolume(activeVolume);
      return;
    }
    setSelectedVolume(null);
  }, [activeChapter?.volume, availableVolumes, chapterNumber]);

  const selectedVolumeChapterCount = useMemo(
    () =>
      selectedVolume !== null
        ? availableVolumes.find((volumeOption) => volumeOption.volume === selectedVolume)
            ?.chapterCount || 0
        : 0,
    [availableVolumes, selectedVolume],
  );

  const updateVolumeEntryByVolume = useCallback(
    (volume: number, updater: (entry: ProjectVolumeEntry) => ProjectVolumeEntry) => {
      const normalizedVolume = Number(volume);
      if (!Number.isFinite(normalizedVolume) || normalizedVolume <= 0) {
        return;
      }
      setVolumeEntriesDraft((currentEntries) => {
        const nextEntries = normalizeProjectVolumeEntries(currentEntries);
        const entryIndex = nextEntries.findIndex(
          (entry) => buildVolumeCoverKey(entry.volume) === buildVolumeCoverKey(normalizedVolume),
        );
        const baseEntry =
          entryIndex >= 0
            ? { ...nextEntries[entryIndex], volume: normalizedVolume }
            : {
                volume: normalizedVolume,
                synopsis: "",
                coverImageUrl: "",
                coverImageAlt: "",
              };
        if (entryIndex >= 0) {
          nextEntries[entryIndex] = updater(baseEntry);
        } else {
          nextEntries.push(updater(baseEntry));
        }
        return normalizeProjectVolumeEntries(nextEntries);
      });
    },
    [],
  );

  const addVolumeEntry = useCallback(() => {
    const nextVolume =
      normalizeProjectVolumeEntries(volumeEntriesDraft).reduce(
        (maxValue, entry) => Math.max(maxValue, Number(entry.volume) || 0),
        0,
      ) + 1;
    setVolumeEntriesDraft((currentEntries) =>
      normalizeProjectVolumeEntries([
        ...normalizeProjectVolumeEntries(currentEntries),
        {
          volume: nextVolume,
          synopsis: "",
          coverImageUrl: "",
          coverImageAlt: "",
        },
      ]),
    );
    setSelectedVolume(nextVolume);
  }, [volumeEntriesDraft]);

  const removeVolumeEntryByVolume = useCallback((volume: number) => {
    const normalizedVolume = Number(volume);
    if (!Number.isFinite(normalizedVolume) || normalizedVolume <= 0) {
      return;
    }
    setVolumeEntriesDraft((currentEntries) =>
      normalizeProjectVolumeEntries(currentEntries).filter(
        (entry) => buildVolumeCoverKey(entry.volume) !== buildVolumeCoverKey(normalizedVolume),
      ),
    );
  }, []);

  const filteredChapters = useMemo(
    () =>
      chapters.filter(
        (episode) =>
          matchesFilter(episode, filterMode) && matchesChapterSearch(episode, chapterSearchQuery),
      ),
    [chapterSearchQuery, chapters, filterMode],
  );

  const chaptersByStructureGroup = useMemo(() => groupChaptersByStructureKey(chapters), [chapters]);
  const filteredChaptersByStructureGroup = useMemo(
    () => groupChaptersByStructureKey(filteredChapters),
    [filteredChapters],
  );

  const structureGroups = useMemo<ChapterStructureGroup[]>(() => {
    const numericGroups = availableVolumes.map((volumeOption) => {
      const key = String(volumeOption.volume);
      return {
        key,
        label: buildChapterVolumeLabel(volumeOption.volume),
        volume: volumeOption.volume,
        hasMetadata: volumeOption.hasMetadata,
        chapterCount: volumeOption.chapterCount,
        allItems: chaptersByStructureGroup.get(key) || [],
        visibleItems: filteredChaptersByStructureGroup.get(key) || [],
      };
    });
    const semVolumeItems = chaptersByStructureGroup.get("none") || [];
    numericGroups.push({
      key: "none",
      label: "Sem volume",
      volume: null,
      hasMetadata: false,
      chapterCount: semVolumeItems.length,
      allItems: semVolumeItems,
      visibleItems: filteredChaptersByStructureGroup.get("none") || [],
    });
    return numericGroups;
  }, [availableVolumes, chaptersByStructureGroup, filteredChaptersByStructureGroup]);

  const navigableChapters = useMemo(() => {
    if (
      activeChapterKey &&
      filteredChapters.some(
        (episode) => buildEpisodeKey(episode.number, episode.volume) === activeChapterKey,
      )
    ) {
      return filteredChapters;
    }
    return chapters;
  }, [activeChapterKey, chapters, filteredChapters]);

  const activeNavigableChapterIndex = useMemo(
    () =>
      activeChapterKey
        ? navigableChapters.findIndex(
            (episode) => buildEpisodeKey(episode.number, episode.volume) === activeChapterKey,
          )
        : -1,
    [activeChapterKey, navigableChapters],
  );

  const previousChapterHref =
    activeNavigableChapterIndex > 0
      ? buildDashboardProjectChapterEditorHref(
          project?.id || "",
          navigableChapters[activeNavigableChapterIndex - 1]?.number,
          navigableChapters[activeNavigableChapterIndex - 1]?.volume,
        )
      : null;
  const nextChapterHref =
    activeNavigableChapterIndex >= 0 && activeNavigableChapterIndex < navigableChapters.length - 1
      ? buildDashboardProjectChapterEditorHref(
          project?.id || "",
          navigableChapters[activeNavigableChapterIndex + 1]?.number,
          navigableChapters[activeNavigableChapterIndex + 1]?.volume,
        )
      : null;
  const neutralHref = buildDashboardProjectChaptersEditorHref(project?.id || projectId || "");

  const requestNavigateToHref = useCallback(
    async (
      href: string,
      options?: {
        preserveNeutralSelectedVolume?: number | null;
      },
    ) => {
      const canLeave = await editorPaneRef.current?.requestLeave?.();
      if (canLeave === false) {
        return false;
      }
      pendingNeutralSelectedVolumeRef.current =
        Number.isFinite(Number(options?.preserveNeutralSelectedVolume)) &&
        Number(options?.preserveNeutralSelectedVolume) > 0
          ? Number(options?.preserveNeutralSelectedVolume)
          : null;
      navigate(href);
      return true;
    },
    [navigate],
  );

  const handleStructureVolumeSelection = useCallback(
    async (nextVolume: number) => {
      const normalizedVolume = Number(nextVolume);
      if (!Number.isFinite(normalizedVolume) || normalizedVolume <= 0) {
        return;
      }

      if (!activeChapterKey || !activeChapter) {
        setSelectedVolume(normalizedVolume);
        return;
      }

      await requestNavigateToHref(neutralHref, {
        preserveNeutralSelectedVolume: normalizedVolume,
      });
    },
    [activeChapter, activeChapterKey, neutralHref, requestNavigateToHref],
  );

  const handleChapterSaved = useCallback(
    (nextProject: ProjectRecord, nextChapter: ProjectEpisode) => {
      setProject(nextProject);
      setActiveDraft(nextChapter);
      navigate(
        buildDashboardProjectChapterEditorHref(
          nextProject.id,
          nextChapter.number,
          nextChapter.volume,
        ),
        { replace: true },
      );
    },
    [navigate],
  );

  const persistProjectSnapshot = useCallback(
    async (
      snapshot: ProjectRecord,
      options: { context: "epub-import" | "volume-editor" | "chapter-create" },
    ) => {
      const { revision: _ignoredRevision, ...payload } = snapshot;
      const response = await apiFetch(apiBase, `/api/projects/${snapshot.id}`, {
        method: "PUT",
        auth: true,
        json: {
          ...payload,
          ifRevision: project?.revision || "",
        },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorCode = String(data?.error || "").trim();
        if (errorCode === "duplicate_episode_key") {
          toast({
            title:
              options.context === "volume-editor"
                ? "Não foi possível salvar os volumes"
                : options.context === "chapter-create"
                  ? "Não foi possível criar o capítulo"
                  : "Falha ao importar EPUB",
            description:
              options.context === "volume-editor"
                ? "O projeto possui capítulos duplicados por número e volume."
                : options.context === "chapter-create"
                  ? "Já existe um capítulo com essa combinação de número e volume."
                  : EPUB_IMPORT_DUPLICATE_EPISODE_MESSAGE,
            variant: "destructive",
          });
          return null;
        }
        if (errorCode === "duplicate_volume_cover_key") {
          toast({
            title:
              options.context === "volume-editor"
                ? "Volumes duplicados"
                : options.context === "chapter-create"
                  ? "Não foi possível criar o capítulo"
                  : "Falha ao importar EPUB",
            description:
              options.context === "volume-editor"
                ? "Cada volume pode aparecer apenas uma vez."
                : options.context === "chapter-create"
                  ? "Os metadados de volume ficaram duplicados neste snapshot."
                  : "O projeto resultante ficou com mais de uma entrada para o mesmo volume.",
            variant: "destructive",
          });
          return null;
        }
        toast({
          title:
            options.context === "volume-editor"
              ? "Não foi possível salvar os volumes"
              : options.context === "chapter-create"
                ? "Não foi possível criar o capítulo"
                : "Não foi possível salvar o projeto",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
        return null;
      }
      const data = (await response.json()) as { project?: ProjectRecord };
      return data?.project || null;
    },
    [apiBase, project?.revision],
  );

  const handleSaveVolumes = useCallback(async () => {
    if (!project || isSavingVolumes || !isVolumeDirty) {
      return true;
    }
    const normalizedVolumeEntries = normalizeVolumeEntriesForSave(volumeEntriesDraft);
    const duplicateVolumeEntry = findDuplicateVolumeCover(normalizedVolumeEntries);
    if (duplicateVolumeEntry) {
      toast({
        title: "Volumes duplicados",
        description: "Cada volume pode aparecer apenas uma vez.",
        variant: "destructive",
      });
      return false;
    }
    setIsSavingVolumes(true);
    try {
      const persistedProject = await persistProjectSnapshot(
        buildProjectSnapshotWithVolumeEntries(project, volumeEntriesDraft),
        { context: "volume-editor" },
      );
      if (!persistedProject) {
        return false;
      }
      setProject(persistedProject);
      setVolumeEntriesDraft(normalizeProjectVolumeEntries(persistedProject.volumeEntries));
      toast({
        title: "Volumes salvos",
        description: "Os metadados de volume foram atualizados no projeto.",
        intent: "success",
      });
      return true;
    } finally {
      setIsSavingVolumes(false);
    }
  }, [isSavingVolumes, isVolumeDirty, persistProjectSnapshot, project, volumeEntriesDraft]);

  const handleAddChapter = useCallback(
    async (targetVolume: number | null) => {
      if (!projectSnapshot || !project) {
        return;
      }
      const normalizedVolume =
        Number.isFinite(Number(targetVolume)) && Number(targetVolume) > 0
          ? Number(targetVolume)
          : undefined;
      const nextChapter = buildNewChapterDraft(
        Array.isArray(projectSnapshot.episodeDownloads) ? projectSnapshot.episodeDownloads : [],
        normalizedVolume,
      );
      const nextSnapshot = {
        ...projectSnapshot,
        episodeDownloads: sortChapters([
          ...(Array.isArray(projectSnapshot.episodeDownloads) ? projectSnapshot.episodeDownloads : []),
          nextChapter,
        ]),
      };
      const shouldResetFilters =
        !matchesFilter(nextChapter, filterMode) ||
        !matchesChapterSearch(nextChapter, chapterSearchQuery);
      const persistedProject = await persistProjectSnapshot(nextSnapshot, {
        context: "chapter-create",
      });
      if (!persistedProject) {
        return;
      }
      setProject(persistedProject);
      setVolumeEntriesDraft(normalizeProjectVolumeEntries(persistedProject.volumeEntries));
      setSelectedVolume(normalizedVolume ?? null);
      if (shouldResetFilters) {
        setChapterSearchQuery("");
        setFilterMode("all");
      }
      const persistedChapter =
        sortChapters(
          Array.isArray(persistedProject.episodeDownloads) ? persistedProject.episodeDownloads : [],
        ).find(
          (episode) =>
            buildEpisodeKey(episode.number, episode.volume) ===
            buildEpisodeKey(nextChapter.number, nextChapter.volume),
        ) || nextChapter;
      navigate(
        buildDashboardProjectChapterEditorHref(
          persistedProject.id,
          persistedChapter.number,
          persistedChapter.volume,
        ),
      );
      toast({
        title: "Capítulo criado",
        description: "O novo capítulo foi adicionado como rascunho.",
        intent: "success",
      });
    },
    [
      chapterSearchQuery,
      filterMode,
      navigate,
      persistProjectSnapshot,
      project,
      projectSnapshot,
    ],
  );

  const openEpubImportPicker = useCallback(
    ({ autoImportAfterSelect }: { autoImportAfterSelect: boolean }) => {
      const input = epubImportInputRef.current;
      if (!input || isImportingEpub || !backendSupportsEpubImport) {
        return;
      }
      pendingEpubAutoImportRef.current = autoImportAfterSelect;
      input.value = "";
      input.click();
    },
    [backendSupportsEpubImport, isImportingEpub],
  );

  const submitEpubImport = useCallback(
    async (file: File) => {
      if (!projectSnapshot || isImportingEpub) {
        return;
      }
      if (!backendSupportsEpubImport) {
        logEpubParityIssue({
          path: "/api/projects/epub/import",
          status: "blocked",
          reason: backendCapabilitiesError ? "contract_unreachable" : "capability_missing",
        });
        toast({
          title: "Falha ao importar EPUB",
          description: backendCapabilitiesError
            ? EPUB_CAPABILITY_UNKNOWN_MESSAGE
            : EPUB_CAPABILITY_UNAVAILABLE_MESSAGE,
          variant: "destructive",
        });
        return;
      }

      setIsImportingEpub(true);
      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("project", JSON.stringify(buildEpubImportProjectSnapshot(projectSnapshot)));
        if (epubImportTargetVolume.trim()) {
          formData.set("targetVolume", epubImportTargetVolume.trim());
        }
        formData.set("defaultStatus", epubImportAsDraft ? "draft" : "published");
        const response = await apiFetch(apiBase, "/api/projects/epub/import", {
          method: "POST",
          auth: true,
          body: formData,
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          if (response.status === 404) {
            if (data?.error === "project_not_found") {
              setEpubRouteStatus("legacy_project_not_found");
              toast({
                title: "Falha ao importar EPUB",
                description: EPUB_IMPORT_LEGACY_PROJECT_MISSING_MESSAGE,
                variant: "destructive",
              });
              return;
            }
            setEpubRouteStatus("route_unreachable_for_current_origin");
            toast({
              title: "Falha ao importar EPUB",
              description: EPUB_IMPORT_ROUTE_MISSING_MESSAGE,
              variant: "destructive",
            });
            return;
          }
          if (response.status === 403) {
            setEpubRouteStatus("forbidden");
            toast({
              title: "Falha ao importar EPUB",
              description: "Você não tem permissão para importar EPUB.",
              variant: "destructive",
            });
            return;
          }
          if (
            (typeof data?.error === "string" && data.error === "project_snapshot_too_large") ||
            isLegacyMultipartSnapshotTooLargeError(data?.error, data?.detail)
          ) {
            setEpubRouteStatus("ok");
            toast({
              title: "Falha ao importar EPUB",
              description: EPUB_IMPORT_SNAPSHOT_TOO_LARGE_MESSAGE,
              variant: "destructive",
            });
            return;
          }
          if (typeof data?.error === "string" && data.error === "invalid_project_snapshot") {
            setEpubRouteStatus("ok");
            toast({
              title: "Falha ao importar EPUB",
              description: EPUB_IMPORT_INVALID_SNAPSHOT_MESSAGE,
              variant: "destructive",
            });
            return;
          }
          if (typeof data?.error === "string" && data.error === "duplicate_episode_key") {
            setEpubRouteStatus("ok");
            toast({
              title: "Falha ao importar EPUB",
              description: EPUB_IMPORT_DUPLICATE_EPISODE_MESSAGE,
              variant: "destructive",
            });
            return;
          }
          if (
            typeof data?.error === "string" &&
            data.error === "epub_import_failed" &&
            (isEpubCssEngineFailureDetail(data?.detail) ||
              !(typeof data?.detail === "string" && data.detail.trim().length > 0))
          ) {
            toast({
              title: "Falha ao importar EPUB",
              description: EPUB_IMPORT_PROCESSING_MESSAGE,
              variant: "destructive",
            });
            return;
          }
          toast({
            title: "Falha ao importar EPUB",
            description:
              typeof data?.detail === "string"
                ? data.detail
                : "Não foi possível processar o arquivo informado.",
            variant: "destructive",
          });
          return;
        }

        setEpubRouteStatus("ok");
        const data = await response.json();
        registerPendingEpubImportIds(data);
        const chapters = Array.isArray(data?.chapters) ? (data.chapters as ProjectEpisode[]) : [];
        const volumeCovers = Array.isArray(data?.volumeCovers)
          ? (data.volumeCovers as Array<
              ProjectVolumeCover & { mergeMode?: "create" | "update" | "preserve_existing" }
            >)
          : [];

        const importedSnapshot = mergeImportedVolumeCoversIntoProject(
          mergeImportedChaptersIntoProject(projectSnapshot, chapters),
          volumeCovers,
        );
        const persistedProject = await persistProjectSnapshot(importedSnapshot, {
          context: "epub-import",
        });
        if (!persistedProject) {
          return;
        }
        clearPendingEpubImportIds();
        setProject(persistedProject);
        setVolumeEntriesDraft(normalizeProjectVolumeEntries(persistedProject.volumeEntries));

        const importedKeys = chapters
          .map((chapter) => buildEpisodeKey(chapter.number, chapter.volume))
          .filter(Boolean);
        const persistedChapters = sortChapters(
          Array.isArray(persistedProject.episodeDownloads) ? persistedProject.episodeDownloads : [],
        );
        const currentPersistedChapter =
          activeChapterKey && importedKeys.includes(activeChapterKey)
            ? persistedChapters.find(
                (chapter) => buildEpisodeKey(chapter.number, chapter.volume) === activeChapterKey,
              ) || null
            : null;
        const firstImportedChapter = persistedChapters.find((chapter) =>
          importedKeys.includes(buildEpisodeKey(chapter.number, chapter.volume)),
        );
        if (currentPersistedChapter) {
          setActiveDraft(normalizeChapterForSave(currentPersistedChapter));
        } else if (firstImportedChapter) {
          navigate(
            buildDashboardProjectChapterEditorHref(
              persistedProject.id,
              firstImportedChapter.number,
              firstImportedChapter.volume,
            ),
            { replace: true },
          );
        }

        const importedChapterCount = Number.isFinite(Number(data?.summary?.chapters))
          ? Number(data.summary.chapters)
          : chapters.length;
        toast({
          title: "EPUB importado",
          description: `${importedChapterCount} capítulo(s) incorporados ao projeto.`,
          intent: "success",
        });
      } catch {
        setEpubRouteStatus("network_unreachable");
        logEpubParityIssue({
          path: "/api/projects/epub/import",
          status: "network",
          reason: "network_unreachable",
        });
        toast({
          title: "Falha ao importar EPUB",
          description: EPUB_NETWORK_ERROR_MESSAGE,
          variant: "destructive",
        });
      } finally {
        pendingEpubAutoImportRef.current = false;
        setIsImportingEpub(false);
      }
    },
    [
      activeChapterKey,
      apiBase,
      backendCapabilitiesError,
      backendSupportsEpubImport,
      clearPendingEpubImportIds,
      epubImportAsDraft,
      epubImportTargetVolume,
      isImportingEpub,
      logEpubParityIssue,
      navigate,
      persistProjectSnapshot,
      projectSnapshot,
      registerPendingEpubImportIds,
    ],
  );

  const handleEpubImportFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0] || null;
      setEpubImportFile(selectedFile);
      if (!selectedFile) {
        pendingEpubAutoImportRef.current = false;
        return;
      }
      if (!pendingEpubAutoImportRef.current) {
        return;
      }
      pendingEpubAutoImportRef.current = false;
      void submitEpubImport(selectedFile);
    },
    [submitEpubImport],
  );

  const handleImportEpub = useCallback(async () => {
    if (!backendSupportsEpubImport) {
      toast({
        title: "Falha ao importar EPUB",
        description: backendCapabilitiesError
          ? EPUB_CAPABILITY_UNKNOWN_MESSAGE
          : EPUB_CAPABILITY_UNAVAILABLE_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    if (!epubImportFile) {
      openEpubImportPicker({ autoImportAfterSelect: true });
      return;
    }
    await submitEpubImport(epubImportFile);
  }, [
    backendCapabilitiesError,
    backendSupportsEpubImport,
    epubImportFile,
    openEpubImportPicker,
    submitEpubImport,
  ]);

  const handleExportEpub = useCallback(async () => {
    if (!projectSnapshot) {
      return;
    }
    if (!backendSupportsEpubExport) {
      toast({
        title: "Falha ao exportar EPUB",
        description: backendCapabilitiesError
          ? EPUB_CAPABILITY_UNKNOWN_MESSAGE
          : EPUB_CAPABILITY_UNAVAILABLE_MESSAGE,
        variant: "destructive",
      });
      return;
    }

    setIsExportingEpub(true);
    try {
      const response = await apiFetch(apiBase, "/api/projects/epub/export", {
        method: "POST",
        auth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project: buildProjectSnapshotForEpubExport(projectSnapshot),
          volume: epubExportVolume.trim() ? Number(epubExportVolume) : null,
          includeDrafts: epubExportIncludeDrafts,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 404) {
          setEpubRouteStatus("route_unreachable_for_current_origin");
          toast({
            title: "Falha ao exportar EPUB",
            description: EPUB_EXPORT_ROUTE_MISSING_MESSAGE,
            variant: "destructive",
          });
          return;
        }
        if (response.status === 403) {
          setEpubRouteStatus("forbidden");
          toast({
            title: "Falha ao exportar EPUB",
            description: "Você não tem permissão para exportar EPUB.",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Falha ao exportar EPUB",
          description:
            typeof data?.error === "string" && data.error === "no_eligible_chapters"
              ? "Não há capítulos elegíveis para esse volume."
              : typeof data?.detail === "string"
                ? data.detail
                : EPUB_EXPORT_GENERIC_MESSAGE,
          variant: "destructive",
        });
        return;
      }
      setEpubRouteStatus("ok");
      await downloadBinaryResponse(
        response,
        `${createSlug(projectSnapshot.title || "projeto") || "projeto"}.epub`,
      );
      toast({
        title: "EPUB exportado",
        description: "O volume foi gerado com o snapshot atual da página.",
        intent: "success",
      });
    } catch {
      setEpubRouteStatus("network_unreachable");
      toast({
        title: "Falha ao exportar EPUB",
        description: EPUB_NETWORK_ERROR_MESSAGE,
        variant: "destructive",
      });
    } finally {
      setIsExportingEpub(false);
    }
  }, [
    apiBase,
    backendCapabilitiesError,
    backendSupportsEpubExport,
    epubExportIncludeDrafts,
    epubExportVolume,
    projectSnapshot,
  ]);

  if (!projectId) {
    return <NotFound />;
  }

  if (isLoading || !hasLoadedCurrentUser) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={!hasLoadedCurrentUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <DashboardPageContainer maxWidth="7xl">
          <AsyncState kind="loading" title="Carregando editor de capítulo" />
        </DashboardPageContainer>
      </DashboardShell>
    );
  }

  if (hasLoadError) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={!hasLoadedCurrentUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <DashboardPageContainer maxWidth="6xl">
          <AsyncState
            kind="error"
            title="Não foi possível carregar o capítulo"
            description="Tente novamente em alguns instantes."
            action={
              <Button variant="outline" onClick={() => void loadProject()}>
                Tentar novamente
              </Button>
            }
          />
        </DashboardPageContainer>
      </DashboardShell>
    );
  }

  if (!canManageProjects) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={!hasLoadedCurrentUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <DashboardPageContainer maxWidth="6xl">
          <AsyncState
            kind="error"
            title="Acesso negado"
            description="Você não tem permissão para editar capítulos."
          />
        </DashboardPageContainer>
      </DashboardShell>
    );
  }

  if (!project || !isLightNovel) {
    return <NotFound />;
  }

  if (!activeChapter && chapterNumber) {
    if (activeChapterLookup.code === "volume_required") {
      return (
        <DashboardShell
          currentUser={currentUser}
          isLoadingUser={!hasLoadedCurrentUser}
          onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
        >
          <DashboardPageContainer maxWidth="6xl">
            <AsyncState
              kind="error"
              title="Volume obrigatório"
              description="Esse número de capítulo existe em mais de um volume. Abra o editor pela leitura pública ou informe o volume na URL."
              action={
                <Button asChild variant="outline">
                  <Link to={buildDashboardProjectEditorHref(projectId)}>Voltar ao projeto</Link>
                </Button>
              }
            />
          </DashboardPageContainer>
        </DashboardShell>
      );
    }
    return <NotFound />;
  }

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={!hasLoadedCurrentUser}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <DashboardPageContainer maxWidth="editor" reveal={false}>
        <ChapterEditorPane
          key={activeChapterKey || "neutral"}
          ref={editorPaneRef}
          project={project}
          activeChapter={activeChapter}
          activeDraft={activeDraft}
          onDraftChange={setActiveDraft}
          volumeEntriesDraft={volumeEntriesDraft}
          selectedVolume={selectedVolume}
          availableVolumes={availableVolumes}
          selectedVolumeChapterCount={selectedVolumeChapterCount}
          onSelectedVolumeChange={handleStructureVolumeSelection}
          onAddVolume={addVolumeEntry}
          onAddChapter={handleAddChapter}
          onRemoveVolume={removeVolumeEntryByVolume}
          onUpdateVolumeEntry={updateVolumeEntryByVolume}
          activeChapterKey={activeChapterKey}
          chapterCount={chapters.length}
          chapterIndex={Math.max(activeChapterIndex, 0)}
          structureGroups={structureGroups}
          chapterSearchQuery={chapterSearchQuery}
          onChapterSearchQueryChange={setChapterSearchQuery}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          previousChapterHref={previousChapterHref}
          nextChapterHref={nextChapterHref}
          neutralHref={neutralHref}
          onNavigateToHref={requestNavigateToHref}
          onChapterSaved={handleChapterSaved}
          isVolumeDirty={isVolumeDirty}
          isSavingVolumes={isSavingVolumes}
          onSaveVolumes={handleSaveVolumes}
          backendSupportsEpubImport={backendSupportsEpubImport}
          backendSupportsEpubExport={backendSupportsEpubExport}
          backendBuildLabel={backendBuildLabel}
          frontendBuildLabel={frontendBuildLabel}
          epubCapabilityState={epubCapabilityState}
          epubImportInputRef={epubImportInputRef}
          epubImportFile={epubImportFile}
          epubImportTargetVolume={epubImportTargetVolume}
          onEpubImportTargetVolumeChange={setEpubImportTargetVolume}
          epubImportAsDraft={epubImportAsDraft}
          onEpubImportAsDraftChange={setEpubImportAsDraft}
          isImportingEpub={isImportingEpub}
          onOpenEpubPicker={openEpubImportPicker}
          onEpubImportFileChange={handleEpubImportFileChange}
          onEpubImportFileCancel={() => {
            pendingEpubAutoImportRef.current = false;
          }}
          onImportEpub={handleImportEpub}
          epubExportVolume={epubExportVolume}
          onEpubExportVolumeChange={setEpubExportVolume}
          epubExportIncludeDrafts={epubExportIncludeDrafts}
          onEpubExportIncludeDraftsChange={setEpubExportIncludeDrafts}
          isExportingEpub={isExportingEpub}
          onExportEpub={handleExportEpub}
        />
      </DashboardPageContainer>
    </DashboardShell>
  );
};

export default DashboardProjectChapterEditor;
