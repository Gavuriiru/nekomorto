import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardActionButton from "@/components/dashboard/DashboardActionButton";

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

describe("DashboardActionButton", () => {
  it("reuses the dashboard home surface without lift classes", () => {
    render(<DashboardActionButton>Biblioteca</DashboardActionButton>);

    const button = screen.getByRole("button", { name: "Biblioteca" });
    const tokens = classTokens(button);

    expect(tokens).toEqual(
      expect.arrayContaining([
        "rounded-xl",
        "bg-background",
        "font-semibold",
        "px-4",
        "py-3",
        "shadow-none",
        "hover:bg-primary/5",
        "hover:text-foreground",
      ]),
    );
    expect(tokens).not.toContain("interactive-lift-sm");
    expect(tokens).not.toContain("pressable");
  });

  it("supports compact sizing and asChild usage", () => {
    render(
      <DashboardActionButton asChild size="sm" className="w-full">
        <a href="/biblioteca">Biblioteca</a>
      </DashboardActionButton>,
    );

    const link = screen.getByRole("link", { name: "Biblioteca" });
    const tokens = classTokens(link);

    expect(tokens).toEqual(
      expect.arrayContaining(["h-9", "px-3", "w-full", "rounded-xl", "font-semibold"]),
    );
    expect(tokens).not.toContain("interactive-lift-sm");
    expect(tokens).not.toContain("pressable");
  });

  it("supports toolbar sizing without lift classes", () => {
    render(
      <DashboardActionButton size="toolbar">
        Importar AniList
      </DashboardActionButton>,
    );

    const button = screen.getByRole("button", { name: "Importar AniList" });
    const tokens = classTokens(button);

    expect(tokens).toEqual(
      expect.arrayContaining(["h-10", "px-4", "rounded-xl", "bg-background", "font-semibold"]),
    );
    expect(tokens).not.toContain("interactive-lift-sm");
    expect(tokens).not.toContain("pressable");
  });

  it("supports primary and destructive tones without lift classes", () => {
    render(
      <div>
        <DashboardActionButton tone="primary">Salvar</DashboardActionButton>
        <DashboardActionButton tone="destructive">Excluir</DashboardActionButton>
      </div>,
    );

    const primaryTokens = classTokens(screen.getByRole("button", { name: "Salvar" }));
    const destructiveTokens = classTokens(screen.getByRole("button", { name: "Excluir" }));

    expect(primaryTokens).toEqual(
      expect.arrayContaining([
        "rounded-xl",
        "bg-primary",
        "text-primary-foreground",
        "shadow-none",
      ]),
    );
    expect(destructiveTokens).toEqual(
      expect.arrayContaining([
        "rounded-xl",
        "bg-destructive/10",
        "text-destructive",
        "shadow-none",
      ]),
    );
    expect(primaryTokens).not.toContain("interactive-lift-sm");
    expect(primaryTokens).not.toContain("pressable");
    expect(destructiveTokens).not.toContain("interactive-lift-sm");
    expect(destructiveTokens).not.toContain("pressable");
  });

  it("supports compact and icon sizing without lift classes", () => {
    render(
      <div>
        <DashboardActionButton size="compact">Ver</DashboardActionButton>
        <DashboardActionButton size="icon-sm" aria-label="Excluir">
          <span aria-hidden="true">X</span>
        </DashboardActionButton>
      </div>,
    );

    const compactTokens = classTokens(screen.getByRole("button", { name: "Ver" }));
    const iconTokens = classTokens(screen.getByRole("button", { name: "Excluir" }));

    expect(compactTokens).toEqual(expect.arrayContaining(["h-8", "px-2.5", "rounded-xl"]));
    expect(iconTokens).toEqual(expect.arrayContaining(["h-8", "w-8", "p-0", "rounded-xl"]));
    expect(compactTokens).not.toContain("interactive-lift-sm");
    expect(compactTokens).not.toContain("pressable");
    expect(iconTokens).not.toContain("interactive-lift-sm");
    expect(iconTokens).not.toContain("pressable");
  });

  it("maps legacy variants to dashboard tones without lift classes", () => {
    render(
      <div>
        <DashboardActionButton variant="default">Salvar</DashboardActionButton>
        <DashboardActionButton variant="outline">Cancelar</DashboardActionButton>
        <DashboardActionButton variant="destructive">Excluir</DashboardActionButton>
      </div>,
    );

    const defaultTokens = classTokens(screen.getByRole("button", { name: "Salvar" }));
    const outlineTokens = classTokens(screen.getByRole("button", { name: "Cancelar" }));
    const destructiveTokens = classTokens(screen.getByRole("button", { name: "Excluir" }));

    expect(defaultTokens).toEqual(expect.arrayContaining(["bg-primary", "text-primary-foreground"]));
    expect(outlineTokens).toEqual(expect.arrayContaining(["bg-background", "text-foreground/70"]));
    expect(destructiveTokens).toEqual(
      expect.arrayContaining(["bg-destructive/10", "text-destructive"]),
    );
    expect(defaultTokens).not.toContain("interactive-lift-sm");
    expect(outlineTokens).not.toContain("interactive-lift-sm");
    expect(destructiveTokens).not.toContain("interactive-lift-sm");
  });
});
