import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardProjectChapterEditor from "@/pages/DashboardProjectChapterEditor";

const {
  apiFetchMock,
  asyncStatePropsSpy,
  toastMock,
  lexicalEditorPropsSpy,
  imageLibraryPropsSpy,
  mangaWorkflowPropsSpy,
} = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  asyncStatePropsSpy: vi.fn(),
  toastMock: vi.fn(),
  lexicalEditorPropsSpy: vi.fn(),
  imageLibraryPropsSpy: vi.fn(),
  mangaWorkflowPropsSpy: vi.fn(),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageContainer", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: (props: unknown) => {
    imageLibraryPropsSpy(props);
    return <div data-testid="image-library-dialog" />;
  },
}));

vi.mock("@/components/project-reader/MangaWorkflowPanel", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/project-reader/MangaWorkflowPanel")>();
  return {
    ...actual,
    default: (props: {
      project?: {
        id?: string;
        title?: string;
        type?: string;
        volumeEntries?: Array<{
          volume: number;
          synopsis?: string;
          coverImageUrl?: string;
          coverImageAlt?: string;
        }>;
        episodeDownloads?: Array<Record<string, unknown>>;
      };
      stagedChapters?: Array<{
        id: string;
        title?: string;
      }>;
      selectedStageChapterId?: string | null;
      setStagedChapters?: (value: unknown) => void;
      setSelectedStageChapterId?: (value: string | null) => void;
      onSelectedStageChapterChange?: (chapter: unknown) => void;
      onOpenImportedChapter?: (project: unknown, chapters: unknown[]) => void;
    }) => {
      mangaWorkflowPropsSpy(props);
      const pendingChapter = {
        id: "stage-1",
        number: 7,
        volume: 1,
        title: "Capítulo pendente",
        titleDetected: "",
        sourceLabel: "Capítulo manual",
        pages: [
          {
            id: "stage-page-1",
            file: new File(["image"], "001.jpg", { type: "image/jpeg" }),
            previewUrl: "blob:stage-1",
            relativePath: "Volume 1/Capitulo 7/001.jpg",
            name: "001.jpg",
          },
        ],
        coverPageId: "stage-page-1",
        publicationStatus: "draft",
        operation: "create",
        warnings: [],
      };
      const pendingChapterNewVolume = {
        ...pendingChapter,
        id: "stage-2",
        volume: 5,
        title: "Capítulo pendente novo volume",
      };
      return (
        <div data-testid="manga-workflow-panel">
          <button
            type="button"
            data-testid="mock-stage-add"
            onClick={() => {
              props.setStagedChapters?.([pendingChapter]);
              props.setSelectedStageChapterId?.("stage-1");
              props.onSelectedStageChapterChange?.(pendingChapter);
            }}
          >
            Adicionar pendente
          </button>
          <button
            type="button"
            data-testid="mock-stage-add-new-volume"
            onClick={() => {
              props.setStagedChapters?.([pendingChapterNewVolume]);
              props.setSelectedStageChapterId?.("stage-2");
              props.onSelectedStageChapterChange?.(pendingChapterNewVolume);
            }}
          >
            Adicionar pendente novo volume
          </button>
          <button
            type="button"
            data-testid="mock-stage-import-open"
            onClick={() => {
              const importedChapter = {
                number: 7,
                volume: 3,
                title: "Capítulo importado",
                synopsis: "",
                releaseDate: "",
                duration: "",
                sourceType: "Web",
                sources: [],
                content: "",
                contentFormat: "images",
                pages: [{ position: 1, imageUrl: "/uploads/manga/importado-01.jpg" }],
                pageCount: 1,
                hasPages: true,
                publicationStatus: "draft",
                coverImageUrl: "/uploads/manga/importado-01.jpg",
                coverImageAlt: "",
              };
              props.onOpenImportedChapter?.(
                {
                  ...props.project,
                  volumeEntries: [
                    ...(props.project?.volumeEntries || []),
                    {
                      volume: 3,
                      synopsis: "Volume importado",
                      coverImageUrl: "",
                      coverImageAlt: "",
                    },
                  ],
                  episodeDownloads: [importedChapter],
                },
                [importedChapter],
              );
            }}
          >
            Abrir importado
          </button>
          <div data-testid="mock-stage-count">{props.stagedChapters?.length || 0}</div>
          <div data-testid="mock-stage-selected">{props.selectedStageChapterId || ""}</div>
        </div>
      );
    },
  };
});

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

