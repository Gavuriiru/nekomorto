import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardProjectEpisodeEditor from "@/pages/DashboardProjectEpisodeEditor";

const {
  apiFetchMock,
  toastMock,
  refetchPublicBootstrapCacheMock,
  imageLibraryPropsSpy,
  dashboardCurrentUserState,
} = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  toastMock: vi.fn(),
  refetchPublicBootstrapCacheMock: vi.fn(async () => undefined),
  imageLibraryPropsSpy: vi.fn(),
  dashboardCurrentUserState: {
    currentUser: {
      id: "user-1",
      name: "Admin",
      username: "admin",
      permissions: ["*"],
    },
    isLoadingUser: false,
  },
}));

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

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
        Abrir usuário
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

vi.mock("@/components/ImageLibraryDialogLoading", () => ({
  ImageLibraryDialogLoadingFallback: () => <div data-testid="image-library-loading" />,
}));

vi.mock("@/components/ui/async-state", () => ({
  default: ({
    kind,
    title,
    description,
    action,
  }: {
    kind?: string;
    title?: string;
    description?: string;
    action?: ReactNode;
  }) => (
    <div data-testid="async-state">
      {kind ? <div>{kind}</div> : null}
      {title ? <div>{title}</div> : null}
      {description ? <div>{description}</div> : null}
      {action}
    </div>
  ),
}));

