import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardSessionProvider } from "@/hooks/dashboard-session-provider";
import { useDashboardSession } from "@/hooks/use-dashboard-session";

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

const createDeferredResponse = () => {
  let resolve: ((value: Response) => void) | null = null;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return {
    promise,
    resolve: (value: Response) => {
      resolve?.(value);
    },
  };
};

const SessionProbe = () => {
  const { currentUser, isLoading, hasResolved } = useDashboardSession();
  return (
    <div
      data-testid="session-probe"
      data-user={String(currentUser?.username || "")}
      data-loading={String(isLoading)}
      data-resolved={String(hasResolved)}
    />
  );
};

const renderProvider = (tick: number) =>
  render(
    <DashboardSessionProvider>
      <div data-testid="render-tick">{tick}</div>
      <SessionProbe />
    </DashboardSessionProvider>,
  );

describe("DashboardSessionProvider", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    (window as Window & { __BOOTSTRAP_PUBLIC_ME__?: unknown }).__BOOTSTRAP_PUBLIC_ME__ = undefined;
  });

  it("revalida o bootstrap uma vez por mount sem voltar ao loading bloqueante", async () => {
    const userDeferred = createDeferredResponse();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return userDeferred.promise;
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    (window as Window & { __BOOTSTRAP_PUBLIC_ME__?: unknown }).__BOOTSTRAP_PUBLIC_ME__ = {
      id: "u-1",
      name: "Admin",
      username: "admin",
      permissions: ["*"],
    };

    const { rerender } = renderProvider(0);

    expect(screen.getByTestId("session-probe")).toHaveAttribute("data-user", "admin");
    expect(screen.getByTestId("session-probe")).toHaveAttribute("data-loading", "true");
    expect(screen.getByTestId("session-probe")).toHaveAttribute("data-resolved", "false");

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("session-probe")).toHaveAttribute("data-user", "admin");
    expect(screen.getByTestId("session-probe")).toHaveAttribute("data-loading", "true");
    expect(screen.getByTestId("session-probe")).toHaveAttribute("data-resolved", "false");

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <DashboardSessionProvider>
        <div data-testid="render-tick">1</div>
        <SessionProbe />
      </DashboardSessionProvider>,
    );

    expect(screen.getByTestId("session-probe")).toHaveAttribute("data-loading", "true");

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });

    userDeferred.resolve(
      mockJsonResponse(true, {
        id: "u-1",
        name: "Admin",
        username: "admin",
        permissions: ["*"],
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("session-probe")).toHaveAttribute("data-loading", "false");
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
