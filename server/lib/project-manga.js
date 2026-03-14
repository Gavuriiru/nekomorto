import fs from "fs";
import path from "path";
import { zipSync, unzipSync } from "fflate";
import { buildEpisodeKey } from "./project-episodes.js";
import { resolveProjectImageFolders } from "./project-image-localizer.js";
import { resolveUploadAbsolutePath } from "./upload-media.js";
import { storeUploadImageBuffer } from "./uploads-import.js";

export const PROJECT_IMAGE_EXPORT_FORMATS = Object.freeze(["zip", "cbz"]);

const NATURAL_COLLATOR = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});

const MIME_BY_EXTENSION = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
});

const IGNORED_IMPORT_BASENAMES = new Set([
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
]);

const IGNORED_IMPORT_SEGMENTS = new Set(["__macosx"]);

const toPosix = (value) => String(value || "").replace(/\\/g, "/");

const normalizeText = (value) => String(value || "").trim();

const compareNatural = (left, right) =>
  NATURAL_COLLATOR.compare(String(left || ""), String(right || ""));

const normalizeRelativeImportPath = (value) =>
  toPosix(String(value || ""))
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .trim();

const sanitizeSlug = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const sanitizeArchiveSegment = (value, fallback) => {
  const normalized = String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  return normalized || fallback;
};

const getFileExtension = (value) => path.extname(String(value || "")).toLowerCase();

const basenameWithoutExt = (value) => path.basename(String(value || ""), getFileExtension(value));

const isSupportedImagePath = (value) => Object.prototype.hasOwnProperty.call(MIME_BY_EXTENSION, getFileExtension(value));

const isIgnoredImportPath = (value) => {
  const normalized = normalizeRelativeImportPath(value);
  if (!normalized) {
    return true;
  }
  const baseName = path.posix.basename(normalized).toLowerCase();
  if (
    IGNORED_IMPORT_BASENAMES.has(baseName) ||
    baseName.startsWith("._") ||
    baseName.startsWith(".")
  ) {
    return true;
  }
  const segments = normalized
    .split("/")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
  return segments.some((segment) => IGNORED_IMPORT_SEGMENTS.has(segment));
};

const resolveMimeFromPath = (value, fallbackMime) => {
  const normalizedFallback = normalizeText(fallbackMime).toLowerCase();
  if (normalizedFallback) {
    return normalizedFallback === "image/jpg" ? "image/jpeg" : normalizedFallback;
  }
  return MIME_BY_EXTENSION[getFileExtension(value)] || "image/jpeg";
};

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
};

const normalizeVolumeValue = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.floor(parsed);
};

const stripCommonPrefix = (value, pattern) =>
  String(value || "")
    .replace(pattern, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseVolumeNumber = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  const explicitMatch = normalized.match(
    /\b(?:vol(?:ume)?|tomo|book|livro)\s*[-_ ]*(\d+)\b/i,
  );
  if (explicitMatch?.[1]) {
    return parsePositiveInteger(explicitMatch[1]);
  }
  const genericMatch = normalized.match(/(\d+)/);
  return genericMatch?.[1] ? parsePositiveInteger(genericMatch[1]) : null;
};

const parseChapterNumber = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  const explicitMatch = normalized.match(
    /\b(?:cap(?:itulo|ítulo)?|chapter|chap|ch|episode|episodio|episódio|ep)\s*[-_ ]*(\d+)\b/i,
  );
  if (explicitMatch?.[1]) {
    return parsePositiveInteger(explicitMatch[1]);
  }
  const genericMatch = normalized.match(/(\d+)/);
  return genericMatch?.[1] ? parsePositiveInteger(genericMatch[1]) : null;
};

const detectChapterTitle = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }
  const withoutPrefix = stripCommonPrefix(
    normalized,
    /^\s*(?:cap(?:itulo|ítulo)?|chapter|chap|ch|episode|episodio|episódio|ep)\s*[-_ ]*\d+\s*[-_:]?\s*/i,
  );
  const withoutLeadingNumber = stripCommonPrefix(withoutPrefix, /^\s*\d+\s*[-_:]?\s*/);
  return withoutLeadingNumber;
};

