import { Suspense } from "react";
import { axe } from "jest-axe";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { $createListItemNode, $createListNode } from "@lexical/list";
import { $createMarkNode } from "@lexical/mark";
import { createEditor, $createParagraphNode, $createTextNode, $getRoot } from "lexical";

import LexicalViewer from "@/components/lexical/LexicalViewer";
import LexicalViewerNodes from "@/components/lexical/LexicalViewerNodes";
import {
  $createViewerPollNode,
  createViewerPollOption,
} from "@/components/lexical/viewer-nodes/ViewerPollNode";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const serializeViewerState = (build: () => void) => {
  const editor = createEditor({
    namespace: "LexicalViewerA11yTest",
    nodes: LexicalViewerNodes,
    editable: false,
    onError: (error: Error) => {
      throw error;
    },
  });

  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      build();
    },
    { discrete: true },
  );

  return JSON.stringify(editor.getEditorState().toJSON());
};

describe("LexicalViewer accessibility", () => {
  it("normaliza checklist, rotula enquete e preserva highlight sem violacoes", async () => {
    const value = serializeViewerState(() => {
      const checklist = $createListNode("check");
      const checkedItem = $createListItemNode(true);
      checkedItem.append($createTextNode("Ler capítulo"));
      const uncheckedItem = $createListItemNode(false);
      uncheckedItem.append($createTextNode("Comentar depois"));
      checklist.append(checkedItem, uncheckedItem);

      const highlightedParagraph = $createParagraphNode();
      highlightedParagraph.append($createTextNode("Antes "));
      const mark = $createMarkNode(["highlight-1"]);
      mark.append($createTextNode("trecho destacado"));
      highlightedParagraph.append(mark);
      highlightedParagraph.append($createTextNode(" depois"));

      const poll = $createViewerPollNode("Escolha uma opção", [
        createViewerPollOption("Opção A"),
        createViewerPollOption("Opção B"),
      ]);

      $getRoot().append(checklist, highlightedParagraph, poll);
    });

    const { container } = render(
      <Suspense fallback={<div>Carregando viewer...</div>}>
        <LexicalViewer value={value} ariaLabel="Conteúdo de acessibilidade" />
      </Suspense>,
    );

    expect(await screen.findByText("Escolha uma opção")).toBeInTheDocument();
    expect(screen.getByLabelText("Escolha uma opção: Opção A")).toBeInTheDocument();
    expect(screen.getByLabelText("Escolha uma opção: Opção B")).toBeInTheDocument();

    const checklistItems = container.querySelectorAll("li[data-lexical-checklist-item='true']");
    expect(checklistItems).toHaveLength(2);
    checklistItems.forEach((item) => {
      expect(item).not.toHaveAttribute("role");
      expect(item).not.toHaveAttribute("tabindex");
      expect(item).not.toHaveAttribute("aria-checked");
    });

    const highlightedText = screen.getByText("trecho destacado");
    expect(highlightedText.closest("mark")).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });
});
