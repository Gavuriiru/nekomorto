import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LatestEpisodeCard from "@/components/LatestEpisodeCard";

const usePublicBootstrapMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-public-bootstrap", () => ({
  usePublicBootstrap: () => usePublicBootstrapMock(),
}));

const setupBootstrapMock = () => {
  usePublicBootstrapMock.mockReturnValue({
    isLoading: false,
    data: {
      projects: [
        {
          id: "project-1",
          type: "Manga",
        },
        {
          id: "project-2",
          type: "Anime",
        },
      ],
      updates: [
        {
          id: "update-1",
          projectId: "project-1",
          projectTitle: "Projeto Alpha",
          episodeNumber: 12,
          kind: "Lancamento",
          reason: "capitulo novo",
          updatedAt: "2026-02-11T12:00:00.000Z",
          image: "/uploads/alpha.jpg",
          unit: "Capitulo",
        },
        {
          id: "update-2",
          projectId: "project-2",
          projectTitle: "Projeto Beta",
          episodeNumber: 3,
          kind: "Ajuste",
          reason: "revisao de links",
          updatedAt: "2026-02-10T12:00:00.000Z",
          image: "/uploads/beta.jpg",
          unit: "Episodio",
        },
      ],
      mediaVariants: {
        "/uploads/alpha.jpg": {
          variantsVersion: 1,
          variants: {
            poster: {
              formats: {
                avif: { url: "/uploads/_variants/u1/poster-v1.avif" },
                webp: { url: "/uploads/_variants/u1/poster-v1.webp" },
                fallback: { url: "/uploads/_variants/u1/poster-v1.jpeg" },
              },
            },
          },
        },
        "/uploads/beta.jpg": {
          variantsVersion: 1,
          variants: {
            poster: {
              formats: {
                avif: { url: "/uploads/_variants/u2/poster-v1.avif" },
                webp: { url: "/uploads/_variants/u2/poster-v1.webp" },
                fallback: { url: "/uploads/_variants/u2/poster-v1.jpeg" },
              },
            },
          },
        },
      },
    },
  });
};

describe("LatestEpisodeCard border styles", () => {
  beforeEach(() => {
    usePublicBootstrapMock.mockReset();
  });

  it("aplica classe semantica de borda nos cards internos e remove classes antigas", async () => {
    setupBootstrapMock();

    const { container } = render(
      <MemoryRouter>
        <LatestEpisodeCard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Atualiza/i });

    const updateLinks = screen.getAllByRole("link");
    expect(updateLinks).toHaveLength(2);

    updateLinks.forEach((link) => {
      expect(link).toHaveClass("recent-updates-item");
      expect(link).not.toHaveClass("border-border/60");
      expect(link).not.toHaveClass("hover:border-primary/40");
    });

    expect(container.querySelector(".soft-divider")).toBeNull();
  });

  it("renderiza poster otimizado para as imagens das atualizacoes", async () => {
    setupBootstrapMock();

    const { container } = render(
      <MemoryRouter>
        <LatestEpisodeCard />
      </MemoryRouter>,
    );

    const coverImage = await screen.findByRole("img", { name: "Projeto Alpha" });
    const coverPicture = coverImage.parentElement;
    const coverWrapper = coverPicture?.parentElement;
    const sources = Array.from(container.querySelectorAll("source"));

    expect(sources).toHaveLength(4);
    expect(sources[0]).toHaveAttribute("srcset", expect.stringContaining("/uploads/_variants/u1/poster-v1.avif"));
    expect(sources[1]).toHaveAttribute("srcset", expect.stringContaining("/uploads/_variants/u1/poster-v1.webp"));
    expect(coverImage).toHaveAttribute("src", expect.stringContaining("/uploads/_variants/u1/poster-v1.jpeg"));
    expect(coverWrapper).not.toBeNull();
    expect(coverWrapper).toHaveClass("h-full");
    expect(coverWrapper).not.toHaveClass("aspect-46/65");
    expect(coverWrapper?.style.aspectRatio).toBe("9 / 14");
  });
});
