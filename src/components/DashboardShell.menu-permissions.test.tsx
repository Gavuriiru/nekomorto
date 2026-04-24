import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DASHBOARD_SCROLLBAR_GUTTER_CLASS = "dashboard-scrollbar-gutter-stable";

vi.mock("@/components/DashboardHeader", () => ({
  default: ({ menuItems }: { menuItems?: Array<{ label: string }> }) => (
    <div data-testid="dashboard-header">
      {(menuItems || []).map((item) => item.label).join("|")}
    </div>
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
  SidebarGroup: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  SidebarGroupContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarInset: ({
    children,
    className,
    ...props
  }: {
    children: ReactNode;
    className?: string;
  } & Record<string, unknown>) => (
    <main data-testid="sidebar-inset" className={className} {...props}>
      {children}
    </main>
  ),
  SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: { children: ReactNode; asChild?: boolean }) => (
    <div>{children}</div>
  ),
  SidebarSeparator: () => <hr />,
  useSidebarState: () => ({ open: true }),
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
    document.documentElement.classList.remove(DASHBOARD_SCROLLBAR_GUTTER_CLASS);
    document.body.classList.remove(DASHBOARD_SCROLLBAR_GUTTER_CLASS);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    document.documentElement.classList.remove(DASHBOARD_SCROLLBAR_GUTTER_CLASS);
    document.body.classList.remove(DASHBOARD_SCROLLBAR_GUTTER_CLASS);
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

    const headerText = screen.getByTestId("dashboard-header").textContent || "";
    expect(headerText).toContain("Início");
    expect(headerText).toContain("Análises");
    expect(headerText).toContain("Postagens");
    expect(screen.queryByRole("link", { name: "Pular para a navegação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pular para o conteúdo" })).not.toBeInTheDocument();
    expect(screen.getByTestId("sidebar-inset").className).toContain("a11y-focus-target");
    expect(screen.getByTestId("sidebar-inset").className).toContain("min-w-0");
    expect(screen.getByTestId("sidebar-inset").className).toContain("overflow-x-hidden");
    expect(screen.getByTestId("sidebar-inset").className).toContain("bg-gradient-surface");
    expect(screen.getByTestId("footer")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-inset")).toHaveAttribute("data-dashboard-motion", "true");
    expect(screen.queryByText("Painel de gestao")).not.toBeInTheDocument();
    expect(screen.queryByText(/Usu[áa]rios/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Integrações")).not.toBeInTheDocument();
    expect(screen.queryByText(/Configura[çc][õo]es/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Redirecionamentos")).not.toBeInTheDocument();
  });

  it("exibe Configurações quando grant de configuracoes esta habilitado", async () => {
    const grants = buildGrants();
    grants.configuracoes = true;
    const { default: DashboardShell } = await import("@/components/DashboardShell");

    render(
      <MemoryRouter initialEntries={["/dashboard/redirecionamentos"]}>
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

    const headerText = screen.getByTestId("dashboard-header").textContent || "";
    expect(headerText).toContain("Configurações");
    expect(headerText).not.toContain("Redirecionamentos");
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("respeita grants explicitos na navegação mesmo com RBAC V2 desligado", async () => {
    vi.stubEnv("VITE_RBAC_V2_ENABLED", "false");
    const grants = buildGrants();
    grants.posts = true;
    grants.configuracoes = true;
    const { default: DashboardShell } = await import("@/components/DashboardShell");

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardShell
          currentUser={{
            id: "user-1",
            name: "User 1",
            username: "user1",
            grants,
            permissions: [],
          }}
        >
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    const headerText = screen.getByTestId("dashboard-header").textContent || "";
    expect(headerText).toContain("Início");
    expect(headerText).toContain("Postagens");
    expect(headerText).toContain("Configurações");
    expect(headerText).not.toContain("Usuários");
    expect(headerText).not.toContain("Integrações");
  });

  it("keeps previous user while loading and clears cache when loading finishes", async () => {
    const grants = buildGrants();
    grants.posts = true;
    const { default: DashboardShell } = await import("@/components/DashboardShell");

    const { rerender } = render(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardShell
          currentUser={{
            id: "user-2",
            name: "Maria Persist",
            username: "maria",
            grants,
          }}
        >
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("Maria Persist")).toBeInTheDocument();
    expect(screen.getByText("membro")).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardShell currentUser={null} isLoadingUser>
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("Maria Persist")).toBeInTheDocument();
    expect(screen.getByText("Aguarde")).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardShell currentUser={null} isLoadingUser={false}>
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Maria Persist")).not.toBeInTheDocument();
    expect(screen.getByText("Usuário")).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardShell currentUser={null} isLoadingUser>
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("Carregando usuário...")).toBeInTheDocument();
    expect(screen.getByText("Aguarde")).toBeInTheDocument();
  });

  it("adds and removes the dashboard scrollbar gutter class with the shell lifecycle", async () => {
    const grants = buildGrants();
    grants.posts = true;
    const { default: DashboardShell } = await import("@/components/DashboardShell");

    const { unmount } = render(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
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

    expect(document.documentElement).toHaveClass(DASHBOARD_SCROLLBAR_GUTTER_CLASS);
    expect(document.body).toHaveClass(DASHBOARD_SCROLLBAR_GUTTER_CLASS);

    unmount();

    expect(document.documentElement).not.toHaveClass(DASHBOARD_SCROLLBAR_GUTTER_CLASS);
    expect(document.body).not.toHaveClass(DASHBOARD_SCROLLBAR_GUTTER_CLASS);
  });
});
