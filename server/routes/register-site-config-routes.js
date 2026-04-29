export const registerSiteConfigRoutes = ({
  app,
  ANILIST_API,
  appendAuditLog,
  buildPublicMediaVariants,
  canManageIntegrations,
  canManagePages,
  canManageSettings,
  collectDownloadIconUploads,
  createRevisionToken,
  deletePrivateUploadByUrl,
  enqueueProjectOgPrewarm,
  ensureNoEditConflict,
  loadPages,
  loadSiteSettings,
  loadTagTranslations,
  normalizeSiteSettings,
  parseEditRevisionOptions,
  requireAuth,
  sanitizeIconSource,
  writePages,
  writeSiteSettings,
  writeTagTranslations,
} = {}) => {
  const trimText = (value) => String(value || "").trim();
  const normalizeDonationsCryptoService = (service) => ({
    name: trimText(service?.name),
    ticker: trimText(service?.ticker),
    network: trimText(service?.network),
    address: trimText(service?.address),
    qrValue: trimText(service?.qrValue),
    note: trimText(service?.note),
    icon: trimText(service?.icon),
    actionLabel: trimText(service?.actionLabel),
    actionUrl: trimText(service?.actionUrl),
  });
  const normalizePagesPayload = (pages) => {
    if (!pages || typeof pages !== "object" || Array.isArray(pages)) {
      return {};
    }
    const donations =
      pages.donations && typeof pages.donations === "object" && !Array.isArray(pages.donations)
        ? pages.donations
        : null;
    if (!donations) {
      return pages;
    }
    return {
      ...pages,
      donations: {
        ...donations,
        cryptoServices: Array.isArray(donations.cryptoServices)
          ? donations.cryptoServices.map((service) => normalizeDonationsCryptoService(service))
          : [],
      },
    };
  };

  app.get("/api/public/settings", (_req, res) => {
    const settings = loadSiteSettings();
    return res.json({ settings, revision: createRevisionToken(settings) });
  });

  app.get("/api/public/tag-translations", (_req, res) => {
    const translations = loadTagTranslations();
    const revision = createRevisionToken(translations);
    res.json({
      tags: translations.tags,
      genres: translations.genres,
      staffRoles: translations.staffRoles,
      revision,
    });
  });

  app.post("/api/tag-translations/anilist-sync", requireAuth, async (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageIntegrations(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    try {
      const query = `
      query {
        GenreCollection
        MediaTagCollection {
          name
        }
      }
    `;
      const response = await fetch(ANILIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) {
        return res.status(502).json({ error: "anilist_failed" });
      }
      const data = await response.json();
      const rawGenres = Array.isArray(data?.data?.GenreCollection) ? data.data.GenreCollection : [];
      const rawTags = Array.isArray(data?.data?.MediaTagCollection)
        ? data.data.MediaTagCollection
        : [];
      const genres = rawGenres.map((genre) => String(genre || "").trim()).filter(Boolean);
      const tags = rawTags.map((tag) => String(tag?.name || "").trim()).filter(Boolean);
      const current = loadTagTranslations();
      const nextTags = { ...current.tags };
      const nextGenres = { ...current.genres };
      const nextStaffRoles = { ...current.staffRoles };
      tags.forEach((tag) => {
        if (typeof nextTags[tag] !== "string") {
          nextTags[tag] = "";
        }
      });
      genres.forEach((genre) => {
        if (typeof nextGenres[genre] !== "string") {
          nextGenres[genre] = "";
        }
      });
      const payload = { tags: nextTags, genres: nextGenres, staffRoles: nextStaffRoles };
      writeTagTranslations(payload);
      void enqueueProjectOgPrewarm({
        reason: "tag-translations-anilist-sync",
      }).catch(() => undefined);
      return res.json(payload);
    } catch {
      return res.status(502).json({ error: "anilist_failed" });
    }
  });

  app.get("/api/public/pages", (_req, res) => {
    const pages = loadPages();
    const settings = loadSiteSettings();
    return res.json({
      pages,
      mediaVariants: buildPublicMediaVariants([
        pages,
        { image: settings?.site?.defaultShareImage || "" },
      ]),
      revision: createRevisionToken(pages),
    });
  });

  app.get("/api/settings", requireAuth, (req, res) => {
    const userId = req.session?.user?.id;
    if (!canManageSettings(userId)) {
      return res.status(403).json({ error: "Sem permissão para gerenciar configurações." });
    }
    const settings = loadSiteSettings();
    return res.json({ settings, revision: createRevisionToken(settings) });
  });

  app.put("/api/settings", requireAuth, (req, res) => {
    const userId = req.session?.user?.id;
    const options = parseEditRevisionOptions(req.body);
    if (!canManageSettings(userId)) {
      return res.status(403).json({ error: "Sem permissão para gerenciar configurações." });
    }
    const currentSettings = loadSiteSettings();
    const currentRevision = createRevisionToken(currentSettings);
    const noConflict = ensureNoEditConflict({
      req,
      res,
      resourceType: "settings",
      resourceId: "global",
      current: currentSettings,
      currentRevision,
      options,
    });
    if (!noConflict) {
      return noConflict;
    }
    const settings = req.body?.settings;
    if (!settings || typeof settings !== "object") {
      return res.status(400).json({ error: "Payload inválido." });
    }
    const previousSettings = currentSettings;
    const previousDownloadIcons = collectDownloadIconUploads(previousSettings);
    const normalized = normalizeSiteSettings(settings);
    writeSiteSettings(normalized);
    const nextDownloadIcons = collectDownloadIconUploads(normalized);
    const removedIcons = Array.from(previousDownloadIcons).filter(
      (url) => !nextDownloadIcons.has(url),
    );
    removedIcons.forEach((url) => deletePrivateUploadByUrl(url));
    appendAuditLog(req, "settings.update", "settings", {});
    void enqueueProjectOgPrewarm({
      reason: "settings-update",
    }).catch(() => undefined);
    return res.json({ settings: normalized, revision: createRevisionToken(normalized) });
  });

  app.get("/api/pages", requireAuth, (req, res) => {
    const userId = req.session?.user?.id;
    if (!canManagePages(userId)) {
      return res.status(403).json({ error: "Sem permissão para gerenciar páginas." });
    }
    const pages = loadPages();
    return res.json({ pages, revision: createRevisionToken(pages) });
  });

  app.put("/api/pages", requireAuth, (req, res) => {
    const userId = req.session?.user?.id;
    const options = parseEditRevisionOptions(req.body);
    if (!canManagePages(userId)) {
      return res.status(403).json({ error: "Sem permissão para gerenciar páginas." });
    }
    const currentPages = loadPages();
    const currentRevision = createRevisionToken(currentPages);
    const noConflict = ensureNoEditConflict({
      req,
      res,
      resourceType: "pages",
      resourceId: "global",
      current: currentPages,
      currentRevision,
      options,
    });
    if (!noConflict) {
      return noConflict;
    }
    const pages = req.body?.pages;
    if (!pages || typeof pages !== "object") {
      return res.status(400).json({ error: "Payload inválido." });
    }
    const normalizedPages = normalizePagesPayload(pages);
    writePages(normalizedPages);
    appendAuditLog(req, "pages.update", "pages", {});
    return res.json({ pages: normalizedPages, revision: createRevisionToken(normalizedPages) });
  });

  app.post("/api/tag-translations/sync", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageIntegrations(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const { tags, genres, staffRoles } = req.body || {};
    const current = loadTagTranslations();
    const nextTags = { ...current.tags };
    const nextGenres = { ...current.genres };
    const nextStaffRoles = { ...current.staffRoles };

    const tagList = Array.isArray(tags) ? tags : [];
    tagList.forEach((tag) => {
      const key = String(tag || "").trim();
      if (key && typeof nextTags[key] !== "string") {
        nextTags[key] = "";
      }
    });

    const genreList = Array.isArray(genres) ? genres : [];
    genreList.forEach((genre) => {
      const key = String(genre || "").trim();
      if (key && typeof nextGenres[key] !== "string") {
        nextGenres[key] = "";
      }
    });

    const staffRoleList = Array.isArray(staffRoles) ? staffRoles : [];
    staffRoleList.forEach((role) => {
      const key = String(role || "").trim();
      if (key && typeof nextStaffRoles[key] !== "string") {
        nextStaffRoles[key] = "";
      }
    });

    const payload = { tags: nextTags, genres: nextGenres, staffRoles: nextStaffRoles };
    writeTagTranslations(payload);
    void enqueueProjectOgPrewarm({
      reason: "tag-translations-sync",
    }).catch(() => undefined);
    return res.json(payload);
  });

  app.put("/api/tag-translations", requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageSettings(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const options = parseEditRevisionOptions(req.body);
    const tags = req.body?.tags;
    const genres = req.body?.genres;
    const staffRoles = req.body?.staffRoles;
    if (
      (!tags || typeof tags !== "object") &&
      (!genres || typeof genres !== "object") &&
      (!staffRoles || typeof staffRoles !== "object")
    ) {
      return res.status(400).json({ error: "translations_required" });
    }
    const current = loadTagTranslations();
    const currentRevision = createRevisionToken(current);
    const noConflict = ensureNoEditConflict({
      req,
      res,
      resourceType: "tag_translations",
      resourceId: "global",
      current,
      currentRevision,
      options,
    });
    if (!noConflict) {
      return noConflict;
    }
    const normalizedTags =
      tags && typeof tags === "object"
        ? Object.fromEntries(
            Object.entries(tags).map(([key, value]) => [String(key), String(value || "")]),
          )
        : current.tags;
    const normalizedGenres =
      genres && typeof genres === "object"
        ? Object.fromEntries(
            Object.entries(genres).map(([key, value]) => [String(key), String(value || "")]),
          )
        : current.genres;
    const normalizedStaffRoles =
      staffRoles && typeof staffRoles === "object"
        ? Object.fromEntries(
            Object.entries(staffRoles).map(([key, value]) => [String(key), String(value || "")]),
          )
        : current.staffRoles;
    const payload = {
      tags: normalizedTags,
      genres: normalizedGenres,
      staffRoles: normalizedStaffRoles,
    };
    writeTagTranslations(payload);
    void enqueueProjectOgPrewarm({
      reason: "tag-translations-update",
    }).catch(() => undefined);
    return res.json({ ...payload, revision: createRevisionToken(payload) });
  });
};
