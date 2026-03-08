import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardProjectChapterEditor from "@/pages/DashboardProjectChapterEditor";

const { apiFetchMock, asyncStatePropsSpy, toastMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  asyncStatePropsSpy: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageContainer", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  default: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description?: string;
    actions?: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {actions}
    </div>
  ),
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/async-state", () => ({
  default: ({
    kind,
    title,
    description,
    action,
    loading,
  }: {
    kind?: "loading" | "empty" | "error";
    title?: string;
    description?: string;
    action?: ReactNode;
    loading?: boolean;
  }) => {
    asyncStatePropsSpy({ kind, title, description, loading });
    return (
      <div>
        {kind ? <div>{kind}</div> : null}
        {title ? <div>{title}</div> : null}
        {description ? <div>{description}</div> : null}
        {loading ? <div>loading</div> : null}
        {action}
      </div>
    );
  },
}));

vi.mock("@/components/lexical/LexicalEditor", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const MockEditor = React.forwardRef(
    (
      props: {
        value?: string;
        onChange?: (nextValue: string) => void;
        className?: string;
      },
      ref: React.ForwardedRef<{ blur: () => void; focus: () => void }>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        blur: () => undefined,
        focus: () => undefined,
      }));
      return (
        <textarea
          data-testid="mock-lexical"
          aria-label="Conteúdo"
          className={props.className}
          value={props.value || ""}
          onChange={(event) => props.onChange?.(event.target.value)}
        />
      );
    },
  );
  MockEditor.displayName = "MockLexicalEditor";
  return { default: MockEditor };
});

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

vi.mock("@/pages/NotFound", () => ({
  default: () => <div data-testid="not-found" />,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const baseProject = {
  id: "project-ln-1",
  revision: "rev-1",
  title: "Projeto Light Novel",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "Sinopse",
  description: "Sinopse",
  type: "Light Novel",
  status: "Em andamento",
  year: "2026",
  studio: "Studio Teste",
  episodes: "2 capítulos",
  tags: [],
  genres: [],
  cover: "",
  banner: "",
  season: "",
  schedule: "",
  rating: "",
  country: "",
  source: "",
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
  heroImageAlt: "",
  volumeEntries: [],
  volumeCovers: [],
  views: 0,
  commentsCount: 0,
  order: 0,
  episodeDownloads: [
    {
      number: 1,
      volume: 2,
      title: "Capítulo 1",
      synopsis: "Resumo do capítulo",
      releaseDate: "2026-03-01",
      duration: "",
      sourceType: "TV",
      sources: [],
      progressStage: "aguardando-raw",
      completedStages: [],
      content: "<p>Conteúdo</p>",
      contentFormat: "lexical",
      publicationStatus: "published",
      coverImageUrl: "",
      coverImageAlt: "",
    },
    {
      number: 2,
      volume: 2,
      title: "Capítulo 2",
      synopsis: "",
      releaseDate: "",
      duration: "",
      sourceType: "TV",
      sources: [],
      progressStage: "aguardando-raw",
      completedStages: [],
      content: "",
      contentFormat: "lexical",
      publicationStatus: "draft",
      coverImageUrl: "",
      coverImageAlt: "",
    },
  ],
};

const buildProject = (overrides: Partial<typeof baseProject> = {}) => ({
  ...baseProject,
  ...overrides,
  episodeDownloads: Array.isArray(overrides.episodeDownloads)
    ? overrides.episodeDownloads
    : [...baseProject.episodeDownloads],
});

const LocationProbe = () => {
  const location = useLocation();
  return (
    <>
      <div data-testid="location-pathname">{location.pathname}</div>
      <div data-testid="location-search">{location.search}</div>
    </>
  );
};

const renderEditor = (initialEntry = "/dashboard/projetos/project-ln-1/capitulos/1?volume=2") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/dashboard/projetos/:projectId/capitulos/:chapterNumber"
          element={
            <>
              <DashboardProjectChapterEditor />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const setupApiMock = ({
  permissions = ["projetos"],
  project = buildProject(),
  projectStatus = 200,
}: {
  permissions?: string[];
  project?: ReturnType<typeof buildProject>;
  projectStatus?: number;
} = {}) => {
  apiFetchMock.mockReset();
  asyncStatePropsSpy.mockReset();
  toastMock.mockReset();
  apiFetchMock.mockImplementation(
    async (
      _base: string,
      path: string,
      options?: RequestInit & { json?: Record<string, unknown> },
    ) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
          permissions,
        });
      }

      if (path === "/api/projects/project-ln-1" && method === "GET") {
        if (projectStatus >= 400) {
          return mockJsonResponse(false, { error: "load_failed" }, projectStatus);
        }
        return mockJsonResponse(true, { project });
      }

      if (path === "/api/projects/project-ln-1/chapters/1?volume=2" && method === "PUT") {
        const payload = options?.json || {};
        const nextChapter = {
          ...project.episodeDownloads[0],
          ...((payload.chapter as Record<string, unknown> | undefined) || {}),
        };
        const nextProject = {
          ...project,
          revision: "rev-2",
          episodeDownloads: [nextChapter, ...project.episodeDownloads.slice(1)],
        };
        return mockJsonResponse(true, {
          project: nextProject,
          chapter: nextChapter,
        });
      }

      return mockJsonResponse(false, { error: "not_found" }, 404);
    },
  );
};

