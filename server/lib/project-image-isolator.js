import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  ensureUniqueTargetRelative,
  extractUploadUrlsFromText,
  normalizeUploadUrl,
  resolveProjectFolders,
} from "./uploads-reorganizer.js";

const MIME_BY_EXTENSION = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

const absoluteUrlPattern = /https?:\/\/[^\\\s"'`<>()\[\]{},]+/gi;

const toPosix = (value) => String(value || "").replace(/\\/g, "/");

const normalizeDatasets = (datasets) => ({
  projects: Array.isArray(datasets?.projects) ? cloneValue(datasets.projects) : [],
  posts: Array.isArray(datasets?.posts) ? cloneValue(datasets.posts) : [],
  uploads: Array.isArray(datasets?.uploads) ? cloneValue(datasets.uploads) : [],
});

const cloneValue = (value) => {
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }
};

const normalizeExtension = (value) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/^\./, "");
  if (!normalized) {
    return "";
  }
  if (normalized === "jpg") {
    return "jpeg";
  }
  return normalized;
};

const getMimeFromFileName = (fileName) => {
  const extension = normalizeExtension(path.extname(String(fileName || "")));
  return MIME_BY_EXTENSION[extension] || "";
};

const toUploadRelativePath = (uploadUrl) =>
  toPosix(String(uploadUrl || "").replace(/^\/uploads\//, "").replace(/^\/+/, ""));

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

const listUploadFilesOnDisk = (uploadsDir) => {
  const files = new Set();
  if (!fs.existsSync(uploadsDir)) {
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

const collectUploadUrlsFromValue = (value, urls, { inEpisodeContext = false } = {}) => {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    const normalized = normalizeUploadUrl(value);
    if (normalized) {
      urls[inEpisodeContext ? "episode" : "main"].add(normalized);
    }
    extractUploadUrlsFromText(value).forEach((uploadUrl) => {
      urls[inEpisodeContext ? "episode" : "main"].add(uploadUrl);
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUploadUrlsFromValue(item, urls, { inEpisodeContext }));
    return;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      collectUploadUrlsFromValue(child, urls, {
        inEpisodeContext: inEpisodeContext || key === "episodeDownloads",
      });
    });
  }
};

const collectUploadUrlsDeep = (value, urls) => {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    const normalized = normalizeUploadUrl(value);
    if (normalized) {
      urls.add(normalized);
    }
    extractUploadUrlsFromText(value).forEach((uploadUrl) => urls.add(uploadUrl));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUploadUrlsDeep(item, urls));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectUploadUrlsDeep(item, urls));
  }
};

const isMainUsageAlreadyIsolated = (sourceRelative, usage) => {
  const projectRootPrefix = `${usage.projectFolder}/`;
  const projectEpisodesPrefix = `${usage.projectEpisodesFolder}/`;
  if (!sourceRelative.startsWith(projectRootPrefix)) {
    return false;
  }
  if (sourceRelative.startsWith(projectEpisodesPrefix)) {
    return false;
  }
  return true;
};

const isEpisodeUsageAlreadyIsolated = (sourceRelative, usage) =>
  sourceRelative.startsWith(`${usage.projectEpisodesFolder}/`);

const resolveTargetRelative = ({
  proposedRelative,
  sourceRelative,
  oldUrl,
  existingFilesOnDisk,
  reservedTargets,
}) => {
  const cleanProposed = toPosix(proposedRelative).replace(/^\/+/, "");
  if (!cleanProposed) {
    return null;
  }

  if (!reservedTargets.has(cleanProposed) && existingFilesOnDisk.has(cleanProposed)) {
    reservedTargets.add(cleanProposed);
    return cleanProposed;
  }

  return ensureUniqueTargetRelative({
    proposedRelative: cleanProposed,
    sourceRelative,
    existingFilesOnDisk,
    reservedTargets,
    oldUrl,
  });
};

