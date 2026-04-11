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
});
