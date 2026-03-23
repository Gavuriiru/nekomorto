const severityLabel = (severity) => {
  if (severity === "critical") return "Crítico";
  if (severity === "warning") return "Atenção";
  if (severity === "success") return "Resolvido";
  return "Informativo";
};

const prettyCode = (code) => String(code || "").replace(/_/g, " ");
const MAX_FIELD_VALUE_LENGTH = 900;

const summarizeGroup = (items) => {
  const source = Array.isArray(items) ? items : [];
  const lines = [];
  let hiddenCount = 0;
  source.forEach((item) => {
    const line = `- ${item.title || prettyCode(item.code)} (${item.severity})`;
    const preview = [...lines, line].join("\n");
    if (preview.length > MAX_FIELD_VALUE_LENGTH) {
      hiddenCount += 1;
      return;
    }
    lines.push(line);
  });
  if (hiddenCount > 0) {
    lines.push(`+${hiddenCount} restante(s)`);
  }
  return lines.join("\n");
};

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
    severity: hasCritical
      ? "critical"
      : hasWarnings
        ? "warning"
        : resolved.length > 0
          ? "success"
          : "info",
    fields,
    url: dashboardUrl || undefined,
    footer: {
      text: `Status operacional • ${severityLabel(
        hasCritical
          ? "critical"
          : hasWarnings
            ? "warning"
            : resolved.length > 0
              ? "success"
              : "info",
      )}`,
    },
    timestamp: generatedAt || new Date().toISOString(),
  };
};
