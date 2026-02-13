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
  coverImageUrl: "",
  coverAlt: "",
  excerpt: "Resumo",
  content: "<p>Conteudo</p>",
  contentFormat: "lexical" as const,
  author: "Admin",
  publishedAt: "2026-02-10T12:00:00.000Z",
  views: 10,
  commentsCount: 2,
};

const setupApiMock = (permissions: string[] | null) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (endpoint === "/api/public/posts/post-teste" && method === "GET") {
      return mockJsonResponse(true, { post: postFixture });
    }
    if (endpoint === "/api/public/posts/post-teste/view" && method === "POST") {
      return mockJsonResponse(true, { views: 11 });
    }
    if (endpoint === "/api/public/me" && method === "GET") {
      return mockJsonResponse(
        true,
        permissions
          ? {
              user: {
                id: "1",
                name: "Admin",
                permissions,
              },
            }
          : { user: null },
      );
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("Post edit button", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("exibe botao de editar para usuario com permissao de posts", async () => {
    setupApiMock(["posts"]);

    render(
      <MemoryRouter>
        <Post />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Post de Teste" });
    const editLink = await screen.findByRole("link", { name: "Editar postagem" });
    expect(editLink).toHaveAttribute("href", "/dashboard/posts?edit=post-1");
  });

  it("nao exibe botao de editar quando nao ha usuario logado", async () => {
    setupApiMock(null);

    render(
      <MemoryRouter>
        <Post />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Post de Teste" });
    expect(screen.queryByRole("link", { name: "Editar postagem" })).not.toBeInTheDocument();
  });

  it("nao exibe botao de editar sem permissao de posts", async () => {
    setupApiMock(["projetos"]);

    render(
      <MemoryRouter>
        <Post />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Post de Teste" });
    expect(screen.queryByRole("link", { name: "Editar postagem" })).not.toBeInTheDocument();
  });
});
