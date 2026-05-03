import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { restoreSelectionForInsertionSpy } = vi.hoisted(() => ({
  restoreSelectionForInsertionSpy: vi.fn(),
}));

let currentEditor: {
  dispatchCommand: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} | null = null;

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [currentEditor],
}));

vi.mock("@lexical/react/LexicalAutoEmbedPlugin", () => ({
  AutoEmbedOption: class {
    key: string;
    title: string;

    constructor(title: string) {
      this.key = title;
      this.title = title;
    }
  },
  LexicalAutoEmbedPlugin: () => null,
  URL_MATCHER: /https?:\/\/\S+/,
}));

vi.mock("@/components/lexical/editor/plugins/ImagesPlugin/selectionSnapshot", () => ({
  restoreSelectionForInsertion: restoreSelectionForInsertionSpy,
}));

import { AutoEmbedDialog } from "@/components/lexical/editor/plugins/AutoEmbedPlugin";

describe("AutoEmbedDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    restoreSelectionForInsertionSpy.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("restaura o snapshot antes de inserir o embed confirmado", async () => {
    const selectionSnapshot = { anchor: { key: "a" }, focus: { key: "b" } };
    const insertNodeSpy = vi.fn();
    const onClose = vi.fn();

    currentEditor = {
      dispatchCommand: vi.fn(),
      update: vi.fn((callback: () => void) => callback()),
    };

    const { container } = render(
      <AutoEmbedDialog
        embedConfig={
          {
            contentName: "X (Tweet)",
            exampleUrl: "https://x.com/jack/status/20",
            insertNode: insertNodeSpy,
            keywords: ["tweet"],
            parseUrl: vi.fn(async (url: string) => ({
              id: "123",
              url,
            })),
            type: "tweet",
          } as never
        }
        onClose={onClose}
        selectionSnapshot={selectionSnapshot as never}
      />,
    );

    fireEvent.change(container.querySelector('[data-test-id="tweet-embed-modal-url"]')!, {
      target: { value: "https://x.com/jack/status/20" },
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    const submitButton = screen.getByRole("button", { name: /embed/i });
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);

    expect(currentEditor?.update).toHaveBeenCalledTimes(1);
    expect(restoreSelectionForInsertionSpy).toHaveBeenCalledWith(selectionSnapshot);
    expect(insertNodeSpy).toHaveBeenCalledWith(currentEditor, {
      id: "123",
      url: "https://x.com/jack/status/20",
    });
    expect(restoreSelectionForInsertionSpy.mock.invocationCallOrder[0]).toBeLessThan(
      insertNodeSpy.mock.invocationCallOrder[0],
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
