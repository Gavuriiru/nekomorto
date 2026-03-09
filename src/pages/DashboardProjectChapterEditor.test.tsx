import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardProjectChapterEditor from "@/pages/DashboardProjectChapterEditor";

const { apiFetchMock, asyncStatePropsSpy, toastMock, lexicalEditorPropsSpy } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  asyncStatePropsSpy: vi.fn(),
  toastMock: vi.fn(),
  lexicalEditorPropsSpy: vi.fn(),
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
        followCaretScroll?: boolean;
      },
      ref: React.ForwardedRef<{ blur: () => void; focus: () => void }>,
    ) => {
      lexicalEditorPropsSpy(props);
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

const createMockDomRect = (top: number): DOMRect =>
  ({
    x: 0,
    y: top,
    top,
    bottom: top + 40,
    left: 0,
    right: 320,
    width: 320,
    height: 40,
    toJSON: () => ({}),
  }) as DOMRect;

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
  volumeEntries: Array.isArray(overrides.volumeEntries)
    ? overrides.volumeEntries
    : [...baseProject.volumeEntries],
  volumeCovers: Array.isArray(overrides.volumeCovers)
    ? overrides.volumeCovers
    : [...baseProject.volumeCovers],
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
  capabilities,
  epubImportResponse,
  epubImportJobCreateResponse,
  epubImportJobStatusResponse,
  epubExportResponse,
}: {
  permissions?: string[];
  project?: ReturnType<typeof buildProject>;
  projectStatus?: number;
  contractOk?: boolean;
  capabilities?: Partial<{
    project_epub_import: boolean;
    project_epub_export: boolean;
    project_epub_import_async: boolean;
  }>;
  epubImportResponse?: Response;
  epubImportJobCreateResponse?: Response;
  epubImportJobStatusResponse?: Response | ((jobId: string) => Response);
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
            project_epub_import_async: false,
            ...capabilities,
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

      if (path === "/api/projects/epub/import/jobs" && method === "POST") {
        return (
          epubImportJobCreateResponse ||
          mockJsonResponse(true, {
            job: {
              id: "job-1",
              projectId: project.id,
              requestedBy: "user-1",
              status: "queued",
              summary: {},
              error: null,
              createdAt: "2026-03-09T00:00:00.000Z",
              startedAt: null,
              finishedAt: null,
              expiresAt: null,
              hasResult: false,
            },
          })
        );
      }

      if (path.startsWith("/api/projects/epub/import/jobs/") && method === "GET") {
        if (typeof epubImportJobStatusResponse === "function") {
          return epubImportJobStatusResponse(path.split("/").at(-1) || "");
        }
        return (
          epubImportJobStatusResponse ||
          mockJsonResponse(true, {
            job: {
              id: path.split("/").at(-1) || "job-1",
              projectId: project.id,
              requestedBy: "user-1",
              status: "completed",
              summary: { chapters: 1 },
              error: null,
              createdAt: "2026-03-09T00:00:00.000Z",
              startedAt: "2026-03-09T00:00:01.000Z",
              finishedAt: "2026-03-09T00:00:02.000Z",
              expiresAt: "2026-03-12T00:00:02.000Z",
              hasResult: true,
              result: {
                chapters: [
                  {
                    ...project.episodeDownloads[1],
                    number: 3,
                    title: "Capítulo importado",
                    content:
                      "{\"root\":{\"children\":[],\"direction\":null,\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}}",
                    publicationStatus: "draft",
                  },
                ],
                volumeCovers: [],
                summary: { chapters: 1 },
              },
            },
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
    lexicalEditorPropsSpy.mockReset();
    vi.stubGlobal("open", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("scrollBy", vi.fn());
    window.URL.createObjectURL = vi.fn(() => "blob:epub");
    window.URL.revokeObjectURL = vi.fn();
  });

  it("envia kind=loading para AsyncState enquanto a tela inicializa", () => {
    apiFetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    renderEditor();
    expect(screen.getByText("Carregando editor de capítulo")).toBeInTheDocument();
  });

  it("renderiza a rota neutra com card único de estrutura e sem volume selecionado", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-epub-tools");
    const mainColumn = screen.getByTestId("chapter-editor-main-column");
    const sidebar = screen.getByTestId("chapter-editor-sidebar");
    const structureSection = screen.getByTestId("chapter-structure-section");
    const structureAccordion = structureSection.parentElement;
    const epubTools = screen.getByTestId("chapter-epub-tools");
    const epubTrigger = within(epubTools).getByRole("button", { name: /Ferramentas EPUB/i });
    expect(structureAccordion).not.toBeNull();
    expect(Array.from(mainColumn.children)).toEqual([epubTools]);
    expect(mainColumn).toContainElement(epubTools);
    expect(sidebar).toContainElement(structureSection);
    expect(sidebar).not.toContainElement(epubTools);
    expect(Array.from(sidebar.children)[0]).toBe(structureAccordion);
    expect(structureSection).toHaveAttribute("data-state", "open");
    expect(epubTrigger).toHaveClass("hover:no-underline", "py-3.5", "md:py-4");
    expect(within(epubTools).getByText("Ferramentas EPUB")).toBeInTheDocument();
    expect(within(epubTools).getByText("Importação e exportação por volume")).toBeInTheDocument();
    expect(within(structureSection).getByText("Estrutura")).toBeInTheDocument();
    expect(
      within(structureSection).getByText("Volumes, filtros, navegação e criação de capítulos"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-none")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-header-2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-main-2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-actions-2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-toggle-2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-main-none")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-actions-none")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-toggle-none")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-select-2")).not.toHaveClass("rounded-xl", "border");
    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-neutral-state")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-content-section")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir capítulo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir volume/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-lexical")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-metadata-accordion")).not.toBeInTheDocument();
  });

  it("renderiza o editor aberto com layout expandido e sidebar alinhada", async () => {
    setupApiMock();
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    const lexicalEditor = await screen.findByTestId("mock-lexical");
    const lexicalWrapper = screen.getByTestId("chapter-lexical-wrapper");
    const sidebar = screen.getByTestId("chapter-editor-sidebar");
    const actionRail = screen.getByTestId("chapter-editor-action-rail");
    const topStatusGroup = screen.getByTestId("chapter-editor-top-status-group");
    const topActions = screen.getByTestId("chapter-editor-top-actions");
    const statusBar = screen.getByTestId("chapter-editor-status-bar");
    const structureSection = screen.getByTestId("chapter-structure-section");
    const structureAccordion = structureSection.parentElement;
    const metadataAccordion = screen.getByTestId("chapter-metadata-accordion");
    const structureTrigger = within(screen.getByTestId("chapter-structure-section")).getByRole(
      "button",
      { name: /Estrutura/i },
    );
    expect(screen.getByTestId("chapter-editor-upper-layout")).not.toHaveClass("px-4");
    expect(screen.getByTestId("chapter-editor-upper-layout")).not.toHaveClass("md:px-6");
    expect(screen.getByTestId("chapter-editor-upper-layout")).not.toHaveClass("lg:px-8");
    expect(screen.getByTestId("chapter-editor-main-column")).not.toHaveClass("2xl:max-w-6xl");
    expect(screen.getByTestId("chapter-editor-sidebar")).toHaveClass("2xl:col-start-2");
    expect(sidebar).toContainElement(metadataAccordion);
    expect(sidebar).toContainElement(structureSection);
    expect(structureAccordion).not.toBeNull();
    expect(Array.from(sidebar.children)[0]).toBe(metadataAccordion);
    expect(Array.from(sidebar.children)[1]).toBe(structureAccordion);
    expect(screen.getByTestId("chapter-structure-group-header-2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-actions-2")).toContainElement(
      screen.getByTestId("chapter-structure-add-chapter-2"),
    );
    expect(screen.queryByTestId("chapter-epub-tools")).not.toBeInTheDocument();
    expect(screen.queryByText(/Autosave do capítulo/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar capítulo/i })).toBeInTheDocument();
    expect(actionRail).toHaveClass("lg:flex-row", "lg:justify-between");
    expect(topStatusGroup).toContainElement(screen.getByText(/Sem alterações pendentes/i));
    expect(topActions).toContainElement(screen.getByRole("button", { name: /Salvar capítulo/i }));
    expect(topActions).toContainElement(screen.getByRole("button", { name: /Excluir capítulo/i }));
    expect(within(statusBar).queryByRole("button", { name: /Salvar capítulo/i })).not.toBeInTheDocument();
    expect(within(statusBar).queryByRole("button", { name: /Excluir capítulo/i })).not.toBeInTheDocument();
    expect(structureTrigger).toHaveClass("hover:no-underline", "py-3.5", "md:py-4");
    expect(screen.getByText("Estrutura")).toBeInTheDocument();
    expect(screen.getByText("Volumes, filtros, navegação e criação de capítulos")).toBeInTheDocument();
    expect(screen.getByText("Identidade do capítulo")).toBeInTheDocument();
    expect(screen.getByText("Título, numeração, tipo e resumo")).toBeInTheDocument();
    expect(lexicalEditor).toHaveClass(
      "lexical-playground--stretch",
      "lexical-playground--chapter-editor",
      "w-full",
    );
    expect(
      lexicalEditorPropsSpy.mock.calls.some(
        ([props]) =>
          Boolean(
            (props as { className?: string; followCaretScroll?: boolean }).followCaretScroll &&
              String((props as { className?: string }).className || "").includes(
                "lexical-playground--chapter-editor",
              ),
          ),
      ),
    ).toBe(true);
    expect(lexicalWrapper).toHaveClass("min-h-[420px]", "lg:min-h-[620px]");
  });

  it("alterna o grupo do volume ao clicar no volume e mantém a seleção", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    const volumeToggle = screen.getByTestId("chapter-structure-group-toggle-2");
    expect(volumeToggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    expect(volumeToggle).toHaveAttribute("aria-expanded", "false");
    expect(within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 2")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    expect(volumeToggle).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 2")).toBeInTheDocument();
  });

  it("usa o mesmo toggle ao clicar no chevron do volume", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    const volumeToggle = screen.getByTestId("chapter-structure-group-toggle-2");
    fireEvent.click(volumeToggle);
    expect(volumeToggle).toHaveAttribute("aria-expanded", "false");
    expect(within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 2")).toBeInTheDocument();

    fireEvent.click(volumeToggle);
    expect(volumeToggle).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 2")).toBeInTheDocument();
  });

  it("adiciona um volume no estado neutro e mostra o aviso sem capítulos", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");
    fireEvent.click(
      within(screen.getByTestId("chapter-structure-section")).getByRole("button", {
        name: /Adicionar volume/i,
      }),
    );
    expect(screen.getByTestId("chapter-structure-group-1")).toBeInTheDocument();
    expect(within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 1")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("chapter-volume-editor")).getByText(
        /Nenhum capítulo vinculado a este volume/i,
      ),
    ).toBeInTheDocument();
  });

  it("edita e salva volumes pelo fluxo manual do projeto", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");
    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    await screen.findByTestId("chapter-volume-editor");
    fireEvent.change(screen.getByLabelText("Sinopse do volume"), {
      target: { value: "Sinopse do volume 2" },
    });
    const saveVolumesButton = await screen.findByRole("button", { name: /Salvar volumes/i });
    expect(screen.getByTestId("chapter-editor-top-actions")).toContainElement(saveVolumesButton);
    expect(saveVolumesButton).toBeEnabled();
    fireEvent.click(saveVolumesButton);
    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(payload?.volumeEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            volume: 2,
            synopsis: "Sinopse do volume 2",
          }),
        ]),
      );
    });
  });

  it("salva volumes com Ctrl+S no estado neutro", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");
    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    await screen.findByTestId("chapter-volume-editor");
    fireEvent.change(screen.getByLabelText("Sinopse do volume"), {
      target: { value: "Volume salvo por atalho" },
    });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(
          ([, path, options]) =>
            path === "/api/projects/project-ln-1" && options?.method === "PUT",
        ),
      ).toBe(true);
    });
  });

  it("confirma antes de navegar quando há alterações não salvas em volumes", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");
    const confirmMock = vi.mocked(window.confirm);
    confirmMock.mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    await screen.findByTestId("chapter-volume-editor");
    fireEvent.change(screen.getByLabelText("Sinopse do volume"), {
      target: { value: "Volume pendente" },
    });
    fireEvent.click(screen.getByTestId("chapter-structure-group-toggle-2"));
    fireEvent.click(screen.getByRole("button", { name: /Capítulo 1/i }));
    expect(confirmMock).toHaveBeenCalled();
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos",
    );
    fireEvent.click(screen.getByRole("button", { name: /Capítulo 1/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/1",
      );
    });
  });

  it("exclui o volume e os capítulos vinculados após confirmar no modal", async () => {
    setupApiMock({
      project: buildProject({
        volumeEntries: [
          {
            volume: 2,
            synopsis: "Volume configurado",
            coverImageUrl: "",
            coverImageAlt: "",
          },
        ],
      }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");
    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    await screen.findByTestId("chapter-volume-editor");
    fireEvent.change(screen.getByLabelText("Sinopse do volume"), {
      target: { value: "Excluir este volume" },
    });
    const volumeEditor = screen.getByTestId("chapter-volume-editor");
    const destructiveFooter = within(volumeEditor).getByTestId("chapter-volume-destructive-footer");
    fireEvent.click(within(destructiveFooter).getByRole("button", { name: /Excluir volume/i }));
    expect(screen.getByRole("heading", { name: /Excluir volume\?/i })).toBeInTheDocument();
    expect(screen.getByText(/Isso também excluirá 2 capítulo\(s\) vinculado\(s\)\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/As alterações atuais da página serão aplicadas imediatamente junto com a exclusão\./i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Excluir$/i }));
    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(payload?.volumeEntries).toEqual([]);
      expect(payload?.episodeDownloads).toEqual([]);
    });
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos",
      );
    });
    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
  });

  it("mostra Fechar volume na barra inferior e limpa a seleção local", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");
    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    await screen.findByTestId("chapter-volume-editor");
    const closeVolumeButton = screen.getByTestId("chapter-close-volume-button");
    expect(within(screen.getByTestId("chapter-editor-status-bar")).getByText("Volume 2")).toBeInTheDocument();
    fireEvent.click(closeVolumeButton);
    await waitFor(() => {
      expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    });
  });

  it("respeita o guard ao fechar o volume com alterações pendentes", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");
    const confirmMock = vi.mocked(window.confirm);
    confirmMock.mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    await screen.findByTestId("chapter-volume-editor");
    fireEvent.change(screen.getByLabelText("Sinopse do volume"), {
      target: { value: "Volume pendente para fechar" },
    });
    fireEvent.click(screen.getByTestId("chapter-close-volume-button"));
    expect(confirmMock).toHaveBeenCalled();
    expect(screen.getByTestId("chapter-volume-editor")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("chapter-close-volume-button"));
    await waitFor(() => {
      expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    });
  });

  it("abre o capítulo e sincroniza o volume pai ao clicar em um capítulo na sidebar", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");
    fireEvent.click(screen.getByRole("button", { name: /Capítulo 1/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/1",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=2");
    expect(within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 2")).toBeInTheDocument();
  });

  it("seleciona um volume sem abrir capítulo e sincroniza a seleção ao abrir um capítulo", async () => {
    setupApiMock({
      project: buildProject({
        episodeDownloads: [
          ...baseProject.episodeDownloads,
          {
            ...baseProject.episodeDownloads[1],
            number: 3,
            volume: undefined,
            title: "Capítulo sem volume",
          },
        ],
      }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");
    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos",
    );
    expect(within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Alternar Sem volume/i }));
    fireEvent.click(screen.getByRole("button", { name: /Capítulo sem volume/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("");
    expect(
      within(screen.getByTestId("chapter-volume-editor")).getByText("Nenhum volume selecionado"),
    ).toBeInTheDocument();
  });

  it("leva ao neutro e preserva o volume selecionado ao trocar de volume com outro capítulo aberto", async () => {
    setupApiMock({
      project: buildProject({
        episodeDownloads: [
          ...baseProject.episodeDownloads,
          {
            ...baseProject.episodeDownloads[0],
            number: 1,
            volume: 4,
            title: "Capítulo 1 V4",
          },
          {
            ...baseProject.episodeDownloads[0],
            number: 3,
            volume: 4,
            title: "Capítulo 3 V4",
          },
        ],
      }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/2?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    fireEvent.change(screen.getByPlaceholderText("Buscar capítulo..."), {
      target: { value: "inexistente" },
    });
    fireEvent.click(screen.getByTestId("chapter-structure-select-4"));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("");
    expect(within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 4")).toBeInTheDocument();
  });

  it("leva ao neutro e preserva o volume selecionado quando o novo volume não tem capítulos", async () => {
    setupApiMock({
      project: buildProject({
        volumeEntries: [
          {
            volume: 5,
            synopsis: "",
            coverImageUrl: "",
            coverImageAlt: "",
          },
        ],
      }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    fireEvent.click(screen.getByTestId("chapter-structure-select-5"));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("");
    expect(within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 5")).toBeInTheDocument();
  });

  it("leva ao neutro mesmo quando seleciona o mesmo volume do capítulo aberto", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("");
    expect(within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 2")).toBeInTheDocument();
  });

  it("pede confirmação ao abrir somente o volume quando há alterações não salvas no capítulo", async () => {
    setupApiMock({
      project: buildProject({
        episodeDownloads: [
          ...baseProject.episodeDownloads,
          {
            ...baseProject.episodeDownloads[0],
            number: 1,
            volume: 4,
            title: "Capítulo 1 V4",
          },
        ],
      }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    const confirmMock = vi.mocked(window.confirm);
    confirmMock.mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Capítulo pendente" } });

    fireEvent.click(screen.getByTestId("chapter-structure-select-4"));
    expect(confirmMock).toHaveBeenCalled();
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos/1",
    );
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=2");

    fireEvent.click(screen.getByTestId("chapter-structure-select-4"));
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("");
    expect(within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 4")).toBeInTheDocument();
  });

  it("cria um capítulo em volume e navega para ele como rascunho", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    fireEvent.click(screen.getByTestId("chapter-structure-add-chapter-2"));

    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(payload?.episodeDownloads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            number: 3,
            volume: 2,
            publicationStatus: "draft",
            entryKind: "main",
            entrySubtype: "chapter",
          }),
        ]),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=2");
  });

  it("cria um capítulo em sem volume e limpa a busca se o filtro esconder o novo item", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    fireEvent.change(screen.getByPlaceholderText("Buscar capítulo..."), {
      target: { value: "inexistente" },
    });
    fireEvent.click(screen.getByTestId("chapter-structure-add-chapter-none"));

    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(payload?.episodeDownloads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            number: 3,
            volume: undefined,
            publicationStatus: "draft",
          }),
        ]),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("");
    expect(screen.getByPlaceholderText("Buscar capítulo...")).toHaveValue("");
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

  it("exibe e confirma a exclusão imediata do capítulo", async () => {
    setupApiMock();
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Capítulo pendente" } });
    fireEvent.click(screen.getByRole("button", { name: /Excluir capítulo/i }));
    expect(screen.getByRole("heading", { name: /Excluir capítulo\?/i })).toBeInTheDocument();
    expect(
      screen.getByText(/As alterações atuais da página serão aplicadas imediatamente junto com a exclusão\./i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Excluir$/i }));
    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(payload?.episodeDownloads).toEqual([
        expect.objectContaining({
          number: 2,
          volume: 2,
        }),
      ]);
    });
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos",
      );
    });
  });

  it("importa EPUB, persiste o projeto e navega para o primeiro capítulo importado", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-epub-tools");
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

  it("importa EPUB por job assíncrono quando a capability está disponível", async () => {
    setupApiMock({
      capabilities: {
        project_epub_import_async: true,
      },
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-epub-tools");
    const fileInput = document.getElementById("chapter-editor-epub-import-file") as HTMLInputElement;
    const file = new File(["epub"], "novo.epub", { type: "application/epub+zip" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(
      within(screen.getByTestId("chapter-epub-tools")).getByRole("button", {
        name: "Importar EPUB",
      }),
    );
    await waitFor(() => {
      expect(apiFetchMock.mock.calls.some(([, path]) => path === "/api/projects/epub/import/jobs")).toBe(
        true,
      );
      expect(
        apiFetchMock.mock.calls.some(([, path]) =>
          String(path).startsWith("/api/projects/epub/import/jobs/"),
        ),
      ).toBe(true);
      expect(
        apiFetchMock.mock.calls.some(
          ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
        ),
      ).toBe(true);
    });
    expect(
      apiFetchMock.mock.calls.some(
        ([, path, options]) => path === "/api/projects/epub/import" && options?.method === "POST",
      ),
    ).toBe(false);
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos/3",
    );
  });

  it("faz fallback para a rota sincrona quando a rota de jobs retorna 404", async () => {
    setupApiMock({
      capabilities: {
        project_epub_import_async: true,
      },
      epubImportJobCreateResponse: mockJsonResponse(false, { error: "not_found" }, 404),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-epub-tools");
    const fileInput = document.getElementById("chapter-editor-epub-import-file") as HTMLInputElement;
    const file = new File(["epub"], "fallback.epub", { type: "application/epub+zip" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(
      within(screen.getByTestId("chapter-epub-tools")).getByRole("button", {
        name: "Importar EPUB",
      }),
    );
    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(
          ([, path, options]) => path === "/api/projects/epub/import" && options?.method === "POST",
        ),
      ).toBe(true);
    });
  });

  it("exporta EPUB no estado neutro usando o snapshot atual da página", async () => {
    const anchorClick = vi.fn();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(anchorClick);

    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-epub-tools");
    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    await screen.findByTestId("chapter-volume-editor");
    fireEvent.change(screen.getByLabelText("Sinopse do volume"), {
      target: { value: "Sinopse ainda não salva" },
    });
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
      expect(body.project.volumeEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            volume: 2,
            synopsis: "Sinopse ainda não salva",
          }),
        ]),
      );
    });
    expect(anchorClick).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("mostra estado de capability desconhecido quando o contrato da API falha", async () => {
    setupApiMock({ contractOk: false });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-epub-tools");
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

  it("compensa o scroll para acompanhar o card do volume ao fechar o capítulo", async () => {
    setupApiMock({
      project: buildProject({
        episodeDownloads: [
          ...baseProject.episodeDownloads,
          {
            ...baseProject.episodeDownloads[0],
            number: 1,
            volume: 4,
            title: "Capítulo 1 V4",
          },
        ],
      }),
    });
    const scrollByMock = vi.mocked(window.scrollBy);
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function () {
        const testId = this.getAttribute("data-testid");
        if (testId === "chapter-structure-group-4") {
          const pathname =
            document.querySelector<HTMLElement>("[data-testid='location-pathname']")?.textContent || "";
          return createMockDomRect(
            pathname === "/dashboard/projetos/project-ln-1/capitulos" ? 120 : 260,
          );
        }
        return createMockDomRect(0);
      });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=2");
    await screen.findByTestId("chapter-editor-header-shell");

    scrollByMock.mockClear();
    fireEvent.click(screen.getByTestId("chapter-structure-select-4"));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos",
      );
    });
    await waitFor(() => {
      expect(scrollByMock).toHaveBeenCalledWith({ top: -140, left: 0, behavior: "auto" });
    });

    scrollByMock.mockClear();
    fireEvent.click(screen.getByTestId("chapter-structure-select-4"));
    expect(scrollByMock).not.toHaveBeenCalled();

    rectSpy.mockRestore();
  });
});
