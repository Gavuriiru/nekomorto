import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { editorPropsSpy } = vi.hoisted(() => ({
  editorPropsSpy: vi.fn(),
}));

vi.mock("@/components/lexical/LexicalEditorShell", () => ({
  default: (props: unknown) => {
    editorPropsSpy(props);
    return <div data-testid="lexical-editor-shell" />;
  },
}));

vi.mock("@/components/lexical/editor-nodes", () => ({
  default: [],
  editorNodes: [],
}));

vi.mock("@/components/lexical/editor/themes/PlaygroundEditorTheme", () => ({
  default: {},
}));

vi.mock("@/components/lexical/editor/context/SettingsContext", () => ({
  SettingsContext: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/lexical/editor/context/SharedHistoryContext", () => ({
  SharedHistoryContext: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/lexical/editor/context/ToolbarContext", () => ({
  ToolbarContext: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/lexical/editor/plugins/TablePlugin", () => ({
  TableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/lexical/editor/context/FlashMessageContext", () => ({
  FlashMessageContext: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/lexical/editor/context/PollContext", () => ({
  PollProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import LexicalEditor from "@/components/lexical/LexicalEditor";

const EMPTY_ROOT_STATE = JSON.stringify({
  root: {
    children: [],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
});

const INVALID_TOP_LEVEL_TEXT_STATE = JSON.stringify({
  root: {
    children: [
      {
        detail: 0,
        format: 0,
        mode: "normal",
        style: "",
        text: "texto invalido",
        type: "text",
        version: 1,
      },
    ],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
});

describe("LexicalEditor", () => {
  beforeEach(() => {
    editorPropsSpy.mockReset();
  });

  it("nao crasha com json invalido", () => {
    expect(() =>
      render(<LexicalEditor value="{" onChange={vi.fn()} placeholder="Digite aqui" />),
    ).not.toThrow();

    expect(screen.getByTestId("lexical-editor-shell")).toBeInTheDocument();
  });

  it("nao crasha com root vazio", () => {
    expect(() =>
      render(
        <LexicalEditor value={EMPTY_ROOT_STATE} onChange={vi.fn()} placeholder="Digite aqui" />,
      ),
    ).not.toThrow();

    expect(screen.getByTestId("lexical-editor-shell")).toBeInTheDocument();
  });

  it("nao crasha com estrutura invalida no topo", () => {
    expect(() =>
      render(
        <LexicalEditor
          value={INVALID_TOP_LEVEL_TEXT_STATE}
          onChange={vi.fn()}
          placeholder="Digite aqui"
        />,
      ),
    ).not.toThrow();

    expect(screen.getByTestId("lexical-editor-shell")).toBeInTheDocument();
  });

  it("repassa autoFocus para o editor interno", () => {
    render(<LexicalEditor value={EMPTY_ROOT_STATE} onChange={vi.fn()} autoFocus={false} />);

    const propsWithDisabledAutoFocus = editorPropsSpy.mock.calls
      .map((call) => call[0] as { autoFocus?: boolean })
      .find((props) => props.autoFocus === false);

    expect(propsWithDisabledAutoFocus).toBeTruthy();
  });

  it("repassa followCaretScroll para o editor interno", () => {
    render(<LexicalEditor value={EMPTY_ROOT_STATE} onChange={vi.fn()} followCaretScroll />);

    const propsWithFollowCaretScroll = editorPropsSpy.mock.calls
      .map((call) => call[0] as { followCaretScroll?: boolean })
      .find((props) => props.followCaretScroll === true);

    expect(propsWithFollowCaretScroll).toBeTruthy();
  });
});
