import { Router } from "express";

const setNoStore = (res) => {
  res.setHeader("Cache-Control", "no-store");
};

export const registerOperationalRoutes = ({
  app,
  buildRuntimeMetadata,
  evaluateOperationalMonitoring,
  isMetricsEnabled,
  loadSecurityEvents,
  loadUserSessionIndexRecords,
  metricsRegistry,
  metricsTokenNormalized,
  securityEventStatusOpen,
}) => {
  const router = Router();

  router.get("/api/health/live", (_req, res) => {
    setNoStore(res);
    return res.json({
      ok: true,
      status: "ok",
      ts: new Date().toISOString(),
      build: buildRuntimeMetadata(),
    });
  });

  const sendOperationalHealth = async (res) => {
    setNoStore(res);
    const snapshot = await evaluateOperationalMonitoring();
    const statusCode = snapshot.health.status === "fail" ? 503 : 200;
    return res.status(statusCode).json({
      ...snapshot.health,
      build: buildRuntimeMetadata(),
    });
  };

  router.get("/api/health/ready", async (_req, res) => {
    return sendOperationalHealth(res);
  });

  router.get("/api/health", async (_req, res) => {
    return sendOperationalHealth(res);
  });

  router.get("/api/metrics", (req, res) => {
    if (!isMetricsEnabled || !metricsTokenNormalized) {
      return res.status(404).json({ error: "not_found" });
    }
    const authHeader = String(req.headers.authorization || "").trim();
    const tokenFromHeader = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice("bearer ".length).trim()
      : "";
    const token = tokenFromHeader || String(req.headers["x-metrics-token"] || "").trim();
    if (!token || token !== metricsTokenNormalized) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const activeSessionsCount = loadUserSessionIndexRecords({ includeRevoked: false }).filter(
      (entry) => !entry.revokedAt,
    ).length;
    metricsRegistry.setGauge("active_sessions_total", {}, activeSessionsCount);
    const openSecurityEvents = loadSecurityEvents().filter(
      (entry) => String(entry.status || "").toLowerCase() === securityEventStatusOpen,
    ).length;
    metricsRegistry.setGauge("security_events_open_current", {}, openSecurityEvents);

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    return res.status(200).send(metricsRegistry.renderPrometheus());
  });

  app.use(router);
};
