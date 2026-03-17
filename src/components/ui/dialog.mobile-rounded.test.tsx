import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

describe("Dialog mobile rounded", () => {
  it("aplica rounded-lg e respiro lateral mobile no conteudo", async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog de teste</DialogTitle>
            <DialogDescription>Descricao do dialog</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const dialog = await screen.findByRole("dialog");
    const tokens = classTokens(dialog);

    expect(tokens).toContain("rounded-lg");
    expect(tokens).not.toContain("sm:rounded-lg");
    expect(tokens).toContain("w-[calc(100vw-1rem)]");
  });

  it("permite sobrescrever largura e max-width via className", async () => {
    render(
      <Dialog open>
        <DialogContent className="w-[95vw] max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dialog com override</DialogTitle>
            <DialogDescription>Descricao do dialog com override</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const dialog = await screen.findByRole("dialog");
    const tokens = classTokens(dialog);

    expect(tokens).toContain("w-[95vw]");
    expect(tokens).toContain("max-w-3xl");
    expect(tokens).not.toContain("w-[calc(100vw-1rem)]");
    expect(tokens).not.toContain("max-w-lg");
  });
});
