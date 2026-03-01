import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildDiskStorageAreaSummary,
  runUploadsCleanup,
} from "../../server/lib/uploads-cleanup.js";

const tempRoots: string[] = [];

type TempWorkspaceDatasets = {
  posts?: unknown[];
  projects?: unknown[];
  updates?: unknown[];
  users?: unknown[];
  comments?: unknown[];
  pages?: Record<string, unknown>;
  siteSettings?: Record<string, unknown>;
  uploads?: unknown[];
};

const createTempWorkspace = (
  datasets: TempWorkspaceDatasets,
  uploadFiles: Array<{ relativePath: string; content?: string | Buffer }> = [],
) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-cleanup-test-"));
  tempRoots.push(rootDir);

  const uploadsDir = path.join(rootDir, "public", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  uploadFiles.forEach((item) => {
    const targetPath = path.join(uploadsDir, item.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, item.content || "img");
  });

  return {
    rootDir,
    uploadsDir,
    datasets: {
      posts: datasets.posts || [],
      projects: datasets.projects || [],
      updates: datasets.updates || [],
      users: datasets.users || [],
      comments: datasets.comments || [],
      pages: datasets.pages || {},
      siteSettings: datasets.siteSettings || {},
      uploads: datasets.uploads || [],
    },
  };
};

afterEach(() => {
  vi.restoreAllMocks();
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) {
      continue;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("buildDiskStorageAreaSummary", () => {
  it("ignora uploads do inventario quando o arquivo original nao existe no disco", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        uploads: [
          {
            id: "u-missing",
            url: "/uploads/posts/missing.png",
            fileName: "missing.png",
            folder: "posts",
            size: 999,
          },
          {
            id: "u-present",
            url: "/uploads/posts/present.png",
            fileName: "present.png",
            folder: "posts",
            size: 888,
          },
        ],
      },
      [{ relativePath: "posts/present.png", content: Buffer.alloc(40) }],
    );

    const result = buildDiskStorageAreaSummary({
      uploads: datasets.uploads,
      uploadsDir,
    });
    const posts = result.areas.find((item) => item.area === "posts");

    expect(posts).toEqual(
      expect.objectContaining({
        area: "posts",
        originalBytes: 40,
        originalFiles: 1,
        variantBytes: 0,
        variantFiles: 0,
        totalBytes: 40,
        totalFiles: 1,
      }),
    );
  });

  it("conta arquivos presentes em disco mesmo sem registro no inventario", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        uploads: [],
      },
      [{ relativePath: "posts/manual.png", content: Buffer.alloc(25) }],
    );

    const result = buildDiskStorageAreaSummary({
      uploads: datasets.uploads,
      uploadsDir,
    });

    expect(result.areas).toEqual([
      expect.objectContaining({
        area: "posts",
        originalBytes: 25,
        originalFiles: 1,
        totalBytes: 25,
        totalFiles: 1,
      }),
    ]);
  });

  it("atribui bytes de variantes existentes para a area do upload dono", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        uploads: [
          {
            id: "u-active",
            url: "/uploads/posts/cover.png",
            fileName: "cover.png",
            folder: "posts",
          },
        ],
      },
      [
        { relativePath: "posts/cover.png", content: Buffer.alloc(100) },
        { relativePath: "_variants/u-active/card.avif", content: Buffer.alloc(30) },
        { relativePath: "_variants/u-active/hero.avif", content: Buffer.alloc(20) },
      ],
    );

    const result = buildDiskStorageAreaSummary({
      uploads: datasets.uploads,
      uploadsDir,
    });

    expect(result.areas).toEqual([
      expect.objectContaining({
        area: "posts",
        originalBytes: 100,
        variantBytes: 50,
        totalBytes: 150,
        originalFiles: 1,
        variantFiles: 2,
        totalFiles: 3,
      }),
    ]);
  });

  it("agrupa variantes orfas em _variants e mantem totais ordenados por bytes", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        uploads: [
          {
            id: "u-project",
            url: "/uploads/projects/cover.png",
            fileName: "cover.png",
            folder: "projects",
          },
        ],
      },
      [
        { relativePath: "projects/cover.png", content: Buffer.alloc(10) },
        { relativePath: "posts/manual.png", content: Buffer.alloc(50) },
        { relativePath: "_variants/ghost/a.webp", content: Buffer.alloc(70) },
        { relativePath: "_variants/ghost/nested/b.webp", content: Buffer.alloc(30) },
      ],
    );

    const result = buildDiskStorageAreaSummary({
      uploads: datasets.uploads,
      uploadsDir,
    });

    expect(result.areas).toEqual([
      expect.objectContaining({
        area: "_variants",
        originalBytes: 0,
        variantBytes: 100,
        totalBytes: 100,
        originalFiles: 0,
        variantFiles: 2,
        totalFiles: 2,
      }),
      expect.objectContaining({
        area: "posts",
        originalBytes: 50,
        totalBytes: 50,
      }),
      expect.objectContaining({
        area: "projects",
        originalBytes: 10,
        totalBytes: 10,
      }),
    ]);
    expect(result.totals).toEqual({
      area: "total",
      originalBytes: 60,
      variantBytes: 100,
      totalBytes: 160,
      originalFiles: 2,
      variantFiles: 2,
      totalFiles: 4,
    });
  });
});

