import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { isolateProjectImageUploads } from "../../server/lib/project-image-isolator.js";

const tempRoots: string[] = [];

const createTempRepo = ({
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

  const dataDir = path.join(rootDir, "server", "data");
  const uploadsDir = path.join(rootDir, "public", "uploads");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });

  fs.writeFileSync(path.join(dataDir, "projects.json"), `${JSON.stringify(projects, null, 2)}\n`);
  fs.writeFileSync(path.join(dataDir, "posts.json"), `${JSON.stringify(posts, null, 2)}\n`);
  fs.writeFileSync(path.join(dataDir, "uploads.json"), `${JSON.stringify(uploads, null, 2)}\n`);

  uploadFiles.forEach((file) => {
    const targetPath = path.join(uploadsDir, file.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, file.content || "img");
  });

  return rootDir;
};

const readJson = (rootDir: string, relativePath: string) =>
  JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf-8"));

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
    const rootDir = createTempRepo({
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

    const report = isolateProjectImageUploads({ rootDir, applyChanges: true });

    expect(report.copied).toBe(2);
    expect(report.rewritten).toBe(2);

    const projects = readJson(rootDir, "server/data/projects.json");
    expect(projects[0].cover).toBe("/uploads/projects/proj-1/common.png");
    expect(projects[1].cover).toBe("/uploads/projects/proj-2/common.png");

    expect(fs.existsSync(path.join(rootDir, "public/uploads/shared/common.png"))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, "public/uploads/projects/proj-1/common.png"))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, "public/uploads/projects/proj-2/common.png"))).toBe(true);
  });

  it("quando URL e compartilhada entre projeto e post, reescreve apenas o projeto", () => {
    const rootDir = createTempRepo({
      projects: [
        { id: "proj-1", title: "Projeto Um", cover: "/uploads/shared/mixed.png", episodeDownloads: [] },
      ],
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

    const report = isolateProjectImageUploads({ rootDir, applyChanges: true });
    expect(report.rewritten).toBe(1);

    const projects = readJson(rootDir, "server/data/projects.json");
    const posts = readJson(rootDir, "server/data/posts.json");

    expect(projects[0].cover).toBe("/uploads/projects/proj-1/mixed.png");
    expect(posts[0].content).toContain('/uploads/shared/mixed.png');
    expect(fs.existsSync(path.join(rootDir, "public/uploads/shared/mixed.png"))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, "public/uploads/projects/proj-1/mixed.png"))).toBe(true);
  });

  it("dry-run nao altera arquivos", () => {
    const rootDir = createTempRepo({
      projects: [{ id: "proj-1", title: "Projeto Um", cover: "/uploads/shared/dry.png", episodeDownloads: [] }],
      posts: [],
      uploads: [],
      uploadFiles: [{ relativePath: "shared/dry.png", content: "dry" }],
    });

    const beforeProjectsRaw = fs.readFileSync(path.join(rootDir, "server/data/projects.json"), "utf-8");
    const report = isolateProjectImageUploads({ rootDir, applyChanges: false });
    const afterProjectsRaw = fs.readFileSync(path.join(rootDir, "server/data/projects.json"), "utf-8");

    expect(report.mode).toBe("dry-run");
    expect(report.copied).toBe(1);
    expect(report.rewritten).toBe(1);
    expect(beforeProjectsRaw).toBe(afterProjectsRaw);
    expect(fs.existsSync(path.join(rootDir, "public/uploads/projects/proj-1/dry.png"))).toBe(false);
  });

  it("arquivo ausente entra em missing sem quebrar", () => {
    const rootDir = createTempRepo({
      projects: [{ id: "proj-1", title: "Projeto Um", cover: "/uploads/shared/missing.png", episodeDownloads: [] }],
      posts: [],
      uploads: [],
      uploadFiles: [],
    });

    const report = isolateProjectImageUploads({ rootDir, applyChanges: true });
    const projects = readJson(rootDir, "server/data/projects.json");

    expect(report.missing).toBeGreaterThan(0);
    expect(report.rewritten).toBe(0);
    expect(projects[0].cover).toBe("/uploads/shared/missing.png");
  });
});
