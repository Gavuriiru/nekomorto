import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  EditorProjectEpisode,
  ProjectRecord,
} from "@/components/dashboard/project-editor/dashboard-projects-editor-types";
import DashboardProjectsEditor from "@/pages/DashboardProjectsEditor";
import { dashboardEditorDialogWidthClassName } from "@/components/dashboard/dashboard-page-tokens";

const apiFetchMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/components/lexical/LexicalEditor", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const MockEditor = React.forwardRef(
    (_props: unknown, ref: React.ForwardedRef<{ blur: () => void; focus: () => void }>) => {
      React.useImperativeHandle(ref, () => ({ blur: () => undefined, focus: () => undefined }));
      return <div data-testid="lexical-editor" />;
    },
  );
  MockEditor.displayName = "MockLexicalEditor";
  return { default: MockEditor };
});

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

const createEditorEpisodeFixture = (
  overrides: Partial<EditorProjectEpisode> = {},
): EditorProjectEpisode => ({
  number: 1,
  volume: 1,
  title: "Capítulo 1",
  synopsis: "",
  releaseDate: "",
  duration: "",
  sourceType: "TV",
  sources: [],
  content: "",
  contentFormat: "lexical",
  publicationStatus: "published",
  ...overrides,
});

const projectFixture: ProjectRecord = {
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
  animationStudios: [],
  episodes: "2 episodios",
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
  episodeDownloads: [],
  views: 0,
  commentsCount: 0,
  order: 0,
};

const chapterProjectFixture: ProjectRecord = {
  ...projectFixture,
  id: "project-ln-1",
  title: "Projeto Light Novel",
  type: "Light Novel",
  episodes: "2 capítulos",
  episodeDownloads: [
    {
      number: 1,
      volume: 1,
      synopsis: "",
      title: "Capítulo 1 - Volume 1",
      releaseDate: "",
      duration: "",
      sourceType: "TV",
      sources: [],
      progressStage: "aguardando-raw",
      completedStages: [],
      content: "",
      contentFormat: "lexical",
      publicationStatus: "published",
    },
    {
      number: 1,
      volume: 2,
      synopsis: "",
      title: "Capítulo 1 - Volume 2",
      releaseDate: "",
      duration: "",
      sourceType: "TV",
      sources: [],
      progressStage: "aguardando-raw",
      completedStages: [],
      content: "",
      contentFormat: "lexical",
      publicationStatus: "published",
    },
  ],
};

const scrollIntoViewMock = vi.fn();
const setupApiMock = ({
  canManageProjects,
  projects,
  users = [],
  currentUserOverrides,
}: {
  canManageProjects: boolean;
  projects: ProjectRecord[];
  users?: Array<{ name?: string; status?: string }>;
  currentUserOverrides?: Record<string, unknown>;
}) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, {
        id: "1",
        name: "Admin",
        username: "admin",
        permissions: canManageProjects ? ["projetos"] : [],
        ...currentUserOverrides,
      });
    }
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, { projects });
    }
    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, { users });
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

const projectWithStaffFixture: ProjectRecord = {
  ...projectFixture,
  staff: [{ role: "Revisao", members: [] }],
  animeStaff: [{ role: "Director", members: [] }],
};
const projectWithInteractiveCardsFixture: ProjectRecord = {
  ...projectFixture,
  episodeDownloads: [createEditorEpisodeFixture()],
  relations: [
    { relation: "Prequela", title: "Projeto Anterior", format: "", status: "", image: "" },
    { relation: "Sequencia", title: "Projeto Seguinte", format: "", status: "", image: "" },
  ],
  staff: [
    { role: "Revisao", members: [] },
    { role: "Traducao", members: [] },
  ],
  animeStaff: [{ role: "Director", members: [] }],
};

const resizeObserverObserveMock = vi.fn();
const resizeObserverUnobserveMock = vi.fn();
const resizeObserverDisconnectMock = vi.fn();
const originalResizeObserver = globalThis.ResizeObserver;
class ResizeObserverMock {
  constructor(_callback: ResizeObserverCallback) {}

