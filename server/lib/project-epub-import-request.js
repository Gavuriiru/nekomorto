export const EPUB_IMPORT_MULTIPART_LIMITS = Object.freeze({
  fileSize: 64 * 1024 * 1024,
  fieldSize: 32 * 1024 * 1024,
  files: 1,
  fields: 8,
});

const EPUB_CSS_ENGINE_ERROR_PATTERNS = [
  /specificity\.max/i,
  /cannot destructure property\s+['"]value['"]/i,
  /@bramus\/specificity/i,
];

const isEpubCssEngineFailure = (error) => {
  const code = String(error?.code || "")
    .trim()
    .toLowerCase();
  if (code === "epub_css_engine_failed") {
    return true;
  }
  const detail = String(error?.message || error || "");
  return EPUB_CSS_ENGINE_ERROR_PATTERNS.some((pattern) => pattern.test(detail));
};

const buildInvalidMultipartUploadResponse = (error) => ({
  status: 400,
  body: {
    error: "invalid_multipart_upload",
    detail: String(error?.message || error || "invalid_multipart_upload"),
  },
});

export const mapEpubImportMultipartError = (error) => {
  const code = String(error?.code || "")
    .trim()
    .toUpperCase();
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

export const mapEpubImportExecutionError = (error) => {
  if (String(error?.code || "").trim() === "epub_upload_persist_failed") {
    return {
      status: 503,
      body: {
        error: "epub_import_upload_persist_failed",
        detail:
          "Nao foi possivel persistir as imagens importadas do EPUB neste momento. Tente novamente em alguns instantes.",
      },
    };
  }
  if (isEpubCssEngineFailure(error)) {
    return {
      status: 400,
      body: {
        error: "epub_import_failed",
        detail:
          "Nao foi possivel processar estilos CSS avancados do EPUB. Tente reexportar o arquivo e importar novamente.",
      },
    };
  }
  return {
    status: 400,
    body: {
      error: "epub_import_failed",
      detail: String(error?.message || error || "epub_import_failed"),
    },
  };
};
