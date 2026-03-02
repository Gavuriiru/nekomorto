const collapseWhitespace = (value) => String(value || "").replace(/\s+/g, " ").trim();

const stripHtml = (value) =>
  String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const BLOCK_NODE_TYPES = new Set([
  "root",
  "paragraph",
  "epub-paragraph",
  "heading",
  "epub-heading",
  "quote",
  "listitem",
  "list-item",
  "list",
]);

const isLexicalState = (value) =>
  Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.root &&
      typeof value.root === "object" &&
      Array.isArray(value.root.children),
  );

const extractLexicalNodeText = (node) => {
  if (!node) {
    return "";
  }
  if (Array.isArray(node)) {
    return collapseWhitespace(node.map((item) => extractLexicalNodeText(item)).join(" "));
  }
  if (typeof node !== "object") {
    return "";
  }
  if (typeof node.text === "string") {
    return node.text;
  }
  if (node.type === "linebreak") {
    return "\n";
  }
  const children = Array.isArray(node.children) ? node.children : [];
  if (!children.length) {
    return "";
  }
  const separator = BLOCK_NODE_TYPES.has(String(node.type || "").toLowerCase()) ? "\n" : " ";
  return collapseWhitespace(children.map((child) => extractLexicalNodeText(child)).join(separator));
};

export const chapterContentToPlainText = (value) => {
  const source = String(value || "").trim();
  if (!source) {
    return "";
  }
  try {
    const parsed = JSON.parse(source);
    if (isLexicalState(parsed)) {
      return collapseWhitespace(extractLexicalNodeText(parsed.root));
    }
  } catch {
    // fall through to the legacy markdown/html cleanup path
  }
  const withoutImages = source.replace(/!\[[^\]]*]\([^)]*\)/g, " ");
  const withoutLinks = withoutImages.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  const withoutInlineCode = withoutLinks.replace(/`{1,3}[^`]*`{1,3}/g, " ");
  const withoutHtml = stripHtml(withoutInlineCode);
  const withoutMarkdownTokens = withoutHtml
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>|`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withoutMarkdownTokens.replace(/\s+/g, " ").trim();
};

export const deriveChapterSynopsis = (chapter, maxLength = 280) => {
  const explicit = String(chapter?.synopsis || "").trim();
  if (explicit) {
    return explicit.length <= maxLength
      ? explicit
      : `${explicit.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
  }
  const fromContent = chapterContentToPlainText(chapter?.content || "");
  if (!fromContent) {
    return "";
  }
  return fromContent.length <= maxLength
    ? fromContent
    : `${fromContent.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};
