import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Projects from "@/pages/Projects";

const apiFetchMock = vi.hoisted(() => vi.fn());
const originalMatchMedia = window.matchMedia;

type BootstrapWindow = Window &
  typeof globalThis & {
    __BOOTSTRAP_PUBLIC__?: unknown;
  };

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const setBootstrapPayload = (payload: unknown) => {
  (window as BootstrapWindow).__BOOTSTRAP_PUBLIC__ = payload;
};

const clearBootstrapPayload = () => {
  delete (window as BootstrapWindow).__BOOTSTRAP_PUBLIC__;
};

const setViewportIsMobile = (isMobile: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(max-width: 767px)" ? isMobile : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};

describe("Projects accessibility", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    clearBootstrapPayload();
    window.scrollTo = vi.fn();
    setViewportIsMobile(false);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    setBootstrapPayload({
      settings: {},
      pages: {
        projects: {
          shareImage: "/uploads/projects-og.jpg",
          shareImageAlt: "Capa da pagina de projetos",
        },
      },
      projects: [
        {
          id: "project-a11y",
          title: "Projeto A11y",
          titleOriginal: "",
          titleEnglish: "",
          synopsis: "Sinopse acessivel",
          description: "Descricao acessivel",
          type: "Anime",
          status: "Em andamento",
          year: "2026",
          studio: "Studio Teste",
          episodes: "12 episodios",
          tags: ["acao"],
          genres: ["drama"],
          producers: ["Produtora 1"],
          cover: "/uploads/projects/projeto-a11y.png",
          coverAlt: "Capa do projeto A11y",
          banner: "/uploads/projects/projeto-a11y-banner.png",
          bannerAlt: "Banner do projeto A11y",
          season: "Temporada 1",
          schedule: "Sabado",
          rating: "14",
          heroImageUrl: "",
          heroImageAlt: "",
          forceHero: false,
          trailerUrl: "",
          volumeEntries: [],
          volumeCovers: [],
          episodeDownloads: [],
          views: 0,
          viewsDaily: {},
          staff: [],
        },
      ],
      posts: [],
      updates: [],
      mediaVariants: {},
      tagTranslations: {
        tags: { acao: "Acao" },
        genres: { drama: "Drama" },
        staffRoles: {},
      },
      generatedAt: "2026-03-06T18:40:00.000Z",
      payloadMode: "full",
    });
  });

  afterEach(() => {
    clearBootstrapPayload();
    window.matchMedia = originalMatchMedia;
  });

  it("mantem os quatro filtros nomeados no desktop e sem violacoes axe", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/projetos"]}>
        <Projects />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("combobox", { name: "Filtrar por letra" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por tag" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por genero" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por formato" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("mantem o disclosure mobile acessivel ao abrir os filtros", async () => {
    setViewportIsMobile(true);

    const { container } = render(
      <MemoryRouter initialEntries={["/projetos"]}>
        <Projects />
      </MemoryRouter>,
    );

    const trigger = await screen.findByRole("button", { name: /^Filtros\b/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("combobox", { name: "Filtrar por letra" })).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("combobox", { name: "Filtrar por letra" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por tag" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por genero" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por formato" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
