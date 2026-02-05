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
import { createSlug, renderPostContent, stripHtml } from "@/lib/post-content";
import LexicalEditor, { type LexicalEditorHandle } from "@/components/lexical/LexicalEditor";
import { htmlToLexicalJson } from "@/lib/lexical/serialize";
import type { Project } from "@/data/projects";
import ProjectEmbedCard from "@/components/ProjectEmbedCard";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { formatDate, formatDateTimeShort } from "@/lib/date";
import { usePageMeta } from "@/hooks/use-page-meta";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const emptyForm = {
  title: "",
  slug: "",
  excerpt: "",
  contentLexical: "",
  contentFormat: "lexical" as const,
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

const buildNumberOptions = (count: number) =>
  Array.from({ length: count }, (_, index) => pad(index));

type PostRecord = {
  id: string;
  title: string;
  slug: string;
  coverImageUrl?: string | null;
  coverAlt?: string | null;
  excerpt: string;
  content: string;
  contentFormat: "markdown" | "html" | "lexical";
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

const DashboardPosts = () => {
  usePageMeta({ title: "Posts", noIndex: true });
  const navigate = useNavigate();
  const apiBase = getApiBase();
  const restoreWindowMs = 3 * 24 * 60 * 60 * 1000;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [postOrder, setPostOrder] = useState<string[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PostRecord | null>(null);
  const [formState, setFormState] = useState(emptyForm);
  const [isSlugCustom, setIsSlugCustom] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [imageTarget, setImageTarget] = useState<"editor" | "cover">("editor");
  const [sortMode, setSortMode] = useState<"recent" | "alpha" | "tags" | "projects" | "status" | "views" | "comments">("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilterId, setProjectFilterId] = useState<string>("all");
  const [projectFilterQuery, setProjectFilterQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PostRecord | null>(null);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const [tagOrder, setTagOrder] = useState<string[]>([]);
  const [draggedTag, setDraggedTag] = useState<string | null>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("Sair da edição?");
  const [confirmDescription, setConfirmDescription] = useState(
    "Você tem alterações não salvas. Deseja continuar?",
  );
  const confirmActionRef = useRef<(() => void) | null>(null);
  const confirmCancelRef = useRef<(() => void) | null>(null);
  const editorRef = useRef<LexicalEditorHandle | null>(null);

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

  const isDirty = useMemo(() => {
    const hasContent =
      formState.title ||
      formState.excerpt ||
      formState.contentLexical ||
      formState.coverImageUrl;
    return Boolean(hasContent);
  }, [formState]);

  const allowPopRef = useRef(false);
  const hasPushedBlockRef = useRef(false);

  useEffect(() => {
    if (!isSlugCustom) {
      setFormState((prev) => ({ ...prev, slug: createSlug(prev.title) }));
    }
  }, [formState.title, isSlugCustom]);

  const loadPosts = async () => {
    const response = await apiFetch(apiBase, "/api/posts", { auth: true });
    if (!response.ok) {
      throw new Error("posts_load_failed");
    }
    const data = await response.json();
    const nextPosts = Array.isArray(data.posts) ? data.posts : [];
    setPosts(nextPosts);
    setPostOrder(nextPosts.map((post) => post.id));
  };

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const [postsRes, usersRes, meRes, projectsRes] = await Promise.all([
          apiFetch(apiBase, "/api/posts", { auth: true }),
          apiFetch(apiBase, "/api/users", { auth: true }),
          apiFetch(apiBase, "/api/me", { auth: true }),
          apiFetch(apiBase, "/api/projects", { auth: true }),
        ]);

        if (postsRes.ok) {
          const data = await postsRes.json();
          if (isActive) {
            const nextPosts = Array.isArray(data.posts) ? data.posts : [];
            setPosts(nextPosts);
            setPostOrder(nextPosts.map((post) => post.id));
          }
        }

        if (usersRes.ok) {
          const data = await usersRes.json();
          if (isActive) {
            setUsers(Array.isArray(data.users) ? data.users : []);
            setOwnerIds(Array.isArray(data.ownerIds) ? data.ownerIds : []);
          }
        }

        if (meRes.ok) {
          const data = await meRes.json();
          if (isActive) {
            setCurrentUser(data);
          }
        }

        if (projectsRes.ok) {
          const data = await projectsRes.json();
          if (isActive) {
            setProjects(Array.isArray(data.projects) ? data.projects : []);
          }
        }
      } catch {
        if (isActive) {
          setPosts([]);
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
  }, [apiBase]);

  useEffect(() => {
    if (!isEditorOpen || !isDirty) {
      return;
    }
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isEditorOpen, isDirty, navigate]);

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
    if (isEditorOpen && isDirty) {
      setConfirmTitle("Criar nova postagem?");
      setConfirmDescription("Há alterações não salvas. Deseja descartar e criar uma nova postagem?");
      confirmActionRef.current = () => {
        setEditingPost(null);
        setIsSlugCustom(false);
        setFormState({
          ...emptyForm,
          author: currentUser?.name || "",
          publishAt: toLocalDateTimeValue(new Date()),
        });
        setIsEditorOpen(true);
      };
      confirmCancelRef.current = null;
      setConfirmOpen(true);
      return;
    }
    setEditingPost(null);
    setIsSlugCustom(false);
    setFormState({
      ...emptyForm,
      author: currentUser?.name || "",
      publishAt: toLocalDateTimeValue(new Date()),
    });
    setIsEditorOpen(true);
  };

  const openEdit = (post: PostRecord) => {
    setEditingPost(post);
    setIsSlugCustom(true);
    const baseContent = post.content || "";
    const lexicalContent =
      post.contentFormat === "lexical"
        ? baseContent
        : htmlToLexicalJson(
            post.contentFormat === "markdown"
              ? renderPostContent(baseContent, "markdown")
              : baseContent,
          );
    setFormState({
      title: post.title || "",
      slug: post.slug || "",
      excerpt: post.excerpt || "",
      contentLexical: lexicalContent,
      contentFormat: "lexical",
      author: post.author || "",
      coverImageUrl: post.coverImageUrl || "",
      coverAlt: post.coverAlt || "",
      status: post.status || "draft",
      publishAt: toLocalDateTimeFromIso(post.publishedAt),
      projectId: post.projectId || "",
      tags: Array.isArray(post.tags) ? post.tags : [],
    });
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingPost(null);
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
  const projectLibraryItems = useMemo(
    () =>
      projects
        .flatMap((project) => [
          { key: `${project.id}-cover`, label: `${project.title} (Capa)`, url: project.cover },
          { key: `${project.id}-banner`, label: `${project.title} (Banner)`, url: project.banner },
        ])
        .filter((item) => Boolean(item.url)),
    [projects],
  );
  const projectTags = useMemo(() => {
    if (!formState.projectId) {
      return [];
    }
    return projectMap.get(formState.projectId)?.tags || [];
  }, [formState.projectId, projectMap]);
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
    return Array.from(collected).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [activePosts, projects]);
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
    const orderMap = new Map(postOrder.map((id, index) => [id, index]));
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
  }, [filteredPosts, postOrder, projectMap, sortMode]);

  const handlePublishDateChange = (nextDate?: Date) => {
    if (!nextDate) {
      setFormState((prev) => ({ ...prev, publishAt: "" }));
      return;
    }
    const { time } = parseLocalDateTimeValue(formState.publishAt || "");
    const timePart = time || "12:00";
    const nextValue = `${toLocalDateTimeValue(nextDate).slice(0, 10)}T${timePart}`;
    setFormState((prev) => ({ ...prev, publishAt: nextValue }));
  };

  const handlePublishTimeChange = (nextTime: string) => {
    const { date } = parseLocalDateTimeValue(formState.publishAt || "");
    const baseDate = date || new Date();
    const datePart = toLocalDateTimeValue(baseDate).slice(0, 10);
    setFormState((prev) => ({ ...prev, publishAt: `${datePart}T${nextTime}` }));
  };

  const timeParts = parseLocalDateTimeValue(formState.publishAt || "");
  const hours = buildNumberOptions(24);
  const minutes = buildNumberOptions(60);
  const timeTypeBuffer = useRef<{ hours: string; minutes: string }>({ hours: "", minutes: "" });
  const timeTypeTimer = useRef<{ hours?: number; minutes?: number }>({});
  const currentHour = (timeParts.time || "12:00").split(":")[0];
  const currentMinute = (timeParts.time || "12:00").split(":")[1];

  const setTimeFromTyping = (target: "hours" | "minutes", digit: string) => {
    const existing = timeTypeBuffer.current[target] + digit;
    const limited = existing.slice(-2);
    timeTypeBuffer.current[target] = limited;
    if (timeTypeTimer.current[target]) {
      window.clearTimeout(timeTypeTimer.current[target]);
    }
    timeTypeTimer.current[target] = window.setTimeout(() => {
      timeTypeBuffer.current[target] = "";
    }, 900);
    const numeric = Number(limited);
    if (Number.isNaN(numeric)) {
      return;
    }
    if (target === "hours") {
      const nextHour = pad(Math.max(0, Math.min(23, numeric)));
      handlePublishTimeChange(`${nextHour}:${currentMinute}`);
    } else {
      const nextMinute = pad(Math.max(0, Math.min(59, numeric)));
      handlePublishTimeChange(`${currentHour}:${nextMinute}`);
    }
  };

  const handleTimeType = (target: "hours" | "minutes") => (event: React.KeyboardEvent) => {
    if (event.key.length === 1 && /\d/.test(event.key)) {
      event.preventDefault();
      setTimeFromTyping(target, event.key);
    }
  };

  const handleSetNow = () => {
    const now = new Date();
    handlePublishDateChange(now);
    handlePublishTimeChange(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
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

  const insertImageToContent = useCallback((url: string, altText?: string) => {
    editorRef.current?.insertImage({
      src: url,
      altText: altText || "Imagem",
      width: "100%",
      align: "center",
    });
  }, []);



  const openLibrary = (target: "editor" | "cover") => {
    setImageTarget(target);
    setIsLibraryOpen(true);
  };

  const handleLibrarySelect = useCallback(
    (url: string, altText?: string) => {
      if (imageTarget === "cover") {
        setFormState((prev) => ({
          ...prev,
          coverImageUrl: url,
          coverAlt: prev.coverAlt || altText || prev.title || "Capa",
        }));
        return;
      }
      insertImageToContent(url, altText || "Imagem");
    },
    [imageTarget, insertImageToContent],
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
    const publishAtValue = formState.publishAt ? new Date(formState.publishAt).toISOString() : null;
    if (resolvedStatus === "scheduled" && !publishAtValue) {
      toast({
        title: "Defina uma data de publicação",
        description: "Posts agendados precisam de uma data.",
      });
      return;
    }
    const resolvedPublishedAt =
      resolvedStatus === "published" ? new Date().toISOString() : publishAtValue;
    const contentHtml = renderPostContent(formState.contentLexical, "lexical");
    const seoDescription = stripHtml(contentHtml).trim().slice(0, 150);
    const coverImageUrl = formState.coverImageUrl.trim() || null;
    const coverAlt = formState.coverAlt.trim() || "";
    const excerpt =
      formState.excerpt.trim() || stripHtml(contentHtml).trim().slice(0, 160);
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

    await loadPosts();
    setFormState((prev) => ({
      ...prev,
      tags: tagsToSave.filter((tag) => !projectTags.includes(tag)),
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
    if (resolvedStatus === "published" || resolvedStatus === "scheduled") {
      closeEditor();
      navigate("/dashboard/posts");
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

  const openLinkDialog = () => {
    setIsLinkDialogOpen(true);
  };

  const handleInsertLink = () => {
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) {
      return;
    }
    const text = (linkText || trimmedUrl).trim();
    editorRef.current?.insertLink(trimmedUrl, text);
    setLinkUrl("");
    setLinkText("");
    setIsLinkDialogOpen(false);
  };

  const openVideoDialog = () => {
    setIsVideoDialogOpen(true);
  };

  const handleInsertVideo = () => {
    const url = videoUrl.trim();
    if (!url) {
      return;
    }
    const embedUrl = url.includes("youtube.com")
      ? url.replace("watch?v=", "embed/")
      : url.includes("youtu.be/")
        ? url.replace("youtu.be/", "youtube.com/embed/")
        : url;
    editorRef.current?.insertVideo({ src: embedUrl, title: "Video" });
    setVideoUrl("");
    setIsVideoDialogOpen(false);
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
        <main className="pt-24 px-6 pb-20 md:px-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge variant="secondary" className="text-xs uppercase tracking-widest">
                  Postagens
                </Badge>
                <h1 className="mt-4 text-3xl font-semibold text-foreground">Gerenciar posts</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Visualize, edite e publique os posts mais recentes do site.
                </p>
              </div>
              {canManagePosts ? (
                <div className="flex flex-wrap items-center gap-3">
                      {isEditorOpen ? (
                        editingPost ? (
                          <>
                            <Button onClick={() => handleSave()} className="gap-2">
                              <Edit3 className="h-4 w-4" />
                              Salvar
                            </Button>
                            <Button variant="outline" onClick={handleDelete} className="gap-2">
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </Button>
                            <Button variant="ghost" onClick={closeEditor} className="gap-2">
                              <X className="h-4 w-4" />
                              Fechar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button onClick={() => handleSave("published")} className="gap-2">
                              <Plus className="h-4 w-4" />
                              Publicar agora
                            </Button>
                            <Button variant="secondary" onClick={() => handleSave("scheduled")}>
                              Agendar
                            </Button>
                            <Button variant="ghost" onClick={() => handleSave("draft")}>
                              Salvar rascunho
                            </Button>
                            <Button variant="ghost" onClick={closeEditor} className="gap-2">
                              <X className="h-4 w-4" />
                              Fechar
                            </Button>
                          </>
                        )
                      ) : (
                        <Button className="gap-2" onClick={openCreate}>
                          <Plus className="h-4 w-4" />
                          Nova postagem
                        </Button>
                      )}
                </div>
              ) : null}
            </div>

            {isEditorOpen && canManagePosts ? (
              <section className="mt-10 space-y-8">
                <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <LexicalEditor
                    ref={editorRef}
                    value={formState.contentLexical}
                    onChange={(value) =>
                      setFormState((prev) => ({
                        ...prev,
                        contentLexical: value,
                        contentFormat: "lexical",
                      }))
                    }
                    onRequestImage={() => openLibrary("editor")}
                    onRequestLink={openLinkDialog}
                    onRequestVideo={openVideoDialog}
                    placeholder="Escreva o conteúdo do post..."
                  />

                  <aside className="space-y-6">
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
                          <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  id="post-date"
                                  variant="outline"
                                  className="justify-start text-left font-normal"
                                >
                                  {formState.publishAt
                                    ? formatDate(formState.publishAt)
                                    : "Selecionar data"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={parseLocalDateTimeValue(formState.publishAt || "").date ?? undefined}
                                  onSelect={(date) => handlePublishDateChange(date ?? undefined)}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <div className="flex items-center gap-1">
                              <Select
                                value={currentHour}
                                onValueChange={(value) =>
                                  handlePublishTimeChange(`${value}:${currentMinute}`)
                                }
                              >
                                <SelectTrigger
                                  className="w-14 justify-center px-2 [&>svg]:hidden"
                                  onKeyDown={handleTimeType("hours")}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {hours.map((hour) => (
                                    <SelectItem key={hour} value={hour}>
                                      {hour}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-xs text-muted-foreground">:</span>
                              <Select
                                value={currentMinute}
                                onValueChange={(value) =>
                                  handlePublishTimeChange(`${currentHour}:${value}`)
                                }
                              >
                                <SelectTrigger
                                  className="w-14 justify-center px-2 [&>svg]:hidden"
                                  onKeyDown={handleTimeType("minutes")}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {minutes.map((minute) => (
                                    <SelectItem key={minute} value={minute}>
                                      {minute}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/80">
                      <CardContent className="space-y-4 p-6">
                        <div className="space-y-2">
                          <Label>Capa</Label>
                          {formState.coverImageUrl ? (
                            <div className="flex items-center gap-3">
                              <img
                                src={normalizeAssetUrl(formState.coverImageUrl)}
                                alt={formState.coverAlt || formState.title || "Capa"}
                                className="h-14 w-14 rounded-lg object-cover"
                              />
                              <span className="text-xs text-muted-foreground break-all">
                                {formState.coverImageUrl}
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sem capa definida.</p>
                          )}
                          <Button type="button" variant="outline" size="sm" onClick={() => openLibrary("cover")}>
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
                                    {tag}
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
              </section>
            ) : null}

            <section className="mt-10 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <div className="w-full max-w-sm">
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Buscar por título, slug, autor, tags..."
                    />
                  </div>
                  <Select value={sortMode} onValueChange={(value) => setSortMode(value as typeof sortMode)}>
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
                    <Select value={projectFilterId} onValueChange={setProjectFilterId}>
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
                <Badge variant="secondary" className="text-xs uppercase">
                  {sortedPosts.length} posts
                </Badge>
              </div>
              {isLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
                  Carregando postagens...
                </div>
              ) : sortedPosts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
                  Nenhuma postagem cadastrada ainda.
                </div>
              ) : (
                <div className="grid gap-6">
                  {sortedPosts.map((post) => {
                    const formattedDate = post.publishedAt ? formatDateTimeShort(post.publishedAt) : "Sem data";
                    const project = post.projectId ? projectMap.get(post.projectId) : null;
                    const tags = Array.from(
                      new Set([
                        ...(project?.tags || []),
                        ...(Array.isArray(post.tags) ? post.tags : []),
                      ]),
                    );
                    return (
                      <Card
                        key={post.id}
                        className="group cursor-pointer overflow-hidden border-border/60 bg-card/80 shadow-lg transition hover:border-primary/40"
                        onClick={() => {
                          if (canManagePosts) {
                            openEdit(post);
                          }
                        }}
                      >
                        <CardContent className="p-0">
                          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                            <div className="relative h-44 w-full md:h-full">
                              {post.coverImageUrl ? (
                                <img
                                  src={normalizeAssetUrl(post.coverImageUrl)}
                                  alt={post.coverAlt || post.title}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  onError={(event) => {
                                    event.currentTarget.src = "/placeholder.svg";
                                  }}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-muted/30 text-xs text-muted-foreground">
                                  Sem capa
                                </div>
                              )}
                            </div>
                        <div className="flex flex-1 flex-col gap-4 p-6">
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                      {post.status}
                                    </Badge>
                                    {project ? (
                                      <Badge variant="secondary" className="text-[10px] uppercase">
                                        {project.title}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <h3 className="text-lg font-semibold text-foreground">{post.title}</h3>
                                  <span className="text-xs text-muted-foreground">{formattedDate}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Visualizar"
                                    onClick={(event) => event.stopPropagation()}
                                    asChild
                                  >
                                    <Link to={`/postagem/${post.slug}`}>
                                      <Eye className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Copiar link"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCopyLink(post.slug);
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  {canManagePosts ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Excluir"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleDeletePost(post);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {post.excerpt || "Sem prévia cadastrada."}
                              </p>
                              {tags.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {tags.slice(0, 4).map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-[10px] uppercase">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-2">
                                  <UserRound className="h-4 w-4" />
                                  {post.author || "Autor não definido"}
                                </span>
                                <span className="inline-flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  {post.views} visualizações
                                </span>
                                <span className="inline-flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4" />
                                  {post.commentsCount} comentários
                                </span>
                                <span className="ml-auto text-xs text-muted-foreground">/{post.slug}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
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
                      {trashedPosts.map((post) => (
                        <div
                          key={`trash-${post.id}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
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
          </main>
      </DashboardShell>


      <ImageLibraryDialog
        open={isLibraryOpen}
        onOpenChange={setIsLibraryOpen}
        apiBase={apiBase}
        description="Escolha uma imagem ja enviada ou use capas/banners de projetos."
        listFolders={[""]}
        showAltInput={imageTarget === "editor"}
        allowDeselect={imageTarget === "cover"}
        selectOnUpload
        currentSelectionUrl={imageTarget === "cover" ? formState.coverImageUrl : undefined}
        onSelect={handleLibrarySelect}
        sections={[
          {
            title: "Projetos",
            items: projectLibraryItems,
          },
        ]}
      />

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inserir link</DialogTitle>
            <DialogDescription>Adicione um hyperlink no conteúdo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Texto</Label>
              <Input value={linkText} onChange={(event) => setLinkText(event.target.value)} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsLinkDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleInsertLink}>Inserir link</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Incorporar vídeo</DialogTitle>
            <DialogDescription>Cole o link do YouTube ou Vimeo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL do vídeo</Label>
              <Input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsVideoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleInsertVideo}>Inserir vídeo</Button>
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







