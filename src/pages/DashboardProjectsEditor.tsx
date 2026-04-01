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
import ProjectEditorAccordionHeader from "@/components/dashboard/project-editor/ProjectEditorAccordionHeader";
import ProjectEditorDialogShell from "@/components/dashboard/project-editor/ProjectEditorDialogShell";
import ProjectEditorImageLibraryDialog from "@/components/dashboard/project-editor/ProjectEditorImageLibraryDialog";
import ProjectEditorImportSection from "@/components/dashboard/project-editor/ProjectEditorImportSection";
import ProjectEditorInformationSection from "@/components/dashboard/project-editor/ProjectEditorInformationSection";
import ProjectEditorMediaSection from "@/components/dashboard/project-editor/ProjectEditorMediaSection";
import ProjectEditorRelationsSection from "@/components/dashboard/project-editor/ProjectEditorRelationsSection";
import ProjectEditorStaffSection from "@/components/dashboard/project-editor/ProjectEditorStaffSection";
import {
  ProjectEditorAnimeBatchDialog,
  ProjectEditorConfirmDialog,
  ProjectEditorDeleteDialog,
} from "@/components/dashboard/project-editor/ProjectEditorSupportDialogs";
import { useProjectEditorDialogState } from "@/components/dashboard/project-editor/useProjectEditorDialogState";
import { useProjectEditorImageLibrary } from "@/components/dashboard/project-editor/useProjectEditorImageLibrary";
import { useDashboardProjectsEditorAnimeBatch } from "@/components/dashboard/project-editor/useDashboardProjectsEditorAnimeBatch";
import {
  clearProjectsPageCache,
  useDashboardProjectsEditorResource,
} from "@/components/dashboard/project-editor/useDashboardProjectsEditorResource";
import { useProjectEditorTaxonomy } from "@/components/dashboard/project-editor/useProjectEditorTaxonomy";
import type {
  AniListMedia,
  EditorProjectEpisode,
  EpisodeVolumeGroup,
  ProjectForm,
  ProjectRecord,
  ProjectRelation,
  ProjectStaff,
  SortedEpisodeItem,
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
import type { ProjectEpisode, ProjectVolumeEntry } from "@/data/projects";
import { useEditorScrollLock } from "@/hooks/use-editor-scroll-lock";
import { useEditorScrollStability } from "@/hooks/use-editor-scroll-stability";
import { useDashboardCurrentUser } from "@/hooks/use-dashboard-current-user";
import { useDashboardRefreshToast } from "@/hooks/use-dashboard-refresh-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { parseAniListMediaId } from "@/lib/anilist";
import { deriveAniListMediaOrganization } from "@/lib/anilist-media";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  canonicalToDisplayTime,
  displayDateToIso,
  displayTimeToCanonical,
  formatDateDigitsToDisplay,
  formatEpisodeReleaseDate,
  formatTimeDigitsToDisplay,
  isoToDisplayDate,
  normalizeCanonicalTimeFromUnknown,
  normalizeIsoDateFromUnknown,
} from "@/lib/dashboard-date-time";
import {
  clearIndexedRecordValue,
  shiftIndexedRecordAfterRemoval,
} from "@/lib/dashboard-indexed-drafts";
import {
  getAnimeEpisodeCompletionIssues,
  getAnimeEpisodeCompletionLabel,
  matchesAnimeEpisodeQuickFilter,
  type AnimeEpisodeQuickFilter,
} from "@/lib/project-anime-episodes";
import { formatBytesCompact, parseHumanSizeToBytes } from "@/lib/file-size";
import {
  DEFAULT_PROJECT_BANNER_ALT,
  DEFAULT_PROJECT_COVER_ALT,
  DEFAULT_PROJECT_HERO_ALT,
  getEpisodeCoverAltFallback,
  resolveAssetAltText,
} from "@/lib/image-alt";
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
  findDuplicateEpisodeKey,
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
import { buildVolumeCoverKey, findDuplicateVolumeCover } from "@/lib/project-volume-cover-key";
import { normalizeProjectVolumeEntries } from "@/lib/project-volume-entries";
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
import type { MouseEvent as ReactMouseEvent } from "react";
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

const emptyProject: ProjectForm = {
  id: "",
  anilistId: null,
  title: "",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "",
  description: "",
  type: "Anime",
  status: "Em andamento",
  year: "",
  studio: "",
  animationStudios: [],
  episodes: "",
  tags: [],
  genres: [],
  cover: "",
  coverAlt: "",
  banner: "",
  bannerAlt: "",
  season: "",
  schedule: "",
  rating: "",
  country: "",
  source: "",
  discordRoleId: "",
  producers: [],
  score: null,
  startDate: "",
  endDate: "",
  relations: [],
  staff: [],
  animeStaff: [],
  trailerUrl: "",
  forceHero: false,
  heroImageUrl: "",
  heroImageAlt: "",
  readerConfig: {},
  volumeEntries: [],
  volumeCovers: [],
  episodeDownloads: [],
};

const defaultFormatOptions = [
  "Anime",
  "Mangá",
  "Webtoon",
  "Light Novel",
  "Filme",
  "OVA",
  "ONA",
  "Especial",
  "Spin-off",
];
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

const formatSeason = (season?: string | null, seasonYear?: number | null) => {
  if (!season && !seasonYear) {
    return "";
  }
  const translated = season
    ? season
        .toLowerCase()
        .replace("winter", "Inverno")
        .replace("spring", "Primavera")
        .replace("summer", "Verão")
        .replace("fall", "Outono")
    : "";
  return `${translated ? `${translated} ` : ""}${seasonYear || ""}`.trim();
};

const formatStatus = (status?: string | null) => {
  switch (status) {
    case "FINISHED":
      return "Finalizado";
    case "RELEASING":
      return "Em andamento";
    case "NOT_YET_RELEASED":
      return "Em andamento";
    case "CANCELLED":
      return "Cancelado";
    case "HIATUS":
      return "Pausado";
    default:
      return "";
  }
};

const formatType = (format?: string | null) => {
  switch (format) {
    case "TV":
      return "Anime";
    case "MOVIE":
      return "Filme";
    case "OVA":
      return "OVA";
    case "ONA":
      return "ONA";
    case "SPECIAL":
      return "Especial";
    case "MANGA":
      return "Mangá";
    case "NOVEL":
      return "Light Novel";
    case "ONE_SHOT":
      return "One-shot";
    case "MUSIC":
      return "Música";
    default:
      return "";
  }
};

const stripHtml = (value?: string | null) => {
  if (!value) {
    return "";
  }
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const normalizeUniqueStringList = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  return values.reduce<string[]>((acc, value) => {
    const normalized = String(value || "").trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      return acc;
    }
    seen.add(key);
    acc.push(normalized);
    return acc;
  }, []);
};

const shiftDraftAfterRemoval = shiftIndexedRecordAfterRemoval<string>;

const clearIndexedDraftValue = clearIndexedRecordValue<string>;

const shiftCollapsedEpisodesAfterRemoval = (
  collapsed: Record<number, boolean>,
  removedIndex: number,
) => shiftIndexedRecordAfterRemoval<boolean>(collapsed, removedIndex);

