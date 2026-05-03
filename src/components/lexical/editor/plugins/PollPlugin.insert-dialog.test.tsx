import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { restoreSelectionForInsertionSpy } = vi.hoisted(() => ({
  restoreSelectionForInsertionSpy: vi.fn(),
}));

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [null],
}));

vi.mock("@/components/lexical/editor/plugins/ImagesPlugin/selectionSnapshot", () => ({
  restoreSelectionForInsertion: restoreSelectionForInsertionSpy,
}));

import {
  INSERT_POLL_COMMAND,
  InsertPollDialog,
} from "@/components/lexical/editor/plugins/PollPlugin";

describe("InsertPollDialog", () => {
  beforeEach(() => {
    restoreSelectionForInsertionSpy.mockReset();
  });

  it("restaura o snapshot antes de inserir a enquete no editor ativo", () => {
    const selectionSnapshot = { anchor: { key: "a" }, focus: { key: "b" } };
    const activeEditor = {
      dispatchCommand: vi.fn(() => true),
      update: vi.fn((callback: () => void) => callback()),
    };
    const onClose = vi.fn();

    render(
      <InsertPollDialog
        activeEditor={activeEditor as never}
        onClose={onClose}
        selectionSnapshot={selectionSnapshot as never}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Pergunta teste" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(activeEditor.update).toHaveBeenCalledTimes(1);
    expect(restoreSelectionForInsertionSpy).toHaveBeenCalledWith(selectionSnapshot);
    expect(activeEditor.dispatchCommand).toHaveBeenCalledWith(
      INSERT_POLL_COMMAND,
      "Pergunta teste",
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("usa apenas a selecao do editor de fallback quando o editor ativo nao trata o comando", () => {
    const selectionSnapshot = { anchor: { key: "a" }, focus: { key: "b" } };
    const activeEditor = {
      dispatchCommand: vi.fn(() => false),
      update: vi.fn((callback: () => void) => callback()),
    };
    const fallbackEditor = {
      dispatchCommand: vi.fn(),
      update: vi.fn((callback: () => void) => callback()),
    };

    render(
      <InsertPollDialog
        activeEditor={activeEditor as never}
        fallbackEditor={fallbackEditor as never}
        onClose={vi.fn()}
        selectionSnapshot={selectionSnapshot as never}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Pergunta fallback" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(restoreSelectionForInsertionSpy).toHaveBeenNthCalledWith(1, selectionSnapshot);
    expect(restoreSelectionForInsertionSpy).toHaveBeenNthCalledWith(2, null);
    expect(fallbackEditor.update).toHaveBeenCalledTimes(1);
    expect(fallbackEditor.dispatchCommand).toHaveBeenCalledWith(
      INSERT_POLL_COMMAND,
      "Pergunta fallback",
    );
  });
});
