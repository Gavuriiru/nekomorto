import fs from "fs/promises";
import os from "os";
import path from "path";
import Epub from "epub-gen";
import sanitizeHtml from "sanitize-html";
import { createSlug } from "./post-slug.js";
import { renderLexicalJsonToHtml } from "./lexical-html.js";
import { getEpisodePublicationStatus, hasEpisodeContent } from "./project-episodes.js";

const EXPORT_ALLOWED_TAGS = [
  "p",
  "br",
  "blockquote",
  "pre",
  "code",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "sub",
  "sup",
  "ul",
  "ol",
  "li",
  "a",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "hr",
  "img",
];

const EXPORT_ALLOWED_ATTRIBUTES = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height", "style"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  span: ["style"],
  p: ["style"],
  blockquote: ["style"],
  h1: ["style"],
  h2: ["style"],
  h3: ["style"],
  h4: ["style"],
  h5: ["style"],
  h6: ["style"],
  em: ["style"],
  strong: ["style"],
  i: ["style"],
  b: ["style"],
  u: ["style"],
  s: ["style"],
  sub: ["style"],
  sup: ["style"],
};

const BLOCK_ALLOWED_STYLE_PATTERNS = {
  "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
  "text-indent": [/^-?(?:\d+(?:\.\d+)?)(?:px|em|rem|pt|%)$/],
  "margin-top": [/^-?(?:\d+(?:\.\d+)?)(?:px|em|rem|pt|%)$/],
  "margin-bottom": [/^-?(?:\d+(?:\.\d+)?)(?:px|em|rem|pt|%)$/],
  "line-height": [/^(?:normal|\d+(?:\.\d+)?(?:px|em|rem|pt|%)?)$/],
  "font-family": [/^(?:serif|sans-serif|monospace)$/],
};

const INLINE_ALLOWED_STYLE_PATTERNS = {
  "font-size": [/^(?:\d+(?:\.\d+)?)(?:px|em|rem|pt|%)$/],
  "font-style": [/^(?:italic|oblique)$/],
  "font-weight": [/^(?:bold|[5-9]00)$/],
  "font-family": [/^(?:serif|sans-serif|monospace)$/],
};

const IMAGE_ALLOWED_STYLE_PATTERNS = {
  width: [/^(?:\d+(?:\.\d+)?)(?:px|em|rem|pt|%)$/],
  height: [/^(?:\d+(?:\.\d+)?)(?:px|em|rem|pt|%)$/],
  "max-width": [/^(?:\d+(?:\.\d+)?)(?:px|em|rem|pt|%)$/],
  display: [/^(?:inline|block|inline-block)$/],
  "margin-left": [/^(?:auto|-?(?:\d+(?:\.\d+)?)(?:px|em|rem|pt|%))$/],
  "margin-right": [/^(?:auto|-?(?:\d+(?:\.\d+)?)(?:px|em|rem|pt|%))$/],
  "margin-top": [/^-?(?:\d+(?:\.\d+)?)(?:px|em|rem|pt|%)$/],
  "margin-bottom": [/^-?(?:\d+(?:\.\d+)?)(?:px|em|rem|pt|%)$/],
  "vertical-align": [/^(?:baseline|middle|text-bottom|text-top|sub|super)$/],
};

const normalizeVolumeForFilter = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

const createExportSanitizeOptions = (origin) => ({
  allowedTags: EXPORT_ALLOWED_TAGS,
  allowedAttributes: EXPORT_ALLOWED_ATTRIBUTES,
  allowedSchemes: ["http", "https", "mailto"],
  allowedStyles: {
    p: BLOCK_ALLOWED_STYLE_PATTERNS,
    blockquote: BLOCK_ALLOWED_STYLE_PATTERNS,
    h1: BLOCK_ALLOWED_STYLE_PATTERNS,
    h2: BLOCK_ALLOWED_STYLE_PATTERNS,
    h3: BLOCK_ALLOWED_STYLE_PATTERNS,
    h4: BLOCK_ALLOWED_STYLE_PATTERNS,
    h5: BLOCK_ALLOWED_STYLE_PATTERNS,
    h6: BLOCK_ALLOWED_STYLE_PATTERNS,
    span: INLINE_ALLOWED_STYLE_PATTERNS,
    em: INLINE_ALLOWED_STYLE_PATTERNS,
    strong: INLINE_ALLOWED_STYLE_PATTERNS,
    i: INLINE_ALLOWED_STYLE_PATTERNS,
    b: INLINE_ALLOWED_STYLE_PATTERNS,
    u: INLINE_ALLOWED_STYLE_PATTERNS,
    s: INLINE_ALLOWED_STYLE_PATTERNS,
    sub: INLINE_ALLOWED_STYLE_PATTERNS,
    sup: INLINE_ALLOWED_STYLE_PATTERNS,
    img: IMAGE_ALLOWED_STYLE_PATTERNS,
  },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        href: absolutizeAssetUrl(attribs?.href, origin),
      },
    }),
    img: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        src: absolutizeAssetUrl(attribs?.src, origin),
      },
    }),
  },
});

