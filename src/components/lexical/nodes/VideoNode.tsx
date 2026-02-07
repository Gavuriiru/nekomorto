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

export type VideoPayload = {
  src: string;
  title?: string;
};

export type SerializedVideoNode = Spread<
  {
    type: "video";
    version: 1;
    src: string;
    title: string;
  },
  SerializedLexicalNode
>;

export const INSERT_VIDEO_COMMAND: LexicalCommand<VideoPayload> = createCommand("INSERT_VIDEO_COMMAND");

export class VideoNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __title: string;

  static getType(): string {
    return "video";
  }

  static clone(node: VideoNode): VideoNode {
    return new VideoNode(node.__src, node.__title, node.__key);
  }

  constructor(src: string, title: string, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__title = title;
  }

  static importJSON(serializedNode: SerializedVideoNode): VideoNode {
    return $createVideoNode({ src: serializedNode.src, title: serializedNode.title });
  }

  static importDOM() {
    return {
      iframe: () => ({
        conversion: (node: Node) => {
          if (!(node instanceof HTMLIFrameElement)) {
            return null;
          }
          return {
            node: $createVideoNode({
              src: node.src,
              title: node.title || "Video",
            }),
          };
        },
        priority: 0,
      }),
    };
  }

  exportJSON(): SerializedVideoNode {
    return {
      type: "video",
      version: 1,
      src: this.__src,
      title: this.__title,
    };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "lexical-video-wrapper";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): { element: HTMLElement } {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", this.__src);
    iframe.setAttribute("title", this.__title || "Video");
    iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("data-lexical-node", "video");
    return { element: iframe };
  }

  decorate(): JSX.Element {
    return (
      <div className="lexical-video">
        <iframe
          src={this.__src}
          title={this.__title || "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          frameBorder="0"
        />
      </div>
    );
  }
}

export const $createVideoNode = (payload: VideoPayload): VideoNode => {
  const { src, title = "Video" } = payload;
  return $applyNodeReplacement(new VideoNode(src, title));
};

export const $isVideoNode = (node: unknown): node is VideoNode => node instanceof VideoNode;
