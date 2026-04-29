import { extractPlainTextFromHtml } from "./html-safety.js";

export const stripHtml = (value) => extractPlainTextFromHtml(value);

export const getPageTitleFromPath = (value) => {
  const pathValue = String(value || "/");
  const rules = [
    [/^\/$/, ""],
    [/^\/postagem\/.+/, "Postagem"],
    [/^\/equipe\/?$/, "Equipe"],
    [/^\/sobre\/?$/, "Sobre"],
    [/^\/doacoes\/?$/, "Doações"],
    [/^\/faq\/?$/, "FAQ"],
    [/^\/projetos\/?$/, "Projetos"],
    [/^\/projeto\/.+\/leitura\/.+/, "Leitura"],
    [/^\/projeto\/.+/, "Projeto"],
    [/^\/projetos\/.+\/leitura\/.+/, "Leitura"],
    [/^\/projetos\/.+/, "Projeto"],
    [/^\/recrutamento\/?$/, "Recrutamento"],
    [/^\/login\/?$/, "Login"],
    [/^\/dashboard\/usuarios\/?$/, "Usuários"],
    [/^\/dashboard\/posts\/?$/, "Posts"],
    [/^\/dashboard\/projetos\/?$/, "Projetos"],
    [/^\/dashboard\/comentarios\/?$/, "Comentários"],
    [/^\/dashboard\/paginas\/?$/, "Páginas"],
    [/^\/dashboard\/configuracoes\/?$/, "Configurações"],
    [/^\/dashboard\/redirecionamentos\/?$/, "Redirecionamentos"],
    [/^\/dashboard\/?$/, "Dashboard"],
  ];
  const match = rules.find(([regex]) => regex.test(pathValue));
  return match ? match[1] : "";
};

