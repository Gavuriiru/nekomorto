import { createEditor } from "lexical";
import { describe, expect, it } from "vitest";

import {
  ViewerPollNode,
  createViewerPollOption,
} from "@/components/lexical/viewer-nodes/ViewerPollNode";

describe("ViewerPollNode", () => {
  it("cria host block-level com largura previsivel no viewer publico", () => {
    const editor = createEditor({
      namespace: "ViewerPollNodeTest",
      nodes: [ViewerPollNode],
      onError: (error: Error) => {
        throw error;
      },
    });

    const state = {
      element: null as HTMLElement | null,
    };
    editor.update(() => {
      const node = new ViewerPollNode()
        .setQuestion("Pergunta")
        .setOptions([createViewerPollOption("Opção A")]);

      state.element = node.createDOM();
    });

    const element = state.element;
    expect(element).not.toBeNull();
    if (!(element instanceof HTMLElement)) {
      throw new Error("Expected poll DOM element");
    }
    expect(element.tagName).toBe("SPAN");
    expect(element.style.display).toBe("block");
    expect(element.style.width).toBe("100%");
    expect(element.getAttribute("data-lexical-viewer-poll")).toBe("true");
  });
});
