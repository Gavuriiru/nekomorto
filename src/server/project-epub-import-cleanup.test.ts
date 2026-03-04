import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { cleanupProjectEpubImportTempUploads } from "../../server/lib/project-epub-import-cleanup.js";

const tempRoots: string[] = [];

const createTempWorkspace = () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "epub-import-cleanup-test-"));
  tempRoots.push(rootDir);
  const uploadsDir = path.join(rootDir, "public", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  return {
    rootDir,
    uploadsDir,
  };
};

const writeUploadFile = (uploadsDir: string, relativePath: string, content: string | Buffer = "img") => {
  const targetPath = path.join(uploadsDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content);
};

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) {
      continue;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("cleanupProjectEpubImportTempUploads", () => {
  it("deleta apenas uploads do importId solicitado e pertencentes ao usuario", () => {
    const { uploadsDir } = createTempWorkspace();
    writeUploadFile(uploadsDir, "tmp/epub-imports/user-1/import-1/ch-1.jpg");
    writeUploadFile(uploadsDir, "tmp/epub-imports/user-2/import-1/ch-2.jpg");
    writeUploadFile(uploadsDir, "tmp/epub-imports/user-1/import-2/ch-3.jpg");
    writeUploadFile(uploadsDir, "_variants/u-own-1/card.webp");
    writeUploadFile(uploadsDir, "_variants/u-other-1/card.webp");
    writeUploadFile(uploadsDir, "_variants/u-own-2/card.webp");

    const uploads = [
      {
        id: "u-own-1",
        url: "/uploads/tmp/epub-imports/user-1/import-1/ch-1.jpg",
        folder: "tmp/epub-imports/user-1/import-1",
      },
      {
        id: "u-other-1",
        url: "/uploads/tmp/epub-imports/user-2/import-1/ch-2.jpg",
        folder: "tmp/epub-imports/user-2/import-1",
      },
      {
        id: "u-own-2",
        url: "/uploads/tmp/epub-imports/user-1/import-2/ch-3.jpg",
        folder: "tmp/epub-imports/user-1/import-2",
      },
    ];

    const result = cleanupProjectEpubImportTempUploads({
      importIds: ["import-1"],
      uploadUserId: "user-1",
      uploads,
      uploadsDir,
      usedUploadUrls: new Set(),
    });

    expect(result).toEqual(
      expect.objectContaining({
        requestedImportIds: ["import-1"],
        matchedUploads: 2,
        deletedUploads: 1,
        skippedInUse: 0,
        skippedNotOwned: 1,
        failed: 0,
        changed: true,
      }),
    );
    expect(result.uploadsNext).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "u-other-1" }),
        expect.objectContaining({ id: "u-own-2" }),
      ]),
    );
    expect(result.uploadsNext).toHaveLength(2);

    expect(fs.existsSync(path.join(uploadsDir, "tmp/epub-imports/user-1/import-1/ch-1.jpg"))).toBe(false);
    expect(fs.existsSync(path.join(uploadsDir, "_variants/u-own-1"))).toBe(false);
    expect(fs.existsSync(path.join(uploadsDir, "tmp/epub-imports/user-2/import-1/ch-2.jpg"))).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, "_variants/u-other-1/card.webp"))).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, "tmp/epub-imports/user-1/import-2/ch-3.jpg"))).toBe(true);
  });

  it("nao deleta upload temporario ainda referenciado em datasets persistidos", () => {
    const { uploadsDir } = createTempWorkspace();
    writeUploadFile(uploadsDir, "tmp/epub-imports/user-1/import-1/ch-1.jpg");

    const uploads = [
      {
        id: "u-own-1",
        url: "/uploads/tmp/epub-imports/user-1/import-1/ch-1.jpg",
        folder: "tmp/epub-imports/user-1/import-1",
      },
    ];

    const result = cleanupProjectEpubImportTempUploads({
      importIds: ["import-1"],
      uploadUserId: "user-1",
      uploads,
      uploadsDir,
      usedUploadUrls: new Set(["/uploads/tmp/epub-imports/user-1/import-1/ch-1.jpg"]),
    });

    expect(result).toEqual(
      expect.objectContaining({
        matchedUploads: 1,
        deletedUploads: 0,
        skippedInUse: 1,
        failed: 0,
        changed: false,
      }),
    );
    expect(result.uploadsNext).toHaveLength(1);
    expect(fs.existsSync(path.join(uploadsDir, "tmp/epub-imports/user-1/import-1/ch-1.jpg"))).toBe(true);
  });

  it("retorna falha para entrada temporaria com url invalida sem remover o registro", () => {
    const { uploadsDir } = createTempWorkspace();
    writeUploadFile(uploadsDir, "tmp/epub-imports/user-1/import-1/ch-1.jpg");

    const uploads = [
      {
        id: "u-bad-1",
        url: "notaurlvalida",
        folder: "tmp/epub-imports/user-1/import-1",
      },
      {
        id: "u-own-2",
        url: "/uploads/tmp/epub-imports/user-1/import-2/ch-2.jpg",
        folder: "tmp/epub-imports/user-1/import-2",
      },
    ];

    const result = cleanupProjectEpubImportTempUploads({
      importIds: ["import-1"],
      uploadUserId: "user-1",
      uploads,
      uploadsDir,
      usedUploadUrls: new Set(),
    });

    expect(result).toEqual(
      expect.objectContaining({
        matchedUploads: 1,
        deletedUploads: 0,
        failed: 1,
        changed: false,
      }),
    );
    expect(result.failures).toEqual([
      {
        url: "notaurlvalida",
        reason: "invalid_upload_url",
      },
    ]);
    expect(result.uploadsNext).toHaveLength(2);
    expect(fs.existsSync(path.join(uploadsDir, "tmp/epub-imports/user-1/import-1/ch-1.jpg"))).toBe(true);
  });
});
