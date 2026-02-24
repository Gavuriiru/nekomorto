import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardAuditLog from "@/pages/DashboardAuditLog";

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    headers: new Headers(),
    json: async () => payload,
    blob: async () => new Blob([""], { type: "text/csv" }),
  }) as Response;

const setupApiMock = (preferences: unknown) => {
  apiFetchMock.mockReset();
  toastMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
    }
    if (path === "/api/me/preferences" && method === "GET") {
      return mockJsonResponse(true, { preferences });
    }
    if (path === "/api/me/preferences" && method === "PUT") {
      const request = (options || {}) as RequestInit & { json?: unknown };
      const payload =
        (request.json as { preferences?: unknown } | undefined) ||
        JSON.parse(String(request.body || "{}"));
      return mockJsonResponse(true, { preferences: payload.preferences || {} });
    }
    if (String(path).startsWith("/api/audit-log?") && method === "GET") {
      return mockJsonResponse(true, { entries: [], page: 1, limit: 50, total: 0 });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const getLastAuditParams = () => {
  const calls = apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return method === "GET" && path.startsWith("/api/audit-log?");
  });
  const lastPath = String(calls[calls.length - 1]?.[1] || "");
  return new URLSearchParams(lastPath.split("?")[1] || "");
};

const getPreferencePutCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    const options = (call[2] || {}) as RequestInit;
    const method = String(options.method || "GET").toUpperCase();
    return path === "/api/me/preferences" && method === "PUT";
  });

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

const NavigateCleanQuery = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/dashboard/audit-log")}>
      Limpar query
    </button>
  );
};

describe("DashboardAuditLog preferences", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
  });

  it("restaura filtros salvos quando URL está limpa", async () => {
    setupApiMock({
      uiListState: {
        "dashboard.audit-log": {
          page: 2,
          filters: {
            limit: 20,
            q: "admin",
            status: "failed",
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log"]}>
        <DashboardAuditLog />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Registro de Auditoria" });
    await waitFor(() => {
      const params = getLastAuditParams();
      expect(params.get("page")).toBe("2");
      expect(params.get("limit")).toBe("20");
      expect(params.get("q")).toBe("admin");
      expect(params.get("status")).toBe("failed");
    });

    await waitFor(() => {
      const search = String(screen.getByTestId("location-search").textContent || "");
      expect(search).toContain("page=2");
      expect(search).toContain("limit=20");
      expect(search).toContain("q=admin");
      expect(search).toContain("status=failed");
    });
  });

  it("mantém query explícita da URL como fonte de verdade", async () => {
    setupApiMock({
      uiListState: {
        "dashboard.audit-log": {
          page: 9,
          filters: {
            limit: 10,
            status: "failed",
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log?page=3&limit=100&status=denied"]}>
        <DashboardAuditLog />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Registro de Auditoria" });
    await waitFor(() => {
      const params = getLastAuditParams();
      expect(params.get("page")).toBe("3");
      expect(params.get("limit")).toBe("100");
      expect(params.get("status")).toBe("denied");
    });
  });

  it("persiste estado aplicado da lista via /api/me/preferences", async () => {
    setupApiMock({ uiListState: {} });

    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log?page=2&limit=20&status=denied"]}>
        <DashboardAuditLog />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Registro de Auditoria" });
    await waitFor(
      () => {
        expect(getPreferencePutCalls().length).toBeGreaterThan(0);
      },
      { timeout: 2500 },
    );

    const putCalls = getPreferencePutCalls();
    const request = ((putCalls[putCalls.length - 1]?.[2] || {}) as RequestInit & {
      json?: { preferences?: unknown };
    });
    const payload =
      request.json ||
      JSON.parse(String(request.body || "{}"));
    expect(payload.preferences?.uiListState?.["dashboard.audit-log"]).toMatchObject({
      page: 2,
      filters: {
        limit: 20,
        status: "denied",
      },
    });
  });

  it("nao reidrata filtros e limpa preferencia salva em PUSH para URL limpa", async () => {
    setupApiMock({
      uiListState: {
        "dashboard.audit-log": {
          page: 2,
          filters: {
            limit: 20,
            q: "admin",
            status: "failed",
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log?page=3&limit=100&status=denied"]}>
        <DashboardAuditLog />
        <NavigateCleanQuery />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Registro de Auditoria" });
    fireEvent.click(screen.getByRole("button", { name: "Limpar query" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });

    await waitFor(() => {
      const params = getLastAuditParams();
      expect(params.get("page")).toBe("1");
      expect(params.get("limit")).toBe("50");
      expect(params.get("status")).toBeNull();
      expect(params.get("q")).toBeNull();
    });

    await waitFor(
      () => {
        const putCalls = getPreferencePutCalls();
        expect(putCalls.length).toBeGreaterThan(0);
        const request = ((putCalls[putCalls.length - 1]?.[2] || {}) as RequestInit & {
          json?: { preferences?: unknown };
        });
        const payload = request.json || JSON.parse(String(request.body || "{}"));
        expect(payload.preferences?.uiListState?.["dashboard.audit-log"]).toBeUndefined();
      },
      { timeout: 2500 },
    );
  });
});
