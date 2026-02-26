const getDisplayTimestampMs = (post) => {
  if (!post || typeof post !== "object") {
    return null;
  }
  const status = String(post.status || "").trim();
  const rawValue =
    status === "scheduled"
      ? post.scheduledAt || post.publishedAt || null
      : status === "published"
        ? post.publishedAt || null
        : null;
  const parsed = new Date(rawValue || "").getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

export const buildEditorialCalendarItems = (posts, { fromMs, toMs } = {}) => {
  const safeFromMs = Number(fromMs);
  const safeToMs = Number(toMs);
  const hasRange =
    Number.isFinite(safeFromMs) &&
    Number.isFinite(safeToMs) &&
    safeFromMs <= safeToMs;

  return (Array.isArray(posts) ? posts : [])
    .filter((post) => post && typeof post === "object")
    .filter((post) => !post.deletedAt)
    .filter((post) => post.status === "scheduled" || post.status === "published")
    .map((post) => {
      const displayAtMs = getDisplayTimestampMs(post);
      return { post, displayAtMs };
    })
    .filter((entry) => Number.isFinite(entry.displayAtMs))
    .filter((entry) => {
      if (!hasRange) {
        return true;
      }
      return entry.displayAtMs >= safeFromMs && entry.displayAtMs <= safeToMs;
    })
    .sort((left, right) => {
      if (left.displayAtMs !== right.displayAtMs) {
        return left.displayAtMs - right.displayAtMs;
      }
      return String(left.post.id || "").localeCompare(String(right.post.id || ""), "pt-BR");
    })
    .map(({ post }) => ({
      id: String(post.id || ""),
      title: String(post.title || ""),
      slug: String(post.slug || ""),
      status: post.status === "scheduled" ? "scheduled" : "published",
      projectId: post.projectId || "",
      publishedAt: String(post.publishedAt || ""),
      scheduledAt: post.status === "scheduled" ? post.scheduledAt || post.publishedAt || null : null,
    }));
};

