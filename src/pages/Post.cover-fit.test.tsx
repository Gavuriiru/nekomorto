import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Post from "@/pages/Post";

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
    useParams: () => ({ slug: "post-teste" }),
  };
});

vi.mock("@/components/DiscordInviteCard", () => ({
  default: () => null,
}));

vi.mock("@/components/LatestEpisodeCard", () => ({
  default: () => null,
}));

vi.mock("@/components/WorkStatusCard", () => ({
  default: () => null,
}));

vi.mock("@/components/ProjectEmbedCard", () => ({
  default: () => null,
}));

vi.mock("@/components/CommentsSection", () => ({
  default: () => null,
}));

vi.mock("@/components/lexical/LexicalViewer", () => ({
  default: () => <div data-testid="lexical-viewer" />,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const postFixture = {
  id: "post-1",
  title: "Post de Teste",
  slug: "post-teste",
  coverImageUrl: "/uploads/capa-post.jpg",
  coverAlt: "Capa de teste",
  excerpt: "Resumo",
  content: "<p>Conteudo</p>",
  contentFormat: "lexical" as const,
  author: "Admin",
  publishedAt: "2026-02-10T12:00:00.000Z",
  views: 10,
  commentsCount: 2,
};

const setupApiMock = (postOverrides: Partial<typeof postFixture> = {}) => {
  const post = {
    ...postFixture,
    ...postOverrides,
  };
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (endpoint === "/api/public/posts/post-teste" && method === "GET") {
      return mockJsonResponse(true, { post });
    }
    if (endpoint === "/api/public/posts/post-teste/view" && method === "POST") {
      return mockJsonResponse(true, { views: 11 });
    }
    if (endpoint === "/api/public/me" && method === "GET") {
      return mockJsonResponse(true, { user: null });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("Post cover fit", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("renderiza capa do post com preenchimento total e container 3:2", async () => {
    setupApiMock();

    render(
      <MemoryRouter>
        <Post />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Post de Teste" });
    const coverImage = await screen.findByRole("img", { name: "Capa de teste" });
    expect(coverImage).toHaveClass("absolute", "inset-0", "block", "h-full", "w-full", "object-cover", "object-center");

    const coverContainer = coverImage.parentElement;
    expect(coverContainer).not.toBeNull();
    expect(coverContainer).toHaveClass("relative", "aspect-3/2", "overflow-hidden");
  });

  it("renderiza breadcrumb e CTAs contextuais para navegacao interna", async () => {
    setupApiMock({
      projectId: "project-1",
    });

    render(
      <MemoryRouter>
        <Post />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Post de Teste" });

    const homeBreadcrumbLink = screen
      .getAllByRole("link", { name: /In[ií]cio/i })
      .find((link) => link.getAttribute("href") === "/");
    expect(homeBreadcrumbLink).toBeDefined();
    expect(screen.getByRole("link", { name: "Ir para projeto" })).toHaveAttribute("href", "/projeto/project-1");
    expect(screen.getByRole("link", { name: "Explorar projetos" })).toHaveAttribute("href", "/projetos");
    expect(screen.getByRole("link", { name: /Voltar ao in/i })).toHaveAttribute("href", "/#lancamentos");
  });
});
