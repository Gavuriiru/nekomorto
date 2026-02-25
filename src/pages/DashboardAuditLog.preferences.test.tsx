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

const setupApiMock = () => {
  apiFetchMock.mockReset();
  toastMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
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

const getPreferenceCalls = () =>
  apiFetchMock.mock.calls.filter((call) => {
    const path = String(call[1] || "");
    return path === "/api/me/preferences";
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

describe("DashboardAuditLog query sync", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
  });

  it("usa defaults quando URL inicial esta limpa", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log"]}>
        <DashboardAuditLog />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Registro de Auditoria" });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    await waitFor(() => {
      const params = getLastAuditParams();
      expect(params.get("page")).toBe("1");
      expect(params.get("limit")).toBe("50");
      expect(params.get("status")).toBeNull();
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("mantem query explicita da URL como fonte de verdade", async () => {
    setupApiMock();

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
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("limpa query e volta para defaults", async () => {
    setupApiMock();

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
    expect(getPreferenceCalls()).toHaveLength(0);
  });
});
