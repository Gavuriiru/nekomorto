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
  Avatar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) =>
    src ? <img src={src} alt={alt || ""} /> : null,
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
  SidebarMenuButton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("DashboardShell avatar render", () => {
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
