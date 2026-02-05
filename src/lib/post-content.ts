import { renderLexicalJsonToHtml } from "@/lib/lexical/serialize";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const createSlug = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeLocalUrl = (rawUrl: string) => {
  if (!rawUrl) {
    return rawUrl;
  }
  if (typeof window === "undefined") {
    return rawUrl;
  }
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("/")) {
    return `${window.location.origin}${trimmed}`;
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
};

const applyInlineFormatting = (value: string) => {
  let html = value;
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_match, alt, url, title) => {
    const safeAlt = escapeHtml(String(alt || ""));
    const safeUrl = escapeHtml(normalizeLocalUrl(String(url || "")));
    const titleAttr = title ? ` title="${escapeHtml(String(title))}"` : "";
    return `<img src="${safeUrl}" alt="${safeAlt}" loading="lazy"${titleAttr} />`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, text, url) => {
    const safeText = escapeHtml(String(text || ""));
    const safeUrl = escapeHtml(normalizeLocalUrl(String(url || "")));
    return `<a href="${safeUrl}" target="_blank" rel="noreferrer">${safeText}</a>`;
  });
  return html;
};

const markdownToHtml = (markdown: string) => {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;

  const closeLists = () => {
    if (inUl) {
      output.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      output.push("</ol>");
      inOl = false;
    }
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      closeLists();
      if (inBlockquote) {
        output.push("</blockquote>");
        inBlockquote = false;
      }
      return;
    }

    if (line.startsWith(">")) {
      closeLists();
      if (!inBlockquote) {
        output.push("<blockquote>");
        inBlockquote = true;
      }
      output.push(`<p>${applyInlineFormatting(line.replace(/^>\s?/, ""))}</p>`);
      return;
    }

    if (inBlockquote) {
      output.push("</blockquote>");
      inBlockquote = false;
    }

    if (line.startsWith("### ")) {
      closeLists();
      output.push(`<h3>${applyInlineFormatting(line.replace(/^###\s+/, ""))}</h3>`);
      return;
    }
    if (line.startsWith("## ")) {
      closeLists();
      output.push(`<h2>${applyInlineFormatting(line.replace(/^##\s+/, ""))}</h2>`);
      return;
    }
    if (line.startsWith("# ")) {
      closeLists();
      output.push(`<h1>${applyInlineFormatting(line.replace(/^#\s+/, ""))}</h1>`);
      return;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (inUl) {
        output.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        output.push("<ol>");
        inOl = true;
      }
      output.push(`<li>${applyInlineFormatting(line.replace(/^\d+\.\s+/, ""))}</li>`);
      return;
    }

    if (/^[-*+]\s+/.test(line)) {
      if (inOl) {
        output.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        output.push("<ul>");
        inUl = true;
      }
      output.push(`<li>${applyInlineFormatting(line.replace(/^[-*+]\s+/, ""))}</li>`);
      return;
    }

    closeLists();
    output.push(`<p>${applyInlineFormatting(line)}</p>`);
  });

  closeLists();
  if (inBlockquote) {
    output.push("</blockquote>");
  }

  return output.join("\n");
};

