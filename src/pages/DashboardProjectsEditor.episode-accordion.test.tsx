import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import DashboardProjectsEditor from "@/pages/DashboardProjectsEditor";

const { apiFetchMock, toastMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageContainer", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  default: ({ title, actions }: { title: string; actions?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/ThemedSvgLogo", () => ({
  default: () => null,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      teamRoles: [],
      downloads: { sources: [] },
    },
  }),
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

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const expectLinkIconClass = (link: HTMLElement, iconClassName: string) => {
  const icon = link.querySelector("svg");
  expect(icon).not.toBeNull();
  expect(icon).toHaveClass(iconClassName);
};

const animeProjectFixture = {
  id: "project-1",
  anilistId: 1001,
  title: "Projeto Teste",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "Sinopse",
  description: "Sinopse",
  type: "Anime",
  status: "Em andamento",
  year: "2025",
  studio: "Studio Teste",
  episodes: "2 episódios",
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
  episodeDownloads: [
    {
      number: 1,
      title: "Primeiro episodio",
      releaseDate: "",
      duration: "",
      sourceType: "TV",
      sources: [{ label: "Google Drive", url: "https://example.com/1" }],
      progressStage: "aguardando-raw",
      completedStages: [],
      content: "",
      contentFormat: "lexical",
      publicationStatus: "draft",
    },
  ],
  views: 0,
  commentsCount: 0,
  order: 0,
};

const lightNovelProjectFixture = {
  ...animeProjectFixture,
  id: "project-ln-1",
  title: "Projeto Light Novel",
  type: "Light Novel",
  episodes: "1 capítulo",
  episodeDownloads: [
    {
      ...animeProjectFixture.episodeDownloads[0],
      title: "Capitulo 1",
      content:
        '{"root":{"children":[{"type":"paragraph","children":[{"type":"text","text":"conteudo local"}],"version":1}],"version":1}}',
      contentFormat: "lexical",
      sources: [],
    },
  ],
};

const mangaProjectFixture = {
  ...animeProjectFixture,
  id: "project-manga-1",
  title: "Projeto Manga",
  type: "Manga",
  episodes: "1 capítulo",
  episodeDownloads: [
    {
      ...animeProjectFixture.episodeDownloads[0],
      title: "Capitulo 1",
      sourceType: "Web",
      contentFormat: "images",
      pages: [{ position: 1, imageUrl: "/uploads/manga/ch1-01.jpg" }],
      pageCount: 1,
      hasPages: true,
      coverImageUrl: "/uploads/manga/ch1-01.jpg",
      coverImageAlt: "",
      volume: 1,
    },
  ],
};

const setupApiMock = (projects = [animeProjectFixture]) => {
  apiFetchMock.mockReset();
  toastMock.mockReset();
  apiFetchMock.mockImplementation(async (_base, path, options) => {
    const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();

    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
    }
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, { projects });
    }
    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, { users: [] });
    }
    if (path === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
    }
    if (path === "/api/contracts/v1.json" && method === "GET") {
      return mockJsonResponse(true, {
        version: "v1",
        generatedAt: "2026-03-02T16:00:00Z",
        capabilities: {
          project_epub_import: true,
          project_epub_export: true,
          project_epub_import_async: false,
        },
        build: {
          commitSha: "abcdef123456",
          builtAt: "2026-03-02T16:00:00Z",
        },
        endpoints: [],
      });
    }

    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const resizeObserverObserveMock = vi.fn();
const resizeObserverUnobserveMock = vi.fn();
const resizeObserverDisconnectMock = vi.fn();
const originalResizeObserver = globalThis.ResizeObserver;

const ResizeObserverMock = vi.fn(() => ({
  observe: resizeObserverObserveMock,
  unobserve: resizeObserverUnobserveMock,
  disconnect: resizeObserverDisconnectMock,
}));

const renderEditor = () =>
  render(
    <MemoryRouter>
      <DashboardProjectsEditor />
    </MemoryRouter>,
  );

const openProject = async (projectTitle: string) => {
  await screen.findByRole("heading", { name: "Gerenciar projetos" });
  fireEvent.click(await screen.findByRole("button", { name: `Abrir projeto ${projectTitle}` }));
  await screen.findByRole("heading", { name: "Editar projeto" });
};

describe("DashboardProjectsEditor episode accordion", () => {
  beforeEach(() => {
    setupApiMock();
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: originalResizeObserver,
    });
    vi.restoreAllMocks();
  });

  it("remove a seção inline de episódios do anime e mantém o CTA dedicado no rodapé", async () => {
    setupApiMock([animeProjectFixture]);
    renderEditor();

    await openProject("Projeto Teste");

    expect(screen.queryByRole("button", { name: /Episódios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Criar lote/i })).not.toBeInTheDocument();

    const footer = document.querySelector(".project-editor-footer") as HTMLElement | null;
    expect(footer).not.toBeNull();
    if (!footer) {
      throw new Error("Footer do editor não encontrado");
    }

    const dedicatedEditorLink = within(footer).getByRole("link", { name: "Episódios" });
    expect(dedicatedEditorLink).toHaveAttribute("href", "/dashboard/projetos/project-1/episodios");
    expectLinkIconClass(dedicatedEditorLink, "lucide-clapperboard");
  });

  it("mantém a seção de capítulos e o CTA de conteúdo para light novel", async () => {
    setupApiMock([lightNovelProjectFixture]);
    renderEditor();

    await openProject("Projeto Light Novel");

    expect(screen.getByRole("button", { name: /Conteúdo/i })).toBeInTheDocument();

    const footer = document.querySelector(".project-editor-footer") as HTMLElement | null;
    expect(footer).not.toBeNull();
    if (!footer) {
      throw new Error("Footer do editor não encontrado");
    }

    const dedicatedEditorLink = within(footer).getByRole("link", { name: /Conte/i });
    expect(dedicatedEditorLink).toHaveAttribute("href", "/dashboard/projetos/project-ln-1/capitulos");
    expectLinkIconClass(dedicatedEditorLink, "lucide-file-text");
  });

  it("mantém a seção de capítulos e o CTA de conteúdo para manga", async () => {
    setupApiMock([mangaProjectFixture]);
    renderEditor();

    await openProject("Projeto Manga");

    expect(screen.getByRole("button", { name: /Conteúdo/i })).toBeInTheDocument();

    const footer = document.querySelector(".project-editor-footer") as HTMLElement | null;
    expect(footer).not.toBeNull();
    if (!footer) {
      throw new Error("Footer do editor não encontrado");
    }

    const dedicatedEditorLink = within(footer).getByRole("link", { name: /Conte/i });
    expect(dedicatedEditorLink).toHaveAttribute(
      "href",
      "/dashboard/projetos/project-manga-1/capitulos",
    );
    expectLinkIconClass(dedicatedEditorLink, "lucide-file-image");
  });
});
