import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ReleasesSection from "@/components/ReleasesSection";

const usePublicBootstrapMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-public-bootstrap", () => ({
  usePublicBootstrap: () => usePublicBootstrapMock(),
}));

vi.mock("@/components/LatestEpisodeCard", () => ({
  default: () => <section data-testid="sidebar-latest-card" />,
}));

vi.mock("@/components/WorkStatusCard", () => ({
  default: () => <section data-testid="sidebar-work-status-card" />,
}));

vi.mock("@/components/TopProjectsSection", () => ({
  default: () => <section data-testid="sidebar-top-projects-card" />,
}));

vi.mock("@/components/DiscordInviteCard", () => ({
  default: () => <section data-testid="sidebar-discord-card" />,
}));

const createPost = (index: number) => ({
  id: `post-${index}`,
  slug: `post-${index}`,
  title: `Post ${index}`,
  excerpt: `Resumo ${index}`,
  author: "Equipe",
  publishedAt: "2026-02-10T12:00:00.000Z",
  coverImageUrl: "/uploads/capa-card.jpg",
  tags: ["acao"],
  projectId: "project-1",
});

const setupBootstrapMock = ({
  posts = [
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
}: {
  posts?: Array<ReturnType<typeof createPost>>;
} = {}) => {
  usePublicBootstrapMock.mockReturnValue({
    isLoading: false,
    data: {
      posts,
      projects: [
        {
          id: "project-1",
          title: "Projeto Teste",
        },
      ],
      tagTranslations: { tags: { acao: "A\u00e7\u00e3o" } },
      mediaVariants: {
        "/uploads/capa-card.jpg": {
          variantsVersion: 2,
          variants: {
            cardHome: {
              formats: {
                avif: { url: "/uploads/_variants/post-1/cardHome-v2.avif" },
                webp: { url: "/uploads/_variants/post-1/cardHome-v2.webp" },
                fallback: { url: "/uploads/_variants/post-1/cardHome-v2.jpeg" },
              },
            },
          },
        },
      },
    },
  });
};

describe("ReleasesSection cover fit", () => {
  beforeEach(() => {
    usePublicBootstrapMock.mockReset();
    window.scrollTo = vi.fn();
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }) as typeof window.requestAnimationFrame;
  });

  it("renderiza capa do card com preenchimento total e wrapper 3:2", async () => {
    setupBootstrapMock();

    render(
      <MemoryRouter>
        <ReleasesSection />
      </MemoryRouter>,
    );

    const coverImage = await screen.findByRole("img", { name: "Post de Teste" });
    const postLink = screen.getByRole("link", { name: /post de teste/i });
    const postCardRoot = postLink.firstElementChild as HTMLElement | null;
    expect(coverImage).toHaveClass(
      "absolute",
      "inset-0",
      "block",
      "h-full",
      "w-full",
      "object-cover",
      "object-center",
    );

    const coverContainer = coverImage.parentElement?.parentElement;
    expect(coverContainer).not.toBeNull();
    expect(coverContainer).toHaveClass("relative", "w-full", "aspect-3/2", "overflow-hidden");
    expect(postCardRoot).not.toBeNull();
    expect(postCardRoot).toHaveClass("shadow-none");
    expect(postCardRoot).not.toHaveClass("shadow-xs");
    expect(postCardRoot).not.toHaveClass("border", "border-border", "hover:border-primary/60");
    expect(postCardRoot).toHaveClass("hover:shadow-lg");
    expect(coverImage).toHaveAttribute(
      "src",
      expect.stringContaining("/uploads/_variants/post-1/cardHome-v2.jpeg"),
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
    expect(screen.queryByText("A\u00e7\u00e3o")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ler postagem/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver projeto/i })).not.toBeInTheDocument();
  });

  it("mantem heading semantico da secao antes dos titulos dos cards", async () => {
    setupBootstrapMock();

    render(
      <MemoryRouter>
        <ReleasesSection />
      </MemoryRouter>,
    );

    const sectionHeading = screen.getByRole("heading", { level: 2, name: /Em Destaque/i });
    const cardHeading = await screen.findByRole("heading", { level: 3, name: "Post de Teste" });

    expect(
      sectionHeading.compareDocumentPosition(cardHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("renderiza Top 10 na sidebar entre Em Progresso e Discord", async () => {
    setupBootstrapMock();

    const { container } = render(
      <MemoryRouter>
        <ReleasesSection />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 3, name: "Post de Teste" });

    const sidebar = container.querySelector("div.flex.h-full.flex-col.gap-6");
    expect(sidebar).not.toBeNull();
    const cards = within(sidebar as HTMLElement).getAllByTestId(/sidebar-/i);
    const order = cards.map((card) => card.getAttribute("data-testid"));

    expect(order).toEqual([
      "sidebar-latest-card",
      "sidebar-work-status-card",
      "sidebar-top-projects-card",
      "sidebar-discord-card",
    ]);
  });

  it("usa paginacao compacta e troca de pagina sem perder o scroll da secao", async () => {
    setupBootstrapMock({
      posts: Array.from({ length: 64 }, (_, index) => createPost(index + 1)),
    });

    render(
      <MemoryRouter>
        <ReleasesSection />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { level: 3, name: "Post 1" })).toBeInTheDocument();

    const pagination = screen.getByRole("navigation");
    expect(within(pagination).getByRole("link", { name: "7" })).toBeInTheDocument();

    fireEvent.click(within(pagination).getByRole("link", { name: "4" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "Post 31" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { level: 3, name: "Post 1" })).not.toBeInTheDocument();
    expect(window.requestAnimationFrame).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalled();
  });
});
