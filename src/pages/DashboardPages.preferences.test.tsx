import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPages from "@/pages/DashboardPages";

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
    json: async () => payload,
  }) as Response;

const setupApiMock = () => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
    }
    if (path === "/api/pages" && method === "GET") {
      return mockJsonResponse(true, {
        pages: {
          home: { shareImage: "" },
          projects: { shareImage: "" },
          about: { shareImage: "" },
          donations: { shareImage: "" },
          faq: { shareImage: "" },
          team: { shareImage: "" },
          recruitment: { shareImage: "" },
        },
      });
    }
    if (path === "/api/pages" && method === "PUT") {
      const request = (options || {}) as RequestInit & { json?: unknown };
      const payload =
        (request.json as { pages?: unknown } | undefined) ||
        JSON.parse(String(request.body || "{}"));
      return mockJsonResponse(true, { pages: payload.pages || {} });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
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

describe("DashboardPages query sync", () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiFetchMock.mockReset();
  });

  it("aplica aba vinda de ?tab=", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas?tab=faq"]}>
        <DashboardPages />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "FAQ" })).toHaveAttribute("aria-selected", "true");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("atualiza tab na URL ao trocar de aba", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas"]}>
        <DashboardPages />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "FAQ" }));

    await waitFor(() => {
      const search = String(screen.getByTestId("location-search").textContent || "");
      expect(search).toContain("tab=faq");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("remove tab da URL quando volta para aba default", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas?tab=faq"]}>
        <DashboardPages />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Doa/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });

  it("tab invalida cai para default e limpa URL", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas?tab=invalida"]}>
        <DashboardPages />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar/i });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /^Doa/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(getPreferenceCalls()).toHaveLength(0);
  });
});
