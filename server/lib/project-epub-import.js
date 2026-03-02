import crypto from "crypto";
import path from "path";
import { JSDOM } from "jsdom";
import EPub from "epub";
import sanitizeHtml from "sanitize-html";
import { buildEpisodeKey, getEpisodePublicationStatus } from "./project-episodes.js";
import { htmlToLexicalJson } from "./lexical-html.js";
import { buildEpubImportTempFolder, storeUploadImageBuffer } from "./uploads-import.js";

const IMPORT_ALLOWED_TAGS = [
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

const IMPORT_ALLOWED_ATTRIBUTES = {
  a: ["href", "title", "target", "rel"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  span: ["style"],
  p: ["style"],
  img: ["src", "alt", "width", "height"],
};

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
    "*": {
      "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
    },
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
    imagesImported: 0,
    imageImportFailures: 0,
  };
};

const shouldDiscardRangePartAsBoilerplate = (item) => {
  const hint = getDocumentHint(item);
  return RANGE_INTRUDER_HINT_PATTERNS.some((pattern) => pattern.test(hint));
};

const rewriteInternalImagesInHtml = async ({
  epub,
  html,
  documentHref,
  chapterTitle,
  manifestByHref,
  imageContext,
} = {}) => {
  const rawHtml = String(html || "");
  if (!rawHtml || !/<img\b/i.test(rawHtml)) {
    return {
      html: rawHtml,
      warnings: [],
    };
  }

  const warnings = [];
  const dom = new JSDOM(`<body>${rawHtml}</body>`);
  try {
    const images = [...dom.window.document.querySelectorAll("img")];
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
        warnings.push(
          `Imagem interna ignorada no capitulo "${chapterTitle}": ${currentSrc}.`,
        );
        if (imageContext) {
          imageContext.imageImportFailures += 1;
        }
        imageElement.remove();
        continue;
      }

      if (!imageContext) {
        warnings.push(
          `Imagem interna ignorada no capitulo "${chapterTitle}": ${currentSrc}.`,
        );
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
        imageContext.writeUploads(imageContext.uploads);
        imageContext.imagesImported += 1;
        imageElement.setAttribute("src", result.uploadEntry.url);
        if (!imageElement.getAttribute("alt") && result.uploadEntry.altText) {
          imageElement.setAttribute("alt", result.uploadEntry.altText);
        }
      } catch (error) {
        imageContext.imageImportFailures += 1;
        warnings.push(
          `Imagem interna ignorada no capitulo "${chapterTitle}": ${currentSrc}.`,
        );
        imageElement.remove();
      }
    }

    return {
      html: dom.window.document.body.innerHTML,
      warnings,
    };
  } finally {
    dom.window.close();
  }
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
      const rewritten = await rewriteInternalImagesInHtml({
        epub,
        html: rawHtml,
        documentHref: partReference.href,
        chapterTitle: item.title,
        manifestByHref,
        imageContext,
      });
      warnings.push(...rewritten.warnings);
      const sanitizedHtml = sanitizeChapterHtml(rewritten.html);
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
      const rewritten = await rewriteInternalImagesInHtml({
        epub,
        html: partReference.rawHtml,
        documentHref: partReference.href,
        chapterTitle: group.title || partReference.title || "Capitulo",
        manifestByHref,
        imageContext,
      });
      warnings.push(...rewritten.warnings);
      const sanitizedHtml = sanitizeChapterHtml(rewritten.html);
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
    },
    warnings,
    metadata: {
      title: String(epub?.metadata?.title || "").trim(),
      author: String(epub?.metadata?.creator || "").trim(),
      language: String(epub?.metadata?.language || "").trim(),
    },
    chapters,
  };
};
