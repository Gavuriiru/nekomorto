import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardUsers from "@/pages/DashboardUsers";

const { apiFetchMock, toastMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: ({ open }: { open?: boolean }) =>
    open ? <div data-testid="image-library-dialog" /> : null,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      teamRoles: [],
    },
  }),
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

const buildUser = ({
  id,
  name,
  accessRole = "normal",
  order,
}: {
  id: string;
  name: string;
  accessRole?: "normal" | "admin";
  order: number;
}) => ({
  id,
  name,
  phrase: "",
  bio: "",
  avatarUrl: null,
  socials: [],
  status: "active" as const,
  permissions: [],
  roles: [],
  accessRole,
  order,
});

const configureApiFetch = ({
  currentUser,
  users,
  ownerIds,
  resetResponse = mockJsonResponse(true, { ok: true }),
}: {
  currentUser: Record<string, unknown>;
  users: Array<ReturnType<typeof buildUser>>;
  ownerIds: string[];
  resetResponse?: Response;
}) => {
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, {
        users,
        ownerIds,
        primaryOwnerId: currentUser.primaryOwnerId ?? null,
      });
    }
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, currentUser);
    }
    if (path === "/api/link-types" && method === "GET") {
      return mockJsonResponse(true, { items: [] });
    }
    if (path.endsWith("/security/totp/reset") && method === "POST") {
      return resetResponse;
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("DashboardUsers admin V2F reset", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
  });

  it("shows the reset action for owners editing another user even without usuarios", async () => {
    configureApiFetch({
      currentUser: {
        id: "owner-2",
        name: "Dona Secundaria",
        username: "owner2",
        primaryOwnerId: "owner-1",
        grants: {
          usuarios: true,
        },
      },
      users: [
        buildUser({ id: "owner-1", name: "Dono Primario", order: 0 }),
        buildUser({ id: "owner-2", name: "Dona Secundaria", order: 1 }),
        buildUser({ id: "user-3", name: "Colaborador", order: 2 }),
      ],
      ownerIds: ["owner-1", "owner-2"],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Abrir usu.*rio Colaborador/i }));

    const editorDialog = await screen.findByRole("dialog", { name: /Editar usu.*rio/i });
    fireEvent.click(within(editorDialog).getByRole("button", { name: "Redefinir V2F" }));

    await screen.findByText(/cancelar o login atual e entrar novamente/i);
    const resetButtons = screen.getAllByRole("button", { name: "Redefinir V2F" });
    fireEvent.click(resetButtons[resetButtons.length - 1]);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "http://api.local",
        "/api/admin/users/user-3/security/totp/reset",
        expect.objectContaining({
          method: "POST",
          auth: true,
        }),
      );
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "V2F redefinida",
        }),
      );
    });

    expect(
      screen.queryByText(/cancelar o login atual e entrar novamente/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Editar usu.*rio/i })).toBeInTheDocument();
  });

  it("does not show the reset action for admins who are not owners", async () => {
    configureApiFetch({
      currentUser: {
        id: "admin-1",
        name: "Admin",
        username: "admin",
        accessRole: "admin",
        grants: {
          usuarios: true,
        },
      },
      users: [
        buildUser({ id: "admin-1", name: "Admin", accessRole: "admin", order: 0 }),
        buildUser({ id: "user-2", name: "Colaborador", order: 1 }),
      ],
      ownerIds: [],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Abrir usu.*rio Colaborador/i }));

    const editorDialog = await screen.findByRole("dialog", { name: /Editar usu.*rio/i });
    expect(within(editorDialog).queryByRole("button", { name: "Redefinir V2F" })).toBeNull();
  });

  it("does not show the reset action when editing the current user", async () => {
    configureApiFetch({
      currentUser: {
        id: "owner-1",
        name: "Dona",
        username: "owner1",
        primaryOwnerId: "owner-1",
        grants: {
          usuarios: true,
        },
      },
      users: [buildUser({ id: "owner-1", name: "Dona", order: 0 })],
      ownerIds: ["owner-1"],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Abrir usu.*rio Dona/i }));

    const editorDialog = await screen.findByRole("dialog", { name: /Editar usu.*rio/i });
    expect(within(editorDialog).queryByRole("button", { name: "Redefinir V2F" })).toBeNull();
  });

  it("keeps the confirmation dialog open and shows an error toast when reset fails", async () => {
    configureApiFetch({
      currentUser: {
        id: "owner-2",
        name: "Dona Secundaria",
        username: "owner2",
        primaryOwnerId: "owner-1",
        grants: {
          usuarios: true,
        },
      },
      users: [
        buildUser({ id: "owner-1", name: "Dono Primario", order: 0 }),
        buildUser({ id: "owner-2", name: "Dona Secundaria", order: 1 }),
        buildUser({ id: "user-3", name: "Colaborador", order: 2 }),
      ],
      ownerIds: ["owner-1", "owner-2"],
      resetResponse: mockJsonResponse(false, { error: "forbidden" }, 403),
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Abrir usu.*rio Colaborador/i }));

    const editorDialog = await screen.findByRole("dialog", { name: /Editar usu.*rio/i });
    fireEvent.click(within(editorDialog).getByRole("button", { name: "Redefinir V2F" }));

    await screen.findByText(/cancelar o login atual e entrar novamente/i);
    const resetButtons = screen.getAllByRole("button", { name: "Redefinir V2F" });
    fireEvent.click(resetButtons[resetButtons.length - 1]);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/redefinir a V2F/i),
          variant: "destructive",
        }),
      );
    });

    expect(screen.getByText(/cancelar o login atual e entrar novamente/i)).toBeInTheDocument();
  });
});
