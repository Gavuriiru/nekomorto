type DashboardPostEditorSnapshotSource = {
  title: string;
  slug: string;
  excerpt: string;
  contentLexical: string;
  author: string;
  coverImageUrl: string;
  coverAlt: string;
  status: "draft" | "scheduled" | "published";
  publishAt: string;
  projectId: string;
  tags: string[];
};

export const buildDashboardPostEditorSnapshot = (form: DashboardPostEditorSnapshotSource) =>
  JSON.stringify({
    title: form.title,
    slug: form.slug,
    excerpt: form.excerpt,
    contentLexical: form.contentLexical,
    author: form.author,
    coverImageUrl: form.coverImageUrl,
    coverAlt: form.coverAlt,
    status: form.status,
    publishAt: form.publishAt,
    projectId: form.projectId,
    tags: form.tags,
  });

export const normalizeComparableDashboardPostCoverUrl = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("/uploads/")) {
    return trimmed.split(/[?#]/)[0] || trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // Keep non-URL values as-is.
  }
  return trimmed;
};

export const areDashboardPostCoverUrlsEquivalent = (left?: string | null, right?: string | null) =>
  normalizeComparableDashboardPostCoverUrl(left) ===
  normalizeComparableDashboardPostCoverUrl(right);

export const extractLexicalImageUploadUrls = (content?: string | null) => {
  const raw = String(content || "").trim();
  if (!raw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const urls: string[] = [];
  const seen = new Set<string>();
  const visit = (node: unknown) => {
    if (!node) {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== "object") {
      return;
    }
    const lexicalNode = node as Record<string, unknown>;
    const type = typeof lexicalNode.type === "string" ? lexicalNode.type.toLowerCase() : "";
    if (type === "image") {
      const src = typeof lexicalNode.src === "string" ? lexicalNode.src : "";
      const normalized = normalizeComparableDashboardPostCoverUrl(src);
      if (normalized.startsWith("/uploads/") && !seen.has(normalized)) {
        seen.add(normalized);
        urls.push(normalized);
      }
    }
    if (Array.isArray(lexicalNode.children)) {
      lexicalNode.children.forEach(visit);
    }
    Object.entries(lexicalNode).forEach(([key, value]) => {
      if (key === "children" || key === "src" || key === "altText" || key === "type") {
        return;
      }
      visit(value);
    });
  };
  const root = (parsed as { root?: unknown })?.root;
  visit(root ?? parsed);
  return urls;
};
