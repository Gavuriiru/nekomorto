import { render, screen, within } from "@testing-library/react";
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

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

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

const lightNovelProjectFixture = {
  ...projectFixture,
  type: "Light Novel",
  episodeDownloads: [
    {
      number: 1,
      volume: 2,
      title: "Capitulo 1",
      synopsis: "Resumo do capitulo",
      content: "<p>Conteudo</p>",
    },
  ],
};

const setupApiMock = () => {
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
      return mockJsonResponse(true, { user: null });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("Project mobile hero layout", () => {
  beforeEach(() => {
    setupApiMock();
  });

  it("centraliza todo o hero no mobile e preserva alinhamento desktop", async () => {
    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    const heading = await screen.findByRole("heading", { name: "Projeto Teste" });
    const headingTokens = classTokens(heading);
    expect(headingTokens).toContain("text-center");
    expect(headingTokens).toContain("md:text-left");
    expect(headingTokens).not.toContain("md:text-center");

    const coverImage = screen.getByRole("img", { name: "Projeto Teste" });
    const coverWrapper = coverImage.parentElement as HTMLElement | null;
    expect(coverWrapper).not.toBeNull();

    const coverWrapperTokens = classTokens(coverWrapper as HTMLElement);
    expect(coverWrapperTokens).toContain("mx-auto");
    expect(coverWrapperTokens).toContain("md:mx-0");

    const contentColumn = heading.parentElement as HTMLElement | null;
    expect(contentColumn).not.toBeNull();

    const contentColumnTokens = classTokens(contentColumn as HTMLElement);
    expect(contentColumnTokens).toContain("w-full");
    expect(contentColumnTokens).toContain("items-center");
    expect(contentColumnTokens).toContain("text-center");
    expect(contentColumnTokens).toContain("md:items-start");
    expect(contentColumnTokens).toContain("md:text-left");

    const typeLabel = within(contentColumn as HTMLElement).getByText("Anime");
    const metaRow = typeLabel.closest("div") as HTMLElement | null;
    expect(metaRow).not.toBeNull();

    const metaRowTokens = classTokens(metaRow as HTMLElement);
    expect(metaRowTokens).toContain("w-full");
    expect(metaRowTokens).toContain("justify-center");
    expect(metaRowTokens).toContain("text-center");
    expect(metaRowTokens).toContain("md:w-auto");
    expect(metaRowTokens).toContain("md:justify-start");
    expect(metaRowTokens).toContain("md:text-left");

    expect(within(metaRow as HTMLElement).getByText("•")).toBeInTheDocument();
    expect(within(metaRow as HTMLElement).getByText("Em andamento")).toBeInTheDocument();

    const synopsis = within(contentColumn as HTMLElement).getByText("Sinopse de teste");
    const synopsisTokens = classTokens(synopsis as HTMLElement);
    expect(synopsisTokens).toContain("text-center");
    expect(synopsisTokens).toContain("md:text-left");

    const downloadsLink = within(contentColumn as HTMLElement).getByRole("link", { name: "Ver episódios" });
    const actionsRow = downloadsLink.closest("div") as HTMLElement | null;
    expect(actionsRow).not.toBeNull();

    const actionsRowTokens = classTokens(actionsRow as HTMLElement);
    expect(actionsRowTokens).toContain("w-full");
    expect(actionsRowTokens).toContain("justify-center");
    expect(actionsRowTokens).toContain("md:justify-start");
  });

  it("renderiza breadcrumb e CTA de leitura para light novel com capitulo publicado", async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (endpoint === "/api/public/projects/project-1" && method === "GET") {
        return mockJsonResponse(true, { project: lightNovelProjectFixture });
      }
      if (endpoint === "/api/public/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [lightNovelProjectFixture] });
      }
      if (endpoint === "/api/public/tag-translations" && method === "GET") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      if (endpoint === "/api/public/projects/project-1/view" && method === "POST") {
        return mockJsonResponse(true, { views: 1 });
      }
      if (endpoint === "/api/public/me" && method === "GET") {
        return mockJsonResponse(true, { user: null });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });

    expect(screen.getByRole("link", { name: /In[ií]cio/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Projetos" })).toHaveAttribute("href", "/projetos");
    expect(screen.getByRole("link", { name: "Começar leitura" })).toHaveAttribute(
      "href",
      "/projeto/project-1/leitura/1?volume=2",
    );
  });
});
