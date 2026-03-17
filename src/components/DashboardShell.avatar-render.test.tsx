import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DashboardShell from "@/components/DashboardShell";

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
}));

describe("DashboardShell avatar render", () => {
  it("mantem o card expandido com borda e preenchimento destacados e a versao compacta neutra", () => {
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

    const [expandedAvatarImage, compactAvatarImage] = screen.getAllByAltText("Admin");
    const expandedAvatar = expandedAvatarImage.parentElement as HTMLElement;
    const compactAvatar = compactAvatarImage.parentElement as HTMLElement;
    const expandedCard = expandedAvatar.parentElement as HTMLElement;
    const compactCard = compactAvatar.parentElement as HTMLElement;

    expect(expandedCard.className).toContain("border");
    expect(expandedCard.className).toContain("border-sidebar-border/80");
    expect(expandedCard.className).toContain("bg-sidebar-accent/20");
    expect(expandedCard.className).toContain("hover:border-sidebar-ring/40");
    expect(expandedCard.className).toContain("hover:bg-sidebar-accent/35");
    expect(compactCard.className).not.toContain("border-sidebar-border/80");
    expect(compactCard.className).not.toContain("bg-sidebar-accent/20");
    expect(compactCard.className).not.toContain("hover:bg-sidebar-accent/35");
    expect(compactCard.className).toContain("border");
    expect(compactCard.className).toContain("border-transparent");
    expect(compactCard.className).toContain("hover:border-sidebar-ring/40");
    expect(expandedAvatar.className).toContain("border");
    expect(expandedAvatar.className).toContain("border-sidebar-border");
    expect(compactAvatar.className).toContain("border");
    expect(compactAvatar.className).toContain("border-sidebar-border");
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
