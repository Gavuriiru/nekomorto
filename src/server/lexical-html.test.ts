import { describe, expect, it } from "vitest";

import {
  EMPTY_LEXICAL_JSON,
  htmlToLexicalJson,
  normalizeLexicalJson,
  renderLexicalJsonToHtml,
} from "../../server/lib/lexical-html.js";

const getRootChildren = (serialized: string) =>
  JSON.parse(serialized).root.children as Array<Record<string, unknown>>;

describe("server lexical HTML bridge", () => {
  it("envolve texto solto em um paragrafo", () => {
    const serialized = htmlToLexicalJson("texto solto");
    const children = getRootChildren(serialized);

    expect(children).toHaveLength(1);
    expect(children[0]?.type).toBe("paragraph");
    expect(children[0]?.children).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "text", text: "texto solto" })]),
    );
  });

  it("envolve inline-only no topo em um paragrafo", () => {
    const serialized = htmlToLexicalJson("<strong>ola</strong><em>mundo</em>");
    const children = getRootChildren(serialized);
    const paragraphChildren = (children[0]?.children || []) as Array<Record<string, unknown>>;

    expect(children).toHaveLength(1);
    expect(children[0]?.type).toBe("paragraph");
    expect(paragraphChildren.map((node) => node.text)).toEqual(["ola", "mundo"]);
  });

  it("nao explode com br isolado", () => {
    const serialized = htmlToLexicalJson("<br>");
    const children = getRootChildren(serialized);

    expect(children).toHaveLength(1);
    expect(children[0]?.type).toBe("paragraph");
  });

  it("mantem blocos e encapsula inline solto depois deles", () => {
    const serialized = htmlToLexicalJson("<p>bloco</p><strong>solto</strong>");
    const children = getRootChildren(serialized);

    expect(children.map((node) => node.type)).toEqual(["paragraph", "paragraph"]);
    expect(children[1]?.children).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "text", text: "solto" })]),
    );
  });

  it("importa img com src publico como epub-image valido", () => {
    const serialized = htmlToLexicalJson(
      '<p>antes</p><img src="/uploads/tmp/epub-imports/test/image.jpg" alt="Ilustracao">',
    );
    const children = getRootChildren(serialized);

    expect(children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "paragraph" }),
        expect.objectContaining({
          type: "epub-image",
          src: "/uploads/tmp/epub-imports/test/image.jpg",
          altText: "Ilustracao",
        }),
      ]),
    );
  });

  it("mapeia imagem editorial estilizada para epub-image", () => {
    const serialized = htmlToLexicalJson(
      '<img src="/uploads/tmp/epub-imports/test/image.jpg" alt="Ornamento" style="width: 3em; height: 0.75em; vertical-align: middle">',
    );
    const children = getRootChildren(serialized);

    expect(children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "epub-image",
          src: "/uploads/tmp/epub-imports/test/image.jpg",
          altText: "Ornamento",
          editorialStyle: expect.stringContaining("width: 3em"),
        }),
      ]),
    );
    expect(String(children[0]?.editorialStyle || "")).toContain("vertical-align: middle");
  });

  it("preserva font-size inline em text nodes estilizados", () => {
    const serialized = htmlToLexicalJson('<span style="font-size: 1.5em">texto grande</span>');
    const children = getRootChildren(serialized);
    const textNode = ((children[0]?.children || []) as Array<Record<string, unknown>>)[0];

    expect(textNode).toEqual(
      expect.objectContaining({
        type: "text",
        text: "texto grande",
      }),
    );
    expect(String(textNode?.style || "")).toContain("font-size: 1.5em");
  });

  it("preserva font-size inline e formato italico em inline estilizado", () => {
    const serialized = htmlToLexicalJson('<em style="font-size: 1.5em">texto italico</em>');
    const children = getRootChildren(serialized);
    const textNode = ((children[0]?.children || []) as Array<Record<string, unknown>>)[0];

    expect(String(textNode?.style || "")).toContain("font-size: 1.5em");
    expect(Number(textNode?.format || 0)).toBeGreaterThan(0);
  });

  it("mapeia imagem block centralizada para epub-image com align", () => {
    const serialized = htmlToLexicalJson(
      '<img src="/uploads/tmp/epub-imports/test/image.jpg" alt="Ilustracao" style="display: block; max-width: 100%" data-epub-align="center">',
    );
    const children = getRootChildren(serialized);

    expect(children[0]).toEqual(
      expect.objectContaining({
        type: "epub-image",
        align: "center",
      }),
    );
  });

  it("mapeia paragrafo com estilo editorial para epub-paragraph", () => {
    const serialized = htmlToLexicalJson(
      '<epub-p style="text-indent: 20pt; margin-top: 1.5em; margin-bottom: 1em">texto editorial</epub-p>',
    );
    const children = getRootChildren(serialized);

    expect(children[0]).toEqual(
      expect.objectContaining({
        type: "epub-paragraph",
        editorialStyle: expect.stringContaining("text-indent: 20pt"),
      }),
    );
    expect(String(children[0]?.editorialStyle || "")).toContain("margin-top: 1.5em");
  });

  it("mapeia heading com estilo editorial para epub-heading", () => {
    const serialized = htmlToLexicalJson(
      '<h1 style="margin-top: 10%; margin-bottom: 3em; line-height: 1.2">Titulo</h1>',
    );
    const children = getRootChildren(serialized);

    expect(children[0]).toEqual(
      expect.objectContaining({
        type: "epub-heading",
        tag: "h1",
        editorialStyle: expect.stringContaining("margin-top: 10%"),
      }),
    );
    expect(String(children[0]?.editorialStyle || "")).toContain("margin-bottom: 3em");
  });

  it("mapeia data-epub-heading em bloco nao heading para epub-heading", () => {
    const serialized = htmlToLexicalJson(
      '<p data-epub-heading="h2" style="font-size: 2em; margin-top: 10%">Titulo heuristico</p>',
    );
    const children = getRootChildren(serialized);

    expect(children[0]).toEqual(
      expect.objectContaining({
        type: "epub-heading",
        tag: "h2",
      }),
    );
    expect(String(children[0]?.editorialStyle || "")).toContain("font-size: 2em");
  });

  it("retorna o estado vazio canonico para html vazio", () => {
    expect(JSON.parse(htmlToLexicalJson(""))).toEqual(JSON.parse(EMPTY_LEXICAL_JSON));
  });

  it("normaliza root vazio para o estado vazio canonico", () => {
    expect(
      normalizeLexicalJson(
        JSON.stringify({
          root: {
            children: [],
            direction: null,
            format: "",
            indent: 0,
            type: "root",
            version: 1,
          },
        }),
      ),
    ).toBe(EMPTY_LEXICAL_JSON);
  });

  it("nao explode ao renderizar lexical json invalido", () => {
    expect(renderLexicalJsonToHtml("{")).toBe("");
  });
});
