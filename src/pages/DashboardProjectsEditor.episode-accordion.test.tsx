import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

const openEpisodeEditor = async () => {
  render(
    <MemoryRouter>
      <DashboardProjectsEditor />
    </MemoryRouter>,
  );

  await screen.findByRole("heading", { name: "Gerenciar projetos" });

  fireEvent.click(await screen.findByText("Projeto Teste"));
  await screen.findByRole("heading", { name: "Editar projeto" });

  fireEvent.click(screen.getByRole("button", { name: /Episódios/i }));
  await screen.findAllByRole("button", { name: "Remover episódio" });
};

describe("DashboardProjectsEditor episode accordion", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();

      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [projectFixture] });
      }
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, { users: [] });
      }
      if (path === "/api/public/tag-translations" && method === "GET") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }

      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("nao fecha ao clicar no fundo do card", async () => {
    await openEpisodeEditor();

    fireEvent.click(screen.getByRole("button", { name: /Ep 1/i }));
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

    const episodeTrigger = screen.getByRole("button", { name: /Ep 1/i });
    expect(screen.queryByDisplayValue("Primeiro episodio")).not.toBeInTheDocument();

    fireEvent.click(episodeTrigger);
    expect(screen.getByDisplayValue("Primeiro episodio")).toBeInTheDocument();

    fireEvent.click(episodeTrigger);
    expect(screen.queryByDisplayValue("Primeiro episodio")).not.toBeInTheDocument();
  });

  it("permite abrir multiplos episodios ao mesmo tempo", async () => {
    await openEpisodeEditor();

    fireEvent.click(screen.getByRole("button", { name: /Ep 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ep 2/i }));

    expect(screen.getByDisplayValue("Primeiro episodio")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();
  });

  it("mantem alinhamento do estado ao remover episodio", async () => {
    await openEpisodeEditor();

    fireEvent.click(screen.getByRole("button", { name: /Ep 2/i }));
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Remover episódio" })[0]);
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();

    const remainingTrigger = screen.getByRole("button", { name: /Ep 2/i });
    fireEvent.click(remainingTrigger);
    expect(screen.queryByDisplayValue("Segundo episodio")).not.toBeInTheDocument();
    fireEvent.click(remainingTrigger);
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();
  });

  it("botao remover nao dispara toggle do accordion", async () => {
    await openEpisodeEditor();

    expect(screen.queryByDisplayValue("Segundo episodio")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Remover epis/i })[0]);
    expect(screen.queryByRole("button", { name: /Ep 1/i })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Segundo episodio")).not.toBeInTheDocument();

    const remainingTrigger = screen.getByRole("button", { name: /Ep 2/i });
    fireEvent.click(remainingTrigger);
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();
  });
});
