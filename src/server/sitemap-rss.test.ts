import { describe, expect, it } from "vitest";

import { buildSitemapXml } from "../../server/lib/sitemap-xml.js";
import { buildRssXml } from "../../server/lib/rss-xml.js";

describe("sitemap xml", () => {
  it("gera sitemap com entradas e escape de xml", () => {
    const xml = buildSitemapXml([
      {
        loc: "https://example.com/projeto/abc",
        lastmod: "2026-02-26T10:00:00.000Z",
        changefreq: "daily",
        priority: 0.8,
      },
      {
        loc: "https://example.com/postagem/x?ignored=1&x=2",
      },
    ]);

    expect(xml).toContain("<urlset");
    expect(xml).toContain("<loc>https://example.com/projeto/abc</loc>");
    expect(xml).toContain("<changefreq>daily</changefreq>");
    expect(xml).toContain("<priority>0.8</priority>");
    expect(xml).toContain("ignored=1&amp;x=2");
  });
});

describe("rss xml", () => {
  it("gera feed rss com itens e atom self", () => {
    const xml = buildRssXml({
      title: "Feed",
      link: "https://example.com",
      description: "Descricao",
      selfUrl: "https://example.com/rss/posts.xml",
      items: [
        {
          title: "Post 1",
          link: "https://example.com/postagem/post-1",
          guid: "https://example.com/postagem/post-1",
          pubDate: "2026-02-26T10:00:00.000Z",
          description: "Resumo <teste>",
          categories: ["A", "B"],
        },
      ],
    });

    expect(xml).toContain("<rss");
    expect(xml).toContain("atom:link");
    expect(xml).toContain("<title>Post 1</title>");
    expect(xml).toContain("<description>Resumo &lt;teste&gt;</description>");
    expect(xml).toContain("<category>A</category>");
    expect(xml).toContain("<guid isPermaLink=\"true\">https://example.com/postagem/post-1</guid>");
  });
});

