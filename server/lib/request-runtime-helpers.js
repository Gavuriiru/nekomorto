export const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const parseEditRevisionOptions = (value) => {
  if (!isPlainObject(value)) {
    return { ifRevision: "", forceOverride: false };
  }

  return {
    ifRevision: String(value.ifRevision || "").trim(),
    forceOverride: value.forceOverride === true,
  };
};

export default {
  isPlainObject,
  parseEditRevisionOptions,
};
