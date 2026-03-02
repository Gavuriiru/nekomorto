import { JSDOM } from "jsdom";
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $getRoot,
  $isElementNode,
  createEditor,
  DecoratorNode,
} from "lexical";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";

class ServerImageNode extends DecoratorNode {
  static getType() {
    return "image";
  }

  static clone(node) {
    return new ServerImageNode(node.__src, node.__altText, node.__width, node.__align, node.__key);
  }

  constructor(src, altText, width, align, key) {
    super(key);
    this.__src = src;
    this.__altText = altText || "";
    this.__width = width;
    this.__align = align;
  }

  static importJSON(serializedNode) {
    return $createServerImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      width: serializedNode.width,
      align: serializedNode.align,
    });
  }

  static importDOM() {
    return {
      img: () => ({
        conversion: (node) => {
          if (!node || String(node.nodeName || "").toLowerCase() !== "img") {
            return null;
          }
          return {
            node: $createServerImageNode({
              src: node.getAttribute?.("src") || "",
              altText: node.getAttribute?.("alt") || "",
              width: node.style?.width || node.getAttribute?.("width") || undefined,
            }),
          };
        },
        priority: 0,
      }),
    };
  }

  exportJSON() {
    return {
      type: "image",
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      align: this.__align,
    };
  }

  createDOM() {
    return globalThis.document.createElement("span");
  }

  updateDOM() {
    return false;
  }

  exportDOM() {
    const img = globalThis.document.createElement("img");
    img.setAttribute("src", this.__src);
    img.setAttribute("alt", this.__altText);
    img.setAttribute("loading", "lazy");
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
      img.style.display = "block";
      img.style.marginLeft = "auto";
      img.style.marginRight = "auto";
    }
    return { element: img };
  }

  decorate() {
    return null;
  }
}

const $createServerImageNode = ({ src, altText = "", width, align }) =>
  $applyNodeReplacement(new ServerImageNode(src, altText, width, align));

class ServerVideoNode extends DecoratorNode {
  static getType() {
    return "video";
  }

  static clone(node) {
    return new ServerVideoNode(node.__src, node.__title, node.__key);
  }

  constructor(src, title, key) {
    super(key);
    this.__src = src;
    this.__title = title || "Video";
  }

  static importJSON(serializedNode) {
    return $createServerVideoNode({
      src: serializedNode.src,
      title: serializedNode.title,
    });
  }

  static importDOM() {
    return {
      iframe: () => ({
        conversion: (node) => {
          if (!node || String(node.nodeName || "").toLowerCase() !== "iframe") {
            return null;
          }
          return {
            node: $createServerVideoNode({
              src: node.getAttribute?.("src") || "",
              title: node.getAttribute?.("title") || "Video",
            }),
          };
        },
        priority: 0,
      }),
    };
  }

  exportJSON() {
    return {
      type: "video",
      version: 1,
      src: this.__src,
      title: this.__title,
    };
  }

  createDOM() {
    return globalThis.document.createElement("span");
  }

  updateDOM() {
    return false;
  }

  exportDOM() {
    const iframe = globalThis.document.createElement("iframe");
    iframe.setAttribute("src", this.__src);
    iframe.setAttribute("title", this.__title || "Video");
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
    );
    iframe.setAttribute("allowfullscreen", "true");
    iframe.style.border = "0";
    return { element: iframe };
  }

  decorate() {
    return null;
  }
}

const $createServerVideoNode = ({ src, title = "Video" }) =>
  $applyNodeReplacement(new ServerVideoNode(src, title));

const lexicalNodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  CodeHighlightNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  ServerImageNode,
  ServerVideoNode,
];

const createLexicalEditor = () =>
  createEditor({
    nodes: lexicalNodes,
  });

