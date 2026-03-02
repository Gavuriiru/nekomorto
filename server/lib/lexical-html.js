import { JSDOM } from "jsdom";
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $getRoot,
  $isElementNode,
  $isTextNode,
  createEditor,
  DecoratorNode,
  ParagraphNode,
  TextNode,
} from "lexical";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { $createLinkNode, LinkNode, AutoLinkNode } from "@lexical/link";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";

const BLOCK_STYLE_KEYS = [
  "font-size",
  "text-indent",
  "margin-top",
  "margin-bottom",
  "line-height",
  "font-family",
];

const IMAGE_STYLE_KEYS = [
  "width",
  "height",
  "max-width",
  "display",
  "margin-left",
  "margin-right",
  "margin-top",
  "margin-bottom",
  "vertical-align",
];

const INLINE_TEXT_STYLE_KEYS = ["font-size", "font-style", "font-weight", "font-family"];

const ZERO_LIKE_VALUES = new Set([
  "",
  "0",
  "0px",
  "0em",
  "0rem",
  "0%",
  "normal",
  "auto",
  "none",
  "initial",
  "inherit",
]);

const normalizeStyleValue = (value) => String(value || "").trim().replace(/\s+/g, " ");

const parseStyleDeclaration = (cssText) =>
  String(cssText || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((styles, entry) => {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex === -1) {
        return styles;
      }
      const property = normalizeStyleValue(entry.slice(0, separatorIndex)).toLowerCase();
      const value = normalizeStyleValue(entry.slice(separatorIndex + 1));
      if (!property || !value) {
        return styles;
      }
      styles[property] = value;
      return styles;
    }, {});

const getStyleRecord = (style) => {
  if (typeof style === "string") {
    return parseStyleDeclaration(style);
  }
  const record = {};
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    if (!property) {
      continue;
    }
    record[property.toLowerCase()] = normalizeStyleValue(style.getPropertyValue(property));
  }
  return record;
};

const buildStyleDeclaration = (entries) =>
  entries
    .map(([property, value]) => [String(property).trim().toLowerCase(), normalizeStyleValue(value)]).filter(
      ([property, value]) => property && value,
    )
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");

const isMeaningfulValue = (value) => !ZERO_LIKE_VALUES.has(normalizeStyleValue(value).toLowerCase());

const normalizeFontFamilyBucket = (value) => {
  const normalized = normalizeStyleValue(value).toLowerCase();
  if (!normalized) {
    return "";
  }
  if (
    normalized.includes("mono") ||
    normalized.includes("consolas") ||
    normalized.includes("courier") ||
    normalized.includes("fira code") ||
    normalized.includes("jetbrains mono")
  ) {
    return "monospace";
  }
  if (
    normalized.includes("sans") ||
    normalized.includes("arial") ||
    normalized.includes("helvetica") ||
    normalized.includes("verdana") ||
    normalized.includes("tahoma") ||
    normalized.includes("gothic") ||
    normalized.includes("meiryo") ||
    normalized.includes("yu gothic")
  ) {
    return "sans-serif";
  }
  return "serif";
};

const normalizeImageAlignment = (value) => {
  const normalized = normalizeStyleValue(value).toLowerCase();
  if (normalized === "left" || normalized === "center" || normalized === "right") {
    return normalized;
  }
  return undefined;
};

