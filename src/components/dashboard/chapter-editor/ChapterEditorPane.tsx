import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import DashboardDedicatedEditorHeader from "@/components/dashboard/DashboardDedicatedEditorHeader";
import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import ChapterEditorDialogs from "@/components/dashboard/chapter-editor/ChapterEditorDialogs";
import ChapterEditorEpubToolsSection from "@/components/dashboard/chapter-editor/ChapterEditorEpubToolsSection";
import ChapterEditorIdentitySection from "@/components/dashboard/chapter-editor/ChapterEditorIdentitySection";
import ChapterEditorProgressSection from "@/components/dashboard/chapter-editor/ChapterEditorProgressSection";
import ChapterEditorPublicationSection from "@/components/dashboard/chapter-editor/ChapterEditorPublicationSection";
import ChapterEditorStructureSection from "@/components/dashboard/chapter-editor/ChapterEditorStructureSection";
import type {
  ChapterEditorPaneHandle,
  ChapterStructureGroup,
  ProjectRecord,
  VolumeSelectionOptions,
} from "@/components/dashboard/chapter-editor/chapter-editor-types";
import { useChapterEditorImageLibrary } from "@/components/dashboard/chapter-editor/useChapterEditorImageLibrary";
import { useChapterEditorLeaveGuard } from "@/components/dashboard/chapter-editor/useChapterEditorLeaveGuard";
import { useChapterEditorPersistence } from "@/components/dashboard/chapter-editor/useChapterEditorPersistence";
import { useChapterEditorStructureOrchestration } from "@/components/dashboard/chapter-editor/useChapterEditorStructureOrchestration";
import { Input, Textarea } from "@/components/dashboard/dashboard-form-controls";
import {
  type DedicatedEditorSidebarHeightStyle,
  dedicatedEditorSidebarStickyClassName,
  useDedicatedEditorSidebarHeight,
} from "@/components/dashboard/dedicated-editor-sidebar";
import type { LexicalEditorHandle } from "@/components/lexical/LexicalEditor";
import LexicalEditorSurface from "@/components/lexical/LexicalEditorSurface";
import DownloadSourcesEditor from "@/components/dashboard/project-editor/DownloadSourcesEditor";
import MangaChapterPagesEditor from "@/components/project-reader/MangaChapterPagesEditor";
import MangaWorkflowPanel, {
  type MangaWorkflowPanelHandle,
  type StageChapter,
} from "@/components/project-reader/MangaWorkflowPanel";
import ProjectEditorSectionCard from "@/components/project-reader/ProjectEditorSectionCard";
import AsyncState from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { ProjectEpisode, ProjectVolumeEntry } from "@/data/projects";
import { getApiBase } from "@/lib/api-base";
import {
  buildChapterSnapshot,
  buildChapterVolumeLabel,
  buildProjectSnapshotWithVolumeEntries,
  buildVolumeCoverAltFallback,
  type ChapterFilterMode,
  chapterHasContent,
  chapterStatusLabel,
  type EditableVolumeOption,
  EMPTY_CHAPTER_DRAFT,
  findProjectVolumeEntryByVolume,
  normalizeChapterForEditor,
  supportsStructureChapterReordering,
  VOLUME_REQUIRED_SAVE_DIALOG_DESCRIPTION,
} from "@/lib/dashboard-project-chapter";
import { DEFAULT_PROJECT_COVER_ALT } from "@/lib/image-alt";
import {
  buildDashboardProjectChapterEditorHref,
  buildDashboardProjectEditorHref,
  buildProjectPublicHref,
  buildProjectPublicReadingHref,
} from "@/lib/project-editor-routes";
import { overlayDraftOnProject } from "@/lib/project-epub";
import { getProjectProgressState, syncProjectProgress } from "@/lib/project-progress";
import { isLightNovelType, isMangaType } from "@/lib/project-utils";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import type { CSSProperties, ChangeEvent, Dispatch, RefObject, SetStateAction } from "react";
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
import { Link } from "react-router-dom";
import {
  normalizeProjectEpisodeContentFormat,
  normalizeProjectEpisodePages,
} from "../../../../shared/project-reader.js";

