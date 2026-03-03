import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DashboardProjectsEditor from "@/pages/DashboardProjectsEditor";

const { apiFetchMock, toastMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  toastMock: vi.fn(),
}));

const viteEnv = import.meta.env as Record<string, unknown>;

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

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
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
      publicationStatus: "draft",
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
      publicationStatus: "draft",
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
      content:
        '{"root":{"children":[{"type":"paragraph","children":[{"type":"text","text":"conteudo local"}],"version":1}],"version":1}}',
      contentFormat: "lexical",
      publicationStatus: "draft",
    },
  ],
};

const lightNovelMultiVolumesFixture = {
  ...lightNovelProjectFixture,
  id: "project-ln-multi-volumes",
  title: "Projeto LN Volumes",
  episodeDownloads: [
    {
      ...lightNovelProjectFixture.episodeDownloads[0],
      number: 1,
      title: "Capitulo V1",
      volume: 1,
    },
    {
      ...lightNovelProjectFixture.episodeDownloads[0],
      number: 2,
      title: "Capitulo V2",
      volume: 2,
    },
  ],
  volumeEntries: [
    {
      volume: 1,
      synopsis: "",
      coverImageUrl: "",
      coverImageAlt: "",
    },
    {
      volume: 2,
      synopsis: "",
      coverImageUrl: "",
      coverImageAlt: "",
    },
  ],
};

const anilistMediaFixture = {
  id: 97894,
  title: {
    romaji: "Imouto sae Ireba Ii.",
    english: "",
    native: "",
  },
  description: "<p>Descricao</p>",
  episodes: null,
  genres: [],
  format: "NOVEL",
  status: "RELEASING",
  countryOfOrigin: "JP",
  season: null,
  seasonYear: null,
  startDate: {},
  endDate: {},
  source: "LIGHT_NOVEL",
  averageScore: null,
  bannerImage: "",
  coverImage: {},
  studios: { nodes: [] },
  producers: { nodes: [] },
  tags: [],
  trailer: null,
  relations: { edges: [], nodes: [] },
  staff: { edges: [], nodes: [] },
};

const setupApiMock = (
  projects = [projectFixture],
  {
    capabilities = {
      project_epub_import: true,
      project_epub_export: true,
    },
    build = {
      commitSha: "abcdef123456",
      builtAt: "2026-03-02T16:00:00Z",
    },
  }: {
    capabilities?: {
      project_epub_import: boolean;
      project_epub_export: boolean;
    };
    build?: {
      commitSha: string | null;
      builtAt: string | null;
    };
  } = {},
) => {
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
        capabilities,
        build,
        endpoints: [
          { method: "POST", path: "/api/projects/epub/import" },
          { method: "POST", path: "/api/projects/epub/export" },
        ],
      });
    }

    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const scrollIntoViewMock = vi.fn();
const resizeObserverObserveMock = vi.fn();
const resizeObserverUnobserveMock = vi.fn();
const resizeObserverDisconnectMock = vi.fn();
const originalResizeObserver = globalThis.ResizeObserver;

const ResizeObserverMock = vi.fn(() => ({
  observe: resizeObserverObserveMock,
  unobserve: resizeObserverUnobserveMock,
  disconnect: resizeObserverDisconnectMock,
}));

const getEpisodeTrigger = (name: RegExp) => {
  const match = screen
    .getAllByRole("button", { name })
    .find((element) => element.hasAttribute("data-episode-accordion-trigger"));
  if (!match) {
    throw new Error(`Episode trigger not found for ${String(name)}`);
  }
  return match;
};

const getVolumeGroupTrigger = (group: HTMLElement) => {
  const [trigger] = within(group).getAllByRole("button");
  if (!trigger) {
    throw new Error("Volume group trigger not found");
  }
  return trigger;
};
const episode1TriggerPattern = /(Epis[oó]dio|Episódio)\s+1/i;
const episode2TriggerPattern = /(Epis[oó]dio|Episódio)\s+2/i;

const chapter1TriggerPattern = /Cap.tulo\s+1/i;
const chapterOpenOverflowClass = "data-[state=open]:overflow-visible";

const getOpenAccordionContentRoot = (element: HTMLElement) => {
  const root = element.closest("div[data-state='open'].overflow-hidden");
  if (!root) {
    throw new Error("Open accordion content root not found");
  }
  return root as HTMLElement;
};

