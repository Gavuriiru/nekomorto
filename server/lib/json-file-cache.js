const cloneCachedValue = (value) => {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
};

export const createJsonFileCache = () => {
  const entries = new Map();

  return {
    read(cacheKey) {
      if (!cacheKey) {
        return null;
      }
      const entry = entries.get(cacheKey);
      if (!entry) {
        return null;
      }
      return cloneCachedValue(entry.value);
    },
    write(cacheKey, value) {
      if (!cacheKey) {
        return false;
      }
      entries.set(cacheKey, { value: cloneCachedValue(value) });
      return true;
    },
    invalidate(cacheKey) {
      if (!cacheKey) {
        return false;
      }
      return entries.delete(cacheKey);
    },
    clear() {
      entries.clear();
    },
  };
};
