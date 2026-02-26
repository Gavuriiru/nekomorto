const normalizeTags = (tags) =>
  Array.isArray(tags)
    ? tags
        .map((tag) => String(tag || ""))
        .filter((tag) => tag.length > 0)
    : [];

const buildComparableSnapshot = (snapshot) => {
  const safe = snapshot && typeof snapshot === "object" ? snapshot : {};
  return {
    title: String(safe.title || "").trim(),
    slug: String(safe.slug || "").trim(),
    status:
      safe.status === "scheduled" || safe.status === "published" || safe.status === "draft"
        ? safe.status
        : "draft",
    publishedAt: String(safe.publishedAt || "").trim(),
    scheduledAt: safe.scheduledAt ? String(safe.scheduledAt).trim() || null : null,
    projectId: String(safe.projectId || "").trim(),
    excerpt: String(safe.excerpt || ""),
    content: String(safe.content || ""),
    contentFormat: String(safe.contentFormat || "").trim(),
    author: String(safe.author || "").trim(),
    coverImageUrl: safe.coverImageUrl == null ? null : String(safe.coverImageUrl),
    coverAlt: String(safe.coverAlt || ""),
    seoTitle: String(safe.seoTitle || ""),
    seoDescription: String(safe.seoDescription || ""),
    tags: normalizeTags(safe.tags),
  };
};

export const buildPostVersionEditorialDedupKey = (versionRecord) =>
  JSON.stringify(buildComparableSnapshot(versionRecord?.snapshot));

export const dedupePostVersionRecordsNewestFirst = (records) => {
  const source = Array.isArray(records) ? records : [];
  const seen = new Set();
  const kept = [];
  source.forEach((record) => {
    if (!record || typeof record !== "object") {
      return;
    }
    const postId = String(record.postId || "").trim();
    if (!postId) {
      return;
    }
    const key = `${postId}::${buildPostVersionEditorialDedupKey(record)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    kept.push(record);
  });
  return kept;
};

