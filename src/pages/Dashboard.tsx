import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import AsyncState from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Project } from "@/data/projects";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date";
import { usePageMeta } from "@/hooks/use-page-meta";
import type { OperationalAlertsResponse } from "@/types/operational-alerts";
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

type DashboardPost = {
  id: string;
  slug: string;
  title: string;
  views: number;
  viewsDaily?: Record<string, number>;
  status: string;
  publishedAt: string;
  updatedAt: string;
};

type DashboardComment = {
  id: string;
  author: string;
  message: string;
  page: string;
  createdAt: string;
  url: string;
  status: string;
};

type AnalyticsOverviewResponse = {
  metrics?: {
    views?: number;
  };
};

type AnalyticsTimeseriesResponse = {
  series?: Array<{
    date: string;
    value: number;
  }>;
};

type DashboardHomeRole = "editor" | "moderador" | "admin";
type DashboardWidgetId =
  | "metrics_overview"
  | "analytics_summary"
  | "projects_rank"
  | "recent_posts"
  | "comments_queue"
  | "ops_status"
  | "projects_quick";

const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  metrics_overview: "Visão de métricas",
  analytics_summary: "Resumo de analytics",
  projects_rank: "Ranking de projetos",
  recent_posts: "Posts recentes",
  comments_queue: "Fila de comentários",
  ops_status: "Status operacional",
  projects_quick: "Acesso rápido a projetos",
};

const DASHBOARD_WIDGET_IDS: DashboardWidgetId[] = [
  "metrics_overview",
  "analytics_summary",
  "projects_rank",
  "recent_posts",
  "comments_queue",
  "ops_status",
  "projects_quick",
];

const DASHBOARD_ROLE_PRESETS: Record<DashboardHomeRole, DashboardWidgetId[]> = {
  editor: ["analytics_summary", "recent_posts", "projects_rank", "projects_quick", "ops_status"],
  moderador: ["comments_queue", "ops_status", "recent_posts", "analytics_summary"],
  admin: [
    "ops_status",
    "analytics_summary",
    "comments_queue",
    "projects_rank",
    "recent_posts",
    "metrics_overview",
  ],
};

const readGrant = (source: Record<string, unknown>, key: string) => source[key] === true;

const inferDashboardRole = (user: Record<string, unknown> | null): DashboardHomeRole => {
  const grants =
    user?.grants && typeof user.grants === "object" ? (user.grants as Record<string, unknown>) : {};
  const permissions = Array.isArray(user?.permissions)
    ? user.permissions.map((item) =>
        String(item || "")
          .trim()
          .toLowerCase(),
      )
    : [];
  const hasPermission = (id: string) =>
    readGrant(grants, id) || permissions.includes(id) || permissions.includes("*");

  const isAdmin =
    hasPermission("configuracoes") ||
    hasPermission("usuarios_acesso") ||
    hasPermission("audit_log") ||
    hasPermission("integracoes");
  if (isAdmin) {
    return "admin";
  }
  const isModerador =
    hasPermission("comentarios") && !hasPermission("posts") && !hasPermission("projetos");
  if (isModerador) {
    return "moderador";
  }
  return "editor";
};

const normalizeDashboardWidgets = (value: unknown): DashboardWidgetId[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const dedupe = new Set<DashboardWidgetId>();
  value.forEach((item) => {
    const normalized = String(item || "").trim() as DashboardWidgetId;
    if (!DASHBOARD_WIDGET_IDS.includes(normalized)) {
      return;
    }
    dedupe.add(normalized);
  });
  return Array.from(dedupe);
};

