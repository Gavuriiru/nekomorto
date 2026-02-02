import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  FileText,
  FolderCog,
  MessageSquare,
  Settings,
  Shield,
  UserRound,
  CheckCircle2,
  Trash2,
  ExternalLink,
} from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Badge } from "@/components/ui/badge";
import { getApiBase } from "@/lib/api-base";

const menuItems = [
  { label: "Início", href: "/dashboard", icon: LayoutGrid, enabled: true },
  { label: "Postagens", href: "/dashboard/posts", icon: FileText, enabled: true },
  { label: "Projetos", href: "/dashboard/projetos", icon: FolderCog, enabled: true },
  { label: "Comentários", href: "/dashboard/comentarios", icon: MessageSquare, enabled: true },
  { label: "Usuários", href: "/dashboard/usuarios", icon: UserRound, enabled: true },
  { label: "Páginas", href: "/dashboard/paginas", icon: Shield, enabled: true },
  { label: "Configurações", href: "/dashboard/configuracoes", icon: Settings, enabled: false },
];

type PendingComment = {
  id: string;
  targetType: string;
  targetId: string;
  parentId?: string | null;
  name: string;
  content: string;
  createdAt: string;
  avatarUrl?: string;
  targetLabel: string;
  targetUrl: string;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const DashboardComments = () => {
  const apiBase = getApiBase();
  const navigate = useNavigate();
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  } | null>(null);

  const loadComments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiBase}/api/comments/pending`, { credentials: "include" });
      if (!response.ok) {
        setComments([]);
        return;
      }
      const data = await response.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch {
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadComments();
  }, [apiBase]);

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

  const handleApprove = async (id: string) => {
    const response = await fetch(`${apiBase}/api/comments/${id}/approve`, {
      method: "POST",
      credentials: "include",
    });
    if (response.ok) {
      setComments((prev) => prev.filter((comment) => comment.id !== id));
    }
  };

  const handleDelete = async (id: string) => {
    const response = await fetch(`${apiBase}/api/comments/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      setComments((prev) => prev.filter((comment) => comment.id !== id));
    }
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="gap-4 transition-all duration-200 ease-linear group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:items-center">
          <div
            className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3 transition-all duration-300 ease-out hover:border-primary/40 hover:bg-sidebar-accent/50 cursor-pointer group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:hidden"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/dashboard/usuarios?edit=me")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate("/dashboard/usuarios?edit=me");
              }
            }}
          >
            <Avatar className="h-11 w-11 border border-sidebar-border">
              {currentUser?.avatarUrl ? (
                <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
              ) : null}
              <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-foreground">
                {currentUser ? currentUser.name.slice(0, 2).toUpperCase() : "??"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">
                {currentUser?.name ?? "Usuário"}
              </span>
              <span className="text-xs text-sidebar-foreground/70">
                {currentUser?.username ? `@${currentUser.username}` : "Dashboard"}
              </span>
            </div>
          </div>
          <div
            className="hidden items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-2 transition-all duration-300 ease-out hover:border-primary/40 hover:bg-sidebar-accent/50 cursor-pointer group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:translate-x-0"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/dashboard/usuarios?edit=me")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate("/dashboard/usuarios?edit=me");
              }
            }}
          >
            <Avatar className="h-8 w-8 border border-sidebar-border shadow-sm">
              {currentUser?.avatarUrl ? (
                <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
              ) : null}
              <AvatarFallback className="bg-sidebar-accent text-[10px] text-sidebar-foreground">
                {currentUser ? currentUser.name.slice(0, 2).toUpperCase() : "??"}
              </AvatarFallback>
            </Avatar>
          </div>
        </SidebarHeader>
        <SidebarSeparator className="my-2" />
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild disabled={!item.enabled}>
                  <Link
                    to={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="bg-gradient-to-b from-background via-[hsl(var(--primary)/0.12)] to-background text-foreground">
        <Header variant="fixed" leading={<SidebarTrigger className="text-white/80 hover:text-white" />} />
        <main className="px-6 pb-20 pt-24 md:px-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Comentários pendentes</h1>
                <p className="text-sm text-muted-foreground">
                  Aprove ou exclua comentários enviados pelos visitantes.
                </p>
              </div>
              <Badge variant="secondary" className="text-xs uppercase">
                {comments.length} pendentes
              </Badge>
            </div>

            {isLoading ? (
              <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
                Carregando comentários...
              </div>
            ) : comments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
                Nenhum comentário aguardando aprovação.
              </div>
            ) : (
              <div className="grid gap-4">
                {comments.map((comment) => (
                  <Card key={comment.id} className="border-border/60 bg-card/80 shadow-lg">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {comment.targetType}
                            </Badge>
                            <span>{formatDateTime(comment.createdAt)}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{comment.name}</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-line">{comment.content}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleApprove(comment.id)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(comment.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={comment.targetUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Ver página
                            </a>
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                        {comment.targetLabel}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  );
};

export default DashboardComments;
