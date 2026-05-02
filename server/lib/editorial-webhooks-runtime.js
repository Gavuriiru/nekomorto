const REQUIRED_DEPENDENCY_KEYS = [
  "appendAuditLog",
  "buildEditorialEventContext",
  "buildEditorialMentions",
  "buildEditorialWebhookImageContext",
  "buildWebhookAuditMeta",
  "buildWebhookTargetLabel",
  "clampWebhookInteger",
  "createSystemAuditReq",
  "deriveChapterSynopsis",
  "enqueueWebhookDelivery",
  "getActiveProjectTypes",
  "getRequestIp",
  "loadIntegrationSettings",
  "loadProjects",
  "loadSiteSettings",
  "loadTagTranslations",
  "normalizeEditorialWebhookSettings",
  "normalizeProjects",
  "primaryAppOrigin",
  "renderWebhookTemplate",
  "resolveEditorialAuthorFromPost",
  "resolveEditorialEventChannel",
  "resolveEditorialEventLabel",
  "resolveEpisodeLookup",
  "runWebhookDeliveryWorkerTick",
  "toDiscordWebhookPayload",
  "validateWebhookUrlForProvider",
  "webhookDeliveryScope",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[editorial-webhooks-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createEditorialWebhooksRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    appendAuditLog,
    buildEditorialEventContext,
    buildEditorialMentions,
    buildEditorialWebhookImageContext,
    buildWebhookAuditMeta,
    buildWebhookTargetLabel,
    clampWebhookInteger,
    createSystemAuditReq,
    deriveChapterSynopsis,
    enqueueWebhookDelivery,
    getActiveProjectTypes,
    getRequestIp,
    loadIntegrationSettings,
    loadProjects,
    loadSiteSettings,
    loadTagTranslations,
    normalizeEditorialWebhookSettings,
    normalizeProjects,
    primaryAppOrigin,
    renderWebhookTemplate,
    resolveEditorialAuthorFromPost,
    resolveEditorialEventChannel,
    resolveEditorialEventLabel,
    resolveEpisodeLookup,
    runWebhookDeliveryWorkerTick,
    toDiscordWebhookPayload,
    validateWebhookUrlForProvider,
    webhookDeliveryScope,
  } = dependencies;

  const resolveProjectWebhookEventKey = (kind) => {
    const normalized = String(kind || "")
      .trim()
      .toLowerCase();
    if (normalized.startsWith("lan")) {
      return "project_release";
    }
    if (normalized.startsWith("aju")) {
      return "project_adjust";
    }
    return "";
  };

  const findProjectChapterByEpisodeNumber = (project, episodeNumber, volume) => {
    const lookup = resolveEpisodeLookup(project, episodeNumber, volume);
    if (!lookup.ok) {
      return null;
    }

    const chapter = lookup.episode;
    const synopsis = deriveChapterSynopsis(chapter);
    return {
      number: Number.isFinite(Number(chapter.number))
        ? Number(chapter.number)
        : Number(episodeNumber),
      volume: Number.isFinite(Number(chapter.volume)) ? Number(chapter.volume) : "",
      title: String(chapter.title || ""),
      synopsis,
      content: String(chapter.content || ""),
      releaseDate: String(chapter.releaseDate || ""),
      updatedAt: String(chapter.chapterUpdatedAt || chapter.updatedAt || ""),
      coverImageUrl: String(chapter.coverImageUrl || ""),
      contentFormat: String(chapter.contentFormat || ""),
      status: String(chapter.status || ""),
      displayLabel: String(chapter.displayLabel || ""),
      entryKind: String(chapter.entryKind || ""),
    };
  };

  const prepareEditorialWebhookDispatch = ({
    eventKey,
    post = null,
    project = null,
    update = null,
    chapter = null,
    settings: settingsInput = null,
    allowDisabled = false,
  } = {}) => {
    const channelKey = resolveEditorialEventChannel(eventKey);
    if (!channelKey) {
      return { ok: false, status: "skipped", code: "invalid_event_key" };
    }

    const projectTypes = getActiveProjectTypes();
    const baseSettings =
      settingsInput && typeof settingsInput === "object"
        ? settingsInput
        : loadIntegrationSettings().editorial;
    const settings = normalizeEditorialWebhookSettings(baseSettings, {
      projectTypes,
    });
    const channel = settings?.channels?.[channelKey];
    if (!channel || typeof channel !== "object") {
      return { ok: false, status: "skipped", code: "missing_channel", channel: channelKey };
    }
    if (!allowDisabled && channel.enabled !== true) {
      return { ok: false, status: "skipped", code: "channel_disabled", channel: channelKey };
    }
    if (!allowDisabled && channel?.events?.[eventKey] !== true) {
      return { ok: false, status: "skipped", code: "event_disabled", channel: channelKey };
    }

    const webhookUrl = String(channel?.webhookUrl || "").trim();
    if (!webhookUrl) {
      return { ok: false, status: "skipped", code: "missing_webhook_url", channel: channelKey };
    }
    const webhookValidation = validateWebhookUrlForProvider({
      provider: "discord",
      webhookUrl,
    });
    if (!webhookValidation.ok) {
      return { ok: false, status: "failed", code: webhookValidation.code, channel: channelKey };
    }

    const template = channel?.templates?.[eventKey];
    if (!template || typeof template !== "object") {
      return { ok: false, status: "skipped", code: "missing_template", channel: channelKey };
    }

    const safeProject =
      project && typeof project === "object"
        ? project
        : post?.projectId
          ? normalizeProjects(loadProjects()).find((item) => item.id === String(post.projectId)) ||
            null
          : null;
    const safeChapter =
      chapter && typeof chapter === "object"
        ? chapter
        : safeProject
          ? findProjectChapterByEpisodeNumber(safeProject, update?.episodeNumber, update?.volume)
          : null;
    const author = resolveEditorialAuthorFromPost(post);
    const safePost =
      post && typeof post === "object"
        ? {
            ...post,
            authorAvatarUrl: author.avatarUrl || String(post.authorAvatarUrl || "").trim(),
          }
        : post;
    const mentions = buildEditorialMentions({
      settings,
      eventKey,
      projectType: safeProject?.type || "",
      projectDiscordRoleId: safeProject?.discordRoleId || "",
      includeProjectRole: channelKey === "projects",
    });
    const occurredAt =
      String(update?.updatedAt || safePost?.updatedAt || safeProject?.updatedAt || "").trim() ||
      new Date().toISOString();
    const siteSettings = loadSiteSettings();
    const translations = loadTagTranslations();
    const siteName = String(siteSettings?.site?.name || "Nekomata").trim() || "Nekomata";
    const siteLogoUrl =
      String(
        siteSettings?.site?.logoUrl ||
          siteSettings?.branding?.assets?.symbolUrl ||
          siteSettings?.branding?.assets?.wordmarkUrl ||
          "",
      ).trim() || "";
    const siteCoverImageUrl = String(siteSettings?.site?.defaultShareImage || "").trim();
    const siteFaviconUrl = String(siteSettings?.site?.faviconUrl || "").trim();
    const imageContext = buildEditorialWebhookImageContext({
      post: safePost,
      project: safeProject,
      chapter: safeChapter,
      settings: siteSettings,
      translations,
    });
    const context = buildEditorialEventContext({
      eventKey,
      occurredAt,
      siteName,
      siteUrl: primaryAppOrigin,
      siteLogoUrl,
      siteCoverImageUrl,
      siteFaviconUrl,
      origin: primaryAppOrigin,
      mentions,
      author,
      post: safePost,
      project: safeProject,
      chapter: safeChapter,
      update,
      postImageUrl: imageContext.postImageUrl,
      postOgImageUrl: imageContext.postOgImageUrl,
      projectImageUrl: imageContext.projectImageUrl,
      projectBackdropImageUrl: imageContext.projectBackdropImageUrl,
      projectOgImageUrl: imageContext.projectOgImageUrl,
      chapterImageUrl: imageContext.chapterImageUrl,
      chapterOgImageUrl: imageContext.chapterOgImageUrl,
    });
    const rendered = renderWebhookTemplate(template, context);
    const payload = toDiscordWebhookPayload({
      content: rendered?.content || "",
      origin: primaryAppOrigin,
      embed: {
        title: rendered?.embed?.title || "",
        description: rendered?.embed?.description || "",
        footerText: rendered?.embed?.footerText || rendered?.embed?.footer || "",
        footerIconUrl: rendered?.embed?.footerIconUrl || "",
        url: rendered?.embed?.url || "",
        color: rendered?.embed?.color || "",
        authorName: rendered?.embed?.authorName || "",
        authorIconUrl: rendered?.embed?.authorIconUrl || "",
        authorUrl: rendered?.embed?.authorUrl || "",
        thumbnailUrl: rendered?.embed?.thumbnailUrl || "",
        imageUrl: rendered?.embed?.imageUrl || "",
        fields: Array.isArray(rendered?.embed?.fields) ? rendered.embed.fields : [],
        timestamp: occurredAt,
      },
      allowedMentionsRoleIds: mentions.roleIds || [],
    });
    const hasContent = String(payload?.content || "").trim().length > 0;
    const hasEmbeds = Array.isArray(payload?.embeds) && payload.embeds.length > 0;
    if (!hasContent && !hasEmbeds) {
      return { ok: false, status: "skipped", code: "empty_payload", channel: channelKey };
    }

    return {
      ok: true,
      channel: channelKey,
      eventKey,
      webhookUrl,
      targetLabel: buildWebhookTargetLabel(webhookValidation.url),
      timeoutMs: clampWebhookInteger(channel.timeoutMs, 1000, 30000, 5000),
      retries: clampWebhookInteger(channel.retries, 0, 5, 1),
      maxAttempts: clampWebhookInteger(channel.retries, 0, 5, 1) + 1,
      payload,
      mentionsRoleIds: Array.isArray(mentions.roleIds) ? mentions.roleIds : [],
      context,
    };
  };

  const dispatchEditorialWebhookEvent = async ({
    eventKey,
    post = null,
    project = null,
    update = null,
    chapter = null,
    req = null,
  } = {}) => {
    const actorReq = req || createSystemAuditReq();
    const prepared = prepareEditorialWebhookDispatch({
      eventKey,
      post,
      project,
      update,
      chapter,
    });
    if (!prepared.ok) {
      appendAuditLog(actorReq, "editorial_webhook.skipped", "integrations", {
        eventKey,
        channel: prepared.channel || resolveEditorialEventChannel(eventKey),
        code: prepared.code || "skipped",
        postId: post?.id || null,
        projectId: project?.id || post?.projectId || null,
      });
      return prepared;
    }

    const queued = enqueueWebhookDelivery({
      scope: webhookDeliveryScope.EDITORIAL,
      provider: "discord",
      webhookUrl: prepared.webhookUrl,
      payload: prepared.payload,
      channel: prepared.channel,
      eventKey: prepared.eventKey,
      timeoutMs: prepared.timeoutMs,
      maxAttempts: prepared.maxAttempts,
      targetLabel: prepared.targetLabel,
      context: {
        ...prepared.context,
        eventLabel: resolveEditorialEventLabel(eventKey),
        postId: post?.id || "",
        projectId: project?.id || post?.projectId || "",
        actorId: actorReq.session?.user?.id || "system",
        actorName: actorReq.session?.user?.name || "System",
        actorIp: typeof getRequestIp === "function" ? getRequestIp(actorReq) : actorReq.ip || "",
        requestId: actorReq.requestId || "",
      },
    });
    if (!queued.ok) {
      appendAuditLog(actorReq, "editorial_webhook.failed", "integrations", {
        eventKey,
        eventLabel: resolveEditorialEventLabel(eventKey),
        channel: prepared.channel,
        code: queued.code || "delivery_enqueue_failed",
        postId: post?.id || null,
        projectId: project?.id || post?.projectId || null,
      });
      return queued;
    }

    appendAuditLog(actorReq, "editorial_webhook.queued", "integrations", {
      ...buildWebhookAuditMeta(queued.delivery),
      attempt: 0,
    });
    void runWebhookDeliveryWorkerTick();

    return {
      ...queued,
      eventKey,
      channel: prepared.channel,
    };
  };

  return {
    dispatchEditorialWebhookEvent,
    findProjectChapterByEpisodeNumber,
    prepareEditorialWebhookDispatch,
    resolveProjectWebhookEventKey,
  };
};

export default createEditorialWebhooksRuntime;
