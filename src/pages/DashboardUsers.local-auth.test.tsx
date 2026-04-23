import DashboardUsers from "@/pages/DashboardUsers";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const originalLocation = window.location;
let locationHref = "http://localhost/dashboard/usuarios?edit=me";

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({ settings: { teamRoles: [] } }),
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
  ({ ok, status, json: async () => payload }) as Response;

const installLocationMock = () => {
  locationHref = "http://localhost/dashboard/usuarios?edit=me";
  const locationMock = {
    get href() {
      return locationHref;
    },
    set href(value: string) {
      locationHref = value;
    },
  } as unknown as Location;

  Object.defineProperty(window, "location", {
    configurable: true,
    value: locationMock,
  });
};

const setupApiMock = () => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, {
        users: [
          {
            id: "user-1",
            name: "Admin",
            phrase: "",
            bio: "",
            avatarUrl: null,
            socials: [],
            status: "active",
            permissions: ["usuarios_basico", "usuarios_acesso"],
            roles: [],
            accessRole: "admin",
            order: 0,
          },
        ],
        ownerIds: [],
        primaryOwnerId: null,
      });
    }
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, {
        id: "user-1",
        name: "Admin",
        username: "admin",
        accessRole: "admin",
        grants: {
          usuarios_basico: true,
          usuarios_acesso: true,
        },
        ownerIds: [],
        primaryOwnerId: null,
      });
    }
    if (path === "/api/me/security" && method === "GET") {
      return mockJsonResponse(true, {
        totpEnabled: false,
        recoveryCodesRemaining: 0,
        activeSessionsCount: 1,
        oauthEmailSuggested: "user@example.com",
        identities: [
          {
            provider: "discord",
            linked: true,
            emailNormalized: "user@example.com",
            emailVerified: true,
            linkedAt: "2026-04-12T21:44:00.000Z",
            lastUsedAt: "2026-04-12T21:45:09.000Z",
          },
        ],
      });
    }
    if (path === "/api/me/sessions" && method === "GET") {
      return mockJsonResponse(true, {
        sessions: [
          {
            sid: "session-current",
            createdAt: "2026-04-12T21:44:00.000Z",
            lastSeenAt: "2026-04-12T21:45:09.000Z",
            lastIp: "203.0.113.42",
            userAgent: "Mozilla/5.0",
            current: true,
          },
        ],
      });
    }
    if (path === "/api/link-types" && method === "GET") {
      return mockJsonResponse(true, { items: [] });
    }

    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("DashboardUsers connected accounts", () => {
  it("renderiza contas conectadas sem UI de login com senha", async () => {
    installLocationMock();
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    await screen.findByText(/editar usu.rio/i);

    expect(screen.getByText(/contas conectadas/i)).toBeInTheDocument();
    expect(screen.getByText(/^Discord$/)).toBeInTheDocument();
    expect(screen.getByText(/^Google$/)).toBeInTheDocument();
    expect(screen.getByText(/não conectada/i)).toBeInTheDocument();
    expect(screen.queryByText(/configurar login com senha/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/voce@exemplo.com/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Username \(opcional\)/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/nova senha/i)).not.toBeInTheDocument();
  });

  it("inicia o fluxo manual de conexão de provider", async () => {
    installLocationMock();
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    await screen.findByText(/contas conectadas/i);
    fireEvent.click(screen.getByRole("button", { name: "Conectar" }));

    expect(locationHref).toBe(
      "http://api.local/api/me/security/identities/google/link/start?next=%2Fdashboard%2Fusuarios%3Fedit%3Dme",
    );
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
});