const buildUploadEntryFromDisk = ({ targetUrl, targetRelative, targetPath, sourceEntry, previousEntry }) => {
  const stat = fs.statSync(targetPath);
  return {
    ...(previousEntry || {}),
    id: previousEntry?.id || crypto.randomUUID(),
    url: targetUrl,
    fileName: path.posix.basename(targetRelative),
    folder: path.posix.dirname(targetRelative) === "." ? "" : path.posix.dirname(targetRelative),
    size: Number(stat.size || 0),
    mime: String(previousEntry?.mime || sourceEntry?.mime || getMimeFromFileName(targetRelative)),
    width: Number.isFinite(previousEntry?.width)
      ? Number(previousEntry.width)
      : Number.isFinite(sourceEntry?.width)
        ? Number(sourceEntry.width)
        : null,
    height: Number.isFinite(previousEntry?.height)
      ? Number(previousEntry.height)
      : Number.isFinite(sourceEntry?.height)
        ? Number(sourceEntry.height)
        : null,
    createdAt: String(previousEntry?.createdAt || sourceEntry?.createdAt || stat.mtime.toISOString()),
  };
};

const areJsonEqual = (left, right) => {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

export const isolateProjectImageUploads = ({
  datasets,
  uploadsDir = path.join(process.cwd(), "public", "uploads"),
  applyChanges = false,
  targetProjectId = "",
} = {}) => {
  const normalizedDatasets = normalizeDatasets(datasets || {});
  const projects = normalizedDatasets.projects;
  const posts = normalizedDatasets.posts;
  const uploads = normalizedDatasets.uploads;

  if (!Array.isArray(projects)) {
    throw new Error("projects dataset invalido.");
  }
  if (!Array.isArray(posts)) {
    throw new Error("posts dataset invalido.");
  }
  if (!Array.isArray(uploads)) {
    throw new Error("uploads dataset invalido.");
  }

  const scopedProjects = targetProjectId
    ? projects
        .map((project, index) => ({ project, index }))
        .filter((item) => String(item.project?.id || "").trim() === String(targetProjectId).trim())
    : projects.map((project, index) => ({ project, index }));

  if (targetProjectId && scopedProjects.length === 0) {
    throw new Error(`Projeto "${targetProjectId}" nao encontrado.`);
  }

  const projectUsageByUrl = new Map();
  scopedProjects.forEach(({ project, index }) => {
    const projectFolders = resolveProjectFolders(project);
    const contextUrls = { main: new Set(), episode: new Set() };
    collectUploadUrlsFromValue(project, contextUrls, { inEpisodeContext: false });

    contextUrls.main.forEach((uploadUrl) => {
      if (!projectUsageByUrl.has(uploadUrl)) {
        projectUsageByUrl.set(uploadUrl, new Map());
      }
      const usageByProject = projectUsageByUrl.get(uploadUrl);
      const usageKey = `${projectFolders.projectId}#${index}`;
      const current = usageByProject.get(usageKey) || {
        projectIndex: index,
        projectId: projectFolders.projectId,
        projectFolder: projectFolders.root,
        projectEpisodesFolder: projectFolders.episodes,
        usesMain: false,
        usesEpisode: false,
      };
      current.usesMain = true;
      usageByProject.set(usageKey, current);
    });

    contextUrls.episode.forEach((uploadUrl) => {
      if (!projectUsageByUrl.has(uploadUrl)) {
        projectUsageByUrl.set(uploadUrl, new Map());
      }
      const usageByProject = projectUsageByUrl.get(uploadUrl);
      const usageKey = `${projectFolders.projectId}#${index}`;
      const current = usageByProject.get(usageKey) || {
        projectIndex: index,
        projectId: projectFolders.projectId,
        projectFolder: projectFolders.root,
        projectEpisodesFolder: projectFolders.episodes,
        usesMain: false,
        usesEpisode: false,
      };
      current.usesEpisode = true;
      usageByProject.set(usageKey, current);
    });
  });

  const postUsageUrls = new Set();
  posts.forEach((post) => collectUploadUrlsDeep(post, postUsageUrls));

  const existingFilesOnDisk = listUploadFilesOnDisk(uploadsDir);
  const reservedTargets = new Set();
  const rewritesByProjectIndex = new Map();
  const rewriteDetails = [];
  const copyPlans = [];
  const skipped = [];
  const missing = [];
  const conflicts = [];

  const ensureProjectRewriteMap = (projectIndex) => {
    if (!rewritesByProjectIndex.has(projectIndex)) {
      rewritesByProjectIndex.set(projectIndex, new Map());
    }
    return rewritesByProjectIndex.get(projectIndex);
  };

  for (const [oldUrl, usageByProject] of projectUsageByUrl.entries()) {
    const normalizedOldUrl = normalizeUploadUrl(oldUrl);
    if (!normalizedOldUrl) {
      continue;
    }
    const sourceRelative = toUploadRelativePath(normalizedOldUrl);
    if (!sourceRelative) {
      skipped.push({
        reason: "invalid_source_path",
        oldUrl: normalizedOldUrl,
      });
      continue;
    }

    const usedByMultipleProjects = usageByProject.size > 1;
    const usedByPosts = postUsageUrls.has(normalizedOldUrl);

    for (const usage of usageByProject.values()) {
      const isAlreadyIsolated = usage.usesMain
        ? isMainUsageAlreadyIsolated(sourceRelative, usage)
        : isEpisodeUsageAlreadyIsolated(sourceRelative, usage);
      if (isAlreadyIsolated) {
        skipped.push({
          reason: "already_isolated",
          oldUrl: normalizedOldUrl,
          projectId: usage.projectId,
          projectIndex: usage.projectIndex,
        });
        continue;
      }

      const targetFolder = usage.usesMain ? usage.projectFolder : usage.projectEpisodesFolder;
      const fallbackBase = crypto.createHash("sha1").update(normalizedOldUrl).digest("hex").slice(0, 8);
      const sourceBaseName = path.posix.basename(sourceRelative) || `asset-${fallbackBase}.bin`;
      const proposedRelative = toPosix(path.posix.join(targetFolder, sourceBaseName));

      const targetRelative = resolveTargetRelative({
        proposedRelative,
        sourceRelative,
        oldUrl: normalizedOldUrl,
        existingFilesOnDisk,
        reservedTargets,
      });

      if (!targetRelative) {
        conflicts.push({
          reason: "unresolved_target_conflict",
          oldUrl: normalizedOldUrl,
          projectId: usage.projectId,
          projectIndex: usage.projectIndex,
          targetFolder,
          proposedRelative,
        });
        continue;
      }

      const targetUrl = `/uploads/${targetRelative}`;
      if (targetUrl === normalizedOldUrl) {
        skipped.push({
          reason: "target_equals_source",
          oldUrl: normalizedOldUrl,
          projectId: usage.projectId,
          projectIndex: usage.projectIndex,
        });
        continue;
      }

      const sourcePath = path.join(uploadsDir, sourceRelative);
      const targetPath = path.join(uploadsDir, targetRelative);
      const sourceExists = existingFilesOnDisk.has(sourceRelative) || fs.existsSync(sourcePath);
      const targetExists = existingFilesOnDisk.has(targetRelative) || fs.existsSync(targetPath);

      if (!sourceExists && !targetExists) {
        missing.push({
          reason: "missing_source_and_target",
          oldUrl: normalizedOldUrl,
          projectId: usage.projectId,
          projectIndex: usage.projectIndex,
          sourceRelative,
          targetRelative,
        });
        continue;
      }

      const mappingKey = `${usage.projectIndex}\u0001${normalizedOldUrl}`;
      const projectRewriteMap = ensureProjectRewriteMap(usage.projectIndex);
      projectRewriteMap.set(normalizedOldUrl, targetUrl);

      rewriteDetails.push({
        mappingKey,
        projectId: usage.projectId,
        projectIndex: usage.projectIndex,
        oldUrl: normalizedOldUrl,
        newUrl: targetUrl,
        sourceRelative,
        targetRelative,
        targetFolder,
        usage: usage.usesMain ? "main" : "episode",
        reason: usedByMultipleProjects
          ? "shared_across_projects"
          : usedByPosts
            ? "shared_with_posts"
            : "single_project",
      });

      if (!targetExists && sourceExists && sourceRelative !== targetRelative) {
        copyPlans.push({
          mappingKey,
          projectId: usage.projectId,
          projectIndex: usage.projectIndex,
          oldUrl: normalizedOldUrl,
          newUrl: targetUrl,
          sourceRelative,
          targetRelative,
          sourcePath,
          targetPath,
        });
      }
    }
  }

  const failedRewriteKeys = new Set();
  const copied = [];

  if (applyChanges) {
    copyPlans.forEach((plan) => {
      try {
        if (!fs.existsSync(plan.sourcePath)) {
          throw new Error("missing_source_file");
        }
        fs.mkdirSync(path.dirname(plan.targetPath), { recursive: true });
        fs.copyFileSync(plan.sourcePath, plan.targetPath);
        existingFilesOnDisk.add(plan.targetRelative);
        copied.push({
          projectId: plan.projectId,
          projectIndex: plan.projectIndex,
          oldUrl: plan.oldUrl,
          newUrl: plan.newUrl,
          sourceRelative: plan.sourceRelative,
          targetRelative: plan.targetRelative,
        });
      } catch (error) {
        failedRewriteKeys.add(plan.mappingKey);
        const errorCode = String(error?.message || "copy_failed");
        if (errorCode === "missing_source_file") {
          missing.push({
            reason: "missing_source_file",
            oldUrl: plan.oldUrl,
            projectId: plan.projectId,
            projectIndex: plan.projectIndex,
            sourceRelative: plan.sourceRelative,
            targetRelative: plan.targetRelative,
          });
        } else {
          conflicts.push({
            reason: errorCode,
            oldUrl: plan.oldUrl,
            projectId: plan.projectId,
            projectIndex: plan.projectIndex,
            sourceRelative: plan.sourceRelative,
            targetRelative: plan.targetRelative,
          });
        }
      }
    });
  }

  const effectiveRewriteDetails = rewriteDetails.filter((detail) => !failedRewriteKeys.has(detail.mappingKey));
  if (failedRewriteKeys.size > 0) {
    rewritesByProjectIndex.forEach((mapping, projectIndex) => {
      for (const oldUrl of mapping.keys()) {
        if (failedRewriteKeys.has(`${projectIndex}\u0001${oldUrl}`)) {
          mapping.delete(oldUrl);
        }
      }
    });
  }

  const nextProjects = [...projects];
  let rewrittenReferences = 0;
  rewritesByProjectIndex.forEach((mapping, projectIndex) => {
    if (!mapping || mapping.size === 0) {
      return;
    }
    const current = projects[projectIndex];
    const result = replaceUploadReferencesDeep(current, mapping);
    if (result.count > 0) {
      nextProjects[projectIndex] = result.value;
      rewrittenReferences += result.count;
    }
  });

  let uploadsUpdatedCount = 0;
  let uploadsChanged = false;
  const uploadsByUrl = new Map(
    uploads
      .filter((item) => item?.url)
      .map((item) => [String(item.url), item]),
  );
  const uploadEntriesBySourceUrl = new Map(
    uploads
      .filter((item) => item?.url)
      .map((item) => [String(item.url), item]),
  );

  if (applyChanges) {
    effectiveRewriteDetails.forEach((detail) => {
      const targetRelative = toUploadRelativePath(detail.newUrl);
      const targetPath = path.join(uploadsDir, targetRelative);
      if (!fs.existsSync(targetPath)) {
        missing.push({
          reason: "target_file_missing_after_rewrite",
          oldUrl: detail.oldUrl,
          newUrl: detail.newUrl,
          projectId: detail.projectId,
          projectIndex: detail.projectIndex,
          targetRelative,
        });
        return;
      }

      const sourceEntry = uploadEntriesBySourceUrl.get(detail.oldUrl);
      const previousEntry = uploadsByUrl.get(detail.newUrl);
      const nextEntry = buildUploadEntryFromDisk({
        targetUrl: detail.newUrl,
        targetRelative,
        targetPath,
        sourceEntry,
        previousEntry,
      });
      if (!areJsonEqual(previousEntry || null, nextEntry)) {
        uploadsUpdatedCount += 1;
        uploadsChanged = true;
      }
      uploadsByUrl.set(detail.newUrl, nextEntry);
    });
  }

  const nextUploads = uploadsChanged
    ? Array.from(uploadsByUrl.values()).sort((a, b) => String(a.url || "").localeCompare(String(b.url || ""), "en"))
    : uploads;

  const changedDatasets = [];
  if (!areJsonEqual(projects, nextProjects)) {
    changedDatasets.push("projects");
  }
  if (!areJsonEqual(uploads, nextUploads)) {
    changedDatasets.push("uploads");
  }

  return {
    mode: applyChanges ? "apply" : "dry-run",
    applyChanges,
    scopedProjects: scopedProjects.length,
    copied: applyChanges ? copied.length : copyPlans.length,
    rewritten: effectiveRewriteDetails.length,
    rewrittenReferences,
    skipped: skipped.length,
    missing: missing.length,
    conflicts: conflicts.length,
    uploadsUpdated: applyChanges ? uploadsUpdatedCount : 0,
    rewrittenDatasets: {
      projects: nextProjects,
      uploads: nextUploads,
    },
    changedDatasets,
    details: {
      copied: applyChanges ? copied : copyPlans,
      rewritten: effectiveRewriteDetails,
      skipped,
      missing,
      conflicts,
    },
  };
};
