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
  default: () => <div data-testid="discord-invite-card" />,
}));

vi.mock("@/components/LatestEpisodeCard", () => ({
  default: () => <div data-testid="latest-episode-card" />,
}));

vi.mock("@/components/WorkStatusCard", () => ({
  default: () => <div data-testid="work-status-card" />,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const createProjectFixture = (episodeDownloads?: Array<Record<string, unknown>>) => ({
  id: "projeto-teste",
  title: "Projeto Teste",
  synopsis: "Sinopse",
  type: "Light Novel",
  cover: "/uploads/project-cover.jpg",
  volumeCovers: [],
  episodeDownloads:
    episodeDownloads ||
    [
      {
        number: 1,
        volume: 2,
        title: "CapÃ­tulo 1",
        synopsis: "Resumo do capÃ­tulo",
        content: "<p>ConteÃºdo</p>",
      },
    ],
});

const setupProjectReadingApiMock = (episodeDownloads?: Array<Record<string, unknown>>) => {
  const project = createProjectFixture(episodeDownloads);

  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    if (endpoint === "/api/public/projects/projeto-teste" && (!options?.method || options.method === "GET")) {
      return mockJsonResponse(true, { project });
    }
    if (endpoint === "/api/public/projects/projeto-teste/chapters/1?volume=2" && (!options?.method || options.method === "GET")) {
      return mockJsonResponse(true, {
        chapter: {
          number: 1,
          volume: 2,
          title: "CapÃ­tulo 1",
          synopsis: "Resumo do capÃ­tulo",
          content: "<p>ConteÃºdo</p>",
          contentFormat: "lexical",
        },
      });
    }
    if (endpoint === "/api/public/analytics/event" && options?.method === "POST") {
      return mockJsonResponse(true, { ok: true });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("ProjectReading analytics", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    window.localStorage.clear();
  });

  it("envia evento chapter_view ao carregar capitulo", async () => {
    setupProjectReadingApiMock();

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });

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

  it("nao renderiza controles do leitor e nao depende de storage local", async () => {
    setupProjectReadingApiMock();
    window.localStorage.setItem("reading.any-value", "1");

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });
    await screen.findByTestId("lexical-viewer");

    expect(screen.queryByText("Fonte")).not.toBeInTheDocument();
    expect(screen.queryByText("Contraste")).not.toBeInTheDocument();
    expect(screen.queryByText("Largura")).not.toBeInTheDocument();
    expect(screen.queryByText("Tamanho")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Restaurar padr.o/i })).not.toBeInTheDocument();
  });

  it("remove breadcrumb e CTAs de projeto, mantendo o capitulo visivel", async () => {
    setupProjectReadingApiMock();

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });

    expect(screen.queryByRole("navigation", { name: /breadcrumb/i })).not.toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: "Voltar ao projeto" });
    expect(backLink).toHaveAttribute("href", "/projeto/projeto-teste");
    expect(screen.queryByRole("link", { name: "Ir para projetos" })).not.toBeInTheDocument();
    expect(screen.queryByText("CapÃ­tulos publicados diretamente no site.")).not.toBeInTheDocument();
    expect(screen.queryByTestId("discord-invite-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("latest-episode-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("work-status-card")).not.toBeInTheDocument();

    expect(screen.getByTestId("project-reading-hero")).toBeInTheDocument();
    const contentSection = document.querySelector("main > section + section");
    expect(contentSection).not.toBeNull();
    expect(contentSection).toHaveClass("mt-8");
  });

  it("ignora capitulos sem leitura na navegacao publica", async () => {
    setupProjectReadingApiMock([
      {
        number: 1,
        volume: 2,
        title: "CapÃ­tulo 1",
        synopsis: "Resumo do capÃ­tulo",
        content: "<p>ConteÃºdo</p>",
        hasContent: true,
      },
      {
        number: 2,
        volume: 2,
        title: "CapÃ­tulo 2",
        synopsis: "So download",
        hasContent: false,
        sources: [{ label: "Drive", url: "https://example.com/file" }],
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });

    expect(screen.queryByRole("link", { name: /Pr.ximo cap.tulo/i })).not.toBeInTheDocument();
  });

  it("usa a capa do volume no hero quando existir", async () => {
    const project = createProjectFixture();
    project.volumeCovers = [
      {
        volume: 2,
        coverImageUrl: "/uploads/volume-2-cover.jpg",
        coverImageAlt: "Capa do volume 2",
      },
    ];

    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
      if (endpoint === "/api/public/projects/projeto-teste" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, { project });
      }
      if (endpoint === "/api/public/projects/projeto-teste/chapters/1?volume=2" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, {
          chapter: {
            number: 1,
            volume: 2,
            title: "CapÃƒÂ­tulo 1",
            synopsis: "Resumo do capÃƒÂ­tulo",
            content: "<p>ConteÃƒÂºdo</p>",
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

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });
    expect(screen.getByRole("img", { name: "Capa do volume 2" })).toBeInTheDocument();
  });
});
