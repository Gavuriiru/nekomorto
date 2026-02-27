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

class RedisRateLimitStore {
  constructor(client, prefix, onError) {
    this.client = client;
    this.prefix = String(prefix || "rate_limit");
    this.onError = typeof onError === "function" ? onError : null;
  }

  reportError(label, error) {
    if (!this.onError) {
      return;
    }
    this.onError({ label, error });
  }

  buildRedisKey(bucket, key) {
    const safeBucket = String(bucket || "default").trim() || "default";
    const safeKey = String(key || "").trim();
    return `${this.prefix}:${safeBucket}:${safeKey}`;
  }

  async consume({ bucket, key, limit, windowMs }) {
    const normalizedKey = String(key || "").trim();
    const normalizedLimit = normalizePositiveInteger(limit, DEFAULT_LIMIT);
    const normalizedWindowMs = normalizePositiveInteger(windowMs, DEFAULT_WINDOW_MS);
    if (!normalizedKey) {
      return {
        allowed: true,
        count: 0,
        remaining: normalizedLimit,
        resetAt: Date.now() + normalizedWindowMs,
        backend: "redis",
      };
    }
    const redisKey = this.buildRedisKey(bucket, normalizedKey);
    try {
      const script = `
        local current = redis.call("INCR", KEYS[1])
        if current == 1 then
          redis.call("PEXPIRE", KEYS[1], ARGV[1])
        end
        local ttl = redis.call("PTTL", KEYS[1])
        if ttl < 0 then
          ttl = ARGV[1]
        end
        return { current, ttl }
      `;
      const result = await this.client.eval(script, {
        keys: [redisKey],
        arguments: [String(normalizedWindowMs)],
      });
      const count = Number(Array.isArray(result) ? result[0] : 0) || 0;
      const ttl =
        Number(Array.isArray(result) ? result[1] : normalizedWindowMs) || normalizedWindowMs;
      const resetAt = Date.now() + Math.max(0, ttl);
      return {
        allowed: count <= normalizedLimit,
        count,
        remaining: Math.max(0, normalizedLimit - count),
        resetAt,
        backend: "redis",
      };
    } catch (error) {
      this.reportError("consume", error);
      throw error;
    }
  }

  async close() {
    try {
      if (this.client?.isOpen) {
        await this.client.quit();
      }
    } catch (error) {
      this.reportError("close", error);
    }
  }
}

const createRedisStoreIfAvailable = async ({ redisUrl, prefix, onError }) => {
  const safeRedisUrl = String(redisUrl || "").trim();
  if (!safeRedisUrl) {
    return null;
  }
  try {
    const redisModule = await import("redis");
    const createClient = redisModule?.createClient;
    if (typeof createClient !== "function") {
      return null;
    }
    const client = createClient({
      url: safeRedisUrl,
      socket: {
        reconnectStrategy: (attempt) => Math.min(250 * attempt, 5000),
      },
    });
    if (typeof onError === "function") {
      client.on("error", (error) => {
        onError({ label: "redis_client", error });
      });
    }
    await client.connect();
    return new RedisRateLimitStore(client, prefix, onError);
  } catch (error) {
    if (typeof onError === "function") {
      onError({ label: "redis_unavailable", error });
    }
    return null;
  }
};

export const createRateLimiter = async ({ redisUrl, prefix = "rate_limit", onError } = {}) => {
  const redisStore = await createRedisStoreIfAvailable({ redisUrl, prefix, onError });
  const memoryStore = new MemoryRateLimitStore();
  const activeStore = redisStore || memoryStore;

  return {
    mode: redisStore ? "redis" : "memory",
    async consume({ bucket, key, limit, windowMs }) {
      try {
        return await activeStore.consume({ bucket, key, limit, windowMs });
      } catch (error) {
        if (activeStore !== memoryStore) {
          if (typeof onError === "function") {
            onError({ label: "redis_fallback_memory", error });
          }
          return memoryStore.consume({ bucket, key, limit, windowMs });
        }
        return memoryStore.consume({ bucket, key, limit, windowMs });
      }
    },
    async close() {
      await activeStore.close();
    },
  };
};
