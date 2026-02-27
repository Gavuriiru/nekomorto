import fs from "fs";
import path from "path";

export const ADMIN_EXPORT_DATASETS = Object.freeze([
  "audit_log",
  "security_events",
  "users",
  "sessions",
]);

export const ADMIN_EXPORT_FORMATS = Object.freeze(["csv", "jsonl"]);

export const ADMIN_EXPORT_STATUSES = Object.freeze([
  "queued",
  "processing",
  "completed",
  "failed",
  "expired",
]);

const normalizeText = (value) => String(value || "").trim();

export const normalizeExportDataset = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (ADMIN_EXPORT_DATASETS.includes(normalized)) {
    return normalized;
  }
  return "audit_log";
};

export const normalizeExportFormat = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (ADMIN_EXPORT_FORMATS.includes(normalized)) {
    return normalized;
  }
  return "csv";
};

export const normalizeExportStatus = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (ADMIN_EXPORT_STATUSES.includes(normalized)) {
    return normalized;
  }
  return "queued";
};

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

export const normalizeExportFilters = (value) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    dateFrom: toIsoOrNull(source.dateFrom),
    dateTo: toIsoOrNull(source.dateTo),
    actorUserId: normalizeText(source.actorUserId),
    targetUserId: normalizeText(source.targetUserId),
    status: normalizeText(source.status).toLowerCase(),
    severity: normalizeText(source.severity).toLowerCase(),
    action: normalizeText(source.action).toLowerCase(),
    resource: normalizeText(source.resource).toLowerCase(),
    q: normalizeText(source.q).toLowerCase(),
  };
};

const matchesQuery = (record, query) => {
  if (!query) {
    return true;
  }
  const haystack = JSON.stringify(record || {}).toLowerCase();
  return haystack.includes(query);
};

const parseTs = (value) => {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : null;
};

export const filterByDateRange = (entries, { dateFrom, dateTo, tsAccessor } = {}) => {
  const fromTs = parseTs(dateFrom);
  const toTs = parseTs(dateTo);
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const raw = typeof tsAccessor === "function" ? tsAccessor(entry) : entry?.ts || entry?.createdAt;
    const ts = parseTs(raw);
    if (ts === null) {
      return false;
    }
    if (fromTs !== null && ts < fromTs) {
      return false;
    }
    if (toTs !== null && ts > toTs) {
      return false;
    }
    return true;
  });
};

export const filterExportEntries = (entries, filters, { fieldAccessors = {} } = {}) => {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const safeFilters = normalizeExportFilters(filters);
  return safeEntries.filter((entry) => {
    const actorUserId =
      (typeof fieldAccessors.actorUserId === "function"
        ? fieldAccessors.actorUserId(entry)
        : entry?.actorUserId || entry?.actorId) || "";
    const targetUserId =
      (typeof fieldAccessors.targetUserId === "function"
        ? fieldAccessors.targetUserId(entry)
        : entry?.targetUserId || entry?.resourceId) || "";
    const status =
      (typeof fieldAccessors.status === "function" ? fieldAccessors.status(entry) : entry?.status) || "";
    const severity =
      (typeof fieldAccessors.severity === "function" ? fieldAccessors.severity(entry) : entry?.severity) || "";
    const action =
      (typeof fieldAccessors.action === "function" ? fieldAccessors.action(entry) : entry?.action) || "";
    const resource =
      (typeof fieldAccessors.resource === "function" ? fieldAccessors.resource(entry) : entry?.resource) || "";

    if (safeFilters.actorUserId && String(actorUserId) !== safeFilters.actorUserId) {
      return false;
    }
    if (safeFilters.targetUserId && String(targetUserId) !== safeFilters.targetUserId) {
      return false;
    }
    if (safeFilters.status && String(status).toLowerCase() !== safeFilters.status) {
      return false;
    }
    if (safeFilters.severity && String(severity).toLowerCase() !== safeFilters.severity) {
      return false;
    }
    if (safeFilters.action && String(action).toLowerCase() !== safeFilters.action) {
      return false;
    }
    if (safeFilters.resource && String(resource).toLowerCase() !== safeFilters.resource) {
      return false;
    }
    if (!matchesQuery(entry, safeFilters.q)) {
      return false;
    }
    return true;
  });
};

const escapeCsv = (value) => {
  const text = String(value ?? "");
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const encodeRowsToCsv = ({ rows, headers }) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const lines = [];
  lines.push(safeHeaders.join(","));
  safeRows.forEach((row) => {
    lines.push(
      safeHeaders
        .map((header) => {
          const value = row && typeof row === "object" ? row[header] : "";
          if (value && typeof value === "object") {
            return escapeCsv(JSON.stringify(value));
          }
          return escapeCsv(value);
        })
        .join(","),
    );
  });
  return `\uFEFF${lines.join("\n")}`;
};

export const encodeRowsToJsonl = ({ rows }) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  return `${safeRows.map((row) => JSON.stringify(row || {})).join("\n")}\n`;
};

export const ensureExportDirectory = (exportsDir) => {
  const directory = path.resolve(String(exportsDir || ""));
  fs.mkdirSync(directory, { recursive: true });
  return directory;
};

export const writeExportFile = ({ exportsDir, fileName, format, rows, headers }) => {
  const directory = ensureExportDirectory(exportsDir);
  const safeFormat = normalizeExportFormat(format);
  const extension = safeFormat === "jsonl" ? "jsonl" : "csv";
  const fullPath = path.join(directory, `${fileName}.${extension}`);
  const body =
    safeFormat === "jsonl" ? encodeRowsToJsonl({ rows }) : encodeRowsToCsv({ rows, headers });
  fs.writeFileSync(fullPath, body, "utf8");
  return fullPath;
};
