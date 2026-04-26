import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const escapeRegexPattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const renderDashboardUsers = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
      <DashboardUsers />
    </MemoryRouter>,
  );

describe("DashboardUsers avatar fallback layout", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("mantem o wrapper do fallback com tamanho fixo nos cards ativos e aposentados", async () => {
    const activeUser = {
      id: "user-active",
      name: "Alana nome extremamente longo para pressionar o layout",
      phrase: "Frase longa para aumentar a pressao horizontal no card ativo",
      bio: "",
      avatarUrl: null,
      socials: [],
      status: "active" as const,
      permissions: [],
      roles: [],
      accessRole: "normal" as const,
      order: 0,
    };
    const retiredUser = {
      id: "user-retired",
      name: "Bento nome extremamente longo para pressionar o layout",
      phrase: "Frase longa para aumentar a pressao horizontal no card aposentado",
      bio: "",
      avatarUrl: null,
      socials: [],
      status: "retired" as const,
      permissions: [],
      roles: [],
      accessRole: "normal" as const,
      order: 1,
    };

    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [activeUser, retiredUser],
          ownerIds: [],
          primaryOwnerId: null,
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "admin-1",
          name: "Admin",
          username: "admin",
          accessRole: "admin",
      grants: {
            usuarios: true,
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

    const activeOpenButton = await screen.findByRole("button", {
      name: new RegExp(`Abrir usu.rio ${escapeRegexPattern(activeUser.name)}`, "i"),
    });
    const activeAvatar = activeOpenButton.parentElement?.querySelector(
      "div.shrink-0.rounded-full",
    ) as HTMLElement | null;
    expect(activeAvatar).not.toBeNull();
    expect(classTokens(activeAvatar as HTMLElement)).toEqual(
      expect.arrayContaining(["h-14", "w-14", "shrink-0", "rounded-full"]),
    );
    expect(activeAvatar).toHaveTextContent("AL");
    expect(activeAvatar?.querySelector("img")).toBeNull();

    const retiredOpenButton = await screen.findByRole("button", {
      name: new RegExp(`Abrir usu.rio ${escapeRegexPattern(retiredUser.name)}`, "i"),
    });
    const retiredAvatar = retiredOpenButton.parentElement?.querySelector(
      "div.shrink-0.rounded-full",
    ) as HTMLElement | null;
    expect(retiredAvatar).not.toBeNull();
    expect(classTokens(retiredAvatar as HTMLElement)).toEqual(
      expect.arrayContaining(["h-14", "w-14", "shrink-0", "rounded-full"]),
    );
    expect(retiredAvatar).toHaveTextContent("BE");
    expect(retiredAvatar?.querySelector("img")).toBeNull();
  });

  it("preserva o wrapper com imagem no card quando o usuario tem avatar", async () => {
    const imageUser = {
      id: "user-image",
      name: "Carla",
      phrase: "Com avatar salvo",
      bio: "",
      avatarUrl: "/uploads/users/avatar-carla.png",
      revision: "rev-image",
      socials: [],
      status: "active" as const,
      permissions: [],
      roles: [],
      accessRole: "normal" as const,
      order: 0,
    };

    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [imageUser],
          ownerIds: [],
          primaryOwnerId: null,
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "admin-1",
          name: "Admin",
          username: "admin",
          accessRole: "admin",
      grants: {
            usuarios: true,
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

    const avatarImage = await screen.findByRole("img", { name: imageUser.name });
    const avatarWrapper = avatarImage.parentElement as HTMLElement | null;
    expect(avatarWrapper).not.toBeNull();
    expect(classTokens(avatarWrapper as HTMLElement)).toEqual(
      expect.arrayContaining([
        "h-14",
        "w-14",
        "relative",
        "shrink-0",
        "overflow-hidden",
        "rounded-full",
      ]),
    );
    expect(avatarImage).toHaveAttribute("src", "/uploads/users/avatar-carla.png?v=rev-image");
    expect(classTokens(avatarImage)).toEqual(
      expect.arrayContaining(["h-full", "w-full", "object-cover"]),
    );
  });
});
