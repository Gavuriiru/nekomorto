const severityLabel = (severity) => {
  if (severity === "critical") return "Crítico";
  if (severity === "warning") return "Atenção";
  if (severity === "success") return "Resolvido";
  return "Informativo";
};

const prettyCode = (code) => String(code || "").replace(/_/g, " ");

const summarizeGroup = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item) => `• ${item.title || prettyCode(item.code)} (${item.severity})`)
    .join("\n");

export const buildOperationalAlertsWebhookNotification = ({
  transition,
  dashboardUrl = "",
  generatedAt,
} = {}) => {
  const triggered = Array.isArray(transition?.triggered) ? transition.triggered : [];
  const changed = Array.isArray(transition?.changed) ? transition.changed : [];
  const resolved = Array.isArray(transition?.resolved) ? transition.resolved : [];
  const totalChanges = triggered.length + changed.length + resolved.length;
  const hasCritical = [...triggered, ...changed].some((alert) => alert.severity === "critical");
  const hasWarnings = [...triggered, ...changed].some((alert) => alert.severity === "warning");

  const title =
    resolved.length > 0 && triggered.length === 0 && changed.length === 0
      ? "Alertas operacionais resolvidos"
      : "Mudança nos alertas operacionais";
  const description =
    totalChanges === 0
      ? "Sem mudanças nos alertas."
      : `${totalChanges} mudança(s) detectada(s) no estado operacional.`;

  const fields = [];
  if (triggered.length > 0) {
    fields.push({
      name: `Disparados (${triggered.length})`,
      value: summarizeGroup(triggered),
    });
  }
  if (changed.length > 0) {
    fields.push({
      name: `Alterados (${changed.length})`,
      value: summarizeGroup(changed),
    });
  }
  if (resolved.length > 0) {
    fields.push({
      name: `Resolvidos (${resolved.length})`,
      value: summarizeGroup(resolved.map((item) => ({ ...item, severity: "success" }))),
    });
  }

  return {
    title,
    description,
    severity: hasCritical ? "critical" : hasWarnings ? "warning" : resolved.length > 0 ? "success" : "info",
    fields,
    url: dashboardUrl || undefined,
    footer: {
      text: `Status operacional • ${severityLabel(
        hasCritical ? "critical" : hasWarnings ? "warning" : resolved.length > 0 ? "success" : "info",
      )}`,
    },
    timestamp: generatedAt || new Date().toISOString(),
  };
};