describe("DashboardProjectChapterEditor", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    asyncStatePropsSpy.mockReset();
    toastMock.mockReset();
  });

  it("envia kind=loading para AsyncState enquanto a tela inicializa", () => {
    apiFetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    renderEditor();

    expect(screen.getByText("Carregando editor de capítulo")).toBeInTheDocument();
    expect(asyncStatePropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "loading",
        title: "Carregando editor de capítulo",
      }),
    );
  });

  it("carrega o editor dedicado com /api/me em payload direto", async () => {
    setupApiMock();

    renderEditor();

    await screen.findByRole("heading", { name: "Editor dedicado de capítulo" });
    expect(screen.getAllByText("Projeto Light Novel").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Salvar capítulo/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar ao projeto/i })).toHaveAttribute(
      "href",
      "/dashboard/projetos?edit=project-ln-1",
    );
    expect(screen.getByRole("link", { name: /Abrir leitura/i })).toHaveAttribute(
      "href",
      "/projeto/project-ln-1/leitura/1?volume=2",
    );
  });

  it("renderiza o shell refinado sem moldura externa e com metadados antes do lexical", async () => {
    setupApiMock();

    renderEditor();

    await screen.findByRole("heading", { name: /Editor dedicado de cap/i });

    expect(document.querySelector(".project-editor-dialog")).toBeNull();
    expect(screen.getByTestId("chapter-editor-header-shell")).toHaveClass("rounded-[28px]");
    expect(screen.getByTestId("chapter-editor-sticky-top")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-editor-status-bar")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-editor-upper-layout")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-editor-main-column")).toHaveClass("2xl:max-w-6xl");
    const sidebar = screen.getByTestId("chapter-editor-sidebar");
    const navigationSection = screen.getByTestId("chapter-navigation-section");
    const metadataAccordion = screen.getByTestId("chapter-metadata-accordion");

    expect(navigationSection).toBeInTheDocument();
    expect(screen.getByTestId("chapter-navigation-volume-accordion")).toBeInTheDocument();
    expect(sidebar).toHaveClass("2xl:col-start-2");
    expect(sidebar).not.toHaveClass("2xl:sticky", "2xl:top-28");
    expect(sidebar).toContainElement(metadataAccordion);
    expect(Array.from(sidebar.children)[0]).toContainElement(navigationSection);
    expect(Array.from(sidebar.children)[1]).toBe(metadataAccordion);
    expect(screen.getByTestId("chapter-content-section")).toHaveClass("order-3", "2xl:col-start-1");
    expect(metadataAccordion).not.toHaveClass(
      "2xl:col-start-2",
      "2xl:row-start-2",
      "2xl:w-[340px]",
      "2xl:shrink-0",
    );
    expect(screen.getAllByText(/Identidade do cap/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Release e visibilidade do cap/i)).toBeInTheDocument();
    expect(screen.getByText(/Capa do cap/i)).toBeInTheDocument();
    expect(screen.getByText("Fontes de download")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-lexical-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("mock-lexical")).toHaveClass(
      "lexical-playground--stretch",
      "lexical-playground--chapter-editor",
      "w-full",
    );
  });

  it("agrupa a navegação por volume e abre o volume ativo por padrão", async () => {
    setupApiMock({
      project: buildProject({
        episodeDownloads: [
          {
            ...baseProject.episodeDownloads[0],
            number: 1,
            volume: 1,
            title: "Capítulo do volume 1",
          },
          {
            ...baseProject.episodeDownloads[0],
            number: 1,
            volume: 2,
            title: "Capítulo do volume 2",
          },
          {
            ...baseProject.episodeDownloads[1],
            number: 7,
            volume: undefined,
            title: "Capítulo sem volume",
          },
        ],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=2");

    await screen.findByRole("heading", { name: /Editor dedicado de cap/i });

    expect(screen.getByText("Sem volume")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-navigation-volume-1")).toHaveAttribute(
      "data-state",
      "closed",
    );
    expect(screen.getByTestId("chapter-navigation-volume-2")).toHaveAttribute("data-state", "open");
    expect(screen.getByTestId("chapter-navigation-volume-none")).toHaveAttribute(
      "data-state",
      "closed",
    );
    expect(screen.getByText("Capítulo do volume 2")).toBeInTheDocument();
    expect(screen.queryByText("Capítulo do volume 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Capítulo sem volume")).not.toBeInTheDocument();
  });

  it("envia kind=error para o estado de falha de carga", async () => {
    setupApiMock({ projectStatus: 500 });

    renderEditor();

    await screen.findByText("Tentar novamente");
    expect(asyncStatePropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "error",
        description: "Tente novamente em alguns instantes.",
      }),
    );
  });

  it("salva pelo endpoint de capítulo e atualiza a URL quando número ou volume mudam", async () => {
    setupApiMock();

    renderEditor();

    await screen.findByRole("heading", { name: "Editor dedicado de capítulo" });

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Capítulo 3" },
    });
    fireEvent.change(screen.getByLabelText("Número"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Volume"), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Salvar capítulo/i }));

    await waitFor(() => {
      const chapterSaveCall = apiFetchMock.mock.calls.find((call) => {
        const path = call[1];
        const options = (call[2] || {}) as RequestInit;
        return (
          path === "/api/projects/project-ln-1/chapters/1?volume=2" && options.method === "PUT"
        );
      });
      expect(chapterSaveCall).toBeDefined();
    });

    const chapterSaveCall = apiFetchMock.mock.calls.find((call) => {
      const path = call[1];
      const options = (call[2] || {}) as RequestInit;
      return path === "/api/projects/project-ln-1/chapters/1?volume=2" && options.method === "PUT";
    });
    const payload = ((chapterSaveCall?.[2] || {}) as { json?: Record<string, unknown> }).json || {};
    expect(payload.ifRevision).toBe("rev-1");
    expect(payload.chapter).toMatchObject({
      title: "Capítulo 3",
      number: 3,
      volume: 5,
    });
    expect(
      apiFetchMock.mock.calls.some((call) => {
        const path = call[1];
        const options = (call[2] || {}) as RequestInit;
        return path === "/api/projects/project-ln-1" && options.method === "PUT";
      }),
    ).toBe(false);

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=5");
  });

  it("bloqueia o acesso sem permissão de projetos", async () => {
    setupApiMock({ permissions: ["posts"] });

    renderEditor();

    await screen.findByText("Acesso negado");
    expect(
      screen.queryByRole("heading", { name: "Editor dedicado de capítulo" }),
    ).not.toBeInTheDocument();
  });

  it("envia kind=error quando o capítulo exige volume na URL", async () => {
    setupApiMock({
      project: buildProject({
        episodeDownloads: [
          {
            ...baseProject.episodeDownloads[0],
            number: 1,
            volume: 1,
            title: "Capítulo 1 - Volume 1",
          },
          {
            ...baseProject.episodeDownloads[0],
            number: 1,
            volume: 2,
            title: "Capítulo 1 - Volume 2",
          },
        ],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1");

    await screen.findByText("Volume obrigatório");
    expect(asyncStatePropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "error",
        title: "Volume obrigatório",
      }),
    );
  });
});
