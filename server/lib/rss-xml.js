const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toRfc2822 = (value) => {
  const parsed = new Date(value || "");
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed.toUTCString();
};

const normalizeItem = (item, index) => {
  const title = String(item?.title || "").trim() || `Item ${index + 1}`;
  const link = String(item?.link || "").trim();
  const guid = String(item?.guid || link || `item-${index + 1}`).trim();
  const description = String(item?.description || "").trim();
  const pubDate = toRfc2822(item?.pubDate);
  const categories = Array.isArray(item?.categories)
    ? item.categories.map((category) => String(category || "").trim()).filter(Boolean)
    : [];
  return {
    title,
    link,
    guid,
    description,
    pubDate,
    categories,
  };
};

export const buildRssXml = ({
  title,
  link,
  description,
  selfUrl = "",
  language = "pt-BR",
  items = [],
} = {}) => {
  const safeTitle = String(title || "").trim() || "Feed";
  const safeLink = String(link || "").trim();
  const safeDescription = String(description || "").trim() || safeTitle;
  const safeSelfUrl = String(selfUrl || "").trim();
  const normalizedItems = (Array.isArray(items) ? items : []).map(normalizeItem);

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(safeTitle)}</title>`,
    `    <link>${escapeXml(safeLink)}</link>`,
    `    <description>${escapeXml(safeDescription)}</description>`,
    `    <language>${escapeXml(language)}</language>`,
  ];
  if (safeSelfUrl) {
    lines.push(
      `    <atom:link href="${escapeXml(safeSelfUrl)}" rel="self" type="application/rss+xml" />`,
    );
  }
  normalizedItems.forEach((item) => {
    lines.push("    <item>");
    lines.push(`      <title>${escapeXml(item.title)}</title>`);
    if (item.link) {
      lines.push(`      <link>${escapeXml(item.link)}</link>`);
    }
    lines.push(`      <guid isPermaLink="${item.guid === item.link ? "true" : "false"}">${escapeXml(item.guid)}</guid>`);
    if (item.pubDate) {
      lines.push(`      <pubDate>${escapeXml(item.pubDate)}</pubDate>`);
    }
    if (item.description) {
      lines.push(`      <description>${escapeXml(item.description)}</description>`);
    }
    item.categories.forEach((category) => {
      lines.push(`      <category>${escapeXml(category)}</category>`);
    });
    lines.push("    </item>");
  });
  lines.push("  </channel>");
  lines.push("</rss>");
  return `${lines.join("\n")}\n`;
};

