const REQUIRED_DEPENDENCY_KEYS = [
  "EPUB_IMPORT_MULTIPART_LIMITS",
  "PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS",
  "express",
  "findDuplicateEpisodeKey",
  "findDuplicateVolumeCover",
  "mapEpubImportMultipartError",
  "mapProjectImageImportMultipartError",
  "multer",
  "normalizeProjects",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[project-import-request-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createProjectImportRequestRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    EPUB_IMPORT_MULTIPART_LIMITS,
    PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS,
    express,
    findDuplicateEpisodeKey,
    findDuplicateVolumeCover,
    mapEpubImportMultipartError,
    mapProjectImageImportMultipartError,
    multer,
    normalizeProjects,
  } = dependencies;

  const epubImportUpload = multer({
    storage: multer.memoryStorage(),
    limits: EPUB_IMPORT_MULTIPART_LIMITS,
  });
  const projectImageImportUpload = multer({
    storage: multer.memoryStorage(),
    limits: PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS,
  });
  const parseLegacyEpubImportBody = express.raw({
    type: ["application/epub+zip", "application/octet-stream"],
    limit: "64mb",
  });

  const getSingleMultipartValue = (value) => (Array.isArray(value) ? value[0] : value);

  const createProjectSnapshotError = (code, key) => {
    const error = new Error(code);
    error.code = code;
    if (key) {
      error.key = key;
    }
    return error;
  };

  const normalizeProjectSnapshotForEpubImport = (rawProjectSnapshot) => {
    const payload = getSingleMultipartValue(rawProjectSnapshot);
    if (payload === undefined || payload === null || String(payload).trim() === "") {
      return null;
    }

    let parsedSnapshot;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      parsedSnapshot = payload;
    } else {
      try {
        parsedSnapshot = JSON.parse(String(payload));
      } catch {
        throw createProjectSnapshotError("invalid_project_snapshot");
      }
    }

    if (!parsedSnapshot || typeof parsedSnapshot !== "object" || Array.isArray(parsedSnapshot)) {
      throw createProjectSnapshotError("invalid_project_snapshot");
    }

    const normalizedProject = normalizeProjects([parsedSnapshot])[0];
    const duplicateEpisodeKey = findDuplicateEpisodeKey(normalizedProject?.episodeDownloads);
    if (duplicateEpisodeKey) {
      throw createProjectSnapshotError("duplicate_episode_key", duplicateEpisodeKey.key);
    }
    const duplicateVolumeCoverKey = findDuplicateVolumeCover(normalizedProject?.volumeEntries);
    if (duplicateVolumeCoverKey) {
      throw createProjectSnapshotError("duplicate_volume_cover_key", duplicateVolumeCoverKey.key);
    }

    return normalizedProject;
  };

  const parseEpubImportRequestBody = (req, res, next) => {
    const contentType = String(req.headers["content-type"] || "").toLowerCase();
    if (contentType.includes("multipart/form-data")) {
      return epubImportUpload.single("file")(req, res, (error) => {
        if (error) {
          const mappedError = mapEpubImportMultipartError(error);
          return res.status(mappedError.status).json(mappedError.body);
        }
        return next();
      });
    }

    return parseLegacyEpubImportBody(req, res, next);
  };

  const parseProjectImageImportRequestBody = (req, res, next) => {
    const contentType = String(req.headers["content-type"] || "").toLowerCase();
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({ error: "multipart_required" });
    }
    return projectImageImportUpload.fields([
      { name: "archive", maxCount: 1 },
      { name: "files", maxCount: PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS.files },
    ])(req, res, (error) => {
      if (error) {
        const mappedError = mapProjectImageImportMultipartError(error);
        return res.status(mappedError.status).json(mappedError.body);
      }
      return next();
    });
  };

  const resolveEpubImportRequestInput = (req) => {
    const isMultipartRequest = String(req.headers["content-type"] || "")
      .toLowerCase()
      .includes("multipart/form-data");
    const rawProjectId = String(req.query.projectId || "").trim();
    const targetVolumeRaw = isMultipartRequest
      ? getSingleMultipartValue(req.body?.targetVolume)
      : req.query.targetVolume;
    const defaultStatusRaw = isMultipartRequest
      ? getSingleMultipartValue(req.body?.defaultStatus)
      : req.query.defaultStatus;
    const defaultStatus = String(defaultStatusRaw || "draft")
      .trim()
      .toLowerCase();
    const targetVolume =
      targetVolumeRaw !== undefined &&
      targetVolumeRaw !== null &&
      String(targetVolumeRaw).trim() !== "" &&
      Number.isFinite(Number(targetVolumeRaw))
        ? Number(targetVolumeRaw)
        : undefined;
    const buffer = isMultipartRequest
      ? Buffer.isBuffer(req.file?.buffer)
        ? req.file.buffer
        : Buffer.from([])
      : Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from([]);
    const project = normalizeProjectSnapshotForEpubImport(req.body?.project);

    return {
      isMultipartRequest,
      rawProjectId,
      targetVolume,
      defaultStatus,
      buffer,
      project,
    };
  };

  return {
    normalizeProjectSnapshotForEpubImport,
    parseEpubImportRequestBody,
    parseProjectImageImportRequestBody,
    resolveEpubImportRequestInput,
  };
};

export default createProjectImportRequestRuntime;
