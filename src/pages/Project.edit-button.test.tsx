import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectPage from "@/pages/Project";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      site: { defaultShareImage: "" },
      downloads: { sources: [] },
    },
  }),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: "project-1" }),
  };
});

vi.mock("@/components/CommentsSection", () => ({
  default: () => null,
}));

vi.mock("@/components/ThemedSvgLogo", () => ({
  default: () => null,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const projectFixture = {
  id: "project-1",
  title: "Projeto Teste",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "Sinopse de teste",
  description: "Descricao de teste",
  type: "Anime",
  status: "Em andamento",
  year: "2026",
  studio: "Studio Teste",
  episodes: "12 episodios",
  tags: [],
  genres: [],
  cover: "/placeholder.svg",
  banner: "/placeholder.svg",
  season: "Temporada 1",
  schedule: "Sabado",
  rating: "14",
  country: "JP",
  source: "Original",
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
};

const setupApiMock = (permissions: string[] | null) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (endpoint === "/api/public/projects/project-1" && method === "GET") {
      return mockJsonResponse(true, { project: projectFixture });
    }
    if (endpoint === "/api/public/projects" && method === "GET") {
      return mockJsonResponse(true, { projects: [projectFixture] });
    }
    if (endpoint === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
    }
    if (endpoint === "/api/public/projects/project-1/view" && method === "POST") {
      return mockJsonResponse(true, { views: 1 });
    }
    if (endpoint === "/api/public/me" && method === "GET") {
      return mockJsonResponse(
        true,
        permissions
          ? {
              user: {
                id: "1",
                name: "Admin",
                permissions,
              },
            }
          : { user: null },
      );
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("Project edit button", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("exibe botao de editar para usuario com permissao de projetos", async () => {
    setupApiMock(["projetos"]);

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    const editLink = await screen.findByRole("link", { name: "Editar projeto" });
    expect(editLink).toHaveAttribute("href", "/dashboard/projetos?edit=project-1");
  });

  it("nao exibe botao de editar quando nao ha usuario logado", async () => {
    setupApiMock(null);

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    expect(screen.queryByRole("link", { name: "Editar projeto" })).not.toBeInTheDocument();
  });

  it("nao exibe botao de editar sem permissao de projetos", async () => {
    setupApiMock(["posts"]);

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    expect(screen.queryByRole("link", { name: "Editar projeto" })).not.toBeInTheDocument();
  });
});
