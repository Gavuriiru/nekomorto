import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardAnalytics, { __testing as analyticsTesting } from "@/pages/DashboardAnalytics";

const apiFetchMock = vi.hoisted(() => vi.fn());
const xAxisPropsSpy = vi.hoisted(() => vi.fn());
const yAxisPropsSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-dashboard-refresh-toast", () => ({
  useDashboardRefreshToast: () => undefined,
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  XAxis: (props: Record<string, unknown>) => {
    xAxisPropsSpy(props);
    return null;
  },
  YAxis: (props: Record<string, unknown>) => {
    yAxisPropsSpy(props);
    return null;
  },
}));

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="analytics-chart-container" className={className}>
      {children}
    </div>
  ),
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  value: vi.fn(),
  writable: true,
});

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

type TopContentEntry = {
  resourceType: string;
  resourceId: string;
  title: string;
  views: number;
  uniqueViews: number;
};

type AnalyticsDataset = {
  metrics?: OverviewResponse["metrics"];
  series?: Array<{ date: string; value: number }>;
  topEntries?: TopContentEntry[];
  referrerHost?: Array<{ key: string; count: number }>;
};

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

const buildAnalyticsDataset = ({
  views,
  uniqueViews,
  topEntries,
  series,
  referrerCount,
}: {
  views: number;
  uniqueViews?: number;
  topEntries?: TopContentEntry[];
  series?: Array<{ date: string; value: number }>;
  referrerCount?: number;
}): AnalyticsDataset => ({
  metrics: {
    views,
    uniqueViews: uniqueViews ?? Math.max(views - 180, 0),
    chapterViews: Math.max(Math.floor(views / 7), 0),
    downloadClicks: Math.max(Math.floor(views / 15), 0),
    commentsCreated: Math.max(Math.floor(views / 40), 0),
    commentsApproved: Math.max(Math.floor(views / 60), 0),
  },
  series: series ?? [
    { date: "2026-02-10", value: Math.max(Math.floor(views / 30), 1) },
    { date: "2026-02-11", value: Math.max(Math.floor(views / 24), 1) },
  ],
  topEntries: topEntries ?? [
    {
      resourceType: "project",
      resourceId: `project-${views}`,
      title: `Projeto ${views}`,
      views: Math.max(Math.floor(views / 3), 1),
      uniqueViews: Math.max(Math.floor(views / 5), 1),
    },
  ],
  referrerHost: [
    { key: "(internal)", count: referrerCount ?? Math.max(Math.floor(views / 10), 1) },
  ],
});

const createDeferredResponse = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

const changeAnalyticsSelect = async (index: number, optionName: string) => {
  fireEvent.click(screen.getAllByRole("combobox")[index] as HTMLElement);
  fireEvent.click(await screen.findByRole("option", { name: optionName }));
};

const setupApiMock = ({
  topEntries = [
    {
      resourceType: "project",
      resourceId: "p-1",
      title: "Projeto 1",
      views: 100,
      uniqueViews: 60,
    },
  ],
}: {
  topEntries?: TopContentEntry[];
} = {}) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string) => {
    const url = new URL(`https://example.test${endpoint}`);
    if (endpoint === "/api/me") {
      return mockJsonResponse(true, {
        id: "u-1",
        name: "Admin",
        username: "admin",
      });
    }
    if (endpoint.startsWith("/api/analytics/overview?")) {
      return mockJsonResponse(true, {
        metrics: buildAnalyticsDataset({ views: 300 }).metrics,
      });
    }
    if (endpoint.startsWith("/api/analytics/timeseries?")) {
      return mockJsonResponse(true, {
        metric: url.searchParams.get("metric") || "views",
        series: buildAnalyticsDataset({ views: 300 }).series,
      });
    }
    if (endpoint.startsWith("/api/analytics/top-content?")) {
      return mockJsonResponse(true, {
        entries: topEntries,
      });
    }
    if (endpoint.startsWith("/api/analytics/acquisition?")) {
      return mockJsonResponse(true, {
        referrerHost: buildAnalyticsDataset({ views: 300 }).referrerHost,
        utmSource: [],
      });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};
const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);
const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-pathname">{location.pathname}</div>;
};

