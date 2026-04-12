import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHead,
  TableRow,
} from "@/components/ui/table";

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

describe("Table", () => {
  it("aplica hover arredondado nas celulas e deixa a linha sem fundo proprio", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-state="selected">
            <TableCell>Projeto 1</TableCell>
            <TableCell>Sucesso</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const table = screen.getByRole("table");
    const selectedRow = screen.getByRole("row", { name: /Projeto 1 Sucesso/i });
    const selectedCell = screen.getByRole("cell", { name: "Projeto 1" });

    expect(classTokens(table)).toContain("[&_tbody_tr:hover_td]:bg-muted/50");
    expect(classTokens(table)).toContain("[&_tbody_tr:hover_td:first-child]:rounded-l-lg");
    expect(classTokens(table)).toContain("[&_tbody_tr:hover_td:last-child]:rounded-r-lg");
    expect(classTokens(table)).toContain("[&_tbody_tr[data-state=selected]_td]:bg-muted");
    expect(classTokens(table)).toContain(
      "[&_tbody_tr[data-state=selected]_td:first-child]:rounded-l-lg",
    );
    expect(classTokens(table)).toContain(
      "[&_tbody_tr[data-state=selected]_td:last-child]:rounded-r-lg",
    );
    expect(classTokens(selectedRow)).toContain("border-b");
    expect(classTokens(selectedRow)).not.toContain("hover:bg-muted/50");
    expect(classTokens(selectedRow)).not.toContain("data-[state=selected]:bg-muted");
    expect(classTokens(selectedCell)).toContain("transition-colors");
  });
});
