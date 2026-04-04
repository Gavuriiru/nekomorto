import { beforeEach, describe, expect, it, vi } from "vitest";

const renderLexicalJsonToHtmlMock = vi.hoisted(() =>
  vi.fn((content: string) => `<p>${content}</p><img src="/uploads/chapter.jpg" alt="Capa">`),
);
const epubRenderState = vi.hoisted(() => ({
  calls: [] as Array<{ options: Record<string, unknown>; outputPath: string }>,
}));

vi.mock("../../server/lib/lexical-html.js", () => ({
  renderLexicalJsonToHtml: renderLexicalJsonToHtmlMock,
}));

vi.mock("@lesjoursfr/html-to-epub", () => ({
  EPub: class MockEpub {
    constructor(options: Record<string, unknown>, outputPath: string) {
      epubRenderState.calls.push({ options, outputPath });
    }

    async render() {
      const outputPath = epubRenderState.calls.at(-1)?.outputPath;
      if (!outputPath) {
        throw new Error("missing_output_path");
      }

      const fs = await import("node:fs/promises");
      await fs.writeFile(outputPath, Buffer.from("fake-epub"));
      return { result: "ok" };
    }
  },
}));

import { exportProjectEpub } from "../../server/lib/project-epub-export.js";

describe("project EPUB export", () => {
  beforeEach(() => {
    renderLexicalJsonToHtmlMock.mockClear();
    epubRenderState.calls = [];
  });

  it("exports the requested volume in chapter order and sanitizes metadata/output", async () => {
    const result = await exportProjectEpub({
      project: {
        id: "projeto-teste",
        title: "Projeto Teste",
        synopsis: "<p>Sinopse <strong>rica</strong></p>",
        episodeDownloads: [
          {
            number: 2,
            volume: 2,
            title: "Capitulo 2",
            content: '{"root":{"children":[{"type":"paragraph"}]}}',
            publicationStatus: "published",
          },
          {
            number: 1,
            volume: 2,
            title: "Capitulo 1",
            content: '{"root":{"children":[{"type":"paragraph"}]}}',
            publicationStatus: "published",
          },
          {
            number: 3,
            volume: 2,
            title: "Capitulo 3",
            content: '{"root":{"children":[{"type":"paragraph"}]}}',
            publicationStatus: "draft",
          },
        ],
      },
      volume: 2,
      includeDrafts: false,
      origin: "https://example.com",
      siteName: "Nekomata",
    });

    expect(result.filename).toBe("projeto-teste-vol-02.epub");
    expect(epubRenderState.calls).toHaveLength(1);
    expect(epubRenderState.calls[0]?.options).toEqual(
      expect.objectContaining({
        title: "Projeto Teste - Volume 2",
        author: "Nekomata",
        publisher: "Nekomata",
        lang: "pt-BR",
        description: "Sinopse rica",
      }),
    );
    expect(epubRenderState.calls[0]?.options.content).toEqual([
      expect.objectContaining({
        title: "Capitulo 1",
        filename: "chapter-1-2.xhtml",
        data: expect.stringContaining("https://example.com/uploads/chapter.jpg"),
      }),
      expect.objectContaining({
        title: "Capitulo 2",
        filename: "chapter-2-2.xhtml",
      }),
    ]);
  });

  it("can include draft chapters and rejects empty exports", async () => {
    const withDrafts = await exportProjectEpub({
      project: {
        id: "projeto-teste",
        title: "Projeto Teste",
        episodeDownloads: [
          {
            number: 3,
            volume: 4,
            title: "Capitulo 3",
            content: '{"root":{"children":[{"type":"paragraph"}]}}',
            publicationStatus: "draft",
          },
        ],
      },
      volume: 4,
      includeDrafts: true,
      origin: "https://example.com",
      siteName: "Nekomata",
    });

    expect(withDrafts.filename).toBe("projeto-teste-vol-04.epub");
    expect(epubRenderState.calls[0]?.options.content).toHaveLength(1);

    await expect(
      exportProjectEpub({
        project: {
          id: "projeto-vazio",
          title: "Projeto Vazio",
          episodeDownloads: [
            {
              number: 1,
              volume: 5,
              title: "Capitulo 1",
              content: "",
              publicationStatus: "published",
            },
          ],
        },
        volume: 5,
        includeDrafts: false,
        origin: "https://example.com",
        siteName: "Nekomata",
      }),
    ).rejects.toMatchObject({
      code: "no_eligible_chapters",
    });
  });
});
