import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_ROOT_DIR = path.resolve(__dirname, "../..");

const DATA_FILES_TO_REWRITE = [
  "posts.json",
  "projects.json",
  "site-settings.json",
  "pages.json",
  "comments.json",
  "updates.json",
  "users.json",
];

const UPLOADS_FILE = "uploads.json";
const MANAGED_UPLOAD_ROOT_FOLDERS = new Set(["posts", "projects", "shared"]);
const DEFAULT_PRIVATE_ROOT_FOLDERS = new Set(["downloads", "socials", "users"]);

const mimeByExtension = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

const uploadPathPattern = /\/uploads\/[^\\\s"'`<>()\[\]{},]+/gi;
const absoluteUrlPattern = /https?:\/\/[^\\\s"'`<>()\[\]{},]+/gi;

const toPosix = (value) => String(value || "").replace(/\\/g, "/");

const fileExists = (value) => {
  try {
    return fs.existsSync(value);
  } catch {
    return false;
  }
};

export const sanitizeSlug = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const resolveProjectFolders = (project) => {
  const id = String(project?.id || "").trim();
  const titleSlug = sanitizeSlug(project?.title || "");
  const projectKey = id || titleSlug || "draft";
  const root = `projects/${projectKey}`;
  return {
    projectId: id || projectKey,
    root,
    episodes: `${root}/episodes`,
  };
};

export const getUploadRootSegment = (relativePath) => {
  const normalized = toPosix(String(relativePath || "")).replace(/^\/+/, "");
  const [first] = normalized.split("/");
  return String(first || "").trim().toLowerCase();
};

const isPrivateFolder = (relativePath, privateRootFolders) =>
  privateRootFolders.has(getUploadRootSegment(relativePath));

const isManagedSourceRelative = (relativePath, privateRootFolders) => {
  const normalized = toPosix(String(relativePath || "")).replace(/^\/+/, "");
  if (!normalized) {
    return true;
  }
  if (!normalized.includes("/")) {
    return true;
  }
  const root = getUploadRootSegment(normalized);
  if (!root) {
    return true;
  }
  if (privateRootFolders.has(root)) {
    return false;
  }
  return MANAGED_UPLOAD_ROOT_FOLDERS.has(root);
};

export const normalizeUploadUrl = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("/uploads/")) {
    const embedded = trimmed.match(uploadPathPattern);
    if (embedded?.length) {
      return embedded[0].split("?")[0].split("#")[0];
    }
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname && parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // ignore invalid URL
  }
  return null;
};

export const extractUploadUrlsFromText = (value) => {
  if (!value || typeof value !== "string") {
    return [];
  }
  const matches = value.match(uploadPathPattern) || [];
  return matches.map((item) => item.split("?")[0].split("#")[0]);
};

const collectUploadUrls = (value, urls) => {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    const direct = normalizeUploadUrl(value);
    if (direct) {
      urls.add(direct);
    }
    extractUploadUrlsFromText(value).forEach((item) => urls.add(item));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUploadUrls(item, urls));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectUploadUrls(item, urls));
  }
};

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceUploadReferencesInText = (value, mapping) => {
  if (!value || typeof value !== "string" || mapping.size === 0) {
    return { value, count: 0 };
  }

  let next = value;
  let count = 0;
  for (const [oldUrl, newUrl] of mapping.entries()) {
    if (oldUrl === newUrl || !next.includes(oldUrl)) {
      continue;
    }
    const pattern = new RegExp(escapeRegExp(oldUrl), "g");
    const matches = next.match(pattern);
    if (matches?.length) {
      count += matches.length;
      next = next.replace(pattern, newUrl);
    }
  }

  next = next.replace(absoluteUrlPattern, (match) => {
    const normalized = normalizeUploadUrl(match);
    if (!normalized) {
      return match;
    }
    const mapped = mapping.get(normalized);
    if (!mapped || mapped === normalized) {
      return match;
    }
    count += 1;
    try {
      const parsed = new URL(match);
      parsed.pathname = mapped;
      return parsed.toString();
    } catch {
      return match.replace(normalized, mapped);
    }
  });

  return { value: next, count };
};

const replaceUploadReferencesDeep = (value, mapping) => {
  if (typeof value === "string") {
    return replaceUploadReferencesInText(value, mapping);
  }
  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((item) => {
      const result = replaceUploadReferencesDeep(item, mapping);
      count += result.count;
      return result.value;
    });
    return { value: next, count };
  }
  if (value && typeof value === "object") {
    let count = 0;
    const next = { ...value };
    Object.keys(next).forEach((key) => {
      const result = replaceUploadReferencesDeep(next[key], mapping);
      count += result.count;
      next[key] = result.value;
    });
    return { value: next, count };
  }
  return { value, count: 0 };
};

