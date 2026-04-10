import { PUBLIC_ANALYTICS_INGEST_PATHS } from "../../../shared/public-analytics.js";

export const registerPublicAnalyticsRoutes = ({
  PUBLIC_ANALYTICS_EVENT_TYPE_SET,
  PUBLIC_ANALYTICS_RESOURCE_TYPE_SET,
  app,
  appendAnalyticsEvent,
  canRegisterView,
  getRequestIp,
} = {}) => {
  const handlePublicAnalyticsIngest = async (req, res) => {
    const ip = typeof getRequestIp === "function" ? getRequestIp(req) : String(req?.ip || "");
    if (!(await canRegisterView(ip))) {
      return res.status(429).json({ error: "rate_limited" });
    }
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const eventType = String(payload.eventType || "")
      .trim()
      .toLowerCase();
    const resourceType = String(payload.resourceType || "")
      .trim()
      .toLowerCase();
    const resourceId = String(payload.resourceId || "").trim();
    if (!PUBLIC_ANALYTICS_EVENT_TYPE_SET.has(eventType)) {
      return res.status(400).json({ error: "invalid_event_type" });
    }
    if (!PUBLIC_ANALYTICS_RESOURCE_TYPE_SET.has(resourceType)) {
      return res.status(400).json({ error: "invalid_resource_type" });
    }
    if (!resourceId) {
      return res.status(400).json({ error: "invalid_resource_id" });
    }
    const result = appendAnalyticsEvent(req, {
      eventType,
      resourceType,
      resourceId,
      meta:
        payload.meta && typeof payload.meta === "object" && !Array.isArray(payload.meta)
          ? payload.meta
          : {},
    });
    if (result.ok || result.reason === "cooldown") {
      return res.json({ ok: true, deduped: result.reason === "cooldown" });
    }
    return res.status(500).json({ error: "event_write_failed" });
  };

  PUBLIC_ANALYTICS_INGEST_PATHS.forEach((path) => {
    app.post(path, handlePublicAnalyticsIngest);
  });
};

export default registerPublicAnalyticsRoutes;
