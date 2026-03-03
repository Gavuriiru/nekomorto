import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { editorPropsSpy } = vi.hoisted(() => ({
  editorPropsSpy: vi.fn(),
}));

vi.mock("@/lexical-playground/Editor", () => ({
  default: (props: unknown) => {
    editorPropsSpy(props);
    return <div data-testid="lexical-editor-shell" />;
  },
}));

vi.mock("@/lexical-playground/nodes/PlaygroundNodes", () => ({
  default: [],
}));

vi.mock("@/lexical-playground/themes/PlaygroundEditorTheme", () => ({
  default: {},
}));

vi.mock("@/lexical-playground/context/SettingsContext", () => ({
  SettingsContext: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lexical-playground/context/SharedHistoryContext", () => ({
  SharedHistoryContext: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lexical-playground/context/ToolbarContext", () => ({
  ToolbarContext: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lexical-playground/plugins/TablePlugin", () => ({
  TableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lexical-playground/context/FlashMessageContext", () => ({
  FlashMessageContext: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lexical-playground/context/PollContext", () => ({
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
      render(<LexicalEditor value={EMPTY_ROOT_STATE} onChange={vi.fn()} placeholder="Digite aqui" />),
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
});