const readJson = (filePath) => {
  if (!fileExists(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
};

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const getUploadRelativePath = (uploadUrl) =>
  toPosix(String(uploadUrl || "").replace(/^\/uploads\//, "").replace(/^\/+/, ""));

const listUploadFilesOnDisk = (uploadsDir) => {
  const files = new Set();
  if (!fileExists(uploadsDir)) {
    return files;
  }
  const walk = (dir, base = "") => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry.name);
      const nextBase = toPosix(path.join(base, entry.name));
      if (entry.isDirectory()) {
        walk(fullPath, nextBase);
      } else {
        files.add(nextBase);
      }
    });
  };
  walk(uploadsDir, "");
  return files;
};

const getUsageBucket = (usageByUrl, uploadUrl) => {
  if (!usageByUrl.has(uploadUrl)) {
    usageByUrl.set(uploadUrl, {
      posts: new Set(),
      projectIds: new Set(),
      projectMainIds: new Set(),
      projectEpisodeIds: new Set(),
    });
  }
  return usageByUrl.get(uploadUrl);
};

const addPostUsage = (usageByUrl, maybeUrl, postRef) => {
  const uploadUrl = normalizeUploadUrl(maybeUrl);
  if (!uploadUrl) {
    return;
  }
  const usage = getUsageBucket(usageByUrl, uploadUrl);
  usage.posts.add(postRef);
};

const addProjectUsage = (usageByUrl, maybeUrl, projectId, kind) => {
  const uploadUrl = normalizeUploadUrl(maybeUrl);
  if (!uploadUrl) {
    return;
  }
  const usage = getUsageBucket(usageByUrl, uploadUrl);
  usage.projectIds.add(projectId);
  if (kind === "episode") {
    usage.projectEpisodeIds.add(projectId);
  } else {
    usage.projectMainIds.add(projectId);
  }
};

const collectUsage = (posts, projects) => {
  const usageByUrl = new Map();
  const projectFoldersById = new Map();

  (Array.isArray(projects) ? projects : []).forEach((project) => {
    const folders = resolveProjectFolders(project);
    projectFoldersById.set(folders.projectId, folders);
  });

  (Array.isArray(posts) ? posts : []).forEach((post, index) => {
    const postRef = String(post?.slug || post?.id || `post-${index + 1}`);
    addPostUsage(usageByUrl, post?.coverImageUrl, postRef);
    extractUploadUrlsFromText(post?.content).forEach((uploadUrl) =>
      addPostUsage(usageByUrl, uploadUrl, postRef),
    );
  });

  (Array.isArray(projects) ? projects : []).forEach((project) => {
    const { projectId } = resolveProjectFolders(project);
    addProjectUsage(usageByUrl, project?.cover, projectId, "main");
    addProjectUsage(usageByUrl, project?.banner, projectId, "main");
    addProjectUsage(usageByUrl, project?.heroImageUrl, projectId, "main");

    (Array.isArray(project?.relations) ? project.relations : []).forEach((relation) => {
      addProjectUsage(usageByUrl, relation?.image, projectId, "main");
    });

    (Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : []).forEach((episode) => {
      addProjectUsage(usageByUrl, episode?.coverImageUrl, projectId, "episode");
      extractUploadUrlsFromText(episode?.content).forEach((uploadUrl) =>
        addProjectUsage(usageByUrl, uploadUrl, projectId, "episode"),
      );
      extractUploadUrlsFromText(episode?.title).forEach((uploadUrl) =>
        addProjectUsage(usageByUrl, uploadUrl, projectId, "episode"),
      );
    });

    extractUploadUrlsFromText(project?.description).forEach((uploadUrl) =>
      addProjectUsage(usageByUrl, uploadUrl, projectId, "main"),
    );
  });

  return { usageByUrl, projectFoldersById };
};

export const classifyTargetFolder = (usage, projectFoldersById) => {
  const postsCount = usage.posts.size;
  const projectsCount = usage.projectIds.size;

  if (projectsCount > 1) {
    return "shared";
  }
  if (projectsCount === 1) {
    const [projectId] = [...usage.projectIds];
    const projectFolders = projectFoldersById.get(projectId);
    if (!projectFolders) {
      return "shared";
    }
    if (usage.projectMainIds.size === 0 && usage.projectEpisodeIds.size > 0) {
      return projectFolders.episodes;
    }
    return projectFolders.root;
  }
  if (postsCount > 0) {
    return "posts";
  }
  return null;
};

