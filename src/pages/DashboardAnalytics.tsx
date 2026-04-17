import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import DashboardShell from "@/components/DashboardShell";
import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import { Combobox } from "@/components/dashboard/dashboard-form-controls";
import {
  dashboardAnimationDelay,
  dashboardMotionDelays,
} from "@/components/dashboard/dashboard-motion";
import { dashboardPageLayoutTokens } from "@/components/dashboard/dashboard-page-tokens";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AsyncState from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDashboardCurrentUser } from "@/hooks/use-dashboard-current-user";
import { useDashboardRefreshToast } from "@/hooks/use-dashboard-refresh-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { uiCopy } from "@/lib/ui-copy";

type RangeValue = "7d" | "30d" | "90d";
type TypeValue = "all" | "post" | "project";
type MetricValue = "views" | "unique_views" | "chapter_views" | "download_clicks";

const rangeOptions = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
];

const typeOptions = [
  { value: "all", label: "Todos" },
  { value: "post", label: "Posts" },
  { value: "project", label: "Projetos" },
];

const metricOptions = [
  { value: "views", label: "Views" },
  { value: "unique_views", label: "Views únicas" },
  { value: "chapter_views", label: "Leituras de capítulos" },
  { value: "download_clicks", label: "Cliques em downloads" },
];

type OverviewResponse = {
  metrics?: {
    views?: number;
    uniqueViews?: number;
    chapterViews?: number;
    downloadClicks?: number;
    commentsCreated?: number;
    commentsApproved?: number;
  };
};

type TimeseriesResponse = {
  metric?: MetricValue;
  series?: Array<{ date: string; value: number }>;
};

type TopContentResponse = {
  entries?: Array<{
    resourceType: string;
    resourceId: string;
    title: string;
    views: number;
    uniqueViews: number;
  }>;
};

type AcquisitionEntry = { key: string; count: number };

type AcquisitionResponse = {
  referrerHost?: AcquisitionEntry[];
  utmSource?: AcquisitionEntry[];
  utmMedium?: AcquisitionEntry[];
  utmCampaign?: AcquisitionEntry[];
};

type AnalyticsFilters = {
  range: RangeValue;
  type: TypeValue;
  metric: MetricValue;
};

type AnalyticsSnapshot = {
  filters: AnalyticsFilters;
  overview: OverviewResponse;
  timeseries: TimeseriesResponse;
  topContent: TopContentResponse;
  acquisition: AcquisitionResponse;
};

type AnalyticsCacheEntry = {
  snapshot: AnalyticsSnapshot;
  expiresAt: number;
};

const ANALYTICS_CACHE_TTL_MS = 60_000;
const ANALYTICS_CACHE_MAX_ENTRIES = 10;

const analyticsCache = new Map<string, AnalyticsCacheEntry>();

const formatInt = (value: number) => Number(value || 0).toLocaleString("pt-BR");
const formatPercent = (value: number) => `${(value * 100).toFixed(1).replace(".", ",")}%`;

const formatResourceType = (value: string) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "project") return "Projeto";
  if (normalized === "post") return "Post";
  return "Outro";
};

const formatAcquisitionLabel = (value: string) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "(internal)") return "(interno)";
  if (normalized === "(direct)") return "(direto)";
  return value;
};

const formatMetricLabel = (value: MetricValue) => {
  if (value === "unique_views") return "Views únicas";
  if (value === "chapter_views") return "Leituras de capítulos";
  if (value === "download_clicks") return "Cliques em downloads";
  return "Views";
};

const formatChartDateLabel = (value: string) => {
  const parts = String(value || "").split("-");
  if (parts.length !== 3) {
    return value;
  }
  const [, month, day] = parts;
  if (!month || !day) {
    return value;
  }
  return `${day}/${month}`;
};

const getTopContentHref = (resourceType: string, resourceId: string) => {
  const normalizedType = String(resourceType || "").toLowerCase();
  const normalizedId = String(resourceId || "").trim();
  if (!normalizedId) {
    return null;
  }
  if (normalizedType === "project") {
    return `/projeto/${encodeURIComponent(normalizedId)}`;
  }
  if (normalizedType === "post") {
    return `/postagem/${encodeURIComponent(normalizedId)}`;
  }
  return null;
};