describe("runUploadsCleanup", () => {
  it("mantem a analise de uploads sem uso e ignora uploads referenciados", () => {
    const { uploadsDir, datasets } = createTempWorkspace({
      posts: [{ coverImageUrl: "/uploads/posts/used.png" }],
      uploads: [
        { id: "u-used", url: "/uploads/posts/used.png", fileName: "used.png" },
        { id: "u-unused", url: "/uploads/posts/unused.png", fileName: "unused.png", size: 120 },
      ],
    });

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: false });

    expect(result.mode).toBe("dry-run");
    expect(result.unusedCount).toBe(1);
    expect(result.unusedUploadCount).toBe(1);
    expect(result.orphanedVariantFilesCount).toBe(0);
    expect(result.orphanedVariantDirsCount).toBe(0);
    expect(result.examples).toEqual([
      expect.objectContaining({
        kind: "upload",
        scope: "unused_upload",
        url: "/uploads/posts/unused.png",
      }),
    ]);
  });

  it("inclui diretorio de variantes sem upload correspondente como orfao", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        uploads: [],
      },
      [
        { relativePath: "_variants/ghost/card.webp", content: Buffer.alloc(40) },
        { relativePath: "_variants/ghost/card.jpeg", content: Buffer.alloc(20) },
      ],
    );

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: false });

    expect(result.unusedUploadCount).toBe(0);
    expect(result.orphanedVariantFilesCount).toBe(2);
    expect(result.orphanedVariantDirsCount).toBe(1);
    expect(result.totals).toEqual(
      expect.objectContaining({
        originalBytes: 0,
        variantBytes: 60,
        totalBytes: 60,
        variantFiles: 2,
        totalFiles: 2,
      }),
    );
    expect(result.examples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "variant",
          scope: "orphaned_variant",
          url: "/uploads/_variants/ghost/card.webp",
          totalBytes: 40,
        }),
      ]),
    );
  });

  it("preserva variantes esperadas e remove apenas arquivos extras de uploads ativos", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        posts: [{ coverImageUrl: "/uploads/posts/cover.png" }],
        uploads: [
          {
            id: "u-active",
            url: "/uploads/posts/cover.png",
            fileName: "cover.png",
            folder: "posts",
            variants: {
              card: {
                formats: {
                  webp: { url: "/uploads/_variants/u-active/card-v1.webp", size: 50 },
                },
              },
            },
          },
        ],
      },
      [
        { relativePath: "_variants/u-active/card-v1.webp", content: Buffer.alloc(50) },
        { relativePath: "_variants/u-active/old-card.webp", content: Buffer.alloc(35) },
      ],
    );

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: true });

    expect(result.deletedUnusedUploadsCount).toBe(0);
    expect(result.deletedOrphanedVariantFilesCount).toBe(1);
    expect(result.deletedOrphanedVariantDirsCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(fs.existsSync(path.join(uploadsDir, "_variants", "u-active", "card-v1.webp"))).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, "_variants", "u-active", "old-card.webp"))).toBe(false);
  });

  it("nao duplica contagem de variantes quando o upload ja sera removido por estar sem uso", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        uploads: [
          {
            id: "u-unused",
            url: "/uploads/posts/unused.png",
            fileName: "unused.png",
            folder: "posts",
            size: 100,
            variants: {
              card: {
                formats: {
                  webp: { url: "/uploads/_variants/u-unused/card-v1.webp", size: 60 },
                },
              },
            },
          },
        ],
      },
      [
        { relativePath: "_variants/u-unused/card-v1.webp", content: Buffer.alloc(60) },
        { relativePath: "_variants/u-unused/orphan-extra.webp", content: Buffer.alloc(90) },
      ],
    );

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: false });

    expect(result.unusedUploadCount).toBe(1);
    expect(result.orphanedVariantFilesCount).toBe(0);
    expect(result.orphanedVariantDirsCount).toBe(0);
    expect(result.totals).toEqual(
      expect.objectContaining({
        originalBytes: 100,
        variantBytes: 60,
        totalBytes: 160,
      }),
    );
  });

  it("soma corretamente bytes de multiplos arquivos em um diretorio orfao", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        uploads: [],
      },
      [
        { relativePath: "_variants/ghost/a.webp", content: Buffer.alloc(10) },
        { relativePath: "_variants/ghost/b.webp", content: Buffer.alloc(20) },
        { relativePath: "_variants/ghost/nested/c.webp", content: Buffer.alloc(30) },
      ],
    );

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: false });

    expect(result.orphanedVariantFilesCount).toBe(3);
    expect(result.orphanedVariantDirsCount).toBe(1);
    expect(result.totals.variantBytes).toBe(60);
    expect(result.totals.variantFiles).toBe(3);
  });

  it("remove diretorios vazios apos limpar variantes orfas em upload ativo", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        posts: [{ coverImageUrl: "/uploads/posts/cover.png" }],
        uploads: [
          {
            id: "u-active",
            url: "/uploads/posts/cover.png",
            fileName: "cover.png",
            folder: "posts",
            variants: {},
          },
        ],
      },
      [{ relativePath: "_variants/u-active/nested/old.webp", content: Buffer.alloc(12) }],
    );

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: true });

    expect(result.deletedOrphanedVariantFilesCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(fs.existsSync(path.join(uploadsDir, "_variants", "u-active", "nested"))).toBe(false);
    expect(fs.existsSync(path.join(uploadsDir, "_variants", "u-active"))).toBe(false);
  });

  it("registra falha de variante sem bloquear outras remocoes", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        posts: [{ coverImageUrl: "/uploads/posts/cover.png" }],
        uploads: [
          {
            id: "u-active",
            url: "/uploads/posts/cover.png",
            fileName: "cover.png",
            folder: "posts",
            variants: {},
          },
        ],
      },
      [
        { relativePath: "_variants/u-active/fail.webp", content: Buffer.alloc(10) },
        { relativePath: "_variants/u-active/ok.webp", content: Buffer.alloc(20) },
      ],
    );

    const failingPath = path.join(uploadsDir, "_variants", "u-active", "fail.webp");
    const originalRmSync = fs.rmSync;
    vi.spyOn(fs, "rmSync").mockImplementation((target, options) => {
      if (String(target) === failingPath) {
        throw new Error("eperm");
      }
      return originalRmSync(target as fs.PathLike, options as fs.RmOptions);
    });

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: true });

    expect(result.deletedOrphanedVariantFilesCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.failures).toEqual([
      {
        kind: "variant",
        url: "/uploads/_variants/u-active/fail.webp",
        reason: "eperm",
      },
    ]);
    expect(fs.existsSync(path.join(uploadsDir, "_variants", "u-active", "ok.webp"))).toBe(false);
    expect(fs.existsSync(path.join(uploadsDir, "_variants", "u-active", "fail.webp"))).toBe(true);
  });

  it("mistura exemplos de upload e variante e respeita exampleLimit", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        posts: [
          { coverImageUrl: "/uploads/posts/used.png" },
          { coverImageUrl: "/uploads/posts/active.png" },
        ],
        uploads: [
          { id: "u-used", url: "/uploads/posts/used.png", fileName: "used.png" },
          {
            id: "u-unused",
            url: "/uploads/posts/unused-big.png",
            fileName: "unused-big.png",
            folder: "posts",
            size: 200,
          },
          {
            id: "u-active",
            url: "/uploads/posts/active.png",
            fileName: "active.png",
            folder: "posts",
            variants: {},
          },
        ],
      },
      [
        { relativePath: "_variants/u-active/big-extra.webp", content: Buffer.alloc(250) },
        { relativePath: "_variants/ghost/medium.webp", content: Buffer.alloc(180) },
      ],
    );

    const result = runUploadsCleanup({
      datasets,
      uploadsDir,
      applyChanges: false,
      exampleLimit: 2,
    });

    expect(result.examples).toHaveLength(2);
    expect(result.examples[0]).toEqual(
      expect.objectContaining({
        kind: "variant",
        url: "/uploads/_variants/u-active/big-extra.webp",
        totalBytes: 250,
      }),
    );
    expect(result.examples[1]).toEqual(
      expect.objectContaining({
        kind: "upload",
        url: "/uploads/posts/unused-big.png",
        totalBytes: 200,
      }),
    );
  });
});
