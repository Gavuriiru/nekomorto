export const createAnalyticsStore = ({
  analyticsAggRetentionDays = 30,
  analyticsAggRetentionMs = 0,
  analyticsCooldownEventTypeSet,
  analyticsCooldownResourceSet,
  analyticsEventTypeSet,
  analyticsIpSalt,
  analyticsMetaStringMax = 256,
  analyticsRetentionDays = 30,
  analyticsRetentionMs = 0,
  analyticsSchemaVersion = 1,
  analyticsViewCooldown,
  analyticsViewCooldownMs = 0,
  backgroundJobQueue,
  crypto,
  getDataRepository,
  getRequestIp,
  primaryAppHost,
  primaryAppOrigin,
  sessionSecret,
} = {}) => {
  const parseAnalyticsTs = (value) => {
    const ts = new Date(value || 0).getTime();
    return Number.isFinite(ts) ? ts : null;
  };

  const getDayKeyFromTs = (value) => {
    const ts = Number(value);
    if (!Number.isFinite(ts)) {
      return new Date().toISOString().slice(0, 10);
    }
    return new Date(ts).toISOString().slice(0, 10);
  };

  const normalizeAnalyticsTypeFilter = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (["post", "project"].includes(normalized)) {
      return normalized;
    }
    return "all";
  };

  const parseAnalyticsRangeDays = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (normalized === "7d") return 7;
    if (normalized === "30d") return 30;
    if (normalized === "90d") return 90;
    return 30;
  };

  const sanitizeAnalyticsText = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.length <= analyticsMetaStringMax) {
      return text;
    }
    return `${text.slice(0, analyticsMetaStringMax)}...`;
  };

  const sanitizeUtmValue = (value) =>
    sanitizeAnalyticsText(value)
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "_")
      .slice(0, 64);

  const getVisitorHash = (req) => {
    const ip = getRequestIp(req);
    if (!ip) {
      return "anonymous";
    }
    const salt = analyticsIpSalt || sessionSecret || "dev-analytics-salt";
    return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
  };

  const getRequestAcquisition = (req) => {
    const refererHeader = String(req.headers.referer || "");
    const fallback = {
      referrerHost: "(direct)",
      utm: { source: "", medium: "", campaign: "" },
    };
    if (!refererHeader) {
      return fallback;
    }
    try {
      const parsed = new URL(refererHeader, primaryAppOrigin);
      const host = String(parsed.host || "")
        .trim()
        .toLowerCase();
      const utm = {
        source: sanitizeUtmValue(parsed.searchParams.get("utm_source") || ""),
        medium: sanitizeUtmValue(parsed.searchParams.get("utm_medium") || ""),
        campaign: sanitizeUtmValue(parsed.searchParams.get("utm_campaign") || ""),
      };
      if (!host) {
        return { ...fallback, utm };
      }
      const referrerHost = host === primaryAppHost ? "(internal)" : host;
      return { referrerHost, utm };
    } catch {
      return fallback;
    }
  };

  const sanitizeAnalyticsMeta = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    const allowlist = [
      "targetType",
      "targetId",
      "status",
      "action",
      "resourceType",
      "resourceId",
      "projectId",
      "chapterNumber",
      "volume",
      "sourceLabel",
      "surface",
      "platform",
      "browser",
      "displayMode",
      "outcome",
    ];
    const output = {};
    allowlist.forEach((key) => {
      if (!(key in value)) {
        return;
      }
      output[key] = sanitizeAnalyticsText(value[key]);
    });
    return output;
  };

  const normalizeAnalyticsEvent = (event) => {
    const eventType = String(event?.eventType || "")
      .trim()
      .toLowerCase();
    const normalizedType = analyticsEventTypeSet.has(eventType) ? eventType : "view";
    const resourceTypeRaw = String(event?.resourceType || "")
      .trim()
      .toLowerCase();
    const resourceType = resourceTypeRaw || "post";
    return {
      id: String(event?.id || crypto.randomUUID()),
      ts: event?.ts || new Date().toISOString(),
      day: String(event?.day || getDayKeyFromTs(parseAnalyticsTs(event?.ts) || Date.now())),
      eventType: normalizedType,
      resourceType,
      resourceId: String(event?.resourceId || "").trim(),
      visitorHash: String(event?.visitorHash || "anonymous"),
      referrerHost: sanitizeAnalyticsText(event?.referrerHost || "(direct)") || "(direct)",
      utm: {
        source: sanitizeUtmValue(event?.utm?.source || ""),
        medium: sanitizeUtmValue(event?.utm?.medium || ""),
        campaign: sanitizeUtmValue(event?.utm?.campaign || ""),
      },
      isAuthenticated: Boolean(event?.isAuthenticated),
      meta: sanitizeAnalyticsMeta(event?.meta || {}),
    };
  };

  const loadAnalyticsEvents = () => {
    const dataRepository = getDataRepository?.();
    if (!dataRepository) {
      return [];
    }
    const events = dataRepository.loadAnalyticsEvents();
    return (Array.isArray(events) ? events : []).map((event) => normalizeAnalyticsEvent(event));
  };

  const writeAnalyticsEvents = (events) => {
    const lines = (Array.isArray(events) ? events : [])
      .map((event) => normalizeAnalyticsEvent(event))
      .filter(Boolean);
    const dataRepository = getDataRepository?.();
    if (dataRepository) {
      dataRepository.writeAnalyticsEvents(lines);
    }
  };

  const appendAnalyticsEventEntry = (event) => {
    const normalizedEvent = normalizeAnalyticsEvent(event);
    const dataRepository = getDataRepository?.();
    if (!dataRepository) {
      return;
    }
    if (typeof dataRepository.appendAnalyticsEventEntry === "function") {
      dataRepository.appendAnalyticsEventEntry(normalizedEvent);
      return;
    }
    const events = loadAnalyticsEvents();
    events.push(normalizedEvent);
    writeAnalyticsEvents(events);
  };

  const loadAnalyticsDaily = () => {
    const fallback = {
      schemaVersion: analyticsSchemaVersion,
      generatedAt: new Date().toISOString(),
      days: {},
    };
    const dataRepository = getDataRepository?.();
    if (!dataRepository) {
      return fallback;
    }
    const parsed = dataRepository.loadAnalyticsDaily();
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    return {
      schemaVersion: Number(parsed.schemaVersion) || analyticsSchemaVersion,
      generatedAt: String(parsed.generatedAt || fallback.generatedAt),
      days: parsed.days && typeof parsed.days === "object" ? parsed.days : {},
    };
  };

  const writeAnalyticsDaily = (data) => {
    const dataRepository = getDataRepository?.();
    if (!dataRepository) {
      return;
    }
    dataRepository.writeAnalyticsDaily({
      schemaVersion: analyticsSchemaVersion,
      generatedAt: data?.generatedAt || new Date().toISOString(),
      days: data?.days && typeof data.days === "object" ? data.days : {},
    });
  };

  const writeAnalyticsMeta = (value) => {
    const payload = {
      schemaVersion: analyticsSchemaVersion,
      retentionDays: analyticsRetentionDays,
      aggregateRetentionDays: analyticsAggRetentionDays,
      updatedAt: new Date().toISOString(),
      ...(value && typeof value === "object" ? value : {}),
    };
    const dataRepository = getDataRepository?.();
    if (dataRepository) {
      dataRepository.writeAnalyticsMeta(payload);
    }
  };

  const ensureAnalyticsDayBucket = (days, dayKey) => {
    if (!days[dayKey]) {
      days[dayKey] = {
        totals: {
          views: 0,
          chapterViews: 0,
          downloadClicks: 0,
          commentsCreated: 0,
          commentsApproved: 0,
        },
        byResourceType: {
          post: { views: 0 },
          project: { views: 0 },
        },
        acquisition: {
          referrerHost: {},
          utmSource: {},
          utmMedium: {},
          utmCampaign: {},
        },
      };
    }
    return days[dayKey];
  };

  const incrementCounter = (target, key, amount = 1) => {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) {
      return;
    }
    target[normalizedKey] = Number(target[normalizedKey] || 0) + amount;
  };

  const buildAnalyticsDailyFromEvents = (events, nowTs = Date.now()) => {
    const cutoff = nowTs - analyticsAggRetentionMs;
    const days = {};
    events.forEach((event) => {
      const ts = parseAnalyticsTs(event.ts);
      if (ts === null || ts < cutoff) {
        return;
      }
      const dayKey = getDayKeyFromTs(ts);
      const bucket = ensureAnalyticsDayBucket(days, dayKey);
      if (event.eventType === "view") {
        bucket.totals.views += 1;
        if (event.resourceType === "post" || event.resourceType === "project") {
          bucket.byResourceType[event.resourceType].views += 1;
        }
        incrementCounter(bucket.acquisition.referrerHost, event.referrerHost || "(direct)");
        if (event.utm?.source) incrementCounter(bucket.acquisition.utmSource, event.utm.source);
        if (event.utm?.medium) incrementCounter(bucket.acquisition.utmMedium, event.utm.medium);
        if (event.utm?.campaign)
          incrementCounter(bucket.acquisition.utmCampaign, event.utm.campaign);
      }
      if (event.eventType === "chapter_view") {
        bucket.totals.chapterViews += 1;
      }
      if (event.eventType === "download_click") {
        bucket.totals.downloadClicks += 1;
      }
      if (event.eventType === "comment_created") {
        bucket.totals.commentsCreated += 1;
      }
      if (event.eventType === "comment_approved") {
        bucket.totals.commentsApproved += 1;
      }
    });
    return {
      schemaVersion: analyticsSchemaVersion,
      generatedAt: new Date().toISOString(),
      days,
    };
  };

  const compactAnalyticsData = (nowTs = Date.now()) => {
    const cutoff = nowTs - analyticsRetentionMs;
    const compacted = loadAnalyticsEvents()
      .filter((event) => parseAnalyticsTs(event.ts) !== null)
      .filter((event) => parseAnalyticsTs(event.ts) >= cutoff)
      .sort((a, b) => (parseAnalyticsTs(a.ts) || 0) - (parseAnalyticsTs(b.ts) || 0));
    writeAnalyticsEvents(compacted);
    const daily = buildAnalyticsDailyFromEvents(compacted, nowTs);
    writeAnalyticsDaily(daily);
    writeAnalyticsMeta({
      eventCount: compacted.length,
      lastCompactionAt: new Date().toISOString(),
    });
    return { events: compacted, daily };
  };

  const enqueueAnalyticsCompactionJob = ({ trigger = "manual" } = {}) =>
    backgroundJobQueue.enqueue({
      type: "analytics.compaction",
      payload: { trigger },
      run: async () => compactAnalyticsData(),
    });

  const shouldRegisterAnalyticsView = (
    visitorHash,
    resourceType,
    resourceId,
    nowTs = Date.now(),
  ) => {
    const key = `${visitorHash}|${resourceType}|${resourceId}`;
    const previous = analyticsViewCooldown.get(key);
    if (Number.isFinite(previous) && nowTs - previous < analyticsViewCooldownMs) {
      return false;
    }
    analyticsViewCooldown.set(key, nowTs);
    if (analyticsViewCooldown.size > 20000) {
      const expirationTs = nowTs - analyticsViewCooldownMs;
      Array.from(analyticsViewCooldown.entries()).forEach(([entryKey, ts]) => {
        if (ts < expirationTs) {
          analyticsViewCooldown.delete(entryKey);
        }
      });
    }
    return true;
  };

  const appendAnalyticsEvent = (req, payload) => {
    try {
      const normalizedPayload = payload && typeof payload === "object" ? payload : {};
      const eventType = String(normalizedPayload.eventType || "")
        .trim()
        .toLowerCase();
      if (!analyticsEventTypeSet.has(eventType)) {
        return { ok: false, reason: "invalid_event_type" };
      }
      const resourceType = String(normalizedPayload.resourceType || "")
        .trim()
        .toLowerCase();
      const resourceId = String(normalizedPayload.resourceId || "").trim();
      if (!resourceType || !resourceId) {
        return { ok: false, reason: "invalid_resource" };
      }
      const now = new Date();
      const visitorHash = getVisitorHash(req);
      if (
        analyticsCooldownEventTypeSet.has(eventType) &&
        analyticsCooldownResourceSet.has(resourceType) &&
        !shouldRegisterAnalyticsView(visitorHash, resourceType, resourceId, now.getTime())
      ) {
        return { ok: false, reason: "cooldown" };
      }
      const acquisition = getRequestAcquisition(req);
      const event = normalizeAnalyticsEvent({
        id: crypto.randomUUID(),
        ts: now.toISOString(),
        day: getDayKeyFromTs(now.getTime()),
        eventType,
        resourceType,
        resourceId,
        visitorHash,
        referrerHost: acquisition.referrerHost,
        utm: acquisition.utm,
        isAuthenticated: Boolean(req.session?.user),
        meta: sanitizeAnalyticsMeta(normalizedPayload.meta || {}),
      });
      appendAnalyticsEventEntry(event);
      return { ok: true };
    } catch {
      return { ok: false, reason: "error" };
    }
  };

  const buildAnalyticsRange = (rangeDays, nowTs = Date.now()) => {
    const safeDays = Number.isFinite(rangeDays) ? Math.max(1, Math.floor(rangeDays)) : 30;
    const endDate = new Date(nowTs);
    endDate.setUTCHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setUTCDate(endDate.getUTCDate() - (safeDays - 1));
    startDate.setUTCHours(0, 0, 0, 0);
    const keys = [];
    for (let index = 0; index < safeDays; index += 1) {
      const day = new Date(startDate);
      day.setUTCDate(startDate.getUTCDate() + index);
      keys.push(day.toISOString().slice(0, 10));
    }
    return {
      rangeDays: safeDays,
      fromTs: startDate.getTime(),
      toTs: endDate.getTime(),
      dayKeys: keys,
    };
  };

  const filterAnalyticsEvents = (events, fromTs, toTs, type) =>
    events.filter((event) => {
      const ts = parseAnalyticsTs(event.ts);
      if (ts === null || ts < fromTs || ts > toTs) {
        return false;
      }
      if (type !== "all" && event.resourceType !== type) {
        if (event.resourceType === "comment") {
          return String(event.meta?.targetType || "").toLowerCase() === type;
        }
        if (event.resourceType === "chapter" && type === "project") {
          return true;
        }
        return false;
      }
      return true;
    });

  return {
    appendAnalyticsEvent,
    buildAnalyticsRange,
    enqueueAnalyticsCompactionJob,
    filterAnalyticsEvents,
    getDayKeyFromTs,
    incrementCounter,
    loadAnalyticsEvents,
    normalizeAnalyticsTypeFilter,
    parseAnalyticsRangeDays,
    parseAnalyticsTs,
  };
};
