type SerializedNodeLike = {
  children?: SerializedNodeLike[];
  editorState?: SerializedNodeLike;
  root?: SerializedNodeLike;
  text?: string;
  type?: string;
};

const BLOCK_NODE_TYPES = new Set(["heading", "listitem", "paragraph", "quote"]);

const visitSerializedNode = (node: SerializedNodeLike | null | undefined): string => {
  if (!node || typeof node !== "object") {
    return "";
  }

  if (typeof node.text === "string") {
    return node.text;
  }

  const sourceNode =
    node.editorState && typeof node.editorState === "object" ? node.editorState : node;
  const childText = Array.isArray(sourceNode.children)
    ? sourceNode.children.map((child) => visitSerializedNode(child)).join("")
    : "";

  if (!childText) {
    return "";
  }

  if (sourceNode.type === "linebreak") {
    return "\n";
  }

  return BLOCK_NODE_TYPES.has(String(sourceNode.type || "")) ? `${childText}\n` : childText;
};

export const extractSerializedLexicalText = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return "";
  }

  const parsed = value as SerializedNodeLike;
  const rootNode =
    parsed.root && typeof parsed.root === "object"
      ? parsed.root
      : parsed.editorState && typeof parsed.editorState === "object"
        ? parsed.editorState.root || parsed.editorState
        : parsed;

  return visitSerializedNode(rootNode)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const toPixelValue = (value: number | string | undefined) => {
  if (typeof value === "number") {
    return value > 0 ? `${value}px` : undefined;
  }

  const normalized = String(value || "").trim();
  if (!normalized || normalized === "0") {
    return undefined;
  }

  return normalized;
};
