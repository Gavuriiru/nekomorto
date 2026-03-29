const REQUIRED_DEPENDENCY_KEYS = [
  "appendAuditLog",
  "createSecurityEventPayload",
  "createSystemAuditReq",
  "dispatchCriticalSecurityEventWebhook",
  "getIpv4Network24",
  "getRequestIp",
  "isAdminUser",
  "loadSecurityEvents",
  "loadUserSessionIndexRecords",
  "metricsRegistry",
  "normalizeSecurityEventStatus",
  "securityEventSeverity",
  "securityEventStatus",
  "upsertSecurityEvent",
  "writeSecurityEvents",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[security-events-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createSecurityEventsRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    appendAuditLog,
    createSecurityEventPayload,
    createSystemAuditReq,
    dispatchCriticalSecurityEventWebhook,
    getIpv4Network24,
    getRequestIp,
    isAdminUser,
    loadSecurityEvents,
    loadUserSessionIndexRecords,
    metricsRegistry,
    newNetworkLookbackMs = 30 * 24 * 60 * 60 * 1000,
    normalizeSecurityEventStatus,
    securityEventCooldownMaxEntries = 5_000,
    securityEventCooldownMs = 10 * 60 * 1000,
    securityEventMaxRows = 20_000,
    securityEventSeverity,
    securityEventStatus,
    upsertSecurityEvent,
    writeSecurityEvents,
  } = dependencies;

  const securityRuleEventCooldown = new Map();

  const shouldEmitSecurityRuleEvent = (ruleKey, actorKey = "") => {
    const normalizedRule = String(ruleKey || "").trim();
    if (!normalizedRule) {
      return false;
    }
    const key = `${normalizedRule}:${String(actorKey || "").trim()}`;
    const nowTs = Date.now();
    const previousTs = Number(securityRuleEventCooldown.get(key) || 0);
    if (Number.isFinite(previousTs) && nowTs - previousTs < securityEventCooldownMs) {
      return false;
    }
    securityRuleEventCooldown.set(key, nowTs);
    if (securityRuleEventCooldown.size > securityEventCooldownMaxEntries) {
      const cutoff = nowTs - securityEventCooldownMs;
      Array.from(securityRuleEventCooldown.entries()).forEach(([entryKey, value]) => {
        if (Number(value) < cutoff) {
          securityRuleEventCooldown.delete(entryKey);
        }
      });
    }
    return true;
  };

  const trimSecurityEvents = (events) => {
    const safe = Array.isArray(events) ? events : [];
    if (safe.length <= securityEventMaxRows) {
      return safe;
    }
    return safe.slice(0, securityEventMaxRows);
  };

  const sanitizeSecurityEventData = (data) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }
    const output = {};
    Object.entries(data)
      .slice(0, 50)
      .forEach(([key, value]) => {
        if (value === undefined) {
          return;
        }
        if (value === null) {
          output[key] = null;
          return;
        }
        if (typeof value === "string") {
          output[key] = value.slice(0, 1000);
          return;
        }
        if (typeof value === "number" || typeof value === "boolean") {
          output[key] = value;
          return;
        }
        if (Array.isArray(value)) {
          output[key] = value.slice(0, 20);
          return;
        }
        if (typeof value === "object") {
          output[key] = value;
        }
      });
    return output;
  };

  const emitSecurityEvent = ({
    req,
    type,
    severity,
    riskScore,
    actorUserId,
    targetUserId,
    data,
  } = {}) => {
    const payload = createSecurityEventPayload({
      type,
      severity,
      riskScore,
      actorUserId: actorUserId || req?.session?.user?.id || null,
      targetUserId,
      ip: getRequestIp(req),
      userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 512),
      sessionId: req?.sessionID ? String(req.sessionID) : null,
      requestId: req?.requestId ? String(req.requestId) : null,
      status: securityEventStatus.OPEN,
      data: sanitizeSecurityEventData(data),
    });
    const saved = upsertSecurityEvent(payload);
    if (!saved) {
      return null;
    }
    const trimmedEvents = trimSecurityEvents(loadSecurityEvents());
    if (trimmedEvents.length !== loadSecurityEvents().length) {
      writeSecurityEvents(trimmedEvents);
    }
    metricsRegistry.inc("security_events_open_total", {
      severity: String(saved.severity || "info"),
      type: String(saved.type || "security_event"),
    });
    appendAuditLog(req || createSystemAuditReq(), "security.event.open", "security", {
      id: saved.id,
      type: saved.type,
      severity: saved.severity,
      riskScore: saved.riskScore,
      targetUserId: saved.targetUserId || null,
    });
    if (String(saved.severity || "").toLowerCase() === securityEventSeverity.CRITICAL) {
      void dispatchCriticalSecurityEventWebhook(saved);
    }
    return saved;
  };

  const toSecurityEventApiResponse = (event) => ({
    id: event.id,
    ts: event.ts,
    type: event.type,
    severity: event.severity,
    riskScore: Number(event.riskScore || 0),
    status: event.status,
    actorUserId: event.actorUserId || null,
    targetUserId: event.targetUserId || null,
    ip: event.ip || "",
    userAgent: event.userAgent || "",
    sessionId: event.sessionId || null,
    requestId: event.requestId || null,
    data: event.data || {},
  });

  const findSecurityEventById = (id) =>
    loadSecurityEvents().find((entry) => String(entry?.id || "") === String(id || "")) || null;

  const updateSecurityEventStatus = ({ eventId, status, actorUserId } = {}) => {
    const existing = findSecurityEventById(eventId);
    if (!existing) {
      return null;
    }
    const normalizedStatus = normalizeSecurityEventStatus(status);
    return upsertSecurityEvent({
      ...existing,
      status: normalizedStatus,
      updatedAt: new Date().toISOString(),
      data: {
        ...(existing.data && typeof existing.data === "object" ? existing.data : {}),
        statusUpdatedAt: new Date().toISOString(),
        statusUpdatedBy: actorUserId ? String(actorUserId) : "system",
      },
    });
  };

  const maybeEmitAdminActionFromNewNetwork = (req) => {
    const userId = String(req?.session?.user?.id || "").trim();
    if (!userId || !String(req?.path || "").startsWith("/api/admin")) {
      return;
    }
    if (!isAdminUser(req?.session?.user)) {
      return;
    }
    const network = getIpv4Network24(getRequestIp(req));
    if (!network) {
      return;
    }
    const nowTs = Date.now();
    const hasKnownNetwork = loadUserSessionIndexRecords({ userId, includeRevoked: true }).some(
      (item) => {
        const ts = new Date(item?.lastSeenAt || 0).getTime();
        if (!Number.isFinite(ts) || nowTs - ts > newNetworkLookbackMs) {
          return false;
        }
        return getIpv4Network24(item?.lastIp) === network;
      },
    );
    if (
      hasKnownNetwork ||
      !shouldEmitSecurityRuleEvent("admin_action_from_new_network_warning", `${userId}:${network}`)
    ) {
      return;
    }
    emitSecurityEvent({
      req,
      type: "admin_action_from_new_network_warning",
      severity: securityEventSeverity.WARNING,
      riskScore: 72,
      actorUserId: userId,
      targetUserId: userId,
      data: {
        network,
        path: String(req.path || ""),
        method: String(req.method || "").toUpperCase(),
      },
    });
  };

  return {
    emitSecurityEvent,
    maybeEmitAdminActionFromNewNetwork,
    shouldEmitSecurityRuleEvent,
    toSecurityEventApiResponse,
    updateSecurityEventStatus,
  };
};

export default createSecurityEventsRuntime;
