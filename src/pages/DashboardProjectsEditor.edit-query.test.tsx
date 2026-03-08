import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DashboardProjectsEditor from "@/pages/DashboardProjectsEditor";

const apiFetchMock = vi.hoisted(() => vi.fn());

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
  heroImageAlt: "",
  volumeEntries: [],
  volumeCovers: [],
  episodeDownloads: [],
  views: 0,
  commentsCount: 0,
  order: 0,
};

const chapterProjectFixture = {
  ...projectFixture,
  id: "project-ln-1",
  title: "Projeto Light Novel",
  type: "Light Novel",
  episodes: "2 capítulos",
  episodeDownloads: [
    {
      number: 1,
      volume: 1,
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
const getEpisodeTrigger = (card: HTMLElement) => {
  const trigger = within(card)
    .getAllByRole("button")
    .find((element) => element.hasAttribute("data-episode-accordion-trigger"));
  if (!trigger) {
    throw new Error("Episode trigger not found");
  }
  return trigger;
};

const setupApiMock = ({
  canManageProjects,
  projects,
}: {
  canManageProjects: boolean;
  projects: (typeof projectFixture)[];
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
      });
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

const LocationProbe = () => {
  const location = useLocation();
  return (
    <>
      <div data-testid="location-pathname">{location.pathname}</div>
      <div data-testid="location-search">{location.search}</div>
    </>
  );
};

describe("DashboardProjectsEditor edit query", () => {
  beforeEach(() => {
    scrollIntoViewMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });
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
    await screen.findByText("Novo projeto");
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
    expect(document.documentElement).toHaveClass("editor-scroll-stable");
    expect(document.body).toHaveClass("editor-scroll-stable");
    expect(document.body.getAttribute("data-editor-scroll-stable-count")).toBe("1");
    expect(document.documentElement).toHaveClass("editor-scroll-locked");
    expect(document.body).toHaveClass("editor-scroll-locked");
    expect(document.body.getAttribute("data-editor-scroll-lock-count")).toBe("1");

    unmount();

    expect(document.documentElement).not.toHaveClass("editor-scroll-stable");
    expect(document.body).not.toHaveClass("editor-scroll-stable");
    expect(document.body.getAttribute("data-editor-scroll-stable-count")).toBeNull();
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

  it("abre o card do capítulo correto quando o modal já está aberto", async () => {
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
    const chaptersTrigger = within(editorDialog).getByRole("button", {
      name: /Conte.do.*cap.tulos/i,
    });
    fireEvent.click(chaptersTrigger);

    const volumeOneGroup = within(editorDialog).getByTestId("volume-group-1");
    const volumeTwoGroup = within(editorDialog).getByTestId("volume-group-2");
    const [volumeOneTrigger] = within(volumeOneGroup).getAllByRole("button");
    const [volumeTwoTrigger] = within(volumeTwoGroup).getAllByRole("button");
    fireEvent.click(volumeTwoTrigger);
    expect(volumeOneTrigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => {
      expect(volumeTwoTrigger).toHaveAttribute("aria-expanded", "true");
    });

    const targetCard = await within(editorDialog).findByTestId(
      "episode-card-1",
      {},
      { timeout: 3000 },
    );
    fireEvent.click(getEpisodeTrigger(targetCard));
    await waitFor(() => {
      expect(getEpisodeTrigger(targetCard)).toHaveAttribute("aria-expanded", "true");
    });
    expect(within(volumeOneGroup).queryByTestId("episode-card-0")).not.toBeInTheDocument();
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
    expect(editorFrame?.className).toContain("flex");
    expect(editorFrame?.className).toContain("flex-col");
    expect(editorFrame?.className).toContain("min-h-0");
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

  it("compacta o trecho inferior do modal de projetos nas areas de volume e episodio", async () => {
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
    const chaptersTrigger = within(editorDialog).getByRole("button", {
      name: /Conte.do.*cap.tulos/i,
    });
    fireEvent.click(chaptersTrigger);

    const volumeTwoGroup = within(editorDialog).getByTestId("volume-group-2");
    const [volumeTwoTrigger] = within(volumeTwoGroup).getAllByRole("button");
    fireEvent.click(volumeTwoTrigger);
    const volumeAccordionContent = volumeTwoGroup.querySelector(
      ".space-y-3.px-4",
    ) as HTMLElement | null;
    expect(volumeAccordionContent).not.toBeNull();
    expect(volumeAccordionContent?.className).toContain("pb-3");

    const episodeAccordion = volumeAccordionContent?.querySelector(
      '[data-orientation="vertical"]',
    ) as HTMLElement | null;
    expect(episodeAccordion).not.toBeNull();
    expect(episodeAccordion?.className).toContain("space-y-3");

    const episodeCard = await within(editorDialog).findByTestId("episode-card-1");
    fireEvent.click(getEpisodeTrigger(episodeCard));
    const episodeContent = episodeCard.querySelector(
      ".project-editor-episode-content",
    ) as HTMLElement | null;
    expect(episodeContent).not.toBeNull();
    expect(episodeContent?.className).toContain("p-4");
    expect(episodeContent?.className).not.toContain("p-5");

    const episodeGroups = Array.from(
      episodeCard.querySelectorAll(".project-editor-episode-group"),
    ) as HTMLElement[];
    expect(episodeGroups.some((group) => group.className.includes("mt-3"))).toBe(true);

    const episodeTrigger = getEpisodeTrigger(episodeCard);
    fireEvent.click(episodeTrigger);

    await waitFor(() => {
      expect(episodeTrigger).toHaveAttribute("aria-expanded", "false");
    });
    expect(episodeContent?.className).toContain("p-3");
    expect(episodeContent?.className).not.toContain("p-4");
  });

  it("exibe um CTA de projeto para abrir o editor dedicado no estado neutro", async () => {
    setupApiMock({ canManageProjects: true, projects: [chapterProjectFixture] });

    render(
      <MemoryRouter initialEntries={["/dashboard/projetos?edit=project-ln-1"]}>
        <DashboardProjectsEditor />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByText("Editar projeto");
    expect(screen.getByRole("link", { name: "Abrir editor dedicado" })).toHaveAttribute(
      "href",
      "/dashboard/projetos/project-ln-1/capitulos",
    );
  });
});
