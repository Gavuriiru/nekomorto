import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
import { Textarea } from "@/components/ui/textarea";
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
  Eye,
  FileText,
  FolderCog,
  LayoutGrid,
  MessageSquare,
  Plus,
  Settings,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import { projectData, Project } from "@/data/projects";
import { createSlug } from "@/lib/post-content";

const menuItems = [
  { label: "Início", href: "/dashboard", icon: LayoutGrid, enabled: true },
  { label: "Postagens", href: "/dashboard/posts", icon: FileText, enabled: true },
  { label: "Projetos", href: "/dashboard/projetos", icon: FolderCog, enabled: true },
  { label: "Comentários", href: "/dashboard/comentarios", icon: MessageSquare, enabled: false },
  { label: "Usuários", href: "/dashboard/usuarios", icon: UserRound, enabled: true },
  { label: "Páginas", href: "/dashboard/paginas", icon: Shield, enabled: false },
  { label: "Configurações", href: "/dashboard/configuracoes", icon: Settings, enabled: false },
];

type ProjectRecord = Project & {
  views: number;
  commentsCount: number;
  isCustom?: boolean;
};

const CUSTOM_STORAGE_KEY = "dashboard-projects-custom";
const ORDER_STORAGE_KEY = "dashboard-projects-order";

const emptyProject = {
  title: "",
  id: "",
  synopsis: "",
  description: "",
  type: "Anime",
  status: "Em andamento",
  year: "",
  studio: "",
  episodes: "",
  tags: "",
  cover: "",
  banner: "",
  season: "",
  schedule: "",
  rating: "",
  trailerUrl: "",
};