const chapterEditorLexicalMinHeightClassName = "min-h-[420px] lg:min-h-[620px]";
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
  onNavigateToHref: (href: string) => void | Promise<boolean>;
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
const editorAccordionHeaderTextClassName = "min-w-0 flex-1 space-y-1 text-left";
const editorAccordionTitleClassName = "block text-[15px] font-semibold leading-tight md:text-base";
const editorAccordionSubtitleClassName = "block text-xs leading-5 text-muted-foreground";
const WorkspaceSectionCard = ProjectEditorSectionCard;
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
    const mainColumnRef = useRef<HTMLDivElement | null>(null);
    const [chapterEditorToolbarStickyTop, setChapterEditorToolbarStickyTop] = useState(0);
    const cancelLeaveDialogRef = useRef<(() => void) | null>(null);
    const hasPendingLeaveDialogRef = useRef(false);
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
    const structureProjectSnapshot = useMemo(() => {
      const nextProjectSnapshot = buildProjectSnapshotWithVolumeEntries(
        project,
        volumeEntriesDraft,
      );
      return overlayDraftOnProject(nextProjectSnapshot, activeChapterKey, activeDraft);
    }, [activeChapterKey, activeDraft, project, volumeEntriesDraft]);
    const normalizedDraftPages = useMemo(
      () => normalizeProjectEpisodePages(draft.pages),
      [draft.pages],
    );
    const isImageChapter =
      normalizeProjectEpisodeContentFormat(
        draft.contentFormat,
        normalizedDraftPages.length > 0 ? "images" : "lexical",
      ) === "images";
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
    const selectedVolumeEntry = useMemo(() => {
      return findProjectVolumeEntryByVolume(volumeEntriesDraft, selectedVolume);
    }, [selectedVolume, volumeEntriesDraft]);
    const selectedVolumeNumber =
      selectedVolume !== null && Number.isFinite(Number(selectedVolume))
        ? Number(selectedVolume)
        : null;
    const {
      clearIdentityError,
      closeVolumeRequiredSaveDialog,
      handleChapterSave,
      handleManualSave,
      identityError,
      isSavingChapter,
      isVolumeRequiredSaveDialogOpen,
    } = useChapterEditorPersistence({
      activeChapter,
      activeChapterKey,
      apiBase,
      draft,
      hasActiveChapter,
      isDirty,
      isImageChapter,
      normalizeEditorChapter,
      onChapterSaved,
      onVolumeRequiredConflict: () => {
        if (hasPendingLeaveDialogRef.current) {
          cancelLeaveDialogRef.current?.();
        }
      },
      project,
    });
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
    const {
      handleAddChapterRequest,
      handleReorderStructureChapter,
      handleSelectPendingStageChapter,
      handleStructureVolumeExport,
      handleStructureVolumeInteraction,
      openStructureGroupKeys,
      selectedStructureGroupKey,
      structureChapterReorderState,
      structureVolumeExportKey,
      toggleStructureGroup,
    } = useChapterEditorStructureOrchestration({
      activeChapterKey,
      apiBase,
      hasActiveChapter,
      initialOpenStructureGroupKeys,
      isVolumeDirty,
      neutralHref,
      onAddChapter,
      onChapterSaved,
      onNavigateToHref,
      onPersistProjectSnapshot,
      onProjectChange,
      onSelectedVolumeChange,
      onStructureGroupKeysChange,
      project,
      projectSnapshotForImageExport,
      requestLeave,
      selectedStageChapterId,
      selectedVolumeNumber,
      setSelectedStageChapterId,
      structureGroups,
      structureProjectSnapshot,
      supportsStructureReordering,
    });
    const showVolumeEditor = selectedVolumeNumber !== null && !hasActiveChapter;
    const measuredSidebarHeight = useDedicatedEditorSidebarHeight(
      mainColumnRef,
      activeChapterKey || selectedVolumeNumber || "neutral",
    );
    const chapterEditorLexicalWrapperStyle = useMemo(
      () =>
        ({
          "--chapter-editor-toolbar-sticky-top": `${chapterEditorToolbarStickyTop}px`,
        }) as CSSProperties,
      [chapterEditorToolbarStickyTop],
    );
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
    useImperativeHandle(ref, () => ({ hasUnsavedChanges, requestLeave }), [
      hasUnsavedChanges,
      requestLeave,
    ]);
    useLayoutEffect(() => {
      const dashboardHeader = document.querySelector<HTMLElement>(
        "#dashboard-main-content > header",
      );
      if (!dashboardHeader) {
        setChapterEditorToolbarStickyTop(0);
        return;
      }

      const updateStickyTop = () => {
        const nextTop = Math.max(0, Math.ceil(dashboardHeader.getBoundingClientRect().bottom));
        setChapterEditorToolbarStickyTop((prev) => (prev === nextTop ? prev : nextTop));
      };

      updateStickyTop();
      window.addEventListener("resize", updateStickyTop);

      if (typeof ResizeObserver === "undefined") {
        return () => {
          window.removeEventListener("resize", updateStickyTop);
        };
      }

      const observer = new ResizeObserver(() => {
        updateStickyTop();
      });
      observer.observe(dashboardHeader);

      return () => {
        observer.disconnect();
        window.removeEventListener("resize", updateStickyTop);
      };
    }, []);
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
    const publicProjectHref = useMemo(() => buildProjectPublicHref(project.id), [project.id]);
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
    const {
      chapterFolder,
      chapterImageLibraryOptions,
      libraryDialogProps,
      openChapterCoverLibrary,
      openVolumeCoverLibrary,
    } = useChapterEditorImageLibrary({
      apiBase,
      chapterIndex,
      draft,
      onNavigateToUploads,
      projectId: project.id,
      projectTitle: project.title,
      selectedVolumeEntry,
      selectedVolumeNumber,
      updateDraft,
      updateSelectedVolumeEntry,
    });
    const epubToolsAccordion = (
      <ChapterEditorEpubToolsSection
        supportsEpubTools={supportsEpubTools}
        epubCapabilityState={epubCapabilityState}
        backendBuildLabel={backendBuildLabel}
        frontendBuildLabel={frontendBuildLabel}
        backendSupportsEpubImport={backendSupportsEpubImport}
        backendSupportsEpubExport={backendSupportsEpubExport}
        epubImportInputRef={epubImportInputRef}
        epubImportFile={epubImportFile}
        epubImportTargetVolume={epubImportTargetVolume}
        onEpubImportTargetVolumeChange={onEpubImportTargetVolumeChange}
        epubImportAsDraft={epubImportAsDraft}
        onEpubImportAsDraftChange={onEpubImportAsDraftChange}
        isImportingEpub={isImportingEpub}
        onOpenEpubPicker={onOpenEpubPicker}
        onEpubImportFileChange={onEpubImportFileChange}
        onEpubImportFileCancel={onEpubImportFileCancel}
        onImportEpub={onImportEpub}
        epubExportVolume={epubExportVolume}
        onEpubExportVolumeChange={onEpubExportVolumeChange}
        epubExportIncludeDrafts={epubExportIncludeDrafts}
        onEpubExportIncludeDraftsChange={onEpubExportIncludeDraftsChange}
        isExportingEpub={isExportingEpub}
        onExportEpub={onExportEpub}
      />
    );
    const structureAccordion = (
      <ChapterEditorStructureSection
        projectId={project.id}
        activeChapterKey={activeChapterKey}
        selectedStageChapterId={selectedStageChapterId}
        selectedStructureGroupKey={selectedStructureGroupKey}
        structureGroups={structureGroups}
        openStructureGroupKeys={openStructureGroupKeys}
        chapterSearchQuery={chapterSearchQuery}
        onChapterSearchQueryChange={onChapterSearchQueryChange}
        filterMode={filterMode}
        onFilterModeChange={onFilterModeChange}
        onAddVolume={onAddVolume}
        onAddChapter={handleAddChapterRequest}
        onSelectPendingStageChapter={handleSelectPendingStageChapter}
        onStructureVolumeInteraction={handleStructureVolumeInteraction}
        onStructureVolumeExport={handleStructureVolumeExport}
        onNavigateToHref={onNavigateToHref}
        onReorderStructureChapter={handleReorderStructureChapter}
        supportsStructureReordering={supportsStructureReordering}
        structureChapterReorderState={structureChapterReorderState}
        structureVolumeExportKey={structureVolumeExportKey}
        onToggleGroup={toggleStructureGroup}
      />
    );
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
            { ...current, completedStages: Array.from(completedSet) },
            "manga",
          );
        });
      },
      [updateDraft],
    );
    const publicationSection =
      hasActiveChapter && !isImageChapter && !supportsEpubTools ? (
        <ChapterEditorPublicationSection
          draft={draft}
          onReleaseDateChange={(nextValue) =>
            updateDraft((current) => ({
              ...current,
              releaseDate: nextValue,
            }))
          }
        />
      ) : null;
    const progressSection =
      supportsChapterProgress && chapterProgressState ? (
        <ChapterEditorProgressSection
          chapterProgressState={chapterProgressState}
          onToggleStage={handleToggleChapterProgressStage}
        />
      ) : null;
    const coverSection =
      hasActiveChapter && !isImageChapter ? (
        <WorkspaceSectionCard
          title="Capa do capítulo"
          subtitle="Biblioteca dedicada e texto alternativo"
          eyebrow="Imagem"
          testId="chapter-cover-section"
          actions={
            <DashboardActionButton type="button" size="sm" onClick={openChapterCoverLibrary}>
              {" "}
              <ImagePlus className="h-4 w-4" /> <span>Biblioteca</span>{" "}
            </DashboardActionButton>
          }
        >
          {" "}
          <div className="space-y-4">
            {" "}
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
              {" "}
              <Label className="text-sm">Imagem de capa</Label>{" "}
              <p className="mt-1 text-xs text-muted-foreground">
                {" "}
                Usa a pasta dedicada do capítulo na biblioteca.{" "}
              </p>{" "}
            </div>{" "}
            <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)]">
              {" "}
              {draft.coverImageUrl ? (
                <img
                  src={draft.coverImageUrl}
                  alt={draft.coverImageAlt || DEFAULT_PROJECT_COVER_ALT}
                  className="h-40 w-28 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-40 w-28 items-center justify-center rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                  {" "}
                  Sem capa{" "}
                </div>
              )}{" "}
              <div className="space-y-3">
                {" "}
                <Input
                  value={draft.coverImageUrl || ""}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      coverImageUrl: event.target.value,
                    }))
                  }
                  placeholder="URL da capa"
                />{" "}
                <Input
                  value={draft.coverImageAlt || ""}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      coverImageAlt: event.target.value,
                    }))
                  }
                  placeholder="Texto alternativo da capa"
                />{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
        </WorkspaceSectionCard>
      ) : null;
    const sourcesSection = hasActiveChapter ? (
      <WorkspaceSectionCard
        title="Fontes de download"
        subtitle="Links opcionais para capítulos híbridos"
        eyebrow="Distribuição"
        testId="chapter-sources-section"
        actions={
          <DashboardActionButton
            type="button"
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
          </DashboardActionButton>
        }
      >
        {" "}
        <div className="space-y-4">
          {" "}
          <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
            {" "}
            <Label className="text-sm">Fontes</Label>{" "}
            <p className="mt-1 text-xs text-muted-foreground">
              {" "}
              Opcional para capítulos com leitura e download.{" "}
            </p>{" "}
          </div>{" "}
          <DownloadSourcesEditor
            sources={draft.sources || []}
            sourceAriaLabelPrefix="Fonte"
            cardClassName="bg-card/70"
            onChange={(nextSources) =>
              updateDraft((current) => ({
                ...current,
                sources: nextSources,
              }))
            }
          />{" "}
        </div>{" "}
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
              {" "}
              <Badge variant="outline" className="shrink-0">
                {" "}
                {selectedVolumeChapterCount} capítulo(s){" "}
              </Badge>{" "}
              <DashboardActionButton type="button" size="sm" onClick={openVolumeCoverLibrary}>
                {" "}
                <ImagePlus className="h-4 w-4" /> <span>Biblioteca</span>{" "}
              </DashboardActionButton>{" "}
            </>
          ) : null
        }
      >
        {" "}
        <div data-testid="chapter-volume-editor" data-state="open">
          {" "}
          <button
            type="button"
            className="sr-only"
            data-testid="chapter-volume-trigger"
            aria-expanded="false"
          >
            {" "}
            Alternar volume{" "}
          </button>{" "}
          <div className="flex w-full items-start justify-between gap-4 text-left">
            {" "}
            <div className={editorAccordionHeaderTextClassName}>
              {" "}
              <span className={editorAccordionTitleClassName}>
                {" "}
                {selectedVolumeNumber !== null ? selectedVolumeLabel : "Editor de volume"}{" "}
              </span>{" "}
              <span className={editorAccordionSubtitleClassName}>
                {" "}
                {selectedVolumeNumber !== null
                  ? "Capa, texto alternativo e sinopse do volume selecionado"
                  : "Selecione um volume na sidebar ou crie um novo para editar seus metadados"}{" "}
              </span>{" "}
            </div>{" "}
            {selectedVolumeNumber !== null ? (
              <Badge variant="outline" className="shrink-0">
                {" "}
                {selectedVolumeChapterCount} capítulo(s){" "}
              </Badge>
            ) : null}{" "}
          </div>{" "}
          {selectedVolumeNumber !== null ? (
            <div className="space-y-4">
              {" "}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border/50 bg-background/45 p-4">
                {" "}
                <div>
                  {" "}
                  <Label className="text-sm">Imagem do volume</Label>{" "}
                  <p className="text-xs text-muted-foreground">
                    {" "}
                    Usa a pasta dedicada de volumes deste projeto na biblioteca.{" "}
                  </p>{" "}
                </div>{" "}
                <div className="flex flex-wrap items-center gap-2">
                  {" "}
                  <DashboardActionButton type="button" size="sm" onClick={openVolumeCoverLibrary}>
                    {" "}
                    <ImagePlus className="h-4 w-4" /> <span>Biblioteca</span>{" "}
                  </DashboardActionButton>{" "}
                </div>{" "}
              </div>{" "}
              <div className="grid gap-5 rounded-[22px] border border-border/50 bg-background/35 p-4 sm:grid-cols-[128px_minmax(0,1fr)]">
                {" "}
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
                    {" "}
                    Sem capa{" "}
                  </div>
                )}{" "}
                <div className="space-y-3">
                  {" "}
                  <p className="text-xs leading-5 text-muted-foreground">
                    {" "}
                    Selecione a capa do volume pela biblioteca para manter a pasta dedicada
                    organizada.{" "}
                  </p>{" "}
                  <DashboardFieldStack>
                    {" "}
                    <Label htmlFor="chapter-volume-cover-alt">Texto alternativo</Label>{" "}
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
                    />{" "}
                  </DashboardFieldStack>{" "}
                </div>{" "}
              </div>{" "}
              <DashboardFieldStack>
                {" "}
                <Label htmlFor="chapter-volume-synopsis">Sinopse do volume</Label>{" "}
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
                />{" "}
              </DashboardFieldStack>{" "}
              {selectedVolumeChapterCount === 0 ? (
                <div className="rounded-[20px] border border-dashed border-border/60 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                  {" "}
                  Nenhum capítulo vinculado a este volume.{" "}
                </div>
              ) : null}{" "}
              <div
                className="flex items-center justify-between border-t border-border/60 pt-4"
                data-testid="chapter-volume-destructive-footer"
              >
                {" "}
                <p className="text-xs text-muted-foreground">
                  {" "}
                  A exclusão remove o volume e todos os capítulos vinculados.{" "}
                </p>{" "}
                <DashboardActionButton
                  type="button"
                  size="sm"
                  tone="destructive"
                  onClick={() => onRequestDeleteVolume(selectedVolumeNumber)}
                  disabled={isDeletingEntity}
                  className="gap-2"
                >
                  {" "}
                  <Trash2 className="h-4 w-4" /> <span>Excluir volume</span>{" "}
                </DashboardActionButton>{" "}
              </div>{" "}
            </div>
          ) : (
            <div
              className="rounded-[20px] border border-dashed border-border/60 bg-background/40 px-4 py-8"
              data-testid="chapter-volume-empty-state"
            >
              {" "}
              <AsyncState
                kind="empty"
                title="Nenhum volume selecionado"
                description="Crie um volume na sidebar para configurar capa e sinopse deste projeto."
                action={
                  <DashboardActionButton type="button" tone="primary" onClick={onAddVolume}>
                    {" "}
                    Adicionar volume{" "}
                  </DashboardActionButton>
                }
              />{" "}
            </div>
          )}{" "}
        </div>{" "}
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
        {" "}
        <div data-testid="chapter-content-section" className="space-y-4" data-state="open">
          {" "}
          <button
            type="button"
            className="sr-only"
            data-testid="chapter-content-trigger"
            aria-expanded="true"
          >
            {" "}
            Alternar conteúdo{" "}
          </button>{" "}
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            {" "}
            <div className="min-w-0 space-y-1.5">
              {" "}
              <div className="flex flex-wrap items-center gap-2">
                {" "}
                <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                  {" "}
                  Espaço editorial{" "}
                </Badge>{" "}
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                  {" "}
                  {isImageChapter ? "Imagem" : "Lexical"}{" "}
                </Badge>{" "}
              </div>{" "}
              <div className="space-y-1">
                {" "}
                <h2 className="text-base font-semibold tracking-tight text-foreground md:text-lg">
                  {" "}
                  Conteúdo{" "}
                </h2>{" "}
                <p className="max-w-2xl text-xs leading-5 text-muted-foreground md:text-sm">
                  {" "}
                  {isImageChapter
                    ? "Gerencie páginas, ordem de leitura e capa para capítulos em imagem."
                    : "Ambiente principal de escrita para o capítulo atual, com foco em leitura, continuidade e edição longa."}{" "}
                </p>{" "}
              </div>{" "}
            </div>{" "}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground lg:justify-end">
              {" "}
              <span>{chapterHasContent(draft) ? "Com leitura" : "Sem leitura"}</span>{" "}
              {draft.sources?.length ? <span>{draft.sources.length} fonte(s)</span> : null}{" "}
              <span>{chapterStatusLabel(draft)}</span>{" "}
            </div>{" "}
          </div>{" "}
          <div
            data-testid="chapter-content-viewport"
            data-state="open"
            className="grid grid-rows-[1fr] opacity-100"
          >
            {" "}
            <div
              className="space-y-4 transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
              data-testid="chapter-content-body"
              data-state="open"
              aria-hidden="false"
            >
              {" "}
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
                  {" "}
                  <LexicalEditorSurface
                    wrapperClassName={`chapter-editor-lexical-wrapper min-w-0 ${chapterEditorLexicalMinHeightClassName}`}
                    wrapperStyle={chapterEditorLexicalWrapperStyle}
                    wrapperTestId="chapter-lexical-wrapper"
                    fallbackVariant="chapter"
                    fallbackMinHeightClassName={chapterEditorLexicalMinHeightClassName}
                    fallbackClassName="chapter-editor-lexical-fallback"
                    fallbackTestId="chapter-lexical-fallback"
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
                  />{" "}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border/50 bg-background/35 px-4 py-3 text-xs text-muted-foreground">
                    {" "}
                    <span>
                      {" "}
                      O conteúdo usa o snapshot atual da página para EPUB e leitura pública.{" "}
                    </span>{" "}
                    <span>Escrita contínua com layout ampliado para capítulos longos.</span>{" "}
                  </div>{" "}
                </>
              )}{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
      </WorkspaceSectionCard>
    ) : null;
    const imageIdentitySection =
      hasActiveChapter && isImageChapter ? (
        <ChapterEditorIdentitySection
          draft={draft}
          identityError={identityError}
          isImageChapter
          supportsEpubTools={supportsEpubTools}
          updateDraft={updateDraft}
          onClearIdentityError={clearIdentityError}
        />
      ) : null;
    const standardIdentitySection =
      hasActiveChapter && !isImageChapter ? (
        <ChapterEditorIdentitySection
          draft={draft}
          identityError={identityError}
          isImageChapter={false}
          supportsEpubTools={supportsEpubTools}
          updateDraft={updateDraft}
          onClearIdentityError={clearIdentityError}
        />
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
          {" "}
          <div data-testid="chapter-content-section" className="space-y-4" data-state="open">
            {" "}
            <button
              type="button"
              className="sr-only"
              data-testid="chapter-content-trigger"
              aria-expanded="true"
            >
              {" "}
              Alternar conteúdo{" "}
            </button>{" "}
            <div
              data-testid="chapter-content-viewport"
              data-state="open"
              className="grid grid-rows-[1fr] opacity-100"
            >
              {" "}
              <div
                className="space-y-4 transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
                data-testid="chapter-content-body"
                data-state="open"
                aria-hidden="false"
              >
                {" "}
                <MangaChapterPagesEditor
                  apiBase={apiBase}
                  projectSnapshot={projectSnapshotForImageExport}
                  chapter={draft}
                  uploadFolder={chapterFolder}
                  onChange={(nextChapter) => onDraftChange(normalizeEditorChapter(nextChapter))}
                />{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
        </WorkspaceSectionCard>
      ) : null;
    const chapterTopAsideSection = hasActiveChapter ? (
      isImageChapter ? (
        progressSection
      ) : publicationSection || progressSection ? (
        <div className="space-y-4" data-testid="chapter-workspace-aside-column">
          {" "}
          {publicationSection} {progressSection}{" "}
        </div>
      ) : null
    ) : null;
    return (
      <>
        {" "}
        <DashboardDedicatedEditorHeader
          shellTestId="chapter-editor-header-shell"
          mastheadTestId="chapter-editor-masthead"
          commandBarTestId="chapter-editor-command-bar"
          primaryRowTestId="chapter-editor-action-rail"
          primaryStatusTestId="chapter-editor-top-status-group"
          primaryActionsTestId="chapter-editor-top-actions"
          secondaryMetaTestId="chapter-editor-status-bar"
          secondaryActionsTestId="chapter-editor-secondary-actions"
          badges={
            hasActiveChapter ? (
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
            ) : selectedVolumeNumber !== null ? (
              <>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                  Volume em edição
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                  {selectedVolumeLabel}
                </Badge>
              </>
            ) : null
          }
          title="Gerenciamento de Conteúdo"
          description={editorialScopeDescription}
          summaryCard={
            <>
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Projeto
              </p>
              <p className="mt-1 text-base font-semibold tracking-tight text-foreground">
                {project.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {hasActiveChapter
                  ? `${chapterTitle} · ${chapterPositionLabel}`
                  : selectedVolumeNumber !== null
                    ? `${selectedVolumeLabel} · ${selectedVolumeChapterCount} capítulo(s)`
                    : `${chapterCount} capítulo(s) disponível(is)`}
              </p>
            </>
          }
          primaryStatus={
            <>
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
            </>
          }
          primaryActions={
            <>
              {hasActiveChapter ? (
                <>
                  <DashboardActionButton
                    type="button"
                    size="sm"
                    tone={isChapterDraft ? "neutral" : "primary"}
                    onClick={() => {
                      void handleManualSave();
                    }}
                    disabled={isSavingChapter || !isDirty}
                    className="gap-2"
                  >
                    {isSavingChapter ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {primaryChapterActionLabel}
                  </DashboardActionButton>
                  <DashboardActionButton
                    type="button"
                    size="sm"
                    tone={isChapterDraft ? "primary" : "neutral"}
                    onClick={() => {
                      void handleChapterSave(isChapterDraft ? "published" : "draft");
                    }}
                    disabled={isSavingChapter}
                    className="gap-2"
                  >
                    {secondaryChapterActionLabel}
                  </DashboardActionButton>
                </>
              ) : null}
              {showVolumeSaveControls ? (
                <DashboardActionButton
                  type="button"
                  size="sm"
                  onClick={() => {
                    void onSaveVolumes();
                  }}
                  disabled={isSavingVolumes || !isVolumeDirty}
                  className="gap-2"
                >
                  {isSavingVolumes ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salvar volumes
                </DashboardActionButton>
              ) : null}
              {hasActiveChapter ? (
                <DashboardActionButton
                  type="button"
                  size="sm"
                  tone="destructive"
                  onClick={onRequestDeleteChapter}
                  disabled={isDeletingEntity}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" /> Excluir capítulo
                </DashboardActionButton>
              ) : null}
            </>
          }
          secondaryMeta={
            <>
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
                    Escolha um capítulo na sidebar, edite um volume na coluna principal ou use as
                    ferramentas EPUB logo abaixo.
                  </span>
                </>
              )}
            </>
          }
          secondaryActions={
            <>
              <DashboardActionButton size="sm" asChild>
                <Link to={buildDashboardProjectEditorHref(project.id)}>
                  <ArrowLeft className="h-4 w-4" />
                  <span>Voltar ao projeto</span>
                </Link>
              </DashboardActionButton>
              <DashboardActionButton size="sm" asChild>
                <Link to={publicProjectHref} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  <span>Página pública</span>
                </Link>
              </DashboardActionButton>
              {hasActiveChapter ? (
                <>
                  <DashboardActionButton size="sm" asChild>
                    <Link to={publicReadingHref} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      <span>Abrir leitura</span>
                    </Link>
                  </DashboardActionButton>
                  <DashboardActionButton size="sm" onClick={() => onNavigateToHref(neutralHref)}>
                    <span>Fechar capítulo</span>
                  </DashboardActionButton>
                  <DashboardActionButton
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
                  </DashboardActionButton>
                  <DashboardActionButton
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
                  </DashboardActionButton>
                </>
              ) : selectedVolumeNumber !== null ? (
                <DashboardActionButton
                  size="sm"
                  data-testid="chapter-close-volume-button"
                  onClick={() => {
                    void handleCloseSelectedVolume();
                  }}
                >
                  <span>Fechar volume</span>
                </DashboardActionButton>
              ) : null}
            </>
          }
        />
        <div
          className="project-editor-layout mx-auto grid w-full gap-5 pb-8 pt-4 md:pb-10 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start"
          data-testid="chapter-editor-upper-layout"
          style={
            {
              "--dedicated-editor-sidebar-height": measuredSidebarHeight,
            } as DedicatedEditorSidebarHeightStyle
          }
        >
          {" "}
          <div
            className="min-w-0 w-full"
            data-testid="chapter-editor-main-column"
            ref={mainColumnRef}
          >
            {" "}
            <div className="space-y-4" data-testid="chapter-editor-workspace">
              {" "}
              {hasActiveChapter ? (
                <>
                  {" "}
                  <div
                    className={cn(
                      "grid gap-4",
                      chapterTopAsideSection
                        ? "xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
                        : "xl:grid-cols-1",
                    )}
                    data-testid="chapter-workspace-top-row"
                  >
                    {" "}
                    {isImageChapter ? imageIdentitySection : standardIdentitySection}{" "}
                    {chapterTopAsideSection}{" "}
                  </div>{" "}
                  {isImageChapter ? imageContentSection : contentSection}{" "}
                  {!isImageChapter ? (
                    <div
                      className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]"
                      data-testid="chapter-workspace-support-row"
                    >
                      {" "}
                      {coverSection} {sourcesSection}{" "}
                    </div>
                  ) : null}{" "}
                </>
              ) : (
                <>
                  {" "}
                  {volumeEditorSection}{" "}
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
                  ) : null}{" "}
                  {epubToolsAccordion}{" "}
                </>
              )}{" "}
            </div>{" "}
          </div>{" "}
          <aside
            className={dedicatedEditorSidebarStickyClassName}
            data-testid="chapter-editor-sidebar"
          >
            {" "}
            {structureAccordion}{" "}
          </aside>{" "}
        </div>{" "}
        <ChapterEditorDialogs
          leaveDialogDescription={leaveDialogDescription}
          leaveDialogState={leaveDialogState}
          leaveDialogTitle={leaveDialogTitle}
          libraryDialogProps={libraryDialogProps}
          onCloseVolumeRequiredSaveDialog={closeVolumeRequiredSaveDialog}
          onLeaveDialogCancel={handleLeaveDialogCancel}
          onLeaveDialogDiscardAndContinue={handleLeaveDialogDiscardAndContinue}
          onLeaveDialogSaveAndContinue={handleLeaveDialogSaveAndContinue}
          volumeRequiredSaveDialogDescription={VOLUME_REQUIRED_SAVE_DIALOG_DESCRIPTION}
          volumeRequiredSaveDialogOpen={isVolumeRequiredSaveDialogOpen}
        />{" "}
      </>
    );
  },
);
ChapterEditorPane.displayName = "ChapterEditorPane";
export default ChapterEditorPane;
