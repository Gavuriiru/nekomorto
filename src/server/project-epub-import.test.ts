import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

const htmlToLexicalJsonMock = vi.hoisted(() => vi.fn((html: string) => `LEXICAL:${html}`));
const storeUploadImageBufferMock = vi.hoisted(() =>
  vi.fn(async ({ uploads = [], filename = "image", altText = "" }: Record<string, unknown>) => {
    const nextIndex = Array.isArray(uploads) ? uploads.length + 1 : 1;
    const uploadEntry = {
      id: `upload-${nextIndex}`,
      url: `/uploads/tmp/epub-imports/test/import-${nextIndex}/${String(filename)}`,
      fileName: String(filename),
      folder: `tmp/epub-imports/test/import-${nextIndex}`,
      altText: String(altText || ""),
      variants: {},
    };
    return {
      uploadEntry,
      uploads: [...(Array.isArray(uploads) ? uploads : []), uploadEntry],
      dedupeHit: false,
      variantsGenerated: true,
      variantGenerationError: "",
      hashSha256: `hash-${nextIndex}`,
    };
  }),
);
const epubState = vi.hoisted(() => ({
  toc: [] as Array<Record<string, unknown>>,
  flow: [] as Array<Record<string, unknown>>,
  manifest: {} as Record<string, Record<string, unknown>>,
  metadata: {} as Record<string, unknown>,
  chapters: {} as Record<string, string>,
  images: {} as Record<string, Buffer>,
  files: {} as Record<string, Buffer>,
}));

vi.mock("../../server/lib/lexical-html.js", () => ({
  htmlToLexicalJson: htmlToLexicalJsonMock,
}));

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

