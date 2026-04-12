export const normalizeTypeLookupKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const dedupeProjectTypes = (typesInput) => {
  const map = new Map();
  (Array.isArray(typesInput) ? typesInput : []).forEach((raw) => {
    const type = String(raw || "").trim();
    const key = normalizeTypeLookupKey(type);
    if (!type || !key || map.has(key)) {
      return;
    }
    map.set(key, type);
  });
  return Array.from(map.values()).sort((left, right) =>
    left.localeCompare(right, "pt-BR", { sensitivity: "base" }),
  );
};

export const isChapterBasedType = (type) => {
  const normalized = normalizeTypeLookupKey(type);
  return (
    normalized.includes("mang") ||
    normalized.includes("webtoon") ||
    normalized.includes("light") ||
    normalized.includes("novel")
  );
};

export const isLightNovelType = (type) => {
  const normalized = normalizeTypeLookupKey(type);
  return normalized.includes("light") || normalized.includes("novel");
};

export const createGetActiveProjectTypes = ({
  defaultProjectTypeCatalog = [],
  loadProjects,
  normalizeProjects,
} = {}) => {
  return ({ includeDefaults = true } = {}) => {
    const existingTypes = (
      typeof normalizeProjects === "function"
        ? normalizeProjects(typeof loadProjects === "function" ? loadProjects() : [])
        : []
    )
      .filter((project) => !project?.deletedAt)
      .map((project) => String(project?.type || "").trim())
      .filter(Boolean);

    const deduped = dedupeProjectTypes(existingTypes);
    if (deduped.length > 0) {
      return deduped;
    }
    return includeDefaults ? dedupeProjectTypes(defaultProjectTypeCatalog) : [];
  };
};

export default {
  createGetActiveProjectTypes,
  dedupeProjectTypes,
  isChapterBasedType,
  isLightNovelType,
  normalizeTypeLookupKey,
};
