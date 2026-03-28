import { extractUploadUrlsFromText, normalizeUploadUrl } from "../../lib/uploads-reorganizer.js";

export const sanitizeProjectFolderSegment = (createSlug, value) =>
  String(createSlug(String(value || "").trim()) || "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const resolveProjectLibraryFolders = ({ createSlug, project }) => {
  const normalizedId = String(project?.id || "").trim();
  const normalizedSlug = sanitizeProjectFolderSegment(createSlug, project?.title || "");
  const projectKey = normalizedId || normalizedSlug || "draft";
  const projectRootFolder = `projects/${projectKey}`;
  return {
    projectRootFolder,
    projectEpisodesFolder: `${projectRootFolder}/episodes`,
    projectRelationsFolder: `${projectRootFolder}/relations`,
    projectVolumeCoversFolder: `${projectRootFolder}/volumes`,
    projectChaptersFolder: `${projectRootFolder}/capitulos`,
  };
};

export const resolveProjectRootFolder = (folder) => {
  const normalized = String(folder || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!normalized.startsWith("projects/")) {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 2) {
    return "";
  }
  return `${segments[0]}/${segments[1]}`;
};

export const resolveVolumeFolderSegment = (volume) => {
  const normalizedVolume = Number.isFinite(Number(volume)) ? Number(volume) : null;
  return normalizedVolume === null ? "volume-sem-volume" : `volume-${normalizedVolume}`;
};

export const resolveEpisodeCoverFolder = ({
  isChapterBasedType,
  project,
  episode,
  index,
  folders,
}) => {
  if (!isChapterBasedType(project?.type || "")) {
    return folders.projectEpisodesFolder;
  }
  const chapterNumber = Number.isFinite(Number(episode?.number)) ? Number(episode.number) : index + 1;
  const safeChapterNumber =
    Number.isFinite(chapterNumber) && chapterNumber > 0 ? Math.floor(chapterNumber) : index + 1;
  const volumeSegment = resolveVolumeFolderSegment(episode?.volume);
  return `${folders.projectChaptersFolder}/${volumeSegment}/capitulo-${safeChapterNumber}`;
};

export const collectProjectImageItems = ({
  createSlug,
  getUploadFolderFromUrlValue,
  isChapterBasedType,
  projects,
}) => {
  const dedupe = new Set();
  const items = [];

  const push = (project, url, kind, label, folder = "") => {
    const normalizedUrl = normalizeUploadUrl(url) || String(url || "").trim();
    if (!normalizedUrl) {
      return;
    }
    const projectKey =
      String(project?.id || "").trim() || String(project?.title || "").trim() || "__draft__";
    const dedupeKey = `${projectKey}\u0001${normalizedUrl}`;
    if (dedupe.has(dedupeKey)) {
      return;
    }
    dedupe.add(dedupeKey);
    const resolvedFolder = String(folder || getUploadFolderFromUrlValue(normalizedUrl) || "").trim();
    items.push({
      source: "project",
      url: normalizedUrl,
      label,
      projectId: project.id,
      projectTitle: project.title,
      kind,
      folder: resolvedFolder,
    });
  };

  const pushFromText = (project, value, kind, label, folder = "") => {
    extractUploadUrlsFromText(value).forEach((uploadUrl) => {
      push(project, uploadUrl, kind, label, folder);
    });
  };

  projects.forEach((project) => {
    const folders = resolveProjectLibraryFolders({ createSlug, project });
    push(project, project.cover, "cover", `${project.title} (Capa)`, folders.projectRootFolder);
    push(project, project.banner, "banner", `${project.title} (Banner)`, folders.projectRootFolder);
    push(
      project,
      project.heroImageUrl,
      "hero",
      `${project.title} (Carrossel)`,
      folders.projectRootFolder,
    );

    const volumeEntries =
      Array.isArray(project.volumeEntries) && project.volumeEntries.length > 0
        ? project.volumeEntries
        : Array.isArray(project.volumeCovers)
          ? project.volumeCovers
          : [];
    volumeEntries.forEach((cover) => {
      const suffix =
        typeof cover?.volume === "number" && Number.isFinite(cover.volume)
          ? `Volume ${cover.volume}`
          : "Sem volume";
      const volumeFolder = `${folders.projectVolumeCoversFolder}/${resolveVolumeFolderSegment(
        cover?.volume,
      )}`;
      push(
        project,
        cover?.coverImageUrl,
        "volume-cover",
        `${project.title} (${suffix})`,
        volumeFolder,
      );
    });

    (Array.isArray(project.relations) ? project.relations : []).forEach((relation, index) => {
      const relationLabel = relation?.title
        ? `${project.title} (Relacao: ${relation.title})`
        : `${project.title} (Relacao ${index + 1})`;
      push(project, relation?.image, "relation", relationLabel, folders.projectRelationsFolder);
    });

    pushFromText(
      project,
      project.description,
      "description-content",
      `${project.title} (Descricao)`,
      folders.projectRootFolder,
    );
    pushFromText(
      project,
      project.synopsis,
      "synopsis-content",
      `${project.title} (Sinopse)`,
      folders.projectRootFolder,
    );

    (Array.isArray(project.episodeDownloads) ? project.episodeDownloads : []).forEach(
      (episode, index) => {
        const suffix = episode?.number ? `Cap/Ep ${episode.number}` : `Cap/Ep ${index + 1}`;
        const episodeFolder = resolveEpisodeCoverFolder({
          isChapterBasedType,
          project,
          episode,
          index,
          folders,
        });
        push(
          project,
          episode?.coverImageUrl,
          "episode-cover",
          `${project.title} (${suffix})`,
          episodeFolder,
        );
        const episodeLabel = String(episode?.title || "").trim();
        const episodeContext = episodeLabel
          ? `${project.title} (${episodeLabel})`
          : `${project.title} (${suffix})`;
        pushFromText(
          project,
          episode?.content,
          "episode-content",
          `${episodeContext} (Conteudo)`,
          episodeFolder,
        );
      },
    );
  });

  return items;
};

