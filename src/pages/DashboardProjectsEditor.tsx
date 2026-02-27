import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { MouseEvent as ReactMouseEvent } from "react";
import DashboardShell from "@/components/DashboardShell";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import { dashboardPageLayoutTokens } from "@/components/dashboard/dashboard-page-tokens";
import type { ImageLibraryOptions } from "@/components/ImageLibraryDialog";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import AsyncState from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "@/components/ui/use-toast";
import {
  Eye,
  FileText,
  FolderCog,
  LayoutGrid,
  MessageSquare,
  Plus,
  Copy,
  Settings,
  Shield,
  Trash2,
  UserRound,
  Download,
  Send,
  Cloud,
  HardDrive,
  Link2,
} from "lucide-react";
import { createSlug } from "@/lib/post-content";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  buildTranslationMap,
  sortByTranslatedLabel,
  translateAnilistRole,
  translateGenre,
  translateRelation,
  translateTag,
} from "@/lib/project-taxonomy";
import { isChapterBasedType, isLightNovelType, isMangaType } from "@/lib/project-utils";
import { formatBytesCompact, parseHumanSizeToBytes } from "@/lib/file-size";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useEditorScrollLock } from "@/hooks/use-editor-scroll-lock";
import { useEditorScrollStability } from "@/hooks/use-editor-scroll-stability";
import type { LexicalEditorHandle } from "@/components/lexical/LexicalEditor";
import { useSiteSettings } from "@/hooks/use-site-settings";

const LexicalEditor = lazy(() => import("@/components/lexical/LexicalEditor"));
const ImageLibraryDialog = lazy(() => import("@/components/ImageLibraryDialog"));

const LexicalEditorFallback = () => (
  <div className="min-h-[380px] w-full rounded-2xl border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">
    Carregando editor...
  </div>
);

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

type DownloadSource = {
  label: string;
  url: string;
};

type ProjectEpisode = {
  number: number;
  volume?: number;
  title: string;
  releaseDate: string;
  duration: string;
  coverImageUrl?: string;
  sourceType: "TV" | "Web" | "Blu-ray";
  sources: DownloadSource[];
  hash?: string;
  sizeBytes?: number;
  progressStage?: string;
  completedStages?: string[];
  content?: string;
  contentFormat?: "lexical";
  chapterUpdatedAt?: string;
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
  episodes: string;
  tags: string[];
  genres: string[];
  cover: string;
  banner: string;
  season: string;
  schedule: string;
  rating: string;
  country: string;
  source: string;
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
  episodeDownloads: ProjectEpisode[];
  views: number;
  commentsCount: number;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
};

type ProjectForm = Omit<ProjectRecord, "views" | "commentsCount" | "order">;

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
  studios?: { nodes?: Array<{ name: string; isAnimationStudio?: boolean | null }> } | null;
  producers?: { nodes?: Array<{ name: string }> } | null;
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
  episodes: "",
  tags: [],
  genres: [],
  cover: "",
  banner: "",
  season: "",
  schedule: "",
  rating: "",
  country: "",
  source: "",
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
  episodeDownloads: [],
};

const formatOptions = ["Anime", "Mangá", "Webtoon", "Light Novel", "Filme", "OVA", "ONA", "Especial", "Spin-off"];
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

const animeStages = [
  { id: "aguardando-raw", label: "Aguardando Raw" },
  { id: "traducao", label: "Tradução" },
  { id: "revisao", label: "Revisão" },
  { id: "timing", label: "Timing" },
  { id: "typesetting", label: "Typesetting" },
  { id: "quality-check", label: "Quality Check" },
  { id: "encode", label: "Encode" },
];

const mangaStages = [
  { id: "aguardando-raw", label: "Aguardando Raw" },
  { id: "traducao", label: "Tradução" },
  { id: "limpeza", label: "Limpeza" },
  { id: "redrawing", label: "Redrawing" },
  { id: "revisao", label: "Revisão" },
  { id: "typesetting", label: "Typesetting" },
  { id: "quality-check", label: "Quality Check" },
];

const getProgressStage = (type: string, completedStages?: string[]) => {
  const isManga = isMangaType(type);
  const stages = isManga ? mangaStages : animeStages;
  const completedSet = new Set((completedStages || []).filter(Boolean));
  const next = stages.find((stage) => !completedSet.has(stage.id));
  return next?.id || stages[stages.length - 1]?.id || "aguardando-raw";
};

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

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const formatDateDigitsToDisplay = (digits: string) => {
  const safe = digitsOnly(digits).slice(0, 8);
  if (!safe) {
    return "";
  }
  if (safe.length <= 2) {
    return safe;
  }
  if (safe.length <= 4) {
    return `${safe.slice(0, 2)}/${safe.slice(2)}`;
  }
  return `${safe.slice(0, 2)}/${safe.slice(2, 4)}/${safe.slice(4)}`;
};

const formatTimeDigitsToDisplay = (digits: string) => {
  const safe = digitsOnly(digits).slice(0, 9);
  if (!safe) {
    return "";
  }
  if (safe.length <= 2) {
    return safe;
  }
  if (safe.length <= 4) {
    return `${safe.slice(0, safe.length - 2)}:${safe.slice(-2)}`;
  }
  return `${safe.slice(0, safe.length - 4)}:${safe.slice(-4, -2)}:${safe.slice(-2)}`;
};

const displayDateToIso = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  const digits = digitsOnly(trimmed).slice(0, 8);
  if (digits.length !== 8) {
    return "";
  }
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return "";
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000) {
    return "";
  }
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return "";
  }
  return iso;
};

const isoToDisplayDate = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed.slice(8, 10)}/${trimmed.slice(5, 7)}/${trimmed.slice(0, 4)}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    return trimmed.replace(/-/g, "/");
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(trimmed)) {
    return `${trimmed.slice(8, 10)}/${trimmed.slice(5, 7)}/${trimmed.slice(0, 4)}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const dd = String(parsed.getDate()).padStart(2, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const yyyy = String(parsed.getFullYear()).padStart(4, "0");
  return `${dd}/${mm}/${yyyy}`;
};

const displayTimeToCanonical = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  const digits = digitsOnly(trimmed).slice(0, 9);
  if (digits.length < 3) {
    return "";
  }
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (digits.length <= 4) {
    minutes = Number(digits.slice(0, digits.length - 2));
    seconds = Number(digits.slice(-2));
  } else {
    hours = Number(digits.slice(0, digits.length - 4));
    minutes = Number(digits.slice(-4, -2));
    seconds = Number(digits.slice(-2));
  }
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return "";
  }
  if (hours < 0 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return "";
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const canonicalToDisplayTime = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  let canonical = "";
  if (/^\d{1,}:\d{2}:\d{2}$/.test(trimmed)) {
    const [hoursPart, minutesPart, secondsPart] = trimmed.split(":");
    const hours = Number(hoursPart);
    const minutes = Number(minutesPart);
    const seconds = Number(secondsPart);
    if (
      Number.isFinite(hours) &&
      Number.isFinite(minutes) &&
      Number.isFinite(seconds) &&
      hours >= 0 &&
      minutes >= 0 &&
      minutes <= 59 &&
      seconds >= 0 &&
      seconds <= 59
    ) {
      canonical = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
  } else if (/^\d{1,}:\d{2}$/.test(trimmed)) {
    const [hoursPart, minutesPart] = trimmed.split(":");
    const hours = Number(hoursPart);
    const minutes = Number(minutesPart);
    if (Number.isFinite(hours) && Number.isFinite(minutes) && hours >= 0 && minutes >= 0 && minutes <= 59) {
      canonical = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
    }
  } else {
    canonical = displayTimeToCanonical(trimmed);
  }
  if (!canonical) {
    return "";
  }
  const [hoursPart, minutesPart, secondsPart] = canonical.split(":");
  const hours = Number(hoursPart);
  if (!Number.isFinite(hours)) {
    return canonical;
  }
  if (hours === 0) {
    return `${minutesPart}:${secondsPart}`;
  }
  return `${hours}:${minutesPart}:${secondsPart}`;
};

const normalizeIsoDateFromUnknown = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    return displayDateToIso(trimmed);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return displayDateToIso(trimmed);
  }
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const yyyy = String(parsed.getFullYear()).padStart(4, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeCanonicalTimeFromUnknown = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (/^\d{1,}:\d{2}:\d{2}$/.test(trimmed)) {
    const [hoursPart, minutesPart, secondsPart] = trimmed.split(":");
    const hours = Number(hoursPart);
    const minutes = Number(minutesPart);
    const seconds = Number(secondsPart);
    if (
      Number.isFinite(hours) &&
      Number.isFinite(minutes) &&
      Number.isFinite(seconds) &&
      hours >= 0 &&
      minutes >= 0 &&
      minutes <= 59 &&
      seconds >= 0 &&
      seconds <= 59
    ) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return "";
  }
  if (/^\d{1,}:\d{2}$/.test(trimmed)) {
    const [hoursPart, minutesPart] = trimmed.split(":");
    const hours = Number(hoursPart);
    const minutes = Number(minutesPart);
    if (Number.isFinite(hours) && Number.isFinite(minutes) && hours >= 0 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
    }
    return "";
  }
  return displayTimeToCanonical(trimmed);
};

const formatEpisodeReleaseDate = (dateValue?: string | null, timeValue?: string | null) => {
  const date = normalizeIsoDateFromUnknown(dateValue);
  if (!date) {
    return String(dateValue || "");
  }
  const time = normalizeCanonicalTimeFromUnknown(timeValue);
  const parsed = new Date(`${date}T00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(parsed);
  if (!time) {
    return dateLabel;
  }
  const timeLabel = canonicalToDisplayTime(time);
  if (!timeLabel) {
    return dateLabel;
  }
  return `${dateLabel} · ${timeLabel}`;
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

const shiftCollapsedEpisodesAfterRemoval = (collapsed: Record<number, boolean>, removedIndex: number) => {
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
  '[role="button"]',
  '[role="link"]',
  '[contenteditable="true"]',
].join(", ");

const shouldSkipEpisodeHeaderToggle = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(episodeHeaderNoToggleSelector));
};

