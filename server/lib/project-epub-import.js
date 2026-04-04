import crypto from "crypto";
import path from "path";
import { JSDOM } from "jsdom";
import EPub from "epub";
import sanitizeHtml from "sanitize-html";
import { buildEpisodeKey, getEpisodePublicationStatus } from "./project-episodes.js";
import { findVolumeCoverByVolume } from "./project-volume-covers.js";
import { htmlToLexicalJson } from "./lexical-html.js";
import { buildEpubImportTempFolder, storeUploadImageBuffer } from "./uploads-import.js";

const IMPORT_ALLOWED_TAGS = [
  "p",
  "br",
  "blockquote",
  "epub-p",
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

const IMPORT_ALLOWED_ATTRIBUTES = {
  a: ["href", "title", "target", "rel"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  span: ["style"],
  p: ["style", "data-epub-heading"],
  "epub-p": ["style"],
  blockquote: ["style", "data-epub-heading"],
  h1: ["style", "data-epub-heading"],
  h2: ["style", "data-epub-heading"],
  h3: ["style", "data-epub-heading"],
  h4: ["style", "data-epub-heading"],
  h5: ["style", "data-epub-heading"],
  h6: ["style", "data-epub-heading"],
  em: ["style"],
  strong: ["style"],
  i: ["style"],
  b: ["style"],
  u: ["style"],
  s: ["style"],
  sub: ["style"],
  sup: ["style"],
  img: ["src", "alt", "width", "height", "style", "data-epub-align"],
};

const BLOCK_ALLOWED_STYLE_PATTERNS = {
  "font-size": [/^(?:\d+(?:\.\d+)?)(?:px|em|rem|pt|%)$/],
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

const ZERO_LIKE_STYLE_VALUES = new Set([
  "",
  "0",
  "0px",
  "0em",
  "0rem",
  "0pt",
  "0%",
  "auto",
  "normal",
  "none",
  "initial",
  "inherit",
]);

const EXTRA_TECHNICAL_NUMBER_BASE = 100000;

const BOILERPLATE_HINT_PATTERNS = [
  /\bcover\b/i,
  /\binsert\b/i,
  /\btitle[\s_-]*page\b/i,
  /\bcopyright\b/i,
  /\btable of contents\b/i,
  /(?:^|[\s/_-])toc(?:$|[\s/_-])/i,
  /(?:^|[\s/_-])nav(?:$|[\s/_-])/i,
  /\bnewsletter\b/i,
  /\bsign[\s_-]*up\b/i,
  /\bcolophon\b/i,
  /\bcredits?\b/i,
  /\badvert(?:isement)?\b/i,
  /\bpreview\b/i,
  /\bsample\b/i,
];

const HARD_DISCARD_BOILERPLATE_HINT_PATTERNS = [
  /\bcopyright\b/i,
  /\btable of contents\b/i,
  /(?:^|[\s/_-])toc(?:$|[\s/_-])/i,
  /(?:^|[\s/_-])nav(?:$|[\s/_-])/i,
  /\bnewsletter\b/i,
  /\bsign[\s_-]*up\b/i,
  /\binsert\b/i,
];

const RANGE_INTRUDER_HINT_PATTERNS = [
  /\bcover\b/i,
  /\btitle[\s_-]*page\b/i,
  /\bcopyright\b/i,
  /\btable of contents\b/i,
  /(?:^|[\s/_-])toc(?:$|[\s/_-])/i,
  /(?:^|[\s/_-])nav(?:$|[\s/_-])/i,
  /\bnewsletter\b/i,
  /\bsign[\s_-]*up\b/i,
];

const FRONT_MATTER_CONSOLIDATION_HINT_PATTERNS = [
  /\bcover\b/i,
  /\btitle[\s_-]*page\b/i,
  /\bcopyright(?:s)?\b/i,
  /\bcredits?\b/i,
  /\btable of contents(?: page)?\b/i,
  /(?:^|[\s/_-])toc(?:$|[\s/_-])/i,
  /(?:^|[\s/_-])nav(?:$|[\s/_-])/i,
  /\bcolou?r[\s_-]*inserts?\b/i,
  /\binsert\b/i,
  /\bfrontispiece\b/i,
];

const FRONT_MATTER_NOISE_HINT_PATTERNS = [
  /\bnewsletter\b/i,
  /\bsign[\s_-]*up\b/i,
  /\badvert(?:isement)?\b/i,
  /\bpreview\b/i,
  /\bsample\b/i,
];

const MAIN_HINT_PATTERNS = [
  /(?:^|[\s/_-])(?:chapter|ch|cap(?:i|\u00ed)tulo)[\s#._-]*\d+/i,
  /(?:^|[\s/_-])(?:chapter|cap(?:i|\u00ed)tulo)\d+(?:$|[\s/_-])/i,
];

const EXTRA_HINT_PATTERNS = [
  /\b(?:prologue|preface|epilogue|afterword|interlude)\b/i,
  /\bdedicat(?:ion|oria)\b/i,
  /\bextra\b/i,
  /\bstory\b/i,
  /\bside[\s_-]*story\b/i,
  /(?:^|[\s/_-])(?:story|extra|afterword|interlude|prologue|preface|epilogue)[\s#._-]*\d+/i,
  /(?:^|[\s/_-])(?:preface|prologue|epilogue|afterword|interlude|extra)\d+(?:$|[\s/_-])/i,
];

const createImportSanitizeOptions = () => ({
  allowedTags: IMPORT_ALLOWED_TAGS,
  allowedAttributes: IMPORT_ALLOWED_ATTRIBUTES,
  allowedSchemes: ["http", "https", "mailto"],
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
  disallowedTagsMode: "discard",
  allowedStyles: {
    p: BLOCK_ALLOWED_STYLE_PATTERNS,
    "epub-p": BLOCK_ALLOWED_STYLE_PATTERNS,
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
});

const flattenToc = (toc) => {
  const entries = [];
  const visit = (value) => {
    if (!value) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "object") {
      entries.push(value);
      visit(value.subitems);
      visit(value.children);
    }
  };
  visit(toc);
  return entries;
};

const sanitizeChapterHtml = (html) =>
  sanitizeHtml(String(html || ""), createImportSanitizeOptions()).trim();

const extractVisibleTextHeuristic = (html) =>
  String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|section|article|blockquote|li|tr|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const getVisibleTextLength = (html) => extractVisibleTextHeuristic(html).replace(/\s+/g, "").length;

const normalizeEpubHref = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  let normalized = raw.replace(/\\/g, "/");
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Ignore malformed URI sequences and keep the original href.
  }
  normalized = normalized.replace(/#.*$/, "");
  normalized = normalized.replace(/^\.?\//, "");
  normalized = normalized.replace(/\/+/g, "/");
  return normalized.trim();
};

const resolveRelativeEpubHref = (baseHref, targetHref) => {
  const normalizedBaseHref = normalizeEpubHref(baseHref);
  const normalizedTargetHref = String(targetHref || "")
    .trim()
    .replace(/\\/g, "/");
  if (!normalizedTargetHref) {
    return "";
  }
  try {
    const base = new URL(normalizedBaseHref || "/", "https://epub.local/");
    const resolved = new URL(normalizedTargetHref, base);
    return normalizeEpubHref(resolved.pathname);
  } catch {
    const dirname = path.posix.dirname(normalizedBaseHref || "");
    return normalizeEpubHref(path.posix.normalize(path.posix.join(dirname, normalizedTargetHref)));
  }
};

const normalizeEpubAssetHref = (value, currentDocumentHref) => {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("javascript:")) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return resolveRelativeEpubHref(currentDocumentHref, raw);
};

const getPathBasename = (value) => {
  const normalized = normalizeEpubHref(value);
  if (!normalized) {
    return "";
  }
  const segments = normalized.split("/");
  return String(segments[segments.length - 1] || "").trim();
};

const normalizeHintText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const getDocumentHint = ({ title, href, id }) =>
  normalizeHintText([title, href, id, getPathBasename(href || id)].filter(Boolean).join(" "));

const hasBoilerplateHint = (value) =>
  BOILERPLATE_HINT_PATTERNS.some((pattern) => pattern.test(value));
const hasHardDiscardBoilerplateHint = (value) =>
  HARD_DISCARD_BOILERPLATE_HINT_PATTERNS.some((pattern) => pattern.test(value));
const hasFrontMatterConsolidationHint = (value) =>
  FRONT_MATTER_CONSOLIDATION_HINT_PATTERNS.some((pattern) => pattern.test(value));
const hasFrontMatterNoiseHint = (value) =>
  FRONT_MATTER_NOISE_HINT_PATTERNS.some((pattern) => pattern.test(value));
const hasMainHint = (value) => MAIN_HINT_PATTERNS.some((pattern) => pattern.test(value));
const hasExtraHint = (value) => EXTRA_HINT_PATTERNS.some((pattern) => pattern.test(value));
const hasCoverTitleHint = (value) => /\bcover\b|\btitle[\s_-]*page\b/i.test(String(value || ""));

const getAnchorTextLength = (html) => {
  const source = String(html || "");
  if (!source) {
    return 0;
  }
  let total = 0;
  const matches = source.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi);
  for (const match of matches) {
    total += extractVisibleTextHeuristic(match[1]).replace(/\s+/g, "").length;
  }
  return total;
};

const getLinkDensity = (html, visibleTextLength) => {
  if (!Number.isFinite(visibleTextLength) || visibleTextLength <= 0) {
    return 0;
  }
  const anchorTextLength = getAnchorTextLength(html);
  if (!Number.isFinite(anchorTextLength) || anchorTextLength <= 0) {
    return 0;
  }
  return Math.min(1, anchorTextLength / visibleTextLength);
};

const resolveDocumentSubtypeFromHint = (hint) => {
  if (/\b(?:dedication|dedicatoria|dedicat[oó]ria)\b/i.test(hint)) {
    return "dedication";
  }
  if (/\bafterword\b/i.test(hint)) {
    return "afterword";
  }
  if (/\bprologue\b/i.test(hint)) {
    return "prologue";
  }
  if (/\bpreface\b/i.test(hint)) {
    return "preface";
  }
  if (/\bepilogue\b/i.test(hint)) {
    return "epilogue";
  }
  if (/\binterlude\b/i.test(hint)) {
    return "interlude";
  }
  if (/\bside[\s_-]*story\b/i.test(hint)) {
    return "side_story";
  }
  if (/\bstory\b/i.test(hint)) {
    return "story";
  }
  if (/\bextra\b/i.test(hint)) {
    return "extra";
  }
  return "";
};

const resolveDisplayLabelForSubtype = (subtype, fallbackTitle) => {
  const normalized = String(subtype || "")
    .trim()
    .toLowerCase();
  if (normalized === "dedication") {
    return "Dedicacao";
  }
  if (normalized === "afterword") {
    return "Afterword";
  }
  if (normalized === "prologue") {
    return "Prologo";
  }
  if (normalized === "preface") {
    return "Prefacio";
  }
  if (normalized === "epilogue") {
    return "Epilogo";
  }
  if (normalized === "interlude") {
    return "Interludio";
  }
  if (normalized === "side_story") {
    return "Side Story";
  }
  if (normalized === "story") {
    return "Story";
  }
  if (normalized === "extra") {
    return "Extra";
  }
  const safeFallback = String(fallbackTitle || "").trim();
  return safeFallback ? safeFallback : "Extra";
};

const shouldPromoteBoilerplateCandidate = ({
  visibleTextLength,
  linkDensity,
  hasImageMarkup,
  hasHardDiscardHint,
  hasCoverHint,
} = {}) => {
  if (hasHardDiscardHint) {
    return false;
  }
  if (hasCoverHint) {
    return hasImageMarkup && visibleTextLength <= 180 && linkDensity <= 0.35;
  }
  if (hasImageMarkup) {
    return true;
  }
  if (visibleTextLength >= 90 && linkDensity <= 0.45) {
    return true;
  }
  if (visibleTextLength >= 45 && linkDensity <= 0.3) {
    return true;
  }
  return false;
};

const classifyEpubDocumentCandidate = ({ title, href, id, html, sanitizedHtml, source }) => {
  const hint = getDocumentHint({ title, href, id });
  const visibleTextLength = getVisibleTextLength(sanitizedHtml);
  const linkDensity = getLinkDensity(sanitizedHtml, visibleTextLength);
  const subtype = resolveDocumentSubtypeFromHint(hint);
  const hasHardDiscardHint = hasHardDiscardBoilerplateHint(hint);
  const hasImageMarkup = /<(?:img|svg|image)\b/i.test(String(html || ""));
  const hasCoverHint = hasCoverTitleHint(hint);

  if (hasBoilerplateHint(hint)) {
    if (
      shouldPromoteBoilerplateCandidate({
        visibleTextLength,
        linkDensity,
        hasImageMarkup,
        hasHardDiscardHint,
        hasCoverHint,
      })
    ) {
      return {
        kind: "boilerplate_candidate",
        reason: "boilerplate_promoted",
        visibleTextLength,
        linkDensity,
        subtype: "boilerplate",
      };
    }
    return {
      kind: "discard",
      reason: "boilerplate_hint",
      visibleTextLength,
      linkDensity,
      subtype: "boilerplate",
    };
  }

  if (visibleTextLength === 0 && hasImageMarkup) {
    return {
      kind: "boilerplate_candidate",
      reason: "image_only_promoted",
      visibleTextLength,
      linkDensity,
      subtype: "boilerplate",
    };
  }

  if (hasMainHint(hint)) {
    return {
      kind: "main",
      reason: "main_hint",
      visibleTextLength,
      linkDensity,
      subtype: "chapter",
    };
  }

  if (hasExtraHint(hint)) {
    return {
      kind: "extra",
      reason: "extra_hint",
      visibleTextLength,
      linkDensity,
      subtype: subtype || "extra",
    };
  }

  if (visibleTextLength >= 30 && source === "toc") {
    return {
      kind: "main",
      reason: "toc_textual_content",
      visibleTextLength,
      linkDensity,
      subtype: subtype || "chapter",
    };
  }

  if (visibleTextLength >= 30 && source === "flow") {
    return {
      kind: "main",
      reason: "flow_textual_content",
      visibleTextLength,
      linkDensity,
      subtype: subtype || "chapter",
    };
  }

  return {
    kind: "discard",
    reason: "not_narrative_enough",
    visibleTextLength,
    linkDensity,
    subtype: "",
  };
};

const extractChapterNumber = (title) => {
  const source = String(title || "").trim();
  if (!source) {
    return null;
  }
  const patterns = [/(?:cap(?:i|\u00ed)tulo|chapter|ch)\s*#?\s*(\d+)/i, /\b(\d+)\b/];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const resolveFallbackNumber = (targetVolume, reservedKeys) => {
  let current = 1;
  while (reservedKeys.has(buildEpisodeKey(current, targetVolume))) {
    current += 1;
  }
  reservedKeys.add(buildEpisodeKey(current, targetVolume));
  return current;
};

const resolveFallbackExtraTechnicalNumber = (targetVolume, reservedKeys) => {
  let current = EXTRA_TECHNICAL_NUMBER_BASE;
  while (reservedKeys.has(buildEpisodeKey(current, targetVolume))) {
    current += 1;
  }
  reservedKeys.add(buildEpisodeKey(current, targetVolume));
  return current;
};

const normalizeImportStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase() === "published"
    ? "published"
    : "draft";

const buildExistingEpisodeMap = (project) =>
  new Map(
    (Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : []).map((episode) => [
      buildEpisodeKey(episode?.number, episode?.volume),
      episode,
    ]),
  );

const buildExistingExtraLookup = (project, targetVolume) => {
  const list = Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : [];
  const byReadingOrder = new Map();
  const byTitle = new Map();
  const targetVolumeValue = Number.isFinite(Number(targetVolume)) ? Number(targetVolume) : 0;
  list.forEach((episode) => {
    const kind = String(episode?.entryKind || "")
      .trim()
      .toLowerCase();
    if (kind !== "extra") {
      return;
    }
    const episodeVolume = Number.isFinite(Number(episode?.volume)) ? Number(episode.volume) : 0;
    if (episodeVolume !== targetVolumeValue) {
      return;
    }
    const safeNumber = Number(episode?.number);
    if (!Number.isFinite(safeNumber) || safeNumber < EXTRA_TECHNICAL_NUMBER_BASE) {
      return;
    }
    const readingOrder = Number(episode?.readingOrder);
    if (Number.isFinite(readingOrder) && !byReadingOrder.has(readingOrder)) {
      byReadingOrder.set(readingOrder, episode);
    }
    const titleKey = normalizeHintText(String(episode?.title || ""));
    if (titleKey && !byTitle.has(titleKey)) {
      byTitle.set(titleKey, episode);
    }
  });
  return {
    byReadingOrder,
    byTitle,
  };
};

const buildFlowIndexes = (epub) => {
  const flowItems = Array.isArray(epub?.flow) ? epub.flow : [];
  const flowById = new Map();
  const flowByHref = new Map();
  const flowIndexById = new Map();

  flowItems.forEach((item, index) => {
    const id = String(item?.id || "").trim();
    const href = normalizeEpubHref(item?.href);
    if (id) {
      flowById.set(id, item);
      flowIndexById.set(id, index);
    }
    if (href) {
      flowByHref.set(href, item);
    }
  });

  return { flowItems, flowById, flowByHref, flowIndexById };
};

const buildManifestIndexes = (epub) => {
  const manifestItems = Object.values(epub?.manifest || {});
  const manifestByHref = new Map();
  const manifestById = new Map();
  manifestItems.forEach((item) => {
    const id = String(item?.id || "").trim();
    const href = normalizeEpubHref(item?.href);
    if (id) {
      manifestById.set(id, item);
    }
    if (href) {
      manifestByHref.set(href, item);
    }
  });
  return { manifestByHref, manifestById };
};

const hasManifestProperty = (item, property) => {
  const target = String(property || "")
    .trim()
    .toLowerCase();
  if (!target) {
    return false;
  }
  const rawProperties = item?.properties;
  if (Array.isArray(rawProperties)) {
    return rawProperties.some(
      (entry) =>
        String(entry || "")
          .trim()
          .toLowerCase() === target,
    );
  }
  return String(rawProperties || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .includes(target);
};

const isHtmlManifestItem = (item) => {
  const mediaType = getManifestMediaType(item);
  return mediaType === "application/xhtml+xml" || mediaType === "text/html";
};

const findResolvableImageInDocument = async ({ epub, manifestItem, manifestByHref } = {}) => {
  const id = String(manifestItem?.id || "").trim();
  if (!id || !isHtmlManifestItem(manifestItem)) {
    return null;
  }
  const rawHtml = await epub.getChapterRaw(id);
  if (!String(rawHtml || "").trim()) {
    return null;
  }
  const dom = new JSDOM(`<body>${String(rawHtml || "")}</body>`);
  try {
    const imageElements = [...dom.window.document.querySelectorAll("img[src]")];
    for (const imageElement of imageElements) {
      const currentSrc = String(imageElement.getAttribute("src") || "").trim();
      if (!currentSrc) {
        continue;
      }
      const resolvedAssetHref = normalizeEpubAssetHref(currentSrc, manifestItem?.href);
      if (!resolvedAssetHref || /^https?:\/\//i.test(resolvedAssetHref)) {
        continue;
      }
      const imageItem = manifestByHref.get(resolvedAssetHref) || null;
      if (!imageItem || !isImageManifestItem(imageItem)) {
        continue;
      }
      return {
        manifestItem: imageItem,
        altText: String(imageElement.getAttribute("alt") || "").trim(),
      };
    }
  } finally {
    dom.window.close();
  }
  return null;
};

const resolveEpubVolumeCoverAsset = async (epub) => {
  const { manifestByHref, manifestById } = buildManifestIndexes(epub);
  const metadataCoverId = String(epub?.metadata?.cover || "").trim();
  if (metadataCoverId) {
    const metadataCoverItem = manifestById.get(metadataCoverId) || null;
    if (metadataCoverItem) {
      if (isImageManifestItem(metadataCoverItem)) {
        return {
          manifestItem: metadataCoverItem,
          altText: "",
          reason: "metadata_cover",
        };
      }
      const resolvedFromDocument = await findResolvableImageInDocument({
        epub,
        manifestItem: metadataCoverItem,
        manifestByHref,
      });
      if (resolvedFromDocument) {
        return {
          ...resolvedFromDocument,
          reason: "metadata_cover_document",
        };
      }
    }
  }

  for (const item of manifestById.values()) {
    if (!hasManifestProperty(item, "cover-image")) {
      continue;
    }
    if (isImageManifestItem(item)) {
      return {
        manifestItem: item,
        altText: "",
        reason: "manifest_cover_image",
      };
    }
    const resolvedFromDocument = await findResolvableImageInDocument({
      epub,
      manifestItem: item,
      manifestByHref,
    });
    if (resolvedFromDocument) {
      return {
        ...resolvedFromDocument,
        reason: "manifest_cover_document",
      };
    }
  }

  const manifestItems = Object.values(epub?.manifest || {});
  const coverDocumentCandidates = manifestItems.filter((item) => {
    if (!isHtmlManifestItem(item)) {
      return false;
    }
    const basename = getPathBasename(item?.href || item?.id);
    return /(?:^|[_-])(cover|titlepage)(?:$|[_-])|^cover\.xhtml$/i.test(basename);
  });
  for (const item of coverDocumentCandidates) {
    const resolvedFromDocument = await findResolvableImageInDocument({
      epub,
      manifestItem: item,
      manifestByHref,
    });
    if (resolvedFromDocument) {
      return {
        ...resolvedFromDocument,
        reason: "cover_document_fallback",
      };
    }
  }

  return null;
};

const resolveTocReferences = (epub) => {
  const tocItems = flattenToc(epub?.toc).filter((entry) => entry?.id || entry?.href);
  const { flowById, flowByHref, flowIndexById } = buildFlowIndexes(epub);
  const ordered = [];
  const seen = new Set();
  let unresolvedCount = 0;

  tocItems.forEach((item) => {
    const id = String(item?.id || "").trim();
    const href = normalizeEpubHref(item?.href);
    const resolved = (href && flowByHref.get(href)) || (id && flowById.get(id)) || null;
    const resolvedId = String(resolved?.id || "").trim();
    if (resolved && resolvedId && !seen.has(resolvedId)) {
      ordered.push({
        id: resolvedId,
        href: normalizeEpubHref(resolved?.href || item?.href),
        title: String(item?.title || resolved?.title || "").trim(),
        source: "toc",
        flowIndex: flowIndexById.get(resolvedId),
      });
      seen.add(resolvedId);
      return;
    }
    unresolvedCount += 1;
  });

  return { items: ordered, unresolvedCount };
};

const buildFallbackFlowReferences = (epub) => {
  const { flowItems } = buildFlowIndexes(epub);
  return flowItems
    .map((item, index) => ({
      id: String(item?.id || "").trim(),
      href: normalizeEpubHref(item?.href),
      title: String(item?.title || "").trim(),
      source: "flow",
      flowIndex: index,
    }))
    .filter((item) => item.id);
};

const buildCandidateDedupeKeys = (item) => {
  const id = String(item?.id || "").trim();
  const href = normalizeEpubHref(item?.href);
  const keys = [];
  if (id) {
    keys.push(`id:${id}`);
  }
  if (href) {
    keys.push(`href:${href}`);
  }
  return keys;
};

const buildTocTitleLookup = (tocReferences) => {
  const lookup = new Map();
  for (const item of Array.isArray(tocReferences) ? tocReferences : []) {
    const title = String(item?.title || "").trim();
    if (!title) {
      continue;
    }
    const keys = buildCandidateDedupeKeys(item);
    for (const key of keys) {
      if (key && !lookup.has(key)) {
        lookup.set(key, title);
      }
    }
  }
  return lookup;
};

const resolvePreferredTocTitle = (reference, tocTitleLookup) => {
  const safeLookup = tocTitleLookup instanceof Map ? tocTitleLookup : new Map();
  for (const key of buildCandidateDedupeKeys(reference)) {
    const match = safeLookup.get(key);
    if (typeof match === "string" && match.trim()) {
      return match.trim();
    }
  }
  return String(reference?.title || "").trim();
};

const hasAnyCandidateKeyMatch = (item, keySet) => {
  const safeKeySet = keySet instanceof Set ? keySet : new Set();
  return buildCandidateDedupeKeys(item).some((key) => safeKeySet.has(key));
};

const isInitialVisualFrontMatterCandidate = ({ rawHtml, sanitizedHtml } = {}) => {
  const hasImageMarkup = /<(?:img|svg|image)\b/i.test(String(rawHtml || ""));
  if (!hasImageMarkup) {
    return false;
  }
  const visibleTextLength = getVisibleTextLength(sanitizedHtml || "");
  const linkDensity = getLinkDensity(sanitizedHtml || "", visibleTextLength);
  return visibleTextLength <= 220 && linkDensity <= 0.4;
};

const resolveFirstNarrativeFlowIndexFromFlow = async (epub, { manifestByHref } = {}) => {
  const flowReferences = buildFallbackFlowReferences(epub);
  for (const item of flowReferences) {
    const candidate = await materializeCandidate(epub, item, {
      manifestByHref,
    });
    const classification = classifyEpubDocumentCandidate({
      title: candidate.title,
      href: candidate.href,
      id: candidate.id,
      html: candidate.rawHtml,
      sanitizedHtml: candidate.sanitizedHtml,
      source: "flow",
    });
    if (classification.kind === "main") {
      const flowIndex = Number(item?.flowIndex);
      if (Number.isFinite(flowIndex)) {
        return flowIndex;
      }
    }
  }
  return null;
};

const buildFrontMatterBundleFromFlow = async ({
  epub,
  firstNarrativeFlowIndex,
  tocReferences,
  warnings,
  discardedCounts,
  imageContext,
  cssFallbackSeenKeys,
} = {}) => {
  if (!Number.isFinite(firstNarrativeFlowIndex) || firstNarrativeFlowIndex <= 0) {
    return {
      chapter: null,
      consumedKeys: new Set(),
    };
  }

  const { flowItems } = buildFlowIndexes(epub);
  const { manifestByHref } = buildManifestIndexes(epub);
  const tocTitleLookup = buildTocTitleLookup(tocReferences);
  const selectedParts = [];
  const selectedKeys = new Set();
  const maxIndex = Math.min(Number(firstNarrativeFlowIndex), flowItems.length);

  for (let flowIndex = 0; flowIndex < maxIndex; flowIndex += 1) {
    const flowItem = flowItems[flowIndex];
    const reference = {
      id: String(flowItem?.id || "").trim(),
      href: normalizeEpubHref(flowItem?.href),
      title: String(flowItem?.title || "").trim(),
      source: "flow",
      flowIndex,
    };
    if (!reference.id) {
      continue;
    }
    if (hasAnyCandidateKeyMatch(reference, selectedKeys)) {
      continue;
    }

    const preferredTitle = resolvePreferredTocTitle(reference, tocTitleLookup);
    const materialized = await materializeCandidate(
      epub,
      {
        ...reference,
        title: preferredTitle,
      },
      { manifestByHref },
    );
    const hint = getDocumentHint({
      title: preferredTitle || materialized.title,
      href: materialized.href,
      id: materialized.id,
    });
    if (hasFrontMatterNoiseHint(hint)) {
      continue;
    }

    const shouldInclude =
      hasFrontMatterConsolidationHint(hint) ||
      isInitialVisualFrontMatterCandidate({
        rawHtml: materialized.rawHtml,
        sanitizedHtml: materialized.sanitizedHtml,
      });
    if (!shouldInclude) {
      continue;
    }

    selectedParts.push({
      ...materialized,
      flowIndex,
      title: String(preferredTitle || materialized.title || "").trim(),
    });
    buildCandidateDedupeKeys(materialized).forEach((key) => selectedKeys.add(key));
  }

  if (!selectedParts.length) {
    return {
      chapter: null,
      consumedKeys: new Set(),
    };
  }

  const chapterParts = [];
  for (const part of selectedParts) {
    const prepared = await prepareNarrativeDocumentHtml({
      epub,
      rawHtml: part.rawHtml,
      documentHref: part.href,
      chapterTitle: String(part.title || "").trim(),
      manifestByHref,
      imageContext,
      cssFallbackSeenKeys,
    });
    if (Array.isArray(warnings)) {
      warnings.push(...prepared.warnings);
    }
    if (prepared.html) {
      chapterParts.push(prepared.html);
    }
  }

  const sanitizedHtml = chapterParts.join("\n").trim();
  if (!sanitizedHtml) {
    return {
      chapter: null,
      consumedKeys: new Set(),
    };
  }

  if (discardedCounts && Number.isFinite(Number(discardedCounts.boilerplatePromoted))) {
    discardedCounts.boilerplatePromoted += selectedParts.length;
  }
  if (Array.isArray(warnings)) {
    warnings.push(
      `Front matter inicial consolidado em um unico extra: ${selectedParts.length} item(ns).`,
    );
  }

  const firstPart = selectedParts[0];
  const bundleTitle =
    String(selectedParts.find((part) => String(part?.title || "").trim())?.title || "").trim() ||
    "Extra";

  return {
    chapter: {
      id: firstPart?.id,
      href: firstPart?.href,
      title: bundleTitle,
      source: "flow_front_matter",
      sanitizedHtml,
      readingOrder: Number(firstPart?.flowIndex) + 1,
      entryKind: "extra",
      entrySubtype: "extra",
      displayLabel: "Extra",
    },
    consumedKeys: selectedKeys,
  };
};

const getNarrativeGroupStem = (item) => {
  const basename = normalizeHintText(
    getPathBasename(item?.href || item?.id).replace(/\.[^.]+$/, ""),
  );
  const chapterStemMatch = basename.match(/^(chapter\d+)(?:[_-].+)?$/i);
  if (chapterStemMatch?.[1]) {
    return chapterStemMatch[1].toLowerCase();
  }
  const sectionStemMatch = basename.match(
    /^((?:preface|prologue|epilogue|afterword|interlude|extra)\d*)(?:[_-].+)?$/i,
  );
  if (sectionStemMatch?.[1]) {
    return sectionStemMatch[1].toLowerCase();
  }
  return null;
};

const buildDiscardWarnings = ({
  boilerplate,
  boilerplatePromoted,
  imageOnly,
  unresolvedTocEntry,
}) => {
  const warnings = [];
  if (boilerplatePromoted > 0) {
    warnings.push(`Itens de boilerplate promovidos para extras: ${boilerplatePromoted}.`);
  }
  if (boilerplate > 0) {
    warnings.push(`Itens de boilerplate ignorados: ${boilerplate}.`);
  }
  if (imageOnly > 0) {
    warnings.push(`Paginas somente com imagem ignoradas: ${imageOnly}.`);
  }
  if (unresolvedTocEntry > 0) {
    warnings.push(`Entradas do TOC não resolvidas: ${unresolvedTocEntry}.`);
  }
  return warnings;
};

const resolveChapterRawByReference = async (epub, item, { manifestByHref } = {}) => {
  const requestedId = String(item?.id || "").trim();
  const normalizedHref = normalizeEpubHref(item?.href);
  let resolvedId = requestedId;
  let rawHtml = resolvedId ? await epub.getChapterRaw(resolvedId) : "";

  if (!String(rawHtml || "").trim() && normalizedHref) {
    const hrefIndex = manifestByHref || buildManifestIndexes(epub).manifestByHref;
    const manifestItem = hrefIndex.get(normalizedHref) || null;
    const fallbackId = String(manifestItem?.id || "").trim();
    if (fallbackId && fallbackId !== resolvedId) {
      const fallbackRawHtml = await epub.getChapterRaw(fallbackId);
      if (String(fallbackRawHtml || "").trim()) {
        resolvedId = fallbackId;
        rawHtml = fallbackRawHtml;
      }
    }
  }

  return {
    rawHtml,
    resolvedId,
    normalizedHref,
    requestedId,
  };
};

const materializeCandidate = async (epub, item, { manifestByHref } = {}) => {
  const { rawHtml, resolvedId, requestedId } = await resolveChapterRawByReference(epub, item, {
    manifestByHref,
  });
  const sanitizedHtml = sanitizeChapterHtml(rawHtml);
  return {
    ...item,
    id: resolvedId || requestedId,
    rawHtml,
    sanitizedHtml,
    title: String(item?.title || epub.manifest?.[resolvedId || requestedId]?.title || "").trim(),
  };
};

const getManifestMediaType = (item) =>
  String(item?.["media-type"] || item?.mediaType || item?.media_type || "")
    .trim()
    .toLowerCase();

const isImageManifestItem = (item) => getManifestMediaType(item).startsWith("image/");

const getManifestBinaryCacheKey = (manifestItem) => {
  const id = String(manifestItem?.id || "").trim();
  const href = normalizeEpubHref(manifestItem?.href);
  if (id && href) {
    return `${id}::${href}`;
  }
  if (id) {
    return id;
  }
  return href || "";
};

const loadManifestBinary = async (epub, manifestItem, { cache } = {}) => {
  const id = String(manifestItem?.id || "").trim();
  if (!id) {
    return Buffer.from([]);
  }
  const cacheKey = getManifestBinaryCacheKey(manifestItem);
  if (cache instanceof Map && cacheKey && cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const extractBinaryPayload = (value) => {
    if (!value) {
      return Buffer.from([]);
    }
    if (Buffer.isBuffer(value)) {
      return value;
    }
    if (value instanceof Uint8Array) {
      return Buffer.from(value);
    }
    if (typeof value === "object" && Buffer.isBuffer(value.data)) {
      return value.data;
    }
    if (typeof value === "object" && value.data instanceof Uint8Array) {
      return Buffer.from(value.data);
    }
    return Buffer.from([]);
  };

  if (isImageManifestItem(manifestItem) && typeof epub.getImage === "function") {
    const imageBuffer = await epub.getImage(id);
    const payload = extractBinaryPayload(imageBuffer);
    if (payload.length > 0) {
      if (cache instanceof Map && cacheKey) {
        cache.set(cacheKey, payload);
      }
      return payload;
    }
  }

  if (typeof epub.getFile === "function") {
    const fileBuffer = await epub.getFile(id);
    const payload = extractBinaryPayload(fileBuffer);
    if (payload.length > 0) {
      if (cache instanceof Map && cacheKey) {
        cache.set(cacheKey, payload);
      }
      return payload;
    }
  }

  return Buffer.from([]);
};

const buildStyleDeclaration = (entries) =>
  entries
    .map(([property, value]) => [
      String(property || "")
        .trim()
        .toLowerCase(),
      String(value || "").trim(),
    ])
    .filter(([property, value]) => property && value)
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");

const isMeaningfulStyleValue = (value) =>
  !ZERO_LIKE_STYLE_VALUES.has(
    String(value || "")
      .trim()
      .toLowerCase(),
  );

const normalizeFontFamilyBucket = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return "";
  }
  if (
    normalized.includes("mono") ||
    normalized.includes("consolas") ||
    normalized.includes("courier") ||
    normalized.includes("fira code") ||
    normalized.includes("jetbrains mono")
  ) {
    return "monospace";
  }
  if (
    normalized.includes("sans") ||
    normalized.includes("arial") ||
    normalized.includes("helvetica") ||
    normalized.includes("verdana") ||
    normalized.includes("tahoma") ||
    normalized.includes("gothic") ||
    normalized.includes("meiryo") ||
    normalized.includes("yu gothic")
  ) {
    return "sans-serif";
  }
  return "serif";
};

const parseCssNumericValue = (value) => {
  const match = String(value || "")
    .trim()
    .match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const computeFontSizeRatio = (value, baseFontSize) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  const parsed = parseCssNumericValue(normalized);
  if (!parsed || !Number.isFinite(baseFontSize) || baseFontSize <= 0) {
    return null;
  }
  if (normalized.endsWith("em") || normalized.endsWith("rem")) {
    return parsed;
  }
  if (normalized.endsWith("%")) {
    return parsed / 100;
  }
  return parsed / baseFontSize;
};

const getElementVisibleTextLength = (element) =>
  String(element?.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "").length;

const resolveEditorialHeadingTag = (ratio) => {
  if (ratio >= 1.9) {
    return "h1";
  }
  if (ratio >= 1.55) {
    return "h2";
  }
  if (ratio >= 1.25) {
    return "h3";
  }
  return null;
};

const hasHeadingLikeSpacing = (computed, baseFontSize) => {
  const marginTop = parseCssNumericValue(computed?.marginTop) || 0;
  const marginBottom = parseCssNumericValue(computed?.marginBottom) || 0;
  return marginTop >= baseFontSize * 0.5 || marginBottom >= baseFontSize * 0.5;
};

const classifyEditorialBlockScale = (element, computed, { baseFontSize } = {}) => {
  const tagName = String(element?.tagName || "").toLowerCase();
  if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) {
    return null;
  }

  const ratio = computeFontSizeRatio(computed?.fontSize, baseFontSize);
  if (!ratio) {
    return null;
  }
  if (ratio < 1.25) {
    return null;
  }

  const visibleTextLength = getElementVisibleTextLength(element);
  if (visibleTextLength === 0 || visibleTextLength > 220) {
    return null;
  }

  const hint = [element?.className, element?.id].filter(Boolean).join(" ").toLowerCase();
  const hasHeadingHint = /\b(chapter-title|title|subtitle|heading|subhead)\b/i.test(hint);
  const isCentered = String(computed?.textAlign || "").toLowerCase() === "center";
  const hasShortText = visibleTextLength <= 120;
  const hasSpacingCue = hasHeadingLikeSpacing(computed, baseFontSize);

  if (!hasHeadingHint && !isCentered && !hasShortText && !hasSpacingCue) {
    return null;
  }

  return resolveEditorialHeadingTag(ratio);
};

const elementHasOnlyThisImage = (element) => {
  const parent = element?.parentElement;
  if (!parent) {
    return false;
  }
  const elementChildren = [...parent.children];
  if (elementChildren.length !== 1 || elementChildren[0] !== element) {
    return false;
  }
  return (
    String(parent.textContent || "")
      .replace(/\s+/g, "")
      .trim() === ""
  );
};

const extractEditorialImageAlignment = (element, computed, wrapperComputed) => {
  const marginLeft = String(computed?.marginLeft || "")
    .trim()
    .toLowerCase();
  const marginRight = String(computed?.marginRight || "")
    .trim()
    .toLowerCase();
  if (marginLeft === "auto" && marginRight === "auto") {
    return "center";
  }
  if (marginLeft === "auto") {
    return "right";
  }
  if (marginRight === "auto") {
    return "left";
  }

  const display = String(computed?.display || "")
    .trim()
    .toLowerCase();
  const wrapperTextAlign = String(wrapperComputed?.textAlign || "")
    .trim()
    .toLowerCase();
  const isolatedInParent = elementHasOnlyThisImage(element);
  if ((display === "block" || isolatedInParent) && wrapperTextAlign === "center") {
    return "center";
  }
  if ((display === "block" || isolatedInParent) && wrapperTextAlign === "right") {
    return "right";
  }
  if ((display === "block" || isolatedInParent) && wrapperTextAlign === "left") {
    return "left";
  }
  return null;
};

const loadEpubDocumentStylesheets = async ({
  epub,
  documentHref,
  manifestByHref,
  rawHtml,
  manifestBinaryCache,
} = {}) => {
  const sourceDom = new JSDOM(String(rawHtml || ""));
  const stylesheets = [];
  try {
    const inlineStyles = [...sourceDom.window.document.querySelectorAll("style")]
      .map((element) => String(element.textContent || "").trim())
      .filter(Boolean);
    stylesheets.push(...inlineStyles);

    const stylesheetHrefs = [
      ...sourceDom.window.document.querySelectorAll('link[rel~="stylesheet"][href]'),
    ]
      .map((element) => String(element.getAttribute("href") || "").trim())
      .filter(Boolean);

    for (const stylesheetHref of stylesheetHrefs) {
      const resolvedHref = normalizeEpubAssetHref(stylesheetHref, documentHref);
      const manifestItem = resolvedHref ? manifestByHref.get(resolvedHref) || null : null;
      if (!manifestItem) {
        continue;
      }
      const stylesheetBuffer = await loadManifestBinary(epub, manifestItem, {
        cache: manifestBinaryCache,
      });
      if (!stylesheetBuffer.length) {
        continue;
      }
      stylesheets.push(stylesheetBuffer.toString("utf8"));
    }
  } finally {
    sourceDom.window.close();
  }
  return stylesheets;
};

const buildStyledEpubDocument = ({ rawHtml, stylesheets } = {}) => {
  const sourceDom = new JSDOM(String(rawHtml || ""));
  try {
    const bodyHtml = sourceDom.window.document.body?.innerHTML || String(rawHtml || "");
    const styleTag =
      stylesheets && stylesheets.length > 0 ? `<style>${stylesheets.join("\n")}</style>` : "";
    return new JSDOM(
      `<!doctype html><html><head>${styleTag}</head><body>${bodyHtml}</body></html>`,
    );
  } finally {
    sourceDom.window.close();
  }
};

const applyInlineStyle = (element, styleText) => {
  const safeStyle = String(styleText || "").trim();
  if (!safeStyle) {
    element.removeAttribute("style");
    return;
  }
  element.setAttribute("style", safeStyle);
};

const replaceElementTag = (element, nextTagName) => {
  const replacement = element.ownerDocument.createElement(nextTagName);
  for (const attribute of [...element.attributes]) {
    replacement.setAttribute(attribute.name, attribute.value);
  }
  while (element.firstChild) {
    replacement.appendChild(element.firstChild);
  }
  element.replaceWith(replacement);
  return replacement;
};

const inlineEditorialComputedStyles = (document) => {
  const computeElementStyles = (element) => document.defaultView.getComputedStyle(element);
  const bodyFontSize = parseCssNumericValue(
    computeElementStyles(document.body || document.documentElement).fontSize,
  );
  const baseFontSize = bodyFontSize && bodyFontSize > 0 ? bodyFontSize : 16;

  const blockElements = [...document.querySelectorAll("p, blockquote, h1, h2, h3, h4, h5, h6")];
  for (const element of blockElements) {
    const tagName = String(element.tagName || "").toLowerCase();
    const computed = computeElementStyles(element);
    const blockHeadingTag = classifyEditorialBlockScale(element, computed, { baseFontSize });
    const blockFontSizeRatio = computeFontSizeRatio(computed.fontSize, baseFontSize);
    const styleText = buildStyleDeclaration([
      [
        "font-size",
        blockFontSizeRatio && Math.abs(blockFontSizeRatio - 1) > 0.05 ? computed.fontSize : "",
      ],
      [
        "text-align",
        ["left", "right", "center", "justify"].includes(
          String(computed.textAlign || "").toLowerCase(),
        )
          ? computed.textAlign.toLowerCase()
          : "",
      ],
      ["text-indent", isMeaningfulStyleValue(computed.textIndent) ? computed.textIndent : ""],
      ["margin-top", isMeaningfulStyleValue(computed.marginTop) ? computed.marginTop : ""],
      ["margin-bottom", isMeaningfulStyleValue(computed.marginBottom) ? computed.marginBottom : ""],
      ["line-height", isMeaningfulStyleValue(computed.lineHeight) ? computed.lineHeight : ""],
      [
        "font-family",
        isMeaningfulStyleValue(computed.fontFamily)
          ? normalizeFontFamilyBucket(computed.fontFamily)
          : "",
      ],
    ]);
    applyInlineStyle(element, styleText);
    if (blockHeadingTag) {
      element.setAttribute("data-epub-heading", blockHeadingTag);
    } else {
      element.removeAttribute("data-epub-heading");
      if (styleText && (tagName === "p" || tagName === "blockquote")) {
        replaceElementTag(element, "epub-p");
      }
    }
  }

  const inlineElements = [...document.querySelectorAll("span, em, strong, i, b, u, s, sub, sup")];
  for (const element of inlineElements) {
    const computed = computeElementStyles(element);
    const parentComputed = element.parentElement
      ? computeElementStyles(element.parentElement)
      : null;
    const computedFontFamily = normalizeFontFamilyBucket(computed.fontFamily);
    const parentFontFamily = parentComputed
      ? normalizeFontFamilyBucket(parentComputed.fontFamily)
      : "";
    const styleText = buildStyleDeclaration([
      [
        "font-size",
        parentComputed && computed.fontSize === parentComputed.fontSize ? "" : computed.fontSize,
      ],
      [
        "font-style",
        ["italic", "oblique"].includes(String(computed.fontStyle || "").toLowerCase())
          ? computed.fontStyle.toLowerCase()
          : "",
      ],
      [
        "font-weight",
        ["bold", "500", "600", "700", "800", "900"].includes(
          String(computed.fontWeight || "").toLowerCase(),
        )
          ? computed.fontWeight.toLowerCase()
          : "",
      ],
      [
        "font-family",
        computedFontFamily && computedFontFamily !== parentFontFamily ? computedFontFamily : "",
      ],
    ]);
    applyInlineStyle(element, styleText);
  }

  const images = [...document.querySelectorAll("img")];
  for (const element of images) {
    const computed = computeElementStyles(element);
    const parentComputed = element.parentElement
      ? computeElementStyles(element.parentElement)
      : null;
    const resolvedAlign = extractEditorialImageAlignment(element, computed, parentComputed);
    const shouldForceBlockDisplay = Boolean(resolvedAlign) && elementHasOnlyThisImage(element);
    const styleText = buildStyleDeclaration([
      ["width", isMeaningfulStyleValue(computed.width) ? computed.width : ""],
      ["height", isMeaningfulStyleValue(computed.height) ? computed.height : ""],
      ["max-width", isMeaningfulStyleValue(computed.maxWidth) ? computed.maxWidth : ""],
      [
        "display",
        shouldForceBlockDisplay
          ? "block"
          : ["inline", "block", "inline-block"].includes(
                String(computed.display || "").toLowerCase(),
              )
            ? computed.display.toLowerCase()
            : "",
      ],
      ["margin-left", isMeaningfulStyleValue(computed.marginLeft) ? computed.marginLeft : ""],
      ["margin-right", isMeaningfulStyleValue(computed.marginRight) ? computed.marginRight : ""],
      ["margin-top", isMeaningfulStyleValue(computed.marginTop) ? computed.marginTop : ""],
      ["margin-bottom", isMeaningfulStyleValue(computed.marginBottom) ? computed.marginBottom : ""],
      [
        "vertical-align",
        ["baseline", "middle", "text-bottom", "text-top", "sub", "super"].includes(
          String(computed.verticalAlign || "").toLowerCase(),
        )
          ? computed.verticalAlign.toLowerCase()
          : "",
      ],
    ]);
    applyInlineStyle(element, styleText);
    if (resolvedAlign) {
      element.setAttribute("data-epub-align", resolvedAlign);
    } else {
      element.removeAttribute("data-epub-align");
    }
  }
};

const normalizeEditorialWrappers = (document) => {
  const wrappers = [...document.querySelectorAll("div, section")].reverse();

  for (const wrapper of wrappers) {
    const elementChildren = [...wrapper.children];
    const nonWhitespaceText = String(wrapper.textContent || "")
      .replace(/\s+/g, "")
      .trim();
    const onlyImages =
      elementChildren.length > 0 && elementChildren.every((child) => child.tagName === "IMG");

    if (nonWhitespaceText === "" && onlyImages) {
      const wrapperComputed = document.defaultView.getComputedStyle(wrapper);
      elementChildren.forEach((imageElement) => {
        const imageComputed = document.defaultView.getComputedStyle(imageElement);
        const resolvedAlign = extractEditorialImageAlignment(
          imageElement,
          imageComputed,
          wrapperComputed,
        );
        const styleText = buildStyleDeclaration([
          ["width", isMeaningfulStyleValue(imageComputed.width) ? imageComputed.width : ""],
          ["height", isMeaningfulStyleValue(imageComputed.height) ? imageComputed.height : ""],
          [
            "max-width",
            isMeaningfulStyleValue(imageComputed.maxWidth) ? imageComputed.maxWidth : "",
          ],
          [
            "display",
            resolvedAlign || imageComputed.display === "block" ? "block" : imageComputed.display,
          ],
          [
            "margin-left",
            resolvedAlign === "center"
              ? "auto"
              : resolvedAlign === "right"
                ? "auto"
                : resolvedAlign === "left"
                  ? "0"
                  : imageComputed.marginLeft,
          ],
          [
            "margin-right",
            resolvedAlign === "center"
              ? "auto"
              : resolvedAlign === "left"
                ? "auto"
                : resolvedAlign === "right"
                  ? "0"
                  : imageComputed.marginRight,
          ],
          [
            "margin-top",
            isMeaningfulStyleValue(imageComputed.marginTop) ? imageComputed.marginTop : "",
          ],
          [
            "margin-bottom",
            isMeaningfulStyleValue(imageComputed.marginBottom) ? imageComputed.marginBottom : "",
          ],
          [
            "vertical-align",
            ["baseline", "middle", "text-bottom", "text-top", "sub", "super"].includes(
              String(imageComputed.verticalAlign || "").toLowerCase(),
            )
              ? imageComputed.verticalAlign.toLowerCase()
              : "",
          ],
        ]);
        applyInlineStyle(imageElement, styleText);
        if (resolvedAlign) {
          imageElement.setAttribute("data-epub-align", resolvedAlign);
        } else {
          imageElement.removeAttribute("data-epub-align");
        }
      });
      wrapper.replaceWith(...elementChildren);
      continue;
    }

    wrapper.replaceWith(...wrapper.childNodes);
  }
};

const rewriteInternalImagesInDocument = async ({
  epub,
  document,
  documentHref,
  chapterTitle,
  manifestByHref,
  imageContext,
} = {}) => {
  const warnings = [];
  const images = [...document.querySelectorAll("img")];

  for (const imageElement of images) {
    const currentSrc = String(imageElement.getAttribute("src") || "").trim();
    if (!currentSrc) {
      imageElement.remove();
      continue;
    }
    if (/^https?:\/\//i.test(currentSrc) || currentSrc.startsWith("/uploads/")) {
      continue;
    }

    const resolvedAssetHref = normalizeEpubAssetHref(currentSrc, documentHref);
    const manifestItem = resolvedAssetHref ? manifestByHref.get(resolvedAssetHref) || null : null;
    if (!manifestItem || !isImageManifestItem(manifestItem)) {
      warnings.push(`Imagem interna ignorada no capítulo "${chapterTitle}": ${currentSrc}.`);
      if (imageContext) {
        imageContext.imageImportFailures += 1;
      }
      imageElement.remove();
      continue;
    }

    if (!imageContext) {
      warnings.push(`Imagem interna ignorada no capítulo "${chapterTitle}": ${currentSrc}.`);
      imageElement.remove();
      continue;
    }

    try {
      const imageCacheKey = String(resolvedAssetHref || manifestItem?.id || currentSrc).trim();
      const cachedUpload = imageCacheKey ? imageContext.imageUploadCache.get(imageCacheKey) : null;
      if (cachedUpload) {
        imageContext.imagesImported += 1;
        imageElement.setAttribute("src", cachedUpload.url);
        if (!imageElement.getAttribute("alt") && cachedUpload.altText) {
          imageElement.setAttribute("alt", cachedUpload.altText);
        }
        continue;
      }
      const imageBuffer = await loadManifestBinary(epub, manifestItem, {
        cache: imageContext.manifestBinaryCache,
      });
      if (!imageBuffer.length) {
        throw new Error("empty_epub_asset");
      }
      const tempFolder = buildEpubImportTempFolder({
        userId: imageContext.uploadUserId,
        importId: imageContext.importId,
      });
      const result = await storeUploadImageBuffer({
        uploadsDir: imageContext.uploadsDir,
        uploads: imageContext.uploads,
        buffer: imageBuffer,
        mime: getManifestMediaType(manifestItem),
        filename: getPathBasename(resolvedAssetHref || currentSrc) || "epub-image",
        folder: tempFolder,
        altText: String(imageElement.getAttribute("alt") || "").trim(),
      });
      imageContext.uploads = result.uploads;
      imageContext.uploadsDirty = true;
      imageContext.imagesImported += 1;
      if (imageCacheKey) {
        imageContext.imageUploadCache.set(imageCacheKey, result.uploadEntry);
      }
      imageElement.setAttribute("src", result.uploadEntry.url);
      if (!imageElement.getAttribute("alt") && result.uploadEntry.altText) {
        imageElement.setAttribute("alt", result.uploadEntry.altText);
      }
    } catch {
      imageContext.imageImportFailures += 1;
      warnings.push(`Imagem interna ignorada no capítulo "${chapterTitle}": ${currentSrc}.`);
      imageElement.remove();
    }
  }

  return warnings;
};

const prepareNarrativeDocumentHtml = async ({
  epub,
  rawHtml,
  documentHref,
  chapterTitle,
  manifestByHref,
  imageContext,
  cssFallbackSeenKeys,
} = {}) => {
  const stylesheets = await loadEpubDocumentStylesheets({
    epub,
    documentHref,
    manifestByHref,
    rawHtml,
    manifestBinaryCache: imageContext?.manifestBinaryCache,
  });
  const dom = buildStyledEpubDocument({
    rawHtml,
    stylesheets,
  });

  try {
    const warnings = await rewriteInternalImagesInDocument({
      epub,
      document: dom.window.document,
      documentHref,
      chapterTitle,
      manifestByHref,
      imageContext,
    });
    try {
      inlineEditorialComputedStyles(dom.window.document);
      normalizeEditorialWrappers(dom.window.document);
    } catch (error) {
      const normalizedDocumentHref = normalizeEpubHref(documentHref);
      const chapterContextLabel =
        String(chapterTitle || "").trim() || normalizedDocumentHref || "Capítulo";
      const warning =
        `Estilos CSS avançados foram ignorados no capítulo "${chapterContextLabel}"; ` +
        "importacao continuou sem estilos calculados.";
      const fallbackKey = String(normalizedDocumentHref || chapterContextLabel || "")
        .trim()
        .toLowerCase();
      const shouldEmitWarning =
        !(cssFallbackSeenKeys instanceof Set) ||
        !fallbackKey ||
        !cssFallbackSeenKeys.has(fallbackKey);
      if (shouldEmitWarning) {
        warnings.push(warning);
        console.warn("epub_import_editorial_css_fallback", {
          chapterTitle: chapterContextLabel,
          documentHref: normalizedDocumentHref || null,
          detail: String(error?.message || error || "css_editorial_fallback"),
        });
        if (cssFallbackSeenKeys instanceof Set && fallbackKey) {
          cssFallbackSeenKeys.add(fallbackKey);
        }
      }
    }
    return {
      html: sanitizeChapterHtml(dom.window.document.body.innerHTML),
      warnings,
    };
  } finally {
    dom.window.close();
  }
};

const createImageImportContext = ({ uploadsDir, loadUploads, writeUploads, uploadUserId } = {}) => {
  if (!uploadsDir || typeof loadUploads !== "function" || typeof writeUploads !== "function") {
    return null;
  }
  const initialUploads = loadUploads();
  return {
    uploadsDir,
    loadUploads,
    writeUploads,
    uploadUserId: String(uploadUserId || "anonymous").trim() || "anonymous",
    importId: crypto.randomUUID(),
    uploads: Array.isArray(initialUploads) ? initialUploads : [],
    uploadsDirty: false,
    imagesImported: 0,
    imageImportFailures: 0,
    manifestBinaryCache: new Map(),
    imageUploadCache: new Map(),
  };
};

const flushImageContextUploads = async (imageContext) => {
  if (!imageContext || imageContext.uploadsDirty !== true) {
    return;
  }
  try {
    await Promise.resolve(
      imageContext.writeUploads(imageContext.uploads, {
        awaitPersist: true,
        reason: "epub_import",
      }),
    );
    imageContext.uploadsDirty = false;
  } catch (error) {
    const persistError = new Error("epub_upload_persist_failed");
    persistError.code = "epub_upload_persist_failed";
    persistError.causeMessage = String(error?.message || error || "epub_upload_persist_failed");
    throw persistError;
  }
};

const buildVolumeCoverAltFallback = ({ targetVolume, projectTitle, epubTitle } = {}) => {
  const safeVolume = Number.isFinite(Number(targetVolume)) ? Number(targetVolume) : null;
  const safeProjectTitle = String(projectTitle || "").trim();
  const safeEpubTitle = String(epubTitle || "").trim();
  if (safeEpubTitle) {
    return safeEpubTitle;
  }
  if (safeVolume !== null && safeProjectTitle) {
    return `Capa do volume ${safeVolume} de ${safeProjectTitle}`;
  }
  if (safeVolume !== null) {
    return `Capa do volume ${safeVolume}`;
  }
  if (safeProjectTitle) {
    return `Capa de ${safeProjectTitle}`;
  }
  return "Capa importada do EPUB";
};

const importVolumeCoverFromEpub = async ({ epub, project, targetVolume, imageContext } = {}) => {
  const warnings = [];
  const existingCover =
    findVolumeCoverByVolume(
      Array.isArray(project?.volumeCovers) ? project.volumeCovers : [],
      targetVolume,
    ) || null;
  const existingUrl = String(existingCover?.coverImageUrl || "").trim();

  if (existingUrl) {
    warnings.push(
      `Capa do volume preservada porque o volume ${
        Number.isFinite(Number(targetVolume)) ? Number(targetVolume) : "sem volume"
      } ja possui capa definida.`,
    );
    return {
      summary: {
        volumeCoverImported: false,
        volumeCoverSkipped: true,
      },
      warnings,
      volumeCovers: [
        {
          volume: Number.isFinite(Number(targetVolume)) ? Number(targetVolume) : undefined,
          coverImageUrl: existingUrl,
          coverImageAlt: String(existingCover?.coverImageAlt || "").trim(),
          mergeMode: "preserve_existing",
        },
      ],
    };
  }

  const coverAsset = await resolveEpubVolumeCoverAsset(epub);
  if (!coverAsset?.manifestItem) {
    warnings.push("Não foi possível localizar a capa do volume no EPUB.");
    return {
      summary: {
        volumeCoverImported: false,
        volumeCoverSkipped: false,
      },
      warnings,
      volumeCovers: [],
    };
  }

  if (!imageContext) {
    warnings.push("Não foi possível importar a capa do volume do EPUB.");
    return {
      summary: {
        volumeCoverImported: false,
        volumeCoverSkipped: false,
      },
      warnings,
      volumeCovers: [],
    };
  }

  try {
    const imageBuffer = await loadManifestBinary(epub, coverAsset.manifestItem, {
      cache: imageContext.manifestBinaryCache,
    });
    if (!imageBuffer.length) {
      throw new Error("empty_epub_cover");
    }
    const tempFolder = buildEpubImportTempFolder({
      userId: imageContext.uploadUserId,
      importId: imageContext.importId,
    });
    const stored = await storeUploadImageBuffer({
      uploadsDir: imageContext.uploadsDir,
      uploads: imageContext.uploads,
      buffer: imageBuffer,
      mime: getManifestMediaType(coverAsset.manifestItem),
      filename:
        getPathBasename(coverAsset.manifestItem?.href || coverAsset.manifestItem?.id) ||
        "epub-cover",
      folder: tempFolder,
      altText:
        String(coverAsset.altText || "").trim() ||
        buildVolumeCoverAltFallback({
          targetVolume,
          projectTitle: project?.title,
          epubTitle: epub?.metadata?.title,
        }),
    });
    imageContext.uploads = stored.uploads;
    imageContext.uploadsDirty = true;
    warnings.push(
      `Capa do volume importada do EPUB para o volume ${
        Number.isFinite(Number(targetVolume)) ? Number(targetVolume) : "sem volume"
      }.`,
    );
    return {
      summary: {
        volumeCoverImported: true,
        volumeCoverSkipped: false,
      },
      warnings,
      volumeCovers: [
        {
          volume: Number.isFinite(Number(targetVolume)) ? Number(targetVolume) : undefined,
          coverImageUrl: stored.uploadEntry.url,
          coverImageAlt: String(
            stored.uploadEntry.altText ||
              buildVolumeCoverAltFallback({
                targetVolume,
                projectTitle: project?.title,
                epubTitle: epub?.metadata?.title,
              }),
          ).trim(),
          mergeMode: existingCover ? "update" : "create",
        },
      ],
    };
  } catch {
    warnings.push("Não foi possível importar a capa do volume do EPUB.");
    return {
      summary: {
        volumeCoverImported: false,
        volumeCoverSkipped: false,
      },
      warnings,
      volumeCovers: [],
    };
  }
};

const shouldDiscardRangePartAsBoilerplate = (item) => {
  const hint = getDocumentHint(item);
  return RANGE_INTRUDER_HINT_PATTERNS.some((pattern) => pattern.test(hint));
};

const buildNarrativeChapterCandidatesFromToc = async ({
  epub,
  tocStructuredCandidates,
  discardedCounts,
  warnings,
  imageContext,
  cssFallbackSeenKeys,
} = {}) => {
  const { flowItems } = buildFlowIndexes(epub);
  const { manifestByHref } = buildManifestIndexes(epub);
  const sortedNarrativeCandidates = [...tocStructuredCandidates]
    .filter((candidate) => Number.isFinite(candidate?.flowIndex))
    .sort((left, right) => Number(left.flowIndex) - Number(right.flowIndex));

  const chapters = [];
  for (let index = 0; index < sortedNarrativeCandidates.length; index += 1) {
    const item = sortedNarrativeCandidates[index];
    const startIndex = Number(item.flowIndex);
    const nextFlowIndex =
      index + 1 < sortedNarrativeCandidates.length
        ? Number(sortedNarrativeCandidates[index + 1]?.flowIndex)
        : flowItems.length;
    const endIndex = Math.max(startIndex, nextFlowIndex - 1);
    const chapterParts = [];

    for (let flowIndex = startIndex; flowIndex <= endIndex; flowIndex += 1) {
      const flowItem = flowItems[flowIndex];
      const partReference = {
        id: String(flowItem?.id || "").trim(),
        href: normalizeEpubHref(flowItem?.href),
        title: String(flowItem?.title || "").trim(),
      };
      if (!partReference.id) {
        continue;
      }
      const isBoundaryStart = flowIndex === startIndex;
      if (
        shouldDiscardRangePartAsBoilerplate(partReference) &&
        !(
          isBoundaryStart &&
          String(item?.classification?.kind || "")
            .trim()
            .toLowerCase() === "boilerplate_candidate"
        )
      ) {
        discardedCounts.boilerplate += 1;
        continue;
      }

      const { rawHtml } = await resolveChapterRawByReference(epub, partReference, {
        manifestByHref,
      });
      const prepared = await prepareNarrativeDocumentHtml({
        epub,
        rawHtml,
        documentHref: partReference.href,
        chapterTitle: item.title,
        manifestByHref,
        imageContext,
        cssFallbackSeenKeys,
      });
      warnings.push(...prepared.warnings);
      const sanitizedHtml = prepared.html;
      if (sanitizedHtml) {
        chapterParts.push(sanitizedHtml);
      }
    }

    const sanitizedHtml = chapterParts.join("\n").trim();
    if (!sanitizedHtml) {
      continue;
    }
    chapters.push({
      id: item.id,
      href: item.href,
      title: item.title,
      source: "toc",
      sanitizedHtml,
      readingOrder: Number(item.flowIndex) + 1,
      entryKind:
        String(item?.classification?.kind || "")
          .trim()
          .toLowerCase() === "main"
          ? "main"
          : "extra",
      entrySubtype: String(item?.classification?.subtype || "").trim() || "extra",
      displayLabel:
        String(item?.classification?.kind || "")
          .trim()
          .toLowerCase() === "main"
          ? ""
          : resolveDisplayLabelForSubtype(item?.classification?.subtype, item.title),
    });
  }

  return chapters;
};

const buildFallbackNarrativeChapterCandidates = async ({
  epub,
  discardedCounts,
  warnings,
  imageContext,
  excludedCandidateKeys,
  cssFallbackSeenKeys,
} = {}) => {
  const flowReferences = buildFallbackFlowReferences(epub);
  const materialized = [];
  for (const item of flowReferences) {
    const candidate = await materializeCandidate(epub, item);
    if (hasAnyCandidateKeyMatch(candidate, excludedCandidateKeys)) {
      continue;
    }
    materialized.push(candidate);
  }

  const groups = [];
  for (const candidate of materialized) {
    const classification = classifyEpubDocumentCandidate({
      title: candidate.title,
      href: candidate.href,
      id: candidate.id,
      html: candidate.rawHtml,
      sanitizedHtml: candidate.sanitizedHtml,
      source: candidate.source,
    });

    if (classification.kind === "discard") {
      discardedCounts.boilerplate += 1;
      continue;
    }
    if (classification.kind === "boilerplate_candidate") {
      discardedCounts.boilerplatePromoted += 1;
    }

    const stem = getNarrativeGroupStem(candidate);
    const previous = groups[groups.length - 1];
    if (stem) {
      if (previous?.stem === stem) {
        previous.parts.push({ candidate, classification });
        previous.hasReadable ||= classification.kind !== "discard";
        if (classification.kind === "main") {
          previous.hasMain = true;
        }
        if (classification.kind === "boilerplate_candidate") {
          previous.hasBoilerplateCandidate = true;
        }
        if (!previous.title && candidate.title) {
          previous.title = candidate.title;
        }
      } else {
        groups.push({
          stem,
          title: candidate.title,
          parts: [{ candidate, classification }],
          hasReadable: classification.kind !== "discard",
          hasMain: classification.kind === "main",
          hasBoilerplateCandidate: classification.kind === "boilerplate_candidate",
        });
      }
      continue;
    }

    if (
      classification.kind === "main" ||
      classification.kind === "extra" ||
      classification.kind === "boilerplate_candidate"
    ) {
      groups.push({
        stem: null,
        title: candidate.title,
        parts: [{ candidate, classification }],
        hasReadable: true,
        hasMain: classification.kind === "main",
        hasBoilerplateCandidate: classification.kind === "boilerplate_candidate",
      });
      continue;
    }

    discardedCounts.imageOnly += 1;
  }

  const { manifestByHref } = buildManifestIndexes(epub);
  const chapters = [];
  groups.forEach((group) => {
    if (!group.hasReadable) {
      group.parts.forEach((part) => {
        if (part.classification.kind === "discard") {
          discardedCounts.imageOnly += 1;
        }
      });
    }
  });

  for (const group of groups.filter((entry) => entry.hasReadable)) {
    const chapterParts = [];
    for (const part of group.parts) {
      const partReference = part.candidate;
      const prepared = await prepareNarrativeDocumentHtml({
        epub,
        rawHtml: partReference.rawHtml,
        documentHref: partReference.href,
        chapterTitle: group.title || partReference.title || "Capítulo",
        manifestByHref,
        imageContext,
        cssFallbackSeenKeys,
      });
      warnings.push(...prepared.warnings);
      const sanitizedHtml = prepared.html;
      if (sanitizedHtml) {
        chapterParts.push(sanitizedHtml);
      }
    }
    const sanitizedHtml = chapterParts.join("\n").trim();
    if (!sanitizedHtml) {
      continue;
    }
    const firstPart = group.parts[0]?.candidate;
    const primaryClassification = group.parts[0]?.classification || {};
    const entryKind = group.hasMain ? "main" : "extra";
    const entrySubtype =
      String(
        group.parts.find((part) => String(part?.classification?.subtype || "").trim())
          ?.classification?.subtype || "",
      ).trim() || (entryKind === "main" ? "chapter" : "extra");
    chapters.push({
      id: firstPart?.id,
      href: firstPart?.href,
      title: String(group.title || firstPart?.title || "").trim(),
      source: "flow",
      sanitizedHtml,
      readingOrder: Number(firstPart?.flowIndex) + 1,
      entryKind,
      entrySubtype,
      displayLabel:
        entryKind === "main"
          ? ""
          : resolveDisplayLabelForSubtype(
              entrySubtype,
              String(group.title || firstPart?.title || "").trim(),
            ),
      classification: primaryClassification,
    });
  }

  return chapters;
};

export const importProjectEpub = async ({
  buffer,
  project,
  targetVolume,
  defaultStatus = "draft",
  uploadsDir,
  loadUploads,
  writeUploads,
  uploadUserId,
}) => {
  const safeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (safeBuffer.length === 0) {
    throw new Error("empty_epub");
  }
  const epub = new EPub(safeBuffer);
  await epub.parse();

  const imageContext = createImageImportContext({
    uploadsDir,
    loadUploads,
    writeUploads,
    uploadUserId,
  });
  const normalizedDefaultStatus = normalizeImportStatus(defaultStatus);
  const existingEpisodes = buildExistingEpisodeMap(project);
  const existingExtraLookup = buildExistingExtraLookup(project, targetVolume);
  const fallbackReservedKeys = new Set(existingEpisodes.keys());
  const assignedImportKeys = new Set();
  const warnings = [];
  const cssFallbackSeenKeys = new Set();
  const chapters = [];
  const discardedCounts = {
    boilerplate: 0,
    boilerplatePromoted: 0,
    imageOnly: 0,
    unresolvedTocEntry: 0,
  };
  const volumeCoverImport = await importVolumeCoverFromEpub({
    epub,
    project,
    targetVolume,
    imageContext,
  });
  warnings.push(...(Array.isArray(volumeCoverImport?.warnings) ? volumeCoverImport.warnings : []));

  const { items: tocReferences, unresolvedCount } = resolveTocReferences(epub);
  discardedCounts.unresolvedTocEntry = unresolvedCount;

  const tocClassifiedCandidates = [];
  for (const item of tocReferences) {
    const candidate = await materializeCandidate(epub, item);
    const classification = classifyEpubDocumentCandidate({
      title: candidate.title,
      href: candidate.href,
      id: candidate.id,
      html: candidate.rawHtml,
      sanitizedHtml: candidate.sanitizedHtml,
      source: candidate.source,
    });
    tocClassifiedCandidates.push({
      ...candidate,
      classification,
    });
  }

  const tocFirstNarrativeFlowIndex = [...tocClassifiedCandidates]
    .filter(
      (item) =>
        String(item?.classification?.kind || "")
          .trim()
          .toLowerCase() === "main",
    )
    .map((item) => Number(item?.flowIndex))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)[0];
  let firstNarrativeFlowIndex = Number.isFinite(tocFirstNarrativeFlowIndex)
    ? tocFirstNarrativeFlowIndex
    : null;
  if (!Number.isFinite(firstNarrativeFlowIndex)) {
    firstNarrativeFlowIndex = await resolveFirstNarrativeFlowIndexFromFlow(epub);
  }

  const frontMatterBundle = await buildFrontMatterBundleFromFlow({
    epub,
    firstNarrativeFlowIndex,
    tocReferences: tocClassifiedCandidates,
    warnings,
    discardedCounts,
    imageContext,
    cssFallbackSeenKeys,
  });
  const consumedFrontMatterKeys =
    frontMatterBundle?.consumedKeys instanceof Set ? frontMatterBundle.consumedKeys : new Set();

  const tocStructuredCandidates = [];
  for (const candidate of tocClassifiedCandidates) {
    if (hasAnyCandidateKeyMatch(candidate, consumedFrontMatterKeys)) {
      continue;
    }
    const classification = candidate.classification || {};
    if (
      classification.kind === "main" ||
      classification.kind === "extra" ||
      classification.kind === "boilerplate_candidate"
    ) {
      tocStructuredCandidates.push(candidate);
      if (classification.kind === "boilerplate_candidate") {
        discardedCounts.boilerplatePromoted += 1;
      }
      continue;
    }
    if (classification.reason === "image_only_markup") {
      discardedCounts.imageOnly += 1;
      continue;
    }
    discardedCounts.boilerplate += 1;
  }

  const narrativeChapterCandidates =
    tocStructuredCandidates.length > 0
      ? await buildNarrativeChapterCandidatesFromToc({
          epub,
          tocStructuredCandidates,
          discardedCounts,
          warnings,
          imageContext,
          cssFallbackSeenKeys,
        })
      : await buildFallbackNarrativeChapterCandidates({
          epub,
          discardedCounts,
          warnings,
          imageContext,
          excludedCandidateKeys: consumedFrontMatterKeys,
          cssFallbackSeenKeys,
        });
  const orderedChapterCandidates = [
    ...(frontMatterBundle?.chapter ? [frontMatterBundle.chapter] : []),
    ...narrativeChapterCandidates,
  ].sort((left, right) => {
    const leftOrder = Number.isFinite(Number(left?.readingOrder))
      ? Number(left.readingOrder)
      : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isFinite(Number(right?.readingOrder))
      ? Number(right.readingOrder)
      : Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    const leftKind = String(left?.entryKind || "")
      .trim()
      .toLowerCase();
    const rightKind = String(right?.entryKind || "")
      .trim()
      .toLowerCase();
    if (leftKind === "extra" && rightKind !== "extra") {
      return -1;
    }
    if (rightKind === "extra" && leftKind !== "extra") {
      return 1;
    }
    return 0;
  });

  warnings.push(...buildDiscardWarnings(discardedCounts));

  for (const [chapterIndex, item] of orderedChapterCandidates.entries()) {
    const title = String(item?.title || epub.manifest?.[item.id]?.title || "").trim() || "Capítulo";
    const readingOrder = Number.isFinite(Number(item?.readingOrder))
      ? Number(item.readingOrder)
      : chapterIndex + 1;
    const entryKind =
      String(item?.entryKind || "")
        .trim()
        .toLowerCase() === "extra"
        ? "extra"
        : "main";
    const entrySubtype =
      String(item?.entrySubtype || "").trim() || (entryKind === "extra" ? "extra" : "chapter");
    const displayLabel =
      String(item?.displayLabel || "").trim() ||
      (entryKind === "extra" ? resolveDisplayLabelForSubtype(entrySubtype, title) : "");

    let chapterNumber = null;
    let extraMatchedExisting = null;
    if (entryKind === "extra") {
      const existingByOrder =
        Number.isFinite(readingOrder) && existingExtraLookup.byReadingOrder.has(readingOrder)
          ? existingExtraLookup.byReadingOrder.get(readingOrder)
          : null;
      const existingByTitle =
        existingByOrder || existingExtraLookup.byTitle.get(normalizeHintText(title)) || null;
      const resolvedExistingNumber = Number(existingByTitle?.number);
      const existingKey = buildEpisodeKey(resolvedExistingNumber, targetVolume);
      if (
        existingByTitle &&
        Number.isFinite(resolvedExistingNumber) &&
        resolvedExistingNumber >= EXTRA_TECHNICAL_NUMBER_BASE &&
        existingKey &&
        !assignedImportKeys.has(existingKey)
      ) {
        chapterNumber = resolvedExistingNumber;
        extraMatchedExisting = existingByTitle;
        assignedImportKeys.add(existingKey);
        fallbackReservedKeys.add(existingKey);
      } else {
        chapterNumber = resolveFallbackExtraTechnicalNumber(targetVolume, fallbackReservedKeys);
        assignedImportKeys.add(buildEpisodeKey(chapterNumber, targetVolume));
      }
    } else {
      chapterNumber = extractChapterNumber(title);
      if (chapterNumber !== null) {
        const explicitKey = buildEpisodeKey(chapterNumber, targetVolume);
        if (assignedImportKeys.has(explicitKey)) {
          warnings.push(
            `Capítulo "${title}" repetiu o número ${chapterNumber}; foi renumerado automaticamente.`,
          );
          chapterNumber = null;
        } else {
          assignedImportKeys.add(explicitKey);
          fallbackReservedKeys.add(explicitKey);
        }
      }
      if (chapterNumber === null) {
        chapterNumber = resolveFallbackNumber(targetVolume, fallbackReservedKeys);
        assignedImportKeys.add(buildEpisodeKey(chapterNumber, targetVolume));
      }
    }

    const episodeKey = buildEpisodeKey(chapterNumber, targetVolume);
    const existingEpisode = extraMatchedExisting || existingEpisodes.get(episodeKey) || null;
    const publicationStatus =
      existingEpisode && getEpisodePublicationStatus(existingEpisode) === "published"
        ? "published"
        : normalizedDefaultStatus;
    let content;
    try {
      content = htmlToLexicalJson(item.sanitizedHtml);
    } catch (error) {
      const message = `Falha ao converter o capítulo ${chapterIndex + 1} ("${title}"), item "${String(item?.id || "").trim() || "unknown"}": ${String(error?.message || error || "conversion_failed")}`;
      console.error("epub_import_conversion_failed", {
        chapterIndex: chapterIndex + 1,
        chapterTitle: title,
        manifestId: String(item?.id || "").trim() || null,
        message,
      });
      const chapterError = new Error(message);
      chapterError.code = "epub_chapter_conversion_failed";
      chapterError.chapterIndex = chapterIndex + 1;
      chapterError.chapterTitle = title;
      chapterError.manifestId = String(item?.id || "").trim() || null;
      chapterError.causeMessage = String(error?.message || error || "conversion_failed");
      throw chapterError;
    }

    chapters.push({
      number: chapterNumber,
      volume: Number.isFinite(Number(targetVolume)) ? Number(targetVolume) : undefined,
      title,
      entryKind,
      entrySubtype,
      readingOrder,
      displayLabel: entryKind === "extra" ? displayLabel : "",
      releaseDate: String(existingEpisode?.releaseDate || ""),
      duration: String(existingEpisode?.duration || ""),
      coverImageUrl: String(existingEpisode?.coverImageUrl || ""),
      coverImageAlt: String(existingEpisode?.coverImageAlt || ""),
      sourceType: String(existingEpisode?.sourceType || "Web"),
      sources: [],
      hash: existingEpisode?.hash,
      sizeBytes: existingEpisode?.sizeBytes,
      progressStage: existingEpisode?.progressStage,
      completedStages: Array.isArray(existingEpisode?.completedStages)
        ? existingEpisode.completedStages
        : [],
      content,
      contentFormat: "lexical",
      publicationStatus,
      chapterUpdatedAt: String(existingEpisode?.chapterUpdatedAt || ""),
      episodeKey,
      mergeMode: existingEpisode ? "update" : "create",
    });
  }

  const createdCount = chapters.filter((chapter) => chapter.mergeMode === "create").length;
  const updatedCount = chapters.length - createdCount;
  const mainImportedCount = chapters.filter((chapter) => chapter.entryKind !== "extra").length;
  const extrasImportedCount = chapters.length - mainImportedCount;

  await flushImageContextUploads(imageContext);

  return {
    summary: {
      chapters: chapters.length,
      mainImported: mainImportedCount,
      extrasImported: extrasImportedCount,
      created: createdCount,
      updated: updatedCount,
      volume: Number.isFinite(Number(targetVolume)) ? Number(targetVolume) : null,
      imagesImported: Number(imageContext?.imagesImported || 0),
      imageImportFailures: Number(imageContext?.imageImportFailures || 0),
      boilerplatePromoted: discardedCounts.boilerplatePromoted,
      boilerplateDiscarded: discardedCounts.boilerplate,
      unresolvedTocEntries: discardedCounts.unresolvedTocEntry,
      volumeCoverImported: volumeCoverImport?.summary?.volumeCoverImported === true,
      volumeCoverSkipped: volumeCoverImport?.summary?.volumeCoverSkipped === true,
    },
    warnings,
    metadata: {
      title: String(epub?.metadata?.title || "").trim(),
      author: String(epub?.metadata?.creator || "").trim(),
      language: String(epub?.metadata?.language || "").trim(),
    },
    volumeCovers: Array.isArray(volumeCoverImport?.volumeCovers)
      ? volumeCoverImport.volumeCovers
      : [],
    chapters,
  };
};
