import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { runUploadsIntegrityCheck } from "../../server/lib/uploads-integrity.js";

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
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-integrity-test-"));
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
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) {
      continue;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("runUploadsIntegrityCheck", () => {
  it("passa quando arquivo /uploads referenciado existe em disco", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        posts: [
          {
            id: "post-1",
            slug: "post-1",
            coverImageUrl: "/uploads/posts/cover-ok.png",
          },
        ],
      },
      [{ relativePath: "posts/cover-ok.png" }],
    );

    const result = runUploadsIntegrityCheck({ datasets, uploadsDir });

    expect(result.ok).toBe(true);
    expect(result.criticalCount).toBe(0);
  });

  it("falha quando post, projeto e update apontam para /uploads ausente", () => {
    const { uploadsDir, datasets } = createTempWorkspace({
      posts: [
        {
          id: "post-1",
          slug: "post-1",
          coverImageUrl: "/uploads/posts/missing-post.png",
        },
      ],
      projects: [
        {
          id: "project-1",
          title: "Projeto 1",
          cover: "/uploads/projects/project-1/missing-cover.png",
          banner: "",
          heroImageUrl: "",
          relations: [],
          episodeDownloads: [],
        },
      ],
      updates: [
        {
          id: "update-1",
          image: "/uploads/projects/project-1/missing-update.png",
        },
      ],
      uploads: [
        { id: "u-post", url: "/uploads/posts/missing-post.png" },
        { id: "u-project", url: "/uploads/projects/project-1/missing-cover.png" },
        { id: "u-update", url: "/uploads/projects/project-1/missing-update.png" },
      ],
    });

    const result = runUploadsIntegrityCheck({ datasets, uploadsDir });
    const missingSourceIssues = result.criticalIssues.filter((item) => item.type === "missing_source_file");

    expect(result.ok).toBe(false);
    expect(missingSourceIssues.map((item) => item.url)).toEqual(
      expect.arrayContaining([
        "/uploads/posts/missing-post.png",
        "/uploads/projects/project-1/missing-cover.png",
        "/uploads/projects/project-1/missing-update.png",
      ]),
    );
  });

  it("normaliza URL absoluta de /uploads e valida corretamente", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        posts: [
          {
            id: "post-absolute",
            slug: "post-absolute",
            coverImageUrl: "https://painel.exemplo.com/uploads/posts/absolute-cover.png?cache=1",
          },
        ],
      },
      [{ relativePath: "posts/absolute-cover.png" }],
    );

    const result = runUploadsIntegrityCheck({ datasets, uploadsDir });

    expect(result.ok).toBe(true);
    expect(result.criticalCount).toBe(0);
  });

  it("ignora URL externa sem /uploads", () => {
    const { uploadsDir, datasets } = createTempWorkspace({
      posts: [
        {
          id: "post-remote",
          slug: "post-remote",
          coverImageUrl: "https://cdn.exemplo.com/images/a.png",
        },
      ],
    });

    const result = runUploadsIntegrityCheck({ datasets, uploadsDir });

    expect(result.ok).toBe(true);
    expect(result.criticalCount).toBe(0);
    expect(result.referencedUrlsCount).toBe(0);
  });

  it("falha quando branding em site settings referencia /uploads ausente", () => {
    const { uploadsDir, datasets } = createTempWorkspace({
      siteSettings: {
        site: {
          logoUrl: "/uploads/branding/logo.svg",
          defaultShareImage: "https://painel.exemplo.com/uploads/branding/share.png?cache=1",
        },
        branding: {
          assets: {
            wordmarkUrl: "/uploads/branding/wordmark.svg",
          },
        },
      },
    });

    const result = runUploadsIntegrityCheck({ datasets, uploadsDir });
    const missingSourceUrls = result.criticalIssues
      .filter((item) => item.type === "missing_source_file")
      .map((item) => item.url);

    expect(result.ok).toBe(false);
    expect(missingSourceUrls).toEqual(
      expect.arrayContaining([
        "/uploads/branding/logo.svg",
        "/uploads/branding/share.png",
        "/uploads/branding/wordmark.svg",
      ]),
    );
  });
});
