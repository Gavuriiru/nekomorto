const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_LIMIT = 60;
const MEMORY_SWEEP_INTERVAL = 500;

const normalizePositiveInteger = (value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(parsed), min), max);
};

const toCacheKey = (bucket, key) =>
  `${String(bucket || "default").trim()}:${String(key || "").trim()}`;

class MemoryRateLimitStore {
  constructor() {
    this.entries = new Map();
    this.opCount = 0;
  }

  sweepExpired(nowTs = Date.now()) {
    this.entries.forEach((entry, key) => {
      if (!entry || nowTs >= Number(entry.resetAt || 0)) {
        this.entries.delete(key);
      }
    });
  }

  consume({ bucket, key, limit, windowMs }) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) {
      return {
        allowed: true,
        count: 0,
        remaining: normalizePositiveInteger(limit, DEFAULT_LIMIT),
        resetAt: Date.now() + normalizePositiveInteger(windowMs, DEFAULT_WINDOW_MS),
        backend: "memory",
      };
    }
    const nowTs = Date.now();
    const normalizedWindowMs = normalizePositiveInteger(windowMs, DEFAULT_WINDOW_MS);
    const normalizedLimit = normalizePositiveInteger(limit, DEFAULT_LIMIT);
    const fullKey = toCacheKey(bucket, normalizedKey);
    const existing = this.entries.get(fullKey);
    const nextEntry =
      existing && nowTs < Number(existing.resetAt || 0)
        ? {
            count: Number(existing.count || 0),
            resetAt: Number(existing.resetAt || nowTs + normalizedWindowMs),
          }
        : { count: 0, resetAt: nowTs + normalizedWindowMs };
    nextEntry.count += 1;
    this.entries.set(fullKey, nextEntry);

    this.opCount += 1;
    if (this.opCount % MEMORY_SWEEP_INTERVAL === 0) {
      this.sweepExpired(nowTs);
    }

    const remaining = Math.max(0, normalizedLimit - nextEntry.count);
    return {
      allowed: nextEntry.count <= normalizedLimit,
      count: nextEntry.count,
      remaining,
      resetAt: nextEntry.resetAt,
      backend: "memory",
    };
  }

  async close() {}
}

export const createRateLimiter = ({ onError } = {}) => {
  const store = new MemoryRateLimitStore();

  return {
    mode: "memory",
    consume({ bucket, key, limit, windowMs }) {
      try {
        return store.consume({ bucket, key, limit, windowMs });
      } catch (error) {
        if (typeof onError === "function") {
          onError({ label: "memory_consume", error });
        }
        return store.consume({ bucket, key, limit, windowMs });
      }
    },
    async close() {
      await store.close();
    },
  };
};
