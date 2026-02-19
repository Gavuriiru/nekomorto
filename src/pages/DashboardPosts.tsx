import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import DashboardShell from "@/components/DashboardShell";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import { dashboardPageLayoutTokens } from "@/components/dashboard/dashboard-page-tokens";
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
  const [isEditorOpen, setIsEditorOpen] = useState(false);
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
  const editorRef = useRef<Suspense fallback={<LexicalEditorFallback />}>
                    <LexicalEditor
                      ref={editorRef}
                      value={formState.contentLexical}
                      onChange={(value) =>
                        setFormState((prev) => ({
                          ...prev,
                          contentLexical: value,
                        }))
                      }
                      placeholder="Escreva o conte�do do post..."
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
                <div className={`${dashboardPageLayoutTokens.surfaceDefault} px-6 py-10 text-sm text-muted-foreground`}>
                  Carregando postagens...
                </div>
              ) : sortedPosts.length === 0 ? (
                <div
                  className={`${dashboardPageLayoutTokens.surfaceMuted} border-dashed px-6 py-10 text-sm text-muted-foreground`}
                >
                  Nenhuma postagem cadastrada ainda.
                </div>
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
                        onClick={() => {
                          if (canManagePosts) {
                            openEdit(post);
                          }
                        }}
                      >
                        <CardContent className="p-0">
                          <div className="grid min-h-[360px] gap-0 lg:h-[280px] lg:min-h-0 lg:grid-cols-[220px_1fr]">
                            <div className="relative h-52 w-full lg:h-full">
                              {resolvedCardCover.coverImageUrl ? (
                                <img
                                  src={normalizeAssetUrl(resolvedCardCover.coverImageUrl)}
                                  alt={resolvedCardCover.coverAlt || post.title}
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
                            <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-2 p-4 lg:pb-5">
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
                                className="line-clamp-2 min-h-0 overflow-hidden text-sm text-muted-foreground lg:line-clamp-1"
                              >
                                {post.excerpt || "Sem prévia cadastrada."}
                              </p>

                              <div className="flex min-h-0 flex-col gap-2">
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








