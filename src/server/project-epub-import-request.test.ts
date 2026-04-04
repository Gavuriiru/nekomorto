import { describe, expect, it } from "vitest";

import {
  EPUB_IMPORT_MULTIPART_LIMITS,
  mapEpubImportExecutionError,
  mapEpubImportMultipartError,
} from "../../server/lib/project-epub-import-request.js";

describe("project EPUB import multipart request", () => {
  it("declares defensive multipart limits with explicit fieldSize", () => {
    expect(EPUB_IMPORT_MULTIPART_LIMITS).toEqual({
      fileSize: 64 * 1024 * 1024,
      fieldSize: 32 * 1024 * 1024,
      files: 1,
      fields: 8,
    });
  });

  it("maps LIMIT_FIELD_VALUE to stable project_snapshot_too_large error", () => {
    const mapped = mapEpubImportMultipartError({
      code: "LIMIT_FIELD_VALUE",
      message: "Field value too long",
    });

    expect(mapped).toEqual({
      status: 400,
      body: {
        error: "project_snapshot_too_large",
        detail:
          "O snapshot do projeto excedeu o limite desta requisição. Salve o projeto e tente novamente.",
      },
    });
  });

  it("keeps generic invalid_multipart_upload fallback for non-field-size multer errors", () => {
    const mapped = mapEpubImportMultipartError({
      code: "LIMIT_FILE_SIZE",
      message: "File too large",
    });

    expect(mapped).toEqual({
      status: 400,
      body: {
        error: "invalid_multipart_upload",
        detail: "File too large",
      },
    });
  });

  it("maps upload persist failure to 503 infrastructure error", () => {
    const mapped = mapEpubImportExecutionError({
      code: "epub_upload_persist_failed",
      message: "epub_upload_persist_failed",
    });

    expect(mapped).toEqual({
      status: 503,
      body: {
        error: "epub_import_upload_persist_failed",
        detail:
          "Não foi possível persistir as imagens importadas do EPUB neste momento. Tente novamente em alguns instantes.",
      },
    });
  });

  it("keeps generic epub_import_failed for non-infra import errors", () => {
    const mapped = mapEpubImportExecutionError(new Error("conversion_failed"));

    expect(mapped).toEqual({
      status: 400,
      body: {
        error: "epub_import_failed",
        detail: "conversion_failed",
      },
    });
  });
});
