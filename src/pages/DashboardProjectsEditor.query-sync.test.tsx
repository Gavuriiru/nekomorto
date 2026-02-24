import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DashboardProjectsEditor from "@/pages/DashboardProjectsEditor";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageContainer", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  default: ({
    title,
    actions,
  }: {
    title: string;
    actions?: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/ThemedSvgLogo", () => ({
  default: () => null,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      teamRoles: [],
      downloads: { sources: [] },
    },
  }),
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

const createProject = (
  index: number,
  overrides: Partial<{
    title: string;
    type: string;
    status: string;
    order: number;
  }> = {},
) => ({
  id: `project-${index}`,
  anilistId: 1001,
  title: overrides.title ?? `Projeto ${index}`,
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "Sinopse",
  description: "Sinopse",
  type: overrides.type ?? "Anime",
  status: overrides.status ?? "Em andamento",
  year: "2025",
  studio: "Studio Teste",
  episodes: "2 episodios",
  tags: [],
  genres: [],
  cover: "",
  banner: "",
  season: "",
  schedule: "",
  rating: "",
  country: "",
  source: "",
  producers: [],
  score: null,
  startDate: "",
  endDate: "",
  relations: [],
  staff: [],
  animeStaff: [],
  trailerUrl: "",
  forceHero: false,
  heroImageUrl: "",
  episodeDownloads: [],
  views: 0,
  commentsCount: 0,
  order: overrides.order ?? index,
});

const setupApiMock = ({
  projects = Array.from({ length: 21 }, (_, index) => createProject(index + 1)),
  preferences = { uiListState: {} },
}: {
  projects?: ReturnType<typeof createProject>[];
  preferences?: unknown;
} = {}) => {
  let persistedPreferences = preferences;
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, {
        id: "1",
        name: "Admin",
        username: "admin",
        permissions: ["projetos"],
      });
    }
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, { projects });
    }
    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, { users: [] });
    }
    if (path === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
    }
    if (path === "/api/me/preferences" && method === "GET") {
      return mockJsonResponse(true, { preferences: persistedPreferences });
    }
    if (path === "/api/me/preferences" && method === "PUT") {
      const request = (options || {}) as RequestInit & { json?: unknown };
      const payload =
        (request.json as { preferences?: unknown } | undefined) ||
        JSON.parse(String(request.body || "{}"));
      persistedPreferences = payload.preferences || {};
      return mockJsonResponse(true, { preferences: persistedPreferences });
    }

    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
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
    <button type="button" onClick={() => navigate("/dashboard/projetos")}>
      Limpar query
    </button>
  );
};

describe("DashboardProjectsEditor query sync", () => {
  it("avanca para pagina 2 ao clicar em proxima", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    const pagination = screen.getByRole("navigation");
    fireEvent.click(within(pagination).getByRole("link", { name: /pr/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?page=2");
    });
  });

  it("nao reintroduz query, reseta tipo e limpa estado salvo apos navegacao para URL limpa", async () => {
    setupApiMock({
      projects: Array.from({ length: 21 }, (_, index) =>
        createProject(index + 1, {
          title: index === 0 ? "Projeto Anime" : `Projeto Manga ${index}`,
          type: index === 0 ? "Anime" : "Manga",
        }),
      ),
      preferences: {
        uiListState: {
          "dashboard.projects": {
            filters: { type: "Manga" },
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
        <NavigateCleanQuery />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Projeto Manga 1");
    expect(screen.queryByText("Projeto Anime")).not.toBeInTheDocument();

    const pagination = screen.getByRole("navigation");
    fireEvent.click(within(pagination).getByRole("link", { name: /pr/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?page=2");
    });

    fireEvent.click(screen.getByRole("button", { name: "Limpar query" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(screen.getByTestId("location-search").textContent).toBe("");

    await waitFor(() => {
      expect(screen.getByText("Projeto Anime")).toBeInTheDocument();
      expect(screen.getByLabelText("Filtrar por formato")).toHaveTextContent("Todos");
    });

    await waitFor(
      () => {
        const putCalls = getPreferencePutCalls();
        expect(putCalls.length).toBeGreaterThan(0);
        const request = ((putCalls[putCalls.length - 1]?.[2] || {}) as RequestInit & {
          json?: { preferences?: unknown };
        });
        const payload = request.json || JSON.parse(String(request.body || "{}"));
        expect(payload.preferences?.uiListState?.["dashboard.projects"]).toBeUndefined();
      },
      { timeout: 2500 },
    );
  });

  it("restaura filtro de tipo salvo em preferencias", async () => {
    setupApiMock({
      projects: [
        createProject(1, { title: "Projeto Anime", type: "Anime" }),
        createProject(2, { title: "Projeto Manga", type: "Manga" }),
      ],
      preferences: {
        uiListState: {
          "dashboard.projects": {
            filters: { type: "Anime" },
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Projeto Anime");
    expect(screen.queryByText("Projeto Manga")).not.toBeInTheDocument();
  });

  it("persiste filtro de tipo e nao adiciona type na URL", async () => {
    setupApiMock({
      projects: [
        createProject(1, { title: "Projeto Anime", type: "Anime" }),
        createProject(2, { title: "Projeto Manga", type: "Manga" }),
      ],
      preferences: {
        uiListState: {
          "dashboard.projects": {
            filters: { type: "Manga" },
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Projeto Manga");
    expect(screen.queryByText("Projeto Anime")).not.toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 500));
    const putCalls = getPreferencePutCalls();
    if (putCalls.length > 0) {
      const request = ((putCalls[putCalls.length - 1]?.[2] || {}) as RequestInit & {
        json?: { preferences?: unknown };
      });
      const payload = request.json || JSON.parse(String(request.body || "{}"));
      expect(payload.preferences?.uiListState?.["dashboard.projects"]?.filters?.type).toBe("Manga");
    }

    const locationSearch = String(screen.getByTestId("location-search").textContent || "");
    expect(locationSearch).not.toContain("type=");
  });

  it("faz fallback para Todos quando tipo salvo nao existe", async () => {
    setupApiMock({
      projects: [
        createProject(1, { title: "Projeto Anime", type: "Anime" }),
        createProject(2, { title: "Projeto Manga", type: "Manga" }),
      ],
      preferences: {
        uiListState: {
          "dashboard.projects": {
            filters: { type: "Inexistente" },
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await waitFor(() => {
      expect(screen.getByText("Projeto Anime")).toBeInTheDocument();
      expect(screen.getByText("Projeto Manga")).toBeInTheDocument();
      expect(screen.getByLabelText("Filtrar por formato")).toHaveTextContent("Todos");
    });
  });
});
