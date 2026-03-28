const runStartupMaintenance = async ({
  enqueueAnalyticsCompactionJob,
  isAutoUploadReorganizationOnStartupEnabled,
  runAutoUploadReorganization,
  runStartupSecuritySanitization,
} = {}) => {
  try {
    runStartupSecuritySanitization?.();
  } catch {
    // ignore startup sanitization failures on boot
  }

  try {
    await enqueueAnalyticsCompactionJob?.({ trigger: "startup" });
  } catch {
    // ignore analytics compaction failures on boot
  }

  if (isAutoUploadReorganizationOnStartupEnabled) {
    try {
      await runAutoUploadReorganization?.({ trigger: "startup" });
    } catch {
      // ignore auto-reorganization failures on boot
    }
  }
};

export const startServerJobs = ({
  ANALYTICS_COMPACTION_INTERVAL_MS,
  OPERATIONAL_ALERTS_SCHEDULER_POLL_MS,
  WEBHOOK_WORKER_POLL_INTERVAL_MS,
  analyticsCompactionState,
  enqueueAnalyticsCompactionJob,
  httpServer,
  isAutoUploadReorganizationOnStartupEnabled,
  isMaintenanceMode,
  listenPort,
  operationalAlertsWebhookState,
  rateLimiter,
  runAutoUploadReorganization,
  runOperationalAlertsSchedulerTick,
  runStartupSecuritySanitization,
  runWebhookDeliveryWorkerTick,
  webhookDeliveryWorkerState,
} = {}) => {
  httpServer.listen(listenPort, () => {
    console.log(
      `[server] listening on :${listenPort} (data_source=db, maintenance=${isMaintenanceMode})`,
    );
    setImmediate(() => {
      void runStartupMaintenance({
        enqueueAnalyticsCompactionJob,
        isAutoUploadReorganizationOnStartupEnabled,
        runAutoUploadReorganization,
        runStartupSecuritySanitization,
      });
    });
    analyticsCompactionState.timer = setInterval(() => {
      void enqueueAnalyticsCompactionJob({ trigger: "interval" }).catch(() => undefined);
    }, ANALYTICS_COMPACTION_INTERVAL_MS);
    analyticsCompactionState.timer.unref?.();
    webhookDeliveryWorkerState.timer = setInterval(() => {
      void runWebhookDeliveryWorkerTick();
    }, WEBHOOK_WORKER_POLL_INTERVAL_MS);
    webhookDeliveryWorkerState.timer.unref?.();
    setImmediate(() => {
      void runWebhookDeliveryWorkerTick();
    });
    operationalAlertsWebhookState.timer = setInterval(() => {
      void runOperationalAlertsSchedulerTick();
    }, OPERATIONAL_ALERTS_SCHEDULER_POLL_MS);
    operationalAlertsWebhookState.timer.unref?.();
    setImmediate(() => {
      void runOperationalAlertsSchedulerTick();
    });
  });

  httpServer.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      console.error(
        `[server] Port ${listenPort} is already in use. Stop the existing process or run "npm run dev" to perform automatic cleanup.`,
      );
      process.exit(1);
      return;
    }
    console.error(
      `[server] Failed to start HTTP server on :${listenPort}. ${String(error?.message || "Unknown error")}`,
    );
    process.exit(1);
  });

  httpServer.on("close", () => {
    if (analyticsCompactionState.timer) {
      clearInterval(analyticsCompactionState.timer);
      analyticsCompactionState.timer = null;
    }
    if (webhookDeliveryWorkerState.timer) {
      clearInterval(webhookDeliveryWorkerState.timer);
      webhookDeliveryWorkerState.timer = null;
    }
    if (operationalAlertsWebhookState.timer) {
      clearInterval(operationalAlertsWebhookState.timer);
      operationalAlertsWebhookState.timer = null;
    }
    void rateLimiter.close();
  });
};

export default startServerJobs;
