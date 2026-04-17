import { HeadingNode } from "@lexical/rich-text";
import {
  $applyNodeReplacement,
  $createParagraphNode,
  type ElementFormatType,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from "lexical";

import {
  applyEditorialStyleToElement,
  extractBlockEditorialStyle,
  hasEditorialBlockStyle,
} from "./epub-style";

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export type SerializedEpubHeadingNode = Spread<
  {
    type: "epub-heading";
    version: 1;
    tag: HeadingTag;
    editorialStyle: string;
  },
  SerializedElementNode
>;

export class EpubHeadingNode extends HeadingNode {
  __editorialStyle: string;

  static getType(): string {
    return "epub-heading";
  }

  static clone(node: EpubHeadingNode): EpubHeadingNode {
    return new EpubHeadingNode(node.getTag(), node.__editorialStyle, node.__key);
  }

  static importJSON(serializedNode: SerializedEpubHeadingNode): EpubHeadingNode {
    return $createEpubHeadingNode({
      tag: serializedNode.tag,
      editorialStyle: serializedNode.editorialStyle,
    }).updateFromJSON(serializedNode);
  }

  static importDOM() {
    const createHeadingConversion = (fallbackTag?: HeadingTag) => ({
      conversion: (node: Node) => {
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const hintedTag = String(
          node.getAttribute("data-epub-heading") || "",
        ).toLowerCase() as HeadingTag;
        const explicitTag = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(hintedTag)
          ? hintedTag
          : undefined;
        const tag =
          explicitTag || fallbackTag || (String(node.tagName || "").toLowerCase() as HeadingTag);
        if (!["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
          return null;
        }
        if (!fallbackTag && !hasEditorialBlockStyle(node.style)) {
          return null;
        }
        if (fallbackTag && !node.hasAttribute("data-epub-heading")) {
          return null;
        }
        const { format, editorialStyle } = extractBlockEditorialStyle(node.style);
        const heading = $createEpubHeadingNode({ tag, editorialStyle });
        if (format) {
          heading.setFormat(format as ElementFormatType);
        }
        return { node: heading };
      },
      priority: 3 as const,
    });

    return {
      h1: () => createHeadingConversion(),
      h2: () => createHeadingConversion(),
      h3: () => createHeadingConversion(),
      h4: () => createHeadingConversion(),
      h5: () => createHeadingConversion(),
      h6: () => createHeadingConversion(),
      p: () => createHeadingConversion("h2"),
      blockquote: () => createHeadingConversion("h2"),
    };
  }

  constructor(tag: HeadingTag, editorialStyle = "", key?: NodeKey) {
    super(tag, key);
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

  updateFromJSON(serializedNode: SerializedEpubHeadingNode): this {
    return super
      .updateFromJSON(serializedNode)
      .setTag(serializedNode.tag)
      .setEditorialStyle(serializedNode.editorialStyle || "");
  }

  createDOM(config: Parameters<HeadingNode["createDOM"]>[0]): HTMLElement {
    const dom = super.createDOM(config);
    applyEditorialStyleToElement(dom, this.getEditorialStyle());
    return dom;
  }

  updateDOM(
    prevNode: HeadingNode,
    dom: HTMLElement,
    _config: Parameters<HeadingNode["createDOM"]>[0],
  ) {
    const needsRemount = prevNode.getTag() !== this.getTag();
    if (!needsRemount) {
      applyEditorialStyleToElement(dom, this.getEditorialStyle());
    }
    return needsRemount;
  }

  exportDOM(editor: Parameters<HeadingNode["exportDOM"]>[0]) {
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

  exportJSON(): SerializedEpubHeadingNode {
    return {
      ...super.exportJSON(),
      type: "epub-heading",
      version: 1,
      tag: this.getTag() as HeadingTag,
      editorialStyle: this.getEditorialStyle(),
    };
  }

  insertNewAfter(selection: Parameters<HeadingNode["insertNewAfter"]>[0], restoreSelection = true) {
    const anchorOffset = selection ? selection.anchor.offset : 0;
    const lastDesc = this.getLastDescendant();
    const isAtEnd =
      !lastDesc ||
      (selection &&
        selection.anchor.key === lastDesc.getKey() &&
        anchorOffset === lastDesc.getTextContentSize());
    const newElement =
      isAtEnd || !selection
        ? $createParagraphNode()
        : $createEpubHeadingNode({
            tag: this.getTag() as HeadingTag,
            editorialStyle: this.getEditorialStyle(),
          });
    newElement.setDirection(this.getDirection());
    this.insertAfter(newElement, restoreSelection);
    if (anchorOffset === 0 && !this.isEmpty() && selection) {
      const paragraph = $createParagraphNode();
      paragraph.select();
      this.replace(paragraph, true);
    }
    return newElement;
  }
}

export const $createEpubHeadingNode = ({
  tag,
  editorialStyle = "",
}: {
  tag: HeadingTag;
  editorialStyle?: string;
}) => $applyNodeReplacement(new EpubHeadingNode(tag, editorialStyle));

export const $isEpubHeadingNode = (node: LexicalNode | null | undefined): node is EpubHeadingNode =>
  node instanceof EpubHeadingNode;
