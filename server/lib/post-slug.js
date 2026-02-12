export const createSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const createUniqueSlug = (value, existingSlugs = []) => {
  const baseSlug = createSlug(value);
  if (!baseSlug) {
    return "";
  }

  const takenSlugs = new Set(
    (Array.isArray(existingSlugs) ? existingSlugs : [])
      .map((item) => createSlug(item))
      .filter(Boolean),
  );

  if (!takenSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  let candidate = `${baseSlug}-${counter}`;
  while (takenSlugs.has(candidate)) {
    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }
  return candidate;
};
