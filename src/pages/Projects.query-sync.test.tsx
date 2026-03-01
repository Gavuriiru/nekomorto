import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Projects from "@/pages/Projects";

const apiFetchMock = vi.hoisted(() => vi.fn());
const PROJECTS_LIST_STATE_STORAGE_KEY = "public.projects.list-state.v1";

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

const createProject = (
  index: number,
  overrides: Partial<{
    title: string;
    type: string;
    tags: string[];
    genres: string[];
  }> = {},
) => ({
  id: `project-${index}`,
  title: overrides.title ?? `Projeto ${index}`,
  titleOriginal: "",
  titleEnglish: "",
  synopsis: `Sinopse ${index}`,
  description: `Descricao ${index}`,
  type: overrides.type ?? "Anime",
  status: "Em andamento",
  year: "2026",
  studio: "Studio Teste",
  episodes: "12 episodios",
  tags: overrides.tags ?? ["acao"],
  genres: overrides.genres ?? ["drama"],
  cover: "/placeholder.svg",
  banner: "/placeholder.svg",
  season: "Temporada 1",
  schedule: "Sabado",
  rating: "14",
  episodeDownloads: [],
  staff: [],
});

const createProjects = (count: number, overrides?: Parameters<typeof createProject>[1]) =>
  Array.from({ length: count }, (_, index) => createProject(index + 1, overrides));

