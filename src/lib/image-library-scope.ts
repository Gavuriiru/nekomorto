const normalizeScopeFolder = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

const getScopeRoot = (value: string | null | undefined) =>
  String(normalizeScopeFolder(value).split("/")[0] || "").toLowerCase();

type UploadScopeGrants = Partial<Record<string, boolean>> | null | undefined;

type FilterImageLibraryFoldersByAccessOptions = {
  grants?: UploadScopeGrants;
  allowUsersSelf?: boolean;
};

const isFolderAllowedByGrants = (
  folder: string,
  { grants, allowUsersSelf = false }: FilterImageLibraryFoldersByAccessOptions,
) => {
  const root = getScopeRoot(folder);
  const hasFullAccess = grants?.uploads === true;
  if (hasFullAccess) {
    return true;
  }
  if (root === "posts") {
    return grants?.posts === true;
  }
  if (root === "projects") {
    return grants?.projetos === true;
  }
  if (root === "users") {
    return grants?.usuarios === true || allowUsersSelf;
  }
  if (root === "shared") {
    return grants?.paginas === true || grants?.posts === true || grants?.configuracoes === true;
  }
  if (!root || root === "branding" || root === "downloads" || root === "socials") {
    return grants?.configuracoes === true;
  }
  return false;
};

export const filterImageLibraryFoldersByAccess = (
  folders: string[],
  options: FilterImageLibraryFoldersByAccessOptions = {},
) => {
  const deduped = new Set<string>();
  (Array.isArray(folders) ? folders : []).forEach((folder) => {
    const normalizedFolder = normalizeScopeFolder(folder);
    if (!normalizedFolder) {
      return;
    }
    if (!isFolderAllowedByGrants(normalizedFolder, options)) {
      return;
    }
    deduped.add(normalizedFolder);
  });
  return Array.from(deduped);
};
