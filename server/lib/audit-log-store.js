export const createAuditLogStore = ({
  auditDefaultMetaKeys = [],
  auditEnabledActionPattern,
  auditMaxEntries = 20_000,
  auditMetaAllowlist = {},
  auditMetaStringMax = 256,
  auditRetentionMs = 0,
  crypto,
  fixMojibakeText,
  getDataRepository,
  getPrimaryAppOrigin,
  primaryAppOrigin,
} = {}) => {
  const parseAuditTs = (value) => {
    const ts = new Date(value || 0).getTime();
    return Number.isFinite(ts) ? ts : null;
  };

  const inferAuditStatus = (action) => {
    const normalized = String(action || "").toLowerCase();
    if (!normalized) {
      return "success";
    }
    if (normalized.includes("denied")) {
      return "denied";
    }
    if (normalized.includes("failed") || normalized.includes("rate_limited")) {
      return "failed";
    }
    return "success";
  };

  const isAuditActionEnabled = (action) => {
    const normalized = String(action || "").toLowerCase();
    if (!normalized) {
      return false;
    }
    if (normalized === "integrations.webhooks_editorial.read") {
      return true;
    }
    if (
      normalized.includes(".read") ||
      normalized.endsWith(".read") ||
      normalized.includes("_read")
    ) {
      return false;
    }
    return auditEnabledActionPattern.test(normalized);
  };

  const truncateAuditString = (value) => {
    const text = String(value || "");
    if (text.length <= auditMetaStringMax) {
      return text;
    }
    return `${text.slice(0, auditMetaStringMax)}...`;
  };

  const redactSignedUrl = (value) => {
    const text = String(value || "");
    const hasSensitiveQuery = /[?&](token|signature|sig|x-amz-signature|x-goog-signature)=/i.test(
      text,
    );
    if (!hasSensitiveQuery) {
      return null;
    }
    try {
      const origin =
        (typeof getPrimaryAppOrigin === "function" ? getPrimaryAppOrigin() : primaryAppOrigin) || "";
      const parsed = new URL(text, origin);
      return `${parsed.origin}${parsed.pathname}?[redacted]`;
    } catch {
      return "[redacted_url]";
    }
  };

  const isSensitiveAuditKey = (key) =>
    /(token|secret|password|cookie|authorization|session|credential|jwt|signature|sig)/i.test(
      String(key || ""),
    );

  const redactSensitiveFields = (value, key = "", depth = 0) => {
    if (depth > 4) {
      return "[max_depth]";
    }
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === "string") {
      if (isSensitiveAuditKey(key)) {
        return "[redacted]";
      }
      const redactedUrl = redactSignedUrl(value);
      return redactedUrl || truncateAuditString(value);
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.slice(0, 20).map((item) => redactSensitiveFields(item, key, depth + 1));
    }
    if (typeof value === "object") {
      const next = {};
      Object.keys(value)
        .slice(0, 30)
        .forEach((entryKey) => {
          if (isSensitiveAuditKey(entryKey)) {
            next[entryKey] = "[redacted]";
            return;
          }
          next[entryKey] = redactSensitiveFields(value[entryKey], entryKey, depth + 1);
        });
      return next;
    }
    return truncateAuditString(value);
  };

  const sanitizeAuditMeta = (meta, action) => {
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
      return {};
    }
    const keys = auditMetaAllowlist[action] || auditDefaultMetaKeys;
    const next = {};
    keys.forEach((key) => {
      if (!(key in meta)) {
        return;
      }
      next[key] = redactSensitiveFields(meta[key], key);
    });
    return next;
  };

  const compactAuditEntries = (entries, nowTs = Date.now()) => {
    const cutoff = nowTs - auditRetentionMs;
    const filtered = entries
      .filter((item) => parseAuditTs(item?.ts) !== null)
      .filter((item) => parseAuditTs(item.ts) >= cutoff)
      .sort((a, b) => parseAuditTs(a.ts) - parseAuditTs(b.ts));
    if (filtered.length <= auditMaxEntries) {
      return filtered;
    }
    return filtered.slice(filtered.length - auditMaxEntries);
  };

  const normalizeAuditEntry = (item) => {
    const normalizedAction = String(item?.action || "").trim();
    return {
      id: String(item?.id || crypto.randomUUID()),
      ts: item?.ts || new Date().toISOString(),
      actorId: String(item?.actorId || "anonymous"),
      actorName: String(item?.actorName || "anonymous"),
      ip: String(item?.ip || ""),
      action: normalizedAction,
      resource: String(item?.resource || ""),
      resourceId: item?.resourceId ? String(item.resourceId) : null,
      status: ["success", "failed", "denied"].includes(item?.status)
        ? item.status
        : inferAuditStatus(normalizedAction),
      requestId: item?.requestId ? String(item.requestId) : null,
      meta: sanitizeAuditMeta(item?.meta, normalizedAction),
    };
  };

  const loadAuditLog = () => {
    const dataRepository = getDataRepository?.();
    if (!dataRepository) {
      return [];
    }
    const entries = dataRepository.loadAuditLog();
    return (Array.isArray(entries) ? entries : []).map(normalizeAuditEntry);
  };

  const writeAuditLog = (entries) => {
    const compacted = compactAuditEntries(Array.isArray(entries) ? entries : []);
    const dataRepository = getDataRepository?.();
    if (dataRepository) {
      dataRepository.writeAuditLog(compacted);
    }
  };

  const appendAuditLog = (req, action, resource, meta = {}) => {
    try {
      if (!isAuditActionEnabled(action)) {
        return;
      }
      const now = new Date();
      const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
      const sessionUser = req.session?.user || null;
      const sanitizedMeta = sanitizeAuditMeta(meta, action);
      const resourceId =
        sanitizedMeta?.resourceId ||
        sanitizedMeta?.id ||
        sanitizedMeta?.slug ||
        sanitizedMeta?.projectId ||
        sanitizedMeta?.userId ||
        null;
      const actorNameRaw = sessionUser?.name || "anonymous";
      const actorNameFixed =
        typeof fixMojibakeText === "function"
          ? fixMojibakeText(actorNameRaw)
          : String(actorNameRaw);
      const actorName =
        String(actorNameFixed || "anonymous")
          .replace(/\uFFFD/g, "")
          .trim() || "anonymous";
      const entry = {
        id: crypto.randomUUID(),
        ts: now.toISOString(),
        actorId: sessionUser?.id || "anonymous",
        actorName,
        ip: String(ip || ""),
        action: String(action || ""),
        resource: String(resource || ""),
        resourceId,
        status: inferAuditStatus(action),
        requestId: req.requestId ? String(req.requestId) : null,
        meta: sanitizedMeta,
      };
      const dataRepository = getDataRepository?.();
      if (dataRepository && typeof dataRepository.appendAuditLogEntry === "function") {
        dataRepository.appendAuditLogEntry(entry);
        return;
      }
      const existing = loadAuditLog();
      existing.push(entry);
      writeAuditLog(existing);
    } catch {
      // ignore audit errors
    }
  };

  return {
    appendAuditLog,
    isAuditActionEnabled,
    loadAuditLog,
    parseAuditTs,
  };
};
