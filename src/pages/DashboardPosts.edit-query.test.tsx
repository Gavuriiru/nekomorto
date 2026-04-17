import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { dashboardEditorDialogWidthClassName } from "@/components/dashboard/dashboard-page-tokens";
import DashboardPosts from "@/pages/DashboardPosts";

const { apiFetchMock, resizeObserverInstances, lexicalEditorPropsSpy } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  resizeObserverInstances: [] as Array<{
    callback: ResizeObserverCallback;
    disconnect: ReturnType<typeof vi.fn>;
    observe: ReturnType<typeof vi.fn>;
  }>,
  lexicalEditorPropsSpy: vi.fn(),
}));

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    resizeObserverInstances.push({
      callback,
      disconnect: this.disconnect,
      observe: this.observe,
    });
  }
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/ProjectEmbedCard", () => ({
  default: () => null,
}));

vi.mock("@/components/lexical/LexicalEditor", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const MockEditor = React.forwardRef(
    (
      props: {
        followCaretScroll?: boolean;
        autoFocus?: boolean;
      },
      ref: React.ForwardedRef<{ blur: () => void }>,
    ) => {
      lexicalEditorPropsSpy(props);
      React.useImperativeHandle(ref, () => ({ blur: () => undefined }));
      return <div data-testid="lexical-editor" />;
    },
  );
  MockEditor.displayName = "MockLexicalEditor";
  return { default: MockEditor };
});

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
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

const postFixture = {
  id: "post-1",
  title: "Post de teste",
  slug: "post-1",
  excerpt: "Resumo",
  content: "",
  contentFormat: "lexical" as const,
  author: "Admin",
  publishedAt: "2026-02-10T12:00:00.000Z",
  status: "draft" as const,
  projectId: "",
  tags: [],
  views: 10,
  commentsCount: 2,
};

const buildVersionSnapshot = (overrides: Record<string, unknown> = {}) => ({
  id: postFixture.id,
  slug: postFixture.slug,
  title: postFixture.title,
  status: postFixture.status,
  publishedAt: postFixture.publishedAt,
  scheduledAt: null,
  projectId: postFixture.projectId,
  excerpt: postFixture.excerpt,
  content: postFixture.content,
  contentFormat: postFixture.contentFormat,
  author: postFixture.author,
  coverImageUrl: null,
  coverAlt: "",
  seoTitle: "",
  seoDescription: "",
  tags: [],
  updatedAt: postFixture.publishedAt,
  ...overrides,
});

const buildVersion = (id: string, snapshotOverrides: Record<string, unknown> = {}) => ({
  id,
  postId: postFixture.id,
  versionNumber: Number(id.replace(/\D/g, "")) || 1,
  reason: "update",
  reasonLabel: "Atualizacao",
  slug: String(snapshotOverrides.slug || postFixture.slug),
  createdAt: "2026-02-10T12:00:00.000Z",
  snapshot: buildVersionSnapshot(snapshotOverrides),
});

