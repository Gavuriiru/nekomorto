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
import { toast } from "@/components/ui/use-toast";
import { usePostEditorState } from "@/hooks/use-post-editor-state";
import PostContentEditor from "@/components/PostContentEditor";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Calendar,
  Copy,
  Edit3,
  Eye,
  MessageSquare,
  Plus,
  Trash2,
  X,
  UserRound,
} from "lucide-react";
import { convertPostContent, createSlug, renderPostContent, stripHtml } from "@/lib/post-content";
import type { Project } from "@/data/projects";
import ProjectEmbedCard from "@/components/ProjectEmbedCard";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { formatDateTimeShort } from "@/lib/date";
import { usePageMeta } from "@/hooks/use-page-meta";
import { normalizeAssetUrl } from "@/lib/asset-url";

const emptyForm = {
  title: "",
  slug: "",
  excerpt: "",
  contentMarkdown: "",
  contentHtml: "",
  contentFormat: "markdown" as "markdown" | "html",
  author: "",
  coverImageUrl: "",
  coverAlt: "",
  status: "draft" as "draft" | "scheduled" | "published",
  publishAt: "",
  projectId: "",
  tags: [] as string[],
};

type PostRecord = {
  id: string;
  title: string;
  slug: string;
  coverImageUrl?: string | null;
  coverAlt?: string | null;
  excerpt: string;
  content: string;
  contentFormat: "markdown" | "html";
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
};

type UserRecord = {
  id: string;
  permissions: string[];
};

