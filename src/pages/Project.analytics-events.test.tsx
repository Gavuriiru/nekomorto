import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectPage from "@/pages/Project";

const apiFetchMock = vi.hoisted(() => vi.fn());
const useSiteSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => useSiteSettingsMock(),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
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

describe("Project analytics events", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    useSiteSettingsMock.mockReset();

    useSiteSettingsMock.mockReturnValue({
      settings: {
        site: { defaultShareImage: "" },
        downloads: {
          sources: [
            {
              id: "drive",
              label: "Google Drive",
              color: "#34A853",
              icon: "google-drive",
              tintIcon: true,
            },
          ],
        },
      },
    });
  });

  it("envia evento download_click ao clicar em fonte de download", async () => {
    const project = {
      id: "projeto-teste",
      title: "Projeto Teste",
      synopsis: "Sinopse",
      description: "Descricao",
      type: "Anime",
      status: "Em andamento",
      year: "2025",
      studio: "Studio Teste",
      episodes: "12 episodios",
      tags: [],
      genres: [],
      cover: "/placeholder.svg",
      banner: "/placeholder.svg",
      season: "Temporada 1",
      schedule: "Sabado",
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
      views: 1,
      commentsCount: 0,
      episodeDownloads: [
        {
          number: 1,
          title: "Episódio 1",
          synopsis: "Sinopse do episódio",
          releaseDate: "2025-01-01",
          duration: "24 min",
          sourceType: "TV",
          sources: [
            {
              label: "Google Drive",
              url: "https://example.com/source-1",
            },
          ],
        },
      ],
    };

    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
      if (endpoint === "/api/public/projects/projeto-teste" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, { project });
      }
      if (endpoint === "/api/public/projects" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, { projects: [project] });
      }
      if (endpoint === "/api/public/tag-translations" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      if (endpoint === "/api/public/me" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, { user: null });
      }
      if (endpoint === "/api/public/projects/projeto-teste/view" && options?.method === "POST") {
        return mockJsonResponse(true, { views: 2 });
      }
      if (endpoint === "/api/public/analytics/event" && options?.method === "POST") {
        return mockJsonResponse(true, { ok: true });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter>
        <ProjectPage />
      </MemoryRouter>,
    );

    const sourceLink = await screen.findByRole("link", { name: "Google Drive" });
    fireEvent.click(sourceLink);

    await waitFor(() => {
      const analyticsCall = apiFetchMock.mock.calls.find((call) => call[1] === "/api/public/analytics/event");
      expect(analyticsCall).toBeDefined();
      const requestOptions = (analyticsCall?.[2] || {}) as RequestInit;
      expect(String(requestOptions.method || "").toUpperCase()).toBe("POST");
      const payload = JSON.parse(String(requestOptions.body || "{}"));
      expect(payload.eventType).toBe("download_click");
      expect(payload.resourceType).toBe("chapter");
      expect(payload.meta?.projectId).toBe("projeto-teste");
      expect(payload.meta?.sourceLabel).toBe("Google Drive");
      expect(payload.meta?.chapterNumber).toBe(1);
    });
  });
});
