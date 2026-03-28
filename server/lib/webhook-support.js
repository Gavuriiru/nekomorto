const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

export const pickFirstNonEmptyText = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

export const clampWebhookInteger = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
};

export const createResolveEditorialAuthorFromPost =
  ({ loadUsers, normalizeTypeLookupKey, normalizeUsers }) =>
  (postInput) => {
    const post = postInput && typeof postInput === "object" ? postInput : null;
    const authorName = String(post?.author || "").trim();
    if (!authorName) {
      return {
        name: "",
        avatarUrl: "",
      };
    }
    const normalizedAuthorName = normalizeTypeLookupKey(authorName);
    const user =
      normalizeUsers(loadUsers()).find((item) => {
        if (item?.status !== "active") {
          return false;
        }
        return normalizeTypeLookupKey(item?.name || "") === normalizedAuthorName;
      }) || null;
    return {
      name: authorName,
      avatarUrl: String(user?.avatarUrl || "").trim(),
    };
  };

export const createWebhookAuditReqFromContext = (contextInput = {}, randomUUID = () => "") => {
  const context = asObject(contextInput);
  return {
    headers: {},
    ip: String(context.actorIp || "127.0.0.1"),
    session: {
      user: {
        id: String(context.actorId || "system"),
        name: String(context.actorName || "System"),
      },
    },
    requestId: String(context.requestId || `webhook-${randomUUID()}`),
  };
};

export const resolveWebhookAuditActions = (scope, webhookDeliveryScope) => {
  if (scope === webhookDeliveryScope?.OPS_ALERTS) {
    return {
      resource: "system",
      queuedAction: "ops_alerts.webhook.queued",
      sentAction: "ops_alerts.webhook.sent",
      failedAction: "ops_alerts.webhook.failed",
    };
  }
  if (scope === webhookDeliveryScope?.SECURITY) {
    return {
      resource: "security",
      queuedAction: "security.webhook.queued",
      sentAction: "security.webhook.sent",
      failedAction: "security.webhook.failed",
    };
  }
  return {
    resource: "integrations",
    queuedAction: "editorial_webhook.queued",
    sentAction: "editorial_webhook.sent",
    failedAction: "editorial_webhook.failed",
  };
};

export const buildWebhookAuditMeta = (delivery, extra = {}) => {
  const context = asObject(delivery?.context);
  return {
    deliveryId: delivery?.id || null,
    scope: delivery?.scope || null,
    channel: delivery?.channel || null,
    eventKey: delivery?.eventKey || null,
    eventLabel: context.eventLabel || null,
    postId: context.postId || null,
    projectId: context.projectId || null,
    securityEventId: context.securityEventId || null,
    ...extra,
  };
};

export const createBuildEditorialWebhookImageContext =
  ({
    buildPostOgRevision,
    buildProjectOgRevision,
    buildProjectReadingOgCardModel,
    buildProjectReadingOgRevisionValue,
    buildVersionedPostOgImagePath,
    buildVersionedProjectOgImagePath,
    buildVersionedProjectReadingOgImagePath,
    extractFirstImageFromPostContent,
    primaryAppOrigin,
    resolveMetaImageVariantUrl,
    resolvePostCover,
  }) =>
  ({ post = null, project = null, chapter = null, settings = {}, translations = {} } = {}) => {
    const safePost = post && typeof post === "object" ? post : null;
    const safeProject = project && typeof project === "object" ? project : null;
    const safeChapter = chapter && typeof chapter === "object" ? chapter : null;
    const fallbackSiteImageUrl = pickFirstNonEmptyText(
      settings?.site?.defaultShareImage,
      "/placeholder.svg",
    );

    const resolvedPostCover = safePost ? resolvePostCover(safePost) : null;
    const firstPostImage = safePost
      ? extractFirstImageFromPostContent(safePost.content, safePost.contentFormat)
      : null;

    const postSlug = String(safePost?.slug || "").trim();
    const postOgImageUrl = postSlug
      ? buildVersionedPostOgImagePath({
          slug: postSlug,
          revision: buildPostOgRevision({
            post: safePost,
            settings,
            coverImageUrl: resolvedPostCover?.coverImageUrl,
            firstPostImageUrl: firstPostImage?.coverImageUrl,
          }),
        })
      : "";

    const projectId = String(safeProject?.id || "").trim();
    const projectOgImageUrl = projectId
      ? buildVersionedProjectOgImagePath({
          projectId,
          revision: buildProjectOgRevision({
            project: safeProject,
            settings,
            translations,
            origin: primaryAppOrigin,
            resolveVariantUrl: resolveMetaImageVariantUrl,
          }),
        })
      : "";

    const chapterNumber = Number(safeChapter?.number);
    const chapterVolume = Number(safeChapter?.volume);
    let chapterOgImageUrl = "";
    if (projectId && Number.isFinite(chapterNumber)) {
      const chapterModel = buildProjectReadingOgCardModel({
        project: safeProject,
        chapterNumber,
        volume: Number.isFinite(chapterVolume) ? chapterVolume : undefined,
        settings,
        tagTranslations: translations?.tags,
        genreTranslations: translations?.genres,
        origin: primaryAppOrigin,
        resolveVariantUrl: resolveMetaImageVariantUrl,
      });
      if (chapterModel) {
        const chapterNumberResolved = Number.isFinite(Number(chapterModel.chapterNumberResolved))
          ? Number(chapterModel.chapterNumberResolved)
          : chapterNumber;
        const chapterVolumeResolved = Number.isFinite(Number(chapterModel.volumeResolved))
          ? Number(chapterModel.volumeResolved)
          : Number.isFinite(chapterVolume)
            ? chapterVolume
            : undefined;
        chapterOgImageUrl = buildVersionedProjectReadingOgImagePath({
          projectId,
          chapterNumber: chapterNumberResolved,
          volume: chapterVolumeResolved,
          revision: buildProjectReadingOgRevisionValue({
            project: safeProject,
            chapterNumber: chapterNumberResolved,
            volume: chapterVolumeResolved,
            settings,
            translations,
          }),
        });
      }
    }

    const resolvedProjectOgImageUrl = pickFirstNonEmptyText(projectOgImageUrl);
    const resolvedChapterOgImageUrl = pickFirstNonEmptyText(
      chapterOgImageUrl,
      resolvedProjectOgImageUrl,
    );

    return {
      postImageUrl: pickFirstNonEmptyText(
        resolvedPostCover?.coverImageUrl,
        firstPostImage?.coverImageUrl,
        postOgImageUrl,
        fallbackSiteImageUrl,
        "/placeholder.svg",
      ),
      postOgImageUrl,
      projectImageUrl: pickFirstNonEmptyText(
        safeProject?.cover,
        safeProject?.heroImageUrl,
        safeProject?.banner,
        projectOgImageUrl,
        fallbackSiteImageUrl,
        "/placeholder.svg",
      ),
      projectBackdropImageUrl: pickFirstNonEmptyText(
        safeProject?.banner,
        safeProject?.heroImageUrl,
        safeProject?.cover,
        projectOgImageUrl,
        fallbackSiteImageUrl,
        "/placeholder.svg",
      ),
      projectOgImageUrl,
      chapterImageUrl: pickFirstNonEmptyText(
        safeChapter?.coverImageUrl,
        safeProject?.heroImageUrl,
        safeProject?.banner,
        safeProject?.cover,
        resolvedChapterOgImageUrl,
        resolvedProjectOgImageUrl,
        fallbackSiteImageUrl,
        "/placeholder.svg",
      ),
      chapterOgImageUrl: resolvedChapterOgImageUrl,
    };
  };
