const isValidPostCoverImageUrl = (value) => {
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

const findFirstLexicalImage = (node) => {
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

  const imageType = typeof node.type === "string" ? node.type.toLowerCase() : "";
  const src = typeof node.src === "string" ? node.src.trim() : "";
  if (imageType === "image" && isValidPostCoverImageUrl(src)) {
    return {
      coverImageUrl: src,
      coverAlt: typeof node.altText === "string" ? node.altText.trim() : "",
    };
  }

  if (Array.isArray(node.children)) {
    const foundInChildren = findFirstLexicalImage(node.children);
    if (foundInChildren) {
      return foundInChildren;
    }
  }

  for (const [key, value] of Object.entries(node)) {
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

const extractFirstImageFromHtml = (value) => {
  const source = String(value || "");
  const regex = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match = regex.exec(source);
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
    match = regex.exec(source);
  }
  return null;
};

const extractFirstImageFromMarkdown = (value) => {
  const source = String(value || "");
  const regex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gi;
  let match = regex.exec(source);
  while (match) {
    const url = String(match[2] || "").trim();
    if (isValidPostCoverImageUrl(url)) {
      return {
        coverImageUrl: url,
        coverAlt: String(match[1] || "").trim(),
        index: typeof match.index === "number" ? match.index : Number.MAX_SAFE_INTEGER,
      };
    }
    match = regex.exec(source);
  }
  return null;
};

export const extractFirstImageFromPostContent = (content, contentFormat) => {
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
  return htmlCandidate.index <= markdownCandidate.index ? htmlCandidate : markdownCandidate;
};

export const resolvePostCover = (post) => {
  const manualCover = typeof post?.coverImageUrl === "string" ? post.coverImageUrl.trim() : "";
  if (isValidPostCoverImageUrl(manualCover)) {
    return {
      coverImageUrl: manualCover,
      coverAlt: typeof post?.coverAlt === "string" ? post.coverAlt.trim() : "",
      source: "manual",
    };
  }

  const extracted = extractFirstImageFromPostContent(post?.content, post?.contentFormat);
  if (extracted?.coverImageUrl) {
    return {
      coverImageUrl: extracted.coverImageUrl,
      coverAlt: extracted.coverAlt || String(post?.title || "").trim() || "",
      source: "content",
    };
  }

  return {
    coverImageUrl: null,
    coverAlt: "",
    source: "none",
  };
};

export { isValidPostCoverImageUrl };
