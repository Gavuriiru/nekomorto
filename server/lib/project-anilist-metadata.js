const toUniqueStringArray = (value) => {
  const seen = new Set();
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter((item) => {
      if (!item) {
        return false;
      }
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

export const normalizeAniListOrganization = (organization) => ({
  studio: String(organization?.studio || "").trim(),
  animationStudios: toUniqueStringArray(organization?.animationStudios),
  producers: toUniqueStringArray(organization?.producers),
});

export const mergeAniListOrganizationIntoProject = (project, organization) => {
  const normalizedOrganization = normalizeAniListOrganization(organization);
  return {
    ...project,
    studio: normalizedOrganization.studio || String(project?.studio || "").trim(),
    animationStudios: normalizedOrganization.animationStudios,
    producers: normalizedOrganization.producers,
  };
};

export const hasAniListOrganizationChanges = (project, mergedProject) =>
  String(project?.studio || "").trim() !== String(mergedProject?.studio || "").trim() ||
  JSON.stringify(toUniqueStringArray(project?.animationStudios)) !==
    JSON.stringify(toUniqueStringArray(mergedProject?.animationStudios)) ||
  JSON.stringify(toUniqueStringArray(project?.producers)) !==
    JSON.stringify(toUniqueStringArray(mergedProject?.producers));
