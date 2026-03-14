import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LayoutGrid } from "lucide-react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { DashboardMenuItem } from "@/components/dashboard-menu";
import DashboardCommandPalette from "@/components/dashboard/DashboardCommandPalette";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
});

type MenuFlags = {
  analytics?: boolean;
  pages?: boolean;
  posts?: boolean;
  projects?: boolean;
  settings?: boolean;
  users?: boolean;
};

const createMenuItems = (flags: MenuFlags = {}): DashboardMenuItem[] => [
  { label: "Início", href: "/dashboard", icon: LayoutGrid, enabled: true, section: "home" },
  {
    label: "Análises",
    href: "/dashboard/analytics",
    icon: LayoutGrid,
    enabled: flags.analytics ?? true,
    section: "system",
  },
  {
    label: "Postagens",
    href: "/dashboard/posts",
    icon: LayoutGrid,
    enabled: flags.posts ?? true,
    section: "content",
  },
  {
    label: "Projetos",
    href: "/dashboard/projetos",
    icon: LayoutGrid,
    enabled: flags.projects ?? true,
    section: "content",
  },
  {
    label: "Usuários",
    href: "/dashboard/usuarios",
    icon: LayoutGrid,
    enabled: flags.users ?? true,
    section: "team",
  },
  {
    label: "Páginas",
    href: "/dashboard/paginas",
    icon: LayoutGrid,
    enabled: flags.pages ?? true,
    section: "content",
  },
  {
    label: "Configurações",
    href: "/dashboard/configuracoes",
    icon: LayoutGrid,
    enabled: flags.settings ?? true,
    section: "system",
  },
];

const renderPalette = (menuItems: DashboardMenuItem[] = createMenuItems()) => {
  const onOpenChange = vi.fn();
  const onNavigate = vi.fn();
  const onOpenNotifications = vi.fn();

  render(
    <DashboardCommandPalette
      open
      menuItems={menuItems}
      onOpenChange={onOpenChange}
      onNavigate={onNavigate}
      onOpenNotifications={onOpenNotifications}
    />,
  );

  return {
    onOpenChange,
    onNavigate,
    onOpenNotifications,
  };
};

describe("DashboardCommandPalette shortcuts", () => {
  it("renderiza grupos de abas apenas quando as rotas base estao habilitadas", () => {
    const { rerender } = render(
      <DashboardCommandPalette
        open
        menuItems={createMenuItems({ settings: false, pages: false })}
        onOpenChange={vi.fn()}
        onNavigate={vi.fn()}
        onOpenNotifications={vi.fn()}
      />,
    );

    expect(screen.queryByText("Abas - Configurações")).not.toBeInTheDocument();
    expect(screen.queryByText("Abas - Páginas")).not.toBeInTheDocument();

    rerender(
      <DashboardCommandPalette
        open
        menuItems={createMenuItems()}
        onOpenChange={vi.fn()}
        onNavigate={vi.fn()}
        onOpenNotifications={vi.fn()}
      />,
    );

    expect(screen.getByText("Abas - Configurações")).toBeInTheDocument();
    expect(screen.getByText("Abas - Páginas")).toBeInTheDocument();
  });

  it("seleciona uma aba de configuracoes, fecha a palette e navega para a URL correta", () => {
    const { onOpenChange, onNavigate } = renderPalette();

    fireEvent.click(screen.getByText("Downloads"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onNavigate).toHaveBeenCalledWith("/dashboard/configuracoes?tab=downloads");
  });

  it("inclui a aba de SEO nas acoes de configuracoes", () => {
    const { onOpenChange, onNavigate } = renderPalette();

    fireEvent.click(screen.getByText("SEO"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onNavigate).toHaveBeenCalledWith("/dashboard/configuracoes?tab=seo");
  });

  it("abre notificacoes e fecha a palette sem navegar", () => {
    const { onOpenChange, onNavigate, onOpenNotifications } = renderPalette();

    fireEvent.click(screen.getByText("Abrir notificações"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("inclui aliases curtos no valor de busca e permite filtrar por eles", () => {
    renderPalette();

    const input = screen.getByRole("combobox");
    const generalItem = screen.getByText("Geral").closest("[cmdk-item]");
    const donationsItem = screen.getByText("Doações").closest("[cmdk-item]");
    const newPostItem = screen.getByText("Novo post").closest("[cmdk-item]");
    const seoItem = screen.getByText("SEO").closest("[cmdk-item]");

    expect(generalItem?.getAttribute("data-value")?.split(" ")).toContain("sg");
    expect(donationsItem?.getAttribute("data-value")?.split(" ")).toContain("pd");
    expect(newPostItem?.getAttribute("data-value")?.split(" ")).toContain("np");
    expect(seoItem?.getAttribute("data-value")?.split(" ")).toContain("ss");

    fireEvent.change(input, { target: { value: "sg" } });

    expect(generalItem).not.toHaveAttribute("hidden");
  });

  it("oculta acoes de usuario quando a rota de usuarios nao esta habilitada", () => {
    renderPalette(createMenuItems({ users: false }));

    expect(screen.queryByText("Novo usuário")).not.toBeInTheDocument();
    expect(screen.queryByText("Editar meu perfil")).not.toBeInTheDocument();
  });

  it("mantem a navegacao padrao a partir de menuItems", () => {
    const { onOpenChange, onNavigate } = renderPalette();

    fireEvent.click(screen.getByText("Análises"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onNavigate).toHaveBeenCalledWith("/dashboard/analytics");
  });
});
