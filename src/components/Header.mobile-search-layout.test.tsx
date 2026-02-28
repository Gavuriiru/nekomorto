import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Header from "@/components/Header";
import { GlobalShortcutsProvider } from "@/hooks/global-shortcuts-provider";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";

const apiFetchMock = vi.hoisted(() => vi.fn());
const useSiteSettingsMock = vi.hoisted(() => vi.fn());
const usePublicBootstrapMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const setThemePreferenceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => useSiteSettingsMock(),
}));

vi.mock("@/hooks/use-public-bootstrap", () => ({
  usePublicBootstrap: () => usePublicBootstrapMock(),
}));

vi.mock("@/hooks/use-theme-mode", () => ({
  useThemeMode: () => ({
    globalMode: "dark",
    effectiveMode: "dark",
    preference: "global",
    isOverridden: false,
    setPreference: setThemePreferenceMock,
  }),
}));

vi.mock("@/hooks/use-dynamic-synopsis-clamp", () => ({
  useDynamicSynopsisClamp: () => ({
    rootRef: { current: null },
    lineByKey: {},
  }),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const createSettings = (override: Partial<SiteSettings> = {}) =>
  mergeSettings(defaultSettings, override);

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);
const setWindowScrollY = (value: number) => {
  Object.defineProperty(window, "scrollY", {
    value,
    configurable: true,
    writable: true,
  });
};

const setupApiMock = (options?: {
  logoutOk?: boolean;
  searchSuggestOk?: boolean;
  searchSuggestions?: unknown[];
}) => {
  const { logoutOk = true, searchSuggestOk = false, searchSuggestions = [] } = options || {};
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(
    async (_apiBase: string, endpoint: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (endpoint === "/api/public/me" && method === "GET") {
        return mockJsonResponse(true, {
          user: {
            id: "user-1",
            name: "Admin",
            username: "admin",
            avatarUrl: null,
          },
        });
      }
      if (endpoint === "/api/logout" && method === "POST") {
        return mockJsonResponse(
          logoutOk,
          logoutOk ? { ok: true } : { error: "logout_failed" },
          logoutOk ? 200 : 500,
        );
      }
      if (endpoint.startsWith("/api/public/search/suggest?") && method === "GET") {
        if (searchSuggestOk) {
          return mockJsonResponse(true, {
            suggestions: searchSuggestions,
          });
        }
        return mockJsonResponse(false, { error: "search_suggest_failed" }, 500);
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    },
  );
};

const getSearchSuggestCalls = () =>
  apiFetchMock.mock.calls.filter((call) =>
    String(call[1] || "").startsWith("/api/public/search/suggest?"),
  );

describe("Header mobile search layout", () => {
  beforeEach(() => {
    setWindowScrollY(0);
    setupApiMock();
    toastMock.mockReset();
    setThemePreferenceMock.mockReset();
    useSiteSettingsMock.mockReset();
    usePublicBootstrapMock.mockReset();
    useSiteSettingsMock.mockReturnValue({
      settings: createSettings(),
      isLoading: false,
      refresh: vi.fn(async () => undefined),
    });
    usePublicBootstrapMock.mockReturnValue({
      data: {
        projects: [
          {
            id: "project-1",
            title: "Projeto Teste",
            synopsis: "Sinopse do projeto",
            tags: ["acao"],
            cover: "/placeholder.svg",
          },
        ],
        posts: [
          {
            title: "Post Teste",
            slug: "post-teste",
            excerpt: "Resumo do post",
          },
        ],
        tagTranslations: {
          tags: { acao: "Acao" },
        },
      },
    });
  });

  it("aplica gradiente abaixo do header fixo apenas apos scroll", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    const banner = screen.getByRole("banner");
    expect(classTokens(banner)).toContain("after:top-full");
    expect(classTokens(banner)).toContain("after:inset-x-0");
    expect(classTokens(banner)).toContain("after:h-8");
    expect(classTokens(banner)).toContain("after:opacity-0");
    expect(classTokens(banner)).not.toContain("after:inset-0");
    expect(classTokens(banner)).toContain("backdrop-blur-none");
    expect(classTokens(banner)).not.toContain("backdrop-blur-xl");

    const nav = within(banner).getByRole("navigation");
    expect(classTokens(nav)).toContain("z-10");

    act(() => {
      setWindowScrollY(20);
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(classTokens(banner)).toContain("after:opacity-100");
      expect(classTokens(banner)).toContain("backdrop-blur-xl");
      expect(classTokens(banner)).not.toContain("backdrop-blur-none");
    });

    act(() => {
      setWindowScrollY(0);
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(classTokens(banner)).toContain("after:opacity-0");
      expect(classTokens(banner)).toContain("backdrop-blur-none");
      expect(classTokens(banner)).not.toContain("backdrop-blur-xl");
    });
  });

  it("nao aplica gradiente no variant static, mesmo com scroll", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header variant="static" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    const banner = screen.getByRole("banner");
    expect(classTokens(banner)).not.toContain("after:top-full");
    expect(classTokens(banner)).not.toContain("after:inset-x-0");
    expect(classTokens(banner)).not.toContain("after:h-8");
    expect(classTokens(banner)).toContain("backdrop-blur-none");

    act(() => {
      setWindowScrollY(40);
      window.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(classTokens(banner)).not.toContain("after:top-full");
      expect(classTokens(banner)).not.toContain("after:inset-x-0");
      expect(classTokens(banner)).not.toContain("after:h-8");
      expect(classTokens(banner)).toContain("backdrop-blur-none");
      expect(classTokens(banner)).not.toContain("backdrop-blur-xl");
    });
  });

  it("oculta clusters, centraliza busca e restaura estado ao fechar no mobile", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    const leftCluster = screen.getByTestId("public-header-left-cluster");
    const searchCluster = screen.getByTestId("public-header-search-cluster");
    const actionsCluster = screen.getByTestId("public-header-actions-cluster");

    await user.click(screen.getByRole("button", { name: "Abrir busca" }));

    const searchInput = await screen.findByPlaceholderText("Buscar projetos e posts");
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveFocus();
    expect(classTokens(leftCluster)).toContain("opacity-0");
    expect(classTokens(leftCluster)).toContain("invisible");
    expect(classTokens(leftCluster)).toContain("pointer-events-none");
    expect(classTokens(actionsCluster)).toContain("opacity-0");
    expect(classTokens(actionsCluster)).toContain("invisible");
    expect(classTokens(actionsCluster)).toContain("pointer-events-none");
    expect(classTokens(searchCluster)).toContain("absolute");
    expect(classTokens(searchCluster)).toContain("inset-x-0");
    expect(classTokens(searchCluster)).toContain("w-[min(22rem,calc(100vw-1rem))]");

    await user.type(searchInput, "teste");

    expect(await screen.findByText("Projeto Teste")).toBeInTheDocument();
    expect(await screen.findByText("Post Teste")).toBeInTheDocument();

    const results = screen.getByTestId("public-header-results");
    expect(classTokens(results)).toContain("w-[min(24rem,calc(100vw-1rem))]");
    expect(classTokens(results)).toContain("md:w-80");
    expect(classTokens(results)).toContain("left-0");
    expect(classTokens(results)).toContain("right-0");

    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Buscar projetos e posts")).not.toBeInTheDocument();
    });
    expect(classTokens(leftCluster)).toContain("opacity-100");
    expect(classTokens(leftCluster)).toContain("visible");
    expect(classTokens(leftCluster)).toContain("pointer-events-auto");
    expect(classTokens(leftCluster)).not.toContain("invisible");
    expect(classTokens(actionsCluster)).toContain("opacity-100");
    expect(classTokens(actionsCluster)).toContain("visible");
    expect(classTokens(actionsCluster)).toContain("pointer-events-auto");
    expect(classTokens(actionsCluster)).not.toContain("invisible");
    expect(classTokens(searchCluster)).not.toContain("absolute");
  });

  it("dispara busca com debounce e renderiza sugestoes remotas", async () => {
    const user = userEvent.setup();
    setupApiMock({
      searchSuggestOk: true,
      searchSuggestions: [
        {
          kind: "project",
          id: "project-99",
          label: "Projeto Remoto",
          href: "/projeto/project-99",
          description: "Resultado remoto",
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Abrir busca" }));
    const searchInput = await screen.findByPlaceholderText("Buscar projetos e posts");
    await user.type(searchInput, "re");

    expect(getSearchSuggestCalls()).toHaveLength(0);

    await waitFor(() => {
      expect(getSearchSuggestCalls()).toHaveLength(1);
    });
    expect(await screen.findByText("Projeto Remoto")).toBeInTheDocument();
  });

  it("mantem badges de projetos remotos em uma linha com overflow oculto", async () => {
    const user = userEvent.setup();
    setupApiMock({
      searchSuggestOk: true,
      searchSuggestions: [
        {
          kind: "project",
          id: "project-88",
          label: "Projeto Remoto Badges",
          href: "/projeto/project-88",
          description: "Resultado remoto com muitas tags",
          tags: ["acao", "TagAlpha", "TagGamma", "TagBeta"],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Abrir busca" }));
    const searchInput = await screen.findByPlaceholderText("Buscar projetos e posts");
    await user.type(searchInput, "ba");

    const projectLink = await screen.findByRole("link", { name: /Projeto Remoto Badges/i });
    const projectCard = projectLink.closest("a");
    expect(projectCard).not.toBeNull();

    const coverColumn = projectCard?.querySelector(
      '[data-synopsis-role="column"]',
    ) as HTMLElement | null;
    expect(coverColumn).not.toBeNull();
    expect(classTokens(coverColumn as HTMLElement)).toContain("h-28");
    expect(classTokens(coverColumn as HTMLElement)).toContain("overflow-hidden");

    const badgesRow = projectCard?.querySelector(
      '[data-synopsis-role="badges"]',
    ) as HTMLElement | null;
    expect(badgesRow).not.toBeNull();
    expect(classTokens(badgesRow as HTMLElement)).toContain("flex-nowrap");
    expect(classTokens(badgesRow as HTMLElement)).toContain("overflow-hidden");
    expect(classTokens(badgesRow as HTMLElement)).not.toContain("flex-wrap");

    expect(screen.getByText("Acao")).toBeInTheDocument();
    expect(screen.getByText("TagAlpha")).toBeInTheDocument();
    expect(screen.queryByText("acao")).not.toBeInTheDocument();
    expect(screen.queryByText("TagBeta")).not.toBeInTheDocument();
    expect(screen.queryByText("TagGamma")).not.toBeInTheDocument();
  });

  it("usa fallback local quando a busca remota falha", async () => {
    const user = userEvent.setup();
    setupApiMock({ searchSuggestOk: false });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Abrir busca" }));
    const searchInput = await screen.findByPlaceholderText("Buscar projetos e posts");
    await user.type(searchInput, "teste");

    await waitFor(() => {
      expect(getSearchSuggestCalls().length).toBeGreaterThan(0);
    });
    expect(await screen.findByText("Projeto Teste")).toBeInTheDocument();
    expect(await screen.findByText("Post Teste")).toBeInTheDocument();
    expect(await screen.findByText("Acao")).toBeInTheDocument();
    expect(screen.queryByText("acao")).not.toBeInTheDocument();
  });

  it("mantem a ordem no desktop com links antes da busca e busca antes das acoes", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    const aboutLink = screen.getByRole("link", { name: "Sobre" });
    const searchCluster = screen.getByTestId("public-header-search-cluster");
    const actionsCluster = screen.getByTestId("public-header-actions-cluster");

    expect(
      aboutLink.compareDocumentPosition(searchCluster) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      searchCluster.compareDocumentPosition(actionsCluster) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("usa breakpoint lg para navbar completa, hamburguer e nome do usuario", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    const aboutLink = screen.getByRole("link", { name: "Sobre" });
    const navLinksContainer = aboutLink.parentElement as HTMLElement | null;
    expect(navLinksContainer).not.toBeNull();
    expect(classTokens(navLinksContainer as HTMLElement)).toContain("hidden");
    expect(classTokens(navLinksContainer as HTMLElement)).toContain("lg:flex");
    expect(classTokens(navLinksContainer as HTMLElement)).not.toContain("md:flex");

    const menuButton = screen.getByRole("button", { name: "Abrir menu" });
    expect(classTokens(menuButton)).toContain("lg:hidden");
    expect(classTokens(menuButton)).not.toContain("md:hidden");

    const userName = screen.getByText("Admin");
    expect(classTokens(userName)).toContain("hidden");
    expect(classTokens(userName)).toContain("lg:inline");
    expect(classTokens(userName)).not.toContain("md:inline");
  });

  it("renderiza toggle de tema no header", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });
    const searchButton = screen.getByRole("button", { name: "Abrir busca" });
    const themeToggle = screen.getByRole("button", { name: /Alternar para tema/i });

    expect(classTokens(searchButton)).toContain("text-foreground/80");
    expect(themeToggle).toBeInTheDocument();
    expect(classTokens(themeToggle)).toContain("text-foreground/80");
    expect(setThemePreferenceMock).not.toHaveBeenCalled();
  });

  it("abre a busca com / quando o foco nao esta em elementos interativos", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <GlobalShortcutsProvider>
          <Header />
        </GlobalShortcutsProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.keyDown(window, { key: "/" });

    const searchInput = await screen.findByPlaceholderText("Buscar projetos e posts");
    expect(searchInput).toHaveFocus();
  });

  it("ignora / quando o foco esta em um botao", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <GlobalShortcutsProvider>
          <Header />
        </GlobalShortcutsProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    const searchButton = screen.getByRole("button", { name: "Abrir busca" });
    fireEvent.keyDown(searchButton, { key: "/" });

    expect(screen.queryByPlaceholderText("Buscar projetos e posts")).not.toBeInTheDocument();
  });

  it("não redireciona e exibe toast quando logout falha", async () => {
    const user = userEvent.setup();
    setupApiMock({ logoutOk: false });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    const profileButton = screen.getByText("Admin").closest("button");
    expect(profileButton).toBeTruthy();
    await user.click(profileButton as HTMLButtonElement);
    await user.click(await screen.findByRole("menuitem", { name: /Sair/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/sair/i),
          variant: "destructive",
        }),
      );
    });
  });
});
