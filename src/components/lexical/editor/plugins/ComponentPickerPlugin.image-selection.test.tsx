import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const {
  cloneCurrentRangeSelectionSpy,
  closeMenuSpy,
  insertImageDialogPropsSpy,
  nodeToRemoveSpy,
} = vi.hoisted(() => ({
  cloneCurrentRangeSelectionSpy: vi.fn(),
  closeMenuSpy: vi.fn(),
  insertImageDialogPropsSpy: vi.fn(),
  nodeToRemoveSpy: vi.fn(),
}));

let currentEditor: {
  dispatchCommand: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} | null = null;

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [currentEditor],
}));

vi.mock("@lexical/react/LexicalTypeaheadMenuPlugin", () => ({
  LexicalTypeaheadMenuPlugin: ({
    onSelectOption,
    options,
  }: {
    onSelectOption: (
      option: {
        title: string;
      },
      nodeToRemove: { remove: () => void },
      closeMenu: () => void,
      matchingString: string,
    ) => void;
    options: Array<{ title: string }>;
  }) => (
    <div>
      {options.map((option) => (
        <button
          key={option.title}
          type="button"
          onClick={() =>
            onSelectOption(
              option,
              { remove: nodeToRemoveSpy },
              closeMenuSpy,
              option.title.toLowerCase(),
            )
          }
        >
          {option.title}
        </button>
      ))}
    </div>
  ),
  MenuOption: class {
    key: string;
    title: string;

    constructor(title: string) {
      this.key = title;
      this.title = title;
    }

    setRefElement() {
      return undefined;
    }
  },
  useBasicTypeaheadTriggerMatch: () => vi.fn(),
}));

vi.mock("@/components/lexical/editor/hooks/useModal", () => ({
  default: () => [null, vi.fn()],
}));

vi.mock("@/components/lexical/editor/plugins/AutoEmbedPlugin", () => ({
  EmbedConfigs: [],
}));

vi.mock("@/components/lexical/editor/plugins/ImagesPlugin", () => ({
  InsertImageDialog: (props: unknown) => {
    insertImageDialogPropsSpy(props);
    return <div data-testid="mock-insert-image-dialog" />;
  },
}));

vi.mock("@/components/lexical/editor/plugins/ImagesPlugin/selectionSnapshot", () => ({
  cloneCurrentRangeSelection: cloneCurrentRangeSelectionSpy,
}));

vi.mock("@/components/lexical/editor/plugins/LayoutPlugin/InsertLayoutDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/lexical/editor/plugins/PollPlugin", () => ({
  InsertPollDialog: () => null,
}));

vi.mock("@/components/lexical/editor/plugins/TablePlugin", () => ({
  InsertTableDialog: () => null,
}));

import ComponentPickerMenuPlugin from "@/components/lexical/editor/plugins/ComponentPickerPlugin";

describe("ComponentPickerMenuPlugin image selection capture", () => {
  it("usa o snapshot da selecao apos remover o gatilho do typeahead", () => {
    const selectionSnapshot = { anchor: { key: "a" }, focus: { key: "b" } };

    closeMenuSpy.mockReset();
    cloneCurrentRangeSelectionSpy.mockReset();
    insertImageDialogPropsSpy.mockReset();
    nodeToRemoveSpy.mockReset();

    cloneCurrentRangeSelectionSpy.mockReturnValue(selectionSnapshot);
    currentEditor = {
      dispatchCommand: vi.fn(),
      update: vi.fn((callback: () => void) => callback()),
    };

    render(<ComponentPickerMenuPlugin imageLibraryOptions={undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Image" }));

    expect(nodeToRemoveSpy).toHaveBeenCalledTimes(1);
    expect(cloneCurrentRangeSelectionSpy).toHaveBeenCalledTimes(1);
    expect(nodeToRemoveSpy.mock.invocationCallOrder[0]).toBeLessThan(
      cloneCurrentRangeSelectionSpy.mock.invocationCallOrder[0],
    );
    expect(closeMenuSpy).toHaveBeenCalledTimes(1);

    const dialogProps = insertImageDialogPropsSpy.mock.calls.at(-1)?.[0] as {
      selectionSnapshot?: unknown;
    };

    expect(screen.getByTestId("mock-insert-image-dialog")).toBeInTheDocument();
    expect(dialogProps.selectionSnapshot).toBe(selectionSnapshot);
  });
});
