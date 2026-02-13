import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardHeader from "@/components/DashboardHeader";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";

const apiFetchMock = vi.hoisted(() => vi.fn());
const useSiteSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => useSiteSettingsMock(),
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

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const createSettings = (override: Partial<SiteSettings> = {}) => mergeSettings(defaultSettings, override);

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

const setupApiMock = () => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (endpoint === "/api/public/projects" && method === "GET") {
      return mockJsonResponse(true, {
        projects: [
          {
            id: "project-1",
            title: "Projeto Dashboard",
            synopsis: "Sinopse dashboard",
            tags: ["acao"],
            cover: "/placeholder.svg",
          },
        ],
      });
    }
    if (endpoint === "/api/public/posts" && method === "GET") {
      return mockJsonResponse(true, {
        posts: [
          {
            title: "Post Dashboard",
            slug: "post-dashboard",
            excerpt: "Resumo dashboard",
          },
        ],
      });
    }
    if (endpoint === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: { acao: "Acao" } });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("DashboardHeader mobile search layout", () => {
  beforeEach(() => {
    setupApiMock();
    useSiteSettingsMock.mockReset();
    useSiteSettingsMock.mockReturnValue({
      settings: createSettings(),
      isLoading: false,
      refresh: vi.fn(async () => undefined),
    });
  });

  it("habilita busca mobile com logo compacta, oculta clusters e centraliza resultados", async () => {
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

    const mobileLogo = screen.getByTestId("dashboard-header-mobile-logo");
    expect(classTokens(mobileLogo)).toContain("xl:hidden");

    const leftCluster = screen.getByTestId("dashboard-header-left-cluster");
    const searchCluster = screen.getByTestId("dashboard-header-search-cluster");
    const actionsCluster = screen.getByTestId("dashboard-header-actions-cluster");

    fireEvent.click(screen.getByRole("button", { name: "Abrir pesquisa" }));

    expect(await screen.findByPlaceholderText("Pesquisar projetos e posts")).toBeInTheDocument();
    expect(classTokens(leftCluster)).toContain("opacity-0");
    expect(classTokens(leftCluster)).toContain("invisible");
    expect(classTokens(leftCluster)).toContain("pointer-events-none");
    expect(classTokens(actionsCluster)).toContain("opacity-0");
    expect(classTokens(actionsCluster)).toContain("invisible");
    expect(classTokens(actionsCluster)).toContain("pointer-events-none");
    expect(classTokens(searchCluster)).toContain("absolute");
    expect(classTokens(searchCluster)).toContain("inset-x-0");
    expect(classTokens(searchCluster)).toContain("w-[min(22rem,calc(100vw-1rem))]");

    fireEvent.change(screen.getByPlaceholderText("Pesquisar projetos e posts"), {
      target: { value: "dashboard" },
    });

    expect(await screen.findByText("Projeto Dashboard")).toBeInTheDocument();
    expect(await screen.findByText("Post Dashboard")).toBeInTheDocument();

    const results = screen.getByTestId("dashboard-header-results");
    expect(classTokens(results)).toContain("w-[min(24rem,calc(100vw-1rem))]");
    expect(classTokens(results)).toContain("xl:w-80");
    expect(classTokens(results)).toContain("left-0");
    expect(classTokens(results)).toContain("right-0");

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Pesquisar projetos e posts")).not.toBeInTheDocument();
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
});
