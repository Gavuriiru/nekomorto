import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardAnalytics from "@/pages/DashboardAnalytics";

const apiFetchMock = vi.hoisted(() => vi.fn());

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
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const setupApiMock = () => {
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
        entries: [
          {
            resourceType: "project",
            resourceId: "p-1",
            title: "Projeto 1",
            views: 100,
            uniqueViews: 60,
          },
        ],
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

const renderPage = (search = "range=30d&type=all&metric=views") =>
  render(
    <MemoryRouter initialEntries={[`/dashboard/analytics?${search}`]}>
      <DashboardAnalytics />
    </MemoryRouter>,
  );

describe("DashboardAnalytics", () => {
  beforeEach(() => {
    setupApiMock();
  });

  it("renderiza os quatro cards principais de consumo e move comentários para bloco secundário", async () => {
    renderPage();

    await screen.findByText("Performance e aquisição");
    expect(screen.getAllByText("Views").length).toBeGreaterThan(0);
    expect(screen.getByText("Views únicas")).toBeInTheDocument();
    expect(screen.getByText("Leituras de capítulos")).toBeInTheDocument();
    expect(screen.getByText("Cliques em downloads")).toBeInTheDocument();

    expect(screen.queryByRole("heading", { name: "Comentários criados" })).not.toBeInTheDocument();
    expect(screen.getByText("Comunidade e moderação")).toBeInTheDocument();
    expect(screen.getByText("Comentários criados")).toBeInTheDocument();
    expect(screen.getByText("Comentários aprovados")).toBeInTheDocument();
    expect(screen.getByText("Taxa de aprovação")).toBeInTheDocument();
  });

  it("respeita a métrica selecionada pela query string ao carregar a série temporal", async () => {
    renderPage("range=30d&type=all&metric=download_clicks");

    await screen.findByText("Série temporal (Cliques em downloads)");

    await waitFor(() => {
      const timeseriesCall = apiFetchMock.mock.calls.find(
        (call) => String(call[1]).startsWith("/api/analytics/timeseries?"),
      );
      expect(timeseriesCall).toBeDefined();
      expect(String(timeseriesCall?.[1])).toContain("metric=download_clicks");
    });
  });
});
