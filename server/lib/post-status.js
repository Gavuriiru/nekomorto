const isFiniteTimestamp = (value) => Number.isFinite(value);

const getPublishedAtMs = (publishedAt) => {
  const parsed = new Date(publishedAt || "").getTime();
  return isFiniteTimestamp(parsed) ? parsed : null;
};

export const resolvePostStatus = (rawStatus, publishedAt, nowMs = Date.now()) => {
  if (rawStatus === "draft") {
    return "draft";
  }
  if (rawStatus === "published") {
    return "published";
  }

  const publishedAtMs = getPublishedAtMs(publishedAt);

  if (rawStatus === "scheduled") {
    if (publishedAtMs !== null && publishedAtMs <= nowMs) {
      return "published";
    }
    return "scheduled";
  }

  if (publishedAtMs !== null && publishedAtMs > nowMs) {
    return "scheduled";
  }
  return "published";
};