const setupApiMock = ({
  canManagePosts,
  currentUserOverrides,
  ownerIds = [],
  users,
  versionsResponse,
}: {
  canManagePosts: boolean;
  currentUserOverrides?: Record<string, unknown>;
  ownerIds?: string[];
  users?: Array<Record<string, unknown>>;
  versionsResponse?: { versions?: unknown[]; nextCursor?: string | null } | "error";
}) => {
  apiFetchMock.mockReset();
  resizeObserverInstances.length = 0;
  lexicalEditorPropsSpy.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (path === "/api/posts" && method === "GET") {
      return mockJsonResponse(true, { posts: [postFixture] });
    }
    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, {
        users: users ?? [{ id: "user-1", permissions: canManagePosts ? ["posts"] : [] }],
        ownerIds,
      });
    }
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, {
        id: "user-1",
        name: "Admin",
        username: "admin",
        permissions: canManagePosts ? ["posts"] : [],
        ...currentUserOverrides,
      });
    }
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, { projects: [] });
    }
    if (path === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
    }
    if (
      path.startsWith("/api/admin/content/post/") &&
      path.includes("/versions") &&
      method === "GET"
    ) {
      if (versionsResponse === "error") {
        return mockJsonResponse(false, { error: "versions_failed" }, 500);
      }
      return mockJsonResponse(true, {
        postId: "post-1",
        versions: versionsResponse?.versions || [],
        nextCursor: versionsResponse?.nextCursor || null,
      });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

const expectStableDashboardActionButton = (element: HTMLElement, sizeToken: "h-9" | "h-10") => {
  const tokens = classTokens(element);

  expect(tokens).toEqual(
    expect.arrayContaining([
      "rounded-xl",
      "bg-background",
      "font-semibold",
      "hover:bg-primary/5",
      "hover:text-foreground",
      sizeToken,
    ]),
  );
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};

const expectPrimaryDashboardActionButton = (element: HTMLElement, sizeToken: "h-9" | "h-10") => {
  const tokens = classTokens(element);

  expect(tokens).toEqual(
    expect.arrayContaining([
      "rounded-xl",
      "border-primary/70",
      "bg-primary/10",
      "hover:border-primary",
      "hover:bg-primary",
      "hover:text-primary-foreground",
      "focus-visible:text-primary-foreground",
      "text-foreground",
      "font-semibold",
      sizeToken,
    ]),
  );
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};

const expectDestructiveDashboardActionButton = (
  element: HTMLElement,
  sizeToken: "h-9" | "h-10",
) => {
  const tokens = classTokens(element);

  expect(tokens).toEqual(
    expect.arrayContaining([
      "rounded-xl",
      "bg-destructive/10",
      "text-destructive",
      "font-semibold",
      sizeToken,
    ]),
  );
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};

const createDomRect = (height: number): DOMRect =>
  ({
    bottom: height,
    height,
    left: 0,
    right: 0,
    toJSON: () => ({}),
    top: 0,
    width: 0,
    x: 0,
    y: 0,
  }) as DOMRect;

const getEditorSectionByTitle = (dialog: HTMLElement, title: string) => {
  const sections = Array.from(
    dialog.querySelectorAll<HTMLElement>("section.project-editor-section"),
  );
  const section = sections.find((candidate) =>
    Array.from(candidate.querySelectorAll<HTMLElement>("span")).some(
      (element) =>
        element.textContent?.trim() === title && classTokens(element).includes("text-[15px]"),
    ),
  );
  if (!section) {
    throw new Error(`Editor section "${title}" not found`);
  }
  return section;
};

const expectEditorSectionHeader = (dialog: HTMLElement, title: string, subtitle: string) => {
  const section = getEditorSectionByTitle(dialog, title);
  const titleElement = Array.from(section.querySelectorAll<HTMLElement>("span")).find(
    (element) =>
      element.textContent?.trim() === title && classTokens(element).includes("text-[15px]"),
  );
  const subtitleElement = Array.from(section.querySelectorAll<HTMLElement>("span")).find(
    (element) =>
      element.textContent?.trim() === subtitle && classTokens(element).includes("text-xs"),
  );
  const header = section.querySelector<HTMLElement>(".project-editor-section-trigger");

  expect(header).not.toBeNull();
  expect(titleElement).toBeDefined();
  expect(subtitleElement).toBeDefined();
  expect(classTokens(header as HTMLElement)).toContain("items-start");
  expect(classTokens(header as HTMLElement)).toContain("pt-3");
  expect(classTokens(header as HTMLElement)).toContain("md:pt-3");
  expect(classTokens(header as HTMLElement)).toContain("pb-1");
  expect(classTokens(header as HTMLElement)).toContain("md:pb-1.5");
  expect(classTokens(header as HTMLElement)).not.toContain("items-center");
  expect(classTokens(header as HTMLElement)).not.toContain("justify-between");
  expect(classTokens(titleElement as HTMLElement)).toContain("text-[15px]");
  expect(classTokens(titleElement as HTMLElement)).toContain("font-semibold");
  expect(classTokens(titleElement as HTMLElement)).toContain("leading-tight");
  expect(classTokens(subtitleElement as HTMLElement)).toContain("text-xs");
  expect(classTokens(subtitleElement as HTMLElement)).toContain("leading-5");
};

describe("DashboardPosts edit query", () => {
  it("usa o dashboard action button estavel para nova postagem", async () => {
    setupApiMock({ canManagePosts: true });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardPosts />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    expectStableDashboardActionButton(
      screen.getByRole("button", { name: /Nova postagem/i }),
      "h-10",
    );
  });

  it("abre criacao automaticamente com ?edit=new e limpa a query", async () => {
    setupApiMock({ canManagePosts: true });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=new"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByRole("heading", { name: "Nova postagem" });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });

  it("abre editor automaticamente com ?edit e limpa a query", async () => {
    setupApiMock({ canManagePosts: true });

    const { unmount } = render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByRole("heading", { name: "Editar postagem" });
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

  it("abre editor com grant de posts sem permissions legadas", async () => {
    setupApiMock({
      canManagePosts: false,
      currentUserOverrides: {
        permissions: [],
        grants: { posts: true },
      },
      users: [{ id: "user-1", permissions: [] }],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByRole("heading", { name: "Editar postagem" });
    expect(screen.getByRole("button", { name: /Nova postagem/i })).toBeInTheDocument();
  });

  it("abre editor para owner sem permissions legadas", async () => {
    setupApiMock({
      canManagePosts: false,
      currentUserOverrides: {
        id: "owner-2",
        permissions: [],
        accessRole: "owner_secondary",
        ownerIds: ["owner-1", "owner-2"],
        primaryOwnerId: "owner-1",
      },
      ownerIds: ["owner-1", "owner-2"],
      users: [{ id: "owner-2", permissions: [] }],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByRole("heading", { name: "Editar postagem" });
    expect(screen.getByRole("button", { name: /Nova postagem/i })).toBeInTheDocument();
  });

  it("nao abre editor sem permissao e limpa a query", async () => {
    setupApiMock({ canManagePosts: false });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(screen.queryByRole("heading", { name: "Editar postagem" })).not.toBeInTheDocument();
  });

  it("oculta botao de historico quando a unica versao equivale ao estado atual", async () => {
    setupApiMock({
      canManagePosts: true,
      versionsResponse: {
        versions: [buildVersion("v1")],
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByRole("heading", { name: "Editar postagem" });

    await waitFor(() => {
      expect(
        apiFetchMock.mock.calls.some((call) =>
          String(call[1] || "").includes("/api/admin/content/post/post-1/versions"),
        ),
      ).toBe(true);
    });

    expect(screen.queryByRole("button", { name: /Hist/i })).not.toBeInTheDocument();
  });

  it("mostra botao de historico quando existe uma versao restauravel mesmo sendo unica", async () => {
    setupApiMock({
      canManagePosts: true,
      versionsResponse: {
        versions: [buildVersion("v2", { title: "Titulo antigo" })],
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByRole("heading", { name: "Editar postagem" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Hist/i })).toBeInTheDocument();
    });
  });

  it("mostra botao de historico quando ha nextCursor mesmo sem diferenca nas primeiras versoes", async () => {
    setupApiMock({
      canManagePosts: true,
      versionsResponse: {
        versions: [buildVersion("v1"), buildVersion("v2")],
        nextCursor: "cursor-1",
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByRole("heading", { name: "Editar postagem" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Hist/i })).toBeInTheDocument();
    });
  });

  it("aplica borda accent suave nos cards de historico e rollback", async () => {
    setupApiMock({
      canManagePosts: true,
      versionsResponse: {
        versions: [buildVersion("v2", { title: "Titulo antigo" })],
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByRole("heading", { name: "Editar postagem" });

    const historyButton = await screen.findByRole("button", { name: /Hist/i });
    fireEvent.click(historyButton);

    const historyDialog = (await screen.findAllByRole("dialog")).at(-1) as HTMLElement;
    const historyCard = Array.from(historyDialog.querySelectorAll<HTMLElement>("div")).find(
      (node) =>
        classTokens(node).includes("rounded-lg") &&
        classTokens(node).includes("hover:border-primary/40"),
    );
    expect(historyCard).toBeDefined();
    expect(classTokens(historyCard as HTMLElement)).toContain("border-border/60");
    expect(classTokens(historyCard as HTMLElement)).toContain("bg-card/60");

    fireEvent.click(within(historyDialog).getByRole("button", { name: /Restaurar esta vers/i }));

    const rollbackDialog = (await screen.findAllByRole("dialog")).at(-1) as HTMLElement;
    const rollbackCard = Array.from(rollbackDialog.querySelectorAll<HTMLElement>("div")).find(
      (node) =>
        classTokens(node).includes("bg-card/60") &&
        classTokens(node).includes("hover:border-primary/40"),
    );
    expect(rollbackCard).toBeDefined();
    expect(classTokens(rollbackCard as HTMLElement)).toContain("border-border/60");
  });

  it("usa shell no padrao do editor de projetos e controla classe editor-modal-scrolled", async () => {
    setupApiMock({ canManagePosts: true });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByRole("heading", { name: "Editar postagem" });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    const editorDialog = document.querySelector(".project-editor-dialog") as HTMLElement | null;
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
    expect(editorScrollShell).not.toBeNull();
    expect(editorTop).not.toBeNull();
    expect(editorFooter).not.toBeNull();
    expect(editorHeader).not.toBeNull();
    expect(editorStatusBar).not.toBeNull();
    expect(editorLayout).not.toBeNull();
    expect(editorSectionContent).not.toBeNull();
    expect(document.querySelector(".project-editor-dialog-surface")).toBeNull();
    expect(classTokens(editorScrollShell as HTMLElement)).toContain("overflow-y-auto");
    expect(classTokens(editorScrollShell as HTMLElement)).not.toContain("max-h-[94vh]");
    expect(classTokens(editorTop as HTMLElement)).toContain("sticky");
    expect(classTokens(editorFooter as HTMLElement)).toContain("sticky");
    expect(classTokens(editorDialog as HTMLElement)).toContain(dashboardEditorDialogWidthClassName);
    expect(classTokens(editorDialog as HTMLElement)).not.toContain(
      "max-w-[min(1520px,calc(100vw-1rem))]",
    );
    expect(classTokens(editorHeader as HTMLElement)).toContain("pt-3.5");
    expect(classTokens(editorHeader as HTMLElement)).toContain("pb-2.5");
    expect(classTokens(editorStatusBar as HTMLElement)).toContain("py-1.5");
    expect(classTokens(editorBackdrop)).toEqual(
      expect.arrayContaining(["fixed", "inset-0", "z-[45]", "bg-black/80", "backdrop-blur-xs"]),
    );
    expect(editorBackdrop.parentElement).toBe(document.body);
    expect(legacyBackdrop).toBeUndefined();
    expect(classTokens(editorLayout as HTMLElement)).toContain("space-y-4");
    expect(classTokens(editorLayout as HTMLElement)).toContain("pt-2.5");
    expect(classTokens(editorLayout as HTMLElement)).toContain("pb-4");
    expect(classTokens(editorFooter as HTMLElement)).toContain("py-2");
    expect(classTokens(editorFooter as HTMLElement)).toContain("md:py-2.5");
    expect(classTokens(editorSectionContent as HTMLElement)).toContain("pb-3.5");
    expect(
      lexicalEditorPropsSpy.mock.calls.some(([props]) =>
        Boolean(
          (props as { followCaretScroll?: boolean; autoFocus?: boolean }).followCaretScroll &&
            (props as { followCaretScroll?: boolean; autoFocus?: boolean }).autoFocus === false,
        ),
      ),
    ).toBe(true);
    expect(screen.getByText("Postagem em edição")).toBeInTheDocument();
    if (!editorDialog || !editorScrollShell) {
      throw new Error("Editor dialog not found");
    }
    const editorPostSummaryCard = within(editorDialog)
      .getByText(/^Postagem$/i)
      .closest("div.rounded-xl");
    expect(editorPostSummaryCard).not.toBeNull();
    expect(classTokens(editorPostSummaryCard as HTMLElement)).toContain("hover:border-primary/40");
    expect(editorDialog.contains(editorScrollShell)).toBe(true);
    const cancelButton = within(editorDialog).getByRole("button", { name: "Cancelar" });
    const deleteButton = within(editorDialog).getByRole("button", { name: "Excluir" });
    const saveButton = within(editorDialog).getByRole("button", { name: "Salvar" });
    const publishButton = within(editorDialog).getByRole("button", { name: "Publicar agora" });
    expectStableDashboardActionButton(cancelButton, "h-9");
    expectDestructiveDashboardActionButton(deleteButton, "h-9");
    expectPrimaryDashboardActionButton(saveButton, "h-9");
    expectPrimaryDashboardActionButton(publishButton, "h-9");
    expectEditorSectionHeader(editorDialog, "Conteúdo", "Texto principal do post");
    expectEditorSectionHeader(editorDialog, "Publicação", "Rascunho");
    expectEditorSectionHeader(editorDialog, "Mídia", "Sem capa");
    expectEditorSectionHeader(editorDialog, "Relacionamento", "Sem projeto");
    expectEditorSectionHeader(editorDialog, "Tags", "0 tags");
    expect(editorDialog).not.toHaveClass("editor-modal-scrolled");

    editorScrollShell.scrollTop = 24;
    fireEvent.scroll(editorScrollShell);

    await waitFor(() => {
      expect(editorDialog).toHaveClass("editor-modal-scrolled");
    });

    fireEvent.click(within(editorDialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Editar postagem" })).not.toBeInTheDocument();
    });
    expect(document.querySelector(".project-editor-dialog.editor-modal-scrolled")).toBeNull();
  });

  it("sincroniza o offset sticky do lexical com a altura da barra superior do modal", async () => {
    setupApiMock({ canManagePosts: true });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Gerenciar posts" });
    await screen.findByRole("heading", { name: "Editar postagem" });

    const editorTop = document.querySelector(".project-editor-top") as HTMLElement | null;
    const lexicalWrapper = document.querySelector(
      ".post-editor-lexical-wrapper",
    ) as HTMLElement | null;

    expect(editorTop).not.toBeNull();
    expect(lexicalWrapper).not.toBeNull();
    if (!editorTop || !lexicalWrapper) {
      throw new Error("Required post editor elements not found");
    }

    const resizeObserverInstance = resizeObserverInstances.at(-1);
    expect(resizeObserverInstance).toBeDefined();

    const getBoundingClientRectSpy = vi.spyOn(editorTop, "getBoundingClientRect");
    getBoundingClientRectSpy.mockReturnValue(createDomRect(96));

    await act(async () => {
      resizeObserverInstance?.callback(
        [{ target: editorTop }] as unknown as ResizeObserverEntry[],
        {} as ResizeObserver,
      );
    });

    await waitFor(() => {
      expect(lexicalWrapper.style.getPropertyValue("--post-editor-toolbar-sticky-top")).toBe(
        "101px",
      );
    });

    getBoundingClientRectSpy.mockReturnValue(createDomRect(132));

    await act(async () => {
      resizeObserverInstance?.callback(
        [{ target: editorTop }] as unknown as ResizeObserverEntry[],
        {} as ResizeObserver,
      );
    });

    await waitFor(() => {
      expect(lexicalWrapper.style.getPropertyValue("--post-editor-toolbar-sticky-top")).toBe(
        "137px",
      );
    });
  });
});
