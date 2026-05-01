import { fireEvent, render, screen } from "@testing-library/react";
import type {
  ButtonHTMLAttributes,
  MouseEvent,
  ReactElement,
  ReactNode,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  captureCurrentRangeSelectionSpy,
  insertImageDialogPropsSpy,
  openEmbedModalWithSelectionCommand,
  restoreSelectionForInsertionSpy,
  showModalSpy,
  updateToolbarStateSpy,
} = vi.hoisted(() => ({
  captureCurrentRangeSelectionSpy: vi.fn(),
  insertImageDialogPropsSpy: vi.fn(),
  openEmbedModalWithSelectionCommand: {
    type: "OPEN_EMBED_MODAL_WITH_SELECTION_COMMAND",
  },
  restoreSelectionForInsertionSpy: vi.fn(),
  showModalSpy: vi.fn(),
  updateToolbarStateSpy: vi.fn(),
}));

vi.mock("@/components/lexical/editor/context/SettingsContext", () => ({
  useSettings: () => ({
    settings: {
      isCodeHighlighted: false,
    },
  }),
}));

vi.mock("@/components/lexical/editor/context/ToolbarContext", () => ({
  blockTypeToBlockName: {
    paragraph: "Normal",
  },
  useToolbarState: () => ({
    toolbarState: {
      bgColor: "#000000",
      blockType: "paragraph",
      canRedo: false,
      canUndo: false,
      codeLanguage: "javascript",
      elementFormat: "left",
      fontColor: "#ffffff",
      isBold: false,
      isCapitalize: false,
      isCode: false,
      isImageCaption: false,
      isItalic: false,
      isHighlight: false,
      isLink: false,
      isLowercase: false,
      isRTL: false,
      isStrikethrough: false,
      isSubscript: false,
      isSuperscript: false,
      isUnderline: false,
      isUppercase: false,
      rootType: "root",
    },
    updateToolbarState: updateToolbarStateSpy,
  }),
}));

vi.mock("@/components/lexical/editor/hooks/useModal", () => ({
  default: () => [null, showModalSpy],
}));

vi.mock("@/components/lexical/editor/plugins/AutoEmbedPlugin", () => ({
  EmbedConfigs: [
    {
      contentName: "X (Tweet)",
      icon: <span aria-hidden="true">x</span>,
      type: "tweet",
    },
    {
      contentName: "Vídeo do YouTube",
      icon: <span aria-hidden="true">yt</span>,
      type: "youtube-video",
    },
  ],
  OPEN_EMBED_MODAL_WITH_SELECTION_COMMAND: openEmbedModalWithSelectionCommand,
}));

vi.mock("@/components/lexical/editor/plugins/ImagesPlugin/selectionSnapshot", () => ({
  captureCurrentRangeSelection: captureCurrentRangeSelectionSpy,
  restoreSelectionForInsertion: restoreSelectionForInsertionSpy,
}));

vi.mock("@/components/lexical/editor/plugins/ImagesPlugin", () => ({
  InsertImageDialog: (props: unknown) => {
    insertImageDialogPropsSpy(props);
    return <div data-testid="mock-insert-image-dialog" />;
  },
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

vi.mock("@/components/lexical/editor/plugins/ToolbarPlugin/fontSize", () => ({
  default: () => null,
  parseFontSizeForToolbar: () => "16px",
}));

vi.mock("@/components/lexical/editor/plugins/ToolbarPlugin/sticky-state", () => ({
  findToolbarScrollRoot: () => window,
  getScrollRootTop: () => 0,
  getStickyTopPx: () => 0,
  isToolbarStickyStuck: () => false,
}));

vi.mock("@/components/lexical/editor/plugins/ToolbarPlugin/utils", () => ({
  clearFormatting: vi.fn(),
  formatBulletList: vi.fn(),
  formatCheckList: vi.fn(),
  formatCode: vi.fn(),
  formatHeading: vi.fn(),
  formatNumberedList: vi.fn(),
  formatParagraph: vi.fn(),
  formatQuote: vi.fn(),
}));

vi.mock("@/components/lexical/editor/ui/Button", () => ({
  default: (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props} />
  ),
}));

vi.mock("@/components/lexical/editor/ui/DropdownColorPicker", () => ({
  default: () => null,
}));

vi.mock("@/components/lexical/editor/ui/DropDown", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropDownItem: ({
    children,
    onClick,
    onMouseDown,
  }: {
    children: ReactNode;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void;
  }) => (
    <button type="button" onClick={onClick} onMouseDown={onMouseDown}>
      {children}
    </button>
  ),
}));

import { INSERT_COLLAPSIBLE_COMMAND } from "@/components/lexical/editor/plugins/CollapsiblePlugin";
import ToolbarPlugin from "@/components/lexical/editor/plugins/ToolbarPlugin";

const createEditor = () => ({
  dispatchCommand: vi.fn(),
  focus: vi.fn(),
  getEditorState: vi.fn(() => ({
    read: vi.fn(),
  })),
  getElementByKey: vi.fn(() => document.createElement("div")),
  getRootElement: vi.fn(() => document.createElement("div")),
  isEditable: vi.fn(() => true),
  registerCommand: vi.fn(() => () => undefined),
  registerEditableListener: vi.fn(() => () => undefined),
  registerUpdateListener: vi.fn(() => () => undefined),
  update: vi.fn((callback: () => void) => callback()),
});

