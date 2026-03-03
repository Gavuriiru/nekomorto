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

const NARRATIVE_HINT_PATTERNS = [
  /\b(?:prologue|preface|epilogue|afterword|interlude)\b/i,
  /\bextra\b/i,
  /\bside[\s_-]*story\b/i,
  /(?:^|[\s/_-])(?:chapter|ch|cap(?:i|\u00ed)tulo)[\s#._-]*\d+/i,
  /(?:^|[\s/_-])(?:chapter|preface|prologue|epilogue|afterword|interlude|extra)\d+(?:$|[\s/_-])/i,
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
  const normalizedTargetHref = String(targetHref || "").trim().replace(/\\/g, "/");
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

const hasBoilerplateHint = (value) => BOILERPLATE_HINT_PATTERNS.some((pattern) => pattern.test(value));
const hasNarrativeHint = (value) => NARRATIVE_HINT_PATTERNS.some((pattern) => pattern.test(value));

const classifyEpubDocumentCandidate = ({ title, href, id, html, sanitizedHtml, source }) => {
  const hint = getDocumentHint({ title, href, id });
  const visibleTextLength = getVisibleTextLength(sanitizedHtml);

  if (hasBoilerplateHint(hint)) {
    return {
      kind: "boilerplate",
      reason: "boilerplate_hint",
      visibleTextLength,
    };
  }

  const hasImageMarkup = /<(?:img|svg|image)\b/i.test(String(html || ""));
  if (visibleTextLength === 0 && hasImageMarkup) {
    return {
      kind: "image_only",
      reason: "image_only_markup",
      visibleTextLength,
    };
  }

  if (hasNarrativeHint(hint)) {
    return {
      kind: "narrative",
      reason: "narrative_hint",
      visibleTextLength,
    };
  }

  if (visibleTextLength >= 30 && source === "toc") {
    return {
      kind: "narrative",
      reason: "toc_textual_content",
      visibleTextLength,
    };
  }

  if (visibleTextLength >= 30 && source === "flow") {
    return {
      kind: "narrative",
      reason: "flow_textual_content",
      visibleTextLength,
    };
  }

  return {
    kind: "unknown",
    reason: "not_narrative_enough",
    visibleTextLength,
  };
};

const extractChapterNumber = (title) => {
  const source = String(title || "").trim();
  if (!source) {
    return null;
  }
  const patterns = [
    /(?:cap(?:i|\u00ed)tulo|chapter|ch)\s*#?\s*(\d+)/i,
    /\b(\d+)\b/,
  ];
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

const normalizeImportStatus = (value) =>
  String(value || "").trim().toLowerCase() === "published" ? "published" : "draft";

const buildExistingEpisodeMap = (project) =>
  new Map(
    (Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : []).map((episode) => [
      buildEpisodeKey(episode?.number, episode?.volume),
      episode,
    ]),
  );

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
  const target = String(property || "").trim().toLowerCase();
  if (!target) {
    return false;
  }
  const rawProperties = item?.properties;
  if (Array.isArray(rawProperties)) {
    return rawProperties.some((entry) => String(entry || "").trim().toLowerCase() === target);
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
    .map((item) => ({
      id: String(item?.id || "").trim(),
      href: normalizeEpubHref(item?.href),
      title: String(item?.title || "").trim(),
      source: "flow",
    }))
    .filter((item) => item.id);
};

const getNarrativeGroupStem = (item) => {
  const basename = normalizeHintText(getPathBasename(item?.href || item?.id).replace(/\.[^.]+$/, ""));
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

const buildDiscardWarnings = ({ boilerplate, imageOnly, unresolvedTocEntry }) => {
  const warnings = [];
  if (boilerplate > 0) {
    warnings.push(`Itens de boilerplate ignorados: ${boilerplate}.`);
  }
  if (imageOnly > 0) {
    warnings.push(`Paginas somente com imagem ignoradas: ${imageOnly}.`);
  }
  if (unresolvedTocEntry > 0) {
    warnings.push(`Entradas do TOC nao resolvidas: ${unresolvedTocEntry}.`);
  }
  return warnings;
};

const materializeCandidate = async (epub, item) => {
  const rawHtml = await epub.getChapterRaw(item.id);
  const sanitizedHtml = sanitizeChapterHtml(rawHtml);
  return {
    ...item,
    rawHtml,
    sanitizedHtml,
    title: String(item?.title || epub.manifest?.[item.id]?.title || "").trim(),
  };
};

const getManifestMediaType = (item) =>
  String(item?.["media-type"] || item?.mediaType || item?.media_type || "").trim().toLowerCase();

const isImageManifestItem = (item) => getManifestMediaType(item).startsWith("image/");

const loadManifestBinary = async (epub, manifestItem) => {
  const id = String(manifestItem?.id || "").trim();
  if (!id) {
    return Buffer.from([]);
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
      return payload;
    }
  }

  if (typeof epub.getFile === "function") {
    const fileBuffer = await epub.getFile(id);
    const payload = extractBinaryPayload(fileBuffer);
    if (payload.length > 0) {
      return payload;
    }
  }

  return Buffer.from([]);
};

const buildStyleDeclaration = (entries) =>
  entries
    .map(([property, value]) => [String(property || "").trim().toLowerCase(), String(value || "").trim()])
    .filter(([property, value]) => property && value)
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");

const isMeaningfulStyleValue = (value) =>
  !ZERO_LIKE_STYLE_VALUES.has(String(value || "").trim().toLowerCase());

const normalizeFontFamilyBucket = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
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
  const match = String(value || "").trim().match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const computeFontSizeRatio = (value, baseFontSize) => {
  const normalized = String(value || "").trim().toLowerCase();
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

  const hint = [element?.className, element?.id]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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
  return String(parent.textContent || "").replace(/\s+/g, "").trim() === "";
};

const extractEditorialImageAlignment = (element, computed, wrapperComputed) => {
  const marginLeft = String(computed?.marginLeft || "").trim().toLowerCase();
  const marginRight = String(computed?.marginRight || "").trim().toLowerCase();
  if (marginLeft === "auto" && marginRight === "auto") {
    return "center";
  }
  if (marginLeft === "auto") {
    return "right";
  }
  if (marginRight === "auto") {
    return "left";
  }

  const display = String(computed?.display || "").trim().toLowerCase();
  const wrapperTextAlign = String(wrapperComputed?.textAlign || "").trim().toLowerCase();
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

const loadEpubDocumentStylesheets = async ({ epub, documentHref, manifestByHref, rawHtml } = {}) => {
  const sourceDom = new JSDOM(String(rawHtml || ""));
  const stylesheets = [];
  try {
    const inlineStyles = [...sourceDom.window.document.querySelectorAll("style")]
      .map((element) => String(element.textContent || "").trim())
      .filter(Boolean);
    stylesheets.push(...inlineStyles);

    const stylesheetHrefs = [...sourceDom.window.document.querySelectorAll('link[rel~="stylesheet"][href]')]
      .map((element) => String(element.getAttribute("href") || "").trim())
      .filter(Boolean);

    for (const stylesheetHref of stylesheetHrefs) {
      const resolvedHref = normalizeEpubAssetHref(stylesheetHref, documentHref);
      const manifestItem = resolvedHref ? manifestByHref.get(resolvedHref) || null : null;
      if (!manifestItem) {
        continue;
      }
      const stylesheetBuffer = await loadManifestBinary(epub, manifestItem);
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
    const styleTag = stylesheets && stylesheets.length > 0 ? `<style>${stylesheets.join("\n")}</style>` : "";
    return new JSDOM(`<!doctype html><html><head>${styleTag}</head><body>${bodyHtml}</body></html>`);
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
        ["left", "right", "center", "justify"].includes(String(computed.textAlign || "").toLowerCase())
          ? computed.textAlign.toLowerCase()
          : "",
      ],
      ["text-indent", isMeaningfulStyleValue(computed.textIndent) ? computed.textIndent : ""],
      ["margin-top", isMeaningfulStyleValue(computed.marginTop) ? computed.marginTop : ""],
      ["margin-bottom", isMeaningfulStyleValue(computed.marginBottom) ? computed.marginBottom : ""],
      ["line-height", isMeaningfulStyleValue(computed.lineHeight) ? computed.lineHeight : ""],
      [
        "font-family",
        isMeaningfulStyleValue(computed.fontFamily) ? normalizeFontFamilyBucket(computed.fontFamily) : "",
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
    const parentComputed = element.parentElement ? computeElementStyles(element.parentElement) : null;
    const computedFontFamily = normalizeFontFamilyBucket(computed.fontFamily);
    const parentFontFamily = parentComputed ? normalizeFontFamilyBucket(parentComputed.fontFamily) : "";
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
        ["bold", "500", "600", "700", "800", "900"].includes(String(computed.fontWeight || "").toLowerCase())
          ? computed.fontWeight.toLowerCase()
          : "",
      ],
      ["font-family", computedFontFamily && computedFontFamily !== parentFontFamily ? computedFontFamily : ""],
    ]);
    applyInlineStyle(element, styleText);
  }

  const images = [...document.querySelectorAll("img")];
  for (const element of images) {
    const computed = computeElementStyles(element);
    const parentComputed = element.parentElement ? computeElementStyles(element.parentElement) : null;
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
          : ["inline", "block", "inline-block"].includes(String(computed.display || "").toLowerCase())
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
    const nonWhitespaceText = String(wrapper.textContent || "").replace(/\s+/g, "").trim();
    const onlyImages = elementChildren.length > 0 && elementChildren.every((child) => child.tagName === "IMG");

    if (nonWhitespaceText === "" && onlyImages) {
      const wrapperComputed = document.defaultView.getComputedStyle(wrapper);
      elementChildren.forEach((imageElement) => {
        const imageComputed = document.defaultView.getComputedStyle(imageElement);
        const resolvedAlign = extractEditorialImageAlignment(imageElement, imageComputed, wrapperComputed);
        const styleText = buildStyleDeclaration([
          ["width", isMeaningfulStyleValue(imageComputed.width) ? imageComputed.width : ""],
          ["height", isMeaningfulStyleValue(imageComputed.height) ? imageComputed.height : ""],
          ["max-width", isMeaningfulStyleValue(imageComputed.maxWidth) ? imageComputed.maxWidth : ""],
          [
            "display",
            resolvedAlign || imageComputed.display === "block"
              ? "block"
              : imageComputed.display,
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
          ["margin-top", isMeaningfulStyleValue(imageComputed.marginTop) ? imageComputed.marginTop : ""],
          ["margin-bottom", isMeaningfulStyleValue(imageComputed.marginBottom) ? imageComputed.marginBottom : ""],
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
      warnings.push(`Imagem interna ignorada no capitulo "${chapterTitle}": ${currentSrc}.`);
      if (imageContext) {
        imageContext.imageImportFailures += 1;
      }
      imageElement.remove();
      continue;
    }

    if (!imageContext) {
      warnings.push(`Imagem interna ignorada no capitulo "${chapterTitle}": ${currentSrc}.`);
      imageElement.remove();
      continue;
    }

    try {
      const imageBuffer = await loadManifestBinary(epub, manifestItem);
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
      imageElement.setAttribute("src", result.uploadEntry.url);
      if (!imageElement.getAttribute("alt") && result.uploadEntry.altText) {
        imageElement.setAttribute("alt", result.uploadEntry.altText);
      }
    } catch {
      imageContext.imageImportFailures += 1;
      warnings.push(`Imagem interna ignorada no capitulo "${chapterTitle}": ${currentSrc}.`);
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
} = {}) => {
  const stylesheets = await loadEpubDocumentStylesheets({
    epub,
    documentHref,
    manifestByHref,
    rawHtml,
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
    inlineEditorialComputedStyles(dom.window.document);
    normalizeEditorialWrappers(dom.window.document);
    return {
      html: sanitizeChapterHtml(dom.window.document.body.innerHTML),
      warnings,
    };
  } finally {
    dom.window.close();
  }
};

const createImageImportContext = ({
  uploadsDir,
  loadUploads,
  writeUploads,
  uploadUserId,
} = {}) => {
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

const importVolumeCoverFromEpub = async ({
  epub,
  project,
  targetVolume,
  imageContext,
} = {}) => {
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
    warnings.push("Nao foi possivel localizar a capa do volume no EPUB.");
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
    warnings.push("Nao foi possivel importar a capa do volume do EPUB.");
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
    const imageBuffer = await loadManifestBinary(epub, coverAsset.manifestItem);
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
      filename: getPathBasename(coverAsset.manifestItem?.href || coverAsset.manifestItem?.id) || "epub-cover",
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
    warnings.push("Nao foi possivel importar a capa do volume do EPUB.");
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
  tocNarrativeCandidates,
  discardedCounts,
  warnings,
  imageContext,
} = {}) => {
  const { flowItems } = buildFlowIndexes(epub);
  const { manifestByHref } = buildManifestIndexes(epub);
  const sortedNarrativeCandidates = [...tocNarrativeCandidates]
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
      if (shouldDiscardRangePartAsBoilerplate(partReference)) {
        discardedCounts.boilerplate += 1;
        continue;
      }

      const rawHtml = await epub.getChapterRaw(partReference.id);
      const prepared = await prepareNarrativeDocumentHtml({
        epub,
        rawHtml,
        documentHref: partReference.href,
        chapterTitle: item.title,
        manifestByHref,
        imageContext,
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
    });
  }

  return chapters;
};

const buildFallbackNarrativeChapterCandidates = async ({
  epub,
  discardedCounts,
  warnings,
  imageContext,
} = {}) => {
  const flowReferences = buildFallbackFlowReferences(epub);
  const materialized = [];
  for (const item of flowReferences) {
    materialized.push(await materializeCandidate(epub, item));
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

    if (classification.kind === "boilerplate") {
      discardedCounts.boilerplate += 1;
      continue;
    }

    const stem = getNarrativeGroupStem(candidate);
    const previous = groups[groups.length - 1];
    if (stem) {
      if (previous?.stem === stem) {
        previous.parts.push({ candidate, classification });
        previous.hasNarrative ||= classification.kind === "narrative";
        if (!previous.title && candidate.title) {
          previous.title = candidate.title;
        }
      } else {
        groups.push({
          stem,
          title: candidate.title,
          parts: [{ candidate, classification }],
          hasNarrative: classification.kind === "narrative",
        });
      }
      continue;
    }

    if (classification.kind === "narrative") {
      groups.push({
        stem: null,
        title: candidate.title,
        parts: [{ candidate, classification }],
        hasNarrative: true,
      });
      continue;
    }

    if (classification.kind === "image_only") {
      discardedCounts.imageOnly += 1;
    }
  }

  const { manifestByHref } = buildManifestIndexes(epub);
  const chapters = [];
  groups.forEach((group) => {
    if (!group.hasNarrative) {
      group.parts.forEach((part) => {
        if (part.classification.kind === "image_only") {
          discardedCounts.imageOnly += 1;
        }
      });
    }
  });

  for (const group of groups.filter((entry) => entry.hasNarrative)) {
    const chapterParts = [];
    for (const part of group.parts) {
      const partReference = part.candidate;
      const prepared = await prepareNarrativeDocumentHtml({
        epub,
        rawHtml: partReference.rawHtml,
        documentHref: partReference.href,
        chapterTitle: group.title || partReference.title || "Capitulo",
        manifestByHref,
        imageContext,
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
    chapters.push({
      id: firstPart?.id,
      href: firstPart?.href,
      title: String(group.title || firstPart?.title || "").trim(),
      source: "flow",
      sanitizedHtml,
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
  const fallbackReservedKeys = new Set(existingEpisodes.keys());
  const assignedImportKeys = new Set();
  const warnings = [];
  const chapters = [];
  const discardedCounts = {
    boilerplate: 0,
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

  const tocNarrativeCandidates = [];
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
    if (classification.kind === "narrative") {
      tocNarrativeCandidates.push(candidate);
      continue;
    }
    if (classification.kind === "boilerplate") {
      discardedCounts.boilerplate += 1;
      continue;
    }
    if (classification.kind === "image_only") {
      discardedCounts.imageOnly += 1;
    }
  }

  const orderedChapterCandidates =
    tocNarrativeCandidates.length > 0
      ? await buildNarrativeChapterCandidatesFromToc({
          epub,
          tocNarrativeCandidates,
          discardedCounts,
          warnings,
          imageContext,
        })
      : await buildFallbackNarrativeChapterCandidates({
          epub,
          discardedCounts,
          warnings,
          imageContext,
        });

  warnings.push(...buildDiscardWarnings(discardedCounts));

  for (const [chapterIndex, item] of orderedChapterCandidates.entries()) {
    const title = String(item?.title || epub.manifest?.[item.id]?.title || "").trim() || "Capitulo";
    let chapterNumber = extractChapterNumber(title);
    if (chapterNumber !== null) {
      const explicitKey = buildEpisodeKey(chapterNumber, targetVolume);
      if (assignedImportKeys.has(explicitKey)) {
        warnings.push(
          `Capitulo "${title}" repetiu o numero ${chapterNumber}; foi renumerado automaticamente.`,
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
    const episodeKey = buildEpisodeKey(chapterNumber, targetVolume);
    const existingEpisode = existingEpisodes.get(episodeKey) || null;
    const publicationStatus =
      existingEpisode && getEpisodePublicationStatus(existingEpisode) === "published"
        ? "published"
        : normalizedDefaultStatus;
    let content;
    try {
      content = htmlToLexicalJson(item.sanitizedHtml);
    } catch (error) {
      const message = `Falha ao converter o capitulo ${chapterIndex + 1} ("${title}"), item "${String(item?.id || "").trim() || "unknown"}": ${String(error?.message || error || "conversion_failed")}`;
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

  await flushImageContextUploads(imageContext);

  return {
    summary: {
      chapters: chapters.length,
      created: createdCount,
      updated: updatedCount,
      volume: Number.isFinite(Number(targetVolume)) ? Number(targetVolume) : null,
      imagesImported: Number(imageContext?.imagesImported || 0),
      imageImportFailures: Number(imageContext?.imageImportFailures || 0),
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
    volumeCovers: Array.isArray(volumeCoverImport?.volumeCovers) ? volumeCoverImport.volumeCovers : [],
    chapters,
  };
};
