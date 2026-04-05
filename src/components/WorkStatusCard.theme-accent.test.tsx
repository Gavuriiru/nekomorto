import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkStatusCard from "@/components/WorkStatusCard";

const usePublicBootstrapMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-public-bootstrap", () => ({
  usePublicBootstrap: () => usePublicBootstrapMock(),
}));

const createBootstrapData = (
  useAccentInProgressCard: boolean,
  itemOverrides: Record<string, unknown> = {},
) => ({
  settings: {
    theme: {
      useAccentInProgressCard,
    },
  },
  projects: [],
  inProgressItems: [
    {
      projectId: "project-1",
      projectTitle: "Oshi no Ko",
      projectType: "Anime",
      number: 2,
      progressStage: "timing",
      completedStages: ["aguardando-raw", "traducao", "revisao"],
      ...itemOverrides,
    },
  ],
});

describe("WorkStatusCard accent mode", () => {
  beforeEach(() => {
    usePublicBootstrapMock.mockReset();
  });

  it("mantem cor por etapa quando a flag estiver desativada", async () => {
    usePublicBootstrapMock.mockReturnValue({
      isLoading: false,
      data: createBootstrapData(false),
    });

    const { container } = render(
      <MemoryRouter>
        <WorkStatusCard />
      </MemoryRouter>,
    );
    const cardRoot = screen
      .getByRole("heading", { name: "Em Progresso" })
      .closest<HTMLElement>("[data-reveal]");
    expect(cardRoot).not.toBeNull();
    expect(cardRoot).not.toHaveClass("lift-hover");
    expect(cardRoot).toHaveClass("shadow-none");
    expect(cardRoot).not.toHaveClass("shadow-xs");

    const badge = await screen.findByText("Timing");
    expect(badge).toHaveClass("bg-pink-500/20", "text-pink-400", "border-pink-500/30");
    expect(badge).not.toHaveClass("bg-primary");
    const progressLink = badge.closest("a");
    expect(progressLink).not.toBeNull();
    expect(progressLink).toHaveClass("hover:-translate-y-1", "hover:border-primary/60");

    const indicator = container.querySelector(".bg-pink-500");
    expect(indicator).not.toBeNull();
    expect(indicator).not.toHaveClass("bg-primary");

    expect(screen.getByRole("progressbar", { name: /Oshi no Ko.*57% conclu/ })).toBeInTheDocument();
  });

  it("usa cor tematica no badge e na barra quando a flag estiver ativada", async () => {
    usePublicBootstrapMock.mockReturnValue({
      isLoading: false,
      data: createBootstrapData(true),
    });

    const { container } = render(
      <MemoryRouter>
        <WorkStatusCard />
      </MemoryRouter>,
    );
    const cardRoot = screen
      .getByRole("heading", { name: "Em Progresso" })
      .closest<HTMLElement>("[data-reveal]");
    expect(cardRoot).not.toBeNull();
    expect(cardRoot).not.toHaveClass("lift-hover");
    expect(cardRoot).toHaveClass("shadow-none");
    expect(cardRoot).not.toHaveClass("shadow-xs");

    const badge = await screen.findByText("Timing");
    expect(badge).toHaveClass("bg-primary", "text-primary-foreground", "border-primary/80");
    expect(badge).not.toHaveClass("bg-pink-500/20");
    const progressLink = badge.closest("a");
    expect(progressLink).not.toBeNull();
    expect(progressLink).toHaveClass("hover:-translate-y-1", "hover:border-primary/60");

    const indicator = container.querySelector(".bg-primary");
    expect(indicator).not.toBeNull();
    expect(indicator).not.toHaveClass("bg-pink-500");
  });

  it("prioriza progressStage no card mesmo quando completedStages ainda esta defasado", async () => {
    usePublicBootstrapMock.mockReturnValue({
      isLoading: false,
      data: createBootstrapData(false, {
        progressStage: "typesetting",
        completedStages: ["aguardando-raw", "traducao"],
      }),
    });

    const { container } = render(
      <MemoryRouter>
        <WorkStatusCard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Typesetting")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /Oshi no Ko.*43% conclu/ })).toBeInTheDocument();
    expect(container.querySelector(".bg-indigo-500")).not.toBeNull();
  });

  it("remove o item do card quando progressStage chega na etapa final", () => {
    usePublicBootstrapMock.mockReturnValue({
      isLoading: false,
      data: createBootstrapData(false, {
        progressStage: "encode",
        completedStages: [
          "aguardando-raw",
          "traducao",
          "revisao",
          "timing",
          "typesetting",
          "quality-check",
        ],
      }),
    });

    render(
      <MemoryRouter>
        <WorkStatusCard />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Nenhum epis.+dio em progresso no momento\./i)).toBeInTheDocument();
    expect(screen.queryByText("Oshi no Ko")).not.toBeInTheDocument();
  });

  it("nao lista capitulos que ja estao publicados com leitura interna", () => {
    usePublicBootstrapMock.mockReturnValue({
      isLoading: false,
      data: {
        settings: {
          theme: {
            useAccentInProgressCard: false,
          },
        },
        inProgressItems: [],
        projects: [
          {
            id: "project-1",
            title: "Blue Box",
            synopsis: "",
            description: "",
            type: "Manga",
            status: "Em andamento",
            tags: [],
            cover: "",
            banner: "",
            heroImageUrl: "",
            forceHero: false,
            trailerUrl: "",
            episodeDownloads: [
              {
                number: 12,
                volume: 2,
                title: "Capitulo 12",
                releaseDate: "",
                duration: "",
                coverImageUrl: "",
                sourceType: "",
                sources: [],
                progressStage: "typesetting",
                completedStages: ["aguardando-raw", "traducao", "limpeza", "redrawing"],
                chapterUpdatedAt: "",
                hasContent: false,
                hasPages: true,
              },
            ],
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <WorkStatusCard />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Nenhum epis.+dio em progresso no momento\./i)).toBeInTheDocument();
    expect(screen.queryByText("Blue Box")).not.toBeInTheDocument();
  });

  it("renderiza drafts reais de light novel e mangá com os rótulos corretos", async () => {
    usePublicBootstrapMock.mockReturnValue({
      isLoading: false,
      data: {
        settings: {
          theme: {
            useAccentInProgressCard: false,
          },
        },
        projects: [],
        inProgressItems: [
          {
            projectId: "project-ln",
            projectTitle: "NouKin",
            projectType: "Light Novel",
            number: 3,
            volume: 0,
            progressStage: "traducao",
            completedStages: ["aguardando-raw"],
          },
          {
            projectId: "project-manga",
            projectTitle: "Gabriel Dropout",
            projectType: "Manga",
            number: 2,
            volume: 1,
            progressStage: "typesetting",
            completedStages: ["aguardando-raw", "traducao", "limpeza", "redrawing"],
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <WorkStatusCard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("NouKin")).toBeInTheDocument();
    expect(screen.getByText("Capítulo 3 • Vol. 0")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /NouKin.*29% conclu/ })).toBeInTheDocument();

    expect(screen.getByText("Gabriel Dropout")).toBeInTheDocument();
    expect(screen.getByText("Capítulo 2 • Vol. 1")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: /Gabriel Dropout.*71% conclu/ }),
    ).toBeInTheDocument();
  });

  it("oculta a scrollbar e limita a lista a cinco progressos visíveis por padrão", async () => {
    usePublicBootstrapMock.mockReturnValue({
      isLoading: false,
      data: {
        settings: {
          theme: {
            useAccentInProgressCard: false,
          },
        },
        projects: [],
        inProgressItems: Array.from({ length: 6 }, (_item, index) => ({
          projectId: `project-${index + 1}`,
          projectTitle: `Projeto ${index + 1}`,
          projectType: "Anime",
          number: index + 1,
          progressStage: "timing",
          completedStages: ["aguardando-raw", "traducao", "revisao"],
        })),
      },
    });

    render(
      <MemoryRouter>
        <WorkStatusCard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Projeto 6")).toBeInTheDocument();

    const scrollRegion = screen.getByTestId("work-status-scroll-region");
    expect(scrollRegion).toHaveClass("no-scrollbar", "overflow-y-auto", "overscroll-contain");
    expect(scrollRegion).toHaveStyle({
      maxHeight: "calc((5.75rem * 5) + (0.75rem * 4) + 0.25rem)",
    });

    const progressLinks = scrollRegion.querySelectorAll("a");
    expect(progressLinks).toHaveLength(6);
    progressLinks.forEach((link) => {
      expect(link.className).toContain("min-h-[5.75rem]");
    });
  });
});
