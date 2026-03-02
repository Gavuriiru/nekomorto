import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $isElementNode,
  $isTextNode,
  DecoratorNode,
  TextNode,
} from "lexical";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { $createLinkNode } from "@lexical/link";
import PlaygroundNodes from "@/lexical-playground/nodes/PlaygroundNodes";
import { lexicalNodes as bridgeLexicalNodes } from "@/lib/lexical/nodes";
import {
  buildStyleDeclaration,
  normalizeFontFamilyBucket,
  parseStyleDeclaration,
} from "@/components/lexical/nodes/epub-style";

const INLINE_TEXT_STYLE_KEYS = ["font-size", "font-style", "font-weight", "font-family"] as const;
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

const isMeaningfulStyleValue = (value: string) =>
  !ZERO_LIKE_VALUES.has(String(value || "").trim().toLowerCase());

const extractInlineEditorialTextStyle = (style: CSSStyleDeclaration | string) => {
  const record = parseStyleDeclaration(typeof style === "string" ? style : style.cssText);
  return buildStyleDeclaration(
    INLINE_TEXT_STYLE_KEYS.map((property) => {
      if (!isMeaningfulStyleValue(record[property] || "")) {
        return [property, ""] as const;
      }
      if (property === "font-family") {
        return [property, normalizeFontFamilyBucket(record[property] || "")] as const;
      }
      return [property, record[property] || ""] as const;
    }),
  );
};

const mergeStyleDeclarations = (baseStyle: string, nextStyle: string) =>
  buildStyleDeclaration([
    ...Object.entries(parseStyleDeclaration(baseStyle)),
    ...Object.entries(parseStyleDeclaration(nextStyle)),
  ]);

const applyInlineEditorialStyleToTextNode = (
  lexicalNode: unknown,
  editorialStyle: string,
  impliedFormat?: "bold" | "italic" | "underline" | "strikethrough" | "subscript" | "superscript",
) => {
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
  ({
    createNode,
    impliedFormat,
  }: {
    createNode?: ((node: Element) => unknown) | undefined;
    impliedFormat?:
      | "bold"
      | "italic"
      | "underline"
      | "strikethrough"
      | "subscript"
      | "superscript";
  } = {}) =>
  () => ({
    conversion: (node: Node) => {
      if (!(node instanceof Element)) {
        return null;
      }
      const editorialStyle = extractInlineEditorialTextStyle(node.getAttribute("style") || "");
      if (!editorialStyle && !createNode && !impliedFormat) {
        return null;
      }
      return {
        node: typeof createNode === "function" ? createNode(node) : null,
        forChild: (lexicalNode: unknown) =>
          applyInlineEditorialStyleToTextNode(lexicalNode, editorialStyle, impliedFormat),
      };
    },
    priority: 3 as const,
  });

class InlineEditorialStyleBridgeNode extends TextNode {
  static getType() {
    return "__inline-editorial-style-bridge";
  }

  static clone(node: InlineEditorialStyleBridgeNode) {
    return new InlineEditorialStyleBridgeNode(node.getTextContent(), node.__key);
  }

  constructor(text = "", key?: string) {
    super(text, key);
  }

  static importJSON() {
    return new InlineEditorialStyleBridgeNode("");
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
          const href = node.getAttribute("href") || "";
          if (((node.textContent || "") !== "" || node.children.length > 0)) {
            return $createLinkNode(href, {
              rel: node.getAttribute("rel"),
              target: node.getAttribute("target"),
              title: node.getAttribute("title"),
            });
          }
          return null;
        },
      }),
    };
  }
}

const createBridgeLexicalEditor = () =>
  createEditor({
    nodes: [...bridgeLexicalNodes, InlineEditorialStyleBridgeNode],
    onError: () => {},
  });

const createPlaygroundLexicalEditor = () =>
  createEditor({
    nodes: PlaygroundNodes,
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

const isRootAppendableNode = (node: unknown) =>
  Boolean(node) && ($isElementNode(node) || node instanceof DecoratorNode);

const normalizeRootImportNodes = (nodes: unknown[]) => {
  const normalizedNodes: unknown[] = [];
  let paragraphBuffer: ReturnType<typeof $createParagraphNode> | null = null;

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

const getSerializedRoot = (serializedState: unknown) =>
  (serializedState as { root?: { type?: string; children?: unknown[] } } | null | undefined)?.root;

const hasNonEmptyRootChildren = (serializedState: unknown) => {
  const root = getSerializedRoot(serializedState);
  return Array.isArray(root?.children) && root.children.length > 0;
};

const hasExplicitlyEmptyRoot = (serializedState: unknown) => {
  const root = getSerializedRoot(serializedState);
  return root?.type === "root" && Array.isArray(root.children) && root.children.length === 0;
};

const hasSerializableRoot = (serializedState: unknown) => {
  const root = getSerializedRoot(serializedState);
  return root?.type === "root" && Array.isArray(root.children);
};

export const normalizeLexicalJson = (value: string) => {
  if (!value) {
    return null;
  }

  let parsed: unknown;
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

  const editor = createPlaygroundLexicalEditor();
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

export const renderLexicalJsonToHtml = (serialized: string) => {
  const editor = createPlaygroundLexicalEditor();
  const safe = normalizeLexicalJson(serialized);
  if (!safe) {
    return "";
  }
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
};

export const htmlToLexicalJson = (html: string) => {
  const editor = createBridgeLexicalEditor();
  const parser = new DOMParser();
  const dom = parser.parseFromString(html || "", "text/html");
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      const nodes = normalizeRootImportNodes($generateNodesFromDOM(editor, dom));
      root.append(...(nodes as never[]));
    },
    { discrete: true },
  );
  return normalizeLexicalJson(JSON.stringify(editor.getEditorState().toJSON())) || EMPTY_LEXICAL_JSON;
};
