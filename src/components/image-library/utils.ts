import type { LibraryImageItem } from "@/components/image-library/types";

const PT_BR_NATURAL_COLLATOR = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});

export const toEffectiveName = (item: LibraryImageItem) =>
  item.name || item.fileName || item.label || "Imagem";

export const compareNaturalTextPtBr = (
  left: string | null | undefined,
  right: string | null | undefined,
) => PT_BR_NATURAL_COLLATOR.compare(String(left || ""), String(right || ""));

const stripUrlQueryAndHash = (value: string) => value.split(/[?#]/)[0] || "";

export const normalizeComparableUploadUrl = (value: string | null | undefined) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("/uploads/")) {
    return stripUrlQueryAndHash(trimmed);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // Ignore invalid absolute URLs and keep original value.
  }
  return trimmed;
};

export const sanitizeUploadFolderForComparison = (value: string | null | undefined) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value
    .trim()
    .replace(/[^a-z0-9/_-]+/gi, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
};

export const sanitizeUploadSlotForComparison = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const toLibraryItemRenderVersion = (item: LibraryImageItem) => {
  const variantVersion = Number(item.variantsVersion);
  if (Number.isFinite(variantVersion) && variantVersion > 0) {
    return `variant-${variantVersion}`;
  }
  const createdAt = String(item.createdAt || "").trim();
  if (!createdAt) {
    return "variant-1";
  }
  const createdAtTimestamp = new Date(createdAt).getTime();
  if (Number.isFinite(createdAtTimestamp) && createdAtTimestamp > 0) {
    return `created-${createdAtTimestamp}`;
  }
  return `created-${createdAt}`;
};

export const appendRenderVersionToUrl = (value: string, version: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed || !version) {
    return trimmed;
  }
  try {
    const isRelativeUrl = trimmed.startsWith("/");
    const parsed = isRelativeUrl ? new URL(trimmed, "http://localhost") : new URL(trimmed);
    parsed.searchParams.set("v", version);
    if (isRelativeUrl) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    const [withoutHash, hashFragment = ""] = trimmed.split("#", 2);
    const [basePath, search = ""] = withoutHash.split("?", 2);
    const params = new URLSearchParams(search);
    params.set("v", version);
    const nextSearch = params.toString();
    return `${basePath}${nextSearch ? `?${nextSearch}` : ""}${hashFragment ? `#${hashFragment}` : ""}`;
  }
};

export const toLibraryItemRenderUrl = (item: LibraryImageItem) => {
  if (item.source !== "upload") {
    return item.url;
  }
  return appendRenderVersionToUrl(item.url, toLibraryItemRenderVersion(item));
};

export const dedupeUrlsByComparableKey = (urls: string[]) => {
  const seen = new Set<string>();
  const deduped: string[] = [];
  urls.forEach((url) => {
    const normalized = normalizeComparableUploadUrl(url);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    deduped.push(url);
  });
  return deduped;
};

export const escapeRegexPattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getUploadRootSegment = (value: string | null | undefined) => {
  const normalizedFolder = sanitizeUploadFolderForComparison(value);
  return String(normalizedFolder.split("/")[0] || "").toLowerCase();
};

