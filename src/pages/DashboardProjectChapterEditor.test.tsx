import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectEpisode, ProjectVolumeCover, ProjectVolumeEntry } from "@/data/projects";
import DashboardProjectChapterEditor from "@/pages/DashboardProjectChapterEditor";

const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
const originalHasPointerCapture = window.HTMLElement.prototype.hasPointerCapture;
const originalSetPointerCapture = window.HTMLElement.prototype.setPointerCapture;
const originalReleasePointerCapture = window.HTMLElement.prototype.releasePointerCapture;

const {
  apiFetchMock,
  asyncStatePropsSpy,
  toastMock,
  lexicalEditorPropsSpy,
  imageLibraryPropsSpy,
  mangaWorkflowPropsSpy,
  refetchPublicBootstrapCacheMock,
} = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  asyncStatePropsSpy: vi.fn(),
  toastMock: vi.fn(),
  lexicalEditorPropsSpy: vi.fn(),
  imageLibraryPropsSpy: vi.fn(),
  mangaWorkflowPropsSpy: vi.fn(),
  refetchPublicBootstrapCacheMock: vi.fn(async () => undefined),
}));

vi.mock("@/hooks/use-public-bootstrap", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-public-bootstrap")>();
  return {
    ...actual,
    refetchPublicBootstrapCache: refetchPublicBootstrapCacheMock,
  };
});

