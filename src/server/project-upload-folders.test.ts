import { describe, expect, it } from "vitest";

import { buildChapterFolder, resolveProjectImageFolders } from "../lib/project-image-folders";
import {
  resolveEpisodeCoverFolder,
  resolveProjectLibraryFolders,
} from "../../server/lib/project-upload-folders.js";
import {
  buildProjectChapterFolder,
  buildProjectChapterPagesFolder,
  buildProjectFolderSet,
  resolveEpisodeCoverFolder as resolveEpisodeCoverFolderShared,
} from "../../shared/project-upload-folders.js";

const createSlug = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

describe("project upload folder helpers", () => {
  it("keeps shared, server, and client folder roots aligned", () => {
    const project = {
      id: "project-42",
      title: "Projeto Incrivel",
    };

    const sharedFolders = buildProjectFolderSet({
      createSlug,
      includeRelations: true,
      projectId: project.id,
      projectTitle: project.title,
    });
    const serverFolders = resolveProjectLibraryFolders({
      createSlug,
      project,
    });
    const clientFolders = resolveProjectImageFolders(project.id, project.title);

    expect(serverFolders).toEqual(sharedFolders);
    expect(clientFolders).toEqual({
      projectKey: sharedFolders.projectKey,
      projectRootFolder: sharedFolders.projectRootFolder,
      projectEpisodesFolder: sharedFolders.projectEpisodesFolder,
      projectVolumeCoversFolder: sharedFolders.projectVolumeCoversFolder,
      projectChaptersFolder: sharedFolders.projectChaptersFolder,
    });
  });

  it("keeps chapter folder naming aligned across shared and client helpers", () => {
    const input = {
      projectChaptersFolder: "projects/project-42/capitulos",
      episode: { number: 7, volume: 3 },
      index: 0,
    };

    expect(buildChapterFolder(input)).toBe(buildProjectChapterFolder(input));
    expect(buildProjectChapterPagesFolder(input)).toBe(
      "projects/project-42/capitulos/volume-3/capitulo-7/paginas",
    );
  });

  it("keeps episode cover folder resolution aligned with the shared helper", () => {
    const folders = buildProjectFolderSet({
      createSlug,
      projectId: "project-42",
      projectTitle: "Projeto Incrivel",
    });
    const chapterOptions = {
      episode: { number: 7, volume: 3 },
      folders,
      index: 0,
      isChapterBasedType: () => true,
      project: { type: "Manga" },
    };
    const legacyOptions = {
      episode: { number: 7, volume: 3 },
      folders,
      index: 0,
      isChapterBasedType: () => false,
      project: { type: "Anime" },
    };

    expect(resolveEpisodeCoverFolder(chapterOptions)).toBe(
      resolveEpisodeCoverFolderShared(chapterOptions),
    );
    expect(resolveEpisodeCoverFolder(legacyOptions)).toBe(
      resolveEpisodeCoverFolderShared(legacyOptions),
    );
  });
});
