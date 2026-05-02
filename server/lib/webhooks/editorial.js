const EDITORIAL_EVENT_TO_CHANNEL = {
  post_create: "posts",
  post_update: "posts",
  project_release: "projects",
  project_adjust: "projects",
};

const EDITORIAL_EVENT_LABEL_LEGACY = {
  post_create: "Novo post",
  post_update: "Post atualizado",
  project_release: "Novo lançamento",
  project_adjust: "Atualização de capítulo/episódio",
};

const EDITORIAL_EVENT_LABEL = {
  ...EDITORIAL_EVENT_LABEL_LEGACY,
  project_release: "Novo lançamento",
  project_adjust: "Atualização de capítulo/episódio",
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRIES = 1;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30000;
const MAX_RETRIES = 5;
const MAX_TEMPLATE_FIELDS = 25;
const ROLE_ID_PATTERN = /^\d+$/;
const FALLBACK_PROJECT_TYPES = Object.freeze(["Anime", "Manga", "Light Novel"]);
const DEFAULT_IMAGE_PLACEHOLDER_PATH = "/placeholder.svg";
const TEMPLATE_PLACEHOLDER_PATTERN = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;
const PLACEHOLDER_ALIAS_MAP = Object.freeze({
  "event.key": "evento.chave",
  "event.label": "evento.rotulo",
  "event.occurredAt": "evento.ocorridoEm",
  "site.name": "site.nome",
  "site.coverImageUrl": "site.capaUrl",
  "mention.type": "mencao.tipo",
  "mention.category": "mencao.tipo",
  "mention.project": "mencao.projeto",
  "mention.release": "mencao.lancamento",
  "mention.general": "mencao.lancamento",
  "mention.all": "mencao.todos",
  "author.name": "autor.nome",
  "author.avatarUrl": "autor.avatarUrl",
  "post.id": "postagem.id",
  "post.title": "postagem.titulo",
  "post.slug": "postagem.slug",
  "post.url": "postagem.url",
  "post.status": "postagem.status",
  "post.author": "postagem.autor",
  "post.authorAvatarUrl": "postagem.autorAvatarUrl",
  "post.publishedAt": "postagem.publicadoEm",
  "post.updatedAt": "postagem.atualizadoEm",
  "post.excerpt": "postagem.resumo",
  "post.tags": "postagem.tags",
  "post.coverImageUrl": "postagem.capaUrl",
  "post.coverAlt": "postagem.capaAlt",
  "post.imageUrl": "postagem.imagemUrl",
  "post.ogImageUrl": "postagem.ogImagemUrl",
  "project.id": "projeto.id",
  "project.title": "projeto.titulo",
  "project.type": "projeto.tipo",
  "project.category": "projeto.categoria",
  "project.url": "projeto.url",
  "project.cover": "projeto.capaUrl",
  "project.banner": "projeto.bannerUrl",
  "project.heroImageUrl": "projeto.heroImagemUrl",
  "project.imageUrl": "projeto.imagemUrl",
  "project.backdropImageUrl": "projeto.fundoImagemUrl",
  "project.ogImageUrl": "projeto.ogImagemUrl",
  "project.synopsis": "projeto.sinopse",
  "project.status": "projeto.status",
  "project.year": "projeto.ano",
  "project.studio": "projeto.estudio",
  "project.episodes": "projeto.episodios",
  "project.tags": "projeto.tags",
  "project.genres": "projeto.generos",
  "project.season": "projeto.temporada",
  "project.schedule": "projeto.agenda",
  "project.rating": "projeto.classificacao",
  "project.country": "projeto.pais",
  "project.source": "projeto.fonte",
  "project.producers": "projeto.produtores",
  "project.score": "projeto.nota",
  "project.startDate": "projeto.inicioEm",
  "project.endDate": "projeto.fimEm",
  "project.trailerUrl": "projeto.trailerUrl",
  "chapter.number": "conteudo.numero",
  "chapter.volume": "conteudo.volume",
  "chapter.title": "conteudo.titulo",
  "chapter.synopsis": "conteudo.sinopse",
  "chapter.releaseDate": "conteudo.dataLancamento",
  "chapter.updatedAt": "conteudo.atualizadoEm",
  "chapter.coverImageUrl": "conteudo.capaUrl",
  "chapter.imageUrl": "conteudo.imagemUrl",
  "chapter.ogImageUrl": "conteudo.ogImagemUrl",
  "content.type": "conteudo.tipo",
  "content.number": "conteudo.numero",
  "content.volume": "conteudo.volume",
  "content.title": "conteudo.titulo",
  "content.synopsis": "conteudo.sinopse",
  "content.url": "conteudo.url",
  "content.releaseDate": "conteudo.dataLancamento",
  "content.updatedAt": "conteudo.atualizadoEm",
  "content.coverImageUrl": "conteudo.capaUrl",
  "content.imageUrl": "conteudo.imagemUrl",
  "content.ogImageUrl": "conteudo.ogImagemUrl",
  "content.format": "conteudo.formato",
  "content.status": "conteudo.status",
  "content.label": "conteudo.rotulo",
  "update.kind": "atualizacao.tipo",
  "update.reason": "atualizacao.motivo",
  "update.unit": "conteudo.tipo",
  "update.episodeNumber": "conteudo.numero",
  "update.volume": "conteudo.volume",
});

const normalizeLookupKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizeRoleId = (value) => {
  const normalized = String(value || "").trim();
  return ROLE_ID_PATTERN.test(normalized) ? normalized : "";
};

const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const asArray = (value) => (Array.isArray(value) ? value : []);

const clampInt = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
};

const uniqueStrings = (items) => {
  const seen = new Set();
  const next = [];
  asArray(items).forEach((item) => {
    const value = String(item || "").trim();
    if (!value) {
      return;
    }
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    next.push(value);
  });
  return next;
};