const getEpisodeAccordionValue = (index: number) => `episode-${index}`;
const episodeHeaderNoToggleSelector = [
  "[data-no-toggle]",
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  '[role="link"]',
  '[contenteditable="true"]',
].join(", ");

const shouldSkipEpisodeHeaderToggle = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(episodeHeaderNoToggleSelector));
};

const generateLocalId = () => {
  const alpha = String.fromCharCode(97 + Math.floor(Math.random() * 26));
  const random = Math.random().toString(36).slice(2, 9);
  const stamp = Date.now().toString(36).slice(-3);
  return `${alpha}${random}${stamp}`;
};

const resolveEpisodeEditorKey = (episode: Partial<EditorProjectEpisode> | null | undefined) => {
  const currentKey = String(episode._editorKey || "").trim();
  return currentKey || generateLocalId();
};

const buildCompletionBadges = (episode: Partial<EditorProjectEpisode> | null | undefined) =>
  getAnimeEpisodeCompletionIssues(episode).map((issue) => ({
    issue,
    label: getAnimeEpisodeCompletionLabel(issue),
  }));

const DashboardProjectsEditor = () => {
  usePageMeta({ title: "Projetos", noIndex: true });
  const navigate = useNavigate();
  const apiBase = getApiBase();
  const { settings: publicSettings } = useSiteSettings();
  const restoreWindowMs = 3 * 24 * 60 * 60 * 1000;
  const { currentUser, isLoadingUser } = useDashboardCurrentUser();
  const hasLoadedCurrentUser = !isLoadingUser;
  const [searchQuery, setSearchQuery] = useState("");

  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [formState, setFormState] = useState<ProjectForm>(emptyProject);
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
  const [collapsedEpisodes, setCollapsedEpisodes] = useState<Record<number, boolean>>({});
  const [collapsedVolumeGroups, setCollapsedVolumeGroups] = useState<Record<string, boolean>>({});
  const [editorAccordionValue, setEditorAccordionValue] = useState<string[]>(["informacoes"]);
  const chapterEditorsRef = useRef<Record<number, LexicalEditorHandle | null>>({});
  const episodeSizeInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const pendingAddAutoScrollRef = useRef(false);
  const pendingVolumeGroupToExpandRef = useRef<string | null>(null);
  const pendingVolumeGroupToScrollRef = useRef<string | null>(null);
  const pendingContentSectionScrollRef = useRef(false);
  const pendingEpisodeToScrollRef = useRef<EditorProjectEpisode | null>(null);
  const previousEpisodeCountRef = useRef(0);
  const episodeCardNodeMapRef = useRef<WeakMap<EditorProjectEpisode, HTMLDivElement>>(
    new WeakMap(),
  );
  const volumeGroupNodeMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const contentSectionRef = useRef<HTMLDivElement | null>(null);

  const resetPendingContentNavigation = useCallback(() => {
    pendingVolumeGroupToExpandRef.current = null;
    pendingVolumeGroupToScrollRef.current = null;
    pendingContentSectionScrollRef.current = false;
    volumeGroupNodeMapRef.current.clear();
  }, []);
  const hasInitializedListFiltersRef = useRef(false);
  const canManageProjects = useMemo(() => {
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    return permissions.includes("*") || permissions.includes("projetos");
  }, [currentUser]);
  const resolveVolumeEntryIndexByVolume = useCallback(
    (entries: ProjectVolumeEntry[], volume?: number) => {
      if (!Number.isFinite(Number(volume))) {
        return -1;
      }
      const normalizedVolume = Number(volume);
      return entries.findIndex(
        (entry) => buildVolumeCoverKey(entry?.volume) === buildVolumeCoverKey(normalizedVolume),
      );
    },
    [],
  );
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
    resolveVolumeEntryIndexByVolume,
    setFormState,
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

  const isManga = isMangaType(formState.type || "");
  const isLightNovel = isLightNovelType(formState.type || "");
  const supportsVolumeEntries = isLightNovel || isManga;
  const isChapterBased = isChapterBasedType(formState.type || "");
  const hasAniListReference =
    Boolean(formState.anilistId) || parseAniListMediaId(anilistIdInput) !== null;
  const stageOptions = getProjectProgressStagesForEditor(formState.type || "");

  const getEpisodeEntryKind = useCallback(
    (episode: Partial<EditorProjectEpisode> | null | undefined): "main" | "extra" =>
      episode?.entryKind === "extra" ? "extra" : "main",
    [],
  );

  const compareEpisodeOrdering = useCallback(
    (left: EditorProjectEpisode, right: EditorProjectEpisode) => {
      const leftReadingOrder = Number(left?.readingOrder);
      const rightReadingOrder = Number(right?.readingOrder);
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
      const numberDelta = (left.number || 0) - (right.number || 0);
      if (numberDelta !== 0) {
        return numberDelta;
      }
      return (left.volume || 0) - (right.volume || 0);
    },
    [],
  );

  const sortedEpisodeDownloads = useMemo<SortedEpisodeItem[]>(() => {
    if (!isChapterBased) {
      return formState.episodeDownloads.map((episode, index) => ({ episode, index }));
    }
    return formState.episodeDownloads
      .map((episode, index) => ({ episode, index }))
      .sort((a, b) => compareEpisodeOrdering(a.episode, b.episode));
  }, [compareEpisodeOrdering, formState.episodeDownloads, isChapterBased]);

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

  const addVolumeEntry = useCallback(() => {
    setFormState((prev) => {
      const nextVolume =
        prev.volumeEntries.reduce((max, entry) => Math.max(max, Number(entry.volume) || 0), 0) + 1;
      const nextGroupKey = buildVolumeCoverKey(nextVolume);
      pendingVolumeGroupToExpandRef.current = nextGroupKey;
      setCollapsedVolumeGroups((flags) => ({
        ...flags,
        [nextGroupKey]: false,
      }));
      return {
        ...prev,
        volumeEntries: [
          ...prev.volumeEntries,
          {
            volume: nextVolume,
            synopsis: "",
            coverImageUrl: "",
            coverImageAlt: "",
          },
        ],
      };
    });
  }, []);

  const updateVolumeEntryByVolume = useCallback(
    (volume: number | undefined, updater: (entry: ProjectVolumeEntry) => ProjectVolumeEntry) => {
      if (!Number.isFinite(Number(volume))) {
        return;
      }
      const normalizedVolume = Number(volume);
      setFormState((prev) => {
        const nextVolumeEntries = [...prev.volumeEntries];
        const entryIndex = resolveVolumeEntryIndexByVolume(nextVolumeEntries, normalizedVolume);
        if (entryIndex >= 0) {
          nextVolumeEntries[entryIndex] = updater({
            ...nextVolumeEntries[entryIndex],
            volume: normalizedVolume,
          });
        } else {
          nextVolumeEntries.push(
            updater({
              volume: normalizedVolume,
              synopsis: "",
              coverImageUrl: "",
              coverImageAlt: "",
            }),
          );
        }
        nextVolumeEntries.sort((left, right) => left.volume - right.volume);
        return {
          ...prev,
          volumeEntries: nextVolumeEntries,
        };
      });
    },
    [resolveVolumeEntryIndexByVolume],
  );

  const removeVolumeEntryByVolume = useCallback((volume: number | undefined) => {
    if (!Number.isFinite(Number(volume))) {
      return;
    }
    const normalizedVolume = Number(volume);
    const removedKey = buildVolumeCoverKey(normalizedVolume);
    setCollapsedVolumeGroups((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, removedKey)) {
        return prev;
      }
      const next = { ...prev };
      delete next[removedKey];
      return next;
    });
    setFormState((prev) => ({
      ...prev,
      volumeEntries: prev.volumeEntries.filter(
        (entry) => buildVolumeCoverKey(entry?.volume) !== buildVolumeCoverKey(normalizedVolume),
      ),
    }));
  }, []);

  const volumeGroups = useMemo<EpisodeVolumeGroup[]>(() => {
    if (!isChapterBased || !supportsVolumeEntries) {
      return [];
    }
    const groups = new Map<string, EpisodeVolumeGroup>();
    const ensureGroup = (volume?: number) => {
      const key = buildVolumeCoverKey(volume);
      const existing = groups.get(key);
      if (existing) {
        return existing;
      }
      const hasNumericVolume = Number.isFinite(Number(volume));
      const nextGroup: EpisodeVolumeGroup = {
        key,
        volume: hasNumericVolume ? Number(volume) : undefined,
        hasNumericVolume,
        volumeEntryIndex: null,
        episodeItems: [],
      };
      groups.set(key, nextGroup);
      return nextGroup;
    };

    sortedEpisodeDownloads.forEach((item) => {
      ensureGroup(item.episode.volume).episodeItems.push(item);
    });

    formState.volumeEntries.forEach((entry, index) => {
      const parsedVolume = Number(entry?.volume);
      if (!Number.isFinite(parsedVolume)) {
        return;
      }
      const group = ensureGroup(parsedVolume);
      group.volumeEntryIndex = index;
    });

    const list = [...groups.values()];
    list.sort((left, right) => {
      if (left.hasNumericVolume && right.hasNumericVolume) {
        return Number(left.volume || 0) - Number(right.volume || 0);
      }
      if (left.hasNumericVolume) {
        return -1;
      }
      if (right.hasNumericVolume) {
        return 1;
      }
      return 0;
    });
    return list;
  }, [formState.volumeEntries, isChapterBased, sortedEpisodeDownloads, supportsVolumeEntries]);

  const episodeGroupsForRender = useMemo<EpisodeVolumeGroup[]>(() => {
    if (isChapterBased && supportsVolumeEntries) {
      return volumeGroups;
    }
    return [
      {
        key: "all",
        volume: undefined,
        hasNumericVolume: false,
        volumeEntryIndex: null,
        episodeItems: sortedEpisodeDownloads,
      },
    ];
  }, [isChapterBased, sortedEpisodeDownloads, supportsVolumeEntries, volumeGroups]);

  const volumeGroupOpenValues = useMemo(() => {
    if (!(isChapterBased && supportsVolumeEntries)) {
      return episodeGroupsForRender.map((group) => group.key);
    }
    return episodeGroupsForRender
      .filter((group) => collapsedVolumeGroups[group.key] === false)
      .map((group) => group.key);
  }, [collapsedVolumeGroups, episodeGroupsForRender, isChapterBased, supportsVolumeEntries]);

  const handleVolumeGroupAccordionChange = useCallback(
    (values: string[]) => {
      const openValues = new Set(values);
      setCollapsedVolumeGroups((prev) => {
        const next: Record<string, boolean> = {};
        let changed = false;
        episodeGroupsForRender.forEach((group) => {
          const nextValue = !openValues.has(group.key);
          next[group.key] = nextValue;
          if ((prev[group.key] ?? true) !== nextValue) {
            changed = true;
          }
        });
        if (Object.keys(prev).length !== Object.keys(next).length) {
          changed = true;
        }
        return changed ? next : prev;
      });
    },
    [episodeGroupsForRender],
  );

  const episodeOpenValues = useMemo(
    () =>
      sortedEpisodeDownloads
        .filter(({ index }) => !collapsedEpisodes[index])
        .map(({ index }) => getEpisodeAccordionValue(index)),
    [collapsedEpisodes, sortedEpisodeDownloads],
  );

  const handleEpisodeAccordionChange = useCallback(
    (values: string[]) => {
      const openValues = new Set(values);
      const next: Record<number, boolean> = {};
      sortedEpisodeDownloads.forEach(({ index }) => {
        next[index] = !openValues.has(getEpisodeAccordionValue(index));
      });
      setCollapsedEpisodes(next);
    },
    [sortedEpisodeDownloads],
  );

  const toggleEpisodeCollapsed = useCallback((index: number) => {
    setCollapsedEpisodes((prev) => ({
      ...prev,
      [index]: !(prev[index] ?? false),
    }));
  }, []);

  const handleEpisodeHeaderClick = useCallback(
    (index: number, event: ReactMouseEvent<HTMLDivElement>) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-episode-accordion-trigger]")) {
        return;
      }
      if (shouldSkipEpisodeHeaderToggle(target)) {
        return;
      }
      toggleEpisodeCollapsed(index);
    },
    [toggleEpisodeCollapsed],
  );

  useEffect(() => {
    if (!isChapterBased) {
      return;
    }
    const sorted = [...sortedEpisodeDownloads].map((item) => item.episode);
    const current = formState.episodeDownloads;
    const changed = sorted.some((episode, idx) => current[idx] !== episode);
    if (!changed) {
      return;
    }
    setFormState((prev) => ({ ...prev, episodeDownloads: sorted }));
    setCollapsedEpisodes((prev) => {
      const next: Record<number, boolean> = {};
      sortedEpisodeDownloads.forEach((item, idx) => {
        next[idx] = prev[item.index] ?? false;
      });
      return next;
    });
  }, [formState.episodeDownloads, isChapterBased, sortedEpisodeDownloads]);

  useEffect(() => {
    if (!(isChapterBased && supportsVolumeEntries)) {
      return;
    }
    setCollapsedVolumeGroups((prev) => {
      const next: Record<string, boolean> = {};
      const nextKeys = new Set<string>();
      let changed = Object.keys(prev).length !== episodeGroupsForRender.length;

      episodeGroupsForRender.forEach((group) => {
        const key = group.key;
        nextKeys.add(key);
        if (Object.prototype.hasOwnProperty.call(prev, key)) {
          next[key] = prev[key];
        } else {
          next[key] = true;
          changed = true;
        }
      });

      Object.keys(prev).forEach((key) => {
        if (!nextKeys.has(key)) {
          changed = true;
        }
      });

      const pendingKey = pendingVolumeGroupToExpandRef.current;
      if (pendingKey && nextKeys.has(pendingKey)) {
        if (next[pendingKey] !== false) {
          changed = true;
          next[pendingKey] = false;
        }
        pendingVolumeGroupToExpandRef.current = null;
      }

      return changed ? next : prev;
    });
  }, [episodeGroupsForRender, isChapterBased, supportsVolumeEntries]);

  useEffect(() => {
    const currentCount = formState.episodeDownloads.length;
    const previousCount = previousEpisodeCountRef.current;
    if (pendingAddAutoScrollRef.current && currentCount > previousCount) {
      const latestEpisode = formState.episodeDownloads.at(-1) || null;
      pendingEpisodeToScrollRef.current = latestEpisode;
      pendingAddAutoScrollRef.current = false;

      if (latestEpisode) {
        const latestEpisodeIndex = currentCount - 1;
        setCollapsedEpisodes((prev) => ({
          ...prev,
          [latestEpisodeIndex]: false,
        }));
      }
    }
    previousEpisodeCountRef.current = currentCount;
  }, [formState.episodeDownloads]);

  useEffect(() => {
    const pendingEpisode = pendingEpisodeToScrollRef.current;
    if (!pendingEpisode) {
      return;
    }
    const episodeCardNode = episodeCardNodeMapRef.current.get(pendingEpisode);
    if (!episodeCardNode) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const latestNode = episodeCardNodeMapRef.current.get(pendingEpisode);
      if (!latestNode) {
        return;
      }
      latestNode.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      pendingEpisodeToScrollRef.current = null;
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [sortedEpisodeDownloads]);

  useEffect(() => {
    if (!pendingContentSectionScrollRef.current) {
      return;
    }
    if (!editorAccordionValue.includes("episodios")) {
      return;
    }

    const pendingVolumeKey = pendingVolumeGroupToScrollRef.current;
    if (pendingVolumeKey && collapsedVolumeGroups[pendingVolumeKey] !== false) {
      return;
    }

    const scrollTarget = pendingVolumeKey
      ? volumeGroupNodeMapRef.current.get(pendingVolumeKey) || contentSectionRef.current
      : contentSectionRef.current;
    if (!scrollTarget) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const latestTarget = pendingVolumeKey
        ? volumeGroupNodeMapRef.current.get(pendingVolumeKey) || contentSectionRef.current
        : contentSectionRef.current;
      if (!latestTarget) {
        return;
      }
      latestTarget.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      pendingVolumeGroupToScrollRef.current = null;
      pendingContentSectionScrollRef.current = false;
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [collapsedVolumeGroups, editorAccordionValue, episodeGroupsForRender]);

  const isRestorable = useCallback(
    (project: ProjectRecord) => {
      if (!project.deletedAt) {
        return false;
      }
      const ts = new Date(project.deletedAt).getTime();
      if (!Number.isFinite(ts)) {
        return false;
      }
      return Date.now() - ts <= restoreWindowMs;
    },
    [restoreWindowMs],
  );

  const getRestoreRemainingLabel = (project: ProjectRecord) => {
    if (!project.deletedAt) {
      return "";
    }
    const ts = new Date(project.deletedAt).getTime();
    if (!Number.isFinite(ts)) {
      return "";
    }
    const remainingMs = restoreWindowMs - (Date.now() - ts);
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    if (remainingDays <= 1) {
      return "1 dia";
    }
    return `${remainingDays} dias`;
  };

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
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [hasResolvedProjects, totalPages]);

  const openCreate = () => {
    const nextForm = { ...emptyProject };
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
      const initialEpisodes: EditorProjectEpisode[] = Array.isArray(project.episodeDownloads)
        ? project.episodeDownloads.map(
            (episode): EditorProjectEpisode => ({
              ...episode,
              synopsis: String(episode.synopsis || "").trim(),
              _editorKey: resolveEpisodeEditorKey(episode),
              entryKind: episode.entryKind === "extra" ? "extra" : "main",
              entrySubtype: String(episode.entrySubtype || "").trim() || undefined,
              readingOrder: Number.isFinite(Number(episode.readingOrder))
                ? Number(episode.readingOrder)
                : undefined,
              displayLabel:
                episode.entryKind === "extra"
                  ? String(episode.displayLabel || "").trim() || undefined
                  : undefined,
              content: episode.content || "",
              contentFormat: "lexical",
              publicationStatus: episode.publicationStatus === "draft" ? "draft" : "published",
              coverImageAlt: episode.coverImageUrl
                ? resolveAssetAltText(
                    episode.coverImageAlt,
                    getEpisodeCoverAltFallback(isChapterBasedType(project.type || "")),
                  )
                : "",
            }),
          )
        : [];
      const focusedEpisodeIndex = (() => {
        if (!pendingEpisodeFocus) {
          return -1;
        }
        const matches = initialEpisodes
          .map((episode, index) => ({ episode, index }))
          .filter(({ episode }) => {
            if (Number(episode.number) !== pendingEpisodeFocus.number) {
              return false;
            }
            if (!Number.isFinite(pendingEpisodeFocus.volume)) {
              return true;
            }
            return (
              buildEpisodeKey(episode.number, episode.volume) ===
              buildEpisodeKey(pendingEpisodeFocus.number, pendingEpisodeFocus.volume)
            );
          });
        if (!matches.length) {
          return -1;
        }
        if (!Number.isFinite(pendingEpisodeFocus.volume) && matches.length !== 1) {
          return -1;
        }
        return matches[0]?.index ?? -1;
      })();
      const focusedEpisode =
        focusedEpisodeIndex >= 0 ? initialEpisodes[focusedEpisodeIndex] || null : null;
      const focusedVolumeGroupKey = focusedEpisode
        ? buildVolumeCoverKey(focusedEpisode.volume)
        : null;
      const mergedSynopsis = project.synopsis || project.description || "";
      const normalizedVolumeEntries = normalizeProjectVolumeEntries(
        Array.isArray(project.volumeEntries)
          ? project.volumeEntries
          : Array.isArray(project.volumeCovers)
            ? project.volumeCovers
            : [],
      );
      const nextForm: ProjectForm = {
        id: project.id,
        anilistId: project.anilistId ?? null,
        title: project.title || "",
        titleOriginal: project.titleOriginal || "",
        titleEnglish: project.titleEnglish || "",
        synopsis: mergedSynopsis,
        description: mergedSynopsis,
        type: project.type || "",
        status: project.status || "",
        year: project.year || "",
        studio: project.studio || "",
        animationStudios: Array.isArray(project.animationStudios) ? project.animationStudios : [],
        episodes: project.episodes || "",
        tags: Array.isArray(project.tags) ? project.tags : [],
        genres: Array.isArray(project.genres) ? project.genres : [],
        cover: project.cover || "",
        coverAlt: project.cover
          ? resolveAssetAltText(project.coverAlt, DEFAULT_PROJECT_COVER_ALT)
          : "",
        banner: project.banner || "",
        bannerAlt: project.banner
          ? resolveAssetAltText(project.bannerAlt, DEFAULT_PROJECT_BANNER_ALT)
          : "",
        season: project.season || "",
        schedule: project.schedule || "",
        rating: project.rating || "",
        country: project.country || "",
        source: project.source || "",
        discordRoleId: project.discordRoleId || "",
        producers: Array.isArray(project.producers) ? project.producers : [],
        score: project.score ?? null,
        startDate: project.startDate || "",
        endDate: project.endDate || "",
        relations: Array.isArray(project.relations) ? project.relations : [],
        staff: Array.isArray(project.staff) ? project.staff : [],
        animeStaff: Array.isArray(project.animeStaff) ? project.animeStaff : [],
        trailerUrl: project.trailerUrl || "",
        forceHero: Boolean(project.forceHero),
        heroImageUrl: project.heroImageUrl || "",
        heroImageAlt: project.heroImageUrl
          ? resolveAssetAltText(project.heroImageAlt, DEFAULT_PROJECT_HERO_ALT)
          : "",
        readerConfig:
          project.readerConfig && typeof project.readerConfig === "object"
            ? project.readerConfig
            : {},
        volumeEntries: normalizedVolumeEntries,
        volumeCovers: normalizedVolumeEntries
          .filter((entry) => String(entry.coverImageUrl || "").trim())
          .map((entry) => ({
            volume: entry.volume,
            coverImageUrl: entry.coverImageUrl,
            coverImageAlt: entry.coverImageAlt || `Capa do volume ${entry.volume}`,
          })),
        episodeDownloads: initialEpisodes,
      };
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

  const revealEpisodeAtIndex = useCallback(
    (index: number) => {
      const episode = formState.episodeDownloads[index];
      if (episode) {
        pendingEpisodeToScrollRef.current = episode;
      }
      setCollapsedEpisodes((prev) => ({
        ...prev,
        [index]: false,
      }));
    },
    [formState.episodeDownloads],
  );

  useEffect(() => {
    const pendingEpisodeFocus = pendingEpisodeFocusRef.current;
    if (!isEditorOpen || !pendingEpisodeFocus) {
      return;
    }
    if (!sortedEpisodeDownloads.length) {
      return;
    }

    const matches = sortedEpisodeDownloads.filter(({ episode }) => {
      if (Number(episode.number) !== pendingEpisodeFocus.number) {
        return false;
      }
      if (!Number.isFinite(pendingEpisodeFocus.volume)) {
        return true;
      }
      return (
        buildEpisodeKey(episode.number, episode.volume) ===
        buildEpisodeKey(pendingEpisodeFocus.number, pendingEpisodeFocus.volume)
      );
    });

    if (!matches.length) {
      pendingEpisodeFocusRef.current = null;
      return;
    }
    if (!Number.isFinite(pendingEpisodeFocus.volume) && matches.length !== 1) {
      pendingEpisodeFocusRef.current = null;
      return;
    }

    const targetIndex = matches[0]?.index;
    if (!Number.isInteger(targetIndex) || targetIndex < 0) {
      pendingEpisodeFocusRef.current = null;
      return;
    }

    setEditorAccordionValue((prev) => (prev.includes("episodios") ? prev : [...prev, "episodios"]));
    revealEpisodeAtIndex(targetIndex);
    pendingEpisodeFocusRef.current = null;
  }, [isEditorOpen, revealEpisodeAtIndex, sortedEpisodeDownloads]);

  const handleSave = async () => {
    const trimmedTitle = formState.title.trim();
    const baseId = formState.id.trim();
    const normalizedDiscordRoleId = String(formState.discordRoleId || "").trim();
    if (!trimmedTitle) {
      toast({
        title: "Preencha o título do projeto",
        description: "O título é obrigatório para salvar.",
        variant: "destructive",
      });
      return;
    }

    if (normalizedDiscordRoleId && !/^\d+$/.test(normalizedDiscordRoleId)) {
      toast({
        title: "Cargo Discord inválido",
        description: "Use apenas números no campo de cargo Discord.",
        variant: "destructive",
      });
      return;
    }

    const normalizedEpisodesForSave: EditorProjectEpisode[] = formState.episodeDownloads.map(
      (episode) => {
        const parsedNumber = Number(episode.number);
        const parsedVolume = Number(episode.volume);
        const parsedReadingOrder = Number(episode.readingOrder);
        const entryKind: "main" | "extra" = episode.entryKind === "extra" ? "extra" : "main";
        return {
          ...episode,
          number: Number.isFinite(parsedNumber) ? parsedNumber : 0,
          volume: Number.isFinite(parsedVolume) ? parsedVolume : undefined,
          entryKind,
          entrySubtype:
            String(episode.entrySubtype || "").trim() ||
            (entryKind === "extra" ? "extra" : "chapter"),
          readingOrder: Number.isFinite(parsedReadingOrder)
            ? Math.round(parsedReadingOrder)
            : undefined,
          displayLabel:
            entryKind === "extra"
              ? String(episode.displayLabel || "").trim() || undefined
              : undefined,
          contentFormat: "lexical" as const,
          publicationStatus: episode.publicationStatus === "draft" ? "draft" : "published",
          sources: Array.isArray(episode.sources)
            ? episode.sources.map((source) => ({ ...source }))
            : [],
        };
      },
    );
    const duplicateEpisode = findDuplicateEpisodeKey(normalizedEpisodesForSave);
    if (duplicateEpisode) {
      const duplicateIndex = normalizedEpisodesForSave.findIndex(
        (episode) => buildEpisodeKey(episode.number, episode.volume) === duplicateEpisode.key,
      );
      setEditorAccordionValue((prev) =>
        prev.includes("episodios") ? prev : [...prev, "episodios"],
      );
      if (duplicateIndex >= 0) {
        revealEpisodeAtIndex(duplicateIndex);
      }
      toast({
        title: "Capítulos duplicados",
        description: "Cada capítulo precisa ter uma combinação única de número e volume.",
        variant: "destructive",
      });
      return;
    }
    const supportsVolumeEntriesForSave =
      isLightNovelType(formState.type || "") || isMangaType(formState.type || "");
    const normalizedVolumeEntriesForSave = supportsVolumeEntriesForSave
      ? formState.volumeEntries
          .map((entry) => {
            const parsedVolume = Number(entry.volume);
            if (!Number.isFinite(parsedVolume)) {
              return null;
            }
            const coverImageUrl = String(entry.coverImageUrl || "").trim();
            return {
              volume: parsedVolume,
              synopsis: String(entry.synopsis || "").trim(),
              coverImageUrl,
              coverImageAlt: coverImageUrl
                ? resolveAssetAltText(entry.coverImageAlt, `Capa do volume ${parsedVolume}`)
                : "",
            };
          })
          .filter((entry): entry is ProjectVolumeEntry => Boolean(entry))
          .sort((left, right) => left.volume - right.volume)
      : [];
    const duplicateVolumeEntry = findDuplicateVolumeCover(normalizedVolumeEntriesForSave);
    if (supportsVolumeEntriesForSave && duplicateVolumeEntry) {
      setEditorAccordionValue((prev) =>
        prev.includes("episodios") ? prev : [...prev, "episodios"],
      );
      toast({
        title: "Volumes duplicados",
        description: "Cada volume pode aparecer apenas uma vez.",
        variant: "destructive",
      });
      return;
    }
    const normalizedVolumeCoversForSave = normalizedVolumeEntriesForSave
      .filter((entry) => String(entry.coverImageUrl || "").trim())
      .map((entry) => ({
        volume: entry.volume,
        coverImageUrl: entry.coverImageUrl,
        coverImageAlt: entry.coverImageAlt || `Capa do volume ${entry.volume}`,
      }));
    const nextEpisodeSizeDrafts = { ...episodeSizeDrafts };
    const nextEpisodeSizeErrors = { ...episodeSizeErrors };
    let firstInvalidEpisodeSizeIndex: number | null = null;

    Object.entries(episodeSizeDrafts).forEach(([key, draftValue]) => {
      const episodeIndex = Number(key);
      if (!Number.isFinite(episodeIndex)) {
        delete nextEpisodeSizeDrafts[episodeIndex];
        delete nextEpisodeSizeErrors[episodeIndex];
        return;
      }
      const episode = normalizedEpisodesForSave[episodeIndex];
      if (!episode) {
        delete nextEpisodeSizeDrafts[episodeIndex];
        delete nextEpisodeSizeErrors[episodeIndex];
        return;
      }
      const trimmedSize = String(draftValue || "").trim();
      if (!trimmedSize) {
        episode.sizeBytes = undefined;
        delete nextEpisodeSizeDrafts[episodeIndex];
        delete nextEpisodeSizeErrors[episodeIndex];
        return;
      }
      const parsedSize = parseHumanSizeToBytes(trimmedSize);
      if (!parsedSize) {
        nextEpisodeSizeErrors[episodeIndex] = "Use formatos como 700 MB ou 1.4 GB.";
        if (firstInvalidEpisodeSizeIndex === null) {
          firstInvalidEpisodeSizeIndex = episodeIndex;
        }
        return;
      }
      episode.sizeBytes = parsedSize;
      delete nextEpisodeSizeDrafts[episodeIndex];
      delete nextEpisodeSizeErrors[episodeIndex];
    });

    const sizeErrorIndexes = Object.keys(nextEpisodeSizeErrors)
      .map((key) => Number(key))
      .filter(
        (index) =>
          Number.isFinite(index) && String(nextEpisodeSizeErrors[index] || "").trim().length > 0,
      );
    if (sizeErrorIndexes.length > 0) {
      const focusIndex =
        firstInvalidEpisodeSizeIndex !== null ? firstInvalidEpisodeSizeIndex : sizeErrorIndexes[0];
      setEpisodeSizeDrafts(nextEpisodeSizeDrafts);
      setEpisodeSizeErrors(nextEpisodeSizeErrors);
      toast({
        title: "Corrija os tamanhos inválidos",
        description: "Use valores como 700 MB ou 1.4 GB antes de salvar.",
      });
      episodeSizeInputRefs.current[focusIndex]?.focus();
      return;
    }

    setEpisodeSizeDrafts(nextEpisodeSizeDrafts);
    setEpisodeSizeErrors({});

    const prevEpisodesMap = new Map<string, ProjectEpisode>();
    if (editingProject?.episodeDownloads?.length) {
      editingProject.episodeDownloads.forEach((episode) => {
        prevEpisodesMap.set(buildEpisodeKey(episode.number, episode.volume), episode);
      });
    }

    const staffWithPending = formState.staff.map((item, index) => {
      const pendingName = (staffMemberInput[index] || "").trim();
      if (!pendingName) {
        return item;
      }
      const members = item.members || [];
      return {
        ...item,
        members: members.includes(pendingName) ? members : [...members, pendingName],
      };
    });

    const parsedAniListId = parseAniListMediaId(anilistIdInput);
    const resolvedAniListId =
      typeof formState.anilistId === "number" &&
      Number.isInteger(formState.anilistId) &&
      formState.anilistId > 0
        ? formState.anilistId
        : parsedAniListId;
    const normalizedId = editingProject?.id
      ? editingProject.id
      : resolvedAniListId
        ? String(resolvedAniListId)
        : baseId || generateLocalId();
    const payload = {
      ...formState,
      anilistId: resolvedAniListId,
      id: normalizedId,
      title: trimmedTitle,
      titleOriginal: formState.titleOriginal?.trim() || "",
      titleEnglish: formState.titleEnglish?.trim() || "",
      synopsis: formState.synopsis?.trim() || "",
      description: formState.synopsis?.trim() || "",
      type: formState.type?.trim() || "",
      status: formState.status?.trim() || "",
      year: formState.year?.trim() || "",
      studio: formState.studio?.trim() || "",
      animationStudios: normalizeUniqueStringList(formState.animationStudios),
      episodes: formState.episodes?.trim() || "",
      tags: formState.tags.filter(Boolean),
      genres: formState.genres.filter(Boolean),
      cover: formState.cover?.trim() || "",
      coverAlt: formState.cover?.trim()
        ? resolveAssetAltText(formState.coverAlt, DEFAULT_PROJECT_COVER_ALT)
        : "",
      banner: formState.banner?.trim() || "",
      bannerAlt: formState.banner?.trim()
        ? resolveAssetAltText(formState.bannerAlt, DEFAULT_PROJECT_BANNER_ALT)
        : "",
      season: formState.season?.trim() || "",
      schedule: formState.schedule?.trim() || "",
      rating: formState.rating?.trim() || "",
      country: formState.country?.trim() || "",
      source: formState.source?.trim() || "",
      discordRoleId: normalizedDiscordRoleId || "",
      producers: normalizeUniqueStringList(formState.producers),
      startDate: formState.startDate || "",
      endDate: formState.endDate || "",
      trailerUrl: formState.trailerUrl?.trim() || "",
      forceHero: Boolean(formState.forceHero),
      heroImageUrl: formState.heroImageUrl?.trim() || "",
      heroImageAlt: formState.heroImageUrl?.trim()
        ? resolveAssetAltText(formState.heroImageAlt, DEFAULT_PROJECT_HERO_ALT)
        : "",
      volumeEntries: normalizedVolumeEntriesForSave,
      volumeCovers: normalizedVolumeCoversForSave,
      relations: formState.relations
        .filter((item) => item.title || item.relation || item.projectId)
        .filter((item, index, arr) => {
          const key = item.projectId || item.anilistId || item.title;
          if (!key) {
            return true;
          }
          return (
            arr.findIndex((rel) => (rel.projectId || rel.anilistId || rel.title) === key) === index
          );
        }),
      staff: staffWithPending.filter((item) => item.role || item.members.length > 0),
      animeStaff: formState.animeStaff.filter((item) => item.role || item.members.length > 0),
      episodeDownloads: normalizedEpisodesForSave.map((episode) => {
        const { _editorKey: _ignoredEditorKey, ...episodePayload } = episode;
        const prev = prevEpisodesMap.get(buildEpisodeKey(episode.number, episode.volume));
        const hash = String(episode.hash || "").trim();
        const coverImageUrl = String(episode.coverImageUrl || "").trim();
        const parsedSize = Number(episode.sizeBytes);
        const sizeBytes =
          Number.isFinite(parsedSize) && parsedSize > 0 ? Math.round(parsedSize) : undefined;
        const progressState = getProjectProgressStateForEditor(
          formState.type || "",
          episode.completedStages,
        );
        return {
          ...episodePayload,
          coverImageUrl,
          coverImageAlt: coverImageUrl
            ? resolveAssetAltText(
                episode.coverImageAlt,
                getEpisodeCoverAltFallback(isChapterBasedType(formState.type || "")),
              )
            : "",
          hash: hash || undefined,
          sizeBytes,
          sources: (episode.sources || [])
            .map((source) => {
              const label = String(source.label || "").trim();
              const url = String(source.url || "").trim();
              return {
                label,
                url,
              };
            })
            .filter((source) => source.url || source.label),
          completedStages: progressState.completedStages,
          progressStage: progressState.currentStageId,
          contentFormat: "lexical",
          publicationStatus: episode.publicationStatus === "draft" ? "draft" : "published",
          chapterUpdatedAt: prev?.chapterUpdatedAt || episode.chapterUpdatedAt || "",
        };
      }),
    };

    const response = await apiFetch(
      apiBase,
      editingProject ? `/api/projects/${editingProject.id}` : "/api/projects",
      {
        method: editingProject ? "PUT" : "POST",
        auth: true,
        json: payload,
      },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const code = typeof data?.error === "string" ? data.error : "";
      if (code === "title_and_id_required") {
        toast({
          title: "Campos obrigatórios ausentes",
          description: "Informe título e identificador do projeto.",
          variant: "destructive",
        });
        return;
      }
      if (code === "id_exists") {
        toast({
          title: "Identificador já existe",
          description: "Use outro ID para criar o projeto.",
          variant: "destructive",
        });
        return;
      }
      if (code === "forbidden") {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para salvar projetos.",
          variant: "destructive",
        });
        return;
      }
      if (code === "duplicate_episode_key") {
        const duplicateKey = String(data?.key || "");
        const duplicateIndex = normalizedEpisodesForSave.findIndex(
          (episode) => buildEpisodeKey(episode.number, episode.volume) === duplicateKey,
        );
        setEditorAccordionValue((prev) =>
          prev.includes("episodios") ? prev : [...prev, "episodios"],
        );
        if (duplicateIndex >= 0) {
          revealEpisodeAtIndex(duplicateIndex);
        }
        toast({
          title: "Capítulos duplicados",
          description:
            "O servidor bloqueou o save porque existe mais de um capítulo com o mesmo número e volume.",
          variant: "destructive",
        });
        return;
      }
      if (code === "duplicate_volume_cover_key") {
        setEditorAccordionValue((prev) =>
          prev.includes("episodios") ? prev : [...prev, "episodios"],
        );
        toast({
          title: "Volumes duplicados",
          description:
            "O servidor bloqueou o save porque existe mais de uma entrada para o mesmo volume.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Não foi possível salvar o projeto",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
      return;
    }
    const data = await response.json();
    if (data?.project) {
      setFormState(data.project);
    }
    if (editingProject) {
      setProjects((prev) =>
        prev.map((project) => (project.id === editingProject.id ? data.project : project)),
      );
    } else {
      setProjects((prev) => [...prev, data.project]);
    }
    markEditorSnapshot((data?.project || payload) as ProjectForm, anilistIdInput);
    toast({
      title: editingProject ? "Projeto atualizado" : "Projeto criado",
      description: "As alterações foram salvas com sucesso.",
      intent: "success",
    });
    closeEditor();
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    const response = await apiFetch(apiBase, `/api/projects/${deleteTarget.id}`, {
      method: "DELETE",
      auth: true,
    });
    if (!response.ok) {
      toast({
        title: "Não foi possível excluir o projeto",
        variant: "destructive",
      });
      return;
    }
    await loadProjects();
    setDeleteTarget(null);
    if (editingProject && deleteTarget.id === editingProject.id) {
      closeEditor();
    }
    toast({
      title: "Projeto movido para a lixeira",
      description: "Você pode restaurar por 3 dias.",
    });
  };

  const handleRestoreProject = async (project: ProjectRecord) => {
    const response = await apiFetch(apiBase, `/api/projects/${project.id}/restore`, {
      method: "POST",
      auth: true,
    });
    if (!response.ok) {
      if (response.status === 410) {
        toast({ title: "Janela de restauração expirou" });
        await loadProjects();
        return;
      }
      toast({ title: "Não foi possível restaurar o projeto", variant: "destructive" });
      return;
    }
    const data = await response.json();
    setProjects((prev) => prev.map((item) => (item.id === project.id ? data.project : item)));
    toast({ title: "Projeto restaurado" });
  };

  const mapAniListToForm = (media: AniListMedia) => {
    const organization = media.organization || deriveAniListMediaOrganization(media);
    const studio = String(organization?.studio || "").trim();
    const animationStudios = normalizeUniqueStringList(organization?.animationStudios || []);
    const producers = normalizeUniqueStringList(organization?.producers || []);
    const tags = (media.tags || [])
      .filter((tag) => !tag.isMediaSpoiler)
      .sort((a, b) => (b.rank || 0) - (a.rank || 0))
      .slice(0, 8)
      .map((tag) => tag.name)
      .filter(Boolean);
    const relationEdges = media.relations?.edges || [];
    const relationNodes = media.relations?.nodes || [];
    const relationIdMap = new Map<number, string>();
    projects.forEach((item) => {
      if (item.anilistId) {
        relationIdMap.set(item.anilistId, item.id);
      }
      relationIdMap.set(Number(item.id), item.id);
    });
    const seenRelationIds = new Set<string>();
    const relations: ProjectRelation[] = relationNodes.reduce<ProjectRelation[]>(
      (acc, node, index) => {
        const projectId = relationIdMap.get(node.id) || "";
        const relationKey = projectId || String(node.id) || node.title?.romaji || "";
        if (relationKey && seenRelationIds.has(relationKey)) {
          return acc;
        }
        if (relationKey) {
          seenRelationIds.add(relationKey);
        }
        acc.push({
          relation: translateRelation(relationEdges[index]?.relationType || ""),
          title: node.title?.romaji || "",
          format: formatType(node.format || ""),
          status: formatStatus(node.status || ""),
          image: node.coverImage?.large || "",
          anilistId: node.id,
          projectId,
        });
        return acc;
      },
      [],
    );
    const staffEdges = media.staff?.edges || [];
    const staffNodes = media.staff?.nodes || [];
    const staffMap = new Map<string, string[]>();
    staffEdges.forEach((edge, index) => {
      const role = edge.role || "Equipe";
      const name = staffNodes[index]?.name?.full || "";
      if (!name) {
        return;
      }
      const list = staffMap.get(role) || [];
      list.push(name);
      staffMap.set(role, list);
    });
    const staff: ProjectStaff[] = Array.from(staffMap.entries()).map(([role, members]) => ({
      role,
      members,
    }));

    const startDate = media.startDate?.year
      ? `${media.startDate.year}-${String(media.startDate.month || 1).padStart(2, "0")}-${String(
          media.startDate.day || 1,
        ).padStart(2, "0")}`
      : "";
    const endDate = media.endDate?.year
      ? `${media.endDate.year}-${String(media.endDate.month || 1).padStart(2, "0")}-${String(
          media.endDate.day || 1,
        ).padStart(2, "0")}`
      : "";

    const trailerUrl =
      media.trailer?.id && media.trailer?.site
        ? media.trailer.site.toLowerCase() === "youtube"
          ? `https://www.youtube.com/watch?v=${media.trailer.id}`
          : media.trailer.site.toLowerCase() === "dailymotion"
            ? `https://www.dailymotion.com/video/${media.trailer.id}`
            : ""
        : "";

    const tagsFromMedia = (media.tags || [])
      .filter((tag) => !tag.isMediaSpoiler)
      .map((tag) => tag.name)
      .filter(Boolean);

    const genresFromMedia = (media.genres || []).filter(Boolean);

    const mergedSynopsis = stripHtml(media.description || "");
    setFormState((prev) => ({
      ...prev,
      id: prev.id || String(media.id),
      anilistId: media.id,
      title: media.title?.romaji || media.title?.english || media.title?.native || prev.title,
      titleOriginal: media.title?.native || "",
      titleEnglish: media.title?.english || "",
      synopsis: mergedSynopsis,
      description: mergedSynopsis,
      type: formatType(media.format || "") || prev.type,
      status: formatStatus(media.status || "") || prev.status,
      year: media.seasonYear ? String(media.seasonYear) : prev.year,
      studio: studio || prev.studio,
      animationStudios,
      episodes: media.episodes ? String(media.episodes) : prev.episodes,
      genres: genresFromMedia.length ? genresFromMedia : prev.genres,
      tags: tags.length ? tags : prev.tags,
      cover: media.coverImage?.extraLarge || media.coverImage?.large || prev.cover,
      banner: media.bannerImage || prev.banner,
      season: formatSeason(media.season, media.seasonYear) || prev.season,
      country: media.countryOfOrigin || prev.country,
      source: media.source || prev.source,
      producers,
      score:
        typeof media.averageScore === "number" && Number.isFinite(media.averageScore)
          ? media.averageScore
          : (prev.score ?? null),
      startDate,
      endDate,
      relations: relations.length ? relations : prev.relations,
      animeStaff: staff.length ? staff : prev.animeStaff,
      trailerUrl: trailerUrl || prev.trailerUrl,
    }));

    const syncTags = tagsFromMedia.length ? tagsFromMedia : tags;
    const syncGenres = genresFromMedia;
    if (syncTags.length || syncGenres.length) {
      apiFetch(apiBase, "/api/tag-translations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({ tags: syncTags, genres: syncGenres }),
      }).catch(() => undefined);
    }
  };

  const handleImportAniList = async () => {
    const id = parseAniListMediaId(anilistIdInput);
    if (id === null) {
      toast({
        title: "ID do AniList inválido",
        description: "Informe um ID ou URL válida do AniList antes de importar.",
        variant: "destructive",
      });
      return;
    }
    const response = await apiFetch(apiBase, `/api/anilist/${id}`, { auth: true });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const code = typeof data?.error === "string" ? data.error : "";
      if (code === "invalid_id") {
        toast({
          title: "ID do AniList inválido",
          description: "Não foi possível buscar esse identificador.",
          variant: "destructive",
        });
        return;
      }
      if (code === "forbidden") {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para usar a integração do AniList.",
          variant: "destructive",
        });
        return;
      }
      if (code === "anilist_failed") {
        toast({
          title: "Falha ao importar do AniList",
          description: "A API externa não respondeu como esperado.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Não foi possível importar do AniList",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
      return;
    }
    const data = await response.json();
    const media = data?.data?.Media as AniListMedia | undefined;
    if (!media) {
      toast({
        title: "AniList sem resultados",
        description: "Nenhuma mídia foi encontrada para esse ID.",
        variant: "destructive",
      });
      return;
    }
    mapAniListToForm(media);
    toast({
      title: "Dados importados do AniList",
      description: "Campos do projeto foram preenchidos automaticamente.",
      intent: "success",
    });
  };

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

  const handleAddEpisodeDownload = () => {
    pendingAddAutoScrollRef.current = true;
    if (isChapterBased && supportsVolumeEntries) {
      const semVolumeKey = buildVolumeCoverKey(undefined);
      pendingVolumeGroupToExpandRef.current = semVolumeKey;
      setCollapsedVolumeGroups((prev) => ({
        ...prev,
        [semVolumeKey]: false,
      }));
    }
    setFormState((prev) => {
      const nextMainNumber = resolveNextMainEpisodeNumber(prev.episodeDownloads, {
        isExtra: (episode) => getEpisodeEntryKind(episode) === "extra",
      });
      const newEpisode: EditorProjectEpisode = {
        _editorKey: generateLocalId(),
        number: nextMainNumber,
        volume: undefined,
        title: "",
        synopsis: "",
        entryKind: "main",
        entrySubtype: "chapter",
        readingOrder: undefined,
        displayLabel: undefined,
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
        publicationStatus: "published",
      };
      const next = [...prev.episodeDownloads, newEpisode];
      return { ...prev, episodeDownloads: next };
    });
  };

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
                    <AccordionItem value="episodios" className={editorSectionClassName}>
                      <AccordionTrigger className={editorSectionTriggerClassName}>
                        <ProjectEditorAccordionHeader
                          title={isChapterBased ? "Conteúdo" : "Episódios"}
                          subtitle={`${formState.episodeDownloads.length} ${
                            isChapterBased ? "capítulos" : "episódios"
                          }`}
                        />
                      </AccordionTrigger>
                      <AccordionContent
                        className={editorSectionContentClassName}
                        contentClassName={isChapterBased ? chapterOpenContentClassName : undefined}
                      >
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
                                    ref={(node) => {
                                      if (node) {
                                        volumeGroupNodeMapRef.current.set(group.key, node);
                                      } else {
                                        volumeGroupNodeMapRef.current.delete(group.key);
                                      }
                                    }}
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
                                                ref={(node) => {
                                                  if (node) {
                                                    episodeCardNodeMapRef.current.set(
                                                      episode,
                                                      node,
                                                    );
                                                    if (
                                                      pendingEpisodeToScrollRef.current === episode
                                                    ) {
                                                      requestAnimationFrame(() => {
                                                        const latestNode =
                                                          episodeCardNodeMapRef.current.get(
                                                            episode,
                                                          );
                                                        if (
                                                          !latestNode ||
                                                          pendingEpisodeToScrollRef.current !==
                                                            episode
                                                        ) {
                                                          return;
                                                        }
                                                        latestNode.scrollIntoView({
                                                          behavior: "smooth",
                                                          block: "center",
                                                          inline: "nearest",
                                                        });
                                                        pendingEpisodeToScrollRef.current = null;
                                                      });
                                                    }
                                                  }
                                                }}
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
                      </AccordionContent>
                    </AccordionItem>
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
