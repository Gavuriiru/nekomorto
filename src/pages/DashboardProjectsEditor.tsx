import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardShell from "@/components/DashboardShell";
import ImageLibraryDialog from "@/components/ImageLibraryDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import { convertPostContent, createSlug, renderPostContent } from "@/lib/post-content";
import { getApiBase } from "@/lib/api-base";
import { usePageMeta } from "@/hooks/use-page-meta";
import PostContentEditor from "@/components/PostContentEditor";

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
  synopsis: string;
  releaseDate: string;
  duration: string;
  coverImageUrl?: string;
  sourceType: "TV" | "Web" | "Blu-ray";
  sources: DownloadSource[];
  progressStage?: string;
  completedStages?: string[];
  content?: string;
  contentFormat?: "markdown" | "html";
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
const downloadSourceOptions = ["Google Drive", "MEGA", "Torrent", "Mediafire", "Telegram", "Outro"];
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
  const isManga =
    type.toLowerCase().includes("mang") ||
    type.toLowerCase().includes("webtoon") ||
    type.toLowerCase().includes("light") ||
    type.toLowerCase().includes("novel");
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

const relationLabel = (relation?: string | null) => {
  switch (relation) {
    case "ADAPTATION":
      return "Adaptação";
    case "PREQUEL":
      return "Prequela";
    case "SEQUEL":
      return "Sequência";
    case "PARENT":
      return "Principal";
    case "SIDE_STORY":
      return "Side story";
    case "SPIN_OFF":
      return "Spin-off";
    case "SOURCE":
      return "Fonte";
    case "COMPILATION":
      return "Compilação";
    default:
      return relation || "Relacionamento";
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

const generateLocalId = () => {
  const alpha = String.fromCharCode(97 + Math.floor(Math.random() * 26));
  const random = Math.random().toString(36).slice(2, 9);
  const stamp = Date.now().toString(36).slice(-3);
  return `${alpha}${random}${stamp}`;
};

const buildImageMarkup = (url: string, alt: string, format: "markdown" | "html") => {
  if (format === "html") {
    return `\n\n<img src="${url}" alt="${alt}" loading="lazy" />\n`;
  }
  return `\n\n![${alt}](${url})\n`;
};

type EpisodeContentEditorProps = {
  value: string;
  format: "markdown" | "html";
  onChange: (value: string) => void;
  onFormatChange: (value: "markdown" | "html") => void;
  onOpenImageLibrary?: () => void;
  onRegister?: (handlers: { insertAtCursor: (text: string) => void }) => void;
};

const EpisodeContentEditor = ({
  value,
  format,
  onChange,
  onFormatChange,
  onOpenImageLibrary,
  onRegister,
}: EpisodeContentEditorProps) => {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [history, setHistory] = useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyGuard = useRef(false);

  useEffect(() => {
    setHistory([value]);
    setHistoryIndex(0);
  }, [format, value]);

  useEffect(() => {
    if (historyGuard.current) {
      historyGuard.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        if (next[next.length - 1] !== value) {
          next.push(value);
          setHistoryIndex(next.length - 1);
        }
        return next;
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [value, historyIndex]);

  const applyTextEdit = useCallback((
    next: string,
    cursorStart: number,
    cursorEnd: number,
    scrollTop: number,
  ) => {
    onChange(next);
    requestAnimationFrame(() => {
      const textarea = editorRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
      textarea.scrollTop = scrollTop;
    });
  }, [onChange]);

  const insertAtCursor = useCallback((text: string) => {
    const textarea = editorRef.current;
    if (!textarea) {
      onChange(`${value}${text}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
    applyTextEdit(next, start + text.length, start + text.length, scrollTop);
  }, [applyTextEdit, onChange, value]);

  useEffect(() => {
    if (!onRegister) {
      return;
    }
    onRegister({ insertAtCursor });
  }, [insertAtCursor, onRegister]);

  const applyWrap = (before: string, after = before) => {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    applyTextEdit(next, start + before.length, end + before.length, scrollTop);
  };

  const applyLinePrefix = (prefix: string) => {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    const selected = value.slice(start, end) || "";
    const lines = selected.split(/\r?\n/).map((line) => `${prefix}${line}`);
    const inserted = lines.join("\n");
    const next = `${value.slice(0, start)}${inserted}${value.slice(end)}`;
    applyTextEdit(next, start, start + inserted.length, scrollTop);
  };

  const applyListHtml = (type: "ul" | "ol") => {
    const textarea = editorRef.current;
    const start = textarea?.selectionStart ?? 0;
    const end = textarea?.selectionEnd ?? 0;
    const scrollTop = textarea?.scrollTop ?? 0;
    const selected = value.slice(start, end).trim();
    const lines = selected ? selected.split(/\r?\n/).filter(Boolean) : [""];
    const items = lines.map((line) => `  <li>${line.trim()}</li>`).join("\n");
    const block = `<${type}>\n${items}\n</${type}>`;
    const next = `${value.slice(0, start)}${block}${value.slice(end)}`;
    applyTextEdit(next, start, start + block.length, scrollTop);
  };

  const handleHeading = () => {
    if (format === "html") {
      applyWrap("<h1>", "</h1>");
      return;
    }
    applyLinePrefix("# ");
  };

  const handleUnorderedList = () => {
    if (format === "html") {
      applyListHtml("ul");
      return;
    }
    applyLinePrefix("- ");
  };

  const handleOrderedList = () => {
    if (format === "html") {
      applyListHtml("ol");
      return;
    }
    applyLinePrefix("1. ");
  };

  const handleAlign = (align: "left" | "center" | "right") => {
    if (format === "html") {
      applyWrap(`<div style="text-align:${align}">`, "</div>");
      return;
    }
    applyWrap(`<div style="text-align:${align}">`, "</div>");
  };

  const handleColor = (color: string, type: "text" | "background") => {
    const style = type === "background" ? `background-color:${color};` : `color:${color};`;
    applyWrap(`<span style="${style}">`, "</span>");
  };

  const handleOpenColorDialog = (type: "text" | "background") => {
    const color = window.prompt("Cor (hex ou nome)", "#ffffff");
    if (!color) {
      return;
    }
    handleColor(color, type);
  };

  const handleOpenGradientDialog = () => {
    const start = window.prompt("Cor inicial do gradiente", "#8b5cf6");
    if (!start) {
      return;
    }
    const end = window.prompt("Cor final do gradiente", "#ec4899");
    if (!end) {
      return;
    }
    applyWrap(
      `<span style="background:linear-gradient(90deg, ${start}, ${end}); -webkit-background-clip:text; color:transparent;">`,
      "</span>",
    );
  };

  const handleOpenImageDialog = () => {
    if (onOpenImageLibrary) {
      onOpenImageLibrary();
      return;
    }
    const url = window.prompt("URL da imagem");
    if (!url) {
      return;
    }
    const alt = window.prompt("Texto alternativo", "Imagem") || "Imagem";
    if (format === "html") {
      insertAtCursor(`\n<img src="${url}" alt="${alt}">\n`);
      return;
    }
    insertAtCursor(`\n![${alt}](${url})\n`);
  };

  const handleOpenLinkDialog = () => {
    const url = window.prompt("URL do link");
    if (!url) {
      return;
    }
    const text = window.prompt("Texto do link", url) || url;
    if (format === "html") {
      insertAtCursor(`<a href="${url}" target="_blank" rel="noreferrer">${text}</a>`);
      return;
    }
    insertAtCursor(`[${text}](${url})`);
  };

  const handleEmbedVideo = () => {
    const url = window.prompt("URL do vídeo (embed ou link)");
    if (!url) {
      return;
    }
    insertAtCursor(`\n\n<iframe src="${url}" title="Video" allowfullscreen></iframe>\n\n`);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) {
      return;
    }
    historyGuard.current = true;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    onChange(history[nextIndex]);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) {
      return;
    }
    historyGuard.current = true;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    onChange(history[nextIndex]);
  };

  const handleFormatChange = (next: "markdown" | "html") => {
    if (next === format) {
      return;
    }
    const converted = convertPostContent(value, format, next);
    onFormatChange(next);
    onChange(converted);
  };

  return (
    <PostContentEditor
      format={format}
      value={value}
      onFormatChange={handleFormatChange}
      onChange={onChange}
      onApplyWrap={applyWrap}
      onApplyHeading={handleHeading}
      onApplyUnorderedList={handleUnorderedList}
      onApplyOrderedList={handleOrderedList}
      onAlign={handleAlign}
      onColor={handleColor}
      onOpenColorDialog={handleOpenColorDialog}
      onOpenGradientDialog={handleOpenGradientDialog}
      onOpenImageDialog={handleOpenImageDialog}
      onOpenLinkDialog={handleOpenLinkDialog}
      onInsertCover={() => {}}
      onUndo={handleUndo}
      onRedo={handleRedo}
      onEmbedVideo={handleEmbedVideo}
      onKeyDown={() => {}}
      onDrop={() => {}}
      textareaRef={editorRef}
      previewHtml={renderPostContent(value, format)}
      showPreview
    />
  );
};

const DashboardProjectsEditor = () => {
  usePageMeta({ title: "Projetos", noIndex: true });
  const navigate = useNavigate();
  const apiBase = getApiBase();
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"order" | "alpha" | "status" | "views" | "comments" | "recent">("order");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [formState, setFormState] = useState<ProjectForm>(emptyProject);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [anilistIdInput, setAnilistIdInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [genreInput, setGenreInput] = useState("");
  const [producerInput, setProducerInput] = useState("");
  const [episodeDragId, setEpisodeDragId] = useState<number | null>(null);
  const [relationDragIndex, setRelationDragIndex] = useState<number | null>(null);
  const [staffDragIndex, setStaffDragIndex] = useState<number | null>(null);
  const [tagDragIndex, setTagDragIndex] = useState<number | null>(null);
  const [staffMemberInput, setStaffMemberInput] = useState<Record<number, string>>({});
  const [memberDirectory, setMemberDirectory] = useState<string[]>([]);
  const [collapsedEpisodes, setCollapsedEpisodes] = useState<Record<number, boolean>>({});
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<
    "chapter" | "cover" | "banner" | "hero" | "episode-cover"
  >("chapter");
  const [episodeCoverIndex, setEpisodeCoverIndex] = useState<number | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number | null>(null);
  const [activeChapterFormat, setActiveChapterFormat] = useState<"markdown" | "html">("markdown");
  const [libraryFolder, setLibraryFolder] = useState<string>("");
  const chapterEditorsRef = useRef<Record<number, { insertAtCursor: (text: string) => void }>>({});

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch(`${apiBase}/api/me`, { credentials: "include" });
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }
        const data = await response.json();
        setCurrentUser(data);
      } catch {
        setCurrentUser(null);
      }
    };

    loadUser();
  }, [apiBase]);
  const listDragId = useRef<string | null>(null);

  const isManga = useMemo(() => {
    const type = (formState.type || "").toLowerCase();
    return type.includes("mang") || type.includes("webtoon");
  }, [formState.type]);
  const isLightNovel = useMemo(() => {
    const type = (formState.type || "").toLowerCase();
    return type.includes("light") || type.includes("novel");
  }, [formState.type]);

  const isChapterBased = isManga || isLightNovel;
  const stageOptions = isChapterBased ? mangaStages : animeStages;

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

  const insertImageToChapter = (url: string, altText?: string) => {
    if (activeChapterIndex === null) {
      return;
    }
    const alt = altText || "Imagem";
    const markup = buildImageMarkup(url, alt, activeChapterFormat);
    const editor = chapterEditorsRef.current[activeChapterIndex];
    if (editor?.insertAtCursor) {
      editor.insertAtCursor(markup);
      return;
    }
    setFormState((prev) => {
      const next = [...prev.episodeDownloads];
      const target = next[activeChapterIndex];
      if (!target) {
        return prev;
      }
      next[activeChapterIndex] = {
        ...target,
        content: `${target.content || ""}${markup}`,
      };
      return { ...prev, episodeDownloads: next };
    });
  };

  const applyLibraryImage = (url: string, altText?: string) => {
    if (libraryTarget === "chapter") {
      insertImageToChapter(url, altText);
      return;
    }
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


  const openLibraryForChapter = (index: number, format: "markdown" | "html") => {
    setActiveChapterIndex(index);
    setActiveChapterFormat(format);
    const projectSlug = formState.id?.trim() || createSlug(formState.title.trim());
    setLibraryFolder(projectSlug ? `light-novel/${projectSlug}` : "light-novel");
    setLibraryTarget("chapter");
    setIsLibraryOpen(true);
  };

  const openLibraryForProjectImage = (target: "cover" | "banner" | "hero") => {
    const projectSlug = formState.id?.trim() || createSlug(formState.title.trim());
    setLibraryFolder(projectSlug ? `projects/${projectSlug}` : "projects");
    setLibraryTarget(target);
    setIsLibraryOpen(true);
  };

  const openLibraryForEpisodeCover = (index: number) => {
    const projectSlug = formState.id?.trim() || createSlug(formState.title.trim());
    setLibraryFolder(projectSlug ? `projects/${projectSlug}/episodes` : "projects/episodes");
    setEpisodeCoverIndex(index);
    setLibraryTarget("episode-cover");
    setIsLibraryOpen(true);
  };

  const loadProjects = useCallback(async () => {
    const response = await fetch(`${apiBase}/api/projects`, { credentials: "include" });
    if (!response.ok) {
      throw new Error("projects_load_failed");
    }
    const data = await response.json();
    setProjects(Array.isArray(data.projects) ? data.projects : []);
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const [projectsResult, usersResult] = await Promise.allSettled([
          loadProjects(),
          fetch(`${apiBase}/api/users`, { credentials: "include" }),
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
        }
        if (projectsResult.status === "rejected") {
          throw projectsResult.reason;
        }
      } catch {
        if (isActive) {
          setProjects([]);
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
  }, [apiBase, loadProjects]);

  useEffect(() => {
    if (!isLibraryOpen) {
      setLibraryFolder("");
      setLibraryTarget("chapter");
      setEpisodeCoverIndex(null);
    }
  }, [isLibraryOpen]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return projects;
    }
    return projects.filter((project) => {
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
  }, [projects, searchQuery]);

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
    next.sort((a, b) => a.order - b.order);
    return next;
  }, [filteredProjects, sortMode]);

  const handleListDragStart = (id: string) => {
    listDragId.current = id;
  };

  const handleListDrop = async (targetId: string) => {
    if (sortMode !== "order") {
      listDragId.current = null;
      return;
    }
    const dragId = listDragId.current;
    if (!dragId || dragId === targetId) {
      listDragId.current = null;
      return;
    }
    const ordered = [...projects];
    const fromIndex = ordered.findIndex((item) => item.id === dragId);
    const toIndex = ordered.findIndex((item) => item.id === targetId);
    if (fromIndex === -1 || toIndex === -1) {
      listDragId.current = null;
      return;
    }
    const [removed] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, removed);
    const next = ordered.map((project, index) => ({ ...project, order: index }));
    setProjects(next);
    listDragId.current = null;

    await fetch(`${apiBase}/api/projects/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ orderedIds: next.map((project) => project.id) }),
    });
  };

  const openCreate = () => {
    setEditingProject(null);
    setFormState({ ...emptyProject });
    setAnilistIdInput("");
    setCollapsedEpisodes({});
    setIsEditorOpen(true);
  };

  const openEdit = (project: ProjectRecord) => {
    const initialEpisodes = Array.isArray(project.episodeDownloads) ? project.episodeDownloads : [];
    setEditingProject(project);
    setFormState({
      id: project.id,
      anilistId: project.anilistId ?? null,
      title: project.title || "",
      titleOriginal: project.titleOriginal || "",
      titleEnglish: project.titleEnglish || "",
      synopsis: project.synopsis || "",
      description: project.description || "",
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
      score: null,
      startDate: project.startDate || "",
      endDate: project.endDate || "",
      relations: Array.isArray(project.relations) ? project.relations : [],
      staff: Array.isArray(project.staff) ? project.staff : [],
      animeStaff: Array.isArray(project.animeStaff) ? project.animeStaff : [],
      trailerUrl: project.trailerUrl || "",
      forceHero: Boolean(project.forceHero),
      heroImageUrl: project.heroImageUrl || "",
      episodeDownloads: initialEpisodes,
    });
    setAnilistIdInput(project.anilistId ? String(project.anilistId) : "");
    setCollapsedEpisodes(() => {
      const next: Record<number, boolean> = {};
      initialEpisodes.forEach((_, index) => {
        next[index] = true;
      });
      return next;
    });
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingProject(null);
  };

  const handleSave = async () => {
    const trimmedTitle = formState.title.trim();
    const baseId = formState.id.trim();
    if (!trimmedTitle) {
      return;
    }

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
      description: formState.description?.trim() || "",
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
      episodeDownloads: formState.episodeDownloads.map((episode) => {
        const key = `${episode.number}-${episode.volume || 0}`;
        const prev = prevEpisodesMap.get(key);
        const signature = [
          String(episode.title || ""),
          String(episode.synopsis || ""),
          String(episode.releaseDate || ""),
          String(episode.content || "").trim(),
        ].join("||");
        const prevSignature = [
          String(prev?.title || ""),
          String(prev?.synopsis || ""),
          String(prev?.releaseDate || ""),
          String(prev?.content || "").trim(),
        ].join("||");
        const shouldStamp =
          isLightNovel &&
          String(episode.content || "").trim().length > 0 &&
          (!prev || signature !== prevSignature);
        return {
          ...episode,
          sources: episode.sources.filter((source) => source.url || source.label),
          completedStages: episode.completedStages || [],
          progressStage: getProgressStage(formState.type || "", episode.completedStages),
          chapterUpdatedAt: shouldStamp
            ? nowIso
            : prev?.chapterUpdatedAt || episode.chapterUpdatedAt || "",
        };
      }),
    };

    const response = await fetch(
      editingProject ? `${apiBase}/api/projects/${editingProject.id}` : `${apiBase}/api/projects`,
      {
        method: editingProject ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
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
    closeEditor();
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    const response = await fetch(`${apiBase}/api/projects/${deleteTarget.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      setProjects((prev) => prev.filter((project) => project.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
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
        relation: relationLabel(relationEdges[index]?.relationType || ""),
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

    setFormState((prev) => ({
      ...prev,
      id: prev.id || String(media.id),
      anilistId: media.id,
      title: media.title?.romaji || media.title?.english || media.title?.native || prev.title,
      titleOriginal: media.title?.native || "",
      titleEnglish: media.title?.english || "",
      synopsis: stripHtml(media.description || ""),
      description: stripHtml(media.description || ""),
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
      score: null,
      startDate,
      endDate,
      relations: relations.length ? relations : prev.relations,
      animeStaff: staff.length ? staff : prev.animeStaff,
      trailerUrl: trailerUrl || prev.trailerUrl,
    }));

    const syncTags = tagsFromMedia.length ? tagsFromMedia : tags;
    const syncGenres = genresFromMedia;
    if (syncTags.length || syncGenres.length) {
      fetch(`${apiBase}/api/tag-translations/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tags: syncTags, genres: syncGenres }),
      }).catch(() => undefined);
    }
  };

  const handleImportAniList = async () => {
    const id = Number(anilistIdInput);
    if (!Number.isFinite(id)) {
      return;
    }
    const response = await fetch(`${apiBase}/api/anilist/${id}`, { credentials: "include" });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    const media = data?.data?.Media as AniListMedia | undefined;
    if (!media) {
      return;
    }
    mapAniListToForm(media);
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

  const handleTagDrop = (targetIndex: number) => {
    if (tagDragIndex === null || tagDragIndex === targetIndex) {
      setTagDragIndex(null);
      return;
    }
    setFormState((prev) => {
      const next = [...prev.tags];
      const [removed] = next.splice(tagDragIndex, 1);
      next.splice(targetIndex, 0, removed);
      return { ...prev, tags: next };
    });
    setTagDragIndex(null);
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

  return (
    <>
      <DashboardShell
        currentUser={currentUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
          <main className="pt-24 px-6 pb-20 md:px-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge variant="secondary" className="text-xs uppercase tracking-widest">
                  Projetos
                </Badge>
                <h1 className="mt-4 text-3xl font-semibold text-foreground">Gerenciar projetos</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Crie, edite e organize os projetos visíveis no site.
                </p>
              </div>
              <Button className="gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Novo projeto
              </Button>
            </div>

            <section className="mt-10 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                      <SelectItem value="order">Ordem manual</SelectItem>
                      <SelectItem value="recent">Mais recentes</SelectItem>
                      <SelectItem value="alpha">Ordem alfabética</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="views">Visualizações</SelectItem>
                      <SelectItem value="comments">Comentários</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="secondary" className="text-xs uppercase">
                  {sortedProjects.length} projetos
                </Badge>
              </div>

              {isLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
                  Carregando projetos...
                </div>
              ) : sortedProjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
                  Nenhum projeto encontrado.
                </div>
              ) : (
                <div className="grid gap-6">
                  {sortedProjects.map((project) => (
                    <Card
                      key={project.id}
                      className="group cursor-pointer overflow-hidden border-border/60 bg-card/80 shadow-lg transition hover:border-primary/40"
                      draggable={sortMode === "order"}
                      onDragStart={() => handleListDragStart(project.id)}
                      onDragOver={(event) => {
                        if (sortMode === "order") {
                          event.preventDefault();
                        }
                      }}
                      onDrop={() => handleListDrop(project.id)}
                      onClick={() => openEdit(project)}
                    >
                      <CardContent className="p-0">
                        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                        <div className="relative aspect-[2/3] w-full">
                            <img
                              src={project.cover || "/placeholder.svg"}
                              alt={project.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            {project.tags[0] ? (
                              <Badge className="absolute right-3 top-3 text-[10px] uppercase bg-background/85 text-foreground">
                                {project.tags[0]}
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
                                {project.tags.slice(0, 4).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-[10px] uppercase">
                                    {tag}
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
            </section>
          </main>
      </DashboardShell>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Editar projeto" : "Novo projeto"}</DialogTitle>
            <DialogDescription>
              Busque no AniList para preencher automaticamente ou edite tudo manualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
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
            </div>

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
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Imagem do carrossel</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-3 py-2">
                    {formState.heroImageUrl ? (
                      <img
                        src={formState.heroImageUrl}
                        alt="Imagem do carrossel"
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border/60 text-[10px] text-muted-foreground">
                        Sem imagem
                      </div>
                    )}
                    <span className="max-w-[260px] truncate text-xs text-muted-foreground">
                      {formState.heroImageUrl || "Usa o banner se vazio."}
                    </span>
                  </div>
                  <Button type="button" variant="outline" onClick={() => openLibraryForProjectImage("hero")}>
                    Biblioteca
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Capa</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-3 py-2">
                    {formState.cover ? (
                      <img src={formState.cover} alt="Capa" className="h-14 w-14 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border/60 text-[10px] text-muted-foreground">
                        Sem imagem
                      </div>
                    )}
                    <span className="max-w-[260px] truncate text-xs text-muted-foreground">
                      {formState.cover || "Sem capa definida."}
                    </span>
                  </div>
                  <Button type="button" variant="outline" onClick={() => openLibraryForProjectImage("cover")}>
                    Biblioteca
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Banner</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-3 py-2">
                    {formState.banner ? (
                      <img src={formState.banner} alt="Banner" className="h-14 w-14 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border/60 text-[10px] text-muted-foreground">
                        Sem imagem
                      </div>
                    )}
                    <span className="max-w-[260px] truncate text-xs text-muted-foreground">
                      {formState.banner || "Sem banner definido."}
                    </span>
                  </div>
                  <Button type="button" variant="outline" onClick={() => openLibraryForProjectImage("banner")}>
                    Biblioteca
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Sinopse</Label>
                <Textarea
                  value={formState.synopsis}
                  onChange={(event) => setFormState((prev) => ({ ...prev, synopsis: event.target.value }))}
                  rows={4}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descrição completa</Label>
                <Textarea
                  value={formState.description}
                  onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                  rows={5}
                />
              </div>
            </div>

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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    placeholder="Adicionar tag"
                  />
                  <Button type="button" variant="outline" onClick={handleAddTag}>
                    Adicionar
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {formState.tags.map((tag, index) => (
                    <Badge
                      key={`${tag}-${index}`}
                      variant="secondary"
                      draggable
                      onDragStart={() => setTagDragIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleTagDrop(index)}
                      className="cursor-move"
                    >
                      {tag}
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
                    placeholder="Adicionar gênero"
                  />
                  <Button type="button" variant="outline" onClick={handleAddGenre}>
                    Adicionar
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {formState.genres.map((genre, index) => (
                    <Badge key={`${genre}-${index}`} variant="secondary">
                      {genre}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Relações</Label>
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
                    className="grid gap-2 rounded-2xl border border-border/60 bg-card/60 p-3 md:grid-cols-[1.2fr_1fr_1fr_auto]"
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Equipe da fansub</Label>
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
                      <Input
                        value={role.role}
                        onChange={(event) =>
                          setFormState((prev) => {
                            const next = [...prev.staff];
                            next[index] = { ...next[index], role: event.target.value };
                            return { ...prev, staff: next };
                          })
                        }
                        placeholder="Função"
                      />
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

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">{isChapterBased ? "Capítulos" : "Episódios"}</Label>
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
                        synopsis: "",
                        releaseDate: "",
                        duration: "",
                        coverImageUrl: "",
                        sourceType: "TV",
                        sources: [],
                        progressStage: "aguardando-raw",
                        completedStages: [],
                        content: "",
                        contentFormat: "markdown",
                      };
                      const next = [...prev.episodeDownloads, newEpisode];
                      return { ...prev, episodeDownloads: next };
                    })
                  }
                >
                  {isChapterBased ? "Adicionar capítulo" : "Adicionar episódio"}
                </Button>
              </div>
              <div className="grid gap-4">
                {sortedEpisodeDownloads.map(({ episode, index }) => (
                  <Card
                    key={`${episode.number}-${index}`}
                    className="border-border/60 bg-card/70"
                    draggable
                    onDragStart={() => setEpisodeDragId(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleEpisodeDrop(index)}
                  >
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-xs">
                            {isChapterBased ? "Cap" : "Ep"} {episode.number || index + 1}
                          </span>
                          {episode.title ? (
                            <span className="font-medium text-foreground">{episode.title}</span>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setCollapsedEpisodes((prev) => ({
                              ...prev,
                              [index]: !prev[index],
                            }))
                          }
                        >
                          {collapsedEpisodes[index] ? "Expandir" : "Colapsar"}
                        </Button>
                      </div>
                      {collapsedEpisodes[index] ? (
                        <div className="grid gap-1 text-xs text-muted-foreground md:grid-cols-[auto_minmax(0,1fr)_auto]">
                          {episode.releaseDate ? (
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5 leading-none">
                                {episode.releaseDate}
                              </span>
                            </div>
                          ) : null}
                          <span className="line-clamp-1 text-foreground/70 leading-none">
                            {episode.synopsis || "Sem sinopse"}
                          </span>
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {isLightNovel && String(episode.content || "").trim().length > 0 ? (
                              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary leading-none">
                                Contedo
                              </span>
                            ) : null}
                            {!isChapterBased && !episode.sources.some((source) => source.url) ? (
                              <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5 leading-none">
                                {stageOptions.find(
                                  (stage) =>
                                    stage.id ===
                                    getProgressStage(formState.type || "", episode.completedStages),
                                )?.label || "Aguardando Raw"}
                              </span>
                            ) : null}
                            {episode.sources.some((source) => source.url) ? (
                              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-400 leading-none">
                                Download
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 md:grid-cols-6">
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
                              placeholder="Nmero"
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
                              value={episode.releaseDate}
                              onChange={(event) =>
                                setFormState((prev) => {
                                  const next = [...prev.episodeDownloads];
                                  next[index] = { ...next[index], releaseDate: event.target.value };
                                  return { ...prev, episodeDownloads: next };
                                })
                              }
                              placeholder="Data"
                            />
                            {!isChapterBased ? (
                              <Input
                                value={episode.duration}
                                onChange={(event) =>
                                  setFormState((prev) => {
                                    const next = [...prev.episodeDownloads];
                                    next[index] = { ...next[index], duration: event.target.value };
                                    return { ...prev, episodeDownloads: next };
                                  })
                                }
                                placeholder="Duração"
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
                          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
                            <Textarea
                              value={episode.synopsis}
                              onChange={(event) =>
                                setFormState((prev) => {
                                  const next = [...prev.episodeDownloads];
                                  next[index] = { ...next[index], synopsis: event.target.value };
                                  return { ...prev, episodeDownloads: next };
                                })
                              }
                              placeholder={isChapterBased ? "Sinopse do capítulo" : "Sinopse do episódio"}
                              rows={2}
                            />
                            {!episode.sources.some((source) => source.url) && !isChapterBased ? (
                              <div className="space-y-2">
                                <Label className="text-xs">Etapa atual</Label>
                                <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                                  {stageOptions.find((stage) =>
                                    stage.id ===
                                    getProgressStage(formState.type || "", episode.completedStages),
                                  )?.label || "Aguardando Raw"}
                                </div>
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-3 space-y-2">
                            <Label className="text-xs">
                              {isChapterBased ? "Capa do capitulo" : "Capa do episodio"}
                            </Label>
                            <div className="flex flex-wrap items-center gap-3">
                              {episode.coverImageUrl ? (
                                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-3 py-2">
                                  <img
                                    src={episode.coverImageUrl}
                                    alt={episode.title || "Capa"}
                                    className="h-12 w-12 rounded-lg object-cover"
                                  />
                                  <span className="max-w-[240px] truncate text-xs text-muted-foreground">
                                    {episode.coverImageUrl}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border/60 text-[10px] text-muted-foreground">
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
                            <div className="mt-4">
                              <Label className="text-xs">Contedo do captulo</Label>
                              <div className="mt-3">
                                <EpisodeContentEditor
                                  value={episode.content || ""}
                                  format={episode.contentFormat || "markdown"}
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
                                  onFormatChange={(nextFormat) =>
                                    setFormState((prev) => {
                                      const next = [...prev.episodeDownloads];
                                      next[index] = { ...next[index], contentFormat: nextFormat };
                                      return { ...prev, episodeDownloads: next };
                                    })
                                  }
                                  onOpenImageLibrary={() =>
                                    openLibraryForChapter(index, episode.contentFormat || "markdown")
                                  }
                                />
                              </div>
                            </div>
                          ) : null}
                          {!episode.sources.some((source) => source.url) && !isChapterBased ? (
                            <div className="mt-3">
                              <Label className="text-xs">Etapas concludas</Label>
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
                            <div className="mt-3">
                              <Label className="text-xs">Fontes de download</Label>
                              <div className="mt-2 grid gap-2">
                                {episode.sources.map((source, sourceIndex) => (
                                  <div
                                    key={`${source.label}-${sourceIndex}`}
                                    className="grid gap-2 md:grid-cols-[1fr_2fr_auto]"
                                  >
                                    <Select
                                      value={source.label}
                                      onValueChange={(value) =>
                                        setFormState((prev) => {
                                          const next = [...prev.episodeDownloads];
                                          const sources = [...next[index].sources];
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
                                          <SelectItem key={option} value={option}>
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      value={source.url}
                                      onChange={(event) =>
                                        setFormState((prev) => {
                                          const next = [...prev.episodeDownloads];
                                          const sources = [...next[index].sources];
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
                                      onClick={() =>
                                        setFormState((prev) => {
                                          const next = [...prev.episodeDownloads];
                                          const sources = next[index].sources.filter((_, idx) => idx !== sourceIndex);
                                          next[index] = { ...next[index], sources };
                                          return { ...prev, episodeDownloads: next };
                                        })
                                      }
                                    >
                                      Remover
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setFormState((prev) => {
                                      const next = [...prev.episodeDownloads];
                                      next[index] = {
                                        ...next[index],
                                        sources: [...next[index].sources, { label: "", url: "" }],
                                      };
                                      return { ...prev, episodeDownloads: next };
                                    })
                                  }
                                >
                                  Adicionar fonte
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setFormState((prev) => ({
                              ...prev,
                              episodeDownloads: prev.episodeDownloads.filter((_, idx) => idx !== index),
                            }))
                          }
                        >
                          {isChapterBased ? "Remover capítulo" : "Remover episódio"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <datalist id="staff-directory">
              {memberDirectory.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={closeEditor}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar projeto</Button>
            </div>
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
              {deleteTarget ? `Excluir "${deleteTarget.title}"? Esta ação não pode ser desfeita.` : ""}
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

      <ImageLibraryDialog
        open={isLibraryOpen}
        onOpenChange={setIsLibraryOpen}
        apiBase={apiBase}
        description={
          libraryTarget === "chapter"
            ? "Envie novas imagens ou selecione uma existente para inserir no capitulo."
            : "Envie novas imagens ou selecione uma existente para usar no projeto."
        }
        uploadFolder={libraryFolder || undefined}
        listFolders={[""]}
        showAltInput={libraryTarget === "chapter"}
        allowDeselect={libraryTarget !== "chapter"}
        currentSelectionUrl={currentLibrarySelection || undefined}
        onSelect={(url, altText) => applyLibraryImage(url, altText)}
      />

    </>
  );
};

export default DashboardProjectsEditor;


