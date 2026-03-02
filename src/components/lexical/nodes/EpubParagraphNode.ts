import {
  $applyNodeReplacement,
  $createParagraphNode,
  ParagraphNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type RangeSelection,
  type SerializedElementNode,
  type Spread,
} from "lexical";

import { applyEditorialStyleToElement, extractBlockEditorialStyle, hasEditorialBlockStyle } from "./epub-style";

export type SerializedEpubParagraphNode = Spread<
  {
    type: "epub-paragraph";
    version: 1;
    editorialStyle: string;
  },
  SerializedElementNode
>;

export class EpubParagraphNode extends ParagraphNode {
  __editorialStyle: string;

  static getType(): string {
    return "epub-paragraph";
  }

  static clone(node: EpubParagraphNode): EpubParagraphNode {
    return new EpubParagraphNode(node.__editorialStyle, node.__key);
  }

  static importJSON(serializedNode: SerializedEpubParagraphNode): EpubParagraphNode {
    return $createEpubParagraphNode({
      editorialStyle: serializedNode.editorialStyle,
    }).updateFromJSON(serializedNode);
  }

  static importDOM() {
    const createConversion = () => ({
      conversion: (node: Node) => {
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        if (node.hasAttribute("data-epub-heading") || !hasEditorialBlockStyle(node.style)) {
          return null;
        }
        const { format, editorialStyle } = extractBlockEditorialStyle(node.style);
        const paragraph = $createEpubParagraphNode({ editorialStyle });
        if (format) {
          paragraph.setFormat(format);
        }
        return { node: paragraph };
      },
      priority: 3 as const,
    });

    return {
      "epub-p": createConversion,
      p: createConversion,
      blockquote: createConversion,
    };
  }

  constructor(editorialStyle = "", key?: NodeKey) {
    super(key);
    this.__editorialStyle = editorialStyle;
  }

  getEditorialStyle(): string {
    return this.getLatest().__editorialStyle;
  }

  setEditorialStyle(editorialStyle: string) {
    const writable = this.getWritable();
    writable.__editorialStyle = editorialStyle.trim();
    return writable;
  }

  updateFromJSON(serializedNode: SerializedEpubParagraphNode): this {
    return super.updateFromJSON(serializedNode).setEditorialStyle(serializedNode.editorialStyle || "");
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    applyEditorialStyleToElement(dom, this.getEditorialStyle());
    return dom;
  }

  updateDOM(prevNode: EpubParagraphNode, dom: HTMLElement, config: EditorConfig): false {
    super.updateDOM(prevNode, dom, config);
    applyEditorialStyleToElement(dom, this.getEditorialStyle());
    return false;
  }

  exportDOM(editor: Parameters<ParagraphNode["exportDOM"]>[0]) {
    const result = super.exportDOM(editor);
    if (result.element instanceof HTMLElement) {
      applyEditorialStyleToElement(result.element, this.getEditorialStyle());
      const formatType = this.getFormatType();
      if (formatType) {
        result.element.style.textAlign = formatType;
      }
    }
    return result;
  }

  exportJSON(): SerializedEpubParagraphNode {
    return {
      ...super.exportJSON(),
      type: "epub-paragraph",
      version: 1,
      editorialStyle: this.getEditorialStyle(),
    };
  }

  insertNewAfter(rangeSelection: RangeSelection, restoreSelection: boolean): ParagraphNode {
    const newElement = $createEpubParagraphNode({
      editorialStyle: this.getEditorialStyle(),
    });
    newElement.setTextFormat(rangeSelection.format);
    newElement.setTextStyle(rangeSelection.style);
    newElement.setDirection(this.getDirection());
    newElement.setFormat(this.getFormatType());
    this.insertAfter(newElement, restoreSelection);
    return newElement;
  }
}

export const $createEpubParagraphNode = ({
  editorialStyle = "",
}: {
  editorialStyle?: string;
}) => $applyNodeReplacement(new EpubParagraphNode(editorialStyle));

export const $isEpubParagraphNode = (node: LexicalNode | null | undefined): node is EpubParagraphNode =>
  node instanceof EpubParagraphNode;

export const $createParagraphLikeNode = (editorialStyle = "") =>
  editorialStyle ? $createEpubParagraphNode({ editorialStyle }) : $createParagraphNode();
