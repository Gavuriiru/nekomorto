import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PublicPageHero from "@/components/PublicPageHero";

describe("PublicPageHero", () => {
  it("renderiza title, subtitle, badge opcional e classe compartilhada", () => {
    const { container } = render(
      <PublicPageHero badge="Equipe" title="Conheca a equipe" subtitle="Texto de apoio" />,
    );

    expect(screen.getByText("Equipe")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conheca a equipe" })).toBeInTheDocument();
    expect(screen.getByText("Texto de apoio")).toBeInTheDocument();
    expect(container.querySelector("section")).toHaveClass("relative", "overflow-hidden");
    expect(container.querySelector("section")?.className).toContain("[background-image:var(--gradient-public-hero)]");
  });

  it("nao renderiza badge vazio", () => {
    const { container } = render(
      <PublicPageHero badge="   " title="Hero sem selo" subtitle="Subtitulo sem selo" />,
    );

    expect(container.querySelector(".animate-fade-in")).toBeNull();
  });

  it("renderiza badges adicionais quando presentes", () => {
    render(
      <PublicPageHero
        title="Sobre"
        subtitle="Subtitulo"
        badges={["Sem propaganda", "Gratuito", "  ", "Legendado com carinho"]}
      />,
    );

    expect(screen.getByText("Sem propaganda")).toBeInTheDocument();
    expect(screen.getByText("Gratuito")).toBeInTheDocument();
    expect(screen.getByText("Legendado com carinho")).toBeInTheDocument();
  });
});