const openEpisodeEditor = async ({
  projectTitle = "Projeto Teste",
  sectionNamePattern = /Epis/i,
  removeButtonPattern = /Remover (epis|cap)/i,
  autoOpenFirstVolumeGroup = true,
  waitForRemoveButtons = true,
}: {
  projectTitle?: string;
  sectionNamePattern?: RegExp;
  removeButtonPattern?: RegExp;
  autoOpenFirstVolumeGroup?: boolean;
  waitForRemoveButtons?: boolean;
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
  if (autoOpenFirstVolumeGroup && screen.queryByRole("button", { name: /Adicionar volume/i })) {
    const volumeGroups = await screen.findAllByTestId(/volume-group-/i);
    volumeGroups.forEach((group) => {
      const trigger = getVolumeGroupTrigger(group);
      if (trigger.getAttribute("aria-expanded") !== "true") {
        fireEvent.click(trigger);
      }
    });
  }
  if (waitForRemoveButtons) {
    await screen.findAllByRole("button", { name: removeButtonPattern });
  }
};

describe("DashboardProjectsEditor episode accordion", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubEnv("VITE_APP_COMMIT_SHA", "frontend123456");
    vi.stubEnv("VITE_APP_BUILD_TIME", "2026-03-02T17:00:00Z");
    viteEnv.VITE_APP_COMMIT_SHA = "frontend123456";
    viteEnv.VITE_APP_BUILD_TIME = "2026-03-02T17:00:00Z";
    setupApiMock();
    scrollIntoViewMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });
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
    vi.unstubAllEnvs();
  });

  it("nao fecha ao clicar no fundo do card", async () => {
    await openEpisodeEditor();

    fireEvent.click(getEpisodeTrigger(episode1TriggerPattern));
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

    const episodeTrigger = getEpisodeTrigger(episode1TriggerPattern);
    expect(screen.queryByDisplayValue("Primeiro episodio")).not.toBeInTheDocument();

    fireEvent.click(episodeTrigger);
    expect(screen.getByDisplayValue("Primeiro episodio")).toBeInTheDocument();

    fireEvent.click(episodeTrigger);
    expect(screen.queryByDisplayValue("Primeiro episodio")).not.toBeInTheDocument();
  });

  it("permite abrir multiplos episodios ao mesmo tempo", async () => {
    await openEpisodeEditor();

    fireEvent.click(getEpisodeTrigger(episode1TriggerPattern));
    fireEvent.click(getEpisodeTrigger(episode2TriggerPattern));

    expect(screen.getByDisplayValue("Primeiro episodio")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();
  });

  it("mantem alinhamento do estado ao remover episodio", async () => {
    await openEpisodeEditor();

    fireEvent.click(getEpisodeTrigger(episode2TriggerPattern));
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Remover epis/i })[0]);
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();

    const remainingTrigger = getEpisodeTrigger(episode2TriggerPattern);
    fireEvent.click(remainingTrigger);
    expect(screen.queryByDisplayValue("Segundo episodio")).not.toBeInTheDocument();
    fireEvent.click(remainingTrigger);
    expect(screen.getByDisplayValue("Segundo episodio")).toBeInTheDocument();
  });

  it("botao remover nao dispara toggle do accordion", async () => {
    await openEpisodeEditor();

    expect(screen.queryByDisplayValue("Segundo episodio")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Remover epis/i })[0]);
    expect(
      screen
        .queryAllByRole("button", { name: episode1TriggerPattern })
        .find((element) => element.hasAttribute("data-episode-accordion-trigger")),
    ).toBeUndefined();
    expect(screen.queryByDisplayValue("Segundo episodio")).not.toBeInTheDocument();

    const remainingTrigger = getEpisodeTrigger(episode2TriggerPattern);
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

  it("mantem foco ao editar numero e move capitulo para o novo volume", async () => {
    setupApiMock([lightNovelProjectFixture]);
    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(getEpisodeTrigger(chapter1TriggerPattern));

    const chapterCard = await screen.findByTestId("episode-card-0");
    const [numberInput, volumeInput] = within(chapterCard).getAllByRole(
      "spinbutton",
    ) as HTMLInputElement[];

    numberInput.focus();
    expect(numberInput).toHaveFocus();

    fireEvent.change(numberInput, { target: { value: "12" } });
    await waitFor(() => {
      expect(numberInput).toHaveFocus();
      expect(screen.getByTestId("episode-card-0")).toBe(chapterCard);
    });

    volumeInput.focus();
    expect(volumeInput).toHaveFocus();

    fireEvent.change(volumeInput, { target: { value: "3" } });
    const volumeThreeGroup = await screen.findByTestId("volume-group-3");
    const volumeThreeTrigger = getVolumeGroupTrigger(volumeThreeGroup);
    fireEvent.click(volumeThreeTrigger);
    expect(
      within(volumeThreeGroup).getByRole("button", { name: /Cap.tulo\s+12/i }),
    ).toBeInTheDocument();
  });

  it("exibe status, volume e fontes em capitulos de light novel", async () => {
    setupApiMock([lightNovelProjectFixture]);
    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(getEpisodeTrigger(chapter1TriggerPattern));

    const chapterCard = await screen.findByTestId("episode-card-0");
    const chapterHeader = screen.getByTestId("episode-header-0");
    expect(
      within(chapterHeader).getByTestId("episode-header-status-visibility-0"),
    ).toHaveTextContent(/Rascunho.*Leitura/i);
    expect(within(chapterHeader).queryByText(/^Rascunho$/i)).not.toBeInTheDocument();
    expect(within(chapterHeader).queryByText(/^Leitura$/i)).not.toBeInTheDocument();
    expect(within(chapterCard).getByPlaceholderText("Volume")).toBeInTheDocument();
    expect(within(chapterCard).getByText("Fontes de download")).toBeInTheDocument();
    expect(within(chapterCard).getByRole("button", { name: /Adicionar fonte/i })).toBeInTheDocument();
    expect(within(chapterCard).getAllByRole("combobox").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Conte.do.*cap.tulos/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar volume/i })).toBeInTheDocument();
    expect(screen.getByTestId("volume-group-none")).toBeInTheDocument();
  });

  it("aplica overflow visivel na raiz dos accordions de capitulos abertos", async () => {
    setupApiMock([lightNovelProjectFixture]);
    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(getEpisodeTrigger(chapter1TriggerPattern));

    const addVolumeButton = screen.getByRole("button", { name: /Adicionar volume/i });
    const chapterTrigger = getEpisodeTrigger(chapter1TriggerPattern);
    const chapterVolumeInput = screen.getByPlaceholderText("Volume");

    const sectionContentRoot = getOpenAccordionContentRoot(addVolumeButton);
    const volumeGroupContentRoot = getOpenAccordionContentRoot(chapterTrigger);
    const chapterPanelContentRoot = getOpenAccordionContentRoot(chapterVolumeInput);

    expect(sectionContentRoot.className).toContain(chapterOpenOverflowClass);
    expect(volumeGroupContentRoot.className).toContain(chapterOpenOverflowClass);
    expect(chapterPanelContentRoot.className).toContain(chapterOpenOverflowClass);
  });

  it("permite alternar entre principal e extra com numeracao tecnica automatica e persiste no save", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();
    const savedPayloads: Array<Record<string, unknown>> = [];

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === `/api/projects/${lightNovelProjectFixture.id}` && method === "PUT") {
        const payload = (((options as { json?: unknown } | undefined)?.json || {}) ??
          {}) as Record<string, unknown>;
        savedPayloads.push(payload);
        return mockJsonResponse(true, {
          project: {
            ...lightNovelProjectFixture,
            ...payload,
          },
        });
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(getEpisodeTrigger(chapter1TriggerPattern));
    const chapterCard = await screen.findByTestId("episode-card-0");
    const entryTypeCombobox = within(chapterCard).getByRole("combobox", {
      name: /Tipo da entrada/i,
    });
    fireEvent.click(entryTypeCombobox);
    fireEvent.click(await screen.findByRole("option", { name: "Extra" }));

    await waitFor(() => {
      const numberInput = within(chapterCard).getAllByRole("spinbutton")[0] as HTMLInputElement;
      expect(numberInput).toBeDisabled();
      expect(Number(numberInput.value)).toBeGreaterThanOrEqual(100000);
    });

    fireEvent.click(screen.getByRole("button", { name: /Salvar projeto/i }));
    await waitFor(() => {
      expect(savedPayloads.length).toBe(1);
    });
    const savedAsExtra = (savedPayloads[0]?.episodeDownloads as Array<Record<string, unknown>>) || [];
    expect(savedAsExtra[0]).toEqual(
      expect.objectContaining({
        entryKind: "extra",
        entrySubtype: "extra",
      }),
    );
    expect(Number(savedAsExtra[0]?.number)).toBeGreaterThanOrEqual(100000);
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Editar projeto" })).not.toBeInTheDocument();
    });
    fireEvent.click(await screen.findByRole("button", { name: "Projeto Light Novel" }));
    const editorDialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(editorDialog).getByRole("button", {
        name: /Conte.do.*cap.tulos/i,
      }),
    );
    const volumeGroups = within(editorDialog).getAllByTestId(/volume-group-/i);
    volumeGroups.forEach((group) => {
      const trigger = getVolumeGroupTrigger(group);
      if (trigger.getAttribute("aria-expanded") !== "true") {
        fireEvent.click(trigger);
      }
    });
    fireEvent.click(within(editorDialog).getByRole("button", { name: chapter1TriggerPattern }));
    const reopenedChapterCard = within(editorDialog).getByTestId("episode-card-0");

    fireEvent.click(
      within(reopenedChapterCard).getByRole("combobox", {
        name: /Tipo da entrada/i,
      }),
    );
    fireEvent.click(await screen.findByRole("option", { name: "Principal" }));

    await waitFor(() => {
      const numberInput = within(reopenedChapterCard).getAllByRole("spinbutton")[0] as HTMLInputElement;
      expect(numberInput).not.toBeDisabled();
      expect(Number(numberInput.value)).toBeLessThan(100000);
    });

    fireEvent.click(screen.getByRole("button", { name: /Salvar projeto/i }));
    await waitFor(() => {
      expect(savedPayloads.length).toBe(2);
    });
    const savedAsMain = (savedPayloads[1]?.episodeDownloads as Array<Record<string, unknown>>) || [];
    expect(savedAsMain[0]).toEqual(
      expect.objectContaining({
        entryKind: "main",
        entrySubtype: "chapter",
      }),
    );
    expect(Number(savedAsMain[0]?.number)).toBeGreaterThan(0);
    expect(Number(savedAsMain[0]?.number)).toBeLessThan(100000);
  });

  it("oculta controles de volume fora de manga/light novel", async () => {
    await openEpisodeEditor();
    expect(screen.queryByRole("button", { name: /Adicionar volume/i })).not.toBeInTheDocument();
  });

  it("envia volumeEntries e volumeCovers vazios ao salvar projeto sem suporte a volume", async () => {
    const animeWithVolumesFixture = {
      ...projectFixture,
      id: "project-anime-volumes",
      title: "Projeto Anime Legado",
      volumeEntries: [
        {
          volume: 1,
          synopsis: "Sinopse legado",
          coverImageUrl: "/uploads/volume-1.jpg",
          coverImageAlt: "Capa do volume 1",
        },
      ],
      volumeCovers: [
        {
          volume: 1,
          coverImageUrl: "/uploads/volume-1.jpg",
          coverImageAlt: "Capa do volume 1",
        },
      ],
    };
    setupApiMock([animeWithVolumesFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();
    let savedPayload: any = null;

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === `/api/projects/${animeWithVolumesFixture.id}` && method === "PUT") {
        savedPayload = (options as { json?: unknown } | undefined)?.json || null;
        return mockJsonResponse(true, {
          project: {
            ...animeWithVolumesFixture,
            ...(savedPayload || {}),
          },
        });
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({ projectTitle: "Projeto Anime Legado" });
    expect(screen.queryByRole("button", { name: /Adicionar volume/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Salvar projeto/i }));

    await waitFor(() => {
      expect(savedPayload).not.toBeNull();
    });
    expect(savedPayload.volumeEntries).toEqual([]);
    expect(savedPayload.volumeCovers).toEqual([]);
  });

  it("abre a secao de capitulos ao detectar volume duplicado no save", async () => {
    const lightNovelWithDuplicateVolumesFixture = {
      ...lightNovelProjectFixture,
      id: "project-ln-duplicated-volumes",
      title: "Projeto LN Duplicado",
      volumeEntries: [
        {
          volume: 2,
          synopsis: "Sinopse A",
          coverImageUrl: "/uploads/volume-2-a.jpg",
          coverImageAlt: "Capa do volume 2 A",
        },
        {
          volume: 2,
          synopsis: "Sinopse B",
          coverImageUrl: "/uploads/volume-2-b.jpg",
          coverImageAlt: "Capa do volume 2 B",
        },
      ],
      volumeCovers: [
        {
          volume: 2,
          coverImageUrl: "/uploads/volume-2-a.jpg",
          coverImageAlt: "Capa do volume 2 A",
        },
      ],
    };
    setupApiMock([lightNovelWithDuplicateVolumesFixture]);

    await openEpisodeEditor({
      projectTitle: "Projeto LN Duplicado",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    const chaptersTrigger = screen.getByRole("button", { name: /Conte.do.*cap.tulos/i });
    fireEvent.click(chaptersTrigger);
    expect(chaptersTrigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: /Salvar projeto/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Volumes duplicados",
          description: "Cada volume pode aparecer apenas uma vez.",
          variant: "destructive",
        }),
      );
    });
    expect(screen.getByRole("button", { name: /Conte.do.*cap.tulos/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      apiFetchMock.mock.calls.some((call) => String(call[1] || "").startsWith("/api/projects/"))
    ).toBe(false);
  });

  it("permite criar volume sem capitulo e exibe grupo vazio", async () => {
    setupApiMock([lightNovelProjectFixture]);
    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Adicionar volume/i }));

    const volumeGroup = await screen.findByTestId("volume-group-1");
    expect(volumeGroup).toBeInTheDocument();
    expect(within(volumeGroup).getByText(/Nenhum cap.tulo vinculado a este volume/i)).toBeInTheDocument();
  });

  it("inicia volumes colapsados e permite alternar abertura do grupo", async () => {
    setupApiMock([lightNovelProjectFixture]);
    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
      autoOpenFirstVolumeGroup: false,
      waitForRemoveButtons: false,
    });

    const volumeGroup = await screen.findByTestId("volume-group-none");
    const volumeTrigger = getVolumeGroupTrigger(volumeGroup);

    expect(within(volumeGroup).queryByTestId("episode-card-0")).not.toBeInTheDocument();
    expect(volumeTrigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(volumeTrigger);
    expect(within(volumeGroup).getByTestId("episode-card-0")).toBeInTheDocument();
    expect(volumeTrigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(volumeTrigger);
    expect(within(volumeGroup).queryByTestId("episode-card-0")).not.toBeInTheDocument();
    expect(volumeTrigger).toHaveAttribute("aria-expanded", "false");
  });

  it("abre o grupo sem volume ao adicionar capitulo", async () => {
    setupApiMock([lightNovelProjectFixture]);
    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
      autoOpenFirstVolumeGroup: false,
      waitForRemoveButtons: false,
    });

    const volumeGroup = await screen.findByTestId("volume-group-none");
    const volumeTrigger = getVolumeGroupTrigger(volumeGroup);

    expect(volumeTrigger).toHaveAttribute("aria-expanded", "false");
    expect(within(volumeGroup).queryByTestId("episode-card-0")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Adicionar cap/i }));

    await waitFor(() => {
      expect(volumeTrigger).toHaveAttribute("aria-expanded", "true");
      expect(within(volumeGroup).getByTestId("episode-card-1")).toBeInTheDocument();
    });
  });

  it("remover metadados de volume nao dispara toggle do accordion", async () => {
    setupApiMock([lightNovelMultiVolumesFixture]);
    await openEpisodeEditor({
      projectTitle: "Projeto LN Volumes",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
      autoOpenFirstVolumeGroup: false,
      waitForRemoveButtons: false,
    });

    const volumeOneGroup = await screen.findByTestId("volume-group-1");
    const volumeOneTrigger = getVolumeGroupTrigger(volumeOneGroup);
    const removeVolumeMetadataButton = volumeOneGroup.querySelector(
      "button[data-no-toggle]",
    ) as HTMLButtonElement | null;

    expect(volumeOneTrigger).toHaveAttribute("aria-expanded", "false");
    expect(removeVolumeMetadataButton).not.toBeNull();

    fireEvent.click(removeVolumeMetadataButton as HTMLButtonElement);

    expect(volumeOneTrigger).toHaveAttribute("aria-expanded", "false");
    expect(within(volumeOneGroup).queryByText("Capitulo V1")).not.toBeInTheDocument();
  });

  it("abre volume ao clicar no lado direito do header (contador de capitulos)", async () => {
    setupApiMock([lightNovelProjectFixture]);
    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
      autoOpenFirstVolumeGroup: false,
      waitForRemoveButtons: false,
    });

    const volumeGroup = await screen.findByTestId("volume-group-none");
    expect(within(volumeGroup).queryByTestId("episode-card-0")).not.toBeInTheDocument();

    fireEvent.click(within(volumeGroup).getByText(/1 cap.tulo\(s\)/i));
    expect(within(volumeGroup).getByTestId("episode-card-0")).toBeInTheDocument();
  });

  it("preserva estado do volume aberto durante edicao do capitulo", async () => {
    setupApiMock([lightNovelProjectFixture]);
    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
      autoOpenFirstVolumeGroup: false,
      waitForRemoveButtons: false,
    });

    const volumeGroup = await screen.findByTestId("volume-group-none");
    const volumeTrigger = getVolumeGroupTrigger(volumeGroup);
    fireEvent.click(volumeTrigger);
    fireEvent.click(getEpisodeTrigger(chapter1TriggerPattern));

    const titleInput = await screen.findByDisplayValue("Capitulo 1");
    fireEvent.change(titleInput, { target: { value: "Capitulo 1 editado" } });

    expect(screen.getByDisplayValue("Capitulo 1 editado")).toBeInTheDocument();
    expect(volumeTrigger).toHaveAttribute("aria-expanded", "true");
  });

  it("mantem estado de colapso independente entre multiplos volumes", async () => {
    setupApiMock([lightNovelMultiVolumesFixture]);
    await openEpisodeEditor({
      projectTitle: "Projeto LN Volumes",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
      autoOpenFirstVolumeGroup: false,
      waitForRemoveButtons: false,
    });

    const volumeOneGroup = await screen.findByTestId("volume-group-1");
    const volumeTwoGroup = await screen.findByTestId("volume-group-2");
    const volumeOneTrigger = getVolumeGroupTrigger(volumeOneGroup);
    const volumeTwoTrigger = getVolumeGroupTrigger(volumeTwoGroup);

    expect(within(volumeOneGroup).queryByText("Capitulo V1")).not.toBeInTheDocument();
    expect(within(volumeTwoGroup).queryByText("Capitulo V2")).not.toBeInTheDocument();

    fireEvent.click(volumeOneTrigger);
    expect(within(volumeOneGroup).getByText("Capitulo V1")).toBeInTheDocument();
    expect(within(volumeTwoGroup).queryByText("Capitulo V2")).not.toBeInTheDocument();

    fireEvent.click(volumeTwoTrigger);
    expect(within(volumeOneGroup).getByText("Capitulo V1")).toBeInTheDocument();
    expect(within(volumeTwoGroup).getByText("Capitulo V2")).toBeInTheDocument();

    fireEvent.click(volumeOneTrigger);
    expect(within(volumeOneGroup).queryByText("Capitulo V1")).not.toBeInTheDocument();
    expect(within(volumeTwoGroup).getByText("Capitulo V2")).toBeInTheDocument();
  });

  it("desabilita ferramentas EPUB quando o backend nao anuncia suporte", async () => {
    setupApiMock([lightNovelProjectFixture], {
      capabilities: {
        project_epub_import: false,
        project_epub_export: false,
      },
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));

    expect(
      screen.getByText(/backend desatualizado e ainda nao suporta EPUB/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar EPUB/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Exportar volume em EPUB/i })).toBeDisabled();
  });

  it("desabilita ferramentas EPUB quando o contrato da API falha", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/contracts/v1.json" && method === "GET") {
        return mockJsonResponse(false, { error: "unavailable" }, 500);
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));

    expect(
      screen.getByText(/Nao foi possivel confirmar o suporte EPUB deste ambiente/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar EPUB/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Exportar volume em EPUB/i })).toBeDisabled();
  });

  it("exibe metadata de build do backend e do frontend na secao EPUB", async () => {
    setupApiMock([lightNovelProjectFixture], {
      build: {
        commitSha: "abcdef1234567890",
        builtAt: "2026-03-02T16:00:00Z",
      },
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));

    expect(screen.getByText(/Contrato da API: commit abcdef123456 \| build 2026-03-02T16:00:00Z/i)).toBeInTheDocument();
    expect(screen.getByText(/Frontend: commit frontend1234 \| build 2026-03-02T17:00:00Z/i)).toBeInTheDocument();
  });

  it("mostra erro especifico quando a rota de importacao EPUB retorna 404", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (String(path).startsWith("/api/projects/epub/import") && method === "POST") {
        return mockJsonResponse(false, { error: "not_found" }, 404);
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));
    const importButton = screen.getByRole("button", { name: /Importar EPUB/i });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });
    const fileInput = screen.getByLabelText(/Arquivo \.epub/i);
    const file = new File(["epub"], "teste.epub", { type: "application/epub+zip" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Falha ao importar EPUB",
          description:
            "A origem atual nao esta alcancando a rota EPUB deste backend. Verifique tunel, proxy ou host aberto no navegador.",
          variant: "destructive",
        }),
      );
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "epub_backend_parity_mismatch",
      expect.objectContaining({
        reason: "route_unreachable_for_current_origin",
        path: "/api/projects/epub/import",
        status: 404,
        apiBase: "http://api.local",
        frontend: expect.objectContaining({
          commitSha: "frontend123456",
        }),
        backend: expect.objectContaining({
          commitSha: "abcdef123456",
        }),
      }),
    );
    consoleWarnSpy.mockRestore();
  });

  it("trata 404 project_not_found legado sem confundir com rota ausente", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/projects/epub/import" && method === "POST") {
        return mockJsonResponse(false, { error: "project_not_found" }, 404);
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));
    const importButton = screen.getByRole("button", { name: /Importar EPUB/i });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });
    const fileInput = screen.getByLabelText(/Arquivo \.epub/i);
    fireEvent.change(fileInput, {
      target: { files: [new File(["epub"], "teste.epub", { type: "application/epub+zip" })] },
    });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Falha ao importar EPUB",
          description:
            "O backend tentou resolver um projeto salvo que nao existe mais. Recarregue o editor e tente novamente.",
          variant: "destructive",
        }),
      );
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "epub_backend_parity_mismatch",
      expect.objectContaining({
        reason: "legacy_project_not_found",
        status: 404,
      }),
    );
    consoleWarnSpy.mockRestore();
  });

  it("mantem a mensagem de processamento para epub_import_failed", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (String(path).startsWith("/api/projects/epub/import") && method === "POST") {
        return mockJsonResponse(false, { error: "epub_import_failed" }, 400);
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));
    const importButton = screen.getByRole("button", { name: /Importar EPUB/i });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });
    const fileInput = screen.getByLabelText(/Arquivo \.epub/i);
    const file = new File(["epub"], "teste.epub", { type: "application/epub+zip" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Falha ao importar EPUB",
          description: "Nao foi possivel processar o arquivo informado.",
          variant: "destructive",
        }),
      );
    });
  });

  it("nao expoe detalhe tecnico de Specificity.max no toast de erro de importacao", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (String(path).startsWith("/api/projects/epub/import") && method === "POST") {
        return mockJsonResponse(
          false,
          {
            error: "epub_import_failed",
            detail:
              "Cannot destructure property 'value' of 'Specificity.max(...)' as it is undefined.",
          },
          400,
        );
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));
    const importButton = screen.getByRole("button", { name: /Importar EPUB/i });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });
    const fileInput = screen.getByLabelText(/Arquivo \.epub/i);
    const file = new File(["epub"], "teste.epub", { type: "application/epub+zip" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Falha ao importar EPUB",
          description: "Nao foi possivel processar o arquivo informado.",
          variant: "destructive",
        }),
      );
    });
  });

  it("mostra erro especifico quando o snapshot do projeto e invalido", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/projects/epub/import" && method === "POST") {
        return mockJsonResponse(false, { error: "invalid_project_snapshot" }, 400);
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));
    const importButton = screen.getByRole("button", { name: /Importar EPUB/i });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });
    const fileInput = screen.getByLabelText(/Arquivo \.epub/i);
    fireEvent.change(fileInput, {
      target: { files: [new File(["epub"], "teste.epub", { type: "application/epub+zip" })] },
    });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Falha ao importar EPUB",
          description:
            "Nao foi possivel enviar o snapshot atual do projeto para a importacao EPUB.",
          variant: "destructive",
        }),
      );
    });
  });

  it("mostra erro especifico quando o snapshot excede o limite no backend novo", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/projects/epub/import" && method === "POST") {
        return mockJsonResponse(false, { error: "project_snapshot_too_large" }, 400);
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));
    const importButton = screen.getByRole("button", { name: /Importar EPUB/i });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });
    const fileInput = screen.getByLabelText(/Arquivo \.epub/i);
    fireEvent.change(fileInput, {
      target: { files: [new File(["epub"], "teste.epub", { type: "application/epub+zip" })] },
    });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Falha ao importar EPUB",
          description:
            "O snapshot atual do projeto excedeu o limite da importacao EPUB. Salve o projeto e tente novamente.",
          variant: "destructive",
        }),
      );
    });
  });

  it("mantem compatibilidade com backend legado para Field value too long", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/projects/epub/import" && method === "POST") {
        return mockJsonResponse(
          false,
          {
            error: "invalid_multipart_upload",
            detail: "Field value too long",
          },
          400,
        );
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));
    const importButton = screen.getByRole("button", { name: /Importar EPUB/i });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });
    const fileInput = screen.getByLabelText(/Arquivo \.epub/i);
    fireEvent.change(fileInput, {
      target: { files: [new File(["epub"], "teste.epub", { type: "application/epub+zip" })] },
    });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Falha ao importar EPUB",
          description:
            "O snapshot atual do projeto excedeu o limite da importacao EPUB. Salve o projeto e tente novamente.",
          variant: "destructive",
        }),
      );
    });
  });

  it("exibe detalhe de indisponibilidade quando persistencia de uploads falha no backend", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/projects/epub/import" && method === "POST") {
        return mockJsonResponse(
          false,
          {
            error: "epub_import_upload_persist_failed",
            detail:
              "Nao foi possivel persistir as imagens importadas do EPUB neste momento. Tente novamente em alguns instantes.",
          },
          503,
        );
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));
    const importButton = screen.getByRole("button", { name: /Importar EPUB/i });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });
    const fileInput = screen.getByLabelText(/Arquivo \.epub/i);
    fireEvent.change(fileInput, {
      target: { files: [new File(["epub"], "teste.epub", { type: "application/epub+zip" })] },
    });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Falha ao importar EPUB",
          description:
            "Nao foi possivel persistir as imagens importadas do EPUB neste momento. Tente novamente em alguns instantes.",
          variant: "destructive",
        }),
      );
    });
  });

  it("importa EPUB no formulario e exporta o snapshot atual", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();
    const createObjectUrlMock = vi.fn(() => "blob:epub");
    const revokeObjectUrlMock = vi.fn();
    const anchorClickMock = vi.fn();
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    const originalAnchorClick = HTMLAnchorElement.prototype.click;

    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      writable: true,
      value: anchorClickMock,
    });

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (String(path).startsWith("/api/projects/epub/import") && method === "POST") {
        return mockJsonResponse(true, {
          summary: {
            chapters: 1,
            created: 1,
            updated: 0,
            volume: 2,
            imagesImported: 2,
            imageImportFailures: 1,
            boilerplateDiscarded: 2,
            unresolvedTocEntries: 0,
            volumeCoverImported: true,
            volumeCoverSkipped: false,
          },
          warnings: [
            "Itens de boilerplate ignorados: 2.",
            'Imagem interna ignorada no capitulo "Capitulo importado": ../Images/missing.jpg.',
            "Capa do volume importada do EPUB para o volume 2.",
          ],
          volumeCovers: [
            {
              volume: 2,
              coverImageUrl: "/uploads/tmp/epub-imports/test/import/volume-cover.jpg",
              coverImageAlt: "Capa do volume 2",
              mergeMode: "create",
            },
          ],
          chapters: [
            {
              number: 2,
              volume: 2,
              title: "Capitulo importado",
              releaseDate: "",
              duration: "",
              sourceType: "Web",
              sources: [],
              progressStage: "aguardando-raw",
              completedStages: [],
              content: '{"root":{"children":[{"type":"paragraph"}]}}',
              contentFormat: "lexical",
              publicationStatus: "draft",
              mergeMode: "create",
              episodeKey: "2:2",
            },
          ],
        });
      }
      if (path === "/api/projects/epub/export" && method === "POST") {
        return {
          ok: true,
          status: 200,
          headers: new Headers({
            "Content-Disposition": 'attachment; filename="projeto-light-novel-vol-02.epub"',
          }),
          blob: async () => new Blob(["epub"]),
          json: async () => ({}),
        } as Response;
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));
    const importButton = screen.getByRole("button", { name: /Importar EPUB/i });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });

    const fileInput = screen.getByLabelText(/Arquivo \.epub/i);
    const file = new File(["epub"], "teste.epub", { type: "application/epub+zip" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText(/Volume de destino/i), { target: { value: "2" } });
    fireEvent.click(importButton);

    scrollIntoViewMock.mockClear();

    const importedVolumeGroup = await screen.findByTestId("volume-group-2");
    const importedVolumeGroupTrigger = getVolumeGroupTrigger(importedVolumeGroup);
    await waitFor(() => {
      expect(importedVolumeGroupTrigger).toHaveAttribute("aria-expanded", "true");
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });
    await within(importedVolumeGroup).findByText("Capitulo importado");
    expect(screen.queryByDisplayValue("Capitulo importado")).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "EPUB importado",
        description:
          '1 capitulo(s) incorporados ao formulario para revisao. 1 capitulo(s) principais detectados. 2 item(ns) de boilerplate foram descartados. 2 imagem(ns) interna(s) foram importadas. 1 imagem(ns) falharam e foram ignoradas. A capa do volume foi incorporada ao formulario. Itens de boilerplate ignorados: 2. Imagem interna ignorada no capitulo "Capitulo importado": ../Images/missing.jpg. Capa do volume importada do EPUB para o volume 2.',
        intent: "success",
      }),
    );

    fireEvent.click(within(importedVolumeGroup).getByRole("button", { name: /Cap.tulo importado/i }));
    await screen.findByDisplayValue("Capitulo importado");

    const importCall = apiFetchMock.mock.calls.find((call) =>
      call[1] === "/api/projects/epub/import",
    );
    expect(importCall).toBeDefined();
    const importOptions = ((importCall?.[2] || {}) as RequestInit) || {};
    expect(importOptions.body).toBeInstanceOf(FormData);
    const importBody = importOptions.body as FormData;
    expect(importBody.get("targetVolume")).toBe("2");
    expect(importBody.get("defaultStatus")).toBe("draft");
    expect(importBody.get("file")).toBeInstanceOf(File);
    const importProjectPayload = JSON.parse(String(importBody.get("project") || "{}"));
    expect(importProjectPayload.id).toBe("project-ln-1");
    expect(importProjectPayload.type).toBe("Light Novel");
    expect(importProjectPayload.title).toBe("Projeto Light Novel");
    expect(importProjectPayload.episodeDownloads).toEqual([
      expect.objectContaining({
        number: 1,
        publicationStatus: "draft",
      }),
    ]);
    expect(importProjectPayload.episodeDownloads[0]).not.toHaveProperty("content");
    expect(importProjectPayload.episodeDownloads[0]).not.toHaveProperty("sources");

    fireEvent.change(screen.getByLabelText(/Volume para exportacao/i), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Incluir rascunhos/i }));
    const exportButton = screen.getByRole("button", { name: /Exportar volume em EPUB/i });
    await waitFor(() => {
      expect(exportButton).not.toBeDisabled();
    });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(anchorClickMock).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1);
    });

    const exportCall = apiFetchMock.mock.calls.find((call) => call[1] === "/api/projects/epub/export");
    expect(exportCall).toBeDefined();
    const exportPayload = JSON.parse(String(((exportCall?.[2] || {}) as RequestInit).body || "{}"));
    expect(exportPayload.volume).toBe(2);
    expect(exportPayload.includeDrafts).toBe(true);
    expect(exportPayload.project.episodeDownloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          number: 2,
          volume: 2,
          title: "Capitulo importado",
          publicationStatus: "draft",
        }),
      ]),
    );
    expect(exportPayload.project.volumeCovers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          volume: 2,
          coverImageUrl: "/uploads/tmp/epub-imports/test/import/volume-cover.jpg",
          coverImageAlt: "Capa do volume 2",
        }),
      ]),
    );
    expect(exportPayload.project.volumeEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          volume: 2,
          coverImageUrl: "/uploads/tmp/epub-imports/test/import/volume-cover.jpg",
          coverImageAlt: "Capa do volume 2",
        }),
      ]),
    );

    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      writable: true,
      value: originalAnchorClick,
    });
  });

  it("abre a secao de conteudo e faz scroll apos importar EPUB sem volume numerico", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (String(path).startsWith("/api/projects/epub/import") && method === "POST") {
        return mockJsonResponse(true, {
          summary: {
            chapters: 1,
            created: 1,
            updated: 0,
            imagesImported: 0,
            imageImportFailures: 0,
            boilerplateDiscarded: 0,
            unresolvedTocEntries: 0,
            volumeCoverImported: false,
            volumeCoverSkipped: false,
          },
          warnings: [],
          volumeCovers: [],
          chapters: [
            {
              number: 2,
              title: "Capitulo sem volume",
              releaseDate: "",
              duration: "",
              sourceType: "Web",
              sources: [],
              progressStage: "aguardando-raw",
              completedStages: [],
              content: '{"root":{"children":[{"type":"paragraph"}]}}',
              contentFormat: "lexical",
              publicationStatus: "draft",
              mergeMode: "create",
              episodeKey: "2:none",
            },
          ],
        });
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));
    const importButton = screen.getByRole("button", { name: /Importar EPUB/i });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });

    const fileInput = screen.getByLabelText(/Arquivo \.epub/i);
    fireEvent.change(fileInput, {
      target: { files: [new File(["epub"], "sem-volume.epub", { type: "application/epub+zip" })] },
    });

    scrollIntoViewMock.mockClear();
    fireEvent.click(importButton);

    const contentTrigger = screen.getByRole("button", { name: /Conte/i });
    await waitFor(() => {
      expect(contentTrigger).toHaveAttribute("aria-expanded", "true");
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });
    await screen.findByText("Capitulo sem volume");
  });
  it("aceita url completa do AniList no import", async () => {
    setupApiMock([lightNovelProjectFixture]);
    const baseImplementation = apiFetchMock.getMockImplementation();

    apiFetchMock.mockImplementation(async (base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/anilist/97894" && method === "GET") {
        return mockJsonResponse(true, { data: { Media: anilistMediaFixture } });
      }
      return baseImplementation
        ? (baseImplementation(base, path, options) as Promise<Response>)
        : mockJsonResponse(false, { error: "not_found" }, 404);
    });

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));
    fireEvent.change(screen.getByLabelText(/ID ou URL do AniList/i), {
      target: { value: "https://anilist.co/manga/97894/Imouto-sae-Ireba-Ii/" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Importar do AniList$/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "http://api.local",
        "/api/anilist/97894",
        expect.objectContaining({ auth: true }),
      );
    });
    expect(screen.getByDisplayValue("Imouto sae Ireba Ii.")).toBeInTheDocument();
  });

  it("bloqueia ids AniList nao positivos sem chamar a API", async () => {
    setupApiMock([lightNovelProjectFixture]);

    await openEpisodeEditor({
      projectTitle: "Projeto Light Novel",
      sectionNamePattern: /Cap/i,
      removeButtonPattern: /Remover cap/i,
    });

    fireEvent.click(screen.getByRole("button", { name: /Importa[^r]/i }));
    fireEvent.change(screen.getByLabelText(/ID ou URL do AniList/i), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Importar do AniList$/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "ID do AniList invalido",
          description: "Informe um ID ou URL valida do AniList antes de importar.",
          variant: "destructive",
        }),
      );
    });
    expect(apiFetchMock.mock.calls.some((call) => call[1] === "/api/anilist/0")).toBe(false);
  });
});
