const DISCORD_MAX_EMBEDS = 10;
const DISCORD_MAX_FIELDS = 25;
const DISCORD_MAX_CONTENT = 2000;
const DISCORD_MAX_EMBED_TITLE = 256;
const DISCORD_MAX_EMBED_DESCRIPTION = 4096;
const DISCORD_MAX_EMBED_FOOTER = 2048;
const DISCORD_MAX_EMBED_AUTHOR = 256;
const DISCORD_MAX_FIELD_NAME = 256;
const DISCORD_MAX_FIELD_VALUE = 1024;
const DISCORD_MAX_EMBED_TOTAL = 6000;
const ROLE_ID_PATTERN = /^\d+$/;

const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const asArray = (value) => (Array.isArray(value) ? value : []);

const toText = (value) => {
  if (value === null || typeof value === "undefined") {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
};

const truncateText = (value, maxLength) => {
  const text = toText(value);
  const normalizedMax = Math.max(0, Math.floor(Number(maxLength) || 0));
  if (!normalizedMax) {
    return "";
  }
  if (text.length <= normalizedMax) {
    return text;
  }
  if (normalizedMax <= 3) {
    return text.slice(0, normalizedMax);
  }
  return `${text.slice(0, normalizedMax - 3).trimEnd()}...`;
};

const normalizeRoleIds = (value) => {
  const seen = new Set();
  const roleIds = [];
  asArray(value).forEach((item) => {
    const roleId = String(item || "").trim();
    if (!ROLE_ID_PATTERN.test(roleId) || seen.has(roleId)) {
      return;
    }
    seen.add(roleId);
    roleIds.push(roleId);
  });
  return roleIds;
};

const severityToColor = (severity) => {
  const normalized = String(severity || "")
    .trim()
    .toLowerCase();
  if (normalized === "critical") {
    return 0xef4444;
  }
  if (normalized === "warning") {
    return 0xf59e0b;
  }
  if (normalized === "success") {
    return 0x22c55e;
  }
  return 0x3b82f6;
};

const normalizeColor = (value, severity) => {
  if (Number.isFinite(value)) {
    const numeric = Number(value);
    if (numeric >= 0 && numeric <= 0xffffff) {
      return Math.floor(numeric);
    }
  }
  const raw = String(value || "").trim();
  if (!raw) {
    return severityToColor(severity);
  }
  const hexCandidate = raw.startsWith("#") ? raw.slice(1) : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(hexCandidate)) {
    return severityToColor(severity);
  }
  return Number.parseInt(hexCandidate, 16);
};

const normalizeEmbedUrl = (value, origin = "") => {
  const raw = toText(value);
  if (!raw) {
    return "";
  }

  try {
    const absolute = new URL(raw);
    const protocol = String(absolute.protocol || "").toLowerCase();
    if (protocol === "http:" || protocol === "https:") {
      return absolute.toString();
    }
  } catch {}

  const base = toText(origin);
  if (!base) {
    return "";
  }

  try {
    const resolved = new URL(raw, base);
    const protocol = String(resolved.protocol || "").toLowerCase();
    if (protocol === "http:" || protocol === "https:") {
      return resolved.toString();
    }
  } catch {}

  return "";
};

const normalizeEmbedField = (value) => {
  const field = asObject(value);
  const name = truncateText(field.name, DISCORD_MAX_FIELD_NAME);
  const fieldValue = truncateText(field.value, DISCORD_MAX_FIELD_VALUE);
  if (!name && !fieldValue) {
    return null;
  }
  return {
    name: name || " ",
    value: fieldValue || " ",
    inline: field.inline === true,
  };
};

const getEmbedTextTotalLength = (embed) => {
  const source = asObject(embed);
  const footer = asObject(source.footer);
  const author = asObject(source.author);
  const fields = asArray(source.fields);
  return [
    toText(source.title),
    toText(source.description),
    toText(footer.text),
    toText(author.name),
    ...fields.flatMap((field) => [toText(field?.name), toText(field?.value)]),
  ].reduce((total, text) => total + text.length, 0);
};

const trimEmbedTotalLength = (embed) => {
  const next = {
    ...asObject(embed),
    footer: asObject(embed?.footer),
    author: asObject(embed?.author),
    fields: asArray(embed?.fields).map((field) => ({ ...asObject(field) })),
  };
  const trimTargets = [
    () => ["description", toText(next.description)],
    ...next.fields.map((field, index) => () => [`field:${index}:value`, toText(field.value)]),
    ...next.fields.map((field, index) => () => [`field:${index}:name`, toText(field.name)]),
    () => ["footer", toText(next.footer?.text)],
    () => ["author", toText(next.author?.name)],
    () => ["title", toText(next.title)],
  ];

  let total = getEmbedTextTotalLength(next);
  if (total <= DISCORD_MAX_EMBED_TOTAL) {
    return next;
  }

  for (const getTarget of trimTargets) {
    if (total <= DISCORD_MAX_EMBED_TOTAL) {
      break;
    }
    const [key, value] = getTarget();
    if (!value) {
      continue;
    }
    const overflow = total - DISCORD_MAX_EMBED_TOTAL;
    const allowed = Math.max(0, value.length - overflow);
    const truncated = truncateText(value, allowed);
    if (key === "description") {
      next.description = truncated;
    } else if (key === "footer") {
      next.footer = {
        ...next.footer,
        text: truncated,
      };
    } else if (key === "author") {
      next.author = {
        ...next.author,
        name: truncated,
      };
    } else if (key === "title") {
      next.title = truncated;
    } else if (key.startsWith("field:")) {
      const [, indexRaw, fieldKey] = key.split(":");
      const index = Number(indexRaw);
      if (Number.isInteger(index) && next.fields[index]) {
        next.fields[index] = {
          ...next.fields[index],
          [fieldKey]: truncated || " ",
        };
      }
    }
    total = getEmbedTextTotalLength(next);
  }

  return next;
};

