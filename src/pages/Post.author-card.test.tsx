import { render, screen, waitFor, within } from "@testing-library/react";
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
      teamRoles: [],
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

vi.mock("@/components/ProjectEmbedCard", () => ({
  default: () => <div data-testid="project-embed-card" />,
}));

vi.mock("@/components/CommentsSection", () => ({
  default: () => <div data-testid="comments-section" />,
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
  projectId: "project-1",
};

const authorFixture = {
  id: "user-1",
  name: "Admin",
  avatarUrl: "/uploads/users/admin.png",
  phrase: "Frase do admin",
  bio: "Bio do admin",
  roles: ["Membro"],
  socials: [{ label: "site", href: "https://admin.dev" }],
  favoriteWorks: { manga: [], anime: [] },
  status: "active",
};

const usersMediaVariants = {
  "/uploads/users/admin.png": {
    variantsVersion: 1,
    variants: {
      square: {
        formats: {
          fallback: { url: "/uploads/_variants/admin/square-v1.png" },
        },
      },
    },
  },
};

const setupApiMock = (users: unknown[]) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (endpoint === "/api/public/posts/post-teste" && method === "GET") {
      return mockJsonResponse(true, {
        post: postFixture,
        mediaVariants: {
          "/uploads/capa-post.jpg": {
            variantsVersion: 1,
            variants: {
              card: {
                formats: {
                  fallback: { url: "/uploads/_variants/post-1/card-v1.jpeg" },
                },
              },
            },
          },
        },
      });
    }
    if (endpoint === "/api/public/users" && method === "GET") {
      return mockJsonResponse(true, { users, mediaVariants: usersMediaVariants });
    }
    if (endpoint === "/api/link-types" && method === "GET") {
      return mockJsonResponse(true, {
        items: [{ id: "site", label: "Site", icon: "globe" }],
      });
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

describe("Post author card", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("renderiza o card do autor entre embed e comentarios quando encontra um unico membro", async () => {
    setupApiMock([authorFixture]);

    render(
      <MemoryRouter>
        <Post />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Post de Teste" });
    const authorCard = await screen.findByTestId("post-author-card");

    expect(within(authorCard).getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(within(authorCard).getByText('"Frase do admin"')).toBeInTheDocument();
    expect(within(authorCard).getByText("Bio do admin")).toBeInTheDocument();

    const embedCard = screen.getByTestId("project-embed-card");
    const comments = screen.getByTestId("comments-section");

    expect(embedCard.compareDocumentPosition(authorCard) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(authorCard.compareDocumentPosition(comments) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("oculta o card do autor quando nao encontra correspondencia unica", async () => {
    setupApiMock([]);

    render(
      <MemoryRouter>
        <Post />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Post de Teste" });
    await screen.findByTestId("comments-section");

    await waitFor(() => {
      expect(screen.queryByTestId("post-author-card")).not.toBeInTheDocument();
    });
  });
});
