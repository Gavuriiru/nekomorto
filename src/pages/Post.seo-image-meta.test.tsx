import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Post from "@/pages/Post";

const apiFetchMock = vi.hoisted(() => vi.fn());
const usePageMetaMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  apiFetchBestEffort: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      site: {
        defaultShareImage: "/uploads/default-og.jpg",
        defaultShareImageAlt: "Imagem padrao",
      },
    },
  }),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: (...args: unknown[]) => usePageMetaMock(...args),
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

vi.mock("@/components/TopProjectsSection", () => ({
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

const hasMetaCall = (matcher: (arg: Record<string, unknown>) => boolean) =>
  usePageMetaMock.mock.calls.some(([arg]) => matcher(arg as Record<string, unknown>));

describe("Post SEO image meta", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    usePageMetaMock.mockReset();
  });

  it("falls back to default share image before load and switches to post OG route after load", async () => {
    let resolvePostRequest: (value: Response | PromiseLike<Response>) => void = () => undefined;
    const postRequest = new Promise<Response>((resolve) => {
      resolvePostRequest = resolve;
    });

    const post = {
      id: "post-1",
      title: "Post de Teste",
      slug: "post-teste",
      coverImageUrl: "/uploads/capa.jpg",
      coverAlt: "Capa",
      seoImageUrl: "/uploads/seo.jpg",
      excerpt: "Resumo",
      content: "<p>Conteudo</p>",
      contentFormat: "lexical",
      author: "Admin",
      publishedAt: "2026-02-10T12:00:00.000Z",
      views: 10,
      commentsCount: 2,
      seoTitle: "",
      seoDescription: "",
      projectId: "",
      tags: [],
    };

    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
        const method = String(options?.method || "GET").toUpperCase();
        if (endpoint === "/api/public/posts/post-teste" && method === "GET") {
          return postRequest;
        }
        if (endpoint === "/api/public/users" && method === "GET") {
          return mockJsonResponse(true, { users: [], mediaVariants: {} });
        }
        if (endpoint === "/api/link-types" && method === "GET") {
          return mockJsonResponse(true, { items: [] });
        }
        if (endpoint === "/api/public/posts/post-teste/view" && method === "POST") {
          return mockJsonResponse(true, { views: 11 });
        }
        if (endpoint === "/api/public/me" && method === "GET") {
          return mockJsonResponse(true, { user: null });
        }
        return mockJsonResponse(false, { error: "not_found" }, 404);
      },
    );

    render(
      <MemoryRouter>
        <Post />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        hasMetaCall(
          (arg) =>
            String(arg.image || "").includes("/uploads/default-og.jpg") && arg.type === "article",
        ),
      ).toBe(true);
    });

    resolvePostRequest(mockJsonResponse(true, { post }));

    await waitFor(() => {
      expect(
        hasMetaCall(
          (arg) =>
            /\/api\/og\/post\/post-teste\?v=/.test(String(arg.image || "")) &&
            arg.imageAlt === "Card de compartilhamento da postagem Post de Teste" &&
            arg.type === "article",
        ),
      ).toBe(true);
    });
  });
});
