import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "@/pages/Dashboard";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

describe("Dashboard overview async states", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("exibe erro bloqueante e carrega dados após retry", async () => {
    let projectsRequestCount = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "u-1",
          name: "Admin",
          username: "admin",
        });
      }
      if (path === "/api/projects" && method === "GET") {
        projectsRequestCount += 1;
        if (projectsRequestCount === 1) {
          return mockJsonResponse(false, { error: "load_failed" }, 500);
        }
        return mockJsonResponse(true, {
          projects: [
            {
              id: "project-1",
              title: "Projeto Teste",
              status: "Em andamento",
              views: 15,
              episodeDownloads: [{ episode: "1" }],
            },
          ],
        });
      }
      if (path === "/api/posts" && method === "GET") {
        return mockJsonResponse(true, {
          posts: [
            {
              id: "post-1",
              slug: "post-1",
              title: "Post Teste",
              status: "published",
              views: 12,
              publishedAt: "2026-02-20T10:00:00.000Z",
              updatedAt: "2026-02-20T10:00:00.000Z",
              commentsCount: 1,
            },
          ],
        });
      }
      if (path === "/api/comments/recent?limit=3" && method === "GET") {
        return mockJsonResponse(true, {
          comments: [
            {
              id: "comment-1",
              name: "Leitor",
              content: "Ótimo projeto",
              targetLabel: "Projeto Teste",
              createdAt: "2026-02-20T10:00:00.000Z",
              targetUrl: "/projeto/project-1",
              status: "approved",
            },
          ],
          pendingCount: 0,
        });
      }
      if (path.startsWith("/api/analytics/overview?") && method === "GET") {
        return mockJsonResponse(true, {
          metrics: {
            views: 20,
          },
        });
      }
      if (path === "/api/analytics/timeseries?range=7d&type=all&metric=views" && method === "GET") {
        return mockJsonResponse(true, {
          series: [
            { date: "2026-02-20", value: 10 },
            { date: "2026-02-21", value: 12 },
          ],
        });
      }
      if (path === "/api/admin/operational-alerts" && method === "GET") {
        return mockJsonResponse(true, {
          ok: true,
          status: "ok",
          generatedAt: "2026-02-20T10:00:00.000Z",
          alerts: [],
          summary: {
            total: 0,
            critical: 0,
            warning: 0,
            info: 0,
          },
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });
    await screen.findByText(/Não foi possível carregar o dashboard/i);

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(screen.queryByText(/Não foi possível carregar o dashboard/i)).not.toBeInTheDocument();
    });
    await screen.findByRole("heading", { name: "Projetos cadastrados" });
    expect(projectsRequestCount).toBeGreaterThanOrEqual(2);
  });

  it("aplica variantes semanticas nas badges operacionais", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "u-1",
          name: "Admin",
          username: "admin",
          permissions: ["*"],
        });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/posts" && method === "GET") {
        return mockJsonResponse(true, { posts: [] });
      }
      if (path === "/api/comments/recent?limit=3" && method === "GET") {
        return mockJsonResponse(true, { comments: [], pendingCount: 0 });
      }
      if (path.startsWith("/api/analytics/overview?") && method === "GET") {
        return mockJsonResponse(true, {
          metrics: {
            views: 20,
          },
        });
      }
      if (path === "/api/analytics/timeseries?range=7d&type=all&metric=views" && method === "GET") {
        return mockJsonResponse(true, {
          series: [
            { date: "2026-02-20", value: 10 },
            { date: "2026-02-21", value: 12 },
          ],
        });
      }
      if (path === "/api/admin/operational-alerts" && method === "GET") {
        return mockJsonResponse(true, {
          ok: true,
          status: "degraded",
          generatedAt: "2026-02-20T10:00:00.000Z",
          alerts: [
            {
              code: "db-latency",
              severity: "critical",
              title: "Banco de dados",
              description: "Latencia acima do esperado.",
            },
          ],
          summary: {
            total: 1,
            critical: 1,
            warning: 0,
            info: 0,
          },
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });

    expect(await screen.findByText("Degradado")).toHaveClass(
      "bg-amber-500/20",
      "text-amber-900",
      "dark:text-amber-200",
    );
    expect(screen.getByText(/Cr.*tico/i)).toHaveClass(
      "bg-red-500/20",
      "text-red-800",
      "dark:text-red-200",
    );
  });

  it("explica degradado com healthcheck quando nao ha alertas ativos", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "u-1",
          name: "Admin",
          username: "admin",
          permissions: ["*"],
        });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/posts" && method === "GET") {
        return mockJsonResponse(true, { posts: [] });
      }
      if (path === "/api/comments/recent?limit=3" && method === "GET") {
        return mockJsonResponse(true, { comments: [], pendingCount: 0 });
      }
      if (path.startsWith("/api/analytics/overview?") && method === "GET") {
        return mockJsonResponse(true, {
          metrics: {
            views: 20,
          },
        });
      }
      if (path === "/api/analytics/timeseries?range=7d&type=all&metric=views" && method === "GET") {
        return mockJsonResponse(true, {
          series: [
            { date: "2026-02-20", value: 10 },
            { date: "2026-02-21", value: 12 },
          ],
        });
      }
      if (path === "/api/admin/operational-alerts" && method === "GET") {
        return mockJsonResponse(true, {
          ok: true,
          status: "degraded",
          generatedAt: "2026-02-20T10:00:00.000Z",
          alerts: [],
          checkFindings: [
            {
              name: "rate_limit_backend",
              severity: "warning",
              title: "Rate limiter",
              description: "Rate limit local em memoria.",
            },
          ],
          checkSummary: {
            total: 1,
            critical: 0,
            warning: 1,
          },
          summary: {
            total: 0,
            critical: 0,
            warning: 0,
            info: 0,
          },
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });

    expect(await screen.findByText("Degradado")).toBeInTheDocument();
    expect(screen.getByText("Healthchecks degradados")).toBeInTheDocument();
    expect(screen.getByText("Rate limiter")).toBeInTheDocument();
    expect(screen.getByText("Rate limit local em memoria.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum alerta operacional ativo.")).not.toBeInTheDocument();
  });

  it("mantem mensagem de vazio quando status operacional esta ok", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "u-1",
          name: "Admin",
          username: "admin",
          permissions: ["*"],
        });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/posts" && method === "GET") {
        return mockJsonResponse(true, { posts: [] });
      }
      if (path === "/api/comments/recent?limit=3" && method === "GET") {
        return mockJsonResponse(true, { comments: [], pendingCount: 0 });
      }
      if (path.startsWith("/api/analytics/overview?") && method === "GET") {
        return mockJsonResponse(true, {
          metrics: {
            views: 20,
          },
        });
      }
      if (path === "/api/analytics/timeseries?range=7d&type=all&metric=views" && method === "GET") {
        return mockJsonResponse(true, {
          series: [
            { date: "2026-02-20", value: 10 },
            { date: "2026-02-21", value: 12 },
          ],
        });
      }
      if (path === "/api/admin/operational-alerts" && method === "GET") {
        return mockJsonResponse(true, {
          ok: true,
          status: "ok",
          generatedAt: "2026-02-20T10:00:00.000Z",
          alerts: [],
          checkFindings: [],
          checkSummary: {
            total: 0,
            critical: 0,
            warning: 0,
          },
          summary: {
            total: 0,
            critical: 0,
            warning: 0,
            info: 0,
          },
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });
    expect(await screen.findByText("Nenhum alerta operacional ativo.")).toBeInTheDocument();
  });

  it("exibe fallback explicito quando status degradado nao traz motivos", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "u-1",
          name: "Admin",
          username: "admin",
          permissions: ["*"],
        });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/posts" && method === "GET") {
        return mockJsonResponse(true, { posts: [] });
      }
      if (path === "/api/comments/recent?limit=3" && method === "GET") {
        return mockJsonResponse(true, { comments: [], pendingCount: 0 });
      }
      if (path.startsWith("/api/analytics/overview?") && method === "GET") {
        return mockJsonResponse(true, {
          metrics: {
            views: 20,
          },
        });
      }
      if (path === "/api/analytics/timeseries?range=7d&type=all&metric=views" && method === "GET") {
        return mockJsonResponse(true, {
          series: [
            { date: "2026-02-20", value: 10 },
            { date: "2026-02-21", value: 12 },
          ],
        });
      }
      if (path === "/api/admin/operational-alerts" && method === "GET") {
        return mockJsonResponse(true, {
          ok: true,
          status: "degraded",
          generatedAt: "2026-02-20T10:00:00.000Z",
          alerts: [],
          checkFindings: [],
          checkSummary: {
            total: 0,
            critical: 0,
            warning: 0,
          },
          summary: {
            total: 0,
            critical: 0,
            warning: 0,
            info: 0,
          },
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });
    expect(
      await screen.findByText("Status operacional degradado sem causa detalhada no payload."),
    ).toBeInTheDocument();
  });

  it("mantem placeholders operacionais sem expor badge OK durante o carregamento", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "u-1",
          name: "Admin",
          username: "admin",
          permissions: ["*"],
        });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/posts" && method === "GET") {
        return mockJsonResponse(true, { posts: [] });
      }
      if (path === "/api/comments/recent?limit=3" && method === "GET") {
        return mockJsonResponse(true, { comments: [], pendingCount: 0 });
      }
      if (path.startsWith("/api/analytics/overview?") && method === "GET") {
        return mockJsonResponse(true, {
          metrics: {
            views: 20,
          },
        });
      }
      if (path === "/api/analytics/timeseries?range=7d&type=all&metric=views" && method === "GET") {
        return mockJsonResponse(true, {
          series: [
            { date: "2026-02-20", value: 10 },
            { date: "2026-02-21", value: 12 },
          ],
        });
      }
      if (path === "/api/admin/operational-alerts" && method === "GET") {
        return new Promise<Response>(() => undefined);
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });

    expect(screen.getByTestId("dashboard-ops-loading")).toBeInTheDocument();
    expect(screen.queryByText("OK")).not.toBeInTheDocument();
  });
});
