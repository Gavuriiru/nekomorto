import { describe, expect, it } from "vitest";

import {
  extractFirstImageFromPostContent,
  getImageFileNameFromUrl,
  resolvePostCoverPreview,
} from "@/lib/post-cover";

const lexicalWithNestedImages = JSON.stringify({
  root: {
    type: "root",
    version: 1,
    children: [
      {
        type: "paragraph",
        version: 1,
        children: [{ type: "text", version: 1, text: "Intro" }],
      },
      {
        type: "paragraph",
        version: 1,
        children: [
          {
            type: "link",
            version: 1,
            url: "https://example.com",
            children: [
              {
                type: "image",
                version: 1,
                src: "/uploads/primeira-capa.png",
                altText: "Primeira imagem",
              },
            ],
          },
        ],
      },
      {
        type: "image",
        version: 1,
        src: "/uploads/segunda-capa.png",
        altText: "Segunda imagem",
      },
    ],
  },
});

describe("post-cover helpers", () => {
  it("extrai a primeira imagem lexical em DFS, inclusive aninhada", () => {
    const extracted = extractFirstImageFromPostContent(lexicalWithNestedImages, "lexical");
    expect(extracted).toEqual({
      coverImageUrl: "/uploads/primeira-capa.png",
      coverAlt: "Primeira imagem",
    });
  });

  it("mantem prioridade da capa manual sobre fallback do conteudo", () => {
    const resolved = resolvePostCoverPreview({
      title: "Post",
      coverImageUrl: "/uploads/capa-manual.jpg",
      coverAlt: "Capa manual",
      content: lexicalWithNestedImages,
      contentFormat: "lexical",
    });

    expect(resolved).toEqual({
      coverImageUrl: "/uploads/capa-manual.jpg",
      coverAlt: "Capa manual",
      source: "manual",
    });
  });

  it("ignora data/blob e pega a primeira imagem valida", () => {
    const lexicalWithInvalidFirst = JSON.stringify({
      root: {
        type: "root",
        version: 1,
        children: [
          {
            type: "image",
            version: 1,
            src: "data:image/png;base64,AAA",
            altText: "Data URI",
          },
          {
            type: "image",
            version: 1,
            src: "/uploads/lexical-valida.png",
            altText: "Valida",
          },
        ],
      },
    });

    const lexical = extractFirstImageFromPostContent(lexicalWithInvalidFirst, "lexical");
    const html = extractFirstImageFromPostContent(
      '<img src="blob:https://site.local/abc" alt="blob"><img src="/uploads/html-valida.png" alt="HTML">',
      "html",
    );
    const markdown = extractFirstImageFromPostContent(
      "![blob](blob:https://site.local/123) ![OK](/uploads/markdown-valida.png)",
      "markdown",
    );

    expect(lexical?.coverImageUrl).toBe("/uploads/lexical-valida.png");
    expect(html?.coverImageUrl).toBe("/uploads/html-valida.png");
    expect(markdown?.coverImageUrl).toBe("/uploads/markdown-valida.png");
  });

  it("retorna null para conteudo lexical invalido", () => {
    const extracted = extractFirstImageFromPostContent("{conteudo-invalido", "lexical");
    expect(extracted).toBeNull();
  });

  it("extrai nome de arquivo de URL absoluta e relativa", () => {
    expect(getImageFileNameFromUrl("https://cdn.site.dev/uploads/capa%20final.webp?x=1#y")).toBe(
      "capa final.webp",
    );
    expect(getImageFileNameFromUrl("/uploads/imagem-teste.png")).toBe("imagem-teste.png");
  });
});
