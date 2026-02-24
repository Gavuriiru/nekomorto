import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";
import DashboardShell from "@/components/DashboardShell";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import { dashboardPageLayoutTokens } from "@/components/dashboard/dashboard-page-tokens";
import AsyncState from "@/components/ui/async-state";
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
import { toast } from "@/components/ui/use-toast";
import {
  Copy,
  Edit3,
  Eye,
  MessageSquare,
  Plus,
  Trash2,
  X,
  UserRound,
} from "lucide-react";
import { createSlug, getLexicalText } from "@/lib/post-content";
import { getImageFileNameFromUrl, resolvePostCoverPreview } from "@/lib/post-cover";
import type { LexicalEditorHandle } from "@/components/lexical/LexicalEditor";
import type { Project } from "@/data/projects";
import ProjectEmbedCard from "@/components/ProjectEmbedCard";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { applyBeforeUnloadCompatibility } from "@/lib/before-unload";
import { formatDateTimeShort } from "@/lib/date";
import { buildTranslationMap, sortByTranslatedLabel, translateTag } from "@/lib/project-taxonomy";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useEditorScrollLock } from "@/hooks/use-editor-scroll-lock";
import { useEditorScrollStability } from "@/hooks/use-editor-scroll-stability";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { normalizeAssetUrl } from "@/lib/asset-url";
import {
  MuiBrazilDateField,
  MuiBrazilTimeField,
  MuiDateTimeFieldsProvider,
} from "@/components/ui/mui-date-time-fields";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const DASHBOARD_POSTS_LIST_STATE_KEY = "dashboard.posts";

const emptyForm = {
  title: "",
  slug: "",
  excerpt: "",
  contentLexical: "",
  author: "",
  coverImageUrl: "",
  coverAlt: "",
  status: "draft" as "draft" | "scheduled" | "published",
  publishAt: "",
  projectId: "",
  tags: [] as string[],
};

const pad = (value: number) => String(value).padStart(2, "0");

const toLocalDateTimeValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;

const parseLocalDateTimeValue = (value: string) => {
  const [datePart, timePart] = value.split("T");
  if (!datePart) {
    return { date: null as Date | null, time: "" };
  }
  const [year, month, day] = datePart.split("-").map((chunk) => Number(chunk));
  if (!year || !month || !day) {
    return { date: null as Date | null, time: "" };
  }
  return {
    date: new Date(year, month - 1, day),
    time: timePart || "",
  };
};

const toLocalDateTimeFromIso = (value?: string | null) =>
  value ? toLocalDateTimeValue(new Date(value)) : "";

