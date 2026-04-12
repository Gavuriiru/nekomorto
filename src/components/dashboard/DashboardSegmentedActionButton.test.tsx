import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardSegmentedActionButton from "@/components/dashboard/DashboardSegmentedActionButton";

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

describe("DashboardSegmentedActionButton", () => {
  it("renders active and inactive segmented states without lift classes", () => {
    render(
      <div>
        <DashboardSegmentedActionButton active>Lista</DashboardSegmentedActionButton>
        <DashboardSegmentedActionButton active={false}>Calendário</DashboardSegmentedActionButton>
      </div>,
    );

    const listButton = screen.getByRole("button", { name: "Lista" });
    const calendarButton = screen.getByRole("button", { name: "Calendário" });
    const listTokens = classTokens(listButton);
    const calendarTokens = classTokens(calendarButton);

    expect(listButton).toHaveAttribute("aria-pressed", "true");
    expect(calendarButton).toHaveAttribute("aria-pressed", "false");
    expect(listTokens).toEqual(
      expect.arrayContaining([
        "h-9",
        "rounded-xl",
        "border-border/70",
        "bg-background",
        "font-semibold",
      ]),
    );
    expect(calendarTokens).toEqual(
      expect.arrayContaining([
        "h-9",
        "rounded-xl",
        "border-transparent",
        "font-semibold",
        "hover:border-primary/40",
        "hover:bg-primary/5",
        "hover:text-foreground",
      ]),
    );
    expect(listTokens).not.toContain("interactive-lift-sm");
    expect(listTokens).not.toContain("pressable");
    expect(calendarTokens).not.toContain("interactive-lift-sm");
    expect(calendarTokens).not.toContain("pressable");
  });
});
