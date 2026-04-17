import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { insertLayoutCommand, restoreSelectionForInsertionSpy } = vi.hoisted(
  () => ({
    insertLayoutCommand: { type: "INSERT_LAYOUT_COMMAND" },
    restoreSelectionForInsertionSpy: vi.fn(),
  }),
);

vi.mock("@/lexical-playground/plugins/ImagesPlugin/selectionSnapshot", () => ({
  restoreSelectionForInsertion: restoreSelectionForInsertionSpy,
}));

vi.mock("@/lexical-playground/plugins/LayoutPlugin/LayoutPlugin", () => ({
  INSERT_LAYOUT_COMMAND: insertLayoutCommand,
}));

import InsertLayoutDialog from "@/lexical-playground/plugins/LayoutPlugin/InsertLayoutDialog";

describe("InsertLayoutDialog", () => {
  it("restaura o snapshot antes de inserir o layout selecionado", () => {
    const selectionSnapshot = { anchor: { key: "a" }, focus: { key: "b" } };
    const activeEditor = {
      dispatchCommand: vi.fn(),
      update: vi.fn((callback: () => void) => callback()),
    };
    const onClose = vi.fn();

    render(
      <InsertLayoutDialog
        activeEditor={activeEditor as never}
        onClose={onClose}
        selectionSnapshot={selectionSnapshot as never}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /inserir/i }));

    expect(activeEditor.update).toHaveBeenCalledTimes(1);
    expect(restoreSelectionForInsertionSpy).toHaveBeenCalledWith(
      selectionSnapshot,
    );
    expect(activeEditor.dispatchCommand).toHaveBeenCalledWith(
      insertLayoutCommand,
      "1fr 1fr",
    );
    expect(
      restoreSelectionForInsertionSpy.mock.invocationCallOrder[0],
    ).toBeLessThan(activeEditor.dispatchCommand.mock.invocationCallOrder[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
