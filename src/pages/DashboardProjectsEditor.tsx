import DashboardShell from "@/components/DashboardShell";
import ReorderControls from "@/components/ReorderControls";
import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/dashboard/dashboard-form-controls";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import {
  dashboardAnimationDelay,
  dashboardClampedStaggerMs,
} from "@/components/dashboard/dashboard-motion";
import {
  dashboardPageLayoutTokens,
  dashboardStrongFocusFieldClassName,
  dashboardStrongSurfaceHoverClassName,
} from "@/components/dashboard/dashboard-page-tokens";
import EpisodeContentEditor from "@/components/dashboard/project-editor/EpisodeContentEditor";
import ProjectEditorDialogShell from "@/components/dashboard/project-editor/ProjectEditorDialogShell";
import ProjectEditorImageLibraryDialog from "@/components/dashboard/project-editor/ProjectEditorImageLibraryDialog";
import ProjectEditorImportSection from "@/components/dashboard/project-editor/ProjectEditorImportSection";
import ProjectEditorInformationSection from "@/components/dashboard/project-editor/ProjectEditorInformationSection";
import ProjectEditorEpisodesSection from "@/components/dashboard/project-editor/ProjectEditorEpisodesSection";
import ProjectEditorMediaSection from "@/components/dashboard/project-editor/ProjectEditorMediaSection";
import ProjectEditorRelationsSection from "@/components/dashboard/project-editor/ProjectEditorRelationsSection";
import ProjectEditorStaffSection from "@/components/dashboard/project-editor/ProjectEditorStaffSection";
import { DEFAULT_PROJECT_FORMAT_OPTIONS } from "@/components/dashboard/project-editor/project-editor-constants";
import {
  buildEmptyProjectForm,
  buildProjectFormFromRecord,
  normalizeUniqueStringList,
  resolveProjectEpisodeFocusIndex,
  resolveSortedProjectEpisodeFocusIndex,
} from "@/components/dashboard/project-editor/project-editor-form";
import { useProjectEditorEpisodeSectionState } from "@/components/dashboard/project-editor/useProjectEditorEpisodeSectionState";
import { useDashboardProjectsEditorPersistence } from "@/components/dashboard/project-editor/useDashboardProjectsEditorPersistence";
import { useDashboardProjectsEditorController } from "@/components/dashboard/project-editor/useDashboardProjectsEditorController";
import {
  ProjectEditorAnimeBatchDialog,
  ProjectEditorConfirmDialog,
  ProjectEditorDeleteDialog,
} from "@/components/dashboard/project-editor/ProjectEditorSupportDialogs";
import { useProjectEditorDialogState } from "@/components/dashboard/project-editor/useProjectEditorDialogState";
import { useProjectEditorImageLibrary } from "@/components/dashboard/project-editor/useProjectEditorImageLibrary";
import {
  buildCompletionBadges,
  getEpisodeAccordionValue,
  shouldSkipEpisodeHeaderToggle,
  shiftCollapsedEpisodesAfterRemoval,
  shiftDraftAfterRemoval,
  useDashboardProjectsEditorAnimeBatch,
} from "@/components/dashboard/project-editor/useDashboardProjectsEditorAnimeBatch";
import {
  clearProjectsPageCache,
  useDashboardProjectsEditorResource,
} from "@/components/dashboard/project-editor/useDashboardProjectsEditorResource";
import { useProjectEditorTaxonomy } from "@/components/dashboard/project-editor/useProjectEditorTaxonomy";
import type {
  EditorProjectEpisode,
  ProjectForm,
  ProjectRecord,
} from "@/components/dashboard/project-editor/dashboard-projects-editor-types";
import type { LexicalEditorHandle } from "@/components/lexical/LexicalEditor";
import DownloadSourceSelect from "@/components/project-reader/DownloadSourceSelect";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AsyncState from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import CompactPagination from "@/components/ui/compact-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import type { ProjectEpisode } from "@/data/projects";
import { useEditorScrollLock } from "@/hooks/use-editor-scroll-lock";
import { useEditorScrollStability } from "@/hooks/use-editor-scroll-stability";
import { useDashboardCurrentUser } from "@/hooks/use-dashboard-current-user";
import { useDashboardRefreshToast } from "@/hooks/use-dashboard-refresh-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { parseAniListMediaId } from "@/lib/anilist";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  canonicalToDisplayTime,
  displayDateToIso,
  displayTimeToCanonical,
  digitsOnly,
  formatDateDigitsToDisplay,
  formatEpisodeReleaseDate,
  formatTimeDigitsToDisplay,
  isoToDisplayDate,
  normalizeCanonicalTimeFromUnknown,
  normalizeIsoDateFromUnknown,
} from "@/lib/dashboard-date-time";
import {
  clearIndexedRecordValue,
} from "@/lib/dashboard-indexed-drafts";
import {
  matchesAnimeEpisodeQuickFilter,
  type AnimeEpisodeQuickFilter,
} from "@/lib/project-anime-episodes";
import { formatBytesCompact, parseHumanSizeToBytes } from "@/lib/file-size";
import {
  buildDashboardProjectChapterEditorHref,
  buildDashboardProjectChaptersEditorHref,
  buildDashboardProjectEpisodeEditorHref,
  buildDashboardProjectEpisodesEditorHref,
  buildProjectPublicHref,
} from "@/lib/project-editor-routes";
import {
  EXTRA_TECHNICAL_NUMBER_BASE,
  buildEpisodeKey,
  resolveEpisodeLookup,
  resolveNextExtraTechnicalNumber,
  resolveNextMainEpisodeNumber,
} from "@/lib/project-episode-key";
import {
  sortByTranslatedLabel,
  translateGenre,
  translateRelation,
  translateTag,
} from "@/lib/project-taxonomy";
import {
  getProjectProgressStagesForEditor,
  getProjectProgressStateForEditor,
} from "@/lib/project-progress";
import { isChapterBasedType, isLightNovelType, isMangaType } from "@/lib/project-utils";
import { buildVolumeCoverKey } from "@/lib/project-volume-cover-key";
import { reorderItems } from "@/lib/reorder-items";
import {
  Clapperboard,
  Copy,
  Eye,
  FileImage,
  FileText,
  LayoutGrid,
  type LucideIcon,
  Loader2,
  MessageSquare,
  PencilLine,
  Plus,
  Settings,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const getDedicatedEditorCtaIcon = (projectType?: string | null): LucideIcon => {
  const normalizedType = String(projectType || "").trim();
  if (!normalizedType) {
    return PencilLine;
  }
  if (isMangaType(normalizedType)) {
    return FileImage;
  }
  if (isLightNovelType(normalizedType)) {
    return FileText;
  }
  return Clapperboard;
};

const appendUniqueValue = (values: string[], nextValue: string) =>
  values.includes(nextValue) ? values : [...values, nextValue];

const defaultFormatOptions = DEFAULT_PROJECT_FORMAT_OPTIONS;
const statusOptions = ["Em andamento", "Finalizado", "Pausado", "Cancelado"];
const fansubRoleOptions = [
  "Tradução",
  "Revisão",
  "Timing",
  "Typesetting",
  "Quality Check",
  "Encode",
  "Cleaner",
  "Redrawer",
  "Karaoke",
  "Editor",
];

const clearIndexedDraftValue = clearIndexedRecordValue<string>;

const DashboardProjectsEditor = () => {
  usePageMeta({ title: "Projetos", noIndex: true });
  const navigate = useNavigate();
  const apiBase = getApiBase();
  const { settings: publicSettings } = useSiteSettings();
  const restoreWindowMs = 3 * 24 * 60 * 60 * 1000;
  const { currentUser, isLoadingUser } = useDashboardCurrentUser();
  const hasLoadedCurrentUser = !isLoadingUser;
  const [searchQuery, setSearchQuery] = useState("");
  const emptyProject = useMemo(() => buildEmptyProjectForm(), []);

  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [formState, setFormState] = useState<ProjectForm>(() => buildEmptyProjectForm());
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [anilistIdInput, setAnilistIdInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [genreInput, setGenreInput] = useState("");
  const [animationStudioInput, setAnimationStudioInput] = useState("");
  const [producerInput, setProducerInput] = useState("");
  const {
    currentPage,
    genreTranslations,
    hasLoadError,
    hasLoadedOnce,
    hasResolvedMemberDirectory,
    hasResolvedProjectTypes,
    hasResolvedProjects,
    hasResolvedTranslations,
    isInitialLoading,
    isRefreshing,
    memberDirectory,
    projectTypeOptions,
    projects,
    refreshProjects,
    searchParams,
    selectedType,
    setCurrentPage,
    setProjects,
    setSearchParams,
    setSelectedType,
    setSortMode,
    sortMode,
    staffRoleTranslations,
    tagTranslations,
  } = useDashboardProjectsEditorResource(apiBase);
  const [episodeDragId, setEpisodeDragId] = useState<number | null>(null);
  const [relationDragIndex, setRelationDragIndex] = useState<number | null>(null);
  const [staffDragIndex, setStaffDragIndex] = useState<number | null>(null);
  const [animeStaffDragIndex, setAnimeStaffDragIndex] = useState<number | null>(null);
  const [staffMemberInput, setStaffMemberInput] = useState<Record<number, string>>({});
  const [animeStaffMemberInput, setAnimeStaffMemberInput] = useState<Record<number, string>>({});
  const [episodeDateDraft, setEpisodeDateDraft] = useState<Record<number, string>>({});
  const [episodeTimeDraft, setEpisodeTimeDraft] = useState<Record<number, string>>({});
  const [episodeSizeDrafts, setEpisodeSizeDrafts] = useState<Record<number, string>>({});
  const [episodeSizeErrors, setEpisodeSizeErrors] = useState<Record<number, string>>({});
  const [editorAccordionValue, setEditorAccordionValue] = useState<string[]>(["informacoes"]);
  const chapterEditorsRef = useRef<Record<number, LexicalEditorHandle | null>>({});
  const episodeSizeInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const hasInitializedListFiltersRef = useRef(false);
  const canManageProjects = useMemo(() => {
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    return permissions.includes("*") || permissions.includes("projetos");
  }, [currentUser]);
  const {
    activeLibraryOptions,
    buildEpisodeLibraryOptions,
    currentLibrarySelection,
    handleLibrarySave,
    isLibraryOpen,
    openLibraryForEpisodeCover,
    openLibraryForProjectImage,
    openLibraryForVolumeCover,
    setIsLibraryOpen,
  } = useProjectEditorImageLibrary({
    canManageProjects,
    formState,
    setFormState,
  });
  const isManga = isMangaType(formState.type || "");
  const isLightNovel = isLightNovelType(formState.type || "");
  const supportsVolumeEntries = isLightNovel || isManga;
  const isChapterBased = isChapterBasedType(formState.type || "");
  const getEpisodeEntryKind = useCallback(
    (episode: Partial<EditorProjectEpisode> | null | undefined): "main" | "extra" =>
      episode?.entryKind === "extra" ? "extra" : "main",
    [],
  );
  const {
    addVolumeEntry,
    collapsedEpisodes,
    collapsedVolumeGroups,
    contentSectionRef,
    episodeGroupsForRender,
    episodeOpenValues,
    handleAddEpisodeDownload,
    handleEpisodeAccordionChange,
    handleEpisodeHeaderClick,
    handleVolumeGroupAccordionChange,
    pendingEpisodeToScrollRef,
    registerEpisodeCardNode,
    registerVolumeGroupNode,
    removeVolumeEntryByVolume,
    resetPendingContentNavigation,
    revealEpisodeAtIndex,
    setCollapsedEpisodes,
    setCollapsedVolumeGroups,
    sortedEpisodeDownloads,
    updateVolumeEntryByVolume,
    volumeGroupOpenValues,
  } = useProjectEditorEpisodeSectionState({
    editorAccordionValue,
    formState,
    getEpisodeEntryKind,
    isChapterBased,
    setFormState,
    shouldSkipEpisodeHeaderToggle,
    supportsVolumeEntries,
  });
  const {
    autoEditHandledRef,
    closeEditor,
    confirmActionRef,
    confirmCancelRef,
    confirmDescription,
    confirmOpen,
    confirmTitle,
    handleEditorOpenChange,
    isDirty,
    isEditorDialogScrolled,
    isEditorOpen,
    markEditorSnapshot,
    pendingEpisodeFocusRef,
    requestCloseEditor,
    setConfirmOpen,
    setIsEditorDialogScrolled,
    setIsEditorOpen,
  } = useProjectEditorDialogState({
    anilistIdInput,
    formState,
    initialFormState: emptyProject,
    isLibraryOpen,
    onCloseEditor: () => {
      resetPendingContentNavigation();
      setEditingProject(null);
    },
  });
  useEditorScrollLock(isEditorOpen);
  useEditorScrollStability(isEditorOpen);

  useEffect(() => {
    const maxEpisodeIndex = formState.episodeDownloads.length - 1;

    const pruneMap = (current: Record<number, string>) => {
      let changed = false;
      const next: Record<number, string> = {};
      Object.entries(current).forEach(([key, value]) => {
        const index = Number(key);
        if (!Number.isFinite(index) || index < 0 || index > maxEpisodeIndex) {
          changed = true;
          return;
        }
        next[index] = value;
      });
      return changed ? next : current;
    };

    setEpisodeSizeDrafts((prev) => pruneMap(prev));
    setEpisodeSizeErrors((prev) => pruneMap(prev));
    Object.keys(episodeSizeInputRefs.current).forEach((key) => {
      const index = Number(key);
      if (!Number.isFinite(index) || index < 0 || index > maxEpisodeIndex) {
        delete episodeSizeInputRefs.current[index];
      }
    });
  }, [formState.episodeDownloads]);

  const staffRoleOptions = useMemo(() => {
    const labels = publicSettings.teamRoles.map((role) => role.label).filter(Boolean);
    if (labels.length) {
      return labels;
    }
    const fallback = formState.staff.map((item) => item.role).filter(Boolean);
    return Array.from(new Set(fallback));
  }, [publicSettings.teamRoles, formState.staff]);

  const {
    genreTranslationMap,
    genreSuggestions,
    resolveGenreInputValue,
    resolveTagInputValue,
    staffRoleTranslationMap,
    tagTranslationMap,
    tagSuggestions,
    translatedSortedEditorGenres,
    translatedSortedEditorTags,
  } = useProjectEditorTaxonomy({
    formState,
    genreInput,
    genreTranslations,
    projects,
    staffRoleTranslations,
    tagInput,
    tagTranslations,
  });

  useEffect(() => {
    if (!hasInitializedListFiltersRef.current) {
      hasInitializedListFiltersRef.current = true;
      return;
    }
    setCurrentPage(1);
  }, [searchQuery, selectedType, sortMode]);

  const hasAniListReference =
    Boolean(formState.anilistId) || parseAniListMediaId(anilistIdInput) !== null;
  const stageOptions = getProjectProgressStagesForEditor(formState.type || "");

  const {
    animeBatchCadenceDays,
    animeBatchCreateOpen,
    animeBatchDurationInput,
    animeBatchOperationCompletedStages,
    animeBatchOperationDuration,
    animeBatchOperationPublicationStatus,
    animeBatchOperationShiftDays,
    animeBatchOperationSourceType,
    animeBatchPublicationStatus,
    animeBatchQuantity,
    animeBatchSourceType,
    animeBatchStartNumber,
    animeEpisodeFilter,
    applyAnimeBatchCompletedStages,
    applyAnimeBatchDuration,
    applyAnimeBatchPublicationStatus,
    applyAnimeBatchReplicateSources,
    applyAnimeBatchShiftReleaseDates,
    applyAnimeBatchSourceType,
    clearSelectedAnimeEpisodes,
    clearRemovedAnimeEpisode,
    createAnimeEpisodeBatch,
    duplicateAnimeEpisode,
    filteredAnimeEpisodeItems,
    removeAnimeEpisodeAtIndex,
    removedAnimeEpisode,
    selectAllFilteredAnimeEpisodes,
    selectedAnimeEpisodeKeys,
    selectedAnimeEpisodeKeySet,
    setAnimeBatchCadenceDays,
    setAnimeBatchCreateOpen,
    setAnimeBatchDurationInput,
    setAnimeBatchOperationCompletedStages,
    setAnimeBatchOperationDuration,
    setAnimeBatchOperationPublicationStatus,
    setAnimeBatchOperationShiftDays,
    setAnimeBatchOperationSourceType,
    setAnimeBatchPublicationStatus,
    setAnimeBatchQuantity,
    setAnimeBatchSourceType,
    setAnimeBatchStartNumber,
    setAnimeEpisodeFilter,
    toggleSelectedAnimeEpisode,
    undoRemoveAnimeEpisode,
  } = useDashboardProjectsEditorAnimeBatch({
    formState,
    isChapterBased,
    pendingEpisodeToScrollRef,
    setCollapsedEpisodes,
    setEpisodeDateDraft,
    setEpisodeSizeDrafts,
    setEpisodeSizeErrors,
    setEpisodeTimeDraft,
    setFormState,
    sortedEpisodeDownloads,
  });

  const {
    getRestoreRemainingLabel,
    handleDelete,
    handleImportAniList,
    handleRestoreProject,
    handleSave,
    isRestorable,
  } = useDashboardProjectsEditorPersistence({
    anilistIdInput,
    apiBase,
    closeEditor,
    deleteTarget,
    editingProject,
    episodeSizeDrafts,
    episodeSizeErrors,
    episodeSizeInputRefs,
    formState,
    markEditorSnapshot,
    projects,
    refreshProjects,
    restoreWindowMs,
    revealEpisodeAtIndex,
    setDeleteTarget,
    setEditorAccordionValue,
    setEpisodeSizeDrafts,
    setEpisodeSizeErrors,
    setFormState,
    setProjects,
    staffMemberInput,
  });

  const activeProjects = useMemo(
    () => projects.filter((project) => !project.deletedAt),
    [projects],
  );
  const trashedProjects = useMemo(
    () => projects.filter((project) => project.deletedAt && isRestorable(project)),
    [isRestorable, projects],
  );
  const typeOptions = useMemo(() => {
    const types = activeProjects
      .map((project) => String(project.type || "").trim())
      .filter(Boolean);
    const unique = Array.from(new Set(types));
    const sorted = unique.sort((a, b) => a.localeCompare(b, "pt-BR"));
    return ["Todos", ...sorted];
  }, [activeProjects]);
  const formatSelectOptions = useMemo(() => {
    const fromApi = Array.isArray(projectTypeOptions) ? projectTypeOptions : [];
    const currentType = String(formState.type || "").trim();
    const merged = Array.from(
      new Set([...fromApi, ...defaultFormatOptions, currentType].filter(Boolean)),
    );
    return merged.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [formState.type, projectTypeOptions]);

  useEffect(() => {
    if (!hasResolvedProjects || !hasResolvedProjectTypes || hasLoadError) {
      return;
    }
    if (selectedType === "Todos") {
      return;
    }
    if (typeOptions.includes(selectedType)) {
      return;
    }
    setSelectedType("Todos");
  }, [hasLoadError, hasResolvedProjectTypes, hasResolvedProjects, selectedType, typeOptions]);

  const filteredProjects = useMemo(() => {
    const projectsByType =
      selectedType === "Todos"
        ? activeProjects
        : activeProjects.filter((project) => String(project.type || "").trim() === selectedType);
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return projectsByType;
    }
    return projectsByType.filter((project) => {
      const haystack = [
        project.title,
        project.titleOriginal,
        project.titleEnglish,
        project.synopsis,
        project.description,
        project.type,
        project.status,
        project.studio,
        project.episodes,
        project.tags.join(" "),
        project.genres.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [activeProjects, searchQuery, selectedType]);

  const sortedProjects = useMemo(() => {
    const next = [...filteredProjects];
    if (sortMode === "alpha") {
      next.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
      return next;
    }
    if (sortMode === "status") {
      next.sort((a, b) => a.status.localeCompare(b.status, "pt-BR"));
      return next;
    }
    if (sortMode === "views") {
      next.sort((a, b) => (b.views || 0) - (a.views || 0));
      return next;
    }
    if (sortMode === "comments") {
      next.sort((a, b) => (b.commentsCount || 0) - (a.commentsCount || 0));
      return next;
    }
    if (sortMode === "recent") {
      next.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime(),
      );
      return next;
    }
    next.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    return next;
  }, [filteredProjects, sortMode]);
  const projectsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / projectsPerPage));
  const pageStart = (currentPage - 1) * projectsPerPage;
  const paginatedProjects = sortedProjects.slice(pageStart, pageStart + projectsPerPage);

  useEffect(() => {
    if (!hasResolvedProjects) {
      return;
    }
    setCurrentPage(Math.min(currentPage, totalPages));
  }, [currentPage, hasResolvedProjects, setCurrentPage, totalPages]);

  const openCreate = () => {
    const nextForm = buildEmptyProjectForm();
    resetPendingContentNavigation();
    setEditingProject(null);
    setFormState(nextForm);
    setAnilistIdInput("");
    setEditorAccordionValue(["importacao"]);
    setEpisodeDateDraft({});
    setEpisodeTimeDraft({});
    setEpisodeSizeDrafts({});
    setEpisodeSizeErrors({});
    setAnimeEpisodeFilter("all");
    clearSelectedAnimeEpisodes();
    clearRemovedAnimeEpisode();
    setAnimeBatchCreateOpen(false);
    setAnimeBatchStartNumber("");
    setAnimeBatchQuantity("3");
    setAnimeBatchCadenceDays("");
    setAnimeBatchDurationInput("");
    setAnimeBatchOperationDuration("");
    setAnimeBatchOperationShiftDays("");
    setAnimeBatchOperationCompletedStages([]);
    episodeSizeInputRefs.current = {};
    setStaffMemberInput({});
    setAnimeStaffMemberInput({});
    markEditorSnapshot(nextForm, "");
    setCollapsedEpisodes({});
    setCollapsedVolumeGroups({});
    setIsEditorOpen(true);
  };

  const openEdit = useCallback(
    (project: ProjectRecord) => {
      resetPendingContentNavigation();
      const pendingEpisodeFocus = pendingEpisodeFocusRef.current;
      const shouldOpenEpisodesSection = Boolean(pendingEpisodeFocus);
      const nextForm = buildProjectFormFromRecord(project);
      const initialEpisodes: EditorProjectEpisode[] = nextForm.episodeDownloads;
      const focusedEpisodeIndex = resolveProjectEpisodeFocusIndex(
        initialEpisodes,
        pendingEpisodeFocus,
      );
      const focusedEpisode =
        focusedEpisodeIndex >= 0 ? initialEpisodes[focusedEpisodeIndex] || null : null;
      const focusedVolumeGroupKey = focusedEpisode
        ? buildVolumeCoverKey(focusedEpisode.volume)
        : null;
      const nextAniListInput = project.anilistId ? String(project.anilistId) : "";
      setEditingProject(project);
      setFormState(nextForm);
      setAnilistIdInput(nextAniListInput);
      setEditorAccordionValue(
        shouldOpenEpisodesSection ? ["informacoes", "episodios"] : ["informacoes"],
      );
      setEpisodeDateDraft({});
      setEpisodeTimeDraft({});
      setEpisodeSizeDrafts({});
      setEpisodeSizeErrors({});
      setAnimeEpisodeFilter("all");
      clearSelectedAnimeEpisodes();
      clearRemovedAnimeEpisode();
      setAnimeBatchCreateOpen(false);
      setAnimeBatchQuantity("3");
      setAnimeBatchCadenceDays("");
      setAnimeBatchDurationInput("");
      setAnimeBatchOperationDuration("");
      setAnimeBatchOperationShiftDays("");
      setAnimeBatchOperationCompletedStages([]);
      episodeSizeInputRefs.current = {};
      setStaffMemberInput({});
      setAnimeStaffMemberInput({});
      markEditorSnapshot(nextForm, nextAniListInput);
      pendingEpisodeToScrollRef.current = focusedEpisode;
      setCollapsedEpisodes(() => {
        const next: Record<number, boolean> = {};
        initialEpisodes.forEach((_, index) => {
          next[index] = focusedEpisodeIndex >= 0 ? index !== focusedEpisodeIndex : true;
        });
        return next;
      });
      setCollapsedVolumeGroups(() =>
        focusedVolumeGroupKey
          ? {
              [focusedVolumeGroupKey]: false,
            }
          : {},
      );
      setIsEditorOpen(true);
    },
    [resetPendingContentNavigation],
  );

  useEffect(() => {
    const editTarget = (searchParams.get("edit") || "").trim();
    const chapterTarget = (searchParams.get("chapter") || "").trim();
    const volumeTarget = (searchParams.get("volume") || "").trim();
    if (!editTarget) {
      autoEditHandledRef.current = null;
      pendingEpisodeFocusRef.current = null;
      return;
    }
    const autoEditToken = `${editTarget}|chapter=${chapterTarget}|volume=${volumeTarget}`;
    if (autoEditHandledRef.current === autoEditToken) {
      return;
    }
    if (!hasResolvedProjects || !hasLoadedCurrentUser) {
      return;
    }
    autoEditHandledRef.current = autoEditToken;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("edit");
    nextParams.delete("chapter");
    nextParams.delete("volume");
    const parsedChapterNumber = Number(chapterTarget);
    const hasChapterTarget = chapterTarget.length > 0 && Number.isFinite(parsedChapterNumber);
    const parsedVolumeNumber = Number(volumeTarget);
    const resolvedVolumeTarget =
      volumeTarget.length > 0 && Number.isFinite(parsedVolumeNumber)
        ? parsedVolumeNumber
        : undefined;
    if (canManageProjects && editTarget === "new") {
      pendingEpisodeFocusRef.current = null;
      openCreate();
    } else {
      const target = canManageProjects
        ? projects.find((project) => project.id === editTarget) || null
        : null;
      if (target) {
        if (hasChapterTarget && isLightNovelType(target.type || "")) {
          const chapterLookup = resolveEpisodeLookup(
            target.episodeDownloads || [],
            parsedChapterNumber,
            resolvedVolumeTarget,
          );
          if (chapterLookup.ok) {
            navigate(
              buildDashboardProjectChapterEditorHref(
                target.id,
                chapterLookup.episode.number,
                chapterLookup.episode.volume,
              ),
              { replace: true },
            );
            return;
          }
        }
        pendingEpisodeFocusRef.current = hasChapterTarget
          ? {
              number: parsedChapterNumber,
              volume: resolvedVolumeTarget,
            }
          : null;
        openEdit(target);
      } else {
        pendingEpisodeFocusRef.current = null;
      }
    }
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    canManageProjects,
    hasLoadedCurrentUser,
    hasResolvedProjects,
    openCreate,
    openEdit,
    projects,
    navigate,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    const pendingEpisodeFocus = pendingEpisodeFocusRef.current;
    if (!isEditorOpen || !pendingEpisodeFocus) {
      return;
    }
    if (!sortedEpisodeDownloads.length) {
      return;
    }

    const targetIndex = resolveSortedProjectEpisodeFocusIndex(
      sortedEpisodeDownloads,
      pendingEpisodeFocus,
    );
    if (!Number.isInteger(targetIndex) || targetIndex < 0) {
      pendingEpisodeFocusRef.current = null;
      return;
    }

    setEditorAccordionValue((prev) => (prev.includes("episodios") ? prev : [...prev, "episodios"]));
    revealEpisodeAtIndex(targetIndex);
    pendingEpisodeFocusRef.current = null;
  }, [isEditorOpen, revealEpisodeAtIndex, sortedEpisodeDownloads]);


  const appendTagValue = (value: string) => {
    const nextValue = String(value || "").trim();
    if (!nextValue) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      tags: appendUniqueValue(prev.tags, nextValue),
    }));
  };

  const appendGenreValue = (value: string) => {
    const nextValue = String(value || "").trim();
    if (!nextValue) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      genres: appendUniqueValue(prev.genres, nextValue),
    }));
  };

  const handleAddTag = () => {
    const next = resolveTagInputValue(tagInput);
    if (!next) {
      return;
    }
    appendTagValue(next);
    setTagInput("");
  };

  const handleAddGenre = () => {
    const next = resolveGenreInputValue(genreInput);
    if (!next) {
      return;
    }
    appendGenreValue(next);
    setGenreInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setFormState((prev) => ({ ...prev, tags: prev.tags.filter((item) => item !== tag) }));
  };

  const handleRemoveGenre = (genre: string) => {
    setFormState((prev) => ({ ...prev, genres: prev.genres.filter((item) => item !== genre) }));
  };

  const handleAddAnimationStudio = () => {
    const next = animationStudioInput.trim();
    if (!next) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      animationStudios: normalizeUniqueStringList([...prev.animationStudios, next]),
    }));
    setAnimationStudioInput("");
  };

  const handleRemoveAnimationStudio = (studio: string) => {
    setFormState((prev) => ({
      ...prev,
      animationStudios: prev.animationStudios.filter((item) => item !== studio),
    }));
  };

  const handleAddProducer = () => {
    const next = producerInput.trim();
    if (!next) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      producers: normalizeUniqueStringList([...prev.producers, next]),
    }));
    setProducerInput("");
  };

  const handleRemoveProducer = (producer: string) => {
    setFormState((prev) => ({
      ...prev,
      producers: prev.producers.filter((item) => item !== producer),
    }));
  };

  const commitStaffMember = useCallback(
    (index: number, rawValue?: string) => {
      const name = String(rawValue ?? staffMemberInput[index] ?? "").trim();
      if (!name) {
        return;
      }
      setFormState((prev) => {
        const next = [...prev.staff];
        const currentRole = next[index];
        if (!currentRole) {
          return prev;
        }
        const members = currentRole.members || [];
        next[index] = {
          ...currentRole,
          members: members.includes(name) ? members : [...members, name],
        };
        return { ...prev, staff: next };
      });
      setStaffMemberInput((prev) => clearIndexedDraftValue(prev, index));
    },
    [staffMemberInput],
  );

  const commitAnimeStaffMember = useCallback(
    (index: number, rawValue?: string) => {
      const name = String(rawValue ?? animeStaffMemberInput[index] ?? "").trim();
      if (!name) {
        return;
      }
      setFormState((prev) => {
        const next = [...prev.animeStaff];
        const currentRole = next[index];
        if (!currentRole) {
          return prev;
        }
        const members = currentRole.members || [];
        next[index] = {
          ...currentRole,
          members: members.includes(name) ? members : [...members, name],
        };
        return { ...prev, animeStaff: next };
      });
      setAnimeStaffMemberInput((prev) => clearIndexedDraftValue(prev, index));
    },
    [animeStaffMemberInput],
  );

  const setEpisodeEntryKind = useCallback(
    (index: number, nextKind: "main" | "extra") => {
      setFormState((prev) => {
        const nextEpisodes = [...prev.episodeDownloads];
        const currentEpisode = nextEpisodes[index];
        if (!currentEpisode) {
          return prev;
        }
        const targetKind = nextKind === "extra" ? "extra" : "main";
        const nextEpisodeBase: EditorProjectEpisode = {
          ...currentEpisode,
          entryKind: targetKind,
          entrySubtype: targetKind === "extra" ? "extra" : "chapter",
          displayLabel: undefined,
        };
        const reservedKeys = new Set(
          nextEpisodes
            .map((episode, episodeIndex) =>
              episodeIndex === index ? "" : buildEpisodeKey(episode?.number, episode?.volume),
            )
            .filter(Boolean),
        );
        if (targetKind === "extra") {
          const currentNumber = Number(currentEpisode.number);
          const currentKey = buildEpisodeKey(currentNumber, currentEpisode.volume);
          const canKeepCurrent =
            Number.isFinite(currentNumber) &&
            currentNumber >= EXTRA_TECHNICAL_NUMBER_BASE &&
            currentKey &&
            !reservedKeys.has(currentKey);
          nextEpisodes[index] = {
            ...nextEpisodeBase,
            number: canKeepCurrent
              ? currentNumber
              : resolveNextExtraTechnicalNumber(nextEpisodes, currentEpisode.volume, {
                  excludeIndex: index,
                }),
          };
          return {
            ...prev,
            episodeDownloads: nextEpisodes,
          };
        }
        const currentNumber = Number(currentEpisode.number);
        const currentKey = buildEpisodeKey(currentNumber, currentEpisode.volume);
        const shouldReassign =
          !Number.isFinite(currentNumber) ||
          currentNumber <= 0 ||
          currentNumber >= EXTRA_TECHNICAL_NUMBER_BASE ||
          (currentKey && reservedKeys.has(currentKey));
        nextEpisodes[index] = {
          ...nextEpisodeBase,
          number: shouldReassign
            ? resolveNextMainEpisodeNumber(nextEpisodes, {
                excludeIndex: index,
                volume: currentEpisode.volume,
                isExtra: (episode) => getEpisodeEntryKind(episode) === "extra",
              })
            : currentNumber,
        };
        return {
          ...prev,
          episodeDownloads: nextEpisodes,
        };
      });
    },
    [getEpisodeEntryKind],
  );

  const moveRelationItem = useCallback((from: number, to: number) => {
    if (from === to) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      relations: reorderItems(prev.relations, from, to),
    }));
  }, []);

  const moveStaffItem = useCallback((from: number, to: number) => {
    if (from === to) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      staff: reorderItems(prev.staff, from, to),
    }));
    setStaffMemberInput({});
  }, []);

  const moveAnimeStaffItem = useCallback((from: number, to: number) => {
    if (from === to) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      animeStaff: reorderItems(prev.animeStaff, from, to),
    }));
    setAnimeStaffMemberInput({});
  }, []);

  const moveEpisodeItem = useCallback(
    (from: number, to: number) => {
      if (from === to) {
        return;
      }
      setFormState((prev) => ({
        ...prev,
        episodeDownloads: reorderItems(prev.episodeDownloads, from, to),
      }));
      setCollapsedEpisodes((prev) => {
        const flags = Array.from(
          { length: formState.episodeDownloads.length },
          (_, idx) => prev[idx] ?? false,
        );
        const nextFlags = reorderItems(flags, from, to);
        const next: Record<number, boolean> = {};
        nextFlags.forEach((value, idx) => {
          next[idx] = value;
        });
        return next;
      });
    },
    [formState.episodeDownloads.length],
  );

  const handleRelationDrop = (targetIndex: number) => {
    if (relationDragIndex === null || relationDragIndex === targetIndex) {
      setRelationDragIndex(null);
      return;
    }
    moveRelationItem(relationDragIndex, targetIndex);
    setRelationDragIndex(null);
  };

  const handleStaffDrop = (targetIndex: number) => {
    if (staffDragIndex === null || staffDragIndex === targetIndex) {
      setStaffDragIndex(null);
      return;
    }
    moveStaffItem(staffDragIndex, targetIndex);
    setStaffDragIndex(null);
  };

  const handleAnimeStaffDrop = (targetIndex: number) => {
    if (animeStaffDragIndex === null || animeStaffDragIndex === targetIndex) {
      setAnimeStaffDragIndex(null);
      return;
    }
    moveAnimeStaffItem(animeStaffDragIndex, targetIndex);
    setAnimeStaffDragIndex(null);
  };

  const handleEpisodeDrop = (targetIndex: number) => {
    if (episodeDragId === null || episodeDragId === targetIndex) {
      setEpisodeDragId(null);
      return;
    }
    moveEpisodeItem(episodeDragId, targetIndex);
    setEpisodeDragId(null);
  };

  const editorSectionClassName =
    "project-editor-section rounded-2xl border border-border/60 bg-card/70 px-4";
  const editorSectionTriggerClassName =
    "project-editor-section-trigger flex w-full items-start gap-4 py-3.5 text-left hover:no-underline md:py-4";
  const editorSectionContentClassName = "project-editor-section-content pb-2.5 px-1";
  const adjacentMetadataInputClassName = dashboardStrongFocusFieldClassName;
  const editorSectionBlockClassName = "space-y-4";
  const editorSectionBlockTitleClassName = "text-sm font-semibold text-foreground";
  const editorSectionBlockDividerClassName = "border-t border-border/50 pt-5";
  const chapterOpenContentClassName = "project-editor-open-overflow";
  const editorProjectLabel = editingProject ? "Projeto em edição" : "Novo projeto";
  const editorProjectTitle = formState.title.trim() || "Sem título";
  const editorProjectId = formState.id.trim() || "Será definido ao salvar";
  const editorTypeLabel = formState.type || "Formato";
  const editorStatusLabel = formState.status || "Status";
  const editorEpisodeCount = formState.episodeDownloads.length;
  const DedicatedEditorFooterIcon = getDedicatedEditorCtaIcon(formState.type);
  const lightNovelContentHref = editingProject?.id
    ? buildDashboardProjectChaptersEditorHref(editingProject.id)
    : "";
  const animeContentHref = editingProject?.id
    ? buildDashboardProjectEpisodesEditorHref(editingProject.id)
    : "";
  const publicProjectHref = editingProject?.id ? buildProjectPublicHref(editingProject.id) : "";
  const episodesSectionProps = useDashboardProjectsEditorController({
    sectionClassName: editorSectionClassName,
    triggerClassName: editorSectionTriggerClassName,
    contentClassName: editorSectionContentClassName,
    contentPanelClassName: isChapterBased ? chapterOpenContentClassName : undefined,
    title: isChapterBased ? "Conteúdo" : "Episódios",
    subtitle: `${formState.episodeDownloads.length} ${
      isChapterBased ? "capítulos" : "episódios"
    }`,
  });
  const hasBlockingLoadError = !hasLoadedOnce && hasLoadError;
  const hasRetainedLoadError = hasLoadedOnce && hasLoadError;
  const showProjectsSurfaceSkeleton = !hasResolvedProjects && !hasBlockingLoadError;

  useDashboardRefreshToast({
    active: isRefreshing && hasLoadedOnce,
    title: "Atualizando projetos",
    description: "Buscando a lista mais recente de projetos.",
  });

  return (
    <>
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={!hasLoadedCurrentUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <DashboardPageContainer>
          <DashboardPageHeader
            badge="Projetos"
            title="Gerenciar projetos"
            description="Crie, edite e organize os projetos visíveis no site."
            actions={
              <Button className="gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Novo projeto
              </Button>
            }
          />

          <section className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 animate-slide-up opacity-0">
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <div className="w-full max-w-sm">
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar por título, tags, estúdio..."
                  />
                </div>
                <Select
                  value={sortMode}
                  onValueChange={(value) => setSortMode(value as typeof sortMode)}
                >
                  <SelectTrigger className="w-[210px]">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Mais recentes</SelectItem>
                    <SelectItem value="alpha">Ordem alfabética</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="views">Visualizações</SelectItem>
                    <SelectItem value="comments">Comentários</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selectedType}
                  onValueChange={setSelectedType}
                  disabled={!hasResolvedProjectTypes}
                >
                  <SelectTrigger className="w-[210px]" aria-label="Filtrar por formato">
                    <SelectValue placeholder="Todos os formatos" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="secondary" className="text-xs uppercase animate-slide-up opacity-0">
                {sortedProjects.length} projetos
              </Badge>
            </div>

            {hasRetainedLoadError ? (
              <Alert className={dashboardPageLayoutTokens.surfaceSolid}>
                <AlertTitle>Atualização parcial indisponível</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                  <span>Mantendo a última lista de projetos carregada.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshProjects}
                  >
                    Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            ) : hasBlockingLoadError ? (
              <AsyncState
                kind="error"
                title="Não foi possível carregar os projetos"
                description="Tente recarregar os dados do painel."
                className={dashboardPageLayoutTokens.surfaceSolid}
                action={
                  <Button
                    variant="outline"
                    onClick={refreshProjects}
                  >
                    Recarregar
                  </Button>
                }
              />
            ) : showProjectsSurfaceSkeleton ? (
              <div className="grid gap-6" data-testid="dashboard-projects-skeleton-surface">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Card
                    key={`project-skeleton-${index}`}
                    lift={false}
                    className={`${dashboardPageLayoutTokens.listCardSolid} overflow-hidden`}
                  >
                    <CardContent className="grid gap-2 p-0 md:gap-6 md:grid-cols-[220px_1fr]">
                      <Skeleton className="aspect-2/3 w-full rounded-none md:min-h-[260px]" />
                      <div className="space-y-4 p-6">
                        <div className="flex gap-2">
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                        <Skeleton className="h-7 w-2/5" />
                        <Skeleton className="h-4 w-1/5" />
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-3/5" />
                        <div className="grid gap-2 md:grid-cols-3">
                          <Skeleton className="h-16 w-full rounded-xl" />
                          <Skeleton className="h-16 w-full rounded-xl" />
                          <Skeleton className="h-16 w-full rounded-xl" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : sortedProjects.length === 0 ? (
              <AsyncState
                kind="empty"
                title="Nenhum projeto encontrado."
                description="Ajuste os filtros ou crie um novo projeto."
                className={dashboardPageLayoutTokens.surfaceInset}
                action={
                  <Button
                    onClick={openCreate}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Criar primeiro projeto
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-6">
                {paginatedProjects.map((project, index) => {
                  const dedicatedEditorHref = isChapterBasedType(project.type || "")
                    ? buildDashboardProjectChaptersEditorHref(project.id)
                    : buildDashboardProjectEpisodesEditorHref(project.id);
                  const DedicatedEditorIcon = getDedicatedEditorCtaIcon(project.type);

                  return (
                    <Card
                      key={project.id}
                      data-testid={`dashboard-project-card-${project.id}`}
                      lift={false}
                      className={`${dashboardPageLayoutTokens.listCardSolid} ${dashboardStrongSurfaceHoverClassName} group overflow-hidden transition animate-fade-in opacity-0`}
                      style={dashboardAnimationDelay(dashboardClampedStaggerMs(index))}
                    >
                      <CardContent className="relative p-0">
                        <button
                          type="button"
                          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/60"
                          aria-label={`Abrir projeto ${project.title}`}
                          onClick={() => openEdit(project)}
                        >
                          <span className="sr-only">{`Abrir projeto ${project.title}`}</span>
                        </button>
                        <div className="grid gap-2 md:gap-6 md:grid-cols-[220px_1fr]">
                          <div
                            data-slot="project-card-cover"
                            className="relative aspect-2/3 w-full"
                          >
                            <img
                              src={project.cover || "/placeholder.svg"}
                              alt={project.title}
                              className="pointer-events-none h-full w-full object-cover object-center"
                              loading="lazy"
                            />
                          </div>
                          <div
                            data-slot="project-card-content"
                            className="flex h-full min-h-0 flex-1 flex-col p-6"
                          >
                            <div
                              data-slot="project-card-top"
                              className="flex flex-col items-start gap-4 md:flex-row md:items-start md:justify-between"
                            >
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    {project.status}
                                  </Badge>
                                  <Badge variant="secondary" className="text-[10px] uppercase">
                                    {project.type}
                                  </Badge>
                                </div>
                                <h3 className="clamp-safe-2 break-words text-lg font-semibold text-muted-foreground transition-colors duration-300 group-hover:text-primary">
                                  {project.title}
                                </h3>
                                <p className={`text-xs ${dashboardPageLayoutTokens.cardMetaText}`}>
                                  {project.studio}
                                </p>
                              </div>
                              <div className="relative z-20 flex shrink-0 flex-wrap items-center justify-end gap-2">
                                <Button variant="ghost" size="icon" title="Editor dedicado" asChild>
                                  <Link
                                    to={dedicatedEditorHref}
                                    aria-label={`Abrir editor dedicado de ${project.title}`}
                                  >
                                    <DedicatedEditorIcon className="h-4 w-4" aria-hidden="true" />
                                  </Link>
                                </Button>
                                <Button variant="ghost" size="icon" title="Visualizar" asChild>
                                  <Link to={buildProjectPublicHref(project.id)}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Copiar link"
                                  onClick={() => {
                                    const url = `${window.location.origin}${buildProjectPublicHref(project.id)}`;
                                    navigator.clipboard.writeText(url).catch(() => {
                                      const textarea = document.createElement("textarea");
                                      textarea.value = url;
                                      document.body.appendChild(textarea);
                                      textarea.select();
                                      document.execCommand("copy");
                                      document.body.removeChild(textarea);
                                    });
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Excluir"
                                  onClick={() => {
                                    setDeleteTarget(project);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>

                            <div
                              data-slot="project-card-middle"
                              className="mt-4 flex min-h-0 flex-1 flex-col gap-4"
                            >
                              <p
                                data-slot="project-card-synopsis"
                                className={`text-sm ${dashboardPageLayoutTokens.cardMetaText} line-clamp-3`}
                              >
                                {project.synopsis}
                              </p>

                              {project.tags.length > 0 ? (
                                <div data-slot="project-card-tags" className="flex flex-wrap gap-2">
                                  {sortByTranslatedLabel(project.tags || [], (tag) =>
                                    translateTag(tag, tagTranslationMap),
                                  )
                                    .slice(0, 4)
                                    .map((tag) => (
                                      <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="text-[10px] uppercase"
                                      >
                                        {translateTag(tag, tagTranslationMap)}
                                      </Badge>
                                    ))}
                                </div>
                              ) : null}
                              {project.genres?.length ? (
                                <div
                                  data-slot="project-card-genres"
                                  className="flex flex-wrap gap-2"
                                >
                                  {sortByTranslatedLabel(project.genres || [], (genre) =>
                                    translateGenre(genre, genreTranslationMap),
                                  )
                                    .slice(0, 4)
                                    .map((genre) => (
                                      <Badge
                                        key={genre}
                                        variant="outline"
                                        className="text-[10px] uppercase"
                                      >
                                        {translateGenre(genre, genreTranslationMap)}
                                      </Badge>
                                    ))}
                                </div>
                              ) : null}

                              <div
                                data-slot="project-card-meta"
                                className={`mt-auto flex flex-wrap items-center gap-4 text-xs ${dashboardPageLayoutTokens.cardMetaText}`}
                              >
                                <span className="inline-flex items-center gap-2">
                                  {project.views} visualizações
                                </span>
                                <span className="inline-flex items-center gap-2">
                                  {project.commentsCount} comentários
                                </span>
                                <span
                                  className={`ml-auto text-xs ${dashboardPageLayoutTokens.cardMetaText}`}
                                >
                                  ID {project.id}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            {sortedProjects.length > projectsPerPage ? (
              <div className="mt-6 flex justify-center">
                <CompactPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            ) : null}
            {trashedProjects.length > 0 ? (
              <Card lift={false} className={`mt-8 ${dashboardPageLayoutTokens.surfaceSolid}`}>
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Lixeira</h3>
                      <p className="text-xs text-muted-foreground">
                        Restaure em até 3 dias após a exclusão.
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs uppercase">
                      {trashedProjects.length} itens
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    {trashedProjects.map((project, index) => (
                      <div
                        key={`trash-${project.id}`}
                        className={`${dashboardPageLayoutTokens.surfaceInset} flex flex-wrap items-center justify-between gap-3 px-4 py-3 animate-slide-up opacity-0`}
                        style={dashboardAnimationDelay(dashboardClampedStaggerMs(index))}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{project.title}</p>
                          <p className="text-xs text-muted-foreground">ID {project.id}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            Restam {getRestoreRemainingLabel(project)}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestoreProject(project)}
                          >
                            Restaurar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </section>
        </DashboardPageContainer>
      </DashboardShell>

      <ProjectEditorDialogShell
        open={isEditorOpen}
        onOpenChange={handleEditorOpenChange}
        isScrolled={isEditorDialogScrolled}
        onScrolledChange={(nextScrolled) => {
          setIsEditorDialogScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
        }}
        isLibraryOpen={isLibraryOpen}
        editorProjectLabel={editorProjectLabel}
        anilistId={formState.anilistId}
        isEditing={Boolean(editingProject)}
        editorProjectTitle={editorProjectTitle}
        editorProjectId={editorProjectId}
        editorTypeLabel={editorTypeLabel}
        editorStatusLabel={editorStatusLabel}
        editorEpisodeCount={editorEpisodeCount}
        isChapterBased={isChapterBased}
        onCancel={requestCloseEditor}
        onSave={handleSave}
        footerLinks={
          <>
            {isChapterBased ? (
              lightNovelContentHref ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-10 gap-0 px-0 md:w-auto md:gap-2 md:px-4"
                  asChild
                >
                  <Link to={lightNovelContentHref}>
                    <DedicatedEditorFooterIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only md:not-sr-only">{"Conte\u00FAdo"}</span>
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-10 gap-0 px-0 md:w-auto md:gap-2 md:px-4"
                  disabled
                >
                  <DedicatedEditorFooterIcon className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only md:not-sr-only">{"Conte\u00FAdo"}</span>
                </Button>
              )
            ) : animeContentHref ? (
              <Button
                type="button"
                variant="outline"
                className="w-10 gap-0 px-0 md:w-auto md:gap-2 md:px-4"
                asChild
              >
                <Link to={animeContentHref}>
                  <Clapperboard className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only md:not-sr-only">{"Epis\u00F3dios"}</span>
                </Link>
              </Button>
            ) : null}
            {publicProjectHref ? (
              <Button
                type="button"
                variant="outline"
                className="w-10 gap-0 px-0 md:w-auto md:gap-2 md:px-4"
                asChild
              >
                <Link target="_blank" rel="noreferrer" to={publicProjectHref}>
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only md:not-sr-only">{"Visualizar p\u00E1gina"}</span>
                </Link>
              </Button>
            ) : null}
          </>
        }
      >
              <div className="project-editor-layout grid gap-3.5 px-4 pb-3 pt-2.5 md:gap-4 md:px-6 md:pb-4 lg:gap-5 lg:px-8">
                <Accordion
                  type="multiple"
                  value={editorAccordionValue}
                  onValueChange={setEditorAccordionValue}
                  className="project-editor-accordion space-y-2.5"
                >
                  <ProjectEditorImportSection
                    anilistIdInput={anilistIdInput}
                    onAnilistIdInputChange={setAnilistIdInput}
                    onImportAniList={handleImportAniList}
                    sectionClassName={editorSectionClassName}
                    triggerClassName={editorSectionTriggerClassName}
                    contentClassName={editorSectionContentClassName}
                  />
                  <ProjectEditorInformationSection
                    adjacentMetadataInputClassName={adjacentMetadataInputClassName}
                    animationStudioInput={animationStudioInput}
                    contentClassName={editorSectionContentClassName}
                    editorSectionBlockClassName={editorSectionBlockClassName}
                    editorSectionBlockDividerClassName={editorSectionBlockDividerClassName}
                    editorSectionBlockTitleClassName={editorSectionBlockTitleClassName}
                    formState={formState}
                    formatSelectOptions={formatSelectOptions}
                    genreInput={genreInput}
                    genreSuggestions={genreSuggestions}
                    genreTranslationMap={genreTranslationMap}
                    hasAniListReference={hasAniListReference}
                    onAddAnimationStudio={handleAddAnimationStudio}
                    onAddGenre={handleAddGenre}
                    onAddProducer={handleAddProducer}
                    onAddTag={handleAddTag}
                    onAppendGenreValue={appendGenreValue}
                    onAppendTagValue={appendTagValue}
                    onRemoveAnimationStudio={handleRemoveAnimationStudio}
                    onRemoveGenre={handleRemoveGenre}
                    onRemoveProducer={handleRemoveProducer}
                    onRemoveTag={handleRemoveTag}
                    producerInput={producerInput}
                    sectionClassName={editorSectionClassName}
                    setAnimationStudioInput={setAnimationStudioInput}
                    setFormState={setFormState}
                    setGenreInput={setGenreInput}
                    setProducerInput={setProducerInput}
                    setTagInput={setTagInput}
                    statusOptions={statusOptions}
                    tagInput={tagInput}
                    tagSuggestions={tagSuggestions}
                    tagTranslationMap={tagTranslationMap}
                    translatedSortedEditorGenres={translatedSortedEditorGenres}
                    translatedSortedEditorTags={translatedSortedEditorTags}
                    triggerClassName={editorSectionTriggerClassName}
                  />



                  <ProjectEditorMediaSection
                    banner={formState.banner}
                    cover={formState.cover}
                    editorSectionClassName={editorSectionClassName}
                    editorSectionContentClassName={editorSectionContentClassName}
                    editorSectionTriggerClassName={editorSectionTriggerClassName}
                    heroImageUrl={formState.heroImageUrl || ""}
                    onOpenLibrary={openLibraryForProjectImage}
                  />

                  <ProjectEditorRelationsSection
                    contentClassName={editorSectionContentClassName}
                    onDragStart={setRelationDragIndex}
                    onDrop={handleRelationDrop}
                    onMove={moveRelationItem}
                    relations={formState.relations}
                    sectionClassName={editorSectionClassName}
                    setFormState={setFormState}
                    triggerClassName={editorSectionTriggerClassName}
                  />

                  {isChapterBased ? (
                    <ProjectEditorEpisodesSection {...episodesSectionProps}>
                        <div ref={contentSectionRef} className="space-y-3">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {isChapterBased && supportsVolumeEntries ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={addVolumeEntry}
                              >
                                Adicionar volume
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleAddEpisodeDownload}
                            >
                              {isChapterBased ? "Adicionar capítulo" : "Adicionar episódio"}
                            </Button>
                            {!isChapterBased ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAnimeBatchStartNumber(
                                    String(
                                      resolveNextMainEpisodeNumber(formState.episodeDownloads, {
                                        isExtra: (episode) =>
                                          getEpisodeEntryKind(episode) === "extra",
                                      }),
                                    ),
                                  );
                                  setAnimeBatchCreateOpen(true);
                                }}
                              >
                                Criar lote
                              </Button>
                            ) : null}
                            {!isChapterBased && animeContentHref ? (
                              <Button type="button" size="sm" variant="outline" asChild>
                                <Link to={animeContentHref}>Abrir editor dedicado</Link>
                              </Button>
                            ) : null}
                          </div>
                          {!isChapterBased ? (
                            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/35 p-3">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] uppercase tracking-[0.12em]"
                                  >
                                    GestÃ£o rÃ¡pida
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] uppercase tracking-[0.12em]"
                                  >
                                    {filteredAnimeEpisodeItems.length} no filtro
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Select
                                    value={animeEpisodeFilter}
                                    onValueChange={(value) =>
                                      setAnimeEpisodeFilter(value as AnimeEpisodeQuickFilter)
                                    }
                                  >
                                    <SelectTrigger className="w-[220px]">
                                      <SelectValue placeholder="Filtrar episÃ³dios" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">Todos</SelectItem>
                                      <SelectItem value="published">Publicados</SelectItem>
                                      <SelectItem value="draft">Rascunhos</SelectItem>
                                      <SelectItem value="missing-links">Sem links</SelectItem>
                                      <SelectItem value="missing-date">Sem data</SelectItem>
                                      <SelectItem value="incomplete">Incompletos</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={selectAllFilteredAnimeEpisodes}
                                    disabled={filteredAnimeEpisodeItems.length === 0}
                                  >
                                    Selecionar visÃ­veis
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={clearSelectedAnimeEpisodes}
                                    disabled={selectedAnimeEpisodeKeys.length === 0}
                                  >
                                    Limpar seleÃ§Ã£o
                                  </Button>
                                </div>
                              </div>
                              {selectedAnimeEpisodeKeys.length > 0 ? (
                                <div className="grid gap-3 rounded-xl border border-border/60 bg-card/70 p-3">
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span>
                                      {selectedAnimeEpisodeKeys.length} episÃ³dio(s) selecionado(s)
                                    </span>
                                    <Badge variant="outline">AÃ§Ãµes em lote</Badge>
                                  </div>
                                  <div className="grid gap-3 xl:grid-cols-2">
                                    <div className="flex flex-wrap items-end gap-2">
                                      <DashboardFieldStack>
                                        <Label className="text-xs">Origem</Label>
                                        <Select
                                          value={animeBatchOperationSourceType}
                                          onValueChange={(value) =>
                                            setAnimeBatchOperationSourceType(
                                              value as EditorProjectEpisode["sourceType"],
                                            )
                                          }
                                        >
                                          <SelectTrigger className="w-[140px]">
                                            <SelectValue placeholder="Origem" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="TV">TV</SelectItem>
                                            <SelectItem value="Web">Web</SelectItem>
                                            <SelectItem value="Blu-ray">Blu-ray</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </DashboardFieldStack>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={applyAnimeBatchSourceType}
                                      >
                                        Aplicar origem
                                      </Button>
                                      <DashboardFieldStack>
                                        <Label className="text-xs">Status</Label>
                                        <Select
                                          value={animeBatchOperationPublicationStatus}
                                          onValueChange={(value) =>
                                            setAnimeBatchOperationPublicationStatus(
                                              value === "draft" ? "draft" : "published",
                                            )
                                          }
                                        >
                                          <SelectTrigger className="w-[140px]">
                                            <SelectValue placeholder="Status" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="draft">Rascunho</SelectItem>
                                            <SelectItem value="published">Publicado</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </DashboardFieldStack>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={applyAnimeBatchPublicationStatus}
                                      >
                                        Aplicar status
                                      </Button>
                                    </div>
                                    <div className="flex flex-wrap items-end gap-2">
                                      <DashboardFieldStack>
                                        <Label className="text-xs">DuraÃ§Ã£o</Label>
                                        <Input
                                          value={animeBatchOperationDuration}
                                          onChange={(event) =>
                                            setAnimeBatchOperationDuration(
                                              formatTimeDigitsToDisplay(event.target.value),
                                            )
                                          }
                                          placeholder="MM:SS ou H:MM:SS"
                                          className="w-[180px]"
                                        />
                                      </DashboardFieldStack>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={applyAnimeBatchDuration}
                                      >
                                        Aplicar duraÃ§Ã£o
                                      </Button>
                                      <DashboardFieldStack>
                                        <Label className="text-xs">Deslocar datas</Label>
                                        <Input
                                          type="number"
                                          value={animeBatchOperationShiftDays}
                                          onChange={(event) =>
                                            setAnimeBatchOperationShiftDays(event.target.value)
                                          }
                                          placeholder="Dias"
                                          className="w-[110px]"
                                        />
                                      </DashboardFieldStack>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={applyAnimeBatchShiftReleaseDates}
                                      >
                                        Aplicar datas
                                      </Button>
                                    </div>
                                  </div>
                                  <DashboardFieldStack>
                                    <Label className="text-xs">Etapas concluÃ­das</Label>
                                    <div className="flex flex-wrap gap-2">
                                      {stageOptions.map((stage) => {
                                        const isSelected =
                                          animeBatchOperationCompletedStages.includes(stage.id);
                                        return (
                                          <Button
                                            key={`anime-batch-stage-${stage.id}`}
                                            type="button"
                                            size="sm"
                                            variant={isSelected ? "default" : "outline"}
                                            onClick={() =>
                                              setAnimeBatchOperationCompletedStages((current) =>
                                                current.includes(stage.id)
                                                  ? current.filter((item) => item !== stage.id)
                                                  : [...current, stage.id],
                                              )
                                            }
                                          >
                                            {stage.label}
                                          </Button>
                                        );
                                      })}
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={applyAnimeBatchCompletedStages}
                                      >
                                        Aplicar etapas
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={applyAnimeBatchReplicateSources}
                                      >
                                        Replicar fontes
                                      </Button>
                                    </div>
                                  </DashboardFieldStack>
                                </div>
                              ) : null}
                              {removedAnimeEpisode ? (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2">
                                  <div className="text-sm text-muted-foreground">
                                    EpisÃ³dio removido do formulÃ¡rio. VocÃª pode desfazer antes de
                                    salvar.
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={undoRemoveAnimeEpisode}
                                  >
                                    Desfazer
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div
                            className={isChapterBased && supportsVolumeEntries ? "space-y-4" : ""}
                          >
                            <Accordion
                              type="multiple"
                              value={volumeGroupOpenValues}
                              onValueChange={handleVolumeGroupAccordionChange}
                              className="space-y-4"
                            >
                              {episodeGroupsForRender.map((group, groupIndex) => {
                                const visibleEpisodeItems = !isChapterBased
                                  ? group.episodeItems.filter(({ episode }) =>
                                      matchesAnimeEpisodeQuickFilter(episode, animeEpisodeFilter),
                                    )
                                  : group.episodeItems;
                                const groupVolumeEntry =
                                  group.volumeEntryIndex !== null
                                    ? formState.volumeEntries[group.volumeEntryIndex] || null
                                    : null;
                                const groupHasEpisodes = visibleEpisodeItems.length > 0;
                                const volumeLabel = group.hasNumericVolume
                                  ? `Volume ${group.volume}`
                                  : "Sem volume";
                                const volumeDescription = group.hasNumericVolume
                                  ? "Configure capa e sinopse para este volume."
                                  : "Capítulos sem volume usam capa e sinopse do próprio projeto.";
                                return (
                                  <AccordionItem
                                      ref={(node) => registerVolumeGroupNode(group.key, node)}
                                    key={`episode-group-${groupIndex}`}
                                    value={group.key}
                                    className="rounded-2xl border border-border/60 bg-card/40"
                                    data-testid={`volume-group-${group.key}`}
                                  >
                                    {isChapterBased && supportsVolumeEntries ? (
                                      <div className="flex w-full items-start gap-2 px-4 pb-3 pt-3">
                                        <AccordionTrigger
                                          headerClassName="flex-1 min-w-0"
                                          className="w-full gap-3 py-0 text-left hover:no-underline [&>svg]:mt-0 [&>svg]:self-center"
                                        >
                                          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-1">
                                            <div className="min-w-0 space-y-1">
                                              <Label className="cursor-pointer">
                                                {volumeLabel}
                                              </Label>
                                              <p className="text-xs text-muted-foreground">
                                                {volumeDescription}
                                              </p>
                                            </div>
                                            <Badge
                                              variant="outline"
                                              className="shrink-0 self-center text-[10px] uppercase"
                                            >
                                              {group.episodeItems.length} capítulo(s)
                                            </Badge>
                                          </div>
                                        </AccordionTrigger>
                                        {group.hasNumericVolume && groupVolumeEntry ? (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            data-no-toggle
                                            onClick={(event) => {
                                              event.preventDefault();
                                              event.stopPropagation();
                                              removeVolumeEntryByVolume(group.volume);
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        ) : null}
                                      </div>
                                    ) : null}
                                    <AccordionContent
                                      className="space-y-3 px-4 pb-3"
                                      contentClassName={
                                        isChapterBased ? chapterOpenContentClassName : undefined
                                      }
                                    >
                                      {group.hasNumericVolume ? (
                                        <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
                                          <div className="flex items-center gap-3">
                                            {groupVolumeEntry?.coverImageUrl ? (
                                              <img
                                                src={groupVolumeEntry.coverImageUrl}
                                                alt={
                                                  groupVolumeEntry.coverImageAlt || "Capa do volume"
                                                }
                                                className="h-16 w-12 rounded-lg object-cover"
                                              />
                                            ) : (
                                              <div className="flex h-16 w-12 items-center justify-center rounded-lg border border-dashed border-border/60 text-center text-[10px] text-muted-foreground leading-tight">
                                                Sem capa
                                              </div>
                                            )}
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() =>
                                                openLibraryForVolumeCover(group.volume)
                                              }
                                            >
                                              Biblioteca
                                            </Button>
                                          </div>
                                          <DashboardFieldStack>
                                            <Label className="text-xs">Alt</Label>
                                            <Input
                                              value={groupVolumeEntry?.coverImageAlt || ""}
                                              onChange={(event) =>
                                                updateVolumeEntryByVolume(
                                                  group.volume,
                                                  (entry) => ({
                                                    ...entry,
                                                    coverImageAlt: event.target.value,
                                                  }),
                                                )
                                              }
                                              placeholder="Texto alternativo da capa"
                                            />
                                          </DashboardFieldStack>
                                          <DashboardFieldStack>
                                            <Label className="text-xs">Sinopse do volume</Label>
                                            <Textarea
                                              value={groupVolumeEntry?.synopsis || ""}
                                              onChange={(event) =>
                                                updateVolumeEntryByVolume(
                                                  group.volume,
                                                  (entry) => ({
                                                    ...entry,
                                                    synopsis: event.target.value,
                                                  }),
                                                )
                                              }
                                              rows={3}
                                              placeholder="Resumo exibido nas páginas públicas para este volume"
                                            />
                                          </DashboardFieldStack>
                                        </div>
                                      ) : null}
                                      {!groupHasEpisodes ? (
                                        <div className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                                          Nenhum capítulo vinculado a este volume.
                                        </div>
                                      ) : null}
                                      <Accordion
                                        type="multiple"
                                        value={episodeOpenValues}
                                        onValueChange={handleEpisodeAccordionChange}
                                        className="space-y-3"
                                      >
                                        {visibleEpisodeItems.map(({ episode, index }) => {
                                          const isEpisodeCollapsed =
                                            collapsedEpisodes[index] ?? false;
                                          const entryKind = getEpisodeEntryKind(episode);
                                          const isExtraEntry = entryKind === "extra";
                                          const episodeUnitLabel = isChapterBased
                                            ? "Capítulo"
                                            : "Episódio";
                                          const episodeNumberLabel = isExtraEntry
                                            ? "Extra"
                                            : `${episodeUnitLabel} ${episode.number || index + 1}`;
                                          const episodeTitleLabel =
                                            String(episode.title || "").trim() || "Sem título";
                                          const episodeKey = buildEpisodeKey(
                                            episode.number,
                                            episode.volume,
                                          );
                                          const publicationStatus =
                                            episode.publicationStatus === "draft"
                                              ? "draft"
                                              : "published";
                                          const hasEpisodeContent =
                                            String(episode.content || "").trim().length > 0;
                                          const hasDownloadSource = (episode.sources || []).some(
                                            (source) => source.url,
                                          );
                                          const isProgressOnlyEntry =
                                            !hasDownloadSource &&
                                            !(isLightNovel && hasEpisodeContent);
                                          const currentProgressStageLabel =
                                            getProjectProgressStateForEditor(
                                              formState.type || "",
                                              episode.completedStages,
                                            ).currentStage.label;
                                          const statusLabel =
                                            publicationStatus === "draft"
                                              ? "Rascunho"
                                              : "Publicado";
                                          const availabilityLabel = isLightNovel
                                            ? hasEpisodeContent && hasDownloadSource
                                              ? "Híbrido"
                                              : hasEpisodeContent
                                                ? "Leitura"
                                                : hasDownloadSource
                                                  ? "Download"
                                                  : "Sem público"
                                            : hasDownloadSource
                                              ? "Download"
                                              : currentProgressStageLabel;
                                          const statusVisibilitySummary = `${statusLabel} • ${availabilityLabel}`;
                                          const animeCompletionBadges = !isChapterBased
                                            ? buildCompletionBadges(episode)
                                            : [];
                                          const isAnimeEpisodeSelected =
                                            !isChapterBased &&
                                            selectedAnimeEpisodeKeySet.has(
                                              String(episode._editorKey || ""),
                                            );
                                          const animeEpisodeEditorHref =
                                            !isChapterBased && editingProject?.id
                                              ? buildDashboardProjectEpisodeEditorHref(
                                                  editingProject.id,
                                                  episode.number,
                                                )
                                              : "";
                                          const chapterEditorHref =
                                            isLightNovel && editingProject?.id
                                              ? buildDashboardProjectChapterEditorHref(
                                                  editingProject.id,
                                                  episode.number,
                                                  episode.volume,
                                                )
                                              : "";

                                          return (
                                            <AccordionItem
                                              key={episode._editorKey || `legacy-episode-${index}`}
                                              value={getEpisodeAccordionValue(index)}
                                              className="border-none"
                                            >
                                              <Card
                                                ref={(node) => registerEpisodeCardNode(episode, node)}
                                                className="project-editor-episode-card border-border/60 bg-card/70 !shadow-none hover:!shadow-none"
                                                data-episode-key={episodeKey}
                                                data-testid={`episode-card-${index}`}
                                                onDragStart={() => setEpisodeDragId(null)}
                                              >
                                                <CardContent
                                                  className={`project-editor-episode-content space-y-3 ${isEpisodeCollapsed ? "p-3" : "p-4"}`}
                                                >
                                                  <div
                                                    className="project-editor-episode-header flex flex-wrap items-center justify-between gap-2"
                                                    data-testid={`episode-header-${index}`}
                                                    onClick={(event) =>
                                                      handleEpisodeHeaderClick(index, event)
                                                    }
                                                  >
                                                    <div className="min-w-0 flex flex-1 items-start gap-2">
                                                      {!isChapterBased ? (
                                                        <Checkbox
                                                          checked={isAnimeEpisodeSelected}
                                                          onCheckedChange={() =>
                                                            toggleSelectedAnimeEpisode(
                                                              String(episode._editorKey || ""),
                                                            )
                                                          }
                                                          aria-label={`Selecionar episódio ${episode.number || index + 1}`}
                                                        />
                                                      ) : null}
                                                      <AccordionTrigger
                                                        data-episode-accordion-trigger
                                                        className="project-editor-episode-trigger gap-3 py-0 text-left text-foreground hover:no-underline [&>svg]:mt-0 [&>svg]:self-center [&>svg]:shrink-0"
                                                      >
                                                        <div className="flex min-w-0 flex-col py-0.5">
                                                          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                                            {episodeNumberLabel}
                                                          </span>
                                                          <span className="line-clamp-1 text-sm font-semibold leading-tight">
                                                            {episodeTitleLabel}
                                                          </span>
                                                          {episode.releaseDate ? (
                                                            <span className="text-[11px] text-muted-foreground">
                                                              {formatEpisodeReleaseDate(
                                                                episode.releaseDate,
                                                                episode.duration,
                                                              )}
                                                            </span>
                                                          ) : null}
                                                        </div>
                                                      </AccordionTrigger>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                      <span
                                                        className="text-[11px] text-muted-foreground"
                                                        data-testid={`episode-header-status-visibility-${index}`}
                                                      >
                                                        {statusVisibilitySummary}
                                                      </span>
                                                      {!isChapterBased
                                                        ? animeCompletionBadges.map((badge) => (
                                                            <Badge
                                                              key={`${episode._editorKey || index}-${badge.issue}`}
                                                              variant="outline"
                                                              className="text-[10px] uppercase tracking-[0.08em]"
                                                            >
                                                              {badge.label}
                                                            </Badge>
                                                          ))
                                                        : null}
                                                      {!isChapterBased && animeEpisodeEditorHref ? (
                                                        <Button
                                                          type="button"
                                                          size="sm"
                                                          variant="outline"
                                                          className="h-7 px-2 text-[11px]"
                                                          data-no-toggle
                                                          asChild
                                                        >
                                                          <Link to={animeEpisodeEditorHref}>
                                                            Abrir
                                                          </Link>
                                                        </Button>
                                                      ) : null}
                                                      {!isChapterBased ? (
                                                        <Button
                                                          type="button"
                                                          size="sm"
                                                          variant="outline"
                                                          className="h-7 px-2 text-[11px]"
                                                          data-no-toggle
                                                          onClick={() =>
                                                            duplicateAnimeEpisode(episode)
                                                          }
                                                        >
                                                          Duplicar
                                                        </Button>
                                                      ) : null}
                                                      <ReorderControls
                                                        label={`item ${isExtraEntry ? "extra" : episode.number || index + 1}`}
                                                        index={index}
                                                        total={sortedEpisodeDownloads.length}
                                                        onMove={(targetIndex) =>
                                                          moveEpisodeItem(index, targetIndex)
                                                        }
                                                        buttonClassName="h-7 w-7"
                                                      />
                                                      <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                                                        data-no-toggle
                                                        onClick={() => {
                                                          if (!isChapterBased) {
                                                            removeAnimeEpisodeAtIndex(index);
                                                            return;
                                                          }
                                                          setFormState((prev) => ({
                                                            ...prev,
                                                            episodeDownloads:
                                                              prev.episodeDownloads.filter(
                                                                (_, idx) => idx !== index,
                                                              ),
                                                          }));
                                                          setEpisodeDateDraft((prev) =>
                                                            shiftDraftAfterRemoval(prev, index),
                                                          );
                                                          setEpisodeTimeDraft((prev) =>
                                                            shiftDraftAfterRemoval(prev, index),
                                                          );
                                                          setEpisodeSizeDrafts((prev) =>
                                                            shiftDraftAfterRemoval(prev, index),
                                                          );
                                                          setEpisodeSizeErrors((prev) =>
                                                            shiftDraftAfterRemoval(prev, index),
                                                          );
                                                          setCollapsedEpisodes((prev) =>
                                                            shiftCollapsedEpisodesAfterRemoval(
                                                              prev,
                                                              index,
                                                            ),
                                                          );
                                                        }}
                                                      >
                                                        {isChapterBased
                                                          ? "Remover capítulo"
                                                          : "Remover episódio"}
                                                      </Button>
                                                    </div>
                                                  </div>
                                                  <AccordionContent
                                                    className="project-editor-episode-panel pt-3 pb-0 px-1"
                                                    contentClassName={
                                                      isChapterBased
                                                        ? chapterOpenContentClassName
                                                        : undefined
                                                    }
                                                  >
                                                    <div className="project-editor-episode-group project-editor-episode-basics grid gap-3 md:grid-cols-[minmax(120px,0.9fr)_minmax(84px,0.7fr)_minmax(84px,0.7fr)_minmax(180px,1.4fr)_minmax(150px,1fr)_minmax(110px,0.8fr)_minmax(130px,0.9fr)]">
                                                      <Select
                                                        value={isExtraEntry ? "extra" : "main"}
                                                        onValueChange={(value) =>
                                                          setEpisodeEntryKind(
                                                            index,
                                                            value === "extra" ? "extra" : "main",
                                                          )
                                                        }
                                                      >
                                                        <SelectTrigger aria-label="Tipo da entrada">
                                                          <SelectValue placeholder="Tipo" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          <SelectItem value="main">
                                                            Principal
                                                          </SelectItem>
                                                          <SelectItem value="extra">
                                                            Extra
                                                          </SelectItem>
                                                        </SelectContent>
                                                      </Select>
                                                      <Input
                                                        type="number"
                                                        value={episode.number}
                                                        disabled={isExtraEntry}
                                                        onChange={(event) =>
                                                          setFormState((prev) => {
                                                            const next = [...prev.episodeDownloads];
                                                            next[index] = {
                                                              ...next[index],
                                                              number: Number(event.target.value),
                                                            };
                                                            return {
                                                              ...prev,
                                                              episodeDownloads: next,
                                                            };
                                                          })
                                                        }
                                                        placeholder={
                                                          isExtraEntry ? "Técnico" : "Número"
                                                        }
                                                      />
                                                      {isChapterBased ? (
                                                        <Input
                                                          type="number"
                                                          value={episode.volume || ""}
                                                          onChange={(event) =>
                                                            setFormState((prev) => {
                                                              const next = [
                                                                ...prev.episodeDownloads,
                                                              ];
                                                              next[index] = {
                                                                ...next[index],
                                                                volume: event.target.value
                                                                  ? Number(event.target.value)
                                                                  : undefined,
                                                              };
                                                              return {
                                                                ...prev,
                                                                episodeDownloads: next,
                                                              };
                                                            })
                                                          }
                                                          placeholder="Volume"
                                                        />
                                                      ) : null}
                                                      <Input
                                                        value={episode.title}
                                                        onChange={(event) =>
                                                          setFormState((prev) => {
                                                            const next = [...prev.episodeDownloads];
                                                            next[index] = {
                                                              ...next[index],
                                                              title: event.target.value,
                                                            };
                                                            return {
                                                              ...prev,
                                                              episodeDownloads: next,
                                                            };
                                                          })
                                                        }
                                                        placeholder="Título"
                                                      />
                                                      {isLightNovel ? (
                                                        <Select
                                                          value={publicationStatus}
                                                          onValueChange={(value) =>
                                                            setFormState((prev) => {
                                                              const next = [
                                                                ...prev.episodeDownloads,
                                                              ];
                                                              next[index] = {
                                                                ...next[index],
                                                                publicationStatus:
                                                                  value === "draft"
                                                                    ? "draft"
                                                                    : "published",
                                                              };
                                                              return {
                                                                ...prev,
                                                                episodeDownloads: next,
                                                              };
                                                            })
                                                          }
                                                        >
                                                          <SelectTrigger>
                                                            <SelectValue placeholder="Status" />
                                                          </SelectTrigger>
                                                          <SelectContent>
                                                            <SelectItem value="draft">
                                                              Rascunho
                                                            </SelectItem>
                                                            <SelectItem value="published">
                                                              Publicado
                                                            </SelectItem>
                                                          </SelectContent>
                                                        </Select>
                                                      ) : null}
                                                      <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={
                                                          episodeDateDraft[index] ??
                                                          isoToDisplayDate(episode.releaseDate)
                                                        }
                                                        onChange={(event) => {
                                                          const masked = formatDateDigitsToDisplay(
                                                            event.target.value,
                                                          );
                                                          const digits = digitsOnly(masked);
                                                          setEpisodeDateDraft((prev) => ({
                                                            ...prev,
                                                            [index]: masked,
                                                          }));
                                                          if (digits.length === 8) {
                                                            const iso = displayDateToIso(masked);
                                                            if (iso) {
                                                              setFormState((prev) => {
                                                                const next = [
                                                                  ...prev.episodeDownloads,
                                                                ];
                                                                next[index] = {
                                                                  ...next[index],
                                                                  releaseDate: iso,
                                                                };
                                                                return {
                                                                  ...prev,
                                                                  episodeDownloads: next,
                                                                };
                                                              });
                                                            }
                                                          } else if (digits.length === 0) {
                                                            setFormState((prev) => {
                                                              const next = [
                                                                ...prev.episodeDownloads,
                                                              ];
                                                              next[index] = {
                                                                ...next[index],
                                                                releaseDate: "",
                                                              };
                                                              return {
                                                                ...prev,
                                                                episodeDownloads: next,
                                                              };
                                                            });
                                                          }
                                                        }}
                                                        onBlur={(event) => {
                                                          const masked = formatDateDigitsToDisplay(
                                                            event.target.value,
                                                          );
                                                          const digits = digitsOnly(masked);
                                                          if (digits.length === 8) {
                                                            const iso = displayDateToIso(masked);
                                                            if (iso) {
                                                              setFormState((prev) => {
                                                                const next = [
                                                                  ...prev.episodeDownloads,
                                                                ];
                                                                next[index] = {
                                                                  ...next[index],
                                                                  releaseDate: iso,
                                                                };
                                                                return {
                                                                  ...prev,
                                                                  episodeDownloads: next,
                                                                };
                                                              });
                                                            }
                                                          } else if (digits.length === 0) {
                                                            setFormState((prev) => {
                                                              const next = [
                                                                ...prev.episodeDownloads,
                                                              ];
                                                              next[index] = {
                                                                ...next[index],
                                                                releaseDate: "",
                                                              };
                                                              return {
                                                                ...prev,
                                                                episodeDownloads: next,
                                                              };
                                                            });
                                                          }
                                                          setEpisodeDateDraft((prev) => {
                                                            const next = { ...prev };
                                                            delete next[index];
                                                            return next;
                                                          });
                                                        }}
                                                        placeholder="DD/MM/AAAA"
                                                        className="md:min-w-[150px]"
                                                      />
                                                      {!isChapterBased ? (
                                                        <Input
                                                          type="text"
                                                          inputMode="numeric"
                                                          value={
                                                            episodeTimeDraft[index] ??
                                                            canonicalToDisplayTime(episode.duration)
                                                          }
                                                          onChange={(event) => {
                                                            const masked =
                                                              formatTimeDigitsToDisplay(
                                                                event.target.value,
                                                              );
                                                            const digits = digitsOnly(masked);
                                                            setEpisodeTimeDraft((prev) => ({
                                                              ...prev,
                                                              [index]: masked,
                                                            }));
                                                            const canonical =
                                                              displayTimeToCanonical(masked);
                                                            if (canonical) {
                                                              setFormState((prev) => {
                                                                const next = [
                                                                  ...prev.episodeDownloads,
                                                                ];
                                                                next[index] = {
                                                                  ...next[index],
                                                                  duration: canonical,
                                                                };
                                                                return {
                                                                  ...prev,
                                                                  episodeDownloads: next,
                                                                };
                                                              });
                                                            } else if (digits.length === 0) {
                                                              setFormState((prev) => {
                                                                const next = [
                                                                  ...prev.episodeDownloads,
                                                                ];
                                                                next[index] = {
                                                                  ...next[index],
                                                                  duration: "",
                                                                };
                                                                return {
                                                                  ...prev,
                                                                  episodeDownloads: next,
                                                                };
                                                              });
                                                            }
                                                          }}
                                                          onBlur={(event) => {
                                                            const masked =
                                                              formatTimeDigitsToDisplay(
                                                                event.target.value,
                                                              );
                                                            const digits = digitsOnly(masked);
                                                            const canonical =
                                                              displayTimeToCanonical(masked);
                                                            if (canonical) {
                                                              setFormState((prev) => {
                                                                const next = [
                                                                  ...prev.episodeDownloads,
                                                                ];
                                                                next[index] = {
                                                                  ...next[index],
                                                                  duration: canonical,
                                                                };
                                                                return {
                                                                  ...prev,
                                                                  episodeDownloads: next,
                                                                };
                                                              });
                                                            } else if (digits.length === 0) {
                                                              setFormState((prev) => {
                                                                const next = [
                                                                  ...prev.episodeDownloads,
                                                                ];
                                                                next[index] = {
                                                                  ...next[index],
                                                                  duration: "",
                                                                };
                                                                return {
                                                                  ...prev,
                                                                  episodeDownloads: next,
                                                                };
                                                              });
                                                            }
                                                            setEpisodeTimeDraft((prev) => {
                                                              const next = { ...prev };
                                                              delete next[index];
                                                              return next;
                                                            });
                                                          }}
                                                          placeholder="MM:SS ou H:MM:SS"
                                                          className="md:min-w-[150px]"
                                                        />
                                                      ) : null}
                                                      {!isChapterBased ? (
                                                        <Select
                                                          value={episode.sourceType}
                                                          onValueChange={(value) =>
                                                            setFormState((prev) => {
                                                              const next = [
                                                                ...prev.episodeDownloads,
                                                              ];
                                                              next[index] = {
                                                                ...next[index],
                                                                sourceType:
                                                                  value as EditorProjectEpisode["sourceType"],
                                                              };
                                                              return {
                                                                ...prev,
                                                                episodeDownloads: next,
                                                              };
                                                            })
                                                          }
                                                        >
                                                          <SelectTrigger>
                                                            <SelectValue placeholder="Origem" />
                                                          </SelectTrigger>
                                                          <SelectContent>
                                                            <SelectItem value="TV">TV</SelectItem>
                                                            <SelectItem value="Web">Web</SelectItem>
                                                            <SelectItem value="Blu-ray">
                                                              Blu-ray
                                                            </SelectItem>
                                                          </SelectContent>
                                                        </Select>
                                                      ) : null}
                                                    </div>
                                                    {isProgressOnlyEntry ? (
                                                      <div className="project-editor-episode-group mt-3 space-y-2">
                                                        <Label className="text-xs">
                                                          Etapa atual
                                                        </Label>
                                                        <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                                                          {currentProgressStageLabel}
                                                        </div>
                                                      </div>
                                                    ) : null}
                                                    <div className="project-editor-episode-group mt-3 space-y-2">
                                                      <Label className="text-xs">
                                                        {isChapterBased
                                                          ? "Capa do capítulo"
                                                          : "Capa do episódio"}
                                                      </Label>
                                                      <div className="flex flex-wrap items-center gap-3">
                                                        {episode.coverImageUrl ? (
                                                          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-3 py-2">
                                                            <img
                                                              src={episode.coverImageUrl}
                                                              alt={episode.title || "Capa"}
                                                              className="h-12 w-12 rounded-lg object-cover"
                                                            />
                                                          </div>
                                                        ) : (
                                                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border/60 text-center text-[10px] text-muted-foreground leading-tight">
                                                            Sem imagem
                                                          </div>
                                                        )}
                                                        <Button
                                                          type="button"
                                                          size="sm"
                                                          variant="outline"
                                                          onClick={() =>
                                                            openLibraryForEpisodeCover(index)
                                                          }
                                                        >
                                                          Biblioteca
                                                        </Button>
                                                      </div>
                                                    </div>
                                                    {isLightNovel ? (
                                                      <div className="project-editor-episode-group mt-3">
                                                        <Label className="text-xs">
                                                          Conteúdo do capítulo
                                                        </Label>
                                                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-4 py-3">
                                                          {chapterEditorHref ? (
                                                            <Button type="button" size="sm" asChild>
                                                              <Link to={chapterEditorHref}>
                                                                Abrir editor dedicado
                                                              </Link>
                                                            </Button>
                                                          ) : (
                                                            <Button
                                                              type="button"
                                                              size="sm"
                                                              disabled
                                                            >
                                                              Salve o projeto para editar
                                                            </Button>
                                                          )}
                                                          <Badge
                                                            variant={
                                                              hasEpisodeContent
                                                                ? "secondary"
                                                                : "outline"
                                                            }
                                                          >
                                                            {hasEpisodeContent
                                                              ? "Com conte?do"
                                                              : "Sem conte?do"}
                                                          </Badge>
                                                        </div>
                                                        <div
                                                          className="mt-3"
                                                          onFocusCapture={(event) => {
                                                            const target =
                                                              event.target as HTMLElement | null;
                                                            if (
                                                              target?.closest(".lexical-playground")
                                                            ) {
                                                              return;
                                                            }
                                                            const editor =
                                                              chapterEditorsRef.current[index];
                                                            editor?.blur?.();
                                                          }}
                                                        >
                                                          <EpisodeContentEditor
                                                            value={episode.content || ""}
                                                            imageLibraryOptions={buildEpisodeLibraryOptions(
                                                              episode,
                                                              index,
                                                            )}
                                                            onRegister={(handlers) => {
                                                              chapterEditorsRef.current[index] =
                                                                handlers;
                                                            }}
                                                            onChange={(nextValue) =>
                                                              setFormState((prev) => {
                                                                const next = [
                                                                  ...prev.episodeDownloads,
                                                                ];
                                                                next[index] = {
                                                                  ...next[index],
                                                                  content: nextValue,
                                                                };
                                                                return {
                                                                  ...prev,
                                                                  episodeDownloads: next,
                                                                };
                                                              })
                                                            }
                                                          />
                                                        </div>
                                                      </div>
                                                    ) : null}
                                                    {isProgressOnlyEntry ? (
                                                      <div className="project-editor-episode-group mt-3">
                                                        <Label className="text-xs">
                                                          Etapas concluídas
                                                        </Label>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                          {stageOptions.map((stage) => {
                                                            const completed = (
                                                              episode.completedStages || []
                                                            ).includes(stage.id);
                                                            return (
                                                              <Button
                                                                key={stage.id}
                                                                type="button"
                                                                size="sm"
                                                                variant={
                                                                  completed ? "default" : "outline"
                                                                }
                                                                onClick={() =>
                                                                  setFormState((prev) => {
                                                                    const next = [
                                                                      ...prev.episodeDownloads,
                                                                    ];
                                                                    const current =
                                                                      next[index].completedStages ||
                                                                      [];
                                                                    next[index] = {
                                                                      ...next[index],
                                                                      completedStages: completed
                                                                        ? current.filter(
                                                                            (item) =>
                                                                              item !== stage.id,
                                                                          )
                                                                        : [...current, stage.id],
                                                                    };
                                                                    return {
                                                                      ...prev,
                                                                      episodeDownloads: next,
                                                                    };
                                                                  })
                                                                }
                                                              >
                                                                {stage.label}
                                                              </Button>
                                                            );
                                                          })}
                                                        </div>
                                                      </div>
                                                    ) : null}
                                                    <div className="project-editor-episode-group mt-3 space-y-3">
                                                      <div hidden={isLightNovel}>
                                                        <Label className="text-xs">
                                                          Arquivo do episódio
                                                        </Label>
                                                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                                                          <div className="space-y-1">
                                                            <Input
                                                              ref={(node) => {
                                                                episodeSizeInputRefs.current[
                                                                  index
                                                                ] = node;
                                                              }}
                                                              value={
                                                                episodeSizeDrafts[index] ??
                                                                (episode.sizeBytes
                                                                  ? formatBytesCompact(
                                                                      episode.sizeBytes,
                                                                    )
                                                                  : "")
                                                              }
                                                              onChange={(event) => {
                                                                const nextValue =
                                                                  event.target.value;
                                                                setEpisodeSizeDrafts((prev) => ({
                                                                  ...prev,
                                                                  [index]: nextValue,
                                                                }));
                                                                setEpisodeSizeErrors((prev) => {
                                                                  if (!prev[index]) {
                                                                    return prev;
                                                                  }
                                                                  const next = { ...prev };
                                                                  delete next[index];
                                                                  return next;
                                                                });
                                                              }}
                                                              onBlur={(event) => {
                                                                const rawValue =
                                                                  episodeSizeDrafts[index] ??
                                                                  event.target.value;
                                                                const trimmedSize = String(
                                                                  rawValue || "",
                                                                ).trim();
                                                                if (!trimmedSize) {
                                                                  setFormState((prev) => {
                                                                    const next = [
                                                                      ...prev.episodeDownloads,
                                                                    ];
                                                                    next[index] = {
                                                                      ...next[index],
                                                                      sizeBytes: undefined,
                                                                    };
                                                                    return {
                                                                      ...prev,
                                                                      episodeDownloads: next,
                                                                    };
                                                                  });
                                                                  setEpisodeSizeDrafts((prev) => {
                                                                    const next = { ...prev };
                                                                    delete next[index];
                                                                    return next;
                                                                  });
                                                                  setEpisodeSizeErrors((prev) => {
                                                                    const next = { ...prev };
                                                                    delete next[index];
                                                                    return next;
                                                                  });
                                                                  return;
                                                                }

                                                                const parsedSize =
                                                                  parseHumanSizeToBytes(
                                                                    trimmedSize,
                                                                  );
                                                                if (!parsedSize) {
                                                                  setEpisodeSizeErrors((prev) => ({
                                                                    ...prev,
                                                                    [index]:
                                                                      "Use formatos como 700 MB ou 1.4 GB.",
                                                                  }));
                                                                  setEpisodeSizeDrafts((prev) => ({
                                                                    ...prev,
                                                                    [index]: rawValue,
                                                                  }));
                                                                  return;
                                                                }

                                                                setFormState((prev) => {
                                                                  const next = [
                                                                    ...prev.episodeDownloads,
                                                                  ];
                                                                  next[index] = {
                                                                    ...next[index],
                                                                    sizeBytes: parsedSize,
                                                                  };
                                                                  return {
                                                                    ...prev,
                                                                    episodeDownloads: next,
                                                                  };
                                                                });
                                                                setEpisodeSizeDrafts((prev) => {
                                                                  const next = { ...prev };
                                                                  delete next[index];
                                                                  return next;
                                                                });
                                                                setEpisodeSizeErrors((prev) => {
                                                                  const next = { ...prev };
                                                                  delete next[index];
                                                                  return next;
                                                                });
                                                              }}
                                                              placeholder="Tamanho (ex.: 700 MB ou 1.4 GB)"
                                                            />
                                                            {episodeSizeErrors[index] ? (
                                                              <p className="text-[11px] text-destructive">
                                                                {episodeSizeErrors[index]}
                                                              </p>
                                                            ) : (
                                                              <p className="text-[11px] text-muted-foreground">
                                                                Campo opcional. Valor salvo em
                                                                bytes.
                                                              </p>
                                                            )}
                                                          </div>
                                                          <Input
                                                            value={episode.hash || ""}
                                                            onChange={(event) =>
                                                              setFormState((prev) => {
                                                                const next = [
                                                                  ...prev.episodeDownloads,
                                                                ];
                                                                next[index] = {
                                                                  ...next[index],
                                                                  hash: event.target.value,
                                                                };
                                                                return {
                                                                  ...prev,
                                                                  episodeDownloads: next,
                                                                };
                                                              })
                                                            }
                                                            placeholder="Hash (ex.: SHA-256: ...)"
                                                          />
                                                        </div>
                                                      </div>

                                                      <div>
                                                        <Label className="text-xs">
                                                          Fontes de download
                                                        </Label>
                                                        <div className="mt-2 grid gap-2">
                                                          {(episode.sources || []).map(
                                                            (source, sourceIndex) => (
                                                              <div
                                                                key={`${source.label}-${sourceIndex}`}
                                                                className="rounded-xl border border-border/60 bg-background/40 p-3"
                                                              >
                                                                <div className="grid items-start gap-2 md:grid-cols-[minmax(180px,1fr)_minmax(240px,2fr)_auto]">
                                                                  <DownloadSourceSelect
                                                                    value={source.label}
                                                                    ariaLabel={`Fonte ${sourceIndex + 1}`}
                                                                    legacyLabels={(episode.sources || []).map(
                                                                      (item) => item.label,
                                                                    )}
                                                                    onValueChange={(value) =>
                                                                      setFormState((prev) => {
                                                                        const next = [
                                                                          ...prev.episodeDownloads,
                                                                        ];
                                                                        const sources = [
                                                                          ...(next[index].sources ||
                                                                            []),
                                                                        ];
                                                                        sources[sourceIndex] = {
                                                                          ...sources[sourceIndex],
                                                                          label: value,
                                                                        };
                                                                        next[index] = {
                                                                          ...next[index],
                                                                          sources,
                                                                        };
                                                                        return {
                                                                          ...prev,
                                                                          episodeDownloads: next,
                                                                        };
                                                                      })
                                                                    }
                                                                  />
                                                                  <Input
                                                                    value={source.url}
                                                                    onChange={(event) =>
                                                                      setFormState((prev) => {
                                                                        const next = [
                                                                          ...prev.episodeDownloads,
                                                                        ];
                                                                        const sources = [
                                                                          ...(next[index].sources ||
                                                                            []),
                                                                        ];
                                                                        sources[sourceIndex] = {
                                                                          ...sources[sourceIndex],
                                                                          url: event.target.value,
                                                                        };
                                                                        next[index] = {
                                                                          ...next[index],
                                                                          sources,
                                                                        };
                                                                        return {
                                                                          ...prev,
                                                                          episodeDownloads: next,
                                                                        };
                                                                      })
                                                                    }
                                                                    placeholder="URL"
                                                                  />
                                                                  <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-9 w-9"
                                                                    onClick={() => {
                                                                      setFormState((prev) => {
                                                                        const next = [
                                                                          ...prev.episodeDownloads,
                                                                        ];
                                                                        const sources = (
                                                                          next[index].sources || []
                                                                        ).filter(
                                                                          (_, idx) =>
                                                                            idx !== sourceIndex,
                                                                        );
                                                                        next[index] = {
                                                                          ...next[index],
                                                                          sources,
                                                                        };
                                                                        return {
                                                                          ...prev,
                                                                          episodeDownloads: next,
                                                                        };
                                                                      });
                                                                    }}
                                                                  >
                                                                    <Trash2 className="h-4 w-4" />
                                                                  </Button>
                                                                </div>
                                                              </div>
                                                            ),
                                                          )}
                                                          <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() =>
                                                              setFormState((prev) => {
                                                                const next = [
                                                                  ...prev.episodeDownloads,
                                                                ];
                                                                const existingSources =
                                                                  next[index].sources || [];
                                                                next[index] = {
                                                                  ...next[index],
                                                                  sources: [
                                                                    ...existingSources,
                                                                    { label: "", url: "" },
                                                                  ],
                                                                };
                                                                return {
                                                                  ...prev,
                                                                  episodeDownloads: next,
                                                                };
                                                              })
                                                            }
                                                          >
                                                            Adicionar fonte
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </AccordionContent>
                                                </CardContent>
                                              </Card>
                                            </AccordionItem>
                                          );
                                        })}
                                      </Accordion>
                                    </AccordionContent>
                                  </AccordionItem>
                                );
                              })}
                            </Accordion>
                          </div>
                        </div>
                    </ProjectEditorEpisodesSection>
                  ) : null}

                  <ProjectEditorStaffSection
                    contentClassName={editorSectionContentClassName}
                    memberDirectory={memberDirectory}
                    memberInput={staffMemberInput}
                    onCommitMember={commitStaffMember}
                    onDragStart={setStaffDragIndex}
                    onDrop={handleStaffDrop}
                    onMove={moveStaffItem}
                    roleOptions={staffRoleOptions}
                    sectionClassName={editorSectionClassName}
                    sectionValue="equipe"
                    setFormState={setFormState}
                    setMemberInput={setStaffMemberInput}
                    shiftDraftAfterRemoval={shiftDraftAfterRemoval}
                    staffEntries={formState.staff}
                    staffKey="staff"
                    title="Equipe da fansub"
                    triggerClassName={editorSectionTriggerClassName}
                    variant="fansub"
                  />

                  <ProjectEditorStaffSection
                    contentClassName={editorSectionContentClassName}
                    memberDirectory={memberDirectory}
                    memberInput={animeStaffMemberInput}
                    onCommitMember={commitAnimeStaffMember}
                    onDragStart={setAnimeStaffDragIndex}
                    onDrop={handleAnimeStaffDrop}
                    onMove={moveAnimeStaffItem}
                    roleTranslationMap={staffRoleTranslationMap}
                    sectionClassName={editorSectionClassName}
                    sectionValue="staff-anime"
                    setFormState={setFormState}
                    setMemberInput={setAnimeStaffMemberInput}
                    shiftDraftAfterRemoval={shiftDraftAfterRemoval}
                    staffEntries={formState.animeStaff}
                    staffKey="animeStaff"
                    title="Staff do anime"
                    triggerClassName={editorSectionTriggerClassName}
                    variant="anime"
                  />
                </Accordion>
              </div>
      </ProjectEditorDialogShell>

      <ProjectEditorConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        onCancel={() => {
          confirmCancelRef.current?.();
          setConfirmOpen(false);
        }}
        onConfirm={() => {
          confirmActionRef.current?.();
          setConfirmOpen(false);
        }}
      />

      <ProjectEditorAnimeBatchDialog
        open={animeBatchCreateOpen}
        onOpenChange={setAnimeBatchCreateOpen}
        startNumber={animeBatchStartNumber}
        onStartNumberChange={setAnimeBatchStartNumber}
        quantity={animeBatchQuantity}
        onQuantityChange={setAnimeBatchQuantity}
        cadenceDays={animeBatchCadenceDays}
        onCadenceDaysChange={setAnimeBatchCadenceDays}
        durationInput={animeBatchDurationInput}
        onDurationInputChange={(nextValue) =>
          setAnimeBatchDurationInput(formatTimeDigitsToDisplay(nextValue))
        }
        sourceType={animeBatchSourceType}
        onSourceTypeChange={(nextValue) => setAnimeBatchSourceType(nextValue)}
        publicationStatus={animeBatchPublicationStatus}
        onPublicationStatusChange={setAnimeBatchPublicationStatus}
        onCreate={createAnimeEpisodeBatch}
      />

      <ProjectEditorDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        targetTitle={deleteTarget?.title}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <ProjectEditorImageLibraryDialog
        activeLibraryOptions={activeLibraryOptions}
        apiBase={apiBase}
        currentLibrarySelection={currentLibrarySelection}
        isOpen={isLibraryOpen}
        onOpenChange={setIsLibraryOpen}
        onSave={handleLibrarySave}
      />
    </>
  );
};

export const __testing = {
  clearProjectsPageCache: () => {
    clearProjectsPageCache();
  },
};

export default DashboardProjectsEditor;
