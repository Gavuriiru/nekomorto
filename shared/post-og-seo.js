import { createStableRevisionToken } from "./stable-revision-token.js";

export const POST_OG_SCENE_VERSION = "post-og-v2";

const normalizeText = (value) => String(value || "").trim();

export const buildPostOgImagePath = (slug) =>
  `/api/og/post/${encodeURIComponent(normalizeText(slug))}`;

export const buildVersionedPostOgImagePath = ({ slug, revision } = {}) => {
  const basePath = buildPostOgImagePath(slug);
  const normalizedRevision = normalizeText(revision);
  if (!normalizedRevision) {
    return basePath;
  }
  return `${basePath}?v=${encodeURIComponent(normalizedRevision)}`;
};

export const buildPostOgImageAlt = (title) => {
  const normalizedTitle = normalizeText(title) || "Postagem";
  return `Card de compartilhamento da postagem ${normalizedTitle}`;
};

export const buildPostOgRevision = ({
  post,
  settings,
  coverImageUrl,
  firstPostImageUrl,
  sceneVersion = POST_OG_SCENE_VERSION,
} = {}) =>
  createStableRevisionToken({
    sceneVersion: normalizeText(sceneVersion) || POST_OG_SCENE_VERSION,
    slug: normalizeText(post?.slug),
    title: normalizeText(post?.title),
    author: normalizeText(post?.author),
    coverImageUrl: normalizeText(coverImageUrl) || normalizeText(post?.coverImageUrl),
    firstPostImageUrl: normalizeText(firstPostImageUrl),
    projectId: normalizeText(post?.projectId),
    tags: Array.isArray(post?.tags)
      ? post.tags.map((value) => normalizeText(value)).filter(Boolean)
      : [],
    accentHex: normalizeText(settings?.theme?.accent),
    defaultShareImage: normalizeText(settings?.site?.defaultShareImage),
  });
