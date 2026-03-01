import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runUploadsCleanup } from "../../server/lib/uploads-cleanup.js";

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

describe("runUploadsCleanup", () => {
  it("retorna apenas uploads do inventario sem referencia no dry-run", () => {
    const { uploadsDir, datasets } = createTempWorkspace({
      posts: [{ coverImageUrl: "/uploads/posts/used-post.png" }],
      projects: [{ cover: "/uploads/projects/project-1/used-project.png" }],
      users: [{ avatarUrl: "/uploads/users/avatar.png" }],
      pages: { about: { heroImageUrl: "/uploads/pages/about-hero.png" } },
      comments: [{ attachments: [{ image: "/uploads/comments/comment-image.png" }] }],
      updates: [{ image: "/uploads/updates/update-image.png" }],
      siteSettings: { site: { logoUrl: "/uploads/branding/logo.png" } },
      uploads: [
        { id: "u-1", url: "/uploads/posts/used-post.png", fileName: "used-post.png" },
        { id: "u-2", url: "/uploads/projects/project-1/used-project.png", fileName: "used-project.png" },
        { id: "u-3", url: "/uploads/users/avatar.png", fileName: "avatar.png" },
        { id: "u-4", url: "/uploads/pages/about-hero.png", fileName: "about-hero.png" },
        { id: "u-5", url: "/uploads/comments/comment-image.png", fileName: "comment-image.png" },
        { id: "u-6", url: "/uploads/updates/update-image.png", fileName: "update-image.png" },
        { id: "u-7", url: "/uploads/branding/logo.png", fileName: "logo.png" },
        { id: "u-8", url: "/uploads/posts/unused.png", fileName: "unused.png" },
      ],
    });

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: false });

    expect(result.mode).toBe("dry-run");
    expect(result.unusedCount).toBe(1);
    expect(result.examples).toEqual([
      expect.objectContaining({
        id: "u-8",
        url: "/uploads/posts/unused.png",
        fileName: "unused.png",
      }),
    ]);
    expect(result.changed).toBe(false);
    expect(result.deletedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.rewritten.uploads).toHaveLength(8);
  });

  it("resume bytes de originais e variantes no dry-run", () => {
    const { uploadsDir, datasets } = createTempWorkspace({
      uploads: [
        {
          id: "u-media",
          url: "/uploads/posts/media.png",
          fileName: "media.png",
          folder: "posts",
          size: 120,
          variants: {
            card: {
              formats: {
                fallback: { url: "/uploads/_variants/u-media/card.jpeg", size: 40 },
                webp: { url: "/uploads/_variants/u-media/card.webp", size: 20 },
              },
            },
          },
        },
      ],
    });

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: false });

    expect(result.totals).toEqual(
      expect.objectContaining({
        area: "total",
        originalBytes: 120,
        variantBytes: 60,
        totalBytes: 180,
        originalFiles: 1,
        variantFiles: 2,
        totalFiles: 3,
      }),
    );
    expect(result.examples[0]).toEqual(
      expect.objectContaining({
        originalBytes: 120,
        variantBytes: 60,
        totalBytes: 180,
      }),
    );
  });

  it("remove arquivo original e pasta de variantes no apply", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        uploads: [
          {
            id: "u-clean",
            url: "/uploads/posts/unused-clean.png",
            fileName: "unused-clean.png",
            folder: "posts",
            size: 10,
          },
        ],
      },
      [
        { relativePath: "posts/unused-clean.png" },
        { relativePath: "_variants/u-clean/card.webp" },
        { relativePath: "_variants/u-clean/card.jpeg" },
      ],
    );

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: true });

    expect(result.mode).toBe("apply");
    expect(result.deletedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.changed).toBe(true);
    expect(result.rewritten.uploads).toHaveLength(0);
    expect(fs.existsSync(path.join(uploadsDir, "posts", "unused-clean.png"))).toBe(false);
    expect(fs.existsSync(path.join(uploadsDir, "_variants", "u-clean"))).toBe(false);
  });

  it("trata ausencia de arquivo e variantes como operacao idempotente", () => {
    const { uploadsDir, datasets } = createTempWorkspace({
      uploads: [
        {
          id: "u-missing",
          url: "/uploads/posts/missing.png",
          fileName: "missing.png",
          folder: "posts",
        },
      ],
    });

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: true });

    expect(result.deletedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.rewritten.uploads).toHaveLength(0);
  });

  it("mantem o item no inventario quando ocorre falha de filesystem", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        uploads: [
          {
            id: "u-fail",
            url: "/uploads/posts/fail.png",
            fileName: "fail.png",
            folder: "posts",
          },
        ],
      },
      [
        { relativePath: "posts/fail.png" },
        { relativePath: "_variants/u-fail/card.webp" },
      ],
    );

    const targetPath = path.join(uploadsDir, "posts", "fail.png");
    const originalRmSync = fs.rmSync;
    vi.spyOn(fs, "rmSync").mockImplementation((target, options) => {
      if (String(target) === targetPath) {
        throw new Error("eprem");
      }
      return originalRmSync(target as fs.PathLike, options as fs.RmOptions);
    });

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: true });

    expect(result.deletedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.changed).toBe(false);
    expect(result.failures).toEqual([
      {
        url: "/uploads/posts/fail.png",
        reason: "eprem",
      },
    ]);
    expect(result.rewritten.uploads).toHaveLength(1);
    expect(fs.existsSync(targetPath)).toBe(true);
  });

  it("limita exemplos a oito itens e ordena pelo maior total recuperavel", () => {
    const uploads = Array.from({ length: 9 }, (_, index) => ({
      id: `u-${index + 1}`,
      url: `/uploads/posts/item-${index + 1}.png`,
      fileName: `item-${index + 1}.png`,
      folder: "posts",
      size: (index + 1) * 10,
    }));
    const { uploadsDir, datasets } = createTempWorkspace({ uploads });

    const result = runUploadsCleanup({ datasets, uploadsDir, applyChanges: false });

    expect(result.examples).toHaveLength(8);
    expect(result.examples[0]?.url).toBe("/uploads/posts/item-9.png");
    expect(result.examples.at(-1)?.url).toBe("/uploads/posts/item-2.png");
    expect(result.examples.some((item) => item.url === "/uploads/posts/item-1.png")).toBe(false);
  });
});
