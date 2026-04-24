import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardShell from "@/components/DashboardShell";

let sidebarOpen = true;

beforeEach(() => {
  sidebarOpen = true;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  sidebarOpen = true;
});

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
  SidebarHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="sidebar-header" className={className}>
      {children}
    </div>
  ),
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
  useSidebarState: () => ({ open: sidebarOpen }),
}));

describe("DashboardShell avatar render", () => {
  it("mantem o avatar centralizado e totalmente contido no card quando colapsado", () => {
    sidebarOpen = false;

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardShell
          currentUser={{
            id: "user-1",
            name: "Admin",
            username: "admin",
            avatarUrl: "/uploads/users/avatar-user-1.png",
            revision: "rev-42",
            grants: {},
          }}
        >
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    const sidebarHeader = screen.getByTestId("sidebar-header");
    const avatarImage = screen.getByAltText("Admin");
    const avatar = avatarImage.parentElement as HTMLElement;
    const profileCard = avatar.parentElement as HTMLElement;
    const textWrap = avatar.nextElementSibling as HTMLElement;

    expect(sidebarHeader.className).toContain("group-data-[collapsible=icon]:items-start");
    expect(sidebarHeader.className).not.toContain("group-data-[collapsible=icon]:items-center");
    expect(profileCard.dataset.state).toBe("collapsed");
    expect(profileCard.dataset.collapsible).toBe("icon");
    expect(profileCard.className).toContain("h-10");
    expect(profileCard.className).toContain("w-10");
    expect(profileCard.className).toContain("self-start");
    expect(profileCard.className).not.toContain("self-center");
    expect(profileCard.className).toContain("justify-center");
    expect(profileCard.className).toContain("gap-0");
    expect(profileCard.className).toContain("p-0");
    expect(profileCard.className).toContain("overflow-hidden");
    expect(avatar.className).toContain("h-7");
    expect(avatar.className).toContain("w-7");
    expect(avatar.className).toContain("min-h-7");
    expect(avatar.className).toContain("min-w-7");
    expect(textWrap.className).toContain("max-w-0");
    expect(textWrap.className).toContain("flex-none");
    expect(screen.getAllByAltText("Admin")).toHaveLength(1);
  });

  it("ja aplica a geometria final do avatar no inicio do colapso", () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardShell
          currentUser={{
            id: "user-1",
            name: "Admin",
            username: "admin",
            avatarUrl: "/uploads/users/avatar-user-1.png",
            revision: "rev-42",
            grants: {},
          }}
        >
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    sidebarOpen = false;

    act(() => {
      rerender(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <DashboardShell
            currentUser={{
              id: "user-1",
              name: "Admin",
              username: "admin",
              avatarUrl: "/uploads/users/avatar-user-1.png",
              revision: "rev-42",
              grants: {},
            }}
          >
            <div>Conteudo</div>
          </DashboardShell>
        </MemoryRouter>,
      );
    });

    const avatarImage = screen.getByAltText("Admin");
    const avatar = avatarImage.parentElement as HTMLElement;
    const profileCard = avatar.parentElement as HTMLElement;
    const textWrap = avatar.nextElementSibling as HTMLElement;
    const textContainer = screen.getByText("Admin").parentElement as HTMLElement;

    expect(profileCard.dataset.state).toBe("collapsed");
    expect(profileCard.dataset.collapsible).toBe("icon");
    expect(profileCard.className).toContain("h-10");
    expect(profileCard.className).toContain("w-10");
    expect(profileCard.className).toContain("justify-center");
    expect(profileCard.className).toContain("gap-0");
    expect(profileCard.className).toContain("p-0");
    expect(avatar.className).toContain("h-7");
    expect(avatar.className).toContain("w-7");
    expect(textWrap.className).toContain("max-w-0");
    expect(textWrap.className).toContain("flex-none");
    expect(textContainer.className).toContain("opacity-0");
    expect(textContainer.className).toContain("translate-x-1");
  });

  it("mantem o avatar expandido ate o texto realmente aparecer na abertura", () => {
    sidebarOpen = false;

    const { rerender } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardShell
          currentUser={{
            id: "user-1",
            name: "Admin",
            username: "admin",
            avatarUrl: "/uploads/users/avatar-user-1.png",
            revision: "rev-42",
            grants: {},
          }}
        >
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    sidebarOpen = true;

    act(() => {
      rerender(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <DashboardShell
            currentUser={{
              id: "user-1",
              name: "Admin",
              username: "admin",
              avatarUrl: "/uploads/users/avatar-user-1.png",
              revision: "rev-42",
              grants: {},
            }}
          >
            <div>Conteudo</div>
          </DashboardShell>
        </MemoryRouter>,
      );
    });

    const avatarImage = screen.getByAltText("Admin");
    const avatar = avatarImage.parentElement as HTMLElement;
    const profileCard = avatar.parentElement as HTMLElement;
    const textWrap = avatar.nextElementSibling as HTMLElement;

    expect(profileCard.dataset.state).toBe("collapsed");
    expect(profileCard.className).toContain("h-10");
    expect(avatar.className).toContain("h-7");
    expect(textWrap.className).toContain("max-w-0");

    act(() => {
      vi.advanceTimersByTime(40);
    });
  });

  it("renderiza fallback de iniciais no estado colapsado sem deslocar o avatar", () => {
    sidebarOpen = false;

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardShell
          currentUser={{
            id: "user-1",
            name: "Admin User",
            username: "admin",
            avatarUrl: null,
            revision: "rev-42",
            grants: {},
          }}
        >
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    const fallback = screen.getByText("AU");
    const avatar = fallback.parentElement as HTMLElement;
    const profileCard = avatar.parentElement as HTMLElement;

    expect(profileCard.dataset.collapsible).toBe("icon");
    expect(avatar.className).toContain("h-7");
    expect(avatar.className).toContain("w-7");
    expect(fallback.className).toContain("h-full");
    expect(fallback.className).toContain("w-full");
    expect(fallback.className).toContain("text-[9px]");

    sidebarOpen = true;
  });

  it("mantem um unico avatar e anima o texto de forma simetrica entre expandir e colapsar", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardShell
          currentUser={{
            id: "user-1",
            name: "Admin",
            username: "admin",
            avatarUrl: "/uploads/users/avatar-user-1.png",
            revision: "rev-42",
            grants: {},
          }}
        >
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    const avatarImages = screen.getAllByAltText("Admin");
    const [avatarImage] = avatarImages;
    const avatar = avatarImage.parentElement as HTMLElement;
    const profileCard = avatar.parentElement as HTMLElement;
    const textWrap = screen.getByText("Admin").parentElement?.parentElement as HTMLElement;
    const textContainer = screen.getByText("Admin").parentElement as HTMLElement;

    expect(profileCard.className).toContain("border");
    expect(profileCard.className).toContain("rounded-[1.15rem]");
    expect(profileCard.className).toContain("border-sidebar-border/70");
    expect(profileCard.className).toContain("bg-[linear-gradient(180deg,hsl(var(--sidebar-accent)/0.34),hsl(var(--sidebar-accent)/0.18))]");
    expect(profileCard.className).not.toContain("hover:border-sidebar-ring/45");
    expect(profileCard.className).not.toContain("hover:bg-[linear-gradient(180deg,hsl(var(--sidebar-accent)/0.5),hsl(var(--sidebar-accent)/0.28))]");
    expect(profileCard.className).toContain("overflow-hidden");
    expect(profileCard.className).toContain("transition-[width,height,padding,gap,background-color,border-color,box-shadow,transform]");
    expect(profileCard.className).toContain("shadow-[0_18px_40px_-28px_hsl(var(--sidebar-background)/0.95)]");
    expect(textWrap.className).toContain("max-w-[10rem]");
    expect(textWrap.className).toContain("transition-[max-width,opacity,transform]");
    expect(avatar.className).toContain("border");
    expect(avatar.className).toContain("border-white/10");
    expect(avatar.className).toContain("transition-[width,height,transform,border-color]");
    expect(avatar.className).toContain("h-11");
    expect(avatar.className).toContain("w-11");
    expect(avatar.className).toContain("min-h-11");
    expect(avatar.className).toContain("min-w-11");
    expect(textContainer.className).toContain("transition-[opacity,transform]");
    expect(textContainer.className).toContain("justify-center");
    expect(textContainer.className).toContain("gap-0.5");
    expect(textContainer.className).toContain("translate-x-0");
    expect(screen.queryByText("Conta ativa")).not.toBeInTheDocument();
    expect(screen.getByText("Membro")).toBeInTheDocument();
    expect(avatarImages).toHaveLength(1);
  });

  it("mostra o papel do usuário no lugar do @username", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardShell
          currentUser={{
            id: "user-1",
            name: "Admin",
            username: "admin",
            accessRole: "admin",
            avatarUrl: "/uploads/users/avatar-user-1.png",
            revision: "rev-42",
            grants: {},
          }}
        >
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.queryByText("@admin")).not.toBeInTheDocument();
  });

  it("dispara o clique no card inteiro quando o perfil pode ser aberto", () => {
    const onUserCardClick = vi.fn();

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardShell
          currentUser={{
            id: "user-1",
            name: "Admin",
            username: "admin",
            avatarUrl: "/uploads/users/avatar-user-1.png",
            revision: "rev-42",
            grants: {},
          }}
          onUserCardClick={onUserCardClick}
        >
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    const profileCard = screen.getByRole("button", { name: "Abrir perfil de Admin" });
    fireEvent.click(profileCard);

    expect(onUserCardClick).toHaveBeenCalledTimes(1);
  });

  it("aplica revision na mesma URL canonica do avatar", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardShell
          currentUser={{
            id: "user-1",
            name: "Admin",
            username: "admin",
            avatarUrl: "/uploads/users/avatar-user-1.png",
            revision: "rev-42",
            grants: {},
          }}
        >
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    const avatarImages = screen.getAllByAltText("Admin");
    expect(avatarImages[0]).toHaveAttribute("src", "/uploads/users/avatar-user-1.png?v=rev-42");
  });

  it("mantem proxy same-origin do Discord e adiciona revision visual", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardShell
          currentUser={{
            id: "user-1",
            name: "Admin",
            username: "admin",
            avatarUrl: "https://cdn.discordapp.com/avatars/123456789/avatar_hash.png?size=64",
            revision: "rev-99",
            grants: {},
          }}
        >
          <div>Conteudo</div>
        </DashboardShell>
      </MemoryRouter>,
    );

    const avatarImages = screen.getAllByAltText("Admin");
    expect(avatarImages[0]).toHaveAttribute(
      "src",
      "/api/public/discord-avatar/123456789/avatar_hash.png?size=128&v=rev-99",
    );
  });
});
