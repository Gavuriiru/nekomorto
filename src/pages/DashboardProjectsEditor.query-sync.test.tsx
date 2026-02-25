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
}: {
  projects?: ReturnType<typeof createProject>[];
} = {}) => {
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

    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const getPreferenceCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    return path === "/api/me/preferences";
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
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("aplica filtro de tipo vindo da URL", async () => {
    setupApiMock({
      projects: Array.from({ length: 21 }, (_, index) =>
        createProject(index + 1, {
          title: index === 0 ? "Projeto Anime" : `Projeto Manga ${index}`,
          type: index === 0 ? "Anime" : "Manga",
        }),
      ),
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?type=Manga"]}>
        <DashboardProjectsEditor />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Projeto Manga 1");
    expect(screen.queryByText("Projeto Anime")).not.toBeInTheDocument();
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("remove type da URL quando filtro volta para Todos", async () => {
    setupApiMock({
      projects: [
        createProject(1, { title: "Projeto Anime", type: "Anime" }),
        createProject(2, { title: "Projeto Manga", type: "Manga" }),
      ],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?type=Todos"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("nao reintroduz query e reseta tipo ao navegar para URL limpa", async () => {
    setupApiMock({
      projects: Array.from({ length: 21 }, (_, index) =>
        createProject(index + 1, {
          title: index === 0 ? "Projeto Anime" : `Projeto Manga ${index}`,
          type: index === 0 ? "Anime" : "Manga",
        }),
      ),
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?type=Manga&page=2"]}>
        <DashboardProjectsEditor />
        <NavigateCleanQuery />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    fireEvent.click(screen.getByRole("button", { name: "Limpar query" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Filtrar por formato")).toHaveTextContent("Todos");
      expect(screen.getByText("Projeto Anime")).toBeInTheDocument();
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("faz fallback para Todos quando type da URL nao existe", async () => {
    setupApiMock({
      projects: [
        createProject(1, { title: "Projeto Anime", type: "Anime" }),
        createProject(2, { title: "Projeto Manga", type: "Manga" }),
      ],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?type=Inexistente"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await waitFor(() => {
      expect(screen.getByText("Projeto Anime")).toBeInTheDocument();
      expect(screen.getByText("Projeto Manga")).toBeInTheDocument();
      expect(screen.getByLabelText("Filtrar por formato")).toHaveTextContent("Todos");
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });
});
