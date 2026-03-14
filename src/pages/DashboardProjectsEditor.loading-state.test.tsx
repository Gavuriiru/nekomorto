import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardProjectsEditor, { __testing } from "@/pages/DashboardProjectsEditor";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageContainer", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  default: ({ title, actions }: { title: string; actions?: ReactNode }) => (
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

vi.mock("@/hooks/use-dashboard-refresh-toast", () => ({
  useDashboardRefreshToast: () => undefined,
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

const deferredResponse = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

const createProject = (index: number) => ({
  id: `project-${index}`,
  anilistId: 1001,
  title: `Projeto ${index}`,
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "Sinopse",
  description: "Sinopse",
  type: "Anime",
  status: "Em andamento",
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
  order: index,
});

describe("DashboardProjectsEditor loading state", () => {
  beforeEach(() => {
    __testing.clearProjectsPageCache();
    apiFetchMock.mockReset();
  });

  it("mantem header e skeleton local enquanto /api/projects ainda nao respondeu", async () => {
    const projectsDeferred = deferredResponse();
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path === "/api/me") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/projects") {
        return projectsDeferred.promise;
      }
      if (path === "/api/project-types") {
        return mockJsonResponse(true, { types: ["Anime"] });
      }
      if (path === "/api/users") {
        return mockJsonResponse(true, { users: [] });
      }
      if (path === "/api/public/tag-translations") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    expect(screen.getByTestId("dashboard-projects-skeleton-surface")).toBeInTheDocument();
    expect(screen.queryByText(/Carregando projetos/i)).not.toBeInTheDocument();

    projectsDeferred.resolve(mockJsonResponse(true, { projects: [createProject(1)] }));

    await screen.findByText("Projeto 1");
  });

  it("reaproveita cache quente ao revisitar a pagina", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path === "/api/me") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/projects") {
        return mockJsonResponse(true, { projects: [createProject(1)] });
      }
      if (path === "/api/project-types") {
        return mockJsonResponse(true, { types: ["Anime"] });
      }
      if (path === "/api/users") {
        return mockJsonResponse(true, { users: [] });
      }
      if (path === "/api/public/tag-translations") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    const firstRender = render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
      </MemoryRouter>,
    );

    await screen.findByText("Projeto 1");
    firstRender.unmount();

    const projectsDeferred = deferredResponse();
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path === "/api/me") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/projects") {
        return projectsDeferred.promise;
      }
      if (path === "/api/project-types") {
        return mockJsonResponse(true, { types: ["Anime"] });
      }
      if (path === "/api/users") {
        return mockJsonResponse(true, { users: [] });
      }
      if (path === "/api/public/tag-translations") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    expect(screen.getByText("Projeto 1")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-projects-skeleton-surface")).not.toBeInTheDocument();

    projectsDeferred.resolve(mockJsonResponse(true, { projects: [createProject(1)] }));
    await screen.findByText("Projeto 1");
  });
});