const normalizeLocalHtml = (value: string) => {
  if (!value || typeof window === "undefined") {
    return value;
  }
  return value.replace(
    /(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?(\/[^\s"'<>)]*)/gi,
    (_match, proto, _host, _port, path) => `${window.location.origin}${path || ""}`,
  );
};

const sanitizeHtml = (value: string) => {
  if (!value) {
    return "";
  }
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return value
      .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script>/gi, "")
      .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style>/gi, "")
      .replace(/\son\w+\s*=\s*(["']).*?\1/gi, "")
      .replace(/javascript:/gi, "");
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(value, "text/html");
  const allowedTags = new Set([
    "A",
    "P",
    "BR",
    "STRONG",
    "EM",
    "B",
    "I",
    "U",
    "S",
    "DEL",
    "UL",
    "OL",
    "LI",
    "BLOCKQUOTE",
    "H1",
    "H2",
    "H3",
    "H4",
    "IMG",
    "HR",
    "CODE",
    "PRE",
    "SPAN",
    "DIV",
    "TABLE",
    "THEAD",
    "TBODY",
    "TR",
    "TD",
    "TH",
    "IFRAME",
  ]);
  const allowedAttrs = new Set([
    "class",
    "title",
    "style",
    "colspan",
    "rowspan",
    "width",
    "height",
    "frameborder",
    "allow",
    "allowfullscreen",
  ]);
  const allowedUrlAttrs = new Set(["href", "src"]);
  const isSafeUrl = (url: string) =>
    /^(https?:|mailto:|\/|#)/i.test(url);

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const toRemove: Element[] = [];
  while (walker.nextNode()) {
    const el = walker.currentNode as Element;
    if (!allowedTags.has(el.tagName)) {
      toRemove.push(el);
      continue;
    }
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        return;
      }
      if (name.startsWith("data-lexical-")) {
        return;
      }
      if (allowedUrlAttrs.has(attr.name)) {
        if (!isSafeUrl(attr.value)) {
          el.removeAttribute(attr.name);
        }
        return;
      }
      if (!allowedAttrs.has(attr.name) && !allowedUrlAttrs.has(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
    if (el.tagName === "A" && el.getAttribute("target") === "_blank") {
      el.setAttribute("rel", "noopener noreferrer");
    }
  }
  toRemove.forEach((el) => el.remove());
  return doc.body.innerHTML;
};

export type PostContentFormat = "markdown" | "html" | "lexical";

export const renderPostContent = (content: string, format: PostContentFormat) => {
  if (format === "lexical") {
    return sanitizeHtml(normalizeLocalHtml(renderLexicalJsonToHtml(content || "")));
  }
  if (format === "html") {
    return sanitizeHtml(normalizeLocalHtml(content || ""));
  }
  return markdownToHtml(content || "");
};

const htmlToMarkdown = (html: string) => {
  let output = html;
  output = output.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n");
  output = output.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n");
  output = output.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n");
  output = output.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  output = output.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  output = output.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  output = output.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");
  output = output.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, "<u>$1</u>");
  output = output.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, "~~$1~~");
  output = output.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, (_m, src, alt) => {
    const safeAlt = String(alt || "");
    const safeSrc = normalizeLocalUrl(String(src || ""));
    return `![${safeAlt}](${safeSrc})`;
  });
  output = output.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, (_m, src) => {
    const safeSrc = normalizeLocalUrl(String(src || ""));
    return `![](${safeSrc})`;
  });
  output = output.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const safeHref = normalizeLocalUrl(String(href || ""));
    const safeText = String(text || "");
    return `[${safeText}](${safeHref})`;
  });
  output = output.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner) => {
    const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
    return `\n${items}\n`;
  });
  output = output.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner) => {
    let idx = 1;
    const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_li, text) => `${idx++}. ${text}\n`);
    return `\n${items}\n`;
  });
  output = output.replace(/<br\s*\/?>/gi, "\n");
  output = output.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");
  output = output.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "> $1\n");
  output = output.replace(/<[^>]+>/g, "");
  return output.replace(/\n{3,}/g, "\n\n").trim();
};

export const convertPostContent = (content: string, from: "markdown" | "html", to: "markdown" | "html") => {
  if (from === to) {
    return content;
  }
  if (from === "markdown") {
    return renderPostContent(content, "markdown");
  }
  return htmlToMarkdown(content);
};

export const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ");

export const estimateReadTime = (content: string, format: PostContentFormat) => {
  const html = renderPostContent(content, format);
  const text = stripHtml(html);
  const words = text.split(/\s+/).filter(Boolean);
  const minutes = Math.max(1, Math.ceil(words.length / 200));
  return `${minutes} min de leitura`;
};
