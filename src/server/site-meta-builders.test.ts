import { describe, expect, it } from "vitest";

import {
  createSiteMetaBuilders,
  getPageTitleFromPath,
} from "../../server/lib/site-meta-builders.js";

describe("site meta builders", () => {
  it("maps dashboard paths with UTF-8 labels", () => {
    expect(getPageTitleFromPath("/dashboard/paginas")).toBe("Páginas");
    expect(getPageTitleFromPath("/dashboard/comentarios")).toBe("Comentários");
    expect(getPageTitleFromPath("/desconhecido")).toBe("");
  });

  it("builds post meta with the configured origin and fallback site name", () => {
    const { buildPostMeta, buildSiteMetaWithSettings } = createSiteMetaBuilders({
      buildInstitutionalOgImageAlt: () => "Alt institucional",
      buildInstitutionalOgRevisionValue: () => "institutional-rev",
      buildPostOgImageAlt: (title) => `Card do post ${title}`,
      buildPostOgRevision: () => "post-rev",
      buildProjectOgRevision: () => "project-rev",
      buildProjectReadingOgCardModel: () => null,
      buildProjectReadingOgRevisionValue: () => "reading-rev",
      buildVersionedInstitutionalOgImagePath: () => "/api/og/institutional/sobre",
      buildVersionedPostOgImagePath: ({ slug, revision }) => `/api/og/post/${slug}?v=${revision}`,
      buildVersionedProjectOgImagePath: ({ projectId, revision }) =>
        `/api/og/project/${projectId}?v=${revision}`,
      buildVersionedProjectReadingOgImagePath: () => "/api/og/reading/project-1",
      extractFirstImageFromPostContent: () => null,
      loadPages: () => [],
      loadSiteSettings: () => ({
        site: {
          name: "Nekomata",
          description: "Descrição padrão",
          faviconUrl: "/favicon.ico",
        },
      }),
      loadTagTranslations: () => ({ tags: {}, genres: {} }),
      primaryAppOrigin: "https://nekomata.moe",
      resolveInstitutionalOgPagePath: (pageKey) => `/${pageKey}`,
      resolveInstitutionalOgPageTitle: () => "",
      resolveInstitutionalOgSupportText: () => "",
      resolveMetaImageVariantUrl: (value) => value,
      resolvePostCover: () => ({ coverImageUrl: "/uploads/post.jpg" }),
      truncateMetaDescription: (value) => String(value || "").trim(),
    });

    expect(getPageTitleFromPath("/")).toBe("");

    expect(
      buildSiteMetaWithSettings({
        site: { name: "Nekomata", description: "Descrição", faviconUrl: "/favicon.ico" },
      }),
    ).toEqual({
      title: "Nekomata",
      description: "Descrição",
      image: "",
      imageAlt: "",
      url: "https://nekomata.moe/",
      type: "website",
      siteName: "Nekomata",
      favicon: "/favicon.ico",
    });

    expect(
      buildPostMeta({
        slug: "post-teste",
        title: "Post Teste",
        seoTitle: "Título SEO",
        seoDescription: "Resumo SEO",
        content: "<p>Resumo do post</p>",
      }),
    ).toEqual({
      title: "Título SEO | Nekomata",
      description: "Resumo SEO",
      image: "/api/og/post/post-teste?v=post-rev",
      imageAlt: "Card do post Post Teste",
      url: "https://nekomata.moe/postagem/post-teste",
      type: "article",
      siteName: "Nekomata",
      favicon: "/favicon.ico",
    });
  });
});
