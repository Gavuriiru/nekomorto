import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const findAncestor = (
  element: HTMLElement,
  predicate: (candidate: HTMLElement) => boolean,
): HTMLElement | null => {
  let current = element.parentElement;
  while (current) {
    if (predicate(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

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

const mangaProjectFixture = {
  ...projectFixture,
  type: "Mangá",
  episodeDownloads: [
    {
      number: 1,
      volume: 3,
      title: "Capitulo 1",
      synopsis: "Resumo do capitulo",
      sources: [{ label: "Drive", url: "https://example.com/file" }],
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
        "/uploads/banner-only.jpg": {
          variantsVersion: 1,
          variants: {
            hero: {
              formats: {
                fallback: { url: "/uploads/_variants/project-1/banner-only-hero-v1.jpeg" },
              },
            },
          },
          focalPoints: {
            hero: { x: 0.35, y: 0.65 },
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
    const secondRender = render(
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
    expect(coverImage).toHaveClass("object-cover", "object-center");
    expect(coverImage).not.toHaveClass("object-contain");

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
    expect(coverWrapperTokens).toContain("self-start");
    expect(coverWrapperTokens).toContain("md:w-[320px]");
    expect(coverWrapperTokens).toContain("lg:w-[340px]");
    expect(coverWrapperTokens).not.toContain("md:h-full");

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

    const coverFrame = screen.getByTestId("project-hero-cover-frame");
    const coverFrameTokens = classTokens(coverFrame);
    expect(coverFrameTokens).not.toContain("h-full");
    expect(coverFrameTokens).not.toContain("md:max-h-[620px]");
    expect(coverFrame.style.aspectRatio).toBe("9 / 14");

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

    const secondRender = render(
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

    const secondRenderCoverImage = within(heroWithCoverFallback).getByRole("img", {
      name: "Projeto Teste",
    });
    expect(secondRenderCoverImage.getAttribute("src")).toContain("/uploads/cover-only.jpg");
    expect(secondRenderCoverImage).toHaveClass("object-cover", "object-center");
    expect(secondRenderCoverImage).not.toHaveClass("object-contain");
    secondRender.unmount();

    setupApiMock({
      ...projectFixture,
      banner: "/uploads/banner-only.jpg",
      heroImageUrl: "",
      cover: "",
    });

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    const heroWithBannerCoverFallback = screen.getByTestId("project-hero");
    const coverFromBannerFallback = within(heroWithBannerCoverFallback).getByRole("img", {
      name: "Projeto Teste",
    });
    expect(coverFromBannerFallback.getAttribute("src")).toContain("/uploads/banner-only.jpg");
    expect(coverFromBannerFallback).toHaveClass("object-cover", "object-center");
    expect(coverFromBannerFallback).not.toHaveClass("object-contain");
  });

  it("aplica proporcao 9:14 nas capas dos projetos relacionados", async () => {
    const projectWithRelation = {
      ...projectFixture,
      relations: [
        {
          relation: "SEQUEL",
          title: "Projeto Relacionado",
          format: "Anime",
          status: "Em andamento",
          image: "/uploads/related-cover.jpg",
          projectId: "project-2",
        },
      ],
    };

    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
        const method = String(options?.method || "GET").toUpperCase();

        if (endpoint === "/api/public/projects/project-1" && method === "GET") {
          return mockJsonResponse(true, { project: projectWithRelation });
        }
        if (endpoint === "/api/public/projects" && method === "GET") {
          return mockJsonResponse(true, {
            projects: [projectWithRelation, { id: "project-2", title: "Projeto Relacionado" }],
          });
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

    const relationImage = await screen.findByRole("img", { name: "Projeto Relacionado" });
    const relationCover = relationImage.parentElement as HTMLElement | null;
    const relationLink = relationImage.closest("a") as HTMLElement | null;
    const relationContent = relationCover?.nextElementSibling as HTMLElement | null;
    expect(relationCover).not.toBeNull();
    expect(relationLink).not.toBeNull();
    expect(relationContent).not.toBeNull();
    expect(classTokens(relationLink as HTMLElement)).toContain("overflow-hidden");
    expect(classTokens(relationCover as HTMLElement)).toContain("w-[4.5rem]");
    expect(classTokens(relationCover as HTMLElement)).toContain("sm:w-20");
    expect(classTokens(relationCover as HTMLElement)).not.toContain("rounded-lg");
    expect(classTokens(relationContent as HTMLElement)).toContain("p-[1.125rem]");
    expect(classTokens(relationCover as HTMLElement)).not.toContain("aspect-2/3");
    expect(classTokens(relationImage as HTMLElement)).not.toContain("scale-110");
    expect(relationCover?.style.aspectRatio).toBe("9 / 14");
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

  it("mantem leitura e download no mesmo card de light novel com thumb vertical", async () => {
    setupApiMock({
      ...lightNovelProjectFixture,
      episodeDownloads: [
        {
          ...lightNovelProjectFixture.episodeDownloads[0],
          synopsis: "Resumo do capitulo",
          sources: [{ label: "Drive", url: "https://example.com/drive" }],
        },
      ],
    });

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    const volumeTrigger = screen.getByRole("button", { name: /Volume 2/i });
    expect(volumeTrigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(volumeTrigger);
    await waitFor(() => {
      expect(volumeTrigger).toHaveAttribute("aria-expanded", "true");
    });
    const readLink = screen.getByRole("link", { name: /Ler cap.tulo/i });
    const readCard = findAncestor(readLink, (candidate) =>
      classTokens(candidate).includes("chapter-download-card"),
    );
    expect(readCard).not.toBeNull();
    expect(classTokens(readCard as HTMLElement)).toContain("w-full");
    expect(classTokens(readCard as HTMLElement)).toContain("group/chapter-card");
    expect(classTokens(readCard as HTMLElement)).toContain("!transform-none");
    expect(classTokens(readCard as HTMLElement)).toContain("hover:!translate-y-0");
    expect(classTokens(readCard as HTMLElement)).not.toContain("hover:-translate-y-1");
    const thumbShell = (readCard as HTMLElement).querySelector(
      ".chapter-download-card__thumb > div",
    ) as HTMLElement | null;
    expect(thumbShell).not.toBeNull();
    expect(thumbShell?.style.aspectRatio).toBe("9 / 14");
    const thumbImage = (readCard as HTMLElement).querySelector(
      ".chapter-download-card__thumb img",
    ) as HTMLElement | null;
    expect(thumbImage).not.toBeNull();
    expect(classTokens(thumbImage as HTMLElement)).toContain(
      "group-hover/chapter-card:scale-[1.03]",
    );
    expect(classTokens(thumbImage as HTMLElement)).not.toContain("group-hover:scale-[1.03]");
    expect(within(readCard as HTMLElement).getByRole("link", { name: "Drive" })).toHaveAttribute(
      "href",
      "https://example.com/drive",
    );
    expect(within(readCard as HTMLElement).getByText("Resumo do capitulo")).toBeInTheDocument();
  });

  it("usa sinopse do volume quando capitulo de light novel nao possui sinopse", async () => {
    setupApiMock({
      ...lightNovelProjectFixture,
      episodeDownloads: [
        {
          ...lightNovelProjectFixture.episodeDownloads[0],
          synopsis: "",
          sources: [{ label: "Drive", url: "https://example.com/drive" }],
        },
      ],
      volumeEntries: [
        {
          volume: 2,
          synopsis: "Sinopse fallback do volume 2",
          coverImageUrl: "/uploads/volume-2-cover.jpg",
          coverImageAlt: "Capa do volume 2",
        },
      ],
      volumeCovers: [
        {
          volume: 2,
          coverImageUrl: "/uploads/volume-2-cover.jpg",
          coverImageAlt: "Capa do volume 2",
        },
      ],
    });

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    const volumeTrigger = screen.getByRole("button", { name: /Volume 2/i });
    expect(volumeTrigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(volumeTrigger);
    await waitFor(() => {
      expect(volumeTrigger).toHaveAttribute("aria-expanded", "true");
    });
    const readLink = screen.getByRole("link", { name: /Ler cap.tulo/i });
    const readCard = findAncestor(readLink, (candidate) =>
      classTokens(candidate).includes("chapter-download-card"),
    );
    expect(readCard).not.toBeNull();
    expect(
      within(readCard as HTMLElement).getByText("Sinopse fallback do volume 2"),
    ).toBeInTheDocument();
  });

  it("exibe capa por volume em grupos de light novel", async () => {
    setupApiMock({
      ...lightNovelProjectFixture,
      volumeEntries: [
        {
          volume: 2,
          synopsis: "Sinopse do volume 2",
          coverImageUrl: "/uploads/volume-2-cover.jpg",
          coverImageAlt: "Capa do volume 2",
        },
      ],
      volumeCovers: [
        {
          volume: 2,
          coverImageUrl: "/uploads/volume-2-cover.jpg",
          coverImageAlt: "Capa do volume 2",
        },
      ],
    });

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    const volumeTrigger = screen.getByRole("button", { name: /Volume 2/i });
    expect(volumeTrigger).toHaveAttribute("aria-expanded", "false");
    const volumeCard = findAncestor(volumeTrigger, (candidate) =>
      classTokens(candidate).includes("bg-card/80"),
    );
    expect(volumeCard).not.toBeNull();
    expect((volumeCard as HTMLElement).querySelectorAll("button").length).toBe(1);
    expect(classTokens(volumeTrigger)).toContain("items-start");
    expect(classTokens(volumeTrigger)).toContain("px-5");
    expect(classTokens(volumeTrigger)).toContain("py-5");
    expect(classTokens(volumeTrigger)).toContain("hover:no-underline");

    const triggerGrid = (volumeTrigger as HTMLElement).querySelector(
      '[class*="md:grid-cols-[128px_minmax(0,1fr)_auto]"]',
    ) as HTMLElement | null;
    expect(triggerGrid).not.toBeNull();
    expect(classTokens(triggerGrid as HTMLElement)).toContain("md:items-start");
    expect(classTokens(triggerGrid as HTMLElement)).toContain("md:gap-5");
    expect((triggerGrid as HTMLElement).querySelector('[class*="self-start"]')).not.toBeNull();
    expect((triggerGrid as HTMLElement).querySelector('[class*="w-28"]')).not.toBeNull();

    expect(within(volumeTrigger).getAllByRole("img", { name: "Capa do volume 2" }).length).toBe(1);
    expect(within(volumeTrigger).getByText("1 capítulos disponíveis")).toBeInTheDocument();
    expect(within(volumeTrigger).getByText("1 capítulos")).toBeInTheDocument();
    expect(within(volumeTrigger).getByText("Sinopse do volume 2")).toBeInTheDocument();
  });

  it("exibe capa por volume em grupos de mangá", async () => {
    setupApiMock({
      ...mangaProjectFixture,
      volumeEntries: [
        {
          volume: 3,
          synopsis: "Sinopse do volume 3",
          coverImageUrl: "/uploads/volume-3-cover.jpg",
          coverImageAlt: "Capa do volume 3",
        },
      ],
      volumeCovers: [
        {
          volume: 3,
          coverImageUrl: "/uploads/volume-3-cover.jpg",
          coverImageAlt: "Capa do volume 3",
        },
      ],
    });

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    const volumeTrigger = screen.getByRole("button", { name: /Volume 3/i });
    expect(volumeTrigger).toHaveAttribute("aria-expanded", "false");
    const volumeCard = findAncestor(volumeTrigger, (candidate) =>
      classTokens(candidate).includes("bg-card/80"),
    );
    expect(volumeCard).not.toBeNull();
    expect((volumeCard as HTMLElement).querySelectorAll("button").length).toBe(1);
    expect(classTokens(volumeTrigger)).toContain("items-start");
    expect(classTokens(volumeTrigger)).toContain("px-5");
    expect(classTokens(volumeTrigger)).toContain("py-5");

    const triggerGrid = (volumeTrigger as HTMLElement).querySelector(
      '[class*="md:grid-cols-[128px_minmax(0,1fr)_auto]"]',
    ) as HTMLElement | null;
    expect(triggerGrid).not.toBeNull();
    expect(classTokens(triggerGrid as HTMLElement)).toContain("md:items-start");
    expect((triggerGrid as HTMLElement).querySelector('[class*="self-start"]')).not.toBeNull();
    expect((triggerGrid as HTMLElement).querySelector('[class*="w-28"]')).not.toBeNull();

    expect(within(volumeTrigger).getAllByRole("img", { name: "Capa do volume 3" }).length).toBe(1);
    expect(within(volumeTrigger).getByText("1 capítulos disponíveis")).toBeInTheDocument();
    expect(within(volumeTrigger).getByText("1 capítulos")).toBeInTheDocument();
    expect(within(volumeTrigger).getByText("Sinopse do volume 3")).toBeInTheDocument();
  });

  it("remove centralizacao do grid de downloads no manga e mantem cards com largura fluida", async () => {
    setupApiMock(mangaProjectFixture);

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    const volumeTrigger = screen.getByRole("button", { name: /Volume 3/i });
    expect(volumeTrigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(volumeTrigger);
    await waitFor(() => {
      expect(volumeTrigger).toHaveAttribute("aria-expanded", "true");
    });
    const downloadsSection = document.getElementById("downloads");
    expect(downloadsSection).not.toBeNull();
    expect(
      (downloadsSection as HTMLElement).querySelector('[class*="justify-items-center"]'),
    ).toBeNull();

    const chapterTitle = screen.getByText("Capitulo 1");
    const episodeCard = findAncestor(chapterTitle, (candidate) =>
      classTokens(candidate).includes("chapter-download-card"),
    );
    expect(episodeCard).not.toBeNull();
    expect(classTokens(episodeCard as HTMLElement)).toContain("w-full");
    expect(classTokens(episodeCard as HTMLElement)).toContain("group/chapter-card");
    expect(classTokens(episodeCard as HTMLElement)).toContain("!transform-none");
    expect(classTokens(episodeCard as HTMLElement)).toContain("hover:!translate-y-0");
    expect(classTokens(episodeCard as HTMLElement)).not.toContain("hover:-translate-y-1");
    expect(within(episodeCard as HTMLElement).queryByRole("link", { name: /Ler/i })).toBeNull();
    expect(within(episodeCard as HTMLElement).getByRole("link", { name: "Drive" })).toHaveAttribute(
      "href",
      "https://example.com/file",
    );
  });

  it("mantem cards de anime com altura fixa no desktop", async () => {
    setupApiMock({
      ...projectFixture,
      episodeDownloads: [
        {
          number: 1,
          title: "Episodio 1",
          releaseDate: "2025-01-01",
          duration: "24 min",
          sourceType: "TV",
          sizeBytes: 734003200,
          hash: "ABC123",
          sources: [{ label: "Drive", url: "https://example.com/1" }],
        },
        {
          number: 2,
          title: "Episodio 2",
          sourceType: "TV",
          sources: [{ label: "Drive", url: "https://example.com/2" }],
        },
      ],
    });

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Teste" });
    const episodeOneTitle = screen.getByText("Episodio 1");
    const episodeOneCard = findAncestor(episodeOneTitle, (candidate) =>
      classTokens(candidate).includes("bg-gradient-card"),
    );
    expect(episodeOneCard).not.toBeNull();
    expect(classTokens(episodeOneCard as HTMLElement)).toContain("md:h-[210px]");
    expect(classTokens(episodeOneCard as HTMLElement)).not.toContain("md:min-h-[185px]");
  });
});
