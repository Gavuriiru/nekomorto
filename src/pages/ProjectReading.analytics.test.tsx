import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProjectReading from "@/pages/ProjectReading";

const apiFetchMock = vi.hoisted(() => vi.fn());
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

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

vi.mock("@/components/Header", () => ({
  default: ({ variant = "fixed" }: { variant?: "fixed" | "static" }) => (
    <div data-testid="public-header" data-variant={variant} />
  ),
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

const mockRectsByTestId = (
  rects: Record<
    string,
    {
      top: number;
      bottom: number;
      left?: number;
      right?: number;
      width?: number;
      height?: number;
    }
  >,
) =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const testId = this.getAttribute("data-testid");
    const rect = testId ? rects[testId] : undefined;
    if (!rect) {
      return {
        x: 0,
        y: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    }

    const left = rect.left ?? 0;
    const right = rect.right ?? left + (rect.width ?? 0);
    const width = rect.width ?? Math.max(right - left, 0);
    const height = rect.height ?? Math.max(rect.bottom - rect.top, 0);

    return {
      x: left,
      y: rect.top,
      top: rect.top,
      bottom: rect.bottom,
      left,
      right,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect;
  });

const ProjectReadingLocationProbe = () => {
  const location = useLocation();
  const navigationType = useNavigationType();

  return (
    <>
      <div data-testid="project-reading-location-search">{location.search}</div>
      <div data-testid="project-reading-location-hash">{location.hash}</div>
      <div data-testid="project-reading-location-action">{navigationType}</div>
    </>
  );
};

const createProjectFixture = (episodeDownloads?: Array<Record<string, unknown>>) => ({
  id: "projeto-teste",
  title: "Projeto Teste",
  synopsis: "Sinopse",
  type: "Light Novel",
  cover: "/uploads/project-cover.jpg",
  volumeEntries: [],
  volumeCovers: [],
  episodeDownloads: episodeDownloads || [
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
    readerConfig?: Record<string, unknown> | null;
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
              content: typeof entry.content === "string" ? entry.content : "",
              contentFormat:
                String(entry.contentFormat || "")
                  .trim()
                  .toLowerCase() === "images"
                  ? "images"
                  : "lexical",
              pages: Array.isArray(entry.pages) ? entry.pages : [],
              pageCount: Number.isFinite(Number(entry.pageCount))
                ? Number(entry.pageCount)
                : undefined,
              hasPages: Boolean((entry as { hasPages?: boolean }).hasPages),
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
                String((entry as { entryKind?: string }).entryKind || "")
                  .trim()
                  .toLowerCase() === "extra"
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
        readerConfig:
          (project as { readerConfig?: Record<string, unknown> }).readerConfig || undefined,
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
  apiFetchMock.mockImplementation(
    async (_apiBase: string, endpoint: string, requestOptions?: RequestInit) => {
      if (
        endpoint === "/api/public/projects/projeto-teste" &&
        (!requestOptions?.method || requestOptions.method === "GET")
      ) {
        return mockJsonResponse(true, { project });
      }
      if (
        endpoint === chapterEndpoint &&
        (!requestOptions?.method || requestOptions.method === "GET")
      ) {
        return mockJsonResponse(true, {
          chapter: chapterResponse,
          readerConfig: options?.readerConfig || undefined,
        });
      }
      if (endpoint === "/api/public/analytics/event" && requestOptions?.method === "POST") {
        return mockJsonResponse(true, { ok: true });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    },
  );
};

describe("ProjectReading analytics", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    apiFetchMock.mockReset();
    window.localStorage.clear();
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 640,
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

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("envia evento chapter_view ao carregar capitulo", async () => {
    setupProjectReadingApiMock();

    const { container } = render(
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

    const { container } = render(
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

  it("remove o hero antigo e mantem a barra informativa na primeira dobra", async () => {
    setupProjectReadingApiMock();

    const { container } = render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });

    expect(screen.queryByRole("navigation", { name: /breadcrumb/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Leitura de Light Novel/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Volume 1/i)).not.toBeInTheDocument();

    const infoBar = screen.getByTestId("project-reading-info-bar");
    expect(infoBar).toBeInTheDocument();
    expect(within(infoBar).getByRole("link", { name: "Projeto Teste" })).toHaveAttribute(
      "href",
      "/projeto/projeto-teste",
    );
    expect(within(infoBar).getByText("Resumo do capitulo")).toBeInTheDocument();
    expect(within(infoBar).getByText("Light Novel")).toBeInTheDocument();
    const chapterContext = within(infoBar).getByTestId("project-reading-chapter-context");
    expect(chapterContext).toHaveTextContent(/Cap.*tulo 1/i);
    expect(within(infoBar).getByTestId("project-reading-meta-row")).not.toHaveTextContent(
      /Cap.*tulo 1/i,
    );
    expect(within(infoBar).getByText(/Volume 2/i)).toBeInTheDocument();
    expect(chapterContext).not.toHaveClass("bg-secondary");
    expect(within(infoBar).getByTestId("project-reading-project-title")).toHaveClass(
      "text-primary",
      "text-sm",
      "md:text-base",
    );
    expect(screen.queryByRole("link", { name: "Voltar ao projeto" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("project-reading-hero")).not.toBeInTheDocument();
    expect(screen.queryByTestId("project-reading-chapter-nav")).not.toBeInTheDocument();
    expect(document.querySelector(".project-reading-reader-shell")).not.toBeNull();
    expect(container.firstElementChild).not.toHaveClass("pt-20", "md:pt-24");
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

    await screen.findByTestId("project-reading-info-bar");
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

  it("mantem a acao de retorno no hero e deixa os controles do reader no menu em-stage", async () => {
    const project = {
      ...createProjectFixture([
        {
          number: 1,
          volume: 2,
          title: "Capitulo 1",
          synopsis: "Resumo do capitulo",
          hasPages: true,
        },
        {
          number: 2,
          volume: 2,
          title: "Capitulo 2",
          synopsis: "Resumo do capitulo 2",
          hasPages: true,
        },
      ]),
      type: "Manga",
    };

    setupProjectReadingApiMock(undefined, null, {
      project,
      readerConfig: {
        layout: "scroll-vertical",
        imageFit: "both",
      },
      chapterResponse: {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        synopsis: "Resumo do capitulo",
        contentFormat: "images",
        pages: [{ position: 0, imageUrl: "/uploads/projects/projeto-teste/page-1.jpg" }],
        pageCount: 1,
        hasPages: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByTestId("project-reading-stage");
    const firstFold = screen.getByTestId("project-reading-first-fold");
    const imageLayout = screen.getByTestId("project-reading-images-layout");
    const publicHeader = screen.getByTestId("public-header");
    const readerShell = screen.getByTestId("project-reading-full-bleed-shell");
    const readerBar = screen.getByTestId("project-reading-reader-bar");
    const infoBar = screen.getByTestId("project-reading-info-bar");
    const contextRow = within(infoBar).getByTestId("project-reading-context-row");
    const projectTitle = within(infoBar).getByTestId("project-reading-project-title");
    const chapterContext = within(infoBar).getByTestId("project-reading-chapter-context");
    const synopsis = within(infoBar).getByTestId("project-reading-synopsis");
    const metaRow = within(infoBar).getByTestId("project-reading-meta-row");
    const actions = within(infoBar).getByTestId("project-reading-actions");
    const heading = within(readerBar).getByRole("heading", { name: /Cap.*tulo 1/i });
    const commentsHandoff = screen.getByTestId("project-reading-comments-handoff");
    const commentsSentinel = screen.getByTestId("project-reading-comments-sentinel");

    expect(firstFold).toHaveClass("project-reading-first-fold", "min-h-screen");
    expect(imageLayout).toHaveClass("flex", "min-h-0", "flex-1", "flex-col");
    expect(imageLayout).not.toHaveClass("pb-16");
    expect(imageLayout).not.toHaveClass("mx-auto");
    expect(imageLayout.style.maxWidth).toBe("");
    expect(publicHeader).toHaveAttribute("data-variant", "static");
    expect(readerShell).toHaveClass("w-full");
    expect(readerShell).toHaveClass("gap-2", "md:gap-3");
    expect(readerBar).not.toHaveClass("mx-auto");
    expect(readerBar).toHaveClass("gap-3", "py-2", "md:py-3");
    expect(readerBar.style.maxWidth).toBe("");
    expect(infoBar).toHaveAttribute("data-variant", "reader-full-bleed");
    expect(projectTitle).toHaveAttribute("href", "/projeto/projeto-teste");
    expect(projectTitle).toHaveClass("text-primary", "text-sm", "md:text-base");
    expect(chapterContext).toHaveTextContent(/Cap.*tulo 1/i);
    expect(within(contextRow).queryByText(/^manga$/i)).not.toBeInTheDocument();
    expect(within(actions).getByRole("link", { name: /Voltar ao projeto/i })).toHaveAttribute(
      "href",
      "/projeto/projeto-teste",
    );
    expect(within(actions).queryByRole("link", { name: /Editar cap.tulo/i })).not.toBeInTheDocument();
    expect(synopsis).toHaveTextContent("Resumo do capitulo");
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-2xl", "md:text-3xl");
    expect(
      contextRow.compareDocumentPosition(projectTitle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      synopsis.compareDocumentPosition(metaRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(metaRow).not.toHaveTextContent(/Cap.*tulo 1/i);
    expect(commentsHandoff.style.minHeight).toBe("5rem");
    expect(
      publicHeader.compareDocumentPosition(infoBar) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      infoBar.compareDocumentPosition(screen.getByTestId("project-reading-stage")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(firstFold.contains(imageLayout)).toBe(true);
    expect(firstFold.contains(commentsHandoff)).toBe(false);
    expect(
      firstFold.compareDocumentPosition(commentsHandoff) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      commentsHandoff.compareDocumentPosition(commentsSentinel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await waitFor(() => {
      expect(readerShell.style.minHeight).toMatch(/px$/);
    });

    expect(screen.queryByTestId("project-reading-chapter-nav")).not.toBeInTheDocument();
    expect(screen.queryByTestId("project-reader-sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("project-reading-stage").contains(screen.getByTestId("project-reader-menu-button"))).toBe(true);
    expect(infoBar.contains(screen.getByTestId("project-reader-menu-button"))).toBe(false);

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));
    expect(await screen.findByText("Leitor")).toBeInTheDocument();
    expect(screen.getByTestId("project-reader-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("project-reading-stage").contains(screen.getByTestId("project-reader-sidebar"))).toBe(true);
    expect(screen.getByRole("combobox", { name: /Selecionar cap.tulo/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Selecionar p.gina/i })).toBeInTheDocument();
    expect(
      within(screen.getByTestId("project-reader-sidebar")).queryByRole("link", {
        name: /Voltar ao projeto/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("project-reader-sidebar")).queryByRole("link", {
        name: /Editar cap.tulo/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("mostra Editar extra no hero do leitor de imagens", async () => {
    const project = {
      ...createProjectFixture([
        {
          number: 1,
          volume: 2,
          title: "Extra 1",
          synopsis: "Resumo do extra",
          hasPages: true,
          entryKind: "extra",
          displayLabel: "Extra 1",
        },
      ]),
      type: "Manga",
    };

    setupProjectReadingApiMock(undefined, ["projetos"], {
      project,
      readerConfig: {
        layout: "single",
        imageFit: "both",
      },
      chapterResponse: {
        number: 1,
        volume: 2,
        title: "Extra 1",
        synopsis: "Resumo do extra",
        contentFormat: "images",
        pages: [{ position: 0, imageUrl: "/uploads/projects/projeto-teste/extra-1.jpg" }],
        pageCount: 1,
        hasPages: true,
        entryKind: "extra",
        displayLabel: "Extra 1",
      },
    });

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    const actions = within(await screen.findByTestId("project-reading-info-bar")).getByTestId(
      "project-reading-actions",
    );
    expect(within(actions).getByRole("link", { name: /Editar extra/i })).toHaveAttribute(
      "href",
      "/dashboard/projetos/projeto-teste/capitulos/1?volume=2",
    );
  });

  it("usa hasContent e hasPages do payload publico enxuto na navegacao", async () => {
    const project = {
      ...createProjectFixture([
        {
          number: 1,
          volume: 2,
          title: "Capitulo 1",
          synopsis: "Resumo do capitulo",
          hasContent: true,
        },
        {
          number: 2,
          volume: 2,
          title: "Capitulo 2",
          synopsis: "Capitulo por imagens",
          hasPages: true,
        },
      ]),
      type: "Manga",
    };

    setupProjectReadingApiMock(undefined, null, {
      project,
      chapterResponse: {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        synopsis: "Resumo do capitulo",
        contentFormat: "images",
        pages: [{ position: 0, imageUrl: "/uploads/projects/projeto-teste/page-1.jpg" }],
        pageCount: 1,
        hasPages: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByTestId("project-reading-stage");
    fireEvent.click(screen.getByTestId("project-reader-menu-button"));

    const chapterTrigger = screen.getByRole("combobox", { name: /Selecionar cap.tulo/i });
    fireEvent.click(chapterTrigger);

    expect(await screen.findByRole("option", { name: /Cap.*tulo 2/i })).toBeInTheDocument();
  });

  it("entra no palco ao abrir um capitulo por imagens sem hash na URL", async () => {
    const rectSpy = mockRectsByTestId({
      "project-reading-stage": { top: 280, bottom: 920, width: 1200, height: 640 },
      "reader-page-0": { top: 280, bottom: 920, width: 1200, height: 640 },
    });
    const project = {
      ...createProjectFixture([
        {
          number: 1,
          volume: 2,
          title: "Capitulo 1",
          synopsis: "Resumo do capitulo",
          hasPages: true,
        },
      ]),
      type: "Manga",
    };

    setupProjectReadingApiMock(undefined, null, {
      project,
      chapterResponse: {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        synopsis: "Resumo do capitulo",
        contentFormat: "images",
        pages: [{ position: 0, imageUrl: "/uploads/projects/projeto-teste/page-1.jpg" }],
        pageCount: 1,
        hasPages: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByTestId("project-reading-stage");

    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 280, behavior: "auto" });
    });

    rectSpy.mockRestore();
  });

  it("sincroniza ?page=1 na rota publica de leitura quando a URL nao traz pagina", async () => {
    const project = {
      ...createProjectFixture([
        {
          number: 1,
          volume: 2,
          title: "Capitulo 1",
          synopsis: "Resumo do capitulo",
          hasPages: true,
        },
      ]),
      type: "Manga",
    };

    setupProjectReadingApiMock(undefined, null, {
      project,
      chapterResponse: {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        synopsis: "Resumo do capitulo",
        contentFormat: "images",
        pages: [{ position: 0, imageUrl: "/uploads/projects/projeto-teste/page-1.jpg" }],
        pageCount: 1,
        hasPages: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
        <ProjectReadingLocationProbe />
      </MemoryRouter>,
    );

    await screen.findByTestId("project-reading-stage");

    await waitFor(() => {
      expect(screen.getByTestId("project-reading-location-search")).toHaveTextContent(
        "?volume=2&page=1",
      );
      expect(screen.getByTestId("project-reading-location-action")).toHaveTextContent("REPLACE");
    });
  });

  it("respeita ?page existente ao entrar na rota publica de leitura", async () => {
    const project = {
      ...createProjectFixture([
        {
          number: 1,
          volume: 2,
          title: "Capitulo 1",
          synopsis: "Resumo do capitulo",
          hasPages: true,
        },
        {
          number: 2,
          volume: 2,
          title: "Capitulo 2",
          synopsis: "Resumo do capitulo 2",
          hasPages: true,
        },
      ]),
      type: "Manga",
    };

    setupProjectReadingApiMock(undefined, null, {
      project,
      chapterResponse: {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        synopsis: "Resumo do capitulo",
        contentFormat: "images",
        pages: [
          { position: 0, imageUrl: "/uploads/projects/projeto-teste/page-1.jpg" },
          { position: 1, imageUrl: "/uploads/projects/projeto-teste/page-2.jpg" },
        ],
        pageCount: 2,
        hasPages: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2&page=2"]}>
        <ProjectReading />
        <ProjectReadingLocationProbe />
      </MemoryRouter>,
    );

    await screen.findByTestId("project-reading-stage");

    await waitFor(() => {
      expect(screen.getByTestId("project-reading-location-search")).toHaveTextContent(
        "?volume=2&page=2",
      );
    });
    expect(screen.getByTestId("project-reading-location-action")).toHaveTextContent("POP");
  });

  it("preserva o fluxo de hash de comentario e nao forca retorno ao palco", async () => {
    const rectSpy = mockRectsByTestId({
      "project-reading-stage": { top: 280, bottom: 920, width: 1200, height: 640 },
      "reader-page-0": { top: 280, bottom: 920, width: 1200, height: 640 },
    });
    const project = {
      ...createProjectFixture([
        {
          number: 1,
          volume: 2,
          title: "Capitulo 1",
          synopsis: "Resumo do capitulo",
          hasPages: true,
        },
      ]),
      type: "Manga",
    };

    setupProjectReadingApiMock(undefined, null, {
      project,
      chapterResponse: {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        synopsis: "Resumo do capitulo",
        contentFormat: "images",
        pages: [{ position: 0, imageUrl: "/uploads/projects/projeto-teste/page-1.jpg" }],
        pageCount: 1,
        hasPages: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2#comment-42"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByTestId("project-reading-stage");
    expect(window.scrollTo).not.toHaveBeenCalled();

    rectSpy.mockRestore();
  });

  it("preserva o hash de comentario enquanto sincroniza ?page na rota publica", async () => {
    const project = {
      ...createProjectFixture([
        {
          number: 1,
          volume: 2,
          title: "Capitulo 1",
          synopsis: "Resumo do capitulo",
          hasPages: true,
        },
      ]),
      type: "Manga",
    };

    setupProjectReadingApiMock(undefined, null, {
      project,
      chapterResponse: {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        synopsis: "Resumo do capitulo",
        contentFormat: "images",
        pages: [{ position: 0, imageUrl: "/uploads/projects/projeto-teste/page-1.jpg" }],
        pageCount: 1,
        hasPages: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2#comment-42"]}>
        <ProjectReading />
        <ProjectReadingLocationProbe />
      </MemoryRouter>,
    );

    await screen.findByTestId("project-reading-stage");

    await waitFor(() => {
      expect(screen.getByTestId("project-reading-location-search")).toHaveTextContent(
        "?volume=2&page=1",
      );
      expect(screen.getByTestId("project-reading-location-hash")).toHaveTextContent("#comment-42");
      expect(screen.getByTestId("project-reading-location-action")).toHaveTextContent("REPLACE");
    });
  });

  it("aplica offset quando o header do manga reader usa o modo fixo do site", async () => {
    window.localStorage.setItem(
      "public.reader.preferences",
      JSON.stringify({
        reader: {
          projectTypes: {
            manga: {
              siteHeaderVariant: "fixed",
            },
          },
        },
      }),
    );

    const project = {
      ...createProjectFixture([
        {
          number: 1,
          volume: 2,
          title: "Capitulo 1",
          synopsis: "Resumo do capitulo",
          hasPages: true,
        },
      ]),
      type: "Manga",
    };

    setupProjectReadingApiMock(undefined, null, {
      project,
      chapterResponse: {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        synopsis: "Resumo do capitulo",
        contentFormat: "images",
        pages: [{ position: 0, imageUrl: "/uploads/projects/projeto-teste/page-1.jpg" }],
        pageCount: 1,
        hasPages: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    const publicHeader = await screen.findByTestId("public-header");
    expect(publicHeader).toHaveAttribute("data-variant", "fixed");
    expect(screen.getByTestId("project-reading-site-header-offset")).toHaveClass("h-20", "md:h-24");
    expect(screen.getByTestId("project-reading-info-bar")).toHaveAttribute(
      "data-variant",
      "reader-full-bleed",
    );
  });

  it("keeps vertical image reader chapters in natural document flow so deferred comments stay after the stack", async () => {
    const project = {
      ...createProjectFixture([
        {
          number: 1,
          volume: 2,
          title: "Capitulo 1",
          synopsis: "Resumo do capitulo",
          hasPages: true,
        },
      ]),
      type: "Webtoon",
    };

    setupProjectReadingApiMock(undefined, null, {
      project,
      chapterResponse: {
        number: 1,
        volume: 2,
        title: "Capitulo 1",
        synopsis: "Resumo do capitulo",
        contentFormat: "images",
        pages: [{ position: 0, imageUrl: "/uploads/projects/projeto-teste/page-1.jpg" }],
        pageCount: 1,
        hasPages: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    const imageLayout = await screen.findByTestId("project-reading-images-layout");
    const readerShell = screen.getByTestId("project-reading-full-bleed-shell");
    const stage = screen.getByTestId("project-reading-stage");
    const commentsHandoff = screen.getByTestId("project-reading-comments-handoff");
    const commentsSentinel = screen.getByTestId("project-reading-comments-sentinel");

    expect(imageLayout).toHaveClass("flex", "flex-col", "min-h-screen");
    expect(imageLayout).not.toHaveClass("flex-1", "min-h-0");
    expect(commentsHandoff.style.minHeight).toBe("5rem");
    expect(
      imageLayout.compareDocumentPosition(commentsHandoff) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      commentsHandoff.compareDocumentPosition(commentsSentinel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await waitFor(() => {
      expect(readerShell.style.minHeight).toMatch(/px$/);
      expect(readerShell.style.height).toBe("");
      expect(stage.style.minHeight).toMatch(/px$/);
      expect(stage.style.height).toBe("");
    });
  });

  it("keeps lexical chapters without the image-reader comments handoff spacer", async () => {
    setupProjectReadingApiMock();

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByTestId("lexical-viewer");

    expect(screen.queryByTestId("project-reading-comments-handoff")).not.toBeInTheDocument();
    expect(screen.getByTestId("project-reading-comments-sentinel")).toBeInTheDocument();
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
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
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
      },
    );

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
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
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
      },
    );

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });
    expect(screen.getByText("Sinopse principal do projeto")).toBeInTheDocument();
  });

  it("remove a capa do leitor mesmo quando o capitulo possui imagem propria", async () => {
    const project = createProjectFixture();
    project.volumeCovers = [
      {
        volume: 2,
        coverImageUrl: "/uploads/volume-2-cover.jpg",
        coverImageAlt: "Capa do volume 2",
      },
    ];

    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
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
      },
    );

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });
    expect(screen.queryByRole("img", { name: "Capa do capitulo 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Capa do volume 2" })).not.toBeInTheDocument();
  });

  it("nao renderiza a capa do volume na barra do leitor", async () => {
    const project = createProjectFixture();
    project.volumeCovers = [
      {
        volume: 2,
        coverImageUrl: "/uploads/volume-2-cover.jpg",
        coverImageAlt: "Capa do volume 2",
      },
    ];

    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
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
      },
    );

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Cap.*tulo 1/i });
    expect(screen.queryByRole("img", { name: "Capa do volume 2" })).not.toBeInTheDocument();
  });
});
