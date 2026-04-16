import { createEditor } from "lexical";

import LexicalViewerNodes from "@/components/lexical/LexicalViewerNodes";
import { EMPTY_LEXICAL_JSON } from "@/lib/lexical/empty-state";

type SerializedLexicalNodeLike = {
  children?: SerializedLexicalNodeLike[];
  open?: boolean;
  root?: SerializedLexicalNodeLike;
  text?: string;
  type?: string;
};

const getSerializedRoot = (serializedState: unknown) =>
  (serializedState as { root?: { type?: string; children?: unknown[] } } | null | undefined)?.root;

const NORMALIZED_VIEWER_STATE_CACHE_LIMIT = 100;
const normalizedViewerStateCache = new Map<string, string>();

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

const isWhitespaceOnlyTextNode = (node: SerializedLexicalNodeLike) =>
  node.type === "text" && String(node.text || "").trim().length === 0;

const isVisuallyEmptyParagraph = (node: SerializedLexicalNodeLike) => {
  if (node.type !== "paragraph") {
    return false;
  }

  if (!Array.isArray(node.children) || node.children.length === 0) {
    return true;
  }

  return node.children.every(
    (child) => child.type === "linebreak" || isWhitespaceOnlyTextNode(child),
  );
};

const closeCollapsibleContainers = (node: unknown): void => {
  if (!node || typeof node !== "object") {
    return;
  }

  const serializedNode = node as SerializedLexicalNodeLike;
  if (serializedNode.type === "collapsible-container") {
    serializedNode.open = false;
  }

  if (serializedNode.root) {
    closeCollapsibleContainers(serializedNode.root);
  }

  if (Array.isArray(serializedNode.children)) {
    if (
      serializedNode.type === "collapsible-title" ||
      serializedNode.type === "collapsible-content"
    ) {
      serializedNode.children = serializedNode.children.filter(
        (child) => !isVisuallyEmptyParagraph(child),
      );
    }

    for (const child of serializedNode.children) {
      closeCollapsibleContainers(child);
    }
  }
};

export const normalizeLexicalViewerJson = (value: string) => {
  if (!value) {
    return EMPTY_LEXICAL_JSON;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return EMPTY_LEXICAL_JSON;
  }

  if (!parsed || typeof parsed !== "object") {
    return EMPTY_LEXICAL_JSON;
  }

  if (hasExplicitlyEmptyRoot(parsed)) {
    return EMPTY_LEXICAL_JSON;
  }

  if (!hasSerializableRoot(parsed)) {
    return EMPTY_LEXICAL_JSON;
  }

  const editor = createEditor({
    nodes: LexicalViewerNodes,
    onError: () => {},
  });

  let normalized: unknown;
  try {
    const editorState = editor.parseEditorState(JSON.stringify(parsed));
    editor.setEditorState(editorState);
    normalized = editor.getEditorState().toJSON();
    if (!hasNonEmptyRootChildren(normalized)) {
      return EMPTY_LEXICAL_JSON;
    }
  } catch {
    return EMPTY_LEXICAL_JSON;
  }

  try {
    const normalizedState = JSON.parse(JSON.stringify(normalized)) as SerializedLexicalNodeLike;
    closeCollapsibleContainers(normalizedState);
    return JSON.stringify(normalizedState);
  } catch {
    return EMPTY_LEXICAL_JSON;
  }
};

export const readPreparedLexicalViewerState = (value?: string | null) => {
  const serializedValue = String(value || "");
  if (!serializedValue) {
    return EMPTY_LEXICAL_JSON;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedValue);
  } catch {
    return EMPTY_LEXICAL_JSON;
  }

  if (!parsed || typeof parsed !== "object") {
    return EMPTY_LEXICAL_JSON;
  }
  if (hasExplicitlyEmptyRoot(parsed)) {
    return EMPTY_LEXICAL_JSON;
  }
  if (!hasSerializableRoot(parsed)) {
    return EMPTY_LEXICAL_JSON;
  }
  return serializedValue;
};

export const prepareLexicalViewerState = (value: string) => {
  const cacheKey = String(value || "");
  const cached = normalizedViewerStateCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const normalized = normalizeLexicalViewerJson(cacheKey) ?? EMPTY_LEXICAL_JSON;
  normalizedViewerStateCache.set(cacheKey, normalized);
  if (normalizedViewerStateCache.size > NORMALIZED_VIEWER_STATE_CACHE_LIMIT) {
    const oldestKey = normalizedViewerStateCache.keys().next().value;
    if (oldestKey) {
      normalizedViewerStateCache.delete(oldestKey);
    }
  }
  return normalized;
};
