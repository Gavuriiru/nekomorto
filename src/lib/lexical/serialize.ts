import { createEditor, $getRoot, $createParagraphNode, $isElementNode, DecoratorNode } from "lexical";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import PlaygroundNodes from "@/lexical-playground/nodes/PlaygroundNodes";
import { lexicalNodes as bridgeLexicalNodes } from "@/lib/lexical/nodes";

const createBridgeLexicalEditor = () =>
  createEditor({
    nodes: bridgeLexicalNodes,
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