const DashboardProjects = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"order" | "alpha" | "status" | "views" | "comments">("order");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formState, setFormState] = useState(emptyProject);
  const [customProjects, setCustomProjects] = useState<ProjectRecord[]>([]);
  const [projectOrder, setProjectOrder] = useState<string[]>([]);
  const dragIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ProjectRecord[];
        setCustomProjects(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      setCustomProjects([]);
    }
    try {
      const storedOrder = localStorage.getItem(ORDER_STORAGE_KEY);
      if (storedOrder) {
        const parsed = JSON.parse(storedOrder) as string[];
        setProjectOrder(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      setProjectOrder([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customProjects));
  }, [customProjects]);

  useEffect(() => {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(projectOrder));
  }, [projectOrder]);

  const baseProjects: ProjectRecord[] = useMemo(
    () =>
      projectData.map((project) => ({
        ...project,
        views: 0,
        commentsCount: 0,
        isCustom: false,
      })),
    [],
  );

  const allProjects = useMemo<ProjectRecord[]>(() => {
    const merged = [
      ...baseProjects,
      ...customProjects.map((project) => ({
        ...project,
        views: project.views ?? 0,
        commentsCount: project.commentsCount ?? 0,
        isCustom: true,
      })),
    ];
    if (!projectOrder.length) {
      return merged;
    }
    const orderMap = new Map(projectOrder.map((id, index) => [id, index]));
    return [...merged].sort((a, b) => {
      const orderA = orderMap.get(a.id);
      const orderB = orderMap.get(b.id);
      if (orderA == null && orderB == null) {
        return 0;
      }
      if (orderA == null) {
        return 1;
      }
      if (orderB == null) {
        return -1;
      }
      return orderA - orderB;
    });
  }, [baseProjects, customProjects, projectOrder]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return allProjects;
    }
    return allProjects.filter((project) => {
      const haystack = [
        project.title,
        project.synopsis,
        project.description,
        project.type,
        project.status,
        project.studio,
        project.episodes,
        project.tags.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [allProjects, searchQuery]);

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
    return next;
  }, [filteredProjects, sortMode]);

  const handleDragStart = (id: string) => {
    dragIdRef.current = id;
  };

  const handleDrop = (targetId: string) => {
    const dragId = dragIdRef.current;
    if (!dragId || dragId === targetId) {
      dragIdRef.current = null;
      return;
    }
    setProjectOrder((prev) => {
      const order = prev.length ? [...prev] : allProjects.map((project) => project.id);
      const fromIndex = order.indexOf(dragId);
      const toIndex = order.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) {
        return prev;
      }
      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, dragId);
      return order;
    });
    dragIdRef.current = null;
  };

  const handleDelete = (projectId: string) => {
    setCustomProjects((prev) => prev.filter((project) => project.id !== projectId));
    setProjectOrder((prev) => prev.filter((id) => id !== projectId));
  };

  const resetForm = () => setFormState(emptyProject);

  const handleCreate = () => {
    const title = formState.title.trim();
    const slug = formState.id.trim() || createSlug(title);
    if (!title || !slug) {
      return;
    }
    const tags = formState.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const project: ProjectRecord = {
      id: slug,
      title,
      synopsis: formState.synopsis.trim(),
      description: formState.description.trim() || formState.synopsis.trim(),
      type: formState.type.trim() || "Anime",
      status: formState.status.trim() || "Em andamento",
      year: formState.year.trim(),
      studio: formState.studio.trim(),
      episodes: formState.episodes.trim(),
      tags,
      cover: formState.cover.trim() || "/placeholder.svg",
      banner: formState.banner.trim() || "/placeholder.svg",
      season: formState.season.trim(),
      schedule: formState.schedule.trim(),
      rating: formState.rating.trim(),
      episodeDownloads: [],
      staff: [],
      relations: [],
      trailerUrl: formState.trailerUrl.trim(),
      views: 0,
      commentsCount: 0,
      isCustom: true,
    };
    setCustomProjects((prev) => [...prev, project]);
    setProjectOrder((prev) => (prev.length ? [project.id, ...prev] : [project.id]));
    resetForm();
    setIsDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-[hsl(var(--primary)/0.12)] to-background text-foreground">
      <SidebarProvider>
        <Sidebar className="border-white/10 bg-black/20 text-foreground">
          <SidebarHeader className="border-white/10">
            <div className="flex items-center gap-3 px-2 py-3">
              <img src="/favicon.svg" alt="Rainbow logo" className="h-8 w-8" />
              <div>
                <p className="text-sm font-semibold">Rainbow</p>
                <p className="text-xs text-muted-foreground">Dashboard</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2">
            <SidebarSeparator className="my-2 bg-white/5" />
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.href}>
                    {item.enabled ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-3"
                        onClick={() => navigate(item.href)}
                      >
                        <item.icon />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </button>
                    ) : (
                      <button type="button" className="flex w-full items-center gap-3" disabled>
                        <item.icon />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </button>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="bg-gradient-to-b from-background via-[hsl(var(--primary)/0.12)] to-background text-foreground">
          <Header variant="static" leading={<SidebarTrigger className="text-white/80 hover:text-white" />} />
          <main className="pt-6 px-6 pb-20 md:px-10">
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
              <Button className="gap-2" onClick={() => setIsDialogOpen(true)}>
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
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order">Ordem manual</SelectItem>
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

              <div className="grid gap-6">
                {sortedProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="group cursor-pointer overflow-hidden border-border/60 bg-card/80 shadow-lg transition hover:border-primary/40"
                    draggable={sortMode === "order"}
                    onDragStart={() => handleDragStart(project.id)}
                    onDragOver={(event) => {
                      if (sortMode === "order") {
                        event.preventDefault();
                      }
                    }}
                    onDrop={() => {
                      if (sortMode === "order") {
                        handleDrop(project.id);
                      }
                    }}
                  >
                    <CardContent className="p-0">
                      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                        <div className="relative h-44 w-full md:h-full">
                          <img
                            src={project.cover || "/placeholder.svg"}
                            alt={project.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
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
                              {project.isCustom ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Excluir"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDelete(project.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              ) : null}
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {project.synopsis}
                          </p>

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
                            <span className="inline-flex items-center gap-2">
                              {project.views} visualizações
                            </span>
                            <span className="inline-flex items-center gap-2">
                              {project.commentsCount} comentários
                            </span>
                            <span className="ml-auto text-xs text-muted-foreground">{project.episodes}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </main>
        </SidebarInset>
      </SidebarProvider>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>Preencha os dados do projeto que aparecerá no site.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={formState.title}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    title: event.target.value,
                    id: prev.id || createSlug(event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={formState.id}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, id: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Sinopse</Label>
              <Textarea
                value={formState.synopsis}
                onChange={(event) => setFormState((prev) => ({ ...prev, synopsis: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input
                value={formState.type}
                onChange={(event) => setFormState((prev) => ({ ...prev, type: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Input
                value={formState.status}
                onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value }))}
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
              <Label>Episódios</Label>
              <Input
                value={formState.episodes}
                onChange={(event) => setFormState((prev) => ({ ...prev, episodes: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags (separe por vírgula)</Label>
              <Input
                value={formState.tags}
                onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value }))}
              />
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
              <Label>Schedule</Label>
              <Input
                value={formState.schedule}
                onChange={(event) => setFormState((prev) => ({ ...prev, schedule: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Rating</Label>
              <Input
                value={formState.rating}
                onChange={(event) => setFormState((prev) => ({ ...prev, rating: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Capa</Label>
              <Input
                value={formState.cover}
                onChange={(event) => setFormState((prev) => ({ ...prev, cover: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Banner</Label>
              <Input
                value={formState.banner}
                onChange={(event) => setFormState((prev) => ({ ...prev, banner: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Trailer URL</Label>
              <Input
                value={formState.trailerUrl}
                onChange={(event) => setFormState((prev) => ({ ...prev, trailerUrl: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Salvar projeto</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
};

export default DashboardProjects;