const parseRange = (value: string | null): RangeValue =>
  value === "7d" || value === "30d" || value === "90d" ? value : "30d";

const parseType = (value: string | null): TypeValue =>
  value === "post" || value === "project" || value === "all" ? value : "all";

const parseMetric = (value: string | null): MetricValue =>
  value === "unique_views" ||
  value === "chapter_views" ||
  value === "download_clicks" ||
  value === "views"
    ? value
    : "views";

const buildAnalyticsCacheKey = (filters: AnalyticsFilters) =>
  `${filters.range}:${filters.type}:${filters.metric}`;

const readAnalyticsCache = (key: string) => {
  const cached = analyticsCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    analyticsCache.delete(key);
    return null;
  }
  analyticsCache.delete(key);
  analyticsCache.set(key, cached);
  return cached.snapshot;
};

const writeAnalyticsCache = (key: string, snapshot: AnalyticsSnapshot) => {
  analyticsCache.delete(key);
  analyticsCache.set(key, {
    snapshot,
    expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS,
  });
  while (analyticsCache.size > ANALYTICS_CACHE_MAX_ENTRIES) {
    const firstKey = analyticsCache.keys().next().value;
    if (!firstKey) {
      break;
    }
    analyticsCache.delete(firstKey);
  }
};

const buildAnalyticsSearchParams = (base: URLSearchParams, next: AnalyticsFilters) => {
  const params = new URLSearchParams(base);
  if (next.range === "30d") {
    params.delete("range");
  } else {
    params.set("range", next.range);
  }
  if (next.type === "all") {
    params.delete("type");
  } else {
    params.set("type", next.type);
  }
  if (next.metric === "views") {
    params.delete("metric");
  } else {
    params.set("metric", next.metric);
  }
  return params;
};

export const __testing = {
  clearAnalyticsCache: () => {
    analyticsCache.clear();
  },
};

