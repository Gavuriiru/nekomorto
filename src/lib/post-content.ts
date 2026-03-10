type LexicalJsonRecord = Record<string, unknown>;

const BLOCK_CHILD_SEPARATOR_PARENTS = new Set([
  "root",
  "list",
  "listitem",
  "quote",
  "table",
  "tablerow",
  "tablecell",
  "layout-container",
  "layout-item",
  "collapsible-container",
  "collapsible-content",
]);

const NEWLINE_LEAF_TYPES = new Set([
  "linebreak",
  "pagebreak",
  "page-break",
  "horizontalrule",
  "horizontal-rule",
]);

const SPACE_LEAF_TYPES = new Set(["tab"]);

const isRecord = (value: unknown): value is LexicalJsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseLexicalJson = (value: string) => {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const getNodeChildren = (node: LexicalJsonRecord) =>
  Array.isArray(node.children) ? node.children.filter(isRecord) : [];

const formatDateTimeText = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  const parsedMs = Date.parse(value);
  if (!Number.isFinite(parsedMs)) {
    return "";
  }
  const dateTime = new Date(parsedMs);
  const hours = dateTime.getHours();
  const minutes = dateTime.getMinutes();
  return (
    dateTime.toDateString() +
    (hours === 0 && minutes === 0
      ? ""
      : ` ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`)
  );
};

const getLeafNodeText = (node: LexicalJsonRecord) => {
  const type = String(node.type || "").trim().toLowerCase();
  if (NEWLINE_LEAF_TYPES.has(type)) {
    return "\n";
  }
  if (SPACE_LEAF_TYPES.has(type)) {
    return " ";
  }
  if (type === "equation") {
    return typeof node.equation === "string" ? node.equation : "";
  }
  if (type === "tweet") {
    const tweetId = String(node.id || "").trim();
    return tweetId ? `https://x.com/i/web/status/${tweetId}` : "";
  }
  if (type === "youtube") {
    const videoId = String(node.videoID || "").trim();
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
  }
  if (type === "datetime") {
    return formatDateTimeText(node.dateTime);
  }
  return typeof node.text === "string" && getNodeChildren(node).length === 0 ? node.text : "";
};

const renderLexicalNodeText = (node: LexicalJsonRecord): string => {
  const type = String(node.type || "").trim().toLowerCase();
  const leafText = getLeafNodeText(node);
  const childSeparator = BLOCK_CHILD_SEPARATOR_PARENTS.has(type) ? "\n" : "";
  const childText = getNodeChildren(node)
    .map((childNode) => renderLexicalNodeText(childNode))
    .filter(Boolean)
    .join(childSeparator);

  if (leafText && childText) {
    return `${leafText}${childSeparator}${childText}`;
  }
  return leafText || childText;
};

const normalizeExtractedText = (value: string) =>
  String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const resolveLexicalRootNode = (value: LexicalJsonRecord) => {
  if (isRecord(value.root)) {
    return value.root;
  }
  return String(value.type || "").trim().toLowerCase() === "root" ? value : null;
};

export const createSlug = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const safeParseLexicalJson = (value: string) => {
  return parseLexicalJson(value) ? value : null;
};

export const getLexicalText = (content: string) => {
  const parsed = parseLexicalJson(content);
  if (!parsed) {
    return "";
  }
  const rootNode = resolveLexicalRootNode(parsed);
  if (!rootNode) {
    return "";
  }
  return normalizeExtractedText(renderLexicalNodeText(rootNode));
};

export const estimateReadTime = (content: string) => {
  const text = getLexicalText(content);
  const words = text.split(/\s+/).filter(Boolean);
  const minutes = Math.max(1, Math.ceil(words.length / 200));
  return `${minutes} min de leitura`;
};