const absolutizeAssetUrl = (value, origin) => {
  const source = String(value || "").trim();
  if (!source) {
    return "";
  }
  if (/^https?:\/\//i.test(source) || /^mailto:/i.test(source)) {
    return source;
  }
  if (source.startsWith("//")) {
    return `https:${source}`;
  }
  if (source.startsWith("/")) {
    return new URL(source, origin).toString();
  }
  return source;
};

const sanitizeExportHtml = (html, origin) =>
  sanitizeHtml(String(html || ""), createExportSanitizeOptions(origin)).trim();

const stripHtml = (value) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildOutputFilename = (project, volume) => {
  const slug = String(project?.id || createSlug(project?.title || "projeto") || "projeto").trim();
  if (volume === null) {
    return `${slug}-sem-volume.epub`;
  }
  return `${slug}-vol-${String(volume).padStart(2, "0")}.epub`;
};

export const exportProjectEpub = async ({
  project,
  volume,
  includeDrafts = false,
  origin,
  siteName,
}) => {
  const volumeFilter = normalizeVolumeForFilter(volume);
  const safeOrigin = String(origin || "http://localhost").trim() || "http://localhost";
  const safeSiteName = String(siteName || "Nekomata").trim() || "Nekomata";
  const episodes = Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : [];
  const eligibleEpisodes = episodes
    .filter((episode) => {
      const episodeVolume = normalizeVolumeForFilter(episode?.volume);
      if (volumeFilter === null) {
        return episodeVolume === null;
      }
      return episodeVolume === volumeFilter;
    })
    .filter((episode) => hasEpisodeContent(episode))
    .filter((episode) => includeDrafts || getEpisodePublicationStatus(episode) === "published")
    .sort((a, b) => {
      const numberDelta = Number(a?.number || 0) - Number(b?.number || 0);
      if (numberDelta !== 0) {
        return numberDelta;
      }
      return Number(a?.volume || 0) - Number(b?.volume || 0);
    });

  if (eligibleEpisodes.length === 0) {
    const error = new Error("no_eligible_chapters");
    error.code = "no_eligible_chapters";
    throw error;
  }

  const epubContent = eligibleEpisodes.map((episode) => {
    const rawHtml = renderLexicalJsonToHtml(String(episode?.content || ""));
    const data = sanitizeExportHtml(rawHtml, safeOrigin);
    return {
      title: String(episode?.title || `Capítulo ${episode?.number || ""}`).trim() || "Capítulo",
      data,
      filename: `chapter-${Number(episode?.number || 0)}-${Number(episode?.volume || 0)}.xhtml`,
    };
  });

  const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "nekomorto-epub-"));
  const outputPath = path.join(outputDirectory, buildOutputFilename(project, volumeFilter));

  const options = {
    title:
      volumeFilter === null
        ? String(project?.title || "Projeto")
        : `${String(project?.title || "Projeto")} - Volume ${volumeFilter}`,
    author: safeSiteName,
    publisher: safeSiteName,
    lang: "pt-BR",
    appendChapterTitles: true,
    content: epubContent,
    description: stripHtml(project?.synopsis || project?.description || ""),
    verbose: false,
  };

  try {
    await new Epub(options, outputPath).promise;
    const buffer = await fs.readFile(outputPath);
    return {
      buffer,
      filename: buildOutputFilename(project, volumeFilter),
    };
  } finally {
    await fs.rm(outputDirectory, { recursive: true, force: true });
  }
};
