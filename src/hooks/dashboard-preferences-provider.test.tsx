import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPreferencesProvider } from "@/hooks/dashboard-preferences-provider";
import {
  DashboardSessionContext,
  type DashboardSessionContextValue,
  type DashboardSessionUser,
} from "@/hooks/dashboard-session-context";
import { useDashboardPreferences } from "@/hooks/use-dashboard-preferences";

const apiFetchMock = vi.hoisted(() => vi.fn());

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

const buildSessionValue = (
  currentUser: DashboardSessionUser | null,
): DashboardSessionContextValue => ({
  hasProvider: true,
  currentUser,
  isLoading: false,
  hasResolved: true,
  refresh: vi.fn(async () => currentUser),
  setCurrentUser: vi.fn(),
});

const PreferencesProbe = () => {
  const { preferences, isLoading, hasResolved } = useDashboardPreferences();
  const dashboard =
    preferences.dashboard && typeof preferences.dashboard === "object"
      ? (preferences.dashboard as Record<string, unknown>)
      : {};
  const notifications =
    dashboard.notifications && typeof dashboard.notifications === "object"
      ? (dashboard.notifications as Record<string, unknown>)
      : {};
  return (
    <div
      data-testid="preferences-probe"
      data-loading={String(isLoading)}
      data-resolved={String(hasResolved)}
      data-last-seen={String(notifications.lastSeenAt || "")}
    />
  );
};

const renderProvider = (sessionValue: DashboardSessionContextValue, tick: number) =>
  render(
    <DashboardSessionContext.Provider value={sessionValue}>
      <DashboardPreferencesProvider>
        <div data-testid="render-tick">{tick}</div>
        <PreferencesProbe />
      </DashboardPreferencesProvider>
    </DashboardSessionContext.Provider>,
  );

describe("DashboardPreferencesProvider", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("carrega preferencias uma vez por currentUser.id e nao reentra em loading com novo objeto do mesmo usuario", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me/preferences" && method === "GET") {
        return mockJsonResponse(true, {
          preferences: {
            dashboard: {
              notifications: {
                lastSeenAt: "2026-03-01T12:00:00.000Z",
              },
            },
          },
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    const firstUser = {
      id: "u-1",
      name: "Admin",
      username: "admin",
      permissions: ["*"],
    } satisfies DashboardSessionUser;

    const { rerender } = renderProvider(buildSessionValue(firstUser), 0);

    await waitFor(() => {
      expect(screen.getByTestId("preferences-probe")).toHaveAttribute("data-loading", "false");
      expect(screen.getByTestId("preferences-probe")).toHaveAttribute("data-resolved", "true");
      expect(screen.getByTestId("preferences-probe")).toHaveAttribute(
        "data-last-seen",
        "2026-03-01T12:00:00.000Z",
      );
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    const secondUser = {
      ...firstUser,
      name: "Admin atualizado",
    } satisfies DashboardSessionUser;

    rerender(
      <DashboardSessionContext.Provider value={buildSessionValue(secondUser)}>
        <DashboardPreferencesProvider>
          <div data-testid="render-tick">1</div>
          <PreferencesProbe />
        </DashboardPreferencesProvider>
      </DashboardSessionContext.Provider>,
    );

    expect(screen.getByTestId("preferences-probe")).toHaveAttribute("data-loading", "false");

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("recarrega preferencias quando o currentUser.id muda", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me/preferences" && method === "GET") {
        return mockJsonResponse(true, { preferences: {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    const { rerender } = renderProvider(
      buildSessionValue({
        id: "u-1",
        name: "Admin",
        username: "admin",
        permissions: ["*"],
      }),
      0,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <DashboardSessionContext.Provider
        value={buildSessionValue({
          id: "u-2",
          name: "Editor",
          username: "editor",
          permissions: ["posts"],
        })}
      >
        <DashboardPreferencesProvider>
          <div data-testid="render-tick">1</div>
          <PreferencesProbe />
        </DashboardPreferencesProvider>
      </DashboardSessionContext.Provider>,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("preferences-probe")).toHaveAttribute("data-loading", "false");
    });
  });
});
