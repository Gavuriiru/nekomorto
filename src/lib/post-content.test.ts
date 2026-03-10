import { describe, expect, it } from "vitest";

import {
  createSlug,
  estimateReadTime,
  getLexicalText,
  safeParseLexicalJson,
} from "@/lib/post-content";

const buildLexicalJson = (children: unknown[]) =>
  JSON.stringify({
    root: {
      type: "root",
      version: 1,
      children,
    },
  });

describe("post-content helpers", () => {
  it("mantem o comportamento atual de slug", () => {
    expect(createSlug("  Meu Post 2026!!!  ")).toBe("meu-post-2026");
  });

  it("valida json lexical sem alterar a assinatura publica", () => {
    const lexical = buildLexicalJson([]);
    expect(safeParseLexicalJson(lexical)).toBe(lexical);
    expect(safeParseLexicalJson("{invalido")).toBeNull();
  });

  it("extrai texto legivel de conteudo lexical aninhado", () => {
    const lexical = buildLexicalJson([
      {
        type: "heading",
        version: 1,
        children: [{ type: "text", version: 1, text: "Titulo" }],
      },
      {
        type: "paragraph",
        version: 1,
        children: [
          { type: "text", version: 1, text: "Primeira linha" },
          { type: "linebreak", version: 1 },
          { type: "text", version: 1, text: "continua" },
          { type: "tab", version: 1 },
          { type: "text", version: 1, text: "aqui" },
        ],
      },
      {
        type: "list",
        version: 1,
        listType: "bullet",
        children: [
          {
            type: "listitem",
            version: 1,
            children: [
              {
                type: "paragraph",
                version: 1,
                children: [{ type: "text", version: 1, text: "Item 1" }],
              },
            ],
          },
          {
            type: "listitem",
            version: 1,
            children: [
              {
                type: "paragraph",
                version: 1,
                children: [{ type: "text", version: 1, text: "Item 2" }],
              },
            ],
          },
        ],
      },
    ]);

    expect(getLexicalText(lexical)).toBe("Titulo\nPrimeira linha\ncontinua aqui\nItem 1\nItem 2");
  });

  it("retorna string vazia para json invalido", () => {
    expect(getLexicalText("{conteudo-invalido")).toBe("");
  });

  it("serializa folhas decoradas com equivalentes textuais", () => {
    const lexical = buildLexicalJson([
      { type: "equation", version: 1, equation: "E = mc^2", inline: false },
      { type: "tweet", version: 1, id: "12345" },
      { type: "youtube", version: 1, videoID: "abc123" },
    ]);

    expect(getLexicalText(lexical)).toBe(
      "E = mc^2\nhttps://x.com/i/web/status/12345\nhttps://www.youtube.com/watch?v=abc123",
    );
  });

  it("mantem no minimo um minuto de leitura", () => {
    const lexical = buildLexicalJson([
      {
        type: "paragraph",
        version: 1,
        children: [{ type: "text", version: 1, text: "Pouco texto" }],
      },
    ]);

    expect(estimateReadTime(lexical)).toBe("1 min de leitura");
  });
});
