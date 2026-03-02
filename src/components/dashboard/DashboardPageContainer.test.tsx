import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

describe("DashboardPageContainer", () => {
  it("aplica reveal ao section interno por padrao", () => {
    render(
      <DashboardPageContainer>
        <div>Conteudo</div>
      </DashboardPageContainer>,
    );

    const section = screen.getByText("Conteudo").closest("section");
    expect(section).not.toBeNull();
    expect(classTokens(section as HTMLElement)).toContain("reveal");
    expect(section).toHaveAttribute("data-reveal");
  });
});
