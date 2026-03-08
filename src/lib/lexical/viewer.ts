import { EMPTY_LEXICAL_JSON, normalizeLexicalJson } from "@/lib/lexical/serialize";

type SerializedLexicalNodeLike = {
  children?: SerializedLexicalNodeLike[];
  open?: boolean;
  root?: SerializedLexicalNodeLike;
  type?: string;
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
    for (const child of serializedNode.children) {
      closeCollapsibleContainers(child);
    }
  }
};

export const normalizeLexicalViewerJson = (value: string) => {
  const normalized = normalizeLexicalJson(value) ?? EMPTY_LEXICAL_JSON;

  try {
    const parsed = JSON.parse(normalized) as SerializedLexicalNodeLike;
    closeCollapsibleContainers(parsed);
    return JSON.stringify(parsed);
  } catch {
    return EMPTY_LEXICAL_JSON;
  }
};
