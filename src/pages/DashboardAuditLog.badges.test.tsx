import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

const getStatusBadges = (label: string) =>
  screen
    .getAllByText(label)
    .filter((element) => String(element.className).includes("rounded-full"));

describe("DashboardAuditLog semantic badges", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (String(path).startsWith("/api/audit-log?") && method === "GET") {
        return mockJsonResponse(true, {
          entries: [
            {
              id: "entry-success",
              ts: "2026-02-20T10:00:00.000Z",
              actorId: "user-1",
              actorName: "Admin",
              ip: "127.0.0.1",
              action: "auth.login.success",
              resource: "auth",
              resourceId: "login-1",
              status: "success",
              requestId: "req-success",
              meta: {},
            },
            {
              id: "entry-denied",
              ts: "2026-02-20T10:05:00.000Z",
              actorId: "user-2",
              actorName: "Moderator",
              ip: "127.0.0.2",
              action: "users.update",
              resource: "user",
              resourceId: "user-2",
              status: "denied",
              requestId: "req-denied",
              meta: {},
            },
            {
              id: "entry-failed",
              ts: "2026-02-20T10:10:00.000Z",
              actorId: "user-3",
              actorName: "Operator",
              ip: "127.0.0.3",
              action: "exports.download",
              resource: "export",
              resourceId: "export-3",
              status: "failed",
              requestId: "req-failed",
              meta: {},
            },
          ],
          page: 1,
          limit: 50,
          total: 3,
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("uses semantic variants for audit statuses in the table and detail dialog", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/audit-log"]}>
        <DashboardAuditLog />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Registro de Auditoria/i });

    expect(getStatusBadges("Sucesso")[0]).toHaveClass(
      "bg-emerald-500/20",
      "text-emerald-800",
      "dark:text-emerald-200",
    );
    expect(getStatusBadges("Negado")[0]).toHaveClass(
      "bg-amber-500/20",
      "text-amber-900",
      "dark:text-amber-200",
    );
    expect(getStatusBadges("Falha")[0]).toHaveClass(
      "bg-red-500/20",
      "text-red-800",
      "dark:text-red-200",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Ver" })[0]);

    await screen.findByRole("heading", { name: "Detalhes do evento" });

    const successBadges = getStatusBadges("Sucesso");
    expect(successBadges).toHaveLength(2);
    successBadges.forEach((badge) => {
      expect(badge).toHaveClass("bg-emerald-500/20", "text-emerald-800", "dark:text-emerald-200");
    });
  });
});
