const safeString = (value) => String(value || "");
const DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PUBLIC_BOOTSTRAP_PAYLOAD_MODES = new Set(["full", "critical-home"]);

const normalizePublicBootstrapPayloadMode = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return PUBLIC_BOOTSTRAP_PAYLOAD_MODES.has(normalized) ? normalized : "full";
};

const safeStringArray = (value) =>
  Array.isArray(value) ? value.map((item) => safeString(item).trim()).filter(Boolean) : [];

const toSafeNonNegativeInt = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.floor(parsed);
};

const sanitizeViewsDaily = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.entries(value).reduce((result, [rawDayKey, rawCount]) => {
    const dayKey = String(rawDayKey || "").trim();
    if (!DAY_KEY_REGEX.test(dayKey)) {
      return result;
    }
    const count = toSafeNonNegativeInt(rawCount);
    result[dayKey] = count;
    return result;
  }, {});
};

const safeSources = (value) =>
  Array.isArray(value)
    ? value
        .map((source) => ({
          label: safeString(source?.label).trim(),
          url: safeString(source?.url).trim(),
        }))
        .filter((source) => source.label || source.url)
    : [];

const sanitizeVolumeCovers = (covers) =>
  Array.isArray(covers)
    ? covers
        .map((cover) => ({
          volume: Number.isFinite(Number(cover?.volume)) ? Number(cover.volume) : undefined,
          coverImageUrl: safeString(cover?.coverImageUrl),
          coverImageAlt: safeString(cover?.coverImageAlt),
        }))
        .filter((cover) => cover.coverImageUrl)
    : [];

const sanitizeVolumeEntries = (entries) =>
  Array.isArray(entries)
    ? entries
        .map((entry) => {
          const volume = Number(entry?.volume);
          if (!Number.isFinite(volume)) {
            return null;
          }
          const coverImageUrl = safeString(entry?.coverImageUrl);
          return {
            volume,
            synopsis: safeString(entry?.synopsis),
            coverImageUrl,
            coverImageAlt: coverImageUrl ? safeString(entry?.coverImageAlt) : "",
          };
        })
        .filter(Boolean)
    : [];

const sanitizeEpisodeDownloads = (episodes) =>
  Array.isArray(episodes)
    ? episodes.map((episode) => ({
        number: Number.isFinite(Number(episode?.number)) ? Number(episode.number) : 0,
        volume: Number.isFinite(Number(episode?.volume)) ? Number(episode.volume) : undefined,
        title: safeString(episode?.title),
        entryKind: String(episode?.entryKind || "").trim().toLowerCase() === "extra" ? "extra" : "main",
        entrySubtype: safeString(episode?.entrySubtype),
        readingOrder: Number.isFinite(Number(episode?.readingOrder))
          ? Number(episode.readingOrder)
          : undefined,
        displayLabel: safeString(episode?.displayLabel),
        releaseDate: safeString(episode?.releaseDate),
        duration: safeString(episode?.duration),
        coverImageUrl: safeString(episode?.coverImageUrl),
        coverImageAlt: safeString(episode?.coverImageAlt),
        sourceType: safeString(episode?.sourceType),
        sources: safeSources(episode?.sources),
        progressStage: safeString(episode?.progressStage),
        completedStages: safeStringArray(episode?.completedStages),
        chapterUpdatedAt: safeString(episode?.chapterUpdatedAt),
        hasContent: typeof episode?.content === "string" && episode.content.trim().length > 0,
      }))
    : [];

export const toPublicBootstrapProject = (project) => ({
  id: safeString(project?.id),
  title: safeString(project?.title),
  titleOriginal: safeString(project?.titleOriginal),
  titleEnglish: safeString(project?.titleEnglish),
  synopsis: safeString(project?.synopsis),
  description: safeString(project?.description),
  type: safeString(project?.type),
  status: safeString(project?.status),
  tags: safeStringArray(project?.tags),
  genres: safeStringArray(project?.genres),
  cover: safeString(project?.cover),
  coverAlt: safeString(project?.coverAlt),
  banner: safeString(project?.banner),
  bannerAlt: safeString(project?.bannerAlt),
  heroImageUrl: safeString(project?.heroImageUrl),
  heroImageAlt: safeString(project?.heroImageAlt),
  forceHero: Boolean(project?.forceHero),
  trailerUrl: safeString(project?.trailerUrl),
  studio: safeString(project?.studio),
  episodes: safeString(project?.episodes),
  producers: safeStringArray(project?.producers),
  volumeEntries: sanitizeVolumeEntries(project?.volumeEntries),
  volumeCovers: sanitizeVolumeCovers(project?.volumeCovers),
  episodeDownloads: sanitizeEpisodeDownloads(project?.episodeDownloads),
  views: toSafeNonNegativeInt(project?.views),
  viewsDaily: sanitizeViewsDaily(project?.viewsDaily),
});

export const toPublicBootstrapPost = (post) => ({
  id: safeString(post?.id),
  slug: safeString(post?.slug),
  title: safeString(post?.title),
  excerpt: safeString(post?.excerpt),
  author: safeString(post?.author),
  publishedAt: safeString(post?.publishedAt),
  coverImageUrl: safeString(post?.coverImageUrl),
  coverAlt: safeString(post?.coverAlt),
  projectId: safeString(post?.projectId),
  tags: safeStringArray(post?.tags),
});

export const toPublicBootstrapUpdate = (update) => ({
  id: safeString(update?.id),
  projectId: safeString(update?.projectId),
  projectTitle: safeString(update?.projectTitle),
  episodeNumber: Number.isFinite(Number(update?.episodeNumber))
    ? Number(update.episodeNumber)
    : 0,
  volume: Number.isFinite(Number(update?.volume)) ? Number(update.volume) : undefined,
  kind: safeString(update?.kind),
  reason: safeString(update?.reason),
  updatedAt: safeString(update?.updatedAt),
  image: safeString(update?.image),
  unit: safeString(update?.unit),
});

export const normalizePublicTagTranslations = (translations) => ({
  tags:
    translations?.tags && typeof translations.tags === "object" && !Array.isArray(translations.tags)
      ? translations.tags
      : {},
  genres:
    translations?.genres && typeof translations.genres === "object" && !Array.isArray(translations.genres)
      ? translations.genres
      : {},
  staffRoles:
    translations?.staffRoles &&
    typeof translations.staffRoles === "object" &&
    !Array.isArray(translations.staffRoles)
      ? translations.staffRoles
      : {},
});

export const buildPublicBootstrapPayload = ({
  settings,
  pages,
  projects,
  posts,
  updates,
  tagTranslations,
  generatedAt,
  payloadMode = "full",
}) => ({
  settings: settings && typeof settings === "object" ? settings : {},
  pages: pages && typeof pages === "object" && !Array.isArray(pages) ? pages : {},
  projects: Array.isArray(projects) ? projects.map(toPublicBootstrapProject) : [],
  posts: Array.isArray(posts) ? posts.map(toPublicBootstrapPost) : [],
  updates: Array.isArray(updates) ? updates.map(toPublicBootstrapUpdate) : [],
  tagTranslations: normalizePublicTagTranslations(tagTranslations),
  generatedAt: safeString(generatedAt || new Date().toISOString()),
  payloadMode: normalizePublicBootstrapPayloadMode(payloadMode),
});
