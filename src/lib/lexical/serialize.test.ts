import { describe, expect, it } from "vitest";

import {
  EMPTY_LEXICAL_JSON,
  htmlToLexicalJson,
  normalizeLexicalJson,
} from "@/lib/lexical/serialize";

const createTextNode = (type: string, text: string) => ({
  detail: 0,
  format: 0,
  mode: "normal",
  style: "",
  text,
  type,
  version: 1,
});

const wrapInParagraph = (child: Record<string, unknown>) =>
  JSON.stringify({
    root: {
      children: [
        {
          children: [child],
          direction: null,
          format: "",
          indent: 0,
          textFormat: 0,
          textStyle: "",
          type: "paragraph",
          version: 1,
        },
      ],
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });

describe("client lexical serialize", () => {
  it("normaliza um estado com keyword node", () => {
    const normalized = normalizeLexicalJson(wrapInParagraph(createTextNode("keyword", "keyword")));

    expect(normalized).not.toBeNull();
    expect(JSON.parse(String(normalized)).root.children[0].children[0].type).toBe("keyword");
  });

  it("normaliza um estado com specialText node", () => {
    const normalized = normalizeLexicalJson(
      wrapInParagraph(createTextNode("specialText", "bracketed")),
    );

    expect(normalized).not.toBeNull();
    expect(JSON.parse(String(normalized)).root.children[0].children[0].type).toBe("specialText");
  });

  it("mantem o fallback canonico para root vazio", () => {
    const normalized = normalizeLexicalJson(
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
    );

    expect(normalized).toBe(EMPTY_LEXICAL_JSON);
  });

  it("normaliza um estado com image node serializado", () => {
    const normalized = normalizeLexicalJson(
      JSON.stringify({
        root: {
          children: [
            {
              altText: "Ilustracao",
              src: "/uploads/tmp/epub-imports/test/image.jpg",
              type: "image",
              version: 1,
            },
          ],
          direction: null,
          format: "",
          indent: 0,
          type: "root",
          version: 1,
        },
      }),
    );

    expect(normalized).not.toBeNull();
    expect(JSON.parse(String(normalized)).root.children[0].type).toBe("image");
  });

  it("normaliza um estado com epub-image node serializado", () => {
    const normalized = normalizeLexicalJson(
      JSON.stringify({
        root: {
          children: [
            {
              align: "center",
              altText: "Ornamento",
              editorialStyle: "width: 3em; height: 0.75em; vertical-align: middle",
              src: "/uploads/tmp/epub-imports/test/image.jpg",
              type: "epub-image",
              version: 1,
            },
          ],
          direction: null,
          format: "",
          indent: 0,
          type: "root",
          version: 1,
        },
      }),
    );

    expect(normalized).not.toBeNull();
    expect(JSON.parse(String(normalized)).root.children[0].type).toBe("epub-image");
    expect(JSON.parse(String(normalized)).root.children[0].align).toBe("center");
  });

  it("normaliza um estado com epub-paragraph node serializado", () => {
    const normalized = normalizeLexicalJson(
      JSON.stringify({
        root: {
          children: [
            {
              children: [createTextNode("text", "texto editorial")],
              direction: null,
              editorialStyle: "font-size: 1.4em; text-indent: 20pt; margin-top: 1.5em",
              format: "",
              indent: 0,
              textFormat: 0,
              textStyle: "",
              type: "epub-paragraph",
              version: 1,
            },
          ],
          direction: null,
          format: "",
          indent: 0,
          type: "root",
          version: 1,
        },
      }),
    );

    expect(normalized).not.toBeNull();
    expect(JSON.parse(String(normalized)).root.children[0].type).toBe("epub-paragraph");
    expect(String(JSON.parse(String(normalized)).root.children[0].editorialStyle)).toContain(
      "font-size: 1.4em",
    );
  });

  it("normaliza um estado com epub-heading node serializado", () => {
    const normalized = normalizeLexicalJson(
      JSON.stringify({
        root: {
          children: [
            {
              children: [createTextNode("text", "Titulo editorial")],
              direction: null,
              editorialStyle: "font-size: 2em; margin-top: 10%; margin-bottom: 3em",
              format: "",
              indent: 0,
              tag: "h1",
              type: "epub-heading",
              version: 1,
            },
          ],
          direction: null,
          format: "",
          indent: 0,
          type: "root",
          version: 1,
        },
      }),
    );

    expect(normalized).not.toBeNull();
    expect(JSON.parse(String(normalized)).root.children[0].type).toBe("epub-heading");
    expect(String(JSON.parse(String(normalized)).root.children[0].editorialStyle)).toContain(
      "font-size: 2em",
    );
  });

  it("preserva font-size inline ao converter html para lexical", () => {
    const serialized = htmlToLexicalJson('<span style="font-size: 1.5em">texto grande</span>');
    const textNode = JSON.parse(serialized).root.children[0].children[0];

    expect(textNode.type).toBe("text");
    expect(String(textNode.style || "")).toContain("font-size: 1.5em");
  });

  it("preserva font-size inline e italico ao converter html para lexical", () => {
    const serialized = htmlToLexicalJson('<em style="font-size: 1.5em">texto italico</em>');
    const textNode = JSON.parse(serialized).root.children[0].children[0];

    expect(String(textNode.style || "")).toContain("font-size: 1.5em");
    expect(Number(textNode.format || 0)).toBeGreaterThan(0);
  });
});