const inferImageAlignment = ({ dataAlign, editorialStyle }) => {
  const explicitAlign = normalizeImageAlignment(dataAlign);
  if (explicitAlign) {
    return explicitAlign;
  }
  const record = parseStyleDeclaration(editorialStyle);
  const marginLeft = normalizeStyleValue(record["margin-left"]).toLowerCase();
  const marginRight = normalizeStyleValue(record["margin-right"]).toLowerCase();
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

const extractBlockEditorialStyle = (style) => {
  const record = getStyleRecord(style);
  const textAlign = normalizeStyleValue(record["text-align"]).toLowerCase();
  return {
    format: ["left", "right", "center", "justify"].includes(textAlign) ? textAlign : "",
    editorialStyle: buildStyleDeclaration([
      ["font-size", isMeaningfulValue(record["font-size"]) ? record["font-size"] : ""],
      ["text-indent", isMeaningfulValue(record["text-indent"]) ? record["text-indent"] : ""],
      ["margin-top", isMeaningfulValue(record["margin-top"]) ? record["margin-top"] : ""],
      ["margin-bottom", isMeaningfulValue(record["margin-bottom"]) ? record["margin-bottom"] : ""],
      ["line-height", isMeaningfulValue(record["line-height"]) ? record["line-height"] : ""],
      [
        "font-family",
        isMeaningfulValue(record["font-family"]) ? normalizeFontFamilyBucket(record["font-family"]) : "",
      ],
    ]),
  };
};

const extractImageEditorialStyle = (style) => {
  const record = getStyleRecord(style);
  return buildStyleDeclaration(
    IMAGE_STYLE_KEYS.map((property) => [property, isMeaningfulValue(record[property]) ? record[property] : ""]),
  );
};

const extractInlineEditorialTextStyle = (style) => {
  const record = getStyleRecord(style);
  return buildStyleDeclaration(
    INLINE_TEXT_STYLE_KEYS.map((property) => {
      if (!isMeaningfulValue(record[property])) {
        return [property, ""];
      }
      if (property === "font-family") {
        return [property, normalizeFontFamilyBucket(record[property])];
      }
      return [property, record[property]];
    }),
  );
};

const mergeStyleDeclarations = (baseStyle, nextStyle) => {
  const baseRecord = parseStyleDeclaration(baseStyle);
  const nextRecord = parseStyleDeclaration(nextStyle);
  return buildStyleDeclaration([...Object.entries(baseRecord), ...Object.entries(nextRecord)]);
};

const applyInlineEditorialStyleToTextNode = (lexicalNode, editorialStyle, impliedFormat) => {
  if (!$isTextNode(lexicalNode)) {
    return lexicalNode;
  }
  const styleRecord = parseStyleDeclaration(editorialStyle);
  if (editorialStyle) {
    const mergedStyle = mergeStyleDeclarations(lexicalNode.getStyle(), editorialStyle);
    if (mergedStyle && mergedStyle !== lexicalNode.getStyle()) {
      lexicalNode.setStyle(mergedStyle);
    }
  }
  const fontWeight = String(styleRecord["font-weight"] || "").trim().toLowerCase();
  const fontStyle = String(styleRecord["font-style"] || "").trim().toLowerCase();
  if ((fontWeight === "bold" || Number(fontWeight) >= 600) && !lexicalNode.hasFormat("bold")) {
    lexicalNode.toggleFormat("bold");
  }
  if (fontStyle === "italic" && !lexicalNode.hasFormat("italic")) {
    lexicalNode.toggleFormat("italic");
  }
  if (impliedFormat && !lexicalNode.hasFormat(impliedFormat)) {
    lexicalNode.toggleFormat(impliedFormat);
  }
  return lexicalNode;
};

const createInlineEditorialTextConversion =
  ({ createNode, impliedFormat } = {}) =>
  () => ({
    conversion: (node) => {
      if (!node || node.nodeType !== 1) {
        return null;
      }
      const editorialStyle = extractInlineEditorialTextStyle(node.style);
      if (!editorialStyle && !createNode && !impliedFormat) {
        return null;
      }
      return {
        node: typeof createNode === "function" ? createNode(node) : null,
        forChild: (lexicalNode) =>
          applyInlineEditorialStyleToTextNode(lexicalNode, editorialStyle, impliedFormat),
      };
    },
    priority: 3,
  });

const hasEditorialBlockStyle = (style) => Boolean(extractBlockEditorialStyle(style).editorialStyle);
const hasEditorialImageStyle = (style) => Boolean(extractImageEditorialStyle(style));

const applyEditorialStyleToElement = (element, editorialStyle) => {
  if (!editorialStyle) {
    element.removeAttribute("style");
    return;
  }
  element.style.cssText = editorialStyle;
};

const isBlockImageStyle = (editorialStyle) => parseStyleDeclaration(editorialStyle).display === "block";

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

class ServerEpubImageNode extends DecoratorNode {
  static getType() {
    return "epub-image";
  }

  static clone(node) {
    return new ServerEpubImageNode(
      node.__src,
      node.__altText,
      node.__editorialStyle,
      node.__align,
      node.__key,
    );
  }

  constructor(src, altText, editorialStyle = "", align, key) {
    super(key);
    this.__src = src;
    this.__altText = altText || "";
    this.__editorialStyle = editorialStyle || "";
    this.__align = align;
  }

  static importJSON(serializedNode) {
    return $createServerEpubImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      editorialStyle: serializedNode.editorialStyle,
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
          const editorialStyle = extractImageEditorialStyle(node.style);
          const align = inferImageAlignment({
            dataAlign: node.getAttribute?.("data-epub-align"),
            editorialStyle,
          });
          const src = node.getAttribute?.("src") || "";
          if (!src) {
            return null;
          }
          return {
            node: $createServerEpubImageNode({
              src,
              altText: node.getAttribute?.("alt") || "",
              editorialStyle,
              align,
            }),
          };
        },
        priority: 3,
      }),
    };
  }

  isInline() {
    return !(isBlockImageStyle(this.__editorialStyle) || this.__align);
  }

  exportJSON() {
    return {
      type: "epub-image",
      version: 1,
      src: this.__src,
      altText: this.__altText,
      editorialStyle: this.__editorialStyle,
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

  decorate() {
    return null;
  }
}

const $createServerEpubImageNode = ({ src, altText = "", editorialStyle = "", align }) =>
  $applyNodeReplacement(new ServerEpubImageNode(src, altText, editorialStyle, align));

class ServerInlineEditorialStyleBridgeNode extends TextNode {
  static getType() {
    return "__inline-editorial-style-bridge";
  }

  static clone(node) {
    return new ServerInlineEditorialStyleBridgeNode(node.__text, node.__key);
  }

  constructor(text = "", key) {
    super(text, key);
  }

  static importJSON() {
    return new ServerInlineEditorialStyleBridgeNode("");
  }

  static importDOM() {
    return {
      span: createInlineEditorialTextConversion(),
      em: createInlineEditorialTextConversion({ impliedFormat: "italic" }),
      strong: createInlineEditorialTextConversion({ impliedFormat: "bold" }),
      i: createInlineEditorialTextConversion({ impliedFormat: "italic" }),
      b: createInlineEditorialTextConversion({ impliedFormat: "bold" }),
      u: createInlineEditorialTextConversion({ impliedFormat: "underline" }),
      s: createInlineEditorialTextConversion({ impliedFormat: "strikethrough" }),
      sub: createInlineEditorialTextConversion({ impliedFormat: "subscript" }),
      sup: createInlineEditorialTextConversion({ impliedFormat: "superscript" }),
      a: createInlineEditorialTextConversion({
        createNode: (node) => {
          const href = node.getAttribute?.("href") || "";
          if (((node.textContent || "") !== "" || node.children.length > 0)) {
            return $createLinkNode(href, {
              rel: node.getAttribute?.("rel"),
              target: node.getAttribute?.("target"),
              title: node.getAttribute?.("title"),
            });
          }
          return null;
        },
      }),
    };
  }
}

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

class ServerEpubParagraphNode extends ParagraphNode {
  static getType() {
    return "epub-paragraph";
  }

  static clone(node) {
    return new ServerEpubParagraphNode(node.__editorialStyle, node.__key);
  }

  constructor(editorialStyle = "", key) {
    super(key);
    this.__editorialStyle = editorialStyle;
  }

  static importJSON(serializedNode) {
    return $createServerEpubParagraphNode({
      editorialStyle: serializedNode.editorialStyle,
    }).updateFromJSON(serializedNode);
  }

  static importDOM() {
    const createConversion = () => ({
      conversion: (node) => {
        if (!(node instanceof globalThis.HTMLElement)) {
          return null;
        }
        if (node.hasAttribute("data-epub-heading") || !hasEditorialBlockStyle(node.style)) {
          return null;
        }
        const { format, editorialStyle } = extractBlockEditorialStyle(node.style);
        const paragraph = $createServerEpubParagraphNode({ editorialStyle });
        if (format) {
          paragraph.setFormat(format);
        }
        return { node: paragraph };
      },
        priority: 3,
    });

    return {
      "epub-p": createConversion,
      p: createConversion,
      blockquote: createConversion,
    };
  }

  getEditorialStyle() {
    return this.getLatest().__editorialStyle;
  }

  setEditorialStyle(editorialStyle) {
    const writable = this.getWritable();
    writable.__editorialStyle = String(editorialStyle || "").trim();
    return writable;
  }

  updateFromJSON(serializedNode) {
    return super.updateFromJSON(serializedNode).setEditorialStyle(serializedNode.editorialStyle || "");
  }

  createDOM(config) {
    const dom = super.createDOM(config);
    applyEditorialStyleToElement(dom, this.getEditorialStyle());
    return dom;
  }

  updateDOM(prevNode, dom, config) {
    super.updateDOM(prevNode, dom, config);
    applyEditorialStyleToElement(dom, this.getEditorialStyle());
    return false;
  }

  exportDOM(editor) {
    const result = super.exportDOM(editor);
    if (result.element instanceof globalThis.HTMLElement) {
      applyEditorialStyleToElement(result.element, this.getEditorialStyle());
      const formatType = this.getFormatType();
      if (formatType) {
        result.element.style.textAlign = formatType;
      }
    }
    return result;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: "epub-paragraph",
      version: 1,
      editorialStyle: this.getEditorialStyle(),
    };
  }
}

