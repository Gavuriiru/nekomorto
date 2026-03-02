import { describe, expect, it } from "vitest";

import {
  chapterContentToPlainText,
  deriveChapterSynopsis,
} from "../../server/lib/chapter-synopsis.js";

describe("chapter synopsis helper", () => {
  it("preserves explicit synopsis when present", () => {
    expect(
      deriveChapterSynopsis({
        synopsis: "Resumo manual",
        content:
          '{"root":{"children":[{"type":"paragraph","children":[{"type":"text","text":"Conteudo lexical","version":1}],"version":1}],"type":"root","version":1}}',
      }),
    ).toBe("Resumo manual");
  });

  it("extracts plain text from lexical json content", () => {
    const lexicalContent = JSON.stringify({
      root: {
        type: "root",
        version: 1,
        children: [
          {
            type: "paragraph",
            version: 1,
            children: [
              { type: "text", version: 1, text: "Primeira linha" },
              { type: "linebreak", version: 1 },
              { type: "text", version: 1, text: "Segunda linha" },
            ],
          },
        ],
      },
    });

    expect(chapterContentToPlainText(lexicalContent)).toBe("Primeira linha Segunda linha");
    expect(deriveChapterSynopsis({ content: lexicalContent })).toBe("Primeira linha Segunda linha");
  });

  it("keeps legacy html and markdown cleanup working", () => {
    expect(chapterContentToPlainText("**Oi** <strong>mundo</strong>")).toBe("Oi mundo");
  });

  it("truncates derived synopsis to the requested maximum length", () => {
    expect(deriveChapterSynopsis({ content: "abcdefghijklmnopqrstuvwxyz" }, 10)).toBe("abcdefg...");
  });
});
