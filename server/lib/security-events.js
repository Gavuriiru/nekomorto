import crypto from "crypto";

export const SecurityEventSeverity = Object.freeze({
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
});

export const SecurityEventStatus = Object.freeze({
  OPEN: "open",
  ACK: "ack",
  RESOLVED: "resolved",
  IGNORED: "ignored",
});

const VALID_SEVERITIES = new Set(Object.values(SecurityEventSeverity));
const VALID_STATUSES = new Set(Object.values(SecurityEventStatus));

const normalizeText = (value) => String(value || "").trim();

export const normalizeSecurityEventSeverity = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (VALID_SEVERITIES.has(normalized)) {
    return normalized;
  }
  return SecurityEventSeverity.INFO;
};

export const normalizeSecurityEventStatus = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (VALID_STATUSES.has(normalized)) {
    return normalized;
  }
  return SecurityEventStatus.OPEN;
};

export const normalizeSecurityEventType = (value) => {
  const normalized = normalizeText(value).toLowerCase().replace(/[^a-z0-9._:-]/g, "_");
  return normalized || "security_event";
};

const parseIpV4Octets = (ip) => {
  const raw = normalizeText(ip);
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) {
    return null;
  }
  const parts = raw.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts;
};

export const getIpv4Network24 = (ip) => {
  const octets = parseIpV4Octets(ip);
  if (!octets) {
    return "";
  }
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
};

export const createSecurityEventPayload = ({
  type,
  severity,
  riskScore = 0,
  status = SecurityEventStatus.OPEN,
  actorUserId = null,
  targetUserId = null,
  ip = null,
  userAgent = null,
  sessionId = null,
  requestId = null,
  data = {},
  ts = new Date(),
} = {}) => ({
  id: crypto.randomUUID(),
  ts: new Date(ts || Date.now()),
  type: normalizeSecurityEventType(type),
  severity: normalizeSecurityEventSeverity(severity),
  riskScore: Number.isFinite(Number(riskScore)) ? Math.max(0, Math.floor(Number(riskScore))) : 0,
  status: normalizeSecurityEventStatus(status),
  actorUserId: actorUserId ? String(actorUserId) : null,
  targetUserId: targetUserId ? String(targetUserId) : null,
  ip: ip ? String(ip) : null,
  userAgent: userAgent ? String(userAgent).slice(0, 512) : null,
  sessionId: sessionId ? String(sessionId) : null,
  requestId: requestId ? String(requestId) : null,
  data: data && typeof data === "object" && !Array.isArray(data) ? data : {},
});

export const createSlidingWindowCounter = () => {
  const buckets = new Map();

  const prune = (key, nowTs, windowMs) => {
    const records = buckets.get(key) || [];
    const cutoff = nowTs - windowMs;
    const next = records.filter((ts) => ts >= cutoff);
    if (next.length === 0) {
      buckets.delete(key);
      return [];
    }
    buckets.set(key, next);
    return next;
  };

  return {
    record({ key, nowTs = Date.now(), windowMs = 60_000 } = {}) {
      const normalizedKey = normalizeText(key);
      if (!normalizedKey) {
        return { count: 0 };
      }
      const safeWindowMs = Number.isFinite(Number(windowMs))
        ? Math.min(Math.max(Math.floor(Number(windowMs)), 1_000), 24 * 60 * 60 * 1000)
        : 60_000;
      const history = prune(normalizedKey, nowTs, safeWindowMs);
      history.push(nowTs);
      buckets.set(normalizedKey, history);
      return { count: history.length };
    },
    count({ key, nowTs = Date.now(), windowMs = 60_000 } = {}) {
      const normalizedKey = normalizeText(key);
      if (!normalizedKey) {
        return 0;
      }
      return prune(normalizedKey, nowTs, windowMs).length;
    },
    clear() {
      buckets.clear();
    },
  };
};
