const DEFAULT_TTL_MS = 30 * 1000;
const DEFAULT_MAX_ENTRIES = 2000;
const SWEEP_INTERVAL = 200;

const normalizePositiveInteger = (value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(parsed), min), max);
};

const cloneValue = (value) => {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
};

const toTagArray = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [value])
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );

export const createResponseCache = ({
  defaultTtlMs = DEFAULT_TTL_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
} = {}) => {
  const ttl = normalizePositiveInteger(defaultTtlMs, DEFAULT_TTL_MS, 250, 24 * 60 * 60 * 1000);
  const maxSize = normalizePositiveInteger(maxEntries, DEFAULT_MAX_ENTRIES, 50, 100000);
  const entries = new Map();
  const tagsIndex = new Map();
  let opCount = 0;

  const cleanupKeyReferences = (cacheKey) => {
    tagsIndex.forEach((cacheKeys, tag) => {
      cacheKeys.delete(cacheKey);
      if (cacheKeys.size === 0) {
        tagsIndex.delete(tag);
      }
    });
  };

  const deleteKey = (cacheKey) => {
    if (!entries.has(cacheKey)) {
      return false;
    }
    entries.delete(cacheKey);
    cleanupKeyReferences(cacheKey);
    return true;
  };

  const sweepExpired = (nowTs = Date.now()) => {
    entries.forEach((entry, cacheKey) => {
      if (!entry || nowTs >= Number(entry.expiresAt || 0)) {
        deleteKey(cacheKey);
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
    const oldestKeys = Array.from(entries.entries())
      .sort((a, b) => Number(a[1]?.updatedAt || 0) - Number(b[1]?.updatedAt || 0))
      .slice(0, overflow)
      .map(([cacheKey]) => cacheKey);
    oldestKeys.forEach((cacheKey) => {
      deleteKey(cacheKey);
    });
  };

  const maybeSweep = () => {
    opCount += 1;
    if (opCount % SWEEP_INTERVAL === 0) {
      sweepExpired(Date.now());
      enforceSize();
    }
  };

  return {
    get(cacheKey) {
      const normalizedKey = String(cacheKey || "").trim();
      if (!normalizedKey) {
        return null;
      }
      const entry = entries.get(normalizedKey);
      if (!entry) {
        return null;
      }
      const nowTs = Date.now();
      if (nowTs >= Number(entry.expiresAt || 0)) {
        deleteKey(normalizedKey);
        return null;
      }
      return cloneValue(entry.value);
    },
    set(cacheKey, value, { ttlMs, tags } = {}) {
      const normalizedKey = String(cacheKey || "").trim();
      if (!normalizedKey) {
        return false;
      }
      const nowTs = Date.now();
      const effectiveTtl = normalizePositiveInteger(ttlMs, ttl, 250, 24 * 60 * 60 * 1000);
      const normalizedTags = toTagArray(tags);
      entries.set(normalizedKey, {
        value: cloneValue(value),
        createdAt: nowTs,
        updatedAt: nowTs,
        expiresAt: nowTs + effectiveTtl,
      });
      cleanupKeyReferences(normalizedKey);
      normalizedTags.forEach((tag) => {
        const keys = tagsIndex.get(tag) || new Set();
        keys.add(normalizedKey);
        tagsIndex.set(tag, keys);
      });
      maybeSweep();
      return true;
    },
    delete(cacheKey) {
      return deleteKey(String(cacheKey || "").trim());
    },
    invalidateTag(tag) {
      const normalizedTag = String(tag || "").trim();
      if (!normalizedTag) {
        return 0;
      }
      const keys = tagsIndex.get(normalizedTag);
      if (!keys || keys.size === 0) {
        return 0;
      }
      const targets = Array.from(keys);
      let removed = 0;
      targets.forEach((cacheKey) => {
        if (deleteKey(cacheKey)) {
          removed += 1;
        }
      });
      return removed;
    },
    invalidateTags(tags) {
      return toTagArray(tags).reduce((total, tag) => total + this.invalidateTag(tag), 0);
    },
    clear() {
      entries.clear();
      tagsIndex.clear();
    },
    snapshot() {
      return {
        size: entries.size,
        tags: tagsIndex.size,
      };
    },
  };
};
