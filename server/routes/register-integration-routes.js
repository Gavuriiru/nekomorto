export const registerIntegrationRoutes = ({
  app,
  crypto,
  WEBHOOK_DELIVERY_STATUS,
  appendAuditLog,
  appendWebhookQueuedAuditLog,
  buildOperationalAlertsWebhookPayload,
  buildOperationalWebhookTestTransition,
  buildSecurityWebhookPayload,
  buildSecurityWebhookTestEvent,
  canManageIntegrations,
  createRevisionToken,
  deriveChapterSynopsis,
  dispatchWebhookMessage,
  ensureEditorialWebhookSettingsNoConflict,
  ensureWebhookSettingsNoConflict,
  findWebhookDelivery,
  getActiveProjectTypes,
  loadIntegrationSettings,
  loadIntegrationSettingsSources,
  loadPosts,
  loadProjects,
  loadWebhookDeliveries,
  normalizeEditorialWebhookSettings,
  normalizePosts,
  normalizeProjects,
  normalizeUnifiedWebhookSettingsForRequest,
  parseEditRevisionOptions,
  prepareEditorialWebhookDispatch,
  requireAuth,
  resolveEditorialEventChannel,
  resolveProjectUpdateUnitLabel,
  runWebhookDeliveryWorkerTick,
  summarizeWebhookDeliveries,
  toAbsoluteUrl,
  toWebhookDeliveryApiResponse,
  upsertWebhookDelivery,
  validateEditorialWebhookChannelUrls,
  validateEditorialWebhookSettingsPlaceholders,
  validateUnifiedWebhookSettingsUrls,
  writeIntegrationSettings,
  migrateEditorialMentionPlaceholdersInSettings,
} = {}) => {
  app.get("/api/integrations/webhooks", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageIntegrations(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const projectTypes = getActiveProjectTypes({ includeDefaults: true });
    const settings = normalizeUnifiedWebhookSettingsForRequest(
      loadIntegrationSettings(),
      projectTypes,
    );
    const sources = loadIntegrationSettingsSources();
    appendAuditLog(req, "integrations.webhooks.read", "integrations", {
      scope: "all",
    });
    return res.json({
      settings,
      projectTypes,
      revision: createRevisionToken(settings),
      sources,
    });
  });

  app.put("/api/integrations/webhooks", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageIntegrations(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const options = parseEditRevisionOptions(req.body);
    const payload = req.body?.settings ?? req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const projectTypes = getActiveProjectTypes({ includeDefaults: true });
    const currentSettings = normalizeUnifiedWebhookSettingsForRequest(
      loadIntegrationSettings(),
      projectTypes,
    );
    const sources = loadIntegrationSettingsSources();
    const currentRevision = createRevisionToken(currentSettings);
    const noConflict = ensureWebhookSettingsNoConflict({
      res,
      currentSettings,
      currentRevision,
      projectTypes,
      sources,
      options,
    });
    if (!noConflict) {
      return noConflict;
    }

    const normalized = normalizeUnifiedWebhookSettingsForRequest(payload, projectTypes);
    const editorialValidation = validateEditorialWebhookSettingsPlaceholders(normalized.editorial);
    if (!editorialValidation.ok) {
      return res.status(400).json({
        error: "invalid_placeholders",
        placeholders: editorialValidation.errors,
      });
    }
    const urlValidation = validateUnifiedWebhookSettingsUrls(normalized);
    if (!urlValidation.ok) {
      return res.status(400).json({
        error: "invalid_webhook_url",
        channels: urlValidation.errors,
      });
    }

    const persisted = writeIntegrationSettings(normalized);
    const settings = normalizeUnifiedWebhookSettingsForRequest(persisted, projectTypes);
    appendAuditLog(req, "integrations.webhooks.update", "integrations", {
      scope: "all",
      count:
        Number(settings.editorial?.typeRoles?.length || 0) +
        (settings.operational.enabled ? 1 : 0) +
        (settings.security.enabled ? 1 : 0),
    });
    return res.json({
      settings,
      projectTypes,
      revision: createRevisionToken(settings),
      sources: {
        editorial: "stored",
        operational: "stored",
        security: "stored",
      },
    });
  });

  app.get("/api/integrations/webhooks/editorial", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageIntegrations(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const projectTypes = getActiveProjectTypes({ includeDefaults: true });
    const loadedSettings = loadIntegrationSettings().editorial;
    const settings = migrateEditorialMentionPlaceholdersInSettings(
      normalizeEditorialWebhookSettings(loadedSettings, { projectTypes }),
    );
    appendAuditLog(req, "integrations.webhooks_editorial.read", "integrations", {
      channel: "all",
    });
    return res.json({ settings, projectTypes, revision: createRevisionToken(settings) });
  });

  app.put("/api/integrations/webhooks/editorial", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageIntegrations(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const options = parseEditRevisionOptions(req.body);
    const payload = req.body?.settings ?? req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const projectTypes = getActiveProjectTypes({ includeDefaults: true });
    const currentBundle = loadIntegrationSettings();
    const currentSettings = migrateEditorialMentionPlaceholdersInSettings(
      normalizeEditorialWebhookSettings(currentBundle.editorial, { projectTypes }),
    );
    const currentRevision = createRevisionToken(currentSettings);
    const noConflict = ensureEditorialWebhookSettingsNoConflict({
      res,
      currentSettings,
      currentRevision,
      projectTypes,
      options,
    });
    if (!noConflict) {
      return noConflict;
    }
    const normalized = normalizeEditorialWebhookSettings(payload, { projectTypes });
    const migrated = migrateEditorialMentionPlaceholdersInSettings(normalized);
    const validation = validateEditorialWebhookSettingsPlaceholders(migrated);
    if (!validation.ok) {
      return res.status(400).json({
        error: "invalid_placeholders",
        placeholders: validation.errors,
      });
    }
    const urlValidation = validateEditorialWebhookChannelUrls(migrated);
    if (!urlValidation.ok) {
      return res.status(400).json({
        error: "invalid_webhook_url",
        channels: urlValidation.errors,
      });
    }

    const persisted = writeIntegrationSettings({
      ...currentBundle,
      editorial: migrated,
    });
    const settings = migrateEditorialMentionPlaceholdersInSettings(
      normalizeEditorialWebhookSettings(persisted.editorial, { projectTypes }),
    );
    appendAuditLog(req, "integrations.webhooks_editorial.update", "integrations", {
      count: Array.isArray(settings?.typeRoles) ? settings.typeRoles.length : 0,
    });
    return res.json({ settings, projectTypes, revision: createRevisionToken(settings) });
  });

  app.post("/api/integrations/webhooks/editorial/test", requireAuth, async (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageIntegrations(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const eventKey = String(req.body?.eventKey || "").trim();
    const channelKey = resolveEditorialEventChannel(eventKey);
    if (!channelKey) {
      return res.status(400).json({ error: "invalid_event_key" });
    }

    try {
      const now = new Date().toISOString();
      const placeholderImage = toAbsoluteUrl("/placeholder.svg") || "/placeholder.svg";
      const projects = normalizeProjects(loadProjects()).filter((project) => !project.deletedAt);
      const posts = normalizePosts(loadPosts()).filter((post) => !post.deletedAt);
      const requestedProjectId = String(req.body?.projectId || "").trim();
      const requestedPostId = String(req.body?.postId || "").trim();

      let sampleProject =
        projects.find((project) => project.id === requestedProjectId) ||
        projects.find((project) => String(project.id || "").trim().length > 0) ||
        null;
      let samplePost =
        posts.find((post) => post.id === requestedPostId) ||
        posts.find((post) => String(post.slug || "").trim().length > 0) ||
        null;

      if (!sampleProject && samplePost?.projectId) {
        sampleProject =
          projects.find((project) => project.id === String(samplePost.projectId)) || null;
      }

      if (!sampleProject) {
        sampleProject = {
          id: "sample-project",
          title: "Projeto de teste",
          type: "Anime",
          cover: placeholderImage,
          banner: placeholderImage,
          heroImageUrl: "",
          heroLogoUrl: "",
          heroLogoAlt: "",
          discordRoleId: "",
          episodeDownloads: [
            {
              number: 1,
              volume: 1,
              title: "Capítulo piloto",
              releaseDate: now.slice(0, 10),
              chapterUpdatedAt: now,
              coverImageUrl: placeholderImage,
            },
          ],
          updatedAt: now,
        };
      }

      if (!samplePost) {
        samplePost = {
          id: "sample-post",
          title: "Post de teste",
          slug: "post-de-teste",
          status: "published",
          author: sessionUser?.name || "Editor",
          publishedAt: now,
          excerpt: "Mensagem de teste para o webhook editorial.",
          tags: ["Teste"],
          coverImageUrl: sampleProject.cover || placeholderImage,
          projectId: String(sampleProject.id || ""),
          updatedAt: now,
        };
      }

      const chapterSource = Array.isArray(sampleProject?.episodeDownloads)
        ? sampleProject.episodeDownloads.find((episode) =>
            Number.isFinite(Number(episode?.number)),
          ) || sampleProject.episodeDownloads[0]
        : null;
      const chapterNumber = Number(chapterSource?.number);
      const safeChapterNumber = Number.isFinite(chapterNumber) ? Number(chapterNumber) : 1;
      const sampleChapter = {
        number: safeChapterNumber,
        volume: Number.isFinite(Number(chapterSource?.volume)) ? Number(chapterSource.volume) : "",
        title: String(chapterSource?.title || ""),
        synopsis: deriveChapterSynopsis(chapterSource),
        releaseDate: String(chapterSource?.releaseDate || ""),
        updatedAt: String(chapterSource?.chapterUpdatedAt || chapterSource?.updatedAt || now),
        coverImageUrl: String(chapterSource?.coverImageUrl || ""),
      };
      const sampleUpdateUnit = resolveProjectUpdateUnitLabel(
        sampleProject?.type || "",
        chapterSource,
      );
      const sampleUpdate = {
        kind: eventKey === "project_adjust" ? "Ajuste" : "Lançamento",
        reason:
          eventKey === "project_adjust"
            ? `Conteúdo ajustado no ${sampleUpdateUnit.toLowerCase()} ${safeChapterNumber}`
            : `${sampleUpdateUnit} ${safeChapterNumber} disponível`,
        unit: sampleUpdateUnit,
        episodeNumber: safeChapterNumber,
        volume: sampleChapter.volume,
        updatedAt: now,
      };
      if (
        !requestedProjectId &&
        sampleProject?.id === "sample-project" &&
        Array.isArray(sampleProject?.episodeDownloads) &&
        sampleProject.episodeDownloads[0]
      ) {
        sampleProject.episodeDownloads[0].title = "Capítulo piloto";
      }
      sampleUpdate.kind = eventKey === "project_adjust" ? "Ajuste" : "Lançamento";
      sampleUpdate.reason =
        eventKey === "project_adjust"
          ? `Conteúdo ajustado no ${sampleUpdateUnit.toLowerCase()} ${safeChapterNumber}`
          : `${sampleUpdateUnit} ${safeChapterNumber} disponível`;

      const requestedSettings =
        req.body?.settings &&
        typeof req.body.settings === "object" &&
        !Array.isArray(req.body.settings)
          ? req.body.settings
          : null;
      const requestedEditorialSettings =
        requestedSettings?.editorial &&
        typeof requestedSettings.editorial === "object" &&
        !Array.isArray(requestedSettings.editorial)
          ? requestedSettings.editorial
          : requestedSettings;
      const normalizedDraftSettings = migrateEditorialMentionPlaceholdersInSettings(
        normalizeEditorialWebhookSettings(
          requestedEditorialSettings || loadIntegrationSettings().editorial,
          {
            projectTypes: getActiveProjectTypes({ includeDefaults: true }),
          },
        ),
      );
      const placeholderValidation =
        validateEditorialWebhookSettingsPlaceholders(normalizedDraftSettings);
      if (!placeholderValidation.ok) {
        return res.status(400).json({
          ok: false,
          error: "invalid_placeholders",
          placeholders: placeholderValidation.errors,
          channel: channelKey,
        });
      }
      const urlValidation = validateEditorialWebhookChannelUrls(normalizedDraftSettings);
      if (!urlValidation.ok) {
        return res.status(400).json({
          ok: false,
          error: "invalid_webhook_url",
          channels: urlValidation.errors,
          channel: channelKey,
        });
      }

      const prepared = prepareEditorialWebhookDispatch({
        eventKey,
        post: samplePost,
        project: sampleProject,
        update: sampleUpdate,
        chapter: sampleChapter,
        settings: normalizedDraftSettings,
        allowDisabled: true,
      });
      if (!prepared.ok) {
        appendAuditLog(req, "integrations.webhooks_editorial.test", "integrations", {
          eventKey,
          channel: prepared.channel || channelKey,
          status: prepared.status || "failed",
          code: prepared.code || "prepare_failed",
          postId: samplePost?.id || null,
          projectId: sampleProject?.id || null,
        });
        return res.status(400).json({
          ok: false,
          error: prepared.code || "prepare_failed",
          channel: prepared.channel || channelKey,
        });
      }

      const result = await dispatchWebhookMessage({
        provider: "discord",
        webhookUrl: prepared.webhookUrl,
        message: prepared.payload,
        timeoutMs: prepared.timeoutMs,
        retries: 0,
      });
      const errorDetail = result.ok
        ? ""
        : String(result.bodyText || result.message || "")
            .trim()
            .slice(0, 500);

      appendAuditLog(req, "integrations.webhooks_editorial.test", "integrations", {
        eventKey,
        channel: prepared.channel,
        status: result.status,
        code: result.code || null,
        statusCode: result.statusCode || null,
        attempt: result.attempt || null,
        postId: samplePost?.id || null,
        projectId: sampleProject?.id || null,
        error: errorDetail || null,
      });

      return res.json({
        ok: result.ok,
        eventKey,
        channel: prepared.channel,
        status: result.status,
        code: result.code || null,
        statusCode: result.statusCode || null,
        attempt: result.attempt || null,
        ...(errorDetail ? { errorDetail } : {}),
      });
    } catch (error) {
      appendAuditLog(req, "integrations.webhooks_editorial.test", "integrations", {
        eventKey,
        channel: channelKey,
        status: "failed",
        code: "test_dispatch_failed",
        error: String(error?.message || error || "").slice(0, 200),
      });
      return res.status(500).json({
        ok: false,
        error: "test_dispatch_failed",
        channel: channelKey,
      });
    }
  });

  app.post("/api/integrations/webhooks/operational/test", requireAuth, async (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageIntegrations(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    try {
      const projectTypes = getActiveProjectTypes({ includeDefaults: true });
      const requestedSettings =
        req.body?.settings &&
        typeof req.body.settings === "object" &&
        !Array.isArray(req.body.settings)
          ? req.body.settings
          : null;
      const normalized = normalizeUnifiedWebhookSettingsForRequest(
        requestedSettings || loadIntegrationSettings(),
        projectTypes,
      );
      const urlValidation = validateUnifiedWebhookSettingsUrls(normalized);
      if (!urlValidation.ok) {
        return res.status(400).json({
          ok: false,
          error: "invalid_webhook_url",
          channels: urlValidation.errors,
          scope: "operational",
        });
      }

      const operational = normalized.operational;
      if (operational.enabled !== true) {
        return res.status(400).json({ ok: false, error: "disabled", scope: "operational" });
      }
      if (!String(operational.webhookUrl || "").trim()) {
        return res.status(400).json({
          ok: false,
          error: "missing_webhook_url",
          scope: "operational",
        });
      }

      const generatedAt = new Date().toISOString();
      const payload = buildOperationalAlertsWebhookPayload({
        transition: buildOperationalWebhookTestTransition(),
        generatedAt,
      });
      const result = await dispatchWebhookMessage({
        provider: operational.provider,
        webhookUrl: operational.webhookUrl,
        message: payload,
        timeoutMs: operational.timeoutMs,
        retries: 0,
      });
      const errorDetail = result.ok
        ? ""
        : String(result.bodyText || result.message || "")
            .trim()
            .slice(0, 500);

      appendAuditLog(req, "integrations.webhooks.operational_test", "integrations", {
        status: result.status,
        code: result.code || null,
        statusCode: result.statusCode || null,
        attempt: result.attempt || null,
        error: errorDetail || null,
      });

      return res.json({
        ok: result.ok,
        scope: "operational",
        status: result.status,
        code: result.code || null,
        statusCode: result.statusCode || null,
        attempt: result.attempt || null,
        ...(errorDetail ? { errorDetail } : {}),
      });
    } catch (error) {
      appendAuditLog(req, "integrations.webhooks.operational_test", "integrations", {
        status: "failed",
        code: "internal_error",
        error: String(error?.message || error || "operational_webhook_test_failed"),
      });
      return res.status(500).json({ ok: false, error: "internal_error", scope: "operational" });
    }
  });

  app.post("/api/integrations/webhooks/security/test", requireAuth, async (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageIntegrations(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    try {
      const projectTypes = getActiveProjectTypes({ includeDefaults: true });
      const requestedSettings =
        req.body?.settings &&
        typeof req.body.settings === "object" &&
        !Array.isArray(req.body.settings)
          ? req.body.settings
          : null;
      const normalized = normalizeUnifiedWebhookSettingsForRequest(
        requestedSettings || loadIntegrationSettings(),
        projectTypes,
      );
      const urlValidation = validateUnifiedWebhookSettingsUrls(normalized);
      if (!urlValidation.ok) {
        return res.status(400).json({
          ok: false,
          error: "invalid_webhook_url",
          channels: urlValidation.errors,
          scope: "security",
        });
      }

      const security = normalized.security;
      if (security.enabled !== true) {
        return res.status(400).json({ ok: false, error: "disabled", scope: "security" });
      }
      if (!String(security.webhookUrl || "").trim()) {
        return res.status(400).json({
          ok: false,
          error: "missing_webhook_url",
          scope: "security",
        });
      }

      const event = buildSecurityWebhookTestEvent();
      const result = await dispatchWebhookMessage({
        provider: security.provider,
        webhookUrl: security.webhookUrl,
        message: buildSecurityWebhookPayload(event),
        timeoutMs: security.timeoutMs,
        retries: 0,
      });
      const errorDetail = result.ok
        ? ""
        : String(result.bodyText || result.message || "")
            .trim()
            .slice(0, 500);

      appendAuditLog(req, "integrations.webhooks.security_test", "integrations", {
        status: result.status,
        code: result.code || null,
        statusCode: result.statusCode || null,
        attempt: result.attempt || null,
        securityEventId: String(event.id || ""),
        error: errorDetail || null,
      });

      return res.json({
        ok: result.ok,
        scope: "security",
        status: result.status,
        code: result.code || null,
        statusCode: result.statusCode || null,
        attempt: result.attempt || null,
        securityEventId: String(event.id || ""),
        ...(errorDetail ? { errorDetail } : {}),
      });
    } catch (error) {
      appendAuditLog(req, "integrations.webhooks.security_test", "integrations", {
        status: "failed",
        code: "internal_error",
        error: String(error?.message || error || "security_webhook_test_failed"),
      });
      return res.status(500).json({ ok: false, error: "internal_error", scope: "security" });
    }
  });

  app.get("/api/integrations/webhooks/deliveries", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageIntegrations(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const pageRaw = Number(req.query.page);
    const limitRaw = Number(req.query.limit);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.max(Math.floor(limitRaw), 10), 100)
        : 25;
    const statusFilter = String(req.query.status || "")
      .trim()
      .toLowerCase();
    const scopeFilter = String(req.query.scope || "")
      .trim()
      .toLowerCase();
    const channelFilter = String(req.query.channel || "")
      .trim()
      .toLowerCase();

    const rows = loadWebhookDeliveries();
    let filtered = rows.slice();
    if (statusFilter) {
      filtered = filtered.filter(
        (entry) =>
          String(entry?.status || "")
            .trim()
            .toLowerCase() === statusFilter,
      );
    }
    if (scopeFilter) {
      filtered = filtered.filter(
        (entry) =>
          String(entry?.scope || "")
            .trim()
            .toLowerCase() === scopeFilter,
      );
    }
    if (channelFilter) {
      filtered = filtered.filter(
        (entry) =>
          String(entry?.channel || "")
            .trim()
            .toLowerCase() === channelFilter,
      );
    }
    filtered.sort(
      (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime(),
    );

    const total = filtered.length;
    const start = (page - 1) * limit;
    return res.json({
      items: filtered
        .slice(start, start + limit)
        .map((entry) => toWebhookDeliveryApiResponse(entry)),
      summary: summarizeWebhookDeliveries(rows),
      page,
      limit,
      total,
    });
  });

  app.post("/api/integrations/webhooks/deliveries/:id/retry", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageIntegrations(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const current = findWebhookDelivery(req.params.id);
    if (!current) {
      return res.status(404).json({ error: "not_found" });
    }
    if (
      String(current.status || "")
        .trim()
        .toLowerCase() !== WEBHOOK_DELIVERY_STATUS.FAILED
    ) {
      return res.status(409).json({ error: "delivery_not_retryable" });
    }

    const now = new Date().toISOString();
    const cloned = upsertWebhookDelivery({
      ...current,
      id: crypto.randomUUID(),
      status: WEBHOOK_DELIVERY_STATUS.QUEUED,
      attemptCount: 0,
      nextAttemptAt: now,
      lastAttemptAt: null,
      lastStatusCode: null,
      lastErrorCode: null,
      lastError: null,
      processingOwner: null,
      processingStartedAt: null,
      sentAt: null,
      retryOfId: current.id,
      createdAt: now,
      updatedAt: now,
    });
    if (!cloned) {
      return res.status(500).json({ error: "delivery_retry_failed" });
    }
    appendWebhookQueuedAuditLog({
      scope: cloned.scope,
      delivery: cloned,
      req,
    });
    void runWebhookDeliveryWorkerTick();
    return res.json({
      ok: true,
      delivery: toWebhookDeliveryApiResponse(cloned),
    });
  });
};
