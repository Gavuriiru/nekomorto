import fs from "fs";
import os from "os";
import { once } from "node:events";
import path from "path";
import { Readable, Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createUploadsDeliveryMiddleware } from "../../server/lib/uploads-delivery.js";

const tempRoots: string[] = [];

const createTempUploadsDir = () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-delivery-test-"));
  tempRoots.push(rootDir);
  const uploadsDir = path.join(rootDir, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
};

class MockResponse extends Writable {
  bodyChunks: Buffer[] = [];
  headers = new Map<string, string>();
  sentFilePath: string | null = null;
  statusCode = 200;
  destroyedError: Error | null = null;

  _write(
    chunk: Buffer | string | Uint8Array,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }

  setHeader(name: string, value: unknown) {
    this.headers.set(String(name).toLowerCase(), String(value));
  }

  status(code: number) {
    this.statusCode = Number(code);
    return this;
  }

  json(payload: unknown) {
    this.setHeader("content-type", "application/json; charset=utf-8");
    this.end(JSON.stringify(payload));
    return this;
  }

  sendFile(targetPath: string) {
    this.sentFilePath = targetPath;
    this.end();
    return this;
  }

  override destroy(error?: Error) {
    this.destroyedError = error || null;
    return super.destroy(error);
  }

  get bodyText() {
    return Buffer.concat(this.bodyChunks).toString("utf-8");
  }
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) {
      continue;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const waitForResponseFinish = async (res: MockResponse) => {
  if (res.writableFinished) {
    return;
  }
  await once(res, "finish");
};

describe("createUploadsDeliveryMiddleware", () => {
  it("serve arquivo local quando o upload metadata aponta para provider local", async () => {
    const uploadsDir = createTempUploadsDir();
    const localFilePath = path.join(uploadsDir, "posts", "local.png");
    fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
    fs.writeFileSync(localFilePath, "local-file");

    const middleware = createUploadsDeliveryMiddleware({
      uploadsDir,
      loadUploads: () => [
        {
          id: "u-local",
          url: "/uploads/posts/local.png",
          storageProvider: "local",
        },
      ],
      storageService: {},
      defaultCacheControl: "public, max-age=60",
    });
    const req = {
      method: "GET",
      originalUrl: "/uploads/posts/local.png",
    };
    const res = new MockResponse();
    const next = vi.fn();

    await middleware(req, res, next);
    await waitForResponseFinish(res);

    expect(res.sentFilePath).toBe(localFilePath);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    expect(next).not.toHaveBeenCalled();
  });

  it("faz proxy de variante remota quando a URL pertence ao metadata do upload", async () => {
    const uploadsDir = createTempUploadsDir();
    const storageService = {
      getUploadStream: vi.fn(async () => ({
        stream: Readable.from(["variant-body"]),
        contentType: "image/webp",
        contentLength: 12,
        cacheControl: "public, max-age=300",
        lastModified: new Date("2026-03-01T00:00:00.000Z"),
      })),
    };
    const middleware = createUploadsDeliveryMiddleware({
      uploadsDir,
      loadUploads: () => [
        {
          id: "u-remote",
          url: "/uploads/posts/original.png",
          storageProvider: "s3",
          variants: {
            card: {
              formats: {
                webp: {
                  url: "/uploads/_variants/u-remote/card-v1.webp",
                },
              },
            },
          },
        },
      ],
      storageService,
      defaultCacheControl: "public, max-age=0, must-revalidate",
    });
    const req = {
      method: "GET",
      originalUrl: "/uploads/_variants/u-remote/card-v1.webp",
    };
    const res = new MockResponse();
    const next = vi.fn();

    await middleware(req, res, next);
    await waitForResponseFinish(res);

    expect(storageService.getUploadStream).toHaveBeenCalledWith({
      provider: "s3",
      uploadUrl: "/uploads/_variants/u-remote/card-v1.webp",
    });
    expect(res.bodyText).toBe("variant-body");
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(next).not.toHaveBeenCalled();
  });

  it("faz fallback para o proximo middleware quando nao encontra metadata", async () => {
    const uploadsDir = createTempUploadsDir();
    const middleware = createUploadsDeliveryMiddleware({
      uploadsDir,
      loadUploads: () => [],
      storageService: {},
    });
    const req = {
      method: "GET",
      originalUrl: "/uploads/posts/loose.png",
    };
    const res = new MockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.sentFilePath).toBeNull();
    expect(res.bodyText).toBe("");
  });

  it("retorna 429 quando a leitura publica excede o limite", async () => {
    const uploadsDir = createTempUploadsDir();
    const middleware = createUploadsDeliveryMiddleware({
      canReadPublicAsset: vi.fn(async () => false),
      getRequestIp: vi.fn(() => "198.51.100.7"),
      uploadsDir,
      loadUploads: () => [],
      storageService: {},
    });
    const req = {
      method: "GET",
      originalUrl: "/uploads/posts/limited.png",
    };
    const res = new MockResponse();
    const next = vi.fn();

    await middleware(req, res, next);
    await waitForResponseFinish(res);

    expect(res.statusCode).toBe(429);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.bodyText).toBe(JSON.stringify({ error: "rate_limited" }));
    expect(next).not.toHaveBeenCalled();
  });
});
