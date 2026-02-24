import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardAnalytics from "@/pages/DashboardAnalytics";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
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

const setupApiMock = (preferences: unknown) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, {
        id: "1",
        name: "Admin",
        username: "admin",
      });
    }
    if (path === "/api/me/preferences" && method === "GET") {
      return mockJsonResponse(true, { preferences });
    }
    if (path === "/api/me/preferences" && method === "PUT") {
      const request = (options || {}) as RequestInit & { json?: unknown };
      const payload =
        (request.json as { preferences?: unknown } | undefined) ||
        JSON.parse(String(request.body || "{}"));
      return mockJsonResponse(true, { preferences: payload.preferences || {} });
    }
    if (path.startsWith("/api/analytics/overview?") && method === "GET") {
      return mockJsonResponse(true, {
        metrics: {
          views: 120,
          uniqueViews: 80,
          chapterViews: 42,
          downloadClicks: 10,
          commentsCreated: 9,
          commentsApproved: 7,
        },
      });
    }
    if (path.startsWith("/api/analytics/timeseries?") && method === "GET") {
      return mockJsonResponse(true, {
        series: [
          { date: "2026-02-20", value: 12 },
          { date: "2026-02-21", value: 15 },
        ],
      });
    }
    if (path.startsWith("/api/analytics/top-content?") && method === "GET") {
      return mockJsonResponse(true, {
        entries: [
          {
            resourceType: "project",
            resourceId: "project-1",
            title: "Projeto 1",
            views: 44,
            uniqueViews: 20,
          },
        ],
      });
    }
    if (path.startsWith("/api/analytics/acquisition?") && method === "GET") {
      return mockJsonResponse(true, {
        referrerHost: [{ key: "(internal)", count: 10 }],
        utmSource: [],
      });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const getLastTimeseriesParams = () => {
  const calls = apiFetchMock.mock.calls.filter((call) => String(call[1] || "").startsWith("/api/analytics/timeseries?"));
  const last = String(calls[calls.length - 1]?.[1] || "");
  return new URLSearchParams(last.split("?")[1] || "");
};

const getPreferencePutCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return path === "/api/me/preferences" && method === "PUT";
  });

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

const NavigateCleanQuery = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/dashboard/analytics")}>
      Limpar query
    </button>
  );
};

describe("DashboardAnalytics preferences", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("restaura filtros salvos quando URL inicial está limpa", async () => {
    setupApiMock({
      uiListState: {
        "dashboard.analytics": {
          filters: {
            range: "90d",
            type: "project",
            metric: "download_clicks",
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/analytics"]}>
        <DashboardAnalytics />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Performance e aquisi/i });
    await waitFor(() => {
      const search = String(screen.getByTestId("location-search").textContent || "");
      expect(search).toContain("range=90d");
      expect(search).toContain("type=project");
      expect(search).toContain("metric=download_clicks");
    });

    await waitFor(() => {
      const params = getLastTimeseriesParams();
      expect(params.get("range")).toBe("90d");
      expect(params.get("type")).toBe("project");
      expect(params.get("metric")).toBe("download_clicks");
    });
  });

  it("prioriza query explícita da URL sobre preferências salvas", async () => {
    setupApiMock({
      uiListState: {
        "dashboard.analytics": {
          filters: {
            range: "90d",
            type: "project",
            metric: "download_clicks",
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/analytics?range=7d&type=post&metric=views"]}>
        <DashboardAnalytics />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Performance e aquisi/i });
    expect(screen.getByTestId("location-search").textContent).toBe("?range=7d&type=post&metric=views");

    await waitFor(() => {
      const params = getLastTimeseriesParams();
      expect(params.get("range")).toBe("7d");
      expect(params.get("type")).toBe("post");
      expect(params.get("metric")).toBe("views");
    });
  });

  it("persiste filtros ativos em /api/me/preferences", async () => {
    setupApiMock({
      uiListState: {},
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/analytics?range=90d&type=project&metric=download_clicks"]}>
        <DashboardAnalytics />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Performance e aquisi/i });

    await waitFor(
      () => {
        const putCalls = getPreferencePutCalls();
        expect(putCalls.length).toBeGreaterThan(0);
      },
      { timeout: 2500 },
    );

    const putCalls = getPreferencePutCalls();
    const request = ((putCalls[putCalls.length - 1]?.[2] || {}) as RequestInit & {
      json?: { preferences?: unknown };
    });
    const payload =
      request.json ||
      JSON.parse(String(request.body || "{}"));
    expect(payload.preferences?.uiListState?.["dashboard.analytics"]?.filters).toMatchObject({
      range: "90d",
      type: "project",
      metric: "download_clicks",
    });
  });

  it("nao reidrata filtros e limpa preferencia salva em PUSH para URL limpa", async () => {
    setupApiMock({
      uiListState: {
        "dashboard.analytics": {
          filters: {
            range: "90d",
            type: "project",
            metric: "download_clicks",
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/analytics?range=7d&type=post&metric=views"]}>
        <DashboardAnalytics />
        <NavigateCleanQuery />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Performance e aquisi/i });
    fireEvent.click(screen.getByRole("button", { name: "Limpar query" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    await waitFor(() => {
      const params = getLastTimeseriesParams();
      expect(params.get("range")).toBe("30d");
      expect(params.get("type")).toBe("all");
      expect(params.get("metric")).toBe("views");
    });

    await waitFor(
      () => {
        const putCalls = getPreferencePutCalls();
        expect(putCalls.length).toBeGreaterThan(0);
        const request = ((putCalls[putCalls.length - 1]?.[2] || {}) as RequestInit & {
          json?: { preferences?: unknown };
        });
        const payload = request.json || JSON.parse(String(request.body || "{}"));
        expect(payload.preferences?.uiListState?.["dashboard.analytics"]).toBeUndefined();
      },
      { timeout: 2500 },
    );
  });
});
