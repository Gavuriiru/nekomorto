import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardNotificationsPopover from "@/components/dashboard/DashboardNotificationsPopover";

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

describe("DashboardNotificationsPopover loading state", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("mostra placeholders enquanto a primeira carga de notificacoes esta pendente", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path === "/api/dashboard/notifications?limit=30") {
        return new Promise<Response>(() => undefined);
      }
      if (path === "/api/me/preferences") {
        return mockJsonResponse(true, { preferences: {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter>
        <DashboardNotificationsPopover
          apiBase="http://api.local"
          open
          onOpenChange={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("dashboard-notifications-loading")).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma pendencia operacional/i)).not.toBeInTheDocument();
  });
});
