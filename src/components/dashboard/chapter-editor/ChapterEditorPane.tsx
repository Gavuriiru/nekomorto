import DashboardShell from "@/components/DashboardShell";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/dashboard/dashboard-form-controls";
import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import { useChapterEditorLeaveGuard } from "@/components/dashboard/chapter-editor/useChapterEditorLeaveGuard";
import ChapterEditorEpubToolsSection from "@/components/dashboard/chapter-editor/ChapterEditorEpubToolsSection";
import ChapterEditorStructureSection from "@/components/dashboard/chapter-editor/ChapterEditorStructureSection";
import type { ChapterStructureGroup } from "@/components/dashboard/chapter-editor/ChapterEditorStructureSection";
import LazyImageLibraryDialog from "@/components/lazy/LazyImageLibraryDialog";
import LazyLexicalEditor, {
  loadLexicalEditor,
} from "@/components/lazy/LazyLexicalEditor";
import type { LexicalEditorHandle } from "@/components/lexical/LexicalEditor";
import LexicalEditorFallback from "@/components/lexical/LexicalEditorFallback";
import DownloadSourceSelect from "@/components/project-reader/DownloadSourceSelect";
import MangaChapterPagesEditor from "@/components/project-reader/MangaChapterPagesEditor";
import ProjectEditorSectionCard from "@/components/project-reader/ProjectEditorSectionCard";
import { exportMangaCollectionZip } from "@/components/project-reader/manga-collection-export";
import MangaWorkflowPanel, {
  buildStageChapterLabel,
  type MangaWorkflowPanelHandle,
  reconcileStageChapters,
  revokeStagePages,
  type StageChapter,
} from "@/components/project-reader/MangaWorkflowPanel";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import type {
  Project,
  ProjectEpisode,
  ProjectVolumeCover,
  ProjectVolumeEntry,
} from "@/data/projects";
import { useDashboardCurrentUser } from "@/hooks/use-dashboard-current-user";
import { refetchPublicBootstrapCache } from "@/hooks/use-public-bootstrap";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  buildProjectChapterAssetLibraryOptions,
  buildProjectVolumeAssetLibraryOptions,
} from "@/lib/dashboard-image-library";
import { logOriginApiBaseMismatchOnce } from "@/lib/dev-diagnostics";
import {
  buildChapterStructureGroupKey,
  buildChapterVolumeLabel,
  buildEditableVolumeOptions,
  buildChapterSnapshot,
  buildProjectSnapshotWithVolumeEntries,
  buildVolumeCoverAltFallback,
  chapterHasContent,
  chapterStatusLabel,
  compareChapterStructureGroupKeys,
  groupChaptersByStructureKey,
  groupStageChaptersByStructureKey,
  matchesChapterSearch,
  matchesFilter,
  matchesStageChapterFilter,
  matchesStageChapterSearch,
  normalizeEpubImportPreviewPayload,
  normalizeProjectSnapshotChapterOrderForPersist,
  normalizeStructureGroupKeys,
  normalizeChapterForEditor,
  normalizeChapterForSave,
  normalizeOriginLabel,
  normalizePositiveInteger,
  normalizeNonNegativeInteger,
  resolveChapterEntrySubtype,
  resolveImportedChapterCount,
  buildVolumeEntriesSnapshot,
  normalizeVolumeEntriesForSave,
  reorderChaptersWithinStructureGroup,
  sortChapters,
  supportsStructureChapterReordering,
  type ChapterFilterMode,
  type EditableVolumeOption,
} from "@/lib/dashboard-project-chapter";
import { formatBuildMetadataLabel, getFrontendBuildMetadata } from "@/lib/frontend-build";
import {
  DEFAULT_PROJECT_COVER_ALT,
  getEpisodeCoverAltFallback,
  resolveAssetAltText,
} from "@/lib/image-alt";
import { createSlug } from "@/lib/post-content";
import { findIncompleteDownloadSourceIndex } from "@/lib/project-download-sources";
import { cn } from "@/lib/utils";
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
  type EpubImportJob,
  type EpubRouteStatus,
  buildEpubImportProjectSnapshot,
  buildProjectSnapshotForEpubExport,
  downloadBinaryResponse,
  extractEpubTempImportIdsFromPayload,
  isEpubCssEngineFailureDetail,
  isLegacyMultipartSnapshotTooLargeError,
  mergeImportedChaptersIntoProject,
  mergeImportedVolumeCoversIntoProject,
  normalizeEpubImportJob,
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
  getProjectProgressState,
  syncProjectProgress,
  type ProjectProgressKind,
} from "@/lib/project-progress";
import {
  buildEpisodeKey,
  resolveCanonicalEpisodeRouteTarget,
  resolveEpisodeLookup,
  resolveNextMainEpisodeNumber,
} from "@/lib/project-episode-key";
import { resolveProjectImageFolders } from "@/lib/project-image-folders";
import { isChapterBasedType, isLightNovelType, isMangaType } from "@/lib/project-utils";
import { buildVolumeCoverKey, findDuplicateVolumeCover } from "@/lib/project-volume-cover-key";
import { normalizeProjectVolumeEntries } from "@/lib/project-volume-entries";
import type {
  ApiContractBuildMetadata,
  ApiContractCapabilities,
  ApiContractV1,
} from "@/types/api-contract";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  FileArchive,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type {
  ChangeEvent,
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  RefObject,
  SetStateAction,
} from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  normalizeProjectEpisodeContentFormat,
  normalizeProjectEpisodePages,
} from "../../../../shared/project-reader.js";
import ChapterEditorAccordionHeader from "./ChapterEditorAccordionHeader";

const chapterEditorLexicalMinHeightClassName = "min-h-[420px] lg:min-h-[620px]";

type ChapterStructureGroup = {
  key: string;
  label: string;
  volume: number | null;
  hasMetadata: boolean;
  chapterCount: number;
  allItems: ProjectEpisode[];
  visibleItems: ProjectEpisode[];
  pendingItems: StageChapter[];
  visiblePendingItems: StageChapter[];
};

type StructureScrollAnchor = {
  groupKey: string;
  top: number;
};

type DeleteDialogState =
  | {
      kind: "chapter";
      title: string;
      description: string;
      volume: number | null;
    }
  | {
      kind: "volume";
      title: string;
      description: string;
      volume: number;
    };

type VolumeSelectionOptions = {
  preserveScrollAnchor?: StructureScrollAnchor | null;
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
  hasUnsavedChanges: (options?: { nextHref?: string; routeExit?: boolean }) => boolean;
  requestLeave: (options?: { nextHref?: string; routeExit?: boolean }) => Promise<boolean>;
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
  filteredChapters: ProjectEpisode[];
  stagedChapters: StageChapter[];
  selectedStageChapterId: string | null;
  setStagedChapters: Dispatch<SetStateAction<StageChapter[]>>;
  setSelectedStageChapterId: Dispatch<SetStateAction<string | null>>;
  volumeEntriesDraft: ProjectVolumeEntry[];
  selectedVolume: number | null;
  availableVolumes: EditableVolumeOption[];
  selectedVolumeChapterCount: number;
  onSelectedVolumeChange: (
    nextVolume: number,
    options?: VolumeSelectionOptions,
  ) => boolean | Promise<boolean>;
  onAddVolume: () => void;
  onAddChapter: (targetVolume: number | null) => void | Promise<void>;
  onRequestDeleteVolume: (volume: number) => void;
  onRequestDeleteChapter: () => void;
  onClearSelectedVolume: () => void;
  onUpdateVolumeEntry: (
    volume: number,
    updater: (entry: ProjectVolumeEntry) => ProjectVolumeEntry,
  ) => void;
  activeChapterKey: string | null;
  chapterCount: number;
  chapterIndex: number;
  structureGroups: ChapterStructureGroup[];
  initialOpenStructureGroupKeys?: string[];
  onStructureGroupKeysChange: (nextKeys: string[]) => void;
  chapterSearchQuery: string;
  onChapterSearchQueryChange: (nextValue: string) => void;
  filterMode: ChapterFilterMode;
  onFilterModeChange: (nextValue: ChapterFilterMode) => void;
  previousChapterHref: string | null;
  nextChapterHref: string | null;
  neutralHref: string;
  onNavigateToHref: (href: string) => void;
  onNavigateToUploads: () => boolean | Promise<boolean>;
  onPersistProjectSnapshot: (
    snapshot: ProjectRecord,
    options: {
      context:
        | "epub-import"
        | "volume-editor"
        | "chapter-create"
        | "chapter-reorder"
        | "chapter-delete"
        | "volume-delete"
        | "manga-import"
        | "manga-publication";
    },
  ) => Promise<ProjectRecord | null>;
  onProjectChange: (nextProject: ProjectRecord) => void;
  onSelectedStageChapterChange?: (chapter: StageChapter | null) => void;
  onOpenImportedChapter?: (nextProject: ProjectRecord, importedChapters: ProjectEpisode[]) => void;
  onChapterSaved: (
    project: ProjectRecord,
    chapter: ProjectEpisode,
    routeHint?: { number: number; volume?: number },
  ) => void;
  isVolumeDirty: boolean;
  isSavingVolumes: boolean;
  onSaveVolumes: () => void | Promise<boolean>;
  isDeletingEntity: boolean;
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
  pages: [],
  pageCount: 0,
  hasPages: false,
  publicationStatus: "draft",
  coverImageUrl: "",
  coverImageAlt: "",
};

const primaryEditorSectionClassName =
  "overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-[0_18px_54px_-42px_rgba(0,0,0,0.72)]";
const editorSectionClassName =
  "project-editor-section overflow-hidden rounded-2xl border border-border/60 bg-card/65 shadow-[0_16px_44px_-38px_rgba(0,0,0,0.68)]";
const editorAccordionTriggerClassName =
  "project-editor-section-trigger flex w-full items-start gap-4 px-5 py-3.5 text-left hover:no-underline md:py-4";
const editorSectionContentClassName = "project-editor-section-content px-5 pb-5";
const editorAccordionHeaderTextClassName = "min-w-0 flex-1 space-y-1 text-left";
const editorAccordionTitleClassName = "block text-[15px] font-semibold leading-tight md:text-base";
const editorAccordionSubtitleClassName = "block text-xs leading-5 text-muted-foreground";
const editorialMastheadClassName =
  "overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-[0_18px_52px_-42px_rgba(0,0,0,0.7)]";
const editorialCommandBarClassName =
  "sticky top-3 z-20 overflow-hidden rounded-2xl border border-border/60 bg-background/92 shadow-[0_18px_52px_-42px_rgba(0,0,0,0.72)] backdrop-blur supports-backdrop-filter:bg-background/78";
const workspaceSectionMutedClassName =
  "overflow-hidden rounded-2xl border border-border/60 bg-card/65";
const IMAGE_PUBLICATION_PAGES_REQUIRED_MESSAGE =
  "Capitulos em imagem precisam ter ao menos uma pagina para serem publicados.";
const VOLUME_REQUIRED_IDENTITY_MESSAGE =
  "Informe o volume para salvar um capítulo com número ambíguo.";
const VOLUME_REQUIRED_SAVE_DIALOG_DESCRIPTION =
  "Esse salvamento foi bloqueado porque a URL do editor ficaria ambígua. Informe o volume antes de salvar este capítulo.";

const toastIncompleteDownloadSources = () => {
  toast({
    title: "Complete as fontes de download",
    description: "Selecione uma fonte e informe a URL antes de salvar o capitulo.",
    variant: "destructive",
  });
};

const WorkspaceSectionCard = ProjectEditorSectionCard;

const buildNewChapterDraft = (
  episodes: ProjectEpisode[],
  options: { volume?: number; projectType?: string | null } = {},
) =>
  normalizeChapterForEditor({
    ...EMPTY_CHAPTER_DRAFT,
    number: resolveNextMainEpisodeNumber(
      options.volume === undefined
        ? episodes.map((episode) => ({
            ...episode,
            volume: undefined,
          }))
        : episodes,
      { volume: options.volume },
    ),
    volume: options.volume,
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
    contentFormat: isMangaType(options.projectType || "") ? "images" : "lexical",
    pages: [],
    pageCount: 0,
    hasPages: false,
    publicationStatus: "draft",
  });

