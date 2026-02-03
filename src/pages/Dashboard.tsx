import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project } from "@/data/projects";
import { getApiBase } from "@/lib/api-base";
import { usePageMeta } from "@/hooks/use-page-meta";

type ProjectView = {
  projectId: string;
  views: number;
};

const projectPageViews: ProjectView[] = [];
const recentComments: Array<{
  id: string;
  author: string;
  message: string;
  page: string;
  createdAt: string;
}> = [];

const recentPosts: Array<{
  id: string;
  title: string;
  views: number;
  status: string;
  updatedAt: string;
}> = [];

const Dashboard = () => {
  usePageMeta({ title: "Dashboard", noIndex: true });

  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    email?: string | null;
    avatarUrl?: string | null;
  } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const apiBase = getApiBase();

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
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUser();
  }, [apiBase]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch(`${apiBase}/api/projects`, { credentials: "include" });
        if (!response.ok) {
          setProjects([]);
          return;
        }
        const data = await response.json();
        setProjects(Array.isArray(data.projects) ? data.projects : []);
      } catch {
        setProjects([]);
      }
    };

    loadProjects();
  }, [apiBase]);

  const userLabel = useMemo(() => {
    if (isLoadingUser) {
      return "Carregando usuário...";
    }
    return currentUser?.name ?? "Usuário não conectado";
  }, [currentUser, isLoadingUser]);

  const userSubLabel = useMemo(() => {
    if (isLoadingUser) {
      return "Aguarde";
    }
    return currentUser ? `@${currentUser.username}` : "OAuth Discord pendente";
  }, [currentUser, isLoadingUser]);

  const totalProjects = projects.length;
  const totalEpisodes = projects.reduce((sum, project) => sum + (project.episodeDownloads?.length || 0), 0);
  const activeProjects = projects.filter((project) => {
    const status = project.status.toLowerCase();
    return status.includes("andamento") || status.includes("produ");
  }).length;
  const finishedProjects = projects.filter((project) => {
    const status = project.status.toLowerCase();
    return status.includes("complet") || status.includes("lan");
  }).length;

  const projectViewsById = new Map(projectPageViews.map((item) => [item.projectId, item.views]));
  const rankedProjects = projects
    .filter((project) => projectViewsById.has(project.id))
    .map((project) => ({
      ...project,
      views: projectViewsById.get(project.id) ?? 0,
    }))
    .sort((a, b) => b.views - a.views);
  const hasViewData = rankedProjects.length > 0;

  const chartWidth = 100;
  const chartHeight = 40;
  const chartPoints = hasViewData
    ? rankedProjects
        .slice(0, 7)
        .map((project, index, items) => {
          const maxViews = Math.max(...items.map((item) => item.views));
          const x = (chartWidth / Math.max(items.length - 1, 1)) * index;
          const y = chartHeight - (project.views / Math.max(maxViews, 1)) * (chartHeight - 6) - 3;
          return `${x},${y}`;
        })
        .join(" ")
    : "";
  const areaPath = hasViewData ? `M0,${chartHeight} L${chartPoints} L${chartWidth},${chartHeight} Z` : "";

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={isLoadingUser}
      userLabel={userLabel}
      userSubLabel={userSubLabel}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <main className="pt-24">
          <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
            <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Dashboard Interna
              </div>
              <h1 className="text-3xl font-semibold lg:text-4xl">
                Painel de controle da comunidade
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Visão geral dos projetos e do conteúdo. Assim que as integrações de analytics e
                comentários estiverem ativas, os dados aparecem aqui automaticamente.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-white/10 text-muted-foreground">Acesso restrito</Badge>
              {currentUser ? (
                <Button variant="outline" className="border-white/15 bg-white/5" disabled>
                  Exportar relatório
                </Button>
              ) : (
                <Link to="/login">
                  <Button variant="outline" className="border-white/15 bg-white/5">
                    Fazer login
                  </Button>
                </Link>
              )}
            </div>
          </header>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-5">
              <p className="text-sm text-muted-foreground">Projetos cadastrados</p>
              <div className="mt-3 text-2xl font-semibold">{totalProjects}</div>
              <p className="mt-2 text-xs text-muted-foreground">Catálogo completo do site.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-5">
              <p className="text-sm text-muted-foreground">Episódios disponíveis</p>
              <div className="mt-3 text-2xl font-semibold">{totalEpisodes}</div>
              <p className="mt-2 text-xs text-muted-foreground">Downloads ativos nos projetos.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-5">
              <p className="text-sm text-muted-foreground">Projetos ativos</p>
              <div className="mt-3 text-2xl font-semibold">{activeProjects}</div>
              <p className="mt-2 text-xs text-muted-foreground">Em andamento ou produção.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-5">
              <p className="text-sm text-muted-foreground">Projetos finalizados</p>
              <div className="mt-3 text-2xl font-semibold">{finishedProjects}</div>
              <p className="mt-2 text-xs text-muted-foreground">Completo ou lançado.</p>
            </div>
          </div>

          <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)]">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Páginas de projeto mais acessadas</p>
                    {hasViewData ? (
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-3xl font-semibold">{rankedProjects[0]?.views ?? 0}</span>
                        <Badge className="bg-white/10 text-muted-foreground">Top 1</Badge>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Nenhum dado de acesso foi coletado ainda.
                      </p>
                    )}
                  </div>
                  <div className="w-full max-w-xs">
                    <div className="h-32 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-4">
                      {hasViewData ? (
                        <svg viewBox="0 0 100 40" className="h-full w-full">
                          <defs>
                            <linearGradient id="visits-gradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(280 80% 70%)" stopOpacity="0.7" />
                              <stop offset="100%" stopColor="hsl(320 80% 60%)" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={areaPath} fill="url(#visits-gradient)" />
                          <polyline
                            points={chartPoints}
                            fill="none"
                            stroke="hsl(280 80% 70%)"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground">
                          <span>Gráfico indisponível</span>
                          <span>Integração de analytics pendente</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Páginas mais acessadas</h2>
                    <p className="text-sm text-muted-foreground">Ranking por projetos individuais</p>
                  </div>
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground" disabled>
                    Ver detalhes
                  </Button>
                </div>
                {hasViewData ? (
                  <div className="mt-6 space-y-4">
                    {rankedProjects.slice(0, 5).map((project) => (
                      <Link
                        key={project.id}
                        to={`/projeto/${project.id}`}
                        className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-primary/40 hover:bg-primary/5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{project.title}</span>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{project.views} acessos</span>
                            <Badge className="bg-white/10 text-muted-foreground">{project.status}</Badge>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-muted-foreground">
                    Conecte o backend de analytics para ver o ranking de acesso por projeto.
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Posts mais recentes</h2>
                    <p className="text-sm text-muted-foreground">Publicações e visualizações</p>
                  </div>
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground" disabled>
                    Gerenciar posts
                  </Button>
                </div>
                {recentPosts.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum post publicado ainda.
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {recentPosts.map((post) => (
                      <div
                        key={post.id}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-medium">{post.title}</p>
                          <p className="text-xs text-muted-foreground">Status: {post.status}</p>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground">{post.views} views</span>
                          <Badge className="bg-white/10 text-muted-foreground">{post.updatedAt}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Comentários recentes</h2>
                    <p className="text-sm text-muted-foreground">Sistema por página</p>
                  </div>
                  <Badge className="bg-white/10 text-muted-foreground">
                    {recentComments.length} novos
                  </Badge>
                </div>
                {recentComments.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum comentário registrado ainda.
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {recentComments.map((comment) => (
                      <div key={comment.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{comment.author}</span>
                          <span>{comment.createdAt}</span>
                        </div>
                        <p className="mt-2 text-sm text-foreground">{comment.message}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Em: {comment.page}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold">Ações rápidas</h2>
                <p className="text-sm text-muted-foreground">Permissões, posts e configurações.</p>
                <div className="mt-5 grid gap-3">
                  <Button className="justify-between bg-white/5 text-foreground hover:bg-white/10" variant="ghost" disabled>
                    Gerenciar cargos
                    <span className="text-xs text-muted-foreground">Discord</span>
                  </Button>
                  <Button className="justify-between bg-white/5 text-foreground hover:bg-white/10" variant="ghost" disabled>
                    Configurações gerais
                    <span className="text-xs text-muted-foreground">Site</span>
                  </Button>
                  <Button className="justify-between bg-white/5 text-foreground hover:bg-white/10" variant="ghost" disabled>
                    Moderação de comentários
                    <span className="text-xs text-muted-foreground">Comunidade</span>
                  </Button>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold">Projetos cadastrados</h2>
                <p className="text-sm text-muted-foreground">Acesso rápido ao catálogo.</p>
                <div className="mt-5 space-y-3">
                  {projects.slice(0, 6).map((project) => (
                    <Link
                      key={project.id}
                      to={`/projeto/${project.id}`}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <span className="font-medium">{project.title}</span>
                      <Badge className="bg-white/10 text-muted-foreground">{project.status}</Badge>
                    </Link>
                  ))}
                  {projects.length > 6 && (
                    <Link
                      to="/projetos"
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                    >
                      Ver todos os projetos
                    </Link>
                  )}
                </div>
              </div>
            </aside>
          </section>
          </section>
        </main>
    </DashboardShell>
  );
};

export default Dashboard;
