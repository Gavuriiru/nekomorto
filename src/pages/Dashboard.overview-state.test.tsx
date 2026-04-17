import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPreferencesProvider } from "@/hooks/dashboard-preferences-provider";
import { DashboardSessionProvider } from "@/hooks/dashboard-session-provider";
import Dashboard from "@/pages/Dashboard";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({
    children,
    currentUser,
    isLoadingUser,
  }: {
    children: ReactNode;
    currentUser?: { username?: string | null } | null;
    isLoadingUser?: boolean;
  }) => (
    <div
      data-testid="dashboard-shell"
      data-current-user={String(currentUser?.username || "")}
      data-loading-user={String(Boolean(isLoadingUser))}
    >
      {children}
    </div>
  ),
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

const createDeferredResponse = () => {
  let resolve: ((value: Response) => void) | null = null;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return {
    promise,
    resolve: (value: Response) => {
      resolve?.(value);
    },
  };
};

const dashboardUser = {
  id: "u-1",
  name: "Admin",
  username: "admin",
  permissions: ["*"],
};

const buildOverviewPayload = (overrides: Record<string, unknown> = {}) => ({
  metrics: {
    totalProjects: 1,
    totalMedia: 2,
    activeProjects: 1,
    finishedProjects: 0,
    totalViewsLast7: 20,
    totalProjectViewsLast7: 12,
    totalPostViewsLast7: 8,
  },
  analyticsSeries7d: [
    { date: "2026-03-01", value: 2 },
    { date: "2026-03-02", value: 4 },
  ],
  rankedProjects: [
    {
      id: "project-1",
      title: "Projeto Teste",
      status: "Em andamento",
      views: 15,
    },
  ],
  recentPosts: [
    {
      id: "post-1",
      slug: "post-1",
      title: "Post Teste",
      status: "published",
      views: 12,
      publishedAt: "2026-02-20T10:00:00.000Z",
      updatedAt: "2026-02-20T10:00:00.000Z",
    },
  ],
  recentComments: [
    {
      id: "comment-1",
      author: "Leitor",
      message: "Otimo projeto",
      page: "Projeto Teste",
      createdAt: "2026-02-20T10:00:00.000Z",
      url: "/projeto/project-1",
      status: "approved",
    },
  ],
  pendingCommentsCount: 0,
  quickProjects: [
    {
      id: "project-1",
      title: "Projeto Teste",
      status: "Em andamento",
    },
  ],
  ...overrides,
});

const buildOperationalAlertsPayload = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

