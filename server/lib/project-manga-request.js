export const PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS = Object.freeze({
  fileSize: 256 * 1024 * 1024,
  fieldSize: 32 * 1024 * 1024,
  files: 512,
  fields: 16,
});

const buildInvalidMultipartUploadResponse = (error) => ({
  status: 400,
  body: {
    error: "invalid_multipart_upload",
    detail: String(error?.message || error || "invalid_multipart_upload"),
  },
});

const parseJsonField = (value, fallbackValue) => {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }
  if (typeof value === "object") {
    return value;
  }
  const normalized = String(value || "").trim();
  if (!normalized) {
    return fallbackValue;
  }
  return JSON.parse(normalized);
};

export const mapProjectImageImportMultipartError = (error) => {
  const code = String(error?.code || "")
    .trim()
    .toUpperCase();
  if (code === "LIMIT_FILE_SIZE") {
    return {
      status: 400,
      body: {
        error: "import_file_too_large",
        detail: "O arquivo enviado excede o limite permitido para esta importacao.",
      },
    };
  }
  if (code === "LIMIT_FILE_COUNT") {
    return {
      status: 400,
      body: {
        error: "too_many_files",
        detail: "O lote enviado possui arquivos demais para uma unica importacao.",
      },
    };
  }
  if (code === "LIMIT_FIELD_VALUE") {
    return {
      status: 400,
      body: {
        error: "project_snapshot_too_large",
        detail:
          "O snapshot do projeto excedeu o limite desta requisicao. Salve o projeto e tente novamente.",
      },
    };
  }
  return buildInvalidMultipartUploadResponse(error);
};

export const mapProjectImageImportExecutionError = (error) => {
  return {
    status: 400,
    body: {
      error: String(error?.code || "").trim() || "project_image_import_failed",
      detail: String(error?.message || error || "project_image_import_failed"),
    },
  };
};

export const resolveProjectImageImportRequestInput = (req) => {
  const multipartFiles = req.files && typeof req.files === "object" ? req.files : {};
  const archiveFiles = Array.isArray(multipartFiles.archive) ? multipartFiles.archive : [];
  const directFiles = Array.isArray(multipartFiles.files) ? multipartFiles.files : [];
  const archiveFile = archiveFiles[0] || null;
  const manifestEntries = parseJsonField(req.body?.manifest, []);

  return {
    rawProject: parseJsonField(req.body?.project, null),
    archiveBuffer: archiveFile?.buffer || null,
    archiveName: archiveFile?.originalname || "",
    files: directFiles,
    manifestEntries: Array.isArray(manifestEntries) ? manifestEntries : [],
    targetVolume: req.body?.targetVolume,
    targetChapterNumber: req.body?.targetChapterNumber,
    defaultStatus:
      String(req.body?.defaultStatus || "").trim().toLowerCase() === "published"
        ? "published"
        : "draft",
  };
};
