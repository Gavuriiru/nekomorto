import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AsyncState from "@/components/ui/async-state";

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);
const svgClassTokens = (element: SVGElement) =>
  String(element.getAttribute("class") || "")
    .split(/\s+/)
    .filter(Boolean);

describe("AsyncState", () => {
  it("renderiza loading com kind explicito", () => {
    const { container } = render(<AsyncState kind="loading" title="Carregando dados" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Carregando dados")).toBeInTheDocument();

    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(svgClassTokens(icon as SVGElement)).toContain("animate-spin");
  });

  it("aceita loading legado sem quebrar", () => {
    render(<AsyncState loading title="Carregando legado" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Carregando legado")).toBeInTheDocument();
  });

  it("cai no fallback de erro quando kind esta ausente", () => {
    render(<AsyncState title="Falha segura" description="Fallback defensivo" />);

    const root = screen.getByRole("alert");
    expect(root).toBeInTheDocument();
    expect(screen.getByText("Falha segura")).toBeInTheDocument();
    expect(screen.getByText("Fallback defensivo")).toBeInTheDocument();
    expect(classTokens(root)).toContain("text-destructive");
  });
});
