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
import ProjectMemberCombobox from "@/components/dashboard/ProjectMemberCombobox";
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
import ProjectEditorImageLibraryDialog from "@/components/dashboard/project-editor/ProjectEditorImageLibraryDialog";
import ProjectEditorMediaSection from "@/components/dashboard/project-editor/ProjectEditorMediaSection";
import { useProjectEditorImageLibrary } from "@/components/dashboard/project-editor/useProjectEditorImageLibrary";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import type {
  ProjectEpisode,
  ProjectReaderConfig,
  ProjectVolumeCover,
  ProjectVolumeEntry,
} from "@/data/projects";
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
  buildDuplicatedAnimeEpisode,
  cloneEpisodeSources,
  getAnimeEpisodeCompletionIssues,
  getAnimeEpisodeCompletionLabel,
  matchesAnimeEpisodeQuickFilter,
  shiftIsoDateByDays,
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
  buildTranslationMap,
  normalizeKey,
  sortByTranslatedLabel,
  translateAnilistRole,
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
import {
  normalizeProjectReaderConfig,
  PROJECT_READER_DIRECTIONS,
  PROJECT_READER_VIEW_MODES,
} from "../../shared/project-reader.js";
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
import { Link, useNavigate, useSearchParams } from "react-router-dom";

type ProjectRelation = {
  relation: string;
  title: string;
  format: string;
  status: string;
  image: string;
  anilistId?: number;
  projectId?: string;
};

type ProjectStaff = {
  role: string;
  members: string[];
};

type TaxonomySuggestionOption = {
  value: string;
  label: string;
  normalizedValue: string;
  normalizedLabel: string;
};

type EditorProjectEpisode = ProjectEpisode & {
  _editorKey?: string;
};

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

type ProjectRecord = {
  id: string;
  anilistId?: number | null;
  title: string;
  titleOriginal?: string;
  titleEnglish?: string;
  synopsis: string;
  description: string;
  type: string;
  status: string;
  year: string;
  studio: string;
  animationStudios: string[];
  episodes: string;
  tags: string[];
  genres: string[];
  cover: string;
  coverAlt: string;
  banner: string;
  bannerAlt: string;
  season: string;
  schedule: string;
  rating: string;
  country: string;
  source: string;
  discordRoleId?: string;
  producers: string[];
  score: number | null;
  startDate: string;
  endDate: string;
  relations: ProjectRelation[];
  staff: ProjectStaff[];
  animeStaff: ProjectStaff[];
  trailerUrl: string;
  forceHero?: boolean;
  heroImageUrl?: string;
  heroImageAlt: string;
  readerConfig?: ProjectReaderConfig;
  volumeEntries: ProjectVolumeEntry[];
  volumeCovers: ProjectVolumeCover[];
  episodeDownloads: ProjectEpisode[];
  views: number;
  commentsCount: number;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
};

const PROJECTS_PAGE_CACHE_TTL_MS = 60_000;

type ProjectsPageCacheEntry = {
  projects: ProjectRecord[];
  projectTypeOptions: string[];
  memberDirectory: string[];
  tagTranslations: Record<string, string>;
  genreTranslations: Record<string, string>;
  staffRoleTranslations: Record<string, string>;
  expiresAt: number;
};

let projectsPageCache: ProjectsPageCacheEntry | null = null;

const cloneProjectsPageCache = (value: Omit<ProjectsPageCacheEntry, "expiresAt">) => ({
  projects: JSON.parse(JSON.stringify(value.projects)) as ProjectRecord[],
  projectTypeOptions: [...value.projectTypeOptions],
  memberDirectory: [...value.memberDirectory],
  tagTranslations: { ...value.tagTranslations },
  genreTranslations: { ...value.genreTranslations },
  staffRoleTranslations: { ...value.staffRoleTranslations },
});

const readProjectsPageCache = () => {
  if (!projectsPageCache) {
    return null;
  }
  if (projectsPageCache.expiresAt <= Date.now()) {
    projectsPageCache = null;
    return null;
  }
  return cloneProjectsPageCache(projectsPageCache);
};

const writeProjectsPageCache = (value: Omit<ProjectsPageCacheEntry, "expiresAt">) => {
  projectsPageCache = {
    ...cloneProjectsPageCache(value),
    expiresAt: Date.now() + PROJECTS_PAGE_CACHE_TTL_MS,
  };
};

const appendUniqueValue = (values: string[], nextValue: string) =>
  values.includes(nextValue) ? values : [...values, nextValue];

const buildTaxonomySuggestionOptions = (
  values: string[],
  translate: (value: string) => string,
): TaxonomySuggestionOption[] => {
  const uniqueValues = Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  );

  return sortByTranslatedLabel(uniqueValues, translate).map((value) => {
    const label = translate(value);
    return {
      value,
      label,
      normalizedValue: normalizeKey(value),
      normalizedLabel: normalizeKey(label),
    };
  });
};

const buildTaxonomySuggestionLookup = (options: TaxonomySuggestionOption[]) => {
  const lookup = new Map<string, string>();

  options.forEach((option) => {
    if (option.normalizedValue && !lookup.has(option.normalizedValue)) {
      lookup.set(option.normalizedValue, option.value);
    }
    if (option.normalizedLabel && !lookup.has(option.normalizedLabel)) {
      lookup.set(option.normalizedLabel, option.value);
    }
  });

  return lookup;
};

const filterTaxonomySuggestions = (
  options: TaxonomySuggestionOption[],
  query: string,
  selectedValues: string[],
) => {
  const normalizedQuery = normalizeKey(query);
  if (!normalizedQuery) {
    return [];
  }

  const selectedSet = new Set(selectedValues);
  return options
    .filter(
      (option) =>
        !selectedSet.has(option.value) &&
        (option.normalizedValue.includes(normalizedQuery) ||
          option.normalizedLabel.includes(normalizedQuery)),
    )
    .slice(0, 6);
};

const resolveTaxonomyInputValue = (input: string, lookup: Map<string, string>) => {
  const trimmedInput = String(input || "").trim();
  if (!trimmedInput) {
    return "";
  }
  return lookup.get(normalizeKey(trimmedInput)) || trimmedInput;
};

type ProjectForm = Omit<ProjectRecord, "views" | "commentsCount" | "order" | "episodeDownloads"> & {
  episodeDownloads: EditorProjectEpisode[];
};

type SortedEpisodeItem = {
  episode: EditorProjectEpisode;
  index: number;
};

type EpisodeVolumeGroup = {
  key: string;
  volume?: number;
  hasNumericVolume: boolean;
  volumeEntryIndex: number | null;
  episodeItems: SortedEpisodeItem[];
};

type AniListMedia = {
  id: number;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  description?: string | null;
  episodes?: number | null;
  genres?: string[] | null;
  format?: string | null;
  status?: string | null;
  countryOfOrigin?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  endDate?: { year?: number | null; month?: number | null; day?: number | null } | null;
  source?: string | null;
  averageScore?: number | null;
  bannerImage?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
  studios?: {
    edges?: Array<{
      isMain?: boolean | null;
      node?: {
        id?: number | string | null;
        name?: string | null;
        isAnimationStudio?: boolean | null;
      } | null;
    }>;
  } | null;
  organization?: {
    studio?: string | null;
    animationStudios?: string[] | null;
    producers?: string[] | null;
  } | null;
  tags?: Array<{ name: string; rank?: number | null; isMediaSpoiler?: boolean | null }> | null;
  trailer?: { id?: string | null; site?: string | null } | null;
  relations?: {
    edges?: Array<{ relationType?: string | null }>;
    nodes?: Array<{
      id: number;
      title?: { romaji?: string | null } | null;
      format?: string | null;
      status?: string | null;
      coverImage?: { large?: string | null } | null;
    }>;
  } | null;
  staff?: {
    edges?: Array<{ role?: string | null }>;
    nodes?: Array<{ name?: { full?: string | null } | null }>;
  } | null;
};

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

const shiftDraftAfterRemoval = (draft: Record<number, string>, removedIndex: number) => {
  const next: Record<number, string> = {};
  Object.entries(draft).forEach(([key, value]) => {
    const index = Number(key);
    if (!Number.isFinite(index) || index === removedIndex) {
      return;
    }
    next[index > removedIndex ? index - 1 : index] = value;
  });
  return next;
};

const clearIndexedDraftValue = (draft: Record<number, string>, index: number) => {
  if (!Object.prototype.hasOwnProperty.call(draft, index)) {
    return draft;
  }
  const next = { ...draft };
  delete next[index];
  return next;
};

const shiftCollapsedEpisodesAfterRemoval = (
  collapsed: Record<number, boolean>,
  removedIndex: number,
) => {
  const next: Record<number, boolean> = {};
  Object.entries(collapsed).forEach(([key, value]) => {
    const index = Number(key);
    if (!Number.isFinite(index) || index === removedIndex) {
      return;
    }
    next[index > removedIndex ? index - 1 : index] = Boolean(value);
  });
  return next;
};

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

const buildCompletionBadges = (episode: Partial<ProjectEpisode> | null | undefined) =>
  getAnimeEpisodeCompletionIssues(episode).map((issue) => ({
    issue,
    label: getAnimeEpisodeCompletionLabel(issue),
  }));

const moveIndexedItem = <T,>(items: T[], from: number, to: number) => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (typeof moved === "undefined") {
    return items;
  }
  next.splice(to, 0, moved);
  return next;
};

const parsePageParam = (value: string | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
};

const parseTypeParam = (value: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "Todos";
  }
  return normalized;
};

const buildProjectEditorSnapshot = (form: ProjectForm, anilistIdInput: string) =>
  JSON.stringify({
    form,
    anilistIdInput: anilistIdInput.trim(),
  });

