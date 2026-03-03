import path from "path";
import { describe, expect, it, vi } from "vitest";

import { localizeProjectImageFields } from "../../server/lib/project-image-localizer.js";

const buildBaseProject = () => ({
  id: "project-1",
  title: "Projeto Um",
  type: "Light Novel",
  cover: "",
  banner: "",
  heroImageUrl: "",
  relations: [],
  episodeDownloads: [],
});

const createImporterMock = () =>
  vi.fn(async ({ remoteUrl, folder }: { remoteUrl: string; folder: string }) => {
    const parsed = new URL(remoteUrl);
    const fileName = path.basename(parsed.pathname) || "image.jpg";
    return {
      ok: true,
      entry: {
        url: `/uploads/${folder}/${fileName}`,
        fileName,
        folder,
        size: 123,
        mime: "image/jpeg",
        width: 10,
        height: 10,
        createdAt: "2026-02-13T00:00:00.000Z",
      },
    };
  });

describe("localizeProjectImageFields", () => {
  it("localiza campos principais e relations por projeto, e capas de capitulo LN em subpasta de capitulo", async () => {
    const project = {
      ...buildBaseProject(),
      cover: "https://cdn.exemplo.com/cover.jpg",
      banner: "https://cdn.exemplo.com/banner.jpg",
      heroImageUrl: "https://cdn.exemplo.com/hero.jpg",
      volumeEntries: [
        {
          volume: 2,
          synopsis: "Sinopse volume 2",
          coverImageUrl: "https://cdn.exemplo.com/volume-entry-2.jpg",
          coverImageAlt: "Capa do volume 2",
        },
      ],
      volumeCovers: [{ volume: 1, coverImageUrl: "https://cdn.exemplo.com/volume-1.jpg" }],
      relations: [{ anilistId: 777, image: "https://cdn.exemplo.com/relation.jpg" }],
      episodeDownloads: [{ number: 1, volume: 1, coverImageUrl: "https://cdn.exemplo.com/episode.jpg" }],
    };

    const importer = createImporterMock();

    const result = await localizeProjectImageFields({
      project,
      importRemoteImage: importer,
    });

    expect(result.project.cover).toBe("/uploads/projects/project-1/cover.jpg");
    expect(result.project.banner).toBe("/uploads/projects/project-1/banner.jpg");
    expect(result.project.heroImageUrl).toBe("/uploads/projects/project-1/hero.jpg");
    expect(result.project.volumeCovers[0].coverImageUrl).toBe(
      "/uploads/projects/project-1/volumes/volume-1.jpg",
    );
    expect(result.project.volumeEntries[0].coverImageUrl).toBe(
      "/uploads/projects/project-1/volumes/volume-entry-2.jpg",
    );
    expect(result.project.relations[0].image).toBe("/uploads/projects/project-1/relation.jpg");
    expect(result.project.episodeDownloads[0].coverImageUrl).toBe(
      "/uploads/projects/project-1/capitulos/volume-1/capitulo-1/episode.jpg",
    );
    expect(result.summary.attempted).toBe(7);
    expect(result.summary.downloaded).toBe(7);
    expect(result.summary.failed).toBe(0);
    expect(result.uploadsToUpsert).toHaveLength(7);

    expect(importer.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            remoteUrl: "https://cdn.exemplo.com/relation.jpg",
            folder: "projects/project-1",
            deterministic: true,
            onExisting: "reuse",
            fileBaseOverride: "relation-777",
          }),
        ],
        [
          expect.objectContaining({
            remoteUrl: "https://cdn.exemplo.com/volume-1.jpg",
            folder: "projects/project-1/volumes",
          }),
        ],
        [
          expect.objectContaining({
            remoteUrl: "https://cdn.exemplo.com/volume-entry-2.jpg",
            folder: "projects/project-1/volumes",
          }),
        ],
      ]),
    );
  });

  it("mantem pasta legacy de episodios para projetos nao-LN", async () => {
    const project = {
      ...buildBaseProject(),
      type: "Anime",
      episodeDownloads: [{ number: 1, coverImageUrl: "https://cdn.exemplo.com/episode.jpg" }],
    };
    const importer = createImporterMock();

    const result = await localizeProjectImageFields({
      project,
      importRemoteImage: importer,
    });

    expect(result.project.episodeDownloads[0].coverImageUrl).toBe(
      "/uploads/projects/project-1/episodes/episode.jpg",
    );
  });

  it("mantem campos locais e normaliza URL absoluta de /uploads", async () => {
    const project = {
      ...buildBaseProject(),
      cover: "/uploads/projects/project-1/capa.png",
      banner: "https://painel.exemplo.com/uploads/projects/project-1/banner.png?cache=1",
    };
    const importer = vi.fn();

    const result = await localizeProjectImageFields({
      project,
      importRemoteImage: importer,
    });

    expect(result.project.cover).toBe("/uploads/projects/project-1/capa.png");
    expect(result.project.banner).toBe("/uploads/projects/project-1/banner.png");
    expect(result.summary.attempted).toBe(0);
    expect(result.summary.skippedLocal).toBe(1);
    expect(result.summary.normalizedLocalAbsolute).toBe(1);
    expect(importer).not.toHaveBeenCalled();
  });

  it("em falha de relation mantem URL remota e contabiliza falha", async () => {
    const project = {
      ...buildBaseProject(),
      relations: [{ image: "https://cdn.exemplo.com/relation.jpg" }],
    };
    const importer = vi.fn(async () => ({
      ok: false,
      error: { code: "fetch_failed" },
    }));

    const result = await localizeProjectImageFields({
      project,
      importRemoteImage: importer,
    });

    expect(result.project.relations[0].image).toBe("https://cdn.exemplo.com/relation.jpg");
    expect(result.summary.attempted).toBe(1);
    expect(result.summary.downloaded).toBe(0);
    expect(result.summary.failed).toBe(1);
    expect(result.failures).toEqual([
      {
        field: "relations[0].image",
        url: "https://cdn.exemplo.com/relation.jpg",
        error: "fetch_failed",
      },
    ]);
  });

  it("deduplica relation com mesma URL remota na mesma pasta", async () => {
    const project = {
      ...buildBaseProject(),
      relations: [
        { anilistId: 777, image: "https://cdn.exemplo.com/shared.jpg" },
        { anilistId: 777, image: "https://cdn.exemplo.com/shared.jpg" },
      ],
    };
    const importer = vi.fn(async ({ folder }: { folder: string }) => ({
      ok: true,
      entry: {
        url: `/uploads/${folder}/relation-777.jpg`,
        fileName: "relation-777.jpg",
        folder,
        size: 123,
        mime: "image/jpeg",
        width: 10,
        height: 10,
        createdAt: "2026-02-13T00:00:00.000Z",
      },
    }));

    const result = await localizeProjectImageFields({
      project,
      importRemoteImage: importer,
    });

    expect(importer).toHaveBeenCalledTimes(1);
    expect(result.project.relations[0].image).toBe("/uploads/projects/project-1/relation-777.jpg");
    expect(result.project.relations[1].image).toBe("/uploads/projects/project-1/relation-777.jpg");
    expect(result.summary.attempted).toBe(2);
    expect(result.summary.downloaded).toBe(2);
    expect(result.uploadsToUpsert).toHaveLength(1);
  });
});
