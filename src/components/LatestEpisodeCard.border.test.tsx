import { render, screen, within } from "@testing-library/react";
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
          volume: 4,
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
            posterThumb: {
              formats: {
                avif: { url: "/uploads/_variants/u1/posterThumb-v1.avif" },
                webp: { url: "/uploads/_variants/u1/posterThumb-v1.webp" },
                fallback: { url: "/uploads/_variants/u1/posterThumb-v1.jpeg" },
              },
            },
          },
        },
        "/uploads/beta.jpg": {
          variantsVersion: 1,
          variants: {
            posterThumb: {
              formats: {
                avif: { url: "/uploads/_variants/u2/posterThumb-v1.avif" },
                webp: { url: "/uploads/_variants/u2/posterThumb-v1.webp" },
                fallback: { url: "/uploads/_variants/u2/posterThumb-v1.jpeg" },
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

    const cardRoot = screen
      .getByRole("heading", { name: /Atualiza/i })
      .closest<HTMLElement>("[data-reveal]");
    expect(cardRoot).not.toBeNull();
    expect(cardRoot).not.toHaveClass("hover:-translate-y-1");
    expect(cardRoot).not.toHaveClass("lift-hover");
    expect(cardRoot).toHaveClass("shadow-none");
    expect(cardRoot).not.toHaveClass("shadow-xs");
    expect(cardRoot).not.toHaveClass(
      "border",
      "border-border",
      "hover:border-primary/60",
    );
    expect(cardRoot).not.toHaveClass("hover:shadow-lg");

    const updateLinks = screen.getAllByRole("link");
    expect(updateLinks).toHaveLength(2);
    expect(screen.getByText("Vol. 4")).toBeInTheDocument();
    expect(screen.getByText("Lançamento")).toBeInTheDocument();
    expect(screen.getByText("Capítulo novo")).toBeInTheDocument();

    updateLinks.forEach((link) => {
      expect(link).toHaveClass("recent-updates-item");
      expect(link).not.toHaveClass("border", "border-transparent");
      expect(link).not.toHaveClass("relative");
      expect(link).not.toHaveClass("block");
      expect(link).not.toHaveClass("border-border/60");
      expect(link).not.toHaveClass("hover:border-primary/60");
    });

    const firstUpdateLink = updateLinks[0];
    expect(firstUpdateLink.querySelector("div.absolute")).toBeNull();
    const badgesRow = firstUpdateLink.querySelector("div.no-scrollbar");
    expect(badgesRow).not.toBeNull();
    expect(badgesRow).toHaveClass("flex-nowrap");
    expect(badgesRow).toHaveClass("overflow-x-auto");
    expect(badgesRow).toHaveClass("md:flex-wrap");

    const unitBadge = within(firstUpdateLink).getByText("Cap 12");
    const volumeBadge = within(firstUpdateLink).getByText("Vol. 4");
    const kindBadge = within(firstUpdateLink).getByText(/lan/i);
    expect(unitBadge).toHaveClass("hidden");
    expect(unitBadge).toHaveClass("md:inline-flex");
    expect(volumeBadge).toHaveClass("hidden");
    expect(volumeBadge).toHaveClass("md:inline-flex");
    expect(kindBadge).not.toHaveClass("hidden");

    const badges = Array.from(badgesRow?.children ?? []);
    expect(badges.length).toBeGreaterThan(0);
    badges.forEach((badge) => {
      expect(badge).toHaveClass("shrink-0");
    });

    const reason = screen.getByText(/capítulo novo/i);
    expect(reason).toHaveClass("line-clamp-1");
    expect(reason).toHaveClass("md:line-clamp-2");

    expect(
      screen.getByRole("heading", { level: 4, name: "Projeto Alpha" }),
    ).toHaveClass("clamp-safe-2");

    expect(container.querySelector(".soft-divider")).toBeNull();
  });

  it("renderiza poster otimizado para as imagens das atualizacoes", async () => {
    setupBootstrapMock();

    const { container } = render(
      <MemoryRouter>
        <LatestEpisodeCard />
      </MemoryRouter>,
    );

    const coverImage = await screen.findByRole("img", {
      name: "Projeto Alpha",
    });
    const coverPicture = coverImage.parentElement;
    const coverWrapper = coverPicture?.parentElement;
    const updateLink = coverWrapper?.parentElement;
    const sources = Array.from(container.querySelectorAll("source"));

    expect(sources).toHaveLength(4);
    expect(sources[0]).toHaveAttribute(
      "srcset",
      expect.stringContaining("/uploads/_variants/u1/posterThumb-v1.avif"),
    );
    expect(sources[1]).toHaveAttribute(
      "srcset",
      expect.stringContaining("/uploads/_variants/u1/posterThumb-v1.webp"),
    );
    expect(coverImage).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/_variants/u1/posterThumb-v1.jpeg"),
    );
    expect(coverWrapper).not.toBeNull();
    expect(updateLink).not.toBeNull();
    expect(updateLink?.firstElementChild).toBe(coverWrapper);
    expect(updateLink?.querySelector("div.absolute")).toBeNull();
    expect(coverWrapper).toHaveClass("h-full");
    expect(coverWrapper).toHaveClass("shrink-0");
    expect(coverWrapper).not.toHaveClass("aspect-46/65");
    expect(coverWrapper).not.toHaveClass("rounded-xl");
    expect(coverWrapper?.style.aspectRatio).toBe("9 / 14");
    expect(coverWrapper?.style.width).toBe("calc(var(--card-h) * 9 / 14)");
  });

  it("oculta badges de unidade e volume no mobile mesmo para unidade Extra", async () => {
    usePublicBootstrapMock.mockReturnValue({
      isLoading: false,
      data: {
        projects: [
          {
            id: "project-extra",
            type: "Manga",
          },
        ],
        updates: [
          {
            id: "update-extra",
            projectId: "project-extra",
            projectTitle: "Projeto Extra",
            episodeNumber: 0,
            volume: 18,
            kind: "Lancamento",
            reason: "extra disponivel",
            updatedAt: "2026-02-12T12:00:00.000Z",
            image: "/uploads/extra.jpg",
            unit: "Extra",
          },
        ],
        mediaVariants: {
          "/uploads/extra.jpg": {
            variantsVersion: 1,
            variants: {
              posterThumb: {
                formats: {
                  avif: { url: "/uploads/_variants/ue/posterThumb-v1.avif" },
                  webp: { url: "/uploads/_variants/ue/posterThumb-v1.webp" },
                  fallback: {
                    url: "/uploads/_variants/ue/posterThumb-v1.jpeg",
                  },
                },
              },
            },
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <LatestEpisodeCard />
      </MemoryRouter>,
    );

    const updateLink = (await screen.findAllByRole("link"))[0];
    const unitBadge = within(updateLink).getByText("Extra");
    const volumeBadge = within(updateLink).getByText("Vol. 18");
    const kindBadge = within(updateLink).getByText(/lan/i);

    expect(unitBadge).toHaveClass("hidden");
    expect(unitBadge).toHaveClass("md:inline-flex");
    expect(volumeBadge).toHaveClass("hidden");
    expect(volumeBadge).toHaveClass("md:inline-flex");
    expect(kindBadge).not.toHaveClass("hidden");
  });
});
