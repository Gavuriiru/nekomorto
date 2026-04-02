import { createContentCollectionsRuntime } from "../lib/content-collections-runtime.js";
import { createDataRepositoryContentRuntime } from "../lib/data-repository-content-runtime.js";
import { createJsonFileCacheRuntime } from "../lib/json-file-cache-runtime.js";
import { createPostVersionRuntime } from "../lib/post-version-runtime.js";
import { assertRequiredDependencies } from "./assert-required-dependencies.js";

const CONTENT_RUNTIME_DEPENDENCY_KEYS = [
  "createSlug",
  "createUniqueSlug",
  "crypto",
  "dataRepository",
  "dedupePostVersionRecordsNewestFirst",
  "getProjectEpisodePageCount",
  "invalidatePublicReadCacheTags",
  "normalizeLegacyUpdateRecord",
  "normalizeProjectEpisodeContentFormat",
  "normalizeProjectEpisodePages",
  "normalizeProjectReaderConfig",
  "normalizeUploadsDeep",
  "publicReadCacheTags",
  "readUploadStorageProvider",
  "resolveEpisodeLookup",
  "resolvePostStatus",
];

export const createContentRuntimeBundle = (dependencies = {}) => {
  const normalizedDependencies = {
    createSlug: dependencies.createSlug,
    createUniqueSlug: dependencies.createUniqueSlug,
    crypto: dependencies.crypto,
    dataRepository: dependencies.dataRepository,
    dedupePostVersionRecordsNewestFirst: dependencies.dedupePostVersionRecordsNewestFirst,
    getProjectEpisodePageCount: dependencies.getProjectEpisodePageCount,
    invalidatePublicReadCacheTags: dependencies.invalidatePublicReadCacheTags,
    normalizeLegacyUpdateRecord: dependencies.normalizeLegacyUpdateRecord,
    normalizeProjectEpisodeContentFormat: dependencies.normalizeProjectEpisodeContentFormat,
    normalizeProjectEpisodePages: dependencies.normalizeProjectEpisodePages,
    normalizeProjectReaderConfig: dependencies.normalizeProjectReaderConfig,
    normalizeUploadsDeep: dependencies.normalizeUploadsDeep,
    publicReadCacheTags: dependencies.publicReadCacheTags ?? dependencies.PUBLIC_READ_CACHE_TAGS,
    readUploadStorageProvider: dependencies.readUploadStorageProvider,
    resolveEpisodeLookup: dependencies.resolveEpisodeLookup,
    resolvePostStatus: dependencies.resolvePostStatus,
  };

  assertRequiredDependencies(
    "createContentRuntimeBundle",
    normalizedDependencies,
    CONTENT_RUNTIME_DEPENDENCY_KEYS,
  );

  const jsonFileCacheRuntime = createJsonFileCacheRuntime();

  const contentCollectionsRuntime = createContentCollectionsRuntime({
    createSlug: normalizedDependencies.createSlug,
    getLoadPosts: () => dataRepositoryContentRuntime.loadPosts,
    getLoadProjects: () => dataRepositoryContentRuntime.loadProjects,
    getProjectEpisodePageCount: normalizedDependencies.getProjectEpisodePageCount,
    getWritePosts: () => dataRepositoryContentRuntime.writePosts,
    getWriteProjects: () => dataRepositoryContentRuntime.writeProjects,
    normalizeProjectEpisodeContentFormat:
      normalizedDependencies.normalizeProjectEpisodeContentFormat,
    normalizeProjectEpisodePages: normalizedDependencies.normalizeProjectEpisodePages,
    normalizeProjectReaderConfig: normalizedDependencies.normalizeProjectReaderConfig,
    normalizeUploadsDeep: normalizedDependencies.normalizeUploadsDeep,
    resolvePostStatus: normalizedDependencies.resolvePostStatus,
  });

  const postVersionRuntime = createPostVersionRuntime({
    createSlug: normalizedDependencies.createSlug,
    createUniqueSlug: normalizedDependencies.createUniqueSlug,
    crypto: normalizedDependencies.crypto,
    dataRepository: normalizedDependencies.dataRepository,
    dedupePostVersionRecordsNewestFirst: normalizedDependencies.dedupePostVersionRecordsNewestFirst,
    getNormalizePosts: () => contentCollectionsRuntime.normalizePosts,
    invalidateJsonFileCache: jsonFileCacheRuntime.invalidateJsonFileCache,
    readJsonFileFromCache: jsonFileCacheRuntime.readJsonFileFromCache,
    writeJsonFileToCache: jsonFileCacheRuntime.writeJsonFileToCache,
  });

  const dataRepositoryContentRuntime = createDataRepositoryContentRuntime({
    dataRepository: normalizedDependencies.dataRepository,
    getNormalizePosts: () => contentCollectionsRuntime.normalizePosts,
    getNormalizeProjects: () => contentCollectionsRuntime.normalizeProjects,
    getPruneExpiredDeleted: () => postVersionRuntime.pruneExpiredDeleted,
    invalidateJsonFileCache: jsonFileCacheRuntime.invalidateJsonFileCache,
    invalidatePublicReadCacheTags: normalizedDependencies.invalidatePublicReadCacheTags,
    normalizeLegacyUpdateRecord: normalizedDependencies.normalizeLegacyUpdateRecord,
    normalizeUploadsDeep: normalizedDependencies.normalizeUploadsDeep,
    publicReadCacheTags: normalizedDependencies.publicReadCacheTags,
    readJsonFileFromCache: jsonFileCacheRuntime.readJsonFileFromCache,
    readUploadStorageProvider: normalizedDependencies.readUploadStorageProvider,
    resolveEpisodeLookup: normalizedDependencies.resolveEpisodeLookup,
    writeJsonFileToCache: jsonFileCacheRuntime.writeJsonFileToCache,
  });

  return {
    ...jsonFileCacheRuntime,
    ...contentCollectionsRuntime,
    ...postVersionRuntime,
    ...dataRepositoryContentRuntime,
  };
};

export default createContentRuntimeBundle;
