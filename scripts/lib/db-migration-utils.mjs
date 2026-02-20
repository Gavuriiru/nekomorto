import crypto from "crypto";
import fs from "fs";
import path from "path";

export const rootDir = path.resolve(process.cwd());
export const dataDir = path.join(rootDir, "server", "data");
export const uploadsRootDir = path.join(rootDir, "public", "uploads");

const readFileSafe = (filePath) => {
  try {
    return fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  } catch {
    return null;
  }
};

export const readJsonFile = (fileName, fallback) => {
  const filePath = path.join(dataDir, fileName);
  const raw = readFileSafe(filePath);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const readJsonLinesFile = (fileName) => {
  const filePath = path.join(dataDir, fileName);
  const raw = readFileSafe(filePath);
  if (raw === null) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const ensureObject = (value, fallback = {}) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : fallback;

export const loadSnapshotFromJson = () => {
  const snapshot = {
    posts: readJsonFile("posts.json", []),
    projects: readJsonFile("projects.json", []),
    users: readJsonFile("users.json", []),
    comments: readJsonFile("comments.json", []),
    updates: readJsonFile("updates.json", []),
    uploads: readJsonFile("uploads.json", []),
    pages: readJsonFile("pages.json", {}),
    siteSettings: readJsonFile("site-settings.json", {}),
    tagTranslations: readJsonFile("tag-translations.json", { tags: {}, genres: {}, staffRoles: {} }),
    linkTypes: readJsonFile("link-types.json", []),
    ownerIds: readJsonFile("owner-ids.json", []),
    allowedUsers: readJsonFile("allowed-users.json", []),
    auditLog: readJsonFile("audit-log.json", []),
    analyticsDaily: readJsonFile("analytics-daily.json", {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      days: {},
    }),
    analyticsMeta: readJsonFile("analytics-meta.json", {
      schemaVersion: 1,
      retentionDays: 90,
      aggregateRetentionDays: 365,
      updatedAt: new Date().toISOString(),
    }),
    analyticsEvents: readJsonLinesFile("analytics-events.jsonl"),
  };
  return normalizeSnapshot(snapshot);
};

export const normalizeSnapshot = (snapshot) => ({
  posts: ensureArray(snapshot.posts),
  projects: ensureArray(snapshot.projects),
  users: ensureArray(snapshot.users),
  comments: ensureArray(snapshot.comments),
  updates: ensureArray(snapshot.updates),
  uploads: ensureArray(snapshot.uploads),
  pages: ensureObject(snapshot.pages, {}),
  siteSettings: ensureObject(snapshot.siteSettings, {}),
  tagTranslations: ensureObject(snapshot.tagTranslations, { tags: {}, genres: {}, staffRoles: {} }),
  linkTypes: ensureArray(snapshot.linkTypes),
  ownerIds: Array.from(new Set(ensureArray(snapshot.ownerIds).map((id) => String(id).trim()).filter(Boolean))),
  allowedUsers: Array.from(
    new Set(ensureArray(snapshot.allowedUsers).map((id) => String(id).trim()).filter(Boolean)),
  ),
  auditLog: ensureArray(snapshot.auditLog),
  analyticsDaily: ensureObject(snapshot.analyticsDaily, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    days: {},
  }),
  analyticsMeta: ensureObject(snapshot.analyticsMeta, {
    schemaVersion: 1,
    retentionDays: 90,
    aggregateRetentionDays: 365,
    updatedAt: new Date().toISOString(),
  }),
  analyticsEvents: ensureArray(snapshot.analyticsEvents),
});

const UPLOAD_PATH_REGEX = /\/uploads\/[^\s"'`<>\\]+/g;
const ABSOLUTE_URL_REGEX = /https?:\/\/[^\s"'()<>]+/gi;

const normalizeUploadPath = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value
    .trim()
    .split("?")[0]
    .split("#")[0]
    .replace(/[)\],.;:]+$/g, "");
  return trimmed.startsWith("/uploads/") ? trimmed : null;
};