const $createServerEpubParagraphNode = ({ editorialStyle = "" }) =>
  $applyNodeReplacement(new ServerEpubParagraphNode(editorialStyle));

class ServerEpubHeadingNode extends HeadingNode {
  static getType() {
    return "epub-heading";
  }

  static clone(node) {
    return new ServerEpubHeadingNode(node.getTag(), node.__editorialStyle, node.__key);
  }

  constructor(tag, editorialStyle = "", key) {
    super(tag, key);
    this.__editorialStyle = editorialStyle;
  }

  static importJSON(serializedNode) {
    return $createServerEpubHeadingNode({
      tag: serializedNode.tag,
      editorialStyle: serializedNode.editorialStyle,
    }).updateFromJSON(serializedNode);
  }

  static importDOM() {
    const createConversion = (fallbackTag) => ({
      conversion: (node) => {
        if (!(node instanceof globalThis.HTMLElement)) {
          return null;
        }
        const hintedTag = String(node.getAttribute("data-epub-heading") || "").toLowerCase();
        const explicitTag = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(hintedTag)
          ? hintedTag
          : undefined;
        const tag = explicitTag || fallbackTag || String(node.tagName || "").toLowerCase();
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
        const heading = $createServerEpubHeadingNode({ tag, editorialStyle });
        if (format) {
          heading.setFormat(format);
        }
        return { node: heading };
      },
        priority: 3,
    });
    return {
      h1: () => createConversion(),
      h2: () => createConversion(),
      h3: () => createConversion(),
      h4: () => createConversion(),
      h5: () => createConversion(),
      h6: () => createConversion(),
      p: () => createConversion("h2"),
      blockquote: () => createConversion("h2"),
    };
  }

