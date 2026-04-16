import DashboardShell from "@/components/DashboardShell";
import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import { Input } from "@/components/dashboard/dashboard-form-controls";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import { useChapterEditorLeaveGuard } from "@/components/dashboard/chapter-editor/useChapterEditorLeaveGuard";
import { useDashboardProjectChapterEpub } from "@/components/dashboard/chapter-editor/useDashboardProjectChapterEpub";
import { useDashboardProjectChapterEditorResource } from "@/components/dashboard/chapter-editor/useDashboardProjectChapterEditorResource";
import { loadLexicalEditor } from "@/components/lazy/LazyLexicalEditor";
import ChapterEditorPane from "@/components/dashboard/chapter-editor/ChapterEditorPane";
import type {
  ChapterEditorPaneHandle,
  ProjectRecord,
  StructureScrollAnchor,
  VolumeSelectionOptions,
} from "@/components/dashboard/chapter-editor/chapter-editor-types";
import {
  reconcileStageChapters,
  revokeStagePages,
  type StageChapter,
} from "@/components/project-reader/MangaWorkflowPanel";
import AsyncState from "@/components/ui/async-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import type { ProjectEpisode, ProjectVolumeEntry } from "@/data/projects";
import { useDashboardCurrentUser } from "@/hooks/use-dashboard-current-user";
import { usePageMeta } from "@/hooks/use-page-meta";
import { canManageProjectsAccess } from "@/lib/access-control";
import { getApiBase } from "@/lib/api-base";
import {
  EMPTY_CHAPTER_DRAFT,
  VOLUME_REQUIRED_IDENTITY_MESSAGE,
  VOLUME_REQUIRED_SAVE_DIALOG_DESCRIPTION,
  buildNewChapterDraft,
  buildChapterStructureGroups,
  buildChapterVolumeLabel,
  buildEditableVolumeOptions,
  resolveFallbackSelectedChapterVolume,
  resolveSelectedChapterVolume,
  resolveSelectedVolumeChapterCount,
  buildChapterSnapshot,
  buildProjectSnapshotWithVolumeEntries,
  chapterHasContent,
  findChapterStructureGroupElement,
  ensureProjectVolumeEntryDraft,
  appendNextProjectVolumeEntryDraft,
  updateProjectVolumeEntriesDraft,
  groupChaptersByStructureKey,
  groupStageChaptersByStructureKey,
  matchesChapterSearch,
  matchesFilter,
  matchesStageChapterFilter,
  matchesStageChapterSearch,
  normalizeStructureGroupKeys,
  normalizeChapterForEditor,
  normalizeChapterForSave,
  normalizePositiveInteger,
  normalizeNonNegativeInteger,
  resolveChapterEntrySubtype,
  buildVolumeEntriesSnapshot,
  normalizeVolumeEntriesForSave,
  reorderChaptersWithinStructureGroup,
  sortChapters,
  supportsStructureChapterReordering,
  type ChapterFilterMode,
  type EditableVolumeOption,
} from "@/lib/dashboard-project-chapter";
import { findIncompleteDownloadSourceIndex } from "@/lib/project-download-sources";
import { cn } from "@/lib/utils";
import { overlayDraftOnProject } from "@/lib/project-epub";
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
} from "@/lib/project-episode-key";
import { isChapterBasedType, isLightNovelType, isMangaType } from "@/lib/project-utils";
import { buildVolumeCoverKey, findDuplicateVolumeCover } from "@/lib/project-volume-cover-key";
import { normalizeProjectVolumeEntries } from "@/lib/project-volume-entries";
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
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
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
} from "../../shared/project-reader.js";
import NotFound from "./NotFound";

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

type CurrentUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  accessRole?: string;
  permissions?: string[];
  ownerIds?: string[];
  primaryOwnerId?: string | null;
  grants?: Partial<Record<string, boolean>>;
};