const collectUploadUrls = (value, urls) => {
  if (!value) return;
  if (typeof value === "string") {
    extractUploadUrlsFromText(value).forEach((item) => urls.add(item));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUploadUrls(item, urls));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectUploadUrls(item, urls));
  }
};

export const getUsedUploadUrls = ({
  loadComments,
  loadLinkTypes,
  loadPages,
  loadPosts,
  loadProjects,
  loadSiteSettings,
  loadUpdates,
  loadUsers,
}) => {
  const urls = new Set();
  collectUploadUrls(loadSiteSettings(), urls);
  collectUploadUrls(loadPosts(), urls);
  collectUploadUrls(loadProjects(), urls);
  collectUploadUrls(loadUsers(), urls);
  collectUploadUrls(loadPages(), urls);
  collectUploadUrls(loadComments(), urls);
  collectUploadUrls(loadUpdates(), urls);
  collectUploadUrls(loadLinkTypes(), urls);
  return urls;
};

export const loadUploadsCleanupDatasets = ({
  loadComments,
  loadLinkTypes,
  loadPages,
  loadPosts,
  loadProjects,
  loadSiteSettings,
  loadUpdates,
  loadUploads,
  loadUsers,
}) => ({
  siteSettings: loadSiteSettings(),
  posts: loadPosts(),
  projects: loadProjects(),
  users: loadUsers(),
  pages: loadPages(),
  comments: loadComments(),
  updates: loadUpdates(),
  linkTypes: loadLinkTypes(),
  uploads: loadUploads(),
});

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const replaceUploadReferencesInText = (value, oldUrl, newUrl) => {
  if (!value || typeof value !== "string") {
    return { value, count: 0 };
  }
  let next = value;
  let count = 0;
  const directRegex = new RegExp(escapeRegExp(oldUrl), "g");
  const directMatches = next.match(directRegex);
  if (directMatches?.length) {
    count += directMatches.length;
    next = next.replace(directRegex, newUrl);
  }
  const absolutePattern = /https?:\/\/[^\s"'()<>]+/gi;
  next = next.replace(absolutePattern, (match) => {
    const normalized = normalizeUploadUrl(match);
    if (normalized !== oldUrl) {
      return match;
    }
    count += 1;
    try {
      const parsed = new URL(match);
      parsed.pathname = newUrl;
      return parsed.toString();
    } catch {
      return match.replace(oldUrl, newUrl);
    }
  });
  return { value: next, count };
};

export const replaceUploadReferencesDeep = (value, oldUrl, newUrl) => {
  if (typeof value === "string") {
    return replaceUploadReferencesInText(value, oldUrl, newUrl);
  }
  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((item) => {
      const result = replaceUploadReferencesDeep(item, oldUrl, newUrl);
      count += result.count;
      return result.value;
    });
    return { value: next, count };
  }
  if (value && typeof value === "object") {
    let count = 0;
    const next = { ...value };
    Object.keys(next).forEach((key) => {
      const result = replaceUploadReferencesDeep(next[key], oldUrl, newUrl);
      count += result.count;
      next[key] = result.value;
    });
    return { value: next, count };
  }
  return { value, count: 0 };
};
