import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Header from "@/components/Header";
import { defaultSettings } from "@/hooks/site-settings-context";

const apiFetchMock = vi.hoisted(() => vi.fn());
const useSiteSettingsMock = vi.hoisted(() => vi.fn());
const usePublicBootstrapMock = vi.hoisted(() => vi.fn());
const scheduleOnBrowserLoadIdleMock = vi.hoisted(() => vi.fn());
const useIsMobileMock = vi.hoisted(() => vi.fn());
const headerActionMenusMock = vi.hoisted(() => vi.fn());
const setThemePreferenceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => useSiteSettingsMock(),
}));

vi.mock("@/hooks/use-public-bootstrap", () => ({
  usePublicBootstrap: () => usePublicBootstrapMock(),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
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

vi.mock("@/lib/browser-idle", () => ({
  scheduleOnBrowserLoadIdle: (
    callback: (deadline: IdleDeadline) => void,
    options?: { delayMs?: number },
  ) => scheduleOnBrowserLoadIdleMock(callback, options),
}));

vi.mock("@/components/HeaderActionMenus", () => ({
  default: (props: unknown) => {
    headerActionMenusMock(props);
    const typedProps = props as { headerAvatarUrl?: string };
    return (
      <div data-testid="header-action-menus" data-avatar-url={typedProps.headerAvatarUrl || ""} />
    );
  },
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

describe("Header discord avatar proxy", () => {
  beforeEach(() => {
    const discordAvatarUrl =
      "https://cdn.discordapp.com/avatars/123456789/avatar_hash.png?size=128";

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
              avatarUrl: discordAvatarUrl,
            },
          });
        }
        return mockJsonResponse(false, { error: "not_found" }, 404);
      },
    );

    scheduleOnBrowserLoadIdleMock.mockReset();
    scheduleOnBrowserLoadIdleMock.mockImplementation(
      (callback: (deadline: IdleDeadline) => void) => {
        callback({
          didTimeout: false,
          timeRemaining: () => 16,
        } as IdleDeadline);
        return () => undefined;
      },
    );

    useIsMobileMock.mockReset();
    useIsMobileMock.mockReturnValue(false);

    useSiteSettingsMock.mockReset();
    useSiteSettingsMock.mockReturnValue({
      settings: defaultSettings,
      isLoading: false,
      refresh: vi.fn(async () => undefined),
    });

    usePublicBootstrapMock.mockReset();
    usePublicBootstrapMock.mockReturnValue({
      data: {
        projects: [],
        posts: [],
        mediaVariants: {},
        tagTranslations: {
          tags: {},
          genres: {},
          staffRoles: {},
        },
      },
    });

    (
      window as Window & {
        __BOOTSTRAP_PUBLIC__?: unknown;
        __BOOTSTRAP_PUBLIC_ME__?: unknown;
      }
    ).__BOOTSTRAP_PUBLIC__ = undefined;
    (
      window as Window & {
        __BOOTSTRAP_PUBLIC__?: unknown;
        __BOOTSTRAP_PUBLIC_ME__?: unknown;
      }
    ).__BOOTSTRAP_PUBLIC_ME__ = {
      id: "user-1",
      name: "Admin",
      username: "admin",
      avatarUrl: discordAvatarUrl,
    };
  });

  it("resolve o avatar do usuario atual para o proxy same-origin antes do menu do header", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    const menus = await screen.findByTestId("header-action-menus");
    expect(menus).toHaveAttribute(
      "data-avatar-url",
      "/api/public/discord-avatar/123456789/avatar_hash.png?size=64",
    );
  });

  it("anexa a revision em avatars locais para invalidar cache na navbar publica", async () => {
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
        const method = String(options?.method || "GET").toUpperCase();
        if (endpoint === "/api/public/me" && method === "GET") {
          return mockJsonResponse(true, {
            user: {
              id: "user-1",
              name: "Admin",
              username: "admin",
              avatarUrl: "/uploads/users/avatar-user-1.png",
              revision: "rev-2",
            },
          });
        }
        return mockJsonResponse(false, { error: "not_found" }, 404);
      },
    );

    (
      window as Window & {
        __BOOTSTRAP_PUBLIC__?: unknown;
        __BOOTSTRAP_PUBLIC_ME__?: unknown;
      }
    ).__BOOTSTRAP_PUBLIC_ME__ = {
      id: "user-1",
      name: "Admin",
      username: "admin",
      avatarUrl: "/uploads/users/avatar-user-1.png",
      revision: "rev-2",
    };

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );

    const menus = await screen.findByTestId("header-action-menus");
    expect(menus).toHaveAttribute("data-avatar-url", "/uploads/users/avatar-user-1.png?v=rev-2");
  });
});