const buildImageEntryListFromFiles = (files, manifestEntries = []) => {
  const manifestByIndex = new Map(
    (Array.isArray(manifestEntries) ? manifestEntries : []).map((entry, index) => [index, entry]),
  );
  return (Array.isArray(files) ? files : [])
    .map((file, index) => {
      const manifestEntry = manifestByIndex.get(index);
      const declaredRelativePath =
        typeof manifestEntry?.relativePath === "string" ? manifestEntry.relativePath : "";
      const relativePath =
        normalizeRelativeImportPath(
          declaredRelativePath ||
            file?.originalname ||
            file?.relativePath ||
            file?.path ||
            file?.name,
        ) ||
        normalizeRelativeImportPath(file?.originalname || file?.name);
      return {
        name: normalizeText(file?.originalname || file?.name) || path.posix.basename(relativePath),
        relativePath,
        buffer: Buffer.isBuffer(file?.buffer)
          ? file.buffer
          : Buffer.from(file?.buffer || []),
        mime: resolveMimeFromPath(relativePath, file?.mimetype),
      };
    })
    .filter((entry) => entry.buffer.length > 0)
    .filter((entry) => !isIgnoredImportPath(entry.relativePath))
    .filter((entry) => isSupportedImagePath(entry.relativePath))
    .sort((left, right) => compareNatural(left.relativePath, right.relativePath));
};

const buildImageEntryListFromArchive = (buffer, archiveName = "arquivo.zip") => {
  const extracted = unzipSync(new Uint8Array(Buffer.from(buffer || [])));
  return Object.entries(extracted)
    .map(([relativePath, data]) => ({
      name: path.posix.basename(relativePath),
      relativePath: normalizeRelativeImportPath(relativePath),
      buffer: Buffer.from(data),
      mime: resolveMimeFromPath(relativePath, ""),
      sourceArchive: normalizeText(archiveName) || "arquivo.zip",
    }))
    .filter((entry) => entry.buffer.length > 0)
    .filter((entry) => !isIgnoredImportPath(entry.relativePath))
    .filter((entry) => isSupportedImagePath(entry.relativePath))
    .sort((left, right) => compareNatural(left.relativePath, right.relativePath));
};

const resolveImportEntries = ({
  files,
  manifestEntries,
  archiveBuffer,
  archiveName,
} = {}) => {
  if (Buffer.isBuffer(archiveBuffer) && archiveBuffer.length > 0) {
    return buildImageEntryListFromArchive(archiveBuffer, archiveName);
  }
  return buildImageEntryListFromFiles(files, manifestEntries);
};

const detectImportLayout = (entries) => {
  const hasRootFiles = entries.some((entry) => entry.relativePath.split("/").filter(Boolean).length === 1);
  if (hasRootFiles) {
    return "single";
  }
  const hasSecondLevel = entries.some(
    (entry) => entry.relativePath.split("/").filter(Boolean).length >= 3,
  );
  return hasSecondLevel ? "volumes" : "chapters";
};

const groupImportEntries = ({
  entries,
  archiveName,
  targetVolume,
  targetChapterNumber,
} = {}) => {
  const layout = detectImportLayout(entries);
  if (layout === "single") {
    return [
      {
        sourceLabel:
          sanitizeArchiveSegment(
            basenameWithoutExt(archiveName || entries[0]?.name || "capitulo"),
            "Capitulo",
          ) || "Capitulo",
        volumeHint: normalizeVolumeValue(targetVolume),
        chapterHint: parsePositiveInteger(targetChapterNumber),
        titleHint: "",
        files: entries,
        layout,
      },
    ];
  }

  const groups = new Map();
  entries.forEach((entry) => {
    const segments = entry.relativePath.split("/").filter(Boolean);
    const volumeLabel = layout === "volumes" ? segments[0] || "" : "";
    const chapterLabel = layout === "volumes" ? segments[1] || "" : segments[0] || "";
    const groupKey =
      layout === "volumes"
        ? `${normalizeText(volumeLabel)}\u0001${normalizeText(chapterLabel)}`
        : normalizeText(chapterLabel);
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        sourceLabel: chapterLabel,
        volumeLabel,
        volumeHint:
          layout === "volumes" ? parseVolumeNumber(volumeLabel) : normalizeVolumeValue(targetVolume),
        chapterHint: parseChapterNumber(chapterLabel),
        titleHint: detectChapterTitle(chapterLabel),
        files: [],
        layout,
      });
    }
    groups.get(groupKey).files.push(entry);
  });

  return [...groups.values()].sort((left, right) => {
    const leftVolume = left.volumeHint ?? 0;
    const rightVolume = right.volumeHint ?? 0;
    if (leftVolume !== rightVolume) {
      return leftVolume - rightVolume;
    }
    if (left.chapterHint && right.chapterHint && left.chapterHint !== right.chapterHint) {
      return left.chapterHint - right.chapterHint;
    }
    if (left.chapterHint && !right.chapterHint) {
      return -1;
    }
    if (!left.chapterHint && right.chapterHint) {
      return 1;
    }
    return compareNatural(left.sourceLabel, right.sourceLabel);
  });
};

