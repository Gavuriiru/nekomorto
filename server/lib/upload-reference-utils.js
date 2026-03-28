const DATASET_LOADER_KEYS = [
  "loadSiteSettings",
  "loadPosts",
  "loadProjects",
  "loadUsers",
  "loadPages",
  "loadComments",
  "loadUpdates",
  "loadLinkTypes",
];

const addCollectedUrl = (urls, value) => {
  const normalized = String(value || "").trim();
  if (normalized) {
    urls.add(normalized);
  }
};

const visitObjectValues = (value, visit) => {
  if (!value || typeof value !== "object") {
    return;
  }
  Object.values(value).forEach((item) => visit(item));
};

export const collectUploadUrlsDeep = (
  value,
  urls,
  {
    extractTextUrls,
    normalizeDirectUrl,
    trackObjects = false,
    seen = trackObjects ? new WeakSet() : null,
  } = {},
) => {
  if (!value) {
    return urls;
  }

  if (typeof value === "string") {
    if (typeof normalizeDirectUrl === "function") {
      addCollectedUrl(urls, normalizeDirectUrl(value));
    }
    if (typeof extractTextUrls === "function") {
      (extractTextUrls(value) || []).forEach((item) => addCollectedUrl(urls, item));
    }
    return urls;
  }

  if (Array.isArray(value)) {
    value.forEach((item) =>
      collectUploadUrlsDeep(item, urls, {
        extractTextUrls,
        normalizeDirectUrl,
        trackObjects,
        seen,
      }),
    );
    return urls;
  }

  if (typeof value !== "object") {
    return urls;
  }

  if (seen) {
    if (seen.has(value)) {
      return urls;
    }
    seen.add(value);
  }

  visitObjectValues(value, (item) =>
    collectUploadUrlsDeep(item, urls, {
      extractTextUrls,
      normalizeDirectUrl,
      trackObjects,
      seen,
    }),
  );
  return urls;
};

export const collectUploadUrlsFromDatasets = (loaders = {}, options = {}) => {
  const urls = new Set();
  DATASET_LOADER_KEYS.forEach((key) => {
    const load = loaders?.[key];
    if (typeof load !== "function") {
      return;
    }
    collectUploadUrlsDeep(load(), urls, options);
  });
  return urls;
};

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const absoluteUrlPattern = /https?:\/\/[^\s"'()<>]+/gi;

export const replaceUploadReferencesInText = (
  value,
  oldUrl,
  newUrl,
  { normalizeUrl } = {},
) => {
  if (!value || typeof value !== "string") {
    return { value, count: 0 };
  }

  let next = value;
  let count = 0;
  const directRegex = new RegExp(escapeRegExp(oldUrl), "g");
  const directMatches = next.match(directRegex);
  if (directMatches?.length) {
    count += directMatches.length;
    next = next.replace(directRegex, newUrl);
  }

  next = next.replace(absoluteUrlPattern, (match) => {
    const normalized = typeof normalizeUrl === "function" ? normalizeUrl(match) : match;
    if (normalized !== oldUrl) {
      return match;
    }
    count += 1;
    try {
      const parsed = new URL(match);
      parsed.pathname = newUrl;
      return parsed.toString();
    } catch {
      return match.replace(oldUrl, newUrl);
    }
  });

  return { value: next, count };
};

export const replaceUploadReferencesDeep = (value, oldUrl, newUrl, options = {}) => {
  if (typeof value === "string") {
    return replaceUploadReferencesInText(value, oldUrl, newUrl, options);
  }
  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((item) => {
      const result = replaceUploadReferencesDeep(item, oldUrl, newUrl, options);
      count += result.count;
      return result.value;
    });
    return { value: next, count };
  }
  if (value && typeof value === "object") {
    let count = 0;
    const next = { ...value };
    Object.keys(next).forEach((key) => {
      const result = replaceUploadReferencesDeep(next[key], oldUrl, newUrl, options);
      count += result.count;
      next[key] = result.value;
    });
    return { value: next, count };
  }
  return { value, count: 0 };
};
