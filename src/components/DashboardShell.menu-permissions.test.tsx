import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/DashboardHeader", () => ({
  default: ({ menuItems }: { menuItems?: Array<{ label: string }> }) => (
    <div data-testid="dashboard-header">{(menuItems || []).map((item) => item.label).join("|")}</div>
  ),
}));

vi.mock("@/components/Footer", () => ({
  default: () => <div data-testid="footer" />,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Sidebar: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
  SidebarHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarInset: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: { children: ReactNode; asChild?: boolean }) => <div>{children}</div>,
  SidebarSeparator: () => <hr />,
}));

const buildGrants = () => ({
  posts: false,
  projetos: false,
  comentarios: false,
  paginas: false,
  uploads: false,
  analytics: false,
  usuarios_basico: false,
  usuarios_acesso: false,
  configuracoes: false,
  audit_log: false,
  integracoes: false,
});

describe("DashboardShell menu permissions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_RBAC_V2_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders only allowed dashboard entries from grants", async () => {
    const grants = buildGrants();
    grants.posts = true;
    grants.analytics = true;
    const { default: DashboardShell } = await import("@/components/DashboardShell");

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardShell
          currentUser={{
            id: "user-1",
            name: "User 1",
            username: "user1",
            grants,
          }}
        >
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("Início")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Postagens")).toBeInTheDocument();
    expect(screen.queryByText("Usuários")).not.toBeInTheDocument();
    expect(screen.queryByText("Configurações")).not.toBeInTheDocument();
  });
});