const setupApiMock = ({
  projects = createProjects(24),
  mediaVariants = {},
}: {
  projects?: ReturnType<typeof createProject>[];
  mediaVariants?: unknown;
} = {}) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (endpoint === "/api/public/projects" && method === "GET") {
      return mockJsonResponse(true, { projects, mediaVariants });
    }
    if (endpoint === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, {
        tags: { acao: "Acao" },
        genres: { drama: "Drama" },
        staffRoles: {},
      });
    }
    if (endpoint === "/api/public/pages" && method === "GET") {
      return mockJsonResponse(true, {
        pages: { projects: { shareImage: "" } },
      });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

const getSearchParams = () =>
  new URLSearchParams(String(screen.getByTestId("location-search").textContent || "").replace(/^\?/, ""));

describe("Projects query sync", () => {
  beforeEach(() => {
    setupApiMock();
    window.scrollTo = vi.fn();
    window.localStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("normaliza query legada de genre para genero", async () => {
    render(
      <MemoryRouter initialEntries={["/projetos?genre=drama"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const params = getSearchParams();
      expect(params.get("genero")).toBe("drama");
      expect(params.get("genre")).toBeNull();
    });
  });

  it("sincroniza letter/type/page da URL", async () => {
    setupApiMock({
      projects: createProjects(24, {
        type: "Anime",
        tags: ["acao"],
        genres: ["drama"],
      }),
    });

    render(
      <MemoryRouter initialEntries={["/projetos?letter=P&type=Anime&page=2"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const params = getSearchParams();
      expect(params.get("letter")).toBe("P");
      expect(params.get("type")).toBe("Anime");
      expect(params.get("page")).toBe("2");
    });
  });

  it("sincroniza q da URL com o campo de busca", async () => {
    render(
      <MemoryRouter initialEntries={["/projetos?q=studio"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    const searchInput = await screen.findByLabelText("Buscar projetos");
    expect(searchInput).toHaveValue("studio");
    expect(getSearchParams().get("q")).toBe("studio");
  });

  it("nao restaura filtros/page do localStorage quando URL chega limpa", async () => {
    window.localStorage.setItem(
      PROJECTS_LIST_STATE_STORAGE_KEY,
      JSON.stringify({
        q: "drama",
        letter: "P",
        type: "Anime",
        tag: "acao",
        genero: "drama",
        page: 2,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/projetos"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const params = getSearchParams();
      expect(params.get("q")).toBeNull();
      expect(params.get("letter")).toBeNull();
      expect(params.get("type")).toBeNull();
      expect(params.get("tag")).toBeNull();
      expect(params.get("genero")).toBeNull();
      expect(params.get("page")).toBeNull();
    });
  });

  it("limpa automaticamente a chave legada ao carregar /projetos", async () => {
    window.localStorage.setItem(
      PROJECTS_LIST_STATE_STORAGE_KEY,
      JSON.stringify({
        q: "valor-antigo",
        page: 4,
      }),
    );

    render(
      <MemoryRouter initialEntries={["/projetos?tag=acao"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(PROJECTS_LIST_STATE_STORAGE_KEY)).toBeNull();
      expect(getSearchParams().get("tag")).toBe("acao");
    });
  });

  it("limpar filtros remove params de filtro/paginacao e preserva params nao relacionados", async () => {
    setupApiMock({
      projects: createProjects(24, {
        type: "Anime",
        tags: ["acao"],
        genres: ["drama"],
      }),
    });

    render(
      <MemoryRouter initialEntries={["/projetos?letter=P&type=Anime&tag=acao&genero=drama&page=2&q=teste&foo=1"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => {
      const params = getSearchParams();
      expect(params.get("letter")).toBeNull();
      expect(params.get("type")).toBeNull();
      expect(params.get("tag")).toBeNull();
      expect(params.get("genero")).toBeNull();
      expect(params.get("genre")).toBeNull();
      expect(params.get("page")).toBeNull();
      expect(params.get("q")).toBeNull();
      expect(params.get("foo")).toBe("1");
    });
  });

  it("nao grava estado da listagem no localStorage ao interagir", async () => {
    render(
      <MemoryRouter initialEntries={["/projetos?tag=acao"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    const pagination = await screen.findByRole("navigation");
    fireEvent.click(within(pagination).getByRole("link", { name: "2" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(PROJECTS_LIST_STATE_STORAGE_KEY)).toBeNull();
      expect(getSearchParams().get("page")).toBe("2");
    });
  });

  it("escreve page na URL ao paginar", async () => {
    render(
      <MemoryRouter initialEntries={["/projetos"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    const pagination = await screen.findByRole("navigation");
    fireEvent.click(within(pagination).getByRole("link", { name: "2" }));

    await waitFor(() => {
      expect(getSearchParams().get("page")).toBe("2");
    });
  });

  it("type invalido cai para Todos e URL canonica remove type", async () => {
    setupApiMock({
      projects: createProjects(12, {
        type: "Anime",
      }),
    });

    render(
      <MemoryRouter initialEntries={["/projetos?type=Inexistente"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getSearchParams().get("type")).toBeNull();
    });
  });

  it("exibe textos da UI com acentuacao correta", async () => {
    render(
      <MemoryRouter initialEntries={["/projetos"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(await screen.findByPlaceholderText("Buscar por t\u00EDtulo, sinopse, tag ou g\u00EAnero")).toBeInTheDocument();
    expect(screen.getByText("G\u00EAneros")).toBeInTheDocument();
  });

  it("renderiza variants poster para as capas publicas quando disponiveis", async () => {
    setupApiMock({
      projects: [
        {
          ...createProject(1),
          cover: "/uploads/projects/projeto-1.png",
        },
      ],
      mediaVariants: {
        "/uploads/projects/projeto-1.png": {
          variantsVersion: 3,
          variants: {
            poster: {
              formats: {
                avif: { url: "/uploads/_variants/p1/poster-v3.avif" },
                webp: { url: "/uploads/_variants/p1/poster-v3.webp" },
                fallback: { url: "/uploads/_variants/p1/poster-v3.jpeg" },
              },
            },
          },
        },
      },
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/projetos"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    const coverImage = await screen.findByRole("img", { name: "Projeto 1" });
    const sources = Array.from(container.querySelectorAll("source"));

    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute("srcset", expect.stringContaining("/poster-v3.avif"));
    expect(sources[1]).toHaveAttribute("srcset", expect.stringContaining("/poster-v3.webp"));
    expect(coverImage).toHaveAttribute("src", expect.stringContaining("/poster-v3.jpeg"));
  });
});