const getLastModalProps = () => {
  const getContent = showModalSpy.mock.calls.at(-1)?.[1] as
    | ((onClose: () => void) => ReactElement)
    | undefined;

  if (!getContent) {
    throw new Error("Modal was not opened");
  }

  return getContent(vi.fn()).props as {
    selectionSnapshot?: unknown;
  };
};

describe("ToolbarPlugin insert dropdown selection capture", () => {
  beforeEach(() => {
    captureCurrentRangeSelectionSpy.mockReset();
    insertImageDialogPropsSpy.mockReset();
    restoreSelectionForInsertionSpy.mockReset();
    showModalSpy.mockReset();
    updateToolbarStateSpy.mockReset();
  });

  it("captura a selecao da imagem no mousedown antes de abrir a biblioteca", () => {
    const editor = createEditor();
    const selectionSnapshot = { anchor: { key: "a" }, focus: { key: "b" } };

    captureCurrentRangeSelectionSpy.mockReturnValue(selectionSnapshot);

    render(
      <ToolbarPlugin
        activeEditor={editor as never}
        editor={editor as never}
        imageLibraryOptions={undefined}
        setActiveEditor={vi.fn()}
        setIsLinkEditMode={vi.fn()}
      />,
    );

    const imageButton = screen.getByRole("button", { name: /imagem/i });
    fireEvent.mouseDown(imageButton);

    expect(captureCurrentRangeSelectionSpy).toHaveBeenCalledTimes(1);
    expect(captureCurrentRangeSelectionSpy).toHaveBeenCalledWith(editor);

    fireEvent.click(imageButton);

    const dialogProps = insertImageDialogPropsSpy.mock.calls.at(-1)?.[0] as {
      selectionSnapshot?: unknown;
    };

    expect(screen.getByTestId("mock-insert-image-dialog")).toBeInTheDocument();
    expect(dialogProps.selectionSnapshot).toBe(selectionSnapshot);
  });

  it("nao captura selecao para linha horizontal", () => {
    const editor = createEditor();

    render(
      <ToolbarPlugin
        activeEditor={editor as never}
        editor={editor as never}
        imageLibraryOptions={undefined}
        setActiveEditor={vi.fn()}
        setIsLinkEditMode={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /linha horizontal/i }));

    expect(captureCurrentRangeSelectionSpy).not.toHaveBeenCalled();
  });

  it.each([["Tabela"], ["Enquete"], ["Layout de colunas"]])(
    "passa o snapshot salvo para o dialogo de %s",
    (buttonLabel: string) => {
      const editor = createEditor();
      const selectionSnapshot = { anchor: { key: "a" }, focus: { key: "b" } };

      captureCurrentRangeSelectionSpy.mockReturnValue(selectionSnapshot);

      render(
        <ToolbarPlugin
          activeEditor={editor as never}
          editor={editor as never}
          imageLibraryOptions={undefined}
          setActiveEditor={vi.fn()}
          setIsLinkEditMode={vi.fn()}
        />,
      );

      const button = screen.getByRole("button", {
        name: new RegExp(buttonLabel, "i"),
      });
      fireEvent.mouseDown(button);
      fireEvent.click(button);

      expect(captureCurrentRangeSelectionSpy).toHaveBeenLastCalledWith(editor);
      expect(getLastModalProps().selectionSnapshot).toBe(selectionSnapshot);
    },
  );

  it("restaura a selecao antes de inserir uma secao recolhivel", () => {
    const editor = createEditor();
    const selectionSnapshot = { anchor: { key: "a" }, focus: { key: "b" } };

    captureCurrentRangeSelectionSpy.mockReturnValue(selectionSnapshot);

    render(
      <ToolbarPlugin
        activeEditor={editor as never}
        editor={editor as never}
        imageLibraryOptions={undefined}
        setActiveEditor={vi.fn()}
        setIsLinkEditMode={vi.fn()}
      />,
    );

    const collapsibleButton = screen.getByRole("button", { name: /recolh/i });
    fireEvent.mouseDown(collapsibleButton);
    fireEvent.click(collapsibleButton);

    expect(editor.update).toHaveBeenCalledTimes(1);
    expect(restoreSelectionForInsertionSpy).toHaveBeenCalledWith(
      selectionSnapshot,
    );
    expect(editor.dispatchCommand).toHaveBeenCalledWith(
      INSERT_COLLAPSIBLE_COMMAND,
      undefined,
    );
    expect(
      restoreSelectionForInsertionSpy.mock.invocationCallOrder[0],
    ).toBeLessThan(editor.dispatchCommand.mock.invocationCallOrder[0]);
  });

  it.each([
    ["X (Tweet)", "tweet"],
    ["Vídeo do YouTube", "youtube-video"],
  ])(
    "abre o fluxo de embed do toolbar com snapshot para %s",
    (buttonLabel: string, type: string) => {
      const editor = createEditor();
      const selectionSnapshot = { anchor: { key: "a" }, focus: { key: "b" } };

      captureCurrentRangeSelectionSpy.mockReturnValue(selectionSnapshot);

      render(
        <ToolbarPlugin
          activeEditor={editor as never}
          editor={editor as never}
          imageLibraryOptions={undefined}
          setActiveEditor={vi.fn()}
          setIsLinkEditMode={vi.fn()}
        />,
      );

      const embedButton = screen.getByRole("button", { name: buttonLabel });
      fireEvent.mouseDown(embedButton);
      fireEvent.click(embedButton);

      expect(editor.dispatchCommand).toHaveBeenCalledWith(
        openEmbedModalWithSelectionCommand,
        {
          selectionSnapshot,
          type,
        },
      );
    },
  );
});
