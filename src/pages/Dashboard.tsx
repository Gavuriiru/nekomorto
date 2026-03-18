import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import DashboardPageBadge from "@/components/dashboard/DashboardPageBadge";
import { dashboardPageLayoutTokens } from "@/components/dashboard/dashboard-page-tokens";
import {
  dashboardAnimationDelay,
  dashboardMotionDelays,
} from "@/components/dashboard/dashboard-motion";
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
import { Skeleton } from "@/components/ui/skeleton";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date";
import { useDashboardCurrentUser } from "@/hooks/use-dashboard-current-user";
import { useDashboardPreferences } from "@/hooks/use-dashboard-preferences";
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

type DashboardQuickProject = {
  id: string;
  title: string;
  status: string;
};

type DashboardOverviewMetrics = {
  totalProjects: number;
  totalMedia: number;
  activeProjects: number;
  finishedProjects: number;
  totalViewsLast7: number;
  totalProjectViewsLast7: number;
  totalPostViewsLast7: number;
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
  editor: ["recent_posts", "analytics_summary", "projects_quick"],
  moderador: ["comments_queue", "ops_status", "recent_posts"],
  admin: ["ops_status", "comments_queue", "analytics_summary", "recent_posts", "metrics_overview"],
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

const EMPTY_DASHBOARD_OVERVIEW = Object.freeze({
  metrics: {
    totalProjects: 0,
    totalMedia: 0,
    activeProjects: 0,
    finishedProjects: 0,
    totalViewsLast7: 0,
    totalProjectViewsLast7: 0,
    totalPostViewsLast7: 0,
  } satisfies DashboardOverviewMetrics,
  analyticsSeries7d: [] as Array<{ date: string; value: number }>,
  rankedProjects: [] as DashboardQuickProject[],
  recentPosts: [] as DashboardPost[],
  recentComments: [] as DashboardComment[],
  pendingCommentsCount: 0,
  quickProjects: [] as DashboardQuickProject[],
});

const normalizeDashboardOverview = (value: unknown) => {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const metricsInput =
    input.metrics && typeof input.metrics === "object"
      ? (input.metrics as Record<string, unknown>)
      : {};
  const normalizeQuickProject = (item: unknown): DashboardQuickProject | null => {
    if (!item || typeof item !== "object") {
      return null;
    }
    const candidate = item as Record<string, unknown>;
    const id = String(candidate.id || "").trim();
    if (!id) {
      return null;
    }
    return {
      id,
      title: String(candidate.title || ""),
      status: String(candidate.status || ""),
    };
  };
  const normalizePost = (item: unknown): DashboardPost | null => {
    if (!item || typeof item !== "object") {
      return null;
    }
    const candidate = item as Record<string, unknown>;
    const id = String(candidate.id || "").trim();
    if (!id) {
      return null;
    }
    return {
      id,
      slug: String(candidate.slug || ""),
      title: String(candidate.title || ""),
      views: Number(candidate.views || 0),
      status: String(candidate.status || ""),
      publishedAt: String(candidate.publishedAt || ""),
      updatedAt: String(candidate.updatedAt || candidate.publishedAt || ""),
    };
  };
  const normalizeComment = (item: unknown): DashboardComment | null => {
    if (!item || typeof item !== "object") {
      return null;
    }
    const candidate = item as Record<string, unknown>;
    const id = String(candidate.id || "").trim();
    if (!id) {
      return null;
    }
    return {
      id,
      author: String(candidate.author || ""),
      message: String(candidate.message || ""),
      page: String(candidate.page || ""),
      createdAt: String(candidate.createdAt || ""),
      url: String(candidate.url || ""),
      status: String(candidate.status || "approved"),
    };
  };

  return {
    metrics: {
      totalProjects: Number(metricsInput.totalProjects || 0),
      totalMedia: Number(metricsInput.totalMedia || 0),
      activeProjects: Number(metricsInput.activeProjects || 0),
      finishedProjects: Number(metricsInput.finishedProjects || 0),
      totalViewsLast7: Number(metricsInput.totalViewsLast7 || 0),
      totalProjectViewsLast7: Number(metricsInput.totalProjectViewsLast7 || 0),
      totalPostViewsLast7: Number(metricsInput.totalPostViewsLast7 || 0),
    } satisfies DashboardOverviewMetrics,
    analyticsSeries7d: Array.isArray(input.analyticsSeries7d)
      ? input.analyticsSeries7d
          .map((item) => {
            if (!item || typeof item !== "object") {
              return null;
            }
            const candidate = item as Record<string, unknown>;
            return {
              date: String(candidate.date || ""),
              value: Number(candidate.value || 0),
            };
          })
          .filter((item): item is { date: string; value: number } => Boolean(item?.date))
      : [],
    rankedProjects: Array.isArray(input.rankedProjects)
      ? input.rankedProjects
          .map(normalizeQuickProject)
          .filter((item): item is DashboardQuickProject => Boolean(item))
      : [],
    recentPosts: Array.isArray(input.recentPosts)
      ? input.recentPosts.map(normalizePost).filter((item): item is DashboardPost => Boolean(item))
      : [],
    recentComments: Array.isArray(input.recentComments)
      ? input.recentComments
          .map(normalizeComment)
          .filter((item): item is DashboardComment => Boolean(item))
      : [],
    pendingCommentsCount: Number(input.pendingCommentsCount || 0),
    quickProjects: Array.isArray(input.quickProjects)
      ? input.quickProjects
          .map(normalizeQuickProject)
          .filter((item): item is DashboardQuickProject => Boolean(item))
      : [],
  };
};

const dashboardOverviewMetricCardClassName = `${dashboardPageLayoutTokens.surfaceSolid} p-5`;
const dashboardOverviewCardShellClassName = `${dashboardPageLayoutTokens.surfaceSolid} rounded-3xl p-6`;
const dashboardOverviewInsetClassName = dashboardPageLayoutTokens.surfaceInset;
const dashboardOverviewInsetDashedClassName =
  "rounded-2xl border border-dashed border-border/70 bg-background";
const dashboardOverviewActionButtonClassName =
  "border-border/70 bg-background text-foreground/70 hover:bg-background hover:text-foreground";
const dashboardOverviewBadgeClassName = "bg-background text-foreground/70";
const dashboardOverviewMetaTextClassName = dashboardPageLayoutTokens.cardMetaText;

const DashboardLoadingSkeleton = () => (
  <div
    className="mt-10 space-y-10"
    data-testid="dashboard-loading-skeleton"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`dashboard-skeleton-metric-${index + 1}`}
          className={dashboardOverviewMetricCardClassName}
        >
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-8 w-20" />
          <Skeleton className="mt-3 h-3 w-36" />
        </div>
      ))}
    </div>
    <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <div className={dashboardOverviewCardShellClassName}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-9 w-24" />
          <Skeleton className="mt-3 h-3 w-40" />
          <Skeleton className="mt-6 h-32 w-full rounded-2xl" />
        </div>
        <div className={dashboardOverviewCardShellClassName}>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-2 h-3 w-32" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton
                key={`dashboard-skeleton-rank-${index + 1}`}
                className="h-16 w-full rounded-2xl"
              />
            ))}
          </div>
        </div>
        <div className={dashboardOverviewCardShellClassName}>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-2 h-3 w-40" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton
                key={`dashboard-skeleton-post-${index + 1}`}
                className="h-20 w-full rounded-2xl"
              />
            ))}
          </div>
        </div>
      </div>
      <aside className="space-y-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`dashboard-skeleton-side-${index + 1}`}
            className={dashboardOverviewCardShellClassName}
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-2 h-3 w-36" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: index === 0 ? 2 : 3 }).map((__, rowIndex) => (
                <Skeleton
                  key={`dashboard-skeleton-side-${index + 1}-row-${rowIndex + 1}`}
                  className="h-16 w-full rounded-2xl"
                />
              ))}
            </div>
          </div>
        ))}
      </aside>
    </section>
    <span className="sr-only">Carregando dashboard...</span>
  </div>
);

