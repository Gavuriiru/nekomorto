import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";

describe("DashboardFieldStack", () => {
  it("usa a densidade default por padrao", () => {
    render(
      <DashboardFieldStack data-testid="field">
        <span>Campo</span>
      </DashboardFieldStack>,
    );

    expect(screen.getByTestId("field")).toHaveClass("flex", "flex-col", "gap-2");
  });

  it("permite densidade compacta e preserva classes extras", () => {
    render(
      <DashboardFieldStack data-testid="field" density="compact" className="md:col-span-2">
        <span>Campo</span>
      </DashboardFieldStack>,
    );

    expect(screen.getByTestId("field")).toHaveClass("flex", "flex-col", "gap-2");
    expect(screen.getByTestId("field")).toHaveClass("md:col-span-2");
  });
});
