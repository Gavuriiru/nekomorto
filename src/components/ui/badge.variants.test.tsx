import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";

describe("Badge semantic variants", () => {
  it("keeps semantic badges readable in light and dark themes", () => {
    render(
      <div>
        <Badge variant="success">Sucesso</Badge>
        <Badge variant="warning">Alerta</Badge>
        <Badge variant="danger">Falha</Badge>
      </div>,
    );

    expect(screen.getByText("Sucesso")).toHaveClass(
      "bg-emerald-500/20",
      "text-emerald-800",
      "dark:text-emerald-200",
    );
    expect(screen.getByText("Alerta")).toHaveClass(
      "bg-amber-500/20",
      "text-amber-900",
      "dark:text-amber-200",
    );
    expect(screen.getByText("Falha")).toHaveClass(
      "bg-red-500/20",
      "text-red-800",
      "dark:text-red-200",
    );
  });
});