const DashboardProjectChapterEditor = () => {
  usePageMeta({ title: "Gerenciamento de Conteúdo", noIndex: true });
  const apiBase = getApiBase();
  const navigate = useNavigate();
  const { projectId, chapterNumber } = useParams<{ projectId: string; chapterNumber?: string }>();
  const [searchParams] = useSearchParams();
  const { currentUser, isLoadingUser } = useDashboardCurrentUser<CurrentUser>();
  const hasLoadedCurrentUser = !isLoadingUser;
  const [chapterSearchQuery, setChapterSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<ChapterFilterMode>("all");
  const [activeDraft, setActiveDraft] = useState<ProjectEpisode | null>(null);
  const [stagedMangaChapters, setStagedMangaChapters] = useState<StageChapter[]>([]);
  const [selectedStageChapterId, setSelectedStageChapterId] = useState<string | null>(null);
  const [isSavingVolumes, setIsSavingVolumes] = useState(false);
  const [deleteDialogState, setDeleteDialogState] = useState<DeleteDialogState | null>(null);
  const [isDeletingEntity, setIsDeletingEntity] = useState(false);
  const editorPaneRef = useRef<ChapterEditorPaneHandle | null>(null);
  const stagedMangaChaptersRef = useRef<StageChapter[]>([]);
  const previousProjectIdRef = useRef<string | undefined>(projectId);
  const pendingNeutralSelectedVolumeRef = useRef<number | null>(null);
  const pendingNeutralScrollAnchorRef = useRef<StructureScrollAnchor | null>(null);
  const pendingChapterNavigationHrefRef = useRef<string | null>(null);
  const fallbackNeutralToastKeyRef = useRef<string | null>(null);
  const clearPendingNeutralRouteState = useCallback(() => {
    pendingNeutralSelectedVolumeRef.current = null;
    pendingNeutralScrollAnchorRef.current = null;
  }, []);
  const chapterEditorResource = useDashboardProjectChapterEditorResource({
    apiBase,
    projectId,
    onProjectResourceReset: clearPendingNeutralRouteState,
  });
  const {
    handleProjectChange,
    hasLoadError,
    isLoading,
    persistProjectSnapshot,
    persistedStructureGroupKeys,
    project,
    projectRef,
    projectSnapshotRef,
    reloadProject,
    selectedVolume,
    setPersistedStructureGroupKeys,
    setSelectedVolume,
    setVolumeEntriesDraft,
    syncProjectSnapshot,
    volumeEntriesDraft,
  } = chapterEditorResource;

  useEffect(() => {
    if (import.meta.env.MODE === "test") {
      return;
    }
    void loadLexicalEditor();
  }, []);

  useEffect(() => {
    stagedMangaChaptersRef.current = stagedMangaChapters;
  }, [stagedMangaChapters]);

  useEffect(() => {
    if (previousProjectIdRef.current && previousProjectIdRef.current !== projectId) {
      revokeStagePages(stagedMangaChaptersRef.current);
      stagedMangaChaptersRef.current = [];
      setStagedMangaChapters([]);
      setSelectedStageChapterId(null);
    }
    previousProjectIdRef.current = projectId;
  }, [projectId]);

  useEffect(
    () => () => {
      revokeStagePages(stagedMangaChaptersRef.current);
    },
    [],
  );

  const canManageProjects = useMemo(() => {
    return canManageProjectsAccess(currentUser);
  }, [currentUser]);

  const volumeParam = searchParams.get("volume");
  const parsedVolume = Number(volumeParam);
  const resolvedVolume =
    volumeParam !== null && Number.isFinite(parsedVolume) ? parsedVolume : undefined;

  const isChapterBased = isChapterBasedType(project?.type || "");
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
    activeChapter && chapterNumber
      ? buildEpisodeKey(activeChapter.number, activeChapter.volume)
      : null;
  const normalizeChapterDraft = useCallback(
    (chapter: ProjectEpisode) => normalizeChapterForEditor(chapter, "manga"),
    [],
  );
  const buildChapterSnapshotForEditor = useCallback(
    (chapter: ProjectEpisode | null) => buildChapterSnapshot(chapter, "manga"),
    [],
  );
  const activeChapterSnapshot = useMemo(
    () => buildChapterSnapshotForEditor(activeChapter),
    [activeChapter, buildChapterSnapshotForEditor],
  );
  const activeDraftSnapshot = useMemo(
    () => buildChapterSnapshotForEditor(activeDraft),
    [activeDraft, buildChapterSnapshotForEditor],
  );
  const isChapterDirty =
    Boolean(activeChapterKey) &&
    Boolean(activeDraft) &&
    activeDraftSnapshot !== activeChapterSnapshot;

  useEffect(() => {
    if (!activeChapter || !activeChapterKey) {
      setActiveDraft(null);
      return;
    }
    const nextDraft = normalizeChapterDraft(activeChapter);
    setActiveDraft((current) => {
      if (!current) {
        return nextDraft;
      }
      const currentKey = buildEpisodeKey(current.number, current.volume);
      if (currentKey !== activeChapterKey) {
        return nextDraft;
      }
      const currentSnapshot = buildChapterSnapshotForEditor(current);
      if (currentSnapshot === activeChapterSnapshot) {
        return nextDraft;
      }
      return current;
    });
  }, [
    activeChapter,
    activeChapterKey,
    activeChapterSnapshot,
    buildChapterSnapshotForEditor,
    normalizeChapterDraft,
  ]);

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

  useEffect(() => {
    syncProjectSnapshot(projectSnapshot);
  }, [projectSnapshot, syncProjectSnapshot]);

  const availableVolumes = useMemo<EditableVolumeOption[]>(() => {
    return buildEditableVolumeOptions(projectSnapshot, volumeEntriesDraft);
  }, [projectSnapshot, volumeEntriesDraft]);
  const shouldFallbackToNeutralRoute = Boolean(
    project &&
      isChapterBased &&
      chapterNumber &&
      !activeChapter &&
      !pendingChapterNavigationHrefRef.current &&
      !activeChapterLookup.ok &&
      activeChapterLookup.code !== "volume_required",
  );
  const fallbackNeutralSelectedVolume = useMemo(() => {
    return resolveFallbackSelectedChapterVolume({
      availableVolumes,
      enabled: shouldFallbackToNeutralRoute,
      volume: resolvedVolume,
    });
  }, [availableVolumes, resolvedVolume, shouldFallbackToNeutralRoute]);
  const fallbackNeutralToastKey = `${project?.id || projectId || ""}:${String(chapterNumber || "")}:${String(volumeParam || "")}`;
  const neutralHref = buildDashboardProjectChaptersEditorHref(project?.id || projectId || "");
  const currentEditorHref = chapterNumber
    ? buildDashboardProjectChapterEditorHref(
        project?.id || projectId || "",
        chapterNumber,
        resolvedVolume,
      )
    : neutralHref;

  useEffect(() => {
    if (pendingChapterNavigationHrefRef.current === currentEditorHref) {
      pendingChapterNavigationHrefRef.current = null;
    }
  }, [currentEditorHref]);

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
    setSelectedVolume(
      resolveSelectedChapterVolume({
        activeChapterVolume: activeChapter?.volume,
        availableVolumes,
        fallbackVolume: shouldFallbackToNeutralRoute ? fallbackNeutralSelectedVolume : null,
      }),
    );
  }, [
    activeChapter?.volume,
    availableVolumes,
    chapterNumber,
    fallbackNeutralSelectedVolume,
    shouldFallbackToNeutralRoute,
  ]);

  useEffect(() => {
    if (!shouldFallbackToNeutralRoute) {
      fallbackNeutralToastKeyRef.current = null;
      return;
    }
    if (fallbackNeutralToastKeyRef.current !== fallbackNeutralToastKey) {
      fallbackNeutralToastKeyRef.current = fallbackNeutralToastKey;
      toast({
        title: "Capítulo não encontrado. Mostrando a lista.",
        intent: "warning",
      });
    }
    pendingNeutralSelectedVolumeRef.current = fallbackNeutralSelectedVolume;
    pendingNeutralScrollAnchorRef.current = null;
    navigate(neutralHref, { replace: true });
  }, [
    fallbackNeutralToastKey,
    fallbackNeutralSelectedVolume,
    navigate,
    neutralHref,
    shouldFallbackToNeutralRoute,
  ]);

  useLayoutEffect(() => {
    if (chapterNumber) {
      return;
    }
    const pendingAnchor = pendingNeutralScrollAnchorRef.current;
    if (!pendingAnchor) {
      return;
    }
    const scheduleFrame =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback: FrameRequestCallback) =>
            window.setTimeout(() => callback(performance.now()), 0);
    const cancelFrame =
      typeof window.cancelAnimationFrame === "function"
        ? window.cancelAnimationFrame.bind(window)
        : window.clearTimeout.bind(window);

    let outerFrame = 0;
    let innerFrame = 0;
    outerFrame = scheduleFrame(() => {
      innerFrame = scheduleFrame(() => {
        const targetElement = findChapterStructureGroupElement(pendingAnchor.groupKey);
        if (!targetElement) {
          return;
        }
        const nextTop = targetElement.getBoundingClientRect().top;
        const delta = nextTop - pendingAnchor.top;
        pendingNeutralScrollAnchorRef.current = null;
        if (!Number.isFinite(delta) || Math.abs(delta) < 1) {
          return;
        }
        if (typeof window.scrollBy === "function") {
          window.scrollBy({ top: delta, left: 0, behavior: "auto" });
          return;
        }
        window.scrollTo({ top: window.scrollY + delta, left: 0, behavior: "auto" });
      });
    });

    return () => {
      cancelFrame(outerFrame);
      cancelFrame(innerFrame);
    };
  }, [chapterNumber, project?.id, selectedVolume]);

  const selectedVolumeChapterCount = useMemo(
    () =>
      resolveSelectedVolumeChapterCount({
        availableVolumes,
        volume: selectedVolume,
      }),
    [availableVolumes, selectedVolume],
  );

  const updateVolumeEntryByVolume = useCallback(
    (volume: number, updater: (entry: ProjectVolumeEntry) => ProjectVolumeEntry) => {
      setVolumeEntriesDraft((currentEntries) =>
        updateProjectVolumeEntriesDraft(currentEntries, volume, updater),
      );
    },
    [],
  );
  const selectVolumeFromStage = useCallback((volume: number | null) => {
    const normalizedVolume =
      Number.isFinite(Number(volume)) && Number(volume) > 0 ? Math.floor(Number(volume)) : null;
    setSelectedVolume(normalizedVolume);
  }, []);

  const addVolumeEntry = useCallback(() => {
    const nextSelection = appendNextProjectVolumeEntryDraft(volumeEntriesDraft);
    setVolumeEntriesDraft(nextSelection.entries);
    setSelectedVolume(nextSelection.selectedVolume);
  }, [volumeEntriesDraft]);

  const filteredChapters = useMemo(
    () =>
      chapters.filter(
        (episode) =>
          matchesFilter(episode, filterMode) && matchesChapterSearch(episode, chapterSearchQuery),
      ),
    [chapterSearchQuery, chapters, filterMode],
  );

  const reconciledStagedMangaChapters: StageChapter[] = useMemo(
    (): StageChapter[] => (project ? reconcileStageChapters(project, stagedMangaChapters) : []),
    [project, stagedMangaChapters],
  );
  const visibleStagedMangaChapters: StageChapter[] = useMemo(
    (): StageChapter[] =>
      reconciledStagedMangaChapters.filter(
        (chapter: StageChapter) =>
          matchesStageChapterFilter(chapter, filterMode) &&
          matchesStageChapterSearch(chapter, chapterSearchQuery),
      ),
    [chapterSearchQuery, filterMode, reconciledStagedMangaChapters],
  );

  const chaptersByStructureGroup = useMemo(() => groupChaptersByStructureKey(chapters), [chapters]);
  const filteredChaptersByStructureGroup = useMemo(
    () => groupChaptersByStructureKey(filteredChapters),
    [filteredChapters],
  );
  const stagedChaptersByStructureGroup = useMemo(
    () => groupStageChaptersByStructureKey(reconciledStagedMangaChapters as StageChapter[]),
    [reconciledStagedMangaChapters],
  );
  const visibleStagedChaptersByStructureGroup = useMemo(
    () => groupStageChaptersByStructureKey(visibleStagedMangaChapters as StageChapter[]),
    [visibleStagedMangaChapters],
  );

  const structureGroups = useMemo(
    () =>
      buildChapterStructureGroups({
        availableVolumes,
        chaptersByStructureGroup,
        filteredChaptersByStructureGroup,
        stagedChaptersByStructureGroup,
        visibleStagedChaptersByStructureGroup,
      }),
    [
      availableVolumes,
      chaptersByStructureGroup,
      filteredChaptersByStructureGroup,
      stagedChaptersByStructureGroup,
      visibleStagedChaptersByStructureGroup,
    ],
  );

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
  const isChapterEditorRouteHref = useCallback(
    (href?: string | null) => {
      const normalizedHref = String(href || "").trim();
      if (!normalizedHref) {
        return false;
      }
      try {
        const resolvedUrl = new URL(normalizedHref, window.location.origin);
        const editorBaseUrl = new URL(neutralHref, window.location.origin);
        const editorPath = editorBaseUrl.pathname.replace(/\/+$/, "");
        const candidatePath = resolvedUrl.pathname.replace(/\/+$/, "");
        return (
          resolvedUrl.origin === editorBaseUrl.origin &&
          (candidatePath === editorPath || candidatePath.startsWith(`${editorPath}/`))
        );
      } catch {
        return false;
      }
    },
    [neutralHref],
  );
  const navigateToChapterEditor = useCallback(
    (
      targetProjectId: string,
      targetChapterNumber: unknown,
      targetVolume?: unknown,
      options?: { replace?: boolean },
    ) => {
      const href = buildDashboardProjectChapterEditorHref(
        targetProjectId,
        targetChapterNumber,
        targetVolume,
      );
      pendingChapterNavigationHrefRef.current = href;
      navigate(href, options);
    },
    [navigate],
  );

  const requestNavigateToHref = useCallback(
    async (
      href: string,
      options?: {
        preserveNeutralSelectedVolume?: number | null;
        preserveScrollAnchor?: StructureScrollAnchor | null;
        preserveScroll?: boolean;
        forceRouteExit?: boolean;
      },
    ) => {
      const canLeave = await editorPaneRef.current?.requestLeave?.({
        nextHref: href,
        routeExit: options?.forceRouteExit === true ? true : !isChapterEditorRouteHref(href),
      });
      if (canLeave === false) {
        return false;
      }
      pendingNeutralSelectedVolumeRef.current =
        Number.isFinite(Number(options?.preserveNeutralSelectedVolume)) &&
        Number(options?.preserveNeutralSelectedVolume) > 0
          ? Number(options?.preserveNeutralSelectedVolume)
          : null;
      pendingNeutralScrollAnchorRef.current =
        options?.preserveScrollAnchor &&
        typeof options.preserveScrollAnchor.groupKey === "string" &&
        Number.isFinite(options.preserveScrollAnchor.top)
          ? {
              groupKey: options.preserveScrollAnchor.groupKey,
              top: options.preserveScrollAnchor.top,
            }
          : null;
      navigate(href, options?.preserveScroll ? { state: { preserveScroll: true } } : undefined);
      return true;
    },
    [isChapterEditorRouteHref, navigate],
  );
  const requestNavigateToUploads = useCallback(
    () => requestNavigateToHref("/dashboard/uploads"),
    [requestNavigateToHref],
  );

  useEffect(() => {
    const handleDocumentNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      if (anchor.target && anchor.target !== "_self") {
        return;
      }
      if (anchor.hasAttribute("download")) {
        return;
      }
      const href = String(anchor.getAttribute("href") || "").trim();
      if (!href || href.startsWith("#")) {
        return;
      }
      let resolvedHref = "";
      try {
        const resolvedUrl = new URL(anchor.href || href, window.location.origin);
        if (resolvedUrl.origin !== window.location.origin) {
          return;
        }
        resolvedHref = `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
      } catch {
        return;
      }
      if (!resolvedHref || isChapterEditorRouteHref(resolvedHref)) {
        return;
      }
      if (
        !editorPaneRef.current?.hasUnsavedChanges?.({ nextHref: resolvedHref, routeExit: true })
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void requestNavigateToHref(resolvedHref, { forceRouteExit: true });
    };

    document.addEventListener("click", handleDocumentNavigation, true);
    return () => document.removeEventListener("click", handleDocumentNavigation, true);
  }, [isChapterEditorRouteHref, requestNavigateToHref]);

  const handleStructureVolumeSelection = useCallback(
    async (nextVolume: number, options?: VolumeSelectionOptions) => {
      const normalizedVolume = Number(nextVolume);
      if (!Number.isFinite(normalizedVolume) || normalizedVolume <= 0) {
        return false;
      }

      if (!activeChapterKey || !activeChapter) {
        setSelectedVolume(normalizedVolume);
        return true;
      }

      return await requestNavigateToHref(neutralHref, {
        preserveNeutralSelectedVolume: normalizedVolume,
        preserveScrollAnchor: options?.preserveScrollAnchor ?? null,
        preserveScroll: true,
      });
    },
    [activeChapter, activeChapterKey, neutralHref, requestNavigateToHref],
  );

  const handleChapterSaved = useCallback(
    (
      nextProject: ProjectRecord,
      nextChapter: ProjectEpisode,
      routeHint?: { number: number; volume?: number },
    ) => {
      const normalizedChapter = normalizeChapterDraft(nextChapter);
      const hintedNumber = routeHint?.number ?? normalizedChapter.number;
      const hintedVolume =
        routeHint?.volume === null ||
        routeHint?.volume === undefined ||
        String(routeHint?.volume).trim() === ""
          ? undefined
          : Number.isFinite(Number(routeHint.volume)) && Number(routeHint.volume) >= 0
            ? Math.floor(Number(routeHint.volume))
            : undefined;
      const canonicalChapter = resolveCanonicalEpisodeRouteTarget(
        nextProject.episodeDownloads || [],
        hintedNumber,
        [hintedVolume, normalizedChapter.volume],
        { exactPreferredOnly: true },
      );
      const resolvedChapter = normalizeChapterDraft(
        canonicalChapter
          ? canonicalChapter
          : {
              ...normalizedChapter,
              number: hintedNumber,
              volume:
                hintedVolume ??
                normalizedChapter.volume ??
                resolvedVolume ??
                activeDraft?.volume ??
                activeChapter?.volume,
            },
      );
      handleProjectChange(nextProject);
      syncProjectSnapshot(
        overlayDraftOnProject(
          nextProject,
          buildEpisodeKey(resolvedChapter.number, resolvedChapter.volume),
          resolvedChapter,
        ),
      );
      setSelectedStageChapterId(null);
      setSelectedVolume(
        Number.isFinite(Number(resolvedChapter.volume)) && Number(resolvedChapter.volume) > 0
          ? Number(resolvedChapter.volume)
          : null,
      );
      setActiveDraft(resolvedChapter);
      navigateToChapterEditor(nextProject.id, resolvedChapter.number, resolvedChapter.volume, {
        replace: true,
      });
    },
    [
      activeChapter?.volume,
      activeDraft?.volume,
      handleProjectChange,
      navigateToChapterEditor,
      normalizeChapterDraft,
      resolvedVolume,
      syncProjectSnapshot,
    ],
  );

  const handleSelectedStageChapterChange = useCallback(
    (chapter: StageChapter | null) => {
      if (activeChapterKey || chapterNumber) {
        return;
      }
      if (!chapter) {
        return;
      }
      selectVolumeFromStage(chapter.volume);
    },
    [activeChapterKey, chapterNumber, selectVolumeFromStage],
  );

  const handleOpenImportedChapter = useCallback(
    (nextProject: ProjectRecord, importedChapters: ProjectEpisode[]) => {
      const importedChapterKeys = new Set(
        importedChapters.map((chapter) => buildEpisodeKey(chapter.number, chapter.volume)),
      );
      const firstImportedChapter = sortChapters(
        Array.isArray(nextProject.episodeDownloads) ? nextProject.episodeDownloads : [],
      ).find((chapter) => importedChapterKeys.has(buildEpisodeKey(chapter.number, chapter.volume)));

      if (firstImportedChapter) {
        handleChapterSaved(nextProject, firstImportedChapter, {
          number: firstImportedChapter.number,
          volume: firstImportedChapter.volume,
        });
        return;
      }

      handleProjectChange(nextProject);
      setSelectedStageChapterId(null);
      setSelectedVolume(null);
      setActiveDraft(null);
    },
    [handleChapterSaved, handleProjectChange],
  );

  const {
    backendBuildLabel,
    backendSupportsEpubExport,
    backendSupportsEpubImport,
    epubCapabilityState,
    epubExportIncludeDrafts,
    epubExportVolume,
    epubImportAsDraft,
    epubImportFile,
    epubImportInputRef,
    epubImportTargetVolume,
    frontendBuildLabel,
    handleEpubImportFileChange,
    handleExportEpub,
    handleImportEpub,
    isExportingEpub,
    isImportingEpub,
    openEpubImportPicker,
    resetPendingEpubAutoImport,
    setEpubExportIncludeDrafts,
    setEpubExportVolume,
    setEpubImportAsDraft,
    setEpubImportTargetVolume,
  } = useDashboardProjectChapterEpub({
    activeChapterKey,
    apiBase,
    chapterEditorResource,
    navigateToChapterEditor,
    normalizeChapterDraft,
    onProjectUpdated: handleProjectChange,
    onDraftUpdated: setActiveDraft,
    persistProjectSnapshot,
    projectSnapshot,
  });

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
      handleProjectChange(persistedProject);
      toast({
        title: "Volumes salvos",
        description: "Os metadados de volume foram atualizados no projeto.",
        intent: "success",
      });
      return true;
    } finally {
      setIsSavingVolumes(false);
    }
  }, [
    handleProjectChange,
    isSavingVolumes,
    isVolumeDirty,
    persistProjectSnapshot,
    project,
    volumeEntriesDraft,
  ]);

  const handleRequestDeleteChapter = useCallback(() => {
    if (!activeChapter) {
      return;
    }
    const chapterLabel =
      String(activeChapter.title || "").trim() || `Capítulo ${activeChapter.number}`;
    const dirtyNotice =
      isChapterDirty || isVolumeDirty
        ? " As alterações atuais da página serão aplicadas imediatamente junto com a exclusão."
        : "";
    setDeleteDialogState({
      kind: "chapter",
      title: "Excluir capítulo?",
      description: `Excluir "${chapterLabel}" agora?${dirtyNotice}`,
      volume: Number.isFinite(Number(activeChapter.volume)) ? Number(activeChapter.volume) : null,
    });
  }, [activeChapter, isChapterDirty, isVolumeDirty]);

  const handleRequestDeleteVolume = useCallback(
    (volume: number) => {
      const normalizedVolume = Number(volume);
      if (!Number.isFinite(normalizedVolume) || normalizedVolume <= 0) {
        return;
      }
      const linkedChapterCount =
        availableVolumes.find((volumeOption) => volumeOption.volume === normalizedVolume)
          ?.chapterCount || 0;
      const dirtyNotice =
        isChapterDirty || isVolumeDirty
          ? " As alterações atuais da página serão aplicadas imediatamente junto com a exclusão."
          : "";
      const chapterImpactLabel =
        linkedChapterCount > 0
          ? ` Isso também excluirá ${linkedChapterCount} capítulo(s) vinculado(s).`
          : " Esse volume ainda não possui capítulos vinculados.";
      setDeleteDialogState({
        kind: "volume",
        title: "Excluir volume?",
        description: `Excluir ${buildChapterVolumeLabel(normalizedVolume)} agora?${chapterImpactLabel}${dirtyNotice}`,
        volume: normalizedVolume,
      });
    },
    [availableVolumes, isChapterDirty, isVolumeDirty],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!project || !deleteDialogState || isDeletingEntity) {
      return;
    }
    setIsDeletingEntity(true);
    try {
      if (deleteDialogState.kind === "chapter") {
        if (!activeChapterKey || !projectWithVolumeDraft) {
          return;
        }
        const nextSnapshot = {
          ...projectWithVolumeDraft,
          episodeDownloads: sortChapters(
            (Array.isArray(projectWithVolumeDraft.episodeDownloads)
              ? projectWithVolumeDraft.episodeDownloads
              : []
            ).filter(
              (episode) => buildEpisodeKey(episode.number, episode.volume) !== activeChapterKey,
            ),
          ),
        };
        const persistedProject = await persistProjectSnapshot(nextSnapshot, {
          context: "chapter-delete",
        });
        if (!persistedProject) {
          return;
        }
        const preservedVolume =
          deleteDialogState.volume !== null &&
          buildEditableVolumeOptions(persistedProject, persistedProject.volumeEntries).some(
            (volumeOption) => volumeOption.volume === deleteDialogState.volume,
          )
            ? deleteDialogState.volume
            : null;
        handleProjectChange(persistedProject);
        setDeleteDialogState(null);
        pendingNeutralSelectedVolumeRef.current = preservedVolume;
        pendingNeutralScrollAnchorRef.current = null;
        setSelectedVolume(preservedVolume);
        navigate(buildDashboardProjectChaptersEditorHref(persistedProject.id), { replace: true });
        toast({
          title: "Capítulo excluído",
          description: "O capítulo foi removido do projeto.",
          intent: "success",
        });
        return;
      }

      const volumeToDelete = deleteDialogState.volume;
      const nextSnapshot = buildProjectSnapshotWithVolumeEntries(
        projectWithVolumeDraft || project,
        [
          ...normalizeProjectVolumeEntries(volumeEntriesDraft).filter(
            (entry) => buildVolumeCoverKey(entry.volume) !== buildVolumeCoverKey(volumeToDelete),
          ),
        ],
      );
      nextSnapshot.episodeDownloads = sortChapters(
        (Array.isArray(nextSnapshot.episodeDownloads) ? nextSnapshot.episodeDownloads : []).filter(
          (episode) => Number(episode.volume) !== volumeToDelete,
        ),
      );
      const persistedProject = await persistProjectSnapshot(nextSnapshot, {
        context: "volume-delete",
      });
      if (!persistedProject) {
        return;
      }
      handleProjectChange(persistedProject);
      setDeleteDialogState(null);
      pendingNeutralSelectedVolumeRef.current = null;
      pendingNeutralScrollAnchorRef.current = null;
      setSelectedVolume(null);
      navigate(buildDashboardProjectChaptersEditorHref(persistedProject.id), { replace: true });
      toast({
        title: "Volume excluído",
        description: "O volume e seus capítulos vinculados foram removidos do projeto.",
        intent: "success",
      });
    } finally {
      setIsDeletingEntity(false);
    }
  }, [
    activeChapterKey,
    deleteDialogState,
    handleProjectChange,
    isDeletingEntity,
    navigate,
    persistProjectSnapshot,
    project,
    projectWithVolumeDraft,
    volumeEntriesDraft,
  ]);

  const handleAddChapter = useCallback(
    async (targetVolume: number | null) => {
      const currentProjectSnapshot = projectSnapshotRef.current;
      const currentProject = projectRef.current;
      if (!currentProjectSnapshot || !currentProject) {
        return;
      }
      const normalizedVolume =
        Number.isFinite(Number(targetVolume)) && Number(targetVolume) > 0
          ? Number(targetVolume)
          : undefined;
      const nextChapter = buildNewChapterDraft(
        Array.isArray(currentProjectSnapshot.episodeDownloads)
          ? currentProjectSnapshot.episodeDownloads
          : [],
        {
          volume: normalizedVolume,
          projectType: currentProjectSnapshot.type,
        },
      );
      const nextSnapshot = {
        ...currentProjectSnapshot,
        episodeDownloads: sortChapters([
          ...(Array.isArray(currentProjectSnapshot.episodeDownloads)
            ? currentProjectSnapshot.episodeDownloads
            : []),
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
      handleProjectChange(persistedProject);
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
      const normalizedPersistedChapter = normalizeChapterDraft(persistedChapter);
      const persistedChapterKey = buildEpisodeKey(
        normalizedPersistedChapter.number,
        normalizedPersistedChapter.volume,
      );
      syncProjectSnapshot(
        overlayDraftOnProject(persistedProject, persistedChapterKey, normalizedPersistedChapter),
      );
      setSelectedStageChapterId(null);
      setActiveDraft(normalizedPersistedChapter);
      navigateToChapterEditor(
        persistedProject.id,
        normalizedPersistedChapter.number,
        normalizedPersistedChapter.volume,
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
      handleProjectChange,
      navigateToChapterEditor,
      normalizeChapterDraft,
      persistProjectSnapshot,
      syncProjectSnapshot,
    ],
  );

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
              <DashboardActionButton onClick={reloadProject}>
                Tentar novamente
              </DashboardActionButton>
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

  if (!project || !isChapterBased) {
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
                <DashboardActionButton asChild>
                  <Link to={buildDashboardProjectEditorHref(projectId)}>Voltar ao projeto</Link>
                </DashboardActionButton>
              }
            />
          </DashboardPageContainer>
        </DashboardShell>
      );
    }
    if (!shouldFallbackToNeutralRoute) {
      return <NotFound />;
    }
  }

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={!hasLoadedCurrentUser}
      onUserCardClick={() => {
        void requestNavigateToHref("/dashboard/usuarios?edit=me", { forceRouteExit: true });
      }}
    >
      <DashboardPageContainer maxWidth="editor" reveal={false}>
        <ChapterEditorPane
          key={activeChapterKey || "neutral"}
          ref={editorPaneRef}
          project={project}
          activeChapter={activeChapter}
          activeDraft={activeDraft}
          onDraftChange={setActiveDraft}
          filteredChapters={filteredChapters}
          stagedChapters={stagedMangaChapters}
          selectedStageChapterId={selectedStageChapterId}
          setStagedChapters={setStagedMangaChapters}
          setSelectedStageChapterId={setSelectedStageChapterId}
          volumeEntriesDraft={volumeEntriesDraft}
          selectedVolume={selectedVolume}
          availableVolumes={availableVolumes}
          selectedVolumeChapterCount={selectedVolumeChapterCount}
          onSelectedVolumeChange={handleStructureVolumeSelection}
          onAddVolume={addVolumeEntry}
          onAddChapter={handleAddChapter}
          onRequestDeleteVolume={handleRequestDeleteVolume}
          onRequestDeleteChapter={handleRequestDeleteChapter}
          onClearSelectedVolume={() => {
            setSelectedVolume(null);
          }}
          onUpdateVolumeEntry={updateVolumeEntryByVolume}
          activeChapterKey={activeChapterKey}
          chapterCount={chapters.length}
          chapterIndex={Math.max(activeChapterIndex, 0)}
          structureGroups={structureGroups}
          initialOpenStructureGroupKeys={persistedStructureGroupKeys}
          onStructureGroupKeysChange={setPersistedStructureGroupKeys}
          chapterSearchQuery={chapterSearchQuery}
          onChapterSearchQueryChange={setChapterSearchQuery}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          previousChapterHref={previousChapterHref}
          nextChapterHref={nextChapterHref}
          neutralHref={neutralHref}
          onNavigateToHref={requestNavigateToHref}
          onNavigateToUploads={requestNavigateToUploads}
          onPersistProjectSnapshot={persistProjectSnapshot}
          onProjectChange={handleProjectChange}
          onSelectedStageChapterChange={handleSelectedStageChapterChange}
          onOpenImportedChapter={handleOpenImportedChapter}
          onChapterSaved={handleChapterSaved}
          isVolumeDirty={isVolumeDirty}
          isSavingVolumes={isSavingVolumes}
          onSaveVolumes={handleSaveVolumes}
          isDeletingEntity={isDeletingEntity}
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
          onEpubImportFileCancel={resetPendingEpubAutoImport}
          onImportEpub={handleImportEpub}
          epubExportVolume={epubExportVolume}
          onEpubExportVolumeChange={setEpubExportVolume}
          epubExportIncludeDrafts={epubExportIncludeDrafts}
          onEpubExportIncludeDraftsChange={setEpubExportIncludeDrafts}
          isExportingEpub={isExportingEpub}
          onExportEpub={handleExportEpub}
        />
        <Dialog
          open={Boolean(deleteDialogState)}
          onOpenChange={(open) => {
            if (!open && !isDeletingEntity) {
              setDeleteDialogState(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{deleteDialogState?.title || ""}</DialogTitle>
              <DialogDescription>{deleteDialogState?.description || ""}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3">
              <DashboardActionButton
                disabled={isDeletingEntity}
                onClick={() => {
                  if (!isDeletingEntity) {
                    setDeleteDialogState(null);
                  }
                }}
              >
                Cancelar
              </DashboardActionButton>
              <DashboardActionButton
                tone="destructive"
                disabled={isDeletingEntity}
                onClick={() => {
                  void handleConfirmDelete();
                }}
              >
                {isDeletingEntity ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Excluir
              </DashboardActionButton>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardPageContainer>
    </DashboardShell>
  );
};

export default DashboardProjectChapterEditor;
