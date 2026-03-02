import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardSecurity from "@/pages/DashboardSecurity";

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
    json: async () => payload,
  }) as Response;
const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

describe("DashboardSecurity semantic badges", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (String(path).startsWith("/api/admin/sessions/active?") && method === "GET") {
        return mockJsonResponse(true, {
          sessions: [
            {
              sid: "current-session",
              userId: "1",
              userName: "Admin",
              userAvatarUrl: null,
              createdAt: "2026-02-20T10:00:00.000Z",
              lastSeenAt: "2026-02-20T10:05:00.000Z",
              lastIp: "127.0.0.1",
              userAgent: "Current Browser",
              isPendingMfa: false,
              currentForViewer: true,
            },
            {
              sid: "pending-session",
              userId: "2",
              userName: "Moderator",
              userAvatarUrl: null,
              createdAt: "2026-02-20T09:00:00.000Z",
              lastSeenAt: "2026-02-20T09:05:00.000Z",
              lastIp: "127.0.0.2",
              userAgent: "Pending Browser",
              isPendingMfa: true,
              currentForViewer: false,
            },
          ],
          total: 2,
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("uses semantic variants for current-session and MFA badges", async () => {
    render(<DashboardSecurity />);

    await screen.findByRole("heading", { name: /Ativas/i });
    await screen.findByText("Admin");

    const headerBadge = screen.getByTestId("dashboard-security-header-badge");
    const sessionsCard = screen.getByTestId("dashboard-security-sessions-card");
    const firstSessionCard = screen.getByText("Admin").closest("article");

    expect(headerBadge).toHaveTextContent("Segurança");
    expect(classTokens(headerBadge)).toContain("animate-fade-in");
    expect(classTokens(sessionsCard)).toContain("animate-slide-up");
    expect(classTokens(sessionsCard)).toContain("opacity-0");
    expect(firstSessionCard).not.toBeNull();
    expect(classTokens(firstSessionCard as HTMLElement)).toContain("animate-slide-up");
    expect(classTokens(firstSessionCard as HTMLElement)).toContain("opacity-0");
    expect(await screen.findByText("Sua sessão atual")).toHaveClass(
      "bg-emerald-500/20",
      "text-emerald-800",
      "dark:text-emerald-200",
    );
    expect(screen.getByText("Pendente MFA")).toHaveClass(
      "bg-amber-500/20",
      "text-amber-900",
      "dark:text-amber-200",
    );
  });

  it("shows loading placeholders before the session payload resolves", () => {
    apiFetchMock.mockImplementation(async () => new Promise<Response>(() => undefined));

    render(<DashboardSecurity />);

    expect(screen.getByTestId("dashboard-security-loading")).toBeInTheDocument();
    expect(screen.queryByText(/Total ativo:/i)).not.toBeInTheDocument();
  });
});