const buildExistingChapterLookup = (project) => {
  const lookup = new Map();
  (Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : []).forEach((episode) => {
    lookup.set(buildEpisodeKey(episode.number, episode.volume), episode);
  });
  return lookup;
};

const buildNextChapterNumberByVolume = (project) => {
  const nextByVolume = new Map();
  (Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : []).forEach((episode) => {
    const volumeKey = Number.isFinite(Number(episode?.volume)) ? String(Number(episode.volume)) : "none";
    const current = nextByVolume.get(volumeKey) || 1;
    const number = parsePositiveInteger(episode?.number) || 0;
    if (number >= current) {
      nextByVolume.set(volumeKey, number + 1);
    }
  });
  return nextByVolume;
};

const resolveSequentialChapterNumber = (volumeKey, nextByVolume) => {
  const current = parsePositiveInteger(nextByVolume.get(volumeKey)) || 1;
  nextByVolume.set(volumeKey, current + 1);
  return current;
};

const normalizeImportPreviewItems = ({
  groupedEntries,
  project,
  targetVolume,
  targetChapterNumber,
} = {}) => {
  const existingByKey = buildExistingChapterLookup(project);
  const nextByVolume = buildNextChapterNumberByVolume(project);
  const seenKeys = new Set();
  const warnings = [];

  const items = groupedEntries.map((group, index) => {
    const volume = normalizeVolumeValue(group.volumeHint ?? targetVolume);
    const volumeKey = volume === undefined ? "none" : String(volume);
    const warningsForItem = [];
    const chapterNumber =
      parsePositiveInteger(group.chapterHint ?? targetChapterNumber) ||
      resolveSequentialChapterNumber(volumeKey, nextByVolume);
    if (!parsePositiveInteger(group.chapterHint ?? targetChapterNumber)) {
      warningsForItem.push("numero_detectado_automaticamente");
    }
    if (group.layout === "single" && volume === undefined) {
      warningsForItem.push("volume_nao_informado");
    }
    const key = buildEpisodeKey(chapterNumber, volume);
    let action = existingByKey.has(key) ? "update" : "create";
    if (seenKeys.has(key)) {
      action = "ignore";
      warningsForItem.push("chave_duplicada_no_lote");
    }
    seenKeys.add(key);
    warnings.push(...warningsForItem.map((warning) => `${key}:${warning}`));
    return {
      key,
      order: index + 1,
      number: chapterNumber,
      volume: volume ?? null,
      titleDetected: group.titleHint || "",
      sourceLabel: group.sourceLabel || "",
      pageCount: group.files.length,
      action,
      warnings: warningsForItem,
      files: group.files,
    };
  });

  return {
    items,
    warnings,
  };
};

const buildPreviewSummary = (items, warnings) => {
  const summary = {
    chapters: items.filter((item) => item.action !== "ignore").length,
    pages: items.reduce((total, item) => total + Number(item.pageCount || 0), 0),
    created: items.filter((item) => item.action === "create").length,
    updated: items.filter((item) => item.action === "update").length,
    ignored: items.filter((item) => item.action === "ignore").length,
    warnings: warnings.length,
  };
  return summary;
};

const buildImportPreviewPayload = (previewItems, warnings) => ({
  items: previewItems.map((item) => ({
    key: item.key,
    order: item.order,
    number: item.number,
    volume: item.volume,
    titleDetected: item.titleDetected,
    sourceLabel: item.sourceLabel,
    pageCount: item.pageCount,
    action: item.action,
    warnings: item.warnings,
  })),
  warnings,
  summary: buildPreviewSummary(previewItems, warnings),
});

