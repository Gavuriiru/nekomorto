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

    let element: HTMLElement | null = null;
    editor.update(() => {
      const node = new ViewerPollNode()
        .setQuestion("Pergunta")
        .setOptions([createViewerPollOption("Opção A")]);

      element = node.createDOM();
    });

    expect(element?.tagName).toBe("SPAN");
    expect(element?.style.display).toBe("block");
    expect(element?.style.width).toBe("100%");
    expect(element?.getAttribute("data-lexical-viewer-poll")).toBe("true");
  });
});
