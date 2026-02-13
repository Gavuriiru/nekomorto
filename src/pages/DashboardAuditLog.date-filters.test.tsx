import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardAuditLog from "@/pages/DashboardAuditLog";

const apiFetchMock = vi.hoisted(() => vi.fn());

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

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    headers: new Headers(),
    json: async () => payload,
    blob: async () => new Blob([""], { type: "text/csv" }),
  }) as Response;

describe("DashboardAuditLog date/time filters", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();

      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (String(path).startsWith("/api/audit-log?") && method === "GET") {
        return mockJsonResponse(true, { entries: [], page: 1, limit: 50, total: 0 });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("converte filtros DateField/TimeField para dateFrom/dateTo ISO sem mudar semântica", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log"]}>
        <DashboardAuditLog />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Registro de Auditoria" });

    const dateFromInput = document.getElementById("audit-date-from") as HTMLInputElement;
    const timeFromInput = document.getElementById("audit-date-from-time") as HTMLInputElement;
    const dateToInput = document.getElementById("audit-date-to") as HTMLInputElement;
    const timeToInput = document.getElementById("audit-date-to-time") as HTMLInputElement;

    expect(timeFromInput).toBeDisabled();
    expect(timeToInput).toBeDisabled();

    fireEvent.change(dateFromInput, { target: { value: "10/02/2026" } });
    fireEvent.blur(dateFromInput);
    fireEvent.change(timeFromInput, { target: { value: "08:30" } });
    fireEvent.blur(timeFromInput);

    fireEvent.change(dateToInput, { target: { value: "11/02/2026" } });
    fireEvent.blur(dateToInput);
    fireEvent.change(timeToInput, { target: { value: "21:45" } });
    fireEvent.blur(timeToInput);

    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    const expectedDateFromIso = new Date("2026-02-10T08:30").toISOString();
    const expectedDateToIso = new Date("2026-02-11T21:45").toISOString();

    await waitFor(() => {
      const auditCalls = apiFetchMock.mock.calls.filter((call) => {
        const path = String(call[1] || "");
        const options = (call[2] || {}) as RequestInit;
        const method = String(options.method || "GET").toUpperCase();
        return method === "GET" && path.startsWith("/api/audit-log?");
      });
      expect(auditCalls.length).toBeGreaterThan(1);

      const lastPath = String(auditCalls[auditCalls.length - 1]?.[1] || "");
      const params = new URLSearchParams(lastPath.split("?")[1] || "");
      expect(params.get("dateFrom")).toBe(expectedDateFromIso);
      expect(params.get("dateTo")).toBe(expectedDateToIso);
    });
  });
});
