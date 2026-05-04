import {
  resolveEpisodeCoverFolder,
  resolveProjectLibraryFolders,
  resolveProjectRootFolder,
  resolveVolumeFolderSegment,
  sanitizeProjectFolderSegment,
} from "../../lib/project-upload-folders.js";
import {
  collectUploadUrlsFromDatasets,
  replaceUploadReferencesDeep as replaceUploadReferencesDeepShared,
  replaceUploadReferencesInText as replaceUploadReferencesInTextShared,
} from "../../lib/upload-reference-utils.js";
import { extractUploadUrlsFromText, normalizeUploadUrl } from "../../lib/uploads-reorganizer.js";

export {
  resolveEpisodeCoverFolder,
  resolveProjectLibraryFolders,
  resolveProjectRootFolder,
  resolveVolumeFolderSegment,
  sanitizeProjectFolderSegment,
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
    const resolvedFolder = String(
      folder || getUploadFolderFromUrlValue(normalizedUrl) || "",
    ).trim();
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
    push(
      project,
      project.heroLogoUrl,
      "hero-logo",
      `${project.title} (Logo do carrossel)`,
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
  return collectUploadUrlsFromDatasets(
    {
      loadComments,
      loadLinkTypes,
      loadPages,
      loadPosts,
      loadProjects,
      loadSiteSettings,
      loadUpdates,
      loadUsers,
    },
    {
      normalizeDirectUrl: normalizeUploadUrl,
      extractTextUrls: extractUploadUrlsFromText,
    },
  );
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

export const replaceUploadReferencesInText = (value, oldUrl, newUrl) =>
  replaceUploadReferencesInTextShared(value, oldUrl, newUrl, {
    normalizeUrl: normalizeUploadUrl,
  });

export const replaceUploadReferencesDeep = (value, oldUrl, newUrl) =>
  replaceUploadReferencesDeepShared(value, oldUrl, newUrl, {
    normalizeUrl: normalizeUploadUrl,
  });