const renderPage = (
  search = "range=30d&type=all&metric=views",
  { withRoutes = false }: { withRoutes?: boolean } = {},
) =>
  render(
    <MemoryRouter initialEntries={[`/dashboard/analytics?${search}`]}>
      {withRoutes ? (
        <Routes>
          <Route path="/dashboard/analytics" element={<DashboardAnalytics />} />
          <Route path="/postagem/:slug" element={<div data-testid="post-page">Post page</div>} />
          <Route path="/projeto/:id" element={<div data-testid="project-page">Project page</div>} />
        </Routes>
      ) : (
        <DashboardAnalytics />
      )}
      <LocationProbe />
    </MemoryRouter>,
  );

describe("DashboardAnalytics", () => {
  beforeEach(() => {
    analyticsTesting.clearAnalyticsCache();
    setupApiMock();
    xAxisPropsSpy.mockReset();
    yAxisPropsSpy.mockReset();
  });

  it("renderiza os quatro cards principais de consumo e move comentarios para bloco secundario", async () => {
    renderPage();

    await screen.findByText(/Performance e aquisi/i);
    expect(screen.getByRole("heading", { name: "Ranking" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Top conteúdos" })).not.toBeInTheDocument();
    const exportButton = screen.getByRole("button", { name: "Exportar" });
    const exportButtonTokens = classTokens(exportButton);
    expect(exportButtonTokens).toEqual(
      expect.arrayContaining(["h-10", "rounded-xl", "bg-background", "font-semibold"]),
    );
    expect(exportButtonTokens).not.toContain("interactive-lift-sm");
    expect(exportButtonTokens).not.toContain("pressable");
    expect(screen.queryByRole("button", { name: "Exportar CSV" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Views").length).toBeGreaterThan(0);
    expect(screen.getByText(/Views .*nicas/i)).toBeInTheDocument();
    expect(screen.getByText(/Leituras de cap.*tulos/i)).toBeInTheDocument();
    expect(screen.getByText("Cliques em downloads")).toBeInTheDocument();

    expect(screen.queryByRole("heading", { name: /Coment.*criados/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Comunidade e modera/i)).toBeInTheDocument();
    expect(screen.getByText(/Coment.*criados/i)).toBeInTheDocument();
    expect(screen.getByText(/Coment.*aprovados/i)).toBeInTheDocument();
    expect(screen.getByText(/Taxa de aprova/i)).toBeInTheDocument();

    const viewsMetricCard =
      screen.getByRole("heading", { name: "Views" }).parentElement?.parentElement || null;
    const moderationInset = screen.getByText(/Coment.*criados/i).parentElement || null;

    expect(viewsMetricCard).not.toBeNull();
    expect(classTokens(viewsMetricCard as HTMLElement)).toContain("bg-card");
    expect(classTokens(viewsMetricCard as HTMLElement)).toContain("hover:border-primary/60");
    expect(classTokens(viewsMetricCard as HTMLElement)).not.toContain("lift-hover");
    expect(moderationInset).not.toBeNull();
    expect(classTokens(moderationInset as HTMLElement)).toContain("bg-background");
  });

  it("respeita a metrica selecionada pela query string ao carregar a serie temporal", async () => {
    renderPage("range=30d&type=all&metric=download_clicks");

    await screen.findByText(/S.rie temporal \(Cliques em downloads\)/i);

    await waitFor(() => {
      const timeseriesCall = apiFetchMock.mock.calls.find((call) =>
        String(call[1]).startsWith("/api/analytics/timeseries?"),
      );
      expect(timeseriesCall).toBeDefined();
      expect(String(timeseriesCall?.[1])).toContain("metric=download_clicks");
    });
  });

  it("aplica layout responsivo no grafico e aquisicao sem overflow lateral", async () => {
    renderPage();

    await screen.findByText(/Performance e aquisi/i);

    const chartContainer = screen.getByTestId("analytics-chart-container");
    const chartContainerClasses = classTokens(chartContainer);
    expect(chartContainerClasses).toContain("min-w-0");
    expect(chartContainerClasses).toContain("w-full");
    expect(chartContainerClasses).toContain("h-52");
    expect(chartContainerClasses).toContain("sm:h-60");
    expect(chartContainerClasses).toContain("lg:h-[280px]");

    await waitFor(() => {
      expect(xAxisPropsSpy).toHaveBeenCalled();
      expect(yAxisPropsSpy).toHaveBeenCalled();
    });

    const xAxisProps = (xAxisPropsSpy.mock.calls.at(-1)?.[0] || {}) as Record<string, unknown>;
    expect(xAxisProps.tickFormatter).toEqual(expect.any(Function));
    expect(xAxisProps.interval).toBe("preserveStartEnd");
    expect(xAxisProps.minTickGap).toBe(18);
    expect(xAxisProps.tickMargin).toBe(8);

    const yAxisProps = (yAxisPropsSpy.mock.calls.at(-1)?.[0] || {}) as Record<string, unknown>;
    expect(yAxisProps.width).toBe(32);
    expect(yAxisProps.tickMargin).toBe(8);

    const acquisitionLabel = await screen.findByText("(interno)");
    expect(classTokens(acquisitionLabel)).toContain("min-w-0");
    expect(classTokens(acquisitionLabel)).toContain("flex-1");
    expect(classTokens(acquisitionLabel)).toContain("truncate");
    expect(acquisitionLabel.getAttribute("title")).toBe("(interno)");

    const acquisitionRow = acquisitionLabel.closest("div");
    expect(acquisitionRow).not.toBeNull();
    expect(classTokens(acquisitionRow as HTMLElement)).toContain("min-w-0");

    const countBadge = within(acquisitionRow as HTMLElement).getByText("30");
    expect(classTokens(countBadge)).toContain("shrink-0");
  });

  it("renderiza links nativos para posts e projetos em top conteudos", async () => {
    setupApiMock({
      topEntries: [
        {
          resourceType: "project",
          resourceId: "project-1",
          title: "Projeto 1",
          views: 100,
          uniqueViews: 60,
        },
        {
          resourceType: "post",
          resourceId: "post-slug",
          title: "Post 1",
          views: 80,
          uniqueViews: 40,
        },
      ],
    });

    renderPage();

    const projectLink = await screen.findByRole("link", { name: /Abrir Projeto Projeto 1/i });
    const postLink = screen.getByRole("link", { name: /Abrir Post Post 1/i });

    expect(projectLink).toHaveAttribute("href", "/projeto/project-1");
    expect(postLink).toHaveAttribute("href", "/postagem/post-slug");
    expect(projectLink).not.toHaveAttribute("tabindex", "-1");
    expect(postLink).not.toHaveAttribute("tabindex", "-1");
    expect(classTokens(projectLink)).toContain("w-full");
    expect(classTokens(projectLink)).toContain("group");
    expect(classTokens(projectLink)).toContain("rounded-lg");
    expect(classTokens(projectLink)).toContain("sm:grid-cols-[140px_minmax(0,1fr)_96px_96px]");
    expect(classTokens(projectLink)).toContain("sm:px-0");
    expect(classTokens(projectLink)).toContain("sm:gap-0");
    expect(classTokens(projectLink)).not.toContain("sm:gap-4");

    const projectTitle = within(projectLink).getByText("Projeto 1");
    expect(classTokens(projectTitle)).not.toContain("group-hover:underline");
    expect(classTokens(projectTitle)).not.toContain("group-focus-visible:underline");

    const typeWrapper = projectTitle.parentElement?.previousElementSibling as HTMLElement | null;
    const titleWrapper = projectTitle.parentElement as HTMLElement | null;
    const viewsWrapper = projectTitle.parentElement?.nextElementSibling as HTMLElement | null;
    const uniqueWrapper = viewsWrapper?.nextElementSibling as HTMLElement | null;

    expect(typeWrapper).not.toBeNull();
    expect(titleWrapper).not.toBeNull();
    expect(viewsWrapper).not.toBeNull();
    expect(uniqueWrapper).not.toBeNull();
    expect(classTokens(typeWrapper as HTMLElement)).toContain("sm:px-4");
    expect(classTokens(titleWrapper as HTMLElement)).toContain("sm:px-4");
    expect(classTokens(viewsWrapper as HTMLElement)).toContain("sm:px-4");
    expect(classTokens(uniqueWrapper as HTMLElement)).toContain("sm:px-4");
  });

  it("usa tabela fixa para alinhar o ranking com o cabecalho", async () => {
    renderPage();

    const rankingHeading = await screen.findByRole("heading", { name: "Ranking" });
    const rankingCard =
      rankingHeading.closest(".rounded-xl, .rounded-2xl, .rounded-3xl") ??
      rankingHeading.parentElement?.parentElement;
    expect(rankingCard).not.toBeNull();

    const table = within(rankingCard as HTMLElement).getByRole("table");
    expect(classTokens(table)).toContain("table-fixed");

    const cols = table.querySelectorAll("colgroup col");
    expect(cols).toHaveLength(4);
  });

  it("mantem loading bloqueante apenas no primeiro carregamento sem cache", async () => {
    const dataset = buildAnalyticsDataset({ views: 300, referrerCount: 30 });
    const overviewDeferred = createDeferredResponse();

    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string) => {
      if (endpoint === "/api/me") {
        return mockJsonResponse(true, {
          id: "u-1",
          name: "Admin",
          username: "admin",
        });
      }
      if (endpoint.startsWith("/api/analytics/overview?")) {
        return overviewDeferred.promise;
      }
      if (endpoint.startsWith("/api/analytics/timeseries?")) {
        return mockJsonResponse(true, { metric: "views", series: dataset.series });
      }
      if (endpoint.startsWith("/api/analytics/top-content?")) {
        return mockJsonResponse(true, { entries: dataset.topEntries });
      }
      if (endpoint.startsWith("/api/analytics/acquisition?")) {
        return mockJsonResponse(true, { referrerHost: dataset.referrerHost, utmSource: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderPage();

    expect(await screen.findByText(/Carregando análises/i)).toBeInTheDocument();

    overviewDeferred.resolve(mockJsonResponse(true, { metrics: dataset.metrics }));

    await screen.findByText("300");
    await waitFor(() => {
      expect(screen.queryByText(/Carregando análises/i)).not.toBeInTheDocument();
    });
  });

  it("mantem os dados visiveis e desabilita exportacao durante refresh de filtro", async () => {
    const defaultDataset = buildAnalyticsDataset({ views: 300, referrerCount: 30 });
    const nextDataset = buildAnalyticsDataset({ views: 700, referrerCount: 70 });
    const overviewDeferred = createDeferredResponse();

    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string) => {
      const url = new URL(`https://example.test${endpoint}`);
      const range = url.searchParams.get("range") || "30d";
      const dataset = range === "7d" ? nextDataset : defaultDataset;

      if (endpoint === "/api/me") {
        return mockJsonResponse(true, {
          id: "u-1",
          name: "Admin",
          username: "admin",
        });
      }
      if (endpoint.startsWith("/api/analytics/overview?")) {
        return range === "7d"
          ? overviewDeferred.promise
          : mockJsonResponse(true, { metrics: dataset.metrics });
      }
      if (endpoint.startsWith("/api/analytics/timeseries?")) {
        return mockJsonResponse(true, {
          metric: url.searchParams.get("metric") || "views",
          series: dataset.series,
        });
      }
      if (endpoint.startsWith("/api/analytics/top-content?")) {
        return mockJsonResponse(true, { entries: dataset.topEntries });
      }
      if (endpoint.startsWith("/api/analytics/acquisition?")) {
        return mockJsonResponse(true, { referrerHost: dataset.referrerHost, utmSource: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderPage();

    await screen.findByText("300");

    await changeAnalyticsSelect(0, "7 dias");

    expect(screen.queryByText(/Carregando análises/i)).not.toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("Atualizando dados...")).not.toHaveClass("invisible");
    expect(screen.getByRole("button", { name: "Exportar" })).toBeDisabled();

    overviewDeferred.resolve(mockJsonResponse(true, { metrics: nextDataset.metrics }));

    await screen.findByText("700");
    await waitFor(() => {
      expect(screen.getByText("Atualizando dados...")).toHaveClass("invisible");
    });
    expect(screen.getByRole("button", { name: "Exportar" })).not.toBeDisabled();
  });

  it("preserva o ultimo snapshot quando o refresh falha para um novo filtro", async () => {
    const defaultDataset = buildAnalyticsDataset({ views: 300, referrerCount: 30 });

    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string) => {
      const url = new URL(`https://example.test${endpoint}`);
      const range = url.searchParams.get("range") || "30d";

      if (endpoint === "/api/me") {
        return mockJsonResponse(true, {
          id: "u-1",
          name: "Admin",
          username: "admin",
        });
      }
      if (endpoint.startsWith("/api/analytics/overview?")) {
        if (range === "7d") {
          return mockJsonResponse(false, { error: "analytics_failed" }, 500);
        }
        return mockJsonResponse(true, { metrics: defaultDataset.metrics });
      }
      if (endpoint.startsWith("/api/analytics/timeseries?")) {
        return mockJsonResponse(true, {
          metric: url.searchParams.get("metric") || "views",
          series: defaultDataset.series,
        });
      }
      if (endpoint.startsWith("/api/analytics/top-content?")) {
        return mockJsonResponse(true, { entries: defaultDataset.topEntries });
      }
      if (endpoint.startsWith("/api/analytics/acquisition?")) {
        return mockJsonResponse(true, { referrerHost: defaultDataset.referrerHost, utmSource: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderPage();

    await screen.findByText("300");
    await changeAnalyticsSelect(0, "7 dias");

    expect(
      await screen.findByText(/Mantendo os últimos resultados carregados/i),
    ).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.queryByText(/Carregando análises/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar" })).toBeDisabled();
  });

  it("reaproveita cache quente ao voltar para um filtro visitado recentemente", async () => {
    const defaultDataset = buildAnalyticsDataset({ views: 300, referrerCount: 30 });
    const alternateDataset = buildAnalyticsDataset({ views: 700, referrerCount: 70 });
    const refreshedDefaultDataset = buildAnalyticsDataset({ views: 320, referrerCount: 32 });
    const overviewDeferred = createDeferredResponse();
    let defaultOverviewCalls = 0;

    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string) => {
      const url = new URL(`https://example.test${endpoint}`);
      const range = url.searchParams.get("range") || "30d";
      const currentDataset = range === "7d" ? alternateDataset : defaultDataset;

      if (endpoint === "/api/me") {
        return mockJsonResponse(true, {
          id: "u-1",
          name: "Admin",
          username: "admin",
        });
      }
      if (endpoint.startsWith("/api/analytics/overview?")) {
        if (range === "30d") {
          defaultOverviewCalls += 1;
          if (defaultOverviewCalls >= 2) {
            return overviewDeferred.promise;
          }
        }
        return mockJsonResponse(true, { metrics: currentDataset.metrics });
      }
      if (endpoint.startsWith("/api/analytics/timeseries?")) {
        return mockJsonResponse(true, {
          metric: url.searchParams.get("metric") || "views",
          series: currentDataset.series,
        });
      }
      if (endpoint.startsWith("/api/analytics/top-content?")) {
        return mockJsonResponse(true, { entries: currentDataset.topEntries });
      }
      if (endpoint.startsWith("/api/analytics/acquisition?")) {
        return mockJsonResponse(true, { referrerHost: currentDataset.referrerHost, utmSource: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderPage();

    await screen.findByText("300");
    await changeAnalyticsSelect(0, "7 dias");
    await screen.findByText("700");

    await changeAnalyticsSelect(0, "30 dias");

    await waitFor(() => {
      expect(screen.getByText("300")).toBeInTheDocument();
    });
    expect(screen.queryByText("700")).not.toBeInTheDocument();
    expect(screen.getByText("Atualizando dados...")).toBeInTheDocument();

    overviewDeferred.resolve(mockJsonResponse(true, { metrics: refreshedDefaultDataset.metrics }));

    await screen.findByText("320");
  });

  it("navega para a pagina publica ao clicar no link do top conteudo", async () => {
    setupApiMock({
      topEntries: [
        {
          resourceType: "post",
          resourceId: "post-slug",
          title: "Post 1",
          views: 80,
          uniqueViews: 40,
        },
      ],
    });

    renderPage("range=30d&type=all&metric=views", { withRoutes: true });

    const postLink = await screen.findByRole("link", { name: /Abrir Post Post 1/i });
    fireEvent.click(postLink);

    await screen.findByTestId("post-page");
    expect(screen.getByTestId("location-pathname")).toHaveTextContent("/postagem/post-slug");
  });
});
