import * as React from "react";
import {
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalNode,
  type SerializedLexicalNode,
  DecoratorNode,
} from "lexical";

export type SerializedViewerPageBreakNode = SerializedLexicalNode;

const ViewerPageBreak = () => (
  <div
    aria-hidden="true"
    className="my-6 border-t border-dashed border-border/70"
    data-lexical-page-break="true"
  />
);

const convertPageBreakElement = (): DOMConversionOutput => ({
  node: $createViewerPageBreakNode(),
});

export class ViewerPageBreakNode extends DecoratorNode<JSX.Element> {
  static getType(): string {
    return "page-break";
  }

  static clone(node: ViewerPageBreakNode): ViewerPageBreakNode {
    return new ViewerPageBreakNode(node.__key);
  }

  static importJSON(serializedNode: SerializedViewerPageBreakNode): ViewerPageBreakNode {
    return $createViewerPageBreakNode().updateFromJSON(serializedNode);
  }

  static importDOM() {
    return {
      figure: (domNode: HTMLElement) =>
        domNode.getAttribute("type") === "page-break"
          ? {
              conversion: convertPageBreakElement,
              priority: 4 as const,
            }
          : null,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("figure");
    element.style.pageBreakAfter = "always";
    element.setAttribute("type", this.getType());
    return { element };
  }

  createDOM(): HTMLElement {
    const element = document.createElement("figure");
    element.style.pageBreakAfter = "always";
    element.setAttribute("type", this.getType());
    return element;
  }

  updateDOM(): false {
    return false;
  }

  getTextContent(): string {
    return "\n";
  }

  isInline(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <ViewerPageBreak />;
  }
}

export const $createViewerPageBreakNode = () => new ViewerPageBreakNode();

export const $isViewerPageBreakNode = (
  node: LexicalNode | null | undefined,
): node is ViewerPageBreakNode => node instanceof ViewerPageBreakNode;
