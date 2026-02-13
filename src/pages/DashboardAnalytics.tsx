import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import DashboardShell from "@/components/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { usePageMeta } from "@/hooks/use-page-meta";

type RangeValue = "7d" | "30d" | "90d";
type TypeValue = "all" | "post" | "project";
type MetricValue = "views" | "unique_views" | "chapter_views" | "download_clicks";

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
const parseRange = (value: string | null): RangeValue =>
  value === "7d" || value === "30d" || value === "90d" ? value : "30d";
const parseType = (value: string | null): TypeValue =>
  value === "post" || value === "project" || value === "all" ? value : "all";
const parseMetric = (value: string | null): MetricValue =>
  value === "unique_views" || value === "chapter_views" || value === "download_clicks" || value === "views"
    ? value
    : "views";

const DashboardAnalytics = () => {
  usePageMeta({ title: "Analytics", noIndex: true });

  const apiBase = getApiBase();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const range = parseRange(searchParams.get("range"));
  const type = parseType(searchParams.get("type"));
  const metric = parseMetric(searchParams.get("metric"));
  const [overview, setOverview] = useState<OverviewResponse>({});
  const [timeseries, setTimeseries] = useState<TimeseriesResponse>({ series: [] });
  const [topContent, setTopContent] = useState<TopContentResponse>({ entries: [] });
  const [acquisition, setAcquisition] = useState<AcquisitionResponse>({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
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
    const load = async () => {
      setIsLoading(true);
      setError("");
      const params = new URLSearchParams({ range, type });
      try {
        const [overviewRes, timeseriesRes, topRes, acquisitionRes] = await Promise.all([
          apiFetch(apiBase, `/api/analytics/overview?${params.toString()}`, { auth: true }),
          apiFetch(apiBase, `/api/analytics/timeseries?${params.toString()}&metric=${metric}`, { auth: true }),
          apiFetch(apiBase, `/api/analytics/top-content?${params.toString()}&limit=10`, { auth: true }),
          apiFetch(apiBase, `/api/analytics/acquisition?${params.toString()}`, { auth: true }),
        ]);
        if (!isActive) return;
        if (!overviewRes.ok || !timeseriesRes.ok || !topRes.ok || !acquisitionRes.ok) {
          setError("Não foi possível carregar analytics.");
          setOverview({});
          setTimeseries({ series: [] });
          setTopContent({ entries: [] });
          setAcquisition({});
          return;
        }
        const [overviewData, timeseriesData, topData, acquisitionData] = await Promise.all([
          overviewRes.json(),
          timeseriesRes.json(),
          topRes.json(),
          acquisitionRes.json(),
        ]);
        if (!isActive) return;
        setOverview((overviewData || {}) as OverviewResponse);
        setTimeseries((timeseriesData || {}) as TimeseriesResponse);
        setTopContent((topData || {}) as TopContentResponse);
        setAcquisition((acquisitionData || {}) as AcquisitionResponse);
      } catch {
        if (!isActive) return;
        setError("Erro de conexão ao carregar analytics.");
        setOverview({});
        setTimeseries({ series: [] });
        setTopContent({ entries: [] });
        setAcquisition({});
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [apiBase, range, type, metric]);

  const chartData = useMemo(
    () => (Array.isArray(timeseries.series) ? timeseries.series.map((item) => ({ ...item })) : []),
    [timeseries.series],
  );

  const metrics = overview.metrics || {};
  const topEntries = Array.isArray(topContent.entries) ? topContent.entries : [];
  const referrerEntries = Array.isArray(acquisition.referrerHost) ? acquisition.referrerHost : [];
  const sourceEntries = Array.isArray(acquisition.utmSource) ? acquisition.utmSource : [];

  const commentsCreated = Number(metrics.commentsCreated || 0);
  const commentsApproved = Number(metrics.commentsApproved || 0);
  const commentsApprovalRate = commentsCreated > 0 ? commentsApproved / commentsCreated : null;

  const setRangeFilter = (value: RangeValue) => {
    const next = new URLSearchParams(searchParams);
    next.set("range", value);
    next.set("type", type);
    next.set("metric", metric);
    setSearchParams(next);
  };

  const setTypeFilter = (value: TypeValue) => {
    const next = new URLSearchParams(searchParams);
    next.set("range", range);
    next.set("type", value);
    next.set("metric", metric);
    setSearchParams(next);
  };

  const setMetricFilter = (value: MetricValue) => {
    const next = new URLSearchParams(searchParams);
    next.set("range", range);
    next.set("type", type);
    next.set("metric", value);
    setSearchParams(next);
  };

  const exportCsv = () => {
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
    referrerEntries.forEach((entry) => lines.push(`acquisition_referrer,${entry.key},${entry.count}`));

    lines.push("acquisition_source,source,count");
    sourceEntries.forEach((entry) => lines.push(`acquisition_source,${entry.key},${entry.count}`));

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
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
      <main className="pt-24">
        <section className="mx-auto w-full max-w-6xl space-y-6 px-6 pb-20 md:px-10">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex animate-fade-in items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Analytics
              </div>
              <h1 className="mt-3 animate-slide-up text-3xl font-semibold lg:text-4xl">Performance e aquisição</h1>
              <p
                className="mt-2 animate-slide-up text-sm text-muted-foreground opacity-0"
                style={{ animationDelay: "0.2s" }}
              >
                Foco em consumo de conteúdo, retenção e tendências de audiência.
              </p>
            </div>
            <div
              className="flex flex-col gap-3 animate-slide-up opacity-0 lg:flex-row lg:items-center"
              style={{ animationDelay: "0.24s" }}
            >
              <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
              <Select value={range} onValueChange={(value) => setRangeFilter(value as RangeValue)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 dias</SelectItem>
                  <SelectItem value="30d">30 dias</SelectItem>
                  <SelectItem value="90d">90 dias</SelectItem>
                </SelectContent>
              </Select>
              <Select value={type} onValueChange={(value) => setTypeFilter(value as TypeValue)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="post">Posts</SelectItem>
                  <SelectItem value="project">Projetos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={metric} onValueChange={(value) => setMetricFilter(value as MetricValue)}>
                <SelectTrigger className="w-[210px]">
                  <SelectValue placeholder="Métrica do gráfico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="views">Views</SelectItem>
                  <SelectItem value="unique_views">Views únicas</SelectItem>
                  <SelectItem value="chapter_views">Leituras de capítulos</SelectItem>
                  <SelectItem value="download_clicks">Cliques em downloads</SelectItem>
                </SelectContent>
              </Select>
              </div>
              <Button className="self-start lg:ml-auto lg:self-auto" variant="outline" onClick={exportCsv}>
                Exportar
              </Button>
            </div>
          </header>

          {error ? (
            <div
              className="animate-slide-up rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 opacity-0"
              style={{ animationDelay: "0.28s" }}
            >
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "40ms" }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Views</CardTitle>
              </CardHeader>
              <CardContent className={`text-3xl font-semibold ${isLoading ? "animate-pulse" : ""}`}>
                {isLoading ? "-" : formatInt(metrics.views || 0)}
              </CardContent>
            </Card>
            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "80ms" }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Views únicas</CardTitle>
              </CardHeader>
              <CardContent className={`text-3xl font-semibold ${isLoading ? "animate-pulse" : ""}`}>
                {isLoading ? "-" : formatInt(metrics.uniqueViews || 0)}
              </CardContent>
            </Card>
            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "120ms" }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Leituras de capítulos</CardTitle>
              </CardHeader>
              <CardContent className={`text-3xl font-semibold ${isLoading ? "animate-pulse" : ""}`}>
                {isLoading ? "-" : formatInt(metrics.chapterViews || 0)}
              </CardContent>
            </Card>
            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "160ms" }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Cliques em downloads</CardTitle>
              </CardHeader>
              <CardContent className={`text-3xl font-semibold ${isLoading ? "animate-pulse" : ""}`}>
                {isLoading ? "-" : formatInt(metrics.downloadClicks || 0)}
              </CardContent>
            </Card>
          </div>

          <Card className="animate-slide-up opacity-0" style={{ animationDelay: "190ms" }}>
            <CardHeader>
              <CardTitle>Comunidade e moderação</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Comentários criados</p>
                <p className={`mt-2 text-2xl font-semibold ${isLoading ? "animate-pulse" : ""}`}>
                  {isLoading ? "-" : formatInt(commentsCreated)}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Comentários aprovados</p>
                <p className={`mt-2 text-2xl font-semibold ${isLoading ? "animate-pulse" : ""}`}>
                  {isLoading ? "-" : formatInt(commentsApproved)}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Taxa de aprovação</p>
                <p className={`mt-2 text-2xl font-semibold ${isLoading ? "animate-pulse" : ""}`}>
                  {isLoading ? "-" : commentsApprovalRate === null ? "0,0%" : formatPercent(commentsApprovalRate)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "220ms" }}>
              <CardHeader>
                <CardTitle>Série temporal ({formatMetricLabel(metric)})</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="animate-pulse text-sm text-muted-foreground">Carregando série temporal...</p>
                ) : chartData.length ? (
                  <ChartContainer
                    className="h-[280px] w-full"
                    config={{ metric: { label: formatMetricLabel(metric), color: "hsl(var(--accent))" } }}
                  >
                    <LineChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis tickLine={false} axisLine={false} width={40} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="value" stroke="var(--color-metric)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados para o período selecionado.</p>
                )}
              </CardContent>
            </Card>

            <Card className="animate-slide-up opacity-0" style={{ animationDelay: "260ms" }}>
              <CardHeader>
                <CardTitle>Aquisição (origens)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <p className="animate-pulse text-sm text-muted-foreground">Carregando origens...</p>
                ) : referrerEntries.length ? (
                  referrerEntries.slice(0, 8).map((entry) => (
                    <div key={entry.key} className="flex items-center justify-between text-sm">
                      <span className="truncate text-muted-foreground">{formatAcquisitionLabel(entry.key)}</span>
                      <Badge variant="secondary">{formatInt(entry.count)}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados de aquisição.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="animate-slide-up opacity-0" style={{ animationDelay: "300ms" }}>
            <CardHeader>
              <CardTitle>Top conteúdos</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="animate-pulse text-sm text-muted-foreground">Carregando conteúdos...</p>
              ) : topEntries.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Únicas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topEntries.map((entry) => (
                      <TableRow key={`${entry.resourceType}:${entry.resourceId}`}>
                        <TableCell>{formatResourceType(entry.resourceType)}</TableCell>
                        <TableCell>{entry.title}</TableCell>
                        <TableCell className="text-right">{formatInt(entry.views)}</TableCell>
                        <TableCell className="text-right">{formatInt(entry.uniqueViews)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum conteúdo com views no período.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </DashboardShell>
  );
};

export default DashboardAnalytics;
