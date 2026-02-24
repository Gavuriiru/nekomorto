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

    const badge = await screen.findByText("Timing");
    expect(badge).toHaveClass("bg-pink-500/20", "text-pink-400", "border-pink-500/30");
    expect(badge).not.toHaveClass("bg-primary/20");

    const indicator = container.querySelector(".bg-pink-500");
    expect(indicator).not.toBeNull();
    expect(indicator).not.toHaveClass("bg-primary");
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

    const badge = await screen.findByText("Timing");
    expect(badge).toHaveClass("bg-primary/20", "text-primary", "border-primary/40");
    expect(badge).not.toHaveClass("bg-pink-500/20");

    const indicator = container.querySelector(".bg-primary");
    expect(indicator).not.toBeNull();
    expect(indicator).not.toHaveClass("bg-pink-500");
  });
});
