const UPLOADS_CLEANUP_PREVIEW_TTL_MS = 15_000;

let cachedPreview = null;
let inflightPreviewEntry = null;

const isPreviewCacheFresh = (entry, now = Date.now()) =>
  Boolean(entry) && Number(entry.expiresAt) > now;

export const invalidateUploadsCleanupPreviewCache = () => {
  cachedPreview = null;
  inflightPreviewEntry = null;
};

export const loadCachedUploadsCleanupPreview = async (loader, options = {}) => {
  const now = options.now ?? Date.now();
  if (!options.force && isPreviewCacheFresh(cachedPreview, now)) {
    return cachedPreview.value;
  }

  if (!options.force && inflightPreviewEntry) {
    return inflightPreviewEntry.promise;
  }

  const nextPromise = (async () => {
    const value = await loader();
    cachedPreview = {
      value,
      expiresAt: (options.now ?? Date.now()) + UPLOADS_CLEANUP_PREVIEW_TTL_MS,
    };
    return value;
  })();

  const nextEntry = { promise: nextPromise };
  inflightPreviewEntry = nextEntry;

  try {
    return await nextPromise;
  } finally {
    if (inflightPreviewEntry === nextEntry) {
      inflightPreviewEntry = null;
    }
  }
};

export const __testing = {
  getUploadsCleanupPreviewCacheState: () => cachedPreview,
  getUploadsCleanupPreviewTtlMs: () => UPLOADS_CLEANUP_PREVIEW_TTL_MS,
  isPreviewCacheFresh,
};
