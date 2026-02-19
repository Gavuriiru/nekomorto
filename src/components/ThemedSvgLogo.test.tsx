import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";

describe("ThemedSvgLogo", () => {
  it("renders allowed remote https icons as img", () => {
    render(
      <ThemedSvgLogo
        url="https://cdn.exemplo.com/icon.svg"
        label="Icone remoto"
        className="h-4 w-4"
      />,
    );

    const image = screen.getByRole("img", { name: "Icone remoto" });
    expect(image).toHaveAttribute("src", "https://cdn.exemplo.com/icon.svg");
  });

  it("renders allowed /uploads icons as img", () => {
    render(
      <ThemedSvgLogo
        url="/uploads/social/icon.svg"
        label="Icone local"
        className="h-4 w-4"
      />,
    );

    const image = screen.getByRole("img", { name: "Icone local" });
    expect(image).toHaveAttribute("src", "/uploads/social/icon.svg");
  });

  it("blocks unsafe data URL icon sources", () => {
    const { queryByRole } = render(
      <ThemedSvgLogo
        url="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3C/script%3E"
        label="Icone bloqueado"
      />,
    );

    expect(queryByRole("img", { name: "Icone bloqueado" })).not.toBeInTheDocument();
  });

  it("does not render icon keys as image URL", () => {
    const { queryByRole } = render(
      <ThemedSvgLogo
        url="instagram"
        label="Icone por chave"
      />,
    );

    expect(queryByRole("img", { name: "Icone por chave" })).not.toBeInTheDocument();
  });
});
