import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DashboardProjectChapterEditor from "@/pages/DashboardProjectChapterEditor";

const { apiFetchMock, imageLibraryPropsSpy } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  imageLibraryPropsSpy: vi.fn(),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageContainer", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: (props: {
    open?: boolean;
    onSave?: (payload: { urls: string[]; items: Array<{ altText?: string }> }) => void;
  }) => {
    imageLibraryPropsSpy(props);
    if (!props.open) {
      return null;
    }
    return (
      <div data-testid="image-library-dialog">
        <button
          type="button"
          onClick={() =>
            props.onSave?.({
              urls: ["https://cdn.example/volume-2.webp"],
              items: [{}],
            })
          }
        >
          Salvar imagem mock
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/ui/async-state", () => ({
  default: ({
    title,
    description,
    action,
  }: {
    title?: string;
    description?: string;
    action?: ReactNode;
  }) => (
    <div>
      {title ? <div>{title}</div> : null}
      {description ? <div>{description}</div> : null}
      {action}
    </div>
  ),
}));

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
  getFrontendBuildMetadata: () => ({
    commitSha: "frontendsha",
    builtAt: "2026-03-08T00:00:00Z",
  }),
  formatBuildMetadataLabel: () => "build-label",
}));

vi.mock("@/lib/dev-diagnostics", () => ({
  logOriginApiBaseMismatchOnce: () => undefined,
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: () => undefined,
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

const projectFixture = {
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
      synopsis: "",
      releaseDate: "",
      duration: "",
      sourceType: "TV",
      sources: [],
      completedStages: [],
      content: "",
      contentFormat: "lexical",
      publicationStatus: "published",
      coverImageUrl: "",
      coverImageAlt: "",
    },
  ],
};

const renderEditor = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/projetos/project-ln-1/capitulos"]}>
      <Routes>
        <Route
          path="/dashboard/projetos/:projectId/capitulos"
          element={<DashboardProjectChapterEditor />}
        />
        <Route
          path="/dashboard/projetos/:projectId/capitulos/:chapterNumber"
          element={<DashboardProjectChapterEditor />}
        />
      </Routes>
    </MemoryRouter>,
  );

const setupApiMock = () => {
  apiFetchMock.mockReset();
  imageLibraryPropsSpy.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, {
        id: "1",
        name: "Admin",
        username: "admin",
        permissions: ["projetos"],
        grants: { projetos: true },
      });
    }
    if (path === "/api/contracts/v1.json" && method === "GET") {
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
      return mockJsonResponse(true, { project: projectFixture });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("DashboardProjectChapterEditor image library context", () => {
  it("usa a pasta de volumes e aplica fallback de alt ao salvar a capa do volume", async () => {
    setupApiMock();
    renderEditor();

    await screen.findByTestId("chapter-structure-section");
    fireEvent.click(screen.getByTestId("chapter-structure-select-2"));
    const volumeEditor = screen.getByTestId("chapter-volume-editor");
    fireEvent.click(within(volumeEditor).getByRole("button", { name: "Biblioteca" }));

    await waitFor(() => {
      const latestImageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
        uploadFolder?: string;
      };
      expect(latestImageLibraryProps?.uploadFolder).toBe("projects/project-ln-1/volumes");
    });

    const latestImageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      listFolders?: string[];
    };
    expect(latestImageLibraryProps.listFolders).toEqual([
      "projects/project-ln-1/volumes",
      "projects/project-ln-1",
      "projects/project-ln-1/episodes",
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Salvar imagem mock" }));

    expect(screen.getByLabelText("Texto alternativo")).toHaveValue("Capa do volume 2");
  });
});
