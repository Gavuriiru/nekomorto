import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import { dashboardMotionDelays } from "@/components/dashboard/dashboard-motion";

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

describe("DashboardPageHeader", () => {
  it("uses the shared reveal wrapper for the badge and shared default delays", () => {
    render(
      <DashboardPageHeader
        badge="Uploads"
        title="Painel"
        description="Descricao"
        actions={<button type="button">Acao</button>}
      />,
    );

    const badge = screen.getByText("Uploads");
    const badgeReveal = badge.parentElement;
    const description = screen.getByText("Descricao");
    const actionWrapper = screen.getByRole("button", { name: "Acao" }).parentElement;

    expect(badgeReveal).not.toBeNull();
    expect(classTokens(badgeReveal as HTMLElement)).toContain("reveal");
    expect(classTokens(badgeReveal as HTMLElement)).toContain("reveal-delay-1");
    expect(badgeReveal).toHaveAttribute("data-reveal");

    expect(description).toHaveStyle({
      animationDelay: `${dashboardMotionDelays.headerDescriptionMs}ms`,
    });

    expect(actionWrapper).not.toBeNull();
    expect(actionWrapper).toHaveStyle({
      animationDelay: `${dashboardMotionDelays.headerActionsMs}ms`,
    });
  });
});