  observe = resizeObserverObserveMock;

  unobserve = resizeObserverUnobserveMock;

  disconnect = resizeObserverDisconnectMock;
}

const LocationProbe = () => {
  const location = useLocation();
  return (
    <>
      <div data-testid="location-pathname">{location.pathname}</div>
      <div data-testid="location-search">{location.search}</div>
    </>
  );
};
const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);
const expectDashboardActionButtonTokens = (element: HTMLElement, sizeToken: "h-9" | "h-10") => {
  const tokens = classTokens(element);

  expect(tokens).toEqual(
    expect.arrayContaining(["rounded-xl", "bg-background", "font-semibold", sizeToken]),
  );
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};

describe("DashboardProjectsEditor edit query", () => {
  beforeEach(() => {
    scrollIntoViewMock.mockReset();
    resizeObserverObserveMock.mockReset();
    resizeObserverUnobserveMock.mockReset();
    resizeObserverDisconnectMock.mockReset();
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: originalResizeObserver,
    });
  });

  it("usa dropdown pesquisavel para membros, aceita texto livre e aplica foco insetado no bloco local", async () => {
    setupApiMock({
      canManageProjects: true,
      projects: [projectWithStaffFixture],
      users: [
        { name: "Jose Gabriel", status: "active" },
        { name: "Pitas", status: "active" },
        { name: "Inativo", status: "inactive" },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-1"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Editar projeto");

    const editorDialog = await waitFor(() => {
      const node = document.querySelector(".project-editor-dialog");
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    expect(document.querySelector("datalist#staff-directory")).toBeNull();

    fireEvent.click(within(editorDialog).getByRole("button", { name: /Equipe da fansub/i }));
    expectDashboardActionButtonTokens(
      within(editorDialog).getByRole("button", { name: /Adicionar fun/i }),
      "h-9",
    );

    const fansubMemberInput = within(editorDialog).getByPlaceholderText(
      "Adicionar membro",
    ) as HTMLInputElement;
    fireEvent.focus(fansubMemberInput);

    expect(await screen.findByText("Jose Gabriel")).toBeInTheDocument();
    expect(screen.getByText("Pitas")).toBeInTheDocument();
    expect(screen.queryByText("Inativo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Jose Gabriel"));

    expect(fansubMemberInput.value).toBe("");
    expect(within(editorDialog).getByText("Jose Gabriel")).toBeInTheDocument();
    expectDashboardActionButtonTokens(
      within(editorDialog).getAllByRole("button", { name: /^Adicionar$/i })[0],
      "h-9",
    );

    fireEvent.click(within(editorDialog).getByRole("button", { name: /Staff do anime/i }));

    const animeMemberInput = within(editorDialog).getAllByPlaceholderText(
      "Adicionar membro",
    )[1] as HTMLInputElement;
    fireEvent.change(animeMemberInput, { target: { value: "Vulcao Custom" } });

    expect(await screen.findByText('Adicionar "Vulcao Custom"')).toBeInTheDocument();

    fireEvent.keyDown(animeMemberInput, { key: "Enter" });

    expect(animeMemberInput.value).toBe("");
    expect(within(editorDialog).getByText("Vulcao Custom")).toBeInTheDocument();

    const producerInput = within(editorDialog).getByPlaceholderText(
      "Adicionar produtora e pressionar Enter",
    ) as HTMLInputElement;
    const animationStudioInput = within(editorDialog).getByPlaceholderText(
      /Adicionar est.*dio de anima.*o e pressionar Enter/i,
    ) as HTMLInputElement;
    const studioProducerSection = producerInput.closest("section") as HTMLElement | null;

    expect(studioProducerSection).not.toBeNull();
    if (!studioProducerSection) {
      throw new Error("Bloco de estudios e produtoras nao encontrado");
    }

    const studioPrincipalInput = within(studioProducerSection).getByDisplayValue(
      "Studio Teste",
    ) as HTMLInputElement;
    expect(studioPrincipalInput.className).toContain("focus-visible:border-primary");
    expect(studioPrincipalInput.className).not.toContain("focus-visible:border-primary/60");
    expect(studioPrincipalInput.className).not.toContain("focus-visible:ring-primary/45");
    expect(studioPrincipalInput.className).not.toContain("focus-visible:ring-inset");
    expect(producerInput.className).toContain("focus-visible:border-primary");
    expect(producerInput.className).not.toContain("focus-visible:border-primary/60");
    expect(producerInput.className).not.toContain("focus-visible:ring-primary/45");
    expect(producerInput.className).not.toContain("focus-visible:ring-inset");
    expect(animationStudioInput.className).toContain("focus-visible:border-primary");
    expect(animationStudioInput.className).not.toContain("focus-visible:border-primary/60");
    expect(animationStudioInput.className).not.toContain("focus-visible:ring-primary/45");
    expect(animationStudioInput.className).not.toContain("focus-visible:ring-inset");
  });

  it("aplica hover accent suave e destaque de drag-over nos cards internos", async () => {
    setupApiMock({ canManageProjects: true, projects: [projectWithInteractiveCardsFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-1"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Editar projeto");

    const editorDialog = await waitFor(() => {
      const node = document.querySelector(".project-editor-dialog");
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    const editorProjectSummaryCard = within(editorDialog)
      .getByText(/^Projeto$/i)
      .closest("div.rounded-xl");
    expect(editorProjectSummaryCard).not.toBeNull();
    expect(classTokens(editorProjectSummaryCard as HTMLElement)).toContain(
      "hover:border-primary/40",
    );

    fireEvent.click(within(editorDialog).getByRole("button", { name: /M.dias/i }));
    const mediaCardLabel = within(editorDialog).getByText(/Imagem do carrossel/i);
    const mediaCard = mediaCardLabel.parentElement?.querySelector("div.rounded-2xl");
    expect(mediaCard).not.toBeNull();
    expect(classTokens(mediaCard as HTMLElement)).toContain("hover:border-primary/40");

    fireEvent.click(within(editorDialog).getByRole("button", { name: /Rela/i }));
    expectDashboardActionButtonTokens(
      within(editorDialog).getByRole("button", { name: /Adicionar rela/i }),
      "h-9",
    );
    const relationTargetCard = within(editorDialog)
      .getByRole("button", { name: /Mover rela.*1 para baixo/i })
      .closest('[draggable="true"]') as HTMLElement | null;
    const relationDraggedCard = within(editorDialog)
      .getByRole("button", { name: /Mover rela.*2 para cima/i })
      .closest('[draggable="true"]') as HTMLElement | null;
    expect(relationTargetCard).not.toBeNull();
    expect(relationDraggedCard).not.toBeNull();
    expect(classTokens(relationTargetCard as HTMLElement)).toContain("hover:border-primary/40");

    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: vi.fn(),
      getData: vi.fn(),
      clearData: vi.fn(),
    };

    fireEvent.dragStart(relationDraggedCard as HTMLElement, { dataTransfer });
    fireEvent.dragOver(relationTargetCard as HTMLElement, { dataTransfer });
    expect(classTokens(relationTargetCard as HTMLElement)).toContain("border-primary/40");
    expect(classTokens(relationTargetCard as HTMLElement)).toContain("bg-primary/5");
    fireEvent.drop(relationTargetCard as HTMLElement, { dataTransfer });
    fireEvent.dragEnd(relationDraggedCard as HTMLElement, { dataTransfer });

    fireEvent.click(within(editorDialog).getByRole("button", { name: /Equipe da fansub/i }));
    const staffTargetCard = within(editorDialog)
      .getByRole("button", { name: /Mover func.*fansub 1 para baixo/i })
      .closest('[draggable="true"]') as HTMLElement | null;
    const staffDraggedCard = within(editorDialog)
      .getByRole("button", { name: /Mover func.*fansub 2 para cima/i })
      .closest('[draggable="true"]') as HTMLElement | null;
    expect(staffTargetCard).not.toBeNull();
    expect(staffDraggedCard).not.toBeNull();
    expect(classTokens(staffTargetCard as HTMLElement)).toContain("hover:border-primary/40");

    fireEvent.dragStart(staffDraggedCard as HTMLElement, { dataTransfer });
    fireEvent.dragOver(staffTargetCard as HTMLElement, { dataTransfer });
    expect(classTokens(staffTargetCard as HTMLElement)).toContain("border-primary/40");
    expect(classTokens(staffTargetCard as HTMLElement)).toContain("bg-primary/5");
    fireEvent.drop(staffTargetCard as HTMLElement, { dataTransfer });
    fireEvent.dragEnd(staffDraggedCard as HTMLElement, { dataTransfer });
  });

  it("não renderiza os accordions internos de conteúdo no modal de light novel", async () => {
    setupApiMock({ canManageProjects: true, projects: [chapterProjectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-ln-1"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Editar projeto");

    const editorDialog = await waitFor(() => {
      const node = document.querySelector(".project-editor-dialog");
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    expect(
      within(editorDialog).queryByRole("button", { name: /Conte.do.*cap.tulos/i }),
    ).not.toBeInTheDocument();
    expect(editorDialog.querySelector(".project-editor-nested-section")).toBeNull();
  });

  it("abre criacao automaticamente com ?edit=new e limpa a query", async () => {
    setupApiMock({ canManageProjects: true, projects: [projectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=new"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByRole("heading", { name: "Novo projeto" });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });

  it("abre editor automaticamente com ?edit e limpa a query", async () => {
    setupApiMock({ canManageProjects: true, projects: [projectFixture] });

    const { unmount } = render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-1"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Editar projeto");
    expect(screen.getByText("Forçar no carrossel")).toBeInTheDocument();
    expect(
      screen.queryByText("Exibe no carrossel da home mesmo sem lançamento recente."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Forçar no carrossel" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(document.documentElement).toHaveClass("editor-scroll-locked");
    expect(document.body).toHaveClass("editor-scroll-locked");
    expect(document.body.getAttribute("data-editor-scroll-lock-count")).toBe("1");

    unmount();

    expect(document.documentElement).not.toHaveClass("editor-scroll-locked");
    expect(document.body).not.toHaveClass("editor-scroll-locked");
    expect(document.body.getAttribute("data-editor-scroll-lock-count")).toBeNull();
  });

  it("nao abre editor quando item nao existe e limpa a query", async () => {
    setupApiMock({ canManageProjects: true, projects: [projectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-inexistente"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(screen.queryByText("Editar projeto")).not.toBeInTheDocument();
  });

  it("expõe o CTA do editor dedicado para anime e mantém o clique do card abrindo o modal", async () => {
    setupApiMock({ canManageProjects: true, projects: [projectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });

    const dedicatedEditorLink = await screen.findByRole("link", {
      name: "Abrir editor dedicado de Projeto Teste",
    });
    expect(dedicatedEditorLink).toHaveAttribute("href", "/dashboard/projetos/project-1/episodios");

    fireEvent.click(await screen.findByRole("button", { name: "Abrir projeto Projeto Teste" }));

    await screen.findByText("Editar projeto");
    expect(screen.getByTestId("location-pathname").textContent).toBe("/dashboard/projetos");
  });

  it("expõe o CTA do editor dedicado para projetos baseados em capítulos", async () => {
    setupApiMock({ canManageProjects: true, projects: [chapterProjectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });

    const dedicatedEditorLink = await screen.findByRole("link", {
      name: "Abrir editor dedicado de Projeto Light Novel",
    });
    expect(dedicatedEditorLink).toHaveAttribute(
      "href",
      "/dashboard/projetos/project-ln-1/capitulos",
    );
  });

  it("expõe o CTA do editor dedicado para usuario com grant de projetos sem permissions legadas", async () => {
    setupApiMock({
      canManageProjects: false,
      projects: [projectFixture],
      currentUserOverrides: {
        permissions: [],
        grants: { projetos: true },
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });

    const dedicatedEditorLink = await screen.findByRole("link", {
      name: "Abrir editor dedicado de Projeto Teste",
    });
    expect(dedicatedEditorLink).toHaveAttribute("href", "/dashboard/projetos/project-1/episodios");
  });

  it("expõe o CTA do editor dedicado para owner secundario sem permissions legadas", async () => {
    setupApiMock({
      canManageProjects: false,
      projects: [chapterProjectFixture],
      currentUserOverrides: {
        id: "owner-2",
        permissions: [],
        accessRole: "owner_secondary",
        ownerIds: ["owner-1", "owner-2"],
        primaryOwnerId: "owner-1",
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });

    const dedicatedEditorLink = await screen.findByRole("link", {
      name: "Abrir editor dedicado de Projeto Light Novel",
    });
    expect(dedicatedEditorLink).toHaveAttribute(
      "href",
      "/dashboard/projetos/project-ln-1/capitulos",
    );
  });

  it("redireciona para o editor dedicado ao receber deep link unico com chapter e volume", async () => {
    setupApiMock({ canManageProjects: true, projects: [chapterProjectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-ln-1&chapter=1&volume=2"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await waitFor(() => {
      expect(screen.getByTestId("location-pathname").textContent).toBe(
        "/dashboard/projetos/project-ln-1/capitulos/1",
      );
    });
    expect(screen.getByTestId("location-search").textContent).toBe("?volume=2");
    expect(screen.queryByText("Editar projeto")).not.toBeInTheDocument();
    expect(document.querySelector(".project-editor-dialog")).toBeNull();
  });

  it("não foca capítulo quando a query vem ambígua sem volume", async () => {
    setupApiMock({ canManageProjects: true, projects: [chapterProjectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-ln-1&chapter=1"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Editar projeto");
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    expect(screen.getByTestId("location-pathname").textContent).toBe("/dashboard/projetos");
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it("remove a seção Conteúdo do modal de light novel já aberto", async () => {
    setupApiMock({ canManageProjects: true, projects: [chapterProjectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-ln-1"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Editar projeto");

    const editorDialog = await waitFor(() => {
      const node = document.querySelector(".project-editor-dialog");
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    expect(
      within(editorDialog).queryByRole("button", { name: /Conte.do.*cap.tulos/i }),
    ).not.toBeInTheDocument();
    expect(within(editorDialog).queryByText("Abrir editor dedicado")).not.toBeInTheDocument();
    expect(within(editorDialog).getByRole("link", { name: "Conteúdo" })).toHaveAttribute(
      "href",
      "/dashboard/projetos/project-ln-1/capitulos",
    );
    const sectionTriggers = Array.from(
      editorDialog.querySelectorAll(".project-editor-section-trigger"),
    ) as HTMLElement[];
    const sectionTitles = sectionTriggers.map((trigger) =>
      String(trigger.textContent || "")
        .replace(/\s+/g, " ")
        .trim(),
    );
    expect(sectionTitles).toHaveLength(6);
    expect(sectionTitles[0]).toContain("Importação");
    expect(sectionTitles[1]).toContain("Informações do projeto");
    expect(sectionTitles[2]).toContain("Mídias");
    expect(sectionTitles[3]).toContain("Relações");
    expect(sectionTitles).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Equipe da fansub"),
        expect.stringContaining("Staff do anime"),
      ]),
    );
    expect(sectionTitles).not.toEqual(
      expect.arrayContaining([expect.stringContaining("Conteúdo")]),
    );
    expect(sectionTriggers[1]).toHaveClass("hover:no-underline", "py-3.5", "md:py-4");
  });

  it("controla classe editor-modal-scrolled no dialog ao rolar e fechar", async () => {
    setupApiMock({ canManageProjects: true, projects: [projectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-1"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Editar projeto");
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    const editorDialog = document.querySelector(".project-editor-dialog") as HTMLElement | null;
    const editorFrame = document.querySelector(".project-editor-modal-frame") as HTMLElement | null;
    const editorScrollShell = document.querySelector(
      ".project-editor-scroll-shell",
    ) as HTMLElement | null;
    const editorTop = document.querySelector(".project-editor-top") as HTMLElement | null;
    const editorFooter = document.querySelector(".project-editor-footer") as HTMLElement | null;
    const editorHeader = editorTop?.firstElementChild as HTMLElement | null;
    const editorStatusBar = editorTop?.lastElementChild as HTMLElement | null;
    const editorLayout = document.querySelector(".project-editor-layout") as HTMLElement | null;
    const editorSectionContent = document.querySelector(
      ".project-editor-section-content",
    ) as HTMLElement | null;
    const editorAccordion = document.querySelector(
      ".project-editor-accordion",
    ) as HTMLElement | null;
    const editorBackdrop = screen.getByTestId("dashboard-editor-backdrop");
    const legacyBackdrop = Array.from(document.body.querySelectorAll("div")).find((node) => {
      const tokens = classTokens(node as HTMLElement);
      return (
        tokens.includes("pointer-events-auto") &&
        tokens.includes("fixed") &&
        tokens.includes("inset-0") &&
        tokens.includes("z-40") &&
        tokens.includes("bg-black/80") &&
        tokens.includes("backdrop-blur-xs")
      );
    });
    expect(editorDialog).not.toBeNull();
    expect(editorFrame).not.toBeNull();
    expect(editorScrollShell).not.toBeNull();
    expect(editorHeader).not.toBeNull();
    expect(editorStatusBar).not.toBeNull();
    expect(editorLayout).not.toBeNull();
    expect(editorSectionContent).not.toBeNull();
    expect(editorAccordion).not.toBeNull();
    expect(editorTop?.className).toContain("sticky");
    expect(editorFooter?.className).not.toContain("sticky");
    expect(document.querySelector(".project-editor-dialog-surface")).toBeNull();
    expect(classTokens(editorDialog as HTMLElement)).toContain(dashboardEditorDialogWidthClassName);
    expect(classTokens(editorDialog as HTMLElement)).not.toContain(
      "max-w-[min(1520px,calc(100vw-1rem))]",
    );
    expect(editorFrame?.className).toContain("flex");
    expect(editorFrame?.className).toContain("flex-col");
    expect(editorFrame?.className).toContain("min-h-0");
    expect(classTokens(editorBackdrop)).toEqual(
      expect.arrayContaining(["fixed", "inset-0", "z-[45]", "bg-black/80", "backdrop-blur-xs"]),
    );
    expect(editorBackdrop.parentElement).toBe(document.body);
    expect(legacyBackdrop).toBeUndefined();
    expect(editorScrollShell?.className).toContain("overflow-y-auto");
    expect(editorScrollShell?.className).toContain("flex-1");
    expect(editorScrollShell?.className).not.toContain("max-h-[94vh]");
    expect(editorHeader?.className).toContain("pt-3.5");
    expect(editorHeader?.className).toContain("pb-2.5");
    expect(editorStatusBar?.className).toContain("py-1.5");
    expect(editorLayout?.className).toContain("gap-3.5");
    expect(editorLayout?.className).toContain("pt-2.5");
    expect(editorLayout?.className).toContain("pb-3");
    expect(editorFooter?.className).toContain("py-1.5");
    expect(editorFooter?.className).toContain("md:py-2");
    expect(editorSectionContent?.className).toContain("pb-2.5");
    expect(editorAccordion?.className).toContain("space-y-2.5");
    expect(editorDialog).not.toHaveClass("editor-modal-scrolled");

    if (!editorDialog || !editorFrame || !editorScrollShell || !editorFooter) {
      throw new Error("Editor dialog not found");
    }

    expect(editorDialog.contains(editorFrame)).toBe(true);
    expect(editorFrame.contains(editorScrollShell)).toBe(true);
    expect(editorFrame.contains(editorFooter)).toBe(true);
    expect(editorScrollShell.contains(editorFooter)).toBe(false);

    editorScrollShell.scrollTop = 24;
    fireEvent.scroll(editorScrollShell);

    await waitFor(() => {
      expect(editorDialog).toHaveClass("editor-modal-scrolled");
    });

    fireEvent.click(within(editorDialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByText("Editar projeto")).not.toBeInTheDocument();
    });
    expect(document.querySelector(".project-editor-dialog.editor-modal-scrolled")).toBeNull();
  });

  it("posiciona o botão Conteúdo à esquerda do rodapé do editor de light novel", async () => {
    setupApiMock({ canManageProjects: true, projects: [chapterProjectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-ln-1"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Editar projeto");
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    const editorDialog = await waitFor(() => {
      const node = document.querySelector(".project-editor-dialog");
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    const footer = editorDialog.querySelector(".project-editor-footer") as HTMLElement | null;
    expect(footer).not.toBeNull();
    if (!footer) {
      throw new Error("Footer do editor não encontrado");
    }
    const footerColumns = Array.from(footer.children) as HTMLElement[];
    expect(footerColumns).toHaveLength(2);
    const footerLinks = within(footerColumns[0]).getAllByRole("link");
    expect(footerLinks.map((link) => link.textContent)).toEqual(["Conteúdo", "Visualizar página"]);
    expect(footerLinks[0]).toHaveAttribute("href", "/dashboard/projetos/project-ln-1/capitulos");
    expect(footerLinks[1]).toHaveAttribute("href", "/projeto/project-ln-1");
    expect(footerLinks[0].className).toContain("w-10");
    expect(footerLinks[0].className).toContain("md:w-auto");
    expect(footerLinks[1].className).toContain("w-10");
    expect(footerLinks[1].className).toContain("md:w-auto");
    expect(within(footerLinks[0]).getByText("Conteúdo").className).toContain("sr-only");
    expect(within(footerLinks[0]).getByText("Conteúdo").className).toContain("md:not-sr-only");
    expect(within(footerLinks[1]).getByText("Visualizar página").className).toContain("sr-only");
    expect(within(footerLinks[1]).getByText("Visualizar página").className).toContain(
      "md:not-sr-only",
    );
    expect(within(footerColumns[1]).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(
      within(footerColumns[1]).getByRole("button", { name: "Salvar projeto" }),
    ).toBeInTheDocument();
  });

  it("exibe o link da página pública em nova aba só para projeto salvo com os textos corrigidos no bloco novo", async () => {
    setupApiMock({ canManageProjects: true, projects: [projectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-1"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByText("Editar projeto");

    const editorDialog = await waitFor(() => {
      const node = document.querySelector(".project-editor-dialog");
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    const publicLink = within(editorDialog).getByRole("link", { name: "Visualizar página" });
    expect(publicLink).toHaveAttribute("href", "/projeto/project-1");
    expect(publicLink).toHaveAttribute("target", "_blank");
    expect(publicLink).toHaveAttribute("rel", "noreferrer");
    expect(within(editorDialog).getByText("Estúdios e produtoras")).toBeInTheDocument();
    expect(within(editorDialog).getByText("Estúdio principal")).toBeInTheDocument();
    expect(within(editorDialog).getByText("Estúdios de animação")).toBeInTheDocument();
    expect(
      within(editorDialog).getByPlaceholderText("Adicionar estúdio de animação e pressionar Enter"),
    ).toBeInTheDocument();
    expect(
      within(editorDialog).queryByText("Est\u00C3\u00BAdios e produtoras"),
    ).not.toBeInTheDocument();
  });

  it("oculta o link da página pública ao criar um projeto novo", async () => {
    setupApiMock({ canManageProjects: true, projects: [projectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=new"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar projetos" });
    await screen.findByRole("heading", { name: "Novo projeto" });

    expect(screen.queryByRole("link", { name: "Visualizar página" })).not.toBeInTheDocument();
  });

  it("exibe um CTA de rodapé para abrir o editor dedicado no estado neutro", async () => {
    setupApiMock({ canManageProjects: true, projects: [chapterProjectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-ln-1"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByText("Editar projeto");
    expect(screen.queryByRole("link", { name: "Abrir editor dedicado" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Conteúdo" })).toHaveAttribute(
      "href",
      "/dashboard/projetos/project-ln-1/capitulos",
    );
  });
});
