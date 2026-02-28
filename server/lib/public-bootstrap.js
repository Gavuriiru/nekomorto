const safeString = (value) => String(value || "");

const safeStringArray = (value) =>
  Array.isArray(value) ? value.map((item) => safeString(item).trim()).filter(Boolean) : [];

const safeSources = (value) =>
  Array.isArray(value)
    ? value
        .map((source) => ({
          label: safeString(source?.label).trim(),
          url: safeString(source?.url).trim(),
        }))
        .filter((source) => source.label || source.url)
    : [];

const sanitizeEpisodeDownloads = (episodes) =>
  Array.isArray(episodes)
    ? episodes.map((episode) => ({
        number: Number.isFinite(Number(episode?.number)) ? Number(episode.number) : 0,
        volume: Number.isFinite(Number(episode?.volume)) ? Number(episode.volume) : undefined,
        title: safeString(episode?.title),
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
  synopsis: safeString(project?.synopsis),
  description: safeString(project?.description),
  type: safeString(project?.type),
  status: safeString(project?.status),
  tags: safeStringArray(project?.tags),
  cover: safeString(project?.cover),
  coverAlt: safeString(project?.coverAlt),
  banner: safeString(project?.banner),
  bannerAlt: safeString(project?.bannerAlt),
  heroImageUrl: safeString(project?.heroImageUrl),
  heroImageAlt: safeString(project?.heroImageAlt),
  forceHero: Boolean(project?.forceHero),
  trailerUrl: safeString(project?.trailerUrl),
  episodeDownloads: sanitizeEpisodeDownloads(project?.episodeDownloads),
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
  projects,
  posts,
  updates,
  tagTranslations,
  generatedAt,
}) => ({
  settings: settings && typeof settings === "object" ? settings : {},
  projects: Array.isArray(projects) ? projects.map(toPublicBootstrapProject) : [],
  posts: Array.isArray(posts) ? posts.map(toPublicBootstrapPost) : [],
  updates: Array.isArray(updates) ? updates.map(toPublicBootstrapUpdate) : [],
  tagTranslations: normalizePublicTagTranslations(tagTranslations),
  generatedAt: safeString(generatedAt || new Date().toISOString()),
});
