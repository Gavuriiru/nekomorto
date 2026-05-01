import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { insertTableCommand, restoreSelectionForInsertionSpy } = vi.hoisted(
  () => ({
    insertTableCommand: { type: "INSERT_TABLE_COMMAND" },
    restoreSelectionForInsertionSpy: vi.fn(),
  }),
);

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [null],
}));

vi.mock("@lexical/table", () => ({
  INSERT_TABLE_COMMAND: insertTableCommand,
  TableCellNode: class {},
  TableNode: class {},
  TableRowNode: class {},
}));

vi.mock("@/components/lexical/editor/plugins/ImagesPlugin/selectionSnapshot", () => ({
  restoreSelectionForInsertion: restoreSelectionForInsertionSpy,
}));

import { InsertTableDialog } from "@/components/lexical/editor/plugins/TablePlugin";

describe("InsertTableDialog", () => {
  it("restaura o snapshot antes de disparar a insercao da tabela", () => {
    const selectionSnapshot = { anchor: { key: "a" }, focus: { key: "b" } };
    const activeEditor = {
      dispatchCommand: vi.fn(),
      update: vi.fn((callback: () => void) => callback()),
    };
    const onClose = vi.fn();

    render(
      <InsertTableDialog
        activeEditor={activeEditor as never}
        onClose={onClose}
        selectionSnapshot={selectionSnapshot as never}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    expect(activeEditor.update).toHaveBeenCalledTimes(1);
    expect(restoreSelectionForInsertionSpy).toHaveBeenCalledWith(
      selectionSnapshot,
    );
    expect(activeEditor.dispatchCommand).toHaveBeenCalledWith(
      insertTableCommand,
      {
        columns: "5",
        rows: "5",
      },
    );
    expect(
      restoreSelectionForInsertionSpy.mock.invocationCallOrder[0],
    ).toBeLessThan(activeEditor.dispatchCommand.mock.invocationCallOrder[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
