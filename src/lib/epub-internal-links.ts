import { resolveCanonicalEpisodeRouteTarget } from "@/lib/project-episode-key";
import { buildProjectPublicReadingHref } from "@/lib/project-editor-routes";

const EPUB_INTERNAL_CHAPTER_PROTOCOL = "epub-internal://chapter/";
const EXTERNAL_HREF_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:/i;
const RAW_EPUB_DOCUMENT_HREF_RE = /(?:^|\/)[^?#]+\.(?:xhtml|html)(?:[?#].*)?$/i;

const normalizeChapterNumber = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.floor(parsed);
};

const normalizeVolume = (value: unknown) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.floor(parsed);
};

const normalizeFragment = (value: unknown) => {
  const trimmed = String(value || "")
    .trim()
    .replace(/^#/, "");
  if (!trimmed) {
    return "";
  }
  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
};

export const buildEpubAnchorHash = (fragment: unknown) => {
  const normalizedFragment = normalizeFragment(fragment);
  if (!normalizedFragment) {
    return "";
  }
  return `#${encodeURIComponent(normalizedFragment)}`;
};

export const buildEpubInternalChapterHref = (
  chapterNumber: unknown,
  volume?: unknown,
  fragment?: unknown,
) => {
  const normalizedChapterNumber = normalizeChapterNumber(chapterNumber);
  if (normalizedChapterNumber === null) {
    return "";
  }
  const params = new URLSearchParams();
  const normalizedVolume = normalizeVolume(volume);
  if (normalizedVolume !== null) {
    params.set("volume", String(normalizedVolume));
  }
  const hash = buildEpubAnchorHash(fragment);
  const search = params.toString();
  return `${EPUB_INTERNAL_CHAPTER_PROTOCOL}${normalizedChapterNumber}${search ? `?${search}` : ""}${hash}`;
};

export const parseEpubInternalChapterHref = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw || !raw.toLowerCase().startsWith(EPUB_INTERNAL_CHAPTER_PROTOCOL)) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(raw);
  } catch {
    return null;
  }

  const pathname = String(parsedUrl.pathname || "").replace(/^\/+/, "");
  const normalizedChapterNumber = normalizeChapterNumber(pathname);
  if (normalizedChapterNumber === null) {
    return null;
  }

  return {
    chapterNumber: normalizedChapterNumber,
    volume: normalizeVolume(parsedUrl.searchParams.get("volume")),
    fragment: normalizeFragment(parsedUrl.hash),
  };
};

export const resolveEpubViewerLinkAction = (
  value: unknown,
  options?: {
    allowInternalChapterNavigation?: boolean;
  },
) => {
  const rawHref = String(value || "").trim();
  if (!rawHref || rawHref.startsWith("#")) {
    return null;
  }
  if (rawHref.toLowerCase().startsWith(EPUB_INTERNAL_CHAPTER_PROTOCOL)) {
    return {
      kind: "internal-chapter" as const,
      href: rawHref,
    };
  }
  if (
    options?.allowInternalChapterNavigation &&
    !EXTERNAL_HREF_PROTOCOL_RE.test(rawHref) &&
    !rawHref.startsWith("//") &&
    RAW_EPUB_DOCUMENT_HREF_RE.test(rawHref)
  ) {
    return {
      kind: "block-raw-epub" as const,
      href: rawHref,
    };
  }
  return null;
};

export const resolveEpubInternalProjectReadingHref = <
  Episode extends {
    number?: unknown;
    volume?: unknown;
  },
>(
  value: unknown,
  projectIdOrSlug: string,
  episodes: Episode[] = [],
) => {
  const target = parseEpubInternalChapterHref(value);
  if (!target) {
    return "";
  }
  const canonicalChapter = resolveCanonicalEpisodeRouteTarget(
    episodes,
    target.chapterNumber,
    target.volume !== null ? [target.volume] : [],
    { exactPreferredOnly: target.volume !== null },
  );
  return (
    buildProjectPublicReadingHref(
      projectIdOrSlug,
      canonicalChapter?.number ?? target.chapterNumber,
      canonicalChapter?.volume ?? target.volume ?? undefined,
    ) + buildEpubAnchorHash(target.fragment)
  );
};
