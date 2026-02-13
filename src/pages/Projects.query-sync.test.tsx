import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Projects from "@/pages/Projects";

const apiFetchMock = vi.hoisted(() => vi.fn());

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
  tags: ["acao"],
  genres: ["drama"],
  cover: "/placeholder.svg",
  banner: "/placeholder.svg",
  season: "Temporada 1",
  schedule: "Sabado",
  rating: "14",
  episodeDownloads: [],
  staff: [],
};

const setupApiMock = () => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (endpoint === "/api/public/projects" && method === "GET") {
      return mockJsonResponse(true, { projects: [projectFixture] });
    }
    if (endpoint === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, {
        tags: { acao: "Acao" },
        genres: { drama: "Drama" },
        staffRoles: {},
      });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

const getLocationSearch = () => String(screen.getByTestId("location-search").textContent || "");

const getSearchParams = () => new URLSearchParams(getLocationSearch().replace(/^\?/, ""));

describe("Projects query sync", () => {
  beforeEach(() => {
    setupApiMock();
    window.scrollTo = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("remove tag da URL ao limpar filtros", async () => {
    render(
      <MemoryRouter initialEntries={["/projetos?tag=acao"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => {
      expect(getSearchParams().get("tag")).toBeNull();
    });
  });

  it("remove tag e genero da URL ao limpar filtros", async () => {
    render(
      <MemoryRouter initialEntries={["/projetos?tag=acao&genero=drama"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => {
      const params = getSearchParams();
      expect(params.get("tag")).toBeNull();
      expect(params.get("genero")).toBeNull();
      expect(params.get("genre")).toBeNull();
    });
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

  it("preserva query params nao relacionados ao limpar tag", async () => {
    render(
      <MemoryRouter initialEntries={["/projetos?tag=acao&foo=1"]}>
        <Projects />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => {
      const params = getSearchParams();
      expect(params.get("tag")).toBeNull();
      expect(params.get("foo")).toBe("1");
    });
  });
});
