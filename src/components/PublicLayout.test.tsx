import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import PublicLayout from "@/components/PublicLayout";

vi.mock("@/components/Header", () => ({
  default: () => <div data-testid="public-header" />,
}));

vi.mock("@/components/Footer", () => ({
  default: () => <div data-testid="public-footer" />,
}));

describe("PublicLayout", () => {
  it("renders header, main outlet, and footer without skip links", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<div data-testid="public-outlet">Conteudo publico</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("public-header")).toBeInTheDocument();
    expect(screen.getByTestId("public-footer")).toBeInTheDocument();
    expect(screen.getByTestId("public-outlet")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "public-main-content");
    expect(
      screen.queryByRole("navigation", { name: /Atalhos de acessibilidade/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pular para o conteúdo" })).not.toBeInTheDocument();
  });
});
