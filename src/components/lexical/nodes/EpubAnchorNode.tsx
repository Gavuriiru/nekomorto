import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";

export type SerializedEpubAnchorNode = Spread<
  {
    type: "epub-anchor";
    version: 1;
    anchorId: string;
  },
  SerializedLexicalNode
>;

type EpubAnchorPayload = {
  anchorId: string;
};

const normalizeAnchorId = (value: unknown) => {
  const trimmed = String(value || "")
    .trim()
    .replace(/^#/, "");
  if (!trimmed) {
    return "";
  }
  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
};

const applyAnchorAttributes = (element: HTMLElement, anchorId: string) => {
  element.setAttribute("id", anchorId);
  element.setAttribute("data-lexical-epub-anchor", anchorId);
  element.setAttribute("aria-hidden", "true");
  element.style.display = "inline-block";
  element.style.width = "0";
  element.style.height = "0";
  element.style.overflow = "hidden";
  element.style.lineHeight = "0";
  element.style.pointerEvents = "none";
};

const convertAnchorNode = (node: Node): DOMConversionOutput | null => {
  if (node.nodeType !== 1) {
    return null;
  }
  const element = node as Element;
  const anchorId = normalizeAnchorId(
    element.getAttribute("data-epub-anchor") || element.getAttribute("id") || "",
  );
  if (!anchorId) {
    return null;
  }
  return {
    node: $createEpubAnchorNode({ anchorId }),
  };
};

export class EpubAnchorNode extends DecoratorNode<null> {
  __anchorId: string;

  static getType(): string {
    return "epub-anchor";
  }

  static clone(node: EpubAnchorNode): EpubAnchorNode {
    return new EpubAnchorNode(node.__anchorId, node.__key);
  }

  static importJSON(serializedNode: SerializedEpubAnchorNode): EpubAnchorNode {
    return $createEpubAnchorNode({ anchorId: serializedNode.anchorId });
  }

  static importDOM(): DOMConversionMap | null {
    const hasAnchorId = (domNode: Node) =>
      domNode.nodeType === 1 &&
      Boolean(
        normalizeAnchorId(
          (domNode as Element).getAttribute("data-epub-anchor") ||
            (domNode as Element).getAttribute("id") ||
            "",
        ),
      );
    const createConversion = (domNode: Node) =>
      hasAnchorId(domNode)
        ? {
            conversion: convertAnchorNode,
            priority: 4 as const,
          }
        : null;

    return {
      "epub-anchor": createConversion,
      span: createConversion,
    };
  }

  constructor(anchorId: string, key?: NodeKey) {
    super(key);
    this.__anchorId = normalizeAnchorId(anchorId);
  }

  isInline(): boolean {
    return true;
  }

  exportJSON(): SerializedEpubAnchorNode {
    return {
      type: "epub-anchor",
      version: 1,
      anchorId: this.__anchorId,
    };
  }

  createDOM(): HTMLElement {
    const element = document.createElement("span");
    applyAnchorAttributes(element, this.__anchorId);
    return element;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): { element: HTMLElement } {
    const element = document.createElement("span");
    applyAnchorAttributes(element, this.__anchorId);
    return { element };
  }

  decorate(): null {
    return null;
  }
}

export const $createEpubAnchorNode = ({ anchorId }: EpubAnchorPayload) =>
  $applyNodeReplacement(new EpubAnchorNode(anchorId));

export const $isEpubAnchorNode = (node: LexicalNode | null | undefined): node is EpubAnchorNode =>
  node instanceof EpubAnchorNode;
