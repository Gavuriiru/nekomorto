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

  it("importa img com src publico como image node valido", () => {
    const serialized = htmlToLexicalJson('<p>antes</p><img src="/uploads/tmp/epub-imports/test/image.jpg" alt="Ilustracao">');
    const children = getRootChildren(serialized);

    expect(children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "paragraph" }),
        expect.objectContaining({
          type: "image",
          src: "/uploads/tmp/epub-imports/test/image.jpg",
          altText: "Ilustracao",
        }),
      ]),
    );
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
