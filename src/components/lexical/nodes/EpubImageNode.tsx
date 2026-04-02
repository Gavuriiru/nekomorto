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

export type EpubImageAlignment = "left" | "center" | "right";

export type SerializedEpubImageNode = Spread<
  {
    type: "epub-image";
    version: 1;
    src: string;
    altText: string;
    editorialStyle: string;
    align?: EpubImageAlignment;
  },
  SerializedLexicalNode
>;

export type EpubImagePayload = {
  src: string;
  altText?: string;
  editorialStyle?: string;
  align?: EpubImageAlignment;
};

const normalizeImageAlignment = (value: unknown): EpubImageAlignment | undefined => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "left" || normalized === "center" || normalized === "right") {
    return normalized;
  }
  return undefined;
};

const inferImageAlignment = ({
  dataAlign,
  editorialStyle,
}: {
  dataAlign?: string | null;
  editorialStyle: string;
}): EpubImageAlignment | undefined => {
  const explicitAlign = normalizeImageAlignment(dataAlign);
  if (explicitAlign) {
    return explicitAlign;
  }
  const record = parseStyleDeclaration(editorialStyle);
  const marginLeft = String(record["margin-left"] || "")
    .trim()
    .toLowerCase();
  const marginRight = String(record["margin-right"] || "")
    .trim()
    .toLowerCase();
  if (marginLeft === "auto" && marginRight === "auto") {
    return "center";
  }
  if (marginLeft === "auto") {
    return "right";
  }
  if (marginRight === "auto") {
    return "left";
  }
  return undefined;
};

const isBlockImageStyle = (style: string) => {
  const record = parseStyleDeclaration(style);
  return record.display === "block";
};

export class EpubImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __editorialStyle: string;
  __align?: EpubImageAlignment;

  static getType(): string {
    return "epub-image";
  }

  static clone(node: EpubImageNode): EpubImageNode {
    return new EpubImageNode(
      node.__src,
      node.__altText,
      node.__editorialStyle,
      node.__align,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedEpubImageNode): EpubImageNode {
    return $createEpubImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      editorialStyle: serializedNode.editorialStyle,
      align: serializedNode.align,
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
          const align = inferImageAlignment({
            dataAlign: node.getAttribute("data-epub-align"),
            editorialStyle,
          });
          const src = node.getAttribute("src") || "";
          if (!src) {
            return null;
          }
          return {
            node: $createEpubImageNode({
              src,
              altText: node.getAttribute("alt") || "",
              editorialStyle,
              align,
            }),
          };
        },
        priority: 3 as const,
      }),
    };
  }

  constructor(
    src: string,
    altText: string,
    editorialStyle = "",
    align?: EpubImageAlignment,
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__editorialStyle = editorialStyle;
    this.__align = align;
  }

  isInline(): boolean {
    return !(isBlockImageStyle(this.__editorialStyle) || this.__align);
  }

  exportJSON(): SerializedEpubImageNode {
    return {
      type: "epub-image",
      version: 1,
      src: this.__src,
      altText: this.__altText,
      editorialStyle: this.__editorialStyle,
      align: this.__align,
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
    if (this.__align === "left") {
      img.style.marginLeft = "0";
      img.style.marginRight = "auto";
      img.style.display = "block";
    }
    if (this.__align === "right") {
      img.style.marginLeft = "auto";
      img.style.marginRight = "0";
      img.style.display = "block";
    }
    if (this.__align === "center") {
      img.style.marginLeft = "auto";
      img.style.marginRight = "auto";
      img.style.display = "block";
    }
    return { element: img };
  }

  decorate(): JSX.Element {
    const style = styleDeclarationToReactStyle(this.__editorialStyle);
    const isBlock = this.isInline() === false;
    if (this.__align === "left") {
      style.marginLeft = "0";
      style.marginRight = "auto";
      style.display = "block";
    }
    if (this.__align === "right") {
      style.marginLeft = "auto";
      style.marginRight = "0";
      style.display = "block";
    }
    if (this.__align === "center") {
      style.marginLeft = "auto";
      style.marginRight = "auto";
      style.display = "block";
    }
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
  align,
}: EpubImagePayload) =>
  $applyNodeReplacement(new EpubImageNode(src, altText, editorialStyle, align));

export const $isEpubImageNode = (node: LexicalNode | null | undefined): node is EpubImageNode =>
  node instanceof EpubImageNode;
