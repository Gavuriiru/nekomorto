import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardNotificationsPopover from "@/components/dashboard/DashboardNotificationsPopover";
import { DashboardPreferencesProvider } from "@/hooks/dashboard-preferences-provider";
import {
  DashboardSessionContext,
  type DashboardSessionContextValue,
} from "@/hooks/dashboard-session-context";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const setupApiMock = () => {
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/dashboard/notifications?limit=30" && method === "GET") {
      return mockJsonResponse(true, {
        items: [
          {
            id: "notif-1",
            kind: "error",
            source: "webhooks",
            title: "Falha em webhook",
            description: "Timeout",
            href: "/dashboard/webhooks",
            ts: "2026-03-01T12:00:00.000Z",
          },
        ],
        summary: {
          total: 1,
        },
      });
    }
    if (path === "/api/me/preferences" && method === "GET") {
      return mockJsonResponse(true, { preferences: {} });
    }
    if (path === "/api/me/preferences" && method === "PUT") {
      return mockJsonResponse(true, { ok: true });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const countApiCalls = (path: string, method = "GET") =>
  apiFetchMock.mock.calls.filter((call) => {
    const requestPath = String(call[1] || "");
    const requestOptions = (call[2] || {}) as RequestInit;
    return requestPath === path && String(requestOptions.method || "GET").toUpperCase() === method;
  }).length;

const renderPopover = (open: boolean) =>
  render(
    <MemoryRouter>
      <DashboardNotificationsPopover apiBase="http://api.local" open={open} onOpenChange={() => undefined} />
    </MemoryRouter>,
  );

const buildSessionValue = (overrides?: {
  currentUser?: DashboardSessionContextValue["currentUser"];
}): DashboardSessionContextValue => ({
  hasProvider: true,
  currentUser:
    overrides?.currentUser ||
    ({
      id: "u-1",
      name: "Admin",
      username: "admin",
      permissions: ["*"],
    } as DashboardSessionContextValue["currentUser"]),
  isLoading: false,
  hasResolved: true,
  refresh: vi.fn(async () => overrides?.currentUser || null),
  setCurrentUser: vi.fn(),
});

const renderPopoverWithProviders = (open: boolean, sessionValue: DashboardSessionContextValue) =>
  render(
    <MemoryRouter>
      <DashboardSessionContext.Provider value={sessionValue}>
        <DashboardPreferencesProvider>
          <DashboardNotificationsPopover
            apiBase="http://api.local"
            open={open}
            onOpenChange={() => undefined}
          />
        </DashboardPreferencesProvider>
      </DashboardSessionContext.Provider>
    </MemoryRouter>,
  );

describe("DashboardNotificationsPopover loading state", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("nao carrega notificacoes nem preferencias enquanto o popover esta fechado", () => {
    setupApiMock();

    renderPopover(false);

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("mostra placeholders enquanto a primeira carga sob demanda esta pendente", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me/preferences" && method === "GET") {
        return mockJsonResponse(true, { preferences: {} });
      }
      if (path === "/api/dashboard/notifications?limit=30" && method === "GET") {
        return new Promise<Response>(() => undefined);
      }
      if (path === "/api/me/preferences" && method === "PUT") {
        return mockJsonResponse(true, { ok: true });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderPopover(true);

    expect(await screen.findByTestId("dashboard-notifications-loading")).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma pendencia operacional/i)).not.toBeInTheDocument();
  });

  it("carrega sob demanda ao abrir e persiste o lastSeen", async () => {
    setupApiMock();
    const { rerender } = renderPopover(false);

    expect(apiFetchMock).not.toHaveBeenCalled();

    rerender(
      <MemoryRouter>
        <DashboardNotificationsPopover apiBase="http://api.local" open onOpenChange={() => undefined} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Falha em webhook")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "http://api.local",
        "/api/me/preferences",
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  it("nao reentra em loading com provider ao receber novo objeto do mesmo usuario", async () => {
    setupApiMock();
    const firstSessionValue = buildSessionValue();
    const { rerender } = renderPopoverWithProviders(true, firstSessionValue);

    expect(await screen.findByText("Falha em webhook")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-notifications-loading")).not.toBeInTheDocument();
    expect(countApiCalls("/api/me/preferences")).toBe(1);
    expect(countApiCalls("/api/dashboard/notifications?limit=30")).toBe(1);

    const secondSessionValue = buildSessionValue({
      currentUser: {
        id: "u-1",
        name: "Admin atualizado",
        username: "admin",
        permissions: ["*"],
      },
    });

    rerender(
      <MemoryRouter>
        <DashboardSessionContext.Provider value={secondSessionValue}>
          <DashboardPreferencesProvider>
            <DashboardNotificationsPopover
              apiBase="http://api.local"
              open
              onOpenChange={() => undefined}
            />
          </DashboardPreferencesProvider>
        </DashboardSessionContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("dashboard-notifications-loading")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(countApiCalls("/api/me/preferences")).toBe(1);
      expect(countApiCalls("/api/dashboard/notifications?limit=30")).toBe(1);
    });
  });

  it("faz polling apenas enquanto esta aberto e recarrega ao reabrir", async () => {
    vi.useFakeTimers();
    setupApiMock();
    const { rerender } = renderPopover(true);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Falha em webhook")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "http://api.local",
      "/api/me/preferences",
      expect.objectContaining({ method: "PUT" }),
    );

    apiFetchMock.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "http://api.local",
      "/api/dashboard/notifications?limit=30",
      expect.objectContaining({ auth: true }),
    );

    rerender(
      <MemoryRouter>
        <DashboardNotificationsPopover apiBase="http://api.local" open={false} onOpenChange={() => undefined} />
      </MemoryRouter>,
    );

    apiFetchMock.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(apiFetchMock).not.toHaveBeenCalled();

    rerender(
      <MemoryRouter>
        <DashboardNotificationsPopover apiBase="http://api.local" open onOpenChange={() => undefined} />
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "http://api.local",
      "/api/dashboard/notifications?limit=30",
      expect.objectContaining({ auth: true }),
    );
  });
});
