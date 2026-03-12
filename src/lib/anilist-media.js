const normalizeName = (value) => String(value || "").replace(/\s+/g, " ").trim();

const normalizeCompanyId = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  const normalized = String(value).trim();
  return normalized || "";
};

const toRawStudioEntries = (studios) => {
  const edges = Array.isArray(studios?.edges) ? studios.edges : [];
  if (edges.length > 0) {
    return edges.map((edge) => ({
      isMain: edge?.isMain === true,
      node: edge?.node || null,
    }));
  }

  const nodes = Array.isArray(studios?.nodes) ? studios.nodes : [];
  return nodes.map((node) => ({
    isMain: false,
    node: node || null,
  }));
};

const dedupeStudioEntries = (entries) => {
  const seen = new Set();
  return entries.filter((entry) => {
    const id = normalizeCompanyId(entry?.id);
    const name = normalizeName(entry?.name).toLowerCase();
    const key = id || name;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export const extractAniListStudioEntries = (media) => {
  const rawEntries = toRawStudioEntries(media?.studios);
  return dedupeStudioEntries(
    rawEntries
      .map((entry) => ({
        id: normalizeCompanyId(entry?.node?.id),
        name: normalizeName(entry?.node?.name),
        isMain: entry?.isMain === true,
        isAnimationStudio: entry?.node?.isAnimationStudio === true,
      }))
      .filter((entry) => entry.name),
  );
};

export const deriveAniListMediaOrganization = (media) => {
  const companies = extractAniListStudioEntries(media);
  const animationStudios = companies
    .filter((company) => company.isAnimationStudio)
    .map((company) => company.name);
  const producers = companies
    .filter((company) => !company.isAnimationStudio)
    .map((company) => company.name);
  const studio =
    companies.find((company) => company.isMain && company.isAnimationStudio)?.name ||
    animationStudios[0] ||
    "";

  return {
    studio,
    animationStudios,
    producers,
  };
};
