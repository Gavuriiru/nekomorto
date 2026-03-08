import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

vi.mock("@/lib/frontend-build", () => ({
  getFrontendBuildMetadata: () => ({ commitSha: "frontendsha", builtAt: "2026-03-08T00:00:00Z" }),
  formatBuildMetadataLabel: () => "build-label",
}));

vi.mock("@/lib/dev-diagnostics", () => ({
  logOriginApiBaseMismatchOnce: () => undefined,
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

const mockBinaryResponse = (ok = true) =>
  ({
    ok,
    status: ok ? 200 : 500,
    headers: {
      get: (name: string) =>
        name === "Content-Disposition" ? 'attachment; filename="projeto.epub"' : null,
    },
    blob: async () => new Blob(["epub"]),
    json: async () => ({}),
  }) as unknown as Response;

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
      content: "{\"root\":{\"children\":[],\"direction\":null,\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}}",
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
          path="/dashboard/projetos/:projectId/capitulos"
          element={
            <>
              <DashboardProjectChapterEditor />
              <LocationProbe />
            </>
          }
        />
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
  contractOk = true,
  epubImportResponse,
  epubExportResponse,
}: {
  permissions?: string[];
  project?: ReturnType<typeof buildProject>;
  projectStatus?: number;
  contractOk?: boolean;
  epubImportResponse?: Response;
  epubExportResponse?: Response;
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

      if (path === "/api/contracts/v1.json" && method === "GET") {
        if (!contractOk) {
          return mockJsonResponse(false, { error: "unavailable" }, 500);
        }
        return mockJsonResponse(true, {
          version: "v1",
          generatedAt: "2026-03-08T00:00:00Z",
          capabilities: {
            project_epub_import: true,
            project_epub_export: true,
          },
          build: {
            commitSha: "backendsha",
            builtAt: "2026-03-08T00:00:00Z",
          },
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
        return mockJsonResponse(true, {
          project: {
            ...project,
            revision: "rev-2",
            episodeDownloads: [nextChapter, ...project.episodeDownloads.slice(1)],
          },
          chapter: nextChapter,
        });
      }

      if (path === "/api/projects/project-ln-1" && method === "PUT") {
        const payload = options?.json || {};
        return mockJsonResponse(true, {
          project: {
            ...project,
            ...payload,
            revision: "rev-3",
          },
        });
      }

      if (path === "/api/projects/epub/import" && method === "POST") {
        return (
          epubImportResponse ||
          mockJsonResponse(true, {
            chapters: [
              {
                ...project.episodeDownloads[1],
                number: 3,
                title: "Capítulo importado",
                content: "{\"root\":{\"children\":[],\"direction\":null,\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}}",
                publicationStatus: "draft",
              },
            ],
            volumeCovers: [],
            summary: { chapters: 1 },
          })
        );
      }

      if (path === "/api/projects/epub/export" && method === "POST") {
        return epubExportResponse || mockBinaryResponse(true);
      }

      if (path === "/api/projects/epub/import/cleanup" && method === "POST") {
        return mockJsonResponse(true, { ok: true });
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
    vi.stubGlobal("open", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
    window.URL.createObjectURL = vi.fn(() => "blob:epub");
    window.URL.revokeObjectURL = vi.fn();
  });

  it("envia kind=loading para AsyncState enquanto a tela inicializa", () => {
    apiFetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    renderEditor();
    expect(screen.getByText("Carregando editor de capítulo")).toBeInTheDocument();
  });

  it("renderiza a rota neutra sem lexical nem metadados de capítulo", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-neutral-state");
    const mainColumn = screen.getByTestId("chapter-editor-main-column");
    const sidebar = screen.getByTestId("chapter-editor-sidebar");
    const navigationSection = screen.getByTestId("chapter-navigation-section");
    const epubTools = screen.getByTestId("chapter-epub-tools");
    const epubTrigger = within(epubTools).getByRole("button", { name: /Ferramentas EPUB/i });
    expect(mainColumn).toContainElement(screen.getByTestId("chapter-neutral-state"));
    expect(mainColumn).toContainElement(epubTools);
    expect(sidebar).toContainElement(navigationSection);
    expect(sidebar).not.toContainElement(epubTools);
    expect(navigationSection).toHaveAttribute("data-state", "open");
    expect(epubTrigger).toHaveClass("hover:no-underline", "py-3.5", "md:py-4");
    expect(within(epubTools).getByText("Ferramentas EPUB")).toBeInTheDocument();
    expect(within(epubTools).getByText("Importação e exportação por volume")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("chapter-neutral-state")).queryByRole("button", {
        name: "Importar EPUB",
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-lexical")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-metadata-accordion")).not.toBeInTheDocument();
  });

  it("renderiza o editor aberto com layout expandido e sidebar alinhada", async () => {
    setupApiMock();
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    const lexicalEditor = await screen.findByTestId("mock-lexical");
    const sidebar = screen.getByTestId("chapter-editor-sidebar");
    const metadataAccordion = screen.getByTestId("chapter-metadata-accordion");
    const navigationSection = screen.getByTestId("chapter-navigation-section");
    const navigationAccordion = navigationSection.parentElement;
    const navigationTrigger = within(screen.getByTestId("chapter-navigation-section")).getByRole(
      "button",
      { name: /Navegação/i },
    );
    expect(screen.getByTestId("chapter-editor-upper-layout")).not.toHaveClass("px-4");
    expect(screen.getByTestId("chapter-editor-upper-layout")).not.toHaveClass("md:px-6");
    expect(screen.getByTestId("chapter-editor-upper-layout")).not.toHaveClass("lg:px-8");
    expect(screen.getByTestId("chapter-editor-main-column")).not.toHaveClass("2xl:max-w-6xl");
    expect(screen.getByTestId("chapter-editor-sidebar")).toHaveClass("2xl:col-start-2");
    expect(sidebar).toContainElement(metadataAccordion);
    expect(sidebar).toContainElement(navigationSection);
    expect(navigationAccordion).not.toBeNull();
    expect(Array.from(sidebar.children)[0]).toBe(metadataAccordion);
    expect(Array.from(sidebar.children)[1]).toBe(navigationAccordion);
    expect(screen.queryByTestId("chapter-epub-tools")).not.toBeInTheDocument();
    expect(screen.queryByText(/Autosave do capítulo/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar capítulo/i })).toBeInTheDocument();
    expect(navigationTrigger).toHaveClass("hover:no-underline", "py-3.5", "md:py-4");
    expect(screen.getByText("Navegação")).toBeInTheDocument();
    expect(screen.getByText("Busca, filtros e troca rápida de capítulo")).toBeInTheDocument();
    expect(screen.getByText("Identidade do capítulo")).toBeInTheDocument();
    expect(screen.getByText("Título, numeração, tipo e resumo")).toBeInTheDocument();
    expect(lexicalEditor).toHaveClass(
      "lexical-playground--stretch",
      "lexical-playground--chapter-editor",
      "w-full",
    );
  });

  it("navega da rota neutra para um capítulo ao clicar na sidebar", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-navigation-section");
    fireEvent.click(screen.getByRole("button", { name: /Capítulo 1/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/1",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=2");
  });

  it("salva o capítulo e atualiza a URL quando número e volume mudam", async () => {
    setupApiMock();
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Capítulo 3" } });
    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar capítulo/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=5");
  });

  it("salva pelo atalho Ctrl+S usando o fluxo manual", async () => {
    setupApiMock();
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Capítulo revisado" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(
          ([, path, options]) =>
            path === "/api/projects/project-ln-1/chapters/1?volume=2" && options?.method === "PUT",
        ),
      ).toBe(true);
    });
  });

  it("confirma antes de sair quando há alterações não salvas", async () => {
    setupApiMock();
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    const confirmMock = vi.mocked(window.confirm);
    confirmMock.mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Capítulo pendente" } });
    fireEvent.click(screen.getByRole("button", { name: /Fechar capítulo/i }));
    expect(confirmMock).toHaveBeenCalled();
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos/1",
    );
    fireEvent.click(screen.getByRole("button", { name: /Fechar capítulo/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos",
      );
    });
  });

  it("importa EPUB, persiste o projeto e navega para o primeiro capítulo importado", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-neutral-state");
    const fileInput = document.getElementById("chapter-editor-epub-import-file") as HTMLInputElement;
    const file = new File(["epub"], "novo.epub", { type: "application/epub+zip" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(
      within(screen.getByTestId("chapter-epub-tools")).getByRole("button", {
        name: "Importar EPUB",
      }),
    );
    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(
          ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
        ),
      ).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
    });
  });

  it("exporta EPUB no estado neutro usando o snapshot atual da página", async () => {
    const anchorClick = vi.fn();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(anchorClick);

    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-neutral-state");
    fireEvent.click(
      within(screen.getByTestId("chapter-epub-tools")).getByRole("button", {
        name: /Exportar volume em EPUB/i,
      }),
    );
    await waitFor(() => {
      const exportCall = apiFetchMock.mock.calls.find(
        ([, path, options]) => path === "/api/projects/epub/export" && options?.method === "POST",
      );
      expect(exportCall).toBeDefined();
      const body = JSON.parse(String(exportCall?.[2]?.body || "{}"));
      expect(body.project.episodeDownloads[0].content).toBe(baseProject.episodeDownloads[0].content);
    });
    expect(anchorClick).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("mostra estado de capability desconhecido quando o contrato da API falha", async () => {
    setupApiMock({ contractOk: false });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-neutral-state");
    expect(screen.getByText(/Não foi possível confirmar o suporte EPUB/i)).toBeInTheDocument();
  });

  it("bloqueia o acesso sem permissão de projetos", async () => {
    setupApiMock({ permissions: ["posts"] });
    renderEditor();
    await screen.findByText("Acesso negado");
  });

  it("envia kind=error quando o capítulo exige volume na URL", async () => {
    setupApiMock({
      project: buildProject({
        episodeDownloads: [
          { ...baseProject.episodeDownloads[0], number: 1, volume: 1, title: "Capítulo 1 V1" },
          { ...baseProject.episodeDownloads[0], number: 1, volume: 2, title: "Capítulo 1 V2" },
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
