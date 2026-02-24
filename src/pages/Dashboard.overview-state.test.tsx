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
});
