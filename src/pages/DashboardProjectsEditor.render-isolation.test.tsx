import type { ComponentProps, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardProjectsEditor from "@/pages/DashboardProjectsEditor";

const { apiFetchMock, renderCounters } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  renderCounters: {
    lexicalEditorSurface: 0,
    mediaSection: 0,
  },
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
  default: () => <div data-testid="image-library-dialog" />,
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

vi.mock("@/hooks/use-dashboard-refresh-toast", () => ({
  useDashboardRefreshToast: () => undefined,
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/components/lexical/LexicalEditorSurface", () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
    renderCounters.lexicalEditorSurface += 1;

    return (
      <button
        type="button"
        data-testid="mock-lexical-editor"
        onClick={() => onChange(`${value} atualizado`)}
      >
        Editor lexical
      </button>
    );
  },
}));

vi.mock("@/components/dashboard/project-editor/ProjectEditorMediaSection", async (importActual) => {
  const { memo } = await import("react");
  const actual =
    await importActual<
      typeof import("@/components/dashboard/project-editor/ProjectEditorMediaSection")
    >();
  const ActualMediaSection = actual.default;

  const WrappedMediaSection = memo((props: ComponentProps<typeof ActualMediaSection>) => {
    renderCounters.mediaSection += 1;
    return <ActualMediaSection {...props} />;
  });

  WrappedMediaSection.displayName = "ObservedProjectEditorMediaSection";

  return {
    default: WrappedMediaSection,
  };
});

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const lightNovelProjectFixture = {
  id: "project-ln-1",
  anilistId: 1001,
  title: "Projeto Light Novel",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "Sinopse",
  description: "Sinopse",
  type: "Light Novel",
  status: "Em andamento",
  year: "2025",
  studio: "Studio Teste",
  animationStudios: [],
  episodes: "1 capitulo",
  tags: [],
  genres: [],
  cover: "",
  coverAlt: "",
  banner: "",
  bannerAlt: "",
  season: "",
  schedule: "",
  rating: "",
  country: "",
  source: "",
  discordRoleId: "",
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
  readerConfig: undefined,
  volumeEntries: [],
  volumeCovers: [],
  episodeDownloads: [
    {
      number: 1,
      title: "Capitulo 1",
      releaseDate: "",
      duration: "",
      sourceType: "Web",
      sources: [],
      progressStage: "aguardando-raw",
      completedStages: [],
      content:
        '{"root":{"children":[{"type":"paragraph","children":[{"type":"text","text":"conteudo local"}],"version":1}],"version":1}}',
      contentFormat: "lexical",
      publicationStatus: "draft",
      volume: 1,
    },
  ],
  views: 0,
  commentsCount: 0,
  order: 0,
};

const setupApiMock = () => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base, path, options) => {
    const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();

    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
    }
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, { projects: [lightNovelProjectFixture] });
    }
    if (path === "/api/project-types" && method === "GET") {
      return mockJsonResponse(true, { types: ["Light Novel"] });
    }
    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, { users: [] });
    }
    if (path === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
    }

    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const renderEditor = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/projetos"]}>
      <DashboardProjectsEditor />
    </MemoryRouter>,
  );

const openProject = async () => {
  await screen.findByRole("heading", { name: "Gerenciar projetos" });
  fireEvent.click(await screen.findByRole("button", { name: "Abrir projeto Projeto Light Novel" }));
  await screen.findByRole("heading", { name: "Editar projeto" });
};

const openAccordionIfNeeded = (trigger: HTMLButtonElement) => {
  const isOpen =
    trigger.getAttribute("data-state") === "open" ||
    trigger.getAttribute("aria-expanded") === "true";

  if (!isOpen) {
    fireEvent.click(trigger);
  }
};

const waitForTrigger = async (
  resolveTrigger: () => HTMLButtonElement | null,
  errorMessage: string,
) =>
  waitFor(() => {
    const trigger = resolveTrigger();

    if (!trigger) {
      throw new Error(errorMessage);
    }

    return trigger;
  });

