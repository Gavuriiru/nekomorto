import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectPage from "@/pages/Project";

const apiFetchMock = vi.hoisted(() => vi.fn());
const usePageMetaMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      site: {
        defaultShareImage: "/uploads/default-og.jpg",
        defaultShareImageAlt: "Imagem padrão",
      },
      downloads: {
        sources: [],
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
    useParams: () => ({ slug: "projeto-teste" }),
  };
});

vi.mock("@/components/CommentsSection", () => ({
  default: () => null,
}));

vi.mock("@/components/ThemedSvgLogo", () => ({
  default: () => null,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const hasMetaCall = (matcher: (arg: Record<string, unknown>) => boolean) =>
  usePageMetaMock.mock.calls.some(([arg]) => matcher(arg as Record<string, unknown>));

describe("Project SEO image meta", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    usePageMetaMock.mockReset();
  });

  it("falls back to the default share image before project data loads and switches to the OG route after load", async () => {
    let resolveProjectRequest = (_value: Response) => undefined;
    const projectRequest = new Promise<Response>((resolve) => {
      resolveProjectRequest = resolve;
    });

    const project = {
      id: "projeto-teste",
      title: "Projeto Teste",
      synopsis: "Sinopse",
      description: "Descrição",
      type: "Anime",
      status: "Em andamento",
      year: "2026",
      studio: "Studio Teste",
      episodes: "12 episódios",
      tags: [],
      genres: [],
      cover: "/uploads/capa.jpg",
      banner: "/uploads/banner.jpg",
      season: "Temporada 1",
      schedule: "Sábado",
      rating: "14",
      country: "JP",
      source: "Original",
      producers: [],
      score: null,
      startDate: "",
      endDate: "",
      relations: [],
      staff: [],
      animeStaff: [],
      trailerUrl: "",
      forceHero: false,
      heroImageUrl: "",
      views: 0,
      commentsCount: 0,
      episodeDownloads: [],
    };
    const projectRevision = "og-revision-123";

    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
        const method = String(options?.method || "GET").toUpperCase();
        if (endpoint === "/api/public/projects/projeto-teste" && method === "GET") {
          return projectRequest;
        }
        if (endpoint === "/api/public/projects" && method === "GET") {
          return mockJsonResponse(true, { projects: [project] });
        }
        if (endpoint === "/api/public/tag-translations" && method === "GET") {
          return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
        }
        if (endpoint === "/api/public/me" && method === "GET") {
          return mockJsonResponse(true, { user: null });
        }
        if (endpoint === "/api/public/projects/projeto-teste/view" && method === "POST") {
          return mockJsonResponse(true, { views: 1 });
        }
        return mockJsonResponse(false, { error: "not_found" }, 404);
      },
    );

    render(
      <MemoryRouter>
        <ProjectPage />
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

    resolveProjectRequest(mockJsonResponse(true, { project, revision: projectRevision }));

    await waitFor(() => {
      expect(
        hasMetaCall(
          (arg) =>
            String(arg.image || "").includes(
              `/api/og/project/projeto-teste?v=${projectRevision}`,
            ) &&
            arg.imageAlt === "Card de compartilhamento do projeto Projeto Teste" &&
            arg.type === "article",
        ),
      ).toBe(true);
    });
  });
});
