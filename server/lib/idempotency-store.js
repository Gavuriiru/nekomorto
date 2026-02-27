import crypto from "crypto";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 5000;
const SWEEP_INTERVAL = 200;

const normalizePositiveInteger = (value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(parsed), min), max);
};

const stableSerialize = (value) => {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b, "en"));
    const body = keys
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value);
};

export const createIdempotencyFingerprint = ({ method, path, actorId, body }) => {
  const payload = [
    String(method || "")
      .trim()
      .toUpperCase(),
    String(path || "").trim(),
    String(actorId || "").trim(),
    stableSerialize(body ?? null),
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
};

export const createIdempotencyStore = ({
  ttlMs = DEFAULT_TTL_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
} = {}) => {
  const defaultTtlMs = normalizePositiveInteger(
    ttlMs,
    DEFAULT_TTL_MS,
    1000,
    7 * 24 * 60 * 60 * 1000,
  );
  const maxSize = normalizePositiveInteger(maxEntries, DEFAULT_MAX_ENTRIES, 100, 250000);
  const entries = new Map();
  let opCount = 0;

  const isExpired = (entry, nowTs = Date.now()) => nowTs >= Number(entry?.expiresAt || 0);

  const sweepExpired = (nowTs = Date.now()) => {
    entries.forEach((entry, key) => {
      if (!entry || isExpired(entry, nowTs)) {
        entries.delete(key);
      }
    });
  };

  const enforceSize = () => {
    if (entries.size <= maxSize) {
      return;
    }
    const overflow = entries.size - maxSize;
    if (overflow <= 0) {
      return;
    }
    const oldest = Array.from(entries.entries())
      .sort((a, b) => Number(a[1]?.updatedAt || 0) - Number(b[1]?.updatedAt || 0))
      .slice(0, overflow);
    oldest.forEach(([key]) => {
      entries.delete(key);
    });
  };

  const maybeSweep = () => {
    opCount += 1;
    if (opCount % SWEEP_INTERVAL === 0) {
      sweepExpired(Date.now());
      enforceSize();
    }
  };

  const reserve = ({ key, fingerprint, ttlOverrideMs } = {}) => {
    const normalizedKey = String(key || "").trim();
    const normalizedFingerprint = String(fingerprint || "").trim();
    if (!normalizedKey || !normalizedFingerprint) {
      return { status: "invalid" };
    }
    const nowTs = Date.now();
    const ttl = normalizePositiveInteger(
      ttlOverrideMs,
      defaultTtlMs,
      1000,
      7 * 24 * 60 * 60 * 1000,
    );
    const existing = entries.get(normalizedKey);
    if (existing && !isExpired(existing, nowTs)) {
      if (String(existing.fingerprint || "") !== normalizedFingerprint) {
        return { status: "conflict" };
      }
      if (existing.state === "completed") {
        return {
          status: "replay",
          response: existing.response || null,
        };
      }
      return { status: "in_progress" };
    }
    const nextEntry = {
      key: normalizedKey,
      fingerprint: normalizedFingerprint,
      state: "in_progress",
      createdAt: nowTs,
      updatedAt: nowTs,
      expiresAt: nowTs + ttl,
      response: null,
    };
    entries.set(normalizedKey, nextEntry);
    maybeSweep();
    return { status: "reserved" };
  };

  const complete = ({ key, fingerprint, response, ttlOverrideMs } = {}) => {
    const normalizedKey = String(key || "").trim();
    const normalizedFingerprint = String(fingerprint || "").trim();
    const existing = entries.get(normalizedKey);
    if (!existing || String(existing.fingerprint || "") !== normalizedFingerprint) {
      return false;
    }
    const nowTs = Date.now();
    const ttl = normalizePositiveInteger(
      ttlOverrideMs,
      defaultTtlMs,
      1000,
      7 * 24 * 60 * 60 * 1000,
    );
    entries.set(normalizedKey, {
      ...existing,
      state: "completed",
      response: response ?? null,
      updatedAt: nowTs,
      expiresAt: nowTs + ttl,
    });
    maybeSweep();
    return true;
  };

  const release = ({ key, fingerprint } = {}) => {
    const normalizedKey = String(key || "").trim();
    const normalizedFingerprint = String(fingerprint || "").trim();
    const existing = entries.get(normalizedKey);
    if (!existing || String(existing.fingerprint || "") !== normalizedFingerprint) {
      return false;
    }
    if (existing.state === "in_progress") {
      entries.delete(normalizedKey);
      maybeSweep();
      return true;
    }
    return false;
  };

  return {
    reserve,
    complete,
    release,
    clear() {
      entries.clear();
    },
    snapshot() {
      const nowTs = Date.now();
      let inProgress = 0;
      let completed = 0;
      entries.forEach((entry) => {
        if (!entry || isExpired(entry, nowTs)) {
          return;
        }
        if (entry.state === "completed") {
          completed += 1;
          return;
        }
        inProgress += 1;
      });
      return {
        size: entries.size,
        inProgress,
        completed,
      };
    },
  };
};
