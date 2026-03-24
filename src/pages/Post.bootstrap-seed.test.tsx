import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const originalIntersectionObserver = window.IntersectionObserver;

describe("Post bootstrap-first", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
        const method = String(options?.method || "GET").toUpperCase();
        if (endpoint === "/api/public/posts/post-teste/view" && method === "POST") {
          return mockJsonResponse(true, { views: 11 });
        }
        if (endpoint === "/api/public/posts/post-teste" && method === "GET") {
          return await new Promise<Response>(() => undefined);
        }
        return mockJsonResponse(false, { error: "not_found" }, 404);
      },
    );

    (
      window as Window & {
        __BOOTSTRAP_PUBLIC__?: unknown;
        __BOOTSTRAP_PUBLIC_ME__?: unknown;
      }
    ).__BOOTSTRAP_PUBLIC__ = {
      settings: {},
      pages: {},
      projects: [],
      posts: [
        {
          id: "post-1",
          slug: "post-teste",
          title: "Post Bootstrap",
          excerpt: "Resumo inicial",
          author: "Admin",
          publishedAt: "2026-02-10T12:00:00.000Z",
          coverImageUrl: "/uploads/post-cover.jpg",
          coverAlt: "Capa inicial",
          projectId: "project-1",
          tags: [],
        },
      ],
      updates: [],
      teamMembers: [
        {
          id: "user-1",
          name: "Admin",
          phrase: "Frase",
          bio: "Bio",
          avatarUrl: "/uploads/users/admin.png",
          socials: [],
          favoriteWorks: { manga: [], anime: [] },
          roles: ["Membro"],
          status: "active",
        },
      ],
      teamLinkTypes: [{ id: "site", label: "Site", icon: "globe" }],
      mediaVariants: {},
      tagTranslations: { tags: {}, genres: {}, staffRoles: {} },
      generatedAt: "2026-03-10T00:00:00.000Z",
      payloadMode: "full",
    };
    (
      window as Window & {
        __BOOTSTRAP_PUBLIC__?: unknown;
        __BOOTSTRAP_PUBLIC_ME__?: unknown;
      }
    ).__BOOTSTRAP_PUBLIC_ME__ = {
      id: "user-1",
      name: "Admin",
      username: "admin",
      permissions: ["posts"],
    };

    class MockIntersectionObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }

    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
    });
  });

  it("renderiza hero a partir do bootstrap antes do fetch completo e nao dispara chamadas redundantes", async () => {
    render(
      <MemoryRouter>
        <Post />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Post Bootstrap" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar postagem" })).toHaveAttribute(
      "href",
      "/dashboard/posts?edit=post-1",
    );

    const calledEndpoints = apiFetchMock.mock.calls.map((call) => String(call[1] || ""));
    expect(calledEndpoints).toContain("/api/public/posts/post-teste");
    expect(calledEndpoints).toContain("/api/public/posts/post-teste/view");
    expect(calledEndpoints).not.toContain("/api/public/me");
    expect(calledEndpoints).not.toContain("/api/public/users");
    expect(calledEndpoints).not.toContain("/api/link-types");
    expect(screen.queryByTestId("project-embed-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comments-section")).not.toBeInTheDocument();
  });

  it("corrige o estado de permissao quando o bootstrap inicial vem anonimo", async () => {
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
        const method = String(options?.method || "GET").toUpperCase();
        if (endpoint === "/api/public/posts/post-teste/view" && method === "POST") {
          return mockJsonResponse(true, { views: 11 });
        }
        if (endpoint === "/api/public/posts/post-teste" && method === "GET") {
          return await new Promise<Response>(() => undefined);
        }
        if (endpoint === "/api/public/me" && method === "GET") {
          return mockJsonResponse(true, {
            user: {
              id: "user-1",
              name: "Admin",
              username: "admin",
              permissions: ["posts"],
            },
          });
        }
        return mockJsonResponse(false, { error: "not_found" }, 404);
      },
    );

    (
      window as Window & {
        __BOOTSTRAP_PUBLIC__?: unknown;
        __BOOTSTRAP_PUBLIC_ME__?: unknown;
      }
    ).__BOOTSTRAP_PUBLIC_ME__ = null;

    render(
      <MemoryRouter>
        <Post />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Post Bootstrap" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Editar postagem" })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "",
        "/api/public/me",
        expect.objectContaining({ auth: true, cache: "no-store" }),
      );
    });
    expect(await screen.findByRole("link", { name: "Editar postagem" })).toHaveAttribute(
      "href",
      "/dashboard/posts?edit=post-1",
    );
  });

  afterEach(() => {
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: originalIntersectionObserver,
    });
    delete (
      window as Window & {
        __BOOTSTRAP_PUBLIC__?: unknown;
        __BOOTSTRAP_PUBLIC_ME__?: unknown;
      }
    ).__BOOTSTRAP_PUBLIC__;
    delete (
      window as Window & {
        __BOOTSTRAP_PUBLIC__?: unknown;
        __BOOTSTRAP_PUBLIC_ME__?: unknown;
      }
    ).__BOOTSTRAP_PUBLIC_ME__;
  });
});
