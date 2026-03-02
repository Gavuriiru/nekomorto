/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import {
  $applyNodeReplacement,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";

import {
  applyEditorialStyleToElement,
  extractImageEditorialStyle,
  parseStyleDeclaration,
  styleDeclarationToReactStyle,
} from "./epub-style";

export type SerializedEpubImageNode = Spread<
  {
    type: "epub-image";
    version: 1;
    src: string;
    altText: string;
    editorialStyle: string;
  },
  SerializedLexicalNode
>;

export type EpubImagePayload = {
  src: string;
  altText?: string;
  editorialStyle?: string;
};

const isBlockImageStyle = (style: string) => {
  const record = parseStyleDeclaration(style);
  return record.display === "block";
};

export class EpubImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __editorialStyle: string;

  static getType(): string {
    return "epub-image";
  }

  static clone(node: EpubImageNode): EpubImageNode {
    return new EpubImageNode(node.__src, node.__altText, node.__editorialStyle, node.__key);
  }

  static importJSON(serializedNode: SerializedEpubImageNode): EpubImageNode {
    return $createEpubImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      editorialStyle: serializedNode.editorialStyle,
    });
  }

  static importDOM() {
    return {
      img: () => ({
        conversion: (node: Node) => {
          if (!(node instanceof HTMLImageElement)) {
            return null;
          }
          const editorialStyle = extractImageEditorialStyle(node.style);
          const src = node.getAttribute("src") || "";
          if (!src) {
            return null;
          }
          return {
            node: $createEpubImageNode({
              src,
              altText: node.getAttribute("alt") || "",
              editorialStyle,
            }),
          };
        },
        priority: 1 as const,
      }),
    };
  }

  constructor(src: string, altText: string, editorialStyle = "", key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__editorialStyle = editorialStyle;
  }

  isInline(): boolean {
    return !isBlockImageStyle(this.__editorialStyle);
  }

  exportJSON(): SerializedEpubImageNode {
    return {
      type: "epub-image",
      version: 1,
      src: this.__src,
      altText: this.__altText,
      editorialStyle: this.__editorialStyle,
    };
  }

  createDOM(): HTMLElement {
    const element = document.createElement("span");
    element.className = "lexical-epub-image-wrapper";
    if (this.isInline()) {
      element.classList.add("lexical-epub-image-wrapper--inline");
    } else {
      element.classList.add("lexical-epub-image-wrapper--block");
    }
    return element;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): { element: HTMLElement } {
    const img = document.createElement("img");
    img.setAttribute("src", this.__src);
    img.setAttribute("alt", this.__altText);
    img.setAttribute("loading", "lazy");
    applyEditorialStyleToElement(img, this.__editorialStyle);
    return { element: img };
  }

  decorate(): JSX.Element {
    const style = styleDeclarationToReactStyle(this.__editorialStyle);
    const isBlock = this.isInline() === false;
    return (
      <span
        className={`lexical-epub-image-shell ${isBlock ? "lexical-epub-image-shell--block" : "lexical-epub-image-shell--inline"}`}
      >
        <img
          src={this.__src}
          alt={this.__altText}
          className="lexical-epub-image"
          style={style}
          loading="lazy"
          draggable={false}
        />
      </span>
    );
  }
}

export const $createEpubImageNode = ({
  src,
  altText = "",
  editorialStyle = "",
}: EpubImagePayload) => $applyNodeReplacement(new EpubImageNode(src, altText, editorialStyle));

export const $isEpubImageNode = (node: LexicalNode | null | undefined): node is EpubImageNode =>
  node instanceof EpubImageNode;
