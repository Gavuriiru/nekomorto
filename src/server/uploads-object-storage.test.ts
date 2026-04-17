import { Readable } from "node:stream";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { repairMissingLocalUploadsFromObjectStorage } from "../../server/lib/uploads-object-storage.js";

const tempRoots: string[] = [];

const createTempUploadsDir = () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-object-storage-test-"));
  tempRoots.push(rootDir);
  const uploadsDir = path.join(rootDir, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
};

const createRasterBuffer = async () =>
  sharp({
    create: {
      width: 16,
      height: 12,
      channels: 3,
      background: { r: 160, g: 110, b: 70 },
    },
  })
    .png()
    .toBuffer();

const writeUploadFile = (uploadsDir: string, relativePath: string, content: Buffer | string) => {
  const targetPath = path.join(uploadsDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content);
  return targetPath;
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

describe("repairMissingLocalUploadsFromObjectStorage", () => {
  it("restaura o original ausente do remoto e regenera variants mantendo provider local", async () => {
    const uploadsDir = createTempUploadsDir();
    const rasterBuffer = await createRasterBuffer();
    const storageService = {
      headUpload: vi.fn(async () => ({ exists: true })),
      getUploadStream: vi.fn(async () => ({
        stream: Readable.from([rasterBuffer]),
      })),
    };
    const uploads = [
      {
        id: "upload-project-episode",
        url: "/uploads/projects/21878/episodes/capa.png",
        fileName: "capa.png",
        folder: "projects/21878/episodes",
        mime: "image/png",
        size: rasterBuffer.length,
        storageProvider: null,
        variantsVersion: 1,
        variants: {
          hero: {
            formats: {
              avif: {
                url: "/uploads/_variants/upload-project-episode/hero-v1.avif",
              },
            },
          },
        },
      },
    ];

    const result = await repairMissingLocalUploadsFromObjectStorage({
      uploads,
      uploadsDir,
      storageService,
      applyChanges: true,
      folder: "projects/21878",
    });

    expect(result.repairedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(storageService.headUpload).toHaveBeenCalledWith({
      provider: "s3",
      uploadUrl: "/uploads/projects/21878/episodes/capa.png",
    });
    expect(storageService.getUploadStream).toHaveBeenCalledWith({
      provider: "s3",
      uploadUrl: "/uploads/projects/21878/episodes/capa.png",
    });
    expect(fs.existsSync(path.join(uploadsDir, "projects", "21878", "episodes", "capa.png"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(uploadsDir, "_variants", "upload-project-episode"))).toBe(true);
    expect(result.uploadsNext[0]).toEqual(
      expect.objectContaining({
        storageProvider: "local",
        width: 16,
        height: 12,
      }),
    );
    expect(String(result.uploadsNext[0]?.hashSha256 || "")).not.toBe("");
    expect(Object.keys(result.uploadsNext[0]?.variants || {}).length).toBeGreaterThan(0);
  });

  it("regenera variants locais ausentes sem consultar o remoto quando o original existe", async () => {
    const uploadsDir = createTempUploadsDir();
    const rasterBuffer = await createRasterBuffer();
    writeUploadFile(uploadsDir, "projects/21878/episodes/capa.png", rasterBuffer);
    const storageService = {
      headUpload: vi.fn(),
      getUploadStream: vi.fn(),
    };
    const uploads = [
      {
        id: "upload-local-only",
        url: "/uploads/projects/21878/episodes/capa.png",
        fileName: "capa.png",
        folder: "projects/21878/episodes",
        mime: "image/png",
        size: rasterBuffer.length,
        storageProvider: "local",
        variantsVersion: 1,
        variants: {
          hero: {
            formats: {
              avif: {
                url: "/uploads/_variants/upload-local-only/hero-v1.avif",
              },
            },
          },
        },
      },
    ];

    const result = await repairMissingLocalUploadsFromObjectStorage({
      uploads,
      uploadsDir,
      storageService,
      applyChanges: true,
      uploadId: "upload-local-only",
    });

    expect(result.repairedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(storageService.headUpload).not.toHaveBeenCalled();
    expect(storageService.getUploadStream).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(uploadsDir, "_variants", "upload-local-only"))).toBe(true);
    expect(Object.keys(result.uploadsNext[0]?.variants || {}).length).toBeGreaterThan(0);
  });

  it("falha explicitamente quando o original nao existe nem localmente nem no remoto", async () => {
    const uploadsDir = createTempUploadsDir();
    const storageService = {
      headUpload: vi.fn(async () => ({ exists: false })),
      getUploadStream: vi.fn(),
    };
    const uploads = [
      {
        id: "upload-missing-everywhere",
        url: "/uploads/projects/21878/episodes/capa.png",
        fileName: "capa.png",
        folder: "projects/21878/episodes",
        mime: "image/png",
        size: 123,
        storageProvider: null,
        variantsVersion: 1,
        variants: {},
      },
    ];

    const result = await repairMissingLocalUploadsFromObjectStorage({
      uploads,
      uploadsDir,
      storageService,
      applyChanges: true,
      url: "/uploads/projects/21878/episodes/capa.png",
    });

    expect(result.repairedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.failures[0]).toEqual(
      expect.objectContaining({
        url: "/uploads/projects/21878/episodes/capa.png",
        reason: "remote_asset_missing:/uploads/projects/21878/episodes/capa.png",
      }),
    );
    expect(storageService.getUploadStream).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(uploadsDir, "projects", "21878", "episodes", "capa.png"))).toBe(
      false,
    );
  });
});
