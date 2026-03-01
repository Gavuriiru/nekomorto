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

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

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
  cover: "/uploads/cover-default.jpg",
  banner: "/uploads/banner-default.jpg",
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

const setupApiMock = (project = projectFixture) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(
    async (_apiBase: string, endpoint: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      const mediaVariants = {
        "/uploads/banner-default.jpg": {
          variantsVersion: 1,
          variants: {
            hero: {
              formats: {
                fallback: { url: "/uploads/_variants/project-1/hero-v1.jpeg" },
              },
            },
          },
          focalPoints: {
            hero: { x: 0.2, y: 0.8 },
          },
        },
        "/uploads/hero-fallback.jpg": {
          variantsVersion: 1,
          variants: {
            hero: {
              formats: {
                fallback: { url: "/uploads/_variants/project-1/hero-fallback-v1.jpeg" },
              },
            },
          },
          focalPoints: {
            hero: { x: 0.25, y: 0.75 },
          },
        },
        "/uploads/cover-only.jpg": {
          variantsVersion: 1,
          variants: {
            hero: {
              formats: {
                fallback: { url: "/uploads/_variants/project-1/cover-only-hero-v1.jpeg" },
              },
            },
          },
          focalPoints: {
            hero: { x: 0.3, y: 0.7 },
          },
        },
      };

      if (endpoint === "/api/public/projects/project-1" && method === "GET") {
        return mockJsonResponse(true, { project, mediaVariants });
      }
      if (endpoint === "/api/public/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [project] });
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
    },
  );
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

    const hero = await screen.findByTestId("project-hero");
    const heroTokens = classTokens(hero);
    expect(heroTokens).not.toContain("border-b");
    const bannerImage = within(hero).getByRole("img", { name: "Banner do projeto Projeto Teste" });
    const coverImage = within(hero).getByRole("img", { name: "Projeto Teste" });
    expect(bannerImage.getAttribute("src")).toContain("/uploads/_variants/project-1/hero-v1.jpeg");
    expect(bannerImage).toHaveStyle({ objectPosition: "20% 80%" });
    expect(coverImage.getAttribute("src")).toContain("/uploads/cover-default.jpg");

    const heading = await screen.findByRole("heading", { name: "Projeto Teste" });
    const headingTokens = classTokens(heading);
    expect(headingTokens).toContain("text-center");
    expect(headingTokens).toContain("md:text-left");
    expect(headingTokens).not.toContain("md:text-center");

    const coverWrapper = screen.getByTestId("project-hero-cover-shell");
    const coverWrapperTokens = classTokens(coverWrapper);
    expect(coverWrapperTokens).toContain("mx-auto");
    expect(coverWrapperTokens).toContain("md:mx-0");
    expect(coverWrapperTokens).toContain("w-64");
    expect(coverWrapperTokens).toContain("md:w-[320px]");
    expect(coverWrapperTokens).toContain("lg:w-[340px]");

    const heroLayout = screen.getByTestId("project-hero-layout");
    const heroLayoutTokens = classTokens(heroLayout);
    expect(heroLayoutTokens).toContain("items-start");
    expect(heroLayoutTokens).toContain("md:items-stretch");
    expect(heroLayoutTokens).toContain("gap-10");
    expect(heroLayoutTokens).toContain("lg:gap-12");
    expect(heroLayoutTokens).toContain("md:grid-cols-[320px_minmax(0,1fr)]");
    expect(heroLayoutTokens).toContain("lg:grid-cols-[340px_minmax(0,1fr)]");

    const heroInnerContainer = heroLayout.parentElement as HTMLElement | null;
    expect(heroInnerContainer).not.toBeNull();
    const heroInnerTokens = classTokens(heroInnerContainer as HTMLElement);
    expect(heroInnerTokens).toContain("pb-14");
    expect(heroInnerTokens).toContain("md:pb-16");
    expect(heroInnerTokens).toContain("lg:pb-20");

    const contentSection = hero.nextElementSibling as HTMLElement | null;
    expect(contentSection).not.toBeNull();
    const contentSectionTokens = classTokens(contentSection as HTMLElement);
    expect(contentSectionTokens).toContain("pt-8");
    expect(contentSectionTokens).toContain("md:pt-10");

    const infoPanel = screen.getByTestId("project-hero-info-panel");
    const infoPanelTokens = classTokens(infoPanel);
    expect(infoPanel.contains(coverWrapper)).toBe(false);
    expect(within(infoPanel).queryByTestId("project-hero-cover-shell")).not.toBeInTheDocument();
    expect(infoPanelTokens).toContain("md:h-full");
    expect(infoPanelTokens).not.toContain("bg-card/45");
    expect(infoPanelTokens).not.toContain("border");
    expect(infoPanelTokens).not.toContain("backdrop-blur-md");

    expect(coverWrapperTokens).toContain("md:h-full");
    const coverFrame = screen.getByTestId("project-hero-cover-frame");
    const coverFrameTokens = classTokens(coverFrame);
    expect(coverFrameTokens).toContain("h-full");
    expect(coverFrameTokens).toContain("md:max-h-[620px]");

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

    expect(within(metaRow as HTMLElement).getByText(/•/)).toBeInTheDocument();
    expect(within(metaRow as HTMLElement).getByText("Em andamento")).toBeInTheDocument();

    const synopsis = within(contentColumn as HTMLElement).getByText("Sinopse de teste");
    const synopsisTokens = classTokens(synopsis as HTMLElement);
    expect(synopsisTokens).toContain("text-center");
    expect(synopsisTokens).toContain("md:text-left");

    const actionsRow = screen.getByTestId("project-hero-actions-row");
    const actionsRowTokens = classTokens(actionsRow);
    expect(actionsRowTokens).toContain("w-full");
    expect(actionsRowTokens).toContain("justify-center");
    expect(actionsRowTokens).toContain("md:justify-start");
    expect(actionsRowTokens).toContain("md:mt-auto");
  });

  it("usa fallback de banner com heroImageUrl e depois cover", async () => {
    setupApiMock({
      ...projectFixture,
      banner: "",
      heroImageUrl: "/uploads/hero-fallback.jpg",
      cover: "/uploads/cover-fallback.jpg",
    });

    const firstRender = render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    const heroWithHeroFallback = screen.getByTestId("project-hero");
    const bannerFromHeroImage = within(heroWithHeroFallback).getByRole("img", {
      name: "Banner do projeto Projeto Teste",
    });
    expect(bannerFromHeroImage.getAttribute("src")).toContain(
      "/uploads/_variants/project-1/hero-fallback-v1.jpeg",
    );
    expect(bannerFromHeroImage).toHaveStyle({ objectPosition: "25% 75%" });
    firstRender.unmount();

    setupApiMock({
      ...projectFixture,
      banner: "",
      heroImageUrl: "",
      cover: "/uploads/cover-only.jpg",
    });

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    const heroWithCoverFallback = screen.getByTestId("project-hero");
    const bannerFromCover = within(heroWithCoverFallback).getByRole("img", {
      name: "Banner do projeto Projeto Teste",
    });
    expect(bannerFromCover.getAttribute("src")).toContain(
      "/uploads/_variants/project-1/cover-only-hero-v1.jpeg",
    );
    expect(bannerFromCover).toHaveStyle({ objectPosition: "30% 70%" });
  });

  it("renderiza CTA de leitura para light novel com capitulo publicado", async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
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
      },
    );

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    expect(screen.getByRole("link", { name: /Come.* leitura/i })).toHaveAttribute(
      "href",
      "/projeto/project-1/leitura/1?volume=2",
    );
  });
});
