import { describe, expect, it, vi } from "vitest";

import { registerProjectCatalogRoutes } from "../../server/routes/project/register-project-catalog-routes.js";

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

describe("registerProjectCatalogRoutes", () => {
  it("retorna variantes de midia no detalhe administrativo do projeto", () => {
    const routeState = {
      detailHandler: null as
        | ((req: Record<string, unknown>, res: ReturnType<typeof createResponse>) => unknown)
        | null,
    };
    const app = {
      get: vi.fn((path: string, _middleware: unknown, handler: typeof routeState.detailHandler) => {
        if (path === "/api/projects/:id") {
          routeState.detailHandler = handler;
        }
      }),
    };
    const project = {
      id: "86864",
      title: "Gabriel Dropout",
      episodeDownloads: [
        {
          number: 99,
          pages: [{ imageUrl: "/uploads/projects/86864/capitulos/99/01.jpeg" }],
        },
      ],
    };
    const mediaVariants = {
      "/uploads/projects/86864/capitulos/99/01.jpeg": {
        variantsVersion: 1,
        variants: {
          posterThumb: {
            formats: {
              fallback: { url: "/uploads/_variants/page-1/posterThumb-v1.jpeg" },
            },
          },
        },
      },
    };
    const buildPublicMediaVariants = vi.fn(() => mediaVariants);

    registerProjectCatalogRoutes({
      app,
      buildPublicMediaVariants,
      canManageProjects: vi.fn(() => true),
      createRevisionToken: vi.fn(() => "revision-token"),
      getActiveProjectTypes: vi.fn(() => []),
      loadProjects: vi.fn(() => [project]),
      normalizeProjects: vi.fn((projects) => projects),
      requireAuth: vi.fn(),
    });

    expect(routeState.detailHandler).toBeTypeOf("function");
    if (!routeState.detailHandler) {
      throw new Error("Expected project detail handler");
    }

    const response = createResponse();
    routeState.detailHandler(
      {
        session: { user: { id: "owner-1" } },
        params: { id: "86864" },
      },
      response,
    );

    expect(buildPublicMediaVariants).toHaveBeenCalledWith(project);
    expect(response.body).toEqual({
      project: {
        ...project,
        revision: "revision-token",
      },
      mediaVariants,
    });
  });
});
