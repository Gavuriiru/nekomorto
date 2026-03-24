import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkStatusCard from "@/components/WorkStatusCard";

const usePublicBootstrapMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-public-bootstrap", () => ({
  usePublicBootstrap: () => usePublicBootstrapMock(),
}));

const createBootstrapData = (useAccentInProgressCard: boolean) => ({
  settings: {
    theme: {
      useAccentInProgressCard,
    },
  },
  projects: [
    {
      id: "project-1",
      title: "Oshi no Ko",
      synopsis: "",
      description: "",
      type: "Anime",
      status: "Em andamento",
      tags: [],
      cover: "",
      banner: "",
      heroImageUrl: "",
      forceHero: false,
      trailerUrl: "",
      episodeDownloads: [
        {
          number: 1,
          title: "Episodio 1",
          releaseDate: "",
          duration: "",
          coverImageUrl: "",
          sourceType: "",
          sources: [],
          progressStage: "timing",
          completedStages: ["aguardando-raw", "traducao", "revisao"],
          chapterUpdatedAt: "",
          hasContent: false,
        },
      ],
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

    expect(screen.getByRole("progressbar", { name: /Oshi no Ko.*43% conclu/ })).toBeInTheDocument();
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
});
