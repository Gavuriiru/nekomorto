import { render, screen, waitFor, within } from "@testing-library/react";
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
  volumeEntries: [],
  volumeCovers: [],
  episodeDownloads:
    episodeDownloads ||
    [
      {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        synopsis: "Resumo do capitulo",
        content: "<p>Conteudo</p>",
      },
    ],
});

const setupProjectReadingApiMock = (
  episodeDownloads?: Array<Record<string, unknown>>,
  permissions: string[] | null = null,
  options?: {
    project?: ReturnType<typeof createProjectFixture>;
    chapterEndpoint?: string;
    chapterResponse?: Record<string, unknown> | null;
  },
) => {
  const project = options?.project || createProjectFixture(episodeDownloads);
  const chapterEndpoint =
    options?.chapterEndpoint || "/api/public/projects/projeto-teste/chapters/1?volume=2";
  const chapterResponse =
    options?.chapterResponse === undefined
      ? {
          number: 1,
          volume: 2,
          title: "Capitulo 1",
          synopsis: "Resumo do capitulo",
          content: "<p>Conteudo</p>",
          contentFormat: "lexical",
        }
      : options.chapterResponse;

  apiFetchMock.mockReset();
  (
    window as Window & {
      __BOOTSTRAP_PUBLIC__?: unknown;
      __BOOTSTRAP_PUBLIC_ME__?: unknown;
    }
  ).__BOOTSTRAP_PUBLIC__ = {
    settings: {},
    pages: {},
    projects: [
      {
        id: project.id,
        title: project.title,
        titleOriginal: "",
        titleEnglish: "",
        synopsis: project.synopsis,
        description: "",
        type: project.type,
        status: "",
        tags: [],
        genres: [],
        cover: project.cover,
        coverAlt: "",
        banner: "",
        bannerAlt: "",
        heroImageUrl: "",
        heroImageAlt: "",
        forceHero: false,
        trailerUrl: "",
        studio: "",
        episodes: "",
        producers: [],
        volumeEntries: project.volumeEntries || [],
        volumeCovers: project.volumeCovers || [],
        episodeDownloads: Array.isArray(project.episodeDownloads)
          ? project.episodeDownloads.map((entry) => ({
              number: Number(entry.number || 0),
              volume: Number.isFinite(Number(entry.volume)) ? Number(entry.volume) : undefined,
              title: String(entry.title || ""),
              releaseDate: String(entry.releaseDate || ""),
              duration: String(entry.duration || ""),
              coverImageUrl: String(entry.coverImageUrl || ""),
              coverImageAlt: String(entry.coverImageAlt || ""),
              sourceType: String(entry.sourceType || ""),
              sources: Array.isArray(entry.sources) ? entry.sources : [],
              progressStage: String(entry.progressStage || ""),
              completedStages: Array.isArray(entry.completedStages) ? entry.completedStages : [],
              chapterUpdatedAt: String(entry.chapterUpdatedAt || ""),
              hasContent:
                Boolean((entry as { hasContent?: boolean }).hasContent) ||
                (typeof entry.content === "string" && entry.content.trim().length > 0),
              entryKind:
                String((entry as { entryKind?: string }).entryKind || "").trim().toLowerCase() ===
                "extra"
                  ? "extra"
                  : "main",
              entrySubtype: String((entry as { entrySubtype?: string }).entrySubtype || ""),
              readingOrder: Number.isFinite(Number(entry.readingOrder))
                ? Number(entry.readingOrder)
                : undefined,
              displayLabel: String((entry as { displayLabel?: string }).displayLabel || ""),
            }))
          : [],
        views: 0,
        viewsDaily: {},
      },
    ],
    posts: [],
    updates: [],
    teamMembers: [],
    teamLinkTypes: [],
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
  ).__BOOTSTRAP_PUBLIC_ME__ = permissions
    ? {
        id: "1",
        name: "Admin",
        username: "admin",
        permissions,
      }
    : null;
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    if (
      endpoint === "/api/public/projects/projeto-teste" &&
      (!options?.method || options.method === "GET")
    ) {
      return mockJsonResponse(true, { project });
    }
    if (endpoint === chapterEndpoint && (!options?.method || options.method === "GET")) {
      return mockJsonResponse(true, {
        chapter: chapterResponse,
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

  it("envia evento chapter_view ao carregar capitulo", async () => {
    setupProjectReadingApiMock();

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });

    await waitFor(() => {
      const analyticsCall = apiFetchMock.mock.calls.find(
        (call) => call[1] === "/api/public/analytics/event",
      );
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

  it("remove ruido visual e mantem acoes principais no hero", async () => {
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
    expect(backLink.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText(/Leitura de Light Novel/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Volume 1/i)).not.toBeInTheDocument();

    const hero = screen.getByTestId("project-reading-hero");
    expect(hero).toBeInTheDocument();
    expect(within(hero).getByText("Projeto Teste")).toBeInTheDocument();
    expect(within(hero).getByText("Resumo do capitulo")).toBeInTheDocument();
    expect(within(hero).getByText("Light Novel")).toBeInTheDocument();
    const chapterBadge = within(hero).getByText(/Cap 1/i);
    expect(chapterBadge).toBeInTheDocument();
    expect(within(hero).getByText(/Vol\. 2/i)).toBeInTheDocument();
    expect(chapterBadge).not.toHaveClass("bg-secondary");
    const contentSection = document.querySelector("main > section + section");
    expect(contentSection).not.toBeNull();
    expect(contentSection).toHaveClass("mt-6");
    expect(document.querySelector(".project-reading-reader-shell")).not.toBeNull();
  });

  it("exibe CTA de editar capitulo para staff com permissao de projetos", async () => {
    setupProjectReadingApiMock(undefined, ["projetos"]);

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });
    const editLink = await screen.findByRole("link", { name: /Editar cap.tulo/i });
    expect(editLink).toHaveAttribute(
      "href",
      "/dashboard/projetos/projeto-teste/capitulos/1?volume=2",
    );
    expect(editLink.querySelector("svg")).not.toBeNull();
  });

  it("mantem o CTA de editar capitulo canonico em capitulo ambiguo quando a resposta publica omite o volume", async () => {
    setupProjectReadingApiMock(
      [
        {
          number: 1,
          volume: 2,
          title: "Capitulo 1 - Volume 2",
          synopsis: "Resumo do capitulo",
          content: "<p>Conteudo</p>",
        },
        {
          number: 1,
          volume: 3,
          title: "Capitulo 1 - Volume 3",
          synopsis: "Resumo do capitulo 3",
          content: "<p>Conteudo 3</p>",
        },
      ],
      ["projetos"],
      {
        chapterResponse: {
          number: 1,
          title: "Capitulo 1 - Publico",
          synopsis: "Resumo do capitulo",
          content: "<p>Conteudo</p>",
          contentFormat: "lexical",
        },
      },
    );

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });
    const editLink = await screen.findByRole("link", { name: /Editar cap.tulo/i });
    expect(editLink).toHaveAttribute(
      "href",
      "/dashboard/projetos/projeto-teste/capitulos/1?volume=2",
    );
  });

  it("mantem o CTA de editar capitulo com ?volume=0 quando esse é o desambiguador canônico", async () => {
    setupProjectReadingApiMock(
      [
        {
          number: 1,
          volume: 0,
          title: "Capitulo 1 - Volume 0",
          synopsis: "Resumo do capitulo",
          content: "<p>Conteudo</p>",
        },
        {
          number: 1,
          volume: 2,
          title: "Capitulo 1 - Volume 2",
          synopsis: "Resumo do capitulo 2",
          content: "<p>Conteudo 2</p>",
        },
      ],
      ["projetos"],
      {
        chapterEndpoint: "/api/public/projects/projeto-teste/chapters/1?volume=0",
        chapterResponse: {
          number: 1,
          title: "Capitulo 1 - Publico",
          synopsis: "Resumo do capitulo",
          content: "<p>Conteudo</p>",
          contentFormat: "lexical",
        },
      },
    );

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=0"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });
    const editLink = await screen.findByRole("link", { name: /Editar cap.tulo/i });
    expect(editLink).toHaveAttribute(
      "href",
      "/dashboard/projetos/projeto-teste/capitulos/1?volume=0",
    );
  });

  it("nao renderiza o CTA de editar capitulo quando a resolucao canonica continua ambigua", async () => {
    setupProjectReadingApiMock(
      [
        {
          number: 1,
          title: "Capitulo 1 - Sem volume",
          synopsis: "Resumo do capitulo",
          content: "<p>Conteudo</p>",
        },
        {
          number: 1,
          volume: 3,
          title: "Capitulo 1 - Volume 3",
          synopsis: "Resumo do capitulo 3",
          content: "<p>Conteudo 3</p>",
        },
      ],
      ["projetos"],
      {
        chapterEndpoint: "/api/public/projects/projeto-teste/chapters/1",
        chapterResponse: {
          number: 1,
          title: "Capitulo 1 - Publico",
          synopsis: "Resumo do capitulo",
          content: "<p>Conteudo</p>",
          contentFormat: "lexical",
        },
      },
    );

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByTestId("project-reading-hero");
    expect(screen.queryByRole("link", { name: /Editar cap.tulo/i })).not.toBeInTheDocument();
  });

  it("nao exibe CTA de editar capitulo sem permissao", async () => {
    setupProjectReadingApiMock(undefined, ["posts"]);

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });
    expect(screen.queryByRole("link", { name: /Editar cap.tulo/i })).not.toBeInTheDocument();
  });

  it("move navegacao anterior/proximo para bloco pos-conteudo", async () => {
    setupProjectReadingApiMock([
      {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        synopsis: "Resumo do capitulo",
        content: "<p>Conteudo</p>",
        hasContent: true,
      },
      {
        number: 2,
        volume: 2,
        title: "Capitulo 2",
        synopsis: "Resumo do capitulo 2",
        content: "<p>Conteudo 2</p>",
        hasContent: true,
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });
    const hero = screen.getByTestId("project-reading-hero");
    expect(within(hero).queryByRole("link", { name: /Pr.ximo cap.tulo/i })).not.toBeInTheDocument();

    const chapterNav = screen.getByTestId("project-reading-chapter-nav");
    const nextLink = within(chapterNav).getByRole("link", { name: /Pr.ximo cap.tulo/i });
    expect(nextLink).toBeInTheDocument();
    expect(nextLink.querySelector("svg")).not.toBeNull();
  });

  it("ignora capitulos sem leitura na navegacao publica", async () => {
    setupProjectReadingApiMock([
      {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        synopsis: "Resumo do capitulo",
        content: "<p>Conteudo</p>",
        hasContent: true,
      },
      {
        number: 2,
        volume: 2,
        title: "Capitulo 2",
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

  it("usa sinopse do volume quando a sinopse do capitulo estiver vazia", async () => {
    const project = createProjectFixture([
      {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        content: "<p>Conteudo</p>",
        hasContent: true,
      },
    ]);
    project.volumeEntries = [
      {
        volume: 2,
        synopsis: "Sinopse do volume 2",
        coverImageUrl: "",
        coverImageAlt: "",
      },
    ];

    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
      if (
        endpoint === "/api/public/projects/projeto-teste" &&
        (!options?.method || options.method === "GET")
      ) {
        return mockJsonResponse(true, { project });
      }
      if (
        endpoint === "/api/public/projects/projeto-teste/chapters/1?volume=2" &&
        (!options?.method || options.method === "GET")
      ) {
        return mockJsonResponse(true, {
          chapter: {
            number: 1,
            volume: 2,
            title: "Capitulo 1",
            synopsis: "",
            content: "<p>Conteudo</p>",
            contentFormat: "lexical",
          },
        });
      }
      if (endpoint === "/api/public/me" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, { user: null });
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
    expect(screen.getByText("Sinopse do volume 2")).toBeInTheDocument();
  });

  it("usa sinopse do projeto quando capitulo e volume nao tiverem sinopse", async () => {
    const project = createProjectFixture([
      {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        content: "<p>Conteudo</p>",
        hasContent: true,
      },
    ]);
    project.synopsis = "Sinopse principal do projeto";
    project.volumeEntries = [
      {
        volume: 2,
        synopsis: "",
        coverImageUrl: "",
        coverImageAlt: "",
      },
    ];

    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
      if (
        endpoint === "/api/public/projects/projeto-teste" &&
        (!options?.method || options.method === "GET")
      ) {
        return mockJsonResponse(true, { project });
      }
      if (
        endpoint === "/api/public/projects/projeto-teste/chapters/1?volume=2" &&
        (!options?.method || options.method === "GET")
      ) {
        return mockJsonResponse(true, {
          chapter: {
            number: 1,
            volume: 2,
            title: "Capitulo 1",
            synopsis: "",
            content: "<p>Conteudo</p>",
            contentFormat: "lexical",
          },
        });
      }
      if (endpoint === "/api/public/me" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, { user: null });
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
    expect(screen.getByText("Sinopse principal do projeto")).toBeInTheDocument();
  });

  it("prioriza a capa do capitulo no hero quando existir capa de capitulo e volume", async () => {
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
      if (
        endpoint === "/api/public/projects/projeto-teste" &&
        (!options?.method || options.method === "GET")
      ) {
        return mockJsonResponse(true, { project });
      }
      if (
        endpoint === "/api/public/projects/projeto-teste/chapters/1?volume=2" &&
        (!options?.method || options.method === "GET")
      ) {
        return mockJsonResponse(true, {
          chapter: {
            number: 1,
            volume: 2,
            title: "Capitulo 1",
            synopsis: "Resumo do capitulo",
            content: "<p>Conteudo</p>",
            contentFormat: "lexical",
            coverImageUrl: "/uploads/chapter-1-cover.jpg",
            coverImageAlt: "Capa do capitulo 1",
          },
        });
      }
      if (endpoint === "/api/public/me" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, { user: null });
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
    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Capa do capitulo 1" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("img", { name: "Capa do volume 2" })).not.toBeInTheDocument();
  });

  it("usa a capa do volume no hero quando nao houver capa do capitulo", async () => {
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
      if (
        endpoint === "/api/public/projects/projeto-teste" &&
        (!options?.method || options.method === "GET")
      ) {
        return mockJsonResponse(true, { project });
      }
      if (
        endpoint === "/api/public/projects/projeto-teste/chapters/1?volume=2" &&
        (!options?.method || options.method === "GET")
      ) {
        return mockJsonResponse(true, {
          chapter: {
            number: 1,
            volume: 2,
            title: "Capitulo 1",
            synopsis: "Resumo do capitulo",
            content: "<p>Conteudo</p>",
            contentFormat: "lexical",
          },
        });
      }
      if (endpoint === "/api/public/me" && (!options?.method || options.method === "GET")) {
        return mockJsonResponse(true, { user: null });
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
