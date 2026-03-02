import { beforeEach, describe, expect, it, vi } from "vitest";

const epubState = vi.hoisted(() => ({
  toc: [] as Array<Record<string, unknown>>,
  flow: [] as Array<Record<string, unknown>>,
  manifest: {} as Record<string, Record<string, unknown>>,
  metadata: {} as Record<string, unknown>,
  chapters: {} as Record<string, string>,
  images: {} as Record<string, Buffer>,
  files: {} as Record<string, Buffer>,
}));

const storeUploadImageBufferMock = vi.hoisted(() =>
  vi.fn(async ({ uploads = [] }: Record<string, unknown>) => {
    const uploadEntry = {
      id: "upload-image-1",
      url: "/uploads/tmp/epub-imports/test/import/image-1.jpg",
      fileName: "image-1.jpg",
      folder: "tmp/epub-imports/test/import",
      altText: "ilustracao",
      variants: {},
    };
    return {
      uploadEntry,
      uploads: [...(Array.isArray(uploads) ? uploads : []), uploadEntry],
      dedupeHit: false,
      variantsGenerated: true,
      variantGenerationError: "",
      hashSha256: "hash-image-1",
    };
  }),
);

vi.mock("../../server/lib/uploads-import.js", () => ({
  EPUB_IMPORT_TMP_PREFIX: "tmp/epub-imports",
  EPUB_IMPORT_TMP_TTL_MS: 72 * 60 * 60 * 1000,
  buildEpubImportTempFolder: ({ userId, importId }: Record<string, unknown>) =>
    `tmp/epub-imports/${String(userId || "anonymous")}/${String(importId || "import")}`,
  isEpubImportTempFolder: (folder: unknown) =>
    String(folder || "").startsWith("tmp/epub-imports/"),
  storeUploadImageBuffer: storeUploadImageBufferMock,
}));

vi.mock("epub", () => ({
  default: class MockEpub {
    toc = epubState.toc;
    flow = epubState.flow;
    manifest = epubState.manifest;
    metadata = epubState.metadata;

    constructor(_input: unknown) {}

    async parse() {}

    async getChapterRaw(id: string) {
      return epubState.chapters[id] || "";
    }

    async getImage(id: string) {
      return epubState.images[id] || Buffer.from([]);
    }

    async getFile(id: string) {
      return epubState.files[id] || Buffer.from([]);
    }
  },
}));

import { importProjectEpub } from "../../server/lib/project-epub-import.js";

describe("project EPUB import with real lexical bridge", () => {
  beforeEach(() => {
    epubState.toc = [];
    epubState.flow = [];
    epubState.manifest = {};
    epubState.metadata = {};
    epubState.chapters = {};
    epubState.images = {};
    epubState.files = {};
    storeUploadImageBufferMock.mockClear();
  });

  it("importa html com texto solto e inline no topo sem quebrar o bridge", async () => {
    epubState.flow = [{ id: "c1", title: "Capitulo 1" }];
    epubState.manifest = {
      c1: { id: "c1", title: "Capitulo 1" },
    };
    epubState.chapters = {
      c1: "texto solto<strong> inline</strong>",
    };

    const result = await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 1,
      defaultStatus: "draft",
      project: { episodeDownloads: [] },
    });

    const parsed = JSON.parse(String(result.chapters[0]?.content || ""));
    expect(result.chapters).toHaveLength(1);
    expect(parsed.root.children).toHaveLength(1);
    expect(parsed.root.children[0]?.type).toBe("paragraph");
    expect(parsed.root.children[0]?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", text: "texto solto" }),
        expect.objectContaining({ type: "text", text: " inline" }),
      ]),
    );
  });

  it("descarta paginas somente com imagem no fallback do flow", async () => {
    epubState.flow = [{ id: "c1", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" }];
    epubState.manifest = {
      c1: { id: "c1", title: "Chapter 1" },
    };
    epubState.chapters = {
      c1: '<img src="cover.jpg" alt="cover">',
    };

    const result = await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 1,
      defaultStatus: "draft",
      project: { episodeDownloads: [] },
    });

    expect(result.chapters).toHaveLength(0);
    expect(result.summary.chapters).toBe(0);
    expect(result.warnings).toEqual(expect.arrayContaining(["Paginas somente com imagem ignoradas: 1."]));
  });

  it("importa imagem interna dentro do intervalo narrativo do TOC", async () => {
    const loadUploads = vi.fn(() => []);
    const writeUploads = vi.fn();

    epubState.toc = [
      { id: "c1-toc", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml#Ref_1" },
      { id: "c2-toc", title: "Chapter 2", href: "OEBPS/Text/chapter002.xhtml#Ref_2" },
    ];
    epubState.flow = [
      { id: "c1", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" },
      { id: "c1a", href: "OEBPS/Text/chapter001_a.xhtml" },
      { id: "c2", title: "Chapter 2", href: "OEBPS/Text/chapter002.xhtml" },
    ];
    epubState.manifest = {
      c1: { id: "c1", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" },
      c1a: { id: "c1a", href: "OEBPS/Text/chapter001_a.xhtml" },
      c2: { id: "c2", title: "Chapter 2", href: "OEBPS/Text/chapter002.xhtml" },
      art1: { id: "art1", href: "OEBPS/Images/Art_P8.jpg", "media-type": "image/jpeg" },
    };
    epubState.chapters = {
      c1: "<p>Texto antes da imagem.</p>",
      c1a: '<p><img src="../Images/Art_P8.jpg" alt="Ilustracao"></p>',
      c2: "<p>Texto do segundo capitulo.</p>",
    };
    epubState.images = {
      art1: Buffer.from("fake-image"),
    };

    const result = await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 1,
      defaultStatus: "draft",
      project: { episodeDownloads: [] },
      uploadsDir: "D:/dev/nekomorto/public/uploads",
      loadUploads,
      writeUploads,
      uploadUserId: "test-user",
    });

    expect(result.chapters).toHaveLength(2);
    const parsed = JSON.parse(String(result.chapters[0]?.content || ""));
    expect(JSON.stringify(parsed)).toContain('"type":"image"');
    expect(JSON.stringify(parsed)).toContain("/uploads/tmp/epub-imports/test/import/image-1.jpg");
    expect(result.summary.imagesImported).toBe(1);
    expect(result.summary.imageImportFailures).toBe(0);
  });
});
