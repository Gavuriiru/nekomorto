import { describe, expect, it } from "vitest";

import { EMPTY_LEXICAL_JSON, normalizeLexicalJson } from "@/lib/lexical/serialize";

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
});
