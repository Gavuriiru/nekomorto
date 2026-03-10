import * as React from "react";
import {
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
  DecoratorNode,
} from "lexical";

import { extractSerializedLexicalText } from "./viewer-node-utils";

type StickyColor = "pink" | "yellow";

type SerializedCaptionEditor = {
  editorState?: unknown;
};

export type SerializedViewerStickyNode = Spread<
  {
    caption: SerializedCaptionEditor;
    color: StickyColor;
    xOffset: number;
    yOffset: number;
  },
  SerializedLexicalNode
>;

const stickyClasses: Record<StickyColor, string> = {
  pink: "border-pink-300/70 bg-pink-100/90 text-pink-950",
  yellow: "border-amber-300/70 bg-amber-100/90 text-amber-950",
};

const ViewerSticky = ({ caption, color }: { caption: string; color: StickyColor }) => (
  <aside
    className={`inline-flex max-w-sm flex-col gap-2 rounded-2xl border px-4 py-3 shadow-sm ${stickyClasses[color]}`}
  >
    <span className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">Nota</span>
    <p className="whitespace-pre-wrap text-sm">{caption || "Nota adesiva"}</p>
  </aside>
);

export class ViewerStickyNode extends DecoratorNode<JSX.Element> {
  __caption: string;
  __color: StickyColor;
  __x: number;
  __y: number;

  static getType(): string {
    return "sticky";
  }

  static clone(node: ViewerStickyNode): ViewerStickyNode {
    return new ViewerStickyNode(node.__x, node.__y, node.__color, node.__caption, node.__key);
  }

  static importJSON(serializedNode: SerializedViewerStickyNode): ViewerStickyNode {
    return new ViewerStickyNode(
      serializedNode.xOffset,
      serializedNode.yOffset,
      serializedNode.color,
      extractSerializedLexicalText(serializedNode.caption),
    ).updateFromJSON(serializedNode);
  }

  constructor(x: number, y: number, color: StickyColor, caption = "", key?: NodeKey) {
    super(key);
    this.__x = x;
    this.__y = y;
    this.__color = color;
    this.__caption = caption;
  }

  exportJSON(): SerializedViewerStickyNode {
    return {
      ...super.exportJSON(),
      caption: this.__caption
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
                        text: this.__caption,
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
        : { editorState: { root: { children: [], direction: null, format: "", indent: 0, type: "root", version: 1 } } },
      color: this.__color,
      xOffset: this.__x,
      yOffset: this.__y,
    };
  }

  createDOM(): HTMLElement {
    return document.createElement("div");
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <ViewerSticky caption={this.__caption} color={this.__color} />;
  }

  isIsolated(): true {
    return true;
  }
}

export const $isViewerStickyNode = (
  node: LexicalNode | null | undefined,
): node is ViewerStickyNode => node instanceof ViewerStickyNode;
