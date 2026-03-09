import fs from "fs";
import path from "path";

export const EPUB_IMPORT_JOB_STATUSES = Object.freeze([
  "queued",
  "processing",
  "completed",
  "failed",
  "expired",
]);

export const EPUB_IMPORT_JOB_RESULT_TTL_MS = 72 * 60 * 60 * 1000;

const normalizeText = (value) => String(value || "").trim();

const toIsoOrNull = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

export const normalizeEpubImportJobStatus = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (EPUB_IMPORT_JOB_STATUSES.includes(normalized)) {
    return normalized;
  }
  return "queued";
};

export const ensureEpubImportJobsDirectory = (jobsDir) => {
  const directory = path.resolve(String(jobsDir || ""));
  fs.mkdirSync(directory, { recursive: true });
  return directory;
};

export const writeEpubImportJobResult = ({ jobsDir, jobId, result } = {}) => {
  const directory = ensureEpubImportJobsDirectory(jobsDir);
  const safeJobId = normalizeText(jobId) || "epub-import-job";
  const fullPath = path.join(directory, `${safeJobId}.json`);
  fs.writeFileSync(fullPath, JSON.stringify(result || {}, null, 2), "utf8");
  return fullPath;
};

export const readEpubImportJobResult = (filePath) => {
  const safeFilePath = normalizeText(filePath);
  if (!safeFilePath || !fs.existsSync(safeFilePath)) {
    return null;
  }
  const raw = fs.readFileSync(safeFilePath, "utf8");
  return JSON.parse(raw);
};

export const deleteEpubImportJobResult = (filePath) => {
  const safeFilePath = normalizeText(filePath);
  if (!safeFilePath || !fs.existsSync(safeFilePath)) {
    return false;
  }
  try {
    fs.unlinkSync(safeFilePath);
    return true;
  } catch {
    return false;
  }
};

export const toEpubImportJobApiResponse = (job, { result } = {}) => ({
  id: normalizeText(job?.id),
  projectId: normalizeText(job?.projectId),
  requestedBy: normalizeText(job?.requestedBy),
  status: normalizeEpubImportJobStatus(job?.status),
  summary: job?.summary && typeof job.summary === "object" && !Array.isArray(job.summary) ? job.summary : {},
  error: job?.error ? String(job.error) : null,
  createdAt: toIsoOrNull(job?.createdAt),
  startedAt: toIsoOrNull(job?.startedAt),
  finishedAt: toIsoOrNull(job?.finishedAt),
  expiresAt: toIsoOrNull(job?.expiresAt),
  hasResult: Boolean(job?.resultPath),
  ...(result !== undefined ? { result } : {}),
});
