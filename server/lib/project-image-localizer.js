import crypto from "crypto";

const DEFAULT_MAX_CONCURRENT = 4;

const sanitizeSlug = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toProjectKey = (project) => {
  const id = String(project?.id || "").trim();
  const titleSlug = sanitizeSlug(project?.title || "");
  return id || titleSlug || "draft";
};

export const resolveProjectImageFolders = (project) => {
  const projectKey = toProjectKey(project);
  const projectFolder = `projects/${projectKey}`;
  return {
    projectKey,
    projectFolder,
    episodeFolder: `${projectFolder}/episodes`,
  };
};

const toTrimmedString = (value) => String(value || "").trim();

const normalizeUploadPath = (value) => {
  const trimmed = toTrimmedString(value);
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("/uploads/")) {
    return trimmed.split("?")[0].split("#")[0];
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname && parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // ignore invalid URL values
  }
  return null;
};

const normalizeRemoteHttpUrl = (value) => {
  const trimmed = toTrimmedString(value);
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // ignore invalid URL values
  }
  return null;
};

const cloneProjectForLocalization = (project) => ({
  ...project,
  relations: Array.isArray(project?.relations) ? project.relations.map((item) => ({ ...item })) : [],
  episodeDownloads: Array.isArray(project?.episodeDownloads)
    ? project.episodeDownloads.map((item) => ({ ...item }))
    : [],
});

const runWithConcurrency = async (items, maxConcurrent, worker) => {
  const queue = Array.isArray(items) ? items : [];
  const concurrency = Number.isFinite(maxConcurrent) && maxConcurrent > 0
    ? Math.floor(maxConcurrent)
    : DEFAULT_MAX_CONCURRENT;
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, queue.length || 1) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= queue.length) {
        return;
      }
      await worker(queue[index], index);
    }
  });
  await Promise.all(runners);
};

const normalizeImportResult = (result) => {
  if (!result || typeof result !== "object") {
    return { ok: false, error: { code: "invalid_import_result" } };
  }
  if ("ok" in result) {
    return result;
  }
  if (typeof result.url === "string") {
    return {
      ok: true,
      entry: result,
    };
  }
  return { ok: false, error: { code: "invalid_import_result" } };
};

const sanitizeRelationKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildRelationHashFromUrl = (sourceUrl) =>
  crypto
    .createHash("sha1")
    .update(String(sourceUrl || ""))
    .digest("hex")
    .slice(0, 12);

export const buildRelationImageFileBase = ({ relation, sourceUrl }) => {
  const relationId = sanitizeRelationKey(relation?.anilistId);
  const key = relationId || buildRelationHashFromUrl(sourceUrl);
  return `relation-${key}`;
};

export const localizeProjectImageFields = async ({
  project,
  importRemoteImage,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
} = {}) => {
  const nextProject = cloneProjectForLocalization(project || {});
  const { projectFolder, episodeFolder } = resolveProjectImageFolders(nextProject);

  const summary = {
    attempted: 0,
    downloaded: 0,
    failed: 0,
    skippedLocal: 0,
    normalizedLocalAbsolute: 0,
  };
  const failures = [];
  const uploadsByUrl = new Map();
  const tasks = [];

  const enqueue = (field, value, setValue, { folder, buildImportOptions } = {}) => {
    const rawValue = toTrimmedString(value);
    if (!rawValue) {
      return;
    }

    const normalizedUpload = normalizeUploadPath(rawValue);
    if (normalizedUpload) {
      if (normalizedUpload !== rawValue) {
        summary.normalizedLocalAbsolute += 1;
        setValue(normalizedUpload);
      } else {
        summary.skippedLocal += 1;
      }
      return;
    }

    const normalizedRemote = normalizeRemoteHttpUrl(rawValue);
    if (!normalizedRemote) {
      return;
    }

    summary.attempted += 1;
    tasks.push({
      field,
      folder,
      remoteUrl: normalizedRemote,
      setValue,
      importOptions:
        typeof buildImportOptions === "function"
          ? buildImportOptions(normalizedRemote) || {}
          : {},
    });
  };

  enqueue("cover", nextProject.cover, (nextValue) => {
    nextProject.cover = nextValue;
  }, { folder: projectFolder });
  enqueue("banner", nextProject.banner, (nextValue) => {
    nextProject.banner = nextValue;
  }, { folder: projectFolder });
  enqueue("heroImageUrl", nextProject.heroImageUrl, (nextValue) => {
    nextProject.heroImageUrl = nextValue;
  }, { folder: projectFolder });

  nextProject.relations.forEach((relation, index) => {
    enqueue(
      `relations[${index}].image`,
      relation?.image,
      (nextValue) => {
        nextProject.relations[index] = {
          ...nextProject.relations[index],
          image: nextValue,
        };
      },
      {
        folder: projectFolder,
        buildImportOptions: (remoteUrl) => ({
          deterministic: true,
          onExisting: "reuse",
          fileBaseOverride: buildRelationImageFileBase({ relation, sourceUrl: remoteUrl }),
        }),
      },
    );
  });

  nextProject.episodeDownloads.forEach((episode, index) => {
    enqueue(
      `episodeDownloads[${index}].coverImageUrl`,
      episode?.coverImageUrl,
      (nextValue) => {
        nextProject.episodeDownloads[index] = {
          ...nextProject.episodeDownloads[index],
          coverImageUrl: nextValue,
        };
      },
      { folder: episodeFolder },
    );
  });

  if (tasks.length === 0) {
    return {
      project: nextProject,
      summary,
      uploadsToUpsert: [],
      failures,
    };
  }

  const dedupeRequests = new Map();
  const importer =
    typeof importRemoteImage === "function"
      ? importRemoteImage
      : async () => ({ ok: false, error: { code: "importer_unavailable" } });

  await runWithConcurrency(tasks, maxConcurrent, async (task) => {
    const dedupeKey = `${task.folder}\u0001${task.remoteUrl}`;
    if (!dedupeRequests.has(dedupeKey)) {
      const request = Promise.resolve()
        .then(() =>
          importer({
            remoteUrl: task.remoteUrl,
            folder: task.folder,
            ...(task.importOptions || {}),
          }),
        )
        .then((result) => normalizeImportResult(result))
        .catch(() => ({ ok: false, error: { code: "import_failed" } }));
      dedupeRequests.set(dedupeKey, request);
    }

    const result = await dedupeRequests.get(dedupeKey);
    const importedUrl = String(result?.entry?.url || "").trim();
    if (result?.ok && importedUrl.startsWith("/uploads/")) {
      task.setValue(importedUrl);
      summary.downloaded += 1;
      const uploadEntry = result.entry || {};
      if (!uploadsByUrl.has(importedUrl)) {
        uploadsByUrl.set(importedUrl, {
          url: importedUrl,
          fileName: String(uploadEntry.fileName || ""),
          folder: String(uploadEntry.folder || task.folder || ""),
          size: Number.isFinite(uploadEntry.size) ? uploadEntry.size : null,
          mime: String(uploadEntry.mime || ""),
          width: Number.isFinite(uploadEntry.width) ? uploadEntry.width : null,
          height: Number.isFinite(uploadEntry.height) ? uploadEntry.height : null,
          createdAt: String(uploadEntry.createdAt || new Date().toISOString()),
        });
      }
      return;
    }

    summary.failed += 1;
    failures.push({
      field: task.field,
      url: task.remoteUrl,
      error: String(result?.error?.code || "import_failed"),
    });
  });

  return {
    project: nextProject,
    summary,
    uploadsToUpsert: Array.from(uploadsByUrl.values()),
    failures,
  };
};
