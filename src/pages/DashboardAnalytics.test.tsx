import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardAnalytics from "@/pages/DashboardAnalytics";

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
        metrics: {
          views: 300,
          uniqueViews: 120,
          chapterViews: 44,
          downloadClicks: 19,
          commentsCreated: 8,
          commentsApproved: 5,
        },
      });
    }
    if (endpoint.startsWith("/api/analytics/timeseries?")) {
      return mockJsonResponse(true, {
        metric: url.searchParams.get("metric") || "views",
        series: [
          { date: "2026-02-10", value: 10 },
          { date: "2026-02-11", value: 15 },
        ],
      });
    }
    if (endpoint.startsWith("/api/analytics/top-content?")) {
      return mockJsonResponse(true, {
        entries: topEntries,
      });
    }
    if (endpoint.startsWith("/api/analytics/acquisition?")) {
      return mockJsonResponse(true, {
        referrerHost: [{ key: "(internal)", count: 30 }],
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
    setupApiMock();
    xAxisPropsSpy.mockReset();
    yAxisPropsSpy.mockReset();
  });

  it("renderiza os quatro cards principais de consumo e move comentarios para bloco secundario", async () => {
    renderPage();

    await screen.findByText(/Performance e aquisi/i);
    expect(screen.getByRole("heading", { name: "Ranking" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Top conteúdos" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar" })).toBeInTheDocument();
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
