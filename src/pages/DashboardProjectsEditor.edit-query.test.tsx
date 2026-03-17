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

  it("não renderiza a seção Conteúdo no modal de light novel já aberto", async () => {
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
    expect(sectionTitles[4]).toContain("Equipe da fansub");
    expect(sectionTitles[5]).toContain("Staff do anime");
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

  it("exibe o link da página pública em nova aba só para projeto salvo e sem mojibake no bloco novo", async () => {
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
    expect(within(editorDialog).queryByText("EstÃºdios e produtoras")).not.toBeInTheDocument();
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
