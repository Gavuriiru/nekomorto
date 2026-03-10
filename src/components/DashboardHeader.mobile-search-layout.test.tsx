import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardHeader from "@/components/DashboardHeader";
import { GlobalShortcutsProvider } from "@/hooks/global-shortcuts-provider";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";

const apiFetchMock = vi.hoisted(() => vi.fn());
const useSiteSettingsMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button type="button" className={className} aria-label="Toggle Sidebar">
      Toggle Sidebar
    </button>
  ),
}));

vi.mock("@/components/dashboard/DashboardNotificationsPopover", () => ({
  default: () => <button type="button">Notificacoes</button>,
}));

vi.mock("@/components/dashboard/DashboardCommandPalette", () => ({
  default: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (value: boolean) => void;
  }) =>
    open ? (
      <div>
        <input
          aria-label="Buscar navegação"
          placeholder="Buscar navegação, abas e ações..."
          onBlur={() => onOpenChange(false)}
        />
      </div>
    ) : null,
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

const setupApiMock = (options?: { logoutOk?: boolean; searchSuggestions?: unknown[] }) => {
  const { logoutOk = true, searchSuggestions = [] } = options || {};
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(
    async (_apiBase: string, endpoint: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (endpoint.startsWith("/api/public/search/suggest?") && method === "GET") {
        return mockJsonResponse(true, {
          suggestions: searchSuggestions,
          mediaVariants: {},
        });
      }
      if (endpoint === "/api/logout" && method === "POST") {
        return mockJsonResponse(
          logoutOk,
          logoutOk ? { ok: true } : { error: "logout_failed" },
          logoutOk ? 200 : 500,
        );
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    },
  );
};

const getSearchSuggestCalls = () =>
  apiFetchMock.mock.calls.filter((call) =>
    String(call[1] || "").startsWith("/api/public/search/suggest?"),
  );

const getOldEagerPublicCalls = () =>
  apiFetchMock.mock.calls.filter((call) =>
    [
      "/api/public/projects",
      "/api/public/posts",
      "/api/public/tag-translations",
    ].includes(String(call[1] || "")),
  );

describe("DashboardHeader mobile search layout", () => {
  beforeEach(() => {
    setupApiMock();
    toastMock.mockReset();
    setThemePreferenceMock.mockReset();
    useSiteSettingsMock.mockReset();
    useSiteSettingsMock.mockReturnValue({
      settings: createSettings(),
      isLoading: false,
      refresh: vi.fn(async () => undefined),
    });
  });

  it("habilita busca mobile, nao faz fetch eager e renderiza sugestoes remotas", async () => {
    setupApiMock({
      searchSuggestions: [
        {
          kind: "project",
          id: "project-1",
          label: "Projeto Dashboard",
          href: "/projeto/project-1",
          description: "Sinopse dashboard",
          image: "/placeholder.svg",
          tags: ["Acao"],
        },
        {
          kind: "post",
          id: "post-1",
          label: "Post Dashboard",
          href: "/postagem/post-dashboard",
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardHeader
          currentUser={{
            name: "Admin",
            username: "admin",
            avatarUrl: null,
          }}
        />
      </MemoryRouter>,
    );

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(getOldEagerPublicCalls()).toHaveLength(0);

    const mobileLogo = screen.getByTestId("dashboard-header-mobile-logo");
    expect(classTokens(mobileLogo)).toContain("xl:hidden");

    const leftCluster = screen.getByTestId("dashboard-header-left-cluster");
    const searchCluster = screen.getByTestId("dashboard-header-search-cluster");
    const actionsCluster = screen.getByTestId("dashboard-header-actions-cluster");

    fireEvent.click(screen.getByRole("button", { name: "Abrir busca" }));

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

    fireEvent.change(searchInput, {
      target: { value: "dashboard" },
    });

    await waitFor(() => {
      expect(getSearchSuggestCalls()).toHaveLength(1);
    });
    expect(await screen.findByText("Projeto Dashboard")).toBeInTheDocument();
    expect(await screen.findByText("Post Dashboard")).toBeInTheDocument();
    expect(await screen.findByText("Acao")).toBeInTheDocument();

    const projectLink = await screen.findByRole("link", { name: /Projeto Dashboard/i });
    const projectCard = projectLink.closest("a");
    expect(projectCard).not.toBeNull();
    expect(classTokens(projectCard as HTMLElement)).toContain("h-36");

    const coverImage = screen.getByRole("img", { name: "Projeto Dashboard" });
    let coverWrapper = coverImage.parentElement as HTMLElement | null;
    while (coverWrapper && !classTokens(coverWrapper).includes("h-28")) {
      coverWrapper = coverWrapper.parentElement;
    }
    expect(coverWrapper).not.toBeNull();
    expect(classTokens(coverWrapper as HTMLElement)).toContain("h-28");
    expect(coverWrapper?.style.aspectRatio).toBe("9 / 14");

    const coverColumn = screen.getByText("Projeto Dashboard").closest(
      '[data-synopsis-role="column"]',
    ) as HTMLElement | null;
    expect(coverColumn).not.toBeNull();
    expect(classTokens(coverColumn as HTMLElement)).toContain("flex-1");
    expect(classTokens(coverColumn as HTMLElement)).toContain("self-stretch");
    expect(classTokens(coverColumn as HTMLElement)).toContain("min-h-0");
    expect(classTokens(coverColumn as HTMLElement)).not.toContain("h-28");

    const synopsis = projectCard?.querySelector(
      '[data-synopsis-role="synopsis"]',
    ) as HTMLElement | null;
    expect(synopsis).not.toBeNull();
    expect(classTokens(synopsis as HTMLElement)).toContain("flex-1");
    expect(classTokens(synopsis as HTMLElement)).toContain("min-h-0");

    const results = screen.getByTestId("dashboard-header-results");
    expect(classTokens(results)).toContain("w-[min(24rem,calc(100vw-1rem))]");
    expect(classTokens(results)).toContain("xl:w-80");
    expect(classTokens(results)).toContain("left-0");
    expect(classTokens(results)).toContain("right-0");

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Buscar projetos e posts")).not.toBeInTheDocument();
    });
    expect(classTokens(leftCluster)).toContain("opacity-100");
    expect(classTokens(leftCluster)).toContain("visible");
    expect(classTokens(leftCluster)).toContain("pointer-events-auto");
    expect(classTokens(actionsCluster)).toContain("opacity-100");
    expect(classTokens(actionsCluster)).toContain("visible");
    expect(classTokens(actionsCluster)).toContain("pointer-events-auto");
    expect(classTokens(searchCluster)).not.toContain("absolute");
  });

  it("mantem badges de projetos remotos em uma linha sem cortar o rodape do card", async () => {
    setupApiMock({
      searchSuggestions: [
        {
          kind: "project",
          id: "project-88",
          label: "Projeto Dashboard Badges",
          href: "/projeto/project-88",
          description: "Resultado remoto com muitas tags",
          image: "/placeholder.svg",
          tags: ["Acao", "TagAlpha", "TagGamma", "TagBeta"],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardHeader
          currentUser={{
            name: "Admin",
            username: "admin",
            avatarUrl: null,
          }}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir busca" }));

    const searchInput = await screen.findByPlaceholderText("Buscar projetos e posts");
    fireEvent.change(searchInput, {
      target: { value: "ba" },
    });

    await waitFor(() => {
      expect(getSearchSuggestCalls()).toHaveLength(1);
    });

    const projectLink = await screen.findByRole("link", { name: /Projeto Dashboard Badges/i });
    const projectCard = projectLink.closest("a");
    expect(projectCard).not.toBeNull();
    expect(classTokens(projectCard as HTMLElement)).toContain("h-36");

    const coverColumn = projectCard?.querySelector(
      '[data-synopsis-role="column"]',
    ) as HTMLElement | null;
    expect(coverColumn).not.toBeNull();
    expect(classTokens(coverColumn as HTMLElement)).toContain("flex-1");
    expect(classTokens(coverColumn as HTMLElement)).toContain("self-stretch");
    expect(classTokens(coverColumn as HTMLElement)).toContain("min-h-0");
    expect(classTokens(coverColumn as HTMLElement)).not.toContain("h-28");
    expect(classTokens(coverColumn as HTMLElement)).not.toContain("overflow-hidden");

    const badgesRow = projectCard?.querySelector(
      '[data-synopsis-role="badges"]',
    ) as HTMLElement | null;
    expect(badgesRow).not.toBeNull();
    expect(classTokens(badgesRow as HTMLElement)).toContain("flex-nowrap");
    expect(classTokens(badgesRow as HTMLElement)).toContain("overflow-hidden");
    expect(classTokens(badgesRow as HTMLElement)).toContain("shrink-0");
    expect(classTokens(badgesRow as HTMLElement)).toContain("pb-1");
    expect(classTokens(badgesRow as HTMLElement)).not.toContain("flex-wrap");
    expect((badgesRow as HTMLElement).childElementCount).toBe(4);

    expect(screen.getByText("Acao")).toBeInTheDocument();
    expect(screen.getByText("TagAlpha")).toBeInTheDocument();
    expect(screen.getByText("TagGamma")).toBeInTheDocument();
    expect(screen.getByText("TagBeta")).toBeInTheDocument();
  });

  it("mantem a ordem no desktop com links antes da busca e busca antes das acoes", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardHeader
          currentUser={{
            name: "Admin",
            username: "admin",
            avatarUrl: null,
          }}
        />
      </MemoryRouter>,
    );

    expect(getOldEagerPublicCalls()).toHaveLength(0);

    const aboutLink = screen.getByRole("link", { name: "Sobre" });
    const searchCluster = screen.getByTestId("dashboard-header-search-cluster");
    const actionsCluster = screen.getByTestId("dashboard-header-actions-cluster");

    expect(
      aboutLink.compareDocumentPosition(searchCluster) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(
      searchCluster.compareDocumentPosition(actionsCluster) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("abre a busca com / e ignora Ctrl/Cmd+K dentro do campo de busca", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <GlobalShortcutsProvider>
          <DashboardHeader
            currentUser={{
              name: "Admin",
              username: "admin",
              avatarUrl: null,
            }}
          />
        </GlobalShortcutsProvider>
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: "/" });

    const searchInput = await screen.findByPlaceholderText("Buscar projetos e posts");
    expect(searchInput).toHaveFocus();

    fireEvent.keyDown(searchInput, { key: "k", ctrlKey: true });

    expect(
      screen.queryByPlaceholderText("Buscar navegação, abas e ações..."),
    ).not.toBeInTheDocument();
  });

  it("nao redireciona e exibe toast quando logout falha", async () => {
    setupApiMock({ logoutOk: false });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardHeader
          currentUser={{
            name: "Admin",
            username: "admin",
            avatarUrl: null,
          }}
        />
      </MemoryRouter>,
    );

    const profileButton = screen.getByText("Admin").closest("button");
    expect(profileButton).toBeTruthy();
    fireEvent.keyDown(profileButton as HTMLButtonElement, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Sair/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/sair/i),
          variant: "destructive",
        }),
      );
    });
  });

  it("renderiza toggle de tema sem fetch publico eager", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardHeader
          currentUser={{
            name: "Admin",
            username: "admin",
            avatarUrl: null,
          }}
        />
      </MemoryRouter>,
    );

    const searchButton = screen.getByRole("button", { name: "Abrir busca" });
    const themeToggle = screen.getByRole("button", { name: /Alternar para tema/i });

    expect(classTokens(searchButton)).toContain("text-foreground/80");
    expect(themeToggle).toBeInTheDocument();
    expect(classTokens(themeToggle)).toContain("text-foreground/80");
    expect(setThemePreferenceMock).not.toHaveBeenCalled();
    expect(getOldEagerPublicCalls()).toHaveLength(0);
  });
});