vi.mock("@/hooks/use-dashboard-current-user", () => ({
  useDashboardCurrentUser: () => ({
    currentUser: dashboardCurrentUserState.currentUser,
    isLoadingUser: dashboardCurrentUserState.isLoadingUser,
  }),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-public-bootstrap", () => ({
  refetchPublicBootstrapCache: () => refetchPublicBootstrapCacheMock(),
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

type ProjectRecord = {
  id: string;
  revision?: string;
  title: string;
  type: string;
  episodeDownloads: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

const formatLocalIsoDate = (timestampMs: number) => {
  const current = new Date(timestampMs);
  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, "0");
  const day = String(current.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const animeProjectFixture: ProjectRecord = {
  id: "project-1",
  revision: "rev-1",
  title: "Projeto Teste",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "Sinopse",
  description: "Sinopse",
  type: "Anime",
  status: "Em andamento",
  year: "2026",
  studio: "Studio Teste",
  episodes: "2 episodios",
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
  volumeEntries: [],
  views: 0,
  commentsCount: 0,
  order: 0,
  episodeDownloads: [
    {
      number: 1,
      title: "Primeiro episodio",
      synopsis: "",
      releaseDate: "2026-03-10",
      duration: "00:24:10",
      sourceType: "TV",
      sources: [{ label: "Google Drive", url: "https://example.com/1" }],
      progressStage: "aguardando-raw",
      completedStages: ["aguardando-raw"],
      content: "",
      contentFormat: "lexical",
      publicationStatus: "draft",
      coverImageUrl: "",
      coverImageAlt: "",
      hash: "hash-1",
      sizeBytes: 1024,
    },
    {
      number: 2,
      title: "Segundo episodio",
      synopsis: "",
      releaseDate: "",
      duration: "00:24:00",
      sourceType: "Web",
      sources: [],
      progressStage: "aguardando-raw",
      completedStages: [],
      content: "",
      contentFormat: "lexical",
      publicationStatus: "draft",
      coverImageUrl: "/uploads/episodios/2.jpg",
      coverImageAlt: "",
      hash: "",
    },
  ],
};

const setDashboardCurrentUser = (overrides: Record<string, unknown> = {}) => {
  dashboardCurrentUserState.currentUser = {
    id: "user-1",
    name: "Admin",
    username: "admin",
    permissions: ["*"],
    ...overrides,
  };
  dashboardCurrentUserState.isLoadingUser = false;
};

const setupApiMock = (projectFixture: ProjectRecord = animeProjectFixture) => {
  let currentProject = structuredClone(projectFixture);
  const persistedProjects: ProjectRecord[] = [];

  apiFetchMock.mockReset();
  toastMock.mockReset();
  refetchPublicBootstrapCacheMock.mockReset();
  imageLibraryPropsSpy.mockReset();

  apiFetchMock.mockImplementation(async (_base, path, options) => {
    const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();

    if (path === `/api/projects/${currentProject.id}` && method === "GET") {
      return mockJsonResponse(true, { project: currentProject });
    }

    if (path === `/api/projects/${currentProject.id}` && method === "PUT") {
      const nextProject = structuredClone(
        ((options as { json?: ProjectRecord } | undefined)?.json ||
          currentProject) as ProjectRecord,
      );
      persistedProjects.push(nextProject);
      currentProject = nextProject;
      return mockJsonResponse(true, { project: currentProject });
    }

    return mockJsonResponse(false, { error: "not_found" }, 404);
  });

  return {
    getPersistedProjects: () => persistedProjects,
    getCurrentProject: () => currentProject,
  };
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderEditor = (initialEntry = "/dashboard/projetos/project-1/episodios/1") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/dashboard/projetos/:projectId/episodios"
          element={<DashboardProjectEpisodeEditor />}
        />
        <Route
          path="/dashboard/projetos/:projectId/episodios/:episodeNumber"
          element={<DashboardProjectEpisodeEditor />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe("DashboardProjectEpisodeEditor", () => {
  beforeEach(() => {
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    setDashboardCurrentUser();
    setupApiMock();
  });

  it("permite acessar o editor com grant de projetos sem permissions legadas", async () => {
    setDashboardCurrentUser({
      permissions: [],
      grants: { projetos: true },
    });

    renderEditor();

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });
    expect(screen.queryByText("Acesso negado")).not.toBeInTheDocument();
  });

  it("permite acessar o editor para owner secundario sem permissions legadas", async () => {
    setDashboardCurrentUser({
      id: "owner-2",
      permissions: [],
      accessRole: "owner_secondary",
      ownerIds: ["owner-1", "owner-2"],
      primaryOwnerId: "owner-1",
    });

    renderEditor();

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });
    expect(screen.queryByText("Acesso negado")).not.toBeInTheDocument();
  });

  it("bloqueia o editor para usuário sem acesso de projetos", async () => {
    setDashboardCurrentUser({
      permissions: ["posts"],
    });

    renderEditor();

    await screen.findByText("Acesso negado");
  });

  it("salva o episódio ativo e envia o snapshot completo do projeto", async () => {
    const apiState = setupApiMock();
    renderEditor();

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });
    expect(screen.getByLabelText(/^Título$/i).parentElement?.className).toContain("gap-2");

    fireEvent.change(screen.getByLabelText(/^Título$/i), {
      target: { value: "Primeiro episodio revisado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar episódio/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Episódio salvo", intent: "success" }),
      ),
    );

    const persistedProject = apiState.getPersistedProjects().at(-1);
    expect(persistedProject?.episodeDownloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          number: 1,
          title: "Primeiro episodio revisado",
          releaseDate: "2026-03-10",
          duration: "00:24:10",
        }),
      ]),
    );
    expect(refetchPublicBootstrapCacheMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/dashboard/projetos/project-1/episodios/1",
    );
  });

  it("mostra o estado neutro com listagem unificada e sem controles legados", async () => {
    renderEditor("/dashboard/projetos/project-1/episodios");

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    const emptyState = screen.getByTestId("anime-episode-empty-state");
    expect(
      within(emptyState).getByRole("button", {
        name: /Adicionar episódio/i,
      }),
    ).toBeInTheDocument();
    expect(within(emptyState).getByPlaceholderText(/Buscar episódio/i)).toBeInTheDocument();
    expect(within(emptyState).getByText(/Nenhum episódio aberto/i)).toBeInTheDocument();
    expect(within(emptyState).getByText(/Primeiro episodio/i)).toBeInTheDocument();
    expect(screen.queryByTestId("anime-episode-editor-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Duplicar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Anterior/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pr(?:o|\u00f3)ximo/i })).not.toBeInTheDocument();
  });

  it("renderiza header shell compartilhado com masthead e command bar em ordem estável", async () => {
    renderEditor();

    await screen.findByRole("heading", { name: /Gerenciamento de Epis/i });

    const headerShell = screen.getByTestId("anime-episode-editor-header-shell");
    const masthead = screen.getByTestId("anime-episode-editor-masthead");
    const commandBar = screen.getByTestId("anime-episode-editor-command-bar");
    const actionRail = screen.getByTestId("anime-episode-editor-action-rail");
    const topStatusGroup = screen.getByTestId("anime-episode-editor-top-status-group");
    const topActions = screen.getByTestId("anime-episode-editor-top-actions");
    const secondaryActions = screen.getByTestId("anime-episode-editor-secondary-actions");

    expect(headerShell).toContainElement(masthead);
    expect(headerShell).toContainElement(commandBar);
    expect(Array.from(headerShell.children)).toEqual([masthead, commandBar]);
    expect(commandBar).toHaveClass("sticky", "top-3");
    expect(actionRail).toHaveClass("lg:flex-row", "lg:justify-between");
    expect(topStatusGroup).toContainElement(screen.getByText(/Tudo salvo/i));
    expect(topActions).toContainElement(screen.getByRole("button", { name: /Salvar epis/i }));
    expect(topActions).toContainElement(screen.getByRole("button", { name: /^Excluir$/i }));
    expect(secondaryActions).toContainElement(
      within(secondaryActions).getByRole("link", { name: /Voltar ao projeto/i }),
    );
    expect(secondaryActions).toContainElement(
      within(secondaryActions).getByRole("link", { name: /P[aá]gina p[uú]blica/i }),
    );
    expect(secondaryActions).toContainElement(
      within(secondaryActions).getByRole("button", { name: /Fechar epis/i }),
    );
  });

  it("navega pela lista integrada no estado neutro e volta a exibir a sidebar no episódio ativo", async () => {
    renderEditor("/dashboard/projetos/project-1/episodios");

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    fireEvent.click(
      within(screen.getByTestId("anime-episode-empty-state"))
        .getByText(/Segundo episodio/i)
        .closest("button") as HTMLButtonElement,
    );

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/dashboard/projetos/project-1/episodios/2",
      ),
    );

    expect(screen.getByTestId("anime-episode-editor-sidebar")).toBeInTheDocument();
  });

  it("adiciona o próximo episódio, persiste o snapshot e navega para a nova rota", async () => {
    const apiState = setupApiMock();
    const mockedNowMs = new Date("2026-04-02T15:00:00.000Z").getTime();
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(mockedNowMs);
    renderEditor("/dashboard/projetos/project-1/episodios");

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });
    fireEvent.click(
      within(screen.getByTestId("anime-episode-empty-state")).getByRole("button", {
        name: /Adicionar episódio/i,
      }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/dashboard/projetos/project-1/episodios/3",
      ),
    );

    const createdEpisode = apiState
      .getPersistedProjects()
      .at(-1)
      ?.episodeDownloads.find((episode) => Number((episode as { number?: number }).number) === 3) as
      | Record<string, unknown>
      | undefined;

    expect(createdEpisode).toEqual(
      expect.objectContaining({
        number: 3,
        title: "",
        sourceType: "TV",
        releaseDate: formatLocalIsoDate(mockedNowMs),
        duration: "",
        synopsis: "",
        sources: [],
        publicationStatus: "draft",
      }),
    );
    expect(createdEpisode?.hash).toBeUndefined();
    expect(createdEpisode?.sizeBytes).toBeUndefined();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Episódio criado", intent: "success" }),
    );
    dateNowSpy.mockRestore();
  });

  it("abre o leave guard ao adicionar com alterações pendentes e permite descartar", async () => {
    const apiState = setupApiMock();
    renderEditor();

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    fireEvent.change(screen.getByLabelText(/^Título$/i), {
      target: { value: "Primeiro episodio alterado" },
    });
    fireEvent.click(
      within(screen.getByTestId("anime-episode-editor-command-bar")).getByRole("button", {
        name: /^Adicionar episódio$/i,
      }),
    );

    expect(await screen.findByTestId("anime-episode-unsaved-leave-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Descartar e continuar/i }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/dashboard/projetos/project-1/episodios/3",
      ),
    );

    const createdEpisode = apiState
      .getPersistedProjects()
      .at(-1)
      ?.episodeDownloads.find((episode) => Number((episode as { number?: number }).number) === 3) as
      | Record<string, unknown>
      | undefined;

    expect(createdEpisode).toEqual(expect.objectContaining({ number: 3, title: "" }));
    expect(
      apiState
        .getPersistedProjects()
        .at(-1)
        ?.episodeDownloads.find((episode) => Number((episode as { number?: number }).number) === 1),
    ).toEqual(expect.objectContaining({ title: "Primeiro episodio" }));
  });

  it("salva o rascunho atual antes de adicionar um novo episódio quando o usuário escolhe continuar salvando", async () => {
    const apiState = setupApiMock();
    renderEditor();

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    fireEvent.change(screen.getByLabelText(/^Título$/i), {
      target: { value: "Primeiro episodio revisado" },
    });
    fireEvent.click(
      within(screen.getByTestId("anime-episode-editor-command-bar")).getByRole("button", {
        name: /^Adicionar episódio$/i,
      }),
    );

    expect(await screen.findByTestId("anime-episode-unsaved-leave-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Salvar e continuar/i }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/dashboard/projetos/project-1/episodios/3",
      ),
    );

    const persistedProject = apiState.getPersistedProjects().at(-1);
    expect(persistedProject?.episodeDownloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ number: 1, title: "Primeiro episodio revisado" }),
        expect.objectContaining({ number: 3, title: "", publicationStatus: "draft" }),
      ]),
    );
  });

  it("move a capa para um card próprio abaixo do pipeline e mantém origem e duração em arquivo e fontes", async () => {
    renderEditor("/dashboard/projetos/project-1/episodios/2");

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    const identitySection = screen.getByTestId("anime-episode-identity-section");
    const progressSection = screen.getByTestId("anime-episode-progress-section");
    const coverSection = screen.getByTestId("anime-episode-cover-section");
    const fileSection = screen.getByTestId("anime-episode-file-section");
    const secondaryGrid = screen.getByTestId("anime-episode-secondary-grid");
    const primaryColumn = screen.getByTestId("anime-episode-secondary-primary-column");
    const coverLayout = screen.getByTestId("anime-episode-cover-layout");
    const coverControls = screen.getByTestId("anime-episode-cover-controls");
    const coverPreview = within(coverSection).getByTestId("anime-episode-cover-preview");
    const altInput = within(coverControls).getByLabelText(/Texto alternativo da capa/i);
    const libraryButton = within(coverControls).getByRole("button", { name: /Biblioteca/i });
    const durationInput = within(fileSection).getByLabelText(/Duração/i);
    const sourceTrigger = within(fileSection).getByRole("combobox", { name: /Origem/i });
    const stageList = within(progressSection).getByTestId("anime-episode-progress-stage-list");

    expect(within(identitySection).queryByLabelText(/Sinopse/i)).not.toBeInTheDocument();
    expect(
      within(identitySection).queryByRole("combobox", { name: /Origem/i }),
    ).not.toBeInTheDocument();
    expect(within(identitySection).queryByLabelText(/Duração/i)).not.toBeInTheDocument();
    expect(
      within(identitySection).queryByTestId("anime-episode-cover-preview"),
    ).not.toBeInTheDocument();
    expect(
      within(coverSection).queryByText(/Banner 16:9 selecionado pela biblioteca do projeto/i),
    ).not.toBeInTheDocument();
    expect(within(coverSection).queryByPlaceholderText(/URL da capa/i)).not.toBeInTheDocument();
    expect(coverLayout.className).not.toContain("ml-auto");
    expect(coverPreview.className).toContain("max-w-[24rem]");
    expect(coverPreview.firstElementChild).not.toHaveClass(
      "shadow-[0_24px_70px_-45px_rgba(0,0,0,0.85)]",
    );
    expect(coverPreview.querySelector(".aspect-video")).not.toBeNull();
    expect(within(coverSection).getByRole("img")).toBeInTheDocument();
    expect(sourceTrigger).toHaveTextContent("Web");
    expect(durationInput).toHaveValue("24:00");
    expect(
      (altInput.compareDocumentPosition(libraryButton) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);
    expect(classTokens(libraryButton as HTMLElement)).toEqual(
      expect.arrayContaining(["w-full", "rounded-xl", "bg-background", "font-semibold"]),
    );
    expect(classTokens(libraryButton as HTMLElement)).not.toContain("interactive-lift-sm");
    expect(classTokens(libraryButton as HTMLElement)).not.toContain("pressable");
    expect(within(primaryColumn).getByTestId("anime-episode-progress-section")).toBe(
      progressSection,
    );
    expect(within(primaryColumn).getByTestId("anime-episode-cover-section")).toBe(coverSection);
    expect(
      (progressSection.compareDocumentPosition(coverSection) & Node.DOCUMENT_POSITION_FOLLOWING) !==
        0,
    ).toBe(true);
    expect(within(secondaryGrid).getByTestId("anime-episode-progress-section")).toBe(
      progressSection,
    );
    expect(within(secondaryGrid).getByTestId("anime-episode-cover-section")).toBe(coverSection);
    expect(within(secondaryGrid).getByTestId("anime-episode-file-section")).toBe(fileSection);
    expect(within(progressSection).getByText(/Etapas editoriais/i)).toBeInTheDocument();
    expect(within(progressSection).getByText(/Etapa atual/i)).toBeInTheDocument();
    expect(
      within(progressSection).getByRole("list", { name: /Etapas editoriais/i }),
    ).toBeInTheDocument();
    expect(within(stageList).getAllByRole("checkbox").length).toBeGreaterThan(0);
    const currentStageBadge = within(progressSection)
      .getAllByText("Atual")
      .find((element) => String((element as HTMLElement).className || "").includes("rounded-full"));
    expect(currentStageBadge).toHaveClass(
      "border-[hsl(var(--badge-info-border))]",
      "bg-[hsl(var(--badge-info-bg))]",
      "text-[hsl(var(--badge-info-fg))]",
    );
  });

  it("persiste a origem selecionada ao salvar o episódio", async () => {
    const apiState = setupApiMock();
    renderEditor("/dashboard/projetos/project-1/episodios/2");

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    const fileSection = screen.getByTestId("anime-episode-file-section");
    const sourceTrigger = within(fileSection).getByRole("combobox", { name: /Origem/i });
    expect(sourceTrigger).toHaveClass("rounded-xl", "border-border/60", "bg-background/60");

    fireEvent.click(sourceTrigger);

    const blurayOption = await screen.findByRole("option", { name: /^Blu-ray$/i });
    expect(blurayOption).toHaveClass("rounded-xl", "py-2", "pl-9", "pr-3");
    expect(screen.getByRole("listbox")).toHaveClass(
      "rounded-2xl",
      "border-border/70",
      "bg-popover/95",
    );

    fireEvent.click(blurayOption);
    fireEvent.click(screen.getByRole("button", { name: /Salvar episódio/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Episódio salvo", intent: "success" }),
      ),
    );

    const persistedProject = apiState.getPersistedProjects().at(-1);
    expect(persistedProject?.episodeDownloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          number: 2,
          sourceType: "Blu-ray",
        }),
      ]),
    );
  });

  it("usa o seletor de fonte para adicionar links de download no editor dedicado", async () => {
    const apiState = setupApiMock();
    renderEditor("/dashboard/projetos/project-1/episodios/2");

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    const fileSection = screen.getByTestId("anime-episode-file-section");
    fireEvent.click(within(fileSection).getByRole("button", { name: /Adicionar fonte/i }));

    const sourceTrigger = within(fileSection).getByRole("combobox", { name: "Fonte 1" });
    const sourceUrlInput = within(fileSection).getByPlaceholderText("URL");
    expect(sourceUrlInput).toBeDisabled();

    fireEvent.click(sourceTrigger);
    fireEvent.click(await screen.findByRole("option", { name: /^Google Drive$/i }));
    expect(sourceUrlInput).not.toBeDisabled();

    fireEvent.change(sourceUrlInput, {
      target: { value: "https://example.com/episodio-2-google-drive" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar episódio/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Episódio salvo", intent: "success" }),
      ),
    );

    const persistedProject = apiState.getPersistedProjects().at(-1);
    expect(persistedProject?.episodeDownloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          number: 2,
          sources: [
            {
              label: "Google Drive",
              url: "https://example.com/episodio-2-google-drive",
            },
          ],
        }),
      ]),
    );
  });

  it("bloqueia o save quando existe fonte de download parcial", async () => {
    const apiState = setupApiMock();
    renderEditor("/dashboard/projetos/project-1/episodios/2");

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    const fileSection = screen.getByTestId("anime-episode-file-section");
    fireEvent.click(within(fileSection).getByRole("button", { name: /Adicionar fonte/i }));
    fireEvent.click(within(fileSection).getByRole("combobox", { name: "Fonte 1" }));
    fireEvent.click(await screen.findByRole("option", { name: /^MEGA$/i }));

    fireEvent.click(screen.getByRole("button", { name: /Salvar episódio/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Complete as fontes de download",
          variant: "destructive",
        }),
      ),
    );
    expect(apiState.getPersistedProjects()).toHaveLength(0);
  });

  it("bloqueia a publicacao local quando o episodio nao tem fonte completa", async () => {
    const apiState = setupApiMock();
    renderEditor("/dashboard/projetos/project-1/episodios/2");

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    const statusTrigger = screen.getByRole("combobox", { name: /Status/i });
    fireEvent.click(statusTrigger);
    fireEvent.click(await screen.findByRole("option", { name: /^Publicado$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Salvar episódio/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Não foi possível publicar o episódio",
          variant: "destructive",
        }),
      ),
    );
    expect(apiState.getPersistedProjects()).toHaveLength(0);
  });

  it("usa a data atual no release ao salvar episódio com release vazio", async () => {
    const apiState = setupApiMock();
    const mockedNowMs = new Date("2026-04-02T15:00:00.000Z").getTime();
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(mockedNowMs);
    renderEditor("/dashboard/projetos/project-1/episodios/2");

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    fireEvent.change(screen.getByLabelText(/^Título$/i), {
      target: { value: "Segundo episodio ajustado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar episódio/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Episódio salvo", intent: "success" }),
      ),
    );

    const persistedProject = apiState.getPersistedProjects().at(-1);
    expect(persistedProject?.episodeDownloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          number: 2,
          title: "Segundo episodio ajustado",
          releaseDate: formatLocalIsoDate(mockedNowMs),
        }),
      ]),
    );
    dateNowSpy.mockRestore();
  });

  it("remove o episódio ativo e retorna para a rota neutra", async () => {
    const apiState = setupApiMock();
    renderEditor();

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    fireEvent.click(screen.getByRole("button", { name: /Excluir/i }));
    expect(await screen.findByTestId("anime-episode-delete-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Excluir episódio/i }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/dashboard/projetos/project-1/episodios",
      ),
    );

    const persistedProject = apiState.getPersistedProjects().at(-1);
    expect(persistedProject?.episodeDownloads).toHaveLength(1);
    expect(persistedProject?.episodeDownloads).toEqual(
      expect.arrayContaining([expect.objectContaining({ number: 2 })]),
    );
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Episódio removido", intent: "success" }),
    );
  });

  it("retorna not found para projetos baseados em capítulos", async () => {
    setupApiMock({
      ...animeProjectFixture,
      id: "project-ln-1",
      type: "Light Novel",
    });

    renderEditor("/dashboard/projetos/project-ln-1/episodios/1");

    expect(await screen.findByTestId("not-found")).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("faz fallback para o estado neutro quando a rota aponta para um episodio inexistente", async () => {
    renderEditor("/dashboard/projetos/project-1/episodios/99");

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/dashboard/projetos/project-1/episodios",
      ),
    );

    expect(screen.getByTestId("anime-episode-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("not-found")).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Episódio não encontrado. Mostrando a lista.",
        intent: "warning",
      }),
    );
  });

  it("faz fallback para o estado neutro quando a rota recebe um numero de episodio invalido", async () => {
    renderEditor("/dashboard/projetos/project-1/episodios/abc");

    await screen.findByRole("heading", { name: /Gerenciamento de Episódios/i });

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/dashboard/projetos/project-1/episodios",
      ),
    );

    expect(screen.getByTestId("anime-episode-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("not-found")).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Episódio não encontrado. Mostrando a lista.",
        intent: "warning",
      }),
    );
  });
});
