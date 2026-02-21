import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

describe("DashboardAuditLog date/time filters", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
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

  it("converte filtros DateField/TimeField para dateFrom/dateTo ISO sem mudar semantica", async () => {
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

  it("exibe toast de sucesso em exportacao CSV sem truncamento", async () => {
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/fake") as typeof window.URL.createObjectURL;
    window.URL.revokeObjectURL = vi.fn() as typeof window.URL.revokeObjectURL;
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      apiFetchMock.mockImplementation(async (_base, path, options) => {
        const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
        if (path === "/api/me" && method === "GET") {
          return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
        }
        if (String(path).startsWith("/api/audit-log?") && method === "GET") {
          const query = String(path).split("?")[1] || "";
          const params = new URLSearchParams(query);
          if (params.get("format") === "csv") {
            return ({
              ok: true,
              status: 200,
              headers: new Headers(),
              blob: async () => new Blob(["event"], { type: "text/csv" }),
            }) as Response;
          }
          return mockJsonResponse(true, { entries: [], page: 1, limit: 50, total: 0 });
        }
        return mockJsonResponse(false, { error: "not_found" }, 404);
      });

      render(
        <MemoryRouter initialEntries={["/dashboard/audit-log"]}>
          <DashboardAuditLog />
        </MemoryRouter>,
      );

      await screen.findByRole("heading", { name: "Registro de Auditoria" });
      fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "CSV exportado",
          }),
        );
      });
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    } finally {
      window.URL.createObjectURL = originalCreateObjectURL;
      window.URL.revokeObjectURL = originalRevokeObjectURL;
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      anchorClickSpy.mockRestore();
    }
  });

  it("exibe toast de truncamento quando exportacao CSV vem limitada", async () => {
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/fake") as typeof window.URL.createObjectURL;
    window.URL.revokeObjectURL = vi.fn() as typeof window.URL.revokeObjectURL;
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      apiFetchMock.mockImplementation(async (_base, path, options) => {
        const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
        if (path === "/api/me" && method === "GET") {
          return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
        }
        if (String(path).startsWith("/api/audit-log?") && method === "GET") {
          const query = String(path).split("?")[1] || "";
          const params = new URLSearchParams(query);
          if (params.get("format") === "csv") {
            const headers = new Headers({
              "X-Audit-Export-Truncated": "1",
              "X-Audit-Export-Count": "10000",
              "X-Audit-Export-Total": "15234",
            });
            return ({
              ok: true,
              status: 200,
              headers,
              blob: async () => new Blob(["event"], { type: "text/csv" }),
            }) as Response;
          }
          return mockJsonResponse(true, { entries: [], page: 1, limit: 50, total: 0 });
        }
        return mockJsonResponse(false, { error: "not_found" }, 404);
      });

      render(
        <MemoryRouter initialEntries={["/dashboard/audit-log"]}>
          <DashboardAuditLog />
        </MemoryRouter>,
      );

      await screen.findByRole("heading", { name: "Registro de Auditoria" });
      fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "CSV exportado com limite",
          }),
        );
      });
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    } finally {
      window.URL.createObjectURL = originalCreateObjectURL;
      window.URL.revokeObjectURL = originalRevokeObjectURL;
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      anchorClickSpy.mockRestore();
    }
  });
});
