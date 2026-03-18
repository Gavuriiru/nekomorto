import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardSecurity, { __testing } from "@/pages/DashboardSecurity";

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const dismissToastMock = vi.hoisted(() => vi.fn());

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
  dismissToast: (...args: unknown[]) => dismissToastMock(...args),
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
const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

describe("DashboardSecurity semantic badges", () => {
  beforeEach(() => {
    __testing.clearSecurityCache();
    apiFetchMock.mockReset();
    toastMock.mockReset();
    toastMock.mockReturnValue("dashboard-security-refresh-toast");
    dismissToastMock.mockReset();
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
    const headerBadgeReveal = headerBadge.parentElement;
    const sessionsCard = screen.getByTestId("dashboard-security-sessions-card");
    const firstSessionCard = screen.getByText("Admin").closest("article");

    expect(headerBadge).toHaveTextContent("Seguran\u00E7a");
    expect(headerBadgeReveal).not.toBeNull();
    expect(classTokens(headerBadgeReveal as HTMLElement)).toContain("reveal");
    expect(classTokens(headerBadgeReveal as HTMLElement)).toContain("reveal-delay-1");
    expect(headerBadgeReveal).toHaveAttribute("data-reveal");
    expect(classTokens(sessionsCard)).toContain("animate-slide-up");
    expect(classTokens(sessionsCard)).toContain("opacity-0");
    expect(classTokens(sessionsCard)).toContain("bg-card");
    expect(firstSessionCard).not.toBeNull();
    expect(classTokens(firstSessionCard as HTMLElement)).toContain("animate-slide-up");
    expect(classTokens(firstSessionCard as HTMLElement)).toContain("opacity-0");
    expect(classTokens(firstSessionCard as HTMLElement)).toContain("bg-background");
    expect(await screen.findByText("Sua sess\u00E3o atual")).toHaveClass(
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

  it("keeps the mobile revoke CTA on the identity row with an icon-first responsive button", async () => {
    render(<DashboardSecurity />);

    const revokeButton = await screen.findByRole("button", {
      name: "Encerrar sessao de Moderator",
    });
    const sessionCard = screen.getByText("Moderator").closest("article");
    const headerRow = revokeButton.parentElement as HTMLElement | null;
    const identityText = screen.getByText("Moderator").parentElement as HTMLElement | null;
    const identityRow = identityText?.parentElement as HTMLElement | null;
    const badgesRow = screen.getByText("Pendente MFA").parentElement as HTMLElement | null;
    const userId = screen.getByText("ID: 2");
    const desktopLabel = within(revokeButton).getByText("Encerrar");
    const revokeIcon = revokeButton.querySelector("svg");

    expect(sessionCard).not.toBeNull();
    expect(headerRow).not.toBeNull();
    expect(identityText).not.toBeNull();
    expect(identityRow).not.toBeNull();
    expect(badgesRow).not.toBeNull();
    expect(revokeIcon).not.toBeNull();

    expect(classTokens(headerRow as HTMLElement)).toContain("flex");
    expect(classTokens(headerRow as HTMLElement)).toContain("flex-wrap");
    expect(classTokens(headerRow as HTMLElement)).toContain("items-start");
    expect(classTokens(headerRow as HTMLElement)).toContain("gap-3");
    expect(classTokens(headerRow as HTMLElement)).toContain("md:flex-nowrap");

    expect(classTokens(identityRow as HTMLElement)).toContain("flex");
    expect(classTokens(identityRow as HTMLElement)).toContain("min-w-0");
    expect(classTokens(identityRow as HTMLElement)).toContain("flex-1");
    expect(classTokens(identityText as HTMLElement)).toContain("min-w-0");
    expect(classTokens(userId as HTMLElement)).toContain("break-all");

    expect(classTokens(revokeButton)).toContain("order-2");
    expect(classTokens(revokeButton)).toContain("h-9");
    expect(classTokens(revokeButton)).toContain("w-9");
    expect(classTokens(revokeButton)).toContain("px-0");
    expect(classTokens(revokeButton)).toContain("md:order-3");
    expect(classTokens(revokeButton)).toContain("md:w-auto");
    expect(classTokens(revokeButton)).toContain("md:px-3");
    expect(classTokens(revokeIcon as HTMLElement)).not.toContain("md:hidden");

    expect(classTokens(badgesRow as HTMLElement)).toContain("order-3");
    expect(classTokens(badgesRow as HTMLElement)).toContain("basis-full");
    expect(classTokens(badgesRow as HTMLElement)).toContain("md:order-2");

    expect(classTokens(desktopLabel as HTMLElement)).toContain("hidden");
    expect(classTokens(desktopLabel as HTMLElement)).toContain("md:inline");
  });

  it("mantem a lista visivel durante a paginacao enquanto a proxima pagina carrega", async () => {
    const pageTwoDeferred = createDeferredResponse();

    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (String(path).startsWith("/api/admin/sessions/active?page=1") && method === "GET") {
        return mockJsonResponse(true, {
          sessions: [
            {
              sid: "page-1-session",
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
          ],
          total: 150,
        });
      }
      if (String(path).startsWith("/api/admin/sessions/active?page=2") && method === "GET") {
        return pageTwoDeferred.promise;
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(<DashboardSecurity />);

    expect(await screen.findByText("Admin")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /pr.*xima p.*gina/i }));

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-security-loading")).not.toBeInTheDocument();
    expect(screen.queryByText(/Atualizando sessoes/i)).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Atualizando sessoes",
        intent: "info",
      }),
    );

    pageTwoDeferred.resolve(
      mockJsonResponse(true, {
        sessions: [
          {
            sid: "page-2-session",
            userId: "2",
            userName: "Moderator",
            userAvatarUrl: null,
            createdAt: "2026-02-20T09:00:00.000Z",
            lastSeenAt: "2026-02-20T09:05:00.000Z",
            lastIp: "127.0.0.2",
            userAgent: "Pending Browser",
            isPendingMfa: false,
            currentForViewer: false,
          },
        ],
        total: 150,
      }),
    );

    expect(await screen.findByText("Moderator")).toBeInTheDocument();
    expect(dismissToastMock).toHaveBeenCalledWith("dashboard-security-refresh-toast");
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows loading placeholders before the session payload resolves", () => {
    apiFetchMock.mockImplementation(async () => new Promise<Response>(() => undefined));

    render(<DashboardSecurity />);

    expect(screen.getByTestId("dashboard-security-loading")).toBeInTheDocument();
    expect(screen.queryByText(/Total ativo:/i)).not.toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
  });
});
