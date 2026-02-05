/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import {
  $applyNodeReplacement,
  createCommand,
  DecoratorNode,
  type LexicalCommand,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";

export type ImageAlignment = "left" | "center" | "right";

export type ImagePayload = {
  src: string;
  altText?: string;
  width?: string;
  align?: ImageAlignment;
};

export type SerializedImageNode = Spread<
  {
    type: "image";
    version: 1;
    src: string;
    altText: string;
    width?: string;
    align?: ImageAlignment;
  },
  SerializedLexicalNode
>;

export const INSERT_IMAGE_COMMAND: LexicalCommand<ImagePayload> = createCommand("INSERT_IMAGE_COMMAND");

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __width?: string;
  __align?: ImageAlignment;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__width, node.__align, node.__key);
  }

  constructor(src: string, altText: string, width?: string, align?: ImageAlignment, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width;
    this.__align = align;
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      width: serializedNode.width,
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
          const align = (() => {
            const marginLeft = node.style.marginLeft;
            const marginRight = node.style.marginRight;
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
          })();
          return {
            node: $createImageNode({
              src: node.src,
              altText: node.alt || "",
              width: node.style.width || node.getAttribute("width") || undefined,
              align,
            }),
          };
        },
        priority: 0,
      }),
    };
  }

  exportJSON(): SerializedImageNode {
    return {
      type: "image",
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      align: this.__align,
    };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "lexical-image-wrapper";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): { element: HTMLElement } {
    const img = document.createElement("img");
    img.setAttribute("src", this.__src);
    img.setAttribute("alt", this.__altText);
    img.setAttribute("loading", "lazy");
    img.setAttribute("data-lexical-node", "image");
    if (this.__width) {
      img.style.width = this.__width;
    }
    if (this.__align === "left") {
      img.style.marginLeft = "0";
      img.style.marginRight = "auto";
    }
    if (this.__align === "right") {
      img.style.marginLeft = "auto";
      img.style.marginRight = "0";
    }
    if (this.__align === "center") {
      img.style.marginLeft = "auto";
      img.style.marginRight = "auto";
      img.style.display = "block";
    }
    return { element: img };
  }

  decorate(): JSX.Element {
    const alignStyle: React.CSSProperties = {};
    if (this.__align === "left") {
      alignStyle.marginLeft = 0;
      alignStyle.marginRight = "auto";
    }
    if (this.__align === "right") {
      alignStyle.marginLeft = "auto";
      alignStyle.marginRight = 0;
    }
    if (this.__align === "center") {
      alignStyle.marginInline = "auto";
      alignStyle.display = "block";
    }
    if (this.__width) {
      alignStyle.width = this.__width;
    }
    return (
      <img
        src={this.__src}
        alt={this.__altText}
        className="lexical-image"
        style={alignStyle}
        loading="lazy"
        draggable={false}
      />
    );
  }
}

export const $createImageNode = (payload: ImagePayload): ImageNode => {
  const { src, altText = "", width, align } = payload;
  return $applyNodeReplacement(new ImageNode(src, altText, width, align));
};

export const $isImageNode = (node: unknown): node is ImageNode => node instanceof ImageNode;