const resolveProjectImageFolders = (projectId: string, projectTitle: string) => {
  const normalizedId = String(projectId || "").trim();
  const normalizedSlug = createSlug(String(projectTitle || "").trim());
  const projectKey = normalizedId || normalizedSlug || "draft";
  const projectRootFolder = `projects/${projectKey}`;
  return {
    projectRootFolder,
    projectEpisodesFolder: `${projectRootFolder}/episodes`,
  };
};

const generateLocalId = () => {
  const alpha = String.fromCharCode(97 + Math.floor(Math.random() * 26));
  const random = Math.random().toString(36).slice(2, 9);
  const stamp = Date.now().toString(36).slice(-3);
  return `${alpha}${random}${stamp}`;
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

type EpisodeContentEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onRegister?: (handlers: LexicalEditorHandle | null) => void;
  imageLibraryOptions?: ImageLibraryOptions;
};

const EpisodeContentEditor = ({
  value,
  onChange,
  onRegister,
  imageLibraryOptions,
}: EpisodeContentEditorProps) => {
  const editorRef = useRef<LexicalEditorHandle | null>(null);

  useEffect(() => {
    if (!onRegister) {
      return;
    }
    onRegister(editorRef.current);
  }, [onRegister]);

  return (
    <Suspense fallback={<LexicalEditorFallback />}>
      <LexicalEditor
        ref={editorRef}
        value={value}
        onChange={onChange}
        placeholder="Escreva o capítulo..."
        className="lexical-playground--modal"
        imageLibraryOptions={imageLibraryOptions}
      />
    </Suspense>
  );
};

