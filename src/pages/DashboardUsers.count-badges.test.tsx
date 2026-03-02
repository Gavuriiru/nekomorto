import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardMotionDelays } from "@/components/dashboard/dashboard-motion";
import DashboardUsers from "@/pages/DashboardUsers";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      teamRoles: [],
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

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

const usersPayload = {
  users: [
    {
      id: "u-1",
      name: "Admin ativo",
      phrase: "",
      bio: "",
      avatarUrl: null,
      socials: [],
      status: "active",
      permissions: ["usuarios_basico"],
      roles: [],
      accessRole: "admin",
      order: 0,
    },
    {
      id: "u-2",
      name: "Admin aposentado",
      phrase: "",
      bio: "",
      avatarUrl: null,
      socials: [],
      status: "retired",
      permissions: ["usuarios_basico"],
      roles: [],
      accessRole: "admin",
      order: 1,
    },
  ],
  ownerIds: [],
  primaryOwnerId: null,
};

const mockLoadedRequests = () => {
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, usersPayload);
    }
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, {
        id: "u-1",
        name: "Admin",
        username: "admin",
        accessRole: "admin",
        grants: {
          usuarios_basico: true,
          usuarios_acesso: true,
        },
        ownerIds: [],
        primaryOwnerId: null,
      });
    }
    if (path === "/api/link-types" && method === "GET") {
      return mockJsonResponse(true, { items: [] });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const renderDashboardUsers = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
      <DashboardUsers />
    </MemoryRouter>,
  );

describe("DashboardUsers count badges", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    mockLoadedRequests();
  });

  it("exibe skeleton no contador de ativos enquanto a carga ainda está pendente", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/users" && method === "GET") {
        return new Promise<Response>(() => undefined);
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "u-1",
          name: "Admin",
          username: "admin",
          accessRole: "admin",
          grants: {
            usuarios_basico: true,
            usuarios_acesso: true,
          },
          ownerIds: [],
          primaryOwnerId: null,
        });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderDashboardUsers();

    await screen.findByRole("heading", { name: /Gestão de Usuários/i });
    expect(screen.getByTestId("dashboard-users-active-count-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-users-active-count-badge")).not.toBeInTheDocument();
  });

  it("anima as badges de ativos e aposentados quando os dados reais carregam", async () => {
    renderDashboardUsers();

    await screen.findByText("Admin ativo");
    await screen.findByText("Admin aposentado");

    const activeBadge = screen.getByTestId("dashboard-users-active-count-badge");
    const retiredBadge = screen.getByTestId("dashboard-users-retired-count-badge");
    const activeReveal = activeBadge.parentElement;
    const retiredReveal = retiredBadge.parentElement;

    expect(activeReveal).not.toBeNull();
    expect(classTokens(activeReveal as HTMLElement)).toContain("animate-slide-up");
    expect(classTokens(activeReveal as HTMLElement)).toContain("opacity-0");
    expect(activeReveal).toHaveStyle({
      animationDelay: `${dashboardMotionDelays.sectionMetaMs}ms`,
    });
    expect(activeBadge).toHaveTextContent("1");
    expect(retiredReveal).not.toBeNull();
    expect(classTokens(retiredReveal as HTMLElement)).toContain("animate-slide-up");
    expect(classTokens(retiredReveal as HTMLElement)).toContain("opacity-0");
    expect(retiredReveal).toHaveStyle({
      animationDelay: `${dashboardMotionDelays.sectionMetaMs}ms`,
    });
    expect(retiredBadge).toHaveTextContent("1");
  });
});
