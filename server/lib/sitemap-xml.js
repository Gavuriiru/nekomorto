const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toIsoDateOrNull = (value) => {
  const parsed = new Date(value || "");
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

export const normalizeSitemapEntries = (entries) =>
  (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const loc = String(entry.loc || "").trim();
      if (!loc) {
        return null;
      }
      const lastmod = toIsoDateOrNull(entry.lastmod);
      const changefreq = String(entry.changefreq || "").trim().toLowerCase();
      const priorityRaw = Number(entry.priority);
      const priority =
        Number.isFinite(priorityRaw) && priorityRaw >= 0 && priorityRaw <= 1
          ? Math.round(priorityRaw * 10) / 10
          : null;
      return {
        loc,
        lastmod,
        changefreq: changefreq || null,
        priority,
      };
    })
    .filter(Boolean);

export const buildSitemapXml = (entries) => {
  const normalized = normalizeSitemapEntries(entries);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  normalized.forEach((entry) => {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
    if (entry.lastmod) {
      lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    }
    if (entry.changefreq) {
      lines.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
    }
    if (entry.priority !== null) {
      lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
    }
    lines.push("  </url>");
  });
  lines.push("</urlset>");
  return `${lines.join("\n")}\n`;
};