const canonicalizeTemplatePlaceholder = (placeholder) =>
  PLACEHOLDER_ALIAS_MAP[String(placeholder || "").trim()] ||
  String(placeholder || "").trim();

const replaceTemplatePlaceholderAliases = (value) => {
  TEMPLATE_PLACEHOLDER_PATTERN.lastIndex = 0;
  return String(value || "").replace(TEMPLATE_PLACEHOLDER_PATTERN, (match, rawPath) => {
    const path = String(rawPath || "").trim();
    if (!path) {
      return match;
    }
    const canonicalPath = canonicalizeTemplatePlaceholder(path);
    if (canonicalPath === path) {
      return match;
    }
    return `{{${canonicalPath}}}`;
  });
};

const migrateTemplatePlaceholderAliasesDeep = (value) => {
  if (typeof value === "string") {
    return replaceTemplatePlaceholderAliases(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => migrateTemplatePlaceholderAliasesDeep(item));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, item]) => {
      acc[key] = migrateTemplatePlaceholderAliasesDeep(item);
      return acc;
    }, {});
  }
  return value;
};

const toMention = (roleId) => {
  const normalized = normalizeRoleId(roleId);
  return normalized ? `<@&${normalized}>` : "";
};

const buildDefaultTemplateLegacy = (eventKey) => {
  if (eventKey === "post_create") {
    return {
      content: "{{mention.all}}",
      embed: {
        title: "{{post.title}}",
        description: "{{post.excerpt}}\n{{post.url}}",
        footerText: "{{site.name}}",
        footerIconUrl: "{{site.logoUrl}}",
        url: "{{post.url}}",
        color: "#3b82f6",
        authorName: "{{author.name}}",
        authorIconUrl: "{{author.avatarUrl}}",
        authorUrl: "{{site.url}}",
        thumbnailUrl: "{{post.imageUrl}}",
        imageUrl: "{{project.backdropImageUrl}}",
        fields: [
          { name: "Status", value: "{{post.status}}", inline: true },
          { name: "Projeto", value: "{{project.title}}", inline: true },
        ],
      },
    };
  }
  if (eventKey === "post_update") {
    return {
      content: "{{mention.all}}",
      embed: {
        title: "{{post.title}}",
        description: "{{post.excerpt}}\n{{post.url}}",
        footerText: "{{site.name}}",
        footerIconUrl: "{{site.logoUrl}}",
        url: "{{post.url}}",
        color: "#f59e0b",
        authorName: "{{author.name}}",
        authorIconUrl: "{{author.avatarUrl}}",
        authorUrl: "{{site.url}}",
        thumbnailUrl: "{{post.imageUrl}}",
        imageUrl: "{{project.backdropImageUrl}}",
        fields: [
          { name: "Status", value: "{{post.status}}", inline: true },
          { name: "Projeto", value: "{{project.title}}", inline: true },
        ],
      },
    };
  }
  if (eventKey === "project_release") {
    return {
      content: "{{mention.all}}",
      embed: {
        title: "{{project.title}}",
        description: "{{update.reason}}\n{{project.url}}",
        footerText: "{{site.name}}",
        footerIconUrl: "{{site.logoUrl}}",
        url: "{{project.url}}",
        color: "#10b981",
        authorName: "{{event.label}}",
        authorIconUrl: "{{site.logoUrl}}",
        authorUrl: "{{site.url}}",
        thumbnailUrl: "{{project.imageUrl}}",
        imageUrl: "{{chapter.imageUrl}}",
        fields: [
          { name: "{{update.unit}}", value: "{{chapter.number}}", inline: true },
          { name: "Título", value: "{{chapter.title}}", inline: true },
        ],
      },
    };
  }
  return {
    content: "{{mention.all}}",
    embed: {
      title: "{{project.title}}",
      description: "{{update.reason}}\n{{project.url}}",
      footerText: "{{site.name}}",
      footerIconUrl: "{{site.logoUrl}}",
      url: "{{project.url}}",
      color: "#f59e0b",
      authorName: "{{event.label}}",
      authorIconUrl: "{{site.logoUrl}}",
      authorUrl: "{{site.url}}",
      thumbnailUrl: "{{project.imageUrl}}",
      imageUrl: "{{chapter.imageUrl}}",
      fields: [
        { name: "{{update.unit}}", value: "{{chapter.number}}", inline: true },
        { name: "Título", value: "{{chapter.title}}", inline: true },
      ],
    },
  };
};

const buildDefaultTemplate = (eventKey) => {
  const template = buildDefaultTemplateLegacy(eventKey);
  if (eventKey === "project_release" || eventKey === "project_adjust") {
    const fields = Array.isArray(template?.embed?.fields) ? [...template.embed.fields] : [];
    if (fields[1]) {
      fields[1] = {
        ...fields[1],
        name: "Título",
      };
    }
    return migrateTemplatePlaceholderAliasesDeep({
      ...template,
      embed: {
        ...template.embed,
        fields,
      },
    });
  }
  return migrateTemplatePlaceholderAliasesDeep(template);
};

const normalizeTemplateField = (value) => {
  const item = asObject(value);
  return {
    name: replaceTemplatePlaceholderAliases(String(item.name || "").trim()),
    value: replaceTemplatePlaceholderAliases(String(item.value || "").trim()),
    inline: item.inline === true,
  };
};

