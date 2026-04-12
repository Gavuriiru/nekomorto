import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createUploadEntriesRuntime } from "../../server/lib/upload-entries-runtime.js";

const tempDirs: string[] = [];

const createTempUploadsDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-entries-runtime-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const createRuntime = () => {
  let uploadsStore: Array<Record<string, unknown>> = [
    {
      id: "upload-1",
      url: "/uploads/users/avatar.png",
      folder: "users",
      fileName: "avatar.png",
      storageProvider: "local",
      width: 100,
      height: 100,
      focalCrops: [{ x: 10, y: 20, width: 50, height: 40 }],
      focalPoints: [{ x: 35, y: 40 }],
      focalPoint: { x: 35, y: 40 },
      variants: { thumb: { url: "/uploads/users/avatar.thumb.png" } },
      variantsVersion: 2,
      altText: "Avatar",
    },
  ];
  const writeUploads = vi.fn((entries) => {
    uploadsStore = Array.isArray(entries) ? [...entries] : [];
  });
  const uploadsDir = createTempUploadsDir();

  const runtime = createUploadEntriesRuntime({
    STATIC_DEFAULT_CACHE_CONTROL: "public, max-age=0, must-revalidate",
    attachUploadMediaMetadata: vi.fn(async ({ entry }) => ({
      ...entry,
      variantsVersion: 3,
      variants: {
        ...(entry?.variants || {}),
        og: { url: "/uploads/users/avatar.og.png" },
      },
    })),
    buildDiskStorageAreaSummary: vi.fn(() => ({
      areas: [
        {
          area: "users",
          originalBytes: 100,
          variantBytes: 25,
          totalBytes: 125,
          originalFiles: 1,
          variantFiles: 1,
          totalFiles: 2,
        },
      ],
    })),
    buildStorageAreaSummary: vi.fn(() => ({
      areas: [
        {
          area: "users",
          originalBytes: 300,
          variantBytes: 75,
          totalBytes: 375,
          originalFiles: 3,
          variantFiles: 3,
          totalFiles: 6,
        },
        {
          area: "projects",
          originalBytes: 50,
          variantBytes: 0,
          totalBytes: 50,
          originalFiles: 1,
          variantFiles: 0,
          totalFiles: 1,
        },
      ],
    })),
    cleanupUploadStagingWorkspace: vi.fn(),
    createUploadStagingWorkspace: vi.fn(() => ({ uploadsDir })),
    crypto: {
      randomUUID: vi.fn(() => "uuid-new"),
    },
    deriveFocalPointsFromCrops: vi.fn((crops) =>
      Array.isArray(crops)
        ? crops.map((crop) => ({
            x: Number(crop?.x || 0),
            y: Number(crop?.y || 0),
          }))
        : [],
    ),
    fs,
    getLoadUploads: () => () => uploadsStore,
    getPrimaryFocalPoint: vi.fn((points) => (Array.isArray(points) ? points[0] || null : null)),
    getUploadVariantUrlPrefix: vi.fn((entry) =>
      String(entry?.url || "").replace(/(\.[a-z0-9]+)$/i, ""),
    ),
    getWriteUploads: () => writeUploads,
    materializeUploadEntrySourceToStaging: vi.fn(async () => ({
      sourcePath: path.join(uploadsDir, "users", "avatar.png"),
    })),
    mergeUploadVariantPresetKeys: vi.fn((current, requested) =>
      Array.from(
        new Set([
          ...(Array.isArray(current) ? current : []),
          ...(Array.isArray(requested) ? requested : []),
        ]),
      ),
    ),
    normalizeFocalCrops: vi.fn((value, fallback, options) => {
      if (Array.isArray(value)) {
        return value;
      }
      if (Array.isArray(fallback)) {
        return fallback;
      }
      if (Array.isArray(options?.fallbackPoints) && options.fallbackPoints.length > 0) {
        return options.fallbackPoints.map((point) => ({
          x: Number(point?.x || 0),
          y: Number(point?.y || 0),
          width: Number(options?.sourceWidth || 0),
          height: Number(options?.sourceHeight || 0),
        }));
      }
      return [];
    }),
    normalizeFocalPoints: vi.fn((value, fallback) => {
      if (Array.isArray(value)) {
        return value;
      }
      if (value && typeof value === "object") {
        return [value];
      }
      if (Array.isArray(fallback)) {
        return fallback;
      }
      if (fallback && typeof fallback === "object") {
        return [fallback];
      }
      return [];
    }),
    normalizeUploadStorageProvider: vi.fn((value, fallback) =>
      String(value || fallback || "local"),
    ),
    normalizeUploadVariantPresetKeys: vi.fn((value) =>
      Array.isArray(value) ? value.map((item) => String(item || "")) : [],
    ),
    normalizeVariants: vi.fn((value) => (value && typeof value === "object" ? value : {})),
    path,
    persistUploadEntryFromStaging: vi.fn(async () => undefined),
    primaryAppOrigin: "https://example.com",
    publicUploadsDir: uploadsDir,
    readUploadStorageProvider: vi.fn((entry, fallback) =>
      String(entry?.storageProvider || fallback || "local"),
    ),
    resolveUploadAbsolutePath: vi.fn(({ uploadUrl }) =>
      path.join(
        uploadsDir,
        String(uploadUrl || "")
          .replace(/^\/uploads\//, "")
          .replace(/\//g, path.sep),
      ),
    ),
    sanitizeUploadSlot: vi.fn((value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    ),
    uploadStorageService: {
      activeProvider: "local",
      deleteUpload: vi.fn(async () => undefined),
      deleteUploadPrefix: vi.fn(async () => undefined),
    },
  });

  return {
    runtime,
    uploadsDir,
    getUploads: () => uploadsStore,
    writeUploads,
  };
};

describe("upload-entries-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createUploadEntriesRuntime()).toThrow(/missing required dependencies/i);
  });

  it("merges managed storage summaries across local and remote providers", () => {
    const { runtime } = createRuntime();

    const summary = runtime.buildManagedStorageAreaSummary([
      { url: "/uploads/users/avatar.png", storageProvider: "local" },
      { url: "/uploads/projects/cover.png", storageProvider: "s3" },
    ]);

    expect(summary.totals).toEqual({
      area: "total",
      originalBytes: 450,
      variantBytes: 100,
      totalBytes: 550,
      originalFiles: 5,
      variantFiles: 4,
      totalFiles: 9,
    });
    expect(summary.areas).toEqual([
      expect.objectContaining({ area: "users", totalBytes: 500 }),
      expect.objectContaining({ area: "projects", totalBytes: 50 }),
    ]);
  });

  it("upserts upload entries, derives focal state, and keeps list sorted", () => {
    const { getUploads, runtime, writeUploads } = createRuntime();

    const result = runtime.upsertUploadEntries([
      {
        url: "/uploads/users/avatar.png",
        focalPoint: { x: 99, y: 88 },
        altText: "Updated avatar",
      },
      {
        url: "/uploads/socials/banner.png",
        folder: "socials",
        fileName: "banner.png",
        storageProvider: "s3",
      },
    ]);

    expect(result.changed).toBe(true);
    expect(writeUploads).toHaveBeenCalledTimes(1);
    expect(getUploads()).toHaveLength(2);
    expect(getUploads()[0]).toMatchObject({
      url: "/uploads/socials/banner.png",
      id: "uuid-new",
    });
    expect(getUploads()[1]).toMatchObject({
      url: "/uploads/users/avatar.png",
      altText: "Updated avatar",
      focalPoint: { x: 99, y: 88 },
      focalPoints: [{ x: 99, y: 88 }],
    });
  });

  it("normalizes upload URLs, resolves folders, and deletes private uploads safely", () => {
    const { getUploads, runtime, uploadsDir, writeUploads } = createRuntime();
    const usersDir = path.join(uploadsDir, "users");
    fs.mkdirSync(usersDir, { recursive: true });
    fs.writeFileSync(path.join(usersDir, "avatar.png"), "avatar");

    expect(
      runtime.normalizeUploadUrlValue("https://example.com/uploads/users/avatar.png?x=1"),
    ).toBe("/uploads/users/avatar.png");
    expect(runtime.getUploadFolderFromUrlValue("/uploads/users/avatar.png")).toBe("users");
    expect(runtime.isPrivateUploadFolder("users/avatar.png")).toBe(true);

    runtime.deletePrivateUploadByUrl("/uploads/users/avatar.png");

    expect(fs.existsSync(path.join(usersDir, "avatar.png"))).toBe(false);
    expect(writeUploads).toHaveBeenCalledTimes(1);
    expect(getUploads()).toEqual([]);
  });

  it("returns unchanged when required variants are already present", async () => {
    const { getUploads, runtime, writeUploads } = createRuntime();

    const result = await runtime.ensureUploadEntryHasRequiredVariants({
      uploads: getUploads(),
      uploadsDir: createTempUploadsDir(),
      entry: getUploads()[0],
      requiredVariantPresetKeys: ["thumb"],
    });

    expect(result.changed).toBe(false);
    expect(result.entry).toEqual(getUploads()[0]);
    expect(writeUploads).not.toHaveBeenCalled();
  });
});
