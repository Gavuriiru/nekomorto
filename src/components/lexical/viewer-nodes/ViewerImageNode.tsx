import * as React from "react";
import {
  $applyNodeReplacement,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
  DecoratorNode,
} from "lexical";

import { extractSerializedLexicalText, toPixelValue } from "./viewer-node-utils";

type SerializedCaptionEditor = {
  editorState?: unknown;
};

export type SerializedViewerImageNode = Spread<
  {
    altText: string;
    caption?: SerializedCaptionEditor;
    height?: number;
    maxWidth?: number;
    showCaption?: boolean;
    src: string;
    width?: number;
  },
  SerializedLexicalNode
>;

type ViewerImageProps = {
  altText: string;
  captionText?: string;
  height?: number;
  maxWidth?: number;
  showCaption?: boolean;
  src: string;
  width?: number;
};

const ViewerImage = ({
  altText,
  captionText,
  height,
  maxWidth,
  showCaption,
  src,
  width,
}: ViewerImageProps) => {
  const imageStyle: React.CSSProperties = {
    height: toPixelValue(height),
    maxWidth: toPixelValue(maxWidth) ?? "100%",
    width: toPixelValue(width) ?? "100%",
  };

  return (
    <figure className="lexical-image-wrapper">
      <img src={src} alt={altText} className="lexical-image" style={imageStyle} loading="lazy" />
      {showCaption && captionText ? (
        <figcaption className="mt-2 text-sm text-muted-foreground">{captionText}</figcaption>
      ) : null}
    </figure>
  );
};

const convertImageElement = (domNode: Node): DOMConversionOutput | null => {
  if (!(domNode instanceof HTMLImageElement)) {
    return null;
  }

  const src = domNode.getAttribute("src");
  if (!src || src.startsWith("file:///")) {
    return null;
  }

  return {
    node: $createViewerImageNode({
      altText: domNode.alt,
      height: domNode.height || undefined,
      src,
      width: domNode.width || undefined,
    }),
  };
};

export class ViewerImageNode extends DecoratorNode<JSX.Element> {
  __altText: string;
  __captionText: string;
  __height?: number;
  __maxWidth?: number;
  __showCaption: boolean;
  __src: string;
  __width?: number;

  static getType(): string {
    return "image";
  }

  static clone(node: ViewerImageNode): ViewerImageNode {
    return new ViewerImageNode(
      node.__src,
      node.__altText,
      node.__captionText,
      node.__maxWidth,
      node.__width,
      node.__height,
      node.__showCaption,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedViewerImageNode): ViewerImageNode {
    return $createViewerImageNode({
      altText: serializedNode.altText,
      captionText: extractSerializedLexicalText(serializedNode.caption),
      height: serializedNode.height,
      maxWidth: serializedNode.maxWidth,
      showCaption: serializedNode.showCaption,
      src: serializedNode.src,
      width: serializedNode.width,
    }).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: convertImageElement,
        priority: 0,
      }),
    };
  }

  constructor(
    src: string,
    altText: string,
    captionText = "",
    maxWidth?: number,
    width?: number,
    height?: number,
    showCaption = false,
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__captionText = captionText;
    this.__maxWidth = maxWidth;
    this.__width = width;
    this.__height = height;
    this.__showCaption = showCaption;
  }

  exportJSON(): SerializedViewerImageNode {
    return {
      ...super.exportJSON(),
      altText: this.__altText,
      caption: this.__captionText
        ? {
            editorState: {
              root: {
                children: [
                  {
                    children: [
                      {
                        detail: 0,
                        format: 0,
                        mode: "normal",
                        style: "",
                        text: this.__captionText,
                        type: "text",
                        version: 1,
                      },
                    ],
                    direction: null,
                    format: "",
                    indent: 0,
                    textFormat: 0,
                    textStyle: "",
                    type: "paragraph",
                    version: 1,
                  },
                ],
                direction: null,
                format: "",
                indent: 0,
                type: "root",
                version: 1,
              },
            },
          }
        : undefined,
      height: this.__height,
      maxWidth: this.__maxWidth,
      showCaption: this.__showCaption,
      src: this.__src,
      width: this.__width,
    };
  }

  exportDOM(): DOMExportOutput {
    const image = document.createElement("img");
    image.setAttribute("src", this.__src);
    image.setAttribute("alt", this.__altText);
    if (this.__width) {
      image.setAttribute("width", String(this.__width));
    }
    if (this.__height) {
      image.setAttribute("height", String(this.__height));
    }

    if (this.__showCaption && this.__captionText) {
      const figure = document.createElement("figure");
      const figcaption = document.createElement("figcaption");
      figcaption.textContent = this.__captionText;
      figure.append(image, figcaption);
      return { element: figure };
    }

    return { element: image };
  }

  createDOM(): HTMLElement {
    return document.createElement("span");
  }

  updateDOM(): false {
    return false;
  }

  getTextContent(): string {
    return this.__altText || this.__captionText || "";
  }

  decorate(): JSX.Element {
    return (
      <ViewerImage
        altText={this.__altText}
        captionText={this.__captionText}
        height={this.__height}
        maxWidth={this.__maxWidth}
        showCaption={this.__showCaption}
        src={this.__src}
        width={this.__width}
      />
    );
  }
}

export const $createViewerImageNode = ({
  altText,
  captionText = "",
  height,
  maxWidth,
  showCaption,
  src,
  width,
}: {
  altText: string;
  captionText?: string;
  height?: number;
  maxWidth?: number;
  showCaption?: boolean;
  src: string;
  width?: number;
}) =>
  $applyNodeReplacement(
    new ViewerImageNode(src, altText, captionText, maxWidth, width, height, Boolean(showCaption)),
  );

export const $isViewerImageNode = (
  node: LexicalNode | null | undefined,
): node is ViewerImageNode => node instanceof ViewerImageNode;
