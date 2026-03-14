import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPages, { __testing } from "@/pages/DashboardPages";

const apiFetchMock = vi.hoisted(() => vi.fn());
const qrCodeToDataUrlMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue("data:image/png;base64,mock-qr"),
);

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-dashboard-refresh-toast", () => ({
  useDashboardRefreshToast: () => undefined,
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: (...args: unknown[]) => qrCodeToDataUrlMock(...args),
  },
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const deferredResponse = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

describe("DashboardPages loading state", () => {
  beforeEach(() => {
    __testing.clearDashboardPagesCache();
    apiFetchMock.mockReset();
  });

  it("renderiza shell e tabs antes de /api/pages responder", async () => {
    const pagesDeferred = deferredResponse();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/pages" && method === "GET") {
        return pagesDeferred.promise;
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/paginas"]}>
        <DashboardPages />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Gerenciar páginas/i });
    expect(screen.getByRole("tab", { name: "FAQ" })).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-pages-skeleton-surface")).toBeInTheDocument();
    expect(screen.queryByText(/Carregando páginas/i)).not.toBeInTheDocument();

    pagesDeferred.resolve(
      mockJsonResponse(true, {
        pages: {
          home: { shareImage: "" },
          projects: { shareImage: "" },
          about: { shareImage: "" },
          donations: { shareImage: "" },
          faq: { shareImage: "" },
          team: { shareImage: "" },
          recruitment: { shareImage: "" },
        },
      }),
    );

    await screen.findByText("Custos");
  });
});
