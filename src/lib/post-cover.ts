export type PostCoverSource = "manual" | "content" | "none";

export type PostCoverPreviewInput = {
  coverImageUrl?: string | null;
  coverAlt?: string | null;
  content?: string | null;
  contentFormat?: "lexical" | "html" | "markdown" | string | null;
  title?: string | null;
};

export type PostCoverResolution = {
  coverImageUrl: string;
  coverAlt: string;
  source: PostCoverSource;
};

type PostCoverCandidate = {
  coverImageUrl: string;
  coverAlt: string;
  index?: number;
};

const isValidPostCoverImageUrl = (value?: string | null) => {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (/^(data|blob):/i.test(trimmed)) {
    return false;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return true;
  }
  return trimmed.startsWith("/");
};

const findFirstLexicalImage = (node: unknown): PostCoverCandidate | null => {
  if (!node) {
    return null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirstLexicalImage(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (typeof node !== "object") {
    return null;
  }

  const lexicalNode = node as Record<string, unknown>;
  const imageType = typeof lexicalNode.type === "string" ? lexicalNode.type.toLowerCase() : "";
  const src = typeof lexicalNode.src === "string" ? lexicalNode.src.trim() : "";
  if (imageType === "image" && isValidPostCoverImageUrl(src)) {
    return {
      coverImageUrl: src,
      coverAlt: typeof lexicalNode.altText === "string" ? lexicalNode.altText.trim() : "",
    };
  }

  if (Array.isArray(lexicalNode.children)) {
    const foundInChildren = findFirstLexicalImage(lexicalNode.children);
    if (foundInChildren) {
      return foundInChildren;
    }
  }

  for (const [key, value] of Object.entries(lexicalNode)) {
    if (key === "children" || key === "src" || key === "altText") {
      continue;
    }
    const found = findFirstLexicalImage(value);
    if (found) {
      return found;
    }
  }
  return null;
};

const extractFirstImageFromHtml = (value: string): PostCoverCandidate | null => {
  const regex = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match = regex.exec(value);
  while (match) {
    const url = String(match[1] || "").trim();
    if (isValidPostCoverImageUrl(url)) {
      const tag = String(match[0] || "");
      const altMatch = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
      return {
        coverImageUrl: url,
        coverAlt: altMatch ? String(altMatch[1] || "").trim() : "",
        index: typeof match.index === "number" ? match.index : Number.MAX_SAFE_INTEGER,
      };
    }
    match = regex.exec(value);
  }
  return null;
};

const extractFirstImageFromMarkdown = (value: string): PostCoverCandidate | null => {
  const regex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gi;
  let match = regex.exec(value);
  while (match) {
    const url = String(match[2] || "").trim();
    if (isValidPostCoverImageUrl(url)) {
      return {
        coverImageUrl: url,
        coverAlt: String(match[1] || "").trim(),
        index: typeof match.index === "number" ? match.index : Number.MAX_SAFE_INTEGER,
      };
    }
    match = regex.exec(value);
  }
  return null;
};

export const extractFirstImageFromPostContent = (
  content?: string | null,
  contentFormat?: "lexical" | "html" | "markdown" | string | null,
): PostCoverCandidate | null => {
  const rawContent = String(content || "");
  if (!rawContent.trim()) {
    return null;
  }
  if (contentFormat === "lexical") {
    try {
      const parsed = JSON.parse(rawContent);
      return findFirstLexicalImage(parsed?.root || parsed);
    } catch {
      return null;
    }
  }

  const htmlCandidate = extractFirstImageFromHtml(rawContent);
  const markdownCandidate = extractFirstImageFromMarkdown(rawContent);
  if (!htmlCandidate && !markdownCandidate) {
    return null;
  }
  if (htmlCandidate && !markdownCandidate) {
    return htmlCandidate;
  }
  if (!htmlCandidate && markdownCandidate) {
    return markdownCandidate;
  }
  return htmlCandidate.index <= (markdownCandidate?.index ?? Number.MAX_SAFE_INTEGER)
    ? htmlCandidate
    : markdownCandidate;
};

export const resolvePostCoverPreview = (post: PostCoverPreviewInput): PostCoverResolution => {
  const title = String(post?.title || "").trim();
  const manualCover = typeof post?.coverImageUrl === "string" ? post.coverImageUrl.trim() : "";
  if (isValidPostCoverImageUrl(manualCover)) {
    return {
      coverImageUrl: manualCover,
      coverAlt: String(post?.coverAlt || "").trim() || title || "Capa",
      source: "manual",
    };
  }

  const extracted = extractFirstImageFromPostContent(post?.content, post?.contentFormat);
  if (extracted?.coverImageUrl) {
    return {
      coverImageUrl: extracted.coverImageUrl,
      coverAlt: extracted.coverAlt || title || "Capa",
      source: "content",
    };
  }

  return {
    coverImageUrl: "",
    coverAlt: title || "Capa",
    source: "none",
  };
};

export const getImageFileNameFromUrl = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  let pathname = raw;
  try {
    const parsed = new URL(raw, "https://local.invalid");
    pathname = parsed.pathname || raw;
  } catch {
    pathname = raw.split("?")[0]?.split("#")[0] || raw;
  }
  const segment = pathname.split("/").filter(Boolean).pop() || "";
  if (!segment) {
    return "";
  }
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};