const normalizeTemplate = (value, fallback) => {
  const input = asObject(value);
  const base = asObject(fallback);
  const baseEmbed = asObject(base.embed);
  const inputEmbed = asObject(input.embed);
  const fieldsInput =
    asArray(inputEmbed.fields).length > 0 ? asArray(inputEmbed.fields) : asArray(baseEmbed.fields);

  const footerSource =
    inputEmbed.footerText ?? inputEmbed.footer ?? baseEmbed.footerText ?? baseEmbed.footer;
  const footerIconSource = inputEmbed.footerIconUrl ?? baseEmbed.footerIconUrl;

  return {
    content: replaceTemplatePlaceholderAliases(String(input.content ?? base.content ?? "").trim()),
    embed: {
      title: replaceTemplatePlaceholderAliases(
        String(inputEmbed.title ?? baseEmbed.title ?? "").trim(),
      ),
      description: replaceTemplatePlaceholderAliases(
        String(inputEmbed.description ?? baseEmbed.description ?? "").trim(),
      ),
      footerText: replaceTemplatePlaceholderAliases(String(footerSource ?? "").trim()),
      footerIconUrl: replaceTemplatePlaceholderAliases(String(footerIconSource ?? "").trim()),
      url: replaceTemplatePlaceholderAliases(String(inputEmbed.url ?? baseEmbed.url ?? "").trim()),
      color: String(inputEmbed.color ?? baseEmbed.color ?? "#3b82f6").trim() || "#3b82f6",
      authorName: replaceTemplatePlaceholderAliases(
        String(inputEmbed.authorName ?? baseEmbed.authorName ?? "").trim(),
      ),
      authorIconUrl: replaceTemplatePlaceholderAliases(
        String(inputEmbed.authorIconUrl ?? baseEmbed.authorIconUrl ?? "").trim(),
      ),
      authorUrl: replaceTemplatePlaceholderAliases(
        String(inputEmbed.authorUrl ?? baseEmbed.authorUrl ?? "").trim(),
      ),
      thumbnailUrl: replaceTemplatePlaceholderAliases(
        String(inputEmbed.thumbnailUrl ?? baseEmbed.thumbnailUrl ?? "").trim(),
      ),
      imageUrl: replaceTemplatePlaceholderAliases(
        String(inputEmbed.imageUrl ?? baseEmbed.imageUrl ?? "").trim(),
      ),
      fields: fieldsInput
        .map((field) => normalizeTemplateField(field))
        .slice(0, MAX_TEMPLATE_FIELDS),
    },
  };
};

const normalizeLegacyCategories = (value) => {
  const source = asArray(value);
  const map = new Map();
  source.forEach((raw) => {
    const item = asObject(raw);
    const id = String(item.id || "").trim();
    if (!id) {
      return;
    }
    map.set(id, {
      id,
      roleId: normalizeRoleId(item.roleId),
      enabled: item.enabled !== false,
    });
  });
  return map;
};

const buildLegacyTypeRoleIndex = ({ categories, typeMappings }) => {
  const categoryMap = normalizeLegacyCategories(categories);
  const map = new Map();
  asArray(typeMappings).forEach((raw) => {
    const item = asObject(raw);
    const type = String(item.type || "").trim();
    const categoryId = String(item.categoryId || "").trim();
    if (!type || !categoryId) {
      return;
    }
    const category = categoryMap.get(categoryId);
    const key = normalizeLookupKey(type);
    if (!key || !category || map.has(key)) {
      return;
    }
    map.set(key, {
      type,
      roleId: normalizeRoleId(category.roleId),
      enabled: category.enabled !== false,
    });
  });
  return map;
};

const normalizeExplicitTypeRoles = (value) => {
  const map = new Map();
  asArray(value).forEach((raw, index) => {
    const item = asObject(raw);
    const type = String(item.type || "").trim();
    const key = normalizeLookupKey(type);
    if (!type || !key || map.has(key)) {
      return;
    }
    map.set(key, {
      type,
      roleId: normalizeRoleId(item.roleId),
      enabled: item.enabled !== false,
      order: clampInt(item.order, 0, 10000, index),
    });
  });
  return map;
};

const normalizeTypeRoles = ({ value, categories, typeMappings, projectTypes }) => {
  const explicit = normalizeExplicitTypeRoles(value);
  const legacy = buildLegacyTypeRoleIndex({ categories, typeMappings });

  const catalog = uniqueStrings(
    asArray(projectTypes).length > 0
      ? projectTypes
      : [
          ...Array.from(explicit.values()).map((item) => item.type),
          ...Array.from(legacy.values()).map((item) => item.type),
          ...FALLBACK_PROJECT_TYPES,
        ],
  );

  return catalog.map((type, index) => {
    const key = normalizeLookupKey(type);
    const source = explicit.get(key) || legacy.get(key) || {};
    return {
      type,
      roleId: normalizeRoleId(source.roleId),
      enabled: source.enabled !== false,
      order: index,
    };
  });
};