const DashboardProjectsEditor = () => {
  usePageMeta({ title: "Projetos", noIndex: true });
  const navigate = useNavigate();
  const apiBase = getApiBase();
  const { settings: publicSettings } = useSiteSettings();
  const restoreWindowMs = 3 * 24 * 60 * 60 * 1000;
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
    permissions?: string[];
  } | null>(null);
  const [hasLoadedCurrentUser, setHasLoadedCurrentUser] = useState(false);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortMode, setSortMode] = useState<"alpha" | "status" | "views" | "comments" | "recent">(() => {
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
  });
  const [currentPage, setCurrentPage] = useState(() => parsePageParam(searchParams.get("page")));
  const [selectedType, setSelectedType] = useState(() => parseTypeParam(searchParams.get("type")));
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  useEditorScrollLock(isEditorOpen);
  useEditorScrollStability(isEditorOpen);
  const [isEditorDialogScrolled, setIsEditorDialogScrolled] = useState(false);

  const downloadSourceOptions = useMemo(() => {
    const sources =
      publicSettings?.downloads?.sources?.map((source) => ({
        label: String(source.label || "").trim(),
        icon: source.icon,
        color: source.color || "#7C3AED",
        tintIcon: source.tintIcon !== false,
      })) ?? [];
    const filtered = sources.filter((source) => source.label);
    if (filtered.length) {
      return filtered;
    }
    return [
      { label: "Google Drive", icon: "google-drive", color: "#34A853" },
      { label: "MEGA", icon: "mega", color: "#D9272E" },
      { label: "Torrent", icon: "torrent", color: "#7C3AED" },
      { label: "Mediafire", icon: "mediafire", color: "#2563EB" },
      { label: "Telegram", icon: "telegram", color: "#0EA5E9" },
      { label: "Outro", icon: "link", color: "#64748B" },
    ];
  }, [publicSettings?.downloads?.sources]);

  const renderDownloadIcon = (
    iconKey: string | undefined,
    color: string,
    label?: string,
    tintIcon = true,
  ) => {
    if (
      iconKey &&
      (iconKey.startsWith("http") || iconKey.startsWith("data:") || iconKey.startsWith("/uploads/"))
    ) {
      if (!tintIcon) {
        return <img src={iconKey} alt={label || ""} className="h-4 w-4" />;
      }
      return (
        <ThemedSvgLogo
          url={iconKey}
          label={label || "Fonte de download"}
          className="h-4 w-4"
          color={color}
        />
      );
    }
    const normalized = String(iconKey || "").toLowerCase();
    if (normalized === "google-drive") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" style={{ color }}>
          <path fill="currentColor" d="M7.5 3h9l4.5 8-4.5 8h-9L3 11z" />
        </svg>
      );
    }
    if (normalized === "mega") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
          <circle cx="12" cy="12" r="10" fill={color} />
          <path
            fill="#fff"
            d="M7.2 16.4V7.6h1.6l3.2 4.2 3.2-4.2h1.6v8.8h-1.6V10l-3.2 4.1L8.8 10v6.4z"
          />
        </svg>
      );
    }
    const iconMap: Record<string, typeof Download> = {
      telegram: Send,
      mediafire: Cloud,
      torrent: HardDrive,
      link: Link2,
      download: Download,
    };
    const Icon = iconMap[normalized] || Download;
    return <Icon className="h-4 w-4" style={{ color }} />;
  };
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [formState, setFormState] = useState<ProjectForm>(emptyProject);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [anilistIdInput, setAnilistIdInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [genreInput, setGenreInput] = useState("");
  const [producerInput, setProducerInput] = useState("");
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>({});
  const [genreTranslations, setGenreTranslations] = useState<Record<string, string>>({});
  const [staffRoleTranslations, setStaffRoleTranslations] = useState<Record<string, string>>({});
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
  const [memberDirectory, setMemberDirectory] = useState<string[]>([]);
  const [collapsedEpisodes, setCollapsedEpisodes] = useState<Record<number, boolean>>({});
  const [editorAccordionValue, setEditorAccordionValue] = useState<string[]>(["dados-principais"]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<
    "cover" | "banner" | "hero" | "episode-cover"
  >("cover");
  const [episodeCoverIndex, setEpisodeCoverIndex] = useState<number | null>(null);
  const chapterEditorsRef = useRef<Record<number, LexicalEditorHandle | null>>({});
  const episodeSizeInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("Sair da edição?");
  const [confirmDescription, setConfirmDescription] = useState(
    "Você tem alterações não salvas. Deseja continuar?",
  );
  const confirmActionRef = useRef<(() => void) | null>(null);
  const confirmCancelRef = useRef<(() => void) | null>(null);
  const autoEditHandledRef = useRef<string | null>(null);
  const isApplyingSearchParamsRef = useRef(false);
  const queryStateRef = useRef({
    sortMode,
    currentPage,
    selectedType,
  });
  const hasInitializedListFiltersRef = useRef(false);
  const editorInitialSnapshotRef = useRef<string>(buildProjectEditorSnapshot(emptyProject, ""));
  const isDirty = useMemo(
    () => buildProjectEditorSnapshot(formState, anilistIdInput) !== editorInitialSnapshotRef.current,
    [anilistIdInput, formState],
  );
  const canManageProjects = useMemo(() => {
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    return permissions.includes("*") || permissions.includes("projetos");
  }, [currentUser]);

  const handleEditorOpenChange = (next: boolean) => {
    if (!next && isLibraryOpen) {
      return;
    }
    if (!next) {
      if (!isDirty) {
        setIsEditorOpen(false);
        setEditingProject(null);
        return;
      }
      setConfirmTitle("Sair da edição?");
      setConfirmDescription("Você tem alterações não salvas. Deseja continuar?");
      confirmActionRef.current = () => {
        setIsEditorOpen(false);
        setEditingProject(null);
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
  const genreTranslationMap = useMemo(() => buildTranslationMap(genreTranslations), [genreTranslations]);
  const staffRoleTranslationMap = useMemo(() => buildTranslationMap(staffRoleTranslations), [staffRoleTranslations]);

  const translatedSortedEditorTags = useMemo(
    () => sortByTranslatedLabel(formState.tags, (tag) => translateTag(tag, tagTranslationMap)),
    [formState.tags, tagTranslationMap],
  );

  const translatedSortedEditorGenres = useMemo(
    () => sortByTranslatedLabel(formState.genres, (genre) => translateGenre(genre, genreTranslationMap)),
    [formState.genres, genreTranslationMap],
  );

  const knownTags = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((project) => {
      (project.tags || []).forEach((tag) => set.add(tag));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [projects]);

  const knownGenres = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((project) => {
      (project.genres || []).forEach((genre) => set.add(genre));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [projects]);

  const tagSuggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return knownTags
      .filter((tag) => tag.toLowerCase().includes(query) && !formState.tags.includes(tag))
      .slice(0, 6);
  }, [tagInput, knownTags, formState.tags]);

  const genreSuggestions = useMemo(() => {
    const query = genreInput.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return knownGenres
      .filter((genre) => genre.toLowerCase().includes(query) && !formState.genres.includes(genre))
      .slice(0, 6);
  }, [genreInput, knownGenres, formState.genres]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/me", { auth: true });
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }
        const data = await response.json();
        setCurrentUser(data);
      } catch {
        setCurrentUser(null);
      } finally {
        setHasLoadedCurrentUser(true);
      }
    };

    loadUser();
  }, [apiBase]);
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
      currentSortMode !== nextSort || currentCurrentPage !== nextPage || currentSelectedType !== nextType;
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
  const isChapterBased = isChapterBasedType(formState.type || "");
  const stageOptions = isChapterBased ? mangaStages : animeStages;
  const { projectRootFolder, projectEpisodesFolder } = useMemo(
    () => resolveProjectImageFolders(formState.id, formState.title),
    [formState.id, formState.title],
  );
  const scopedProjectImageIds = useMemo(() => {
    const normalizedProjectId = String(formState.id || "").trim();
    return normalizedProjectId ? [normalizedProjectId] : [];
  }, [formState.id]);
  const projectAssetLibraryOptions = useMemo(
    () =>
      ({
        uploadFolder: projectRootFolder,
        listFolders: [projectRootFolder, projectEpisodesFolder],
        listAll: false,
        includeProjectImages: true,
        projectImageProjectIds: scopedProjectImageIds,
      }) satisfies ImageLibraryOptions,
    [projectEpisodesFolder, projectRootFolder, scopedProjectImageIds],
  );
  const episodeAssetLibraryOptions = useMemo(
    () =>
      ({
        uploadFolder: projectEpisodesFolder,
        listFolders: [projectEpisodesFolder, projectRootFolder],
        listAll: false,
        includeProjectImages: true,
        projectImageProjectIds: scopedProjectImageIds,
      }) satisfies ImageLibraryOptions,
    [projectEpisodesFolder, projectRootFolder, scopedProjectImageIds],
  );
  const activeLibraryOptions = useMemo(
    () => (libraryTarget === "episode-cover" ? episodeAssetLibraryOptions : projectAssetLibraryOptions),
    [episodeAssetLibraryOptions, libraryTarget, projectAssetLibraryOptions],
  );

  const sortedEpisodeDownloads = useMemo(() => {
    if (!isChapterBased) {
      return formState.episodeDownloads.map((episode, index) => ({ episode, index }));
    }
    return formState.episodeDownloads
      .map((episode, index) => ({ episode, index }))
      .sort((a, b) => {
        const numberDelta = (a.episode.number || 0) - (b.episode.number || 0);
        if (numberDelta !== 0) {
          return numberDelta;
        }
        return (a.episode.volume || 0) - (b.episode.volume || 0);
      });
  }, [formState.episodeDownloads, isChapterBased]);

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

  const applyLibraryImage = (url: string, _altText?: string) => {
    setFormState((prev) => {
      const next = { ...prev };
      if (libraryTarget === "cover") {
        next.cover = url;
      } else if (libraryTarget === "banner") {
        next.banner = url;
      } else if (libraryTarget === "hero") {
        next.heroImageUrl = url;
      } else if (libraryTarget === "episode-cover") {
        if (episodeCoverIndex === null) {
          return prev;
        }
        const nextEpisodes = [...prev.episodeDownloads];
        if (!nextEpisodes[episodeCoverIndex]) {
          return prev;
        }
        nextEpisodes[episodeCoverIndex] = {
          ...nextEpisodes[episodeCoverIndex],
          coverImageUrl: url,
        };
        return { ...prev, episodeDownloads: nextEpisodes };
      }
      return next;
    });
  };

  const openLibraryForProjectImage = (target: "cover" | "banner" | "hero") => {
    setLibraryTarget(target);
    setIsLibraryOpen(true);
  };

  const openLibraryForEpisodeCover = (index: number) => {
    setEpisodeCoverIndex(index);
    setLibraryTarget("episode-cover");
    setIsLibraryOpen(true);
  };

  const loadProjects = useCallback(async () => {
    const response = await apiFetch(apiBase, "/api/projects", { auth: true });
    if (!response.ok) {
      throw new Error("projects_load_failed");
    }
    const data = await response.json();
    setProjects(Array.isArray(data.projects) ? data.projects : []);
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      if (isActive) {
        setIsLoading(true);
        setHasLoadError(false);
      }
      try {
        const [projectsResult, usersResult, translationsResult] = await Promise.allSettled([
          loadProjects(),
          apiFetch(apiBase, "/api/users", { auth: true }),
          apiFetch(apiBase, "/api/public/tag-translations", { cache: "no-store" }),
        ]);
        if (usersResult.status === "fulfilled") {
          const response = usersResult.value;
          if (response.ok) {
            const data = (await response.json()) as { users?: Array<{ name?: string; status?: string }> };
            const names = Array.isArray(data.users)
              ? data.users
                  .filter((user) => user.status === "active")
                  .map((user) => user.name)
                  .filter((name): name is string => Boolean(name))
              : [];
            if (isActive) {
              setMemberDirectory(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "pt-BR")));
            }
          }
        } else if (isActive) {
          setMemberDirectory([]);
        }
        if (projectsResult.status === "rejected") {
          throw projectsResult.reason;
        }
        if (translationsResult.status === "fulfilled") {
          const response = translationsResult.value;
          if (response.ok) {
            const data = await response.json();
            if (isActive) {
              setTagTranslations(data?.tags || {});
              setGenreTranslations(data?.genres || {});
              setStaffRoleTranslations(data?.staffRoles || {});
            }
          }
        } else if (isActive) {
          setTagTranslations({});
          setGenreTranslations({});
          setStaffRoleTranslations({});
        }
        if (isActive) {
          setHasLoadError(false);
        }
      } catch {
        if (isActive) {
          setProjects([]);
          setMemberDirectory([]);
          setTagTranslations({});
          setGenreTranslations({});
          setStaffRoleTranslations({});
          setHasLoadError(true);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [apiBase, loadProjects, loadVersion]);

  useEffect(() => {
    if (!isLibraryOpen) {
      setLibraryTarget("cover");
      setEpisodeCoverIndex(null);
    }
  }, [isLibraryOpen]);

  const isRestorable = useCallback((project: ProjectRecord) => {
    if (!project.deletedAt) {
      return false;
    }
    const ts = new Date(project.deletedAt).getTime();
    if (!Number.isFinite(ts)) {
      return false;
    }
    return Date.now() - ts <= restoreWindowMs;
  }, [restoreWindowMs]);

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

  const activeProjects = useMemo(() => projects.filter((project) => !project.deletedAt), [projects]);
  const trashedProjects = useMemo(
    () => projects.filter((project) => project.deletedAt && isRestorable(project)),
    [isRestorable, projects],
  );
  const typeOptions = useMemo(() => {
    const types = activeProjects.map((project) => String(project.type || "").trim()).filter(Boolean);
    const unique = Array.from(new Set(types));
    const sorted = unique.sort((a, b) => a.localeCompare(b, "pt-BR"));
    return ["Todos", ...sorted];
  }, [activeProjects]);

  useEffect(() => {
    if (isLoading || hasLoadError) {
      return;
    }
    if (selectedType === "Todos") {
      return;
    }
    if (typeOptions.includes(selectedType)) {
      return;
    }
    setSelectedType("Todos");
  }, [hasLoadError, isLoading, selectedType, typeOptions]);

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

  const currentLibrarySelection = useMemo(() => {
    if (libraryTarget === "cover") {
      return formState.cover || "";
    }
    if (libraryTarget === "banner") {
      return formState.banner || "";
    }
    if (libraryTarget === "hero") {
      return formState.heroImageUrl || "";
    }
    if (libraryTarget === "episode-cover" && episodeCoverIndex !== null) {
      return formState.episodeDownloads[episodeCoverIndex]?.coverImageUrl || "";
    }
    return "";
  }, [
    episodeCoverIndex,
    formState.banner,
    formState.cover,
    formState.episodeDownloads,
    formState.heroImageUrl,
    libraryTarget,
  ]);

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
    if (isLoading) {
      return;
    }
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [isLoading, totalPages]);

  const openCreate = () => {
    const nextForm = { ...emptyProject };
    setEditingProject(null);
    setFormState(nextForm);
    setAnilistIdInput("");
    setEditorAccordionValue(["importacao"]);
    setEpisodeDateDraft({});
    setEpisodeTimeDraft({});
    setEpisodeSizeDrafts({});
    setEpisodeSizeErrors({});
    episodeSizeInputRefs.current = {};
    setAnimeStaffMemberInput({});
    editorInitialSnapshotRef.current = buildProjectEditorSnapshot(nextForm, "");
    setCollapsedEpisodes({});
    setIsEditorOpen(true);
  };

  const openEdit = useCallback((project: ProjectRecord) => {
    const initialEpisodes: ProjectEpisode[] = Array.isArray(project.episodeDownloads)
      ? project.episodeDownloads.map((episode): ProjectEpisode => ({
          ...episode,
          content: episode.content || "",
          contentFormat: "lexical",
        }))
      : [];
    const mergedSynopsis = project.synopsis || project.description || "";
    const nextForm = {
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
      episodes: project.episodes || "",
      tags: Array.isArray(project.tags) ? project.tags : [],
      genres: Array.isArray(project.genres) ? project.genres : [],
      cover: project.cover || "",
      banner: project.banner || "",
      season: project.season || "",
      schedule: project.schedule || "",
      rating: project.rating || "",
      country: project.country || "",
      source: project.source || "",
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
      episodeDownloads: initialEpisodes,
    };
    const nextAniListInput = project.anilistId ? String(project.anilistId) : "";
    setEditingProject(project);
    setFormState(nextForm);
    setAnilistIdInput(nextAniListInput);
    setEditorAccordionValue(["dados-principais"]);
    setEpisodeDateDraft({});
    setEpisodeTimeDraft({});
    setEpisodeSizeDrafts({});
    setEpisodeSizeErrors({});
    episodeSizeInputRefs.current = {};
    setAnimeStaffMemberInput({});
    editorInitialSnapshotRef.current = buildProjectEditorSnapshot(nextForm, nextAniListInput);
    setCollapsedEpisodes(() => {
      const next: Record<number, boolean> = {};
      initialEpisodes.forEach((_, index) => {
        next[index] = true;
      });
      return next;
    });
    setIsEditorOpen(true);
  }, []);

  useEffect(() => {
    const editTarget = (searchParams.get("edit") || "").trim();
    if (!editTarget) {
      autoEditHandledRef.current = null;
      return;
    }
    if (autoEditHandledRef.current === editTarget) {
      return;
    }
    if (isLoading || !hasLoadedCurrentUser) {
      return;
    }
    autoEditHandledRef.current = editTarget;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("edit");
    const target = canManageProjects
      ? projects.find((project) => project.id === editTarget) || null
      : null;
    if (target) {
      openEdit(target);
    }
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    canManageProjects,
    hasLoadedCurrentUser,
    isLoading,
    openEdit,
    projects,
    searchParams,
    setSearchParams,
  ]);

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingProject(null);
  };

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

  const handleSave = async () => {
    const trimmedTitle = formState.title.trim();
    const baseId = formState.id.trim();
    if (!trimmedTitle) {
      toast({
        title: "Preencha o título do projeto",
        description: "O título é obrigatório para salvar.",
        variant: "destructive",
      });
      return;
    }

    const normalizedEpisodesForSave = formState.episodeDownloads.map((episode) => ({
      ...episode,
      sources: Array.isArray(episode.sources) ? episode.sources.map((source) => ({ ...source })) : [],
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

    const nowIso = new Date().toISOString();
    const prevEpisodesMap = new Map<string, ProjectEpisode>();
    if (editingProject?.episodeDownloads?.length) {
      editingProject.episodeDownloads.forEach((episode) => {
        const key = `${episode.number}-${episode.volume || 0}`;
        prevEpisodesMap.set(key, episode);
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

    const parsedAniListId = Number(anilistIdInput);
    const resolvedAniListId =
      formState.anilistId ?? (Number.isFinite(parsedAniListId) ? parsedAniListId : null);
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
      episodes: formState.episodes?.trim() || "",
      tags: formState.tags.filter(Boolean),
      genres: formState.genres.filter(Boolean),
      cover: formState.cover?.trim() || "",
      banner: formState.banner?.trim() || "",
      season: formState.season?.trim() || "",
      schedule: formState.schedule?.trim() || "",
      rating: formState.rating?.trim() || "",
      country: formState.country?.trim() || "",
      source: formState.source?.trim() || "",
      producers: formState.producers.filter(Boolean),
      startDate: formState.startDate || "",
      endDate: formState.endDate || "",
      trailerUrl: formState.trailerUrl?.trim() || "",
      forceHero: Boolean(formState.forceHero),
      heroImageUrl: formState.heroImageUrl?.trim() || "",
      relations: formState.relations
        .filter((item) => item.title || item.relation || item.projectId)
        .filter((item, index, arr) => {
          const key = item.projectId || item.anilistId || item.title;
          if (!key) {
            return true;
          }
          return arr.findIndex((rel) => (rel.projectId || rel.anilistId || rel.title) === key) === index;
        }),
      staff: staffWithPending.filter((item) => item.role || item.members.length > 0),
      animeStaff: formState.animeStaff.filter((item) => item.role || item.members.length > 0),
      episodeDownloads: normalizedEpisodesForSave.map((episode) => {
        const key = `${episode.number}-${episode.volume || 0}`;
        const prev = prevEpisodesMap.get(key);
        const signature = [
          String(episode.title || ""),
          String(episode.releaseDate || ""),
          String(episode.content || "").trim(),
        ].join("||");
        const prevSignature = [
          String(prev?.title || ""),
          String(prev?.releaseDate || ""),
          String(prev?.content || "").trim(),
        ].join("||");
        const shouldStamp =
          isLightNovel &&
          String(episode.content || "").trim().length > 0 &&
          (!prev || signature !== prevSignature);
        const hash = String(episode.hash || "").trim();
        const parsedSize = Number(episode.sizeBytes);
        const sizeBytes =
          Number.isFinite(parsedSize) && parsedSize > 0 ? Math.round(parsedSize) : undefined;
        return {
          ...episode,
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
          completedStages: episode.completedStages || [],
          progressStage: getProgressStage(formState.type || "", episode.completedStages),
          chapterUpdatedAt: shouldStamp
            ? nowIso
            : prev?.chapterUpdatedAt || episode.chapterUpdatedAt || "",
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
      toast({
        title: "Não foi possível salvar o projeto",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
      return;
    }
    const data = await response.json();
    if (editingProject) {
      setProjects((prev) =>
        prev.map((project) => (project.id === editingProject.id ? data.project : project)),
      );
    } else {
      setProjects((prev) => [...prev, data.project]);
    }
    editorInitialSnapshotRef.current = buildProjectEditorSnapshot(payload as ProjectForm, anilistIdInput);
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
    toast({ title: "Projeto movido para a lixeira", description: "Você pode restaurar por 3 dias." });
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
    const studio =
      media.studios?.nodes?.find((item) => item.isAnimationStudio)?.name ||
      media.studios?.nodes?.[0]?.name ||
      "";
    const producers = media.producers?.nodes?.map((item) => item.name).filter(Boolean) || [];
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
    const relations: ProjectRelation[] = relationNodes.reduce<ProjectRelation[]>((acc, node, index) => {
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
    }, []);
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
      studio,
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
    const id = Number(anilistIdInput);
    if (!Number.isFinite(id)) {
      toast({
        title: "ID do AniList inválido",
        description: "Informe um número válido antes de importar.",
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

  const handleAddTag = () => {
    const next = tagInput.trim();
    if (!next) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      tags: prev.tags.includes(next) ? prev.tags : [...prev.tags, next],
    }));
    setTagInput("");
  };

  const handleAddGenre = () => {
    const next = genreInput.trim();
    if (!next) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      genres: prev.genres.includes(next) ? prev.genres : [...prev.genres, next],
    }));
    setGenreInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setFormState((prev) => ({ ...prev, tags: prev.tags.filter((item) => item !== tag) }));
  };

  const handleRemoveGenre = (genre: string) => {
    setFormState((prev) => ({ ...prev, genres: prev.genres.filter((item) => item !== genre) }));
  };

  const handleAddProducer = () => {
    const next = producerInput.trim();
    if (!next) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      producers: prev.producers.includes(next) ? prev.producers : [...prev.producers, next],
    }));
    setProducerInput("");
  };

  const handleRelationDrop = (targetIndex: number) => {
    if (relationDragIndex === null || relationDragIndex === targetIndex) {
      setRelationDragIndex(null);
      return;
    }
    setFormState((prev) => {
      const next = [...prev.relations];
      const [removed] = next.splice(relationDragIndex, 1);
      next.splice(targetIndex, 0, removed);
      return { ...prev, relations: next };
    });
    setRelationDragIndex(null);
  };

  const handleStaffDrop = (targetIndex: number) => {
    if (staffDragIndex === null || staffDragIndex === targetIndex) {
      setStaffDragIndex(null);
      return;
    }
    setFormState((prev) => {
      const next = [...prev.staff];
      const [removed] = next.splice(staffDragIndex, 1);
      next.splice(targetIndex, 0, removed);
      return { ...prev, staff: next };
    });
    setStaffDragIndex(null);
  };

  const handleAnimeStaffDrop = (targetIndex: number) => {
    if (animeStaffDragIndex === null || animeStaffDragIndex === targetIndex) {
      setAnimeStaffDragIndex(null);
      return;
    }
    setFormState((prev) => {
      const next = [...prev.animeStaff];
      const [removed] = next.splice(animeStaffDragIndex, 1);
      next.splice(targetIndex, 0, removed);
      return { ...prev, animeStaff: next };
    });
    setAnimeStaffMemberInput({});
    setAnimeStaffDragIndex(null);
  };

  const handleEpisodeDrop = (targetIndex: number) => {
    if (episodeDragId === null || episodeDragId === targetIndex) {
      setEpisodeDragId(null);
      return;
    }
    setFormState((prev) => {
      const next = [...prev.episodeDownloads];
      const [removed] = next.splice(episodeDragId, 1);
      next.splice(targetIndex, 0, removed);
      return { ...prev, episodeDownloads: next };
    });
    setCollapsedEpisodes((prev) => {
      const flags = Array.from({ length: formState.episodeDownloads.length }, (_, idx) => prev[idx] ?? false);
      const [moved] = flags.splice(episodeDragId, 1);
      flags.splice(targetIndex, 0, moved);
      const next: Record<number, boolean> = {};
      flags.forEach((value, idx) => {
        next[idx] = value;
      });
      return next;
    });
    setEpisodeDragId(null);
  };

  const editorSectionClassName =
    "project-editor-section rounded-2xl border border-border/60 bg-card/70 px-4";
  const editorSectionTriggerClassName =
    "project-editor-section-trigger py-3 text-sm font-semibold hover:no-underline";
  const editorSectionContentClassName = "project-editor-section-content pb-4 px-1";
  const editorProjectLabel = editingProject ? "Projeto em edição" : "Novo projeto";
  const editorProjectTitle = formState.title.trim() || "Sem título";
  const editorProjectId = formState.id.trim() || "Será definido ao salvar";
  const editorTypeLabel = formState.type || "Formato";
  const editorStatusLabel = formState.status || "Status";
  const editorEpisodeCount = formState.episodeDownloads.length;

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
              actions={(
                <Button className="gap-2" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Novo projeto
                </Button>
              )}
            />

            <section className="mt-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 motion-item opacity-0">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <div className="w-full max-w-sm">
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Buscar por título, tags, estúdio..."
                    />
                  </div>
                  <Select value={sortMode} onValueChange={(value) => setSortMode(value as typeof sortMode)}>
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
                  <Select value={selectedType} onValueChange={setSelectedType}>
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
                <Badge variant="secondary" className="text-xs uppercase motion-item opacity-0">
                  {sortedProjects.length} projetos
                </Badge>
              </div>

              {isLoading ? (
                <AsyncState
                  kind="loading"
                  title="Carregando projetos"
                  description="Buscando os projetos no banco de dados."
                  className={dashboardPageLayoutTokens.surfaceDefault}
                />
              ) : hasLoadError ? (
                <AsyncState
                  kind="error"
                  title="Nao foi possivel carregar os projetos"
                  description="Tente recarregar os dados do painel."
                  className={dashboardPageLayoutTokens.surfaceDefault}
                  action={
                    <Button
                      variant="outline"
                      onClick={() => setLoadVersion((previous) => previous + 1)}
                    >
                      Recarregar
                    </Button>
                  }
                />
              ) : sortedProjects.length === 0 ? (
                <AsyncState
                  kind="empty"
                  title="Nenhum projeto encontrado"
                  description="Ajuste os filtros ou crie um novo projeto."
                  className={dashboardPageLayoutTokens.surfaceMuted}
                  action={
                    <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
                      <Plus className="mr-2 h-4 w-4" />
                      Criar primeiro projeto
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-6">
                  {paginatedProjects.map((project, index) => (
                    <Card
                      key={project.id}
                      className={`${dashboardPageLayoutTokens.listCard} group cursor-pointer overflow-hidden transition hover:border-primary/40 motion-item opacity-0`}
                      style={{ animationDelay: `${Math.min(index * 35, 210)}ms` }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openEdit(project);
                        }
                      }}
                      onClick={() => openEdit(project)}
                    >
                      <CardContent className="p-0">
                        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                        <div className="relative aspect-2/3 w-full">
                            <img
                              src={project.cover || "/placeholder.svg"}
                              alt={project.title}
                              className="h-full w-full object-cover object-center"
                              loading="lazy"
                            />
                            {project.tags[0] ? (
                              <Badge className="absolute right-3 top-3 text-[10px] uppercase bg-background/85 text-foreground">
                                {translateTag(
                                  sortByTranslatedLabel(project.tags || [], (tag) =>
                                    translateTag(tag, tagTranslationMap),
                                  )[0] || "",
                                  tagTranslationMap,
                                )}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex flex-1 flex-col gap-4 p-6">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    {project.status}
                                  </Badge>
                                  <Badge variant="secondary" className="text-[10px] uppercase">
                                    {project.type}
                                  </Badge>
                                </div>
                                <h3 className="text-lg font-semibold text-foreground">{project.title}</h3>
                                <p className="text-xs text-muted-foreground">{project.studio}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Visualizar"
                                  asChild
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Link to={`/projeto/${project.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Copiar link"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    const url = `${window.location.origin}/projeto/${project.id}`;
                                    navigator.clipboard
                                      .writeText(url)
                                      .catch(() => {
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
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setDeleteTarget(project);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-3">{project.synopsis}</p>

                            {project.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {sortByTranslatedLabel(project.tags || [], (tag) =>
                                  translateTag(tag, tagTranslationMap),
                                )
                                  .slice(0, 4)
                                  .map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-[10px] uppercase">
                                    {translateTag(tag, tagTranslationMap)}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                            {project.genres?.length ? (
                              <div className="flex flex-wrap gap-2">
                                {sortByTranslatedLabel(project.genres || [], (genre) =>
                                  translateGenre(genre, genreTranslationMap),
                                )
                                  .slice(0, 4)
                                  .map((genre) => (
                                  <Badge key={genre} variant="outline" className="text-[10px] uppercase">
                                    {translateGenre(genre, genreTranslationMap)}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}

                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-2">{project.views} visualizações</span>
                              <span className="inline-flex items-center gap-2">
                                {project.commentsCount} comentários
                              </span>
                              <span className="ml-auto text-xs text-muted-foreground">ID {project.id}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {sortedProjects.length > projectsPerPage ? (
                <div className="mt-6 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            setCurrentPage((page) => Math.max(1, page - 1));
                          }}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            isActive={page === currentPage}
                            onClick={(event) => {
                              event.preventDefault();
                              setCurrentPage(page);
                            }}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            setCurrentPage((page) => Math.min(totalPages, page + 1));
                          }}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
              {trashedProjects.length > 0 ? (
                <Card className="mt-8 border-border/60 bg-card/60">
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
                          className={`${dashboardPageLayoutTokens.surfaceDefault} flex flex-wrap items-center justify-between gap-3 px-4 py-3 motion-item opacity-0`}
                          style={{ animationDelay: `${Math.min(index * 35, 210)}ms` }}
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
          className={`project-editor-dialog max-h-[94vh] max-w-[min(1120px,calc(100vw-1.5rem))] overflow-y-auto no-scrollbar p-0 ${
            isEditorDialogScrolled ? "editor-modal-scrolled" : ""
          }`}
          onScroll={(event) => {
            const nextScrolled = event.currentTarget.scrollTop > 0;
            setIsEditorDialogScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
          }}
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
          <div className="project-editor-top sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80">
            <DialogHeader className="space-y-0 px-4 pb-4 pt-5 text-left md:px-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                      {editorProjectLabel}
                    </Badge>
                    {formState.anilistId ? (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                        AniList {formState.anilistId}
                      </Badge>
                    ) : null}
                  </div>
                  <DialogTitle className="text-xl md:text-2xl">
                    {editingProject ? "Editar projeto" : "Novo projeto"}
                  </DialogTitle>
                  <DialogDescription className="max-w-2xl text-xs md:text-sm">
                    Busque no AniList para preencher automaticamente ou ajuste todos os dados manualmente.
                  </DialogDescription>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/65 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Projeto</p>
                  <p className="max-w-[210px] truncate text-sm font-medium text-foreground">{editorProjectTitle}</p>
                </div>
              </div>
            </DialogHeader>
            <div className="project-editor-status-bar flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-3 md:px-6">
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

          <div className="project-editor-layout grid gap-6 px-4 pb-5 pt-4 md:px-6 md:pb-7">
            <Accordion
              type="multiple"
              value={editorAccordionValue}
              onValueChange={setEditorAccordionValue}
              className="project-editor-accordion space-y-3"
            >
              <AccordionItem value="importacao" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionTriggerClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span>Importação AniList</span>
                    <span className="text-xs text-muted-foreground">Preenchimento automático</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className={editorSectionContentClassName}>
                  <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label>ID AniList</Label>
                  <Input
                    value={anilistIdInput}
                    onChange={(event) => setAnilistIdInput(event.target.value)}
                    placeholder="Ex.: 21366"
                  />
                </div>
                <Button className="self-end" onClick={handleImportAniList}>
                  Importar do AniList
                </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="dados-principais" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionTriggerClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span>Dados principais</span>
                    <span className="text-xs text-muted-foreground">{formState.title || "ID e títulos"}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className={editorSectionContentClassName}>
                  <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>ID do projeto</Label>
                <Input
                  value={formState.id}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    const hasAniList =
                      Boolean(formState.anilistId) || Number.isFinite(Number(anilistIdInput));
                    const trimmed = nextValue.trim();
                    if (!hasAniList && trimmed && /^\d+$/.test(trimmed)) {
                      return;
                    }
                    setFormState((prev) => ({ ...prev, id: nextValue }));
                  }}
                  placeholder="Mesmo ID do AniList ou slug manual"
                />
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={formState.title}
                  onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Título original</Label>
                <Input
                  value={formState.titleOriginal}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, titleOriginal: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Título em inglês</Label>
                <Input
                  value={formState.titleEnglish}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, titleEnglish: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Forçar no carrossel</Label>
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Exibe no carrossel da home mesmo sem lançamento recente.
                  </span>
                  <Switch
                    checked={Boolean(formState.forceHero)}
                    onCheckedChange={(checked) =>
                      setFormState((prev) => ({ ...prev, forceHero: checked }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Sinopse</Label>
                <Textarea
                  value={formState.synopsis}
                  onChange={(event) => setFormState((prev) => ({ ...prev, synopsis: event.target.value }))}
                  rows={6}
                />
              </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="midias" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionTriggerClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span>Mídias</span>
                    <span className="text-xs text-muted-foreground">
                      {[formState.heroImageUrl, formState.cover, formState.banner].filter(Boolean).length}/3 selecionadas
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className={editorSectionContentClassName}>
                  <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Imagem do carrossel</Label>
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-3 py-2">
                  {formState.heroImageUrl ? (
                    <img
                      src={formState.heroImageUrl}
                      alt="Imagem do carrossel"
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border/60 text-center text-[10px] text-muted-foreground leading-tight">
                      Sem imagem
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => openLibraryForProjectImage("hero")}
                  >
                    Biblioteca
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Capa</Label>
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-3 py-2">
                  {formState.cover ? (
                    <img src={formState.cover} alt="Capa" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border/60 text-center text-[10px] text-muted-foreground leading-tight">
                      Sem imagem
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => openLibraryForProjectImage("cover")}
                  >
                    Biblioteca
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Banner</Label>
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-3 py-2">
                  {formState.banner ? (
                    <img src={formState.banner} alt="Banner" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border/60 text-center text-[10px] text-muted-foreground leading-tight">
                      Sem imagem
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => openLibraryForProjectImage("banner")}
                  >
                    Biblioteca
                  </Button>
                </div>
              </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="metadados" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionTriggerClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span>Metadados</span>
                    <span className="text-xs text-muted-foreground">
                      {formState.type || "Formato"} • {formState.status || "Status"}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className={editorSectionContentClassName}>
                  <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Formato</Label>
                <Select
                  value={formState.type}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Formato" />
                  </SelectTrigger>
                  <SelectContent>
                    {formatOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formState.status}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, status: value }))}
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
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input
                  value={formState.year}
                  onChange={(event) => setFormState((prev) => ({ ...prev, year: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Temporada</Label>
                <Input
                  value={formState.season}
                  onChange={(event) => setFormState((prev) => ({ ...prev, season: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Estúdio</Label>
                <Input
                  value={formState.studio}
                  onChange={(event) => setFormState((prev) => ({ ...prev, studio: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Episódios/Capítulos</Label>
                <Input
                  value={formState.episodes}
                  onChange={(event) => setFormState((prev) => ({ ...prev, episodes: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>País de origem</Label>
                <Input
                  value={formState.country}
                  onChange={(event) => setFormState((prev) => ({ ...prev, country: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fonte</Label>
                <Input
                  value={formState.source}
                  onChange={(event) => setFormState((prev) => ({ ...prev, source: event.target.value }))}
                />
              </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="classificacao" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionTriggerClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span>Classificação</span>
                    <span className="text-xs text-muted-foreground">
                      {formState.tags.length} tags • {formState.genres.length} gêneros
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className={editorSectionContentClassName}>
                  <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
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
                    {tagSuggestions.map((tag) => (
                      <Button
                        key={`tag-suggestion-${tag}`}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setTagInput(tag);
                          setFormState((prev) => ({
                            ...prev,
                            tags: prev.tags.includes(tag) ? prev.tags : [...prev.tags, tag],
                          }));
                          setTagInput("");
                        }}
                      >
                        {tag}
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
              </div>
              <div className="space-y-2">
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
                    {genreSuggestions.map((genre) => (
                      <Button
                        key={`genre-suggestion-${genre}`}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setGenreInput(genre);
                          setFormState((prev) => ({
                            ...prev,
                            genres: prev.genres.includes(genre) ? prev.genres : [...prev.genres, genre],
                          }));
                          setGenreInput("");
                        }}
                      >
                        {genre}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {translatedSortedEditorGenres.map((genre, index) => (
                    <Badge key={`${genre}-${index}`} variant="secondary" onClick={() => handleRemoveGenre(genre)} className="cursor-pointer">
                      {translateGenre(genre, genreTranslationMap)}
                    </Badge>
                  ))}
                </div>
              </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="relacoes" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionTriggerClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span>Relações</span>
                    <span className="text-xs text-muted-foreground">{formState.relations.length} itens</span>
                  </div>
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
                    className="grid gap-2 rounded-2xl border border-border/60 bg-card/60 p-3 md:grid-cols-[1.35fr_1fr_1fr_auto]"
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

              <AccordionItem value="equipe" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionTriggerClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span>Equipe da fansub</span>
                    <span className="text-xs text-muted-foreground">{formState.staff.length} funções</span>
                  </div>
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
                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
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
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setFormState((prev) => ({
                            ...prev,
                            staff: prev.staff.filter((_, idx) => idx !== index),
                          }))
                        }
                      >
                        Remover
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Input
                        list="staff-directory"
                        value={staffMemberInput[index] || ""}
                        onChange={(event) =>
                          setStaffMemberInput((prev) => ({ ...prev, [index]: event.target.value }))
                        }
                        placeholder="Adicionar membro"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setFormState((prev) => {
                            const next = [...prev.staff];
                            const name = (staffMemberInput[index] || "").trim();
                            if (!name) {
                              return prev;
                            }
                            const members = next[index].members || [];
                            next[index] = {
                              ...next[index],
                              members: members.includes(name) ? members : [...members, name],
                            };
                            return { ...prev, staff: next };
                          })
                        }
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
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span>Staff do anime</span>
                    <span className="text-xs text-muted-foreground">{formState.animeStaff.length} funções</span>
                  </div>
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
                          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
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
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setFormState((prev) => ({
                                  ...prev,
                                  animeStaff: prev.animeStaff.filter((_, idx) => idx !== index),
                                }));
                                setAnimeStaffMemberInput((prev) => shiftDraftAfterRemoval(prev, index));
                              }}
                            >
                              Remover
                            </Button>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Input
                              list="staff-directory"
                              value={animeStaffMemberInput[index] || ""}
                              onChange={(event) =>
                                setAnimeStaffMemberInput((prev) => ({ ...prev, [index]: event.target.value }))
                              }
                              placeholder="Adicionar membro"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const name = (animeStaffMemberInput[index] || "").trim();
                                if (!name) {
                                  return;
                                }
                                setFormState((prev) => {
                                  const next = [...prev.animeStaff];
                                  const members = next[index].members || [];
                                  next[index] = {
                                    ...next[index],
                                    members: members.includes(name) ? members : [...members, name],
                                  };
                                  return { ...prev, animeStaff: next };
                                });
                                setAnimeStaffMemberInput((prev) => ({ ...prev, [index]: "" }));
                              }}
                            >
                              Adicionar
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(role.members || []).map((member) => (
                              <Badge key={member} variant="secondary" className="flex items-center gap-1">
                                <span>{member}</span>
                                <button
                                  type="button"
                                  className="rounded-sm p-0.5 text-muted-foreground transition hover:text-foreground"
                                  onClick={() =>
                                    setFormState((prev) => {
                                      const next = [...prev.animeStaff];
                                      next[index] = {
                                        ...next[index],
                                        members: (next[index].members || []).filter((item) => item !== member),
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

              <AccordionItem value="episodios" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionTriggerClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span>{isChapterBased ? "Capítulos" : "Episódios"}</span>
                    <span className="text-xs text-muted-foreground">
                      {formState.episodeDownloads.length} {isChapterBased ? "capítulos" : "episódios"}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className={editorSectionContentClassName}>
                  <div className="space-y-3">
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setFormState((prev) => {
                      const newEpisode: ProjectEpisode = {
                        number: prev.episodeDownloads.length + 1,
                        volume: undefined,
                        title: "",
                        releaseDate: "",
                        duration: "",
                        coverImageUrl: "",
                        sourceType: "TV",
                        sources: [],
                        progressStage: "aguardando-raw",
                        completedStages: [],
                        content: "",
                        contentFormat: "lexical",
                      };
                      const next = [...prev.episodeDownloads, newEpisode];
                      return { ...prev, episodeDownloads: next };
                    })
                  }
                >
                  {isChapterBased ? "Adicionar capítulo" : "Adicionar episódio"}
                </Button>
              </div>
              <Accordion
                type="multiple"
                value={episodeOpenValues}
                onValueChange={handleEpisodeAccordionChange}
                className="space-y-4"
              >
                {sortedEpisodeDownloads.map(({ episode, index }) => {
                  const isEpisodeCollapsed = collapsedEpisodes[index] ?? false;
                  const episodeUnitLabel = isChapterBased ? "Capítulo" : "Episódio";
                  const episodeNumberLabel = `${episodeUnitLabel} ${episode.number || index + 1}`;
                  const episodeTitleLabel = String(episode.title || "").trim() || "Sem título";
                  const hasDownloadSource = episode.sources.some((source) => source.url);
                  const currentProgressStageLabel =
                    stageOptions.find(
                      (stage) =>
                        stage.id === getProgressStage(formState.type || "", episode.completedStages),
                    )?.label || "Aguardando Raw";
                  const collapsedHeaderMeta: string[] = [];

                  if (isLightNovel && String(episode.content || "").trim().length > 0) {
                    collapsedHeaderMeta.push("Conteúdo");
                  }
                  if (!isChapterBased && !hasDownloadSource) {
                    collapsedHeaderMeta.push(currentProgressStageLabel);
                  }
                  if (hasDownloadSource) {
                    collapsedHeaderMeta.push("Download");
                  }

                  return (
                  <AccordionItem
                    key={`${episode.number}-${index}`}
                    value={getEpisodeAccordionValue(index)}
                    className="border-none"
                  >
                  <Card
                    className="project-editor-episode-card border-border/60 bg-card/70 !shadow-none hover:!shadow-none"
                    data-testid={`episode-card-${index}`}
                    onDragStart={() => setEpisodeDragId(null)}
                  >
                    <CardContent className={`project-editor-episode-content space-y-3 ${isEpisodeCollapsed ? "p-4" : "p-5"}`}>
                      <div
                        className="project-editor-episode-header flex flex-wrap items-start justify-between gap-2"
                        data-testid={`episode-header-${index}`}
                        onClick={(event) => handleEpisodeHeaderClick(index, event)}
                      >
                        <div className="min-w-0 flex-1">
                          <AccordionTrigger
                            data-episode-accordion-trigger
                            className="project-editor-episode-trigger py-0 text-left text-foreground hover:no-underline [&>svg]:mt-0.5 [&>svg]:shrink-0"
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
                                  {formatEpisodeReleaseDate(episode.releaseDate, episode.duration)}
                                </span>
                              ) : null}
                            </div>
                          </AccordionTrigger>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isEpisodeCollapsed && collapsedHeaderMeta.length > 0 ? (
                            <span className="text-[11px] text-muted-foreground">
                              {collapsedHeaderMeta.join(" • ")}
                            </span>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                            data-no-toggle
                            onClick={() =>
                              {
                                setFormState((prev) => ({
                                  ...prev,
                                  episodeDownloads: prev.episodeDownloads.filter((_, idx) => idx !== index),
                                }));
                                setEpisodeDateDraft((prev) => shiftDraftAfterRemoval(prev, index));
                                setEpisodeTimeDraft((prev) => shiftDraftAfterRemoval(prev, index));
                                setEpisodeSizeDrafts((prev) => shiftDraftAfterRemoval(prev, index));
                                setEpisodeSizeErrors((prev) => shiftDraftAfterRemoval(prev, index));
                                setCollapsedEpisodes((prev) => shiftCollapsedEpisodesAfterRemoval(prev, index));
                              }
                            }
                          >
                            {isChapterBased ? "Remover capítulo" : "Remover episódio"}
                          </Button>
                        </div>
                      </div>
                      <AccordionContent className="project-editor-episode-panel pt-3 pb-0 px-1">
                          <div className="project-editor-episode-group project-editor-episode-basics grid gap-3 md:grid-cols-[minmax(84px,0.7fr)_minmax(84px,0.7fr)_minmax(180px,1.4fr)_minmax(150px,1fr)_minmax(110px,0.8fr)_minmax(130px,0.9fr)]">
                            <Input
                              type="number"
                              value={episode.number}
                              onChange={(event) =>
                                setFormState((prev) => {
                                  const next = [...prev.episodeDownloads];
                                  next[index] = { ...next[index], number: Number(event.target.value) };
                                  return { ...prev, episodeDownloads: next };
                                })
                              }
                              placeholder="Número"
                            />
                            {isManga ? (
                              <Input
                                type="number"
                                value={episode.volume || ""}
                                onChange={(event) =>
                                  setFormState((prev) => {
                                    const next = [...prev.episodeDownloads];
                                    next[index] = {
                                      ...next[index],
                                      volume: event.target.value ? Number(event.target.value) : undefined,
                                    };
                                    return { ...prev, episodeDownloads: next };
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
                                  next[index] = { ...next[index], title: event.target.value };
                                  return { ...prev, episodeDownloads: next };
                                })
                              }
                              placeholder="Título"
                            />
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={episodeDateDraft[index] ?? isoToDisplayDate(episode.releaseDate)}
                              onChange={(event) => {
                                const masked = formatDateDigitsToDisplay(event.target.value);
                                const digits = digitsOnly(masked);
                                setEpisodeDateDraft((prev) => ({ ...prev, [index]: masked }));
                                if (digits.length === 8) {
                                  const iso = displayDateToIso(masked);
                                  if (iso) {
                                    setFormState((prev) => {
                                      const next = [...prev.episodeDownloads];
                                      next[index] = { ...next[index], releaseDate: iso };
                                      return { ...prev, episodeDownloads: next };
                                    });
                                  }
                                } else if (digits.length === 0) {
                                  setFormState((prev) => {
                                    const next = [...prev.episodeDownloads];
                                    next[index] = { ...next[index], releaseDate: "" };
                                    return { ...prev, episodeDownloads: next };
                                  });
                                }
                              }}
                              onBlur={(event) => {
                                const masked = formatDateDigitsToDisplay(event.target.value);
                                const digits = digitsOnly(masked);
                                if (digits.length === 8) {
                                  const iso = displayDateToIso(masked);
                                  if (iso) {
                                    setFormState((prev) => {
                                      const next = [...prev.episodeDownloads];
                                      next[index] = { ...next[index], releaseDate: iso };
                                      return { ...prev, episodeDownloads: next };
                                    });
                                  }
                                } else if (digits.length === 0) {
                                  setFormState((prev) => {
                                    const next = [...prev.episodeDownloads];
                                    next[index] = { ...next[index], releaseDate: "" };
                                    return { ...prev, episodeDownloads: next };
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
                                value={episodeTimeDraft[index] ?? canonicalToDisplayTime(episode.duration)}
                                onChange={(event) => {
                                  const masked = formatTimeDigitsToDisplay(event.target.value);
                                  const digits = digitsOnly(masked);
                                  setEpisodeTimeDraft((prev) => ({ ...prev, [index]: masked }));
                                  const canonical = displayTimeToCanonical(masked);
                                  if (canonical) {
                                    setFormState((prev) => {
                                      const next = [...prev.episodeDownloads];
                                      next[index] = { ...next[index], duration: canonical };
                                      return { ...prev, episodeDownloads: next };
                                    });
                                  } else if (digits.length === 0) {
                                    setFormState((prev) => {
                                      const next = [...prev.episodeDownloads];
                                      next[index] = { ...next[index], duration: "" };
                                      return { ...prev, episodeDownloads: next };
                                    });
                                  }
                                }}
                                onBlur={(event) => {
                                  const masked = formatTimeDigitsToDisplay(event.target.value);
                                  const digits = digitsOnly(masked);
                                  const canonical = displayTimeToCanonical(masked);
                                  if (canonical) {
                                    setFormState((prev) => {
                                      const next = [...prev.episodeDownloads];
                                      next[index] = { ...next[index], duration: canonical };
                                      return { ...prev, episodeDownloads: next };
                                    });
                                  } else if (digits.length === 0) {
                                    setFormState((prev) => {
                                      const next = [...prev.episodeDownloads];
                                      next[index] = { ...next[index], duration: "" };
                                      return { ...prev, episodeDownloads: next };
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
                                    const next = [...prev.episodeDownloads];
                                    next[index] = {
                                      ...next[index],
                                      sourceType: value as ProjectEpisode["sourceType"],
                                    };
                                    return { ...prev, episodeDownloads: next };
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Origem" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="TV">TV</SelectItem>
                                  <SelectItem value="Web">Web</SelectItem>
                                  <SelectItem value="Blu-ray">Blu-ray</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : null}
                          </div>
                          {!episode.sources.some((source) => source.url) && !isChapterBased ? (
                            <div className="project-editor-episode-group mt-3 space-y-2">
                              <Label className="text-xs">Etapa atual</Label>
                              <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                                {currentProgressStageLabel}
                              </div>
                            </div>
                          ) : null}
                          <div className="project-editor-episode-group mt-3 space-y-2">
                            <Label className="text-xs">
                              {isChapterBased ? "Capa do capítulo" : "Capa do episódio"}
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
                                onClick={() => openLibraryForEpisodeCover(index)}
                              >
                                Biblioteca
                              </Button>
                            </div>
                          </div>
                          {isLightNovel ? (
                            <div className="project-editor-episode-group mt-4">
                              <Label className="text-xs">Conteúdo do capítulo</Label>
                        <div
                          className="mt-3"
                          onFocusCapture={(event) => {
                            const target = event.target as HTMLElement | null;
                            if (target?.closest(".lexical-playground")) {
                              return;
                            }
                            const editor = chapterEditorsRef.current[index];
                            editor?.blur?.();
                          }}
                        >
                          <EpisodeContentEditor
                            value={episode.content || ""}
                            imageLibraryOptions={episodeAssetLibraryOptions}
                            onRegister={(handlers) => {
                              chapterEditorsRef.current[index] = handlers;
                            }}
                            onChange={(nextValue) =>
                              setFormState((prev) => {
                                const next = [...prev.episodeDownloads];
                                next[index] = { ...next[index], content: nextValue };
                                return { ...prev, episodeDownloads: next };
                              })
                            }
                          />
                              </div>
                            </div>
                          ) : null}
                          {!episode.sources.some((source) => source.url) && !isChapterBased ? (
                            <div className="project-editor-episode-group mt-3">
                              <Label className="text-xs">Etapas concluídas</Label>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {stageOptions.map((stage) => {
                                  const completed = (episode.completedStages || []).includes(stage.id);
                                  return (
                                    <Button
                                      key={stage.id}
                                      type="button"
                                      size="sm"
                                      variant={completed ? "default" : "outline"}
                                      onClick={() =>
                                        setFormState((prev) => {
                                          const next = [...prev.episodeDownloads];
                                          const current = next[index].completedStages || [];
                                          next[index] = {
                                            ...next[index],
                                            completedStages: completed
                                              ? current.filter((item) => item !== stage.id)
                                              : [...current, stage.id],
                                          };
                                          return { ...prev, episodeDownloads: next };
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
                          {!isLightNovel ? (
                            <div className="project-editor-episode-group mt-3 space-y-3">
                              <div>
                                <Label className="text-xs">Arquivo do episódio</Label>
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                  <div className="space-y-1">
                                    <Input
                                      ref={(node) => {
                                        episodeSizeInputRefs.current[index] = node;
                                      }}
                                      value={
                                        episodeSizeDrafts[index] ??
                                        (episode.sizeBytes ? formatBytesCompact(episode.sizeBytes) : "")
                                      }
                                      onChange={(event) => {
                                        const nextValue = event.target.value;
                                        setEpisodeSizeDrafts((prev) => ({ ...prev, [index]: nextValue }));
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
                                        const rawValue = episodeSizeDrafts[index] ?? event.target.value;
                                        const trimmedSize = String(rawValue || "").trim();
                                        if (!trimmedSize) {
                                          setFormState((prev) => {
                                            const next = [...prev.episodeDownloads];
                                            next[index] = {
                                              ...next[index],
                                              sizeBytes: undefined,
                                            };
                                            return { ...prev, episodeDownloads: next };
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

                                        const parsedSize = parseHumanSizeToBytes(trimmedSize);
                                        if (!parsedSize) {
                                          setEpisodeSizeErrors((prev) => ({
                                            ...prev,
                                            [index]: "Use formatos como 700 MB ou 1.4 GB.",
                                          }));
                                          setEpisodeSizeDrafts((prev) => ({ ...prev, [index]: rawValue }));
                                          return;
                                        }

                                        setFormState((prev) => {
                                          const next = [...prev.episodeDownloads];
                                          next[index] = {
                                            ...next[index],
                                            sizeBytes: parsedSize,
                                          };
                                          return { ...prev, episodeDownloads: next };
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
                                      <p className="text-[11px] text-destructive">{episodeSizeErrors[index]}</p>
                                    ) : (
                                      <p className="text-[11px] text-muted-foreground">
                                        Campo opcional. Valor salvo em bytes.
                                      </p>
                                    )}
                                  </div>
                                  <Input
                                    value={episode.hash || ""}
                                    onChange={(event) =>
                                      setFormState((prev) => {
                                        const next = [...prev.episodeDownloads];
                                        next[index] = {
                                          ...next[index],
                                          hash: event.target.value,
                                        };
                                        return { ...prev, episodeDownloads: next };
                                      })
                                    }
                                    placeholder="Hash (ex.: SHA-256: ...)"
                                  />
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs">Fontes de download</Label>
                                <div className="mt-2 grid gap-2">
                                  {(episode.sources || []).map((source, sourceIndex) => (
                                    <div
                                      key={`${source.label}-${sourceIndex}`}
                                      className="rounded-xl border border-border/60 bg-background/40 p-3"
                                    >
                                      <div className="grid items-start gap-2 md:grid-cols-[minmax(180px,1fr)_minmax(240px,2fr)_auto]">
                                        <Select
                                          value={source.label}
                                          onValueChange={(value) =>
                                            setFormState((prev) => {
                                              const next = [...prev.episodeDownloads];
                                              const sources = [...(next[index].sources || [])];
                                              sources[sourceIndex] = {
                                                ...sources[sourceIndex],
                                                label: value,
                                              };
                                              next[index] = { ...next[index], sources };
                                              return { ...prev, episodeDownloads: next };
                                            })
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Fonte" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {downloadSourceOptions.map((option) => (
                                              <SelectItem key={option.label} value={option.label}>
                                                <span className="flex items-center gap-2">
                                                  {renderDownloadIcon(
                                                    option.icon,
                                                    option.color,
                                                    option.label,
                                                    option.tintIcon,
                                                  )}
                                                  <span>{option.label}</span>
                                                </span>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Input
                                          value={source.url}
                                          onChange={(event) =>
                                            setFormState((prev) => {
                                              const next = [...prev.episodeDownloads];
                                              const sources = [...(next[index].sources || [])];
                                              sources[sourceIndex] = {
                                                ...sources[sourceIndex],
                                                url: event.target.value,
                                              };
                                              next[index] = { ...next[index], sources };
                                              return { ...prev, episodeDownloads: next };
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
                                              const next = [...prev.episodeDownloads];
                                              const sources = (next[index].sources || []).filter(
                                                (_, idx) => idx !== sourceIndex,
                                              );
                                              next[index] = { ...next[index], sources };
                                              return { ...prev, episodeDownloads: next };
                                            });
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setFormState((prev) => {
                                        const next = [...prev.episodeDownloads];
                                        const existingSources = next[index].sources || [];
                                        next[index] = {
                                          ...next[index],
                                          sources: [...existingSources, { label: "", url: "" }],
                                        };
                                        return { ...prev, episodeDownloads: next };
                                      })
                                    }
                                  >
                                    Adicionar fonte
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : null}
                      </AccordionContent>
                    </CardContent>
                  </Card>
                  </AccordionItem>
                  );
                })}
              </Accordion>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <datalist id="staff-directory">
              {memberDirectory.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div className="project-editor-footer sticky bottom-0 z-20 flex justify-end gap-3 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-sm supports-backdrop-filter:bg-background/80 md:px-6 md:py-4">
            <Button variant="ghost" onClick={requestCloseEditor}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar projeto</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      >
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
              {deleteTarget ? `Excluir "${deleteTarget.title}"? Você pode restaurar por até 3 dias.` : ""}
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

      <Suspense fallback={null}>
        <ImageLibraryDialog
          open={isLibraryOpen}
          onOpenChange={setIsLibraryOpen}
          apiBase={apiBase}
          description="Envie novas imagens ou selecione uma existente para usar no projeto."
          uploadFolder={activeLibraryOptions.uploadFolder}
          listFolders={activeLibraryOptions.listFolders}
          listAll={activeLibraryOptions.listAll}
          includeProjectImages={activeLibraryOptions.includeProjectImages}
          projectImageProjectIds={activeLibraryOptions.projectImageProjectIds}
          allowDeselect
          mode="single"
          currentSelectionUrls={currentLibrarySelection ? [currentLibrarySelection] : []}
          onSave={({ urls }) => applyLibraryImage(urls[0] || "")}
        />
      </Suspense>

    </>
  );
};

export default DashboardProjectsEditor;