const findStructureGroupElement = (groupKey: string) => {
  if (typeof document === "undefined") {
    return null;
  }
  return document.querySelector<HTMLElement>(`[data-testid="chapter-structure-group-${groupKey}"]`);
};

const ChapterEditorPane = forwardRef<ChapterEditorPaneHandle, ChapterEditorPaneProps>(
  (
    {
      project,
      activeChapter,
      activeDraft,
      onDraftChange,
      filteredChapters,
      stagedChapters,
      selectedStageChapterId,
      setStagedChapters,
      setSelectedStageChapterId,
      volumeEntriesDraft,
      selectedVolume,
      availableVolumes,
      selectedVolumeChapterCount,
      onSelectedVolumeChange,
      onAddVolume,
      onAddChapter,
      onRequestDeleteVolume,
      onRequestDeleteChapter,
      onClearSelectedVolume,
      onUpdateVolumeEntry,
      activeChapterKey,
      chapterCount,
      chapterIndex,
      structureGroups,
      initialOpenStructureGroupKeys,
      onStructureGroupKeysChange,
      chapterSearchQuery,
      onChapterSearchQueryChange,
      filterMode,
      onFilterModeChange,
      previousChapterHref,
      nextChapterHref,
      neutralHref,
      onNavigateToHref,
      onNavigateToUploads,
      onPersistProjectSnapshot,
      onProjectChange,
      onSelectedStageChapterChange,
      onOpenImportedChapter,
      onChapterSaved,
      isVolumeDirty,
      isSavingVolumes,
      onSaveVolumes,
      isDeletingEntity,
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
    const mangaWorkflowRef = useRef<MangaWorkflowPanelHandle | null>(null);
    const cancelLeaveDialogRef = useRef<(() => void) | null>(null);
    const hasPendingLeaveDialogRef = useRef(false);
    const [identityError, setIdentityError] = useState<string | null>(null);
    const [isVolumeRequiredSaveDialogOpen, setIsVolumeRequiredSaveDialogOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [libraryTarget, setLibraryTarget] = useState<"chapter-cover" | "volume-cover" | null>(
      null,
    );
    const [isSavingChapter, setIsSavingChapter] = useState(false);
    const [structureVolumeExportKey, setStructureVolumeExportKey] = useState<string | null>(null);
    const hasActiveChapter = Boolean(activeChapter && activeChapterKey);
    const normalizeEditorChapter = useCallback(
      (chapter: ProjectEpisode) => normalizeChapterForEditor(chapter, "manga"),
      [],
    );
    const buildEditorChapterSnapshot = useCallback(
      (chapter: ProjectEpisode | null) => buildChapterSnapshot(chapter, "manga"),
      [],
    );
    const draft =
      activeDraft || (activeChapter ? normalizeEditorChapter(activeChapter) : EMPTY_CHAPTER_DRAFT);
    const supportsEpubTools = isLightNovelType(project.type || "");
    const isMangaProject = isMangaType(project.type || "");
    const supportsStructureReordering = supportsStructureChapterReordering(project.type || "");
    const [structureChapterReorderState, setStructureChapterReorderState] = useState<{
      key: string;
      direction: "up" | "down";
    } | null>(null);
    const structureProjectSnapshot = useMemo(() => {
      const nextProjectSnapshot = buildProjectSnapshotWithVolumeEntries(
        project,
        volumeEntriesDraft,
      );
      return overlayDraftOnProject(nextProjectSnapshot, activeChapterKey, activeDraft);
    }, [activeChapterKey, activeDraft, project, volumeEntriesDraft]);
    const structureProjectSnapshotRef = useRef<ProjectRecord>(structureProjectSnapshot);
    useEffect(() => {
      structureProjectSnapshotRef.current = structureProjectSnapshot;
    }, [structureProjectSnapshot]);
    const normalizedDraftPages = useMemo(
      () => normalizeProjectEpisodePages(draft.pages),
      [draft.pages],
    );
    const isImageChapter =
      normalizeProjectEpisodeContentFormat(
        draft.contentFormat,
        normalizedDraftPages.length > 0 ? "images" : "lexical",
      ) === "images";
    const isPublishedImageChapterMissingPages = isImageChapter && normalizedDraftPages.length === 0;
    const projectSnapshotForImageExport = useMemo(
      () => overlayDraftOnProject(project, activeChapterKey, draft),
      [activeChapterKey, draft, project],
    );
    const activeChapterSnapshot = useMemo(
      () => buildEditorChapterSnapshot(activeChapter),
      [activeChapter, buildEditorChapterSnapshot],
    );
    const draftSnapshot = useMemo(
      () => (hasActiveChapter ? buildEditorChapterSnapshot(draft) : ""),
      [buildEditorChapterSnapshot, draft, hasActiveChapter],
    );
    const isDirty = hasActiveChapter && draftSnapshot !== activeChapterSnapshot;

    const projectImageFolders = useMemo(
      () => resolveProjectImageFolders(project.id, project.title),
      [project.id, project.title],
    );
    const chapterImageLibraryOptions = useMemo(
      () =>
        buildProjectChapterAssetLibraryOptions({
          projectFolders: projectImageFolders,
          projectId: project.id,
          episode: draft,
          index: Math.max(chapterIndex, 0),
          onRequestNavigateToUploads: onNavigateToUploads,
        }),
      [chapterIndex, draft, onNavigateToUploads, project.id, projectImageFolders],
    );
    const chapterFolder = chapterImageLibraryOptions.uploadFolder;
    const volumeImageLibraryOptions = useMemo(
      () =>
        buildProjectVolumeAssetLibraryOptions({
          projectFolders: projectImageFolders,
          projectId: project.id,
        }),
      [project.id, projectImageFolders],
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
    const showVolumeEditor = selectedVolumeNumber !== null && !hasActiveChapter;
    const selectedVolumeLabel =
      selectedVolumeNumber !== null ? buildChapterVolumeLabel(selectedVolumeNumber) : "Volumes";
    const showVolumeSaveControls = isVolumeDirty || isSavingVolumes;
    const isChapterDraft = hasActiveChapter && draft.publicationStatus === "draft";
    const chapterSaveStatusLabel = isSavingChapter
      ? "Salvando..."
      : isDirty
        ? "Alterações pendentes"
        : "Sem alterações pendentes";
    const volumeSaveStatusLabel = isSavingVolumes ? "Salvando volumes..." : "Volumes pendentes";
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

    const blockAmbiguousChapterSave = useCallback(
      (snapshot: ProjectEpisode) => {
        const normalizedSnapshot = normalizeChapterForSave(snapshot, "manga");
        if (normalizedSnapshot.volume !== undefined) {
          return false;
        }
        const nextProjectSnapshot = overlayDraftOnProject(project, activeChapterKey, normalizedSnapshot);
        const saveLookup = resolveEpisodeLookup(
          Array.isArray(nextProjectSnapshot.episodeDownloads)
            ? nextProjectSnapshot.episodeDownloads
            : [],
          normalizedSnapshot.number,
          normalizedSnapshot.volume,
        );
        if (saveLookup.ok || saveLookup.code !== "volume_required") {
          return false;
        }
        setIdentityError(VOLUME_REQUIRED_IDENTITY_MESSAGE);
        if (hasPendingLeaveDialogRef.current) {
          cancelLeaveDialogRef.current?.();
        }
        setIsVolumeRequiredSaveDialogOpen(true);
        return true;
      },
      [activeChapterKey, project],
    );

    const persistChapter = useCallback(
      async (snapshot: ProjectEpisode) => {
        if (!activeChapter) {
          return snapshot;
        }
        setIdentityError(null);
        const normalizedSnapshot = normalizeChapterForSave(snapshot, "manga");
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
                ...normalizedSnapshot,
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
          } else if (errorCode === "image_pages_required_for_publication") {
            toast({
              title: "Não foi possível publicar o capítulo",
              description: IMAGE_PUBLICATION_PAGES_REQUIRED_MESSAGE,
              variant: "destructive",
            });
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

        const normalizedSavedChapter = normalizeEditorChapter(data.chapter);
        onChapterSaved(data.project, normalizedSavedChapter, {
          number: normalizedSnapshot.number,
          volume: normalizedSnapshot.volume,
        });
        void refetchPublicBootstrapCache(apiBase).catch(() => undefined);
        return normalizedSavedChapter;
      },
      [
        activeChapter,
        apiBase,
        normalizeEditorChapter,
        onChapterSaved,
        project.id,
        project.revision,
        refetchPublicBootstrapCache,
      ],
    );

    const handleChapterSave = useCallback(
      async (nextPublicationStatus?: "draft" | "published") => {
        if (!hasActiveChapter || isSavingChapter) {
          return true;
        }
        if (findIncompleteDownloadSourceIndex(draft.sources) >= 0) {
          toastIncompleteDownloadSources();
          return false;
        }
        const resolvedPublicationStatus = nextPublicationStatus ?? draft.publicationStatus;
        if (resolvedPublicationStatus === "published" && isPublishedImageChapterMissingPages) {
          toast({
            title: "Não foi possível publicar o capítulo",
            description: IMAGE_PUBLICATION_PAGES_REQUIRED_MESSAGE,
            variant: "destructive",
          });
          return false;
        }
        const shouldPersist = isDirty || resolvedPublicationStatus !== draft.publicationStatus;
        if (!shouldPersist) {
          return true;
        }
        const nextSnapshot = {
          ...draft,
          publicationStatus: resolvedPublicationStatus,
        };
        if (blockAmbiguousChapterSave(nextSnapshot)) {
          return false;
        }
        setIsSavingChapter(true);
        try {
          await persistChapter(nextSnapshot);
          return true;
        } catch {
          return false;
        } finally {
          setIsSavingChapter(false);
        }
      },
      [
        draft,
        findIncompleteDownloadSourceIndex,
        hasActiveChapter,
        isDirty,
        isPublishedImageChapterMissingPages,
        isSavingChapter,
        blockAmbiguousChapterSave,
        persistChapter,
      ],
    );

    const handleManualSave = useCallback(async () => {
      if (!hasActiveChapter) {
        return true;
      }
      return handleChapterSave(draft.publicationStatus);
    }, [draft.publicationStatus, handleChapterSave, hasActiveChapter]);

    const {
      handleCloseSelectedVolume,
      handleLeaveDialogCancel,
      handleLeaveDialogDiscardAndContinue,
      handleLeaveDialogSaveAndContinue,
      hasUnsavedChanges,
      leaveDialogState,
      requestLeave,
    } = useChapterEditorLeaveGuard({
      hasActiveChapter,
      hasMangaWorkflowUnsavedChanges: () => Boolean(mangaWorkflowRef.current?.hasUnsavedChanges()),
      isDirty,
      isMangaProject,
      isVolumeDirty,
      neutralHref,
      onClearSelectedVolume,
      onDiscardPreparedChapters: () => {
        mangaWorkflowRef.current?.discardPreparedChapters();
      },
      onSaveChapter: handleChapterSave,
      onSavePreparedChaptersAsDraft: async () =>
        (await mangaWorkflowRef.current?.savePreparedChaptersAsDraft()) ?? true,
      onSaveVolumes,
      selectedVolumeNumber,
    });

    cancelLeaveDialogRef.current = handleLeaveDialogCancel;
    hasPendingLeaveDialogRef.current = Boolean(leaveDialogState);

    const focusChapterVolumeInput = useCallback(() => {
      if (typeof document === "undefined") {
        return;
      }
      const volumeInput = document.getElementById(
        isImageChapter ? "chapter-volume-image" : "chapter-volume-standard",
      );
      if (!(volumeInput instanceof HTMLInputElement)) {
        return;
      }
      volumeInput.focus();
      if (typeof volumeInput.select === "function") {
        volumeInput.select();
      }
    }, [isImageChapter]);

    const closeVolumeRequiredSaveDialog = useCallback(() => {
      setIsVolumeRequiredSaveDialogOpen(false);
      if (typeof window === "undefined") {
        return;
      }
      const scheduleFocus =
        typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame.bind(window)
          : (callback: FrameRequestCallback) =>
              window.setTimeout(() => callback(performance.now()), 0);
      scheduleFocus(() => {
        focusChapterVolumeInput();
      });
    }, [focusChapterVolumeInput]);

    useImperativeHandle(
      ref,
      () => ({
        hasUnsavedChanges,
        requestLeave,
      }),
      [hasUnsavedChanges, requestLeave],
    );

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
        hasActiveChapter
          ? buildProjectPublicReadingHref(project.id, draft.number, draft.volume)
          : "",
      [draft.number, draft.volume, hasActiveChapter, project.id],
    );
    const chapterTitle = hasActiveChapter
      ? String(draft.title || "").trim() || `Capítulo ${draft.number}`
      : "Nenhum capítulo aberto";
    const chapterSummaryLabel =
      hasActiveChapter && draft.entryKind === "extra" ? "Extra em edição" : "Capítulo em edição";
    const chapterPositionLabel = `${Math.max(chapterIndex + 1, 1)} de ${Math.max(chapterCount, 1)}`;
    const primaryChapterActionLabel = isChapterDraft ? "Salvar como rascunho" : "Salvar alterações";
    const secondaryChapterActionLabel = isChapterDraft ? "Publicar" : "Mover para rascunho";
    const editorialScopeDescription = supportsEpubTools
      ? "Espaço editorial para organizar capítulos, volumes e publicação de light novels com foco em leitura e escrita contínua."
      : isMangaProject
        ? "Hub editorial para revisar importações, organizar páginas, publicar capítulos e exportar mangá/webtoon na mesma rota dedicada."
        : "Espaço editorial para organizar capítulos, volumes e publicação do projeto.";
    const leaveDialogTitle = leaveDialogState?.mangaWorkflowDirty
      ? "Há alterações não salvas no workflow de mangá"
      : leaveDialogState?.chapterDirty
        ? "Há alterações não salvas"
        : "Salvar alterações do volume antes de continuar?";
    const leaveDialogDescription = leaveDialogState?.mangaWorkflowDirty
      ? leaveDialogState.chapterDirty || leaveDialogState.volumeDirty
        ? "Você pode salvar como rascunho para persistir o capítulo atual e o lote preparado antes de sair, descartar as alterações ou cancelar."
        : "Você pode salvar os capítulos preparados como rascunho, descartar o lote ou cancelar e continuar editando."
      : leaveDialogState?.chapterDirty
        ? "Escolha se deseja salvar como rascunho, publicar ou descartar antes de trocar de contexto."
        : "Você pode salvar o volume agora, descartar as mudanças ou cancelar e continuar editando.";
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
      if (!hasActiveChapter && selectedStageChapterId) {
        const pendingGroup = structureGroups.find((group) =>
          group.pendingItems.some((chapter) => chapter.id === selectedStageChapterId),
        );
        if (pendingGroup?.key) {
          return pendingGroup.key;
        }
      }
      if (selectedVolumeNumber !== null) {
        return (
          structureGroups.find((group) => group.volume === selectedVolumeNumber)?.key ||
          structureGroups[0]?.key ||
          ""
        );
      }
      return structureGroups[0]?.key || "";
    }, [
      activeChapterKey,
      hasActiveChapter,
      selectedStageChapterId,
      selectedVolumeNumber,
      structureGroups,
    ]);
    const selectedStructureGroupKey = useMemo(() => {
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
      if (!hasActiveChapter && selectedStageChapterId) {
        const pendingGroup = structureGroups.find((group) =>
          group.pendingItems.some((chapter) => chapter.id === selectedStageChapterId),
        );
        if (pendingGroup?.key) {
          return pendingGroup.key;
        }
      }
      if (selectedVolumeNumber !== null) {
        return structureGroups.find((group) => group.volume === selectedVolumeNumber)?.key || "";
      }
      return "";
    }, [
      activeChapterKey,
      hasActiveChapter,
      selectedStageChapterId,
      selectedVolumeNumber,
      structureGroups,
    ]);
    const handleStructureVolumeInteraction = useCallback(
      async (groupKey: string, nextVolume: number) => {
        const normalizedVolume = Number(nextVolume);
        if (!Number.isFinite(normalizedVolume) || normalizedVolume <= 0) {
          return;
        }

        const scrollAnchorElement = findStructureGroupElement(groupKey);
        const scrollAnchorTop = scrollAnchorElement?.getBoundingClientRect().top;
        const previousOpenGroupKeys = openStructureGroupKeysRef.current;
        const nextOpenGroupKeys = previousOpenGroupKeys.includes(groupKey)
          ? previousOpenGroupKeys.filter((key) => key !== groupKey)
          : [...previousOpenGroupKeys, groupKey];
        setOpenStructureGroupKeys(nextOpenGroupKeys);

        if (!hasActiveChapter && isVolumeDirty && selectedVolumeNumber !== normalizedVolume) {
          const canLeave = await requestLeave();
          if (!canLeave) {
            setOpenStructureGroupKeys(previousOpenGroupKeys);
            return;
          }
        }

        const didSelectVolume = await onSelectedVolumeChange(normalizedVolume, {
          preserveScrollAnchor:
            Number.isFinite(scrollAnchorTop) && typeof scrollAnchorTop === "number"
              ? { groupKey, top: scrollAnchorTop }
              : null,
        });
        if (didSelectVolume === false) {
          setOpenStructureGroupKeys(previousOpenGroupKeys);
          return;
        }
      },
      [
        hasActiveChapter,
        isVolumeDirty,
        onSelectedVolumeChange,
        requestLeave,
        selectedVolumeNumber,
      ],
    );

    const handleSelectPendingStageChapter = useCallback(
      async (chapterId: string) => {
        if (!chapterId || selectedStageChapterId === chapterId) {
          return;
        }
        if (hasActiveChapter) {
          const didNavigate = await onNavigateToHref(neutralHref);
          if (!didNavigate) {
            return;
          }
          setSelectedStageChapterId(chapterId);
          return;
        }
        if (isVolumeDirty) {
          const canLeave = await requestLeave();
          if (!canLeave) {
            return;
          }
        }
        setSelectedStageChapterId(chapterId);
      },
      [
        hasActiveChapter,
        isVolumeDirty,
        neutralHref,
        onNavigateToHref,
        requestLeave,
        selectedStageChapterId,
        setSelectedStageChapterId,
      ],
    );

    const handleAddChapterRequest = useCallback(
      async (targetVolume: number | null) => {
        const canLeave = await requestLeave();
        if (!canLeave) {
          return;
        }
        await onAddChapter(targetVolume);
      },
      [onAddChapter, requestLeave],
    );

    const handleReorderStructureChapter = useCallback(
      async (chapterKey: string, direction: "up" | "down") => {
        if (!supportsStructureReordering || structureChapterReorderState || !chapterKey) {
          return;
        }

        const canLeave = await requestLeave();
        if (!canLeave) {
          return;
        }

        const latestProjectSnapshot = structureProjectSnapshotRef.current;
        const reorderedEpisodes = reorderChaptersWithinStructureGroup(
          Array.isArray(latestProjectSnapshot?.episodeDownloads)
            ? latestProjectSnapshot.episodeDownloads
            : [],
          chapterKey,
          direction,
        );
        if (!reorderedEpisodes) {
          return;
        }

        const optimisticProject = {
          ...latestProjectSnapshot,
          episodeDownloads: reorderedEpisodes,
        };
        setStructureChapterReorderState({ key: chapterKey, direction });
        onProjectChange(optimisticProject);
        try {
          const persistedProject = await onPersistProjectSnapshot(optimisticProject, {
            context: "chapter-reorder",
          });
          if (!persistedProject) {
            onProjectChange(latestProjectSnapshot);
            return;
          }

          const persistedActiveChapter = activeChapterKey
            ? (Array.isArray(persistedProject.episodeDownloads)
                ? persistedProject.episodeDownloads
                : []
              ).find(
                (episode) => buildEpisodeKey(episode.number, episode.volume) === activeChapterKey,
              ) || null
            : null;

          if (persistedActiveChapter) {
            onChapterSaved(persistedProject, persistedActiveChapter, {
              number: persistedActiveChapter.number,
              volume: persistedActiveChapter.volume,
            });
            return;
          }

          onProjectChange(persistedProject);
        } catch {
          onProjectChange(latestProjectSnapshot);
        } finally {
          setStructureChapterReorderState(null);
        }
      },
      [
        activeChapterKey,
        onChapterSaved,
        onPersistProjectSnapshot,
        onProjectChange,
        requestLeave,
        structureChapterReorderState,
        supportsStructureReordering,
      ],
    );

    const handleStructureVolumeExport = useCallback(
      async (volume: number, groupKey: string) => {
        setStructureVolumeExportKey(groupKey);
        try {
          await exportMangaCollectionZip({
            apiBase,
            projectId: String(project.id || ""),
            projectSnapshot: projectSnapshotForImageExport,
            volume,
            includeDrafts: false,
            fallbackName: `${String(project.id || "projeto")}-volume-${volume}.zip`,
          });
          toast({
            title: `ZIP do volume ${volume} exportado`,
            intent: "success",
          });
        } catch {
          toast({ title: "Não foi possível exportar o volume", variant: "destructive" });
        } finally {
          setStructureVolumeExportKey(null);
        }
      },
      [apiBase, project.id, projectSnapshotForImageExport],
    );

    const updateDraft = useCallback(
      (recipe: (current: ProjectEpisode) => ProjectEpisode) => {
        if (!hasActiveChapter) {
          return;
        }
        onDraftChange(normalizeEditorChapter(recipe(draft)));
      },
      [draft, hasActiveChapter, normalizeEditorChapter, onDraftChange],
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

    const openStructureGroupKeysRef = useRef<string[]>([]);

    const [openStructureGroupKeys, setOpenStructureGroupKeys] = useState<string[]>(() => {
      const initialKeys = normalizeStructureGroupKeys(
        initialOpenStructureGroupKeys,
        structureGroups,
      );
      if (initialKeys.length > 0) {
        return initialKeys;
      }
      return activeStructureGroupKey ? [activeStructureGroupKey] : [];
    });
    const lastAutoSyncedStructureGroupKeyRef = useRef(activeStructureGroupKey);

    useEffect(() => {
      setOpenStructureGroupKeys((currentKeys) => {
        const fallbackGroupKey = structureGroups[0]?.key || "";
        const normalizedActiveStructureGroupKey =
          activeStructureGroupKey &&
          structureGroups.some((group) => group.key === activeStructureGroupKey)
            ? activeStructureGroupKey
            : fallbackGroupKey;
        const normalizedCurrentKeys = normalizeStructureGroupKeys(currentKeys, structureGroups);

        if (normalizedActiveStructureGroupKey !== lastAutoSyncedStructureGroupKeyRef.current) {
          lastAutoSyncedStructureGroupKeyRef.current = normalizedActiveStructureGroupKey;
          if (
            !normalizedActiveStructureGroupKey ||
            normalizedCurrentKeys.includes(normalizedActiveStructureGroupKey)
          ) {
            return normalizedCurrentKeys;
          }
          return [...normalizedCurrentKeys, normalizedActiveStructureGroupKey];
        }

        return normalizedCurrentKeys;
      });
    }, [activeStructureGroupKey, structureGroups]);

    useEffect(() => {
      onStructureGroupKeysChange(openStructureGroupKeys);
    }, [onStructureGroupKeysChange, openStructureGroupKeys]);

    useEffect(() => {
      openStructureGroupKeysRef.current = openStructureGroupKeys;
    }, [openStructureGroupKeys]);

    const toggleStructureGroup = useCallback(
      (groupKey: string) => {
        setOpenStructureGroupKeys((currentKeys) => {
          const normalizedCurrentKeys = normalizeStructureGroupKeys(currentKeys, structureGroups);
          return normalizedCurrentKeys.includes(groupKey)
            ? normalizedCurrentKeys.filter((key) => key !== groupKey)
            : [...normalizedCurrentKeys, groupKey];
        });
      },
      [structureGroups],
    );

    const epubToolsAccordion = supportsEpubTools ? (
      <Accordion
        type="single"
        collapsible
        defaultValue="epub-tools"
        className="project-editor-accordion space-y-2.5"
        data-testid="chapter-epub-tools"
      >
        <AccordionItem value="epub-tools" className={primaryEditorSectionClassName}>
          <AccordionTrigger className={editorAccordionTriggerClassName}>
            <ChapterEditorAccordionHeader
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
                  <p className="text-[11px] text-muted-foreground">
                    Frontend: {frontendBuildLabel}
                  </p>
                ) : null}
              </div>

              <div className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-foreground">Importar EPUB</h4>
                  <p className="hidden">
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
                    <span className="block font-medium text-foreground">
                      Importar como rascunho
                    </span>
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
                    onCheckedChange={(checked) => onEpubExportIncludeDraftsChange(checked === true)}
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
    ) : null;
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
            <ChapterEditorAccordionHeader
              title="Estrutura"
              subtitle="Volumes, filtros, navegação e criação de capítulos"
            />
          </AccordionTrigger>
          <AccordionContent className={editorSectionContentClassName}>
            <div className="space-y-4">
              <div className="space-y-3 rounded-[20px] border border-border/50 bg-background/45 p-3.5">
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
                <div className="space-y-3" data-testid="chapter-structure-intro-row">
                  <p
                    className="text-xs leading-5 text-muted-foreground"
                    data-testid="chapter-structure-intro-copy"
                  >
                    Selecione volumes, navegue por capítulos e organize a estrutura editorial do
                    projeto.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onAddVolume}
                    className="w-full justify-center"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Adicionar volume</span>
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5">
                {structureGroups.map((group) => {
                  const isSelected = group.key === selectedStructureGroupKey;
                  const isOpen = openStructureGroupKeys.includes(group.key);
                  const hasVisibleItems =
                    group.visiblePendingItems.length > 0 || group.visibleItems.length > 0;
                  const pendingCount = group.pendingItems.length;
                  const hasExportablePublishedVolumeChapter =
                    group.volume !== null &&
                    group.allItems.some((episode) => {
                      const episodePages = normalizeProjectEpisodePages(episode.pages || []);
                      const isImageEpisode =
                        normalizeProjectEpisodeContentFormat(
                          episode.contentFormat,
                          episodePages.length > 0 ? "images" : "lexical",
                        ) === "images";
                      return (
                        episode.publicationStatus === "published" &&
                        isImageEpisode &&
                        (episodePages.length > 0 || episode.hasPages === true)
                      );
                    });
                  const isExportingVolume = structureVolumeExportKey === group.key;
                  const emptyMessage =
                    group.chapterCount > 0 || pendingCount > 0
                      ? "Nenhum capítulo corresponde ao filtro atual neste grupo."
                      : group.volume !== null
                        ? "Nenhum capítulo vinculado a este volume ainda."
                        : "Nenhum capítulo sem volume ainda.";
                  return (
                    <section
                      key={group.key}
                      className={`overflow-hidden rounded-[20px] border bg-background/40 shadow-[0_14px_42px_-34px_rgba(0,0,0,0.74)] ${
                        isSelected ? "border-primary/45 bg-primary/[0.06]" : "border-border/50"
                      }`}
                      data-testid={`chapter-structure-group-${group.key}`}
                    >
                      <div
                        className={`space-y-3 border-b border-border/50 px-4 py-4 ${
                          isSelected ? "bg-primary/[0.04]" : ""
                        }`}
                        data-testid={`chapter-structure-group-header-${group.key}`}
                      >
                        <div className="flex items-start gap-3">
                          {group.volume !== null ? (
                            <button
                              type="button"
                              data-testid={`chapter-structure-select-${group.key}`}
                              onClick={() =>
                                void handleStructureVolumeInteraction(
                                  group.key,
                                  group.volume as number,
                                )
                              }
                              className="min-w-0 flex-1 self-stretch text-left"
                            >
                              <div
                                className="min-w-0 space-y-2"
                                data-testid={`chapter-structure-group-main-${group.key}`}
                              >
                                <div className="min-w-0 space-y-1">
                                  <p className="text-sm font-semibold tracking-tight text-foreground">
                                    {group.label}
                                  </p>
                                  <p className="text-xs leading-5 text-muted-foreground">
                                    {group.chapterCount > 0 || pendingCount > 0
                                      ? `${group.chapterCount} salvo(s)${
                                          pendingCount > 0 ? ` + ${pendingCount} em importação` : ""
                                        }`
                                      : "Nenhum capítulo vinculado"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={group.hasMetadata ? "secondary" : "outline"}>
                                    {group.hasMetadata ? "Metadados" : "Sem metadados"}
                                  </Badge>
                                  {pendingCount > 0 ? (
                                    <Badge variant="outline">Importação {pendingCount}</Badge>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleStructureGroup(group.key)}
                              className="min-w-0 flex-1 self-stretch text-left"
                              data-testid={`chapter-structure-group-main-${group.key}`}
                            >
                              <p className="text-sm font-semibold text-foreground">{group.label}</p>
                              <p className="text-xs leading-5 text-muted-foreground">
                                {group.chapterCount > 0 || pendingCount > 0
                                  ? `${group.chapterCount} salvo(s)${
                                      pendingCount > 0 ? ` + ${pendingCount} em importação` : ""
                                    }`
                                  : "Agrupe aqui capítulos fora de volume"}
                              </p>
                            </button>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            data-testid={`chapter-structure-group-toggle-${group.key}`}
                            aria-label={`Alternar ${group.label}`}
                            aria-expanded={isOpen}
                            onClick={() => toggleStructureGroup(group.key)}
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
                          className="flex gap-2"
                          data-testid={`chapter-structure-group-actions-${group.key}`}
                        >
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            data-testid={`chapter-structure-add-chapter-${group.key}`}
                            onClick={() => {
                              void handleAddChapterRequest(group.volume);
                            }}
                            className="flex-1 justify-center rounded-xl"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Adicionar capítulo</span>
                          </Button>
                          {hasExportablePublishedVolumeChapter && group.volume !== null ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              data-testid={`chapter-structure-export-volume-${group.key}`}
                              onClick={() => {
                                void handleStructureVolumeExport(group.volume as number, group.key);
                              }}
                              disabled={isExportingVolume}
                              className="shrink-0 justify-center rounded-xl px-3"
                            >
                              {isExportingVolume ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileArchive className="h-4 w-4" />
                              )}
                              <span>ZIP</span>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      {isOpen ? (
                        <div className="space-y-2.5 p-3.5">
                          {hasVisibleItems ? (
                            <>
                              {group.visiblePendingItems.map((chapter) => {
                                const isActivePending = chapter.id === selectedStageChapterId;
                                return (
                                  <button
                                    key={chapter.id}
                                    type="button"
                                    data-testid={`chapter-structure-stage-select-${chapter.id}`}
                                    onClick={() => {
                                      void handleSelectPendingStageChapter(chapter.id);
                                    }}
                                    className={`w-full rounded-[18px] border px-3.5 py-3 text-left transition ${
                                      isActivePending
                                        ? "border-primary/50 bg-primary/[0.07] shadow-sm"
                                        : "border-border/50 bg-background/55 hover:bg-background/78"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                          {chapter.operation === "update"
                                            ? "Atualizar"
                                            : "Importar"}
                                        </p>
                                        <p className="line-clamp-2 text-sm font-semibold text-foreground">
                                          {buildStageChapterLabel(chapter)}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline">Importação</Badge>
                                        <Badge
                                          variant={
                                            chapter.publicationStatus === "draft"
                                              ? "outline"
                                              : "secondary"
                                          }
                                        >
                                          {chapter.publicationStatus === "draft"
                                            ? "Rascunho"
                                            : "Publicado"}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      <span>
                                        {chapter.pages.length > 0
                                          ? `${chapter.pages.length} página(s)`
                                          : "Sem páginas"}
                                      </span>
                                      {chapter.warnings.length > 0 ? (
                                        <span>- {chapter.warnings.length} aviso(s)</span>
                                      ) : null}
                                    </div>
                                  </button>
                                );
                              })}
                              {group.visibleItems.map((episode) => {
                                const episodeKey = buildEpisodeKey(episode.number, episode.volume);
                                const href = buildDashboardProjectChapterEditorHref(
                                  project.id,
                                  episode.number,
                                  episode.volume,
                                );
                                const readingHref = buildProjectPublicReadingHref(
                                  project.id,
                                  episode.number,
                                  episode.volume,
                                );
                                const isActive = episodeKey === activeChapterKey;
                                const episodePages = normalizeProjectEpisodePages(
                                  episode.pages || [],
                                );
                                const isImageEpisode =
                                  normalizeProjectEpisodeContentFormat(
                                    episode.contentFormat,
                                    episodePages.length > 0 ? "images" : "lexical",
                                  ) === "images";
                                const groupEpisodeKeys = group.allItems.map((item) =>
                                  buildEpisodeKey(item.number, item.volume),
                                );
                                const structurePosition = groupEpisodeKeys.indexOf(episodeKey);
                                const canMoveUp =
                                  supportsStructureReordering && structurePosition > 0;
                                const canMoveDown =
                                  supportsStructureReordering &&
                                  structurePosition >= 0 &&
                                  structurePosition < groupEpisodeKeys.length - 1;
                                const hasReadableChapter =
                                  chapterHasContent(episode) ||
                                  (isImageEpisode &&
                                    (episodePages.length > 0 || episode.hasPages === true));
                                const canOpenReadingPage =
                                  episode.publicationStatus === "published" && hasReadableChapter;
                                const isReorderingEpisodeUp =
                                  structureChapterReorderState?.key === episodeKey &&
                                  structureChapterReorderState.direction === "up";
                                const isReorderingEpisodeDown =
                                  structureChapterReorderState?.key === episodeKey &&
                                  structureChapterReorderState.direction === "down";
                                const showStructureActions =
                                  supportsStructureReordering || canOpenReadingPage;
                                const handleOpenEpisode = () => void onNavigateToHref(href);
                                const handleOpenReadingPage = () => {
                                  if (typeof window === "undefined" || !canOpenReadingPage) {
                                    return;
                                  }
                                  window.open(readingHref, "_blank", "noopener,noreferrer");
                                };
                                const handleEpisodeCardKeyDown = (
                                  event: ReactKeyboardEvent<HTMLDivElement>,
                                ) => {
                                  if (event.target !== event.currentTarget) {
                                    return;
                                  }
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleOpenEpisode();
                                  }
                                };
                                return (
                                  <div
                                    key={episodeKey}
                                    data-testid={`chapter-structure-episode-open-${episodeKey}`}
                                    data-state={isActive ? "active" : "idle"}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Abrir capítulo ${episode.number}`}
                                    onClick={handleOpenEpisode}
                                    onKeyDown={handleEpisodeCardKeyDown}
                                    className={`w-full cursor-pointer rounded-[18px] border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 ${
                                      isActive
                                        ? "border-primary/50 bg-primary/[0.07] shadow-sm"
                                        : "border-border/50 bg-background/55 hover:bg-background/78"
                                    }`}
                                  >
                                    <div className="space-y-3">
                                      <div
                                        className="space-y-3"
                                        data-testid={`chapter-structure-episode-content-${episodeKey}`}
                                      >
                                        <div
                                          className="flex items-start justify-between gap-3"
                                          data-testid={`chapter-structure-episode-header-${episodeKey}`}
                                        >
                                          <div className="min-w-0 space-y-1">
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
                                            className="shrink-0 self-start"
                                          >
                                            {chapterStatusLabel(episode)}
                                          </Badge>
                                        </div>
                                      </div>
                                      <div
                                        className="flex items-end justify-between gap-3"
                                        data-testid={`chapter-structure-episode-footer-${episodeKey}`}
                                      >
                                        <div
                                          className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground"
                                          data-testid={`chapter-structure-episode-meta-${episodeKey}`}
                                        >
                                          <span>
                                            {chapterHasContent(episode)
                                              ? "Com leitura"
                                              : "Sem leitura"}
                                          </span>
                                          {episode.sources?.length ? (
                                            <span>- {episode.sources.length} fonte(s)</span>
                                          ) : null}
                                        </div>
                                        {showStructureActions ? (
                                          <div
                                            className="flex shrink-0 items-center gap-2"
                                            data-testid={`chapter-structure-episode-actions-${episodeKey}`}
                                          >
                                            {supportsStructureReordering ? (
                                              <>
                                                <Button
                                                  type="button"
                                                  size="icon"
                                                  variant="outline"
                                                  data-testid={`chapter-structure-episode-move-up-${episodeKey}`}
                                                  aria-label="Mover item para cima"
                                                  className="h-9 w-9 rounded-xl bg-background/92"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    void handleReorderStructureChapter(
                                                      episodeKey,
                                                      "up",
                                                    );
                                                  }}
                                                  disabled={
                                                    !canMoveUp ||
                                                    Boolean(structureChapterReorderState)
                                                  }
                                                >
                                                  {isReorderingEpisodeUp ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                  ) : (
                                                    <ArrowUp className="h-4 w-4" />
                                                  )}
                                                </Button>
                                                <Button
                                                  type="button"
                                                  size="icon"
                                                  variant="outline"
                                                  data-testid={`chapter-structure-episode-move-down-${episodeKey}`}
                                                  aria-label="Mover item para baixo"
                                                  className="h-9 w-9 rounded-xl bg-background/92"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    void handleReorderStructureChapter(
                                                      episodeKey,
                                                      "down",
                                                    );
                                                  }}
                                                  disabled={
                                                    !canMoveDown ||
                                                    Boolean(structureChapterReorderState)
                                                  }
                                                >
                                                  {isReorderingEpisodeDown ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                  ) : (
                                                    <ArrowDown className="h-4 w-4" />
                                                  )}
                                                </Button>
                                              </>
                                            ) : null}
                                            {canOpenReadingPage ? (
                                              <Button
                                                type="button"
                                                size="icon"
                                                variant="outline"
                                                data-testid={`chapter-structure-episode-open-icon-${episodeKey}`}
                                                aria-label={`Abrir leitura do capítulo ${episode.number} em nova aba`}
                                                className="h-9 w-9 rounded-xl bg-background/92"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleOpenReadingPage();
                                                }}
                                              >
                                                <ExternalLink className="h-4 w-4" />
                                              </Button>
                                            ) : null}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          ) : (
                            <div className="rounded-[18px] border border-dashed border-border/60 bg-background/30 px-4 py-4 text-sm text-muted-foreground">
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
    const identitySection = hasActiveChapter ? (
      <WorkspaceSectionCard
        title={supportsEpubTools && !isImageChapter ? "Dados" : "Identidade do capitulo"}
        subtitle={
          supportsEpubTools && !isImageChapter
            ? "Título, numeração, tipo, release e resumo"
            : "Título, numeração, tipo e resumo"
        }
        eyebrow="Ficha editorial"
        testId="chapter-identity-accordion"
        actions={
          <>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
              {draft.entryKind === "extra" ? "Extra" : "Capítulo"}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
              {buildChapterVolumeLabel(draft.volume)}
            </Badge>
            {supportsEpubTools && !isImageChapter ? (
              <Badge
                variant={draft.publicationStatus === "draft" ? "outline" : "default"}
                className="text-[10px] uppercase tracking-[0.12em]"
                data-testid="chapter-identity-status-badge"
              >
                {chapterStatusLabel(draft)}
              </Badge>
            ) : null}
          </>
        }
      >
        <div className="space-y-5" data-testid="chapter-identity-section" data-state="open">
          <button
            type="button"
            className="sr-only"
            data-testid="chapter-identity-trigger"
            aria-expanded="false"
          >
            Alternar identidade
          </button>
          {identityError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {identityError}
            </div>
          ) : null}

          <DashboardFieldStack>
            <Label htmlFor="chapter-title">Título</Label>
            <Input
              id="chapter-title"
              value={draft.title || ""}
              onChange={(event) =>
                updateDraft((current) => ({ ...current, title: event.target.value }))
              }
            />
          </DashboardFieldStack>

          <div
            className={cn(
              "grid gap-3 md:grid-cols-2",
              supportsEpubTools && !isImageChapter ? "xl:grid-cols-5" : "xl:grid-cols-4",
            )}
          >
            <DashboardFieldStack>
              <Label htmlFor="chapter-number">Capítulo</Label>
              <Input
                id="chapter-number"
                type="number"
                min={1}
                step={1}
                value={draft.number}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    number:
                      normalizePositiveInteger(Number(event.target.value), 1) ?? current.number,
                  }))
                }
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label htmlFor="chapter-volume">Volume</Label>
              <Input
                id="chapter-volume"
                type="number"
                min={1}
                step={1}
                value={draft.volume ?? ""}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    volume:
                      event.target.value.trim() === ""
                        ? undefined
                        : normalizePositiveInteger(Number(event.target.value)),
                  }))
                }
                placeholder="Sem volume"
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label>Tipo de entrada</Label>
              <Select
                value={draft.entryKind === "extra" ? "extra" : "main"}
                onValueChange={(value) =>
                  updateDraft((current) => {
                    const nextEntryKind = value === "extra" ? "extra" : "main";
                    return {
                      ...current,
                      entryKind: nextEntryKind,
                      entrySubtype: resolveChapterEntrySubtype(nextEntryKind),
                      displayLabel:
                        nextEntryKind === "extra" ? current.displayLabel || "Extra" : undefined,
                    };
                  })
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
            </DashboardFieldStack>
            {!isImageChapter && !supportsEpubTools ? (
              <DashboardFieldStack>
                <Label htmlFor="chapter-reading-order">Ordem de leitura</Label>
                <Input
                  id="chapter-reading-order"
                  type="number"
                  value={draft.readingOrder ?? ""}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      readingOrder:
                        event.target.value.trim() === "" ? undefined : Number(event.target.value),
                    }))
                  }
                />
              </DashboardFieldStack>
            ) : null}
            {supportsEpubTools && !isImageChapter ? (
              <DashboardFieldStack>
                <Label htmlFor="chapter-release-date">Data de release</Label>
                <Input
                  id="chapter-release-date"
                  type="date"
                  value={draft.releaseDate || ""}
                  onChange={(event) =>
                    updateDraft((current) => ({ ...current, releaseDate: event.target.value }))
                  }
                />
              </DashboardFieldStack>
            ) : null}
          </div>
          <div className="hidden">
            <Label htmlFor="chapter-title">{isImageChapter ? "Título" : "Título"}</Label>
            <Input
              id="chapter-title"
              value={draft.title || ""}
              onChange={(event) =>
                updateDraft((current) => ({ ...current, title: event.target.value }))
              }
            />
          </div>
          {draft.entryKind === "extra" ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <DashboardFieldStack>
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
              </DashboardFieldStack>
            </div>
          ) : null}

          {!isImageChapter ? (
            <DashboardFieldStack>
              <Label htmlFor="chapter-synopsis">Sinopse</Label>
              <Textarea
                id="chapter-synopsis"
                value={draft.synopsis || ""}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, synopsis: event.target.value }))
                }
                rows={5}
              />
            </DashboardFieldStack>
          ) : null}
        </div>
      </WorkspaceSectionCard>
    ) : null;
    const supportsChapterProgress =
      hasActiveChapter &&
      draft.publicationStatus === "draft" &&
      (supportsEpubTools || isMangaProject);
    const chapterProgressState = useMemo(
      () =>
        supportsChapterProgress
          ? getProjectProgressState({
              kind: "manga",
              completedStages: draft.completedStages,
            })
          : null,
      [draft.completedStages, supportsChapterProgress],
    );
    const handleToggleChapterProgressStage = useCallback(
      (stageId: string) => {
        updateDraft((current) => {
          const completedSet = new Set(
            getProjectProgressState({
              kind: "manga",
              completedStages: current.completedStages,
            }).completedStages,
          );
          if (completedSet.has(stageId)) {
            completedSet.delete(stageId);
          } else {
            completedSet.add(stageId);
          }
          return syncProjectProgress(
            {
              ...current,
              completedStages: Array.from(completedSet),
            },
            "manga",
          );
        });
      },
      [updateDraft],
    );
    const publicationSection =
      hasActiveChapter && !isImageChapter && !supportsEpubTools ? (
        <WorkspaceSectionCard
          title="Publicação"
          subtitle="Release, status atual e visibilidade do capitulo"
          eyebrow="Operacao"
          testId="chapter-publication-section"
          actions={
            <Badge
              variant={draft.publicationStatus === "draft" ? "outline" : "default"}
              className="text-[10px] uppercase tracking-[0.12em]"
            >
              {chapterStatusLabel(draft)}
            </Badge>
          }
        >
          <div className="grid gap-4">
            <DashboardFieldStack>
              <Label htmlFor="chapter-release-date">Data de release</Label>
              <Input
                id="chapter-release-date"
                type="date"
                value={draft.releaseDate || ""}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, releaseDate: event.target.value }))
                }
              />
            </DashboardFieldStack>
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">Status atual</Label>
                  <p className="text-xs text-muted-foreground">
                    Use as ações do topo para publicar este capítulo ou voltar para rascunho.
                  </p>
                </div>
                <Badge
                  variant={draft.publicationStatus === "draft" ? "outline" : "default"}
                  className="text-[10px] uppercase tracking-[0.12em]"
                >
                  {chapterStatusLabel(draft)}
                </Badge>
              </div>
            </div>
          </div>
        </WorkspaceSectionCard>
      ) : null;
    const progressSection =
      supportsChapterProgress && chapterProgressState ? (
        <WorkspaceSectionCard
          title="Em progresso"
          subtitle="Acompanhe o pipeline editorial do capítulo atual."
          eyebrow="Fluxo editorial"
          testId="chapter-progress-section"
          bodyClassName="space-y-3 py-4"
          actions={
            <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
              <span data-testid="chapter-progress-percent">{chapterProgressState.progress}%</span>
            </Badge>
          }
        >
          <div className="space-y-3">
            <div
              className="flex flex-wrap items-center gap-1.5"
              data-testid="chapter-progress-stage-track"
              role="list"
              aria-label="Resumo visual das etapas editoriais"
            >
              {chapterProgressState.stages.map((stage) => {
                const isCompleted = chapterProgressState.completedStages.includes(stage.id);
                const isCurrentStage = stage.id === chapterProgressState.currentStageId;
                return (
                  <span
                    key={stage.id}
                    role="listitem"
                    title={stage.label}
                    aria-label={`${stage.label}: ${
                      isCompleted ? "concluída" : isCurrentStage ? "atual" : "pendente"
                    }`}
                    data-testid={`chapter-progress-stage-chip-${stage.id}`}
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
              data-testid="chapter-progress-stage-list"
              id="chapter-progress-stage-list"
              role="group"
              aria-label="Etapas concluídas"
            >
              {chapterProgressState.stages.map((stage) => {
                const isCompleted = chapterProgressState.completedStages.includes(stage.id);
                const isCurrentStage = stage.id === chapterProgressState.currentStageId;
                return (
                  <label
                    key={stage.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/35 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Checkbox
                        checked={isCompleted}
                        onCheckedChange={() => handleToggleChapterProgressStage(stage.id)}
                        data-testid={`chapter-progress-toggle-${stage.id}`}
                        aria-label={stage.label}
                      />
                      <span className="truncate text-sm font-medium text-foreground">
                        {stage.label}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {isCompleted ? "Concluida" : isCurrentStage ? "Atual" : "Pendente"}
                      </span>
                      {isCurrentStage ? (
                        <Badge variant="outline" className="shrink-0">
                          Atual
                        </Badge>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </WorkspaceSectionCard>
      ) : null;
    const coverSection =
      hasActiveChapter && !isImageChapter ? (
        <WorkspaceSectionCard
          title="Capa do capítulo"
          subtitle="Biblioteca dedicada e texto alternativo"
          eyebrow="Imagem"
          testId="chapter-cover-section"
          actions={
            <Button type="button" variant="outline" size="sm" onClick={openChapterCoverLibrary}>
              <ImagePlus className="h-4 w-4" />
              <span>Biblioteca</span>
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
              <Label className="text-sm">Imagem de capa</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Usa a pasta dedicada do capitulo na biblioteca.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)]">
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
        </WorkspaceSectionCard>
      ) : null;
    const sourcesSection = hasActiveChapter ? (
      <WorkspaceSectionCard
        title="Fontes de download"
        subtitle="Links opcionais para capitulos hibridos"
        eyebrow="Distribuicao"
        testId="chapter-sources-section"
        actions={
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
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
            <Label className="text-sm">Fontes</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Opcional para capitulos com leitura e download.
            </p>
          </div>
          <div className="space-y-3">
            {(draft.sources || []).map((source, sourceIndex) => (
              <div
                key={`chapter-source-${sourceIndex}`}
                className="grid gap-2 rounded-xl border border-border/60 bg-card/70 p-3"
              >
                <DownloadSourceSelect
                  value={source.label}
                  ariaLabel={`Fonte ${sourceIndex + 1}`}
                  legacyLabels={(draft.sources || []).map((item) => item.label)}
                  onValueChange={(value) =>
                    updateDraft((current) => ({
                      ...current,
                      sources: (current.sources || []).map((item, index) =>
                        index === sourceIndex ? { ...item, label: value } : item,
                      ),
                    }))
                  }
                />
                <Input
                  value={source.url}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      sources: (current.sources || []).map((item, index) =>
                        index === sourceIndex ? { ...item, url: event.target.value } : item,
                      ),
                    }))
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
      </WorkspaceSectionCard>
    ) : null;
    const volumeEditorSection = showVolumeEditor ? (
      <WorkspaceSectionCard
        title={selectedVolumeNumber !== null ? selectedVolumeLabel : "Editor de volume"}
        subtitle={
          selectedVolumeNumber !== null
            ? "Capa, texto alternativo e sinopse do volume selecionado"
            : "Selecione um volume na coluna lateral ou crie um novo para editar seus metadados."
        }
        eyebrow="Volume"
        testId="chapter-volume-accordion"
        actions={
          selectedVolumeNumber !== null ? (
            <>
              <Badge variant="outline" className="shrink-0">
                {selectedVolumeChapterCount} capitulo(s)
              </Badge>
              <Button type="button" variant="outline" size="sm" onClick={openVolumeCoverLibrary}>
                <ImagePlus className="h-4 w-4" />
                <span>Biblioteca</span>
              </Button>
            </>
          ) : null
        }
      >
        <div data-testid="chapter-volume-editor" data-state="open">
          <button
            type="button"
            className="sr-only"
            data-testid="chapter-volume-trigger"
            aria-expanded="false"
          >
            Alternar volume
          </button>
          <div className="flex w-full items-start justify-between gap-4 text-left">
            <div className={editorAccordionHeaderTextClassName}>
              <span className={editorAccordionTitleClassName}>
                {selectedVolumeNumber !== null ? selectedVolumeLabel : "Editor de volume"}
              </span>
              <span className={editorAccordionSubtitleClassName}>
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
          {selectedVolumeNumber !== null ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border/50 bg-background/45 p-4">
                <div>
                  <Label className="text-sm">Imagem do volume</Label>
                  <p className="text-xs text-muted-foreground">
                    Usa a pasta dedicada de volumes deste projeto na biblioteca.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
              <div className="grid gap-5 rounded-[22px] border border-border/50 bg-background/35 p-4 sm:grid-cols-[128px_minmax(0,1fr)]">
                {selectedVolumeEntry?.coverImageUrl ? (
                  <img
                    src={selectedVolumeEntry.coverImageUrl}
                    alt={
                      selectedVolumeEntry.coverImageAlt ||
                      buildVolumeCoverAltFallback(selectedVolumeNumber)
                    }
                    className="h-44 w-32 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-44 w-32 items-center justify-center rounded-2xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                    Sem capa
                  </div>
                )}
                <div className="space-y-3">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Selecione a capa do volume pela biblioteca para manter a pasta dedicada
                    organizada.
                  </p>
                  <DashboardFieldStack>
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
                  </DashboardFieldStack>
                </div>
              </div>
              <DashboardFieldStack>
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
              </DashboardFieldStack>
              {selectedVolumeChapterCount === 0 ? (
                <div className="rounded-[20px] border border-dashed border-border/60 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                  Nenhum capítulo vinculado a este volume.
                </div>
              ) : null}
              <div
                className="flex items-center justify-between border-t border-border/60 pt-4"
                data-testid="chapter-volume-destructive-footer"
              >
                <p className="text-xs text-muted-foreground">
                  A exclusão remove o volume e todos os capítulos vinculados.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => onRequestDeleteVolume(selectedVolumeNumber)}
                  disabled={isDeletingEntity}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Excluir volume</span>
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="rounded-[20px] border border-dashed border-border/60 bg-background/40 px-4 py-8"
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
      </WorkspaceSectionCard>
    ) : null;
    const contentSection = hasActiveChapter ? (
      <WorkspaceSectionCard
        title="Conteúdo"
        subtitle={
          isImageChapter
            ? "Gerencie páginas, ordem de leitura e capa para capítulos em imagem."
            : "Ambiente principal de escrita para o capítulo atual, com foco em leitura, continuidade e edição longa."
        }
        eyebrow="Espaço editorial"
        testId="chapter-content-accordion"
        className="chapter-editor-content-shell min-w-0"
      >
        <div data-testid="chapter-content-section" className="space-y-4" data-state="open">
          <button
            type="button"
            className="sr-only"
            data-testid="chapter-content-trigger"
            aria-expanded="true"
          >
            Alternar conteúdo
          </button>
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                  Espaço editorial
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                  {isImageChapter ? "Imagem" : "Lexical"}
                </Badge>
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight text-foreground md:text-lg">
                  Conteúdo
                </h2>
                <p className="max-w-2xl text-xs leading-5 text-muted-foreground md:text-sm">
                  {isImageChapter
                    ? "Gerencie páginas, ordem de leitura e capa para capítulos em imagem."
                    : "Ambiente principal de escrita para o capítulo atual, com foco em leitura, continuidade e edição longa."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground lg:justify-end">
              <span>{chapterHasContent(draft) ? "Com leitura" : "Sem leitura"}</span>
              {draft.sources?.length ? <span>{draft.sources.length} fonte(s)</span> : null}
              <span>{chapterStatusLabel(draft)}</span>
            </div>
          </div>
          <div
            data-testid="chapter-content-viewport"
            data-state="open"
            className="grid grid-rows-[1fr] opacity-100"
          >
            <div
              className="space-y-4 transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
              data-testid="chapter-content-body"
              data-state="open"
              aria-hidden="false"
            >
              {isImageChapter ? (
                <MangaChapterPagesEditor
                  apiBase={apiBase}
                  projectSnapshot={projectSnapshotForImageExport}
                  chapter={draft}
                  uploadFolder={chapterFolder}
                  onChange={(nextChapter) => onDraftChange(normalizeEditorChapter(nextChapter))}
                />
              ) : (
                <>
                  <div
                    className={`chapter-editor-lexical-wrapper min-w-0 rounded-[22px] border border-border/50 bg-background/40 p-2 md:p-3 ${chapterEditorLexicalMinHeightClassName}`}
                    data-testid="chapter-lexical-wrapper"
                  >
                    <LazyLexicalEditor
                      ref={editorRef}
                      value={draft.content || ""}
                      onChange={(nextValue) =>
                        updateDraft((current) => ({
                          ...current,
                          content: nextValue,
                          contentFormat: "lexical",
                          pages: [],
                          pageCount: 0,
                          hasPages: false,
                        }))
                      }
                      placeholder="Escreva o capítulo..."
                      className="lexical-playground--modal lexical-playground--stretch lexical-playground--chapter-editor min-w-0 w-full"
                      imageLibraryOptions={chapterImageLibraryOptions}
                      autoFocus={false}
                      followCaretScroll
                      loadingFallback={
                        <LexicalEditorFallback
                          variant="chapter"
                          minHeightClassName={chapterEditorLexicalMinHeightClassName}
                          className="chapter-editor-lexical-fallback"
                          testId="chapter-lexical-fallback"
                        />
                      }
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border/50 bg-background/35 px-4 py-3 text-xs text-muted-foreground">
                    <span>
                      O conteúdo usa o snapshot atual da página para EPUB e leitura pública.
                    </span>
                    <span>Escrita contínua com layout ampliado para capítulos longos.</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </WorkspaceSectionCard>
    ) : null;
    const imageIdentitySection =
      hasActiveChapter && isImageChapter ? (
        <WorkspaceSectionCard
          title="Dados do capítulo"
          subtitle="Volume, capítulo, tipo de entrada, título e sinopse."
          eyebrow="Ficha editorial"
          testId="chapter-identity-accordion"
          actions={
            <>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                {draft.entryKind === "extra" ? "Extra" : "Capítulo"}
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                {buildChapterVolumeLabel(draft.volume)}
              </Badge>
            </>
          }
        >
          <div className="space-y-5" data-testid="chapter-identity-section" data-state="open">
            <button
              type="button"
              className="sr-only"
              data-testid="chapter-identity-trigger"
              aria-expanded="false"
            >
              Alternar identidade
            </button>
            {identityError ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {identityError}
              </div>
            ) : null}

            <DashboardFieldStack>
              <Label htmlFor="chapter-title-image">Título</Label>
              <Input
                id="chapter-title-image"
                value={draft.title || ""}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, title: event.target.value }))
                }
                className="w-full"
              />
            </DashboardFieldStack>

            <div className="flex flex-wrap gap-3" data-testid="chapter-image-compact-fields">
              <DashboardFieldStack>
                <Label htmlFor="chapter-volume-image">Volume</Label>
                <Input
                  id="chapter-volume-image"
                  type="number"
                  min={1}
                  step={1}
                  value={draft.volume ?? ""}
                  onChange={(event) => {
                    setIdentityError(null);
                    updateDraft((current) => ({
                      ...current,
                      volume:
                        event.target.value.trim() === ""
                          ? undefined
                          : normalizePositiveInteger(Number(event.target.value)),
                    }));
                  }}
                  placeholder="Sem volume"
                  className="w-full sm:w-[132px]"
                />
              </DashboardFieldStack>
              <DashboardFieldStack>
                <Label htmlFor="chapter-number-image">Capítulo</Label>
                <Input
                  id="chapter-number-image"
                  type="number"
                  min={1}
                  step={1}
                  value={draft.number}
                  onChange={(event) => {
                    setIdentityError(null);
                    updateDraft((current) => ({
                      ...current,
                      number:
                        normalizePositiveInteger(Number(event.target.value), 1) ?? current.number,
                    }));
                  }}
                  className="w-full sm:w-[132px]"
                />
              </DashboardFieldStack>
              <DashboardFieldStack className="sm:min-w-[180px]">
                <Label>Tipo de entrada</Label>
                <Select
                  value={draft.entryKind === "extra" ? "extra" : "main"}
                  onValueChange={(value) =>
                    updateDraft((current) => {
                      const nextEntryKind = value === "extra" ? "extra" : "main";
                      return {
                        ...current,
                        entryKind: nextEntryKind,
                        entrySubtype: resolveChapterEntrySubtype(nextEntryKind),
                        displayLabel:
                          nextEntryKind === "extra" ? current.displayLabel || "Extra" : undefined,
                      };
                    })
                  }
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Capítulo</SelectItem>
                    <SelectItem value="extra">Extra</SelectItem>
                  </SelectContent>
                </Select>
              </DashboardFieldStack>
            </div>

            {draft.entryKind === "extra" ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <DashboardFieldStack>
                  <Label htmlFor="chapter-display-label-image">Rótulo do extra</Label>
                  <Input
                    id="chapter-display-label-image"
                    value={draft.displayLabel || ""}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        displayLabel: event.target.value,
                      }))
                    }
                    placeholder="Ex.: Side Story"
                  />
                </DashboardFieldStack>
              </div>
            ) : null}

            <DashboardFieldStack>
              <Label htmlFor="chapter-synopsis-image">Sinopse</Label>
              <Textarea
                id="chapter-synopsis-image"
                value={draft.synopsis || ""}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, synopsis: event.target.value }))
                }
                rows={4}
              />
            </DashboardFieldStack>
          </div>
        </WorkspaceSectionCard>
      ) : null;
    const standardIdentitySection =
      hasActiveChapter && !isImageChapter ? (
        <WorkspaceSectionCard
          title="Identidade do capítulo"
          subtitle="Título, numeração, tipo e resumo"
          eyebrow="Ficha editorial"
          testId="chapter-identity-accordion"
          actions={
            <>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                {draft.entryKind === "extra" ? "Extra" : "Capítulo"}
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                {buildChapterVolumeLabel(draft.volume)}
              </Badge>
            </>
          }
        >
          <div className="space-y-5" data-testid="chapter-identity-section" data-state="open">
            <button
              type="button"
              className="sr-only"
              data-testid="chapter-identity-trigger"
              aria-expanded="false"
            >
              Alternar identidade
            </button>
            {identityError ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {identityError}
              </div>
            ) : null}

            <DashboardFieldStack>
              <Label htmlFor="chapter-title-standard">Título</Label>
              <Input
                id="chapter-title-standard"
                value={draft.title || ""}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, title: event.target.value }))
                }
                className="w-full"
              />
            </DashboardFieldStack>

            <div className="flex flex-wrap gap-3" data-testid="chapter-standard-compact-fields">
              <DashboardFieldStack>
                <Label htmlFor="chapter-number-standard">Capítulo</Label>
                <Input
                  id="chapter-number-standard"
                  type="number"
                  min={1}
                  step={1}
                  value={draft.number}
                  onChange={(event) => {
                    setIdentityError(null);
                    updateDraft((current) => ({
                      ...current,
                      number:
                        normalizePositiveInteger(Number(event.target.value), 1) ?? current.number,
                    }));
                  }}
                  className="w-full sm:w-[132px]"
                />
              </DashboardFieldStack>
              <DashboardFieldStack>
                <Label htmlFor="chapter-volume-standard">Volume</Label>
                <Input
                  id="chapter-volume-standard"
                  type="number"
                  min={1}
                  step={1}
                  value={draft.volume ?? ""}
                  onChange={(event) => {
                    setIdentityError(null);
                    updateDraft((current) => ({
                      ...current,
                      volume:
                        event.target.value.trim() === ""
                          ? undefined
                          : normalizePositiveInteger(Number(event.target.value)),
                    }));
                  }}
                  placeholder="Sem volume"
                  className="w-full sm:w-[132px]"
                />
              </DashboardFieldStack>
              <DashboardFieldStack className="sm:min-w-[180px]">
                <Label>Tipo de entrada</Label>
                <Select
                  value={draft.entryKind === "extra" ? "extra" : "main"}
                  onValueChange={(value) =>
                    updateDraft((current) => {
                      const nextEntryKind = value === "extra" ? "extra" : "main";
                      return {
                        ...current,
                        entryKind: nextEntryKind,
                        entrySubtype: resolveChapterEntrySubtype(nextEntryKind),
                        displayLabel:
                          nextEntryKind === "extra" ? current.displayLabel || "Extra" : undefined,
                      };
                    })
                  }
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Capítulo</SelectItem>
                    <SelectItem value="extra">Extra</SelectItem>
                  </SelectContent>
                </Select>
              </DashboardFieldStack>
              {!supportsEpubTools ? (
                <DashboardFieldStack>
                  <Label htmlFor="chapter-reading-order-standard">Ordem de leitura</Label>
                  <Input
                    id="chapter-reading-order-standard"
                    type="number"
                    value={draft.readingOrder ?? ""}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        readingOrder:
                          event.target.value.trim() === "" ? undefined : Number(event.target.value),
                      }))
                    }
                    className="w-full sm:w-[148px]"
                  />
                </DashboardFieldStack>
              ) : null}
            </div>

            {draft.entryKind === "extra" ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <DashboardFieldStack>
                  <Label htmlFor="chapter-display-label-standard">Rótulo do extra</Label>
                  <Input
                    id="chapter-display-label-standard"
                    value={draft.displayLabel || ""}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        displayLabel: event.target.value,
                      }))
                    }
                    placeholder="Ex.: Side Story"
                  />
                </DashboardFieldStack>
              </div>
            ) : null}

            <DashboardFieldStack>
              <Label htmlFor="chapter-synopsis-standard">Sinopse</Label>
              <Textarea
                id="chapter-synopsis-standard"
                value={draft.synopsis || ""}
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, synopsis: event.target.value }))
                }
                rows={5}
                className="w-full"
              />
            </DashboardFieldStack>
          </div>
        </WorkspaceSectionCard>
      ) : null;
    const imageContentSection =
      hasActiveChapter && isImageChapter ? (
        <WorkspaceSectionCard
          title="Páginas"
          subtitle="Upload, ordem de leitura e capa em um fluxo simples para capítulos em imagem."
          eyebrow="Leitura em imagem"
          testId="chapter-content-accordion"
          className="chapter-editor-content-shell min-w-0"
        >
          <div data-testid="chapter-content-section" className="space-y-4" data-state="open">
            <button
              type="button"
              className="sr-only"
              data-testid="chapter-content-trigger"
              aria-expanded="true"
            >
              Alternar conteúdo
            </button>
            <div
              data-testid="chapter-content-viewport"
              data-state="open"
              className="grid grid-rows-[1fr] opacity-100"
            >
              <div
                className="space-y-4 transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
                data-testid="chapter-content-body"
                data-state="open"
                aria-hidden="false"
              >
                <MangaChapterPagesEditor
                  apiBase={apiBase}
                  projectSnapshot={projectSnapshotForImageExport}
                  chapter={draft}
                  uploadFolder={chapterFolder}
                  onChange={(nextChapter) => onDraftChange(normalizeEditorChapter(nextChapter))}
                />
              </div>
            </div>
          </div>
        </WorkspaceSectionCard>
      ) : null;
    const chapterTopAsideSection = hasActiveChapter ? (
      isImageChapter ? (
        progressSection
      ) : publicationSection || progressSection ? (
        <div className="space-y-4" data-testid="chapter-workspace-aside-column">
          {publicationSection}
          {progressSection}
        </div>
      ) : null
    ) : null;
    return (
      <>
        <div className="space-y-3" data-testid="chapter-editor-header-shell">
          <section className={editorialMastheadClassName} data-testid="chapter-editor-masthead">
            <div className="grid gap-5 px-4 py-5 md:px-6 md:py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:px-8">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {hasActiveChapter ? (
                    <>
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase tracking-[0.12em]"
                      >
                        {chapterSummaryLabel}
                      </Badge>
                      <Badge
                        variant={draft.publicationStatus === "draft" ? "outline" : "default"}
                        className="text-[10px] uppercase tracking-[0.12em]"
                      >
                        {chapterStatusLabel(draft)}
                      </Badge>
                      {Number.isFinite(Number(draft.volume)) ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-[0.12em]"
                        >
                          {buildChapterVolumeLabel(draft.volume)}
                        </Badge>
                      ) : null}
                    </>
                  ) : selectedVolumeNumber !== null ? (
                    <>
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase tracking-[0.12em]"
                      >
                        Volume em edição
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                        {selectedVolumeLabel}
                      </Badge>
                    </>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem]">
                    Gerenciamento de Conteúdo
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    {editorialScopeDescription}
                  </p>
                </div>
              </div>

              <div className="rounded-[22px] border border-border/50 bg-background/45 p-4 text-left shadow-[0_16px_50px_-40px_rgba(0,0,0,0.8)] lg:text-right">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Projeto
                </p>
                <p className="mt-1 text-base font-semibold tracking-tight text-foreground">
                  {project.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {hasActiveChapter
                    ? `${chapterTitle} ? ${chapterPositionLabel}`
                    : selectedVolumeNumber !== null
                      ? `${selectedVolumeLabel} · ${selectedVolumeChapterCount} capítulo(s)`
                      : `${chapterCount} capítulo(s) disponível(is)`}
                </p>
              </div>
            </div>
          </section>

          <div className={editorialCommandBarClassName} data-testid="chapter-editor-command-bar">
            <div className="space-y-3 px-4 py-3 md:px-6 lg:px-8">
              <div
                className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                data-testid="chapter-editor-action-rail"
              >
                <div
                  className="flex flex-wrap items-center gap-2"
                  data-testid="chapter-editor-top-status-group"
                >
                  {hasActiveChapter ? (
                    <Badge
                      variant={isDirty ? "outline" : "secondary"}
                      className="text-[10px] uppercase tracking-[0.12em]"
                    >
                      {chapterSaveStatusLabel}
                    </Badge>
                  ) : selectedVolumeNumber !== null ? (
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                      {selectedVolumeLabel} selecionado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                      Sem alterações pendentes
                    </Badge>
                  )}
                  {showVolumeSaveControls ? (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                      {volumeSaveStatusLabel}
                    </Badge>
                  ) : null}
                </div>
                <div
                  className="flex flex-wrap items-center gap-2 lg:justify-end"
                  data-testid="chapter-editor-top-actions"
                >
                  {hasActiveChapter ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant={isChapterDraft ? "outline" : "default"}
                        onClick={() => {
                          void handleManualSave();
                        }}
                        disabled={isSavingChapter || !isDirty}
                        className="gap-2"
                      >
                        {isSavingChapter ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {primaryChapterActionLabel}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={isChapterDraft ? "default" : "outline"}
                        onClick={() => {
                          void handleChapterSave(isChapterDraft ? "published" : "draft");
                        }}
                        disabled={isSavingChapter}
                        className="gap-2"
                      >
                        {secondaryChapterActionLabel}
                      </Button>
                    </>
                  ) : null}
                  {showVolumeSaveControls ? (
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
                  ) : null}
                  {hasActiveChapter ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={onRequestDeleteChapter}
                      disabled={isDeletingEntity}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir capítulo
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/50 pt-3 lg:flex-row lg:items-center lg:justify-between">
                <div
                  className="project-editor-status-bar flex flex-wrap items-center gap-2"
                  data-testid="chapter-editor-status-bar"
                >
                  {hasActiveChapter ? (
                    <>
                      <div
                        className="project-editor-status-bar__meta-group"
                        data-testid="chapter-editor-status-meta-group"
                      >
                        <span
                          className="project-editor-status-bar__pill project-editor-status-bar__pill--position"
                          data-testid="chapter-editor-status-position-badge"
                        >
                          {chapterPositionLabel}
                        </span>
                        <span
                          className="project-editor-status-bar__pill project-editor-status-bar__pill--chapter"
                          data-testid="chapter-editor-status-pill-chapter"
                        >
                          Capítulo {draft.number}
                        </span>
                        <span
                          className="project-editor-status-bar__pill project-editor-status-bar__pill--reading"
                          data-testid="chapter-editor-status-pill-reading"
                        >
                          {chapterHasContent(draft) ? "Com leitura" : "Sem leitura"}
                        </span>
                      </div>
                      {draft.sources?.length ? (
                        <span className="text-[11px] text-muted-foreground">
                          {draft.sources.length} fonte(s)
                        </span>
                      ) : null}
                    </>
                  ) : selectedVolumeNumber !== null ? (
                    <>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                        {selectedVolumeLabel}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {selectedVolumeChapterCount > 0
                          ? `${selectedVolumeChapterCount} capítulo(s) vinculado(s)`
                          : "Nenhum capítulo vinculado"}
                      </span>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                        Nenhum capítulo aberto
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        Escolha um capítulo na sidebar, edite um volume na coluna principal ou use
                        as ferramentas EPUB logo abaixo.
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigateToHref(neutralHref)}
                      >
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
                  ) : selectedVolumeNumber !== null ? (
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="chapter-close-volume-button"
                      onClick={() => {
                        void handleCloseSelectedVolume();
                      }}
                    >
                      <span>Fechar volume</span>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="project-editor-layout mx-auto grid w-full gap-5 pb-8 pt-4 md:pb-10 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start"
          data-testid="chapter-editor-upper-layout"
        >
          <div className="min-w-0 w-full" data-testid="chapter-editor-main-column">
            <div className="space-y-4" data-testid="chapter-editor-workspace">
              {hasActiveChapter ? (
                <>
                  <div
                    className={cn(
                      "grid gap-4",
                      chapterTopAsideSection
                        ? "xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
                        : "xl:grid-cols-1",
                    )}
                    data-testid="chapter-workspace-top-row"
                  >
                    {isImageChapter ? imageIdentitySection : standardIdentitySection}
                    {chapterTopAsideSection}
                  </div>
                  {isImageChapter ? imageContentSection : contentSection}
                  {!isImageChapter ? (
                    <div
                      className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]"
                      data-testid="chapter-workspace-support-row"
                    >
                      {coverSection}
                      {sourcesSection}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  {volumeEditorSection}
                  {isMangaProject ? (
                    <MangaWorkflowPanel
                      ref={mangaWorkflowRef}
                      apiBase={apiBase}
                      project={project}
                      projectSnapshot={projectSnapshotForImageExport}
                      selectedVolume={selectedVolumeNumber}
                      filterMode={filterMode}
                      filteredChapters={filteredChapters}
                      stagedChapters={stagedChapters}
                      setStagedChapters={setStagedChapters}
                      selectedStageChapterId={selectedStageChapterId}
                      setSelectedStageChapterId={setSelectedStageChapterId}
                      onPersistProjectSnapshot={onPersistProjectSnapshot}
                      onProjectChange={onProjectChange}
                      onSelectedStageChapterChange={onSelectedStageChapterChange}
                      onOpenImportedChapter={onOpenImportedChapter}
                      onNavigateToChapter={(chapter) =>
                        onNavigateToHref(
                          buildDashboardProjectChapterEditorHref(
                            project.id,
                            chapter.number,
                            chapter.volume,
                          ),
                        )
                      }
                    />
                  ) : null}
                  {epubToolsAccordion}
                </>
              )}
            </div>
            {null}
            {false ? (
              <Accordion
                key={`identity-${activeChapterKey ?? "none"}`}
                type="multiple"
                defaultValue={[]}
                className="project-editor-accordion space-y-2.5"
                data-testid="chapter-identity-accordion"
              >
                <AccordionItem
                  value="identity"
                  className={editorSectionClassName}
                  data-testid="chapter-identity-section"
                >
                  <AccordionTrigger
                    className={editorAccordionTriggerClassName}
                    data-testid="chapter-identity-trigger"
                  >
                    <ChapterEditorAccordionHeader
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
                          <Label htmlFor="chapter-number">Capítulo</Label>
                          <Input
                            id="chapter-number"
                            type="number"
                            min={1}
                            step={1}
                            value={draft.number}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                number:
                                  normalizePositiveInteger(Number(event.target.value), 1) ??
                                  current.number,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chapter-volume">Volume</Label>
                          <Input
                            id="chapter-volume"
                            type="number"
                            min={1}
                            step={1}
                            value={draft.volume ?? ""}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                volume:
                                  event.target.value.trim() === ""
                                    ? undefined
                                    : normalizePositiveInteger(Number(event.target.value)),
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
                              updateDraft((current) => {
                                const nextEntryKind = value === "extra" ? "extra" : "main";
                                return {
                                  ...current,
                                  entryKind: nextEntryKind,
                                  entrySubtype: resolveChapterEntrySubtype(nextEntryKind),
                                  displayLabel:
                                    nextEntryKind === "extra"
                                      ? current.displayLabel || "Extra"
                                      : undefined,
                                };
                              })
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
                        {!supportsEpubTools ? (
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
                        ) : null}
                      </div>
                      {draft.entryKind === "extra" ? (
                        <div className="grid gap-3 lg:grid-cols-2">
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
                        </div>
                      ) : null}

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
            {null}
            {false ? (
              <MangaWorkflowPanel
                ref={mangaWorkflowRef}
                apiBase={apiBase}
                project={project}
                projectSnapshot={projectSnapshotForImageExport}
                selectedVolume={selectedVolumeNumber}
                filterMode={filterMode}
                filteredChapters={filteredChapters}
                stagedChapters={stagedChapters}
                setStagedChapters={setStagedChapters}
                selectedStageChapterId={selectedStageChapterId}
                setSelectedStageChapterId={setSelectedStageChapterId}
                onPersistProjectSnapshot={onPersistProjectSnapshot}
                onProjectChange={onProjectChange}
                onSelectedStageChapterChange={onSelectedStageChapterChange}
                onOpenImportedChapter={onOpenImportedChapter}
                onNavigateToChapter={(chapter) =>
                  onNavigateToHref(
                    buildDashboardProjectChapterEditorHref(
                      project.id,
                      chapter.number,
                      chapter.volume,
                    ),
                  )
                }
              />
            ) : null}
            {false ? (
              <Accordion
                type="multiple"
                defaultValue={["identity"]}
                className="project-editor-accordion space-y-2.5"
                data-testid="chapter-identity-accordion"
              >
                <AccordionItem
                  value="identity"
                  className={editorSectionClassName}
                  data-testid="chapter-identity-section"
                >
                  <AccordionTrigger
                    className={editorAccordionTriggerClassName}
                    data-testid="chapter-identity-trigger"
                  >
                    <ChapterEditorAccordionHeader
                      title={isImageChapter ? "Dados do capítulo" : "Identidade do capítulo"}
                      subtitle={
                        isImageChapter
                          ? "Volume, capítulo, tipo de entrada e título."
                          : "Título, numeração, tipo e resumo"
                      }
                    />
                  </AccordionTrigger>
                  <AccordionContent className={editorSectionContentClassName}>
                    <div className="space-y-5">
                      {identityError ? (
                        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          {identityError}
                        </div>
                      ) : null}

                      <div
                        className={cn(
                          "grid gap-3",
                          isImageChapter ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4",
                        )}
                      >
                        <div className="space-y-2">
                          <Label htmlFor="chapter-number">Capítulo</Label>
                          <Input
                            id="chapter-number"
                            type="number"
                            min={1}
                            step={1}
                            value={draft.number}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                number:
                                  normalizePositiveInteger(Number(event.target.value), 1) ??
                                  current.number,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chapter-volume">Volume</Label>
                          <Input
                            id="chapter-volume"
                            type="number"
                            min={1}
                            step={1}
                            value={draft.volume ?? ""}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                volume:
                                  event.target.value.trim() === ""
                                    ? undefined
                                    : normalizePositiveInteger(Number(event.target.value)),
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
                              updateDraft((current) => {
                                const nextEntryKind = value === "extra" ? "extra" : "main";
                                return {
                                  ...current,
                                  entryKind: nextEntryKind,
                                  entrySubtype: resolveChapterEntrySubtype(nextEntryKind),
                                  displayLabel:
                                    nextEntryKind === "extra"
                                      ? current.displayLabel || "Extra"
                                      : undefined,
                                };
                              })
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
                        {!supportsEpubTools ? (
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
                        ) : null}
                      </div>
                      {draft.entryKind === "extra" ? (
                        <div className="grid gap-3 lg:grid-cols-2">
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
                        </div>
                      ) : null}

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
            {null}
            {null}
          </div>

          <aside className="min-w-0 xl:sticky xl:top-24" data-testid="chapter-editor-sidebar">
            {false ? (
              <Accordion
                type="multiple"
                defaultValue={["publication", "cover", "sources"]}
                className="project-editor-accordion space-y-2.5"
                data-testid="chapter-metadata-accordion"
              >
                <AccordionItem value="publication" className={editorSectionClassName}>
                  <AccordionTrigger className={editorAccordionTriggerClassName}>
                    <ChapterEditorAccordionHeader
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
                            updateDraft((current) => ({
                              ...current,
                              releaseDate: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <Label className="text-sm">Status atual</Label>
                            <p className="text-xs text-muted-foreground">
                              Use as ações do topo para publicar este capítulo ou voltar para
                              rascunho.
                            </p>
                          </div>
                          <Badge
                            variant={draft.publicationStatus === "draft" ? "outline" : "default"}
                            className="text-[10px] uppercase tracking-[0.12em]"
                          >
                            {chapterStatusLabel(draft)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="cover" className={editorSectionClassName}>
                  <AccordionTrigger className={editorAccordionTriggerClassName}>
                    <ChapterEditorAccordionHeader
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
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={openChapterCoverLibrary}
                        >
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
                    <ChapterEditorAccordionHeader
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
                            <DownloadSourceSelect
                              value={source.label}
                              ariaLabel={`Fonte ${sourceIndex + 1}`}
                              legacyLabels={(draft.sources || []).map((item) => item.label)}
                              onValueChange={(value) =>
                                updateDraft((current) => ({
                                  ...current,
                                  sources: (current.sources || []).map((item, index) =>
                                    index === sourceIndex
                                      ? { ...item, label: value }
                                      : item,
                                  ),
                                }))
                              }
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
                              disabled={!String(source.label || "").trim()}
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
        </div>

        <Dialog
          open={Boolean(leaveDialogState)}
          onOpenChange={(open) => {
            if (!open) {
              handleLeaveDialogCancel();
            }
          }}
        >
          <DialogContent className="max-w-lg" data-testid="chapter-unsaved-leave-dialog">
            <DialogHeader>
              <>
                <DialogTitle>{leaveDialogTitle}</DialogTitle>
                <DialogDescription>{leaveDialogDescription}</DialogDescription>
              </>
              <div className="hidden">
                {leaveDialogState?.chapterDirty
                  ? "Há alterações não salvas"
                  : "Salvar alterações do volume antes de continuar?"}
              </div>
              <div className="hidden">
                {leaveDialogState?.chapterDirty
                  ? "Escolha se deseja salvar como rascunho, publicar ou descartar antes de trocar de contexto."
                  : "Você pode salvar o volume agora, descartar as mudanças ou cancelar e continuar editando."}
              </div>
            </DialogHeader>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button type="button" variant="ghost" onClick={handleLeaveDialogCancel}>
                Cancelar
              </Button>
              <Button type="button" variant="outline" onClick={handleLeaveDialogDiscardAndContinue}>
                Descartar e continuar
              </Button>
              {leaveDialogState?.chapterDirty && !leaveDialogState?.mangaWorkflowDirty ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void handleLeaveDialogSaveAndContinue("draft");
                    }}
                  >
                    Salvar como rascunho e continuar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      void handleLeaveDialogSaveAndContinue("published");
                    }}
                  >
                    Publicar e continuar
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant={
                    leaveDialogState?.mangaWorkflowDirty || leaveDialogState?.chapterDirty
                      ? "outline"
                      : "default"
                  }
                  onClick={() => {
                    void handleLeaveDialogSaveAndContinue("draft");
                  }}
                >
                  {leaveDialogState?.mangaWorkflowDirty || leaveDialogState?.chapterDirty
                    ? "Salvar como rascunho e continuar"
                    : "Salvar volume e continuar"}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isVolumeRequiredSaveDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeVolumeRequiredSaveDialog();
            }
          }}
        >
          <DialogContent className="max-w-md" data-testid="chapter-save-volume-required-dialog">
            <DialogHeader>
              <DialogTitle>Volume obrigatório</DialogTitle>
              <DialogDescription>{VOLUME_REQUIRED_SAVE_DIALOG_DESCRIPTION}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end">
              <Button type="button" onClick={closeVolumeRequiredSaveDialog}>
                Entendi
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {libraryTarget ? (
          <LazyImageLibraryDialog
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
            description={
              libraryTarget === "volume-cover"
                ? "Selecione uma capa para o volume."
                : "Selecione uma capa para o capítulo."
            }
            allowDeselect
            mode="single"
            onRequestNavigateToUploads={onNavigateToUploads}
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
        ) : null}
      </>
    );
  },
);

ChapterEditorPane.displayName = "ChapterEditorPane";

export default ChapterEditorPane;
