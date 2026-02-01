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

const applyInlineFormatting = (value: string) => {
  let html = value;
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"([^\"]+)\")?\)/g, (_match, alt, url, title) => {
    const safeAlt = escapeHtml(String(alt || ""));
    const safeUrl = escapeHtml(String(url || ""));
    const titleAttr = title ? ` title="${escapeHtml(String(title))}"` : "";
    return `<img src="${safeUrl}" alt="${safeAlt}" loading="lazy"${titleAttr} />`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, text, url) => {
    const safeText = escapeHtml(String(text || ""));
    const safeUrl = escapeHtml(String(url || ""));
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

export const renderPostContent = (content: string, format: "markdown" | "html") => {
  if (format === "html") {
    return content || "";
  }
  return markdownToHtml(content || "");
};

export const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ");

export const estimateReadTime = (content: string, format: "markdown" | "html") => {
  const html = renderPostContent(content, format);
  const text = stripHtml(html);
  const words = text.split(/\s+/).filter(Boolean);
  const minutes = Math.max(1, Math.ceil(words.length / 200));
  return `${minutes} min de leitura`;
};
