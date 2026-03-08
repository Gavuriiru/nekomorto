import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lexical-playground/Editor", () => ({
  default: () => <div data-testid="lexical-viewer-shell" />,
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

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
}));

import LexicalViewer from "@/components/lexical/LexicalViewer";

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

describe("LexicalViewer", () => {
  it("nao crasha com json invalido", () => {
    expect(() => render(<LexicalViewer value="{" />)).not.toThrow();

    expect(screen.getByTestId("lexical-viewer-shell")).toBeInTheDocument();
  });

  it("nao crasha com root vazio", () => {
    expect(() => render(<LexicalViewer value={EMPTY_ROOT_STATE} />)).not.toThrow();

    expect(screen.getByTestId("lexical-viewer-shell")).toBeInTheDocument();
  });

  it("nao crasha com estrutura invalida no topo", () => {
    expect(() => render(<LexicalViewer value={INVALID_TOP_LEVEL_TEXT_STATE} />)).not.toThrow();

    expect(screen.getByTestId("lexical-viewer-shell")).toBeInTheDocument();
  });

  it("marca o wrapper com a classe do viewer sem perder classes externas", () => {
    const { container } = render(
      <LexicalViewer value={EMPTY_ROOT_STATE} className="reader-content post-content" />,
    );

    const viewerRoot = container.querySelector(".lexical-playground");
    expect(viewerRoot).toHaveClass("lexical-playground--viewer");
    expect(viewerRoot).toHaveClass("reader-content");
    expect(viewerRoot).toHaveClass("post-content");
  });
});
