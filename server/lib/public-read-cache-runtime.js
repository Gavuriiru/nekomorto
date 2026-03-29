const assertRequiredDependencies = (dependencies = {}) => {
  const missing = ["publicReadCache"].filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[public-read-cache-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

const assertCacheMethod = (dependencyName, value) => {
  if (typeof value !== "function") {
    throw new Error(`[public-read-cache-runtime] ${dependencyName} must be a function`);
  }
  return value;
};

export const createPublicReadCacheRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const { publicReadCache } = dependencies;
  const readCache = assertCacheMethod("publicReadCache.get", publicReadCache?.get?.bind(publicReadCache));
  const writeCache = assertCacheMethod("publicReadCache.set", publicReadCache?.set?.bind(publicReadCache));
  const invalidateTags = assertCacheMethod(
    "publicReadCache.invalidateTags",
    publicReadCache?.invalidateTags?.bind(publicReadCache),
  );

  const serializeQueryForCache = (query) => {
    if (!query || typeof query !== "object") {
      return "";
    }
    const params = [];
    Object.keys(query)
      .sort((a, b) => a.localeCompare(b, "en"))
      .forEach((key) => {
        const value = query[key];
        if (Array.isArray(value)) {
          value.forEach((item) => {
            params.push([key, String(item)]);
          });
          return;
        }
        if (value === undefined) {
          return;
        }
        params.push([key, String(value)]);
      });
    if (params.length === 0) {
      return "";
    }
    return params
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
  };

  const buildPublicReadCacheKey = (req) => {
    const pathName = String(req?.path || req?.originalUrl || "").split("?")[0] || "/";
    const queryText = serializeQueryForCache(req?.query);
    if (!queryText) {
      return pathName;
    }
    return `${pathName}?${queryText}`;
  };

  const readPublicCachedJson = (req) => {
    const cacheKey = buildPublicReadCacheKey(req);
    const cached = readCache(cacheKey);
    if (!cached) {
      return null;
    }
    return {
      cacheKey,
      payload: cached.payload,
      statusCode: Number(cached.statusCode || 200),
    };
  };

  const writePublicCachedJson = (req, payload, { statusCode = 200, ttlMs, tags = [] } = {}) => {
    const cacheKey = buildPublicReadCacheKey(req);
    writeCache(
      cacheKey,
      {
        payload,
        statusCode: Number(statusCode) || 200,
      },
      {
        ttlMs,
        tags,
      },
    );
    return cacheKey;
  };

  const invalidatePublicReadCacheTags = (tags) => {
    invalidateTags(tags);
  };

  return {
    buildPublicReadCacheKey,
    invalidatePublicReadCacheTags,
    readPublicCachedJson,
    serializeQueryForCache,
    writePublicCachedJson,
  };
};

export default createPublicReadCacheRuntime;
