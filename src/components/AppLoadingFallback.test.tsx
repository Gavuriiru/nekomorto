import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AppLoadingFallback from "@/components/AppLoadingFallback";

describe("AppLoadingFallback", () => {
  it("renderiza spinner com accent compartilhada e label padrão", () => {
    const { container } = render(<AppLoadingFallback />);

    expect(screen.getByText("Carregando...")).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector("svg.animate-spin")).not.toBeNull();
    expect(container.innerHTML).toContain("var(--app-loader-accent)");
  });

  it("usa layout full-screen quando solicitado", () => {
    render(<AppLoadingFallback fullScreen label="Verificando acesso..." />);

    expect(screen.getByText("Verificando acesso...")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveStyle({ minHeight: "100vh" });
  });
});