export const ensureUniqueTargetRelative = ({
  proposedRelative,
  sourceRelative,
  existingFilesOnDisk,
  reservedTargets,
  oldUrl,
}) => {
  const cleanProposed = toPosix(proposedRelative).replace(/^\/+/, "");
  const cleanSource = toPosix(sourceRelative).replace(/^\/+/, "");
  const hasConflict = (candidate) =>
    reservedTargets.has(candidate) ||
    (existingFilesOnDisk.has(candidate) && candidate !== cleanSource);

  if (!hasConflict(cleanProposed)) {
    reservedTargets.add(cleanProposed);
    return cleanProposed;
  }

  const parsed = path.posix.parse(cleanProposed);
  const hash = crypto.createHash("sha1").update(oldUrl).digest("hex").slice(0, 8);
  let index = 0;
  while (index < 5000) {
    const suffix = index === 0 ? `-migrated-${hash}` : `-migrated-${hash}-${index}`;
    const candidateName = `${parsed.name}${suffix}${parsed.ext}`;
    const candidate = parsed.dir ? `${parsed.dir}/${candidateName}` : candidateName;
    if (!hasConflict(candidate)) {
      reservedTargets.add(candidate);
      return candidate;
    }
    index += 1;
  }
  return null;
};

const extToMime = (fileName) => {
  const ext = String(path.extname(fileName || "").replace(".", "")).toLowerCase();
  return mimeByExtension[ext] || "";
};

const mergeUploadEntry = (current, incoming) => {
  if (!current) {
    return incoming;
  }
  return {
    ...current,
    ...incoming,
    id: current.id || incoming.id || crypto.randomUUID(),
  };
};

const ensureUploadEntry = ({ uploadMap, uploadUrl, skipped, uploadsDir }) => {
  if (uploadMap.has(uploadUrl)) {
    return;
  }
  const relative = getUploadRelativePath(uploadUrl);
  const filePath = path.join(uploadsDir, relative);
  if (!fileExists(filePath)) {
    skipped.push({ type: "missing_upload_file_for_inventory", url: uploadUrl, path: relative });
    return;
  }
  const stat = fs.statSync(filePath);
  uploadMap.set(uploadUrl, {
    id: crypto.randomUUID(),
    url: uploadUrl,
    fileName: path.posix.basename(relative),
    folder: path.posix.dirname(relative) === "." ? "" : path.posix.dirname(relative),
    size: stat.size,
    mime: extToMime(relative),
    createdAt: stat.mtime.toISOString(),
  });
};

const sumReplacements = (replacementSummary) =>
  replacementSummary.reduce((acc, item) => acc + Number(item.replacements || 0), 0);

