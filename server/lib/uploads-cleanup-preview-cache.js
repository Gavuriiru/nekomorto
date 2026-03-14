const UPLOADS_CLEANUP_PREVIEW_TTL_MS = 15_000;

let cachedPreview = null;
let inflightPreviewPromise = null;

const isPreviewCacheFresh = (entry, now = Date.now()) =>
  Boolean(entry) && Number(entry.expiresAt) > now;

export const invalidateUploadsCleanupPreviewCache = () => {
  cachedPreview = null;
  inflightPreviewPromise = null;
};

export const loadCachedUploadsCleanupPreview = async (loader, options = {}) => {
  const now = options.now ?? Date.now();
  if (!options.force && isPreviewCacheFresh(cachedPreview, now)) {
    return cachedPreview.value;
  }

  if (!options.force && inflightPreviewPromise) {
    return inflightPreviewPromise;
  }

  const nextPromise = (async () => {
    const value = await loader();
    cachedPreview = {
      value,
      expiresAt: (options.now ?? Date.now()) + UPLOADS_CLEANUP_PREVIEW_TTL_MS,
    };
    return value;
  })();

  inflightPreviewPromise = nextPromise;

  try {
    return await nextPromise;
  } finally {
    if (inflightPreviewPromise === nextPromise) {
      inflightPreviewPromise = null;
    }
  }
};

export const __testing = {
  getUploadsCleanupPreviewCacheState: () => cachedPreview,
  getUploadsCleanupPreviewTtlMs: () => UPLOADS_CLEANUP_PREVIEW_TTL_MS,
  isPreviewCacheFresh,
};