vi.mock("@/components/DashboardShell", () => ({
  default: ({
    children,
    onUserCardClick,
  }: {
    children: ReactNode;
    onUserCardClick?: () => void;
  }) => (
    <div>
      <button type="button" data-testid="dashboard-shell-user-card" onClick={onUserCardClick}>
        Abrir usuario
      </button>
      {children}
    </div>
  ),
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
  const React = await vi.importActual<typeof import("react")>("react");
  const actual =
    await importOriginal<typeof import("@/components/project-reader/MangaWorkflowPanel")>();
  return {
    ...actual,
    default: React.forwardRef(function MockMangaWorkflowPanel(
      props: {
        project?: {
          id?: string;
          revision?: string;
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
        onPersistProjectSnapshot?: (
          snapshot: Record<string, unknown>,
          options: { context: string },
        ) => Promise<Record<string, unknown> | null>;
        onProjectChange?: (project: unknown) => void;
        onSelectedStageChapterChange?: (chapter: unknown) => void;
        onOpenImportedChapter?: (project: unknown, chapters: unknown[]) => void;
      },
      ref: React.ForwardedRef<{
        hasUnsavedChanges: () => boolean;
        savePreparedChaptersAsDraft: () => Promise<boolean>;
        discardPreparedChapters: () => void;
      }>,
    ) {
      const [isStageDirty, setIsStageDirty] = React.useState(false);
      mangaWorkflowPropsSpy(props);
      const pendingChapter = {
        id: "stage-1",
        number: 7,
        synopsis: "",
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
        entryKind: "main",
        entrySubtype: "chapter",
        publicationStatus: "draft",
        progressStage: "aguardando-raw",
        completedStages: [],
        operation: "create",
        warnings: [],
      };
      const pendingChapterNewVolume = {
        ...pendingChapter,
        id: "stage-2",
        volume: 5,
        title: "Capítulo pendente novo volume",
      };
      const pristineManualChapter = {
        ...pendingChapter,
        id: "stage-pristine",
        number: 11,
        title: "Capítulo manual vazio",
        pages: [],
        coverPageId: null,
        leaveGuardPristine: true,
      };
      React.useImperativeHandle(
        ref,
        () => ({
          hasUnsavedChanges: () => isStageDirty,
          savePreparedChaptersAsDraft: async () => {
            const nextProject = {
              ...(props.project || {}),
              episodeDownloads: [
                ...((props.project?.episodeDownloads || []) as Array<Record<string, unknown>>),
                {
                  number: 7,
                  volume: 1,
                  title: "Capítulo pendente",
                  synopsis: "",
                  releaseDate: "",
                  duration: "",
                  sourceType: "Web",
                  sources: [],
                  content: "",
                  contentFormat: "images",
                  pages: [{ position: 1, imageUrl: "/uploads/manga/pending-01.jpg" }],
                  pageCount: 1,
                  hasPages: true,
                  publicationStatus: "draft",
                  coverImageUrl: "/uploads/manga/pending-01.jpg",
                  coverImageAlt: "",
                },
              ],
            };
            const persistedProject =
              (await props.onPersistProjectSnapshot?.(nextProject, {
                context: "manga-import",
              })) || null;
            if (!persistedProject) {
              return false;
            }
            props.onProjectChange?.(persistedProject);
            props.setStagedChapters?.([]);
            props.setSelectedStageChapterId?.(null);
            props.onSelectedStageChapterChange?.(null);
            setIsStageDirty(false);
            return true;
          },
          discardPreparedChapters: () => {
            props.setStagedChapters?.([]);
            props.setSelectedStageChapterId?.(null);
            props.onSelectedStageChapterChange?.(null);
            setIsStageDirty(false);
          },
        }),
        [isStageDirty, props],
      );
      return (
        <div data-testid="manga-workflow-panel">
          <button
            type="button"
            data-testid="mock-stage-add"
            onClick={() => {
              props.setStagedChapters?.([pendingChapter]);
              props.setSelectedStageChapterId?.("stage-1");
              props.onSelectedStageChapterChange?.(pendingChapter);
              setIsStageDirty(true);
            }}
          >
            Adicionar pendente
          </button>
          <button
            type="button"
            data-testid="mock-stage-add-pristine"
            onClick={() => {
              props.setStagedChapters?.([pristineManualChapter]);
              props.setSelectedStageChapterId?.("stage-pristine");
              props.onSelectedStageChapterChange?.(pristineManualChapter);
              setIsStageDirty(false);
            }}
          >
            Adicionar pendente limpo
          </button>
          <button
            type="button"
            data-testid="mock-stage-edit-selected"
            onClick={() => {
              props.setStagedChapters?.([
                {
                  ...pristineManualChapter,
                  volume: 2,
                  leaveGuardPristine: false,
                },
              ]);
              props.setSelectedStageChapterId?.("stage-pristine");
              props.onSelectedStageChapterChange?.({
                ...pristineManualChapter,
                volume: 2,
                leaveGuardPristine: false,
              });
              setIsStageDirty(true);
            }}
          >
            Editar pendente limpo
          </button>
          <button
            type="button"
            data-testid="mock-stage-add-new-volume"
            onClick={() => {
              props.setStagedChapters?.([pendingChapterNewVolume]);
              props.setSelectedStageChapterId?.("stage-2");
              props.onSelectedStageChapterChange?.(pendingChapterNewVolume);
              setIsStageDirty(true);
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
          <div data-testid="mock-stage-dirty">{isStageDirty ? "dirty" : "clean"}</div>
          <div data-testid="mock-stage-count">{props.stagedChapters?.length || 0}</div>
          <div data-testid="mock-stage-selected">{props.selectedStageChapterId || ""}</div>
        </div>
      );
    }),
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

type ChapterEditorTestProject = {
  id: string;
  revision: string;
  title: string;
  titleOriginal: string;
  titleEnglish: string;
  synopsis: string;
  description: string;
  type: string;
  status: string;
  year: string;
  studio: string;
  episodes: string;
  tags: string[];
  genres: string[];
  cover: string;
  banner: string;
  season: string;
  schedule: string;
  rating: string;
  country: string;
  source: string;
  producers: string[];
  score: number | null;
  startDate: string;
  endDate: string;
  relations: unknown[];
  staff: unknown[];
  animeStaff: unknown[];
  trailerUrl: string;
  forceHero: boolean;
  heroImageUrl: string;
  heroImageAlt: string;
  volumeEntries: ProjectVolumeEntry[];
  volumeCovers: ProjectVolumeCover[];
  views: number;
  commentsCount: number;
  order: number;
  episodeDownloads: ProjectEpisode[];
};

const getLastItem = <T,>(items: readonly T[]) =>
  items.length > 0 ? items[items.length - 1] : undefined;

const getLastPathSegment = (path: string) => {
  const segments = path.split("/");
  return segments[segments.length - 1] || "";
};

const baseProject: ChapterEditorTestProject = {
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

const buildProject = (
  overrides: Partial<ChapterEditorTestProject> = {},
): ChapterEditorTestProject => ({
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

const buildAmbiguousRouteSaveProject = () =>
  buildProject({
    episodeDownloads: [
      {
        ...baseProject.episodeDownloads[0],
        number: 3,
        volume: undefined,
        title: "Capítulo 3 sem volume",
        publicationStatus: "published",
      },
      ...baseProject.episodeDownloads,
    ],
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
        <Route
          path="/dashboard/projetos/:projectId"
          element={
            <>
              <div data-testid="project-editor-page" />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/dashboard/projetos"
          element={
            <>
              <div data-testid="project-editor-page" />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/dashboard/usuarios"
          element={
            <>
              <div data-testid="dashboard-users-page" />
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
const findVolumeRequiredSaveDialog = () =>
  screen.findByTestId("chapter-save-volume-required-dialog");
const hasChapterSaveRequest = () =>
  apiFetchMock.mock.calls.some(
    ([, path, options]) =>
      /^\/api\/projects\/project-ln-1\/chapters\//.test(String(path || "")) &&
      options?.method === "PUT",
  );
const getStructureGroupChapterOrder = (groupKey: string) => {
  const group = screen.getByTestId(`chapter-structure-group-${groupKey}`);
  return Array.from(
    group.querySelectorAll<HTMLElement>("[data-testid^='chapter-structure-episode-open-']"),
  )
    .map((element) => element.dataset.testid || "")
    .filter(
      (testId) => testId.includes("chapter-structure-episode-open-") && !testId.includes("-icon-"),
    )
    .map((testId) => testId.replace("chapter-structure-episode-open-", ""));
};

const setupApiMock = ({
  permissions = ["projetos"],
  currentUserOverrides,
  project = buildProject(),
  projectStatus = 200,
  contractOk = true,
  capabilities,
  chapterSaveResponse,
  projectSaveResponse,
  epubImportResponse,
  epubImportJobCreateResponse,
  epubImportJobStatusResponse,
  epubExportResponse,
}: {
  permissions?: string[];
  currentUserOverrides?: Record<string, unknown>;
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
    | Promise<Response>
    | ((context: {
        path: string;
        payload: Record<string, unknown>;
        chapterNumber: number;
        chapterVolume: number | undefined;
        currentChapter: (typeof project.episodeDownloads)[number];
        nextChapter: Record<string, unknown>;
      }) => Response | Promise<Response>);
  projectSaveResponse?:
    | Response
    | Promise<Response>
    | ((context: {
        path: string;
        payload: Record<string, unknown>;
        project: ReturnType<typeof buildProject>;
      }) => Response | Promise<Response>);
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
          ...currentUserOverrides,
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
        if (projectSaveResponse) {
          return typeof projectSaveResponse === "function"
            ? projectSaveResponse({
                path,
                payload,
                project,
              })
            : projectSaveResponse;
        }
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
          return epubImportJobStatusResponse(getLastPathSegment(path));
        }
        return (
          epubImportJobStatusResponse ||
          mockJsonResponse(true, {
            job: {
              id: getLastPathSegment(path) || "job-1",
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
    refetchPublicBootstrapCacheMock.mockReset();
    refetchPublicBootstrapCacheMock.mockResolvedValue(undefined);
    vi.stubGlobal("open", vi.fn());
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    vi.stubGlobal("scrollBy", vi.fn());
    window.URL.createObjectURL = vi.fn(() => "blob:epub");
    window.URL.revokeObjectURL = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window.HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: vi.fn(() => false),
    });
    Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: originalScrollIntoView,
    });
    Object.defineProperty(window.HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: originalHasPointerCapture,
    });
    Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: originalSetPointerCapture,
    });
    Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: originalReleasePointerCapture,
    });
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
    expect(screen.queryByTestId("chapter-editor-status-meta-group")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-editor-status-pill-chapter")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-editor-status-pill-reading")).not.toBeInTheDocument();
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

    const initialWorkflowProps = getLastItem(mangaWorkflowPropsSpy.mock.calls)?.[0] as {
      filteredChapters?: Array<{ title?: string }>;
      filterMode?: string;
    };
    expect(initialWorkflowProps.filterMode).toBe("all");
    expect(initialWorkflowProps.filteredChapters).toHaveLength(2);

    fireEvent.change(within(screen.getByTestId("chapter-structure-section")).getByRole("textbox"), {
      target: { value: "publicado" },
    });

    await waitFor(() => {
      const latestWorkflowProps = getLastItem(mangaWorkflowPropsSpy.mock.calls)?.[0] as {
        filteredChapters?: Array<{ title?: string }>;
      };
      expect(latestWorkflowProps.filteredChapters).toHaveLength(1);
      expect(latestWorkflowProps.filteredChapters?.[0]?.title).toBe("Capítulo publicado");
    });
  });

  it("mostra reordenacao na estrutura e abre a leitura publicada em nova aba", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        episodeDownloads: [
          {
            number: 3,
            volume: 1,
            title: "Capítulo em imagem",
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
            title: "Capítulo lexical",
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
            title: "Capítulo sem páginas",
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
            title: "Capítulo volume 2 sem exportação",
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
    const openMock = vi.mocked(window.open);
    openMock.mockClear();

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
    expect(screen.getByTestId("chapter-structure-episode-move-up-3:1")).toBeDisabled();
    expect(screen.getByTestId("chapter-structure-episode-move-down-3:1")).toBeEnabled();
    expect(
      screen.queryByTestId("chapter-structure-episode-export-zip-3:1"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-open-icon-3:1")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("chapter-structure-episode-header-3:1")).getByText(
        "Capítulo em imagem",
      ),
    ).toHaveClass("line-clamp-2");
    expect(screen.getByTestId("chapter-structure-episode-footer-4:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-meta-4:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-actions-4:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-move-up-4:1")).toBeEnabled();
    expect(screen.getByTestId("chapter-structure-episode-move-down-4:1")).toBeEnabled();
    expect(
      screen.queryByTestId("chapter-structure-episode-export-zip-4:1"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-structure-episode-open-icon-4:1")).not.toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-footer-5:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-meta-5:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-actions-5:1")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-move-up-5:1")).toBeEnabled();
    expect(screen.getByTestId("chapter-structure-episode-move-down-5:1")).toBeDisabled();
    expect(
      screen.queryByTestId("chapter-structure-episode-export-zip-5:1"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-structure-episode-open-icon-5:1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("chapter-structure-group-toggle-2"));
    expect(screen.getByTestId("chapter-structure-episode-actions-6:2")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-move-up-6:2")).toBeDisabled();
    expect(screen.getByTestId("chapter-structure-episode-move-down-6:2")).toBeDisabled();
    expect(
      screen.queryByTestId("chapter-structure-episode-export-zip-6:2"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("chapter-structure-episode-open-icon-6:2")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-stage-add"));
    await screen.findByTestId("chapter-structure-stage-select-stage-1");
    expect(screen.queryByTestId("chapter-structure-episode-move-up-7:1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-structure-episode-move-down-7:1")).not.toBeInTheDocument();

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

    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/dashboard/projetos/project-ln-1/capitulos",
    );

    fireEvent.click(screen.getByTestId("chapter-structure-episode-open-icon-3:1"));

    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/dashboard/projetos/project-ln-1/capitulos",
    );
    expect(openMock).toHaveBeenCalledWith(
      "/projeto/project-ln-1/leitura/3?volume=1",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("abre o capitulo ao clicar no rodape do card na sidebar", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    fireEvent.click(screen.getByTestId("chapter-structure-episode-footer-1:2"));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/1",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=2");
  });

  it("reordena capitulos de light novel na sidebar de forma otimista e renormaliza readingOrder", async () => {
    let capturedProjectPayload: Record<string, unknown> | null = null;
    const projectSaveState = {
      resolve: null as ((value: Response) => void) | null,
    };
    const pendingProjectSave = new Promise<Response>((resolve) => {
      projectSaveState.resolve = resolve;
    });
    setupApiMock({
      projectSaveResponse: ({ payload }) => {
        capturedProjectPayload = payload;
        return pendingProjectSave;
      },
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    expect(screen.getByTestId("chapter-structure-episode-move-up-1:2")).toBeDisabled();
    expect(screen.getByTestId("chapter-structure-episode-move-down-1:2")).toBeEnabled();
    expect(screen.getByTestId("chapter-structure-episode-move-up-2:2")).toBeEnabled();
    expect(screen.getByTestId("chapter-structure-episode-move-down-2:2")).toBeDisabled();
    expect(getStructureGroupChapterOrder("2")).toEqual(["1:2", "2:2"]);

    fireEvent.click(screen.getByTestId("chapter-structure-episode-move-up-2:2"));

    await waitFor(() => {
      expect(getStructureGroupChapterOrder("2")).toEqual(["2:2", "1:2"]);
    });
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos",
    );

    await waitFor(() => {
      expect(
        (
          (capturedProjectPayload?.episodeDownloads as
            | Array<Record<string, unknown>>
            | undefined) || []
        ).map((episode) => ({
          number: episode.number,
          volume: episode.volume,
          readingOrder: episode.readingOrder,
        })),
      ).toEqual([
        { number: 2, volume: 2, readingOrder: 1 },
        { number: 1, volume: 2, readingOrder: 2 },
      ]);
    });

    const completeProjectSave = projectSaveState.resolve;
    if (!completeProjectSave) {
      throw new Error("Expected pending project save");
    }
    completeProjectSave(
      mockJsonResponse(true, {
        project: {
          ...buildProject(),
          ...(capturedProjectPayload || {}),
          revision: "rev-3",
        },
      }),
    );

    await waitFor(() => {
      expect(getStructureGroupChapterOrder("2")).toEqual(["2:2", "1:2"]);
    });
  });

  it("restaura a ordem anterior na sidebar quando a reordenacao falha", async () => {
    const projectSaveState = {
      resolve: null as ((value: Response) => void) | null,
    };
    const pendingProjectSave = new Promise<Response>((resolve) => {
      projectSaveState.resolve = resolve;
    });
    setupApiMock({
      projectSaveResponse: pendingProjectSave,
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    expect(getStructureGroupChapterOrder("2")).toEqual(["1:2", "2:2"]);

    fireEvent.click(screen.getByTestId("chapter-structure-episode-move-up-2:2"));

    await waitFor(() => {
      expect(getStructureGroupChapterOrder("2")).toEqual(["2:2", "1:2"]);
    });

    const failProjectSave = projectSaveState.resolve;
    if (!failProjectSave) {
      throw new Error("Expected pending project save");
    }
    failProjectSave(mockJsonResponse(false, { error: "save_failed" }, 500));

    await waitFor(() => {
      expect(getStructureGroupChapterOrder("2")).toEqual(["1:2", "2:2"]);
    });
  });

  it("reordena capitulos extras de manga na sidebar", async () => {
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
          {
            number: 99,
            volume: 1,
            title: "Side Story",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            entryKind: "extra",
            entrySubtype: "chapter",
            displayLabel: "Extra",
            content: "",
            contentFormat: "images",
            pages: [{ position: 1, imageUrl: "/uploads/manga/extra-01.jpg" }],
            pageCount: 1,
            hasPages: true,
            publicationStatus: "draft",
            coverImageUrl: "/uploads/manga/extra-01.jpg",
            coverImageAlt: "",
          },
        ],
      }),
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("manga-workflow-panel");

    fireEvent.click(screen.getByTestId("chapter-structure-episode-move-up-99:1"));

    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(
        ((payload?.episodeDownloads as Array<Record<string, unknown>> | undefined) || []).map(
          (episode) => ({
            number: episode.number,
            volume: episode.volume,
            readingOrder: episode.readingOrder,
            entryKind: episode.entryKind,
          }),
        ),
      ).toEqual([
        { number: 99, volume: 1, readingOrder: 1, entryKind: "extra" },
        { number: 1, volume: 1, readingOrder: 2, entryKind: "main" },
      ]);
    });
  });

  it("abre o leave guard antes de reordenar capítulos com alterações pendentes", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/2?volume=2");
    await screen.findByTestId("mock-lexical");

    openIdentityAccordion();
    fireEvent.change(document.getElementById("chapter-title-standard") as HTMLInputElement, {
      target: { value: "Capítulo 2 alterado" },
    });

    fireEvent.click(screen.getByTestId("chapter-structure-episode-move-up-2:2"));

    const leaveDialog = await findLeaveDialog();
    expect(leaveDialog).toBeInTheDocument();
    fireEvent.click(within(leaveDialog).getByRole("button", { name: /Cancelar/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("chapter-unsaved-leave-dialog")).not.toBeInTheDocument();
    });
    expect(
      apiFetchMock.mock.calls.some(
        ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
      ),
    ).toBe(false);
  });

  it("reordena capitulos extras de manga na sidebar", async () => {
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
          {
            number: 99,
            volume: 1,
            title: "Side Story",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            entryKind: "extra",
            entrySubtype: "chapter",
            displayLabel: "Extra",
            content: "",
            contentFormat: "images",
            pages: [{ position: 1, imageUrl: "/uploads/manga/extra-01.jpg" }],
            pageCount: 1,
            hasPages: true,
            publicationStatus: "draft",
            coverImageUrl: "/uploads/manga/extra-01.jpg",
            coverImageAlt: "",
          },
        ],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("manga-workflow-panel");

    fireEvent.click(screen.getByTestId("chapter-structure-episode-move-up-99:1"));

    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) => path === "/api/projects/project-ln-1" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(
        ((payload?.episodeDownloads as Array<Record<string, unknown>> | undefined) || []).map(
          (episode) => ({
            number: episode.number,
            volume: episode.volume,
            readingOrder: episode.readingOrder,
            entryKind: episode.entryKind,
          }),
        ),
      ).toEqual([
        { number: 99, volume: 1, readingOrder: 1, entryKind: "extra" },
        { number: 1, volume: 1, readingOrder: 2, entryKind: "main" },
      ]);
    });
  });

  it("abre a leitura publicada de light novel em nova aba pelo card da sidebar", async () => {
    setupApiMock();
    const openMock = vi.mocked(window.open);
    openMock.mockClear();

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    expect(screen.getByTestId("chapter-structure-episode-open-icon-1:2")).toBeInTheDocument();
    expect(screen.queryByTestId("chapter-structure-episode-open-icon-2:2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("chapter-structure-episode-open-icon-1:2"));

    expect(openMock).toHaveBeenCalledWith(
      "/projeto/project-ln-1/leitura/1?volume=2",
      "_blank",
      "noopener,noreferrer",
    );
    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/dashboard/projetos/project-ln-1/capitulos",
    );
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

  it("abre o capítulo importado no editor e mostra as ações de publicação", async () => {
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

  it("não abre modal ao sair com capítulo manual vazio ainda intocado no workflow de mangá", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        episodeDownloads: [],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("manga-workflow-panel");

    fireEvent.click(screen.getByTestId("mock-stage-add-pristine"));
    fireEvent.click(screen.getByTestId("dashboard-shell-user-card"));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe("/dashboard/usuarios");
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?edit=me");
    expect(screen.getByTestId("dashboard-users-page")).toBeInTheDocument();
    expect(screen.queryByTestId("chapter-unsaved-leave-dialog")).not.toBeInTheDocument();
  });

  it("protege a saída da rota quando o workflow de mangá tem alterações não salvas", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        episodeDownloads: [],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("manga-workflow-panel");

    fireEvent.click(screen.getByTestId("mock-stage-add"));
    fireEvent.click(screen.getByTestId("dashboard-shell-user-card"));

    let leaveDialog = await findLeaveDialog();
    fireEvent.click(within(leaveDialog).getByRole("button", { name: /Cancelar/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("chapter-unsaved-leave-dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("location-pathname")).toHaveTextContent(
      "/dashboard/projetos/project-ln-1/capitulos",
    );

    fireEvent.click(screen.getByTestId("dashboard-shell-user-card"));
    leaveDialog = await findLeaveDialog();
    fireEvent.click(
      within(leaveDialog).getByRole("button", { name: /Salvar como rascunho e continuar/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe("/dashboard/usuarios");
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?edit=me");
    expect(screen.getByTestId("dashboard-users-page")).toBeInTheDocument();

    const stageSaveCall = apiFetchMock.mock.calls.find(([, path, options]) => {
      if (path !== "/api/projects/project-ln-1" || options?.method !== "PUT") {
        return false;
      }
      const payload = (options as { json?: Record<string, unknown> } | undefined)?.json;
      return Array.isArray(payload?.episodeDownloads) && payload.episodeDownloads.length > 0;
    });
    expect(stageSaveCall).toBeDefined();
    const payload = (stageSaveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
    expect(payload?.episodeDownloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          number: 7,
          volume: 1,
          publicationStatus: "draft",
        }),
      ]),
    );
  });

  it("descarta o lote preparado ao sair do editor de manga pelo modal", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        episodeDownloads: [],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("manga-workflow-panel");

    fireEvent.click(screen.getByTestId("mock-stage-add"));
    expect(screen.getByTestId("mock-stage-dirty")).toHaveTextContent("dirty");

    fireEvent.click(screen.getByTestId("dashboard-shell-user-card"));
    const leaveDialog = await findLeaveDialog();
    fireEvent.click(within(leaveDialog).getByRole("button", { name: /Descartar e continuar/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe("/dashboard/usuarios");
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?edit=me");
    expect(screen.getByTestId("dashboard-users-page")).toBeInTheDocument();
  });

  it("registra beforeunload quando o workflow de manga esta dirty", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        episodeDownloads: [],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("manga-workflow-panel");

    fireEvent.click(screen.getByTestId("mock-stage-add"));

    const beforeUnloadEvent = new Event("beforeunload", {
      cancelable: true,
    }) as BeforeUnloadEvent;
    window.dispatchEvent(beforeUnloadEvent);

    expect(beforeUnloadEvent.defaultPrevented).toBe(true);
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
    const identityCard = screen.getByTestId("chapter-identity-accordion");
    const identitySection = screen.getByTestId("chapter-identity-section");
    const identityTrigger = screen.getByTestId("chapter-identity-trigger");
    const topRow = screen.getByTestId("chapter-workspace-top-row");
    const asideColumn = screen.queryByTestId("chapter-workspace-aside-column");
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
    expect(structureTrigger).toHaveClass("hover:no-underline", "py-3.5", "md:py-4");
    expect(screen.getByText("Estrutura")).toBeInTheDocument();
    expect(screen.getByText(/Volumes, filtros, navega/i)).toBeInTheDocument();
    expect(identityCard).toHaveTextContent(/Dados|Identidade do cap/i);
    expect(screen.getByText(/numera/i)).toBeInTheDocument();
    expect(identityTrigger).toHaveAttribute("aria-expanded", "false");
    expect(identitySection).toHaveAttribute("data-state", "open");
    expect(screen.queryByTestId("chapter-volume-accordion")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-volume-trigger")).not.toBeInTheDocument();
    expect(topRow).toContainElement(identityCard);
    expect(asideColumn).toBeNull();
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
    expect(screen.queryByLabelText(/Ordem de leitura/i)).not.toBeInTheDocument();
    expect(document.getElementById("chapter-synopsis-standard") as HTMLTextAreaElement).toHaveClass(
      "w-full",
      "app-textarea",
      "resize-none",
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
          title: "Capítulo em imagem",
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
          coverImageAlt: "Capa do capítulo em imagem",
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
    const progressCard = screen.getByTestId("chapter-progress-section");
    const contentCard = screen.getByTestId("chapter-content-accordion");
    expect(Array.from(workspace.children)).toEqual([topRow, contentCard]);
    expect(Array.from(topRow.children)).toEqual([identityCard, progressCard]);
    expect(screen.queryByTestId("chapter-publication-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-workspace-support-row")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-cover-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-sources-section")).not.toBeInTheDocument();
    expect(within(identityCard).getByText(/Dados do cap/i)).toBeInTheDocument();
    expect(within(progressCard).getByText("Em progresso")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-progress-percent")).toHaveTextContent("0%");
    expect(screen.getByTestId("chapter-progress-stage-track")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-progress-stage-list")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-progress-stage-chip-aguardando-raw")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Aguardando Raw: atual/i),
    );
    const currentStageBadge = within(progressCard)
      .getAllByText("Atual")
      .find((element) => String((element as HTMLElement).className || "").includes("rounded-full"));
    expect(currentStageBadge).toHaveClass(
      "border-[hsl(var(--badge-info-border))]",
      "bg-[hsl(var(--badge-info-bg))]",
      "text-[hsl(var(--badge-info-fg))]",
    );
    expect(within(contentCard).getByRole("heading", { name: /Páginas/i })).toBeInTheDocument();
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
    expect(screen.getByLabelText(/Sinopse/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sinopse/i)).toHaveValue("");
    expect(screen.queryByTestId("manga-pages-utilities-trigger")).not.toBeInTheDocument();
    expect(screen.getByTestId("manga-pages-export-actions")).toBeInTheDocument();
    expect(screen.getByTestId("manga-pages-sources")).toBeInTheDocument();
    expect(
      getTopActions().getByRole("button", { name: /Salvar como rascunho/i }),
    ).toBeInTheDocument();
    expect(getTopActions().getByRole("button", { name: /Publicar/i })).toBeInTheDocument();
    expect(screen.queryByTestId("chapter-editor-footer-actions")).not.toBeInTheDocument();
  });

  it("renderiza e persiste o progresso no painel de light novel", async () => {
    setupApiMock({
      project: buildProject({
        episodeDownloads: [
          baseProject.episodeDownloads[0],
          {
            ...baseProject.episodeDownloads[1],
            completedStages: ["aguardando-raw", "traducao"],
            progressStage: "qualquer-coisa",
          },
        ],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos/2?volume=2");
    await screen.findByTestId("mock-lexical");

    const statusBar = screen.getByTestId("chapter-editor-status-bar");
    const positionPill = within(statusBar).getByTestId("chapter-editor-status-position-badge");
    expect(positionPill).toHaveTextContent(/\d+ de \d+/i);
    expect(within(statusBar).getByTestId("chapter-editor-status-meta-group")).toBeInTheDocument();
    const chapterPill = within(statusBar).getByTestId("chapter-editor-status-pill-chapter");
    const readingPill = within(statusBar).getByTestId("chapter-editor-status-pill-reading");
    expect(within(statusBar).getByTestId("chapter-editor-status-pill-chapter")).toHaveTextContent(
      /Cap[ií]tulo 2/i,
    );
    expect(within(statusBar).getByTestId("chapter-editor-status-pill-reading")).toHaveTextContent(
      "Sem leitura",
    );
    expect(positionPill).toHaveClass(
      "project-editor-status-bar__pill",
      "project-editor-status-bar__pill--position",
    );
    expect(chapterPill).toHaveClass(
      "project-editor-status-bar__pill",
      "project-editor-status-bar__pill--chapter",
    );
    expect(readingPill).toHaveClass(
      "project-editor-status-bar__pill",
      "project-editor-status-bar__pill--reading",
    );

    expect(screen.getByTestId("chapter-progress-percent")).toHaveTextContent("29%");
    expect(screen.getByTestId("chapter-progress-stage-chip-limpeza")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Limpeza: atual/i),
    );

    fireEvent.click(screen.getByTestId("chapter-progress-toggle-limpeza"));

    expect(screen.getByTestId("chapter-progress-percent")).toHaveTextContent("43%");
    expect(screen.getByTestId("chapter-progress-stage-chip-redrawing")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Redrawing: atual/i),
    );

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
          completedStages: ["aguardando-raw", "traducao", "limpeza"],
          progressStage: "redrawing",
        }),
      );
    });
    expect(refetchPublicBootstrapCacheMock).toHaveBeenCalledTimes(1);
  });

  it("usa o seletor de fonte ao salvar links de download em light novel", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/2?volume=2");

    await screen.findByTestId("mock-lexical");

    const sourcesSection = screen.getByTestId("chapter-sources-section");
    fireEvent.click(within(sourcesSection).getByRole("button", { name: /^Adicionar$/i }));

    const sourceTrigger = await waitFor(() =>
      within(screen.getByTestId("chapter-sources-section")).getByRole("combobox", {
        name: "Fonte 1",
      }),
    );
    const sourceUrlInput = within(
      screen.getByTestId("chapter-sources-section"),
    ).getByPlaceholderText("URL");
    expect(sourceUrlInput).toBeDisabled();

    fireEvent.click(sourceTrigger);
    fireEvent.click(await screen.findByRole("option", { name: /^Google Drive$/i }));
    await waitFor(() => {
      expect(
        within(screen.getByTestId("chapter-sources-section")).getByPlaceholderText("URL"),
      ).not.toBeDisabled();
    });

    fireEvent.change(
      within(screen.getByTestId("chapter-sources-section")).getByPlaceholderText("URL"),
      {
        target: { value: "https://example.com/capitulo-2-google-drive" },
      },
    );
    await waitFor(() => {
      expect(getTopActions().getByRole("button", { name: /Salvar como rascunho/i })).toBeEnabled();
    });
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
          sources: [
            {
              label: "Google Drive",
              url: "https://example.com/capitulo-2-google-drive",
            },
          ],
        }),
      );
    });
    expect(refetchPublicBootstrapCacheMock).toHaveBeenCalledTimes(1);
  });

  it("renderiza e persiste o progresso no painel de manga em imagem", async () => {
    setupApiMock({
      project: buildProject({
        type: "Manga",
        title: "Projeto Manga",
        episodeDownloads: [
          {
            number: 3,
            volume: 1,
            title: "Capítulo em imagem",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            progressStage: "aguardando-raw",
            completedStages: ["aguardando-raw"],
            content: "",
            contentFormat: "images",
            publicationStatus: "draft",
            coverImageUrl: "https://cdn.test/page-1.jpg",
            coverImageAlt: "Capa do capítulo em imagem",
            pages: [
              { position: 1, imageUrl: "https://cdn.test/page-1.jpg" },
              { position: 2, imageUrl: "https://cdn.test/page-2.jpg" },
            ],
            pageCount: 2,
            hasPages: true,
          },
        ],
      }),
    });

    renderEditor("/dashboard/projetos/project-ln-1/capitulos/3?volume=1");
    await screen.findByTestId("manga-chapter-pages-editor");

    const statusBar = screen.getByTestId("chapter-editor-status-bar");
    const positionPill = within(statusBar).getByTestId("chapter-editor-status-position-badge");
    expect(positionPill).toHaveTextContent(/\d+ de \d+/i);
    expect(within(statusBar).getByTestId("chapter-editor-status-meta-group")).toBeInTheDocument();
    expect(within(statusBar).getByTestId("chapter-editor-status-pill-chapter")).toHaveTextContent(
      /Cap[ií]tulo 3/i,
    );
    expect(within(statusBar).getByTestId("chapter-editor-status-pill-reading")).toHaveTextContent(
      "Com leitura",
    );
    const chapterPill = within(statusBar).getByTestId("chapter-editor-status-pill-chapter");
    const readingPill = within(statusBar).getByTestId("chapter-editor-status-pill-reading");
    expect(positionPill).toHaveClass(
      "project-editor-status-bar__pill",
      "project-editor-status-bar__pill--position",
    );
    expect(chapterPill).toHaveClass(
      "project-editor-status-bar__pill",
      "project-editor-status-bar__pill--chapter",
    );
    expect(readingPill).toHaveClass(
      "project-editor-status-bar__pill",
      "project-editor-status-bar__pill--reading",
    );

    expect(screen.getByTestId("chapter-progress-percent")).toHaveTextContent("14%");
    expect(screen.getByTestId("chapter-progress-stage-chip-traducao")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Tradução: atual/i),
    );

    fireEvent.click(screen.getByTestId("chapter-progress-toggle-traducao"));

    expect(screen.getByTestId("chapter-progress-percent")).toHaveTextContent("29%");
    expect(screen.getByTestId("chapter-progress-stage-chip-limpeza")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Limpeza: atual/i),
    );
    fireEvent.change(screen.getByLabelText(/Sinopse/i), {
      target: { value: "Sinopse opcional do capitulo em imagem" },
    });

    fireEvent.click(getTopActions().getByRole("button", { name: /Salvar como rascunho/i }));

    await waitFor(() => {
      const saveCall = apiFetchMock.mock.calls.find(
        ([, path, options]) =>
          path === "/api/projects/project-ln-1/chapters/3?volume=1" && options?.method === "PUT",
      );
      expect(saveCall).toBeDefined();
      const payload = (saveCall?.[2] as { json?: Record<string, unknown> } | undefined)?.json;
      expect(payload?.chapter).toEqual(
        expect.objectContaining({
          completedStages: ["aguardando-raw", "traducao"],
          progressStage: "limpeza",
          synopsis: "Sinopse opcional do capitulo em imagem",
        }),
      );
    });
    expect(refetchPublicBootstrapCacheMock).toHaveBeenCalledTimes(1);
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

  it("usa o modal de alterações não salvas antes de navegar para uploads", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/1?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conte/i });
    await screen.findByTestId("mock-lexical");

    const lexicalProps = getLastItem(lexicalEditorPropsSpy.mock.calls)?.[0] as {
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

    const dialogProps = getLastItem(imageLibraryPropsSpy.mock.calls)?.[0] as {
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

    fireEvent.click(screen.getByTestId("chapter-structure-episode-open-3:none"));

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

  it("usa o modal ao navegar entre volume e capítulo com alterações pendentes", async () => {
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
    fireEvent.click(screen.getByTestId("chapter-structure-episode-open-1:2"));
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

    fireEvent.click(screen.getByTestId("chapter-structure-episode-open-1:2"));
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
    expect(screen.queryByTestId("chapter-editor-status-meta-group")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-editor-status-pill-chapter")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chapter-editor-status-pill-reading")).not.toBeInTheDocument();
    fireEvent.click(closeVolumeButton);
    await waitFor(() => {
      expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
    });
  });

  it("respeita o modal ao fechar o volume com alterações pendentes", async () => {
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
    fireEvent.click(screen.getByTestId("chapter-structure-episode-open-1:2"));
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
    fireEvent.click(screen.getByTestId("chapter-structure-episode-open-3:none"));
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

  it("abre o volume pelo modal de alterações não salvas do capítulo", async () => {
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
    await screen.findByRole("heading", { name: /Gerenciamento de Conte/i });
    openIdentityAccordion();
    fireEvent.change(document.getElementById("chapter-title-standard") as HTMLInputElement, {
      target: { value: "Capítulo pendente" },
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
        title: "Capítulo pendente",
      }),
    );
  });
  it("mostra o modal ao criar novo capítulo com alterações pendentes e preserva o capítulo salvo", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/2?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conte/i });
    openIdentityAccordion();
    fireEvent.change(document.getElementById("chapter-title-standard") as HTMLInputElement, {
      target: { value: "Capítulo 2 revisado antes do novo" },
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
          title: "Capítulo 2 revisado antes do novo",
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

  it("mostra em progresso ao criar capítulo novo de light novel sem conteúdo", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    fireEvent.click(screen.getByTestId("chapter-structure-add-chapter-2"));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/3",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=2");
    expect(screen.getByTestId("chapter-progress-section")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-progress-percent")).toHaveTextContent("0%");
    expect(screen.getByTestId("chapter-progress-stage-list")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-progress-stage-chip-aguardando-raw")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Aguardando Raw: atual/i),
    );
  });

  it("mostra em progresso ao criar capítulo novo de manga sem páginas", async () => {
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
            progressStage: "aguardando-raw",
            completedStages: [],
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
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/2",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=1");
    expect(screen.getByTestId("chapter-progress-section")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-progress-percent")).toHaveTextContent("0%");
    expect(screen.getByTestId("chapter-progress-stage-list")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-progress-stage-chip-aguardando-raw")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Aguardando Raw: atual/i),
    );
  });

  it("mantém em progresso visível ao criar capítulo de manga mesmo se o backend omitir publicationStatus", async () => {
    const mangaProject = buildProject({
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
          progressStage: "aguardando-raw",
          completedStages: [],
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
    });

    setupApiMock({
      project: mangaProject,
      projectSaveResponse: ({ payload, project }) => {
        const incomingEpisodes = (
          (payload.episodeDownloads as Array<Record<string, unknown>> | undefined) || []
        ).map((episode) => {
          if (Number(episode.number) === 2 && Number(episode.volume) === 1) {
            const { publicationStatus, ...rest } = episode;
            return rest;
          }
          return episode;
        });
        return mockJsonResponse(true, {
          project: {
            ...project,
            ...payload,
            revision: "rev-3",
            episodeDownloads: incomingEpisodes,
          },
        });
      },
    });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos");
    await screen.findByTestId("chapter-structure-section");

    fireEvent.click(screen.getByTestId("chapter-structure-add-chapter-1"));

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/2",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=1");
    expect(screen.getByTestId("chapter-progress-section")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-progress-percent")).toHaveTextContent("0%");
    expect(screen.getByTestId("chapter-progress-stage-list")).toBeInTheDocument();
    expect(screen.getByTestId("chapter-progress-stage-chip-aguardando-raw")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Aguardando Raw: atual/i),
    );
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
  it("bloqueia o save manual quando a URL do editor ficaria ambigua sem volume", async () => {
    setupApiMock({ project: buildAmbiguousRouteSaveProject() });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/3");
    await screen.findByRole("heading", { name: /Gerenciamento de Conte\u00fado/i });
    openIdentityAccordion();

    fireEvent.change(document.getElementById("chapter-number-standard") as HTMLInputElement, {
      target: { value: "1" },
    });
    fireEvent.click(getTopActions().getByRole("button", { name: /Salvar altera/i }));

    const warningDialog = await findVolumeRequiredSaveDialog();
    expect(within(warningDialog).getByText("Volume obrigat\u00f3rio")).toBeInTheDocument();
    expect(hasChapterSaveRequest()).toBe(false);
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos/3",
    );
    expect(screen.getByTestId("location-search").textContent).toBe("");
  });

  it("bloqueia a acao secundaria quando a URL do editor ficaria ambigua sem volume", async () => {
    setupApiMock({ project: buildAmbiguousRouteSaveProject() });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/3");
    await screen.findByRole("heading", { name: /Gerenciamento de Conte\u00fado/i });
    openIdentityAccordion();

    fireEvent.change(document.getElementById("chapter-number-standard") as HTMLInputElement, {
      target: { value: "1" },
    });
    fireEvent.click(getTopActions().getByRole("button", { name: /Mover para rascunho/i }));

    const warningDialog = await findVolumeRequiredSaveDialog();
    expect(within(warningDialog).getByText("Volume obrigat\u00f3rio")).toBeInTheDocument();
    expect(hasChapterSaveRequest()).toBe(false);
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos/3",
    );
  });

  it("bloqueia Ctrl+S quando a URL do editor ficaria ambigua sem volume", async () => {
    setupApiMock({ project: buildAmbiguousRouteSaveProject() });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/3");
    await screen.findByRole("heading", { name: /Gerenciamento de Conte\u00fado/i });
    openIdentityAccordion();

    fireEvent.change(document.getElementById("chapter-number-standard") as HTMLInputElement, {
      target: { value: "1" },
    });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    const warningDialog = await findVolumeRequiredSaveDialog();
    expect(within(warningDialog).getByText("Volume obrigat\u00f3rio")).toBeInTheDocument();
    expect(hasChapterSaveRequest()).toBe(false);
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos/3",
    );
  });

  it("fecha o leave dialog e abre o aviso quando salvar e continuar cairia em rota ambigua", async () => {
    setupApiMock({ project: buildAmbiguousRouteSaveProject() });
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/3");
    await screen.findByRole("heading", { name: /Gerenciamento de Conte\u00fado/i });
    openIdentityAccordion();

    fireEvent.change(document.getElementById("chapter-number-standard") as HTMLInputElement, {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Fechar cap/i }));

    const leaveDialog = await findLeaveDialog();
    fireEvent.click(within(leaveDialog).getByRole("button", { name: /Publicar e continuar/i }));

    const warningDialog = await findVolumeRequiredSaveDialog();
    expect(within(warningDialog).getByText("Volume obrigat\u00f3rio")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId("chapter-unsaved-leave-dialog")).not.toBeInTheDocument();
    });
    expect(hasChapterSaveRequest()).toBe(false);
    expect(screen.getByTestId("location-pathname").textContent).toBe(
      "/dashboard/projetos/project-ln-1/capitulos/3",
    );
    expect(screen.getByTestId("location-search").textContent).toBe("");
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
    fireEvent.change(await screen.findByTestId("mock-lexical"), {
      target: { value: "Conteudo pronto para leitura" },
    });

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

  it("bloqueia a publicação local quando o capítulo não tem conteúdo nem fonte completa", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/2?volume=2");
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    fireEvent.click(getTopActions().getByRole("button", { name: /Publicar/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Não foi possível publicar o capítulo",
          variant: "destructive",
        }),
      );
    });
    expect(
      apiFetchMock.mock.calls.some(
        ([, path, options]) =>
          path === "/api/projects/project-ln-1/chapters/2?volume=2" && options?.method === "PUT",
      ),
    ).toBe(false);
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
    expect(screen.getByLabelText("Título").parentElement?.className).toContain("gap-2");
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

  it("abre um modal ao fechar capítulo com alterações não salvas", async () => {
    setupApiMock();
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conte/i });
    openIdentityAccordion();
    fireEvent.change(document.getElementById("chapter-title-standard") as HTMLInputElement, {
      target: { value: "Capítulo pendente" },
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

  it("permite acessar o editor com grant de projetos sem permissions legadas", async () => {
    setupApiMock({
      permissions: [],
      currentUserOverrides: {
        permissions: [],
        grants: { projetos: true },
      },
    });
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    expect(screen.queryByText("Acesso negado")).not.toBeInTheDocument();
  });

  it("permite acessar o editor para owner secundario sem permissions legadas", async () => {
    setupApiMock({
      permissions: [],
      currentUserOverrides: {
        id: "owner-2",
        permissions: [],
        accessRole: "owner_secondary",
        ownerIds: ["owner-1", "owner-2"],
        primaryOwnerId: "owner-1",
      },
    });
    renderEditor();
    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });
    expect(screen.queryByText("Acesso negado")).not.toBeInTheDocument();
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
    expect(toastMock).not.toHaveBeenCalled();
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
      .mockImplementation(function (this: HTMLElement) {
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

  it("mantem a ordem manual ao criar capitulo novo em projeto ja reordenado", async () => {
    setupApiMock({
      project: buildProject({
        episodeDownloads: [
          {
            ...baseProject.episodeDownloads[0],
            number: 1,
            volume: 1,
            title: "Capítulo 1 V1",
            readingOrder: 1,
          },
          {
            ...baseProject.episodeDownloads[0],
            number: 1,
            volume: 2,
            title: "Capítulo 1 V2",
            readingOrder: 2,
          },
          {
            ...baseProject.episodeDownloads[1],
            number: 2,
            volume: 2,
            title: "Capítulo 2 V2",
            readingOrder: 3,
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
      expect(
        ((payload?.episodeDownloads as Array<Record<string, unknown>> | undefined) || []).map(
          (episode) => ({
            number: episode.number,
            volume: episode.volume,
            readingOrder: episode.readingOrder,
          }),
        ),
      ).toEqual([
        { number: 1, volume: 1, readingOrder: 1 },
        { number: 2, volume: 1, readingOrder: 2 },
        { number: 1, volume: 2, readingOrder: 3 },
        { number: 2, volume: 2, readingOrder: 4 },
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/2",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=1");
  });

  it("faz fallback para o estado neutro quando a rota aponta para um capitulo inexistente", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/99");

    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos",
      );
    });

    expect(screen.getByTestId("location-search").textContent).toBe("");
    expect(screen.getByTestId("chapter-epub-tools")).toBeInTheDocument();
    expect(screen.queryByTestId("not-found")).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Capítulo não encontrado. Mostrando a lista.",
        intent: "warning",
      }),
    );
  });

  it("faz fallback para o estado neutro quando a rota recebe um numero de capitulo invalido", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/abc");

    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos",
      );
    });

    expect(screen.getByTestId("location-search").textContent).toBe("");
    expect(screen.getByTestId("chapter-epub-tools")).toBeInTheDocument();
    expect(screen.queryByTestId("not-found")).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Capítulo não encontrado. Mostrando a lista.",
        intent: "warning",
      }),
    );
  });

  it("preserva o volume valido ao cair para o estado neutro por rota de capitulo invalida", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/99?volume=2");

    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

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

  it("limpa a selecao de volume ao cair para o estado neutro com volume invalido na URL", async () => {
    setupApiMock();
    renderEditor("/dashboard/projetos/project-ln-1/capitulos/99?volume=999");

    await screen.findByRole("heading", { name: /Gerenciamento de Conteúdo/i });

    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos",
      );
    });

    expect(screen.getByTestId("location-search").textContent).toBe("");
    expect(screen.queryByTestId("chapter-volume-editor")).not.toBeInTheDocument();
  });
});