const buildImportedChapterPayload = ({
  project,
  previewItem,
  pages,
  defaultStatus = "draft",
} = {}) => {
  const existingByKey = buildExistingChapterLookup(project);
  const existingChapter = existingByKey.get(previewItem.key);
  const coverImageUrl = pages[0]?.imageUrl || "";
  return {
    ...(existingChapter || {}),
    number: previewItem.number,
    volume: previewItem.volume ?? undefined,
    title: previewItem.titleDetected || String(existingChapter?.title || "").trim(),
    synopsis: String(existingChapter?.synopsis || "").trim(),
    entryKind: existingChapter?.entryKind === "extra" ? "extra" : "main",
    entrySubtype: String(existingChapter?.entrySubtype || "").trim() || undefined,
    readingOrder: Number.isFinite(Number(existingChapter?.readingOrder))
      ? Number(existingChapter.readingOrder)
      : undefined,
    displayLabel:
      existingChapter?.entryKind === "extra"
        ? String(existingChapter?.displayLabel || "").trim() || undefined
        : undefined,
    releaseDate: String(existingChapter?.releaseDate || "").trim(),
    duration: String(existingChapter?.duration || "").trim(),
    sourceType:
      existingChapter?.sourceType === "Web" || existingChapter?.sourceType === "Blu-ray"
        ? existingChapter.sourceType
        : "Web",
    sources: Array.isArray(existingChapter?.sources)
      ? existingChapter.sources
      : [],
    completedStages: Array.isArray(existingChapter?.completedStages)
      ? existingChapter.completedStages
      : [],
    progressStage: normalizeText(existingChapter?.progressStage) || undefined,
    content: "",
    contentFormat: "images",
    pages,
    pageCount: pages.length,
    hasPages: pages.length > 0,
    coverImageUrl: String(existingChapter?.coverImageUrl || "").trim() || coverImageUrl,
    coverImageAlt:
      String(existingChapter?.coverImageAlt || "").trim() ||
      (coverImageUrl ? `Capa do capitulo ${previewItem.number}` : ""),
    publicationStatus:
      existingChapter?.publicationStatus === "published"
        ? "published"
        : defaultStatus === "published"
          ? "published"
          : "draft",
  };
};

const resolvePageExactFileName = (pageIndex, originalPath) => {
  const ext = getFileExtension(originalPath);
  const normalizedExt = Object.prototype.hasOwnProperty.call(MIME_BY_EXTENSION, ext) ? ext : ".jpg";
  return `${String(pageIndex + 1).padStart(3, "0")}${normalizedExt}`;
};

export const previewProjectImageImport = ({
  project,
  files,
  manifestEntries,
  archiveBuffer,
  archiveName,
  targetVolume,
  targetChapterNumber,
} = {}) => {
  const entries = resolveImportEntries({
    files,
    manifestEntries,
    archiveBuffer,
    archiveName,
  });
  if (!entries.length) {
    const error = new Error("no_supported_images");
    error.code = "no_supported_images";
    throw error;
  }
  const groupedEntries = groupImportEntries({
    entries,
    archiveName,
    targetVolume,
    targetChapterNumber,
  });
  const normalizedPreview = normalizeImportPreviewItems({
    groupedEntries,
    project,
    targetVolume,
    targetChapterNumber,
  });
  return buildImportPreviewPayload(normalizedPreview.items, normalizedPreview.warnings);
};

