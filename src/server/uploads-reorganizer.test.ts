import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  classifyTargetFolder,
  ensureUniqueTargetRelative,
  extractUploadUrlsFromText,
  resolveProjectFolders,
  runUploadsReorganization,
} from "../../server/lib/uploads-reorganizer.js";

const tempRoots: string[] = [];

const createTempWorkspace = (
  datasets: {
    posts?: unknown[];
    projects?: unknown[];
    users?: unknown[];
    comments?: unknown[];
    updates?: unknown[];
    pages?: Record<string, unknown>;
    siteSettings?: Record<string, unknown>;
    uploads?: unknown[];
  },
  uploadFiles: Array<{ relativePath: string; content?: string | Buffer }> = [],
) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-reorg-test-"));
  tempRoots.push(rootDir);

  const uploadsDir = path.join(rootDir, "public", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  uploadFiles.forEach((item) => {
    const nextPath = path.join(uploadsDir, item.relativePath);
    fs.mkdirSync(path.dirname(nextPath), { recursive: true });
    fs.writeFileSync(nextPath, item.content || "img");
  });

  return {
    rootDir,
    uploadsDir,
    datasets: {
      posts: datasets.posts || [],
      projects: datasets.projects || [],
      users: datasets.users || [],
      comments: datasets.comments || [],
      updates: datasets.updates || [],
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

describe("uploads reorganizer classification", () => {
  it("prioriza pasta de projeto quando ha uso em projeto e post", () => {
    const folders = resolveProjectFolders({ id: "proj-1", title: "Projeto Um" });
    const usage = {
      posts: new Set(["post-1"]),
      projectIds: new Set(["proj-1"]),
      projectMainIds: new Set(["proj-1"]),
      projectEpisodeIds: new Set(),
    };
    const target = classifyTargetFolder(usage, new Map([["proj-1", folders]]));
    expect(target).toBe("projects/proj-1");
  });

  it("usa shared quando mesma url aparece em multiplos projetos", () => {
    const usage = {
      posts: new Set(),
      projectIds: new Set(["proj-1", "proj-2"]),
      projectMainIds: new Set(["proj-1", "proj-2"]),
      projectEpisodeIds: new Set(),
    };
    const target = classifyTargetFolder(usage, new Map());
    expect(target).toBe("shared");
  });

  it("usa posts quando existe apenas uso em post", () => {
    const usage = {
      posts: new Set(["post-1"]),
      projectIds: new Set(),
      projectMainIds: new Set(),
      projectEpisodeIds: new Set(),
    };
    const target = classifyTargetFolder(usage, new Map());
    expect(target).toBe("posts");
  });

  it("usa pasta episodes quando o uso do projeto e apenas episodios", () => {
    const folders = resolveProjectFolders({ id: "proj-1", title: "Projeto Um" });
    const usage = {
      posts: new Set(),
      projectIds: new Set(["proj-1"]),
      projectMainIds: new Set(),
      projectEpisodeIds: new Set(["proj-1"]),
    };
    const target = classifyTargetFolder(usage, new Map([["proj-1", folders]]));
    expect(target).toBe("projects/proj-1/episodes");
  });
});

describe("uploads reorganizer helpers", () => {
  it("extrai urls /uploads de texto serializado sem capturas invalidas", () => {
    const content =
      '{"src":"/uploads/posts/a.png","x":"1"},{"src":"https://cdn.exemplo.com/uploads/shared/b.jpeg?v=2"}';
    const urls = extractUploadUrlsFromText(content);
    expect(urls).toEqual(["/uploads/posts/a.png", "/uploads/shared/b.jpeg"]);
  });

  it("resolve conflito de nome com sufixo -migrated-<hash8>", () => {
    const next = ensureUniqueTargetRelative({
      proposedRelative: "shared/image.png",
      sourceRelative: "legacy/image.png",
      existingFilesOnDisk: new Set(["shared/image.png"]),
      reservedTargets: new Set(),
      oldUrl: "/uploads/legacy/image.png",
    });
    expect(next).toMatch(/^shared\/image-migrated-[a-f0-9]{8}\.png$/);
  });
});

describe("uploads reorganizer apply", () => {
  it("mantem shared/relations sticky mesmo com uso em um unico projeto", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        projects: [
          {
            id: "proj-1",
            title: "Projeto Um",
            cover: "",
            banner: "",
            heroImageUrl: "",
            relations: [{ image: "/uploads/shared/relations/relation-777.png" }],
            episodeDownloads: [],
          },
        ],
      },
      [{ relativePath: "shared/relations/relation-777.png" }],
    );

    const report = runUploadsReorganization({ datasets, uploadsDir, applyChanges: true });
    expect(report.mappings).toEqual([]);
    expect((report.rewritten.projects as Array<Record<string, unknown>>)[0].relations?.[0]?.image).toBe(
      "/uploads/shared/relations/relation-777.png",
    );
    expect(fs.existsSync(path.join(uploadsDir, "shared/relations/relation-777.png"))).toBe(true);
  });

  it("move para pasta de projeto e reescreve referencias de post", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        posts: [
          {
            id: "post-1",
            slug: "post-1",
            content: '<img src="/uploads/legacy.png" />',
            coverImageUrl: null,
          },
        ],
        projects: [
          {
            id: "proj-1",
            title: "Projeto Um",
            cover: "/uploads/legacy.png",
            banner: "",
            heroImageUrl: "",
            relations: [],
            episodeDownloads: [],
          },
        ],
      },
      [{ relativePath: "legacy.png" }],
    );

    const report = runUploadsReorganization({ datasets, uploadsDir, applyChanges: true });
    expect(report.mode).toBe("apply");
    expect(report.mappings).toEqual([
      {
        oldUrl: "/uploads/legacy.png",
        newUrl: "/uploads/projects/proj-1/legacy.png",
      },
    ]);

    const posts = report.rewritten.posts as Array<Record<string, unknown>>;
    const projects = report.rewritten.projects as Array<Record<string, unknown>>;
    expect(String(posts[0].content || "")).toContain("/uploads/projects/proj-1/legacy.png");
    expect(projects[0].cover).toBe("/uploads/projects/proj-1/legacy.png");
    expect(fs.existsSync(path.join(uploadsDir, "projects/proj-1/legacy.png"))).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, "legacy.png"))).toBe(false);
  });

  it("move para shared quando a mesma url e usada por multiplos projetos", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        projects: [
          {
            id: "proj-1",
            title: "Projeto Um",
            cover: "/uploads/image.png",
            banner: "",
            heroImageUrl: "",
            relations: [],
            episodeDownloads: [],
          },
          {
            id: "proj-2",
            title: "Projeto Dois",
            cover: "/uploads/image.png",
            banner: "",
            heroImageUrl: "",
            relations: [],
            episodeDownloads: [],
          },
        ],
      },
      [{ relativePath: "image.png" }],
    );

    const report = runUploadsReorganization({ datasets, uploadsDir, applyChanges: true });
    expect(report.mappings).toEqual([
      {
        oldUrl: "/uploads/image.png",
        newUrl: "/uploads/shared/image.png",
      },
    ]);

    const projects = report.rewritten.projects as Array<Record<string, unknown>>;
    expect(projects[0].cover).toBe("/uploads/shared/image.png");
    expect(projects[1].cover).toBe("/uploads/shared/image.png");
    expect(fs.existsSync(path.join(uploadsDir, "shared/image.png"))).toBe(true);
  });

  it("move para posts quando existe uso apenas em post", () => {
    const { uploadsDir, datasets } = createTempWorkspace(
      {
        posts: [
          {
            id: "post-1",
            slug: "post-1",
            content: "",
            coverImageUrl: "/uploads/cover.png",
          },
        ],
      },
      [{ relativePath: "cover.png" }],
    );

    const report = runUploadsReorganization({ datasets, uploadsDir, applyChanges: true });
    expect(report.mappings).toEqual([
      {
        oldUrl: "/uploads/cover.png",
        newUrl: "/uploads/posts/cover.png",
      },
    ]);

    const posts = report.rewritten.posts as Array<Record<string, unknown>>;
    expect(posts[0].coverImageUrl).toBe("/uploads/posts/cover.png");
    expect(fs.existsSync(path.join(uploadsDir, "posts/cover.png"))).toBe(true);
  });
});
