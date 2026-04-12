import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PillButton } from "@/components/ui/pill-button";
import { deriveThemeAccentTokens } from "@/lib/theme-accent";

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

describe("PillButton", () => {
  it("reutiliza o foco compartilhado e o tamanho minimo de pill", () => {
    render(<PillButton>Filtro</PillButton>);

    const button = screen.getByRole("button", { name: "Filtro" });
    const tokens = classTokens(button);

    expect(tokens).toEqual(
      expect.arrayContaining([
        "focus-visible:ring-2",
        "focus-visible:ring-ring/45",
        "min-h-6",
        "min-w-6",
        "rounded-full",
        "shadow-none",
      ]),
    );
  });

  it("expoe tons compartilhados para pills interativas", () => {
    render(
      <>
        <PillButton tone="primary">Primaria</PillButton>
        <PillButton tone="secondary">Secundaria</PillButton>
        <PillButton tone="outline">Outline</PillButton>
      </>,
    );

    expect(screen.getByRole("button", { name: "Primaria" })).toHaveClass(
      "border-primary/20",
      "bg-primary/10",
      "text-primary",
    );
    const secondaryButton = screen.getByRole("button", { name: "Secundaria" });
    const outlineButton = screen.getByRole("button", { name: "Outline" });

    [secondaryButton, outlineButton].forEach((button) => {
      expect(button).toHaveClass(
        "border-border/70",
        "bg-background",
        "text-foreground/70",
        "hover:border-accent/60",
        "hover:bg-accent/15",
        "hover:text-foreground",
        "focus-visible:border-accent/60",
        "focus-visible:bg-accent/15",
        "focus-visible:text-foreground",
      );
    });

    expect(secondaryButton).toHaveClass("border-border/70", "bg-background", "text-foreground/70");
    expect(outlineButton).toHaveClass("border-border/70", "bg-background", "text-foreground/70");
  });

  it("mantem a pill neutra independente de accent customizado claro", () => {
    const tokens = deriveThemeAccentTokens("#4adffc");

    expect(tokens?.accentForeground).toBe("224 41% 12%");

    if (tokens) {
      document.documentElement.style.setProperty("--accent", tokens.accent);
      document.documentElement.style.setProperty("--accent-foreground", tokens.accentForeground);
    }

    render(<PillButton tone="secondary">Filtro claro</PillButton>);

    const button = screen.getByRole("button", { name: "Filtro claro" });

    expect(button).toHaveClass("hover:text-foreground", "focus-visible:text-foreground");
    expect(button).not.toHaveClass(
      "hover:text-accent-foreground",
      "focus-visible:text-accent-foreground",
    );

    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-foreground");
  });
});
