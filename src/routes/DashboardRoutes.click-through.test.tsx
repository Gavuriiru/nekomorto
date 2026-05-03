import DashboardShell, { DashboardShellRoot } from "@/components/DashboardShell";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const useDashboardSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-dashboard-session", () => ({
  useDashboardSession: () => useDashboardSessionMock(),
}));

vi.mock("@/components/DashboardHeader", () => ({
  default: () => null,
}));

vi.mock("@/components/Footer", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) =>
    src ? <img src={src} alt={alt || ""} /> : null,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Sidebar: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
  SidebarHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  SidebarGroupContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: { children: ReactNode; asChild?: boolean }) => (
    <div>{children}</div>
  ),
  SidebarSeparator: () => <hr />,
  useSidebarState: () => ({ open: true }),
}));

vi.mock("@/components/dashboard-menu", () => ({
  dashboardMenuItems: [
    { href: "/dashboard", label: "Visão geral", icon: () => null, enabled: true },
    { href: "/dashboard/usuarios", label: "Usuários", icon: () => null, enabled: true },
  ],
  groupDashboardMenuItems: (items: Array<{ href: string; label: string; icon: () => null }>) => [
    { id: "geral", label: "Geral", items },
  ],
  isDashboardMenuItemActive: () => false,
}));

vi.mock("@/lib/access-control", () => ({
  buildDashboardMenuFromGrants: (items: unknown[]) => items,
  getFirstAllowedDashboardRoute: () => "/dashboard",
  resolveAccessRole: (user: { accessRole?: string } | null) => user?.accessRole ?? "member",
  resolveGrants: () => ({ usuarios: true }),
}));

vi.mock("@/lib/avatar-render-url", () => ({
  buildAvatarRenderUrl: (avatarUrl?: string | null) => avatarUrl ?? undefined,
}));

vi.mock("@/lib/public-bootstrap-global", () => ({
  readWindowPublicBootstrapCurrentUser: () => null,
}));

const MockDashboardPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <DashboardShell
      currentUser={{
        id: "user-1",
        name: "Admin",
        username: "admin",
        accessRole: "admin",
        grants: {},
      }}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <div data-testid="dashboard-page">{location.pathname}</div>
    </DashboardShell>
  );
};

const MockDashboardUsersPage = () => {
  const location = useLocation();
  return <div data-testid="dashboard-users-page">{location.search}</div>;
};

describe("DashboardRoutes shell click-through", () => {
  it("propaga o clique do card da sidebar visível para o fluxo ?edit=me", async () => {
    useDashboardSessionMock.mockReturnValue({ currentUser: null });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <DashboardShellRoot>
            <Routes>
              <Route path="/dashboard" element={<MockDashboardPage />} />
              <Route path="/dashboard/usuarios" element={<MockDashboardUsersPage />} />
            </Routes>
          </DashboardShellRoot>
        </MemoryRouter>,
      );
    });

    fireEvent.click(await screen.findByRole("button", { name: "Abrir perfil de Admin" }));

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-users-page").textContent).toBe("?edit=me");
    });
  });
});