export const parseUploadUrlPath = (value: string | null | undefined) => {
  const normalizedUrl = normalizeComparableUploadUrl(value);
  if (!normalizedUrl.startsWith("/uploads/")) {
    return { folder: "", fileName: "" };
  }
  const relativePath = normalizedUrl.replace(/^\/uploads\//, "");
  const segments = relativePath.split("/").filter(Boolean);
  const fileName = segments.length > 0 ? segments[segments.length - 1] : "";
  const folder = segments.length > 1 ? segments.slice(0, -1).join("/") : "";
  return { folder, fileName };
};

export const resolveItemFolder = (item: LibraryImageItem) => {
  const explicitFolder = sanitizeUploadFolderForComparison(item.folder);
  if (explicitFolder) {
    return explicitFolder;
  }
  return sanitizeUploadFolderForComparison(parseUploadUrlPath(item.url).folder);
};

export const isFolderWithinSelection = ({
  itemFolder,
  selectedFolder,
}: {
  itemFolder: string | null | undefined;
  selectedFolder: string | null | undefined;
}) => {
  const normalizedItem = sanitizeUploadFolderForComparison(itemFolder);
  const normalizedSelected = sanitizeUploadFolderForComparison(selectedFolder);
  if (!normalizedSelected) {
    return normalizedItem === "";
  }
  return normalizedItem === normalizedSelected || normalizedItem.startsWith(`${normalizedSelected}/`);
};

export const listFolderAncestors = (value: string | null | undefined) => {
  const normalized = sanitizeUploadFolderForComparison(value);
  if (!normalized) {
    return [] as string[];
  }
  const segments = normalized.split("/").filter(Boolean);
  const ancestors: string[] = [];
  for (let index = 1; index <= segments.length; index += 1) {
    ancestors.push(segments.slice(0, index).join("/"));
  }
  return ancestors;
};

export const listFolderSelfAndAncestors = (value: string | null | undefined) => {
  const ancestors = listFolderAncestors(value);
  if (ancestors.length === 0) {
    return [] as string[];
  }
  return [...ancestors].reverse();
};

export const isProjectsNamespaceFolder = (folder: string | null | undefined) => {
  const normalized = sanitizeUploadFolderForComparison(folder);
  return normalized === "projects" || normalized.startsWith("projects/");
};

export const resolveProjectRootFromFolder = (folder: string) => {
  const normalized = sanitizeUploadFolderForComparison(folder);
  if (!normalized.startsWith("projects/")) {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 2) {
    return "";
  }
  return `${segments[0]}/${segments[1]}`;
};

export const toRelativeProjectFolderLabel = ({
  folder,
  projectRoot,
}: {
  folder: string;
  projectRoot: string;
}) => {
  const normalizedFolder = sanitizeUploadFolderForComparison(folder);
  const normalizedRoot = sanitizeUploadFolderForComparison(projectRoot);
  if (!normalizedFolder) {
    return "Sem pasta";
  }
  if (!normalizedRoot) {
    return normalizedFolder;
  }
  if (normalizedFolder === normalizedRoot) {
    return "Raiz do projeto";
  }
  if (normalizedFolder.startsWith(`${normalizedRoot}/`)) {
    return normalizedFolder.slice(normalizedRoot.length + 1);
  }
  return normalizedFolder;
};

export const resolveUploadFolderGroupTitle = ({
  folder,
  scopedProjectRoot,
  preferFullProjectPath = false,
}: {
  folder: string;
  scopedProjectRoot: string;
  preferFullProjectPath?: boolean;
}) => {
  const normalizedFolder = sanitizeUploadFolderForComparison(folder);
  if (!normalizedFolder) {
    return "Sem pasta";
  }
  const folderProjectRoot = resolveProjectRootFromFolder(normalizedFolder);
  if (preferFullProjectPath && folderProjectRoot) {
    return normalizedFolder;
  }
  return toRelativeProjectFolderLabel({
    folder: normalizedFolder,
    projectRoot: scopedProjectRoot || folderProjectRoot,
  });
};

export const compareProjectFolderGroupsRootFirst = <T extends { folder: string; title: string }>(
  left: T,
  right: T,
) => {
  const leftFolder = sanitizeUploadFolderForComparison(left.folder);
  const rightFolder = sanitizeUploadFolderForComparison(right.folder);
  const leftProjectRoot = resolveProjectRootFromFolder(leftFolder);
  const rightProjectRoot = resolveProjectRootFromFolder(rightFolder);

  if (leftProjectRoot && leftProjectRoot === rightProjectRoot) {
    const leftIsProjectRoot = leftFolder === leftProjectRoot;
    const rightIsProjectRoot = rightFolder === rightProjectRoot;
    if (leftIsProjectRoot !== rightIsProjectRoot) {
      return leftIsProjectRoot ? -1 : 1;
    }
  }

  const titleComparison = compareNaturalTextPtBr(left.title, right.title);
  if (titleComparison !== 0) {
    return titleComparison;
  }
  return compareNaturalTextPtBr(leftFolder, rightFolder);
};

export const resolveContextProjectIdFromFolder = (folder: string | null | undefined) => {
  const normalized = sanitizeUploadFolderForComparison(folder);
  if (!normalized.startsWith("projects/")) {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 2) {
    return "";
  }
  return String(segments[1] || "").trim();
};

export const resolveClosestFolderGroupKey = <T extends { key: string; folder: string }>(
  groups: T[],
  contextFolder: string | null | undefined,
) => {
  const candidates = listFolderSelfAndAncestors(contextFolder);
  if (candidates.length === 0) {
    return "";
  }
  const groupsByFolder = new Map<string, string>();
  groups.forEach((group) => {
    const normalizedFolder = sanitizeUploadFolderForComparison(group.folder);
    if (normalizedFolder) {
      groupsByFolder.set(normalizedFolder, group.key);
    }
  });
  for (const candidate of candidates) {
    const match = groupsByFolder.get(candidate);
    if (match) {
      return match;
    }
  }
  return "";
};
