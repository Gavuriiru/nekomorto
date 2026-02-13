import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

describe("AlertDialog mobile rounded", () => {
  it("aplica rounded-lg no conteudo sem depender de sm:rounded-lg", async () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acao</AlertDialogTitle>
            <AlertDialogDescription>Descricao da confirmacao</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const alertDialog = await screen.findByRole("alertdialog");
    const tokens = classTokens(alertDialog);

    expect(tokens).toContain("rounded-lg");
    expect(tokens).not.toContain("sm:rounded-lg");
  });
});
