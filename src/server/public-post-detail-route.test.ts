import { describe, expect, it } from "vitest";

import { registerContentPostPublicDetailRoute } from "../../server/routes/content/public-posts/register-content-post-public-detail-route.js";

const createAppCapture = () => {
  const routes = new Map<string, (...args: any[]) => unknown>();
  return {
    app: {
      get: (path: string, handler: (...args: any[]) => unknown) => {
        routes.set(`GET ${path}`, handler);
      },
    },
    getRoute: (method: string, path: string) => routes.get(`${method.toUpperCase()} ${path}`) || null,
  };
};

const createResponse = () => ({
  body: null as unknown,
  headers: new Map<string, string>(),
  statusCode: 200,
  json(payload: unknown) {
    this.body = payload;
    return this;
  },
  setHeader(name: string, value: unknown) {
    this.headers.set(String(name).toLowerCase(), String(value));
    return this;
  },
  status(code: number) {
    this.statusCode = Number(code);
    return this;
  },
});

describe("registerContentPostPublicDetailRoute", () => {
  it("retorna o detalhe publico com cache curto reutilizavel", () => {
    const { app, getRoute } = createAppCapture();
    registerContentPostPublicDetailRoute({
      app,
      buildPublicMediaVariants: () => ({ cover: [] }),
      loadPosts: () => [
        {
          id: "post-1",
          slug: "post-teste",
          title: "Post Teste",
          excerpt: "Resumo",
          content: "Conteudo completo",
          contentFormat: "lexical",
          author: "Admin",
          publishedAt: "2026-02-10T12:00:00.000Z",
          status: "published",
          deletedAt: null,
          views: 10,
          commentsCount: 2,
          seoTitle: "SEO title",
          seoDescription: "SEO description",
          coverImageUrl: "/uploads/post-cover.jpg",
          coverAlt: "Capa",
          projectId: "project-1",
          tags: [],
        },
      ],
      normalizePosts: (posts: unknown) => posts as any[],
      resolvePostCover: (post: any) => ({
        coverImageUrl: post.coverImageUrl,
        coverAlt: post.coverAlt,
      }),
    });

    const handler = getRoute("GET", "/api/public/posts/:slug");
    if (!handler) {
      throw new Error("route_not_registered");
    }

    const req = { params: { slug: "post-teste" } };
    const res = createResponse();

    handler(req, res);

    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      post: {
        id: "post-1",
        title: "Post Teste",
        slug: "post-teste",
        coverImageUrl: "/uploads/post-cover.jpg",
        coverAlt: "Capa",
        excerpt: "Resumo",
        content: "Conteudo completo",
        contentFormat: "lexical",
        author: "Admin",
        publishedAt: "2026-02-10T12:00:00.000Z",
        views: 10,
        commentsCount: 2,
        seoTitle: "SEO title",
        seoDescription: "SEO description",
        projectId: "project-1",
        tags: [],
      },
      mediaVariants: { cover: [] },
    });
  });
});