const createEmptyLexicalState = () => ({
  root: {
    children: [
      {
        children: [],
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
});

export const EMPTY_LEXICAL_STATE = createEmptyLexicalState();
export const EMPTY_LEXICAL_JSON = JSON.stringify(EMPTY_LEXICAL_STATE);
const ROOT_DECORATOR_TYPES = new Set(["image", "video"]);

const isRootAppendableNode = (node) => $isElementNode(node) || node instanceof DecoratorNode;

const normalizeRootImportNodes = (nodes) => {
  const normalizedNodes = [];
  let paragraphBuffer = null;

  const flushParagraphBuffer = () => {
    if (paragraphBuffer) {
      normalizedNodes.push(paragraphBuffer);
      paragraphBuffer = null;
    }
  };

  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node) {
      continue;
    }
    if (isRootAppendableNode(node)) {
      flushParagraphBuffer();
      normalizedNodes.push(node);
      continue;
    }
    if (!paragraphBuffer) {
      paragraphBuffer = $createParagraphNode();
    }
    paragraphBuffer.append(node);
  }

  flushParagraphBuffer();

  if (normalizedNodes.length === 0) {
    normalizedNodes.push($createParagraphNode());
  }

  return normalizedNodes;
};

const isRootChildrenArray = (root) => Array.isArray(root?.children);

const hasNonEmptyRootChildren = (serializedState) =>
  isRootChildrenArray(serializedState?.root) && serializedState.root.children.length > 0;

const hasExplicitlyEmptyRoot = (serializedState) =>
  serializedState?.root?.type === "root" &&
  isRootChildrenArray(serializedState.root) &&
  serializedState.root.children.length === 0;

const hasSupportedRootChildren = (serializedState) =>
  serializedState?.root?.type === "root" &&
  isRootChildrenArray(serializedState.root) &&
  serializedState.root.children.every((child) => {
    if (!child || typeof child !== "object") {
      return false;
    }
    if (Array.isArray(child.children)) {
      return true;
    }
    return ROOT_DECORATOR_TYPES.has(String(child.type || ""));
  });

const withDomEnvironment = (fn) => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    DOMParser: globalThis.DOMParser,
    Node: globalThis.Node,
    HTMLElement: globalThis.HTMLElement,
    HTMLImageElement: globalThis.HTMLImageElement,
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.Node = dom.window.Node;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLImageElement = dom.window.HTMLImageElement;
  globalThis.HTMLIFrameElement = dom.window.HTMLIFrameElement;
  try {
    return fn(dom.window);
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.DOMParser = previous.DOMParser;
    globalThis.Node = previous.Node;
    globalThis.HTMLElement = previous.HTMLElement;
    globalThis.HTMLImageElement = previous.HTMLImageElement;
    globalThis.HTMLIFrameElement = previous.HTMLIFrameElement;
    dom.window.close();
  }
};

export const normalizeLexicalJson = (value) => {
  if (!value) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  if (hasExplicitlyEmptyRoot(parsed)) {
    return EMPTY_LEXICAL_JSON;
  }

  if (!hasSupportedRootChildren(parsed)) {
    return null;
  }

  const editor = createLexicalEditor();
  try {
    const editorState = editor.parseEditorState(JSON.stringify(parsed));
    editor.setEditorState(editorState);
    const normalized = editor.getEditorState().toJSON();
    if (!hasNonEmptyRootChildren(normalized)) {
      return EMPTY_LEXICAL_JSON;
    }
    return JSON.stringify(normalized);
  } catch {
    return null;
  }
};

export const safeParseLexicalJson = normalizeLexicalJson;

export const renderLexicalJsonToHtml = (serialized) => {
  const safe = normalizeLexicalJson(serialized);
  if (!safe) {
    return "";
  }
  return withDomEnvironment(() => {
    const editor = createLexicalEditor();
    const editorState = editor.parseEditorState(safe);
    editor.setEditorState(editorState);
    let html = "";
    editor.update(
      () => {
        html = $generateHtmlFromNodes(editor);
      },
      { discrete: true },
    );
    return html;
  });
};

export const htmlToLexicalJson = (html) =>
  withDomEnvironment(() => {
    const editor = createLexicalEditor();
    const parser = new globalThis.DOMParser();
    const dom = parser.parseFromString(html || "", "text/html");
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        const nodes = normalizeRootImportNodes($generateNodesFromDOM(editor, dom));
        root.append(...nodes);
      },
      { discrete: true },
    );
    return normalizeLexicalJson(JSON.stringify(editor.getEditorState().toJSON())) || EMPTY_LEXICAL_JSON;
  });
