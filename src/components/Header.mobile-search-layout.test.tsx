import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Header from "@/components/Header";
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
            title: "Projeto Teste",
            synopsis: "Sinopse do projeto",
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
            title: "Post Teste",
            slug: "post-teste",
            excerpt: "Resumo do post",
          },
        ],
      });
    }
    if (endpoint === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: { acao: "Acao" } });
    }
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
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("Header mobile search layout", () => {
  beforeEach(() => {
    setupApiMock();
    useSiteSettingsMock.mockReset();
    useSiteSettingsMock.mockReturnValue({
      settings: createSettings(),
      isLoading: false,
      refresh: vi.fn(async () => undefined),
    });
  });

  it("oculta clusters, centraliza busca e restaura estado ao fechar no mobile", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    const leftCluster = screen.getByTestId("public-header-left-cluster");
    const searchCluster = screen.getByTestId("public-header-search-cluster");
    const actionsCluster = screen.getByTestId("public-header-actions-cluster");

    fireEvent.click(screen.getByRole("button", { name: "Abrir pesquisa" }));

    const searchInput = await screen.findByPlaceholderText("Pesquisar projetos e posts");
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
      target: { value: "teste" },
    });

    expect(await screen.findByText("Projeto Teste")).toBeInTheDocument();
    expect(await screen.findByText("Post Teste")).toBeInTheDocument();

    const results = screen.getByTestId("public-header-results");
    expect(classTokens(results)).toContain("w-[min(24rem,calc(100vw-1rem))]");
    expect(classTokens(results)).toContain("md:w-80");
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

  it("mantem a ordem no desktop com links antes da busca e busca antes das acoes", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(4);
    });

    const aboutLink = screen.getByRole("link", { name: "Sobre" });
    const searchCluster = screen.getByTestId("public-header-search-cluster");
    const actionsCluster = screen.getByTestId("public-header-actions-cluster");

    expect(aboutLink.compareDocumentPosition(searchCluster) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(searchCluster.compareDocumentPosition(actionsCluster) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("usa breakpoint lg para navbar completa, hamburguer e nome do usuario", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(4);
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
});