export const importProjectImageChapters = async ({
  project,
  files,
  manifestEntries,
  archiveBuffer,
  archiveName,
  targetVolume,
  targetChapterNumber,
  defaultStatus = "draft",
  uploadsDir,
  loadUploads,
  writeUploads,
} = {}) => {
  const entries = resolveImportEntries({
    files,
    manifestEntries,
    archiveBuffer,
    archiveName,
  });
  if (!entries.length) {
    const error = new Error("no_supported_images");
    error.code = "no_supported_images";
    throw error;
  }
  const groupedEntries = groupImportEntries({
    entries,
    archiveName,
    targetVolume,
    targetChapterNumber,
  });
  const normalizedPreview = normalizeImportPreviewItems({
    groupedEntries,
    project,
    targetVolume,
    targetChapterNumber,
  });
  let uploads = typeof loadUploads === "function" ? loadUploads() : [];
  const importedChapters = [];
  const { chaptersFolder } = resolveProjectImageFolders(project || {});

  for (const previewItem of normalizedPreview.items) {
    if (previewItem.action === "ignore") {
      continue;
    }
    const volumeSegment =
      previewItem.volume && Number.isFinite(Number(previewItem.volume))
        ? `volume-${Math.floor(Number(previewItem.volume))}`
        : "volume-sem-volume";
    const chapterPagesFolder = `${chaptersFolder}/${volumeSegment}/capitulo-${Math.floor(
      Number(previewItem.number),
    )}/paginas`;
    const pages = [];
    for (let pageIndex = 0; pageIndex < previewItem.files.length; pageIndex += 1) {
      const file = previewItem.files[pageIndex];
      const uploadResult = await storeUploadImageBuffer({
        uploadsDir,
        uploads,
        buffer: file.buffer,
        mime: resolveMimeFromPath(file.relativePath, file.mime),
        filename: file.name,
        exactFileName: resolvePageExactFileName(pageIndex, file.relativePath),
        folder: chapterPagesFolder,
        altText: "",
        dedupeMode: "none",
      });
      uploads = uploadResult.uploads;
      pages.push({
        position: pageIndex + 1,
        imageUrl: uploadResult.uploadEntry.url,
      });
    }
    importedChapters.push(
      buildImportedChapterPayload({
        project,
        previewItem,
        pages,
        defaultStatus,
      }),
    );
  }

  if (typeof writeUploads === "function") {
    writeUploads(uploads, { reason: "project_image_import" });
  }

  return {
    ...buildImportPreviewPayload(normalizedPreview.items, normalizedPreview.warnings),
    chapters: importedChapters,
  };
};

const collectExportableImageChapters = (project, { chapterNumber, volume, includeDrafts = true } = {}) => {
  const episodes = Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : [];
  return episodes
    .filter((episode) => String(episode?.contentFormat || "").trim().toLowerCase() === "images")
    .filter((episode) => Array.isArray(episode?.pages) && episode.pages.length > 0)
    .filter((episode) => (includeDrafts ? true : episode.publicationStatus !== "draft"))
    .filter((episode) =>
      chapterNumber && Number.isFinite(Number(chapterNumber))
        ? Number(episode.number) === Number(chapterNumber) &&
          (volume === undefined
            ? true
            : Number.isFinite(Number(volume))
              ? Number(episode.volume) === Number(volume)
              : !Number.isFinite(Number(episode.volume)))
        : true,
    )
    .sort((left, right) => {
      const volumeDelta = (Number(left.volume) || 0) - (Number(right.volume) || 0);
      if (volumeDelta !== 0) {
        return volumeDelta;
      }
      return (Number(left.number) || 0) - (Number(right.number) || 0);
    });
};

const readUploadBufferOrThrow = ({ uploadsDir, uploadUrl }) => {
  const absolutePath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl });
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    const error = new Error(`page_file_missing:${String(uploadUrl || "")}`);
    error.code = "page_file_missing";
    throw error;
  }
  return fs.readFileSync(absolutePath);
};

const buildChapterArchivePath = (chapter, fileName) => {
  const chapterLabel = `Capitulo ${String(chapter?.number || "0").padStart(3, "0")}`;
  return `${sanitizeArchiveSegment(chapterLabel, "Capitulo")}/${fileName}`;
};

const buildVolumeArchivePath = (chapter, fileName) => {
  const volumeValue = Number(chapter?.volume);
  const volumeLabel = Number.isFinite(volumeValue)
    ? `Volume ${String(Math.floor(volumeValue)).padStart(2, "0")}`
    : "Volume sem numero";
  return `${sanitizeArchiveSegment(volumeLabel, "Volume")}/${buildChapterArchivePath(chapter, fileName)}`;
};

const buildProjectArchiveFileMap = ({ project, chapters, uploadsDir, includeManifest = true } = {}) => {
  const files = {};
  chapters.forEach((chapter) => {
    const normalizedPages = Array.isArray(chapter?.pages) ? chapter.pages : [];
    normalizedPages
      .slice()
      .sort((left, right) => (Number(left.position) || 0) - (Number(right.position) || 0))
      .forEach((page, pageIndex) => {
        const uploadUrl = normalizeText(page?.imageUrl);
        if (!uploadUrl) {
          return;
        }
        const fileName = resolvePageExactFileName(pageIndex, uploadUrl);
        files[buildVolumeArchivePath(chapter, fileName)] = readUploadBufferOrThrow({
          uploadsDir,
          uploadUrl,
        });
      });
  });
  if (includeManifest) {
    files["manifest.json"] = Buffer.from(
      JSON.stringify(
        {
          projectId: project?.id || "",
          title: project?.title || "",
          exportedAt: new Date().toISOString(),
          chapters: chapters.map((chapter) => ({
            number: chapter.number,
            volume: chapter.volume ?? null,
            title: chapter.title || "",
            pageCount: Array.isArray(chapter.pages) ? chapter.pages.length : 0,
          })),
        },
        null,
        2,
      ),
      "utf8",
    );
  }
  return files;
};