  getEditorialStyle() {
    return this.getLatest().__editorialStyle;
  }

  setEditorialStyle(editorialStyle) {
    const writable = this.getWritable();
    writable.__editorialStyle = String(editorialStyle || "").trim();
    return writable;
  }

  updateFromJSON(serializedNode) {
    return super
      .updateFromJSON(serializedNode)
      .setTag(serializedNode.tag)
      .setEditorialStyle(serializedNode.editorialStyle || "");
  }

  createDOM(config) {
    const dom = super.createDOM(config);
    applyEditorialStyleToElement(dom, this.getEditorialStyle());
    return dom;
  }

  updateDOM(prevNode, dom, config) {
    const needsRemount = super.updateDOM(prevNode, dom, config);
    if (!needsRemount) {
      applyEditorialStyleToElement(dom, this.getEditorialStyle());
    }
    return needsRemount;
  }

  exportDOM(editor) {
    const result = super.exportDOM(editor);
    if (result.element instanceof globalThis.HTMLElement) {
      applyEditorialStyleToElement(result.element, this.getEditorialStyle());
      const formatType = this.getFormatType();
      if (formatType) {
        result.element.style.textAlign = formatType;
      }
    }
    return result;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: "epub-heading",
      version: 1,
      tag: this.getTag(),
      editorialStyle: this.getEditorialStyle(),
    };
  }
}

const $createServerEpubHeadingNode = ({ tag, editorialStyle = "" }) =>
  $applyNodeReplacement(new ServerEpubHeadingNode(tag, editorialStyle));

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
  ServerInlineEditorialStyleBridgeNode,
  ServerEpubParagraphNode,
  ServerEpubHeadingNode,
  ServerEpubImageNode,
  ServerImageNode,
  ServerVideoNode,
];

const createLexicalEditor = () =>
  createEditor({
    nodes: lexicalNodes,
    onError: () => {},
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

const hasSerializableRoot = (serializedState) =>
  serializedState?.root?.type === "root" && Array.isArray(serializedState.root.children);

const hasNonEmptyRootChildren = (serializedState) =>
  Array.isArray(serializedState?.root?.children) && serializedState.root.children.length > 0;

const hasExplicitlyEmptyRoot = (serializedState) =>
  serializedState?.root?.type === "root" &&
  Array.isArray(serializedState.root.children) &&
  serializedState.root.children.length === 0;

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

  if (!hasSerializableRoot(parsed)) {
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