const DashboardPosts = () => {
  usePageMeta({ title: "Posts", noIndex: true });
  const navigate = useNavigate();
  const apiBase = getApiBase();
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
  const [imageEditOpen, setImageEditOpen] = useState(false);
  const [imageEditSrc, setImageEditSrc] = useState("");
  const [imageEditAlt, setImageEditAlt] = useState("");
  const [imageEditWidth, setImageEditWidth] = useState("");
  const [imageEditAlign, setImageEditAlign] = useState<"left" | "center" | "right">("center");
  const [imageEditMarkup, setImageEditMarkup] = useState("");
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
  const [colorTarget, setColorTarget] = useState<"text" | "background">("text");
  const [colorValue, setColorValue] = useState("#ffffff");
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const [isGradientDialogOpen, setIsGradientDialogOpen] = useState(false);
  const [gradientStart, setGradientStart] = useState("#ff6ec7");
  const [gradientEnd, setGradientEnd] = useState("#7dd3fc");
  const [gradientAngle, setGradientAngle] = useState(135);
  const [gradientTarget, setGradientTarget] = useState<"text" | "background">("text");
  const [sortMode, setSortMode] = useState<"recent" | "alpha" | "tags" | "projects" | "status" | "views" | "comments">("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilterId, setProjectFilterId] = useState<string>("all");
  const [projectFilterQuery, setProjectFilterQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PostRecord | null>(null);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const [tagOrder, setTagOrder] = useState<string[]>([]);
  const [draggedTag, setDraggedTag] = useState<string | null>(null);
  const draggedImageRef = useRef<{ url: string; alt: string } | null>(null);
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
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const {
    currentContent,
    updateContent,
    applyTextEdit,
    insertAtCursor,
    applyWrap,
    applyLinePrefix,
    handleUnorderedList,
    handleOrderedList,
    handleUndo,
    handleRedo,
  } = usePostEditorState({
    formState,
    setFormState,
    editorRef,
    isEditorOpen,
  });

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
      formState.contentMarkdown ||
      formState.contentHtml ||
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
          publishAt: new Date().toISOString().slice(0, 16),
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
      publishAt: new Date().toISOString().slice(0, 16),
    });
    setIsEditorOpen(true);
  };

  const openEdit = (post: PostRecord) => {
    setEditingPost(post);
    setIsSlugCustom(true);
    setFormState({
      title: post.title || "",
      slug: post.slug || "",
      excerpt: post.excerpt || "",
      contentMarkdown: post.contentFormat === "markdown" ? post.content || "" : "",
      contentHtml: post.contentFormat === "html" ? post.content || "" : "",
      contentFormat: post.contentFormat || "markdown",
      author: post.author || "",
      coverImageUrl: post.coverImageUrl || "",
      coverAlt: post.coverAlt || "",
      status: post.status || "draft",
      publishAt: post.publishedAt ? post.publishedAt.slice(0, 16) : "",
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
  const availableTags = useMemo(() => {
    const collected = new Set<string>();
    projects.forEach((project) => {
      (project.tags || []).forEach((tag) => {
        if (tag) {
          collected.add(tag);
        }
      });
    });
    posts.forEach((post) => {
      (post.tags || []).forEach((tag) => {
        if (tag) {
          collected.add(tag);
        }
      });
    });
    return Array.from(collected).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [posts, projects]);
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
        return posts.filter((post) => post.projectId === projectFilterId);
      }
      return posts;
    }
    return posts.filter((post) => {
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
  }, [posts, projectFilterId, projectMap, searchQuery, sortMode]);

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

  const handleFormatChange = (value: "markdown" | "html") => {
    if (value === formState.contentFormat) {
      return;
    }
    if (value === "html") {
      const html = convertPostContent(formState.contentMarkdown || "", "markdown", "html");
      setFormState((prev) => ({
        ...prev,
        contentFormat: "html",
        contentHtml: html,
      }));
      return;
    }
    const markdown = convertPostContent(formState.contentHtml || "", "html", "markdown");
    setFormState((prev) => ({
      ...prev,
      contentFormat: "markdown",
      contentMarkdown: markdown,
    }));
  };

  const applyAlign = (align: "left" | "center" | "right") => {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    if (start === end) {
      toast({ title: "Selecione um trecho para alinhar." });
      return;
    }
    const selected = currentContent.slice(start, end);
    const block = `<div style="text-align:${align}">${selected}</div>`;
    const next = `${currentContent.slice(0, start)}${block}${currentContent.slice(end)}`;
    applyTextEdit(next, start, start + block.length, scrollTop);
  };

  const applyColor = (color: string, type: "text" | "background") => {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    if (start === end) {
      toast({ title: "Selecione um trecho para aplicar cor." });
      return;
    }
    const selected = currentContent.slice(start, end);
    const style = type === "text" ? `color:${color};` : `background-color:${color};`;
    const existingSpanMatch = selected.match(/^<span style="[^"]*">([\s\S]*)<\/span>$/);
    const inner = existingSpanMatch ? existingSpanMatch[1] : selected;
    const wrapped = `<span style="${style}">${inner}</span>`;
    const next = `${currentContent.slice(0, start)}${wrapped}${currentContent.slice(end)}`;
    applyTextEdit(next, start, start + wrapped.length, scrollTop);
  };

  const applyGradient = () => {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    if (start === end) {
      toast({ title: "Selecione um trecho para aplicar gradiente." });
      return;
    }
    const selected = currentContent.slice(start, end);
    const gradient = `linear-gradient(${gradientAngle}deg, ${gradientStart}, ${gradientEnd})`;
    const style =
      gradientTarget === "text"
        ? `background:${gradient};-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent;display:inline-block;`
        : `background:${gradient};`;
    const wrapped = `<span style="${style}">${selected}</span>`;
    const next = `${currentContent.slice(0, start)}${wrapped}${currentContent.slice(end)}`;
    applyTextEdit(next, start, start + wrapped.length, scrollTop);
    setIsGradientDialogOpen(false);
  };

  const openColorDialog = (type: "text" | "background") => {
    setColorTarget(type);
    setIsColorDialogOpen(true);
  };

  useEffect(() => {
    if (!isColorDialogOpen) {
      return;
    }
    const timer = window.setTimeout(() => {
      colorInputRef.current?.click();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isColorDialogOpen]);

  const applyColorSelection = () => {
    applyColor(colorValue, colorTarget);
    setIsColorDialogOpen(false);
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

  const handleApplyHeading = () => {
    if (formState.contentFormat === "html") {
      applyWrap("<h2>", "</h2>");
      return;
    }
    applyLinePrefix("# ");
  };

  const getFirstImageFromContent = () => {
    const content =
      formState.contentFormat === "markdown" ? formState.contentMarkdown : formState.contentHtml;
    const markdownMatch = content.match(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/i);
    if (markdownMatch) {
      return { url: markdownMatch[2], alt: markdownMatch[1] || "" };
    }
    const htmlMatch = content.match(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/i);
    if (htmlMatch) {
      return { url: htmlMatch[1], alt: htmlMatch[2] || "" };
    }
    const htmlSrcMatch = content.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
    if (htmlSrcMatch) {
      return { url: htmlSrcMatch[1], alt: "" };
    }
    return null;
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("file_read_failed"));
      reader.readAsDataURL(file);
    });

  const uploadImage = async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    const response = await apiFetch(apiBase, "/api/uploads/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      auth: true,
      body: JSON.stringify({ dataUrl, filename: file.name }),
    });
    if (!response.ok) {
      throw new Error("upload_failed");
    }
    const data = await response.json();
    return String(data.url || "");
  };

  const insertImageToContent = useCallback(
    (url: string, altText?: string) => {
      const alt = altText || "Imagem";
      if (formState.contentFormat === "markdown") {
        insertAtCursor(`\n\n![${alt}](${url})\n`);
      } else {
        insertAtCursor(`\n\n<img src="${url}" alt="${alt}" loading="lazy" />\n`);
      }
    },
    [formState.contentFormat, insertAtCursor],
  );

  const insertAtCursorWithContent = (baseContent: string, text: string) => {
    const textarea = editorRef.current;
    if (!textarea) {
      updateContent(`${baseContent}${text}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    const next = `${baseContent.slice(0, start)}${text}${baseContent.slice(end)}`;
    applyTextEdit(next, start + text.length, start + text.length, scrollTop);
  };

  const insertAtCursorWithoutReplace = (baseContent: string, text: string) => {
    const textarea = editorRef.current;
    if (!textarea) {
      updateContent(`${baseContent}${text}`);
      return;
    }
    const start = textarea.selectionStart;
    const scrollTop = textarea.scrollTop;
    const next = `${baseContent.slice(0, start)}${text}${baseContent.slice(start)}`;
    applyTextEdit(next, start + text.length, start + text.length, scrollTop);
  };

  const insertAtPosition = (baseContent: string, text: string, position: number) => {
    const textarea = editorRef.current;
    const safePosition = Math.max(0, Math.min(position, baseContent.length));
    const scrollTop = textarea?.scrollTop ?? 0;
    const next = `${baseContent.slice(0, safePosition)}${text}${baseContent.slice(safePosition)}`;
    applyTextEdit(next, safePosition + text.length, safePosition + text.length, scrollTop);
  };

  const insertImageBeforeTarget = (content: string, imageMarkup: string, targetUrl: string) => {
    const escaped = targetUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const markdownRegex = new RegExp(`!\\[[^\\]]*\\]\\(${escaped}[^)]*\\)`, "i");
    const htmlRegex = new RegExp(`<img[^>]*src=["']${escaped}["'][^>]*>`, "i");
    const markdownMatch = content.match(markdownRegex);
    if (markdownMatch?.index !== undefined) {
      return `${content.slice(0, markdownMatch.index)}${imageMarkup}\n\n${content.slice(markdownMatch.index)}`;
    }
    const htmlMatch = content.match(htmlRegex);
    if (htmlMatch?.index !== undefined) {
      return `${content.slice(0, htmlMatch.index)}${imageMarkup}\n\n${content.slice(htmlMatch.index)}`;
    }
    return `${content}${imageMarkup}`;
  };

  const removeImageFromContent = (url: string) => {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const markdownRegex = new RegExp(`!\\[([^\\]]*)\\]\\(${escaped}[^)]*\\)\\s*`, "i");
    const htmlRegex = new RegExp(`<img[^>]*src=["']${escaped}["'][^>]*>\\s*`, "i");
    let next = currentContent;
    let alt = "";
    const markdownMatch = next.match(markdownRegex);
    if (markdownMatch) {
      alt = markdownMatch[1] || "";
      next = next.replace(markdownRegex, "");
      return { next, alt };
    }
    const htmlMatch = next.match(
      new RegExp(`<img[^>]*src=["']${escaped}["'][^>]*alt=["']([^"']*)["'][^>]*>`, "i"),
    );
    if (htmlMatch) {
      alt = htmlMatch[1] || "";
      next = next.replace(htmlRegex, "");
      return { next, alt };
    }
    next = next.replace(htmlRegex, "");
    return { next, alt };
  };



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
    const contentHtml = renderPostContent(
      formState.contentFormat === "markdown" ? formState.contentMarkdown : formState.contentHtml,
      formState.contentFormat,
    );
    const seoDescription = stripHtml(contentHtml).trim().slice(0, 150);
    const fallbackImage = getFirstImageFromContent();
    const coverImageUrl = formState.coverImageUrl.trim() || fallbackImage?.url || null;
    const coverAlt = formState.coverAlt.trim() || fallbackImage?.alt || "";
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
      content:
        formState.contentFormat === "markdown" ? formState.contentMarkdown : formState.contentHtml,
      contentFormat: formState.contentFormat,
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

  const renderImagePanel = () => {
    if (editorImages.images.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-4 py-3 text-xs text-muted-foreground">
          Nenhuma imagem no texto.
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Imagens no texto</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {editorImages.images.map((image, index) => (
            <button
              key={`${image.src}-${index}`}
              type="button"
              draggable
              className="group flex w-40 flex-col gap-2 rounded-xl border border-border/60 bg-card/60 p-2 text-left transition hover:border-primary/40"
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-editor-image-index", String(index));
                event.dataTransfer.setData("text/plain", String(index));
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const fromIndex = Number(event.dataTransfer.getData("text/plain"));
                if (!Number.isNaN(fromIndex)) {
                  reorderEditorImages(fromIndex, index);
                }
              }}
              onClick={() => {
                const widthMatch = image.markup.match(/width\s*:\s*([^;"]+)[;"\s]/i);
                const attrWidthMatch = image.markup.match(/width=["']([^"']+)["']/i);
                const detectedWidth = (widthMatch?.[1] || attrWidthMatch?.[1] || "").trim();
                setImageEditSrc(image.src);
                setImageEditAlt(image.alt || "");
                setImageEditWidth(detectedWidth);
                setImageEditAlign("center");
                setImageEditMarkup(image.markup);
                setImageEditOpen(true);
              }}
            >
              <div className="relative h-20 w-full overflow-hidden rounded-lg bg-muted/30">
                <img src={image.src} alt={image.alt || "Imagem"} className="h-full w-full object-cover" />
              </div>
              <span className="text-[11px] text-muted-foreground line-clamp-2">
                {image.alt || "Imagem sem alt"}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Clique para editar a imagem. Arraste para reordenar. Para inserir no texto, posicione o cursor e arraste.
        </p>
      </div>
    );
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
    toast({ title: "Postagem removida" });
  };

  const previewContentRaw = renderPostContent(
    currentContent || formState.excerpt,
    formState.contentFormat,
  );
  const previewContent = previewContentRaw.replace(
    /<img([^>]*?)>/gi,
    (_match, attrs: string) => {
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      const src = srcMatch?.[1] || "";
      return `<img${attrs} data-editor-src="${src}" draggable="true">`;
    },
  );
  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      handleUndo();
    }
    if ((event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z") || (event.ctrlKey && event.key.toLowerCase() === "y")) {
      event.preventDefault();
      handleRedo();
    }
  };

  const handleEditorDrop = async (event: React.DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) {
      return;
    }
    const draggedIndexRaw = dataTransfer.getData("application/x-editor-image-index");
    if (draggedIndexRaw) {
      const fromIndex = Number(draggedIndexRaw);
      if (!Number.isNaN(fromIndex)) {
        moveEditorImageToCursor(fromIndex);
      }
      return;
    }
    const draggedUrl = dataTransfer.getData("application/x-editor-image");
    if (draggedUrl) {
      const { next, alt } = removeImageFromContent(draggedUrl);
      insertAtCursorWithContent(
        next,
        formState.contentFormat === "markdown"
          ? `\n\n![${alt || "Imagem"}](${draggedUrl})\n`
          : `\n\n<img src="${draggedUrl}" alt="${alt || "Imagem"}" loading="lazy" />\n`,
      );
      draggedImageRef.current = null;
      return;
    }
    if (!dataTransfer.files?.length) {
      const url = dataTransfer.getData("text/uri-list") || dataTransfer.getData("text/plain");
      if (url && /^https?:\/\//i.test(url)) {
        insertImageToContent(url, "Imagem");
      }
      return;
    }
    const file = dataTransfer.files[0];
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arraste apenas imagens para o editor." });
      return;
    }
    try {
      setIsUploading(true);
      const url = await uploadImage(file);
      const alt = file.name.replace(/\\.[^/.]+$/, "").replace(/[-_]/g, " ") || "Imagem";
      insertImageToContent(url, alt);
    } catch {
      toast({ title: "Não foi possível enviar a imagem" });
    } finally {
      setIsUploading(false);
    }
  };


  const applyImageUpdate = () => {
    if (!imageEditSrc || !imageEditMarkup) {
      setImageEditOpen(false);
      return;
    }
    const styleParts = ["height:auto;", "display:block;"];
    if (imageEditWidth.trim()) {
      styleParts.unshift(`width:${imageEditWidth.trim()};`);
    }
    if (imageEditAlign === "left") {
      styleParts.push("margin-right:auto;");
    } else if (imageEditAlign === "right") {
      styleParts.push("margin-left:auto;");
    } else {
      styleParts.push("margin-left:auto;");
      styleParts.push("margin-right:auto;");
    }
    const imgTag = `<img src="${imageEditSrc}" alt="${imageEditAlt || "Imagem"}" style="${styleParts.join("")}" loading="lazy" />`;

    const updated = currentContent.replace(imageEditMarkup, imgTag);
    updateContent(updated);
    setImageEditOpen(false);
  };

  const handleRemoveImage = () => {
    if (!imageEditMarkup) {
      setImageEditOpen(false);
      return;
    }
    const updated = currentContent.replace(imageEditMarkup, "");
    updateContent(updated);
    setImageEditOpen(false);
  };

  const openLinkDialog = () => {
    const textarea = editorRef.current;
    const start = textarea?.selectionStart ?? 0;
    const end = textarea?.selectionEnd ?? 0;
    const selected = currentContent.slice(start, end);
    setLinkText(selected.trim());
    setIsLinkDialogOpen(true);
  };

  const handleInsertLink = () => {
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) {
      return;
    }
    const text = (linkText || trimmedUrl).trim();
    const linkMarkup =
      formState.contentFormat === "markdown"
        ? `[${text}](${trimmedUrl})`
        : `<a href="${trimmedUrl}" target="_blank" rel="noreferrer">${text}</a>`;

    const textarea = editorRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const scrollTop = textarea.scrollTop;
      const next = `${currentContent.slice(0, start)}${linkMarkup}${currentContent.slice(end)}`;
      applyTextEdit(next, start + linkMarkup.length, start + linkMarkup.length, scrollTop);
    } else {
      updateContent(`${currentContent}\n\n${linkMarkup}\n`);
    }
    setLinkUrl("");
    setLinkText("");
    setIsLinkDialogOpen(false);
  };

  const openVideoDialog = () => {
    setIsVideoDialogOpen(true);
  };

  const editorImages = useMemo(() => {
    const content = currentContent;
    const images: Array<{ markup: string; src: string; alt: string }> = [];
    const segments: string[] = [];
    if (formState.contentFormat === "markdown") {
      const regex = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/gi;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        segments.push(content.slice(lastIndex, match.index));
        images.push({
          markup: match[0],
          alt: match[1] || "",
          src: match[2] || "",
        });
        lastIndex = match.index + match[0].length;
      }
      segments.push(content.slice(lastIndex));
    } else {
      const regex = /<img\b[^>]*>/gi;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        segments.push(content.slice(lastIndex, match.index));
        const markup = match[0];
        const srcMatch = markup.match(/src=["']([^"']+)["']/i);
        const altMatch = markup.match(/alt=["']([^"']*)["']/i);
        images.push({
          markup,
          alt: altMatch?.[1] || "",
          src: srcMatch?.[1] || "",
        });
        lastIndex = match.index + match[0].length;
      }
      segments.push(content.slice(lastIndex));
    }
    return { images, segments };
  }, [currentContent, formState.contentFormat]);

  const reorderEditorImages = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }
    const { images, segments } = editorImages;
    if (!images[fromIndex] || !images[toIndex]) {
      return;
    }
    const nextImages = [...images];
    const [moved] = nextImages.splice(fromIndex, 1);
    nextImages.splice(toIndex, 0, moved);
    let rebuilt = "";
    for (let i = 0; i < nextImages.length; i += 1) {
      rebuilt += segments[i] ?? "";
      rebuilt += nextImages[i]?.markup ?? "";
    }
    rebuilt += segments[nextImages.length] ?? "";
    updateContent(rebuilt);
  };

  const moveEditorImageToCursor = (fromIndex: number) => {
    const { images, segments } = editorImages;
    if (!images[fromIndex]) {
      return;
    }
    const textarea = editorRef.current;
    const cursorStart = textarea?.selectionStart ?? 0;
    let imageStart = 0;
    for (let i = 0; i < fromIndex; i += 1) {
      imageStart += (segments[i]?.length ?? 0);
      imageStart += images[i]?.markup.length ?? 0;
    }
    imageStart += segments[fromIndex]?.length ?? 0;
    const imageLength = images[fromIndex].markup.length;
    const imageEnd = imageStart + imageLength;
    const baseContent = `${currentContent.slice(0, imageStart)}${currentContent.slice(imageEnd)}`;
    let insertPosition = cursorStart;
    if (cursorStart > imageEnd) {
      insertPosition = cursorStart - imageLength;
    } else if (cursorStart >= imageStart) {
      insertPosition = imageStart;
    }
    insertAtPosition(baseContent, images[fromIndex].markup, insertPosition);
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
    insertAtCursor(`\n\n<iframe src="${embedUrl}" title="Video" allowfullscreen></iframe>\n`);
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
                  <PostContentEditor
                    format={formState.contentFormat}
                    value={currentContent}
                    onFormatChange={handleFormatChange}
                    onChange={updateContent}
                    onApplyWrap={applyWrap}
                    onApplyHeading={handleApplyHeading}
                    onApplyUnorderedList={handleUnorderedList}
                    onApplyOrderedList={handleOrderedList}
                    onAlign={applyAlign}
                    onColor={applyColor}
                    onOpenColorDialog={openColorDialog}
                    onOpenGradientDialog={() => setIsGradientDialogOpen(true)}
                    onOpenImageDialog={() => openLibrary("editor")}
                    onOpenLinkDialog={openLinkDialog}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onEmbedVideo={openVideoDialog}
                    onKeyDown={handleEditorKeyDown}
                    onDrop={handleEditorDrop}
                    textareaRef={editorRef}
                    previewHtml={previewContent}
                    coverImageUrl={formState.coverImageUrl || getFirstImageFromContent()?.url}
                    coverAlt={formState.coverAlt || getFirstImageFromContent()?.alt}
                    title={formState.title}
                    excerpt={formState.excerpt}
                    imagePanel={renderImagePanel()}
                    onPreviewClick={(event) => {
                      const target = event.target as HTMLElement | null;
                      if (!target || target.tagName !== "IMG") {
                        return;
                      }
                      const img = target as HTMLImageElement;
                      setImageEditSrc(img.src);
                      setImageEditAlt(img.alt || "");
                      setImageEditWidth("100%");
                      setImageEditAlign("center");
                      setImageEditOpen(true);
                    }}
                    previewMeta={
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <UserRound className="h-4 w-4" />
                          {formState.author || "Autor"}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formState.publishAt ? formatDateTimeShort(formState.publishAt) : ""}
                        </span>
                      </div>
                    }
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
                          <Input
                            id="post-date"
                            type="datetime-local"
                            value={formState.publishAt}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, publishAt: event.target.value }))
                            }
                          />
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

      <Dialog open={isGradientDialogOpen} onOpenChange={setIsGradientDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gradiente</DialogTitle>
            <DialogDescription>Crie um gradiente para texto ou fundo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="h-14 w-full rounded-xl border border-border/60"
              style={{
                background: `linear-gradient(${gradientAngle}deg, ${gradientStart}, ${gradientEnd})`,
              }}
            />
            <div className="space-y-2">
              <Label>Aplicar em</Label>
              <Select value={gradientTarget} onValueChange={(value) => setGradientTarget(value as "text" | "background")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="background">Fundo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cor inicial</Label>
                <Input type="color" value={gradientStart} onChange={(event) => setGradientStart(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cor final</Label>
                <Input type="color" value={gradientEnd} onChange={(event) => setGradientEnd(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ângulo</Label>
              <Input
                type="number"
                min={0}
                max={360}
                value={gradientAngle}
                onChange={(event) => setGradientAngle(Number(event.target.value || 0))}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsGradientDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={applyGradient}>Aplicar gradiente</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cor sólida</DialogTitle>
            <DialogDescription>Escolha uma cor para o texto ou fundo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/70 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {colorTarget === "text" ? "Texto" : "Fundo"}
              </span>
              <div className="flex items-center gap-3">
                <input
                  ref={colorInputRef}
                  type="color"
                  value={colorValue}
                  onChange={(event) => setColorValue(event.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-md border border-border/60 bg-transparent p-1"
                />
                <span className="text-xs text-muted-foreground">{colorValue}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsColorDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={applyColorSelection}>Aplicar cor</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={imageEditOpen} onOpenChange={setImageEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar imagem</DialogTitle>
            <DialogDescription>Ajuste tamanho, alinhamento e texto alternativo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Alt</Label>
              <Input value={imageEditAlt} onChange={(event) => setImageEditAlt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Largura</Label>
              <Input value={imageEditWidth} onChange={(event) => setImageEditWidth(event.target.value)} placeholder="Ex: 100% ou 480px" />
            </div>
            <div className="space-y-2">
              <Label>Alinhamento</Label>
              <Select value={imageEditAlign} onValueChange={(value) => setImageEditAlign(value as "left" | "center" | "right")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="destructive" onClick={handleRemoveImage}>Excluir</Button>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setImageEditOpen(false)}>Cancelar</Button>
                <Button onClick={applyImageUpdate}>Salvar</Button>
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
              {deleteTarget ? `Excluir "${deleteTarget.title}"? Esta ação não pode ser desfeita.` : ""}
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







