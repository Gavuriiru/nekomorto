import { findPublishedEpisodeWithoutPublicAccess } from "../../../lib/project-episodes.js";

export const prepareLocalizedProjectMutation = async ({
  PUBLIC_UPLOADS_DIR,
  findDuplicateEpisodeKey,
  findDuplicateVolumeCover,
  findPublishedImageEpisodeWithoutPages,
  importRemoteImageFile,
  localizeProjectImageFields,
  normalizeProjects,
  project,
  requireImagePagesForPublication = false,
  requirePublicContentForPublication = requireImagePagesForPublication,
  upsertUploadEntries,
} = {}) => {
  const localizedProject = await localizeProjectImageFields({
    project,
    importRemoteImage: ({ remoteUrl, folder, ...options }) =>
      importRemoteImageFile({
        remoteUrl,
        folder,
        ...options,
        uploadsDir: PUBLIC_UPLOADS_DIR,
      }),
    maxConcurrent: 4,
  });
  const normalizedProject = normalizeProjects([localizedProject.project])[0];
  upsertUploadEntries(localizedProject.uploadsToUpsert);

  const duplicateEpisodeKey = findDuplicateEpisodeKey(normalizedProject.episodeDownloads);
  if (duplicateEpisodeKey) {
    return {
      ok: false,
      status: 400,
      body: { error: "duplicate_episode_key", key: duplicateEpisodeKey.key },
    };
  }

  const duplicateVolumeCoverKey = findDuplicateVolumeCover(normalizedProject.volumeEntries);
  if (duplicateVolumeCoverKey) {
    return {
      ok: false,
      status: 400,
      body: { error: "duplicate_volume_cover_key", key: duplicateVolumeCoverKey.key },
    };
  }

  if (requirePublicContentForPublication) {
    const publishedEpisodeWithoutPublicAccess = findPublishedEpisodeWithoutPublicAccess(
      normalizedProject.type || "",
      normalizedProject.episodeDownloads,
    );
    if (publishedEpisodeWithoutPublicAccess) {
      return {
        ok: false,
        status: 400,
        body: {
          error: publishedEpisodeWithoutPublicAccess.errorCode,
          key: publishedEpisodeWithoutPublicAccess.key,
        },
      };
    }
  }

  return {
    ok: true,
    project: normalizedProject,
    summary: localizedProject.summary,
  };
};

export const buildEpisodeUpdateRecords = ({ project, updates } = {}) =>
  (Array.isArray(updates) ? updates : []).map((item) => ({
    id: crypto.randomUUID(),
    projectId: project.id,
    projectTitle: project.title,
    episodeNumber: item.episodeNumber,
    volume: item.volume,
    kind: item.kind,
    reason: item.reason,
    unit: item.unit,
    updatedAt: item.updatedAt,
    image: project.cover || "",
  }));

export const writeProjectMutationUpdates = ({
  collectEpisodeUpdatesByVisibility,
  currentProject,
  loadUpdates,
  previousProject,
  now,
  writeUpdates,
} = {}) => {
  const updates = loadUpdates();
  const episodeWebhookUpdates = collectEpisodeUpdatesByVisibility(previousProject, currentProject, now)
    .map((item) => ({
      ...item,
      updatedAt: item.updatedAt || now,
    }));
  const episodeUpdateRecords = buildEpisodeUpdateRecords({
    project: currentProject,
    updates: episodeWebhookUpdates,
  });
  const nextUpdates =
    episodeUpdateRecords.length > 0 ? [...updates, ...episodeUpdateRecords] : updates;
  if (nextUpdates.length !== updates.length) {
    writeUpdates(nextUpdates);
  }
  return episodeWebhookUpdates;
};

export const dispatchProjectWebhookUpdates = async ({
  dispatchEditorialWebhookEvent,
  findProjectChapterByEpisodeNumber,
  project,
  req,
  resolveProjectWebhookEventKey,
  updates,
} = {}) => {
  for (const update of Array.isArray(updates) ? updates : []) {
    const eventKey = resolveProjectWebhookEventKey(update.kind);
    if (!eventKey) {
      continue;
    }
    await dispatchEditorialWebhookEvent({
      eventKey,
      project,
      update,
      chapter: findProjectChapterByEpisodeNumber(project, update.episodeNumber, update.volume),
      req,
    });
  }
};

export const finalizeProjectMutation = async ({
  dispatchEditorialWebhookEvent,
  enqueueProjectOgPrewarm,
  findProjectChapterByEpisodeNumber,
  loadProjects,
  mutationReason,
  normalizeProjects,
  project,
  projectIds = [project?.id].filter(Boolean),
  req,
  resolveProjectWebhookEventKey,
  runAutoUploadReorganization,
  updates,
} = {}) => {
  await runAutoUploadReorganization({ trigger: "project-save", req });
  const persistedProject =
    normalizeProjects(loadProjects()).find((item) => item.id === project.id) || project;
  void enqueueProjectOgPrewarm({
    reason: mutationReason,
    projectIds,
  }).catch(() => undefined);
  await dispatchProjectWebhookUpdates({
    dispatchEditorialWebhookEvent,
    findProjectChapterByEpisodeNumber,
    project: persistedProject,
    req,
    resolveProjectWebhookEventKey,
    updates,
  });
  return persistedProject;
};