const openContentSection = async () => {
  const trigger = await waitForTrigger(
    () =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          ".project-editor-accordion .project-editor-section-trigger",
        ),
      ).find((button) => /conte/i.test(button.textContent || "")) || null,
    "Expected content accordion trigger to be rendered.",
  );

  openAccordionIfNeeded(trigger);
};

const openMediaSection = async () => {
  const trigger = await waitForTrigger(
    () =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          ".project-editor-accordion .project-editor-section-trigger",
        ),
      ).find((button) => /m[ií]dia/i.test(button.textContent || "")) || null,
    "Expected media accordion trigger to be rendered.",
  );

  openAccordionIfNeeded(trigger);
};

const openVolumeGroup = async () => {
  const trigger = await waitForTrigger(
    () =>
      document.querySelector<HTMLButtonElement>(
        "[data-testid^='volume-group-'] button[data-state]",
      ),
    "Expected volume group accordion trigger to be rendered.",
  );

  openAccordionIfNeeded(trigger);
};

const openChapter = async () => {
  const trigger = await waitForTrigger(
    () => document.querySelector<HTMLButtonElement>("[data-episode-accordion-trigger]"),
    "Expected chapter accordion trigger to be rendered.",
  );

  openAccordionIfNeeded(trigger);
};

const openChapterContentEditor = async () => {
  await openContentSection();
  await openVolumeGroup();
  await openChapter();
  await screen.findByTestId("mock-lexical-editor");
};

describe("DashboardProjectsEditor render isolation", () => {
  beforeEach(() => {
    renderCounters.lexicalEditorSurface = 0;
    renderCounters.mediaSection = 0;
    setupApiMock();
  });

  it("mantem os filtros do editor alinhados ao contrato visual compartilhado", async () => {
    renderEditor();

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    expect(screen.getByTestId("dashboard-projects-toolbar")).toHaveClass("relative", "z-[30]");
    expect(screen.getByPlaceholderText("Buscar por título, tags, estúdio...")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ordenar projetos" })).toHaveTextContent(
      "Ordem alfabética",
    );

    const typeTrigger = screen.getByRole("combobox", { name: "Filtrar por formato" });
    expect(typeTrigger).toHaveClass("rounded-xl", "border-border/60", "bg-background/60");

    fireEvent.click(typeTrigger);

    const option = await screen.findByRole("option", { name: "Light Novel" });
    expect(option).toHaveClass("rounded-xl", "py-2", "pl-9", "pr-3");
    expect(screen.getByRole("listbox")).toHaveClass(
      "rounded-2xl",
      "border-border/70",
      "bg-popover/95",
    );
  });

  it("keeps the lexical editor stable when only project metadata changes", async () => {
    renderEditor();

    await openProject();
    await openChapterContentEditor();

    const lexicalRenderCountBeforeTitleEdit = renderCounters.lexicalEditorSurface;

    fireEvent.change(screen.getByDisplayValue("Projeto Light Novel"), {
      target: { value: "Projeto Light Novel atualizado" },
    });

    await waitFor(() => {
      expect(renderCounters.lexicalEditorSurface).toBe(lexicalRenderCountBeforeTitleEdit);
    });
  });

  it("keeps the media section stable when only chapter content changes", async () => {
    renderEditor();

    await openProject();
    await openChapterContentEditor();

    const mediaSectionRenderCountBeforeContentEdit = renderCounters.mediaSection;

    fireEvent.click(screen.getByTestId("mock-lexical-editor"));

    await waitFor(() => {
      expect(renderCounters.mediaSection).toBe(mediaSectionRenderCountBeforeContentEdit);
    });
  });

  it("lazy-mounts the image library only after the dialog is opened", async () => {
    renderEditor();

    await openProject();
    await openMediaSection();

    expect(screen.queryByTestId("image-library-dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Biblioteca/i })[0]);

    expect(await screen.findByTestId("image-library-dialog")).toBeInTheDocument();
  });
});