const installDashboardApiMock = (options?: {
  userResponse?: Response | Promise<Response>;
  preferencesResponse?: Response | Promise<Response>;
  overviewResponse?: Response | Promise<Response>;
  operationalAlertsResponse?: Response | Promise<Response>;
}) => {
  const {
    userResponse = mockJsonResponse(true, dashboardUser),
    preferencesResponse = mockJsonResponse(true, { preferences: {} }),
    overviewResponse = mockJsonResponse(true, buildOverviewPayload()),
    operationalAlertsResponse = mockJsonResponse(true, buildOperationalAlertsPayload()),
  } = options || {};

  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return userResponse;
    }
    if (path === "/api/me/preferences" && method === "GET") {
      return preferencesResponse;
    }
    if (path === "/api/dashboard/overview" && method === "GET") {
      return overviewResponse;
    }
    if (path === "/api/admin/operational-alerts" && method === "GET") {
      return operationalAlertsResponse;
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const countApiCalls = (path: string, method = "GET") =>
  apiFetchMock.mock.calls.filter((call) => {
    const requestPath = String(call[1] || "");
    const requestOptions = (call[2] || {}) as RequestInit;
    return requestPath === path && String(requestOptions.method || "GET").toUpperCase() === method;
  }).length;

const classTokens = (element: Element | null) =>
  String((element as HTMLElement | null)?.className || "")
    .split(/\s+/)
    .filter(Boolean);

const expectOverviewBadgeClasses = (element: Element | null) => {
  const tokens = classTokens(element);
  expect(tokens).toEqual(
    expect.arrayContaining([
      "border-accent/60",
      "bg-accent/10",
      "text-accent",
      "hover:bg-accent/15",
    ]),
  );
  expect(tokens).not.toContain("bg-background");
  expect(tokens).not.toContain("text-foreground");
};

const expectOverviewActionLinkClasses = (element: Element | null) => {
  const tokens = classTokens(element);
  expect(tokens).toEqual(
    expect.arrayContaining([
      "rounded-xl",
      "bg-background",
      "font-semibold",
      "hover:text-foreground",
    ]),
  );
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};

describe("Dashboard overview async states", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    (window as Window & { __BOOTSTRAP_PUBLIC_ME__?: unknown }).__BOOTSTRAP_PUBLIC_ME__ = undefined;
  });

  it("mantem shell seeded por bootstrap e evita flash de login enquanto /api/me revalida", async () => {
    const userDeferred = createDeferredResponse();
    installDashboardApiMock({
      userResponse: userDeferred.promise,
      overviewResponse: mockJsonResponse(true, buildOverviewPayload()),
      preferencesResponse: mockJsonResponse(true, { preferences: {} }),
      operationalAlertsResponse: mockJsonResponse(true, buildOperationalAlertsPayload()),
    });
    (window as Window & { __BOOTSTRAP_PUBLIC_ME__?: unknown }).__BOOTSTRAP_PUBLIC_ME__ = {
      id: "u-1",
      name: "Admin",
      username: "admin",
      avatarUrl: null,
      permissions: ["*"],
      grants: { usuarios_acesso: true },
    };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute("data-current-user", "admin");
    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute("data-loading-user", "true");
    expect(screen.getByTestId("dashboard-loading-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-header-user-action-skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fazer login" })).not.toBeInTheDocument();
    expectOverviewActionLinkClasses(screen.getByRole("button", { name: "Personalizar painel" }));
    expect(classTokens(screen.getByRole("button", { name: "Personalizar painel" }))).toContain(
      "h-10",
    );
    expect(screen.queryByRole("button", { name: "Exportar relatório" })).not.toBeInTheDocument();

    userDeferred.resolve(mockJsonResponse(true, dashboardUser));
    const exportButton = await screen.findByRole("button", { name: /Exportar relat/i });
    expectOverviewActionLinkClasses(exportButton);
    expect(classTokens(exportButton)).toContain("h-10");

    expect(await screen.findByRole("button", { name: "Exportar relatório" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-loading-skeleton")).not.toBeInTheDocument();
    });
  });

  it("usa o padrao estavel no fallback de login do header", async () => {
    installDashboardApiMock({
      userResponse: mockJsonResponse(false, { error: "unauthorized" }, 401),
      overviewResponse: mockJsonResponse(true, buildOverviewPayload()),
      preferencesResponse: mockJsonResponse(true, { preferences: {} }),
      operationalAlertsResponse: mockJsonResponse(true, buildOperationalAlertsPayload()),
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    const loginLink = await screen.findByRole("link", { name: "Fazer login" });
    expectOverviewActionLinkClasses(loginLink);
    expect(classTokens(loginLink)).toContain("h-10");
    expect(loginLink).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: /Exportar relat/i })).not.toBeInTheDocument();
  });

  it("revalida o bootstrap uma vez no fallback e nao recoloca o skeleton apos rerender", async () => {
    installDashboardApiMock({
      userResponse: mockJsonResponse(true, dashboardUser),
      overviewResponse: mockJsonResponse(true, buildOverviewPayload()),
      operationalAlertsResponse: mockJsonResponse(true, buildOperationalAlertsPayload()),
    });
    (window as Window & { __BOOTSTRAP_PUBLIC_ME__?: unknown }).__BOOTSTRAP_PUBLIC_ME__ = {
      id: "u-1",
      name: "Admin",
      username: "admin",
      avatarUrl: null,
      permissions: ["*"],
    };

    const { rerender } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: "Exportar relatório" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-loading-skeleton")).not.toBeInTheDocument();
    });

    expect(countApiCalls("/api/me")).toBe(1);
    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute("data-loading-user", "false");

    rerender(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("dashboard-loading-skeleton")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(countApiCalls("/api/me")).toBe(1);
      expect(screen.getByTestId("dashboard-shell")).toHaveAttribute("data-loading-user", "false");
    });
  });

  it("exibe erro bloqueante e carrega dados apos retry", async () => {
    let overviewRequestCount = 0;
    installDashboardApiMock({
      overviewResponse: Promise.resolve().then(() => {
        overviewRequestCount += 1;
        if (overviewRequestCount === 1) {
          return mockJsonResponse(false, { error: "load_failed" }, 500);
        }
        return mockJsonResponse(true, buildOverviewPayload());
      }),
    });

    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, dashboardUser);
      }
      if (path === "/api/me/preferences" && method === "GET") {
        return mockJsonResponse(true, { preferences: {} });
      }
      if (path === "/api/dashboard/overview" && method === "GET") {
        overviewRequestCount += 1;
        if (overviewRequestCount === 1) {
          return mockJsonResponse(false, { error: "load_failed" }, 500);
        }
        return mockJsonResponse(true, buildOverviewPayload());
      }
      if (path === "/api/admin/operational-alerts" && method === "GET") {
        return mockJsonResponse(true, buildOperationalAlertsPayload());
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
    expect(await screen.findByText("Projetos cadastrados")).toBeInTheDocument();
    expect(overviewRequestCount).toBeGreaterThanOrEqual(2);
  });

  it("aplica variantes semanticas nas badges operacionais", async () => {
    installDashboardApiMock({
      operationalAlertsResponse: mockJsonResponse(
        true,
        buildOperationalAlertsPayload({
          status: "degraded",
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
        }),
      ),
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });

    expect(await screen.findByText("Degradado")).toHaveClass(
      "border-[hsl(var(--badge-warning-border))]",
      "bg-[hsl(var(--badge-warning-bg))]",
      "text-[hsl(var(--badge-warning-fg))]",
    );
    expect(screen.getByText(/Cr.*tico/i)).toHaveClass(
      "border-[hsl(var(--badge-danger-border))]",
      "bg-[hsl(var(--badge-danger-bg))]",
      "text-[hsl(var(--badge-danger-fg))]",
    );
  });

  it("explica degradado com healthcheck quando nao ha alertas ativos", async () => {
    installDashboardApiMock({
      operationalAlertsResponse: mockJsonResponse(
        true,
        buildOperationalAlertsPayload({
          status: "degraded",
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
        }),
      ),
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
    installDashboardApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });
    expect(await screen.findByText("Nenhum alerta operacional ativo.")).toBeInTheDocument();
  });

  it("mantem o badge de pendentes e esconde a lista quando ainda nao ha comentarios aprovados", async () => {
    installDashboardApiMock({
      overviewResponse: mockJsonResponse(
        true,
        buildOverviewPayload({
          recentComments: [],
          pendingCommentsCount: 2,
        }),
      ),
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });

    const pendingBadge = screen.getByText("2 pendentes");

    expect(pendingBadge).toBeInTheDocument();
    expectOverviewBadgeClasses(pendingBadge);
    expect(await screen.findByText("Nenhum comentário aprovado ainda.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum comentário registrado ainda.")).not.toBeInTheDocument();
  });

  it("exibe fallback explicito quando status degradado nao traz motivos", async () => {
    installDashboardApiMock({
      operationalAlertsResponse: mockJsonResponse(
        true,
        buildOperationalAlertsPayload({
          status: "degraded",
        }),
      ),
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
    const operationalDeferred = createDeferredResponse();
    installDashboardApiMock({
      operationalAlertsResponse: operationalDeferred.promise,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });
    expect(screen.getByTestId("dashboard-ops-loading-badge")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-ops-loading")).toBeInTheDocument();
    expect(screen.queryByText("OK")).not.toBeInTheDocument();

    operationalDeferred.resolve(mockJsonResponse(true, buildOperationalAlertsPayload()));

    expect(await screen.findByText("OK")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-ops-loading")).not.toBeInTheDocument();
    });
  });

  it("usa shells solidos nos principais cards do overview", async () => {
    installDashboardApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });

    const metricsCardLabel = screen.getAllByText("Projetos cadastrados")[0];
    const metricsCard = metricsCardLabel.closest(".rounded-2xl");
    const analyticsCard = screen.getByText(/Análises de acessos/i).closest(".rounded-3xl");

    expect(classTokens(metricsCard)).toContain("bg-card");
    expect(classTokens(metricsCard)).not.toContain("bg-card/60");
    expect(classTokens(analyticsCard)).toContain("bg-card");
    expect(classTokens(analyticsCard)).not.toContain("bg-card/60");
  });

  it("preserva a contagem de acessos no ranking de projetos", async () => {
    (window as Window & { __BOOTSTRAP_PUBLIC_ME__?: unknown }).__BOOTSTRAP_PUBLIC_ME__ = {
      ...dashboardUser,
      grants: { usuarios_acesso: true },
    };
    installDashboardApiMock({
      preferencesResponse: mockJsonResponse(true, {
        preferences: {
          dashboard: {
            homeByRole: {
              admin: {
                widgets: ["metrics_overview", "analytics_summary", "projects_rank"],
              },
            },
          },
        },
      }),
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardSessionProvider>
          <DashboardPreferencesProvider>
            <Dashboard />
          </DashboardPreferencesProvider>
        </DashboardSessionProvider>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });

    expect(await screen.findByText("Projeto Teste")).toBeInTheDocument();
    expect(screen.getByText("15 acessos")).toBeInTheDocument();
    const last7DaysBadge = screen.getByText(/7 dias/i);
    const projectStatusBadge = screen.getByText("Em andamento");

    expect(last7DaysBadge).toBeInTheDocument();
    expectOverviewBadgeClasses(last7DaysBadge);
    expect(projectStatusBadge).toBeInTheDocument();
    expectOverviewBadgeClasses(projectStatusBadge);
  });

  it("abre personalizacao com preferencias salvas sem reentrar em atualizacao", async () => {
    installDashboardApiMock({
      preferencesResponse: mockJsonResponse(true, {
        preferences: {
          dashboard: {
            homeByRole: {
              admin: {
                widgets: ["analytics_summary", "recent_posts"],
              },
            },
          },
        },
      }),
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardSessionProvider>
          <DashboardPreferencesProvider>
            <Dashboard />
          </DashboardPreferencesProvider>
        </DashboardSessionProvider>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });
    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-loading-skeleton")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Personalizar painel" }));

    const dialog = await screen.findByRole("dialog", { name: "Personalizar painel" });
    const dialogQueries = within(dialog);

    expect(dialogQueries.getAllByRole("button", { name: "Ativo" })).toHaveLength(2);
    expect(dialogQueries.getAllByRole("button", { name: "Oculto" })).toHaveLength(5);
  });

  it("uniformiza os CTAs principais da home sem herdar classes de button", async () => {
    (window as Window & { __BOOTSTRAP_PUBLIC_ME__?: unknown }).__BOOTSTRAP_PUBLIC_ME__ = {
      ...dashboardUser,
      grants: { usuarios_acesso: true },
    };
    installDashboardApiMock({
      preferencesResponse: mockJsonResponse(true, {
        preferences: {
          dashboard: {
            homeByRole: {
              admin: {
                widgets: [
                  "analytics_summary",
                  "projects_rank",
                  "recent_posts",
                  "ops_status",
                  "projects_quick",
                ],
              },
            },
          },
        },
      }),
      overviewResponse: mockJsonResponse(
        true,
        buildOverviewPayload({
          metrics: {
            totalProjects: 4,
            totalMedia: 2,
            activeProjects: 1,
            finishedProjects: 0,
            totalViewsLast7: 20,
            totalProjectViewsLast7: 12,
            totalPostViewsLast7: 8,
          },
          quickProjects: [
            {
              id: "project-1",
              title: "Projeto Teste",
              status: "Em andamento",
            },
            {
              id: "project-2",
              title: "Projeto Dois",
              status: "Pausado",
            },
            {
              id: "project-3",
              title: "Projeto Tres",
              status: "Concluido",
            },
          ],
        }),
      ),
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardSessionProvider>
          <DashboardPreferencesProvider>
            <Dashboard />
          </DashboardPreferencesProvider>
        </DashboardSessionProvider>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Painel de controle da comunidade/i });

    expectOverviewActionLinkClasses(screen.getByRole("link", { name: "Ver analytics completos" }));
    expectOverviewActionLinkClasses(
      screen.getByRole("link", { name: "Ver analytics de projetos" }),
    );
    expectOverviewActionLinkClasses(screen.getByRole("link", { name: "Ver analytics de posts" }));
    expectOverviewActionLinkClasses(screen.getByRole("link", { name: "Ver audit log" }));
    expectOverviewActionLinkClasses(screen.getByRole("link", { name: "Ver todos os projetos" }));
  });
});
