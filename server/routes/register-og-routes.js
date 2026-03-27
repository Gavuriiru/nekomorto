export const registerOgRoutes = ({
  app,
  PRIMARY_APP_ORIGIN,
  resolveInstitutionalOgPageTitle,
  loadSiteSettings,
  loadPages,
  loadTagTranslations,
  getPublicVisibleProjects,
  ogRenderCache,
  resolveMetaImageVariantUrl,
  getInstitutionalOgCachedRender,
  buildInstitutionalOgDeliveryHeaders,
  getProjectReadingOgCachedRender,
  buildProjectReadingOgDeliveryHeaders,
  getProjectOgCachedRender,
  buildProjectOgDeliveryHeaders,
  logProjectOgDelivery,
  normalizePosts,
  loadPosts,
  resolvePostCover,
  extractFirstImageFromPostContent,
  resolveEditorialAuthorFromPost,
  getPostOgCachedRender,
} = {}) => {
  app.get("/api/og/institutional/:pageKey", async (req, res) => {
    const pageKey = String(req.params.pageKey || "").trim();
    if (!resolveInstitutionalOgPageTitle(pageKey)) {
      return res.status(404).type("text/plain").send("not_found");
    }

    try {
      const settings = loadSiteSettings();
      const pages = loadPages();
      const rendered = await getInstitutionalOgCachedRender({
        pageKey,
        pages,
        settings,
        origin: PRIMARY_APP_ORIGIN,
        resolveVariantUrl: resolveMetaImageVariantUrl,
        ogRenderCache,
      });
      if (!rendered) {
        return res.status(404).type("text/plain").send("not_found");
      }

      const deliveryHeaders = buildInstitutionalOgDeliveryHeaders({
        cacheHit: rendered.cacheHit,
        timings: rendered.timings,
      });

      res.setHeader("Content-Type", rendered.contentType || "image/png");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
      res.setHeader("X-OG-Cache", deliveryHeaders.cache);
      if (deliveryHeaders.serverTiming) {
        res.setHeader("Server-Timing", deliveryHeaders.serverTiming);
      }
      return res.status(200).send(Buffer.from(rendered.buffer));
    } catch {
      return res.status(500).type("text/plain").send("image_generation_failed");
    }
  });

  app.get("/api/og/project/:id/reading/:chapter", async (req, res) => {
    const id = String(req.params.id || "").trim();
    const chapterNumber = Number(req.params.chapter);
    const volume = Number(req.query?.volume);
    const project = getPublicVisibleProjects().find((item) => String(item?.id || "").trim() === id);
    if (!project || !Number.isFinite(chapterNumber)) {
      return res.status(404).type("text/plain").send("not_found");
    }

    try {
      const settings = loadSiteSettings();
      const translations = loadTagTranslations();
      const rendered = await getProjectReadingOgCachedRender({
        project,
        chapterNumber,
        volume: Number.isFinite(volume) ? volume : undefined,
        settings,
        translations,
        origin: PRIMARY_APP_ORIGIN,
        resolveVariantUrl: resolveMetaImageVariantUrl,
        ogRenderCache,
      });
      if (!rendered) {
        return res.status(404).type("text/plain").send("not_found");
      }

      const deliveryHeaders = buildProjectReadingOgDeliveryHeaders({
        cacheHit: rendered.cacheHit,
        timings: rendered.timings,
      });

      res.setHeader("Content-Type", rendered.contentType || "image/png");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
      res.setHeader("X-OG-Cache", deliveryHeaders.cache);
      if (deliveryHeaders.serverTiming) {
        res.setHeader("Server-Timing", deliveryHeaders.serverTiming);
      }
      return res.status(200).send(Buffer.from(rendered.buffer));
    } catch {
      return res.status(500).type("text/plain").send("image_generation_failed");
    }
  });

  app.get("/api/og/project/:id", async (req, res) => {
    const id = String(req.params.id || "").trim();
    const project = getPublicVisibleProjects().find((item) => String(item?.id || "").trim() === id);
    if (!project) {
      return res.status(404).type("text/plain").send("not_found");
    }

    try {
      const settings = loadSiteSettings();
      const translations = loadTagTranslations();
      const rendered = await getProjectOgCachedRender({
        project,
        settings,
        translations,
        origin: PRIMARY_APP_ORIGIN,
        resolveVariantUrl: resolveMetaImageVariantUrl,
        ogRenderCache,
      });
      const deliveryHeaders = buildProjectOgDeliveryHeaders({
        cacheHit: rendered.cacheHit,
        timings: rendered.timings,
      });

      res.setHeader("Content-Type", rendered.contentType || "image/png");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
      res.setHeader("X-OG-Cache", deliveryHeaders.cache);
      if (deliveryHeaders.serverTiming) {
        res.setHeader("Server-Timing", deliveryHeaders.serverTiming);
      }
      logProjectOgDelivery({
        projectId: id,
        cacheHit: rendered.cacheHit,
        timings: rendered.timings,
        userAgent: req.headers["user-agent"],
      });
      return res.status(200).send(Buffer.from(rendered.buffer));
    } catch {
      return res.status(500).type("text/plain").send("image_generation_failed");
    }
  });

  app.get("/api/og/post/:slug", async (req, res) => {
    const slug = String(req.params.slug || "").trim();
    const now = Date.now();
    const post = normalizePosts(loadPosts()).find((item) => item.slug === slug);
    if (!post || post.deletedAt) {
      return res.status(404).type("text/plain").send("not_found");
    }
    const publishTime = new Date(post.publishedAt).getTime();
    if (publishTime > now || (post.status !== "published" && post.status !== "scheduled")) {
      return res.status(404).type("text/plain").send("not_found");
    }

    try {
      const settings = loadSiteSettings();
      const translations = loadTagTranslations();
      const resolvedCover = resolvePostCover(post);
      const firstPostImage = extractFirstImageFromPostContent(post.content, post.contentFormat);
      const relatedProjectId = String(post.projectId || "").trim();
      const relatedProject = relatedProjectId
        ? getPublicVisibleProjects().find(
            (item) => String(item?.id || "").trim() === relatedProjectId,
          ) || null
        : null;
      const resolvedAuthor = resolveEditorialAuthorFromPost(post);
      const rendered = await getPostOgCachedRender({
        post,
        relatedProject,
        resolvedCover,
        firstPostImage,
        resolvedAuthor,
        defaultBackdropUrl: settings.site?.defaultShareImage || "",
        settings,
        translations,
        origin: PRIMARY_APP_ORIGIN,
        resolveVariantUrl: resolveMetaImageVariantUrl,
        ogRenderCache,
      });

      res.setHeader("Content-Type", rendered.contentType || "image/png");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
      return res.status(200).send(Buffer.from(rendered.buffer));
    } catch {
      return res.status(500).type("text/plain").send("image_generation_failed");
    }
  });
};
