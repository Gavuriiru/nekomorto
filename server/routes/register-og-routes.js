const OG_IMAGE_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=86400";

const sendOgText = (res, statusCode, body) => res.status(statusCode).type("text/plain").send(body);

const sendOgImageResponse = (res, rendered, deliveryHeaders = null) => {
  res.setHeader("Content-Type", rendered.contentType || "image/png");
  res.setHeader("Cache-Control", OG_IMAGE_CACHE_CONTROL);
  if (deliveryHeaders?.cache) {
    res.setHeader("X-OG-Cache", deliveryHeaders.cache);
  }
  if (deliveryHeaders?.serverTiming) {
    res.setHeader("Server-Timing", deliveryHeaders.serverTiming);
  }
  return res.status(200).send(Buffer.from(rendered.buffer));
};

const handleOgImageRequest = async (res, { render, buildDeliveryHeaders, onRendered } = {}) => {
  try {
    const rendered = await render?.();
    if (!rendered) {
      return sendOgText(res, 404, "not_found");
    }
    const deliveryHeaders =
      typeof buildDeliveryHeaders === "function" ? buildDeliveryHeaders(rendered) : null;
    if (typeof onRendered === "function") {
      onRendered(rendered);
    }
    return sendOgImageResponse(res, rendered, deliveryHeaders);
  } catch {
    return sendOgText(res, 500, "image_generation_failed");
  }
};

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
      return sendOgText(res, 404, "not_found");
    }

    return handleOgImageRequest(res, {
      render: async () => {
      const settings = loadSiteSettings();
      const pages = loadPages();
      return await getInstitutionalOgCachedRender({
        pageKey,
        pages,
        settings,
        origin: PRIMARY_APP_ORIGIN,
        resolveVariantUrl: resolveMetaImageVariantUrl,
        ogRenderCache,
      });
      },
      buildDeliveryHeaders: (rendered) =>
        buildInstitutionalOgDeliveryHeaders({
        cacheHit: rendered.cacheHit,
        timings: rendered.timings,
        }),
    });
  });

  app.get("/api/og/project/:id/reading/:chapter", async (req, res) => {
    const id = String(req.params.id || "").trim();
    const chapterNumber = Number(req.params.chapter);
    const volume = Number(req.query?.volume);
    const project = getPublicVisibleProjects().find((item) => String(item?.id || "").trim() === id);
    if (!project || !Number.isFinite(chapterNumber)) {
      return sendOgText(res, 404, "not_found");
    }

    return handleOgImageRequest(res, {
      render: async () => {
      const settings = loadSiteSettings();
      const translations = loadTagTranslations();
      return await getProjectReadingOgCachedRender({
        project,
        chapterNumber,
        volume: Number.isFinite(volume) ? volume : undefined,
        settings,
        translations,
        origin: PRIMARY_APP_ORIGIN,
        resolveVariantUrl: resolveMetaImageVariantUrl,
        ogRenderCache,
      });
      },
      buildDeliveryHeaders: (rendered) =>
        buildProjectReadingOgDeliveryHeaders({
        cacheHit: rendered.cacheHit,
        timings: rendered.timings,
        }),
    });
  });

  app.get("/api/og/project/:id", async (req, res) => {
    const id = String(req.params.id || "").trim();
    const project = getPublicVisibleProjects().find((item) => String(item?.id || "").trim() === id);
    if (!project) {
      return sendOgText(res, 404, "not_found");
    }

    return handleOgImageRequest(res, {
      render: async () => {
      const settings = loadSiteSettings();
      const translations = loadTagTranslations();
      return await getProjectOgCachedRender({
        project,
        settings,
        translations,
        origin: PRIMARY_APP_ORIGIN,
        resolveVariantUrl: resolveMetaImageVariantUrl,
        ogRenderCache,
      });
      },
      buildDeliveryHeaders: (rendered) =>
        buildProjectOgDeliveryHeaders({
        cacheHit: rendered.cacheHit,
        timings: rendered.timings,
        }),
      onRendered: (rendered) => {
        logProjectOgDelivery({
          projectId: id,
          cacheHit: rendered.cacheHit,
          timings: rendered.timings,
          userAgent: req.headers["user-agent"],
        });
      },
    });
  });

  app.get("/api/og/post/:slug", async (req, res) => {
    const slug = String(req.params.slug || "").trim();
    const now = Date.now();
    const post = normalizePosts(loadPosts()).find((item) => item.slug === slug);
    if (!post || post.deletedAt) {
      return sendOgText(res, 404, "not_found");
    }
    const publishTime = new Date(post.publishedAt).getTime();
    if (publishTime > now || (post.status !== "published" && post.status !== "scheduled")) {
      return sendOgText(res, 404, "not_found");
    }

    return handleOgImageRequest(res, {
      render: async () => {
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
      return await getPostOgCachedRender({
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
      },
    });
  });
};