describe("project EPUB import", () => {
  beforeEach(() => {
    htmlToLexicalJsonMock.mockClear();
    storeUploadImageBufferMock.mockClear();
    epubState.toc = [];
    epubState.flow = [];
    epubState.manifest = {};
    epubState.metadata = {};
    epubState.chapters = {};
    epubState.images = {};
    epubState.files = {};
  });

  it("resolve o TOC por href e ignora front matter nao narrativo", async () => {
    epubState.toc = [
      { id: "cover-toc", title: "Cover", href: "OEBPS/Text/cover.xhtml" },
      { id: "chapter-toc", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml#Ref_1" },
      { id: "afterword-toc", title: "Afterword", href: "OEBPS/Text/afterword.xhtml#Ref_2" },
      { id: "newsletter-toc", title: "Yen Newsletter", href: "OEBPS/Text/newsletterSignup.xhtml" },
      { id: "ghost-toc", title: "Ghost", href: "OEBPS/Text/missing.xhtml" },
    ];
    epubState.flow = [
      { id: "cover", title: "Cover", href: "OEBPS/Text/cover.xhtml" },
      { id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" },
      { id: "afterword", title: "Afterword", href: "OEBPS/Text/afterword.xhtml" },
      { id: "newsletterSignup", title: "Yen Newsletter", href: "OEBPS/Text/newsletterSignup.xhtml" },
    ];
    epubState.manifest = {
      cover: { id: "cover", title: "Cover" },
      chapter001: { id: "chapter001", title: "Chapter 1" },
      afterword: { id: "afterword", title: "Afterword" },
      newsletterSignup: { id: "newsletterSignup", title: "Yen Newsletter" },
    };
    epubState.metadata = {
      title: "Livro teste",
      creator: "Equipe",
      language: "pt-BR",
    };
    epubState.chapters = {
      cover: '<img src="cover.jpg" alt="cover">',
      chapter001: "<p>Capitulo de abertura</p>",
      afterword: "<p>Consideracoes finais</p>",
      newsletterSignup: "<p>Subscribe now</p>",
    };

    const result = await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 7,
      defaultStatus: "draft",
      project: {
        episodeDownloads: [],
      },
    });

    expect(result.summary).toEqual({
      chapters: 2,
      mainImported: 1,
      extrasImported: 1,
      created: 2,
      updated: 0,
      volume: 7,
      imagesImported: 0,
      imageImportFailures: 0,
      boilerplatePromoted: 1,
      boilerplateDiscarded: 2,
      unresolvedTocEntries: 1,
      volumeCoverImported: false,
      volumeCoverSkipped: false,
    });
    expect(result.metadata).toEqual({
      title: "Livro teste",
      author: "Equipe",
      language: "pt-BR",
    });
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(["Chapter 1", "Afterword"]);
    expect(result.chapters.map((chapter) => chapter.number)).toEqual([1, 100000]);
    expect(result.chapters.map((chapter) => chapter.entryKind)).toEqual(["main", "extra"]);
    expect(result.chapters[1]).toEqual(
      expect.objectContaining({
        mergeMode: "create",
        publicationStatus: "draft",
        episodeKey: "100000:7",
        entrySubtype: "afterword",
      }),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Itens de boilerplate promovidos para extras: 1.",
        "Itens de boilerplate ignorados: 2.",
        "Entradas do TOC nao resolvidas: 1.",
      ]),
    );
    expect(htmlToLexicalJsonMock).toHaveBeenCalledTimes(2);
    expect(htmlToLexicalJsonMock.mock.calls[0]?.[0]).toContain("<p>Capitulo de abertura</p>");
    expect(htmlToLexicalJsonMock.mock.calls[1]?.[0]).toContain("<p>Consideracoes finais</p>");
  });

  it("usa fallback narrativo do flow e agrupa fragmentos do mesmo capitulo", async () => {
    epubState.flow = [
      { id: "cover", title: "Cover", href: "OEBPS/Text/cover.xhtml" },
      { id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" },
      { id: "chapter001_a", href: "OEBPS/Text/chapter001_a.xhtml" },
      { id: "chapter001_b", href: "OEBPS/Text/chapter001_b.xhtml" },
      { id: "nav", title: "Table of Contents", href: "OEBPS/Text/nav.xhtml" },
    ];
    epubState.manifest = {
      chapter001: { id: "chapter001", title: "Chapter 1" },
      chapter001_a: { id: "chapter001_a" },
      chapter001_b: { id: "chapter001_b" },
    };
    epubState.chapters = {
      cover: '<img src="cover.jpg" alt="cover">',
      chapter001: "<p>Parte 1 do capitulo.</p>",
      chapter001_a: "<p>Parte 2 do capitulo.</p>",
      chapter001_b: "<p>Parte 3 do capitulo.</p>",
      nav: "<p>Contents</p>",
    };

    const result = await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 3,
      defaultStatus: "draft",
      project: {
        episodeDownloads: [],
      },
    });

    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0]).toEqual(
      expect.objectContaining({
        number: 1,
        volume: 3,
        title: "Chapter 1",
        publicationStatus: "draft",
        episodeKey: "1:3",
        mergeMode: "create",
      }),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Itens de boilerplate promovidos para extras: 1.",
        "Itens de boilerplate ignorados: 1.",
      ]),
    );
    expect(htmlToLexicalJsonMock).toHaveBeenCalledTimes(1);
    expect(htmlToLexicalJsonMock.mock.calls[0]?.[0]).toContain("<p>Parte 1 do capitulo.</p>");
    expect(htmlToLexicalJsonMock.mock.calls[0]?.[0]).toContain("<p>Parte 2 do capitulo.</p>");
    expect(htmlToLexicalJsonMock.mock.calls[0]?.[0]).toContain("<p>Parte 3 do capitulo.</p>");
  });

  it("monta o capitulo como intervalo do spine e importa a imagem intermediaria", async () => {
    const loadUploads = vi.fn(() => []);
    const writeUploads = vi.fn();

    epubState.toc = [
      { id: "chapter-toc", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml#Ref_1" },
      { id: "chapter-2-toc", title: "Chapter 2", href: "OEBPS/Text/chapter002.xhtml#Ref_2" },
    ];
    epubState.flow = [
      { id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" },
      { id: "chapter001_a", href: "OEBPS/Text/chapter001_a.xhtml" },
      { id: "chapter001_b", href: "OEBPS/Text/chapter001_b.xhtml" },
      { id: "chapter002", title: "Chapter 2", href: "OEBPS/Text/chapter002.xhtml" },
    ];
    epubState.manifest = {
      chapter001: { id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" },
      chapter001_a: { id: "chapter001_a", href: "OEBPS/Text/chapter001_a.xhtml" },
      chapter001_b: { id: "chapter001_b", href: "OEBPS/Text/chapter001_b.xhtml" },
      chapter002: { id: "chapter002", title: "Chapter 2", href: "OEBPS/Text/chapter002.xhtml" },
      artP8: {
        id: "artP8",
        href: "OEBPS/Images/Art_P8.jpg",
        "media-type": "image/jpeg",
      },
    };
    epubState.chapters = {
      chapter001: "<p>Parte 1 do capitulo.</p>",
      chapter001_a: '<p><img src="../Images/Art_P8.jpg" alt="Full page art"></p>',
      chapter001_b: "<p>Parte 2 do capitulo.</p>",
      chapter002: "<p>Outro capitulo.</p>",
    };
    epubState.images = {
      artP8: Buffer.from("fake-image"),
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
    expect(result.summary).toEqual({
      chapters: 2,
      mainImported: 2,
      extrasImported: 0,
      created: 2,
      updated: 0,
      volume: 1,
      imagesImported: 1,
      imageImportFailures: 0,
      boilerplatePromoted: 0,
      boilerplateDiscarded: 0,
      unresolvedTocEntries: 0,
      volumeCoverImported: false,
      volumeCoverSkipped: false,
    });
    expect(htmlToLexicalJsonMock).toHaveBeenCalledTimes(2);
    expect(htmlToLexicalJsonMock.mock.calls[0]?.[0]).toContain("<p>Parte 1 do capitulo.</p>");
    expect(htmlToLexicalJsonMock.mock.calls[0]?.[0]).toContain("/uploads/tmp/epub-imports");
    expect(htmlToLexicalJsonMock.mock.calls[0]?.[0]).toContain("<p>Parte 2 do capitulo.</p>");
    expect(storeUploadImageBufferMock).toHaveBeenCalledTimes(1);
    expect(writeUploads).toHaveBeenCalledTimes(1);
  });

  it("preserva o subset editorial de CSS do EPUB no HTML enviado ao bridge", async () => {
    const loadUploads = vi.fn(() => []);
    const writeUploads = vi.fn();

    epubState.toc = [{ id: "chapter-toc", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml#Ref_1" }];
    epubState.flow = [{ id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" }];
    epubState.manifest = {
      chapter001: { id: "chapter001", href: "OEBPS/Text/chapter001.xhtml" },
      stylesheet: {
        id: "stylesheet",
        href: "OEBPS/Styles/stylesheet.css",
        "media-type": "text/css",
      },
      censor: {
        id: "censor",
        href: "OEBPS/Images/censor.png",
        "media-type": "image/png",
      },
      inlineGlyph: {
        id: "inlineGlyph",
        href: "OEBPS/Images/inline.png",
        "media-type": "image/png",
      },
    };
    epubState.chapters = {
      chapter001: `<!doctype html>
        <html>
          <head>
            <link rel="stylesheet" href="../Styles/stylesheet.css">
          </head>
          <body>
            <h1 class="chapter-title">
              Titulo
              <img class="bbox1" src="../Images/censor.png" alt="censor">
            </h1>
            <p class="txalt">
              Texto
              <img class="box" src="../Images/inline.png" alt="ornamento">
              <span class="tx14">grande</span>
              <span class="tx14i">italico</span>
            </p>
            <p class="callout">What in the hell is this?!</p>
            <p class="space-break1">Quebra editorial</p>
          </body>
        </html>`,
    };
    epubState.files = {
      stylesheet: Buffer.from(`
        .chapter-title { margin-top: 10%; margin-bottom: 3em; }
        p { text-indent: 20pt; }
        .space-break1 { margin-top: 1.5em; text-indent: 0; }
        .tx14 { font-size: 1.5em; }
        .tx14i { font-size: 1.5em; font-style: italic; }
        .txalt { font-family: Arial, sans-serif; }
        .bbox1 { width: 3em; }
        .box { height: 0.75em; vertical-align: middle; }
        .callout { font-size: 2em; margin-top: 1em; margin-bottom: 1em; text-align: center; }
      `),
    };
    epubState.images = {
      censor: Buffer.from("censor-image"),
      inlineGlyph: Buffer.from("inline-image"),
    };

    await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 1,
      defaultStatus: "draft",
      project: { episodeDownloads: [] },
      uploadsDir: "D:/dev/nekomorto/public/uploads",
      loadUploads,
      writeUploads,
      uploadUserId: "test-user",
    });

    const importedHtml = String(htmlToLexicalJsonMock.mock.calls.at(-1)?.[0] || "");
    expect(importedHtml).toContain("<h1");
    expect(importedHtml).toContain("margin-top:");
    expect(importedHtml).toContain("margin-bottom:");
    expect(importedHtml).toContain("/uploads/tmp/epub-imports/");
    expect(importedHtml).toContain("width:");
    expect(importedHtml).toContain("height:");
    expect(importedHtml).toContain("vertical-align:middle");
    expect(importedHtml).toContain("font-size:");
    expect(importedHtml).toContain("font-style:italic");
    expect(importedHtml).toContain("font-family:sans-serif");
    expect(importedHtml).toContain("text-indent:");
    expect(importedHtml).toContain('data-epub-heading="h1"');
  });

  it("continua a importacao quando a etapa de estilo editorial falha", async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(JSDOM.prototype, "window");
    const windowGetterSpy = vi.spyOn(JSDOM.prototype, "window", "get").mockImplementation(function () {
      const nextWindow = originalWindowDescriptor?.get?.call(this);
      if (nextWindow && typeof nextWindow.getComputedStyle === "function") {
        nextWindow.getComputedStyle = () => {
          throw new Error(
            "Cannot destructure property 'value' of 'Specificity.max(...)' as it is undefined.",
          );
        };
      }
      return nextWindow;
    });

    try {
      epubState.toc = [{ id: "chapter-toc", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" }];
      epubState.flow = [{ id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" }];
      epubState.manifest = {
        chapter001: { id: "chapter001", href: "OEBPS/Text/chapter001.xhtml" },
      };
      epubState.chapters = {
        chapter001: "<p>Capitulo com estilo editorial.</p>",
      };

      const result = await importProjectEpub({
        buffer: Buffer.from("fake"),
        targetVolume: 1,
        defaultStatus: "draft",
        project: { episodeDownloads: [] },
      });

      expect(result.summary.chapters).toBe(1);
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0]).toEqual(
        expect.objectContaining({
          title: "Chapter 1",
          entryKind: "main",
        }),
      );
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          'Estilos CSS avancados foram ignorados no capitulo "Chapter 1"; importacao continuou sem estilos calculados.',
        ]),
      );
      expect(htmlToLexicalJsonMock).toHaveBeenCalledTimes(1);
    } finally {
      windowGetterSpy.mockRestore();
    }
  });

  it("deduplica fallback CSS por documentHref durante a mesma importacao", async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(JSDOM.prototype, "window");
    const windowGetterSpy = vi.spyOn(JSDOM.prototype, "window", "get").mockImplementation(function () {
      const nextWindow = originalWindowDescriptor?.get?.call(this);
      if (nextWindow && typeof nextWindow.getComputedStyle === "function") {
        nextWindow.getComputedStyle = () => {
          throw new Error(
            "Cannot destructure property 'value' of 'Specificity.max(...)' as it is undefined.",
          );
        };
      }
      return nextWindow;
    });
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      epubState.toc = [{ id: "chapter-toc", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" }];
      epubState.flow = [
        { id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" },
        { id: "chapter001_part2", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" },
      ];
      epubState.manifest = {
        chapter001: { id: "chapter001", href: "OEBPS/Text/chapter001.xhtml" },
        chapter001_part2: { id: "chapter001_part2", href: "OEBPS/Text/chapter001.xhtml" },
      };
      epubState.chapters = {
        chapter001: "<p>Parte 1.</p>",
        chapter001_part2: "<p>Parte 2.</p>",
      };

      const result = await importProjectEpub({
        buffer: Buffer.from("fake"),
        targetVolume: 1,
        defaultStatus: "draft",
        project: { episodeDownloads: [] },
      });

      const warningMessage =
        'Estilos CSS avancados foram ignorados no capitulo "Chapter 1"; importacao continuou sem estilos calculados.';
      expect(result.warnings.filter((warning) => warning === warningMessage)).toHaveLength(1);
      expect(
        consoleWarnSpy.mock.calls.filter(
          ([eventName]) => String(eventName || "") === "epub_import_editorial_css_fallback",
        ),
      ).toHaveLength(1);
    } finally {
      consoleWarnSpy.mockRestore();
      windowGetterSpy.mockRestore();
    }
  });

  it("usa documentHref como contexto quando a etapa de estilo falha sem titulo de capitulo", async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(JSDOM.prototype, "window");
    const windowGetterSpy = vi.spyOn(JSDOM.prototype, "window", "get").mockImplementation(function () {
      const nextWindow = originalWindowDescriptor?.get?.call(this);
      if (nextWindow && typeof nextWindow.getComputedStyle === "function") {
        nextWindow.getComputedStyle = () => {
          throw new Error(
            "Cannot destructure property 'value' of 'Specificity.max(...)' as it is undefined.",
          );
        };
      }
      return nextWindow;
    });
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      epubState.toc = [{ id: "chapter-toc", title: "", href: "OEBPS/Text/chapter001.xhtml" }];
      epubState.flow = [{ id: "chapter001", title: "", href: "OEBPS/Text/chapter001.xhtml" }];
      epubState.manifest = {
        chapter001: { id: "chapter001", href: "OEBPS/Text/chapter001.xhtml" },
      };
      epubState.chapters = {
        chapter001:
          "<p>Texto narrativo suficiente para classificar como principal e validar o fallback de contexto.</p>",
      };

      const result = await importProjectEpub({
        buffer: Buffer.from("fake"),
        targetVolume: 1,
        defaultStatus: "draft",
        project: { episodeDownloads: [] },
      });

      expect(result.summary.chapters).toBe(1);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          'Estilos CSS avancados foram ignorados no capitulo "OEBPS/Text/chapter001.xhtml"; importacao continuou sem estilos calculados.',
        ]),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "epub_import_editorial_css_fallback",
        expect.objectContaining({
          chapterTitle: "OEBPS/Text/chapter001.xhtml",
          documentHref: "OEBPS/Text/chapter001.xhtml",
        }),
      );
    } finally {
      consoleWarnSpy.mockRestore();
      windowGetterSpy.mockRestore();
    }
  });

  it("preserva alinhamento explicito de imagens block centralizadas no html enviado ao bridge", async () => {
    const loadUploads = vi.fn(() => []);
    const writeUploads = vi.fn();

    epubState.toc = [{ id: "chapter-toc", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml#Ref_1" }];
    epubState.flow = [
      { id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" },
      { id: "chapter001_a", href: "OEBPS/Text/chapter001_a.xhtml" },
    ];
    epubState.manifest = {
      chapter001: { id: "chapter001", href: "OEBPS/Text/chapter001.xhtml" },
      chapter001_a: { id: "chapter001_a", href: "OEBPS/Text/chapter001_a.xhtml" },
      stylesheet: {
        id: "stylesheet",
        href: "OEBPS/Styles/stylesheet.css",
        "media-type": "text/css",
      },
      ornament: {
        id: "ornament",
        href: "OEBPS/Images/ornament.png",
        "media-type": "image/png",
      },
    };
    epubState.chapters = {
      chapter001: `<!doctype html>
        <html>
          <head>
            <link rel="stylesheet" href="../Styles/stylesheet.css">
          </head>
          <body>
            <p>Texto antes.</p>
          </body>
        </html>`,
      chapter001_a: `<!doctype html>
        <html>
          <head>
            <link rel="stylesheet" href="../Styles/stylesheet.css">
          </head>
          <body>
            <div class="align-center-rw"><img class="orn1" src="../Images/ornament.png" alt="ornamento"></div>
          </body>
        </html>`,
    };
    epubState.files = {
      stylesheet: Buffer.from(`
        .align-center-rw { text-align: center; }
        .orn1 { width: 3em; display: block; margin-left: auto; margin-right: auto; }
      `),
    };
    epubState.images = {
      ornament: Buffer.from("ornament"),
    };

    await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 1,
      defaultStatus: "draft",
      project: { episodeDownloads: [] },
      uploadsDir: "D:/dev/nekomorto/public/uploads",
      loadUploads,
      writeUploads,
      uploadUserId: "test-user",
    });

    const importedHtml = String(htmlToLexicalJsonMock.mock.calls.at(-1)?.[0] || "");
    expect(importedHtml).toContain('data-epub-align="center"');
    expect(importedHtml).toContain("display:block");
  });

  it("descarta paginas somente com imagem no fallback do flow", async () => {
    epubState.flow = [{ id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" }];
    epubState.manifest = {
      chapter001: { id: "chapter001", title: "Chapter 1" },
    };
    epubState.chapters = {
      chapter001: '<img src="illustration.jpg" alt="illustration">',
    };

    const result = await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 1,
      defaultStatus: "draft",
      project: { episodeDownloads: [] },
    });

    expect(result.chapters).toHaveLength(0);
    expect(result.summary.chapters).toBe(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Imagem interna ignorada no capitulo "Chapter 1": illustration.jpg.',
        "Itens de boilerplate promovidos para extras: 1.",
      ]),
    );
    expect(htmlToLexicalJsonMock).not.toHaveBeenCalled();
  });

  it("preserva o status published quando um capitulo existente colide por numero + volume", async () => {
    epubState.toc = [
      { id: "chapter-toc", title: "Chapter 2", href: "OEBPS/Text/chapter002.xhtml#Ref_2" },
    ];
    epubState.flow = [{ id: "chapter002", title: "Chapter 2", href: "OEBPS/Text/chapter002.xhtml" }];
    epubState.manifest = {
      chapter002: { id: "chapter002", title: "Chapter 2" },
    };
    epubState.chapters = {
      chapter002: "<p>Capitulo atualizado</p>",
    };

    const result = await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 5,
      defaultStatus: "draft",
      project: {
        episodeDownloads: [
          {
            number: 2,
            volume: 5,
            title: "Chapter 2",
            publicationStatus: "published",
            chapterUpdatedAt: "2026-02-01T00:00:00.000Z",
          },
        ],
      },
    });

    expect(result.summary).toEqual({
      chapters: 1,
      mainImported: 1,
      extrasImported: 0,
      created: 0,
      updated: 1,
      volume: 5,
      imagesImported: 0,
      imageImportFailures: 0,
      boilerplatePromoted: 0,
      boilerplateDiscarded: 0,
      unresolvedTocEntries: 0,
      volumeCoverImported: false,
      volumeCoverSkipped: false,
    });
    expect(result.chapters[0]).toEqual(
      expect.objectContaining({
        number: 2,
        volume: 5,
        mergeMode: "update",
        publicationStatus: "published",
        episodeKey: "2:5",
      }),
    );
  });

  it("consolida o front matter inicial em um unico extra e mantem a capa do volume", async () => {
    const loadUploads = vi.fn(() => []);
    const writeUploads = vi.fn();

    epubState.toc = [
      { id: "chapter-1-toc", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml#Ref_1" },
      { id: "chapter-2-toc", title: "Chapter 2", href: "OEBPS/Text/chapter002.xhtml#Ref_2" },
    ];
    epubState.flow = [
      { id: "coverDoc", title: "Cover", href: "OEBPS/Text/cover.xhtml" },
      { id: "frontDoc", title: "Frontispiece", href: "OEBPS/Text/frontispiece.xhtml" },
      { id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" },
      { id: "chapter002", title: "Chapter 2", href: "OEBPS/Text/chapter002.xhtml" },
    ];
    epubState.manifest = {
      coverImage: {
        id: "coverImage",
        href: "OEBPS/Images/cover.jpg",
        "media-type": "image/jpeg",
        properties: "cover-image",
      },
      frontArt: {
        id: "frontArt",
        href: "OEBPS/Images/front-1.jpg",
        "media-type": "image/jpeg",
      },
      coverDoc: { id: "coverDoc", href: "OEBPS/Text/cover.xhtml" },
      frontDoc: { id: "frontDoc", href: "OEBPS/Text/frontispiece.xhtml" },
      chapter001: { id: "chapter001", href: "OEBPS/Text/chapter001.xhtml" },
      chapter002: { id: "chapter002", href: "OEBPS/Text/chapter002.xhtml" },
    };
    epubState.metadata = {
      title: "Livro teste",
      cover: "coverImage",
    };
    epubState.chapters = {
      coverDoc: '<p><img src="../Images/cover.jpg" alt="Volume cover"></p>',
      frontDoc: '<p><img src="../Images/front-1.jpg" alt="Frontispiece art"></p>',
      chapter001: "<p>Texto do capitulo 1.</p>",
      chapter002: "<p>Texto do capitulo 2.</p>",
    };
    epubState.images = {
      coverImage: Buffer.from("cover-image"),
      frontArt: Buffer.from("front-image"),
    };

    const result = await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 1,
      defaultStatus: "draft",
      project: { episodeDownloads: [], volumeCovers: [] },
      uploadsDir: "D:/dev/nekomorto/public/uploads",
      loadUploads,
      writeUploads,
      uploadUserId: "test-user",
    });
    expect(result.summary).toEqual(
      expect.objectContaining({
        chapters: 3,
        mainImported: 2,
        extrasImported: 1,
        imagesImported: 2,
        volumeCoverImported: true,
        volumeCoverSkipped: false,
      }),
    );
    expect(result.chapters.map((chapter) => chapter.entryKind)).toEqual(["extra", "main", "main"]);
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(["Cover", "Chapter 1", "Chapter 2"]);
    expect(result.chapters.map((chapter) => chapter.number)).toEqual([100000, 1, 2]);
    expect(result.volumeCovers).toEqual([
      expect.objectContaining({
        volume: 1,
        coverImageUrl: expect.stringContaining("/uploads/tmp/epub-imports/"),
        mergeMode: "create",
      }),
    ]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Capa do volume importada do EPUB para o volume 1.",
        "Front matter inicial consolidado em um unico extra: 2 item(ns).",
      ]),
    );
    expect(writeUploads).toHaveBeenCalledTimes(1);
  });

  it("consolida cover, color inserts, title page, copyrights e toc em um unico extra inicial", async () => {
    const loadUploads = vi.fn(() => []);
    const writeUploads = vi.fn();

    epubState.toc = [
      { id: "cover-toc", title: "Cover", href: "OEBPS/Text/CoverPage.html" },
      { id: "color-toc", title: "Color Inserts", href: "OEBPS/Text/section-0001.html" },
      { id: "title-toc", title: "Title Page", href: "OEBPS/Text/section-0002.html" },
      { id: "credits-toc", title: "Copyrights and Credits", href: "OEBPS/Text/section-0003.html" },
      { id: "toc-toc", title: "Table of Contents Page", href: "OEBPS/Text/section-0004.html" },
      { id: "chapter-toc", title: "Chapter 1", href: "OEBPS/Text/section-0005.html" },
      { id: "newsletter-toc", title: "Newsletter", href: "OEBPS/Text/newsletter.html" },
    ];
    epubState.flow = [
      { id: "coverDoc", title: "Cover", href: "OEBPS/Text/CoverPage.html" },
      { id: "colorDoc", href: "OEBPS/Text/section-0001.html" },
      { id: "titleDoc", href: "OEBPS/Text/section-0002.html" },
      { id: "creditsDoc", href: "OEBPS/Text/section-0003.html" },
      { id: "tocPageDoc", href: "OEBPS/Text/section-0004.html" },
      { id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/section-0005.html" },
      { id: "newsletterDoc", title: "Newsletter", href: "OEBPS/Text/newsletter.html" },
    ];
    epubState.manifest = {
      coverImage: {
        id: "coverImage",
        href: "OEBPS/Images/cover.jpg",
        "media-type": "image/jpeg",
        properties: "cover-image",
      },
      colorImage: {
        id: "colorImage",
        href: "OEBPS/Images/color-1.jpg",
        "media-type": "image/jpeg",
      },
      coverDoc: { id: "coverDoc", href: "OEBPS/Text/CoverPage.html" },
      colorDoc: { id: "colorDoc", href: "OEBPS/Text/section-0001.html" },
      titleDoc: { id: "titleDoc", href: "OEBPS/Text/section-0002.html" },
      creditsDoc: { id: "creditsDoc", href: "OEBPS/Text/section-0003.html" },
      tocPageDoc: { id: "tocPageDoc", href: "OEBPS/Text/section-0004.html" },
      chapter001: { id: "chapter001", href: "OEBPS/Text/section-0005.html" },
      newsletterDoc: { id: "newsletterDoc", href: "OEBPS/Text/newsletter.html" },
    };
    epubState.metadata = {
      title: "Livro teste",
      cover: "coverImage",
    };
    epubState.chapters = {
      coverDoc: '<p><img src="../Images/cover.jpg" alt="Volume cover"></p>',
      colorDoc: '<p><img src="../Images/color-1.jpg" alt="Color insert"></p>',
      titleDoc: "<p>Title Page</p>",
      creditsDoc: "<p>Copyrights and Credits</p>",
      tocPageDoc: "<p>Table of Contents Page</p>",
      chapter001: "<p>Narrativa principal.</p>",
      newsletterDoc: "<p>Newsletter signup</p>",
    };
    epubState.images = {
      coverImage: Buffer.from("cover-image"),
      colorImage: Buffer.from("color-image"),
    };

    const result = await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 1,
      defaultStatus: "draft",
      project: { episodeDownloads: [], volumeCovers: [] },
      uploadsDir: "D:/dev/nekomorto/public/uploads",
      loadUploads,
      writeUploads,
      uploadUserId: "test-user",
    });

    expect(result.summary).toEqual(
      expect.objectContaining({
        chapters: 2,
        mainImported: 1,
        extrasImported: 1,
        boilerplateDiscarded: 2,
      }),
    );
    expect(result.chapters.map((chapter) => chapter.entryKind)).toEqual(["extra", "main"]);
    expect(result.chapters[0]).toEqual(
      expect.objectContaining({
        title: "Cover",
        entryKind: "extra",
        entrySubtype: "extra",
      }),
    );
    expect(result.chapters[1]).toEqual(
      expect.objectContaining({
        title: "Chapter 1",
        entryKind: "main",
      }),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Front matter inicial consolidado em um unico extra: 5 item(ns).",
        "Itens de boilerplate ignorados: 2.",
      ]),
    );
    expect(htmlToLexicalJsonMock).toHaveBeenCalledTimes(2);
    expect(String(htmlToLexicalJsonMock.mock.calls[0]?.[0] || "")).toContain("Copyrights and Credits");
    expect(String(htmlToLexicalJsonMock.mock.calls[0]?.[0] || "")).toContain("Table of Contents Page");
    expect(String(htmlToLexicalJsonMock.mock.calls[0]?.[0] || "")).not.toContain("Newsletter signup");
  });

  it("usa documentHref no fallback CSS para item de front matter consolidado sem titulo", async () => {
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(JSDOM.prototype, "window");
    const windowGetterSpy = vi.spyOn(JSDOM.prototype, "window", "get").mockImplementation(function () {
      const nextWindow = originalWindowDescriptor?.get?.call(this);
      if (nextWindow && typeof nextWindow.getComputedStyle === "function") {
        nextWindow.getComputedStyle = () => {
          throw new Error(
            "Cannot destructure property 'value' of 'Specificity.max(...)' as it is undefined.",
          );
        };
      }
      return nextWindow;
    });
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      epubState.toc = [
        { id: "cover-toc", title: "", href: "OEBPS/Text/CoverPage.html" },
        { id: "chapter-toc", title: "Chapter 1", href: "OEBPS/Text/section-0006.html" },
      ];
      epubState.flow = [
        { id: "coverDoc", title: "", href: "OEBPS/Text/CoverPage.html" },
        { id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/section-0006.html" },
      ];
      epubState.manifest = {
        coverDoc: { id: "coverDoc", href: "OEBPS/Text/CoverPage.html" },
        chapter001: { id: "chapter001", href: "OEBPS/Text/section-0006.html" },
      };
      epubState.chapters = {
        coverDoc: '<p>Front matter sem titulo. <img src="../Images/cover.jpg" alt="cover"></p>',
        chapter001: "<p>Capitulo principal.</p>",
      };

      const result = await importProjectEpub({
        buffer: Buffer.from("fake"),
        targetVolume: 1,
        defaultStatus: "draft",
        project: { episodeDownloads: [] },
      });

      expect(result.summary.chapters).toBeGreaterThan(0);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          'Estilos CSS avancados foram ignorados no capitulo "OEBPS/Text/CoverPage.html"; importacao continuou sem estilos calculados.',
        ]),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "epub_import_editorial_css_fallback",
        expect.objectContaining({
          chapterTitle: "OEBPS/Text/CoverPage.html",
          documentHref: "OEBPS/Text/CoverPage.html",
        }),
      );
    } finally {
      consoleWarnSpy.mockRestore();
      windowGetterSpy.mockRestore();
    }
  });

  it("extrai a capa do volume do EPUB e preserva a cover como extra", async () => {
    const loadUploads = vi.fn(() => []);
    const writeUploads = vi.fn();

    epubState.toc = [
      { id: "chapter-toc", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml#Ref_1" },
    ];
    epubState.flow = [
      { id: "cover-doc", title: "Cover", href: "OEBPS/Text/cover.xhtml" },
      { id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" },
    ];
    epubState.manifest = {
      coverImage: {
        id: "coverImage",
        href: "OEBPS/Images/cover.jpg",
        "media-type": "image/jpeg",
        properties: "cover-image",
      },
      coverDoc: { id: "coverDoc", href: "OEBPS/Text/cover.xhtml" },
      chapter001: { id: "chapter001", href: "OEBPS/Text/chapter001.xhtml" },
    };
    epubState.metadata = {
      title: "Livro teste",
      cover: "coverImage",
    };
    epubState.chapters = {
      coverDoc: '<p><img src="../Images/cover.jpg" alt="Volume cover"></p>',
      chapter001: "<p>Capitulo 1.</p>",
    };
    epubState.images = {
      coverImage: Buffer.from("cover-image"),
    };

    const result = await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 1,
      defaultStatus: "draft",
      project: { episodeDownloads: [], volumeCovers: [] },
      uploadsDir: "D:/dev/nekomorto/public/uploads",
      loadUploads,
      writeUploads,
      uploadUserId: "test-user",
    });

    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0]).toEqual(
      expect.objectContaining({
        title: "Cover",
        entryKind: "extra",
      }),
    );
    expect(result.chapters[1]).toEqual(
      expect.objectContaining({
        title: "Chapter 1",
        entryKind: "main",
      }),
    );
    expect(result.summary.volumeCoverImported).toBe(true);
    expect(result.summary.volumeCoverSkipped).toBe(false);
    expect(result.volumeCovers).toEqual([
      expect.objectContaining({
        volume: 1,
        coverImageUrl: expect.stringContaining("/uploads/tmp/epub-imports/"),
        mergeMode: "create",
      }),
    ]);
    expect(result.warnings).toEqual(
      expect.arrayContaining(["Capa do volume importada do EPUB para o volume 1."]),
    );
    expect(writeUploads).toHaveBeenCalledTimes(1);
  });

  it("faz flush unico de uploads quando importa capa e imagem interna no mesmo EPUB", async () => {
    const loadUploads = vi.fn(() => []);
    const writeUploads = vi.fn();

    epubState.toc = [
      { id: "chapter-toc", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml#Ref_1" },
    ];
    epubState.flow = [
      { id: "cover-doc", title: "Cover", href: "OEBPS/Text/cover.xhtml" },
      { id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" },
    ];
    epubState.manifest = {
      coverImage: {
        id: "coverImage",
        href: "OEBPS/Images/cover.jpg",
        "media-type": "image/jpeg",
        properties: "cover-image",
      },
      coverDoc: { id: "coverDoc", href: "OEBPS/Text/cover.xhtml" },
      chapter001: { id: "chapter001", href: "OEBPS/Text/chapter001.xhtml" },
      art1: { id: "art1", href: "OEBPS/Images/art1.jpg", "media-type": "image/jpeg" },
    };
    epubState.metadata = {
      title: "Livro teste",
      cover: "coverImage",
    };
    epubState.chapters = {
      coverDoc: '<p><img src="../Images/cover.jpg" alt="Volume cover"></p>',
      chapter001: '<p><img src="../Images/art1.jpg" alt="Ilustracao"></p><p>Capitulo 1.</p>',
    };
    epubState.images = {
      coverImage: Buffer.from("cover-image"),
      art1: Buffer.from("chapter-image"),
    };

    const result = await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 1,
      defaultStatus: "draft",
      project: { episodeDownloads: [], volumeCovers: [] },
      uploadsDir: "D:/dev/nekomorto/public/uploads",
      loadUploads,
      writeUploads,
      uploadUserId: "test-user",
    });

    expect(result.summary.volumeCoverImported).toBe(true);
    expect(result.summary.imagesImported).toBe(2);
    expect(writeUploads).toHaveBeenCalledTimes(1);
    expect(writeUploads).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        awaitPersist: true,
        reason: "epub_import",
      }),
    );
  });

  it("propaga erro de persistencia de uploads com codigo especifico", async () => {
    const loadUploads = vi.fn(() => []);
    const writeUploads = vi.fn(async () => {
      throw new Error("tx_timeout");
    });

    epubState.toc = [
      { id: "chapter-toc", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml#Ref_1" },
    ];
    epubState.flow = [{ id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" }];
    epubState.manifest = {
      chapter001: { id: "chapter001", href: "OEBPS/Text/chapter001.xhtml" },
      art1: { id: "art1", href: "OEBPS/Images/art1.jpg", "media-type": "image/jpeg" },
    };
    epubState.chapters = {
      chapter001: '<p><img src="../Images/art1.jpg" alt="Ilustracao"></p><p>Capitulo 1.</p>',
    };
    epubState.images = {
      art1: Buffer.from("chapter-image"),
    };

    await expect(
      importProjectEpub({
        buffer: Buffer.from("fake"),
        targetVolume: 1,
        defaultStatus: "draft",
        project: { episodeDownloads: [] },
        uploadsDir: "D:/dev/nekomorto/public/uploads",
        loadUploads,
        writeUploads,
        uploadUserId: "test-user",
      }),
    ).rejects.toMatchObject({
      code: "epub_upload_persist_failed",
    });
    expect(writeUploads).toHaveBeenCalledTimes(1);
  });

  it("preserva capa manual existente do volume durante o import", async () => {
    epubState.toc = [
      { id: "chapter-toc", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml#Ref_1" },
    ];
    epubState.flow = [{ id: "chapter001", title: "Chapter 1", href: "OEBPS/Text/chapter001.xhtml" }];
    epubState.manifest = {
      coverImage: {
        id: "coverImage",
        href: "OEBPS/Images/cover.jpg",
        "media-type": "image/jpeg",
        properties: "cover-image",
      },
      chapter001: { id: "chapter001", href: "OEBPS/Text/chapter001.xhtml" },
    };
    epubState.metadata = {
      title: "Livro teste",
      cover: "coverImage",
    };
    epubState.chapters = {
      chapter001: "<p>Capitulo 1.</p>",
    };
    epubState.images = {
      coverImage: Buffer.from("cover-image"),
    };

    const result = await importProjectEpub({
      buffer: Buffer.from("fake"),
      targetVolume: 1,
      defaultStatus: "draft",
      project: {
        episodeDownloads: [],
        volumeCovers: [
          {
            volume: 1,
            coverImageUrl: "/uploads/projects/project-1/manual-cover.jpg",
            coverImageAlt: "Manual cover",
          },
        ],
      },
    });

    expect(result.summary.volumeCoverImported).toBe(false);
    expect(result.summary.volumeCoverSkipped).toBe(true);
    expect(result.volumeCovers).toEqual([
      expect.objectContaining({
        volume: 1,
        coverImageUrl: "/uploads/projects/project-1/manual-cover.jpg",
        coverImageAlt: "Manual cover",
        mergeMode: "preserve_existing",
      }),
    ]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Capa do volume preservada porque o volume 1 ja possui capa definida.",
      ]),
    );
  });

  it("aborta a importacao no primeiro capitulo invalido com contexto de capitulo", async () => {
    epubState.flow = [{ id: "broken", title: "Chapter 9", href: "OEBPS/Text/chapter009.xhtml" }];
    epubState.manifest = {
      broken: { id: "broken", title: "Chapter 9" },
    };
    epubState.chapters = {
      broken: "<p>Quebrado</p>",
    };
    htmlToLexicalJsonMock.mockImplementationOnce(() => {
      throw new Error("Only element or decorator nodes can be inserted to the root node");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      importProjectEpub({
        buffer: Buffer.from("fake"),
        targetVolume: 2,
        defaultStatus: "draft",
        project: { episodeDownloads: [] },
      }),
    ).rejects.toMatchObject({
      code: "epub_chapter_conversion_failed",
      chapterIndex: 1,
      chapterTitle: "Chapter 9",
      manifestId: "broken",
      causeMessage: "Only element or decorator nodes can be inserted to the root node",
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "epub_import_conversion_failed",
      expect.objectContaining({
        chapterIndex: 1,
        chapterTitle: "Chapter 9",
        manifestId: "broken",
      }),
    );
    consoleErrorSpy.mockRestore();
  });
});