const normalizeEmbed = (value, fallbackSeverity = "", origin = "") => {
  const source = asObject(value);

  const footerSource = asObject(source.footer);
  const authorSource = asObject(source.author);
  const thumbnailSource = asObject(source.thumbnail);
  const imageSource = asObject(source.image);

  const title = truncateText(source.title, DISCORD_MAX_EMBED_TITLE);
  const description = truncateText(source.description, DISCORD_MAX_EMBED_DESCRIPTION);
  const url = normalizeEmbedUrl(source.url, origin);
  const timestamp = toText(source.timestamp);

  const footerText = truncateText(source.footerText || footerSource.text, DISCORD_MAX_EMBED_FOOTER);
  const footerIconUrl = normalizeEmbedUrl(
    source.footerIconUrl || footerSource.icon_url || footerSource.iconUrl,
    origin,
  );

  const authorName = truncateText(source.authorName || authorSource.name, DISCORD_MAX_EMBED_AUTHOR);
  const authorIconUrl = normalizeEmbedUrl(
    source.authorIconUrl || authorSource.icon_url || authorSource.iconUrl,
    origin,
  );
  const authorUrl = normalizeEmbedUrl(source.authorUrl || authorSource.url, origin);

  const thumbnailUrl = normalizeEmbedUrl(source.thumbnailUrl || thumbnailSource.url, origin);
  const imageUrl = normalizeEmbedUrl(source.imageUrl || imageSource.url, origin);

  const fields = asArray(source.fields)
    .map((field) => normalizeEmbedField(field))
    .filter(Boolean)
    .slice(0, DISCORD_MAX_FIELDS);

  const embed = {};

  if (title) {
    embed.title = title;
  }
  if (description) {
    embed.description = description;
  }
  if (url) {
    embed.url = url;
  }
  if (timestamp) {
    embed.timestamp = timestamp;
  }

  embed.color = normalizeColor(source.color, source.severity || fallbackSeverity);

  if (footerText || footerIconUrl) {
    embed.footer = {
      ...(footerText ? { text: footerText } : {}),
      ...(footerIconUrl ? { icon_url: footerIconUrl } : {}),
    };
  }

  if (authorName || authorIconUrl || authorUrl) {
    embed.author = {
      ...(authorName ? { name: authorName } : {}),
      ...(authorUrl ? { url: authorUrl } : {}),
      ...(authorIconUrl ? { icon_url: authorIconUrl } : {}),
    };
  }

  if (thumbnailUrl) {
    embed.thumbnail = { url: thumbnailUrl };
  }

  if (imageUrl) {
    embed.image = { url: imageUrl };
  }

  if (fields.length > 0) {
    embed.fields = fields;
  }

  const hasAnyDisplayField = Boolean(
    embed.title ||
      embed.description ||
      embed.url ||
      (embed.fields && embed.fields.length > 0) ||
      embed.author ||
      embed.thumbnail ||
      embed.image ||
      embed.footer,
  );

  if (!hasAnyDisplayField) {
    return null;
  }

  return trimEmbedTotalLength(embed);
};

const inferEmbedsInput = (notification) => {
  const source = asObject(notification);
  const sourceEmbeds = asArray(source.embeds);
  if (sourceEmbeds.length > 0) {
    return sourceEmbeds;
  }
  if (source.embed && typeof source.embed === "object") {
    return [source.embed];
  }

  const hasLegacyRootEmbed = Boolean(
    toText(source.title) ||
      toText(source.description) ||
      toText(source.url) ||
      asArray(source.fields).length > 0 ||
      source.footer ||
      toText(source.timestamp),
  );
  if (hasLegacyRootEmbed) {
    return [source];
  }
  return [];
};

export const toDiscordWebhookPayload = (notification = {}) => {
  const source = asObject(notification);
  const content = truncateText(source.content, DISCORD_MAX_CONTENT);
  const origin = toText(source.origin);
  const embedsInput = inferEmbedsInput(source);
  const embeds = embedsInput
    .map((item) => normalizeEmbed(item, source.severity, origin))
    .filter(Boolean)
    .slice(0, DISCORD_MAX_EMBEDS);

  const allowedRoleIds = normalizeRoleIds(
    asArray(source.allowedMentionsRoleIds).length > 0
      ? source.allowedMentionsRoleIds
      : asObject(source.allowed_mentions).roles,
  );

  return {
    ...(content ? { content } : {}),
    ...(embeds.length > 0 ? { embeds } : {}),
    allowed_mentions: {
      parse: [],
      roles: allowedRoleIds,
    },
  };
};
