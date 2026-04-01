import { createJsonFileCache } from "./json-file-cache.js";

export const createJsonFileCacheRuntime = ({
  shouldUseInMemoryCache = true,
  cache = createJsonFileCache(),
} = {}) => ({
  invalidateJsonFileCache(cacheKey) {
    cache.invalidate(cacheKey);
  },
  readJsonFileFromCache(cacheKey) {
    if (!shouldUseInMemoryCache) {
      return null;
    }
    return cache.read(cacheKey);
  },
  writeJsonFileToCache(cacheKey, value) {
    if (!shouldUseInMemoryCache) {
      return;
    }
    cache.write(cacheKey, value);
  },
});

export default {
  createJsonFileCacheRuntime,
};
