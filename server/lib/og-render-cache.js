import crypto from "node:crypto";

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 256;

const clampInteger = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(parsed), min), max);
};

const normalizeText = (value) => String(value || "").trim();

const pickModelFingerprint = (model) => {
  const safeModel = model && typeof model === "object" ? model : {};
  const palette = safeModel.palette && typeof safeModel.palette === "object" ? safeModel.palette : {};
  const layout = safeModel.layout && typeof safeModel.layout === "object" ? safeModel.layout : {};
  return {
    eyebrow: normalizeText(safeModel.eyebrow),
    title: normalizeText(safeModel.title),
    subtitle: normalizeText(safeModel.subtitle),
    titleFontSize: Number.isFinite(Number(safeModel.titleFontSize))
      ? Number(safeModel.titleFontSize)
      : 0,
    artworkUrl: normalizeText(safeModel.artworkUrl),
    artworkSource: normalizeText(safeModel.artworkSource),
    palette: {
      accentPrimary: normalizeText(palette.accentPrimary),
      accentLine: normalizeText(palette.accentLine),
      accentDarkStart: normalizeText(palette.accentDarkStart),
      accentDarkEnd: normalizeText(palette.accentDarkEnd),
      bgBase: normalizeText(palette.bgBase),
    },
    layout: {
      artworkLeft: Number(layout.artworkLeft) || 0,
      artworkTop: Number(layout.artworkTop) || 0,
      artworkWidth: Number(layout.artworkWidth) || 0,
      artworkHeight: Number(layout.artworkHeight) || 0,
      dividerLeft: Number(layout.dividerLeft) || 0,
      dividerTop: Number(layout.dividerTop) || 0,
      dividerWidth: Number(layout.dividerWidth) || 0,
      dividerHeight: Number(layout.dividerHeight) || 0,
    },
  };
};

export const buildOgRenderFingerprint = ({ kind, id, model }) =>
  JSON.stringify({
    kind: normalizeText(kind),
    id: normalizeText(id),
    model: pickModelFingerprint(model),
  });

export const buildOgRenderCacheKey = (args) =>
  crypto.createHash("sha1").update(buildOgRenderFingerprint(args)).digest("hex");

export const createOgRenderCache = ({
  ttlMs = DEFAULT_TTL_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
} = {}) => {
  const effectiveTtlMs = clampInteger(ttlMs, DEFAULT_TTL_MS, 1000, 24 * 60 * 60 * 1000);
  const effectiveMaxEntries = clampInteger(maxEntries, DEFAULT_MAX_ENTRIES, 1, 4096);
  const entries = new Map();
  const inFlight = new Map();

  const evictExpired = (nowTs = Date.now()) => {
    entries.forEach((entry, key) => {
      if (!entry || nowTs >= Number(entry.expiresAt || 0)) {
        entries.delete(key);
      }
    });
  };

  const evictOverflow = () => {
    while (entries.size > effectiveMaxEntries) {
      const oldest = Array.from(entries.entries()).sort(
        (a, b) => Number(a[1]?.lastAccessTs || 0) - Number(b[1]?.lastAccessTs || 0),
      )[0];
      if (!oldest) {
        break;
      }
      entries.delete(oldest[0]);
    }
  };

  return {
    read(cacheKey) {
      const normalizedKey = normalizeText(cacheKey);
      if (!normalizedKey) {
        return null;
      }
      evictExpired(Date.now());
      const entry = entries.get(normalizedKey);
      if (!entry) {
        return null;
      }
      entry.lastAccessTs = Date.now();
      return {
        buffer: entry.buffer,
        contentType: entry.contentType,
      };
    },
    write(cacheKey, { buffer, contentType } = {}) {
      const normalizedKey = normalizeText(cacheKey);
      if (!normalizedKey || !Buffer.isBuffer(buffer)) {
        return false;
      }
      const nowTs = Date.now();
      entries.set(normalizedKey, {
        buffer: Buffer.from(buffer),
        contentType: normalizeText(contentType) || "image/png",
        expiresAt: nowTs + effectiveTtlMs,
        lastAccessTs: nowTs,
      });
      evictExpired(nowTs);
      evictOverflow();
      return true;
    },
    getOrCreateInFlight(cacheKey, createPromise) {
      const normalizedKey = normalizeText(cacheKey);
      if (!normalizedKey || typeof createPromise !== "function") {
        return Promise.reject(new Error("invalid_og_cache_inflight_arguments"));
      }
      const existing = inFlight.get(normalizedKey);
      if (existing) {
        return existing;
      }
      const promise = Promise.resolve()
        .then(() => createPromise())
        .finally(() => {
          inFlight.delete(normalizedKey);
        });
      inFlight.set(normalizedKey, promise);
      return promise;
    },
    clear() {
      entries.clear();
      inFlight.clear();
    },
    snapshot() {
      evictExpired(Date.now());
      return {
        size: entries.size,
        inFlight: inFlight.size,
      };
    },
  };
};