export const runUploadsReorganization = ({
  rootDir = DEFAULT_ROOT_DIR,
  applyChanges = false,
  privateRootFolders = DEFAULT_PRIVATE_ROOT_FOLDERS,
} = {}) => {
  const dataDir = path.join(rootDir, "server", "data");
  const uploadsDir = path.join(rootDir, "public", "uploads");
  const privateFoldersSet =
    privateRootFolders instanceof Set ? privateRootFolders : new Set(privateRootFolders || []);

  const loadedData = new Map();
  [...DATA_FILES_TO_REWRITE, UPLOADS_FILE].forEach((fileName) => {
    loadedData.set(fileName, readJson(path.join(dataDir, fileName)));
  });

  const posts = loadedData.get("posts.json");
  const projects = loadedData.get("projects.json");
  const uploadsInventory = loadedData.get(UPLOADS_FILE);

  if (!Array.isArray(posts) || !Array.isArray(projects)) {
    throw new Error("posts.json ou projects.json invalidos.");
  }

  const { usageByUrl, projectFoldersById } = collectUsage(posts, projects);
  const referencedUploadUrls = [...usageByUrl.keys()].sort();
  const existingFilesOnDisk = listUploadFilesOnDisk(uploadsDir);
  const reservedTargets = new Set();
  const skipped = [];
  const plannedMoves = [];
  const plannedMapping = new Map();

  referencedUploadUrls.forEach((oldUrl) => {
    const usage = usageByUrl.get(oldUrl);
    const targetFolder = classifyTargetFolder(usage, projectFoldersById);
    if (!targetFolder) {
      skipped.push({ type: "unclassified", url: oldUrl });
      return;
    }

    const sourceRelative = getUploadRelativePath(oldUrl);
    const sourceRoot = getUploadRootSegment(sourceRelative);
    if (isPrivateFolder(sourceRelative, privateFoldersSet)) {
      skipped.push({ type: "private_folder_skipped", url: oldUrl, path: sourceRelative, root: sourceRoot });
      return;
    }
    if (!isManagedSourceRelative(sourceRelative, privateFoldersSet)) {
      skipped.push({ type: "unmanaged_folder_skipped", url: oldUrl, path: sourceRelative, root: sourceRoot });
      return;
    }

    const sourcePath = path.join(uploadsDir, sourceRelative);
    if (!fileExists(sourcePath)) {
      skipped.push({ type: "missing_source_file", url: oldUrl, path: sourceRelative });
      return;
    }

    const baseName = path.posix.basename(sourceRelative);
    const proposedRelative = toPosix(path.posix.join(targetFolder, baseName));
    if (proposedRelative === sourceRelative) {
      return;
    }
    const targetRelative = ensureUniqueTargetRelative({
      proposedRelative,
      sourceRelative,
      existingFilesOnDisk,
      reservedTargets,
      oldUrl,
    });
    if (!targetRelative) {
      skipped.push({ type: "target_conflict_unresolved", url: oldUrl, target: proposedRelative });
      return;
    }
    const newUrl = `/uploads/${targetRelative}`;
    plannedMapping.set(oldUrl, newUrl);
    plannedMoves.push({
      oldUrl,
      newUrl,
      sourceRelative,
      targetRelative,
      sourcePath,
      targetPath: path.join(uploadsDir, targetRelative),
    });
  });

  const moveFailures = [];
  const effectiveMapping = new Map();
  if (applyChanges) {
    plannedMoves.forEach((move) => {
      if (!fileExists(move.sourcePath)) {
        moveFailures.push({ ...move, reason: "missing_source_before_move" });
        return;
      }
      try {
        fs.mkdirSync(path.dirname(move.targetPath), { recursive: true });
        fs.renameSync(move.sourcePath, move.targetPath);
        effectiveMapping.set(move.oldUrl, move.newUrl);
      } catch (error) {
        moveFailures.push({ ...move, reason: error?.message || "move_failed" });
      }
    });
  } else {
    plannedMapping.forEach((newUrl, oldUrl) => {
      effectiveMapping.set(oldUrl, newUrl);
    });
  }

  const rewrittenData = new Map();
  const replacementSummary = [];
  DATA_FILES_TO_REWRITE.forEach((fileName) => {
    const payload = loadedData.get(fileName);
    const safePayload = payload === null || payload === undefined ? {} : payload;
    const { value, count } = replaceUploadReferencesDeep(safePayload, effectiveMapping);
    rewrittenData.set(fileName, value);
    replacementSummary.push({ fileName, replacements: count });
    if (applyChanges && count > 0) {
      writeJson(path.join(dataDir, fileName), value);
    }
  });

  const uploadsArray = Array.isArray(uploadsInventory) ? uploadsInventory : [];
  const nextUploadsByUrl = new Map();
  uploadsArray.forEach((item) => {
    const normalizedOriginal = normalizeUploadUrl(item?.url);
    if (!normalizedOriginal) {
      return;
    }
    const mapped = effectiveMapping.get(normalizedOriginal) || normalizedOriginal;
    const relative = getUploadRelativePath(mapped);
    const merged = {
      ...item,
      url: mapped,
      fileName: path.posix.basename(relative),
      folder: path.posix.dirname(relative) === "." ? "" : path.posix.dirname(relative),
    };
    const current = nextUploadsByUrl.get(mapped);
    nextUploadsByUrl.set(mapped, mergeUploadEntry(current, merged));
  });

  const referencedAfter = new Set();
  collectUploadUrls(rewrittenData.get("posts.json"), referencedAfter);
  collectUploadUrls(rewrittenData.get("projects.json"), referencedAfter);
  [...referencedAfter].forEach((uploadUrl) =>
    ensureUploadEntry({ uploadMap: nextUploadsByUrl, uploadUrl, skipped, uploadsDir }),
  );

  const nextUploads = [...nextUploadsByUrl.values()].sort((a, b) =>
    String(a.url || "").localeCompare(String(b.url || ""), "en"),
  );

  if (applyChanges) {
    writeJson(path.join(dataDir, UPLOADS_FILE), nextUploads);
  }

  const mappings = [...effectiveMapping.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "en"))
    .map(([oldUrl, newUrl]) => ({ oldUrl, newUrl }));
  const totalRewrites = sumReplacements(replacementSummary);

  return {
    mode: applyChanges ? "apply" : "dry-run",
    applyChanges,
    referencedUrlsCount: referencedUploadUrls.length,
    plannedMovesCount: plannedMoves.length,
    appliedMovesCount: applyChanges ? effectiveMapping.size : 0,
    effectiveMappingsCount: effectiveMapping.size,
    moveFailuresCount: moveFailures.length,
    uploadsInventoryCount: nextUploads.length,
    totalRewrites,
    mappings,
    replacementsByFile: replacementSummary,
    skipped,
    failures: moveFailures,
  };
};

export const __testing = {
  uploadPathPattern,
  normalizeUploadUrl,
  extractUploadUrlsFromText,
  resolveProjectFolders,
  classifyTargetFolder,
  ensureUniqueTargetRelative,
  getUploadRootSegment,
};

