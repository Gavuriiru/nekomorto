import { describe, expect, it } from "vitest";

import { createAbsoluteUrlResolver, createMetaHtmlRenderer } from "../../server/lib/meta-html.js";

describe("meta html", () => {
  it("injects title, canonical url, og image and structured data", () => {
    const getIndexHtml = () =>
      "<!doctype html><html><head><title>Base</title></head><body></body></html>";
    const toAbsoluteUrl = createAbsoluteUrlResolver({
      origin: "https://nekomata.moe",
    });
    const { renderMetaHtml } = createMetaHtmlRenderer({
      getIndexHtml,
      primaryAppOrigin: "https://nekomata.moe",
      resolveMetaImageVariantUrl: (value) => value,
      serializeSchemaOrgEntry: JSON.stringify,
      toAbsoluteUrl,
      truncateMetaDescription: (value) => String(value || "").trim(),
    });

    const html = renderMetaHtml({
      title: "Projeto Teste",
      description: "Descrição curta",
      image: "/uploads/share.png",
      imageAlt: "Capa",
      url: "https://nekomata.moe/projeto/teste",
      siteName: "Nekomata",
      structuredData: [{ "@type": "WebPage", name: "Projeto Teste" }],
    });

    expect(html).toContain("<title>Projeto Teste</title>");
    expect(html).toContain('property="og:image" content="https://nekomata.moe/uploads/share.png"');
    expect(html).toContain('<link rel="canonical" href="https://nekomata.moe/projeto/teste" />');
    expect(html).toContain('data-schema-org="true"');
  });
});
