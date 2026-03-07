import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  resolveHomeHeroPreloadFromSlide,
  sanitizePublicMediaVariantEntry,
  shouldExposePublicUploadInMediaVariants,
} from "../../server/lib/public-media-variants.js";

const tempRoots: string[] = [];

const createTempUploadsDir = (
  files: Array<{ relativePath: string; content?: string | Buffer }> = [],
) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "public-media-variants-test-"));
  tempRoots.push(rootDir);
  const uploadsDir = path.join(rootDir, "public", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  files.forEach((item) => {
    const targetPath = path.join(uploadsDir, item.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, item.content || "img");
  });
  return uploadsDir;
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

describe("public media variants", () => {
  it("remove formats e presets que apontam para variants inexistentes", () => {
    const uploadsDir = createTempUploadsDir([
      { relativePath: "_variants/u-1/hero-v1.avif" },
      { relativePath: "_variants/u-1/heroSm-v1.avif" },
    ]);

    const sanitized = sanitizePublicMediaVariantEntry(
      {
        variantsVersion: 1,
        variants: {
          heroXs: {
            width: 768,
            height: 432,
            formats: {
              avif: { url: "/uploads/_variants/u-1/heroXs-v1.avif" },
            },
          },
          heroSm: {
            width: 960,
            height: 540,
            formats: {
              avif: { url: "/uploads/_variants/u-1/heroSm-v1.avif" },
            },
          },
          hero: {
            width: 1600,
            height: 900,
            formats: {
              avif: { url: "/uploads/_variants/u-1/hero-v1.avif" },
              fallback: { url: "/uploads/_variants/u-1/hero-v1.jpeg" },
            },
          },
        },
      },
      { uploadsDir },
    );

    expect(sanitized).toEqual({
      variantsVersion: 1,
      variants: {
        heroSm: {
          width: 960,
          height: 540,
          formats: {
            avif: { url: "/uploads/_variants/u-1/heroSm-v1.avif" },
          },
        },
        hero: {
          width: 1600,
          height: 900,
          formats: {
            avif: { url: "/uploads/_variants/u-1/hero-v1.avif" },
          },
        },
      },
    });
  });

  it("faz fallback do preload do hero para a imagem original quando variants responsivas nao existem", () => {
    const preload = resolveHomeHeroPreloadFromSlide({
      imageUrl: "/uploads/projects/project-1/hero.jpg",
      mediaVariants: {},
      resolveVariantUrl: () => "",
    });

    expect(preload).toEqual({
      href: "/uploads/projects/project-1/hero.jpg",
      as: "image",
      fetchpriority: "high",
    });
  });

  it("permite variants privadas de users apenas para avatares explicitamente publicados na equipe", () => {
    expect(
      shouldExposePublicUploadInMediaVariants({
        uploadUrl: "/uploads/users/team-1.png",
        folder: "users",
        allowPrivateUrls: ["/uploads/users/team-1.png"],
      }),
    ).toBe(true);
    expect(
      shouldExposePublicUploadInMediaVariants({
        uploadUrl: "/uploads/users/team-2.png",
        folder: "users",
        allowPrivateUrls: ["/uploads/users/team-1.png"],
      }),
    ).toBe(false);
  });
});