const toTimeFieldValue = (time: string, fallback = "12:00") => {
  const [hoursPart, minutesPart] = (time || fallback).split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  const next = new Date();
  next.setHours(Number.isFinite(hours) ? hours : 12, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return next;
};

const buildPostEditorSnapshot = (form: typeof emptyForm) =>
  JSON.stringify({
    title: form.title,
    slug: form.slug,
    excerpt: form.excerpt,
    contentLexical: form.contentLexical,
    author: form.author,
    coverImageUrl: form.coverImageUrl,
    coverAlt: form.coverAlt,
    status: form.status,
    publishAt: form.publishAt,
    projectId: form.projectId,
    tags: form.tags,
  });

const parsePageParam = (value: string | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
};

const parseSortParam = (
  value: string | null,
): "recent" | "alpha" | "tags" | "projects" | "status" | "views" | "comments" => {
  if (
    value === "alpha" ||
    value === "tags" ||
    value === "projects" ||
    value === "status" ||
    value === "views" ||
    value === "comments" ||
    value === "recent"
  ) {
    return value;
  }
  return "recent";
};

const hasPostsSearchQueryState = (params: URLSearchParams) =>
  Boolean(params.get("sort") || params.get("q") || params.get("project") || params.get("page"));

const normalizeComparableCoverUrl = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("/uploads/")) {
    return trimmed.split(/[?#]/)[0] || trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // Keep non-URL values as-is.
  }
  return trimmed;
};

const areCoverUrlsEquivalent = (left?: string | null, right?: string | null) =>
  normalizeComparableCoverUrl(left) === normalizeComparableCoverUrl(right);

const extractLexicalImageUploadUrls = (content?: string | null) => {
  const raw = String(content || "").trim();
  if (!raw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const urls: string[] = [];
  const seen = new Set<string>();
  const visit = (node: unknown) => {
    if (!node) {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== "object") {
      return;
    }
    const lexicalNode = node as Record<string, unknown>;
    const type = typeof lexicalNode.type === "string" ? lexicalNode.type.toLowerCase() : "";
    if (type === "image") {
      const src = typeof lexicalNode.src === "string" ? lexicalNode.src : "";
      const normalized = normalizeComparableCoverUrl(src);
      if (normalized.startsWith("/uploads/") && !seen.has(normalized)) {
        seen.add(normalized);
        urls.push(normalized);
      }
    }
    if (Array.isArray(lexicalNode.children)) {
      lexicalNode.children.forEach(visit);
    }
    Object.entries(lexicalNode).forEach(([key, value]) => {
      if (key === "children" || key === "src" || key === "altText" || key === "type") {
        return;
      }
      visit(value);
    });
  };
  const root = (parsed as { root?: unknown })?.root;
  visit(root ?? parsed);
  return urls;
};

type PostRecord = {
  id: string;
  title: string;
  slug: string;
  coverImageUrl?: string | null;
  coverAlt?: string | null;
  excerpt: string;
  content: string;
  contentFormat?: "lexical";
  author: string;
  publishedAt: string;
  scheduledAt?: string | null;
  status: "draft" | "scheduled" | "published";
  seoTitle?: string | null;
  seoDescription?: string | null;
  projectId?: string | null;
  tags?: string[];
  views: number;
  commentsCount: number;
  deletedAt?: string | null;
  deletedBy?: string | null;
};

type UserRecord = {
  id: string;
  permissions: string[];
};

const LexicalEditor = lazy(() => import("@/components/lexical/LexicalEditor"));
const ImageLibraryDialog = lazy(() => import("@/components/ImageLibraryDialog"));

const LexicalEditorFallback = () => (
  <div className="min-h-[460px] w-full rounded-2xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
    Carregando editor...
  </div>
);

const getPostStatusLabel = (status: PostRecord["status"]): string => {
  if (status === "published") {
    return "Publicado";
  }
  if (status === "scheduled") {
    return "Agendado";
  }
  return "Rascunho";
};

const DashboardPosts = () => {
  usePageMeta({ title: "Posts", noIndex: true });
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [searchParams, setSearchParams] = useSearchParams();
  const apiBase = getApiBase();
  const restoreWindowMs = 3 * 24 * 60 * 60 * 1000;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  useEditorScrollLock(isEditorOpen);
  useEditorScrollStability(isEditorOpen);
  const [isEditorDialogScrolled, setIsEditorDialogScrolled] = useState(false);
  const [editingPost, setEditingPost] = useState<PostRecord | null>(null);
  const [formState, setFormState] = useState(emptyForm);
  const [isSlugCustom, setIsSlugCustom] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"recent" | "alpha" | "tags" | "projects" | "status" | "views" | "comments">(() =>
    parseSortParam(searchParams.get("sort")),
  );
  const [currentPage, setCurrentPage] = useState(() => parsePageParam(searchParams.get("page")));
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [projectFilterId, setProjectFilterId] = useState<string>(() => searchParams.get("project") || "all");
  const [projectFilterQuery, setProjectFilterQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PostRecord | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>({});
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const [tagOrder, setTagOrder] = useState<string[]>([]);
  const [draggedTag, setDraggedTag] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("Sair da edição?");
  const [confirmDescription, setConfirmDescription] = useState(
    "Você tem alterações não salvas. Deseja continuar?",
  );
  const confirmActionRef = useRef<(() => void) | null>(null);
  const confirmCancelRef = useRef<(() => void) | null>(null);
  const editorRef = useRef<LexicalEditorHandle | null>(null);
  const editorInitialSnapshotRef = useRef<string>(buildPostEditorSnapshot(emptyForm));
  const autoEditHandledRef = useRef<string | null>(null);
  const isApplyingSearchParamsRef = useRef(false);
  const queryStateRef = useRef({
    sortMode,
    searchQuery,
    projectFilterId,
    currentPage,
  });
  const hasRestoredListStateRef = useRef(false);
  const {
    hasLoaded: hasLoadedUserPreferences,
    getUiListState,
    setUiListState,
  } = useUserPreferences();

  const currentUserRecord = currentUser
    ? users.find((user) => user.id === currentUser.id) || null
    : null;
  const canManagePosts = useMemo(() => {
    if (!currentUser) {
      return false;
    }
    if (ownerIds.includes(currentUser.id)) {
      return true;
    }
    const permissions = currentUserRecord?.permissions || [];
    return permissions.includes("*") || permissions.includes("posts");
  }, [currentUser, currentUserRecord, ownerIds]);

  const isDirty = useMemo(
    () => buildPostEditorSnapshot(formState) !== editorInitialSnapshotRef.current,
    [formState],
  );
  const editorResolvedCover = useMemo(
    () =>
      resolvePostCoverPreview({
        coverImageUrl: formState.coverImageUrl,
        coverAlt: formState.coverAlt,
        content: formState.contentLexical,
        contentFormat: "lexical",
        title: formState.title,
      }),
    [formState.contentLexical, formState.coverAlt, formState.coverImageUrl, formState.title],
  );
  const editorCoverFileName = useMemo(
    () => getImageFileNameFromUrl(editorResolvedCover.coverImageUrl),
    [editorResolvedCover.coverImageUrl],
  );

  const allowPopRef = useRef(false);
  const hasPushedBlockRef = useRef(false);

  useEffect(() => {
    if (!isSlugCustom) {
      setFormState((prev) => ({ ...prev, slug: createSlug(prev.title) }));
    }
  }, [formState.title, isSlugCustom]);

  useEffect(() => {
    if (!isEditorOpen) {
      setIsEditorDialogScrolled(false);
    }
  }, [isEditorOpen]);

  const loadPosts = async () => {
    const response = await apiFetch(apiBase, "/api/posts", { auth: true });
    if (!response.ok) {
      throw new Error("posts_load_failed");
    }
    const data = await response.json();
    const nextPosts = Array.isArray(data.posts) ? data.posts : [];
    setPosts(nextPosts);
  };

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      if (isActive) {
        setIsLoading(true);
        setHasLoadError(false);
      }
      try {
        let failed = false;
        const [postsRes, usersRes, meRes, projectsRes, tagsRes] = await Promise.all([
          apiFetch(apiBase, "/api/posts", { auth: true }),
          apiFetch(apiBase, "/api/users", { auth: true }),
          apiFetch(apiBase, "/api/me", { auth: true }),
          apiFetch(apiBase, "/api/projects", { auth: true }),
          apiFetch(apiBase, "/api/public/tag-translations", { cache: "no-store" }),
        ]);

        if (postsRes.ok) {
          const data = await postsRes.json();
          if (isActive) {
            const nextPosts = Array.isArray(data.posts) ? data.posts : [];
            setPosts(nextPosts);
          }
        } else {
          failed = true;
          if (isActive) {
            setPosts([]);
          }
        }

        if (usersRes.ok) {
          const data = await usersRes.json();
          if (isActive) {
            setUsers(Array.isArray(data.users) ? data.users : []);
            setOwnerIds(Array.isArray(data.ownerIds) ? data.ownerIds : []);
          }
        } else {
          failed = true;
          if (isActive) {
            setUsers([]);
            setOwnerIds([]);
          }
        }

        if (meRes.ok) {
          const data = await meRes.json();
          if (isActive) {
            setCurrentUser(data);
          }
        } else {
          failed = true;
          if (isActive) {
            setCurrentUser(null);
          }
        }

        if (projectsRes.ok) {
          const data = await projectsRes.json();
          if (isActive) {
            setProjects(Array.isArray(data.projects) ? data.projects : []);
          }
        } else if (isActive) {
          setProjects([]);
        }

        if (tagsRes.ok) {
          const data = await tagsRes.json();
          if (isActive) {
            setTagTranslations(data.tags || {});
          }
        } else if (isActive) {
          setTagTranslations({});
        }
        if (isActive) {
          setHasLoadError(failed);
        }
      } catch {
        if (isActive) {
          setPosts([]);
          setUsers([]);
          setOwnerIds([]);
          setCurrentUser(null);
          setProjects([]);
          setTagTranslations({});
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
  }, [apiBase, loadVersion]);

  useEffect(() => {
    if (!isEditorOpen || !isDirty) {
      return;
    }
    const handler = (event: BeforeUnloadEvent) => {
      applyBeforeUnloadCompatibility(event);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isEditorOpen, isDirty]);

  useEffect(() => {
    if (!isEditorOpen || !isDirty) {
      return;
    }
    if (!hasPushedBlockRef.current) {
      window.history.pushState(null, document.title, window.location.href);
      hasPushedBlockRef.current = true;
    }
    const handlePopState = () => {
      if (allowPopRef.current) {
        allowPopRef.current = false;
        return;
      }
      window.history.pushState(null, document.title, window.location.href);
      setConfirmTitle("Sair da edição?");
      setConfirmDescription("Você tem alterações não salvas. Deseja continuar?");
      confirmActionRef.current = () => {
        allowPopRef.current = true;
        closeEditor();
        navigate(-1);
      };
      confirmCancelRef.current = () => {
        allowPopRef.current = false;
      };
      setConfirmOpen(true);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      hasPushedBlockRef.current = false;
    };
  }, [isEditorOpen, isDirty, navigate]);

  useEffect(() => {
    if (!isEditorOpen || !isDirty) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.getAttribute("target") === "_blank") {
        return;
      }
      event.preventDefault();
      setConfirmTitle("Sair da edição?");
      setConfirmDescription("Você tem alterações não salvas. Deseja continuar?");
      confirmActionRef.current = () => {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin === window.location.origin) {
          navigate(`${url.pathname}${url.search}${url.hash}`);
        } else {
          window.location.href = url.href;
        }
      };
      confirmCancelRef.current = () => {
        setConfirmOpen(false);
      };
      setConfirmOpen(true);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isEditorOpen, isDirty, navigate]);

  const openCreate = () => {
    const nextForm = {
      ...emptyForm,
      author: currentUser?.name || "",
      publishAt: toLocalDateTimeValue(new Date()),
    };
    if (isEditorOpen && isDirty) {
      setConfirmTitle("Criar nova postagem?");
      setConfirmDescription("Há alterações não salvas. Deseja descartar e criar uma nova postagem?");
      confirmActionRef.current = () => {
        setEditingPost(null);
        setIsSlugCustom(false);
        setFormState(nextForm);
        editorInitialSnapshotRef.current = buildPostEditorSnapshot(nextForm);
        setIsEditorOpen(true);
      };
      confirmCancelRef.current = null;
      setConfirmOpen(true);
      return;
    }
    setEditingPost(null);
    setIsSlugCustom(false);
    setFormState(nextForm);
    editorInitialSnapshotRef.current = buildPostEditorSnapshot(nextForm);
    setIsEditorOpen(true);
  };

  const openEdit = useCallback((post: PostRecord) => {
    const nextForm = {
      title: post.title || "",
      slug: post.slug || "",
      excerpt: post.excerpt || "",
      contentLexical: post.content || "",
      author: post.author || "",
      coverImageUrl: post.coverImageUrl || "",
      coverAlt: post.coverAlt || "",
      status: post.status || "draft",
      publishAt: toLocalDateTimeFromIso(post.publishedAt),
      projectId: post.projectId || "",
      tags: Array.isArray(post.tags) ? post.tags : [],
    };
    setEditingPost(post);
    setIsSlugCustom(true);
    setFormState(nextForm);
    editorInitialSnapshotRef.current = buildPostEditorSnapshot(nextForm);
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
    if (isLoading) {
      return;
    }
    autoEditHandledRef.current = editTarget;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("edit");
    const target = canManagePosts
      ? posts.find((post) => post.id === editTarget || post.slug === editTarget) || null
      : null;
    if (target) {
      openEdit(target);
    }
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [canManagePosts, isLoading, openEdit, posts, searchParams, setSearchParams]);

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingPost(null);
  };

  const requestCloseEditor = () => {
    if (!isEditorOpen || !isDirty) {
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

  const handleEditorOpenChange = (next: boolean) => {
    if (!next && isLibraryOpen) {
      return;
    }
    if (!next) {
      requestCloseEditor();
      return;
    }
    setIsEditorOpen(true);
  };

  const handleRouteNavigate = (href: string) => {
    if (!isEditorOpen || !isDirty) {
      navigate(href);
      return;
    }
    setConfirmTitle("Sair da edição?");
    setConfirmDescription("Você tem alterações não salvas. Deseja continuar?");
    confirmActionRef.current = () => {
      navigate(href);
    };
    confirmCancelRef.current = () => {
      setConfirmOpen(false);
    };
    setConfirmOpen(true);
  };

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const embeddedUploadUrls = useMemo(
    () => extractLexicalImageUploadUrls(formState.contentLexical),
    [formState.contentLexical],
  );
  const postImageLibraryOptions = useMemo(
    () => ({
      uploadFolder: "posts",
      listFolders: ["posts", "shared"],
      listAll: false,
      includeProjectImages: true,
      projectImageProjectIds: [],
      projectImagesView: "by-project" as const,
      currentSelectionUrls: embeddedUploadUrls,
    }),
    [embeddedUploadUrls],
  );
  const projectTags = useMemo(() => {
    if (!formState.projectId) {
      return [];
    }
    return projectMap.get(formState.projectId)?.tags || [];
  }, [formState.projectId, projectMap]);
  const tagTranslationMap = useMemo(() => buildTranslationMap(tagTranslations), [tagTranslations]);
  const displayTag = useCallback(
    (tag: string) => translateTag(tag, tagTranslationMap),
    [tagTranslationMap],
  );
  useEffect(() => {
    const base = (formState.tags || []).filter(Boolean);
    const next = [...base];
    projectTags.forEach((tag) => {
      if (tag && !next.includes(tag)) {
        next.push(tag);
      }
    });
    setTagOrder((prev) => {
      if (prev.length === 0) {
        return next;
      }
      const ordered = prev.filter((tag) => next.includes(tag));
      next.forEach((tag) => {
        if (!ordered.includes(tag)) {
          ordered.push(tag);
        }
      });
      return ordered;
    });
  }, [projectTags, formState.tags]);
  const isRestorable = useCallback((post: PostRecord) => {
    if (!post.deletedAt) {
      return false;
    }
    const ts = new Date(post.deletedAt).getTime();
    if (!Number.isFinite(ts)) {
      return false;
    }
    return Date.now() - ts <= restoreWindowMs;
  }, [restoreWindowMs]);
  const getRestoreRemainingLabel = (post: PostRecord) => {
    if (!post.deletedAt) {
      return "";
    }
    const ts = new Date(post.deletedAt).getTime();
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
  const activePosts = useMemo(() => posts.filter((post) => !post.deletedAt), [posts]);
  const trashedPosts = useMemo(
    () => posts.filter((post) => post.deletedAt && isRestorable(post)),
    [isRestorable, posts],
  );
  const availableTags = useMemo(() => {
    const collected = new Set<string>();
    projects.forEach((project) => {
      (project.tags || []).forEach((tag) => {
        if (tag) {
          collected.add(tag);
        }
      });
    });
    activePosts.forEach((post) => {
      (post.tags || []).forEach((tag) => {
        if (tag) {
          collected.add(tag);
        }
      });
    });
    return sortByTranslatedLabel(Array.from(collected), (tag) => displayTag(tag));
  }, [activePosts, displayTag, projects]);
  const mergedTags = useMemo(() => {
    if (tagOrder.length) {
      return tagOrder;
    }
    const combined = [...projectTags, ...(formState.tags || [])];
    return Array.from(new Set(combined.filter(Boolean)));
  }, [projectTags, formState.tags, tagOrder]);

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      if (sortMode === "projects" && projectFilterId !== "all") {
        return activePosts.filter((post) => post.projectId === projectFilterId);
      }
      return activePosts;
    }
    return activePosts.filter((post) => {
      if (sortMode === "projects" && projectFilterId !== "all" && post.projectId !== projectFilterId) {
        return false;
      }
      const project = post.projectId ? projectMap.get(post.projectId) : null;
      const projectTitle = project?.title || "";
      const projectTags = project?.tags?.join(" ") || "";
      const postTags = Array.isArray(post.tags) ? post.tags.join(" ") : "";
      const haystack = [
        post.title,
        post.slug,
        post.excerpt,
        post.author,
        projectTitle,
        projectTags,
        postTags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [activePosts, projectFilterId, projectMap, searchQuery, sortMode]);

  const sortedPosts = useMemo(() => {
    const next = [...filteredPosts];
    next.sort((a, b) => {
      if (sortMode === "alpha") {
        return a.title.localeCompare(b.title, "pt-BR");
      }
      if (sortMode === "tags") {
        const tagsA = [
          ...(a.projectId ? projectMap.get(a.projectId)?.tags || [] : []),
          ...(Array.isArray(a.tags) ? a.tags : []),
        ];
        const tagsB = [
          ...(b.projectId ? projectMap.get(b.projectId)?.tags || [] : []),
          ...(Array.isArray(b.tags) ? b.tags : []),
        ];
        return tagsA.join(",").localeCompare(tagsB.join(","), "pt-BR");
      }
      if (sortMode === "projects") {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
      if (sortMode === "status") {
        return a.status.localeCompare(b.status, "pt-BR");
      }
      if (sortMode === "views") {
        return (b.views || 0) - (a.views || 0);
      }
      if (sortMode === "comments") {
        return (b.commentsCount || 0) - (a.commentsCount || 0);
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    return next;
  }, [filteredPosts, projectMap, sortMode]);

  const postsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(sortedPosts.length / postsPerPage));
  const pageStart = (currentPage - 1) * postsPerPage;
  const paginatedPosts = sortedPosts.slice(pageStart, pageStart + postsPerPage);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [isLoading, totalPages]);

  useEffect(() => {
    queryStateRef.current = {
      sortMode,
      searchQuery,
      projectFilterId,
      currentPage,
    };
  }, [currentPage, projectFilterId, searchQuery, sortMode]);

  useEffect(() => {
    if (!hasLoadedUserPreferences) {
      return;
    }
    if (navigationType === "POP" || hasPostsSearchQueryState(searchParams)) {
      return;
    }
    setUiListState(DASHBOARD_POSTS_LIST_STATE_KEY, null);
  }, [hasLoadedUserPreferences, navigationType, searchParams, setUiListState]);

  useEffect(() => {
    if (hasRestoredListStateRef.current || !hasLoadedUserPreferences) {
      return;
    }
    hasRestoredListStateRef.current = true;
    const hasSearchQueryState = hasPostsSearchQueryState(searchParams);
    if (hasSearchQueryState) {
      return;
    }
    if (navigationType !== "POP") {
      setUiListState(DASHBOARD_POSTS_LIST_STATE_KEY, null);
      return;
    }
    const savedListState = getUiListState(DASHBOARD_POSTS_LIST_STATE_KEY);
    if (!savedListState) {
      return;
    }
    const savedSortMode = parseSortParam(typeof savedListState.sort === "string" ? savedListState.sort : null);
    const savedSearchQuery = typeof savedListState.filters?.q === "string" ? savedListState.filters.q : "";
    const savedProjectFilterId =
      typeof savedListState.filters?.projectId === "string" && savedListState.filters.projectId.trim()
        ? savedListState.filters.projectId.trim()
        : "all";
    const savedPageRaw = Number(savedListState.page);
    const savedPage = Number.isFinite(savedPageRaw) && savedPageRaw >= 1 ? Math.floor(savedPageRaw) : 1;
    setSortMode((previous) => (previous === savedSortMode ? previous : savedSortMode));
    setSearchQuery((previous) => (previous === savedSearchQuery ? previous : savedSearchQuery));
    setProjectFilterId((previous) => (previous === savedProjectFilterId ? previous : savedProjectFilterId));
    setCurrentPage((previous) => (previous === savedPage ? previous : savedPage));
  }, [getUiListState, hasLoadedUserPreferences, navigationType, searchParams, setUiListState]);

  useEffect(() => {
    const nextSortMode = parseSortParam(searchParams.get("sort"));
    const nextSearchQuery = searchParams.get("q") || "";
    const nextProjectFilterId = searchParams.get("project") || "all";
    const nextPage = parsePageParam(searchParams.get("page"));
    const {
      sortMode: currentSortMode,
      searchQuery: currentSearchQuery,
      projectFilterId: currentProjectFilterId,
      currentPage: currentCurrentPage,
    } = queryStateRef.current;
    const shouldApply =
      currentSortMode !== nextSortMode ||
      currentSearchQuery !== nextSearchQuery ||
      currentProjectFilterId !== nextProjectFilterId ||
      currentCurrentPage !== nextPage;
    if (!shouldApply) {
      return;
    }
    isApplyingSearchParamsRef.current = true;
    setSortMode((prev) => (prev === nextSortMode ? prev : nextSortMode));
    setSearchQuery((prev) => (prev === nextSearchQuery ? prev : nextSearchQuery));
    setProjectFilterId((prev) => (prev === nextProjectFilterId ? prev : nextProjectFilterId));
    setCurrentPage((prev) => (prev === nextPage ? prev : nextPage));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (sortMode === "recent") {
      nextParams.delete("sort");
    } else {
      nextParams.set("sort", sortMode);
    }
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      nextParams.set("q", trimmedQuery);
    } else {
      nextParams.delete("q");
    }
    if (projectFilterId && projectFilterId !== "all") {
      nextParams.set("project", projectFilterId);
    } else {
      nextParams.delete("project");
    }
    if (currentPage <= 1) {
      nextParams.delete("page");
    } else {
      nextParams.set("page", String(currentPage));
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
  }, [sortMode, searchQuery, projectFilterId, currentPage, searchParams, setSearchParams]);

  useEffect(() => {
    if (!hasLoadedUserPreferences) {
      return;
    }
    const trimmedQuery = searchQuery.trim();
    const filters: Record<string, string> = {};
    if (trimmedQuery) {
      filters.q = trimmedQuery;
    }
    if (projectFilterId && projectFilterId !== "all") {
      filters.projectId = projectFilterId;
    }
    const nextState: {
      sort?: string;
      page?: number;
      filters?: Record<string, string>;
    } = {};
    if (sortMode !== "recent") {
      nextState.sort = sortMode;
    }
    if (currentPage > 1) {
      nextState.page = currentPage;
    }
    if (Object.keys(filters).length > 0) {
      nextState.filters = filters;
    }
    setUiListState(
      DASHBOARD_POSTS_LIST_STATE_KEY,
      Object.keys(nextState).length > 0 ? nextState : null,
    );
  }, [currentPage, hasLoadedUserPreferences, projectFilterId, searchQuery, setUiListState, sortMode]);

  const handlePublishDateChange = (nextDate: Date | null) => {
    if (!nextDate) {
      setFormState((prev) => ({ ...prev, publishAt: "" }));
      return;
    }
    const { time } = parseLocalDateTimeValue(formState.publishAt || "");
    const timePart = time || "12:00";
    const nextValue = `${toLocalDateTimeValue(nextDate).slice(0, 10)}T${timePart}`;
    setFormState((prev) => ({ ...prev, publishAt: nextValue }));
  };

  const handlePublishTimeChange = (nextTime: Date | null) => {
    if (!nextTime || Number.isNaN(nextTime.getTime())) {
      return;
    }
    const nextTimePart = `${pad(nextTime.getHours())}:${pad(nextTime.getMinutes())}`;
    const { date } = parseLocalDateTimeValue(formState.publishAt || "");
    const baseDate = date || new Date();
    const datePart = toLocalDateTimeValue(baseDate).slice(0, 10);
    setFormState((prev) => ({ ...prev, publishAt: `${datePart}T${nextTimePart}` }));
  };

  const publishDateParts = parseLocalDateTimeValue(formState.publishAt || "");
  const publishDateValue = publishDateParts.date;
  const publishTimeValue = toTimeFieldValue(publishDateParts.time || "12:00");

  const handleSetNow = () => {
    const now = new Date();
    handlePublishDateChange(now);
    handlePublishTimeChange(now);
  };

  const handleAddTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag) {
      return;
    }
    const tagsToAdd = nextTag
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tagsToAdd.length === 0) {
      setTagInput("");
      return;
    }
    setFormState((prev) => {
      const current = prev.tags || [];
      const combined = [...current, ...tagsToAdd.filter((tag) => !projectTags.includes(tag))];
      return { ...prev, tags: Array.from(new Set(combined)) };
    });
    setTagOrder((prev) => {
      const next = [...prev];
      tagsToAdd.forEach((tag) => {
        if (!next.includes(tag)) {
          next.push(tag);
        }
      });
      return next;
    });
    setTagInput("");
    if (tagInputRef.current) {
      tagInputRef.current.value = "";
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormState((prev) => ({
      ...prev,
      tags: (prev.tags || []).filter((item) => item !== tag),
    }));
    setTagOrder((prev) => prev.filter((item) => item !== tag));
  };

  const handleTagDragStart = (tag: string) => {
    setDraggedTag(tag);
  };

  const handleTagDrop = (targetTag: string) => {
    if (!draggedTag || draggedTag === targetTag) {
      setDraggedTag(null);
      return;
    }
    setTagOrder((prev) => {
      const tags = [...prev];
      const fromIndex = tags.indexOf(draggedTag);
      const toIndex = tags.indexOf(targetTag);
      if (fromIndex === -1 || toIndex === -1) {
        return prev;
      }
      tags.splice(fromIndex, 1);
      tags.splice(toIndex, 0, draggedTag);
      return tags;
    });
    setDraggedTag(null);
  };

  const openLibrary = () => {
    setIsLibraryOpen(true);
  };

  const handleLibrarySelect = useCallback(
    (url: string, altText?: string) => {
      const nextUrl = String(url || "").trim();
      setFormState((prev) => {
        const hasManualCover = Boolean(String(prev.coverImageUrl || "").trim());
        const shouldKeepAutomatic =
          !hasManualCover &&
          editorResolvedCover.source === "content" &&
          areCoverUrlsEquivalent(nextUrl, editorResolvedCover.coverImageUrl);
        return {
          ...prev,
          coverImageUrl: shouldKeepAutomatic ? "" : nextUrl,
          coverAlt: prev.coverAlt || altText || prev.title || "Capa",
        };
      });
    },
    [editorResolvedCover.coverImageUrl, editorResolvedCover.source],
  );



  const handleCopyLink = async (slug: string) => {
    const url = `${window.location.origin}/postagem/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: url });
    } catch {
      toast({ title: "Não foi possível copiar o link" });
    }
  };

  const handleSave = async (overrideStatus?: "draft" | "scheduled" | "published") => {
    const resolvedStatus = overrideStatus || formState.status;
    const parsedPublishAtMs = formState.publishAt ? new Date(formState.publishAt).getTime() : null;
    const publishAtValue =
      parsedPublishAtMs !== null && Number.isFinite(parsedPublishAtMs)
        ? new Date(parsedPublishAtMs).toISOString()
        : null;
    const nowIso = new Date().toISOString();
    const originalPublishAtLocal = editingPost ? toLocalDateTimeFromIso(editingPost.publishedAt) : "";
    const didPublishAtChange = Boolean(editingPost) && formState.publishAt !== originalPublishAtLocal;
    let resolvedPublishedAt = editingPost?.publishedAt || nowIso;
    if (overrideStatus === "published") {
      resolvedPublishedAt = nowIso;
    } else if (editingPost && !didPublishAtChange) {
      resolvedPublishedAt = editingPost.publishedAt || nowIso;
    } else if (publishAtValue) {
      resolvedPublishedAt = publishAtValue;
    }
    const scheduledDateSource = editingPost && !didPublishAtChange ? editingPost.publishedAt : publishAtValue;
    const hasScheduledDate = resolvedStatus !== "scheduled" || Boolean(scheduledDateSource);
    if (!hasScheduledDate) {
      toast({
        title: "Defina uma data de publicação",
        description: "Posts agendados precisam de uma data.",
      });
      return;
    }
    const lexicalText = getLexicalText(formState.contentLexical);
    const seoDescription = lexicalText.trim().slice(0, 150);
    const coverImageUrl = formState.coverImageUrl.trim() || null;
    const coverAlt = formState.coverAlt.trim() || "";
    const excerpt = formState.excerpt.trim() || lexicalText.trim().slice(0, 160);
    const rawTagInput = tagInputRef.current?.value ?? tagInput;
    const pendingTags = rawTagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const tagsToSave = (() => {
      const ordered: string[] = [];
      const pushUnique = (tag: string) => {
        if (tag && !ordered.includes(tag)) {
          ordered.push(tag);
        }
      };
      tagOrder.forEach(pushUnique);
      (formState.tags || []).forEach(pushUnique);
      projectTags.forEach(pushUnique);
      pendingTags.forEach(pushUnique);
      return ordered;
    })();
    const payload = {
      title: formState.title.trim(),
      slug: formState.slug.trim(),
      coverImageUrl,
      coverAlt,
      excerpt,
      content: formState.contentLexical,
      contentFormat: "lexical",
      author: formState.author.trim(),
      publishedAt: resolvedPublishedAt,
      status: resolvedStatus,
      seoTitle: formState.title.trim(),
      seoDescription,
      projectId: formState.projectId || "",
      tags: tagsToSave,
    };

    if (!payload.title || !payload.slug) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Título e slug são necessários para criar a postagem.",
      });
      return;
    }

    const response = await apiFetch(
      apiBase,
      `/api/posts${editingPost ? `/${editingPost.id}` : ""}`,
      {
        method: editingPost ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      toast({
        title: "Não foi possível salvar",
        description: "Verifique as permissões ou tente novamente.",
      });
      return;
    }

    const data = await response.json();
    const savedPostSlug = typeof data?.post?.slug === "string" ? data.post.slug : "";
    if (!editingPost) {
      const baseSlug = createSlug(payload.slug || payload.title);
      if (savedPostSlug && savedPostSlug !== baseSlug) {
        toast({
          title: "Link ajustado automaticamente",
          description: `Conflito detectado. O post foi salvo com /${savedPostSlug}.`,
        });
      }
    }

    await loadPosts();
    const nextFormAfterSave = {
      ...formState,
      status: resolvedStatus,
      publishAt: resolvedPublishedAt ? toLocalDateTimeFromIso(resolvedPublishedAt) : "",
      excerpt,
      coverImageUrl: coverImageUrl || "",
      coverAlt,
      tags: tagsToSave.filter((tag) => !projectTags.includes(tag)),
    };
    editorInitialSnapshotRef.current = buildPostEditorSnapshot(nextFormAfterSave);
    setFormState((prev) => ({
      ...prev,
      ...nextFormAfterSave,
    }));
    setTagOrder(tagsToSave);
    toast({
      title: editingPost ? "Postagem atualizada" : "Postagem criada",
      description: "As alterações já estão na dashboard.",
    });
    if (pendingTags.length) {
      setTagInput("");
      if (tagInputRef.current) {
        tagInputRef.current.value = "";
      }
    }
    if (editingPost) {
      closeEditor();
    } else if (resolvedStatus === "published" || resolvedStatus === "scheduled") {
      closeEditor();
    }
  };

  const handleDelete = () => {
    if (!editingPost) {
      return;
    }
    setDeleteTarget(editingPost);
  };

  const handleDeletePost = async (post: PostRecord) => {
    setDeleteTarget(post);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    const response = await apiFetch(apiBase, `/api/posts/${deleteTarget.id}`, {
      method: "DELETE",
      auth: true,
    });
    if (!response.ok) {
      toast({ title: "Não foi possível excluir a postagem" });
      return;
    }
    await loadPosts();
    setDeleteTarget(null);
    if (editingPost && deleteTarget.id === editingPost.id) {
      closeEditor();
    }
    toast({ title: "Postagem movida para a lixeira", description: "Você pode restaurar por 3 dias." });
  };
  const handleRestorePost = async (post: PostRecord) => {
    const response = await apiFetch(apiBase, `/api/posts/${post.id}/restore`, {
      method: "POST",
      auth: true,
    });
    if (!response.ok) {
      if (response.status === 410) {
        toast({ title: "Janela de restauração expirou" });
        await loadPosts();
        return;
      }
      toast({ title: "Não foi possível restaurar a postagem" });
      return;
    }
    const data = await response.json();
    setPosts((prev) => prev.map((item) => (item.id === post.id ? data.post : item)));
    toast({ title: "Postagem restaurada" });
  };


  return (
    <>
      <DashboardShell
        currentUser={currentUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
        onMenuItemClick={(item, event) => {
          if (!item.enabled || !isEditorOpen || !isDirty) {
            return;
          }
          event.preventDefault();
          handleRouteNavigate(item.href);
        }}
      >
        <DashboardPageContainer>
            <DashboardPageHeader
              badge="Postagens"
              title="Gerenciar posts"
              description="Visualize, edite e publique os posts mais recentes do site."
              actions={canManagePosts ? (
                <Button className="gap-2" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Nova postagem
                </Button>
              ) : undefined}
            />

            {isEditorOpen && canManagePosts ? (
              <>
                <div
                  className="pointer-events-auto fixed inset-0 z-40 bg-black/80 backdrop-blur-xs"
                  aria-hidden="true"
                />
                <Dialog open={isEditorOpen} onOpenChange={handleEditorOpenChange} modal={false}>
                  <DialogContent
                    className={`max-w-6xl max-h-[92vh] overflow-y-auto no-scrollbar ${
                      isEditorDialogScrolled ? "editor-modal-scrolled" : ""
                    }`}
                    onScroll={(event) => {
                      const nextScrolled = event.currentTarget.scrollTop > 0;
                      setIsEditorDialogScrolled((prev) =>
                        prev === nextScrolled ? prev : nextScrolled,
                      );
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
                    <DialogHeader>
                      <DialogTitle>{editingPost ? "Editar postagem" : "Nova postagem"}</DialogTitle>
                      <DialogDescription>
                        Crie, edite e publique conteúdos sem sair da listagem.
                      </DialogDescription>
                    </DialogHeader>
                    <div
                      className="mt-2 space-y-8"
                      onFocusCapture={(event) => {
                        const target = event.target as HTMLElement | null;
                        if (target?.closest(".lexical-playground")) {
                          return;
                        }
                        editorRef.current?.blur();
                      }}
                    >
                <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <Suspense fallback={<LexicalEditorFallback />}>
                    <LexicalEditor
                      ref={editorRef}
                      value={formState.contentLexical}
                      onChange={(value) =>
                        setFormState((prev) => ({
                          ...prev,
                          contentLexical: value,
                        }))
                      }
                      placeholder="Escreva o conteúdo do post..."
                      className="lexical-playground--stretch lexical-playground--modal min-w-0 w-full"
                      imageLibraryOptions={postImageLibraryOptions}
                    />
                  </Suspense>

                  <aside className="min-w-0 space-y-6">
                    <Card className="border-border/60 bg-card/80">
                      <CardContent className="space-y-5 p-6">
                        <div className="space-y-2">
                          <Label htmlFor="post-title">Título</Label>
                          <Input
                            id="post-title"
                            value={formState.title}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, title: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="post-slug">Link</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsSlugCustom((prev) => !prev)}
                            >
                              {isSlugCustom ? "Automático" : "Personalizar"}
                            </Button>
                          </div>
                          <Input
                            id="post-slug"
                            value={formState.slug}
                            onChange={(event) => {
                              setIsSlugCustom(true);
                              setFormState((prev) => ({ ...prev, slug: event.target.value }));
                            }}
                            disabled={!isSlugCustom}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="post-author">Autor</Label>
                          <Input
                            id="post-author"
                            value={formState.author}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, author: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="post-status">Status</Label>
                          <Select
                            value={formState.status}
                            onValueChange={(value) =>
                              setFormState((prev) => ({
                                ...prev,
                                status: value as "draft" | "scheduled" | "published",
                              }))
                            }
                          >
                            <SelectTrigger id="post-status">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Rascunho</SelectItem>
                              <SelectItem value="scheduled">Agendado</SelectItem>
                              <SelectItem value="published">Publicado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="post-date">Publicação</Label>
                          <MuiDateTimeFieldsProvider>
                            <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                              <MuiBrazilDateField
                                id="post-date"
                                value={publishDateValue}
                                onChange={handlePublishDateChange}
                              />
                              <div className="flex items-center gap-2">
                                <MuiBrazilTimeField
                                  id="post-time"
                                  value={publishTimeValue}
                                  onChange={handlePublishTimeChange}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-xs"
                                  onClick={handleSetNow}
                                >
                                  Agora
                                </Button>
                              </div>
                            </div>
                          </MuiDateTimeFieldsProvider>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/80">
                      <CardContent className="space-y-4 p-6">
                        <div className="space-y-2">
                          <Label>Capa</Label>
                          {editorResolvedCover.coverImageUrl ? (
                            <div className="space-y-2">
                              <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
                                <img
                                  src={normalizeAssetUrl(editorResolvedCover.coverImageUrl)}
                                  alt={editorResolvedCover.coverAlt}
                                  className="aspect-3/2 w-full object-cover"
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span className="min-w-0 truncate">
                                  {editorCoverFileName || "Imagem"}
                                </span>
                                <Badge
                                  variant={editorResolvedCover.source === "manual" ? "secondary" : "outline"}
                                  className="shrink-0 text-[10px] uppercase"
                                >
                                  {editorResolvedCover.source === "manual" ? "Manual" : "Automática"}
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sem capa definida.</p>
                          )}
                          <Button type="button" variant="outline" size="sm" onClick={openLibrary}>
                            Biblioteca
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/80">
                      <CardContent className="space-y-4 p-6">
                        <div className="space-y-2">
                          <Label>Projeto associado</Label>
                          <Select
                            value={formState.projectId || "none"}
                            onValueChange={(value) =>
                              setFormState((prev) => ({
                                ...prev,
                                projectId: value === "none" ? "" : value,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              {projects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  {project.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/80">
                      <CardContent className="space-y-4 p-6">
                        <div className="space-y-2">
                          <Label>Tags</Label>
                          <div className="flex flex-wrap gap-2">
                            {mergedTags.map((tag) => {
                              const isProjectTag = projectTags.includes(tag);
                              return (
                                <button
                                  key={`tag-${tag}`}
                                  type="button"
                                  className="group"
                                  draggable
                                  onDragStart={() => handleTagDragStart(tag)}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={() => handleTagDrop(tag)}
                                  onClick={() => {
                                    if (!isProjectTag) {
                                      handleRemoveTag(tag);
                                    }
                                  }}
                                >
                                  <Badge
                                    variant={isProjectTag ? "secondary" : "outline"}
                                    className="text-[10px] uppercase"
                                  >
                                    {displayTag(tag)}
                                    {isProjectTag ? null : (
                                      <span className="ml-2 text-[10px] text-muted-foreground group-hover:text-foreground">
                                        ×
                                      </span>
                                    )}
                                  </Badge>
                                </button>
                              );
                            })}
                            {mergedTags.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Sem tags ainda.</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Input
                            ref={tagInputRef}
                            value={tagInput}
                            onChange={(event) => setTagInput(event.target.value)}
                            placeholder="Adicionar tag"
                            list="post-tag-options"
                            onBlur={() => {
                              if (tagInput.trim()) {
                                handleAddTag();
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === ",") {
                                event.preventDefault();
                                handleAddTag();
                              }
                            }}
                          />
                          <datalist id="post-tag-options">
                            {availableTags.map((tag) => (
                              <option key={tag} value={tag} />
                            ))}
                          </datalist>
                          <Button type="button" variant="secondary" onClick={handleAddTag}>
                            Adicionar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex flex-wrap gap-3" />
                  </aside>
                </div>

                {formState.projectId ? <ProjectEmbedCard projectId={formState.projectId} /> : null}
                      <div className="flex flex-wrap justify-end gap-3">
                        <Button variant="ghost" onClick={requestCloseEditor} className="gap-2">
                          <X className="h-4 w-4" />
                          Fechar
                        </Button>
                        {editingPost ? (
                          <>
                            <Button variant="outline" onClick={handleDelete} className="gap-2">
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </Button>
                            <Button onClick={() => handleSave()} className="gap-2">
                              <Edit3 className="h-4 w-4" />
                              Salvar
                            </Button>
                            {formState.status === "draft" ? (
                              <Button onClick={() => handleSave("published")} className="gap-2">
                                <Plus className="h-4 w-4" />
                                Publicar agora
                              </Button>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" onClick={() => handleSave("draft")}>
                              Salvar rascunho
                            </Button>
                            <Button variant="secondary" onClick={() => handleSave("scheduled")}>
                              Agendar
                            </Button>
                            <Button onClick={() => handleSave("published")} className="gap-2">
                              <Plus className="h-4 w-4" />
                              Publicar agora
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : null}

            <section className="mt-10 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 animate-slide-up opacity-0">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <div className="w-full max-w-sm">
                    <Input
                      value={searchQuery}
                      onChange={(event) => {
                        setCurrentPage(1);
                        setSearchQuery(event.target.value);
                      }}
                      placeholder="Buscar por título, slug, autor, tags..."
                    />
                  </div>
                  <Select
                    value={sortMode}
                    onValueChange={(value) => {
                      setCurrentPage(1);
                      setSortMode(value as typeof sortMode);
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Mais recentes</SelectItem>
                      <SelectItem value="alpha">Ordem alfabética</SelectItem>
                      <SelectItem value="tags">Tags</SelectItem>
                      <SelectItem value="projects">Projetos</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="views">Visualizações</SelectItem>
                      <SelectItem value="comments">Comentários</SelectItem>
                    </SelectContent>
                  </Select>
                  {sortMode === "projects" ? (
                    <Select
                      value={projectFilterId}
                      onValueChange={(value) => {
                        setCurrentPage(1);
                        setProjectFilterId(value);
                      }}
                    >
                      <SelectTrigger className="w-[240px]">
                        <SelectValue placeholder="Selecionar projeto" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            value={projectFilterQuery}
                            onChange={(event) => setProjectFilterQuery(event.target.value)}
                            placeholder="Buscar projeto..."
                          />
                        </div>
                        <SelectItem value="all">Todos os projetos</SelectItem>
                        {projects
                          .filter((project) =>
                            project.title.toLowerCase().includes(projectFilterQuery.toLowerCase()),
                          )
                          .map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
                <Badge variant="secondary" className="text-xs uppercase animate-slide-up opacity-0">
                  {sortedPosts.length} posts
                </Badge>
              </div>
              {isLoading ? (
                <AsyncState
                  kind="loading"
                  title="Carregando postagens"
                  description="Buscando os dados mais recentes do painel."
                  className={dashboardPageLayoutTokens.surfaceDefault}
                />
              ) : hasLoadError ? (
                <AsyncState
                  kind="error"
                  title="Nao foi possivel carregar as postagens"
                  description="Confira a conexao e tente atualizar os dados."
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
              ) : sortedPosts.length === 0 ? (
                <AsyncState
                  kind="empty"
                  title="Nenhuma postagem cadastrada"
                  description="Crie uma nova postagem para iniciar o fluxo editorial."
                  className={dashboardPageLayoutTokens.surfaceMuted}
                  action={
                    canManagePosts ? (
                      <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        <Plus className="mr-2 h-4 w-4" />
                        Criar primeira postagem
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <div className="grid gap-6">
                  {paginatedPosts.map((post, index) => {
                    const formattedDate = post.publishedAt ? formatDateTimeShort(post.publishedAt) : "Sem data";
                    const project = post.projectId ? projectMap.get(post.projectId) : null;
                    const tags = Array.from(
                      new Set([
                        ...(project?.tags || []),
                        ...(Array.isArray(post.tags) ? post.tags : []),
                      ]),
                    );
                    const sortedCardTags = sortByTranslatedLabel(tags, (tag) => displayTag(tag));
                    const visibleCardTags = sortedCardTags.slice(0, 3);
                    const extraTagCount = Math.max(0, sortedCardTags.length - visibleCardTags.length);
                    const statusLabel = getPostStatusLabel(post.status);
                    const resolvedCardCover = resolvePostCoverPreview({
                      coverImageUrl: post.coverImageUrl,
                      coverAlt: post.coverAlt,
                      content: post.content,
                      contentFormat: post.contentFormat || "lexical",
                      title: post.title,
                    });
                    return (
                      <Card
                        key={post.id}
                        data-testid={`post-card-${post.id}`}
                        className={`${dashboardPageLayoutTokens.listCard} group cursor-pointer overflow-hidden transition hover:border-primary/40 animate-slide-up opacity-0`}
                        style={{ animationDelay: `${Math.min(index * 35, 210)}ms` }}
                        role={canManagePosts ? "button" : undefined}
                        tabIndex={canManagePosts ? 0 : -1}
                        onKeyDown={(event) => {
                          if (!canManagePosts) {
                            return;
                          }
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openEdit(post);
                          }
                        }}
                        onClick={() => {
                          if (canManagePosts) {
                            openEdit(post);
                          }
                        }}
                      >
                        <CardContent className="p-0">
                          <div className="grid min-h-[360px] gap-0 lg:h-[280px] lg:min-h-0 lg:grid-cols-[220px_1fr]">
                            <div className="relative h-52 w-full overflow-hidden lg:h-full">
                              {resolvedCardCover.coverImageUrl ? (
                                <img
                                  src={normalizeAssetUrl(resolvedCardCover.coverImageUrl)}
                                  alt={resolvedCardCover.coverAlt || post.title}
                                  className="absolute inset-0 block h-full w-full object-cover object-center"
                                  loading="lazy"
                                  onError={(event) => {
                                    event.currentTarget.src = "/placeholder.svg";
                                  }}
                                />
                              ) : (
                                <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-muted/30 text-xs text-muted-foreground">
                                  Sem capa
                                </div>
                              )}
                            </div>
                            <div className="grid h-full min-h-0 overflow-hidden grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-2 p-4 lg:pb-5">
                              <div data-slot="top" className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    {statusLabel}
                                  </Badge>
                                  {project ? (
                                    <Badge variant="secondary" className="max-w-60 truncate text-[10px] uppercase">
                                      {project.title}
                                    </Badge>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Visualizar"
                                    className="h-8 w-8"
                                    onClick={(event) => event.stopPropagation()}
                                    asChild
                                  >
                                    <Link to={`/postagem/${post.slug}`}>
                                      <Eye className="h-3.5 w-3.5" />
                                    </Link>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Copiar link"
                                    className="h-8 w-8"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCopyLink(post.slug);
                                    }}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                  {canManagePosts ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Excluir"
                                      className="h-8 w-8"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleDeletePost(post);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  ) : null}
                                </div>
                              </div>

                              <div data-slot="headline" className="min-h-11">
                                <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-foreground lg:line-clamp-1">
                                  {post.title}
                                </h3>
                                <span className="text-xs text-muted-foreground">{formattedDate}</span>
                              </div>

                              <p
                                data-slot="excerpt"
                                className="line-clamp-2 min-h-0 overflow-hidden text-sm text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] lg:line-clamp-1 lg:[-webkit-line-clamp:1]"
                              >
                                {post.excerpt || "Sem prévia cadastrada."}
                              </p>

                              <div className="flex min-h-0 shrink-0 flex-col gap-2">
                                <div data-slot="tags" className="min-h-6">
                                  {visibleCardTags.length > 0 ? (
                                    <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                                      {visibleCardTags.map((tag) => (
                                        <Badge
                                          key={tag}
                                          variant="secondary"
                                          className="min-w-0 max-w-34 overflow-hidden text-[10px] uppercase"
                                        >
                                          <span className="block min-w-0 truncate">{displayTag(tag)}</span>
                                        </Badge>
                                      ))}
                                      {extraTagCount > 0 ? (
                                        <Badge variant="secondary" className="text-[10px] uppercase">
                                          +{extraTagCount}
                                        </Badge>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <span className="invisible text-[10px]">placeholder</span>
                                  )}
                                </div>

                                <div
                                  data-slot="meta"
                                  className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground lg:flex-nowrap lg:gap-y-0"
                                >
                                  <span className="inline-flex min-w-0 max-w-full items-center gap-2">
                                    <UserRound className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{post.author || "Autor não definido"}</span>
                                  </span>
                                  <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
                                    <Eye className="h-4 w-4" />
                                    {post.views} visualizações
                                  </span>
                                  <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
                                    <MessageSquare className="h-4 w-4" />
                                    {post.commentsCount} comentários
                                  </span>
                                  <span className="ml-auto hidden max-w-44 truncate text-right text-xs text-muted-foreground lg:block">
                                    /{post.slug}
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
              {sortedPosts.length > postsPerPage ? (
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
              {trashedPosts.length > 0 ? (
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
                        {trashedPosts.length} itens
                      </Badge>
                    </div>
                    <div className="grid gap-3">
                      {trashedPosts.map((post, index) => (
                        <div
                          key={`trash-${post.id}`}
                          className={`${dashboardPageLayoutTokens.surfaceDefault} flex flex-wrap items-center justify-between gap-3 px-4 py-3 animate-slide-up opacity-0`}
                          style={{ animationDelay: `${Math.min(index * 35, 210)}ms` }}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{post.title}</p>
                            <p className="text-xs text-muted-foreground">/{post.slug}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              Restam {getRestoreRemainingLabel(post)}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestorePost(post)}
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


      <Suspense fallback={null}>
        <ImageLibraryDialog
          open={isLibraryOpen}
          onOpenChange={setIsLibraryOpen}
          apiBase={apiBase}
          description="Escolha uma imagem ja enviada ou use capas/banners de projetos."
          uploadFolder={postImageLibraryOptions.uploadFolder}
          listFolders={postImageLibraryOptions.listFolders}
          listAll={postImageLibraryOptions.listAll}
          includeProjectImages={postImageLibraryOptions.includeProjectImages}
          projectImageProjectIds={postImageLibraryOptions.projectImageProjectIds}
          projectImagesView={postImageLibraryOptions.projectImagesView}
          allowDeselect
          mode="single"
          currentSelectionUrls={editorResolvedCover.coverImageUrl ? [editorResolvedCover.coverImageUrl] : []}
          onSave={({ urls }) => handleLibrarySelect(urls[0] || "")}
        />
      </Suspense>

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
              Cancelar
            </Button>
            <Button
              onClick={() => {
                confirmActionRef.current?.();
                setConfirmOpen(false);
              }}
            >
              Confirmar
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
            <DialogTitle>Excluir postagem?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `Excluir "${deleteTarget.title}"? Você pode restaurar por até 3 dias.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DashboardPosts;