const Dashboard = () => {
  usePageMeta({ title: "Dashboard", noIndex: true });

  const navigate = useNavigate();
  const { currentUser, isLoadingUser } = useDashboardCurrentUser();
  const dashboardPreferences = useDashboardPreferences();
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [customDraftWidgets, setCustomDraftWidgets] = useState<DashboardWidgetId[]>([]);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [overview, setOverview] = useState(() => EMPTY_DASHBOARD_OVERVIEW);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [hasOverviewError, setHasOverviewError] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);
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
    let isActive = true;
    const loadOverview = async () => {
      setIsLoadingOverview(true);
      setHasOverviewError(false);
      try {
        const overviewResponse = await apiFetch(apiBase, "/api/dashboard/overview", {
          auth: true,
          cache: "no-store",
        });
        if (!isActive) {
          return;
        }
        if (!overviewResponse.ok) {
          throw new Error("dashboard_overview_load_failed");
        }
        const overviewPayload = await overviewResponse.json();
        if (!isActive) {
          return;
        }
        setOverview(normalizeDashboardOverview(overviewPayload));
      } catch {
        if (!isActive) {
          return;
        }
        setHasOverviewError(true);
        setOverview(EMPTY_DASHBOARD_OVERVIEW);
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

  const totalProjects = overview.metrics.totalProjects;
  const totalMedia = overview.metrics.totalMedia;
  const activeProjects = overview.metrics.activeProjects;
  const finishedProjects = overview.metrics.finishedProjects;
  const totalProjectViewsLast7 = overview.metrics.totalProjectViewsLast7;
  const totalPostViewsLast7 = overview.metrics.totalPostViewsLast7;
  const totalViewsLast7 = overview.metrics.totalViewsLast7;
  const analyticsAllHref = "/dashboard/analytics?range=30d&type=all";
  const analyticsProjectHref = "/dashboard/analytics?range=30d&type=project";
  const analyticsPostHref = "/dashboard/analytics?range=30d&type=post";

  const rankedProjects = overview.rankedProjects;
  const hasProjectViewData = rankedProjects.length > 0;
  const hasAnalyticsData = totalViewsLast7 > 0;
  const homeByRole = dashboardPreferences.dashboardPreferences.homeByRole || {};
  const homePreferences: Partial<Record<DashboardHomeRole, DashboardWidgetId[]>> = {
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
  const isLoadingPreferences =
    dashboardPreferences.hasProvider &&
    (!dashboardPreferences.hasResolved || dashboardPreferences.isLoading);
  const isDashboardReady = !isLoadingOverview && !isLoadingUser && !isLoadingPreferences;

  const dailyTotals = useMemo(
    () =>
      last7Days.map(
        (day) => overview.analyticsSeries7d.find((item) => item.date === day)?.value ?? 0,
      ),
    [last7Days, overview.analyticsSeries7d],
  );
  const recentPosts = overview.recentPosts;
  const recentComments = overview.recentComments;
  const pendingCommentsCount = overview.pendingCommentsCount;
  const quickProjects = overview.quickProjects;

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
  const operationalStatusVariant: "danger" | "warning" | "success" =
    operationalAlerts?.status === "fail"
      ? "danger"
      : operationalAlerts?.status === "degraded"
        ? "warning"
        : "success";
  const alertSeverityVariant = (severity?: string): "danger" | "warning" | null => {
    if (severity === "critical") return "danger";
    if (severity === "warning") return "warning";
    return null;
  };
  const operationalSeverityLabel = (severity?: string) => {
    if (severity === "critical") return "Crítico";
    if (severity === "warning") return "Alerta";
    return "Info";
  };
  const operationalActiveAlerts = operationalAlerts?.alerts ?? [];
  const operationalCheckFindings = operationalAlerts?.checkFindings ?? [];
  const hasOperationalReasons =
    operationalActiveAlerts.length > 0 || operationalCheckFindings.length > 0;
  const hasStatusWithoutReason =
    Boolean(operationalAlerts) &&
    (operationalAlerts.status === "degraded" || operationalAlerts.status === "fail") &&
    !hasOperationalReasons;
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
      setIsSavingPreferences(true);
      try {
        await dashboardPreferences.patchDashboardPreferences((previousDashboard) => ({
          homeByRole: {
            ...(previousDashboard.homeByRole && typeof previousDashboard.homeByRole === "object"
              ? previousDashboard.homeByRole
              : {}),
            [role]: {
              widgets: normalizedWidgets,
            },
          },
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
    [dashboardPreferences],
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

  const handleExportReport = async () => {
    if (isExportingReport) {
      return;
    }
    setIsExportingReport(true);
    const escapeCsv = (value: string | number | null | undefined) => {
      const text = String(value ?? "");
      if (text.includes('"') || text.includes(",") || text.includes("\n")) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    try {
      const [projectsResponse, postsResponse] = await Promise.all([
        apiFetch(apiBase, "/api/projects", { auth: true, cache: "no-store" }),
        apiFetch(apiBase, "/api/posts", { auth: true, cache: "no-store" }),
      ]);
      if (!projectsResponse.ok || !postsResponse.ok) {
        throw new Error("dashboard_export_load_failed");
      }
      const [projectsPayload, postsPayload] = (await Promise.all([
        projectsResponse.json(),
        postsResponse.json(),
      ])) as [
        {
          projects?: Array<{
            id: string;
            title?: string;
            status?: string;
            views?: number;
            commentsCount?: number;
            updatedAt?: string;
          }>;
        },
        {
          posts?: Array<{
            id: string;
            slug?: string;
            title?: string;
            status?: string;
            views?: number;
            commentsCount?: number;
            publishedAt?: string;
            updatedAt?: string;
          }>;
        },
      ];
      const exportProjects = Array.isArray(projectsPayload.projects)
        ? projectsPayload.projects
        : [];
      const exportPosts = Array.isArray(postsPayload.posts) ? postsPayload.posts : [];
      const totalProjectViews = exportProjects.reduce(
        (sum, project) => sum + Number(project.views || 0),
        0,
      );
      const totalPostViews = exportPosts.reduce((sum, post) => sum + Number(post.views || 0), 0);
      const totalViews = totalProjectViews + totalPostViews;

      const rows: string[] = [];
      rows.push("Resumo");
      rows.push(`Total de projetos,${totalProjects}`);
      rows.push(`Total de midias,${totalMedia}`);
      rows.push(`Projetos ativos,${activeProjects}`);
      rows.push(`Projetos finalizados,${finishedProjects}`);
      rows.push(`Acessos em projetos,${totalProjectViews}`);
      rows.push(`Acessos em posts,${totalPostViews}`);
      rows.push(`Acessos totais,${totalViews}`);
      rows.push("");
      rows.push("Projetos");
      rows.push("id,titulo,status,views,comentarios,atualizado_em");
      exportProjects.forEach((project) => {
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
      exportPosts.forEach((post) => {
        rows.push(
          [
            escapeCsv(post.id),
            escapeCsv(post.slug),
            escapeCsv(post.title),
            escapeCsv(post.status),
            escapeCsv(post.views ?? 0),
            escapeCsv(post.commentsCount ?? 0),
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
    } catch {
      toast({
        title: "Falha ao exportar relatorio",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsExportingReport(false);
    }
  };

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={isLoadingUser}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <DashboardPageContainer>
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <DashboardPageBadge>Painel interno</DashboardPageBadge>
            <h1 className="text-3xl font-semibold lg:text-4xl animate-slide-up">
              Painel de controle da comunidade
            </h1>
            <p
              className="max-w-2xl text-sm text-foreground/70 animate-slide-up opacity-0"
              style={dashboardAnimationDelay(dashboardMotionDelays.headerDescriptionMs)}
            >
              Visão geral dos projetos e do conteúdo. Assim que as integrações de analytics e
              comentários estiverem ativas, os dados aparecem aqui automaticamente.
            </p>
          </div>
          <div
            className="flex items-center gap-3 overflow-x-auto whitespace-nowrap pb-1 animate-slide-up opacity-0"
            style={dashboardAnimationDelay(dashboardMotionDelays.headerActionsMs)}
          >
            <Button
              variant="outline"
              className="border-border/70 bg-background px-4 text-foreground/70 hover:bg-background hover:text-foreground"
              onClick={() => setIsCustomizeOpen(true)}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Personalizar painel
            </Button>
            {isLoadingUser ? (
              <Skeleton
                className="h-10 w-40 shrink-0 rounded-md border border-border/70"
                data-testid="dashboard-header-user-action-skeleton"
              />
            ) : currentUser ? (
              <Button
                variant="outline"
                className="border-border/70 bg-background px-4 text-foreground/70 hover:bg-background hover:text-foreground"
                onClick={() => void handleExportReport()}
                disabled={isExportingReport}
              >
                {isExportingReport ? "Exportando..." : "Exportar relatorio"}
              </Button>
            ) : (
              <Link to="/login">
                <Button
                  variant="outline"
                  className="border-border/70 bg-background px-4 text-foreground/70 hover:bg-background hover:text-foreground"
                >
                  Fazer login
                </Button>
              </Link>
            )}
          </div>
        </header>

        {!isDashboardReady ? (
          <DashboardLoadingSkeleton />
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
                  className={`${dashboardOverviewMetricCardClassName} animate-slide-up opacity-0`}
                  style={dashboardAnimationDelay(0)}
                >
                  <p className={`text-sm ${dashboardOverviewMetaTextClassName}`}>
                    Projetos cadastrados
                  </p>
                  <div className="mt-3 text-2xl font-semibold">{totalProjects}</div>
                  <p className={`mt-2 text-xs ${dashboardOverviewMetaTextClassName}`}>
                    Catálogo completo do site.
                  </p>
                </div>
                <div
                  className={`${dashboardOverviewMetricCardClassName} animate-slide-up opacity-0`}
                  style={dashboardAnimationDelay(dashboardMotionDelays.sectionStepMs)}
                >
                  <p className={`text-sm ${dashboardOverviewMetaTextClassName}`}>
                    Mídias disponíveis
                  </p>
                  <div className="mt-3 text-2xl font-semibold">{totalMedia}</div>
                  <p className={`mt-2 text-xs ${dashboardOverviewMetaTextClassName}`}>
                    Downloads ativos nos projetos.
                  </p>
                </div>
                <div
                  className={`${dashboardOverviewMetricCardClassName} animate-slide-up opacity-0`}
                  style={dashboardAnimationDelay(dashboardMotionDelays.sectionStepMs * 2)}
                >
                  <p className={`text-sm ${dashboardOverviewMetaTextClassName}`}>Projetos ativos</p>
                  <div className="mt-3 text-2xl font-semibold">{activeProjects}</div>
                  <p className={`mt-2 text-xs ${dashboardOverviewMetaTextClassName}`}>
                    Em andamento ou produção.
                  </p>
                </div>
                <div
                  className={`${dashboardOverviewMetricCardClassName} animate-slide-up opacity-0`}
                  style={dashboardAnimationDelay(dashboardMotionDelays.sectionStepMs * 3)}
                >
                  <p className={`text-sm ${dashboardOverviewMetaTextClassName}`}>
                    Projetos finalizados
                  </p>
                  <div className="mt-3 text-2xl font-semibold">{finishedProjects}</div>
                  <p className={`mt-2 text-xs ${dashboardOverviewMetaTextClassName}`}>
                    Completo ou lançado.
                  </p>
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
                    className={`${dashboardOverviewCardShellClassName} animate-slide-up opacity-0`}
                    style={dashboardAnimationDelay(dashboardMotionDelays.headerActionsMs)}
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className={`text-sm ${dashboardOverviewMetaTextClassName}`}>
                          Análises de acessos
                        </p>
                        {hasAnalyticsData ? (
                          <div className="mt-3 flex items-center gap-3">
                            <span className="text-3xl font-semibold">{totalViewsLast7}</span>
                            <Badge className={dashboardOverviewBadgeClassName}>
                              Últimos 7 dias
                            </Badge>
                          </div>
                        ) : (
                          <p className={`mt-3 text-sm ${dashboardOverviewMetaTextClassName}`}>
                            Nenhum dado de acesso foi coletado ainda.
                          </p>
                        )}
                        {hasAnalyticsData ? (
                          <p className={`mt-2 text-xs ${dashboardOverviewMetaTextClassName}`}>
                            {totalProjectViewsLast7} em projetos e {totalPostViewsLast7} em posts
                          </p>
                        ) : null}
                        <div className="mt-4">
                          <Button
                            variant="outline"
                            className={dashboardOverviewActionButtonClassName}
                            asChild
                          >
                            <Link to={analyticsAllHref}>Ver analytics completos</Link>
                          </Button>
                        </div>
                      </div>
                      <div className="w-full max-w-xs">
                        <div className={`h-32 ${dashboardOverviewInsetClassName} p-4`}>
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
                            <div
                              className={`flex h-full flex-col items-center justify-center text-center text-xs ${dashboardOverviewMetaTextClassName}`}
                            >
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
                    className={`${dashboardOverviewCardShellClassName} animate-slide-up opacity-0`}
                    style={dashboardAnimationDelay(dashboardMotionDelays.sectionLeadMs)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Projetos mais acessados</h2>
                        <p className={`text-sm ${dashboardOverviewMetaTextClassName}`}>
                          Ranking por projetos individuais
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className={dashboardOverviewActionButtonClassName}
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
                            className={`block ${dashboardOverviewInsetClassName} p-4 transition hover:border-primary/40 hover:bg-primary/5`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{project.title}</span>
                              <div
                                className={`flex items-center gap-3 text-sm ${dashboardOverviewMetaTextClassName}`}
                              >
                                <span>{project.views} acessos</span>
                                <Badge className={dashboardOverviewBadgeClassName}>
                                  {project.status}
                                </Badge>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div
                        className={`mt-6 ${dashboardOverviewInsetDashedClassName} px-4 py-8 text-center text-sm ${dashboardOverviewMetaTextClassName}`}
                      >
                        Conecte o backend de analytics para ver o ranking de acesso por projeto.
                      </div>
                    )}
                  </div>
                ) : null}

                {selectedWidgetSet.has("recent_posts") ? (
                  <div
                    className={`${dashboardOverviewCardShellClassName} animate-slide-up opacity-0`}
                    style={dashboardAnimationDelay(
                      dashboardMotionDelays.sectionLeadMs + dashboardMotionDelays.sectionStepMs,
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Posts mais recentes</h2>
                        <p className={`text-sm ${dashboardOverviewMetaTextClassName}`}>
                          Publicações e visualizações
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className={dashboardOverviewActionButtonClassName}
                        asChild
                      >
                        <Link to={analyticsPostHref}>Ver analytics de posts</Link>
                      </Button>
                    </div>
                    {recentPosts.length === 0 ? (
                      <div
                        className={`mt-6 ${dashboardOverviewInsetDashedClassName} px-4 py-8 text-center text-sm ${dashboardOverviewMetaTextClassName}`}
                      >
                        Nenhum post publicado ainda.
                      </div>
                    ) : (
                      <div className="mt-6 space-y-4">
                        {recentPosts.map((post) => (
                          <Link
                            key={post.id}
                            to={`/postagem/${post.slug}`}
                            className={`flex flex-col gap-3 ${dashboardOverviewInsetClassName} p-4 transition hover:border-primary/40 hover:bg-primary/5 md:flex-row md:items-center md:justify-between`}
                          >
                            <div>
                              <p className="font-medium">{post.title}</p>
                              <p className={`text-xs ${dashboardOverviewMetaTextClassName}`}>
                                Status: {post.status}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className={dashboardOverviewMetaTextClassName}>
                                {post.views} visualizações
                              </span>
                              <Badge className={dashboardOverviewBadgeClassName}>
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
                    className={`${dashboardOverviewCardShellClassName} animate-slide-up opacity-0`}
                    style={dashboardAnimationDelay(
                      dashboardMotionDelays.sectionLeadMs + dashboardMotionDelays.sectionStepMs * 2,
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Status operacional</h2>
                        <p className={`text-sm ${dashboardOverviewMetaTextClassName}`}>
                          Healthchecks e alertas internos
                        </p>
                      </div>
                      {isLoadingOperationalAlerts ? (
                        <Skeleton
                          className="h-6 w-16 rounded-full"
                          data-testid="dashboard-ops-loading-badge"
                        />
                      ) : (
                        <Badge variant={operationalStatusVariant}>{operationalStatusLabel}</Badge>
                      )}
                    </div>
                    {isLoadingOperationalAlerts ? (
                      <div
                        className={`mt-4 space-y-3 ${dashboardOverviewInsetDashedClassName} px-4 py-6`}
                        data-testid="dashboard-ops-loading"
                        role="status"
                        aria-live="polite"
                        aria-busy="true"
                      >
                        <Skeleton className="h-4 w-2/5" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                        <Skeleton className="h-10 w-full rounded-xl" />
                        <span className="sr-only">Carregando status operacional...</span>
                      </div>
                    ) : operationalAlertsError ? (
                      <div className="mt-4 space-y-3">
                        <div
                          className={`${dashboardOverviewInsetDashedClassName} px-4 py-6 text-sm ${dashboardOverviewMetaTextClassName}`}
                        >
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
                      <div className="mt-4 space-y-4">
                        {operationalAlerts?.generatedAt ? (
                          <p className={`text-xs ${dashboardOverviewMetaTextClassName}`}>
                            Última atualização: {formatDateTime(operationalAlerts.generatedAt)}
                          </p>
                        ) : null}
                        {operationalActiveAlerts.length > 0 ? (
                          <section className="space-y-3">
                            <p
                              className={`text-xs font-semibold uppercase tracking-wide ${dashboardOverviewMetaTextClassName}`}
                            >
                              Alertas ativos
                            </p>
                            <div className="space-y-3">
                              {operationalActiveAlerts.map((alert) => (
                                <div
                                  key={alert.code}
                                  className={`${dashboardOverviewInsetClassName} p-3`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium">{alert.title}</p>
                                    <Badge
                                      variant={alertSeverityVariant(alert.severity) ?? undefined}
                                      className={
                                        alertSeverityVariant(alert.severity)
                                          ? undefined
                                          : dashboardOverviewBadgeClassName
                                      }
                                    >
                                      {operationalSeverityLabel(alert.severity)}
                                    </Badge>
                                  </div>
                                  <p
                                    className={`mt-1 text-xs ${dashboardOverviewMetaTextClassName}`}
                                  >
                                    {alert.description}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </section>
                        ) : null}
                        {operationalCheckFindings.length > 0 ? (
                          <section className="space-y-3">
                            <p
                              className={`text-xs font-semibold uppercase tracking-wide ${dashboardOverviewMetaTextClassName}`}
                            >
                              Healthchecks degradados
                            </p>
                            <div className="space-y-3">
                              {operationalCheckFindings.map((check) => (
                                <div
                                  key={`check-${check.name}`}
                                  className={`${dashboardOverviewInsetClassName} p-3`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium">{check.title}</p>
                                    <Badge
                                      variant={alertSeverityVariant(check.severity) ?? "warning"}
                                    >
                                      {operationalSeverityLabel(check.severity)}
                                    </Badge>
                                  </div>
                                  <p
                                    className={`mt-1 text-xs ${dashboardOverviewMetaTextClassName}`}
                                  >
                                    {check.description}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </section>
                        ) : null}
                        {!hasOperationalReasons && (
                          <div
                            className={`${dashboardOverviewInsetDashedClassName} px-4 py-6 text-sm ${dashboardOverviewMetaTextClassName}`}
                          >
                            {hasStatusWithoutReason
                              ? "Status operacional degradado sem causa detalhada no payload."
                              : "Nenhum alerta operacional ativo."}
                          </div>
                        )}
                        <div className="pt-1">
                          <Button
                            variant="outline"
                            className={`w-full ${dashboardOverviewActionButtonClassName}`}
                            asChild
                          >
                            <Link to="/dashboard/audit-log">Ver audit log</Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
                {selectedWidgetSet.has("comments_queue") ? (
                  <div
                    className={`${dashboardOverviewCardShellClassName} animate-slide-up opacity-0`}
                    style={dashboardAnimationDelay(
                      dashboardMotionDelays.sectionLeadMs + dashboardMotionDelays.sectionStepMs * 3,
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Comentários recentes</h2>
                        <p className={`text-sm ${dashboardOverviewMetaTextClassName}`}>
                          Sistema por página
                        </p>
                      </div>
                      <Badge className={dashboardOverviewBadgeClassName}>
                        {pendingCommentsCount} pendentes
                      </Badge>
                    </div>
                    {recentComments.length === 0 ? (
                      <div
                        className={`mt-6 ${dashboardOverviewInsetDashedClassName} px-4 py-8 text-center text-sm ${dashboardOverviewMetaTextClassName}`}
                      >
                        Nenhum comentário registrado ainda.
                      </div>
                    ) : (
                      <div className="mt-6 space-y-4">
                        {recentComments.slice(0, 3).map((comment) => (
                          <a
                            key={comment.id}
                            href={comment.url}
                            className={`block ${dashboardOverviewInsetClassName} p-4 transition hover:border-primary/40 hover:bg-primary/5`}
                          >
                            <div
                              className={`flex items-center justify-between text-xs ${dashboardOverviewMetaTextClassName}`}
                            >
                              <span>{comment.author}</span>
                              <span>{formatDateTime(comment.createdAt)}</span>
                            </div>
                            <p className="mt-2 text-sm text-foreground">{comment.message}</p>
                            <p className={`mt-2 text-xs ${dashboardOverviewMetaTextClassName}`}>
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
                    className={`${dashboardOverviewCardShellClassName} overflow-hidden animate-slide-up opacity-0`}
                    style={dashboardAnimationDelay(
                      dashboardMotionDelays.sectionLeadMs + dashboardMotionDelays.sectionStepMs * 4,
                    )}
                  >
                    <h2 className="text-lg font-semibold">Projetos cadastrados</h2>
                    <p className={`text-sm ${dashboardOverviewMetaTextClassName}`}>
                      Acesso rápido ao catálogo.
                    </p>
                    <div className="mt-5 space-y-3">
                      {quickProjects.map((project) => (
                        <Link
                          key={project.id}
                          to={`/projeto/${project.id}`}
                          className={`flex items-center justify-between ${dashboardOverviewInsetClassName} px-4 py-3 text-sm transition hover:border-primary/40 hover:bg-primary/5`}
                        >
                          <span className="font-medium">{project.title}</span>
                          <Badge className={dashboardOverviewBadgeClassName}>
                            {project.status}
                          </Badge>
                        </Link>
                      ))}
                      {totalProjects > 3 && (
                        <Link
                          to="/projetos"
                          className={`block w-full ${dashboardPageLayoutTokens.cardActionSurface} px-4 py-3 text-center text-sm ${dashboardOverviewMetaTextClassName} transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground`}
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
      </DashboardPageContainer>
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
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2"
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
