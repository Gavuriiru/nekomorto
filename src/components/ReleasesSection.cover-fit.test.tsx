import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ReleasesSection from "@/components/ReleasesSection";

const usePublicBootstrapMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-public-bootstrap", () => ({
  usePublicBootstrap: () => usePublicBootstrapMock(),
}));

vi.mock("@/components/LatestEpisodeCard", () => ({
  default: () => null,
}));

vi.mock("@/components/WorkStatusCard", () => ({
  default: () => null,
}));

vi.mock("@/components/DiscordInviteCard", () => ({
  default: () => null,
}));

const setupBootstrapMock = () => {
  usePublicBootstrapMock.mockReturnValue({
    isLoading: false,
    data: {
      posts: [
        {
          id: "post-1",
          slug: "post-teste",
          title: "Post de Teste",
          excerpt: "Resumo",
          author: "Equipe",
          publishedAt: "2026-02-10T12:00:00.000Z",
          coverImageUrl: "/uploads/capa-card.jpg",
          tags: ["acao"],
          projectId: "project-1",
        },
      ],
      projects: [
        {
          id: "project-1",
          title: "Projeto Teste",
        },
      ],
      tagTranslations: { tags: {} },
    },
  });
};

describe("ReleasesSection cover fit", () => {
  beforeEach(() => {
    usePublicBootstrapMock.mockReset();
  });

  it("renderiza capa do card com preenchimento total e wrapper 3:2", async () => {
    setupBootstrapMock();

    render(
      <MemoryRouter>
        <ReleasesSection />
      </MemoryRouter>,
    );

    const coverImage = await screen.findByRole("img", { name: "Post de Teste" });
    expect(coverImage).toHaveClass(
      "absolute",
      "inset-0",
      "block",
      "h-full",
      "w-full",
      "object-cover",
      "object-center",
    );

    const coverContainer = coverImage.parentElement;
    expect(coverContainer).not.toBeNull();
    expect(coverContainer).toHaveClass(
      "relative",
      "w-full",
      "aspect-3/2",
      "overflow-hidden",
    );
  });

  it("expoe ancora de lancamentos, link da postagem e remove CTAs extras", async () => {
    setupBootstrapMock();

    render(
      <MemoryRouter>
        <ReleasesSection />
      </MemoryRouter>,
    );

    expect(document.getElementById("lancamentos")).toBeInTheDocument();
    const postLink = await screen.findByRole("link", { name: /post de teste/i });
    expect(postLink).toHaveAttribute("href", "/postagem/post-teste");
    expect(screen.queryByRole("link", { name: /Ler postagem/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver projeto/i })).not.toBeInTheDocument();
  });
});
