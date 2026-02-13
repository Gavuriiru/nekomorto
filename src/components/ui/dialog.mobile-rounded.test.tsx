import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

describe("Dialog mobile rounded", () => {
  it("aplica rounded-lg no conteudo sem depender de sm:rounded-lg", async () => {
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
  });
});
