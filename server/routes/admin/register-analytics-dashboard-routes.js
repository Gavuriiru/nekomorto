export const registerAnalyticsDashboardRoutes = ({
  app,
  buildAnalyticsRange,
  buildDashboardOverviewResponsePayload,
  canManageComments,
  canManageIntegrations,
  canManageSettings,
  canViewAnalytics,
  filterAnalyticsEvents,
  getDayKeyFromTs,
  incrementCounter,
  loadAnalyticsEvents,
  loadComments,
  loadPosts,
  loadProjects,
  loadWebhookDeliveries,
  normalizeAnalyticsTypeFilter,
  normalizePosts,
  normalizeProjects,
  parseAnalyticsRangeDays,
  parseAnalyticsTs,
  parseDashboardNotificationsLimit,
  requireAuth,
  toDashboardNotificationId,
  WEBHOOK_DELIVERY_STATUS,
  evaluateOperationalMonitoring,
} = {}) => {
  app.get("/api/analytics/overview", requireAuth, (req, res) => {
    if (!canViewAnalytics(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const rangeDays = parseAnalyticsRangeDays(req.query.range);
    const type = normalizeAnalyticsTypeFilter(req.query.type);
    const range = buildAnalyticsRange(rangeDays);
    const events = filterAnalyticsEvents(loadAnalyticsEvents(), range.fromTs, range.toTs, type);
    const viewEvents = events.filter((event) => event.eventType === "view");
    const chapterViewEvents = events.filter((event) => event.eventType === "chapter_view");
    const downloadClickEvents = events.filter((event) => event.eventType === "download_click");
    const commentCreatedEvents = events.filter((event) => event.eventType === "comment_created");
    const commentApprovedEvents = events.filter((event) => event.eventType === "comment_approved");
    const uniqueVisitors = new Set(viewEvents.map((event) => event.visitorHash));

    return res.json({
      range: `${rangeDays}d`,
      type,
      from: new Date(range.fromTs).toISOString(),
      to: new Date(range.toTs).toISOString(),
      metrics: {
        views: viewEvents.length,
        uniqueViews: uniqueVisitors.size,
        chapterViews: chapterViewEvents.length,
        downloadClicks: downloadClickEvents.length,
        commentsCreated: commentCreatedEvents.length,
        commentsApproved: commentApprovedEvents.length,
      },
    });
  });

  app.get("/api/analytics/timeseries", requireAuth, (req, res) => {
    if (!canViewAnalytics(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const rangeDays = parseAnalyticsRangeDays(req.query.range);
    const type = normalizeAnalyticsTypeFilter(req.query.type);
    const metricRaw = String(req.query.metric || "")
      .trim()
      .toLowerCase();
    const metric = [
      "views",
      "unique_views",
      "comments",
      "chapter_views",
      "download_clicks",
    ].includes(metricRaw)
      ? metricRaw
      : "views";
    const range = buildAnalyticsRange(rangeDays);
    const events = filterAnalyticsEvents(loadAnalyticsEvents(), range.fromTs, range.toTs, type);
    const perDay = Object.fromEntries(
      range.dayKeys.map((day) => [
        day,
        {
          views: 0,
          chapterViews: 0,
          downloadClicks: 0,
          comments: 0,
          uniqueVisitors: new Set(),
        },
      ]),
    );
    events.forEach((event) => {
      const ts = parseAnalyticsTs(event.ts);
      if (ts === null) {
        return;
      }
      const dayKey = getDayKeyFromTs(ts);
      if (!perDay[dayKey]) {
        return;
      }
      if (event.eventType === "view") {
        perDay[dayKey].views += 1;
        perDay[dayKey].uniqueVisitors.add(event.visitorHash);
        return;
      }
      if (event.eventType === "comment_created") {
        perDay[dayKey].comments += 1;
        return;
      }
      if (event.eventType === "chapter_view") {
        perDay[dayKey].chapterViews += 1;
        return;
      }
      if (event.eventType === "download_click") {
        perDay[dayKey].downloadClicks += 1;
      }
    });

    const pickMetricValue = (day) => {
      if (metric === "views") return perDay[day].views;
      if (metric === "comments") return perDay[day].comments;
      if (metric === "chapter_views") return perDay[day].chapterViews;
      if (metric === "download_clicks") return perDay[day].downloadClicks;
      return perDay[day].uniqueVisitors.size;
    };

    return res.json({
      range: `${rangeDays}d`,
      type,
      metric,
      series: range.dayKeys.map((day) => ({
        date: day,
        value: pickMetricValue(day),
      })),
    });
  });

  app.get("/api/analytics/top-content", requireAuth, (req, res) => {
    if (!canViewAnalytics(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const rangeDays = parseAnalyticsRangeDays(req.query.range);
    const type = normalizeAnalyticsTypeFilter(req.query.type);
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 50) : 10;
    const range = buildAnalyticsRange(rangeDays);
    const allEvents = filterAnalyticsEvents(loadAnalyticsEvents(), range.fromTs, range.toTs, type);
    const viewEvents = allEvents.filter((event) => event.eventType === "view");
    const grouped = new Map();
    viewEvents.forEach((event) => {
      const resourceType = event.resourceType === "project" ? "project" : "post";
      const key = `${resourceType}:${event.resourceId}`;
      const previous = grouped.get(key) || {
        resourceType,
        resourceId: event.resourceId,
        views: 0,
        uniqueVisitors: new Set(),
      };
      previous.views += 1;
      previous.uniqueVisitors.add(event.visitorHash);
      grouped.set(key, previous);
    });

    const postsBySlug = new Map(normalizePosts(loadPosts()).map((post) => [post.slug, post]));
    const projectsById = new Map(
      normalizeProjects(loadProjects()).map((project) => [project.id, project]),
    );

    const entries = Array.from(grouped.values())
      .map((item) => {
        const title =
          item.resourceType === "project"
            ? projectsById.get(item.resourceId)?.title || `Projeto ${item.resourceId}`
            : postsBySlug.get(item.resourceId)?.title || `Post ${item.resourceId}`;
        return {
          resourceType: item.resourceType,
          resourceId: item.resourceId,
          title,
          views: item.views,
          uniqueViews: item.uniqueVisitors.size,
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);

    return res.json({
      range: `${rangeDays}d`,
      type,
      limit,
      entries,
    });
  });

  app.get("/api/analytics/acquisition", requireAuth, (req, res) => {
    if (!canViewAnalytics(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const rangeDays = parseAnalyticsRangeDays(req.query.range);
    const type = normalizeAnalyticsTypeFilter(req.query.type);
    const range = buildAnalyticsRange(rangeDays);
    const events = filterAnalyticsEvents(
      loadAnalyticsEvents(),
      range.fromTs,
      range.toTs,
      type,
    ).filter((event) => event.eventType === "view");

    const counters = {
      referrerHost: {},
      utmSource: {},
      utmMedium: {},
      utmCampaign: {},
    };

    events.forEach((event) => {
      incrementCounter(counters.referrerHost, event.referrerHost || "(direct)");
      if (event.utm?.source) incrementCounter(counters.utmSource, event.utm.source);
      if (event.utm?.medium) incrementCounter(counters.utmMedium, event.utm.medium);
      if (event.utm?.campaign) incrementCounter(counters.utmCampaign, event.utm.campaign);
    });

    const toSortedEntries = (target) =>
      Object.entries(target)
        .map(([key, value]) => ({ key, count: Number(value) || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

    return res.json({
      range: `${rangeDays}d`,
      type,
      referrerHost: toSortedEntries(counters.referrerHost),
      utmSource: toSortedEntries(counters.utmSource),
      utmMedium: toSortedEntries(counters.utmMedium),
      utmCampaign: toSortedEntries(counters.utmCampaign),
    });
  });

  app.get("/api/admin/operational-alerts", requireAuth, async (req, res) => {
    if (!canManageSettings(req.session?.user?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    res.setHeader("Cache-Control", "no-store");
    const snapshot = await evaluateOperationalMonitoring();
    return res.json(snapshot.alerts);
  });

  app.get("/api/dashboard/overview", requireAuth, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const userId = String(req.session?.user?.id || "").trim();
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }
    return res.json(buildDashboardOverviewResponsePayload(userId));
  });

  app.get("/api/dashboard/notifications", requireAuth, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const items = [];
    const nowTs = Date.now();
    const limit = parseDashboardNotificationsLimit(req.query.limit);

    if (canManageComments(userId)) {
      const comments = loadComments();
      const pendingCount = comments.filter((comment) => comment.status === "pending").length;
      if (pendingCount > 0) {
        const ts = new Date().toISOString();
        items.push({
          id: toDashboardNotificationId(`comments:pending:${pendingCount}`),
          kind: "pending",
          source: "comments",
          severity: pendingCount > 20 ? "critical" : "warning",
          title: "ComentÃ¡rios pendentes",
          description:
            pendingCount === 1
              ? "HÃ¡ 1 comentÃ¡rio aguardando moderaÃ§Ã£o."
              : `HÃ¡ ${pendingCount} comentÃ¡rios aguardando moderaÃ§Ã£o.`,
          href: "/dashboard/comentarios",
          ts,
        });
      }
      const approvedSince = nowTs - 24 * 60 * 60 * 1000;
      const approvedRecent = comments.filter((comment) => {
        if (comment.status !== "approved") {
          return false;
        }
        const createdTs = new Date(comment.createdAt || 0).getTime();
        return Number.isFinite(createdTs) && createdTs >= approvedSince;
      }).length;
      if (approvedRecent > 0) {
        const ts = new Date().toISOString();
        items.push({
          id: toDashboardNotificationId(`comments:approved:${approvedRecent}`),
          kind: "approval",
          source: "comments",
          severity: "info",
          title: "AprovaÃ§Ãµes recentes",
          description:
            approvedRecent === 1
              ? "1 comentÃ¡rio foi aprovado nas Ãºltimas 24h."
              : `${approvedRecent} comentÃ¡rios foram aprovados nas Ãºltimas 24h.`,
          href: "/dashboard/comentarios",
          ts,
        });
      }
    }

    if (canManageSettings(userId)) {
      try {
        const snapshot = await evaluateOperationalMonitoring();
        const operationalAlerts = Array.isArray(snapshot?.alerts?.alerts)
          ? snapshot.alerts.alerts
          : [];
        operationalAlerts.forEach((alert) => {
          if (!alert || (alert.severity !== "critical" && alert.severity !== "warning")) {
            return;
          }
          items.push({
            id: toDashboardNotificationId(`ops:${alert.code}:${alert.since || snapshot.ts}`),
            kind: "error",
            source: "operations",
            severity: alert.severity,
            title: alert.title || "Alerta operacional",
            description: alert.description || "Falha operacional detectada.",
            href: "/dashboard",
            ts: alert.since || snapshot.ts || new Date().toISOString(),
          });
        });
      } catch {
        // ignore transient monitoring errors in notifications endpoint
      }
    }

    if (canManageIntegrations(userId)) {
      const webhookFailures = loadWebhookDeliveries()
        .filter(
          (entry) =>
            String(entry?.status || "")
              .trim()
              .toLowerCase() === WEBHOOK_DELIVERY_STATUS.FAILED,
        )
        .sort(
          (a, b) => new Date(b?.updatedAt || 0).getTime() - new Date(a?.updatedAt || 0).getTime(),
        )
        .slice(0, 10);
      webhookFailures.forEach((entry) => {
        items.push({
          id: toDashboardNotificationId(`webhook:${entry.id}:${entry.updatedAt}`),
          kind: "error",
          source: "webhooks",
          severity: "warning",
          title: "Falha em webhook",
          description:
            String(entry?.lastErrorCode || "").trim() ||
            String(entry?.lastError || "").trim() ||
            "Entrega falhou.",
          href: "/dashboard/webhooks",
          ts: entry.updatedAt || new Date().toISOString(),
        });
      });
    }

    const sorted = items
      .slice()
      .sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime())
      .slice(0, limit);
    const summary = sorted.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.kind === "pending") acc.pending += 1;
        if (item.kind === "error") acc.error += 1;
        if (item.kind === "approval") acc.approval += 1;
        return acc;
      },
      { total: 0, pending: 0, error: 0, approval: 0 },
    );

    return res.json({
      generatedAt: new Date().toISOString(),
      items: sorted,
      summary,
    });
  });
};