const DashboardProjectsEditor = () => {
  usePageMeta({ title: "Projetos", noIndex: true });
  const navigate = useNavigate();
  const apiBase = getApiBase();
  const { settings: publicSettings } = useSiteSettings();
  const restoreWindowMs = 3 * 24 * 60 * 60 * 1000;
  const { currentUser, isLoadingUser } = useDashboardCurrentUser();
  const hasLoadedCurrentUser = !isLoadingUser;
  const initialCacheRef = useRef(readProjectsPageCache());
  const [projects, setProjects] = useState<ProjectRecord[]>(
    initialCacheRef.current?.projects ?? [],
  );
  const [projectTypeOptions, setProjectTypeOptions] = useState<string[]>(
    initialCacheRef.current?.projectTypeOptions ?? defaultFormatOptions,
  );
  const [isInitialLoading, setIsInitialLoading] = useState(!initialCacheRef.current);
  const [isRefreshing, setIsRefreshing] = useState(Boolean(initialCacheRef.current));
  const [hasLoadedOnce, setHasLoadedOnce] = useState(Boolean(initialCacheRef.current));
  const [hasResolvedProjects, setHasResolvedProjects] = useState(Boolean(initialCacheRef.current));
  const [hasResolvedProjectTypes, setHasResolvedProjectTypes] = useState(
    Boolean(initialCacheRef.current),
  );
  const [hasResolvedMemberDirectory, setHasResolvedMemberDirectory] = useState(
    Boolean(initialCacheRef.current),
  );
  const [hasResolvedTranslations, setHasResolvedTranslations] = useState(
    Boolean(initialCacheRef.current),
  );
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortMode, setSortMode] = useState<"alpha" | "status" | "views" | "comments" | "recent">(
    () => {
      const sortParam = searchParams.get("sort");
      if (
        sortParam === "alpha" ||
        sortParam === "status" ||
        sortParam === "views" ||
        sortParam === "comments" ||
        sortParam === "recent"
      ) {
        return sortParam;
      }
      return "alpha";
    },
  );
  const [currentPage, setCurrentPage] = useState(() => parsePageParam(searchParams.get("page")));
  const [selectedType, setSelectedType] = useState(() => parseTypeParam(searchParams.get("type")));
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  useEditorScrollLock(isEditorOpen);
  useEditorScrollStability(isEditorOpen);
  const [isEditorDialogScrolled, setIsEditorDialogScrolled] = useState(false);

  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [formState, setFormState] = useState<ProjectForm>(emptyProject);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [anilistIdInput, setAnilistIdInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [genreInput, setGenreInput] = useState("");
  const [animationStudioInput, setAnimationStudioInput] = useState("");
  const [producerInput, setProducerInput] = useState("");
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>(
    initialCacheRef.current?.tagTranslations ?? {},
  );
  const [genreTranslations, setGenreTranslations] = useState<Record<string, string>>(
    initialCacheRef.current?.genreTranslations ?? {},
  );
  const [staffRoleTranslations, setStaffRoleTranslations] = useState<Record<string, string>>(
    initialCacheRef.current?.staffRoleTranslations ?? {},
  );
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
  const [animeEpisodeFilter, setAnimeEpisodeFilter] = useState<AnimeEpisodeQuickFilter>("all");
  const [selectedAnimeEpisodeKeys, setSelectedAnimeEpisodeKeys] = useState<string[]>([]);
  const [removedAnimeEpisode, setRemovedAnimeEpisode] = useState<{
    episode: EditorProjectEpisode;
    index: number;
  } | null>(null);
  const [animeBatchCreateOpen, setAnimeBatchCreateOpen] = useState(false);
  const [animeBatchStartNumber, setAnimeBatchStartNumber] = useState("");
  const [animeBatchQuantity, setAnimeBatchQuantity] = useState("3");
  const [animeBatchCadenceDays, setAnimeBatchCadenceDays] = useState("");
  const [animeBatchDurationInput, setAnimeBatchDurationInput] = useState("");
  const [animeBatchSourceType, setAnimeBatchSourceType] =
    useState<EditorProjectEpisode["sourceType"]>("TV");
  const [animeBatchPublicationStatus, setAnimeBatchPublicationStatus] = useState<
    "draft" | "published"
  >("draft");
  const [animeBatchOperationDuration, setAnimeBatchOperationDuration] = useState("");
  const [animeBatchOperationSourceType, setAnimeBatchOperationSourceType] =
    useState<EditorProjectEpisode["sourceType"]>("TV");
  const [animeBatchOperationPublicationStatus, setAnimeBatchOperationPublicationStatus] = useState<
    "draft" | "published"
  >("draft");
  const [animeBatchOperationShiftDays, setAnimeBatchOperationShiftDays] = useState("");
  const [animeBatchOperationCompletedStages, setAnimeBatchOperationCompletedStages] = useState<
    string[]
  >([]);
  const [memberDirectory, setMemberDirectory] = useState<string[]>(
    initialCacheRef.current?.memberDirectory ?? [],
  );
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
  const pendingEpisodeFocusRef = useRef<{ number: number; volume?: number } | null>(null);
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
  const closeEditor = useCallback(() => {
    pendingEpisodeFocusRef.current = null;
    resetPendingContentNavigation();
    setIsEditorOpen(false);
    setEditingProject(null);
  }, [resetPendingContentNavigation]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("Sair da edição?");
  const [confirmDescription, setConfirmDescription] = useState(
    "Você tem alterações não salvas. Deseja continuar?",
  );
  const confirmActionRef = useRef<(() => void) | null>(null);
  const confirmCancelRef = useRef<(() => void) | null>(null);
  const autoEditHandledRef = useRef<string | null>(null);
  const isApplyingSearchParamsRef = useRef(false);
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(hasLoadedOnce);
  const queryStateRef = useRef({
    sortMode,
    currentPage,
    selectedType,
  });
  const hasInitializedListFiltersRef = useRef(false);
  const editorInitialSnapshotRef = useRef<string>(buildProjectEditorSnapshot(emptyProject, ""));
  const isDirty = useMemo(
    () =>
      buildProjectEditorSnapshot(formState, anilistIdInput) !== editorInitialSnapshotRef.current,
    [anilistIdInput, formState],
  );
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
  const handleEditorOpenChange = (next: boolean) => {
    if (!next && isLibraryOpen) {
      return;
    }
    if (!next) {
      if (!isDirty) {
        closeEditor();
        return;
      }
      setConfirmTitle("Sair da edição?");
      setConfirmDescription("Você tem alterações não salvas. Deseja continuar?");
      confirmActionRef.current = () => {
        closeEditor();
      };
      confirmCancelRef.current = () => {
        setConfirmOpen(false);
      };
      setConfirmOpen(true);
      return;
    }
    setIsEditorOpen(true);
  };

  useEffect(() => {
    if (!isEditorOpen) {
      setIsEditorDialogScrolled(false);
    }
  }, [isEditorOpen]);

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

  const tagTranslationMap = useMemo(() => buildTranslationMap(tagTranslations), [tagTranslations]);
  const genreTranslationMap = useMemo(
    () => buildTranslationMap(genreTranslations),
    [genreTranslations],
  );
  const staffRoleTranslationMap = useMemo(
    () => buildTranslationMap(staffRoleTranslations),
    [staffRoleTranslations],
  );

  const translatedSortedEditorTags = useMemo(
    () => sortByTranslatedLabel(formState.tags, (tag) => translateTag(tag, tagTranslationMap)),
    [formState.tags, tagTranslationMap],
  );

  const translatedSortedEditorGenres = useMemo(
    () =>
      sortByTranslatedLabel(formState.genres, (genre) =>
        translateGenre(genre, genreTranslationMap),
      ),
    [formState.genres, genreTranslationMap],
  );

  const knownTagValues = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((project) => {
      (project.tags || []).forEach((tag) => {
        const normalizedTag = String(tag || "").trim();
        if (normalizedTag) {
          set.add(normalizedTag);
        }
      });
    });
    Object.keys(tagTranslations).forEach((tag) => {
      const normalizedTag = String(tag || "").trim();
      if (normalizedTag) {
        set.add(normalizedTag);
      }
    });
    formState.tags.forEach((tag) => {
      const normalizedTag = String(tag || "").trim();
      if (normalizedTag) {
        set.add(normalizedTag);
      }
    });
    return Array.from(set);
  }, [formState.tags, projects, tagTranslations]);

  const knownGenresValues = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((project) => {
      (project.genres || []).forEach((genre) => {
        const normalizedGenre = String(genre || "").trim();
        if (normalizedGenre) {
          set.add(normalizedGenre);
        }
      });
    });
    Object.keys(genreTranslations).forEach((genre) => {
      const normalizedGenre = String(genre || "").trim();
      if (normalizedGenre) {
        set.add(normalizedGenre);
      }
    });
    formState.genres.forEach((genre) => {
      const normalizedGenre = String(genre || "").trim();
      if (normalizedGenre) {
        set.add(normalizedGenre);
      }
    });
    return Array.from(set);
  }, [formState.genres, genreTranslations, projects]);

  const tagSuggestionOptions = useMemo(
    () =>
      buildTaxonomySuggestionOptions(knownTagValues, (tag) => translateTag(tag, tagTranslationMap)),
    [knownTagValues, tagTranslationMap],
  );

  const genreSuggestionOptions = useMemo(
    () =>
      buildTaxonomySuggestionOptions(knownGenresValues, (genre) =>
        translateGenre(genre, genreTranslationMap),
      ),
    [genreTranslationMap, knownGenresValues],
  );

  const tagSuggestionLookup = useMemo(
    () => buildTaxonomySuggestionLookup(tagSuggestionOptions),
    [tagSuggestionOptions],
  );

  const genreSuggestionLookup = useMemo(
    () => buildTaxonomySuggestionLookup(genreSuggestionOptions),
    [genreSuggestionOptions],
  );

  const tagSuggestions = useMemo(() => {
    return filterTaxonomySuggestions(tagSuggestionOptions, tagInput, formState.tags);
  }, [formState.tags, tagInput, tagSuggestionOptions]);

  const genreSuggestions = useMemo(() => {
    return filterTaxonomySuggestions(genreSuggestionOptions, genreInput, formState.genres);
  }, [formState.genres, genreInput, genreSuggestionOptions]);

  useEffect(() => {
    queryStateRef.current = {
      sortMode,
      currentPage,
      selectedType,
    };
  }, [currentPage, selectedType, sortMode]);

  useEffect(() => {
    const sortParam = searchParams.get("sort");
    const nextSort =
      sortParam === "alpha" ||
      sortParam === "status" ||
      sortParam === "views" ||
      sortParam === "comments" ||
      sortParam === "recent"
        ? sortParam
        : "alpha";
    const nextPage = parsePageParam(searchParams.get("page"));
    const nextType = parseTypeParam(searchParams.get("type"));
    const {
      sortMode: currentSortMode,
      currentPage: currentCurrentPage,
      selectedType: currentSelectedType,
    } = queryStateRef.current;
    const shouldApply =
      currentSortMode !== nextSort ||
      currentCurrentPage !== nextPage ||
      currentSelectedType !== nextType;
    if (!shouldApply) {
      return;
    }
    isApplyingSearchParamsRef.current = true;
    setSortMode((prev) => (prev === nextSort ? prev : nextSort));
    setCurrentPage((prev) => (prev === nextPage ? prev : nextPage));
    setSelectedType((prev) => (prev === nextType ? prev : nextType));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (sortMode === "alpha") {
      nextParams.delete("sort");
    } else {
      nextParams.set("sort", sortMode);
    }
    if (currentPage <= 1) {
      nextParams.delete("page");
    } else {
      nextParams.set("page", String(currentPage));
    }
    if (selectedType === "Todos") {
      nextParams.delete("type");
    } else {
      nextParams.set("type", selectedType);
    }
    const currentQuery = searchParams.toString();
    const nextQuery = nextParams.toString();
    if (isApplyingSearchParamsRef.current) {
      if (nextQuery === currentQuery) {
        isApplyingSearchParamsRef.current = false;
      }
      return;
    }
    if (nextQuery !== currentQuery) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [currentPage, searchParams, selectedType, setSearchParams, sortMode]);

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
  const readerConfigDraft = useMemo(
    () => normalizeProjectReaderConfig(formState.readerConfig, { projectType: formState.type }),
    [formState.readerConfig, formState.type],
  );
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

  const filteredAnimeEpisodeItems = useMemo(
    () =>
      isChapterBased
        ? []
        : sortedEpisodeDownloads.filter(({ episode }) =>
            matchesAnimeEpisodeQuickFilter(episode, animeEpisodeFilter),
          ),
    [animeEpisodeFilter, isChapterBased, sortedEpisodeDownloads],
  );

  const filteredAnimeEpisodeKeySet = useMemo(
    () => new Set(filteredAnimeEpisodeItems.map(({ episode }) => String(episode._editorKey || ""))),
    [filteredAnimeEpisodeItems],
  );

  const selectedAnimeEpisodeKeySet = useMemo(
    () => new Set(selectedAnimeEpisodeKeys),
    [selectedAnimeEpisodeKeys],
  );

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

  useEffect(() => {
    if (isChapterBased) {
      setSelectedAnimeEpisodeKeys([]);
      setRemovedAnimeEpisode(null);
      return;
    }
    const availableKeys = new Set(
      formState.episodeDownloads.map((episode) => String(episode._editorKey || "")),
    );
    setSelectedAnimeEpisodeKeys((current) => current.filter((key) => availableKeys.has(key)));
  }, [formState.episodeDownloads, isChapterBased]);

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

  const loadProjects = useCallback(async () => {
    const response = await apiFetch(apiBase, "/api/projects", { auth: true });
    if (!response.ok) {
      throw new Error("projects_load_failed");
    }
    const data = await response.json();
    const nextProjects = Array.isArray(data.projects) ? data.projects : [];
    setProjects(nextProjects);
    setHasResolvedProjects(true);
    setHasLoadedOnce(true);
    setHasLoadError(false);
    writeProjectsPageCache({
      projects: nextProjects,
      projectTypeOptions,
      memberDirectory,
      tagTranslations,
      genreTranslations,
      staffRoleTranslations,
    });
    return nextProjects;
  }, [
    apiBase,
    genreTranslations,
    memberDirectory,
    projectTypeOptions,
    staffRoleTranslations,
    tagTranslations,
  ]);

  const loadProjectTypes = useCallback(async () => {
    const response = await apiFetch(apiBase, "/api/project-types", {
      auth: true,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("project_types_load_failed");
    }
    const data = await response.json();
    const remoteTypes = Array.isArray(data?.types)
      ? data.types.map((item: unknown) => String(item || "").trim()).filter(Boolean)
      : [];
    const uniqueTypes = Array.from(new Set([...remoteTypes, ...defaultFormatOptions]));
    const nextProjectTypeOptions = uniqueTypes.length > 0 ? uniqueTypes : defaultFormatOptions;
    setProjectTypeOptions(nextProjectTypeOptions);
    setHasResolvedProjectTypes(true);
    return nextProjectTypeOptions;
  }, [apiBase]);

  useEffect(() => {
    hasLoadedOnceRef.current = hasLoadedOnce;
  }, [hasLoadedOnce]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const background = hasLoadedOnceRef.current;
      const cached = initialCacheRef.current;

      setHasLoadError(false);
      if (background) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
        setHasResolvedProjects(false);
      }
      if (!cached) {
        setHasResolvedProjectTypes(false);
        setHasResolvedMemberDirectory(false);
        setHasResolvedTranslations(false);
      }

      try {
        const projectsPromise = loadProjects();
        const projectTypesPromise = loadProjectTypes();
        const usersPromise = apiFetch(apiBase, "/api/users", { auth: true });
        const translationsPromise = apiFetch(apiBase, "/api/public/tag-translations", {
          cache: "no-store",
        });

        const nextProjects = await projectsPromise;
        if (!isActive || requestIdRef.current !== requestId) {
          return;
        }

        setIsInitialLoading(false);

        let nextProjectTypeOptions = projectTypeOptions;
        let nextMemberDirectory = memberDirectory;
        let nextTagTranslations = tagTranslations;
        let nextGenreTranslations = genreTranslations;
        let nextStaffRoleTranslations = staffRoleTranslations;

        const [projectTypesResult, usersResult, translationsResult] = await Promise.allSettled([
          projectTypesPromise,
          usersPromise,
          translationsPromise,
        ]);
        if (!isActive || requestIdRef.current !== requestId) {
          return;
        }

        if (projectTypesResult.status === "rejected") {
          nextProjectTypeOptions = defaultFormatOptions;
          setProjectTypeOptions(defaultFormatOptions);
        } else {
          nextProjectTypeOptions = projectTypesResult.value;
        }
        setHasResolvedProjectTypes(true);

        if (usersResult.status === "fulfilled" && usersResult.value.ok) {
          const data = (await usersResult.value.json()) as {
            users?: Array<{ name?: string; status?: string }>;
          };
          const names = Array.isArray(data.users)
            ? data.users
                .filter((user) => user.status === "active")
                .map((user) => user.name)
                .filter((name): name is string => Boolean(name))
            : [];
          nextMemberDirectory = Array.from(new Set(names)).sort((a, b) =>
            a.localeCompare(b, "pt-BR"),
          );
        } else {
          nextMemberDirectory = [];
        }
        setMemberDirectory(nextMemberDirectory);
        setHasResolvedMemberDirectory(true);

        if (translationsResult.status === "fulfilled" && translationsResult.value.ok) {
          const data = await translationsResult.value.json();
          nextTagTranslations = data?.tags || {};
          nextGenreTranslations = data?.genres || {};
          nextStaffRoleTranslations = data?.staffRoles || {};
        } else {
          nextTagTranslations = {};
          nextGenreTranslations = {};
          nextStaffRoleTranslations = {};
        }
        setTagTranslations(nextTagTranslations);
        setGenreTranslations(nextGenreTranslations);
        setStaffRoleTranslations(nextStaffRoleTranslations);
        setHasResolvedTranslations(true);

        writeProjectsPageCache({
          projects: nextProjects,
          projectTypeOptions: nextProjectTypeOptions,
          memberDirectory: nextMemberDirectory,
          tagTranslations: nextTagTranslations,
          genreTranslations: nextGenreTranslations,
          staffRoleTranslations: nextStaffRoleTranslations,
        });
      } catch {
        if (isActive && requestIdRef.current === requestId) {
          if (!hasLoadedOnceRef.current) {
            setProjects([]);
            setProjectTypeOptions(defaultFormatOptions);
            setMemberDirectory([]);
            setTagTranslations({});
            setGenreTranslations({});
            setStaffRoleTranslations({});
            setHasResolvedProjectTypes(false);
            setHasResolvedMemberDirectory(false);
            setHasResolvedTranslations(false);
          }
          setHasLoadError(true);
        }
      } finally {
        if (isActive && requestIdRef.current === requestId) {
          setIsInitialLoading(false);
          setIsRefreshing(false);
          if (cached) {
            setHasResolvedProjectTypes(true);
            setHasResolvedMemberDirectory(true);
            setHasResolvedTranslations(true);
          }
        }
      }
    };
    void load();
    return () => {
      isActive = false;
    };
  }, [apiBase, loadVersion]);

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
    setSelectedAnimeEpisodeKeys([]);
    setRemovedAnimeEpisode(null);
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
    editorInitialSnapshotRef.current = buildProjectEditorSnapshot(nextForm, "");
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
      setSelectedAnimeEpisodeKeys([]);
      setRemovedAnimeEpisode(null);
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
      editorInitialSnapshotRef.current = buildProjectEditorSnapshot(nextForm, nextAniListInput);
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

  const requestCloseEditor = () => {
    if (!isDirty) {
      closeEditor();
      return;
    }
    setConfirmTitle("Sair da edição?");
    setConfirmDescription("Você tem alterações não salvas. Deseja continuar?");
    confirmActionRef.current = () => {
      closeEditor();
    };
    confirmCancelRef.current = () => {
      setConfirmOpen(false);
    };
    setConfirmOpen(true);
  };

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
    editorInitialSnapshotRef.current = buildProjectEditorSnapshot(
      (data?.project || payload) as ProjectForm,
      anilistIdInput,
    );
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
    const next = resolveTaxonomyInputValue(tagInput, tagSuggestionLookup);
    if (!next) {
      return;
    }
    appendTagValue(next);
    setTagInput("");
  };

  const handleAddGenre = () => {
    const next = resolveTaxonomyInputValue(genreInput, genreSuggestionLookup);
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

  const toggleAnimeEpisodeSelection = useCallback((episodeKey: string) => {
    if (!episodeKey) {
      return;
    }
    setSelectedAnimeEpisodeKeys((current) =>
      current.includes(episodeKey)
        ? current.filter((item) => item !== episodeKey)
        : [...current, episodeKey],
    );
  }, []);

  const selectAllFilteredAnimeEpisodes = useCallback(() => {
    setSelectedAnimeEpisodeKeys(
      filteredAnimeEpisodeItems
        .map(({ episode }) => String(episode._editorKey || ""))
        .filter(Boolean),
    );
  }, [filteredAnimeEpisodeItems]);

  const clearSelectedAnimeEpisodes = useCallback(() => {
    setSelectedAnimeEpisodeKeys([]);
  }, []);

  const applyAnimeBatchUpdate = useCallback(
    (updater: (episode: EditorProjectEpisode) => EditorProjectEpisode) => {
      if (!selectedAnimeEpisodeKeys.length) {
        return;
      }
      const selectedSet = new Set(selectedAnimeEpisodeKeys);
      setFormState((prev) => ({
        ...prev,
        episodeDownloads: prev.episodeDownloads.map((episode) =>
          selectedSet.has(String(episode._editorKey || "")) ? updater(episode) : episode,
        ),
      }));
    },
    [selectedAnimeEpisodeKeys],
  );

  const removeAnimeEpisodeAtIndex = useCallback((index: number) => {
    setFormState((prev) => {
      const removed = prev.episodeDownloads[index];
      if (!removed) {
        return prev;
      }
      const nextEpisodes = prev.episodeDownloads.filter((_, idx) => idx !== index);
      setRemovedAnimeEpisode({
        episode: {
          ...removed,
          _editorKey: removed._editorKey || generateLocalId(),
        },
        index,
      });
      setSelectedAnimeEpisodeKeys((current) =>
        current.filter((key) => key !== String(removed._editorKey || "")),
      );
      return {
        ...prev,
        episodeDownloads: nextEpisodes,
      };
    });
    setEpisodeDateDraft((prev) => shiftDraftAfterRemoval(prev, index));
    setEpisodeTimeDraft((prev) => shiftDraftAfterRemoval(prev, index));
    setEpisodeSizeDrafts((prev) => shiftDraftAfterRemoval(prev, index));
    setEpisodeSizeErrors((prev) => shiftDraftAfterRemoval(prev, index));
    setCollapsedEpisodes((prev) => shiftCollapsedEpisodesAfterRemoval(prev, index));
  }, []);

  const undoRemoveAnimeEpisode = useCallback(() => {
    if (!removedAnimeEpisode) {
      return;
    }
    const { episode, index } = removedAnimeEpisode;
    pendingEpisodeToScrollRef.current = episode;
    setFormState((prev) => {
      const nextEpisodes = [...prev.episodeDownloads];
      nextEpisodes.splice(Math.min(index, nextEpisodes.length), 0, episode);
      return {
        ...prev,
        episodeDownloads: nextEpisodes,
      };
    });
    setCollapsedEpisodes((prev) => ({
      ...prev,
      [index]: false,
    }));
    setRemovedAnimeEpisode(null);
  }, [removedAnimeEpisode]);

  const duplicateAnimeEpisode = useCallback(
    (episode: EditorProjectEpisode) => {
      const duplicatedEpisode = buildDuplicatedAnimeEpisode(episode, formState.episodeDownloads);
      pendingEpisodeToScrollRef.current = duplicatedEpisode;
      setFormState((prev) => ({
        ...prev,
        episodeDownloads: [...prev.episodeDownloads, duplicatedEpisode],
      }));
      setCollapsedEpisodes((prev) => ({
        ...prev,
        [formState.episodeDownloads.length]: false,
      }));
    },
    [formState.episodeDownloads],
  );

  const createAnimeEpisodeBatch = useCallback(() => {
    const startNumber = Math.max(1, Number(animeBatchStartNumber) || 0);
    const quantity = Math.max(1, Number(animeBatchQuantity) || 0);
    if (!startNumber || !quantity) {
      toast({
        title: "Parametros invalidos",
        description: "Informe episodio inicial e quantidade validos.",
        variant: "destructive",
      });
      return;
    }
    const durationValue = displayTimeToCanonical(animeBatchDurationInput);
    const cadenceDays = Math.max(0, Number(animeBatchCadenceDays) || 0);
    const existingNumbers = new Set(
      formState.episodeDownloads.map((episode) => Number(episode.number)),
    );
    const duplicatedNumbers = Array.from(
      { length: quantity },
      (_, index) => startNumber + index,
    ).filter((value) => existingNumbers.has(value));
    if (duplicatedNumbers.length > 0) {
      toast({
        title: "Faixa ocupada",
        description: "A faixa escolhida conflita com episodios ja existentes.",
        variant: "destructive",
      });
      return;
    }
    const latestDatedEpisode = [...sortedEpisodeDownloads]
      .map(({ episode }) => episode)
      .reverse()
      .find((episode) => String(episode.releaseDate || "").trim());
    const initialDate = latestDatedEpisode?.releaseDate || "";
    const createdEpisodes = Array.from({ length: quantity }, (_, index) => {
      const episodeNumber = startNumber + index;
      const releaseDate =
        cadenceDays > 0 && initialDate
          ? shiftIsoDateByDays(initialDate, cadenceDays * (index + 1))
          : "";
      return {
        _editorKey: generateLocalId(),
        number: episodeNumber,
        title: "",
        synopsis: "",
        releaseDate,
        duration: durationValue,
        sourceType: animeBatchSourceType,
        sources: [],
        progressStage: "aguardando-raw",
        completedStages: [],
        content: "",
        contentFormat: "lexical" as const,
        publicationStatus: animeBatchPublicationStatus,
        coverImageUrl: "",
        coverImageAlt: "",
      } satisfies EditorProjectEpisode;
    });
    const lastCreatedEpisode = createdEpisodes[createdEpisodes.length - 1] || null;
    if (lastCreatedEpisode) {
      pendingEpisodeToScrollRef.current = lastCreatedEpisode;
    }
    setFormState((prev) => ({
      ...prev,
      episodeDownloads: [...prev.episodeDownloads, ...createdEpisodes],
    }));
    setCollapsedEpisodes((prev) => {
      const next = { ...prev };
      createdEpisodes.forEach((_, offset) => {
        next[formState.episodeDownloads.length + offset] = false;
      });
      return next;
    });
    setAnimeBatchCreateOpen(false);
    setAnimeBatchQuantity("3");
    setAnimeBatchCadenceDays("");
    setAnimeBatchDurationInput("");
    setAnimeBatchPublicationStatus("draft");
    setAnimeBatchSourceType("TV");
    toast({
      title: "Episodios criados",
      description: `${createdEpisodes.length} episodio(s) adicionados ao formulario.`,
      intent: "success",
    });
  }, [
    animeBatchCadenceDays,
    animeBatchDurationInput,
    animeBatchPublicationStatus,
    animeBatchQuantity,
    animeBatchSourceType,
    animeBatchStartNumber,
    formState.episodeDownloads,
    sortedEpisodeDownloads,
  ]);

  const applyAnimeBatchDuration = useCallback(() => {
    const canonicalDuration = displayTimeToCanonical(animeBatchOperationDuration);
    if (!canonicalDuration) {
      toast({
        title: "Duracao invalida",
        description: "Use MM:SS ou H:MM:SS para aplicar a duracao em lote.",
        variant: "destructive",
      });
      return;
    }
    applyAnimeBatchUpdate((episode) => ({
      ...episode,
      duration: canonicalDuration,
    }));
  }, [animeBatchOperationDuration, applyAnimeBatchUpdate]);

  const applyAnimeBatchSourceType = useCallback(() => {
    applyAnimeBatchUpdate((episode) => ({
      ...episode,
      sourceType: animeBatchOperationSourceType,
    }));
  }, [animeBatchOperationSourceType, applyAnimeBatchUpdate]);

  const applyAnimeBatchPublicationStatus = useCallback(() => {
    applyAnimeBatchUpdate((episode) => ({
      ...episode,
      publicationStatus: animeBatchOperationPublicationStatus,
    }));
  }, [animeBatchOperationPublicationStatus, applyAnimeBatchUpdate]);

  const applyAnimeBatchCompletedStages = useCallback(() => {
    applyAnimeBatchUpdate((episode) => ({
      ...episode,
      completedStages: [...animeBatchOperationCompletedStages],
    }));
  }, [animeBatchOperationCompletedStages, applyAnimeBatchUpdate]);

  const applyAnimeBatchShiftReleaseDates = useCallback(() => {
    const dayOffset = Number(animeBatchOperationShiftDays);
    if (!Number.isFinite(dayOffset) || dayOffset === 0) {
      toast({
        title: "Deslocamento invalido",
        description: "Informe um numero inteiro de dias para deslocar as datas.",
        variant: "destructive",
      });
      return;
    }
    applyAnimeBatchUpdate((episode) => ({
      ...episode,
      releaseDate: shiftIsoDateByDays(episode.releaseDate, dayOffset),
    }));
  }, [animeBatchOperationShiftDays, applyAnimeBatchUpdate]);

  const applyAnimeBatchReplicateSources = useCallback(() => {
    const sourceEpisode =
      sortedEpisodeDownloads.find(({ episode }) =>
        selectedAnimeEpisodeKeySet.has(String(episode._editorKey || "")),
      )?.episode || null;
    if (!sourceEpisode) {
      return;
    }
    const nextSources = cloneEpisodeSources(sourceEpisode.sources);
    applyAnimeBatchUpdate((episode) => ({
      ...episode,
      sources: cloneEpisodeSources(nextSources),
    }));
  }, [applyAnimeBatchUpdate, selectedAnimeEpisodeKeySet, sortedEpisodeDownloads]);

  const moveRelationItem = useCallback((from: number, to: number) => {
    if (from === to) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      relations: moveIndexedItem(prev.relations, from, to),
    }));
  }, []);

  const moveStaffItem = useCallback((from: number, to: number) => {
    if (from === to) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      staff: moveIndexedItem(prev.staff, from, to),
    }));
    setStaffMemberInput({});
  }, []);

  const moveAnimeStaffItem = useCallback((from: number, to: number) => {
    if (from === to) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      animeStaff: moveIndexedItem(prev.animeStaff, from, to),
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
        episodeDownloads: moveIndexedItem(prev.episodeDownloads, from, to),
      }));
      setCollapsedEpisodes((prev) => {
        const flags = Array.from(
          { length: formState.episodeDownloads.length },
          (_, idx) => prev[idx] ?? false,
        );
        const nextFlags = moveIndexedItem(flags, from, to);
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
                    onClick={() => setLoadVersion((previous) => previous + 1)}
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
                    onClick={() => setLoadVersion((previous) => previous + 1)}
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

      {isEditorOpen ? (
        <div
          className="pointer-events-auto fixed inset-0 z-40 bg-black/80 backdrop-blur-xs"
          aria-hidden="true"
        />
      ) : null}

      <Dialog open={isEditorOpen} onOpenChange={handleEditorOpenChange} modal={false}>
        <DialogContent
          className={`project-editor-dialog max-w-[min(1520px,calc(100vw-1rem))] gap-0 p-0 ${
            isEditorDialogScrolled ? "editor-modal-scrolled" : ""
          }`}
          onPointerDownOutside={(event) => {
            if (isLibraryOpen) {
              event.preventDefault();
              return;
            }
            const target = event.target as HTMLElement | null;
            if (target?.closest(".lexical-playground")) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (isLibraryOpen) {
              event.preventDefault();
              return;
            }
            const target = event.target as HTMLElement | null;
            if (target?.closest(".lexical-playground")) {
              event.preventDefault();
            }
          }}
        >
          <div className="project-editor-modal-frame flex max-h-[min(90vh,calc(100dvh-1.5rem))] min-h-0 flex-col">
            <div
              className="project-editor-scroll-shell flex-1 overflow-y-auto no-scrollbar"
              onScroll={(event) => {
                const nextScrolled = event.currentTarget.scrollTop > 0;
                setIsEditorDialogScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
              }}
            >
              <div className="project-editor-top sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80">
                <DialogHeader className="space-y-0 px-4 pb-2.5 pt-3.5 text-left md:px-6 lg:px-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-[10px] uppercase tracking-[0.12em]"
                        >
                          {editorProjectLabel}
                        </Badge>
                        {formState.anilistId ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-[0.12em]"
                          >
                            AniList {formState.anilistId}
                          </Badge>
                        ) : null}
                      </div>
                      <DialogTitle className="text-xl md:text-2xl">
                        {editingProject ? "Editar projeto" : "Novo projeto"}
                      </DialogTitle>
                      <DialogDescription className="max-w-2xl text-xs md:text-sm">
                        Busque no AniList para preencher automaticamente ou ajuste todos os dados
                        manualmente.
                      </DialogDescription>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/65 px-3 py-1.5 text-right">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        Projeto
                      </p>
                      <p className="max-w-[210px] truncate text-sm font-medium text-foreground">
                        {editorProjectTitle}
                      </p>
                    </div>
                  </div>
                </DialogHeader>
                <div className="project-editor-status-bar flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-1.5 md:px-6 lg:px-8">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                    ID {editorProjectId}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                    {editorTypeLabel}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                    {editorStatusLabel}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {editorEpisodeCount} {isChapterBased ? "capítulos" : "episódios"}
                  </span>
                </div>
              </div>

              <div className="project-editor-layout grid gap-3.5 px-4 pb-3 pt-2.5 md:gap-4 md:px-6 md:pb-4 lg:gap-5 lg:px-8">
                <Accordion
                  type="multiple"
                  value={editorAccordionValue}
                  onValueChange={setEditorAccordionValue}
                  className="project-editor-accordion space-y-2.5"
                >
                  <AccordionItem value="importacao" className={editorSectionClassName}>
                    <AccordionTrigger className={editorSectionTriggerClassName}>
                      <ProjectEditorAccordionHeader
                        title="Importação"
                        subtitle="Preenchimento automático"
                      />
                    </AccordionTrigger>
                    <AccordionContent className={editorSectionContentClassName}>
                      <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                          <DashboardFieldStack>
                            <Label htmlFor="anilist-id-input">ID ou URL do AniList</Label>
                            <Input
                              id="anilist-id-input"
                              value={anilistIdInput}
                              onChange={(event) => setAnilistIdInput(event.target.value)}
                              placeholder="Ex.: 21366 ou https://anilist.co/manga/97894/..."
                            />
                          </DashboardFieldStack>
                          <Button className="self-end" onClick={handleImportAniList}>
                            Importar do AniList
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {false ? (
                    <AccordionItem value="leitor" className={editorSectionClassName}>
                      <AccordionTrigger className={editorSectionTriggerClassName}>
                        <ProjectEditorAccordionHeader
                          title="Leitor"
                          subtitle="Direção, modo e overrides do manga/webtoon"
                        />
                      </AccordionTrigger>
                      <AccordionContent className={editorSectionContentClassName}>
                        <section className={editorSectionBlockClassName}>
                          <div className="space-y-1">
                            <h3 className={editorSectionBlockTitleClassName}>
                              Configuração do reader
                            </h3>
                            <p className="text-xs leading-5 text-muted-foreground">
                              Os defaults seguem o tipo do projeto, mas você pode sobrescrever aqui.
                            </p>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <DashboardFieldStack>
                              <Label>Direção</Label>
                              <Select
                                value={readerConfigDraft.direction}
                                onValueChange={(value) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    readerConfig: {
                                      ...(prev.readerConfig || {}),
                                      direction:
                                        value === PROJECT_READER_DIRECTIONS.LTR
                                          ? PROJECT_READER_DIRECTIONS.LTR
                                          : PROJECT_READER_DIRECTIONS.RTL,
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={PROJECT_READER_DIRECTIONS.RTL}>
                                    Direita para esquerda
                                  </SelectItem>
                                  <SelectItem value={PROJECT_READER_DIRECTIONS.LTR}>
                                    Esquerda para direita
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </DashboardFieldStack>

                            <DashboardFieldStack>
                              <Label>Modo de leitura</Label>
                              <Select
                                value={readerConfigDraft.viewMode}
                                onValueChange={(value) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    readerConfig: {
                                      ...(prev.readerConfig || {}),
                                      viewMode:
                                        value === PROJECT_READER_VIEW_MODES.SCROLL
                                          ? PROJECT_READER_VIEW_MODES.SCROLL
                                          : PROJECT_READER_VIEW_MODES.PAGE,
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={PROJECT_READER_VIEW_MODES.PAGE}>
                                    Página
                                  </SelectItem>
                                  <SelectItem value={PROJECT_READER_VIEW_MODES.SCROLL}>
                                    Scroll contínuo
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </DashboardFieldStack>

                            <DashboardFieldStack>
                              <Label htmlFor="reader-preview-limit">Limite de preview</Label>
                              <Input
                                id="reader-preview-limit"
                                type="number"
                                min="1"
                                value={readerConfigDraft.previewLimit ?? ""}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setFormState((prev) => ({
                                    ...prev,
                                    readerConfig: {
                                      ...(prev.readerConfig || {}),
                                      previewLimit: nextValue.trim()
                                        ? Math.max(1, Number(nextValue))
                                        : null,
                                    },
                                  }));
                                }}
                                placeholder="Opcional"
                              />
                            </DashboardFieldStack>

                            <DashboardFieldStack>
                              <Label htmlFor="reader-theme-preset">Preset visual</Label>
                              <Input
                                id="reader-theme-preset"
                                value={readerConfigDraft.themePreset || ""}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    readerConfig: {
                                      ...(prev.readerConfig || {}),
                                      themePreset: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="manga, webtoon, custom..."
                              />
                            </DashboardFieldStack>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <label className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-3 text-sm">
                              <span className="space-y-1">
                                <span className="block font-medium text-foreground">
                                  Primeira página isolada
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  Útil para capa ou páginas ímpares.
                                </span>
                              </span>
                              <Switch
                                checked={readerConfigDraft.firstPageSingle !== false}
                                onCheckedChange={(checked) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    readerConfig: {
                                      ...(prev.readerConfig || {}),
                                      firstPageSingle: checked,
                                    },
                                  }))
                                }
                              />
                            </label>

                            <label className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-3 text-sm">
                              <span className="space-y-1">
                                <span className="block font-medium text-foreground">
                                  Permitir spread
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  Junta páginas duplas no modo paginado.
                                </span>
                              </span>
                              <Switch
                                checked={readerConfigDraft.allowSpread !== false}
                                onCheckedChange={(checked) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    readerConfig: {
                                      ...(prev.readerConfig || {}),
                                      allowSpread: checked,
                                    },
                                  }))
                                }
                              />
                            </label>

                            <label className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-3 text-sm">
                              <span className="space-y-1">
                                <span className="block font-medium text-foreground">
                                  Mostrar rodapé
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  Mantém os controles inferiores do pacote.
                                </span>
                              </span>
                              <Switch
                                checked={readerConfigDraft.showFooter !== false}
                                onCheckedChange={(checked) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    readerConfig: {
                                      ...(prev.readerConfig || {}),
                                      showFooter: checked,
                                    },
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </section>
                      </AccordionContent>
                    </AccordionItem>
                  ) : null}

                  <AccordionItem value="informacoes" className={editorSectionClassName}>
                    <AccordionTrigger className={editorSectionTriggerClassName}>
                      <ProjectEditorAccordionHeader
                        title="Informações do projeto"
                        subtitle={`${
                          formState.title || "Títulos, classificação e metadados"
                        } • ${formState.type || "Formato"} • ${formState.status || "Status"} • ${
                          formState.tags.length
                        } tags • ${formState.genres.length} gêneros`}
                      />
                    </AccordionTrigger>
                    <AccordionContent className={editorSectionContentClassName}>
                      <div className="space-y-6">
                        <section className={editorSectionBlockClassName}>
                          <div className="space-y-1">
                            <h3 className={editorSectionBlockTitleClassName}>Dados principais</h3>
                            <p className="text-xs leading-5 text-muted-foreground">
                              ID, títulos, sinopse e destaque no carrossel.
                            </p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <DashboardFieldStack>
                              <Label>ID do projeto</Label>
                              <Input
                                value={formState.id}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  const hasAniList =
                                    Boolean(formState.anilistId) ||
                                    parseAniListMediaId(anilistIdInput) !== null;
                                  const trimmed = nextValue.trim();
                                  if (!hasAniList && trimmed && /^\d+$/.test(trimmed)) {
                                    return;
                                  }
                                  setFormState((prev) => ({ ...prev, id: nextValue }));
                                }}
                                placeholder="Mesmo ID do AniList ou slug manual"
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Título</Label>
                              <Input
                                value={formState.title}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, title: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Título original</Label>
                              <Input
                                value={formState.titleOriginal}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    titleOriginal: event.target.value,
                                  }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Título em inglês</Label>
                              <Input
                                value={formState.titleEnglish}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    titleEnglish: event.target.value,
                                  }))
                                }
                              />
                            </DashboardFieldStack>
                            <div className="flex items-center justify-between gap-4">
                              <Label htmlFor="force-hero-switch">Forçar no carrossel</Label>
                              <Switch
                                id="force-hero-switch"
                                checked={Boolean(formState.forceHero)}
                                onCheckedChange={(checked) =>
                                  setFormState((prev) => ({ ...prev, forceHero: checked }))
                                }
                              />
                            </div>
                            <DashboardFieldStack className="md:col-span-2">
                              <Label>Sinopse</Label>
                              <Textarea
                                value={formState.synopsis}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    synopsis: event.target.value,
                                  }))
                                }
                                rows={6}
                              />
                            </DashboardFieldStack>
                          </div>
                        </section>

                        <section
                          className={`${editorSectionBlockClassName} ${editorSectionBlockDividerClassName}`}
                        >
                          <div className="space-y-1">
                            <h3 className={editorSectionBlockTitleClassName}>Classificação</h3>
                            <p className="text-xs leading-5 text-muted-foreground">
                              Tags editoriais e gêneros usados no projeto.
                            </p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <DashboardFieldStack>
                              <Label>Tags</Label>
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  value={tagInput}
                                  onChange={(event) => setTagInput(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      handleAddTag();
                                    }
                                  }}
                                  placeholder="Adicionar tag"
                                />
                              </div>
                              {tagSuggestions.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {tagSuggestions.map((option) => (
                                    <Button
                                      key={`tag-suggestion-${option.value}`}
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => {
                                        appendTagValue(option.value);
                                        setTagInput("");
                                      }}
                                    >
                                      {option.label}
                                    </Button>
                                  ))}
                                </div>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-2">
                                {translatedSortedEditorTags.map((tag, index) => (
                                  <Badge
                                    key={`${tag}-${index}`}
                                    variant="secondary"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="cursor-pointer"
                                  >
                                    {translateTag(tag, tagTranslationMap)}
                                  </Badge>
                                ))}
                              </div>
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Gêneros</Label>
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  value={genreInput}
                                  onChange={(event) => setGenreInput(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      handleAddGenre();
                                    }
                                  }}
                                  placeholder="Adicionar gênero"
                                />
                              </div>
                              {genreSuggestions.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {genreSuggestions.map((option) => (
                                    <Button
                                      key={`genre-suggestion-${option.value}`}
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => {
                                        appendGenreValue(option.value);
                                        setGenreInput("");
                                      }}
                                    >
                                      {option.label}
                                    </Button>
                                  ))}
                                </div>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-2">
                                {translatedSortedEditorGenres.map((genre, index) => (
                                  <Badge
                                    key={`${genre}-${index}`}
                                    variant="secondary"
                                    onClick={() => handleRemoveGenre(genre)}
                                    className="cursor-pointer"
                                  >
                                    {translateGenre(genre, genreTranslationMap)}
                                  </Badge>
                                ))}
                              </div>
                            </DashboardFieldStack>
                          </div>
                        </section>

                        <section
                          className={`${editorSectionBlockClassName} ${editorSectionBlockDividerClassName}`}
                        >
                          <div className="space-y-1">
                            <h3 className={editorSectionBlockTitleClassName}>Metadados</h3>
                            <p className="text-xs leading-5 text-muted-foreground">
                              Formato, status e dados editoriais do projeto.
                            </p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <DashboardFieldStack>
                              <Label>Formato</Label>
                              <Select
                                value={formState.type}
                                onValueChange={(value) =>
                                  setFormState((prev) => ({ ...prev, type: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Formato" />
                                </SelectTrigger>
                                <SelectContent>
                                  {formatSelectOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Status</Label>
                              <Select
                                value={formState.status}
                                onValueChange={(value) =>
                                  setFormState((prev) => ({ ...prev, status: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Ano</Label>
                              <Input
                                value={formState.year}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, year: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Temporada</Label>
                              <Input
                                value={formState.season}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, season: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Estúdio</Label>
                              <Input
                                value={formState.studio}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, studio: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Episódios/Capítulos</Label>
                              <Input
                                value={formState.episodes}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    episodes: event.target.value,
                                  }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>País de origem</Label>
                              <Input
                                value={formState.country}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, country: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Fonte</Label>
                              <Input
                                value={formState.source}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, source: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Cargo Discord (ID)</Label>
                              <Input
                                value={formState.discordRoleId || ""}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    discordRoleId: event.target.value.replace(/\D/g, ""),
                                  }))
                                }
                                placeholder="Opcional: ID numerico do cargo"
                              />
                            </DashboardFieldStack>
                          </div>
                        </section>
                        <section
                          className={`${editorSectionBlockClassName} ${editorSectionBlockDividerClassName}`}
                        >
                          <div className="space-y-1">
                            <h3 className={editorSectionBlockTitleClassName}>
                              Estúdios e produtoras
                            </h3>
                            <p className="text-xs leading-5 text-muted-foreground">
                              Separe o estúdio principal dos estúdios de animação e das produtoras.
                            </p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <DashboardFieldStack>
                              <Label>Estúdio principal</Label>
                              <Input
                                className={adjacentMetadataInputClassName}
                                value={formState.studio}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, studio: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Produtoras</Label>
                              <Input
                                className={adjacentMetadataInputClassName}
                                value={producerInput}
                                onChange={(event) => setProducerInput(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleAddProducer();
                                  }
                                }}
                                placeholder="Adicionar produtora e pressionar Enter"
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack className="md:col-span-2">
                              <Label>Estúdios de animação</Label>
                              <Input
                                className={adjacentMetadataInputClassName}
                                value={animationStudioInput}
                                onChange={(event) => setAnimationStudioInput(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleAddAnimationStudio();
                                  }
                                }}
                                placeholder="Adicionar estúdio de animação e pressionar Enter"
                              />
                              <div className="mt-2 flex flex-wrap gap-2">
                                {formState.animationStudios.map((studioName, index) => (
                                  <Badge
                                    key={`${studioName}-${index}`}
                                    variant="secondary"
                                    onClick={() => handleRemoveAnimationStudio(studioName)}
                                    className="cursor-pointer"
                                  >
                                    {studioName}
                                  </Badge>
                                ))}
                              </div>
                            </DashboardFieldStack>
                            <div className="space-y-2 md:col-span-2">
                              <Label>Lista atual de produtoras</Label>
                              <div className="flex flex-wrap gap-2">
                                {formState.producers.map((producer, index) => (
                                  <Badge
                                    key={`${producer}-${index}`}
                                    variant="secondary"
                                    onClick={() => handleRemoveProducer(producer)}
                                    className="cursor-pointer"
                                  >
                                    {producer}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/*
                  <AccordionItem value="classificacao" className={editorSectionClassName}>
                    <AccordionTrigger className={editorSectionTriggerClassName}>
                      <ProjectEditorAccordionHeader
                        title="Classificação"
                        subtitle={`${formState.tags.length} tags • ${formState.genres.length} gêneros`}
                      />
                    </AccordionTrigger>
                    <AccordionContent className={editorSectionContentClassName}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <DashboardFieldStack>
                          <Label>Tags</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              value={tagInput}
                              onChange={(event) => setTagInput(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleAddTag();
                                }
                              }}
                              placeholder="Adicionar tag"
                            />
                          </div>
                          {tagSuggestions.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {tagSuggestions.map((option) => (
                                <Button
                                  key={`tag-suggestion-${option.value}`}
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    appendTagValue(option.value);
                                    setTagInput("");
                                  }}
                                >
                                  {option.label}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {translatedSortedEditorTags.map((tag, index) => (
                              <Badge
                                key={`${tag}-${index}`}
                                variant="secondary"
                                onClick={() => handleRemoveTag(tag)}
                                className="cursor-pointer"
                              >
                                {translateTag(tag, tagTranslationMap)}
                              </Badge>
                            ))}
                          </div>
                        </DashboardFieldStack>
                        <DashboardFieldStack>
                          <Label>Gêneros</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              value={genreInput}
                              onChange={(event) => setGenreInput(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleAddGenre();
                                }
                              }}
                              placeholder="Adicionar gênero"
                            />
                          </div>
                          {genreSuggestions.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {genreSuggestions.map((option) => (
                                <Button
                                  key={`genre-suggestion-${option.value}`}
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    appendGenreValue(option.value);
                                    setGenreInput("");
                                  }}
                                >
                                  {option.label}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {translatedSortedEditorGenres.map((genre, index) => (
                              <Badge
                                key={`${genre}-${index}`}
                                variant="secondary"
                                onClick={() => handleRemoveGenre(genre)}
                                className="cursor-pointer"
                              >
                                {translateGenre(genre, genreTranslationMap)}
                              </Badge>
                            ))}
                          </div>
                        </DashboardFieldStack>
                          </div>
                        </section>

                        <section
                          className={`${editorSectionBlockClassName} ${editorSectionBlockDividerClassName}`}
                        >
                          <div className="space-y-1">
                            <h3 className={editorSectionBlockTitleClassName}>Classificação</h3>
                            <p className="text-xs leading-5 text-muted-foreground">
                              Tags editoriais e gêneros usados no projeto.
                            </p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <DashboardFieldStack>
                              <Label>Tags</Label>
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  value={tagInput}
                                  onChange={(event) => setTagInput(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      handleAddTag();
                                    }
                                  }}
                                  placeholder="Adicionar tag"
                                />
                              </div>
                              {tagSuggestions.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {tagSuggestions.map((option) => (
                                    <Button
                                      key={`tag-suggestion-${option.value}`}
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => {
                                        appendTagValue(option.value);
                                        setTagInput("");
                                      }}
                                    >
                                      {option.label}
                                    </Button>
                                  ))}
                                </div>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-2">
                                {translatedSortedEditorTags.map((tag, index) => (
                                  <Badge
                                    key={`${tag}-${index}`}
                                    variant="secondary"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="cursor-pointer"
                                  >
                                    {translateTag(tag, tagTranslationMap)}
                                  </Badge>
                                ))}
                              </div>
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Gêneros</Label>
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  value={genreInput}
                                  onChange={(event) => setGenreInput(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      handleAddGenre();
                                    }
                                  }}
                                  placeholder="Adicionar gênero"
                                />
                              </div>
                              {genreSuggestions.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {genreSuggestions.map((option) => (
                                    <Button
                                      key={`genre-suggestion-${option.value}`}
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => {
                                        appendGenreValue(option.value);
                                        setGenreInput("");
                                      }}
                                    >
                                      {option.label}
                                    </Button>
                                  ))}
                                </div>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-2">
                                {translatedSortedEditorGenres.map((genre, index) => (
                                  <Badge
                                    key={`${genre}-${index}`}
                                    variant="secondary"
                                    onClick={() => handleRemoveGenre(genre)}
                                    className="cursor-pointer"
                                  >
                                    {translateGenre(genre, genreTranslationMap)}
                                  </Badge>
                                ))}
                              </div>
                            </DashboardFieldStack>
                          </div>
                        </section>

                        <section
                          className={`${editorSectionBlockClassName} ${editorSectionBlockDividerClassName}`}
                        >
                          <div className="space-y-1">
                            <h3 className={editorSectionBlockTitleClassName}>Metadados</h3>
                            <p className="text-xs leading-5 text-muted-foreground">
                              Formato, status e dados editoriais do projeto.
                            </p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <DashboardFieldStack>
                              <Label>Formato</Label>
                              <Select
                                value={formState.type}
                                onValueChange={(value) =>
                                  setFormState((prev) => ({ ...prev, type: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Formato" />
                                </SelectTrigger>
                                <SelectContent>
                                  {formatSelectOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Status</Label>
                              <Select
                                value={formState.status}
                                onValueChange={(value) =>
                                  setFormState((prev) => ({ ...prev, status: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Ano</Label>
                              <Input
                                value={formState.year}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, year: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Temporada</Label>
                              <Input
                                value={formState.season}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, season: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Estúdio</Label>
                              <Input
                                value={formState.studio}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, studio: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Episódios/Capítulos</Label>
                              <Input
                                value={formState.episodes}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, episodes: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>País de origem</Label>
                              <Input
                                value={formState.country}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, country: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Fonte</Label>
                              <Input
                                value={formState.source}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, source: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Cargo Discord (ID)</Label>
                              <Input
                                value={formState.discordRoleId || ""}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    discordRoleId: event.target.value.replace(/\D/g, ""),
                                  }))
                                }
                                placeholder="Opcional: ID numerico do cargo"
                              />
                            </DashboardFieldStack>
                          </div>
                        </section>
                          </div>
                        </section>

                        <section
                          className={`${editorSectionBlockClassName} ${editorSectionBlockDividerClassName}`}
                        >
                          <div className="space-y-1">
                            <h3 className={editorSectionBlockTitleClassName}>Classificação</h3>
                            <p className="text-xs leading-5 text-muted-foreground">
                              Tags editoriais e gêneros usados no projeto.
                            </p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <DashboardFieldStack>
                              <Label>Tags</Label>
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  value={tagInput}
                                  onChange={(event) => setTagInput(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      handleAddTag();
                                    }
                                  }}
                                  placeholder="Adicionar tag"
                                />
                              </div>
                              {tagSuggestions.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {tagSuggestions.map((option) => (
                                    <Button
                                      key={`tag-suggestion-${option.value}`}
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => {
                                        appendTagValue(option.value);
                                        setTagInput("");
                                      }}
                                    >
                                      {option.label}
                                    </Button>
                                  ))}
                                </div>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-2">
                                {translatedSortedEditorTags.map((tag, index) => (
                                  <Badge
                                    key={`${tag}-${index}`}
                                    variant="secondary"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="cursor-pointer"
                                  >
                                    {translateTag(tag, tagTranslationMap)}
                                  </Badge>
                                ))}
                              </div>
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Gêneros</Label>
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  value={genreInput}
                                  onChange={(event) => setGenreInput(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      handleAddGenre();
                                    }
                                  }}
                                  placeholder="Adicionar gênero"
                                />
                              </div>
                              {genreSuggestions.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {genreSuggestions.map((option) => (
                                    <Button
                                      key={`genre-suggestion-${option.value}`}
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => {
                                        appendGenreValue(option.value);
                                        setGenreInput("");
                                      }}
                                    >
                                      {option.label}
                                    </Button>
                                  ))}
                                </div>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-2">
                                {translatedSortedEditorGenres.map((genre, index) => (
                                  <Badge
                                    key={`${genre}-${index}`}
                                    variant="secondary"
                                    onClick={() => handleRemoveGenre(genre)}
                                    className="cursor-pointer"
                                  >
                                    {translateGenre(genre, genreTranslationMap)}
                                  </Badge>
                                ))}
                              </div>
                            </DashboardFieldStack>
                          </div>
                        </section>

                        <section
                          className={`${editorSectionBlockClassName} ${editorSectionBlockDividerClassName}`}
                        >
                          <div className="space-y-1">
                            <h3 className={editorSectionBlockTitleClassName}>Metadados</h3>
                            <p className="text-xs leading-5 text-muted-foreground">
                              Formato, status e dados editoriais do projeto.
                            </p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <DashboardFieldStack>
                              <Label>Formato</Label>
                              <Select
                                value={formState.type}
                                onValueChange={(value) =>
                                  setFormState((prev) => ({ ...prev, type: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Formato" />
                                </SelectTrigger>
                                <SelectContent>
                                  {formatSelectOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Status</Label>
                              <Select
                                value={formState.status}
                                onValueChange={(value) =>
                                  setFormState((prev) => ({ ...prev, status: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Ano</Label>
                              <Input
                                value={formState.year}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, year: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Temporada</Label>
                              <Input
                                value={formState.season}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, season: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Estúdio</Label>
                              <Input
                                value={formState.studio}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, studio: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Episódios/Capítulos</Label>
                              <Input
                                value={formState.episodes}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, episodes: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>País de origem</Label>
                              <Input
                                value={formState.country}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, country: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Fonte</Label>
                              <Input
                                value={formState.source}
                                onChange={(event) =>
                                  setFormState((prev) => ({ ...prev, source: event.target.value }))
                                }
                              />
                            </DashboardFieldStack>
                            <DashboardFieldStack>
                              <Label>Cargo Discord (ID)</Label>
                              <Input
                                value={formState.discordRoleId || ""}
                                onChange={(event) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    discordRoleId: event.target.value.replace(/\D/g, ""),
                                  }))
                                }
                                placeholder="Opcional: ID numerico do cargo"
                              />
                            </DashboardFieldStack>
                          </div>
                        </section>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  */}

                  {/*
                  <AccordionItem value="metadados" className={editorSectionClassName}>
                    <AccordionTrigger className={editorSectionTriggerClassName}>
                      <ProjectEditorAccordionHeader
                        title="Metadados"
                        subtitle={`${formState.type || "Formato"} • ${formState.status || "Status"}`}
                      />
                    </AccordionTrigger>
                    <AccordionContent className={editorSectionContentClassName}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <DashboardFieldStack>
                          <Label>Formato</Label>
                          <Select
                            value={formState.type}
                            onValueChange={(value) =>
                              setFormState((prev) => ({ ...prev, type: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Formato" />
                            </SelectTrigger>
                            <SelectContent>
                              {formatSelectOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </DashboardFieldStack>
                        <DashboardFieldStack>
                          <Label>Status</Label>
                          <Select
                            value={formState.status}
                            onValueChange={(value) =>
                              setFormState((prev) => ({ ...prev, status: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </DashboardFieldStack>
                        <DashboardFieldStack>
                          <Label>Ano</Label>
                          <Input
                            value={formState.year}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, year: event.target.value }))
                            }
                          />
                        </DashboardFieldStack>
                        <DashboardFieldStack>
                          <Label>Temporada</Label>
                          <Input
                            value={formState.season}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, season: event.target.value }))
                            }
                          />
                        </DashboardFieldStack>
                        <DashboardFieldStack>
                          <Label>Estúdio</Label>
                          <Input
                            value={formState.studio}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, studio: event.target.value }))
                            }
                          />
                        </DashboardFieldStack>
                        <DashboardFieldStack>
                          <Label>Episódios/Capítulos</Label>
                          <Input
                            value={formState.episodes}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, episodes: event.target.value }))
                            }
                          />
                        </DashboardFieldStack>
                        <DashboardFieldStack>
                          <Label>País de origem</Label>
                          <Input
                            value={formState.country}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, country: event.target.value }))
                            }
                          />
                        </DashboardFieldStack>
                        <DashboardFieldStack>
                          <Label>Fonte</Label>
                          <Input
                            value={formState.source}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, source: event.target.value }))
                            }
                          />
                        </DashboardFieldStack>
                        <DashboardFieldStack>
                          <Label>Cargo Discord (ID)</Label>
                          <Input
                            value={formState.discordRoleId || ""}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                discordRoleId: event.target.value.replace(/\D/g, ""),
                              }))
                            }
                            placeholder="Opcional: ID numerico do cargo"
                          />
                        </DashboardFieldStack>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  */}

                  <ProjectEditorMediaSection
                    banner={formState.banner}
                    cover={formState.cover}
                    editorSectionClassName={editorSectionClassName}
                    editorSectionContentClassName={editorSectionContentClassName}
                    editorSectionTriggerClassName={editorSectionTriggerClassName}
                    heroImageUrl={formState.heroImageUrl || ""}
                    onOpenLibrary={openLibraryForProjectImage}
                  />

                  <AccordionItem value="relacoes" className={editorSectionClassName}>
                    <AccordionTrigger className={editorSectionTriggerClassName}>
                      <ProjectEditorAccordionHeader
                        title="Relações"
                        subtitle={`${formState.relations.length} itens`}
                      />
                    </AccordionTrigger>
                    <AccordionContent className={editorSectionContentClassName}>
                      <div className="space-y-3">
                        <div className="flex items-center justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setFormState((prev) => ({
                                ...prev,
                                relations: [
                                  ...prev.relations,
                                  { relation: "", title: "", format: "", status: "", image: "" },
                                ],
                              }))
                            }
                          >
                            Adicionar relação
                          </Button>
                        </div>
                        <div className="grid gap-3">
                          {formState.relations.map((relation, index) => (
                            <div
                              key={`${relation.title}-${index}`}
                              className="grid gap-2 rounded-2xl border border-border/60 bg-card/60 p-3 md:grid-cols-[1.35fr_1fr_1fr_auto_auto]"
                              draggable
                              onDragStart={() => setRelationDragIndex(index)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleRelationDrop(index)}
                            >
                              <Input
                                value={relation.title}
                                onChange={(event) =>
                                  setFormState((prev) => {
                                    const next = [...prev.relations];
                                    next[index] = { ...next[index], title: event.target.value };
                                    return { ...prev, relations: next };
                                  })
                                }
                                placeholder="Título"
                              />
                              <Input
                                value={relation.relation}
                                onChange={(event) =>
                                  setFormState((prev) => {
                                    const next = [...prev.relations];
                                    next[index] = { ...next[index], relation: event.target.value };
                                    return { ...prev, relations: next };
                                  })
                                }
                                placeholder="Relação"
                              />
                              <Input
                                value={relation.projectId || relation.anilistId || ""}
                                onChange={(event) =>
                                  setFormState((prev) => {
                                    const next = [...prev.relations];
                                    next[index] = { ...next[index], projectId: event.target.value };
                                    return { ...prev, relations: next };
                                  })
                                }
                                placeholder="ID relacionado"
                              />
                              <ReorderControls
                                label={`relação ${index + 1}`}
                                index={index}
                                total={formState.relations.length}
                                onMove={(targetIndex) => moveRelationItem(index, targetIndex)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    relations: prev.relations.filter((_, idx) => idx !== index),
                                  }))
                                }
                              >
                                Remover
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

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
                                                            toggleAnimeEpisodeSelection(
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

                  <AccordionItem value="equipe" className={editorSectionClassName}>
                    <AccordionTrigger className={editorSectionTriggerClassName}>
                      <ProjectEditorAccordionHeader
                        title="Equipe da fansub"
                        subtitle={`${formState.staff.length} funções`}
                      />
                    </AccordionTrigger>
                    <AccordionContent className={editorSectionContentClassName}>
                      <div className="space-y-3">
                        <div className="flex items-center justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setFormState((prev) => ({
                                ...prev,
                                staff: [...prev.staff, { role: "", members: [] }],
                              }))
                            }
                          >
                            Adicionar função
                          </Button>
                        </div>
                        <div className="grid gap-3">
                          {formState.staff.map((role, index) => (
                            <div
                              key={`${role.role}-${index}`}
                              className="rounded-2xl border border-border/60 bg-card/60 p-3"
                              draggable
                              onDragStart={() => setStaffDragIndex(index)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleStaffDrop(index)}
                            >
                              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                                <Select
                                  value={role.role || ""}
                                  onValueChange={(value) =>
                                    setFormState((prev) => {
                                      const next = [...prev.staff];
                                      next[index] = { ...next[index], role: value };
                                      return { ...prev, staff: next };
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Função" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(role.role && !staffRoleOptions.includes(role.role)
                                      ? [role.role, ...staffRoleOptions]
                                      : staffRoleOptions
                                    ).map((option) => (
                                      <SelectItem key={option} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <ReorderControls
                                  label={`funcao da fansub ${index + 1}`}
                                  index={index}
                                  total={formState.staff.length}
                                  onMove={(targetIndex) => moveStaffItem(index, targetIndex)}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => {
                                    setFormState((prev) => ({
                                      ...prev,
                                      staff: prev.staff.filter((_, idx) => idx !== index),
                                    }));
                                    setStaffMemberInput((prev) =>
                                      shiftDraftAfterRemoval(prev, index),
                                    );
                                  }}
                                >
                                  Remover
                                </Button>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <ProjectMemberCombobox
                                  value={staffMemberInput[index] || ""}
                                  options={memberDirectory}
                                  onValueChange={(nextValue) =>
                                    setStaffMemberInput((prev) => ({
                                      ...prev,
                                      [index]: nextValue,
                                    }))
                                  }
                                  onCommit={(member) => commitStaffMember(index, member)}
                                  placeholder="Adicionar membro"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => commitStaffMember(index)}
                                >
                                  Adicionar
                                </Button>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(role.members || []).map((member) => (
                                  <Badge key={member} variant="secondary">
                                    {member}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="staff-anime" className={editorSectionClassName}>
                    <AccordionTrigger className={editorSectionTriggerClassName}>
                      <ProjectEditorAccordionHeader
                        title="Staff do anime"
                        subtitle={`${formState.animeStaff.length} funções`}
                      />
                    </AccordionTrigger>
                    <AccordionContent className={editorSectionContentClassName}>
                      <div className="space-y-3">
                        <div className="flex items-center justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setFormState((prev) => ({
                                ...prev,
                                animeStaff: [...prev.animeStaff, { role: "", members: [] }],
                              }))
                            }
                          >
                            Adicionar função
                          </Button>
                        </div>
                        <div className="grid gap-3">
                          {formState.animeStaff.map((role, index) => (
                            <div
                              key={`${role.role}-${index}`}
                              className="rounded-2xl border border-border/60 bg-card/60 p-3"
                              draggable
                              onDragStart={() => setAnimeStaffDragIndex(index)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleAnimeStaffDrop(index)}
                            >
                              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                                <div className="space-y-1">
                                  <Input
                                    value={role.role || ""}
                                    onChange={(event) =>
                                      setFormState((prev) => {
                                        const next = [...prev.animeStaff];
                                        next[index] = { ...next[index], role: event.target.value };
                                        return { ...prev, animeStaff: next };
                                      })
                                    }
                                    placeholder="Função"
                                  />
                                  {String(role.role || "").trim() ? (
                                    <p className="text-[11px] text-muted-foreground">
                                      {translateAnilistRole(role.role, staffRoleTranslationMap)}
                                    </p>
                                  ) : null}
                                </div>
                                <ReorderControls
                                  label={`funcao do anime ${index + 1}`}
                                  index={index}
                                  total={formState.animeStaff.length}
                                  onMove={(targetIndex) => moveAnimeStaffItem(index, targetIndex)}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => {
                                    setFormState((prev) => ({
                                      ...prev,
                                      animeStaff: prev.animeStaff.filter((_, idx) => idx !== index),
                                    }));
                                    setAnimeStaffMemberInput((prev) =>
                                      shiftDraftAfterRemoval(prev, index),
                                    );
                                  }}
                                >
                                  Remover
                                </Button>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <ProjectMemberCombobox
                                  value={animeStaffMemberInput[index] || ""}
                                  options={memberDirectory}
                                  onValueChange={(nextValue) =>
                                    setAnimeStaffMemberInput((prev) => ({
                                      ...prev,
                                      [index]: nextValue,
                                    }))
                                  }
                                  onCommit={(member) => commitAnimeStaffMember(index, member)}
                                  placeholder="Adicionar membro"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => commitAnimeStaffMember(index)}
                                >
                                  Adicionar
                                </Button>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(role.members || []).map((member) => (
                                  <Badge
                                    key={member}
                                    variant="secondary"
                                    className="flex items-center gap-1"
                                  >
                                    <span>{member}</span>
                                    <button
                                      type="button"
                                      className="rounded-sm p-0.5 text-muted-foreground transition hover:text-foreground"
                                      onClick={() =>
                                        setFormState((prev) => {
                                          const next = [...prev.animeStaff];
                                          next[index] = {
                                            ...next[index],
                                            members: (next[index].members || []).filter(
                                              (item) => item !== member,
                                            ),
                                          };
                                          return { ...prev, animeStaff: next };
                                        })
                                      }
                                      aria-label={`Remover ${member}`}
                                    >
                                      x
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
            <div className="project-editor-footer flex items-center justify-between gap-3 border-t border-border/60 bg-background/95 px-4 py-1.5 backdrop-blur-sm supports-backdrop-filter:bg-background/80 md:px-6 md:py-2 lg:px-8">
              <div className="flex items-center gap-2 md:gap-3">
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
                        <span className="sr-only md:not-sr-only">Conteúdo</span>
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
                      <span className="sr-only md:not-sr-only">Conteúdo</span>
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
                      <span className="sr-only md:not-sr-only">Episódios</span>
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
                      <span className="sr-only md:not-sr-only">Visualizar página</span>
                    </Link>
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={requestCloseEditor}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>Salvar projeto</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
            <DialogDescription>{confirmDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                confirmCancelRef.current?.();
                setConfirmOpen(false);
              }}
            >
              Continuar editando
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                confirmActionRef.current?.();
                setConfirmOpen(false);
              }}
            >
              Sair
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={animeBatchCreateOpen} onOpenChange={setAnimeBatchCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar lote de episÃ³dios</DialogTitle>
            <DialogDescription>
              Adiciona vÃ¡rios episÃ³dios sequenciais ao formulÃ¡rio com defaults de data,
              duraÃ§Ã£o, origem e status.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <DashboardFieldStack>
              <Label htmlFor="anime-batch-start-number">EpisÃ³dio inicial</Label>
              <Input
                id="anime-batch-start-number"
                type="number"
                min={1}
                value={animeBatchStartNumber}
                onChange={(event) => setAnimeBatchStartNumber(event.target.value)}
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label htmlFor="anime-batch-quantity">Quantidade</Label>
              <Input
                id="anime-batch-quantity"
                type="number"
                min={1}
                value={animeBatchQuantity}
                onChange={(event) => setAnimeBatchQuantity(event.target.value)}
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label htmlFor="anime-batch-cadence">CadÃªncia de datas</Label>
              <Input
                id="anime-batch-cadence"
                type="number"
                min={0}
                value={animeBatchCadenceDays}
                onChange={(event) => setAnimeBatchCadenceDays(event.target.value)}
                placeholder="Dias"
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label htmlFor="anime-batch-duration">DuraÃ§Ã£o padrÃ£o</Label>
              <Input
                id="anime-batch-duration"
                value={animeBatchDurationInput}
                onChange={(event) =>
                  setAnimeBatchDurationInput(formatTimeDigitsToDisplay(event.target.value))
                }
                placeholder="MM:SS ou H:MM:SS"
              />
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label htmlFor="anime-batch-source-type">Origem padrÃ£o</Label>
              <Select
                value={animeBatchSourceType}
                onValueChange={(value) =>
                  setAnimeBatchSourceType(value as EditorProjectEpisode["sourceType"])
                }
              >
                <SelectTrigger id="anime-batch-source-type">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TV">TV</SelectItem>
                  <SelectItem value="Web">Web</SelectItem>
                  <SelectItem value="Blu-ray">Blu-ray</SelectItem>
                </SelectContent>
              </Select>
            </DashboardFieldStack>
            <DashboardFieldStack>
              <Label htmlFor="anime-batch-status">Status inicial</Label>
              <Select
                value={animeBatchPublicationStatus}
                onValueChange={(value) =>
                  setAnimeBatchPublicationStatus(value === "draft" ? "draft" : "published")
                }
              >
                <SelectTrigger id="anime-batch-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </DashboardFieldStack>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setAnimeBatchCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createAnimeEpisodeBatch}>Criar lote</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir projeto?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Excluir "${deleteTarget.title}"? Você pode restaurar por até 3 dias.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
    projectsPageCache = null;
  },
};

export default DashboardProjectsEditor;
