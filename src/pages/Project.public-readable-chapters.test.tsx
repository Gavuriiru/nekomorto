import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectPage from "@/pages/Project";

const apiFetchMock = vi.hoisted(() => vi.fn());
const useSiteSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  apiFetchBestEffort: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => useSiteSettingsMock(),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: "projeto-teste" }),
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

const baseProject = {
  id: "projeto-teste",
  title: "Projeto Teste",
  synopsis: "Sinopse",
  description: "Descricao",
  type: "Light Novel",
  status: "Em andamento",
  year: "2026",
  studio: "Studio Teste",
  episodes: "12 capitulos",
  tags: [],
  genres: [],
  cover: "/placeholder.svg",
  banner: "/placeholder.svg",
  season: "",
  schedule: "",
  rating: "",
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
  heroImageAlt: "",
  volumeEntries: [],
  volumeCovers: [],
  episodeDownloads: [],
  views: 0,
  commentsCount: 0,
};

const setupApiMock = (project: Record<string, unknown>) => {
  apiFetchMock.mockImplementation(
    async (_apiBase: string, endpoint: string, options?: RequestInit) => {
      if (
        endpoint === "/api/public/projects/projeto-teste" &&
        (!options?.method || options.method === "GET")
      ) {
        return mockJsonResponse(true, { project });
      }
      if (endpoint === "/api/public/projects" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, { projects: [project] });
      }
      if (
        endpoint === "/api/public/tag-translations" &&
        (!options?.method || options.method === "GET")
      ) {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      if (endpoint === "/api/public/me" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, { user: null });
      }
      if (
        endpoint === `/api/public/projects/${project.id}/view` &&
        String(options?.method || "").toUpperCase() === "POST"
      ) {
        return mockJsonResponse(true, { views: 1 });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    },
  );
};

describe("Project public readable chapters", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    useSiteSettingsMock.mockReset();
    useSiteSettingsMock.mockReturnValue({
      settings: {
        site: { defaultShareImage: "", defaultShareImageAlt: "" },
        downloads: { sources: [] },
      },
    });
  });

  it("exibe capítulos de light novel publicados quando o payload público só informa hasContent", async () => {
    const project = {
      ...baseProject,
      type: "Light Novel",
      volumeEntries: [
        {
          volume: 2,
          synopsis: "Volume 2",
          coverImageUrl: "",
          coverImageAlt: "",
        },
      ],
      episodeDownloads: [
        {
          number: 1,
          volume: 2,
          title: "Capitulo 1",
          synopsis: "Resumo do capitulo",
          releaseDate: "2026-03-10",
          duration: "",
          sourceType: "Web",
          sources: [],
          publicationStatus: "published",
          hasContent: true,
        },
      ],
    };

    setupApiMock(project);

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    const heroReadLink = screen.getByRole("link", { name: /Come.ar leitura/i });
    expect(heroReadLink).toHaveAttribute("href", "/projeto/projeto-teste/leitura/1?volume=2");

    const volumeTrigger = screen.getByRole("button", { name: /Volume 2/i });
    fireEvent.click(volumeTrigger);

    const readLink = await screen.findByRole("link", { name: /Ler cap.tulo/i });
    expect(readLink).toHaveAttribute("href", "/projeto/projeto-teste/leitura/1?volume=2");
    expect(screen.queryByText(/Nenhum cap.tulo publicado ainda/i)).not.toBeInTheDocument();
  });

  it("exibe capítulos de manga publicados quando o payload público só informa hasPages", async () => {
    const project = {
      ...baseProject,
      type: "Manga",
      volumeEntries: [
        {
          volume: 1,
          synopsis: "Volume 1",
          coverImageUrl: "",
          coverImageAlt: "",
        },
      ],
      episodeDownloads: [
        {
          number: 3,
          volume: 1,
          title: "Capitulo 3",
          synopsis: "Capitulo por imagens",
          releaseDate: "2026-03-11",
          duration: "",
          sourceType: "Web",
          sources: [],
          publicationStatus: "published",
          hasPages: true,
        },
      ],
    };

    setupApiMock(project);

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    const heroReadLink = screen.getByRole("link", { name: /Come.ar leitura/i });
    expect(heroReadLink).toHaveAttribute("href", "/projeto/projeto-teste/leitura/3?volume=1");

    const volumeTrigger = screen.getByRole("button", { name: /Volume 1/i });
    fireEvent.click(volumeTrigger);

    const readLink = await screen.findByRole("link", { name: /Abrir leitor/i });
    expect(readLink).toHaveAttribute("href", "/projeto/projeto-teste/leitura/3?volume=1");
    expect(screen.queryByText(/Nenhum cap.tulo publicado ainda/i)).not.toBeInTheDocument();
  });
});
