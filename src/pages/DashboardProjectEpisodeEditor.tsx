import DashboardShell from "@/components/DashboardShell";
import type { ImageLibraryOptions } from "@/components/ImageLibraryDialog";
import { ImageLibraryDialogLoadingFallback } from "@/components/ImageLibraryDialogLoading";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import ProjectEditorSectionCard from "@/components/project-reader/ProjectEditorSectionCard";
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
import { toast } from "@/components/ui/use-toast";
import type { Project, ProjectEpisode } from "@/data/projects";
import { useDashboardCurrentUser } from "@/hooks/use-dashboard-current-user";
import { refetchPublicBootstrapCache } from "@/hooks/use-public-bootstrap";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  cloneEpisodeSources,
  getAnimeEpisodeCompletionIssues,
  getAnimeEpisodeCompletionLabel,
  matchesAnimeEpisodeQuickFilter,
  type AnimeEpisodeQuickFilter,
} from "@/lib/project-anime-episodes";
import { formatBytesCompact, parseHumanSizeToBytes } from "@/lib/file-size";
import {
  getEpisodeCoverAltFallback,
  resolveAssetAltText,
  DEFAULT_PROJECT_COVER_ALT,
} from "@/lib/image-alt";
import { filterImageLibraryFoldersByAccess } from "@/lib/image-library-scope";
import {
  buildDashboardProjectEditorHref,
  buildDashboardProjectEpisodeEditorHref,
  buildDashboardProjectEpisodesEditorHref,
  buildProjectPublicHref,
} from "@/lib/project-editor-routes";
import {
  buildEpisodeKey,
  findDuplicateEpisodeKey,
  resolveEpisodeLookup,
  resolveNextMainEpisodeNumber,
} from "@/lib/project-episode-key";
import {
  getProjectProgressStateForEditor,
  getProjectProgressStagesForEditor,
  syncProjectProgress,
} from "@/lib/project-progress";
import { resolveProjectImageFolders } from "@/lib/project-image-folders";
import { isChapterBasedType } from "@/lib/project-utils";
import {
  Search,
  ArrowLeft,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import NotFound from "./NotFound";

const ImageLibraryDialog = lazy(() => import("@/components/ImageLibraryDialog"));

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

type EditableAnimeEpisode = ProjectEpisode & {
  _editorKey: string;
};

type PendingEpisodeAction =
  | {
      type: "navigate";
      href: string;
    }
  | {
      type: "create";
    }
  | null;

const editorSectionClassName =
  "overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-[0_18px_52px_-42px_rgba(0,0,0,0.7)]";
const editorMastheadClassName =
  "overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-[0_18px_52px_-42px_rgba(0,0,0,0.7)]";
const editorCommandBarClassName =
  "sticky top-3 z-20 overflow-hidden rounded-2xl border border-border/60 bg-background/92 shadow-[0_18px_52px_-42px_rgba(0,0,0,0.72)] backdrop-blur supports-backdrop-filter:bg-background/78";

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const formatDateDigitsToDisplay = (value: string) => {
  const safe = digitsOnly(value).slice(0, 8);
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

const displayDateToIso = (value: string) => {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length !== 8) {
    return "";
  }
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (!day || !month || !year) {
    return "";
  }
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getDate() !== day ||
    parsed.getMonth() + 1 !== month ||
    parsed.getFullYear() !== year
  ) {
    return "";
  }
  return iso;
};

const isoToDisplayDate = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return "";
  }
  return `${trimmed.slice(8, 10)}/${trimmed.slice(5, 7)}/${trimmed.slice(0, 4)}`;
};

const formatTimeDigitsToDisplay = (value: string) => {
  const safe = digitsOnly(value).slice(0, 9);
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

const displayTimeToCanonical = (value: string) => {
  const digits = digitsOnly(value).slice(0, 9);
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
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return "";
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const canonicalToDisplayTime = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed || !/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return "";
  }
  const [hours, minutes, seconds] = trimmed.split(":");
  const normalizedHours = Number(hours || 0);
  return normalizedHours > 0
    ? `${normalizedHours}:${minutes}:${seconds}`
    : `${Number(minutes)}:${seconds}`.replace(/^0:/, "");
};

const sortEpisodes = (episodes: ProjectEpisode[]) =>
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
    if (left.number !== right.number) {
      return (left.number || 0) - (right.number || 0);
    }
    return String(left.title || "").localeCompare(String(right.title || ""), "pt-BR");
  });