const createMockDomRect = (top: number, height = 40, width = 320): DOMRect =>
  ({
    x: 0,
    y: top,
    top,
    bottom: top + height,
    left: 0,
    right: width,
    width,
    height,
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
      content:
        '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
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
        <Route
          path="/dashboard/uploads"
          element={
            <>
              <div data-testid="uploads-page" />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const openIdentityAccordion = () => {
  const trigger = screen.getByTestId("chapter-identity-trigger");
  if (trigger.getAttribute("aria-expanded") !== "true") {
    fireEvent.click(trigger);
  }
};

const openVolumeAccordion = () => {
  const trigger = screen.getByTestId("chapter-volume-trigger");
  if (trigger.getAttribute("aria-expanded") !== "true") {
    fireEvent.click(trigger);
  }
};

const expectStructureGroupSelected = (groupKey: string) => {
  expect(screen.getByTestId(`chapter-structure-group-${groupKey}`)).toHaveClass(
    "border-primary/45",
    "bg-primary/[0.06]",
  );
  expect(screen.getByTestId(`chapter-structure-group-header-${groupKey}`)).toHaveClass(
    "bg-primary/[0.04]",
  );
};

const expectStructureGroupNotSelected = (groupKey: string) => {
  expect(screen.getByTestId(`chapter-structure-group-${groupKey}`)).not.toHaveClass(
    "border-primary/45",
    "bg-primary/[0.06]",
  );
  expect(screen.getByTestId(`chapter-structure-group-header-${groupKey}`)).not.toHaveClass(
    "bg-primary/[0.04]",
  );
};

const getTopActions = () => within(screen.getByTestId("chapter-editor-top-actions"));

const findLeaveDialog = () => screen.findByTestId("chapter-unsaved-leave-dialog");

const setupApiMock = ({
  permissions = ["projetos"],
  project = buildProject(),
  projectStatus = 200,
  contractOk = true,
  capabilities,
  chapterSaveResponse,
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
  chapterSaveResponse?:
    | Response
    | ((context: {
        path: string;
        payload: Record<string, unknown>;
        chapterNumber: number;
        chapterVolume: number | undefined;
        currentChapter: (typeof project.episodeDownloads)[number];
        nextChapter: Record<string, unknown>;
      }) => Response);
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

      const chapterSaveMatch = path.match(
        /^\/api\/projects\/project-ln-1\/chapters\/(\d+)(?:\?volume=(\d+))?$/,
      );
      if (chapterSaveMatch && method === "PUT") {
        const payload = options?.json || {};
        const chapterNumber = Number(chapterSaveMatch[1]);
        const chapterVolume = chapterSaveMatch[2] ? Number(chapterSaveMatch[2]) : undefined;
        const chapterIndex = project.episodeDownloads.findIndex(
          (episode) =>
            Number(episode.number) === chapterNumber &&
            (chapterVolume === undefined
              ? !Number.isFinite(Number(episode.volume))
              : Number(episode.volume) === chapterVolume),
        );
        const currentChapter =
          chapterIndex >= 0 ? project.episodeDownloads[chapterIndex] : project.episodeDownloads[0];
        const nextChapter = {
          ...currentChapter,
          ...((payload.chapter as Record<string, unknown> | undefined) || {}),
        };
        if (chapterSaveResponse) {
          return typeof chapterSaveResponse === "function"
            ? chapterSaveResponse({
                path,
                payload,
                chapterNumber,
                chapterVolume,
                currentChapter,
                nextChapter,
              })
            : chapterSaveResponse;
        }
        return mockJsonResponse(true, {
          project: {
            ...project,
            revision: "rev-2",
            episodeDownloads: project.episodeDownloads.map((episode, index) =>
              index === (chapterIndex >= 0 ? chapterIndex : 0) ? nextChapter : episode,
            ),
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

      if (path === "/api/projects/project-ln-1/manga-export/chapter" && method === "POST") {
        return mockBinaryResponse(true);
      }

      if (path === "/api/projects/project-ln-1/manga-export/jobs" && method === "POST") {
        return mockJsonResponse(true, {
          job: {
            id: "manga-export-job-1",
            projectId: project.id,
            requestedBy: "user-1",
            status: "completed",
            summary: {},
            error: null,
            createdAt: "2026-03-09T00:00:00.000Z",
            startedAt: "2026-03-09T00:00:00.000Z",
            finishedAt: "2026-03-09T00:00:01.000Z",
            expiresAt: null,
            hasFile: true,
            downloadPath: "/api/projects/project-ln-1/manga-export/downloads/manga-export-job-1",
          },
        });
      }

      if (path === "/api/projects/project-ln-1/manga-export/downloads/manga-export-job-1") {
        return mockBinaryResponse(true);
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
                content:
                  '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
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
                      '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
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
    imageLibraryPropsSpy.mockReset();
    mangaWorkflowPropsSpy.mockReset();
    vi.stubGlobal("open", vi.fn());
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
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
    const headerShell = screen.getByTestId("chapter-editor-header-shell");
    const mainColumn = screen.getByTestId("chapter-editor-main-column");
    const workspace = screen.getByTestId("chapter-editor-workspace");
    const sidebar = screen.getByTestId("chapter-editor-sidebar");
    const upperLayout = screen.getByTestId("chapter-editor-upper-layout");
    const structureSection = screen.getByTestId("chapter-structure-section");
    const structureAccordion = structureSection.parentElement;
    const epubTools = screen.getByTestId("chapter-epub-tools");
    const epubTrigger = within(epubTools).getByRole("button", { name: /Ferramentas EPUB/i });
    expect(structureAccordion).not.toBeNull();
    expect(headerShell).toContainElement(screen.getByTestId("chapter-editor-masthead"));
    expect(headerShell).toContainElement(screen.getByTestId("chapter-editor-command-bar"));
    expect(Array.from(upperLayout.children)).toEqual([mainColumn, sidebar]);
    expect(Array.from(mainColumn.children)).toEqual([workspace]);
    expect(Array.from(workspace.children)).toEqual([epubTools]);
    expect(mainColumn).toContainElement(workspace);
    expect(sidebar).toContainElement(structureSection);
    expect(sidebar).not.toContainElement(epubTools);
    expect(Array.from(sidebar.children)[0]).toBe(structureAccordion);
    expect(structureSection).toHaveAttribute("data-state", "open");
    expect(epubTrigger).toHaveClass("hover:no-underline", "py-3.5", "md:py-4");
    expect(within(epubTools).getByText("Ferramentas EPUB")).toBeInTheDocument();
    expect(within(epubTools).getByText("Importação e exportação por volume")).toBeInTheDocument();
    expect(within(structureSection).getByText("Estrutura")).toBeInTheDocument();
    expect(screen.queryByText(/Seleção editorial/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Salvar como rascunho/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Publicar$/i })).not.toBeInTheDocument();
    expect(
      within(structureSection).getByText("Volumes, filtros, navegação e criação de capítulos"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-intro-row")).toHaveClass("space-y-3");
    expect(screen.getByTestId("chapter-structure-intro-copy")).toHaveClass(
      "text-xs",
      "leading-5",
      "text-muted-foreground",
    );
    expect(
      within(screen.getByTestId("chapter-structure-intro-row")).getByRole("button", {
        name: /Adicionar volume/i,
      }),
    ).toHaveClass("w-full", "justify-center");
    expect(screen.getByTestId("chapter-structure-group-2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-none")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-header-2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-main-2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-actions-2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-toggle-2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-main-none")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-actions-none")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-toggle-none")).toBeInTheDocument();
    expectStructureGroupNotSelected("2");
    expectStructureGroupNotSelected("none");
    expect(screen.getByTestId("chapter-structure-select-2")).not.toHaveClass(
      "rounded-xl",
      "border",
    );
    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-selection-state")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-content-accordion")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-content-section")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir capítulo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Excluir volume/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-lexical")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-metadata-accordion")).not.toBeInTheDocument();
  });

  it("passa filteredChapters para o workflow neutro de manga e atualiza com a busca", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        episodeDownloads: [
          {
            number: 1,
            volume: 1,
            title: "Capítulo publicado",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "TV",
            sources: [],
            progressStage: "aguardando-raw",
            completedStages: [],
            content: "",
            contentFormat: "images",
            pages: [{ position: 0, imageUrl: "/uploads/manga/ch1-01.jpg" }],
            pageCount: 1,
            hasPages: true,
            publicationStatus: "published",
            coverImageUrl: "/uploads/manga/ch1-01.jpg",
            coverImageAlt: "",
          },
          {
            number: 2,
            volume: 1,
            title: "Capítulo rascunho",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "TV",
            sources: [],
            progressStage: "aguardando-raw",
            completedStages: [],
            content: "",
            contentFormat: "images",
            pages: [{ position: 0, imageUrl: "/uploads/manga/ch2-01.jpg" }],
            pageCount: 1,
            hasPages: true,
            publicationStatus: "draft",
            coverImageUrl: "/uploads/manga/ch2-01.jpg",
            coverImageAlt: "",
          },
        ],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");

    await screen.findByTestId("manga-workflow-panel");
    expect(screen.queryByTestId("chapter-epub-tools")).not.toBeInTheDocument();

    const initialWorkflowProps = mangaWorkflowPropsSpy.mock.calls.at(-1)?.[0] as {
      filteredChapters?: Array<{ title?: string }>;
      filterMode?: string;
    };
    expect(initialWorkflowProps.filterMode).toBe("all");
    expect(initialWorkflowProps.filteredChapters).toHaveLength(2);

    fireEvent.change(within(screen.getByTestId("chapter-structure-section")).getByRole("textbox"), {
      target: { value: "publicado" },
    });

    await waitFor(() => {
      const latestWorkflowProps = mangaWorkflowPropsSpy.mock.calls.at(-1)?.[0] as {
        filteredChapters?: Array<{ title?: string }>;
      };
      expect(latestWorkflowProps.filteredChapters).toHaveLength(1);
      expect(latestWorkflowProps.filteredChapters?.[0]?.title).toBe("Capítulo publicado");
    });
  });

  it("mostra ZIP de volume e acoes de capitulo apenas para itens exportaveis na estrutura", async () => {
    const anchorClick = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(anchorClick);

    setupApiMock({
      project: buildProject({
        type: "Manga",
        episodeDownloads: [
          {
            number: 3,
            volume: 1,
            title: "Capitulo em imagem",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            content: "",
            contentFormat: "images",
            pages: [{ position: 1, imageUrl: "/uploads/manga/ch3-01.jpg" }],
            pageCount: 1,
            hasPages: true,
            publicationStatus: "published",
            coverImageUrl: "/uploads/manga/ch3-01.jpg",
            coverImageAlt: "",
          },
          {
            number: 4,
            volume: 1,
            title: "Capitulo lexical",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            content:
              '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
            contentFormat: "lexical",
            pages: [],
            pageCount: 0,
            hasPages: false,
            publicationStatus: "draft",
            coverImageUrl: "",
            coverImageAlt: "",
          },
          {
            number: 5,
            volume: 1,
            title: "Capitulo sem paginas",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            content: "",
            contentFormat: "images",
            pages: [],
            pageCount: 0,
            hasPages: false,
            publicationStatus: "draft",
            coverImageUrl: "",
            coverImageAlt: "",
          },
          {
            number: 6,
            volume: 2,
            title: "Capitulo volume 2 sem exportacao",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            content:
              '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
            contentFormat: "lexical",
            pages: [],
            pageCount: 0,
            hasPages: false,
            publicationStatus: "published",
            coverImageUrl: "",
            coverImageAlt: "",
          },
        ],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");

    await screen.findByTestId("manga-workflow-panel");

    expect(screen.getByTestId("chapter-structure-export-volume-1")).toBeInTheDocument();
    expect(screen.queryByTestId("chapter-structure-export-volume-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-structure-export-volume-none")).not.toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-content-3:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-header-3:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-footer-3:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-meta-3:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-actions-3:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-export-zip-3:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-export-cbz-3:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-open-icon-3:1")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("chapter-structure-episode-header-3:1")).getByText(
        "Capitulo em imagem",
      ),
    ).toHaveClass("line-clamp-2");
    expect(screen.getByTestId("chapter-structure-episode-footer-4:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-meta-4:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-footer-5:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-meta-5:1")).toBeInTheDocument();
    expect(screen.queryByTestId("chapter-structure-episode-actions-4:1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-structure-episode-actions-5:1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("chapter-structure-export-volume-1"));

    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(
          ([, path, options]) =>
            path === "/api/projects/project-ln-1/manga-export/jobs" &&
            options?.method === "POST" &&
            (options?.json as { volume?: number; includeDrafts?: boolean } | undefined)?.volume ===
              1 &&
            (options?.json as { volume?: number; includeDrafts?: boolean } | undefined)
              ?.includeDrafts === false,
        ),
      ).toBe(true);
    });

    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    expectStructureGroupNotSelected("1");
    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/dashboard/projetos/project-ln-1/capitulos",
    );

    fireEvent.click(screen.getByTestId("chapter-structure-episode-export-zip-3:1"));

    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(
          ([, path, options]) =>
            path === "/api/projects/project-ln-1/manga-export/chapter" &&
            options?.method === "POST",
        ),
      ).toBe(true);
    });

    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/dashboard/projetos/project-ln-1/capitulos",
    );
    expect(anchorClick).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("chapter-structure-episode-open-icon-3:1"));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname")).toHaveTextContent(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
      expect(screen.getByTestId("location-search")).toHaveTextContent("?volume=1");
    });

    clickSpy.mockRestore();
  });

  it("mantem o loading de exportacao isolado por card na estrutura", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        episodeDownloads: [
          {
            number: 3,
            volume: 1,
            title: "Capitulo 3",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            content: "",
            contentFormat: "images",
            pages: [{ position: 1, imageUrl: "/uploads/manga/ch3-01.jpg" }],
            pageCount: 1,
            hasPages: true,
            publicationStatus: "published",
            coverImageUrl: "/uploads/manga/ch3-01.jpg",
            coverImageAlt: "",
          },
          {
            number: 4,
            volume: 1,
            title: "Capitulo 4",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            content: "",
            contentFormat: "images",
            pages: [{ position: 1, imageUrl: "/uploads/manga/ch4-01.jpg" }],
            pageCount: 1,
            hasPages: true,
            publicationStatus: "draft",
            coverImageUrl: "/uploads/manga/ch4-01.jpg",
            coverImageAlt: "",
          },
          {
            number: 8,
            volume: 2,
            title: "Capitulo 8",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            content: "",
            contentFormat: "images",
            pages: [{ position: 1, imageUrl: "/uploads/manga/ch8-01.jpg" }],
            pageCount: 1,
            hasPages: true,
            publicationStatus: "published",
            coverImageUrl: "/uploads/manga/ch8-01.jpg",
            coverImageAlt: "",
          },
        ],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("manga-workflow-panel");

    const defaultImplementation = apiFetchMock.getMockImplementation();
    apiFetchMock.mockImplementation(async (...args: unknown[]) => {
      const [, path, options] = args as [string, string, { json?: { volume?: number } }?];
      if (path === "/api/projects/project-ln-1/manga-export/chapter") {
        return new Promise<Response>(() => undefined);
      }
      if (path === "/api/projects/project-ln-1/manga-export/jobs" && options?.json?.volume === 1) {
        return new Promise<Response>(() => undefined);
      }
      return defaultImplementation?.(...args);
    });

    fireEvent.click(screen.getByTestId("chapter-structure-episode-export-zip-3:1"));
    fireEvent.click(screen.getByTestId("chapter-structure-export-volume-1"));

    await waitFor(() => {
      expect(screen.getByTestId("chapter-structure-episode-export-zip-3:1")).toBeDisabled();
      expect(screen.getByTestId("chapter-structure-episode-export-cbz-3:1")).toBeDisabled();
    });

    expect(screen.getByTestId("chapter-structure-episode-export-zip-4:1")).not.toBeDisabled();
    expect(screen.getByTestId("chapter-structure-episode-export-cbz-4:1")).not.toBeDisabled();
    expect(screen.getByTestId("chapter-structure-export-volume-1")).toBeDisabled();
    expect(screen.getByTestId("chapter-structure-export-volume-2")).not.toBeDisabled();
  });

  it("integra capitulos pendentes na sidebar sem navegar de rota", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        episodeDownloads: [
          {
            number: 1,
            volume: 1,
            title: "Capítulo publicado",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            content: "",
            contentFormat: "images",
            pages: [{ position: 1, imageUrl: "/uploads/manga/ch1-01.jpg" }],
            pageCount: 1,
            hasPages: true,
            publicationStatus: "published",
            coverImageUrl: "/uploads/manga/ch1-01.jpg",
            coverImageAlt: "",
          },
        ],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");

    await screen.findByTestId("manga-workflow-panel");
    fireEvent.click(screen.getByTestId("mock-stage-add"));

    const pendingEntry = await screen.findByTestId("chapter-structure-stage-select-stage-1");
    expect(pendingEntry).toHaveTextContent("Capítulo pendente");
    expectStructureGroupSelected("1");
    expectStructureGroupNotSelected("none");

    const previousPath = screen.getByTestId("location-pathname").textContent;
    fireEvent.click(pendingEntry);

    expect(screen.getByTestId("location-pathname").textContent).toBe(previousPath);
    expect(screen.getByTestId("mock-stage-selected")).toHaveTextContent("stage-1");
  });

  it("abre o editor de volume existente ao selecionar um capitulo pendente com volume conhecido", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        volumeEntries: [
          {
            volume: 1,
            synopsis: "Sinopse do volume 1",
            coverImageUrl: "",
            coverImageAlt: "",
          },
        ],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("manga-workflow-panel");

    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    expectStructureGroupSelected("2");
    expectStructureGroupNotSelected("1");
    fireEvent.click(screen.getByTestId("mock-stage-add"));

    const volumeEditor = await screen.findByTestId("chapter-volume-editor");
    expect(screen.getByDisplayValue("Sinopse do volume 1")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/URL da capa do volume/i)).not.toBeInTheDocument();
    expect(within(volumeEditor).getByRole("button", { name: "Biblioteca" })).toBeInTheDocument();
    expectStructureGroupSelected("1");
    expectStructureGroupNotSelected("2");
  });

  it("abre um draft de volume novo ao selecionar um capitulo pendente com volume inedito", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        volumeEntries: [],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("manga-workflow-panel");

    fireEvent.click(screen.getByTestId("mock-stage-add-new-volume"));

    const volumeEditor = await screen.findByTestId("chapter-volume-editor");
    expect(volumeEditor).toBeInTheDocument();
    expect(within(volumeEditor).getAllByText("Volume 5").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Sinopse do volume/i)).toHaveValue("");
    expect(screen.queryByPlaceholderText(/URL da capa do volume/i)).not.toBeInTheDocument();
    expectStructureGroupSelected("5");
    expectStructureGroupNotSelected("2");
  });

  it("abre o capitulo importado no editor e mostra as acoes de publicacao", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        volumeEntries: [],
        episodeDownloads: [],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("manga-workflow-panel");

    fireEvent.click(screen.getByTestId("mock-stage-import-open"));

    await screen.findByTestId("manga-chapter-pages-editor");
    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/dashboard/projetos/project-ln-1/capitulos/7",
    );
    expect(
      getTopActions().getByRole("button", { name: /Salvar como rascunho/i }),
    ).toBeInTheDocument();
    expect(getTopActions().getByRole("button", { name: /^Publicar$/i })).toBeInTheDocument();
    expect(screen.queryByTestId("chapter-editor-footer-actions")).not.toBeInTheDocument();
  });

  it("renderiza o editor aberto com layout expandido e sidebar alinhada", async () => {
    setupApiMock();
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conte/i });
    const masthead = screen.getByTestId("chapter-editor-masthead");
    const commandBar = screen.getByTestId("chapter-editor-command-bar");
    const upperLayout = screen.getByTestId("chapter-editor-upper-layout");
    const mainColumn = screen.getByTestId("chapter-editor-main-column");
    const workspace = screen.getByTestId("chapter-editor-workspace");
    const lexicalEditor = await screen.findByTestId("mock-lexical");
    const lexicalWrapper = screen.getByTestId("chapter-lexical-wrapper");
    const contentAccordion = screen.getByTestId("chapter-content-accordion");
    const contentBody = screen.getByTestId("chapter-content-body");
    const contentViewport = screen.getByTestId("chapter-content-viewport");
    const contentSection = screen.getByTestId("chapter-content-section");
    const contentTrigger = screen.getByTestId("chapter-content-trigger");
    const identitySection = screen.getByTestId("chapter-identity-section");
    const identityTrigger = screen.getByTestId("chapter-identity-trigger");
    const topRow = screen.getByTestId("chapter-workspace-top-row");
    const supportRow = screen.getByTestId("chapter-workspace-support-row");
    const sidebar = screen.getByTestId("chapter-editor-sidebar");
    const actionRail = screen.getByTestId("chapter-editor-action-rail");
    const topStatusGroup = screen.getByTestId("chapter-editor-top-status-group");
    const topActions = screen.getByTestId("chapter-editor-top-actions");
    const statusBar = screen.getByTestId("chapter-editor-status-bar");
    const structureSection = screen.getByTestId("chapter-structure-section");
    const structureAccordion = structureSection.parentElement;
    const structureTrigger = within(screen.getByTestId("chapter-structure-section")).getByRole(
      "button",
      { name: /Estrutura/i },
    );

    expect(screen.getByTestId("chapter-editor-upper-layout")).not.toHaveClass("px-4");
    expect(screen.getByTestId("chapter-editor-upper-layout")).not.toHaveClass("md:px-6");
    expect(screen.getByTestId("chapter-editor-upper-layout")).not.toHaveClass("lg:px-8");
    expect(commandBar).toHaveClass("sticky", "top-3");
    expect(Array.from(upperLayout.children)).toEqual([mainColumn, sidebar]);
    expect(Array.from(mainColumn.children)).toEqual([workspace]);
    expect(Array.from(workspace.children)).toEqual([topRow, contentAccordion, supportRow]);
    expect(masthead).toHaveTextContent(/Gerenciamento de Conte/i);
    expect(sidebar).toContainElement(structureSection);
    expect(structureAccordion).not.toBeNull();
    expect(Array.from(sidebar.children)[0]).toBe(structureAccordion);
    expect(screen.getByTestId("chapter-structure-group-header-2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-group-actions-2")).toContainElement(
      screen.getByTestId("chapter-structure-add-chapter-2"),
    );
    expectStructureGroupSelected("2");
    expectStructureGroupNotSelected("none");
    expect(screen.queryByTestId("chapter-epub-tools")).not.toBeInTheDocument();
    expect(screen.queryByText(/Autosave do cap/i)).not.toBeInTheDocument();
    expect(getTopActions().getByRole("button", { name: /Salvar altera/i })).toBeInTheDocument();
    expect(
      getTopActions().getByRole("button", { name: /Mover para rascunho/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("chapter-editor-footer-actions")).not.toBeInTheDocument();
    expect(actionRail).toHaveClass("lg:flex-row", "lg:justify-between");
    expect(topStatusGroup).toContainElement(screen.getByText(/Sem alter/i));
    expect(topActions).toContainElement(
      getTopActions().getByRole("button", { name: /Salvar altera/i }),
    );
    expect(topActions).toContainElement(
      getTopActions().getByRole("button", { name: /Mover para rascunho/i }),
    );
    expect(topActions).toContainElement(screen.getByRole("button", { name: /Excluir cap/i }));
    expect(
      within(statusBar).queryByRole("button", { name: /Salvar altera/i }),
    ).not.toBeInTheDocument();
    expect(
      within(statusBar).queryByRole("button", { name: /Excluir cap/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("chapter-publication-section")).getByText(/^Status atual$/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/ações do topo/i)).toBeInTheDocument();
    expect(structureTrigger).toHaveClass("hover:no-underline", "py-3.5", "md:py-4");
    expect(screen.getByText("Estrutura")).toBeInTheDocument();
    expect(screen.getByText(/Volumes, filtros, navega/i)).toBeInTheDocument();
    expect(screen.getByText(/Identidade do cap/i)).toBeInTheDocument();
    expect(screen.getByText(/numera/i)).toBeInTheDocument();
    expect(identityTrigger).toHaveAttribute("aria-expanded", "false");
    expect(identitySection).toHaveAttribute("data-state", "open");
    expect(screen.queryByTestId("chapter-volume-accordion")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-volume-trigger")).not.toBeInTheDocument();
    expect(contentTrigger).toHaveAttribute("aria-expanded", "true");
    expect(within(contentSection).getByText(/Espa/i)).toBeInTheDocument();
    expect(within(contentSection).getByText(/Ambiente principal de escrita/i)).toBeInTheDocument();
    expect(screen.queryByText("Texto / Lexical")).not.toBeInTheDocument();
    expect(screen.queryByText("Imagem / Manga")).not.toBeInTheDocument();
    expect(contentBody).toHaveAttribute("aria-hidden", "false");
    expect(contentViewport).toHaveAttribute("data-state", "open");
    expect(contentViewport).toHaveClass("grid-rows-[1fr]", "opacity-100");
    expect(contentBody).toHaveClass(
      "transition-all",
      "data-[state=closed]:animate-accordion-up",
      "data-[state=open]:animate-accordion-down",
    );
    expect(screen.queryByTestId("chapter-metadata-accordion")).not.toBeInTheDocument();
    expect(lexicalEditor).toHaveClass(
      "lexical-playground--stretch",
      "lexical-playground--chapter-editor",
      "w-full",
    );
    expect(
      lexicalEditorPropsSpy.mock.calls.some(([props]) =>
        Boolean(
          (props as { className?: string; followCaretScroll?: boolean }).followCaretScroll &&
            String((props as { className?: string }).className || "").includes(
              "lexical-playground--chapter-editor",
            ),
        ),
      ),
    ).toBe(true);
    expect(lexicalWrapper).toHaveClass("min-h-[420px]", "lg:min-h-[620px]");
    expect(screen.getByTestId("chapter-standard-compact-fields")).toHaveClass(
      "flex",
      "flex-wrap",
      "gap-3",
    );
    expect(document.getElementById("chapter-title-standard") as HTMLInputElement).toHaveClass(
      "w-full",
    );
    expect(document.getElementById("chapter-number-standard") as HTMLInputElement).toHaveClass(
      "w-full",
      "sm:w-[132px]",
    );
    expect(document.getElementById("chapter-volume-standard") as HTMLInputElement).toHaveClass(
      "w-full",
      "sm:w-[132px]",
    );
    expect(document.getElementById("chapter-synopsis-standard") as HTMLTextAreaElement).toHaveClass(
      "w-full",
    );
  });
  it("simplifica o workspace para capitulos em imagem", async () => {
    const imageProject = buildProject({
      type: "Manga",
      title: "Projeto Manga",
      episodeDownloads: [
        {
          number: 3,
          volume: 1,
          title: "Capitulo em imagem",
          synopsis: "",
          releaseDate: "2026-03-10",
          duration: "",
          sourceType: "Web",
          sources: [],
          progressStage: "aguardando-raw",
          completedStages: [],
          content: "",
          contentFormat: "images",
          publicationStatus: "draft",
          coverImageUrl: "https://cdn.test/page-1.jpg",
          coverImageAlt: "Capa do capitulo em imagem",
          pages: [
            { position: 1, imageUrl: "https://cdn.test/page-1.jpg" },
            { position: 2, imageUrl: "https://cdn.test/page-2.jpg" },
          ],
          pageCount: 2,
          hasPages: true,
        },
      ],
    });

    setupApiMock({ project: imageProject });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/3?volume=1");

    await screen.findByTestId("manga-chapter-pages-editor");

    const workspace = screen.getByTestId("chapter-editor-workspace");
    const topRow = screen.getByTestId("chapter-workspace-top-row");
    const identityCard = screen.getByTestId("chapter-identity-accordion");
    const contentCard = screen.getByTestId("chapter-content-accordion");
    expect(Array.from(workspace.children)).toEqual([topRow, contentCard]);
    expect(Array.from(topRow.children)).toEqual([identityCard]);
    expect(screen.queryByTestId("chapter-publication-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-workspace-support-row")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-cover-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-sources-section")).not.toBeInTheDocument();
    expect(within(identityCard).getByText(/Dados do cap/i)).toBeInTheDocument();
    expect(within(contentCard).getByRole("heading", { name: /Pag/i })).toBeInTheDocument();
    expect(document.getElementById("chapter-volume-image") as HTMLInputElement).toHaveClass(
      "w-full",
      "sm:w-[132px]",
    );
    expect(document.getElementById("chapter-number-image") as HTMLInputElement).toHaveClass(
      "w-full",
      "sm:w-[132px]",
    );
    expect(document.getElementById("chapter-title-image") as HTMLInputElement).toHaveClass(
      "w-full",
    );
    expect(screen.getByTestId("chapter-image-compact-fields")).toHaveClass(
      "flex",
      "flex-wrap",
      "gap-3",
    );
    expect(screen.queryByText("Texto / Lexical")).not.toBeInTheDocument();
    expect(screen.queryByText("Imagem / Manga")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Ordem de leitura/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Sinopse/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("manga-pages-utilities-trigger")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      getTopActions().getByRole("button", { name: /Salvar como rascunho/i }),
    ).toBeInTheDocument();
    expect(getTopActions().getByRole("button", { name: /Publicar/i })).toBeInTheDocument();
    expect(screen.queryByTestId("chapter-editor-footer-actions")).not.toBeInTheDocument();
  });
  it("cria novo capitulo de manga ja em modo imagem por padrao", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        title: "Projeto Manga",
        episodeDownloads: [
          {
            number: 1,
            volume: 1,
            title: "Capítulo 1",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            content: "",
            contentFormat: "images",
            pages: [{ position: 1, imageUrl: "/uploads/manga/ch1-01.jpg" }],
            pageCount: 1,
            hasPages: true,
            publicationStatus: "draft",
            coverImageUrl: "/uploads/manga/ch1-01.jpg",
            coverImageAlt: "",
          },
        ],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    fireEvent.click(screen.getByTestId("chapter-structure-add-chapter-1"));

    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(payload?.episodeDownloads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            number: 2,
            volume: 1,
            contentFormat: "images",
            publicationStatus: "draft",
          }),
        ]),
      );
    });

    await screen.findByTestId("manga-chapter-pages-editor");
    expect(screen.queryByTestId("mock-lexical")).not.toBeInTheDocument();
  });

  it("usa o modal de alteracoes nao salvas antes de navegar para uploads", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conte/i });
    await screen.findByTestId("mock-lexical");

    const lexicalProps = lexicalEditorPropsSpy.mock.calls.at(-1)?.[0] as {
      imageLibraryOptions?: {
        onRequestNavigateToUploads?: () => boolean | Promise<boolean>;
      };
    };
    expect(lexicalProps.imageLibraryOptions?.onRequestNavigateToUploads).toEqual(
      expect.any(Function),
    );

    fireEvent.change(screen.getByTestId("mock-lexical"), {
      target: { value: "Conteudo alterado" },
    });

    fireEvent.click((await screen.findAllByRole("button", { name: "Biblioteca" }))[0]);
    await screen.findByTestId("image-library-dialog");

    const dialogProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      onRequestNavigateToUploads?: () => boolean | Promise<boolean>;
    };
    expect(dialogProps.onRequestNavigateToUploads).toEqual(expect.any(Function));

    const navigateToUploadsPromise = dialogProps.onRequestNavigateToUploads?.();

    const leaveDialog = await findLeaveDialog();
    expect(
      within(leaveDialog).getByRole("button", { name: /Descartar e continuar/i }),
    ).toBeInTheDocument();
    fireEvent.click(within(leaveDialog).getByRole("button", { name: /Descartar e continuar/i }));

    await navigateToUploadsPromise;
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname")).toHaveTextContent("/dashboard/uploads");
    });
  });
  it("mostra acoes contextuais de rascunho no topo para capitulos draft", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/2?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conte/i });

    expect(
      getTopActions().getByRole("button", { name: /Salvar como rascunho/i }),
    ).toBeInTheDocument();
    expect(getTopActions().getByRole("button", { name: /Publicar/i })).toBeInTheDocument();
    expect(
      getTopActions().queryByRole("button", { name: /Mover para rascunho/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-editor-footer-actions")).not.toBeInTheDocument();
  });
  it("simplifica a identidade do capítulo e remove o subtipo manual", async () => {
    setupApiMock();
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    openIdentityAccordion();

    expect(screen.getByLabelText("Capítulo")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Subtipo/i)).not.toBeInTheDocument();
  });

  it("normaliza valores negativos de capítulo e volume ao salvar", async () => {
    setupApiMock();
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    openIdentityAccordion();

    fireEvent.change(screen.getByLabelText("Capítulo"), { target: { value: "-3" } });
    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "-1" } });
    fireEvent.click(getTopActions().getByRole("button", { name: /Salvar altera/i }));

    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) =>
          path === "/api/projects/project-ln-1/chapters/1?volume=2" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(payload?.chapter).toEqual(
        expect.objectContaining({
          number: 1,
          volume: undefined,
          entrySubtype: "chapter",
        }),
      );
    });
  });

  /* teste do sticky custom do chapter editor removido no rollback do accordion simples
    setupApiMock();
    let commandBarTop = 180;
    let commandBarHeight = 72;
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function () {
        if (this.getAttribute("data-testid") === "chapter-editor-command-bar") {
          return createMockDomRect(commandBarTop, commandBarHeight, 1280);
        }
        return createMockDomRect(0);
      });

    renderEditor();
    const lexicalWrapper = await screen.findByTestId("chapter-lexical-wrapper");
    const contentSection = screen.getByTestId("chapter-content-section");

    await waitFor(() => {
      expect(lexicalWrapper.style.getPropertyValue("--chapter-editor-toolbar-sticky-top")).toBe(
        "77px",
      );
      expect(contentSection.style.getPropertyValue("--chapter-editor-toolbar-sticky-top")).toBe("");
    });

    commandBarTop = 12;
    fireEvent.scroll(window);

    expect(lexicalWrapper.style.getPropertyValue("--chapter-editor-toolbar-sticky-top")).toBe(
      "77px",
    );
    expect(contentSection.style.getPropertyValue("--chapter-editor-toolbar-sticky-top")).toBe("");

    commandBarHeight = 64;
    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(lexicalWrapper.style.getPropertyValue("--chapter-editor-toolbar-sticky-top")).toBe(
        "69px",
      );
      expect(contentSection.style.getPropertyValue("--chapter-editor-toolbar-sticky-top")).toBe("");
    });

    rectSpy.mockRestore();
  */

  it("recolhe e expande o accordion de conteúdo sem desmontar o editor", async () => {
    setupApiMock();
    renderEditor();
    const lexicalEditor = await screen.findByTestId("mock-lexical");
    const contentBody = screen.getByTestId("chapter-content-body");
    const contentViewport = screen.getByTestId("chapter-content-viewport");
    const contentTrigger = screen.getByTestId("chapter-content-trigger");
    const contentSection = screen.getByTestId("chapter-content-section");

    fireEvent.change(lexicalEditor, { target: { value: "Novo trecho do capítulo" } });
    expect(lexicalEditor).toHaveValue("Novo trecho do capítulo");
    expect(contentTrigger).toHaveAttribute("aria-expanded", "true");
    expect(contentSection).toHaveAttribute("data-state", "open");

    fireEvent.click(contentTrigger);
    expect(contentTrigger).toHaveAttribute("aria-expanded", "true");
    expect(contentSection).toHaveAttribute("data-state", "open");
    expect(contentBody).toHaveAttribute("aria-hidden", "false");
    expect(contentViewport).toHaveAttribute("data-state", "open");
    expect(contentViewport).toHaveClass("grid-rows-[1fr]", "opacity-100");
    expect(screen.getByTestId("mock-lexical")).toBeInTheDocument();
    expect(screen.getByTestId("mock-lexical")).toHaveValue("Novo trecho do capítulo");

    fireEvent.click(contentTrigger);
    expect(contentTrigger).toHaveAttribute("aria-expanded", "true");
    expect(contentSection).toHaveAttribute("data-state", "open");
    expect(contentBody).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByTestId("mock-lexical")).toHaveValue("Novo trecho do capítulo");
  });

  it("alterna o grupo do volume ao clicar no volume e mantém a seleção", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    const volumeToggle = screen.getByTestId("chapter-structure-group-toggle-2");
    expect(volumeToggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    expect(volumeToggle).toHaveAttribute("aria-expanded", "false");
    expect(
      within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 2"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    expect(volumeToggle).toHaveAttribute("aria-expanded", "true");
    expect(
      within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 2"),
    ).toBeInTheDocument();
  });

  it("usa o chevron do volume apenas para expandir e colapsar sem selecionar", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    const volumeToggle = screen.getByTestId("chapter-structure-group-toggle-2");
    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    expectStructureGroupNotSelected("2");

    fireEvent.click(volumeToggle);
    expect(volumeToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    expectStructureGroupNotSelected("2");

    fireEvent.click(volumeToggle);
    expect(volumeToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    expectStructureGroupNotSelected("2");
  });

  it("mantem a rota atual e ignora o leave guard ao clicar no chevron do volume", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    await screen.findByTestId("chapter-volume-editor");
    openVolumeAccordion();
    fireEvent.change(screen.getByLabelText(/Sinopse do volume/i), {
      target: { value: "Volume pendente" },
    });

    const volumeToggle = screen.getByTestId("chapter-structure-group-toggle-2");
    expect(volumeToggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(volumeToggle);

    expect(volumeToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/dashboard/projetos/project-ln-1/capitulos",
    );
    expect(screen.queryByTestId("chapter-unsaved-leave-dialog")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 2"),
    ).toBeInTheDocument();

    fireEvent.click(volumeToggle);
    expect(volumeToggle).toHaveAttribute("aria-expanded", "false");
  });

  it("mantem o capitulo aberto ao clicar no chevron do volume", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=2");
    await screen.findByTestId("chapter-structure-section");

    const volumeToggle = screen.getByTestId("chapter-structure-group-toggle-2");
    fireEvent.click(volumeToggle);

    expect(volumeToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/dashboard/projetos/project-ln-1/capitulos/1",
    );
    expect(screen.queryByTestId("chapter-unsaved-leave-dialog")).not.toBeInTheDocument();
  });

  it("mantém múltiplos grupos da estrutura abertos ao expandir outro grupo e abrir outro capítulo", async () => {
    setupApiMock({
      project: buildProject({
        episodeDownloads: [
          ...baseProject.episodeDownloads,
          {
            number: 3,
            title: "Capítulo 3 sem volume",
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
          },
        ],
      }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    const volumeTwoToggle = screen.getByTestId("chapter-structure-group-toggle-2");
    const noVolumeToggle = screen.getByTestId("chapter-structure-group-toggle-none");
    expect(volumeTwoToggle).toHaveAttribute("aria-expanded", "true");
    expect(noVolumeToggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(noVolumeToggle);
    expect(volumeTwoToggle).toHaveAttribute("aria-expanded", "true");
    expect(noVolumeToggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: /Capítulo 3/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
    });
    expect(volumeTwoToggle).toHaveAttribute("aria-expanded", "true");
    expect(noVolumeToggle).toHaveAttribute("aria-expanded", "true");
    expectStructureGroupSelected("none");
    expectStructureGroupNotSelected("2");
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
    const workspace = screen.getByTestId("chapter-editor-workspace");
    expect(screen.getByTestId("chapter-volume-accordion")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 1"),
    ).toBeInTheDocument();
    expect(Array.from(screen.getByTestId("chapter-editor-main-column").children)).toEqual([
      workspace,
    ]);
    expect(Array.from(workspace.children)).toEqual([
      screen.getByTestId("chapter-volume-accordion"),
      screen.getByTestId("chapter-epub-tools"),
    ]);
    expect(screen.getByTestId("chapter-volume-trigger")).toHaveAttribute("aria-expanded", "false");
    openVolumeAccordion();
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
    openVolumeAccordion();
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
    openVolumeAccordion();
    fireEvent.change(screen.getByLabelText("Sinopse do volume"), {
      target: { value: "Volume salvo por atalho" },
    });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(
          ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
        ),
      ).toBe(true);
    });
  });

  it("usa o modal ao navegar entre volume e capitulo com alteracoes pendentes", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");
    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    await screen.findByTestId("chapter-volume-editor");
    openVolumeAccordion();
    fireEvent.change(screen.getByLabelText(/Sinopse do volume/i), {
      target: { value: "Volume pendente" },
    });

    fireEvent.click(screen.getByTestId("chapter-structure-group-toggle-2"));
    fireEvent.click(screen.getByRole("button", { name: /Cap.*1/i }));
    let leaveDialog = await findLeaveDialog();
    expect(
      within(leaveDialog).getByRole("button", { name: /Salvar volume e continuar/i }),
    ).toBeInTheDocument();
    fireEvent.click(within(leaveDialog).getByRole("button", { name: /Cancelar/i }));
    await waitFor(() => {
      expect(screen.queryByTestId("chapter-unsaved-leave-dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos",
    );

    fireEvent.click(screen.getByRole("button", { name: /Cap.*1/i }));
    leaveDialog = await findLeaveDialog();
    fireEvent.click(
      within(leaveDialog).getByRole("button", { name: /Salvar volume e continuar/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/1",
      );
    });

    const saveCall = apiFetchMock.mock.calls.find(
      ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
    );
    expect(saveCall).toBeDefined();
    const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
    expect(payload?.volumeEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          volume: 2,
          synopsis: "Volume pendente",
        }),
      ]),
    );
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
    openVolumeAccordion();
    fireEvent.change(screen.getByLabelText("Sinopse do volume"), {
      target: { value: "Excluir este volume" },
    });
    const volumeEditor = screen.getByTestId("chapter-volume-editor");
    const destructiveFooter = within(volumeEditor).getByTestId("chapter-volume-destructive-footer");
    fireEvent.click(within(destructiveFooter).getByRole("button", { name: /Excluir volume/i }));
    expect(screen.getByRole("heading", { name: /Excluir volume\?/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Isso também excluirá 2 capítulo\(s\) vinculado\(s\)\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /As alterações atuais da página serão aplicadas imediatamente junto com a exclusão\./i,
      ),
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
    expect(
      within(screen.getByTestId("chapter-editor-status-bar")).getByText("Volume 2"),
    ).toBeInTheDocument();
    fireEvent.click(closeVolumeButton);
    await waitFor(() => {
      expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    });
  });

  it("respeita o modal ao fechar o volume com alteracoes pendentes", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");
    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    await screen.findByTestId("chapter-volume-editor");
    openVolumeAccordion();
    fireEvent.change(screen.getByLabelText(/Sinopse do volume/i), {
      target: { value: "Volume pendente para fechar" },
    });

    fireEvent.click(screen.getByTestId("chapter-close-volume-button"));
    let leaveDialog = await findLeaveDialog();
    fireEvent.click(within(leaveDialog).getByRole("button", { name: /Cancelar/i }));
    await waitFor(() => {
      expect(screen.queryByTestId("chapter-unsaved-leave-dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("chapter-volume-editor")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("chapter-close-volume-button"));
    leaveDialog = await findLeaveDialog();
    fireEvent.click(within(leaveDialog).getByRole("button", { name: /Descartar e continuar/i }));

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
    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    expect(screen.getAllByText("Volume 2").length).toBeGreaterThan(0);
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
    expect(
      within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 2"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Alternar Sem volume/i }));
    fireEvent.click(screen.getByRole("button", { name: /Capítulo sem volume/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("");
    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
  });

  it("não renderiza o editor de volume quando o capítulo ativo está sem volume", async () => {
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
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/3");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    const workspace = screen.getByTestId("chapter-editor-workspace");
    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    expect(Array.from(screen.getByTestId("chapter-editor-main-column").children)).toEqual([
      workspace,
    ]);
    expect(workspace).toContainElement(screen.getByTestId("chapter-identity-accordion"));
    expect(workspace).toContainElement(screen.getByTestId("chapter-content-accordion"));
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
    expect(
      within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 4"),
    ).toBeInTheDocument();
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
    expect(
      within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 5"),
    ).toBeInTheDocument();
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
    expect(
      within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 2"),
    ).toBeInTheDocument();
  });

  it("abre o volume pelo modal de alteracoes nao salvas do capitulo", async () => {
    setupApiMock({
      project: buildProject({
        episodeDownloads: [
          ...baseProject.episodeDownloads,
          {
            ...baseProject.episodeDownloads[0],
            number: 1,
            volume: 4,
            title: "Capitulo 1 V4",
          },
        ],
      }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conte/i });
    openIdentityAccordion();
    fireEvent.change(document.getElementById("chapter-title-standard") as HTMLInputElement, {
      target: { value: "Capitulo pendente" },
    });

    fireEvent.click(screen.getByTestId("chapter-structure-select-4"));
    let leaveDialog = await findLeaveDialog();
    fireEvent.click(within(leaveDialog).getByRole("button", { name: /Cancelar/i }));
    await waitFor(() => {
      expect(screen.queryByTestId("chapter-unsaved-leave-dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos/1",
    );
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=2");

    fireEvent.click(screen.getByTestId("chapter-structure-select-4"));
    leaveDialog = await findLeaveDialog();
    fireEvent.click(within(leaveDialog).getByRole("button", { name: /Publicar e continuar/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("");
    expect(
      within(screen.getByTestId("chapter-volume-editor")).getByText("Volume 4"),
    ).toBeInTheDocument();

    const saveCall = apiFetchMock.mock.calls.find(
      ([, path, options]) =>
        path === "/api/projects/project-ln-1/chapters/1?volume=2" && options?.method === "PUT",
    );
    expect(saveCall).toBeDefined();
    const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
    expect(payload?.chapter).toEqual(
      expect.objectContaining({
        publicationStatus: "published",
        title: "Capitulo pendente",
      }),
    );
  });
  it("mostra o modal ao criar novo capitulo com alteracoes pendentes e preserva o capitulo salvo", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/2?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conte/i });
    openIdentityAccordion();
    fireEvent.change(document.getElementById("chapter-title-standard") as HTMLInputElement, {
      target: { value: "Capitulo 2 revisado antes do novo" },
    });

    fireEvent.click(screen.getByTestId("chapter-structure-add-chapter-2"));
    const leaveDialog = await findLeaveDialog();
    fireEvent.click(
      within(leaveDialog).getByRole("button", { name: /Salvar como rascunho e continuar/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
    });

    const chapterSaveCall = apiFetchMock.mock.calls.find(
      ([, path, options]) =>
        path === "/api/projects/project-ln-1/chapters/2?volume=2" && options?.method === "PUT",
    );
    expect(chapterSaveCall).toBeDefined();

    const createCall = apiFetchMock.mock.calls.find(
      ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
    );
    expect(createCall).toBeDefined();
    const createPayload = (createCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
    expect(createPayload?.episodeDownloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          number: 2,
          volume: 2,
          title: "Capitulo 2 revisado antes do novo",
        }),
        expect.objectContaining({
          number: 3,
          volume: 2,
          publicationStatus: "draft",
        }),
      ]),
    );
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
    openIdentityAccordion();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Capítulo 3" } });
    fireEvent.change(screen.getByLabelText("Capítulo"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "5" } });
    fireEvent.click(getTopActions().getByRole("button", { name: /Salvar altera/i }));
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=5");
  });

  it("preserva o volume atual na URL ao salvar um capítulo ambíguo quando a resposta volta sem volume", async () => {
    const ambiguousProject = buildProject({
      episodeDownloads: [
        {
          ...baseProject.episodeDownloads[0],
          number: 1,
          volume: 2,
          title: "Capítulo 1 - Volume 2",
        },
        {
          ...baseProject.episodeDownloads[0],
          number: 1,
          volume: 3,
          title: "Capítulo 1 - Volume 3",
          publicationStatus: "draft",
        },
      ],
    });
    setupApiMock({
      project: ambiguousProject,
      chapterSaveResponse: ({ nextChapter }) =>
        mockJsonResponse(true, {
          project: {
            ...ambiguousProject,
            revision: "rev-2",
            episodeDownloads: ambiguousProject.episodeDownloads.map((episode) =>
              Number(episode.number) === 1 && Number(episode.volume) === 2
                ? { ...episode, ...nextChapter }
                : episode,
            ),
          },
          chapter: {
            ...nextChapter,
            volume: undefined,
          },
        }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    openIdentityAccordion();
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Capítulo 1 revisado" },
    });
    fireEvent.click(getTopActions().getByRole("button", { name: /Salvar altera/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/1",
      );
      expect(screen.getByTestId("location-search").textContent).toBe("?volume=2");
    });
  });

  it("preserva ?volume=0 ao salvar um capítulo legado ambíguo quando a resposta volta sem volume", async () => {
    const zeroVolumeProject = buildProject({
      episodeDownloads: [
        {
          ...baseProject.episodeDownloads[0],
          number: 1,
          volume: 0,
          title: "Capítulo 1 - Volume 0",
        },
        {
          ...baseProject.episodeDownloads[0],
          number: 1,
          volume: 2,
          title: "Capítulo 1 - Volume 2",
          publicationStatus: "draft",
        },
      ],
    });
    setupApiMock({
      project: zeroVolumeProject,
      chapterSaveResponse: ({ nextChapter }) =>
        mockJsonResponse(true, {
          project: {
            ...zeroVolumeProject,
            revision: "rev-2",
            episodeDownloads: zeroVolumeProject.episodeDownloads.map((episode) =>
              Number(episode.number) === 1 && Number(episode.volume) === 0
                ? { ...episode, ...nextChapter, volume: 0 }
                : episode,
            ),
          },
          chapter: {
            ...nextChapter,
            volume: undefined,
          },
        }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=0");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    openIdentityAccordion();
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Capítulo 1 - legado revisado" },
    });
    fireEvent.click(getTopActions().getByRole("button", { name: /Salvar altera/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/1",
      );
      expect(screen.getByTestId("location-search").textContent).toBe("?volume=0");
    });
  });

  it("usa o volume salvo como hint canônico quando o usuário muda o volume e a resposta volta sem esse campo", async () => {
    setupApiMock({
      chapterSaveResponse: ({ nextChapter }) =>
        mockJsonResponse(true, {
          project: {
            ...baseProject,
            revision: "rev-2",
            episodeDownloads: baseProject.episodeDownloads.map((episode, index) =>
              index === 0
                ? {
                    ...episode,
                    ...nextChapter,
                    number: 3,
                    volume: undefined,
                  }
                : episode,
            ),
          },
          chapter: {
            ...nextChapter,
            number: 3,
            volume: undefined,
          },
        }),
    });
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    openIdentityAccordion();
    fireEvent.change(screen.getByLabelText("Capítulo"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "5" } });
    fireEvent.click(getTopActions().getByRole("button", { name: /Salvar altera/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
      expect(screen.getByTestId("location-search").textContent).toBe("?volume=5");
    });
  });

  it("salva como rascunho com persistência imediata pelo botão contextual", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/2?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    openIdentityAccordion();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Capítulo 2 revisado" } });
    fireEvent.click(getTopActions().getByRole("button", { name: /Salvar como rascunho/i }));

    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) =>
          path === "/api/projects/project-ln-1/chapters/2?volume=2" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(payload?.chapter).toEqual(
        expect.objectContaining({
          title: "Capítulo 2 revisado",
          publicationStatus: "draft",
        }),
      );
    });
  });

  it("publica um rascunho em um clique", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/2?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    fireEvent.click(getTopActions().getByRole("button", { name: /Publicar/i }));

    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) =>
          path === "/api/projects/project-ln-1/chapters/2?volume=2" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(payload?.chapter).toEqual(
        expect.objectContaining({
          publicationStatus: "published",
        }),
      );
    });
  });

  it("preserva o volume atual na URL ao alterar o status de um capítulo ambíguo quando a resposta volta sem volume", async () => {
    const ambiguousProject = buildProject({
      episodeDownloads: [
        {
          ...baseProject.episodeDownloads[0],
          number: 1,
          volume: 2,
          title: "Capítulo 1 - Volume 2",
          publicationStatus: "published",
        },
        {
          ...baseProject.episodeDownloads[0],
          number: 1,
          volume: 3,
          title: "Capítulo 1 - Volume 3",
          publicationStatus: "draft",
        },
      ],
    });
    setupApiMock({
      project: ambiguousProject,
      chapterSaveResponse: ({ nextChapter }) =>
        mockJsonResponse(true, {
          project: {
            ...ambiguousProject,
            revision: "rev-2",
            episodeDownloads: ambiguousProject.episodeDownloads.map((episode) =>
              Number(episode.number) === 1 && Number(episode.volume) === 2
                ? { ...episode, ...nextChapter }
                : episode,
            ),
          },
          chapter: {
            ...nextChapter,
            volume: undefined,
          },
        }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    fireEvent.click(getTopActions().getByRole("button", { name: /Mover para rascunho/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/1",
      );
      expect(screen.getByTestId("location-search").textContent).toBe("?volume=2");
    });
  });

  it("preserva ?volume=0 ao alterar o status de um capítulo legado ambíguo quando a resposta volta sem volume", async () => {
    const zeroVolumeProject = buildProject({
      episodeDownloads: [
        {
          ...baseProject.episodeDownloads[0],
          number: 1,
          volume: 0,
          title: "Capítulo 1 - Volume 0",
          publicationStatus: "published",
        },
        {
          ...baseProject.episodeDownloads[0],
          number: 1,
          volume: 2,
          title: "Capítulo 1 - Volume 2",
          publicationStatus: "draft",
        },
      ],
    });
    setupApiMock({
      project: zeroVolumeProject,
      chapterSaveResponse: ({ nextChapter }) =>
        mockJsonResponse(true, {
          project: {
            ...zeroVolumeProject,
            revision: "rev-2",
            episodeDownloads: zeroVolumeProject.episodeDownloads.map((episode) =>
              Number(episode.number) === 1 && Number(episode.volume) === 0
                ? { ...episode, ...nextChapter, volume: 0 }
                : episode,
            ),
          },
          chapter: {
            ...nextChapter,
            volume: undefined,
          },
        }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=0");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    fireEvent.click(getTopActions().getByRole("button", { name: /Mover para rascunho/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/1",
      );
      expect(screen.getByTestId("location-search").textContent).toBe("?volume=0");
    });
  });

  it("move um capítulo publicado para rascunho em um clique", async () => {
    setupApiMock();
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    fireEvent.click(getTopActions().getByRole("button", { name: /Mover para rascunho/i }));

    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) =>
          path === "/api/projects/project-ln-1/chapters/1?volume=2" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(payload?.chapter).toEqual(
        expect.objectContaining({
          publicationStatus: "draft",
        }),
      );
    });
  });

  it("salva pelo atalho Ctrl+S usando o fluxo manual", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/2?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    openIdentityAccordion();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Capítulo revisado" } });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) =>
          path === "/api/projects/project-ln-1/chapters/2?volume=2" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(payload?.chapter).toEqual(
        expect.objectContaining({
          title: "Capítulo revisado",
          publicationStatus: "draft",
        }),
      );
    });
  });

  it("abre um modal ao fechar capitulo com alteracoes nao salvas", async () => {
    setupApiMock();
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conte/i });
    openIdentityAccordion();
    fireEvent.change(document.getElementById("chapter-title-standard") as HTMLInputElement, {
      target: { value: "Capitulo pendente" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Fechar cap/i }));
    let leaveDialog = await findLeaveDialog();
    fireEvent.click(within(leaveDialog).getByRole("button", { name: /Cancelar/i }));
    await waitFor(() => {
      expect(screen.queryByTestId("chapter-unsaved-leave-dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos/1",
    );

    fireEvent.click(screen.getByRole("button", { name: /Fechar cap/i }));
    leaveDialog = await findLeaveDialog();
    fireEvent.click(within(leaveDialog).getByRole("button", { name: /Descartar e continuar/i }));

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
    openIdentityAccordion();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Capítulo pendente" } });
    fireEvent.click(screen.getByRole("button", { name: /Excluir capítulo/i }));
    expect(screen.getByRole("heading", { name: /Excluir capítulo\?/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /As alterações atuais da página serão aplicadas imediatamente junto com a exclusão\./i,
      ),
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
    const fileInput = document.getElementById(
      "chapter-editor-epub-import-file",
    ) as HTMLInputElement;
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

  it("usa a quantidade de capítulos importados quando o payload EPUB não retorna summary", async () => {
    const project = buildProject();
    setupApiMock({
      epubImportResponse: mockJsonResponse(true, {
        chapters: [
          {
            ...project.episodeDownloads[1],
            number: 3,
            title: "Capítulo importado A",
            content:
              '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
            publicationStatus: "draft",
          },
          {
            ...project.episodeDownloads[1],
            number: 4,
            title: "Capítulo importado B",
            content:
              '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
            publicationStatus: "draft",
          },
        ],
        volumeCovers: [],
      }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-epub-tools");
    const fileInput = document.getElementById(
      "chapter-editor-epub-import-file",
    ) as HTMLInputElement;
    const file = new File(["epub"], "sem-summary.epub", { type: "application/epub+zip" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(
      within(screen.getByTestId("chapter-epub-tools")).getByRole("button", {
        name: "Importar EPUB",
      }),
    );
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "EPUB importado",
          description: "2 capítulo(s) incorporados ao projeto.",
          intent: "success",
        }),
      );
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
    const fileInput = document.getElementById(
      "chapter-editor-epub-import-file",
    ) as HTMLInputElement;
    const file = new File(["epub"], "novo.epub", { type: "application/epub+zip" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(
      within(screen.getByTestId("chapter-epub-tools")).getByRole("button", {
        name: "Importar EPUB",
      }),
    );
    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some(([, path]) => path === "/api/projects/epub/import/jobs"),
      ).toBe(true);
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
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
    });
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
    const fileInput = document.getElementById(
      "chapter-editor-epub-import-file",
    ) as HTMLInputElement;
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
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(anchorClick);

    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-epub-tools");
    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    await screen.findByTestId("chapter-volume-editor");
    openVolumeAccordion();
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
      expect(body.project.episodeDownloads[0].content).toBe(
        baseProject.episodeDownloads[0].content,
      );
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
            document.querySelector<HTMLElement>("[data-testid='location-pathname']")?.textContent ||
            "";
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