const normalizeChannelSettings = ({
  value,
  eventKeys,
  fallbackTemplates,
  fallbackEnabled = false,
}) => {
  const input = asObject(value);
  const inputEvents = asObject(input.events);
  const inputTemplates = asObject(input.templates);

  const events = {};
  const templates = {};

  eventKeys.forEach((eventKey) => {
    events[eventKey] = inputEvents[eventKey] === true;
    templates[eventKey] = normalizeTemplate(inputTemplates[eventKey], fallbackTemplates[eventKey]);
  });

  return {
    enabled: input.enabled === true || (input.enabled !== false && fallbackEnabled),
    webhookUrl: String(input.webhookUrl || "").trim(),
    timeoutMs: clampInt(input.timeoutMs, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    retries: clampInt(input.retries, 0, MAX_RETRIES, DEFAULT_RETRIES),
    events,
    templates,
  };
};

const migrateTemplateCollectionMentionAliases = (templatesInput, eventKeys) => {
  const templates = asObject(templatesInput);
  const nextTemplates = { ...templates };
  eventKeys.forEach((eventKey) => {
    if (!(eventKey in templates)) {
      return;
    }
    const source = asObject(templates[eventKey]);
    nextTemplates[eventKey] = normalizeTemplate(source, source);
  });
  return nextTemplates;
};

export const migrateEditorialMentionPlaceholdersInSettings = (settingsInput = {}) => {
  const settings = asObject(settingsInput);
  const channels = asObject(settings.channels);
  const posts = asObject(channels.posts);
  const projects = asObject(channels.projects);
  return {
    ...settings,
    channels: {
      ...channels,
      posts: {
        ...posts,
        templates: migrateTemplateCollectionMentionAliases(posts.templates, [
          "post_create",
          "post_update",
        ]),
      },
      projects: {
        ...projects,
        templates: migrateTemplateCollectionMentionAliases(projects.templates, [
          "project_release",
          "project_adjust",
        ]),
      },
    },
  };
};

const buildDefaultTypeRoles = (projectTypes = []) => {
  const catalog = uniqueStrings(projectTypes.length > 0 ? projectTypes : FALLBACK_PROJECT_TYPES);
  return catalog.map((type, order) => ({
    type,
    roleId: "",
    enabled: true,
    order,
  }));
};

export const defaultEditorialWebhookSettings = (projectTypes = []) => ({
  version: 1,
  mentionMode: "role_id",
  mentionFallback: "skip",
  generalReleaseRoleId: "",
  typeRoles: buildDefaultTypeRoles(projectTypes),
  channels: {
    posts: {
      enabled: false,
      webhookUrl: "",
      timeoutMs: DEFAULT_TIMEOUT_MS,
      retries: DEFAULT_RETRIES,
      events: {
        post_create: true,
        post_update: true,
      },
      templates: {
        post_create: buildDefaultTemplate("post_create"),
        post_update: buildDefaultTemplate("post_update"),
      },
    },
    projects: {
      enabled: false,
      webhookUrl: "",
      timeoutMs: DEFAULT_TIMEOUT_MS,
      retries: DEFAULT_RETRIES,
      events: {
        project_release: true,
        project_adjust: true,
      },
      templates: {
        project_release: buildDefaultTemplate("project_release"),
        project_adjust: buildDefaultTemplate("project_adjust"),
      },
    },
  },
});

export const normalizeEditorialWebhookSettings = (
  payload,
  { projectTypes = [], defaultProjectTypes = [] } = {},
) => {
  const input = asObject(payload);
  const fallbackCatalog = extractProjectTypeCatalog({
    settings: input,
    defaultTypes:
      uniqueStrings(projectTypes).length > 0
        ? uniqueStrings(projectTypes)
        : uniqueStrings(defaultProjectTypes).length > 0
          ? uniqueStrings(defaultProjectTypes)
          : FALLBACK_PROJECT_TYPES,
  });
  const catalog =
    uniqueStrings(projectTypes).length > 0 ? uniqueStrings(projectTypes) : fallbackCatalog;

  const defaults = defaultEditorialWebhookSettings(catalog);
  const typeRoles = normalizeTypeRoles({
    value: input.typeRoles,
    categories: input.categories,
    typeMappings: input.typeMappings,
    projectTypes: catalog,
  });

  const normalized = {
    version: 1,
    mentionMode: "role_id",
    mentionFallback: "skip",
    generalReleaseRoleId: normalizeRoleId(input.generalReleaseRoleId),
    typeRoles,
    channels: {
      posts: normalizeChannelSettings({
        value: asObject(input.channels).posts,
        eventKeys: ["post_create", "post_update"],
        fallbackTemplates: defaults.channels.posts.templates,
      }),
      projects: normalizeChannelSettings({
        value: asObject(input.channels).projects,
        eventKeys: ["project_release", "project_adjust"],
        fallbackTemplates: defaults.channels.projects.templates,
      }),
    },
  };
  return migrateEditorialMentionPlaceholdersInSettings(normalized);
};

export const extractTemplatePlaceholders = (value) => {
  const source = String(value || "");
  const placeholders = new Set();
  let match;
  TEMPLATE_PLACEHOLDER_PATTERN.lastIndex = 0;
  while ((match = TEMPLATE_PLACEHOLDER_PATTERN.exec(source))) {
    const placeholder = String(match[1] || "").trim();
    if (!placeholder) {
      continue;
    }
    placeholders.add(placeholder);
  }
  return Array.from(placeholders);
};

const COMMON_PLACEHOLDERS_CANONICAL = [
  "evento.chave",
  "evento.rotulo",
  "evento.ocorridoEm",
  "site.nome",
  "site.url",
  "site.logoUrl",
  "site.capaUrl",
  "site.faviconUrl",
  "mencao.tipo",
  "mencao.projeto",
  "mencao.lancamento",
  "mencao.todos",
  "autor.nome",
  "autor.avatarUrl",
];

const PROJECT_PLACEHOLDERS = [
  "projeto.id",
  "projeto.titulo",
  "projeto.tipo",
  "projeto.categoria",
  "projeto.url",
  "projeto.capaUrl",
  "projeto.bannerUrl",
  "projeto.heroImagemUrl",
  "projeto.imagemUrl",
  "projeto.fundoImagemUrl",
  "projeto.ogImagemUrl",
  "projeto.sinopse",
  "projeto.status",
  "projeto.ano",
  "projeto.estudio",
  "projeto.episodios",
  "projeto.tags",
  "projeto.generos",
  "projeto.temporada",
  "projeto.agenda",
  "projeto.classificacao",
  "projeto.pais",
  "projeto.fonte",
  "projeto.produtores",
  "projeto.nota",
  "projeto.inicioEm",
  "projeto.fimEm",
  "projeto.trailerUrl",
];

const POST_PLACEHOLDERS = [
  "postagem.id",
  "postagem.titulo",
  "postagem.slug",
  "postagem.url",
  "postagem.status",
  "postagem.autor",
  "postagem.autorAvatarUrl",
  "postagem.publicadoEm",
  "postagem.atualizadoEm",
  "postagem.resumo",
  "postagem.tags",
  "postagem.capaUrl",
  "postagem.capaAlt",
  "postagem.imagemUrl",
  "postagem.ogImagemUrl",
];

const CONTENT_PLACEHOLDERS = [
  "conteudo.tipo",
  "conteudo.numero",
  "conteudo.volume",
  "conteudo.titulo",
  "conteudo.sinopse",
  "conteudo.url",
  "conteudo.dataLancamento",
  "conteudo.atualizadoEm",
  "conteudo.capaUrl",
  "conteudo.imagemUrl",
  "conteudo.ogImagemUrl",
  "conteudo.formato",
  "conteudo.status",
  "conteudo.rotulo",
];

const UPDATE_PLACEHOLDERS = [
  "atualizacao.tipo",
  "atualizacao.motivo",
];

const PLACEHOLDER_ALLOWLIST = {
  post_create: new Set([
    ...COMMON_PLACEHOLDERS_CANONICAL,
    ...POST_PLACEHOLDERS,
    ...PROJECT_PLACEHOLDERS,
  ]),
  post_update: new Set([
    ...COMMON_PLACEHOLDERS_CANONICAL,
    ...POST_PLACEHOLDERS,
    ...PROJECT_PLACEHOLDERS,
  ]),
  project_release: new Set([
    ...COMMON_PLACEHOLDERS_CANONICAL,
    ...PROJECT_PLACEHOLDERS,
    ...CONTENT_PLACEHOLDERS,
    ...UPDATE_PLACEHOLDERS,
  ]),
  project_adjust: new Set([
    ...COMMON_PLACEHOLDERS_CANONICAL,
    ...PROJECT_PLACEHOLDERS,
    ...CONTENT_PLACEHOLDERS,
    ...UPDATE_PLACEHOLDERS,
  ]),
};

export const getEditorialPlaceholderAllowlist = (eventKey) =>
  new Set(PLACEHOLDER_ALLOWLIST[eventKey] || []);

const collectTemplateEntries = (template, eventKey) => {
  const source = asObject(template);
  const embed = asObject(source.embed);
  const fields = asArray(embed.fields);
  const entries = [
    { eventKey, templatePath: "content", value: source.content },
    { eventKey, templatePath: "embed.title", value: embed.title },
    { eventKey, templatePath: "embed.description", value: embed.description },
    { eventKey, templatePath: "embed.footerText", value: embed.footerText || embed.footer },
    { eventKey, templatePath: "embed.footerIconUrl", value: embed.footerIconUrl },
    { eventKey, templatePath: "embed.url", value: embed.url },
    { eventKey, templatePath: "embed.authorName", value: embed.authorName },
    { eventKey, templatePath: "embed.authorIconUrl", value: embed.authorIconUrl },
    { eventKey, templatePath: "embed.authorUrl", value: embed.authorUrl },
    { eventKey, templatePath: "embed.thumbnailUrl", value: embed.thumbnailUrl },
    { eventKey, templatePath: "embed.imageUrl", value: embed.imageUrl },
  ];
  fields.forEach((field, index) => {
    const fieldValue = asObject(field);
    entries.push({
      eventKey,
      templatePath: `embed.fields[${index}].name`,
      value: fieldValue.name,
    });
    entries.push({
      eventKey,
      templatePath: `embed.fields[${index}].value`,
      value: fieldValue.value,
    });
  });
  return entries;
};

export const validateEditorialWebhookSettingsPlaceholders = (settings) => {
  const normalized = normalizeEditorialWebhookSettings(settings);
  const errors = [];
  const channels = asObject(normalized.channels);
  Object.entries(channels).forEach(([channelKey, channelValue]) => {
    const channel = asObject(channelValue);
    const templates = asObject(channel.templates);
    Object.entries(templates).forEach(([eventKey, template]) => {
      const allowlist = getEditorialPlaceholderAllowlist(eventKey);
      collectTemplateEntries(template, eventKey).forEach((entry) => {
        extractTemplatePlaceholders(entry.value).forEach((placeholder) => {
          const canonicalPlaceholder = canonicalizeTemplatePlaceholder(placeholder);
          if (allowlist.has(canonicalPlaceholder)) {
            return;
          }
          errors.push({
            channel: channelKey,
            eventKey,
            templatePath: entry.templatePath,
            placeholder,
            canonicalPlaceholder,
          });
        });
      });
    });
  });
  return {
    ok: errors.length === 0,
    errors,
  };
};

const resolvePathValue = (source, path) => {
  const keys = String(path || "")
    .split(".")
    .map((item) => item.trim())
    .filter(Boolean);
  let current = source;
  for (const key of keys) {
    if (!current || typeof current !== "object") {
      return "";
    }
    current = current[key];
  }
  if (current === null || typeof current === "undefined") {
    return "";
  }
  if (Array.isArray(current)) {
    return current
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }
  if (typeof current === "object") {
    return "";
  }
  return String(current);
};

export const renderTemplateString = (template, context) =>
  (() => {
    TEMPLATE_PLACEHOLDER_PATTERN.lastIndex = 0;
    return String(template || "").replace(TEMPLATE_PLACEHOLDER_PATTERN, (_match, rawPath) =>
      resolvePathValue(context, canonicalizeTemplatePlaceholder(String(rawPath || "").trim())),
    );
  })();

export const renderWebhookTemplate = (template, context) => {
  const source = asObject(template);
  const embed = asObject(source.embed);
  const footerText = renderTemplateString(embed.footerText || embed.footer, context);
  return {
    content: renderTemplateString(source.content, context),
    embed: {
      title: renderTemplateString(embed.title, context),
      description: renderTemplateString(embed.description, context),
      footerText,
      footer: footerText,
      footerIconUrl: renderTemplateString(embed.footerIconUrl, context),
      url: renderTemplateString(embed.url, context),
      color: String(embed.color || "#3b82f6").trim() || "#3b82f6",
      authorName: renderTemplateString(embed.authorName, context),
      authorIconUrl: renderTemplateString(embed.authorIconUrl, context),
      authorUrl: renderTemplateString(embed.authorUrl, context),
      thumbnailUrl: renderTemplateString(embed.thumbnailUrl, context),
      imageUrl: renderTemplateString(embed.imageUrl, context),
      fields: asArray(embed.fields)
        .slice(0, MAX_TEMPLATE_FIELDS)
        .map((field) => ({
          name: renderTemplateString(asObject(field).name, context),
          value: renderTemplateString(asObject(field).value, context),
          inline: asObject(field).inline === true,
        })),
    },
  };
};

export const resolveEditorialEventChannel = (eventKey) =>
  EDITORIAL_EVENT_TO_CHANNEL[eventKey] || "";

export const resolveEditorialEventLabel = (eventKey) => EDITORIAL_EVENT_LABEL[eventKey] || "Evento";

const buildTypeRoleIndex = (settings) => {
  const map = new Map();
  asArray(settings?.typeRoles).forEach((item) => {
    const type = String(item?.type || "").trim();
    const key = normalizeLookupKey(type);
    if (!type || !key) {
      return;
    }
    if (map.has(key)) {
      return;
    }
    map.set(key, {
      type,
      roleId: normalizeRoleId(item?.roleId),
      enabled: item?.enabled !== false,
      order: clampInt(item?.order, 0, 10000, 0),
    });
  });
  return map;
};

export const resolveEditorialCategoryForType = (settings, projectType) => {
  const rolesByType = buildTypeRoleIndex(settings);
  return rolesByType.get(normalizeLookupKey(projectType)) || null;
};

export const buildEditorialMentions = ({
  settings,
  eventKey,
  projectType,
  projectDiscordRoleId,
  includeProjectRole = false,
} = {}) => {
  const typeRole = resolveEditorialCategoryForType(settings, projectType);
  const typeRoleId = normalizeRoleId(typeRole?.roleId);
  const typeMention = toMention(typeRoleId);
  const projectRoleId = includeProjectRole ? normalizeRoleId(projectDiscordRoleId) : "";
  const projectMention = toMention(projectRoleId);
  const releaseRoleId =
    String(eventKey || "") === "project_release"
      ? normalizeRoleId(settings?.generalReleaseRoleId)
      : "";
  const releaseMention = toMention(releaseRoleId);
  const roleIds = uniqueStrings([typeRoleId, projectRoleId, releaseRoleId]);
  const allMention = uniqueStrings([typeMention, projectMention, releaseMention]).join(" ").trim();

  return {
    type: typeRole?.type || "",
    categoryId: typeRole?.type || "",
    categoryLabel: typeRole?.type || "",
    typeMention,
    categoryMention: typeMention,
    projectMention,
    releaseMention,
    generalMention: releaseMention,
    allMention,
    roleIds,
  };
};

const pickFirstText = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

const normalizeContentKind = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const resolveContentTypeLabel = ({ update, project, chapter } = {}) => {
  const explicit = pickFirstText(update?.unit, update?.contentType, chapter?.type);
  const normalized = normalizeContentKind(explicit);
  if (normalized.startsWith("cap")) {
    return "Capitulo";
  }
  if (normalized.startsWith("epi")) {
    return "Episodio";
  }
  if (normalized.includes("extra")) {
    return "Extra";
  }
  if (normalized.includes("especial")) {
    return "Especial";
  }

  const projectType = normalizeContentKind(project?.type);
  if (projectType.includes("manga") || projectType.includes("novel")) {
    return "Capitulo";
  }
  return "Episodio";
};

const resolveContentFormatLabel = (value) => {
  const normalized = normalizeContentKind(value);
  if (normalized === "images") {
    return "Imagem";
  }
  if (normalized === "lexical") {
    return "Texto";
  }
  return String(value || "").trim();
};

const resolvePublicationStatusLabel = (value) => {
  const normalized = normalizeContentKind(value);
  if (normalized === "published" || normalized === "publicado") {
    return "Publicado";
  }
  if (normalized === "draft" || normalized === "rascunho") {
    return "Rascunho";
  }
  return String(value || "").trim();
};

const buildContentLabel = ({ contentType, number, title, chapter } = {}) => {
  const explicit = pickFirstText(chapter?.displayLabel, chapter?.label);
  if (explicit) {
    return explicit;
  }
  const numeric = Number.isFinite(Number(number)) ? String(Number(number)) : "";
  return [contentType, numeric].filter(Boolean).join(" ").trim();
};

export const buildEditorialEventContext = ({
  eventKey,
  occurredAt,
  siteName,
  siteUrl,
  siteLogoUrl,
  siteCoverImageUrl,
  siteFaviconUrl,
  origin,
  mentions,
  author,
  post,
  project,
  chapter,
  update,
  postImageUrl,
  postOgImageUrl,
  projectImageUrl,
  projectBackdropImageUrl,
  projectOgImageUrl,
  chapterImageUrl,
  chapterOgImageUrl,
} = {}) => {
  const safePost = asObject(post);
  const safeProject = asObject(project);
  const safeChapter = asObject(chapter);
  const safeUpdate = asObject(update);
  const safeMentions = asObject(mentions);
  const safeAuthor = asObject(author);
  const projectId = String(safeProject.id || "").trim();
  const postSlug = String(safePost.slug || "").trim();
  const normalizedOrigin = String(origin || "").replace(/\/+$/, "");
  const resolvedAuthorName = String(safeAuthor.name || safePost.author || "").trim();
  const resolvedAuthorAvatarUrl = String(
    safeAuthor.avatarUrl || safePost.authorAvatarUrl || "",
  ).trim();
  const fallbackSiteImageUrl = pickFirstText(siteCoverImageUrl, DEFAULT_IMAGE_PLACEHOLDER_PATH);
  const chapterCoverImageUrl = pickFirstText(safeChapter.coverImageUrl, safeProject.heroImageUrl);
  const resolvedProjectOgImageUrl = pickFirstText(projectOgImageUrl);
  const resolvedPostOgImageUrl = pickFirstText(postOgImageUrl);
  const resolvedChapterOgImageUrl = pickFirstText(chapterOgImageUrl, resolvedProjectOgImageUrl);
  const resolvedPostImageUrl = pickFirstText(
    postImageUrl,
    safePost.coverImageUrl,
    resolvedPostOgImageUrl,
    fallbackSiteImageUrl,
    DEFAULT_IMAGE_PLACEHOLDER_PATH,
  );
  const resolvedProjectImageUrl = pickFirstText(
    projectImageUrl,
    safeProject.cover,
    safeProject.heroImageUrl,
    safeProject.banner,
    resolvedProjectOgImageUrl,
    fallbackSiteImageUrl,
    DEFAULT_IMAGE_PLACEHOLDER_PATH,
  );
  const resolvedProjectBackdropImageUrl = pickFirstText(
    projectBackdropImageUrl,
    safeProject.banner,
    safeProject.heroImageUrl,
    safeProject.cover,
    resolvedProjectOgImageUrl,
    fallbackSiteImageUrl,
    DEFAULT_IMAGE_PLACEHOLDER_PATH,
  );
  const resolvedChapterImageUrl = pickFirstText(
    chapterImageUrl,
    chapterCoverImageUrl,
    safeProject.banner,
    safeProject.cover,
    resolvedChapterOgImageUrl,
    resolvedProjectOgImageUrl,
    fallbackSiteImageUrl,
    DEFAULT_IMAGE_PLACEHOLDER_PATH,
  );
  const contentNumber = Number.isFinite(Number(safeUpdate.episodeNumber))
    ? Number(safeUpdate.episodeNumber)
    : Number.isFinite(Number(safeChapter.number))
      ? Number(safeChapter.number)
      : "";
  const contentVolume = Number.isFinite(Number(safeUpdate.volume))
    ? Number(safeUpdate.volume)
    : Number.isFinite(Number(safeChapter.volume))
      ? Number(safeChapter.volume)
      : "";
  const contentType = resolveContentTypeLabel({
    update: safeUpdate,
    project: safeProject,
    chapter: safeChapter,
  });
  const contentLabel = buildContentLabel({
    contentType,
    number: contentNumber,
    chapter: safeChapter,
  });
  const contentTitle = pickFirstText(
    safeChapter.title,
    contentLabel,
    normalizeContentKind(contentType) === "extra" ? "Extra" : "",
  );
  const contentPathNumber = contentNumber ? String(contentNumber) : "";
  const contentUrl =
    projectId && contentPathNumber
      ? `${normalizedOrigin}/projeto/${projectId}/leitura/${contentPathNumber}`
      : projectId
        ? `${normalizedOrigin}/projeto/${projectId}`
        : "";
  const site = {
    name: String(siteName || ""),
    nome: String(siteName || ""),
    url: String(siteUrl || normalizedOrigin),
    logoUrl: String(siteLogoUrl || ""),
    coverImageUrl: String(siteCoverImageUrl || ""),
    capaUrl: String(siteCoverImageUrl || ""),
    faviconUrl: String(siteFaviconUrl || ""),
  };
  const event = {
    key: String(eventKey || ""),
    chave: String(eventKey || ""),
    label: resolveEditorialEventLabel(eventKey),
    rotulo: resolveEditorialEventLabel(eventKey),
    occurredAt: String(occurredAt || new Date().toISOString()),
    ocorridoEm: String(occurredAt || new Date().toISOString()),
  };
  const mention = {
    type: String(safeMentions.typeMention || safeMentions.categoryMention || ""),
    tipo: String(safeMentions.typeMention || safeMentions.categoryMention || ""),
    category: String(safeMentions.categoryMention || safeMentions.typeMention || ""),
    project: String(safeMentions.projectMention || ""),
    projeto: String(safeMentions.projectMention || ""),
    release: String(safeMentions.releaseMention || safeMentions.generalMention || ""),
    lancamento: String(safeMentions.releaseMention || safeMentions.generalMention || ""),
    general: String(safeMentions.generalMention || safeMentions.releaseMention || ""),
    all: String(safeMentions.allMention || ""),
    todos: String(safeMentions.allMention || ""),
  };
  const authorContext = {
    name: resolvedAuthorName,
    nome: resolvedAuthorName,
    avatarUrl: resolvedAuthorAvatarUrl,
  };
  const postContext = {
    id: String(safePost.id || ""),
    title: String(safePost.title || ""),
    titulo: String(safePost.title || ""),
    slug: postSlug,
    url: postSlug ? `${normalizedOrigin}/postagem/${postSlug}` : "",
    status: String(safePost.status || ""),
    author: String(safePost.author || ""),
    autor: String(safePost.author || ""),
    authorAvatarUrl: resolvedAuthorAvatarUrl,
    autorAvatarUrl: resolvedAuthorAvatarUrl,
    publishedAt: String(safePost.publishedAt || ""),
    publicadoEm: String(safePost.publishedAt || ""),
    updatedAt: String(safePost.updatedAt || ""),
    atualizadoEm: String(safePost.updatedAt || ""),
    excerpt: String(safePost.excerpt || ""),
    resumo: String(safePost.excerpt || ""),
    tags: asArray(safePost.tags)
      .map((item) => String(item || ""))
      .filter(Boolean),
    coverImageUrl: String(safePost.coverImageUrl || ""),
    capaUrl: String(safePost.coverImageUrl || ""),
    coverAlt: String(safePost.coverAlt || ""),
    capaAlt: String(safePost.coverAlt || ""),
    imageUrl: resolvedPostImageUrl,
    imagemUrl: resolvedPostImageUrl,
    ogImageUrl: resolvedPostOgImageUrl,
    ogImagemUrl: resolvedPostOgImageUrl,
  };
  const projectContext = {
    id: projectId,
    title: String(safeProject.title || ""),
    titulo: String(safeProject.title || ""),
    type: String(safeProject.type || ""),
    tipo: String(safeProject.type || ""),
    category: String(safeMentions.type || safeMentions.categoryLabel || ""),
    categoria: String(safeMentions.type || safeMentions.categoryLabel || ""),
    url: projectId ? `${normalizedOrigin}/projeto/${projectId}` : "",
    cover: String(safeProject.cover || ""),
    capaUrl: String(safeProject.cover || ""),
    banner: String(safeProject.banner || ""),
    bannerUrl: String(safeProject.banner || ""),
    heroImageUrl: String(safeProject.heroImageUrl || ""),
    heroImagemUrl: String(safeProject.heroImageUrl || ""),
    synopsis: String(safeProject.synopsis || ""),
    sinopse: String(safeProject.synopsis || ""),
    status: String(safeProject.status || ""),
    year: String(safeProject.year || ""),
    ano: String(safeProject.year || ""),
    studio: String(safeProject.studio || ""),
    estudio: String(safeProject.studio || ""),
    episodes: String(safeProject.episodes || ""),
    episodios: String(safeProject.episodes || ""),
    tags: asArray(safeProject.tags)
      .map((item) => String(item || ""))
      .filter(Boolean),
    genres: asArray(safeProject.genres)
      .map((item) => String(item || ""))
      .filter(Boolean),
    generos: asArray(safeProject.genres)
      .map((item) => String(item || ""))
      .filter(Boolean),
    season: String(safeProject.season || ""),
    temporada: String(safeProject.season || ""),
    schedule: String(safeProject.schedule || ""),
    agenda: String(safeProject.schedule || ""),
    rating: String(safeProject.rating || ""),
    classificacao: String(safeProject.rating || ""),
    country: String(safeProject.country || ""),
    pais: String(safeProject.country || ""),
    source: String(safeProject.source || ""),
    fonte: String(safeProject.source || ""),
    producers: asArray(safeProject.producers)
      .map((item) => String(item || ""))
      .filter(Boolean),
    produtores: asArray(safeProject.producers)
      .map((item) => String(item || ""))
      .filter(Boolean),
    score: Number.isFinite(Number(safeProject.score)) ? Number(safeProject.score) : "",
    nota: Number.isFinite(Number(safeProject.score)) ? Number(safeProject.score) : "",
    startDate: String(safeProject.startDate || ""),
    inicioEm: String(safeProject.startDate || ""),
    endDate: String(safeProject.endDate || ""),
    fimEm: String(safeProject.endDate || ""),
    trailerUrl: String(safeProject.trailerUrl || ""),
    imageUrl: resolvedProjectImageUrl,
    imagemUrl: resolvedProjectImageUrl,
    backdropImageUrl: resolvedProjectBackdropImageUrl,
    fundoImagemUrl: resolvedProjectBackdropImageUrl,
    ogImageUrl: resolvedProjectOgImageUrl,
    ogImagemUrl: resolvedProjectOgImageUrl,
  };
  const contentContext = {
    type: contentType,
    tipo: contentType,
    number: contentNumber,
    numero: contentNumber,
    volume: contentVolume,
    title: contentTitle,
    titulo: contentTitle,
    synopsis: String(safeChapter.synopsis || ""),
    sinopse: String(safeChapter.synopsis || ""),
    url: contentUrl,
    releaseDate: String(safeChapter.releaseDate || ""),
    dataLancamento: String(safeChapter.releaseDate || ""),
    updatedAt: String(safeChapter.updatedAt || ""),
    atualizadoEm: String(safeChapter.updatedAt || ""),
    coverImageUrl: chapterCoverImageUrl,
    capaUrl: chapterCoverImageUrl,
    imageUrl: resolvedChapterImageUrl,
    imagemUrl: resolvedChapterImageUrl,
    ogImageUrl: resolvedChapterOgImageUrl,
    ogImagemUrl: resolvedChapterOgImageUrl,
    format: resolveContentFormatLabel(safeChapter.contentFormat),
    formato: resolveContentFormatLabel(safeChapter.contentFormat),
    status: resolvePublicationStatusLabel(safeChapter.status),
    label: contentLabel,
    rotulo: contentLabel,
  };
  const updateContext = {
    kind: String(safeUpdate.kind || ""),
    tipo: String(safeUpdate.kind || ""),
    reason: String(safeUpdate.reason || ""),
    motivo: String(safeUpdate.reason || ""),
    unit: contentType,
    episodeNumber: contentNumber,
    volume: contentVolume,
  };

  return {
    event,
    evento: event,
    site,
    mention,
    mencao: mention,
    author: authorContext,
    autor: authorContext,
    post: postContext,
    postagem: postContext,
    project: projectContext,
    projeto: projectContext,
    chapter: contentContext,
    content: contentContext,
    conteudo: contentContext,
    update: updateContext,
    atualizacao: updateContext,
  };
};

export const extractProjectTypeCatalog = ({
  settings,
  existingTypes = [],
  defaultTypes = [],
} = {}) => {
  const typeRoles = asArray(settings?.typeRoles).map((item) => String(item?.type || "").trim());
  const legacyMappedTypes = asArray(settings?.typeMappings).map((item) =>
    String(item?.type || "").trim(),
  );
  return uniqueStrings([
    ...typeRoles,
    ...legacyMappedTypes,
    ...asArray(existingTypes),
    ...asArray(defaultTypes),
  ]);
};
