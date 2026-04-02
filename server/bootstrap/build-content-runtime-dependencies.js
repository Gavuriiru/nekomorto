export const buildContentRuntimeDependencies = (dependencies = {}) => ({
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
  publicReadCacheTags:
    dependencies.publicReadCacheTags ?? dependencies.PUBLIC_READ_CACHE_TAGS,
  readUploadStorageProvider: dependencies.readUploadStorageProvider,
  resolveEpisodeLookup: dependencies.resolveEpisodeLookup,
  resolvePostStatus: dependencies.resolvePostStatus,
});

export default buildContentRuntimeDependencies;