export const createSiteMetaBuilders = ({
  buildInstitutionalOgImageAlt,
  buildInstitutionalOgRevisionValue,
  buildPostOgImageAlt,
  buildPostOgRevision,
  buildProjectOgRevision,
  buildProjectReadingOgCardModel,
  buildProjectReadingOgRevisionValue,
  buildVersionedInstitutionalOgImagePath,
  buildVersionedPostOgImagePath,
  buildVersionedProjectOgImagePath,
  buildVersionedProjectReadingOgImagePath,
  extractFirstImageFromPostContent,
  loadPages,
  loadSiteSettings,
  loadTagTranslations,
  primaryAppOrigin,
  resolveInstitutionalOgPagePath,
  resolveInstitutionalOgPageTitle,
  resolveInstitutionalOgSupportText,
  resolveMetaImageVariantUrl,
  resolvePostCover,
  truncateMetaDescription,
}) => {
  const buildSiteMetaWithSettings = (settings) => {
    const siteName = settings.site?.name || "Nekomata";
    return {
      title: siteName,
      description: truncateMetaDescription(
        settings.site?.description ||
          "Nekomata é uma fansub e scan feita por fãs, com traduções cuidadosas, carinho pela comunidade e respeito aos autores.",
      ),
      image: settings.site?.defaultShareImage || "",
      imageAlt: settings.site?.defaultShareImageAlt || "",
      url: `${primaryAppOrigin}/`,
      type: "website",
      siteName,
      favicon: settings.site?.faviconUrl || "",
    };
  };

  const buildInstitutionalPageMeta = (
    pageKey,
    { settings = loadSiteSettings(), pages = loadPages() } = {},
  ) => {
    const resolvedPageKey = String(pageKey || "").trim();
    const titleText = resolveInstitutionalOgPageTitle(resolvedPageKey);
    if (!titleText) {
      return buildSiteMetaWithSettings(settings);
    }

    const siteName = settings.site?.name || "Nekomata";
    const separator = settings.site?.titleSeparator || " | ";
    const description = truncateMetaDescription(
      resolveInstitutionalOgSupportText({
        pageKey: resolvedPageKey,
        pages,
        settings,
      }) ||
        settings.site?.description ||
        "",
    );
    const imageRevision = buildInstitutionalOgRevisionValue({
      pageKey: resolvedPageKey,
      pages,
      settings,
    });
    const image = buildVersionedInstitutionalOgImagePath({
      pageKey: resolvedPageKey,
      revision: imageRevision,
    });

    return {
      title: `${titleText}${separator}${siteName}`,
      description,
      image,
      imageAlt: buildInstitutionalOgImageAlt(resolvedPageKey),
      url: `${primaryAppOrigin}${resolveInstitutionalOgPagePath(resolvedPageKey)}`,
      type: "website",
      siteName,
      favicon: settings.site?.faviconUrl || "",
    };
  };

  const buildProjectMeta = (
    project,
    { settings = loadSiteSettings(), translations = loadTagTranslations() } = {},
  ) => {
    const siteName = settings.site?.name || "Nekomata";
    const title = project?.title ? `${project.title} | ${siteName}` : siteName;
    const description = truncateMetaDescription(
      stripHtml(project?.synopsis || project?.description || "") ||
        settings.site?.description ||
        "",
    );
    const imageRevision = buildProjectOgRevision({
      project,
      settings,
      translations,
      origin: primaryAppOrigin,
      resolveVariantUrl: resolveMetaImageVariantUrl,
    });
    const image = buildVersionedProjectOgImagePath({
      projectId: project?.id || "",
      revision: imageRevision,
    });
    const imageAlt = `Card de compartilhamento do projeto ${String(project?.title || "Projeto").trim() || "Projeto"}`;

    return {
      title,
      description,
      image,
      imageAlt,
      url: `${primaryAppOrigin}/projeto/${project?.id || ""}`,
      type: "article",
      siteName,
      favicon: settings.site?.faviconUrl || "",
    };
  };

  const buildProjectReadingMeta = (
    project,
    {
      chapterNumber,
      volume,
      settings = loadSiteSettings(),
      translations = loadTagTranslations(),
    } = {},
  ) => {
    const model = buildProjectReadingOgCardModel({
      project,
      chapterNumber,
      volume,
      settings,
      tagTranslations: translations?.tags,
      genreTranslations: translations?.genres,
      origin: primaryAppOrigin,
      resolveVariantUrl: resolveMetaImageVariantUrl,
    });
    if (!model) {
      return null;
    }

    const siteName = settings.site?.name || "Nekomata";
    const title = model?.seoTitle ? `${model.seoTitle} | ${siteName}` : siteName;
    const description = truncateMetaDescription(
      stripHtml(model?.seoDescription || "") || settings.site?.description || "",
    );
    const imageRevision = buildProjectReadingOgRevisionValue({
      project,
      chapterNumber,
      volume,
      settings,
      translations,
    });
    const image = buildVersionedProjectReadingOgImagePath({
      projectId: project?.id || "",
      chapterNumber: model.chapterNumberResolved ?? chapterNumber,
      volume: model.volumeResolved,
      revision: imageRevision,
    });
    const volumeQuery = Number.isFinite(Number(model.volumeResolved))
      ? `?volume=${encodeURIComponent(String(model.volumeResolved))}`
      : "";

    return {
      title,
      description,
      image,
      imageAlt:
        String(model?.imageAlt || "").trim() ||
        `Card de compartilhamento da leitura de ${String(project?.title || "Projeto").trim() || "Projeto"}`,
      url: `${primaryAppOrigin}/projeto/${encodeURIComponent(String(project?.id || "").trim())}/leitura/${encodeURIComponent(String(model.chapterNumberResolved ?? chapterNumber))}${volumeQuery}`,
      type: "article",
      siteName,
      favicon: settings.site?.faviconUrl || "",
      robots: "noindex, nofollow",
    };
  };

  const buildPostMeta = (post) => {
    const settings = loadSiteSettings();
    const siteName = settings.site?.name || "Nekomata";
    const titleText = stripHtml(post?.seoTitle || post?.title || "");
    const title = titleText ? `${titleText} | ${siteName}` : siteName;
    const description = truncateMetaDescription(
      stripHtml(post?.seoDescription || post?.excerpt || post?.content || "") ||
        settings.site?.description ||
        "",
    );
    const resolvedCover = resolvePostCover(post);
    const firstPostImage = extractFirstImageFromPostContent(post?.content, post?.contentFormat);
    const imageRevision = buildPostOgRevision({
      post,
      settings,
      coverImageUrl: resolvedCover?.coverImageUrl,
      firstPostImageUrl: firstPostImage?.coverImageUrl,
    });
    const image = buildVersionedPostOgImagePath({
      slug: post?.slug || "",
      revision: imageRevision,
    });

    return {
      title,
      description,
      image,
      imageAlt: buildPostOgImageAlt(post?.title),
      url: `${primaryAppOrigin}/postagem/${post?.slug || ""}`,
      type: "article",
      siteName,
      favicon: settings.site?.faviconUrl || "",
    };
  };

  return {
    buildInstitutionalPageMeta,
    buildPostMeta,
    buildProjectMeta,
    buildProjectReadingMeta,
    buildSiteMetaWithSettings,
    getPageTitleFromPath,
  };
};