const matchesEpisodeSearch = (episode: ProjectEpisode, query: string) => {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  const haystack = [
    episode.number,
    episode.title,
    episode.synopsis,
    episode.sourceType,
    ...(episode.sources || []).flatMap((source) => [source.label, source.url]),
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return haystack.includes(normalizedQuery);
};

const normalizeEpisodeForEditor = (episode: ProjectEpisode): EditableAnimeEpisode => ({
  ...episode,
  _editorKey: buildEpisodeKey(episode.number, episode.volume) || String(episode.number || ""),
  title: String(episode.title || ""),
  synopsis: String(episode.synopsis || ""),
  releaseDate: String(episode.releaseDate || ""),
  duration: String(episode.duration || ""),
  sourceType:
    episode.sourceType === "Blu-ray" || episode.sourceType === "Web" ? episode.sourceType : "TV",
  sources: cloneEpisodeSources(episode.sources),
  coverImageUrl: String(episode.coverImageUrl || ""),
  coverImageAlt: episode.coverImageUrl
    ? resolveAssetAltText(episode.coverImageAlt, getEpisodeCoverAltFallback(false))
    : "",
  publicationStatus: episode.publicationStatus === "draft" ? "draft" : "published",
  completedStages: Array.isArray(episode.completedStages) ? [...episode.completedStages] : [],
});

const normalizeEpisodeForSave = (episode: EditableAnimeEpisode): ProjectEpisode =>
  syncProjectProgress(
    {
      ...episode,
      title: String(episode.title || "").trim(),
      synopsis: String(episode.synopsis || "").trim(),
      releaseDate: String(episode.releaseDate || "").trim(),
      duration: String(episode.duration || "").trim(),
      sourceType:
        episode.sourceType === "Blu-ray" || episode.sourceType === "Web"
          ? episode.sourceType
          : "TV",
      sources: cloneEpisodeSources(episode.sources).filter(
        (source) => String(source.url || "").trim() || String(source.label || "").trim(),
      ),
      coverImageUrl: String(episode.coverImageUrl || "").trim(),
      coverImageAlt: String(episode.coverImageUrl || "").trim()
        ? resolveAssetAltText(episode.coverImageAlt, getEpisodeCoverAltFallback(false))
        : "",
      number: Math.max(1, Number(episode.number) || 1),
      publicationStatus: episode.publicationStatus === "draft" ? "draft" : "published",
      completedStages: Array.isArray(episode.completedStages) ? [...episode.completedStages] : [],
      entryKind: episode.entryKind === "extra" ? "extra" : "main",
      entrySubtype: String(episode.entrySubtype || "").trim() || undefined,
      displayLabel:
        episode.entryKind === "extra"
          ? String(episode.displayLabel || "").trim() || undefined
          : undefined,
      hash: String(episode.hash || "").trim() || undefined,
      sizeBytes: Number(episode.sizeBytes) > 0 ? Number(episode.sizeBytes) : undefined,
    },
    "anime",
  );

const buildEpisodeSnapshot = (episode: EditableAnimeEpisode | null) =>
  JSON.stringify(
    episode
      ? {
          number: Number(episode.number) || 0,
          title: String(episode.title || ""),
          synopsis: String(episode.synopsis || ""),
          releaseDate: String(episode.releaseDate || ""),
          duration: String(episode.duration || ""),
          sourceType: String(episode.sourceType || ""),
          sources: cloneEpisodeSources(episode.sources),
          coverImageUrl: String(episode.coverImageUrl || ""),
          coverImageAlt: String(episode.coverImageAlt || ""),
          hash: String(episode.hash || ""),
          sizeBytes: Number(episode.sizeBytes) || 0,
          publicationStatus: episode.publicationStatus === "draft" ? "draft" : "published",
          completedStages: Array.isArray(episode.completedStages)
            ? [...episode.completedStages]
            : [],
        }
      : null,
  );

const buildCompletionBadges = (episode: ProjectEpisode | EditableAnimeEpisode) =>
  getAnimeEpisodeCompletionIssues(episode).map((issue) => ({
    issue,
    label: getAnimeEpisodeCompletionLabel(issue),
  }));

const buildNewAnimeEpisode = (episodes: ProjectEpisode[]) =>
  syncProjectProgress(
    {
      number: resolveNextMainEpisodeNumber(episodes, {
        isExtra: (episode) => episode.entryKind === "extra",
      }),
      title: "",
      synopsis: "",
      releaseDate: "",
      duration: "",
      sourceType: "TV",
      sources: [],
      hash: undefined,
      sizeBytes: undefined,
      coverImageUrl: "",
      coverImageAlt: "",
      completedStages: [],
      content: "",
      contentFormat: "lexical",
      publicationStatus: "draft",
      entryKind: "main",
    },
    "anime",
  );

const DashboardProjectEpisodeEditor = () => {
  usePageMeta({ title: "Editor de Episodios", noIndex: true });
  const apiBase = getApiBase();
  const navigate = useNavigate();
  const { projectId, episodeNumber } = useParams<{ projectId: string; episodeNumber?: string }>();
  const { currentUser, isLoadingUser } = useDashboardCurrentUser<CurrentUser>();
  const hasLoadedCurrentUser = !isLoadingUser;
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<AnimeEpisodeQuickFilter>("all");
  const [activeDraft, setActiveDraft] = useState<EditableAnimeEpisode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [releaseDateInput, setReleaseDateInput] = useState("");
  const [durationInput, setDurationInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");
  const [sizeInputError, setSizeInputError] = useState("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingEpisodeAction>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const focusTitleOnNextOpenRef = useRef(false);

  const canManageProjects = useMemo(() => {
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    return permissions.includes("*") || permissions.includes("projetos");
  }, [currentUser]);

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
        setHasLoadError(response.status !== 404);
        return;
      }
      const data = (await response.json()) as { project?: ProjectRecord };
      setProject(data?.project || null);
    } catch {
      setProject(null);
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const isChapterBased = isChapterBasedType(project?.type || "");
  const episodes = useMemo(
    () => sortEpisodes(Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : []),
    [project?.episodeDownloads],
  );

  const activeEpisodeLookup = useMemo(() => {
    if (!episodeNumber) {
      return { ok: false as const, code: "neutral" as const };
    }
    return resolveEpisodeLookup(episodes, episodeNumber);
  }, [episodeNumber, episodes]);

  const activeEpisode =
    activeEpisodeLookup.ok && "episode" in activeEpisodeLookup ? activeEpisodeLookup.episode : null;
  const activeEpisodeKey = activeEpisode
    ? buildEpisodeKey(activeEpisode.number, activeEpisode.volume)
    : null;
  const activeEpisodeSnapshot = useMemo(
    () => buildEpisodeSnapshot(activeEpisode ? normalizeEpisodeForEditor(activeEpisode) : null),
    [activeEpisode],
  );
  const activeDraftSnapshot = useMemo(() => buildEpisodeSnapshot(activeDraft), [activeDraft]);
  const isDirty =
    Boolean(activeEpisode && activeDraft && activeEpisodeSnapshot !== activeDraftSnapshot);

  useEffect(() => {
    if (!activeEpisode) {
      setActiveDraft(null);
      setReleaseDateInput("");
      setDurationInput("");
      setSizeInput("");
      setSizeInputError("");
      return;
    }
    const nextDraft = normalizeEpisodeForEditor(activeEpisode);
    setActiveDraft((current) => {
      if (!current || !activeEpisodeKey) {
        return nextDraft;
      }
      const currentKey = buildEpisodeKey(current.number, current.volume);
      return currentKey === activeEpisodeKey && buildEpisodeSnapshot(current) !== activeEpisodeSnapshot
        ? current
        : nextDraft;
    });
  }, [activeEpisode, activeEpisodeKey, activeEpisodeSnapshot]);

  useEffect(() => {
    if (!activeDraft) {
      return;
    }
    setReleaseDateInput((current) =>
      current && isDirty ? current : isoToDisplayDate(activeDraft.releaseDate),
    );
    setDurationInput((current) =>
      current && isDirty ? current : canonicalToDisplayTime(activeDraft.duration),
    );
    setSizeInput((current) =>
      current && isDirty
        ? current
        : activeDraft.sizeBytes
          ? formatBytesCompact(activeDraft.sizeBytes)
          : "",
    );
    setSizeInputError("");
  }, [activeDraft, isDirty]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  const filteredEpisodes = useMemo(
    () =>
      episodes.filter(
        (episode) =>
          matchesEpisodeSearch(episode, searchQuery) &&
          matchesAnimeEpisodeQuickFilter(episode, filterMode),
      ),
    [episodes, filterMode, searchQuery],
  );

  const neutralHref = project
    ? buildDashboardProjectEpisodesEditorHref(project.id)
    : buildDashboardProjectEditorHref(projectId || "");
  const publicProjectHref = project ? buildProjectPublicHref(project.id) : "";
  const stageOptions = getProjectProgressStagesForEditor(project?.type || "Anime");
  const progressState = useMemo(
    () =>
      getProjectProgressStateForEditor(project?.type || "Anime", activeDraft?.completedStages),
    [activeDraft?.completedStages, project?.type],
  );
  const projectImageFolders = useMemo(
    () => resolveProjectImageFolders(project?.id || projectId || "", project?.title || ""),
    [project?.id, project?.title, projectId],
  );
  const libraryOptions = useMemo<ImageLibraryOptions>(
    () => ({
      uploadFolder: projectImageFolders.projectEpisodesFolder,
      listFolders: filterImageLibraryFoldersByAccess(
        [projectImageFolders.projectEpisodesFolder, projectImageFolders.projectRootFolder],
        {
          grants: { projetos: canManageProjects },
        },
      ),
      listAll: false,
      includeProjectImages: true,
      projectImageProjectIds: project?.id ? [project.id] : [],
      projectImagesView: "by-project",
      currentSelectionUrls:
        activeDraft?.coverImageUrl && String(activeDraft.coverImageUrl || "").trim()
          ? [activeDraft.coverImageUrl]
          : [],
    }),
    [
      activeDraft?.coverImageUrl,
      canManageProjects,
      project?.id,
      projectImageFolders.projectEpisodesFolder,
      projectImageFolders.projectRootFolder,
    ],
  );

  useEffect(() => {
    if (!activeEpisodeKey || !focusTitleOnNextOpenRef.current) {
      return;
    }
    const frameId = requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
      focusTitleOnNextOpenRef.current = false;
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [activeEpisodeKey]);

  const updateDraft = useCallback(
    (updater: (current: EditableAnimeEpisode) => EditableAnimeEpisode) => {
      setActiveDraft((current) => (current ? updater(current) : current));
    },
    [],
  );

  const persistProject = useCallback(
    async (nextProject: ProjectRecord) => {
      if (!projectId) {
        return null;
      }
      const response = await apiFetch(apiBase, `/api/projects/${projectId}`, {
        method: "PUT",
        auth: true,
        json: nextProject,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const code = typeof data?.error === "string" ? data.error : "";
        if (code === "forbidden") {
          toast({
            title: "Acesso negado",
            description: "Voce nao tem permissao para salvar episodios.",
            variant: "destructive",
          });
          return null;
        }
        toast({
          title: "Nao foi possivel salvar o episodio",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
        return null;
      }
      const data = (await response.json().catch(() => null)) as { project?: ProjectRecord } | null;
      const persistedProject = data?.project || nextProject;
      setProject(persistedProject);
      void refetchPublicBootstrapCache();
      return persistedProject;
    },
    [apiBase, projectId],
  );

  const createEpisode = useCallback(
    async (projectSnapshot?: ProjectRecord) => {
      const baseProject = projectSnapshot || project;
      if (!baseProject) {
        return false;
      }

      const baseEpisodes = sortEpisodes(
        Array.isArray(baseProject.episodeDownloads) ? baseProject.episodeDownloads : [],
      );
      const newEpisode = buildNewAnimeEpisode(baseEpisodes);

      setIsCreating(true);
      const persistedProject = await persistProject({
        ...baseProject,
        episodeDownloads: [...baseEpisodes, newEpisode],
      });
      setIsCreating(false);

      if (!persistedProject) {
        return false;
      }

      focusTitleOnNextOpenRef.current = true;
      toast({
        title: "Episodio criado",
        description: `Episodio ${newEpisode.number} adicionado ao projeto.`,
        intent: "success",
      });
      navigate(buildDashboardProjectEpisodeEditorHref(persistedProject.id, newEpisode.number));
      return true;
    },
    [navigate, persistProject, project],
  );

  const runPendingAction = useCallback(
    async (action: PendingEpisodeAction, projectSnapshot?: ProjectRecord) => {
      if (!action) {
        return false;
      }
      if (action.type === "navigate") {
        navigate(action.href);
        return true;
      }
      return createEpisode(projectSnapshot);
    },
    [createEpisode, navigate],
  );

  const requestNavigateToHref = useCallback(
    (href: string) => {
      if (!href) {
        return;
      }
      if (isDirty) {
        setPendingAction({ type: "navigate", href });
        return;
      }
      navigate(href);
    },
    [isDirty, navigate],
  );

  const saveActiveDraft = useCallback(async () => {
    if (!project || !activeDraft || !activeEpisodeKey) {
      return null;
    }
    const normalizedDraft = normalizeEpisodeForSave(activeDraft);
    const nextEpisodes = episodes.map((episode) =>
      buildEpisodeKey(episode.number, episode.volume) === activeEpisodeKey
        ? normalizedDraft
        : episode,
    );
    const duplicateEpisode = findDuplicateEpisodeKey(nextEpisodes);
    if (duplicateEpisode) {
      toast({
        title: "Episodios duplicados",
        description: "Cada episodio precisa ter um numero unico neste projeto.",
        variant: "destructive",
      });
      return null;
    }
    setIsSaving(true);
    const persistedProject = await persistProject({
      ...project,
      episodeDownloads: nextEpisodes,
    });
    setIsSaving(false);
    if (!persistedProject) {
      return null;
    }
    return {
      normalizedDraft,
      persistedProject,
    };
  }, [activeDraft, activeEpisodeKey, episodes, persistProject, project]);

  const handleSave = useCallback(async () => {
    const savedDraft = await saveActiveDraft();
    if (!savedDraft) {
      return false;
    }
    const { normalizedDraft, persistedProject } = savedDraft;
    toast({
      title: "Episodio salvo",
      description: `Episodio ${normalizedDraft.number} atualizado no projeto.`,
      intent: "success",
    });
    navigate(buildDashboardProjectEpisodeEditorHref(persistedProject.id, normalizedDraft.number), {
      replace: true,
    });
    return true;
  }, [navigate, saveActiveDraft]);

  const handleDelete = useCallback(async () => {
    if (!project || !activeEpisodeKey) {
      return;
    }
    setIsDeleting(true);
    const nextEpisodes = episodes.filter(
      (episode) => buildEpisodeKey(episode.number, episode.volume) !== activeEpisodeKey,
    );
    const persistedProject = await persistProject({
      ...project,
      episodeDownloads: nextEpisodes,
    });
    setIsDeleting(false);
    if (!persistedProject) {
      return;
    }
    setDeleteDialogOpen(false);
    toast({
      title: "Episodio removido",
      description: "O episodio foi removido do projeto.",
      intent: "success",
    });
    navigate(buildDashboardProjectEpisodesEditorHref(persistedProject.id), { replace: true });
  }, [activeEpisodeKey, episodes, navigate, persistProject, project]);

  const handleAddEpisode = useCallback(async () => {
    if (isDirty) {
      setPendingAction({ type: "create" });
      return;
    }
    await createEpisode();
  }, [createEpisode, isDirty]);

  const handleLeaveSaveAndContinue = useCallback(async () => {
    if (!pendingAction) {
      return;
    }
    const action = pendingAction;
    const savedDraft = await saveActiveDraft();
    if (!savedDraft) {
      return;
    }
    toast({
      title: "Episodio salvo",
      description: `Episodio ${savedDraft.normalizedDraft.number} atualizado no projeto.`,
      intent: "success",
    });
    setPendingAction(null);
    await runPendingAction(action, savedDraft.persistedProject);
  }, [pendingAction, runPendingAction, saveActiveDraft]);

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
          <AsyncState kind="loading" title="Carregando editor de episodios" />
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
        <DashboardPageContainer maxWidth="7xl">
          <AsyncState
            kind="error"
            title="Nao foi possivel carregar os episodios"
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
            description="Voce nao tem permissao para editar episodios."
          />
        </DashboardPageContainer>
      </DashboardShell>
    );
  }

  if (!project || isChapterBased) {
    return <NotFound />;
  }

  if (!activeEpisode && episodeNumber) {
    return <NotFound />;
  }

  const episodeNavigationPanel = (
    <section
      className={editorSectionClassName}
      data-testid={activeDraft ? undefined : "anime-episode-empty-state"}
    >
      <div className="space-y-4 px-5 py-5">
        <div className="space-y-3">
          {!activeDraft ? (
            <div className="rounded-[22px] border border-dashed border-border/60 bg-background/35 px-4 py-5">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground">Nenhum episodio aberto</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Escolha um episodio na lista ou crie um novo rascunho para comecar a edicao.
                </p>
              </div>
            </div>
          ) : null}
          <Button
            type="button"
            className="w-full justify-center"
            onClick={() => void handleAddEpisode()}
            disabled={isCreating || isSaving}
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>Adicionar episodio</span>
          </Button>
          <div className="grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar episodio..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Select
                value={filterMode}
                onValueChange={(value) => setFilterMode(value as AnimeEpisodeQuickFilter)}
              >
                <SelectTrigger className="w-full sm:max-w-[220px]">
                  <SelectValue placeholder="Filtrar" />
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
              <p className="text-[11px] font-medium tracking-[0.02em] text-muted-foreground sm:text-right">
                {filteredEpisodes.length} episodio(s) no filtro atual
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {filteredEpisodes.map((episode) => {
            const episodeHref = buildDashboardProjectEpisodeEditorHref(project.id, episode.number);
            const isActive = activeEpisodeKey === buildEpisodeKey(episode.number, episode.volume);
            return (
              <button
                key={buildEpisodeKey(episode.number, episode.volume)}
                type="button"
                onClick={() => requestNavigateToHref(episodeHref)}
                className={`w-full rounded-[18px] border px-3.5 py-3 text-left transition ${
                  isActive
                    ? "border-primary/50 bg-primary/[0.07] shadow-sm"
                    : "border-border/50 bg-background/55 hover:bg-background/78"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Episodio {episode.number}
                    </p>
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">
                      {episode.title || "Sem titulo"}
                    </p>
                  </div>
                  <Badge
                    variant={episode.publicationStatus === "draft" ? "outline" : "secondary"}
                  >
                    {episode.publicationStatus === "draft" ? "Rascunho" : "Publicado"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {episode.releaseDate ? <span>{isoToDisplayDate(episode.releaseDate)}</span> : null}
                  {episode.sources?.length ? <span>{episode.sources.length} fonte(s)</span> : null}
                  <span>{episode.sourceType}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {buildCompletionBadges(episode).map((badge) => (
                    <Badge
                      key={`${episode.number}-${badge.issue}`}
                      variant="outline"
                      className="text-[10px] uppercase tracking-[0.08em]"
                    >
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              </button>
            );
          })}
          {filteredEpisodes.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-border/60 bg-background/30 px-4 py-6 text-sm text-muted-foreground">
              Nenhum episodio corresponde aos filtros atuais.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );

  return (
    <>
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={!hasLoadedCurrentUser}
        onUserCardClick={() => requestNavigateToHref("/dashboard/usuarios?edit=me")}
      >
        <DashboardPageContainer maxWidth="editor" reveal={false}>
          <div className="space-y-4 pb-8">
            <section className={editorMastheadClassName} data-testid="anime-episode-editor-masthead">
              <div className="grid gap-5 px-4 py-5 md:px-6 md:py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:px-8">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                      Episodios de anime
                    </Badge>
                    {activeDraft
                      ? buildCompletionBadges(activeDraft).map((badge) => (
                          <Badge
                            key={badge.issue}
                            variant="outline"
                            className="text-[10px] uppercase tracking-[0.12em]"
                          >
                            {badge.label}
                          </Badge>
                        ))
                      : null}
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem]">
                      Gerenciamento de Episodios
                    </h1>
                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                      Liste, adicione e ajuste episodios sem sair do fluxo principal de publicacao.
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
                    {activeDraft
                      ? `Episodio ${activeDraft.number} - ${activeDraft.title || "Sem titulo"}`
                      : `${episodes.length} episodio(s) disponivel(is)`}
                  </p>
                </div>
              </div>
            </section>

            <div className={editorCommandBarClassName} data-testid="anime-episode-editor-command-bar">
              <div className="space-y-3 px-4 py-3 md:px-6 lg:px-8">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    {activeDraft ? (
                      <>
                        <Badge
                          variant={isDirty ? "outline" : "secondary"}
                          className="text-[10px] uppercase tracking-[0.12em]"
                        >
                          {isDirty ? "Alteracoes pendentes" : "Tudo salvo"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                          {progressState.currentStage.label}
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                        Adicione um episodio ou escolha um item na lista
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleAddEpisode()}
                      disabled={isCreating || isSaving}
                    >
                      {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      <span>Adicionar episodio</span>
                    </Button>
                    {activeDraft ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteDialogOpen(true)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Excluir</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleSave()}
                          disabled={isSaving || isCreating || !isDirty}
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          <span>Salvar episodio</span>
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-border/50 pt-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={buildDashboardProjectEditorHref(project.id)}>
                        <ArrowLeft className="h-4 w-4" />
                        <span>Voltar ao projeto</span>
                      </Link>
                    </Button>
                    {publicProjectHref ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={publicProjectHref} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          <span>Pagina publica</span>
                        </Link>
                      </Button>
                    ) : null}
                    {activeDraft ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => requestNavigateToHref(neutralHref)}
                      >
                        <span>Fechar episodio</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div
              className={
                activeDraft
                  ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start"
                  : "space-y-5"
              }
            >
              <div className="min-w-0 space-y-4">
                {activeDraft ? (
                  <>
                    <ProjectEditorSectionCard
                      title="Dados do episodio"
                      subtitle="Numero, titulo, status, origem, data, duracao e etapas editoriais."
                      eyebrow="Edicao"
                      testId="anime-episode-identity-section"
                      actions={
                        <>
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                            Episodio {activeDraft.number}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                            {activeDraft.sourceType}
                          </Badge>
                        </>
                      }
                    >
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(5,minmax(120px,0.7fr))]">
                        <div className="space-y-2">
                          <Label htmlFor="anime-episode-title">Titulo</Label>
                          <Input
                            id="anime-episode-title"
                            ref={titleInputRef}
                            value={activeDraft.title}
                            onChange={(event) =>
                              updateDraft((current) => ({ ...current, title: event.target.value }))
                            }
                            placeholder="Titulo do episodio"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="anime-episode-number">Episodio</Label>
                          <Input
                            id="anime-episode-number"
                            type="number"
                            min={1}
                            step={1}
                            value={activeDraft.number}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                number: Math.max(1, Number(event.target.value) || current.number),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="anime-episode-publication-status">Status</Label>
                          <Select
                            value={activeDraft.publicationStatus === "draft" ? "draft" : "published"}
                            onValueChange={(value) =>
                              updateDraft((current) => ({
                                ...current,
                                publicationStatus: value === "draft" ? "draft" : "published",
                              }))
                            }
                          >
                            <SelectTrigger id="anime-episode-publication-status">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Rascunho</SelectItem>
                              <SelectItem value="published">Publicado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="anime-episode-date">Release</Label>
                          <Input
                            id="anime-episode-date"
                            value={releaseDateInput}
                            onChange={(event) => {
                              const masked = formatDateDigitsToDisplay(event.target.value);
                              setReleaseDateInput(masked);
                              const isoValue = displayDateToIso(masked);
                              if (isoValue) {
                                updateDraft((current) => ({ ...current, releaseDate: isoValue }));
                              }
                              if (!digitsOnly(masked).length) {
                                updateDraft((current) => ({ ...current, releaseDate: "" }));
                              }
                            }}
                            onBlur={() => {
                              const isoValue = displayDateToIso(releaseDateInput);
                              setReleaseDateInput(isoValue ? isoToDisplayDate(isoValue) : "");
                              if (isoValue) {
                                updateDraft((current) => ({ ...current, releaseDate: isoValue }));
                              }
                            }}
                            placeholder="DD/MM/AAAA"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="anime-episode-duration">Duracao</Label>
                          <Input
                            id="anime-episode-duration"
                            value={durationInput}
                            onChange={(event) => {
                              const masked = formatTimeDigitsToDisplay(event.target.value);
                              setDurationInput(masked);
                              const canonicalValue = displayTimeToCanonical(masked);
                              if (canonicalValue) {
                                updateDraft((current) => ({
                                  ...current,
                                  duration: canonicalValue,
                                }));
                              }
                              if (!digitsOnly(masked).length) {
                                updateDraft((current) => ({ ...current, duration: "" }));
                              }
                            }}
                            onBlur={() => {
                              const canonicalValue = displayTimeToCanonical(durationInput);
                              setDurationInput(
                                canonicalValue ? canonicalToDisplayTime(canonicalValue) : "",
                              );
                              if (canonicalValue) {
                                updateDraft((current) => ({
                                  ...current,
                                  duration: canonicalValue,
                                }));
                              }
                            }}
                            placeholder="MM:SS ou H:MM:SS"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="anime-episode-synopsis">Sinopse</Label>
                        <Textarea
                          id="anime-episode-synopsis"
                          value={activeDraft.synopsis || ""}
                          onChange={(event) =>
                            updateDraft((current) => ({
                              ...current,
                              synopsis: event.target.value,
                            }))
                          }
                          rows={4}
                          placeholder="Resumo interno ou publico do episodio"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-sm">Etapas editoriais</Label>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                            {progressState.progress}%
                          </Badge>
                        </div>
                        <div
                          className="flex flex-wrap items-center gap-1.5"
                          role="list"
                          aria-label="Etapas editoriais"
                        >
                          {progressState.stages.map((stage) => {
                            const isCompleted = progressState.completedStages.includes(stage.id);
                            const isCurrentStage = stage.id === progressState.currentStageId;
                            return (
                              <span
                                key={stage.id}
                                role="listitem"
                                title={stage.label}
                                className={`block h-2.5 rounded-full ${
                                  isCompleted
                                    ? "w-6 bg-primary"
                                    : isCurrentStage
                                      ? "w-10 border border-border/60 bg-background/80"
                                      : "w-2.5 bg-muted/55"
                                }`}
                              />
                            );
                          })}
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {stageOptions.map((stage) => {
                            const isCompleted = (activeDraft.completedStages || []).includes(stage.id);
                            const isCurrentStage = stage.id === progressState.currentStageId;
                            return (
                              <label
                                key={stage.id}
                                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/35 px-3 py-2.5"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <Checkbox
                                    checked={isCompleted}
                                    onCheckedChange={() =>
                                      updateDraft((current) => {
                                        const completedStages = new Set(current.completedStages || []);
                                        if (completedStages.has(stage.id)) {
                                          completedStages.delete(stage.id);
                                        } else {
                                          completedStages.add(stage.id);
                                        }
                                        return {
                                          ...current,
                                          completedStages: stageOptions
                                            .filter((item) => completedStages.has(item.id))
                                            .map((item) => item.id),
                                        };
                                      })
                                    }
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
                                  {isCurrentStage ? <Badge variant="outline">Atual</Badge> : null}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </ProjectEditorSectionCard>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                      <ProjectEditorSectionCard
                        title="Arquivo e fontes"
                        subtitle="Metadados tecnicos do release e links de distribuicao."
                        eyebrow="Entrega"
                        testId="anime-episode-file-section"
                        actions={
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateDraft((current) => ({
                                ...current,
                                sources: [...(current.sources || []), { label: "", url: "" }],
                              }))
                            }
                          >
                            <Plus className="h-4 w-4" />
                            <span>Adicionar fonte</span>
                          </Button>
                        }
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="anime-episode-size">Tamanho</Label>
                            <Input
                              id="anime-episode-size"
                              value={sizeInput}
                              onChange={(event) => {
                                setSizeInput(event.target.value);
                                setSizeInputError("");
                              }}
                              onBlur={() => {
                                const trimmed = String(sizeInput || "").trim();
                                if (!trimmed) {
                                  updateDraft((current) => ({ ...current, sizeBytes: undefined }));
                                  setSizeInput("");
                                  setSizeInputError("");
                                  return;
                                }
                                const parsedSize = parseHumanSizeToBytes(trimmed);
                                if (!parsedSize) {
                                  setSizeInputError("Use formatos como 700 MB ou 1.4 GB.");
                                  return;
                                }
                                updateDraft((current) => ({ ...current, sizeBytes: parsedSize }));
                                setSizeInput(formatBytesCompact(parsedSize));
                                setSizeInputError("");
                              }}
                              placeholder="Ex.: 700 MB ou 1.4 GB"
                            />
                            {sizeInputError ? (
                              <p className="text-[11px] text-destructive">{sizeInputError}</p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">
                                Campo opcional salvo em bytes.
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="anime-episode-hash">Hash</Label>
                            <Input
                              id="anime-episode-hash"
                              value={activeDraft.hash || ""}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  hash: event.target.value,
                                }))
                              }
                              placeholder="Ex.: SHA-256: ..."
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Fontes de download</Label>
                          <div className="space-y-3">
                          {(activeDraft.sources || []).map((source, sourceIndex) => (
                            <div
                              key={`anime-episode-source-${sourceIndex}`}
                              className="grid gap-2 rounded-xl border border-border/60 bg-background/40 p-3"
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
                          {(activeDraft.sources || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada.</p>
                          ) : null}
                        </div>
                        </div>
                      </ProjectEditorSectionCard>

                      <ProjectEditorSectionCard
                        title="Capa do episodio"
                        subtitle="Biblioteca dedicada e texto alternativo."
                        eyebrow="Imagem"
                        testId="anime-episode-cover-section"
                        actions={
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setIsLibraryOpen(true)}
                          >
                            <ImagePlus className="h-4 w-4" />
                            <span>Biblioteca</span>
                          </Button>
                        }
                      >
                        <div className="space-y-4">
                          <div
                            className="mx-auto w-full max-w-[34rem]"
                            data-testid="anime-episode-cover-preview"
                          >
                            <div className="rounded-[26px] border border-border/60 bg-gradient-to-b from-background via-background to-muted/30 p-3 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.85)]">
                              <div className="relative aspect-video overflow-hidden rounded-[20px] border border-border/60 bg-muted/35">
                                {activeDraft.coverImageUrl ? (
                                  <>
                                    <img
                                      src={activeDraft.coverImageUrl}
                                      alt={activeDraft.coverImageAlt || DEFAULT_PROJECT_COVER_ALT}
                                      className="absolute inset-0 h-full w-full object-cover"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-3">
                                      <Badge
                                        variant="secondary"
                                        className="border border-white/15 bg-black/45 text-[10px] uppercase tracking-[0.12em] text-white"
                                      >
                                        Capa selecionada
                                      </Badge>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,_hsl(var(--background))_0%,_transparent_70%)] px-6 text-center">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-background/90 shadow-sm">
                                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-foreground">
                                        Escolha uma capa
                                      </p>
                                      <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                                        Use a biblioteca para selecionar um banner 16:9 do episodio.
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="anime-episode-cover-alt">Texto alternativo da capa</Label>
                            <Input
                              id="anime-episode-cover-alt"
                              value={activeDraft.coverImageAlt || ""}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  coverImageAlt: event.target.value,
                                }))
                              }
                              placeholder="Texto alternativo da capa"
                            />
                            <p className="text-xs leading-5 text-muted-foreground">
                              Descreva a imagem em uma frase curta para acessibilidade.
                            </p>
                          </div>
                        </div>
                      </ProjectEditorSectionCard>
                    </div>
                  </>
                ) : episodeNavigationPanel}
              </div>

              {activeDraft ? (
                <aside
                  className="min-w-0 xl:sticky xl:top-24"
                  data-testid="anime-episode-editor-sidebar"
                >
                  {episodeNavigationPanel}
                </aside>
              ) : null}
            </div>
          </div>
        </DashboardPageContainer>
      </DashboardShell>

      <Dialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
          }
        }}
      >
        <DialogContent className="max-w-lg" data-testid="anime-episode-unsaved-leave-dialog">
          <DialogHeader>
            <DialogTitle>Sair da edicao?</DialogTitle>
            <DialogDescription>
              Voce tem alteracoes nao salvas. Salve o episodio antes de continuar ou descarte as mudancas.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setPendingAction(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const action = pendingAction;
                setPendingAction(null);
                if (action) {
                  void runPendingAction(action);
                }
              }}
            >
              Descartar e continuar
            </Button>
            <Button type="button" onClick={() => void handleLeaveSaveAndContinue()} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar e continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="anime-episode-delete-dialog">
          <DialogHeader>
            <DialogTitle>Excluir episodio?</DialogTitle>
            <DialogDescription>
              Esta acao remove o episodio do snapshot atual do projeto assim que for confirmada.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Excluir episodio
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Suspense fallback={<ImageLibraryDialogLoadingFallback />}>
        <ImageLibraryDialog
          open={isLibraryOpen}
          onOpenChange={setIsLibraryOpen}
          title="Selecionar capa do episodio"
          description="Escolha a capa que representa este episodio."
          uploadFolder={libraryOptions.uploadFolder}
          listFolders={libraryOptions.listFolders}
          listAll={libraryOptions.listAll}
          includeProjectImages={libraryOptions.includeProjectImages}
          projectImageProjectIds={libraryOptions.projectImageProjectIds}
          projectImagesView={libraryOptions.projectImagesView}
          currentSelectionUrls={libraryOptions.currentSelectionUrls}
          onSelect={(urls) => {
            const nextUrl = String(urls?.[0] || "").trim();
            if (!nextUrl) {
              return;
            }
            updateDraft((current) => ({
              ...current,
              coverImageUrl: nextUrl,
              coverImageAlt: current.coverImageAlt || getEpisodeCoverAltFallback(false),
            }));
            setIsLibraryOpen(false);
          }}
        />
      </Suspense>
    </>
  );
};

export default DashboardProjectEpisodeEditor;
