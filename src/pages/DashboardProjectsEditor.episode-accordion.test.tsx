import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DashboardProjectsEditor from "@/pages/DashboardProjectsEditor";

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
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
    actions,
  }: {
    title: string;
    actions?: ReactNode;
  }) => (
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

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const projectFixture = {
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
    },
    {
      number: 2,
      title: "Segundo episodio",
      releaseDate: "",
      duration: "",
      sourceType: "TV",
      sources: [{ label: "Google Drive", url: "https://example.com/2" }],
      progressStage: "aguardando-raw",
      completedStages: [],
      content: "",
      contentFormat: "lexical",
    },
  ],
  views: 0,
  commentsCount: 0,
  order: 0,
};

const lightNovelProjectFixture = {
  ...projectFixture,
  id: "project-ln-1",
  title: "Projeto Light Novel",
  type: "Light Novel",
  episodes: "1 capítulo",
  episodeDownloads: [
    {
      number: 1,
      title: "Capitulo 1",
      releaseDate: "",
      duration: "",
      sourceType: "TV",
      sources: [],
      progressStage: "aguardando-raw",
      completedStages: [],
      content: "",
      contentFormat: "lexical",
    },
  ],
};

const setupApiMock = (projects = [projectFixture]) => {
  apiFetchMock.mockReset();
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

    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const scrollIntoViewMock = vi.fn();
const episode1TriggerPattern = /(Epis[oó]dio|EpisÃ³dio)\s+1/i;
const episode2TriggerPattern = /(Epis[oó]dio|EpisÃ³dio)\s+2/i;

const openEpisodeEditor = async ({
  projectTitle = "Projeto Teste",
  sectionNamePattern = /Epis/i,
  removeButtonPattern = /Remover (epis|cap)/i,
}: {
  projectTitle?: string;
  sectionNamePattern?: RegExp;
  removeButtonPattern?: RegExp;
} = {}) => {
  render(
    <MemoryRouter>
      <DashboardProjectsEditor />
    </MemoryRouter>,
  );

  await screen.findByRole("heading", { name: "Gerenciar projetos" });

  fireEvent.click(await screen.findByText(projectTitle));
  await screen.findByRole("heading", { name: "Editar projeto" });

  fireEvent.click(screen.getByRole("button", { name: sectionNamePattern }));
  await screen.findAllByRole("button", { name: removeButtonPattern });
};

describe("DashboardProjectsEditor episode accordion", () => {
  beforeEach(() => {
    setupApiMock();
    scrollIntoViewMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });
  });

  it("nao fecha ao clicar no fundo do card", async () => {
    await openEpisodeEditor();

    fireEvent.click(screen.getByRole("button", { name: episode1TriggerPattern }));
    expect(screen.getByDisplayValue("Primeiro episodio")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("episode-card-0"));
    expect(screen.getByDisplayValue("Primeiro episodio")).toBeInTheDocument();
  });

  it("abre e fecha ao clicar no topo do card fora do trigger", async () => {
    await openEpisodeEditor();

    expect(screen.queryByDisplayValue("Primeiro episodio")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("episode-header-0"));
    expect(screen.getByDisplayValue("Primeiro episodio")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("episode-header-0"));
    expect(screen.queryByDisplayValue("Primeiro episodio")).not.toBeInTheDocument();
  });

  it("abre e fecha ao clicar no topo (trigger)", async () => {
    await openEpisodeEditor();

    const episodeTrigger = screen.getByRole("button", { name: episode1TriggerPattern });
    expect(screen.queryByDisplayValue("Primeiro episodio")).not.toBeInTheDocument();

    fireEvent.click(episodeTrigger);
    expect(screen.getByDisplayValue("Primeiro episodio")).toBeInTheDocument();

    fireEvent.click(episodeTrigger);
    expect(screen.queryByDisplayValue("Primeiro episodio")).not.toBeInTheDocument();
  });

  it("permite abrir multiplos episodios ao mesmo tempo", async () => {
    await openEpisodeEditor();

    fireEvent.click(screen.getByRole("button", { name: episode1TriggerPattern }));
    fireEvent.click(screen.getByRole("button", { name: episode2TriggerPattern }));

    expect(screen.getByDisplayValue("Primeiro episodio")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();
  });

  it("mantem alinhamento do estado ao remover episodio", async () => {
    await openEpisodeEditor();

    fireEvent.click(screen.getByRole("button", { name: episode2TriggerPattern }));
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Remover epis/i })[0]);
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();

    const remainingTrigger = screen.getByRole("button", { name: episode2TriggerPattern });
    fireEvent.click(remainingTrigger);
    expect(screen.queryByDisplayValue("Segundo episodio")).not.toBeInTheDocument();
    fireEvent.click(remainingTrigger);
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();
  });

  it("botao remover nao dispara toggle do accordion", async () => {
    await openEpisodeEditor();

    expect(screen.queryByDisplayValue("Segundo episodio")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Remover epis/i })[0]);
    expect(screen.queryByRole("button", { name: episode1TriggerPattern })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Segundo episodio")).not.toBeInTheDocument();

    const remainingTrigger = screen.getByRole("button", { name: episode2TriggerPattern });
    fireEvent.click(remainingTrigger);
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();
  });

  it("faz scroll suave ao adicionar episodio e mantem item aberto", async () => {
    await openEpisodeEditor();

    fireEvent.click(screen.getByRole("button", { name: /Adicionar epis/i }));

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });

    const newEpisodeCard = await screen.findByTestId("episode-card-2");
    expect(within(newEpisodeCard).getByDisplayValue("3")).toBeInTheDocument();
  });

  it("faz scroll suave ao adicionar capitulo e mantem item aberto", async () => {
    setupApiMock([lightNovelProjectFixture]);
    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Adicionar cap/i }));

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });

    const newChapterCard = await screen.findByTestId("episode-card-1");
    expect(within(newChapterCard).getByDisplayValue("2")).toBeInTheDocument();
  });
});
