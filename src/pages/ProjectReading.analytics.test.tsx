import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectReading from "@/pages/ProjectReading";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: "projeto-teste", chapter: "1" }),
  };
});

vi.mock("@/components/lexical/LexicalViewer", () => ({
  default: () => <div data-testid="lexical-viewer" />,
}));

vi.mock("@/components/CommentsSection", () => ({
  default: () => null,
}));

vi.mock("@/components/DiscordInviteCard", () => ({
  default: () => null,
}));

vi.mock("@/components/LatestEpisodeCard", () => ({
  default: () => null,
}));

vi.mock("@/components/WorkStatusCard", () => ({
  default: () => null,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

describe("ProjectReading analytics", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("envia evento chapter_view ao carregar capítulo", async () => {
    const project = {
      id: "projeto-teste",
      title: "Projeto Teste",
      synopsis: "Sinopse",
      type: "Light Novel",
      episodeDownloads: [
        {
          number: 1,
          volume: 2,
          title: "Capítulo 1",
          synopsis: "Resumo do capítulo",
          content: "<p>Conteúdo</p>",
        },
      ],
    };

    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
      if (endpoint === "/api/public/projects/projeto-teste" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, { project });
      }
      if (endpoint === "/api/public/projects/projeto-teste/chapters/1?volume=2" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, {
          chapter: {
            number: 1,
            volume: 2,
            title: "Capítulo 1",
            synopsis: "Resumo do capítulo",
            content: "<p>Conteúdo</p>",
            contentFormat: "lexical",
          },
        });
      }
      if (endpoint === "/api/public/analytics/event" && options?.method === "POST") {
        return mockJsonResponse(true, { ok: true });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Capítulo 1" });

    await waitFor(() => {
      const analyticsCall = apiFetchMock.mock.calls.find((call) => call[1] === "/api/public/analytics/event");
      expect(analyticsCall).toBeDefined();
      const requestOptions = (analyticsCall?.[2] || {}) as RequestInit;
      expect(String(requestOptions.method || "").toUpperCase()).toBe("POST");
      const payload = JSON.parse(String(requestOptions.body || "{}"));
      expect(payload.eventType).toBe("chapter_view");
      expect(payload.resourceType).toBe("chapter");
      expect(payload.meta?.projectId).toBe("projeto-teste");
      expect(payload.meta?.chapterNumber).toBe(1);
      expect(payload.meta?.volume).toBe(2);
    });
  });
});
