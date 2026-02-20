import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { isolateProjectImageUploads } from "../../server/lib/project-image-isolator.js";

const tempRoots: string[] = [];

const createTempWorkspace = ({
  projects = [],
  posts = [],
  uploads = [],
  uploadFiles = [],
}: {
  projects?: unknown[];
  posts?: unknown[];
  uploads?: unknown[];
  uploadFiles?: Array<{ relativePath: string; content?: string | Buffer }>;
}) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "project-isolator-test-"));
  tempRoots.push(rootDir);

  const uploadsDir = path.join(rootDir, "public", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  uploadFiles.forEach((file) => {
    const targetPath = path.join(uploadsDir, file.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, file.content || "img");
  });

  return {
    uploadsDir,
    datasets: {
      projects,
      posts,
      uploads,
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

describe("project image isolator", () => {
  it("duplica URL compartilhada entre dois projetos e reescreve ambos", () => {
    const { uploadsDir, datasets } = createTempWorkspace({
      projects: [
        { id: "proj-1", title: "Projeto Um", cover: "/uploads/shared/common.png", episodeDownloads: [] },
        { id: "proj-2", title: "Projeto Dois", cover: "/uploads/shared/common.png", episodeDownloads: [] },
      ],
      posts: [],
      uploads: [
        {
          id: "upload-1",
          url: "/uploads/shared/common.png",
          fileName: "common.png",
          folder: "shared",
          size: 3,
          mime: "image/png",
          createdAt: "2026-02-13T00:00:00.000Z",
        },
      ],
      uploadFiles: [{ relativePath: "shared/common.png", content: "abc" }],
    });

    const report = isolateProjectImageUploads({ datasets, uploadsDir, applyChanges: true });

    expect(report.copied).toBe(2);
    expect(report.rewritten).toBe(2);

    const projects = report.rewrittenDatasets.projects as Array<Record<string, unknown>>;
    expect(projects[0].cover).toBe("/uploads/projects/proj-1/common.png");
    expect(projects[1].cover).toBe("/uploads/projects/proj-2/common.png");

    expect(fs.existsSync(path.join(uploadsDir, "shared/common.png"))).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, "projects/proj-1/common.png"))).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, "projects/proj-2/common.png"))).toBe(true);
  });

  it("quando URL e compartilhada entre projeto e post, reescreve apenas o projeto", () => {
    const { uploadsDir, datasets } = createTempWorkspace({
      projects: [{ id: "proj-1", title: "Projeto Um", cover: "/uploads/shared/mixed.png", episodeDownloads: [] }],
      posts: [
        {
          id: "post-1",
          slug: "post-1",
          content: '<img src="/uploads/shared/mixed.png" />',
          coverImageUrl: null,
        },
      ],
      uploads: [],
      uploadFiles: [{ relativePath: "shared/mixed.png", content: "xyz" }],
    });

    const report = isolateProjectImageUploads({ datasets, uploadsDir, applyChanges: true });
    expect(report.rewritten).toBe(1);

    const projects = report.rewrittenDatasets.projects as Array<Record<string, unknown>>;
    const posts = datasets.posts as Array<Record<string, unknown>>;

    expect(projects[0].cover).toBe("/uploads/projects/proj-1/mixed.png");
    expect(String(posts[0].content || "")).toContain('/uploads/shared/mixed.png');
    expect(fs.existsSync(path.join(uploadsDir, "shared/mixed.png"))).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, "projects/proj-1/mixed.png"))).toBe(true);
  });

  it("dry-run nao altera arquivos", () => {
    const { uploadsDir, datasets } = createTempWorkspace({
      projects: [{ id: "proj-1", title: "Projeto Um", cover: "/uploads/shared/dry.png", episodeDownloads: [] }],
      posts: [],
      uploads: [],
      uploadFiles: [{ relativePath: "shared/dry.png", content: "dry" }],
    });

    const report = isolateProjectImageUploads({ datasets, uploadsDir, applyChanges: false });

    expect(report.mode).toBe("dry-run");
    expect(report.copied).toBe(1);
    expect(report.rewritten).toBe(1);
    expect(fs.existsSync(path.join(uploadsDir, "projects/proj-1/dry.png"))).toBe(false);
  });

  it("arquivo ausente entra em missing sem quebrar", () => {
    const { uploadsDir, datasets } = createTempWorkspace({
      projects: [{ id: "proj-1", title: "Projeto Um", cover: "/uploads/shared/missing.png", episodeDownloads: [] }],
      posts: [],
      uploads: [],
      uploadFiles: [],
    });

    const report = isolateProjectImageUploads({ datasets, uploadsDir, applyChanges: true });
    const projects = report.rewrittenDatasets.projects as Array<Record<string, unknown>>;

    expect(report.missing).toBeGreaterThan(0);
    expect(report.rewritten).toBe(0);
    expect(projects[0].cover).toBe("/uploads/shared/missing.png");
  });
});