const buildSingleChapterArchiveFileMap = ({ chapter, uploadsDir, format } = {}) => {
  const files = {};
  const normalizedPages = Array.isArray(chapter?.pages) ? chapter.pages : [];
  normalizedPages
    .slice()
    .sort((left, right) => (Number(left.position) || 0) - (Number(right.position) || 0))
    .forEach((page, pageIndex) => {
      const uploadUrl = normalizeText(page?.imageUrl);
      if (!uploadUrl) {
        return;
      }
      const fileName = resolvePageExactFileName(pageIndex, uploadUrl);
      const archivePath =
        format === "cbz" ? fileName : buildChapterArchivePath(chapter, fileName);
      files[archivePath] = readUploadBufferOrThrow({
        uploadsDir,
        uploadUrl,
      });
    });
  if (format !== "cbz") {
    files["manifest.json"] = Buffer.from(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          chapter: {
            number: chapter?.number,
            volume: chapter?.volume ?? null,
            title: chapter?.title || "",
            pageCount: normalizedPages.length,
          },
        },
        null,
        2,
      ),
      "utf8",
    );
  }
  return files;
};

const buildArchiveFilenameBase = (project) =>
  sanitizeSlug(project?.title || project?.id || "projeto") || "projeto";

export const exportProjectImageChapter = ({
  project,
  chapterNumber,
  volume,
  format = "zip",
  uploadsDir,
} = {}) => {
  const safeFormat = format === "cbz" ? "cbz" : "zip";
  const chapter = collectExportableImageChapters(project, {
    chapterNumber,
    volume,
    includeDrafts: true,
  })[0];
  if (!chapter) {
    const error = new Error("no_eligible_chapters");
    error.code = "no_eligible_chapters";
    throw error;
  }
  const fileMap = buildSingleChapterArchiveFileMap({
    chapter,
    uploadsDir,
    format: safeFormat,
  });
  const buffer = Buffer.from(zipSync(fileMap, { level: 0 }));
  const filename = `${buildArchiveFilenameBase(project)}-capitulo-${String(chapter.number).padStart(3, "0")}.${safeFormat}`;
  return {
    buffer,
    filename,
    contentType: safeFormat === "cbz" ? "application/vnd.comicbook+zip" : "application/zip",
    summary: {
      scope: "chapter",
      chapters: 1,
      pages: Array.isArray(chapter.pages) ? chapter.pages.length : 0,
      format: safeFormat,
    },
  };
};

export const exportProjectImageCollection = ({
  project,
  volume,
  uploadsDir,
  includeDrafts = true,
} = {}) => {
  const chapters = collectExportableImageChapters(project, {
    includeDrafts,
  }).filter((chapter) =>
    volume === undefined
      ? true
      : Number.isFinite(Number(volume))
        ? Number(chapter.volume) === Number(volume)
        : !Number.isFinite(Number(chapter.volume)),
  );
  if (!chapters.length) {
    const error = new Error("no_eligible_chapters");
    error.code = "no_eligible_chapters";
    throw error;
  }
  const fileMap = buildProjectArchiveFileMap({
    project,
    chapters,
    uploadsDir,
    includeManifest: true,
  });
  const buffer = Buffer.from(zipSync(fileMap, { level: 0 }));
  const filename =
    volume !== undefined && Number.isFinite(Number(volume))
      ? `${buildArchiveFilenameBase(project)}-volume-${String(Number(volume)).padStart(2, "0")}.zip`
      : `${buildArchiveFilenameBase(project)}-manga.zip`;
  return {
    buffer,
    filename,
    contentType: "application/zip",
    summary: {
      scope: volume !== undefined ? "volume" : "project",
      chapters: chapters.length,
      pages: chapters.reduce(
        (total, chapter) => total + (Array.isArray(chapter.pages) ? chapter.pages.length : 0),
        0,
      ),
      volume: volume ?? null,
      format: "zip",
    },
  };
};
