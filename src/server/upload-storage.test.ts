import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const awsSdkMock = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class BaseCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  return {
    S3Client: class {
      send(command: unknown) {
        return awsSdkMock.send(command);
      }
    },
    CopyObjectCommand: class extends BaseCommand {},
    DeleteObjectCommand: class extends BaseCommand {},
    DeleteObjectsCommand: class extends BaseCommand {},
    GetObjectCommand: class extends BaseCommand {},
    HeadObjectCommand: class extends BaseCommand {},
    ListObjectsV2Command: class extends BaseCommand {},
    PutObjectCommand: class extends BaseCommand {},
  };
});

import { createUploadStorageService } from "../../server/lib/upload-storage.js";

const tempRoots: string[] = [];

const createTempUploadsDir = () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-storage-test-"));
  tempRoots.push(rootDir);
  const uploadsDir = path.join(rootDir, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
};

afterEach(() => {
  awsSdkMock.send.mockReset();
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) {
      continue;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("createUploadStorageService", () => {
  it("persiste e recupera uploads locais via driver local", async () => {
    const uploadsDir = createTempUploadsDir();
    const storage = createUploadStorageService({
      uploadsDir,
      env: {
        UPLOAD_STORAGE_DRIVER: "local",
      },
    });

    await storage.putUploadUrl({
      provider: "local",
      uploadUrl: "/uploads/posts/local.png",
      buffer: Buffer.from("local-file"),
      contentType: "image/png",
      cacheControl: "public, max-age=60",
    });
    await storage.putUploadUrl({
      provider: "local",
      uploadUrl: "/uploads/_variants/u-local/card.avif",
      buffer: Buffer.from("variant-file"),
      contentType: "image/avif",
    });

    const originalHead = await storage.headUpload({
      provider: "local",
      uploadUrl: "/uploads/posts/local.png",
    });
    const variantUrls = await storage.listUploadPrefix({
      provider: "local",
      uploadUrlPrefix: "/uploads/_variants/u-local/",
    });
    const originalBuffer = await storage.downloadUploadBuffer({
      provider: "local",
      uploadUrl: "/uploads/posts/local.png",
    });

    expect(originalHead).toEqual(
      expect.objectContaining({
        exists: true,
        contentLength: 10,
        contentType: "image/png",
      }),
    );
    expect(variantUrls).toEqual(["/uploads/_variants/u-local/card.avif"]);
    expect(originalBuffer.toString("utf-8")).toBe("local-file");

    await storage.deleteUploadPrefix({
      provider: "local",
      uploadUrlPrefix: "/uploads/_variants/u-local/",
    });

    expect(
      fs.existsSync(path.join(uploadsDir, "_variants", "u-local", "card.avif")),
    ).toBe(false);
  });

  it("encaminha operacoes S3-compatible com prefixo de chave", async () => {
    const uploadsDir = createTempUploadsDir();
    const storage = createUploadStorageService({
      uploadsDir,
      env: {
        UPLOAD_STORAGE_DRIVER: "s3",
        UPLOAD_STORAGE_BUCKET: "media-bucket",
        UPLOAD_STORAGE_REGION: "auto",
        UPLOAD_STORAGE_ENDPOINT: "https://example.r2.cloudflarestorage.com",
        UPLOAD_STORAGE_ACCESS_KEY_ID: "key",
        UPLOAD_STORAGE_SECRET_ACCESS_KEY: "secret",
        UPLOAD_STORAGE_PREFIX: "tenants/nekomata",
      },
    });

    awsSdkMock.send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Contents: [{ Key: "tenants/nekomata/_variants/u-remote/card.avif" }],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({
        exists: true,
      });

    await storage.putUploadUrl({
      provider: "s3",
      uploadUrl: "/uploads/posts/remote.png",
      buffer: Buffer.from("remote-file"),
      contentType: "image/png",
      cacheControl: "public, max-age=600",
    });
    const variantUrls = await storage.listUploadPrefix({
      provider: "s3",
      uploadUrlPrefix: "/uploads/_variants/u-remote/",
    });

    expect(awsSdkMock.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: "media-bucket",
          Key: "tenants/nekomata/posts/remote.png",
          ContentType: "image/png",
          CacheControl: "public, max-age=600",
        }),
      }),
    );
    expect(awsSdkMock.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: "media-bucket",
          Prefix: "tenants/nekomata/_variants/u-remote/",
        }),
      }),
    );
    expect(variantUrls).toEqual(["/uploads/_variants/u-remote/card.avif"]);
  });

  it("retorna exists=false quando head remoto recebe not found", async () => {
    const uploadsDir = createTempUploadsDir();
    const storage = createUploadStorageService({
      uploadsDir,
      env: {
        UPLOAD_STORAGE_DRIVER: "s3",
        UPLOAD_STORAGE_BUCKET: "media-bucket",
        UPLOAD_STORAGE_REGION: "auto",
        UPLOAD_STORAGE_ACCESS_KEY_ID: "key",
        UPLOAD_STORAGE_SECRET_ACCESS_KEY: "secret",
      },
    });

    awsSdkMock.send.mockRejectedValueOnce({
      name: "NotFound",
      $metadata: { httpStatusCode: 404 },
    });

    const result = await storage.headUpload({
      provider: "s3",
      uploadUrl: "/uploads/posts/missing.png",
    });

    expect(result).toEqual({
      exists: false,
      key: "posts/missing.png",
    });
  });
});
