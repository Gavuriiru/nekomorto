import { describe, expect, it } from "vitest";

import { buildSchemaOrgPayload, serializeSchemaOrgEntry } from "../../server/lib/schema-org.js";

const settingsFixture = {
  site: {
    name: "Nekomata",
    description: "Descricao do site",
    faviconUrl: "/favicon.ico",
    defaultShareImage: "/uploads/shared/default.jpg",
  },
  branding: {
    assets: {
      symbolUrl: "/uploads/branding/symbol.png",
      wordmarkUrl: "",
    },
  },
  footer: {
    socialLinks: [
      { label: "Discord", href: "https://discord.gg/nekomata" },
      { label: "Twitter", href: "https://x.com/nekomata" },
    ],
  },
};

describe("schema.org payload", () => {
  it("gera schemas core e Article para rota de postagem", () => {
    const post = {
      title: "Titulo do post",
      seoTitle: "",
      excerpt: "Resumo do post",
      content: "<p>Conteudo</p>",
      author: "Equipe",
      publishedAt: "2026-02-10T10:00:00.000Z",
      updatedAt: "2026-02-11T10:00:00.000Z",
      coverImageUrl: "/uploads/posts/capa.jpg",
      tags: ["acao", "drama"],
    };
    const payload = buildSchemaOrgPayload({
      origin: "https://nekomata.moe",
      pathname: "/postagem/titulo-do-post",
      canonicalUrl: "https://nekomata.moe/postagem/titulo-do-post",
      settings: settingsFixture,
      pages: {},
      post,
    });

    expect(payload.some((entry) => entry["@type"] === "Organization")).toBe(true);
    expect(payload.some((entry) => entry["@type"] === "WebSite")).toBe(true);
    expect(payload.some((entry) => entry["@type"] === "BreadcrumbList")).toBe(true);

    const article = payload.find((entry) => entry["@type"] === "Article");
    expect(article).toBeDefined();
    expect(article?.headline).toBe("Titulo do post");
    expect(article?.datePublished).toBe("2026-02-10T10:00:00.000Z");
    expect(article?.keywords).toBe("acao, drama");
  });

  it("gera FAQPage para /faq com perguntas e respostas", () => {
    const payload = buildSchemaOrgPayload({
      origin: "https://nekomata.moe",
      pathname: "/faq",
      canonicalUrl: "https://nekomata.moe/faq",
      settings: settingsFixture,
      pages: {
        faq: {
          groups: [
            {
              items: [
                { question: "Pergunta 1", answer: "Resposta 1" },
                { question: "Pergunta 2", answer: "<b>Resposta 2</b>" },
              ],
            },
          ],
        },
      },
    });

    const faq = payload.find((entry) => entry["@type"] === "FAQPage");
    expect(faq).toBeDefined();
    expect(faq?.mainEntity).toHaveLength(2);
    expect(faq?.mainEntity?.[1]?.acceptedAnswer?.text).toBe("Resposta 2");
  });

  it("nao gera schema para rotas noindex do dashboard", () => {
    const payload = buildSchemaOrgPayload({
      origin: "https://nekomata.moe",
      pathname: "/dashboard/configuracoes",
      canonicalUrl: "https://nekomata.moe/dashboard/configuracoes",
      settings: settingsFixture,
      pages: {},
    });
    expect(payload).toEqual([]);
  });
});

describe("schema.org serialization", () => {
  it("escapa caracteres de fechamento de script", () => {
    const serialized = serializeSchemaOrgEntry({
      "@context": "https://schema.org",
      text: "</script><script>alert(1)</script>",
    });
    expect(serialized).toContain("\\u003c/script>");
    expect(serialized).not.toContain("</script>");
  });
});