const Dashboard = () => {
  usePageMeta({ title: "Dashboard", noIndex: true });

  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    email?: string | null;
    avatarUrl?: string | null;
    grants?: Partial<Record<string, boolean>>;
    permissions?: string[];
  } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [homePreferences, setHomePreferences] = useState<
    Partial<Record<DashboardHomeRole, DashboardWidgetId[]>>
  >({});
  const [allPreferences, setAllPreferences] = useState<Record<string, unknown>>({});
  const [customDraftWidgets, setCustomDraftWidgets] = useState<DashboardWidgetId[]>([]);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [posts, setPosts] = useState<DashboardPost[]>([]);
  const [recentComments, setRecentComments] = useState<DashboardComment[]>([]);
  const [pendingCommentsCount, setPendingCommentsCount] = useState(0);
  const [analyticsSeries7d, setAnalyticsSeries7d] = useState<
    Array<{ date: string; value: number }>
  >([]);
  const [analyticsTotalViews7d, setAnalyticsTotalViews7d] = useState(0);
  const [analyticsProjectViews7d, setAnalyticsProjectViews7d] = useState(0);
  const [analyticsPostViews7d, setAnalyticsPostViews7d] = useState(0);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [hasOverviewError, setHasOverviewError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [operationalAlerts, setOperationalAlerts] = useState<OperationalAlertsResponse | null>(
    null,
  );
  const [isLoadingOperationalAlerts, setIsLoadingOperationalAlerts] = useState(true);
  const [operationalAlertsError, setOperationalAlertsError] = useState("");
  const [hideOperationalAlertsCard, setHideOperationalAlertsCard] = useState(false);
  const apiBase = getApiBase();
  const homeRole = useMemo<DashboardHomeRole>(
    () => inferDashboardRole((currentUser as Record<string, unknown> | null) || null),
    [currentUser],
  );

  useEffect(() => {
    const loadUser = async () => {
      setIsLoadingUser(true);
      try {
        const response = await apiFetch(apiBase, "/api/me", { auth: true });
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
    void loadUser();
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const loadPreferences = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/me/preferences", {
          auth: true,
          cache: "no-store",
        });
        if (!response.ok) {
          if (isActive) {
            setHomePreferences({});
            setAllPreferences({});
          }
          return;
        }
        const payload = (await response.json()) as { preferences?: Record<string, unknown> };
        const preferences =
          payload?.preferences && typeof payload.preferences === "object"
            ? payload.preferences
            : {};
        const dashboard =
          preferences.dashboard && typeof preferences.dashboard === "object"
            ? (preferences.dashboard as Record<string, unknown>)
            : {};
        const homeByRole =
          dashboard.homeByRole && typeof dashboard.homeByRole === "object"
            ? (dashboard.homeByRole as Record<string, unknown>)
            : {};
        const nextHomePrefs: Partial<Record<DashboardHomeRole, DashboardWidgetId[]>> = {
          editor: normalizeDashboardWidgets(
            (homeByRole.editor as { widgets?: unknown } | undefined)?.widgets,
          ),
          moderador: normalizeDashboardWidgets(
            (homeByRole.moderador as { widgets?: unknown } | undefined)?.widgets,
          ),
          admin: normalizeDashboardWidgets(
            (homeByRole.admin as { widgets?: unknown } | undefined)?.widgets,
          ),
        };
        if (isActive) {
          setAllPreferences(preferences);
          setHomePreferences(nextHomePrefs);
        }
      } catch {
        if (isActive) {
          setHomePreferences({});
          setAllPreferences({});
        }
      }
    };
    void loadPreferences();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const loadOverview = async () => {
      setIsLoadingOverview(true);
      setHasOverviewError(false);
      try {
        const [
          overviewAllRes,
          overviewProjectRes,
          overviewPostRes,
          seriesRes,
          projectsRes,
          postsRes,
          recentCommentsRes,
        ] = await Promise.all([
          apiFetch(apiBase, "/api/analytics/overview?range=7d&type=all", { auth: true }),
          apiFetch(apiBase, "/api/analytics/overview?range=7d&type=project", { auth: true }),
          apiFetch(apiBase, "/api/analytics/overview?range=7d&type=post", { auth: true }),
          apiFetch(apiBase, "/api/analytics/timeseries?range=7d&type=all&metric=views", {
            auth: true,
          }),
          apiFetch(apiBase, "/api/projects", { auth: true }),
          apiFetch(apiBase, "/api/posts", { auth: true }),
          apiFetch(apiBase, "/api/comments/recent?limit=3", { auth: true }),
        ]);
        if (!isActive) {
          return;
        }
        if (
          !overviewAllRes.ok ||
          !overviewProjectRes.ok ||
          !overviewPostRes.ok ||
          !seriesRes.ok ||
          !projectsRes.ok ||
          !postsRes.ok ||
          !recentCommentsRes.ok
        ) {
          throw new Error("dashboard_overview_load_failed");
        }
        const [
          overviewAll,
          overviewProject,
          overviewPost,
          seriesData,
          projectsData,
          postsData,
          commentsData,
        ] = await Promise.all([
          overviewAllRes.json(),
          overviewProjectRes.json(),
          overviewPostRes.json(),
          seriesRes.json(),
          projectsRes.json(),
          postsRes.json(),
          recentCommentsRes.json(),
        ]);
        if (!isActive) {
          return;
        }
        setAnalyticsTotalViews7d(
          Number((overviewAll as AnalyticsOverviewResponse)?.metrics?.views || 0),
        );
        setAnalyticsProjectViews7d(
          Number((overviewProject as AnalyticsOverviewResponse)?.metrics?.views || 0),
        );
        setAnalyticsPostViews7d(
          Number((overviewPost as AnalyticsOverviewResponse)?.metrics?.views || 0),
        );
        setAnalyticsSeries7d(
          Array.isArray((seriesData as AnalyticsTimeseriesResponse)?.series)
            ? (seriesData as AnalyticsTimeseriesResponse).series || []
            : [],
        );
        const projectsPayload = projectsData as { projects?: Project[] };
        const postsPayload = postsData as { posts?: DashboardPost[] };
        const commentsPayload = commentsData as {
          comments?: Array<{
            id: string;
            name: string;
            content: string;
            targetLabel: string;
            createdAt: string;
            targetUrl: string;
            status?: string;
          }>;
          pendingCount?: number;
        };
        setProjects(Array.isArray(projectsPayload.projects) ? projectsPayload.projects : []);
        setPosts(Array.isArray(postsPayload.posts) ? postsPayload.posts : []);
        setRecentComments(
          Array.isArray(commentsPayload.comments)
            ? commentsPayload.comments.map((comment) => ({
                id: comment.id,
                author: comment.name,
                message: comment.content,
                page: comment.targetLabel,
                createdAt: comment.createdAt,
                url: comment.targetUrl,
                status: comment.status || "approved",
              }))
            : [],
        );
        setPendingCommentsCount(
          Number.isFinite(commentsPayload.pendingCount) ? Number(commentsPayload.pendingCount) : 0,
        );
      } catch {
        if (!isActive) {
          return;
        }
        setHasOverviewError(true);
        setProjects([]);
        setPosts([]);
        setRecentComments([]);
        setPendingCommentsCount(0);
        setAnalyticsTotalViews7d(0);
        setAnalyticsProjectViews7d(0);
        setAnalyticsPostViews7d(0);
        setAnalyticsSeries7d([]);
      } finally {
        if (isActive) {
          setIsLoadingOverview(false);
        }
      }
    };

    void loadOverview();
    return () => {
      isActive = false;
    };
  }, [apiBase, reloadTick]);

  useEffect(() => {
    let isActive = true;
    const loadOperationalAlerts = async () => {
      setIsLoadingOperationalAlerts(true);
      setOperationalAlertsError("");
      try {
        const response = await apiFetch(apiBase, "/api/admin/operational-alerts", { auth: true });
        if (!isActive) {
          return;
        }
        if (response.status === 403 || response.status === 401) {
          setHideOperationalAlertsCard(true);
          setOperationalAlerts(null);
          return;
        }
        setHideOperationalAlertsCard(false);
        if (!response.ok) {
          setOperationalAlertsError("Não foi possível carregar o status operacional.");
          setOperationalAlerts(null);
          return;
        }
        const data = (await response.json()) as OperationalAlertsResponse;
        setOperationalAlerts(data);
      } catch {
        if (!isActive) {
          return;
        }
        setHideOperationalAlertsCard(false);
        setOperationalAlertsError("Erro ao consultar alertas operacionais.");
        setOperationalAlerts(null);
      } finally {
        if (isActive) {
          setIsLoadingOperationalAlerts(false);
        }
      }
    };
    void loadOperationalAlerts();
    return () => {
      isActive = false;
    };
  }, [apiBase, reloadTick]);

  const last7Days = useMemo(() => {
    const days: string[] = [];
    const today = new Date();
    for (let index = 6; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - index);
      days.push(date.toISOString().slice(0, 10));
    }
    return days;
  }, []);

  const totalProjects = projects.length;
  const totalMedia = projects.reduce(
    (sum, project) => sum + (project.episodeDownloads?.length || 0),
    0,
  );
  const activeProjects = projects.filter((project) => {
    const status = project.status.toLowerCase();
    return status.includes("andamento") || status.includes("produ");
  }).length;
  const finishedProjects = projects.filter((project) => {
    const status = project.status.toLowerCase();
    return status.includes("complet") || status.includes("lan");
  }).length;

  const totalProjectViews = projects.reduce((sum, project) => sum + (project.views ?? 0), 0);
  const totalPostViews = posts.reduce((sum, post) => sum + (post.views ?? 0), 0);
  const totalViews = totalProjectViews + totalPostViews;
  const totalProjectViewsLast7 = analyticsProjectViews7d;
  const totalPostViewsLast7 = analyticsPostViews7d;
  const totalViewsLast7 = analyticsTotalViews7d;
  const analyticsAllHref = "/dashboard/analytics?range=30d&type=all";
  const analyticsProjectHref = "/dashboard/analytics?range=30d&type=project";
  const analyticsPostHref = "/dashboard/analytics?range=30d&type=post";

  const rankedProjects = projects
    .map((project) => ({
      ...project,
      views: project.views ?? 0,
    }))
    .filter((project) => project.views > 0)
    .sort((a, b) => b.views - a.views);
  const hasProjectViewData = rankedProjects.length > 0;
  const hasAnalyticsData = totalViewsLast7 > 0;

  const dailyTotals = useMemo(
    () => last7Days.map((day) => analyticsSeries7d.find((item) => item.date === day)?.value ?? 0),
    [analyticsSeries7d, last7Days],
  );

  const recentPosts = useMemo(
    () =>
      posts
        .slice()
        .sort((a, b) => {
          const aDate = new Date(a.updatedAt || a.publishedAt).getTime();
          const bDate = new Date(b.updatedAt || b.publishedAt).getTime();
          return bDate - aDate;
        })
        .slice(0, 3),
    [posts],
  );

  const chartWidth = 100;
  const chartHeight = 40;
  const chartPoints = hasAnalyticsData
    ? dailyTotals
        .map((value, index, items) => {
          const maxViews = Math.max(...items.map((item) => item));
          const x = (chartWidth / Math.max(items.length - 1, 1)) * index;
          const y = chartHeight - (value / Math.max(maxViews, 1)) * (chartHeight - 6) - 3;
          return `${x},${y}`;
        })
        .join(" ")
    : "";
  const areaPath = hasAnalyticsData
    ? `M0,${chartHeight} L${chartPoints} L${chartWidth},${chartHeight} Z`
    : "";
  const operationalStatusLabel =
    operationalAlerts?.status === "fail"
      ? "Falha"
      : operationalAlerts?.status === "degraded"
        ? "Degradado"
        : "OK";
  const operationalStatusClass =
    operationalAlerts?.status === "fail"
      ? "bg-red-500/20 text-red-200"
      : operationalAlerts?.status === "degraded"
        ? "bg-amber-500/20 text-amber-200"
        : "bg-emerald-500/20 text-emerald-200";
  const alertSeverityClass = (severity?: string) => {
    if (severity === "critical") return "bg-red-500/20 text-red-200";
    if (severity === "warning") return "bg-amber-500/20 text-amber-200";
    return "bg-card/80 text-muted-foreground";
  };
  const rolePresetWidgets = DASHBOARD_ROLE_PRESETS[homeRole];
  const selectedWidgetsByRole = useMemo(
    () =>
      homePreferences[homeRole] && homePreferences[homeRole]!.length > 0
        ? homePreferences[homeRole]!
        : rolePresetWidgets,
    [homePreferences, homeRole, rolePresetWidgets],
  );
  const selectedWidgetSet = useMemo(
    () => new Set<DashboardWidgetId>(selectedWidgetsByRole),
    [selectedWidgetsByRole],
  );

  useEffect(() => {
    if (!isCustomizeOpen) {
      return;
    }
    setCustomDraftWidgets(selectedWidgetsByRole);
  }, [isCustomizeOpen, selectedWidgetsByRole]);

  const persistHomeWidgetsByRole = useCallback(
    async (role: DashboardHomeRole, widgets: DashboardWidgetId[]) => {
      const normalizedWidgets = normalizeDashboardWidgets(widgets);
      const dashboard =
        allPreferences.dashboard && typeof allPreferences.dashboard === "object"
          ? (allPreferences.dashboard as Record<string, unknown>)
          : {};
      const homeByRole =
        dashboard.homeByRole && typeof dashboard.homeByRole === "object"
          ? (dashboard.homeByRole as Record<string, unknown>)
          : {};
      const nextPreferences = {
        ...allPreferences,
        dashboard: {
          ...dashboard,
          homeByRole: {
            ...homeByRole,
            [role]: {
              widgets: normalizedWidgets,
            },
          },
        },
      };
      setIsSavingPreferences(true);
      try {
        const response = await apiFetch(apiBase, "/api/me/preferences", {
          method: "PUT",
          auth: true,
          json: { preferences: nextPreferences },
        });
        if (!response.ok) {
          throw new Error("preferences_save_failed");
        }
        setAllPreferences(nextPreferences);
        setHomePreferences((previous) => ({
          ...previous,
          [role]: normalizedWidgets,
        }));
        toast({
          title: "Painel personalizado",
          description: "Preferências do dashboard salvas.",
          intent: "success",
        });
      } catch {
        toast({
          title: "Falha ao salvar painel",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
      } finally {
        setIsSavingPreferences(false);
      }
    },
    [allPreferences, apiBase],
  );

  const toggleDraftWidget = useCallback((widgetId: DashboardWidgetId) => {
    setCustomDraftWidgets((previous) => {
      const hasWidget = previous.includes(widgetId);
      if (hasWidget) {
        if (previous.length <= 1) {
          return previous;
        }
        return previous.filter((item) => item !== widgetId);
      }
      return [...previous, widgetId];
    });
  }, []);

  const moveDraftWidget = useCallback((widgetId: DashboardWidgetId, direction: -1 | 1) => {
    setCustomDraftWidgets((previous) => {
      const index = previous.indexOf(widgetId);
      if (index === -1) {
        return previous;
      }
      const target = index + direction;
      if (target < 0 || target >= previous.length) {
        return previous;
      }
      const next = [...previous];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }, []);

  const applyCustomDraft = useCallback(async () => {
    if (customDraftWidgets.length === 0) {
      return;
    }
    await persistHomeWidgetsByRole(homeRole, customDraftWidgets);
    setIsCustomizeOpen(false);
  }, [customDraftWidgets, homeRole, persistHomeWidgetsByRole]);

  const restoreRolePreset = useCallback(async () => {
    await persistHomeWidgetsByRole(homeRole, DASHBOARD_ROLE_PRESETS[homeRole]);
    setCustomDraftWidgets(DASHBOARD_ROLE_PRESETS[homeRole]);
  }, [homeRole, persistHomeWidgetsByRole]);

  const handleExportReport = () => {
    const escapeCsv = (value: string | number | null | undefined) => {
      const text = String(value ?? "");
      if (text.includes('"') || text.includes(",") || text.includes("\n")) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const rows: string[] = [];
    rows.push("Resumo");
    rows.push(`Total de projetos,${totalProjects}`);
    rows.push(`Total de mídias,${totalMedia}`);
    rows.push(`Projetos ativos,${activeProjects}`);
    rows.push(`Projetos finalizados,${finishedProjects}`);
    rows.push(`Acessos em projetos,${totalProjectViews}`);
    rows.push(`Acessos em posts,${totalPostViews}`);
    rows.push(`Acessos totais,${totalViews}`);
    rows.push("");
    rows.push("Projetos");
    rows.push("id,titulo,status,views,comentarios,atualizado_em");
    projects.forEach((project) => {
      rows.push(
        [
          escapeCsv(project.id),
          escapeCsv(project.title),
          escapeCsv(project.status),
          escapeCsv(project.views ?? 0),
          escapeCsv(project.commentsCount ?? 0),
          escapeCsv(project.updatedAt ?? ""),
        ].join(","),
      );
    });
    rows.push("");
    rows.push("Posts");
    rows.push("id,slug,titulo,status,views,comentarios,publicado_em,atualizado_em");
    posts.forEach((post) => {
      rows.push(
        [
          escapeCsv(post.id),
          escapeCsv(post.slug),
          escapeCsv(post.title),
          escapeCsv(post.status),
          escapeCsv(post.views ?? 0),
          escapeCsv((post as { commentsCount?: number }).commentsCount ?? 0),
          escapeCsv(post.publishedAt ?? ""),
          escapeCsv(post.updatedAt ?? ""),
        ].join(","),
      );
    });

    const csvContent = `\uFEFF${rows.join("\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.download = `relatorio-dashboard-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={isLoadingUser}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <main className="pt-24">
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10 reveal" data-reveal>
          <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground animate-fade-in">
                Painel interno
              </div>
              <h1 className="text-3xl font-semibold lg:text-4xl animate-slide-up">
                Painel de controle da comunidade
              </h1>
              <p
                className="max-w-2xl text-sm text-muted-foreground animate-slide-up opacity-0"
                style={{ animationDelay: "0.2s" }}
              >
                Visão geral dos projetos e do conteúdo. Assim que as integrações de analytics e
                comentários estiverem ativas, os dados aparecem aqui automaticamente.
              </p>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap pb-1">
              <Button
                variant="outline"
                className="border-border/70 bg-card/60 px-4 text-muted-foreground hover:text-foreground"
                onClick={() => setIsCustomizeOpen(true)}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Personalizar painel
              </Button>
              {currentUser ? (
                <Button
                  variant="outline"
                  className="border-border/70 bg-card/60 px-4 text-muted-foreground hover:text-foreground"
                  onClick={handleExportReport}
                >
                  Exportar relatório
                </Button>
              ) : (
                <Link to="/login">
                  <Button
                    variant="outline"
                    className="border-border/70 bg-card/60 px-4 text-muted-foreground hover:text-foreground"
                  >
                    Fazer login
                  </Button>
                </Link>
              )}
            </div>
          </header>

          {isLoadingOverview ? (
            <AsyncState
              kind="loading"
              title="Carregando dashboard"
              description="Buscando analytics, projetos, posts e comentários."
            />
          ) : hasOverviewError ? (
            <AsyncState
              kind="error"
              title="Não foi possível carregar o dashboard"
              description="Tente novamente em alguns instantes."
              action={
                <Button variant="outline" onClick={() => setReloadTick((previous) => previous + 1)}>
                  Tentar novamente
                </Button>
              }
            />
          ) : (
            <>
              {selectedWidgetSet.has("metrics_overview") ? (
                <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div
                    className="rounded-2xl border border-border/60 bg-linear-to-br from-card/70 to-background/60 p-5 animate-slide-up opacity-0"
                    style={{ animationDelay: "0ms" }}
                  >
                    <p className="text-sm text-muted-foreground">Projetos cadastrados</p>
                    <div className="mt-3 text-2xl font-semibold">{totalProjects}</div>
                    <p className="mt-2 text-xs text-muted-foreground">Catálogo completo do site.</p>
                  </div>
                  <div
                    className="rounded-2xl border border-border/60 bg-linear-to-br from-card/70 to-background/60 p-5 animate-slide-up opacity-0"
                    style={{ animationDelay: "80ms" }}
                  >
                    <p className="text-sm text-muted-foreground">Mídias disponíveis</p>
                    <div className="mt-3 text-2xl font-semibold">{totalMedia}</div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Downloads ativos nos projetos.
                    </p>
                  </div>
                  <div
                    className="rounded-2xl border border-border/60 bg-linear-to-br from-card/70 to-background/60 p-5 animate-slide-up opacity-0"
                    style={{ animationDelay: "160ms" }}
                  >
                    <p className="text-sm text-muted-foreground">Projetos ativos</p>
                    <div className="mt-3 text-2xl font-semibold">{activeProjects}</div>
                    <p className="mt-2 text-xs text-muted-foreground">Em andamento ou produção.</p>
                  </div>
                  <div
                    className="rounded-2xl border border-border/60 bg-linear-to-br from-card/70 to-background/60 p-5 animate-slide-up opacity-0"
                    style={{ animationDelay: "240ms" }}
                  >
                    <p className="text-sm text-muted-foreground">Projetos finalizados</p>
                    <div className="mt-3 text-2xl font-semibold">{finishedProjects}</div>
                    <p className="mt-2 text-xs text-muted-foreground">Completo ou lançado.</p>
                  </div>
                </div>
              ) : null}

              <section
                className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] reveal"
                data-reveal
              >
                <div className="space-y-6">
                  {selectedWidgetSet.has("analytics_summary") ? (
                    <div
                      className="rounded-3xl border border-border/60 bg-card/60 p-6 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)] animate-slide-up opacity-0"
                      style={{ animationDelay: "120ms" }}
                    >
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Análises de acessos</p>
                          {hasAnalyticsData ? (
                            <div className="mt-3 flex items-center gap-3">
                              <span className="text-3xl font-semibold">{totalViewsLast7}</span>
                              <Badge className="bg-card/80 text-muted-foreground">
                                Últimos 7 dias
                              </Badge>
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-muted-foreground">
                              Nenhum dado de acesso foi coletado ainda.
                            </p>
                          )}
                          {hasAnalyticsData ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {totalProjectViewsLast7} em projetos e {totalPostViewsLast7} em posts
                            </p>
                          ) : null}
                          <div className="mt-4">
                            <Button
                              variant="outline"
                              className="border-border/70 bg-card/60 px-4 text-muted-foreground hover:text-foreground"
                              asChild
                            >
                              <Link to={analyticsAllHref}>Ver analytics completos</Link>
                            </Button>
                          </div>
                        </div>
                        <div className="w-full max-w-xs">
                          <div className="h-32 rounded-2xl border border-border/60 bg-linear-to-br from-card/70 to-background/60 p-4">
                            {hasAnalyticsData ? (
                              <svg viewBox="0 0 100 40" className="h-full w-full">
                                <defs>
                                  <linearGradient id="visits-gradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop
                                      offset="0%"
                                      stopColor="hsl(var(--accent))"
                                      stopOpacity="0.7"
                                    />
                                    <stop
                                      offset="100%"
                                      stopColor="hsl(var(--accent))"
                                      stopOpacity="0"
                                    />
                                  </linearGradient>
                                </defs>
                                <path d={areaPath} fill="url(#visits-gradient)" />
                                <polyline
                                  points={chartPoints}
                                  fill="none"
                                  stroke="hsl(var(--accent))"
                                  strokeWidth="2.5"
                                  strokeLinejoin="round"
                                  strokeLinecap="round"
                                />
                              </svg>
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground">
                                <span>Gráfico indisponível</span>
                                <span>Sem dados de projetos ainda</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selectedWidgetSet.has("projects_rank") ? (
                    <div
                      className="rounded-3xl border border-border/60 bg-card/60 p-6 animate-slide-up opacity-0"
                      style={{ animationDelay: "200ms" }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold">Projetos mais acessados</h2>
                          <p className="text-sm text-muted-foreground">
                            Ranking por projetos individuais
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="border-border/70 bg-card/60 px-4 text-muted-foreground hover:text-foreground"
                          asChild
                        >
                          <Link to={analyticsProjectHref}>Ver analytics de projetos</Link>
                        </Button>
                      </div>
                      {hasProjectViewData ? (
                        <div className="mt-6 space-y-4">
                          {rankedProjects.slice(0, 3).map((project) => (
                            <Link
                              key={project.id}
                              to={`/projeto/${project.id}`}
                              className="block rounded-2xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/40 hover:bg-primary/5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{project.title}</span>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  <span>{project.views} acessos</span>
                                  <Badge className="bg-card/80 text-muted-foreground">
                                    {project.status}
                                  </Badge>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-6 rounded-2xl border border-dashed border-border/60 bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
                          Conecte o backend de analytics para ver o ranking de acesso por projeto.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {selectedWidgetSet.has("recent_posts") ? (
                    <div
                      className="rounded-3xl border border-border/60 bg-card/60 p-6 animate-slide-up opacity-0"
                      style={{ animationDelay: "280ms" }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold">Posts mais recentes</h2>
                          <p className="text-sm text-muted-foreground">
                            Publicações e visualizações
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="border-border/70 bg-card/60 px-4 text-muted-foreground hover:text-foreground"
                          asChild
                        >
                          <Link to={analyticsPostHref}>Ver analytics de posts</Link>
                        </Button>
                      </div>
                      {recentPosts.length === 0 ? (
                        <div className="mt-6 rounded-2xl border border-dashed border-border/60 bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
                          Nenhum post publicado ainda.
                        </div>
                      ) : (
                        <div className="mt-6 space-y-4">
                          {recentPosts.map((post) => (
                            <Link
                              key={post.id}
                              to={`/postagem/${post.slug}`}
                              className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/40 hover:bg-primary/5 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <p className="font-medium">{post.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  Status: {post.status}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                <span className="text-muted-foreground">
                                  {post.views} visualizações
                                </span>
                                <Badge className="bg-card/80 text-muted-foreground">
                                  {formatDateTime(post.updatedAt || post.publishedAt)}
                                </Badge>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <aside className="space-y-6">
                  {selectedWidgetSet.has("ops_status") && !hideOperationalAlertsCard ? (
                    <div
                      className="rounded-3xl border border-border/60 bg-card/60 p-6 animate-slide-up opacity-0"
                      style={{ animationDelay: "320ms" }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold">Status operacional</h2>
                          <p className="text-sm text-muted-foreground">
                            Healthchecks e alertas internos
                          </p>
                        </div>
                        <Badge className={operationalStatusClass}>{operationalStatusLabel}</Badge>
                      </div>
                      {isLoadingOperationalAlerts ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-border/60 bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                          Carregando status operacional...
                        </div>
                      ) : operationalAlertsError ? (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                            {operationalAlertsError}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReloadTick((value) => value + 1)}
                          >
                            Tentar novamente
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {operationalAlerts?.alerts?.slice(0, 3).map((alert) => (
                            <div
                              key={alert.code}
                              className="rounded-2xl border border-border/60 bg-card/60 p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">{alert.title}</p>
                                <Badge className={alertSeverityClass(alert.severity)}>
                                  {alert.severity === "critical"
                                    ? "Crítico"
                                    : alert.severity === "warning"
                                      ? "Alerta"
                                      : "Info"}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {alert.description}
                              </p>
                            </div>
                          ))}
                          {(!operationalAlerts?.alerts ||
                            operationalAlerts.alerts.length === 0) && (
                            <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                              Nenhum alerta operacional ativo.
                            </div>
                          )}
                          <div className="pt-1">
                            <Button variant="outline" className="w-full" asChild>
                              <Link to="/dashboard/audit-log">Ver audit log</Link>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {selectedWidgetSet.has("comments_queue") ? (
                    <div
                      className="rounded-3xl border border-border/60 bg-card/60 p-6 animate-slide-up opacity-0"
                      style={{ animationDelay: "360ms" }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold">Comentários recentes</h2>
                          <p className="text-sm text-muted-foreground">Sistema por página</p>
                        </div>
                        <Badge className="bg-card/80 text-muted-foreground">
                          {pendingCommentsCount} pendentes
                        </Badge>
                      </div>
                      {recentComments.length === 0 ? (
                        <div className="mt-6 rounded-2xl border border-dashed border-border/60 bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
                          Nenhum comentário registrado ainda.
                        </div>
                      ) : (
                        <div className="mt-6 space-y-4">
                          {recentComments.slice(0, 3).map((comment) => (
                            <a
                              key={comment.id}
                              href={comment.url}
                              className="block rounded-2xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/40 hover:bg-primary/5"
                            >
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{comment.author}</span>
                                <span>{formatDateTime(comment.createdAt)}</span>
                              </div>
                              <p className="mt-2 text-sm text-foreground">{comment.message}</p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                Em: {comment.page}
                              </p>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {selectedWidgetSet.has("projects_quick") ? (
                    <div
                      className="rounded-3xl border border-border/60 bg-card/60 p-6 overflow-hidden animate-slide-up opacity-0"
                      style={{ animationDelay: "440ms" }}
                    >
                      <h2 className="text-lg font-semibold">Projetos cadastrados</h2>
                      <p className="text-sm text-muted-foreground">Acesso rápido ao catálogo.</p>
                      <div className="mt-5 space-y-3">
                        {projects.slice(0, 3).map((project) => (
                          <Link
                            key={project.id}
                            to={`/projeto/${project.id}`}
                            className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 px-4 py-3 text-sm transition hover:border-primary/40 hover:bg-primary/5"
                          >
                            <span className="font-medium">{project.title}</span>
                            <Badge className="bg-card/80 text-muted-foreground">
                              {project.status}
                            </Badge>
                          </Link>
                        ))}
                        {projects.length > 3 && (
                          <Link
                            to="/projetos"
                            className="block w-full rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-center text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                          >
                            Ver todos os projetos
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : null}
                </aside>
              </section>
            </>
          )}
        </section>
      </main>
      <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Personalizar painel</DialogTitle>
            <DialogDescription>
              Função atual: <strong>{homeRole}</strong>. Preferências salvas por função.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {DASHBOARD_WIDGET_IDS.map((widgetId) => {
              const isSelected = customDraftWidgets.includes(widgetId);
              const index = customDraftWidgets.indexOf(widgetId);
              return (
                <div
                  key={widgetId}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-card/60 px-3 py-2"
                >
                  <p className="text-sm">{DASHBOARD_WIDGET_LABELS[widgetId]}</p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => moveDraftWidget(widgetId, -1)}
                      disabled={!isSelected || index <= 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => moveDraftWidget(widgetId, 1)}
                      disabled={!isSelected || index < 0 || index >= customDraftWidgets.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => toggleDraftWidget(widgetId)}
                    >
                      {isSelected ? "Ativo" : "Oculto"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => void restoreRolePreset()}
              disabled={isSavingPreferences}
            >
              Restaurar padrão da função
            </Button>
            <Button
              type="button"
              onClick={() => void applyCustomDraft()}
              disabled={isSavingPreferences || customDraftWidgets.length === 0}
            >
              {isSavingPreferences ? "Salvando..." : "Salvar painel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
};

export default Dashboard;