const DashboardAnalytics = () => {
  usePageMeta({ title: uiCopy.navigation.analytics, noIndex: true });

  const apiBase = getApiBase();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const range = parseRange(searchParams.get("range"));
  const type = parseType(searchParams.get("type"));
  const metric = parseMetric(searchParams.get("metric"));
  const requestedFilters = useMemo<AnalyticsFilters>(
    () => ({ range, type, metric }),
    [metric, range, type],
  );
  const queryKey = useMemo(() => buildAnalyticsCacheKey(requestedFilters), [requestedFilters]);
  const [initialSnapshot] = useState<AnalyticsSnapshot | null>(() => readAnalyticsCache(queryKey));
  const [displayedSnapshot, setDisplayedSnapshot] = useState<AnalyticsSnapshot | null>(
    initialSnapshot,
  );
  const [loadError, setLoadError] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(!initialSnapshot);
  const [isRefreshing, setIsRefreshing] = useState(Boolean(initialSnapshot));
  const [hasLoadedOnce, setHasLoadedOnce] = useState(Boolean(initialSnapshot));
  const [reloadTick, setReloadTick] = useState(0);
  const hasLoadedOnceRef = useRef(hasLoadedOnce);
  const { currentUser, isLoadingUser } = useDashboardCurrentUser();

  useEffect(() => {
    hasLoadedOnceRef.current = hasLoadedOnce;
  }, [hasLoadedOnce]);

  useEffect(() => {
    const cachedSnapshot = readAnalyticsCache(queryKey);
    if (cachedSnapshot) {
      setDisplayedSnapshot(cachedSnapshot);
      setHasLoadedOnce(true);
      setIsInitialLoading(false);
    }

    let isActive = true;
    const shouldRefreshInBackground = hasLoadedOnceRef.current || Boolean(cachedSnapshot);

    const load = async () => {
      if (shouldRefreshInBackground) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }
      setLoadError("");

      const nextFilters: AnalyticsFilters = { range, type, metric };
      const params = new URLSearchParams({
        range: nextFilters.range,
        type: nextFilters.type,
      });

      try {
        const [overviewRes, timeseriesRes, topRes, acquisitionRes] = await Promise.all([
          apiFetch(apiBase, `/api/analytics/overview?${params.toString()}`, {
            auth: true,
            cache: "no-store",
          }),
          apiFetch(
            apiBase,
            `/api/analytics/timeseries?${params.toString()}&metric=${nextFilters.metric}`,
            {
              auth: true,
              cache: "no-store",
            },
          ),
          apiFetch(apiBase, `/api/analytics/top-content?${params.toString()}&limit=10`, {
            auth: true,
            cache: "no-store",
          }),
          apiFetch(apiBase, `/api/analytics/acquisition?${params.toString()}`, {
            auth: true,
            cache: "no-store",
          }),
        ]);

        if (!isActive) {
          return;
        }

        if (!overviewRes.ok || !timeseriesRes.ok || !topRes.ok || !acquisitionRes.ok) {
          setLoadError("Não foi possível carregar as análises.");
          return;
        }

        const [overviewData, timeseriesData, topData, acquisitionData] = await Promise.all([
          overviewRes.json(),
          timeseriesRes.json(),
          topRes.json(),
          acquisitionRes.json(),
        ]);

        if (!isActive) {
          return;
        }

        const nextSnapshot: AnalyticsSnapshot = {
          filters: nextFilters,
          overview: (overviewData || {}) as OverviewResponse,
          timeseries: (timeseriesData || {}) as TimeseriesResponse,
          topContent: (topData || {}) as TopContentResponse,
          acquisition: (acquisitionData || {}) as AcquisitionResponse,
        };

        setDisplayedSnapshot(nextSnapshot);
        setHasLoadedOnce(true);
        writeAnalyticsCache(queryKey, nextSnapshot);
      } catch {
        if (!isActive) {
          return;
        }
        setLoadError("Erro de conexão ao carregar as análises.");
      } finally {
        if (isActive) {
          setIsInitialLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [apiBase, metric, queryKey, range, reloadTick, type]);

  const displayedFilters = displayedSnapshot?.filters ?? requestedFilters;
  const isSnapshotAlignedWithRequestedFilters =
    displayedSnapshot !== null && buildAnalyticsCacheKey(displayedFilters) === queryKey;

  useDashboardRefreshToast({
    active: isRefreshing && hasLoadedOnce,
    title: "Atualizando análises",
    description: "Buscando métricas e tendências do período selecionado.",
  });

  const chartData = useMemo(
    () =>
      Array.isArray(displayedSnapshot?.timeseries.series)
        ? displayedSnapshot.timeseries.series.map((item) => ({ ...item }))
        : [],
    [displayedSnapshot?.timeseries.series],
  );

  const metrics = displayedSnapshot?.overview.metrics || {};
  const topEntries = Array.isArray(displayedSnapshot?.topContent.entries)
    ? displayedSnapshot.topContent.entries
    : [];
  const referrerEntries = Array.isArray(displayedSnapshot?.acquisition.referrerHost)
    ? displayedSnapshot.acquisition.referrerHost
    : [];
  const sourceEntries = Array.isArray(displayedSnapshot?.acquisition.utmSource)
    ? displayedSnapshot.acquisition.utmSource
    : [];
  const commentsCreated = Number(metrics.commentsCreated || 0);
  const commentsApproved = Number(metrics.commentsApproved || 0);
  const commentsApprovalRate = commentsCreated > 0 ? commentsApproved / commentsCreated : null;
  const hasBlockingError = !displayedSnapshot && Boolean(loadError);
  const hasRetainedError = Boolean(displayedSnapshot) && Boolean(loadError);

  const updateFilters = (nextRange: RangeValue, nextType: TypeValue, nextMetric: MetricValue) => {
    const nextParams = buildAnalyticsSearchParams(searchParams, {
      range: nextRange,
      type: nextType,
      metric: nextMetric,
    });
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  };

  const setRangeFilter = (value: RangeValue) => {
    updateFilters(value, type, metric);
  };

  const setTypeFilter = (value: TypeValue) => {
    updateFilters(range, value, metric);
  };

  const setMetricFilter = (value: MetricValue) => {
    updateFilters(range, type, value);
  };

  const exportCsv = () => {
    if (!displayedSnapshot || isRefreshing || !isSnapshotAlignedWithRequestedFilters) {
      return;
    }

    const lines: string[] = [];
    lines.push("section,key,value");
    lines.push(`kpi,views,${Number(metrics.views || 0)}`);
    lines.push(`kpi,unique_views,${Number(metrics.uniqueViews || 0)}`);
    lines.push(`kpi,chapter_views,${Number(metrics.chapterViews || 0)}`);
    lines.push(`kpi,download_clicks,${Number(metrics.downloadClicks || 0)}`);
    lines.push(`kpi,comments_created,${commentsCreated}`);
    lines.push(`kpi,comments_approved,${commentsApproved}`);

    lines.push("timeseries,date,value");
    chartData.forEach((item) => lines.push(`timeseries,${item.date},${Number(item.value || 0)}`));

    lines.push("top_content,type,title,views,unique_views");
    topEntries.forEach((entry) =>
      lines.push(
        [
          "top_content",
          entry.resourceType,
          `"${String(entry.title || "").replace(/"/g, '""')}"`,
          Number(entry.views || 0),
          Number(entry.uniqueViews || 0),
        ].join(","),
      ),
    );

    lines.push("acquisition_referrer,host,count");
    referrerEntries.forEach((entry) =>
      lines.push(`acquisition_referrer,${entry.key},${entry.count}`),
    );

    lines.push("acquisition_source,source,count");
    sourceEntries.forEach((entry) => lines.push(`acquisition_source,${entry.key},${entry.count}`));

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `analytics-${displayedFilters.range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={isLoadingUser}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <DashboardPageContainer>
        <DashboardPageHeader
          badge={uiCopy.navigation.analytics}
          title="Performance e aquisição"
          description="Foco em consumo de conteúdo, retenção e tendências de audiência."
          actions={
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
                <Combobox
                  value={range}
                  onValueChange={(value) => setRangeFilter(value as RangeValue)}
                  ariaLabel="Selecionar período"
                  options={rangeOptions}
                  searchable={false}
                  className="w-[130px]"
                />
                <Combobox
                  value={type}
                  onValueChange={(value) => setTypeFilter(value as TypeValue)}
                  ariaLabel="Selecionar tipo"
                  options={typeOptions}
                  searchable={false}
                  className="w-[150px]"
                />
                <Combobox
                  value={metric}
                  onValueChange={(value) => setMetricFilter(value as MetricValue)}
                  ariaLabel="Selecionar métrica do gráfico"
                  options={metricOptions}
                  searchable={false}
                  className="w-[210px]"
                />
              </div>
              <div className="flex items-center self-start lg:self-auto">
                <Badge
                  variant="secondary"
                  aria-hidden={!isRefreshing}
                  className={
                    isRefreshing
                      ? "bg-background text-foreground/70"
                      : "pointer-events-none invisible bg-background text-foreground/70"
                  }
                >
                  Atualizando dados...
                </Badge>
              </div>
              <DashboardActionButton
                type="button"
                size="toolbar"
                className="self-start lg:ml-auto lg:self-auto"
                onClick={exportCsv}
                disabled={
                  !displayedSnapshot || isRefreshing || !isSnapshotAlignedWithRequestedFilters
                }
              >
                Exportar
              </DashboardActionButton>
            </div>
          }
        />

        {hasRetainedError ? (
          <Alert
            className={`${dashboardPageLayoutTokens.surfaceSolid} animate-slide-up opacity-0`}
            style={dashboardAnimationDelay(dashboardMotionDelays.sectionLeadMs)}
          >
            <AlertDescription className="flex flex-col gap-3 text-foreground/70 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p>{loadError}</p>
                <p>Mantendo os últimos resultados carregados.</p>
              </div>
              <DashboardActionButton onClick={() => setReloadTick((previous) => previous + 1)}>
                Tentar novamente
              </DashboardActionButton>
            </AlertDescription>
          </Alert>
        ) : null}

        {isInitialLoading && !displayedSnapshot ? (
          <AsyncState
            kind="loading"
            title="Carregando análises"
            description="Buscando métricas, série temporal e aquisição."
          />
        ) : hasBlockingError ? (
          <AsyncState
            kind="error"
            title="Não foi possível carregar as análises"
            description={loadError}
            action={
              <DashboardActionButton onClick={() => setReloadTick((previous) => previous + 1)}>
                Tentar novamente
              </DashboardActionButton>
            }
          />
        ) : displayedSnapshot ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card
                lift={false}
                className={`${dashboardPageLayoutTokens.surfaceSolid} animate-slide-up opacity-0`}
                style={dashboardAnimationDelay(0)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm ${dashboardPageLayoutTokens.cardMetaText}`}>
                    Views
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">
                  {formatInt(metrics.views || 0)}
                </CardContent>
              </Card>
              <Card
                lift={false}
                className={`${dashboardPageLayoutTokens.surfaceSolid} animate-slide-up opacity-0`}
                style={dashboardAnimationDelay(dashboardMotionDelays.sectionStepMs)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm ${dashboardPageLayoutTokens.cardMetaText}`}>
                    Views únicas
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">
                  {formatInt(metrics.uniqueViews || 0)}
                </CardContent>
              </Card>
              <Card
                lift={false}
                className={`${dashboardPageLayoutTokens.surfaceSolid} animate-slide-up opacity-0`}
                style={dashboardAnimationDelay(dashboardMotionDelays.sectionStepMs * 2)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm ${dashboardPageLayoutTokens.cardMetaText}`}>
                    Leituras de capítulos
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">
                  {formatInt(metrics.chapterViews || 0)}
                </CardContent>
              </Card>
              <Card
                lift={false}
                className={`${dashboardPageLayoutTokens.surfaceSolid} animate-slide-up opacity-0`}
                style={dashboardAnimationDelay(dashboardMotionDelays.sectionStepMs * 3)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm ${dashboardPageLayoutTokens.cardMetaText}`}>
                    Cliques em downloads
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-semibold">
                  {formatInt(metrics.downloadClicks || 0)}
                </CardContent>
              </Card>
            </div>

            <Card
              lift={false}
              className={`${dashboardPageLayoutTokens.surfaceSolid} animate-slide-up opacity-0`}
              style={dashboardAnimationDelay(dashboardMotionDelays.headerActionsMs)}
            >
              <CardHeader>
                <CardTitle>Comunidade e moderação</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className={`${dashboardPageLayoutTokens.surfaceInset} rounded-xl p-4`}>
                  <p
                    className={`text-xs uppercase tracking-wide ${dashboardPageLayoutTokens.cardMetaText}`}
                  >
                    Comentários criados
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{formatInt(commentsCreated)}</p>
                </div>
                <div className={`${dashboardPageLayoutTokens.surfaceInset} rounded-xl p-4`}>
                  <p
                    className={`text-xs uppercase tracking-wide ${dashboardPageLayoutTokens.cardMetaText}`}
                  >
                    Comentários aprovados
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{formatInt(commentsApproved)}</p>
                </div>
                <div className={`${dashboardPageLayoutTokens.surfaceInset} rounded-xl p-4`}>
                  <p
                    className={`text-xs uppercase tracking-wide ${dashboardPageLayoutTokens.cardMetaText}`}
                  >
                    Taxa de aprovação
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {commentsApprovalRate === null ? "0,0%" : formatPercent(commentsApprovalRate)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Card
                lift={false}
                className={`${dashboardPageLayoutTokens.surfaceSolid} min-w-0 animate-slide-up opacity-0`}
                style={dashboardAnimationDelay(dashboardMotionDelays.sectionLeadMs)}
              >
                <CardHeader>
                  <CardTitle>
                    Série temporal ({formatMetricLabel(displayedFilters.metric)})
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                  {chartData.length ? (
                    <ChartContainer
                      className="min-w-0 w-full max-w-full h-52 sm:h-60 lg:h-[280px]"
                      config={{
                        metric: {
                          label: formatMetricLabel(displayedFilters.metric),
                          color: "hsl(var(--accent))",
                        },
                      }}
                    >
                      <LineChart
                        data={chartData}
                        margin={{ left: 12, right: 12, top: 12, bottom: 8 }}
                      >
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatChartDateLabel}
                          interval="preserveStartEnd"
                          minTickGap={18}
                          tickMargin={8}
                        />
                        <YAxis tickLine={false} axisLine={false} width={32} tickMargin={8} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="var(--color-metric)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <AsyncState
                      kind="empty"
                      title="Sem dados para o período selecionado."
                      className="border-dashed border-border/70 bg-background py-8 text-foreground/70"
                    />
                  )}
                </CardContent>
              </Card>

              <Card
                lift={false}
                className={`${dashboardPageLayoutTokens.surfaceSolid} min-w-0 animate-slide-up opacity-0`}
                style={dashboardAnimationDelay(
                  dashboardMotionDelays.sectionLeadMs + dashboardMotionDelays.sectionStepMs,
                )}
              >
                <CardHeader>
                  <CardTitle>Aquisição (origens)</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 space-y-3">
                  {referrerEntries.length ? (
                    referrerEntries.slice(0, 8).map((entry) => (
                      <div key={entry.key} className="flex min-w-0 items-center gap-2 text-sm">
                        <span
                          title={formatAcquisitionLabel(entry.key)}
                          className={`min-w-0 flex-1 truncate ${dashboardPageLayoutTokens.cardMetaText}`}
                        >
                          {formatAcquisitionLabel(entry.key)}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {formatInt(entry.count)}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <AsyncState
                      kind="empty"
                      title="Sem dados de aquisição."
                      className="border-dashed border-border/70 bg-background py-8 text-foreground/70"
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <Card
              lift={false}
              className={`${dashboardPageLayoutTokens.surfaceSolid} animate-slide-up opacity-0`}
              style={dashboardAnimationDelay(
                dashboardMotionDelays.sectionLeadMs + dashboardMotionDelays.sectionStepMs * 2,
              )}
            >
              <CardHeader>
                <CardTitle>Ranking</CardTitle>
              </CardHeader>
              <CardContent>
                {topEntries.length ? (
                  <Table className="table-fixed">
                    <colgroup>
                      <col className="sm:w-[140px]" />
                      <col />
                      <col className="sm:w-[96px]" />
                      <col className="sm:w-[96px]" />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Únicas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topEntries.map((entry) => {
                        const entryHref = getTopContentHref(entry.resourceType, entry.resourceId);
                        return (
                          <TableRow
                            key={`${entry.resourceType}:${entry.resourceId}`}
                            className={entryHref ? "[&:hover>td]:!bg-transparent" : undefined}
                          >
                            {entryHref ? (
                              <TableCell colSpan={4} className="p-0">
                                <Link
                                  to={entryHref}
                                  className="group grid w-full gap-3 rounded-lg px-4 py-4 text-sm transition hover:bg-muted/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset sm:grid-cols-[140px_minmax(0,1fr)_96px_96px] sm:items-center sm:gap-0 sm:px-0"
                                  aria-label={`Abrir ${formatResourceType(entry.resourceType)} ${entry.title}`}
                                >
                                  <span className="flex flex-col gap-1 sm:px-4">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/70 sm:hidden">
                                      Tipo
                                    </span>
                                    <span className="text-foreground/70">
                                      {formatResourceType(entry.resourceType)}
                                    </span>
                                  </span>
                                  <span className="min-w-0 flex flex-col gap-1 sm:px-4">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/70 sm:hidden">
                                      Título
                                    </span>
                                    <span className="truncate font-medium text-foreground">
                                      {entry.title}
                                    </span>
                                  </span>
                                  <span className="flex flex-col gap-1 sm:px-4 sm:text-right">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/70 sm:hidden">
                                      Views
                                    </span>
                                    <span className="sm:text-right">{formatInt(entry.views)}</span>
                                  </span>
                                  <span className="flex flex-col gap-1 sm:px-4 sm:text-right">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/70 sm:hidden">
                                      Unicas
                                    </span>
                                    <span className="sm:text-right">
                                      {formatInt(entry.uniqueViews)}
                                    </span>
                                  </span>
                                </Link>
                              </TableCell>
                            ) : (
                              <>
                                <TableCell>{formatResourceType(entry.resourceType)}</TableCell>
                                <TableCell>{entry.title}</TableCell>
                                <TableCell className="text-right">
                                  {formatInt(entry.views)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatInt(entry.uniqueViews)}
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <AsyncState
                    kind="empty"
                    title="Nenhum conteúdo com views no período."
                    className="border-dashed border-border/70 bg-background py-8 text-foreground/70"
                  />
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </DashboardPageContainer>
    </DashboardShell>
  );
};

export default DashboardAnalytics;
