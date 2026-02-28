import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import SkipLinks from "@/components/SkipLinks";

describe("SkipLinks accessibility", () => {
  it("renders a skip-links landmark without axe violations", async () => {
    const { container } = render(
      <>
        <SkipLinks links={[{ href: "#main-content", label: "Pular para o conteudo" }]} />
        <main id="main-content" tabIndex={-1}>
          Conteudo principal
        </main>
      </>,
    );

    expect(
      screen.getByRole("navigation", { name: /Atalhos de acessibilidade/i }),
    ).toBeInTheDocument();
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
