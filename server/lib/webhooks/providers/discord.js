const clampEmbedFieldValue = (value, max = 1024) => {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 3))}...`;
};

export const toDiscordWebhookPayload = (notification) => {
  const title = String(notification?.title || "Notificação").trim();
  const description = clampEmbedFieldValue(notification?.description || "", 4096);
  const fields = Array.isArray(notification?.fields)
    ? notification.fields
        .map((field) => ({
          name: clampEmbedFieldValue(field?.name || "", 256) || "-",
          value: clampEmbedFieldValue(field?.value || "", 1024) || "-",
          inline: field?.inline === true,
        }))
        .slice(0, 25)
    : [];

  const severity = String(notification?.severity || "info").toLowerCase();
  const color =
    severity === "critical" ? 0xef4444 : severity === "warning" ? 0xf59e0b : severity === "success" ? 0x10b981 : 0x3b82f6;

  const embed = {
    title: clampEmbedFieldValue(title, 256),
    description,
    color,
    fields,
    ...(notification?.url ? { url: String(notification.url) } : {}),
    ...(notification?.timestamp ? { timestamp: new Date(notification.timestamp).toISOString() } : {}),
    ...(notification?.footer?.text ? { footer: { text: clampEmbedFieldValue(notification.footer.text, 2048) } } : {}),
  };

  return {
    embeds: [embed],
    allowed_mentions: { parse: [] },
  };
};

