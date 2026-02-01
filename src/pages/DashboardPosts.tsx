import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Calendar,
  Copy,
  Edit3,
  Eye,
  FileImage,
  FileText,
  FolderCog,
  Italic,
  LayoutGrid,
  Link as LinkIcon,
  List,
  ListOrdered,
  MessageSquare,
  Plus,
  Redo2,
  Settings,
  Shield,
  Strikethrough,
  Underline,
  Undo2,
  UserRound,
  Video,
} from "lucide-react";
import { createSlug, renderPostContent } from "@/lib/post-content";
import { projectData } from "@/data/projects";
import ProjectEmbedCard from "@/components/ProjectEmbedCard";

const menuItems = [
  { label: "Início", href: "/dashboard", icon: LayoutGrid, enabled: true },
  { label: "Post", href: "/dashboard/posts", icon: FileText, enabled: true },
  { label: "Projetos", href: "/dashboard/projetos", icon: FolderCog, enabled: false },
  { label: "Comentários", href: "/dashboard/comentarios", icon: MessageSquare, enabled: false },
  { label: "Usuários", href: "/dashboard/usuarios", icon: UserRound, enabled: true },
  { label: "Páginas", href: "/dashboard/paginas", icon: Shield, enabled: false },
  { label: "Configurações", href: "/dashboard/configuracoes", icon: Settings, enabled: false },
];

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
  seoTitle: "",
  seoDescription: "",
  status: "draft" as "draft" | "scheduled" | "published",
  publishAt: "",
  projectId: "",
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
  views: number;
  commentsCount: number;
};

type UserRecord = {
  id: string;
  permissions: string[];
};