const extractUploadsPaths = (value) => {
  if (!value || typeof value !== "string") return [];

  const normalizedInput = value.replace(/\\\//g, "/");
  const matches = [];

  const directMatches = normalizedInput.match(UPLOAD_PATH_REGEX) || [];
  matches.push(...directMatches);

  const absoluteUrls = normalizedInput.match(ABSOLUTE_URL_REGEX) || [];
  absoluteUrls.forEach((url) => {
    const index = url.indexOf("/uploads/");
    if (index >= 0) {
      matches.push(url.slice(index));
    }
  });

  return Array.from(
    new Set(
      matches
        .map((item) => normalizeUploadPath(item))
        .filter(Boolean),
    ),
  );
};

const collectUploadsFromValue = (value, targetSet) => {
  if (!value) return;
  if (typeof value === "string") {
    const urls = extractUploadsPaths(value);
    urls.forEach((url) => targetSet.add(url));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUploadsFromValue(item, targetSet));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectUploadsFromValue(item, targetSet));
  }
};

export const collectReferencedUploadUrls = (snapshot) => {
  const urls = new Set();
  [snapshot.posts, snapshot.projects, snapshot.users, snapshot.comments, snapshot.updates, snapshot.pages, snapshot.siteSettings]
    .forEach((entry) => collectUploadsFromValue(entry, urls));
  return urls;
};

const extensionToMime = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".zip": "application/zip",
};

const detectMimeType = (fileName) => {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  return extensionToMime[ext] || "application/octet-stream";
};

export const backfillMissingUploads = (snapshot, nowIso = new Date().toISOString()) => {
  const referenced = collectReferencedUploadUrls(snapshot);
  const existing = new Set(
    ensureArray(snapshot.uploads)
      .map((item) => (item?.url ? String(item.url) : ""))
      .filter(Boolean),
  );

  const added = [];
  const missingOnDisk = [];

  const buildBackfillId = (uploadUrl) =>
    `upload-backfill-${crypto.createHash("sha1").update(uploadUrl).digest("hex").slice(0, 24)}`;

  referenced.forEach((uploadUrl) => {
    if (existing.has(uploadUrl)) return;
    const relativePath = uploadUrl.replace(/^\/uploads\//, "");
    const absolutePath = path.join(uploadsRootDir, ...relativePath.split("/"));
    if (!fs.existsSync(absolutePath)) {
      missingOnDisk.push(uploadUrl);
      return;
    }
    const stat = fs.statSync(absolutePath);
    const fileName = path.basename(relativePath);
    const folder = path.dirname(relativePath) === "." ? "" : path.dirname(relativePath).split(path.sep).join("/");
    const deterministicCreatedAt = Number.isFinite(stat.mtimeMs)
      ? new Date(stat.mtimeMs).toISOString()
      : nowIso;
    added.push({
      // Keep deterministic IDs so apply + verify produce stable checksums.
      id: buildBackfillId(uploadUrl),
      url: uploadUrl,
      fileName,
      folder,
      size: Number(stat.size || 0),
      mime: detectMimeType(fileName),
      createdAt: deterministicCreatedAt,
    });
    existing.add(uploadUrl);
  });

  return { added, missingOnDisk };
};

export const applyUploadBackfill = (snapshot, backfillResult) => {
  if (!backfillResult?.added?.length) return snapshot;
  return {
    ...snapshot,
    uploads: [...snapshot.uploads, ...backfillResult.added],
  };
};

const stableStringify = (value) => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
};

export const checksumOf = (value) =>
  crypto.createHash("sha256").update(stableStringify(value)).digest("hex");

export const snapshotCounts = (snapshot) => ({
  posts: ensureArray(snapshot.posts).length,
  projects: ensureArray(snapshot.projects).length,
  users: ensureArray(snapshot.users).length,
  comments: ensureArray(snapshot.comments).length,
  updates: ensureArray(snapshot.updates).length,
  uploads: ensureArray(snapshot.uploads).length,
  linkTypes: ensureArray(snapshot.linkTypes).length,
  ownerIds: ensureArray(snapshot.ownerIds).length,
  allowedUsers: ensureArray(snapshot.allowedUsers).length,
  auditLog: ensureArray(snapshot.auditLog).length,
  analyticsEvents: ensureArray(snapshot.analyticsEvents).length,
  hasPages: snapshot.pages && typeof snapshot.pages === "object" ? 1 : 0,
  hasSiteSettings: snapshot.siteSettings && typeof snapshot.siteSettings === "object" ? 1 : 0,
  hasTagTranslations: snapshot.tagTranslations && typeof snapshot.tagTranslations === "object" ? 1 : 0,
  hasAnalyticsDaily: snapshot.analyticsDaily && typeof snapshot.analyticsDaily === "object" ? 1 : 0,
  hasAnalyticsMeta: snapshot.analyticsMeta && typeof snapshot.analyticsMeta === "object" ? 1 : 0,
});
