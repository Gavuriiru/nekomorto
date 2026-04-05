import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";

describe("Badge semantic variants", () => {
  it("keeps semantic badges token-driven after the light-theme inversion", () => {
    render(
      <div>
        <Badge variant="success">Sucesso</Badge>
        <Badge variant="warning">Alerta</Badge>
        <Badge variant="danger">Falha</Badge>
        <Badge variant="info">Atual</Badge>
        <Badge variant="neutral">Na fila</Badge>
      </div>,
    );

    expect(screen.getByText("Sucesso")).toHaveClass(
      "border-[hsl(var(--badge-success-border))]",
      "bg-[hsl(var(--badge-success-bg))]",
      "text-[hsl(var(--badge-success-fg))]",
    );
    expect(screen.getByText("Alerta")).toHaveClass(
      "border-[hsl(var(--badge-warning-border))]",
      "bg-[hsl(var(--badge-warning-bg))]",
      "text-[hsl(var(--badge-warning-fg))]",
    );
    expect(screen.getByText("Falha")).toHaveClass(
      "border-[hsl(var(--badge-danger-border))]",
      "bg-[hsl(var(--badge-danger-bg))]",
      "text-[hsl(var(--badge-danger-fg))]",
    );
    expect(screen.getByText("Atual")).toHaveClass(
      "border-[hsl(var(--badge-info-border))]",
      "bg-[hsl(var(--badge-info-bg))]",
      "text-[hsl(var(--badge-info-fg))]",
    );
    expect(screen.getByText("Na fila")).toHaveClass(
      "border-[hsl(var(--badge-neutral-border))]",
      "bg-[hsl(var(--badge-neutral-bg))]",
      "text-[hsl(var(--badge-neutral-fg))]",
    );
    expect(String(screen.getByText("Sucesso").className)).not.toContain("dark:");
  });
});