const DashboardPosts = () => {
  const location = useLocation();
  const apiBase = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8080";
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PostRecord | null>(null);
  const [formState, setFormState] = useState(emptyForm);
  const [isSlugCustom, setIsSlugCustom] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyGuard = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

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

  const currentContent =
    formState.contentFormat === "markdown" ? formState.contentMarkdown : formState.contentHtml;

  useEffect(() => {
    if (!isSlugCustom) {
      setFormState((prev) => ({ ...prev, slug: createSlug(prev.title) }));
    }
  }, [formState.title, isSlugCustom]);

  useEffect(() => {
    if (!isEditorOpen) {
      return;
    }
    setHistory([currentContent]);
    setHistoryIndex(0);
  }, [isEditorOpen, formState.contentFormat]);

  useEffect(() => {
    if (!isEditorOpen || historyGuard.current) {
      historyGuard.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        if (next[next.length - 1] !== currentContent) {
          next.push(currentContent);
          setHistoryIndex(next.length - 1);
        }
        return next;
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [currentContent, historyIndex, isEditorOpen]);

  const loadPosts = async () => {
    const response = await fetch(`${apiBase}/api/posts`, { credentials: "include" });
    if (!response.ok) {
      throw new Error("posts_load_failed");
    }
    const data = await response.json();
    setPosts(Array.isArray(data.posts) ? data.posts : []);
  };

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const [postsRes, usersRes, meRes] = await Promise.all([
          fetch(`${apiBase}/api/posts`, { credentials: "include" }),
          fetch(`${apiBase}/api/users`, { credentials: "include" }),
          fetch(`${apiBase}/api/me`, { credentials: "include" }),
        ]);

        if (postsRes.ok) {
          const data = await postsRes.json();
          if (isActive) {
            setPosts(Array.isArray(data.posts) ? data.posts : []);
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

  const openCreate = () => {
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
      seoTitle: post.seoTitle || "",
      seoDescription: post.seoDescription || "",
      status: post.status || "draft",
      publishAt: post.publishedAt ? post.publishedAt.slice(0, 16) : "",
      projectId: post.projectId || "",
    });
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingPost(null);
  };

  const updateContent = (value: string) => {
    if (formState.contentFormat === "markdown") {
      setFormState((prev) => ({ ...prev, contentMarkdown: value }));
    } else {
      setFormState((prev) => ({ ...prev, contentHtml: value }));
    }
  };

  const applyWrap = (before: string, after = before) => {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = currentContent.slice(start, end);
    const next = `${currentContent.slice(0, start)}${before}${selected}${after}${currentContent.slice(end)}`;
    updateContent(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    });
  };

  const applyLinePrefix = (prefix: string) => {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = currentContent.slice(start, end) || "";
    const lines = selected.split(/\r?\n/).map((line) => `${prefix}${line}`);
    const next = `${currentContent.slice(0, start)}${lines.join("\n")}${currentContent.slice(end)}`;
    updateContent(next);
    requestAnimationFrame(() => {
      textarea.focus();
    });
  };

  const applyAlign = (align: "left" | "center" | "right") => {
    const block = `<div style="text-align:${align}">${currentContent ? currentContent : "Texto"}</div>`;
    updateContent(block);
  };

  const applyColor = (color: string, type: "text" | "background") => {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = currentContent.slice(start, end) || "Texto";
    const style = type === "text" ? `color:${color};` : `background-color:${color};`;
    const wrapped = `<span style="${style}">${selected}</span>`;
    const next = `${currentContent.slice(0, start)}${wrapped}${currentContent.slice(end)}`;
    updateContent(next);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) {
      return;
    }
    historyGuard.current = true;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    updateContent(history[nextIndex]);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) {
      return;
    }
    historyGuard.current = true;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    updateContent(history[nextIndex]);
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
    const response = await fetch(`${apiBase}/api/uploads/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ dataUrl, filename: file.name }),
    });
    if (!response.ok) {
      throw new Error("upload_failed");
    }
    const data = await response.json();
    return String(data.url || "");
  };

  const handleUploadCover = async (file: File) => {
    try {
      setIsUploading(true);
      const url = await uploadImage(file);
      setFormState((prev) => ({ ...prev, coverImageUrl: url }));
      toast({ title: "Capa enviada", description: "Imagem salva e vinculada ao post." });
    } catch {
      toast({ title: "Não foi possível enviar a capa" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleInsertImage = () => {
    if (!imageUrl) {
      return;
    }
    const alt = imageAlt || "Imagem";
    if (formState.contentFormat === "markdown") {
      updateContent(`${currentContent}\n\n![${alt}](${imageUrl})\n`);
    } else {
      updateContent(`${currentContent}\n\n<img src="${imageUrl}" alt="${alt}" loading="lazy" />\n`);
    }
    setImageUrl("");
    setImageAlt("");
    setImageFile(null);
    setIsImageDialogOpen(false);
  };

  const handleUploadImage = async () => {
    if (!imageFile) {
      return;
    }
    try {
      setIsUploading(true);
      const url = await uploadImage(imageFile);
      setImageUrl(url);
    } catch {
      toast({ title: "Não foi possível enviar a imagem" });
    } finally {
      setIsUploading(false);
    }
  };

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
      resolvedStatus === "published" ? publishAtValue || new Date().toISOString() : publishAtValue;
    const payload = {
      title: formState.title.trim(),
      slug: formState.slug.trim(),
      coverImageUrl: formState.coverImageUrl.trim() || null,
      coverAlt: formState.coverAlt.trim(),
      excerpt: formState.excerpt.trim(),
      content:
        formState.contentFormat === "markdown" ? formState.contentMarkdown : formState.contentHtml,
      contentFormat: formState.contentFormat,
      author: formState.author.trim(),
      publishedAt: resolvedPublishedAt,
      status: resolvedStatus,
      seoTitle: formState.seoTitle.trim(),
      seoDescription: formState.seoDescription.trim(),
      projectId: formState.projectId || "",
    };

    if (!payload.title || !payload.slug) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Título e slug são necessários para criar a postagem.",
      });
      return;
    }

    const response = await fetch(
      `${apiBase}/api/posts${editingPost ? `/${editingPost.id}` : ""}`,
      {
        method: editingPost ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
    toast({
      title: editingPost ? "Postagem atualizada" : "Postagem criada",
      description: "As alterações já estão na dashboard.",
    });
  };

  const handleDelete = async () => {
    if (!editingPost) {
      return;
    }
    const response = await fetch(`${apiBase}/api/posts/${editingPost.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      toast({ title: "Não foi possível excluir a postagem" });
      return;
    }
    await loadPosts();
    closeEditor();
    toast({ title: "Postagem removida" });
  };

  const previewContent = renderPostContent(currentContent || formState.excerpt, formState.contentFormat);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <SidebarProvider>
        <Sidebar collapsible="icon" className="border-r border-border/60 bg-background/80">
          <SidebarHeader className="border-b border-border/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Dashboard</p>
                <p className="text-sm font-semibold text-foreground">Visão geral</p>
              </div>
              <SidebarTrigger />
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3 py-5">
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.href}>
                    <Link
                      to={item.href}
                      className={item.enabled ? "opacity-100" : "pointer-events-none opacity-40"}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <SidebarSeparator className="my-6" />
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-4 text-xs text-muted-foreground">
              Posts, redes sociais e atualizações podem ser gerenciados por aqui.
            </div>
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          <main className="px-6 pb-20 pt-10 md:px-10">
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
              {canManagePosts && (
                <Button className="gap-2" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Nova postagem
                </Button>
              )}
            </div>

            {isEditorOpen && canManagePosts ? (
              <section className="mt-10 space-y-8">
                <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <Tabs
                      value={formState.contentFormat}
                      onValueChange={(value) =>
                        setFormState((prev) => ({
                          ...prev,
                          contentFormat: value === "html" ? "html" : "markdown",
                        }))
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <TabsList>
                          <TabsTrigger value="markdown">Markdown</TabsTrigger>
                          <TabsTrigger value="html">HTML</TabsTrigger>
                        </TabsList>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="ghost" size="icon" onClick={() => applyWrap("**")}
                            title="Negrito">
                            <Bold className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => applyWrap("*")}
                            title="Itálico">
                            <Italic className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => applyWrap("<u>", "</u>")}
                            title="Sublinhado">
                            <Underline className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => applyWrap("~~")}
                            title="Tachado">
                            <Strikethrough className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => applyLinePrefix("- ")}
                            title="Lista">
                            <List className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => applyLinePrefix("1. ")}
                            title="Lista numerada">
                            <ListOrdered className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => applyAlign("left")}
                            title="Alinhar à esquerda">
                            <AlignLeft className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => applyAlign("center")}
                            title="Centralizar">
                            <AlignCenter className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => applyAlign("right")}
                            title="Alinhar à direita">
                            <AlignRight className="h-4 w-4" />
                          </Button>
                          <input
                            type="color"
                            aria-label="Cor do texto"
                            className="h-9 w-9 rounded-md border border-border/60 bg-transparent p-1"
                            onChange={(event) => applyColor(event.target.value, "text")}
                          />
                          <input
                            type="color"
                            aria-label="Cor de fundo"
                            className="h-9 w-9 rounded-md border border-border/60 bg-transparent p-1"
                            onChange={(event) => applyColor(event.target.value, "background")}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsImageDialogOpen(true)}
                            title="Imagem"
                          >
                            <FileImage className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const url = window.prompt("URL do vídeo (YouTube/Vimeo)");
                              if (!url) {
                                return;
                              }
                              const embedUrl = url.includes("youtube.com")
                                ? url.replace("watch?v=", "embed/")
                                : url;
                              updateContent(
                                `${currentContent}\n\n<iframe src="${embedUrl}" title="Video" allowfullscreen></iframe>\n`,
                              );
                            }}
                            title="Incorporar vídeo"
                          >
                            <Video className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={handleUndo} title="Desfazer">
                            <Undo2 className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={handleRedo} title="Refazer">
                            <Redo2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <TabsContent value={formState.contentFormat}>
                        <Textarea
                          ref={editorRef}
                          value={currentContent}
                          onChange={(event) => updateContent(event.target.value)}
                          placeholder="Escreva o conteúdo do post..."
                          className="min-h-[320px]"
                        />
                      </TabsContent>
                    </Tabs>
                    {formState.coverImageUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          const alt = formState.coverAlt || formState.title || "Capa";
                          if (formState.contentFormat === "markdown") {
                            updateContent(`${currentContent}\n\n![${alt}](${formState.coverImageUrl})\n`);
                          } else {
                            updateContent(
                              `${currentContent}\n\n<img src="${formState.coverImageUrl}" alt="${alt}" loading="lazy" />\n`,
                            );
                          }
                        }}
                      >
                        <LinkIcon className="h-4 w-4" />
                        Inserir capa no texto
                      </Button>
                    ) : null}
                  </div>

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
                          <Label htmlFor="post-excerpt">Prévia</Label>
                          <Textarea
                            id="post-excerpt"
                            value={formState.excerpt}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, excerpt: event.target.value }))
                            }
                            rows={4}
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
                          <Label htmlFor="post-cover">Capa</Label>
                          <Input
                            id="post-cover"
                            value={formState.coverImageUrl}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, coverImageUrl: event.target.value }))
                            }
                            placeholder="https://..."
                          />
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                handleUploadCover(file);
                              }
                            }}
                          />
                          <Input
                            value={formState.coverAlt}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, coverAlt: event.target.value }))
                            }
                            placeholder="Texto alternativo (SEO)"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/80">
                      <CardContent className="space-y-4 p-6">
                        <div className="space-y-2">
                          <Label>SEO</Label>
                          <Input
                            value={formState.seoTitle}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, seoTitle: event.target.value }))
                            }
                            placeholder="Título para buscadores"
                          />
                          <Textarea
                            value={formState.seoDescription}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, seoDescription: event.target.value }))
                            }
                            rows={3}
                            placeholder="Descrição para SEO"
                          />
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
                              {projectData.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  {project.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex flex-wrap gap-3">
                      {editingPost ? (
                        <>
                          <Button onClick={() => handleSave()} className="gap-2">
                            <Edit3 className="h-4 w-4" />
                            Salvar
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleDelete}>
                            Excluir
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
                        </>
                      )}
                      <Button variant="ghost" onClick={closeEditor}>
                        Fechar
                      </Button>
                    </div>
                  </aside>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card/80 p-6">
                  <h2 className="text-lg font-semibold text-foreground">Preview</h2>
                  <div className="mt-6 space-y-6">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <UserRound className="h-4 w-4" />
                        {formState.author || "Autor"}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formState.publishAt ? new Date(formState.publishAt).toLocaleString("pt-BR") : ""}
                      </span>
                    </div>
                    <h3 className="text-2xl font-semibold text-foreground">{formState.title || "Sem título"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formState.excerpt || "Sem prévia cadastrada."}
                    </p>
                    <div className="overflow-hidden rounded-2xl border border-border">
                      <img
                        src={formState.coverImageUrl || "/placeholder.svg"}
                        alt={formState.coverAlt || formState.title || "Capa"}
                        className="aspect-[3/2] w-full object-cover"
                      />
                    </div>
                    <div
                      className="post-content space-y-4 text-sm text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: previewContent }}
                    />
                    {formState.projectId ? <ProjectEmbedCard projectId={formState.projectId} /> : null}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="mt-10">
              {isLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
                  Carregando postagens...
                </div>
              ) : posts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
                  Nenhuma postagem cadastrada ainda.
                </div>
              ) : (
                <div className="grid gap-6">
                  {posts.map((post) => {
                    const formattedDate = post.publishedAt
                      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
                          new Date(post.publishedAt),
                        )
                      : "Sem data";
                    return (
                      <Card
                        key={post.id}
                        className="overflow-hidden border-border/60 bg-card/80 shadow-lg transition hover:border-primary/40"
                      >
                        <CardContent className="p-0">
                          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                            <div className="relative h-48 w-full md:h-full">
                              {post.coverImageUrl ? (
                                <img
                                  src={post.coverImageUrl}
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
                            <div className="flex flex-col gap-4 p-6">
                              <div className="flex flex-wrap items-center gap-3">
                                <h3 className="text-lg font-semibold text-foreground">{post.title}</h3>
                                <Badge variant="secondary" className="text-[10px] uppercase">
                                  {post.slug}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  {post.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {post.excerpt || "Sem prévia cadastrada."}
                              </p>
                              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-2">
                                  <UserRound className="h-4 w-4" />
                                  {post.author || "Autor não definido"}
                                </span>
                                <span className="inline-flex items-center gap-2">
                                  <Calendar className="h-4 w-4" />
                                  {formattedDate}
                                </span>
                                <span className="inline-flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  {post.views} visualizações
                                </span>
                                <span className="inline-flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4" />
                                  {post.commentsCount} comentários
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-3">
                                <Button
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => handleCopyLink(post.slug)}
                                >
                                  <Copy className="h-4 w-4" />
                                  Copiar link
                                </Button>
                                {canManagePosts && (
                                  <Button
                                    variant="secondary"
                                    className="gap-2"
                                    onClick={() => openEdit(post)}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                    Editar
                                  </Button>
                                )}
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
        </SidebarInset>
      </SidebarProvider>

      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inserir imagem</DialogTitle>
            <DialogDescription>
              Envie uma imagem para o armazenamento do site ou informe uma URL externa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL da imagem</Label>
              <Input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Texto alternativo (alt)</Label>
              <Input value={imageAlt} onChange={(event) => setImageAlt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Upload</Label>
              <Input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] || null)} />
              <Button type="button" variant="outline" disabled={!imageFile || isUploading} onClick={handleUploadImage}>
                {isUploading ? "Enviando..." : "Enviar imagem"}
              </Button>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsImageDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleInsertImage}>Inserir no texto</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default DashboardPosts;

