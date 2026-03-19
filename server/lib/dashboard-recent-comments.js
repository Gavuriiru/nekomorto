const toTimestamp = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const selectRecentApprovedComments = (comments, limit = 3) => {
  const normalizedLimit = Number(limit);
  const resolvedLimit = Number.isFinite(normalizedLimit) && normalizedLimit > 0 ? normalizedLimit : 3;

  return (Array.isArray(comments) ? comments : [])
    .filter((comment) => comment?.status === "approved")
    .slice()
    .sort((a, b) => toTimestamp(b?.createdAt) - toTimestamp(a?.createdAt))
    .slice(0, resolvedLimit);
};
