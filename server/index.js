import "dotenv/config";
import crypto from "crypto";
import express from "express";
import session from "express-session";
import fileStoreFactory from "session-file-store";
import cookieParser from "cookie-parser";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const FileStore = fileStoreFactory(session);

const DISCORD_API = "https://discord.com/api/v10";
const ANILIST_API = "https://graphql.anilist.co";
const SCOPES = ["identify", "email"];
const OWNER_IDS = (process.env.OWNER_IDS || "380305493391966208")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const isOwner = (id) => OWNER_IDS.includes(String(id));

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI = "http://127.0.0.1:8080/login",
  APP_ORIGIN = "http://127.0.0.1:5173",
  SESSION_SECRET,
  PORT = 8080,
} = process.env;

const APP_ORIGINS = APP_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const PRIMARY_APP_ORIGIN = APP_ORIGINS[0] || "http://127.0.0.1:5173";
const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }
  if (APP_ORIGINS.includes(origin)) {
    return true;
  }
  try {
    const { hostname } = new URL(origin);
    if (!hostname) {
      return false;
    }
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }
    if (
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname)
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
};

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !SESSION_SECRET) {
  console.warn("Missing DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, or SESSION_SECRET in env.");
}

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.set("trust proxy", 1);
const sessionPath = path.join(__dirname, "data", "sessions");
if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
}
app.use(
  session({
    name: "rainbow.sid",
    secret: SESSION_SECRET || "dev-session-secret",
    resave: false,
    saveUninitialized: false,
    store: new FileStore({
      path: sessionPath,
      ttl: 60 * 60 * 24 * 7,
      retries: 1,
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: PRIMARY_APP_ORIGIN.startsWith("https://"),
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

const loadAllowedUsers = () => {
  const filePath = path.join(__dirname, "data", "allowed-users.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAllowedUsers = (ids) => {
  const filePath = path.join(__dirname, "data", "allowed-users.json");
  fs.writeFileSync(filePath, JSON.stringify(ids, null, 2));
};

const loadUsers = () => {
  const filePath = path.join(__dirname, "data", "users.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeUsers = (users) => {
  const filePath = path.join(__dirname, "data", "users.json");
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
};

const loadLinkTypes = () => {
  const filePath = path.join(__dirname, "data", "link-types.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLinkTypes = (items) => {
  const filePath = path.join(__dirname, "data", "link-types.json");
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
};

const loadPosts = () => {
  const filePath = path.join(__dirname, "data", "posts.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePosts = (posts) => {
  const filePath = path.join(__dirname, "data", "posts.json");
  fs.writeFileSync(filePath, JSON.stringify(posts, null, 2));
};

const projectsFilePath = path.join(__dirname, "data", "projects.json");
const updatesFilePath = path.join(__dirname, "data", "updates.json");
const tagTranslationsFilePath = path.join(__dirname, "data", "tag-translations.json");
const commentsFilePath = path.join(__dirname, "data", "comments.json");
const pagesFilePath = path.join(__dirname, "data", "pages.json");
const siteSettingsFilePath = path.join(__dirname, "data", "site-settings.json");

const defaultSiteSettings = {
  site: {
    name: "NEKOMATA",
    logoUrl: "",
    faviconUrl: "",
    description:
      "Fansub dedicada a trazer histórias inesquecíveis com o carinho que a comunidade merece.",
    defaultShareImage: "/placeholder.svg",
  },
  navbar: {
    recruitmentUrl: "https://discord.com/invite/BAHKhdX2ju",
  },
  community: {
    discordUrl: "https://discord.com/invite/BAHKhdX2ju",
  },
  downloads: {
    sources: [
      { id: "google-drive", label: "Google Drive", color: "#34A853", icon: "google-drive" },
      { id: "mega", label: "MEGA", color: "#D9272E", icon: "mega" },
      { id: "torrent", label: "Torrent", color: "#7C3AED", icon: "torrent" },
      { id: "mediafire", label: "Mediafire", color: "#2563EB", icon: "mediafire" },
      { id: "telegram", label: "Telegram", color: "#0EA5E9", icon: "telegram" },
      { id: "outro", label: "Outro", color: "#64748B", icon: "link" },
    ],
  },
  teamRoles: [
    { id: "tradutor", label: "Tradutor", icon: "languages" },
    { id: "revisor", label: "Revisor", icon: "check" },
    { id: "typesetter", label: "Typesetter", icon: "pen-tool" },
    { id: "qualidade", label: "Qualidade", icon: "sparkles" },
    { id: "desenvolvedor", label: "Desenvolvedor", icon: "code" },
    { id: "cleaner", label: "Cleaner", icon: "paintbrush" },
    { id: "redrawer", label: "Redrawer", icon: "layers" },
    { id: "encoder", label: "Encoder", icon: "video" },
    { id: "k-timer", label: "K-Timer", icon: "clock" },
    { id: "logo-maker", label: "Logo Maker", icon: "badge" },
    { id: "k-maker", label: "K-Maker", icon: "palette" },
  ],
  footer: {
    brandName: "NEKOMATA",
    brandLogoUrl: "",
    brandDescription:
      "Fansub dedicada a trazer histórias inesquecíveis com o carinho que a comunidade merece. Traduzimos por paixão, respeitando autores e apoiando o consumo legal das obras.",
    columns: [
      {
        title: "Nekomata",
        links: [
          { label: "Sobre", href: "/sobre" },
          { label: "Equipe", href: "/equipe" },
        ],
      },
      {
        title: "Ajude nossa equipe",
        links: [
          { label: "Recrutamento", href: "https://discord.com/invite/BAHKhdX2ju" },
          { label: "Doações", href: "/doacoes" },
        ],
      },
      {
        title: "Links úteis",
        links: [
          { label: "Projetos", href: "/projetos" },
          { label: "FAQ", href: "/faq" },
          { label: "Reportar erros", href: "https://discord.com/invite/BAHKhdX2ju" },
          { label: "Info Anime", href: "https://infoanime.com.br" },
        ],
      },
    ],
    socialLinks: [
      { label: "Instagram", href: "https://instagram.com", icon: "instagram" },
      { label: "Facebook", href: "https://facebook.com", icon: "facebook" },
      { label: "Twitter", href: "https://twitter.com", icon: "twitter" },
      { label: "Discord", href: "https://discord.com/invite/BAHKhdX2ju", icon: "discord" },
    ],
    disclaimer: [
      "Todo o conteúdo divulgado aqui pertence a seus respectivos autores e editoras. As traduções são realizadas por fãs, sem fins lucrativos, com o objetivo de divulgar as obras no Brasil.",
      "Caso goste de alguma obra, apoie a versão oficial. A venda de materiais legendados pela equipe é proibida.",
    ],
    highlightTitle: "Atribuição • Não Comercial",
    highlightDescription:
      "Este site segue a licença Creative Commons BY-NC. Você pode compartilhar com créditos, sem fins comerciais.",
    copyright: "© 2014 - 2026 Nekomata Fansub. Feito por fãs para fãs.",
  },
};

const mergeSettings = (base, override) => {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override : base;
  }
  if (base && typeof base === "object") {
    const next = { ...base };
    if (override && typeof override === "object") {
      Object.keys(override).forEach((key) => {
        next[key] = mergeSettings(base[key], override[key]);
      });
    }
    return next;
  }
  return override ?? base;
};

const normalizeSiteSettings = (payload) => {
  const merged = mergeSettings(defaultSiteSettings, payload || {});
  const discordUrl = String(merged?.community?.discordUrl || "").trim();
  if (discordUrl) {
    if (!merged.navbar?.recruitmentUrl) {
      merged.navbar.recruitmentUrl = discordUrl;
    }
    if (Array.isArray(merged.footer?.socialLinks)) {
      merged.footer.socialLinks = merged.footer.socialLinks.map((link) => {
        if (String(link.label || "").toLowerCase() === "discord" && !link.href) {
          return { ...link, href: discordUrl };
        }
        return link;
      });
    }
  }
  return merged;
};

const loadProjects = () => {
  try {
    if (!fs.existsSync(projectsFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(projectsFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeProjects = (projects) => {
  fs.mkdirSync(path.dirname(projectsFilePath), { recursive: true });
  fs.writeFileSync(projectsFilePath, JSON.stringify(projects, null, 2));
};

const loadUpdates = () => {
  try {
    if (!fs.existsSync(updatesFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(updatesFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeUpdates = (updates) => {
  fs.mkdirSync(path.dirname(updatesFilePath), { recursive: true });
  fs.writeFileSync(updatesFilePath, JSON.stringify(updates, null, 2));
};

const loadTagTranslations = () => {
  try {
    if (!fs.existsSync(tagTranslationsFilePath)) {
      return { tags: {}, genres: {} };
    }
    const raw = fs.readFileSync(tagTranslationsFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      tags: parsed?.tags && typeof parsed.tags === "object" ? parsed.tags : {},
      genres: parsed?.genres && typeof parsed.genres === "object" ? parsed.genres : {},
    };
  } catch {
    return { tags: {}, genres: {} };
  }
};

const writeTagTranslations = (payload) => {
  fs.mkdirSync(path.dirname(tagTranslationsFilePath), { recursive: true });
  fs.writeFileSync(tagTranslationsFilePath, JSON.stringify(payload, null, 2));
};

const loadComments = () => {
  try {
    if (!fs.existsSync(commentsFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(commentsFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeComments = (comments) => {
  fs.mkdirSync(path.dirname(commentsFilePath), { recursive: true });
  fs.writeFileSync(commentsFilePath, JSON.stringify(comments, null, 2));
};

const loadPages = () => {
  try {
    if (!fs.existsSync(pagesFilePath)) {
      const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "pages.json"), "utf-8"));
      fs.mkdirSync(path.dirname(pagesFilePath), { recursive: true });
      fs.writeFileSync(pagesFilePath, JSON.stringify(seed, null, 2));
      return seed;
    }
    const raw = fs.readFileSync(pagesFilePath, "utf-8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
};

const writePages = (pages) => {
  fs.mkdirSync(path.dirname(pagesFilePath), { recursive: true });
  fs.writeFileSync(pagesFilePath, JSON.stringify(pages, null, 2));
};

const loadSiteSettings = () => {
  try {
    if (!fs.existsSync(siteSettingsFilePath)) {
      const seeded = normalizeSiteSettings(defaultSiteSettings);
      fs.mkdirSync(path.dirname(siteSettingsFilePath), { recursive: true });
      fs.writeFileSync(siteSettingsFilePath, JSON.stringify(seeded, null, 2));
      return seeded;
    }
    const raw = fs.readFileSync(siteSettingsFilePath, "utf-8");
    const parsed = JSON.parse(raw || "{}");
    return normalizeSiteSettings(parsed);
  } catch {
    return normalizeSiteSettings(defaultSiteSettings);
  }
};

const writeSiteSettings = (settings) => {
  fs.mkdirSync(path.dirname(siteSettingsFilePath), { recursive: true });
  fs.writeFileSync(siteSettingsFilePath, JSON.stringify(settings, null, 2));
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const createGravatarHash = (email) =>
  crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
const buildGravatarUrl = (hash, size = 96) =>
  `https://gravatar.com/avatar/${hash}?d=identicon&s=${size}`;

const resolveGravatarAvatarUrl = async (hash) => {
  const apiKey = process.env.GRAVATAR_API_KEY;
  if (!apiKey) {
    return buildGravatarUrl(hash);
  }
  try {
    const response = await fetch(`https://api.gravatar.com/v3/profiles/${hash}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      return buildGravatarUrl(hash);
    }
    const data = await response.json();
    if (data?.avatar_url) {
      return String(data.avatar_url);
    }
  } catch {
    // ignore
  }
  return buildGravatarUrl(hash);
};

const commentRateLimit = new Map();
const canSubmitComment = (ip) => {
  if (!ip) {
    return true;
  }
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxPerWindow = 3;
  const entry = commentRateLimit.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  commentRateLimit.set(ip, entry);
  return entry.count <= maxPerWindow;
};
const createSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizePosts = (posts) => {
  const now = Date.now();
  return posts.map((post, index) => {
    const id = String(post.id || `${Date.now()}-${index}`);
    const title = String(post.title || "Sem título");
    const slug = String(post.slug || createSlug(title) || id);
    const publishedAt = post.publishedAt || post.createdAt || new Date().toISOString();
    const scheduledAt = post.scheduledAt || null;
    const status =
      post.status === "draft" || post.status === "scheduled" || post.status === "published"
        ? post.status
        : new Date(publishedAt).getTime() > now
          ? "scheduled"
          : "published";
    return {
      id,
      title,
      slug,
      coverImageUrl: post.coverImageUrl || null,
      coverAlt: post.coverAlt || "",
      excerpt: post.excerpt || "",
      content: post.content || "",
      contentFormat: post.contentFormat === "html" ? "html" : "markdown",
      author: post.author || "",
      publishedAt,
      scheduledAt,
      status,
      seoTitle: post.seoTitle || "",
      seoDescription: post.seoDescription || "",
      projectId: post.projectId || "",
      tags: Array.isArray(post.tags) ? post.tags.filter(Boolean) : [],
      views: Number.isFinite(post.views) ? post.views : 0,
      commentsCount: Number.isFinite(post.commentsCount) ? post.commentsCount : 0,
      createdAt: post.createdAt || new Date().toISOString(),
      updatedAt: post.updatedAt || post.createdAt || new Date().toISOString(),
    };
  });
};

const normalizeProjects = (projects) =>
  projects.map((project, index) => ({
    id: String(project.id || `project-${Date.now()}-${index}`),
    anilistId: project.anilistId ? Number(project.anilistId) : null,
    title: String(project.title || "Sem título"),
    titleOriginal: String(project.titleOriginal || ""),
    titleEnglish: String(project.titleEnglish || ""),
    synopsis: String(project.synopsis || ""),
    description: String(project.description || ""),
    type: String(project.type || project.format || ""),
    status: String(project.status || ""),
    year: String(project.year || ""),
    studio: String(project.studio || ""),
    episodes: String(project.episodes || ""),
    tags: Array.isArray(project.tags) ? project.tags.filter(Boolean) : [],
    genres: Array.isArray(project.genres) ? project.genres.filter(Boolean) : [],
    cover: project.cover || "/placeholder.svg",
    banner: project.banner || "/placeholder.svg",
    season: String(project.season || ""),
    schedule: String(project.schedule || ""),
    rating: String(project.rating || ""),
    country: String(project.country || ""),
    source: String(project.source || ""),
    producers: Array.isArray(project.producers) ? project.producers.filter(Boolean) : [],
    score: Number.isFinite(project.score) ? project.score : null,
    startDate: project.startDate || "",
    endDate: project.endDate || "",
    relations: Array.isArray(project.relations) ? project.relations : [],
    staff: Array.isArray(project.fansubStaff)
      ? project.fansubStaff
      : Array.isArray(project.staff)
        ? project.staff
        : [],
    animeStaff: Array.isArray(project.animeStaff) ? project.animeStaff : [],
    trailerUrl: project.trailerUrl || "",
    episodeDownloads: Array.isArray(project.episodeDownloads)
      ? project.episodeDownloads.map((episode) => ({
          ...episode,
          chapterUpdatedAt: episode.chapterUpdatedAt || "",
        }))
      : [],
    views: Number.isFinite(project.views) ? project.views : 0,
    commentsCount: Number.isFinite(project.commentsCount) ? project.commentsCount : 0,
    order: Number.isFinite(project.order) ? project.order : index,
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: project.updatedAt || project.createdAt || new Date().toISOString(),
  }));

const countApprovedComments = (comments, targetType, targetId) =>
  comments.filter(
    (comment) =>
      comment.status === "approved" &&
      comment.targetType === targetType &&
      comment.targetId === targetId,
  ).length;

const applyCommentCountToPosts = (posts, comments, targetId) => {
  const next = [...posts];
  const index = next.findIndex((post) => post.slug === targetId || post.id === targetId);
  if (index === -1) {
    return next;
  }
  next[index] = {
    ...next[index],
    commentsCount: countApprovedComments(comments, "post", next[index].slug),
    updatedAt: new Date().toISOString(),
  };
  return next;
};

const applyCommentCountToProjects = (projects, comments, targetId) => {
  const next = [...projects];
  const index = next.findIndex((project) => project.id === targetId);
  if (index === -1) {
    return next;
  }
  next[index] = {
    ...next[index],
    commentsCount: countApprovedComments(comments, "project", next[index].id),
    updatedAt: new Date().toISOString(),
  };
  return next;
};

const collectEpisodeUpdates = (prevProject, nextProject) => {
  const updates = [];
  const prevEpisodes = Array.isArray(prevProject?.episodeDownloads) ? prevProject.episodeDownloads : [];
  const nextEpisodes = Array.isArray(nextProject?.episodeDownloads) ? nextProject.episodeDownloads : [];
  const prevMap = new Map(prevEpisodes.map((ep) => [Number(ep.number), ep]));
  const typeLabel = String(nextProject?.type || "").toLowerCase();
  const isChapterBased =
    typeLabel.includes("mang") ||
    typeLabel.includes("webtoon") ||
    typeLabel.includes("light") ||
    typeLabel.includes("novel");
  const unitLabel = isChapterBased ? "Capítulo" : "Episódio";
  const isLightNovel =
    typeLabel.includes("light") || typeLabel.includes("novel");
  nextEpisodes.forEach((ep) => {
    const number = Number(ep.number);
    const sources = Array.isArray(ep.sources) ? ep.sources.filter((s) => s.url) : [];
    const hasContent = typeof ep.content === "string" && ep.content.trim().length > 0;
    if (!sources.length && !(isLightNovel && hasContent)) {
      return;
    }
    const prev = prevMap.get(number);
    const prevSources = Array.isArray(prev?.sources) ? prev.sources.filter((s) => s.url) : [];
    const prevContent = typeof prev?.content === "string" ? prev.content.trim() : "";
    const urls = sources.map((s) => s.url).sort().join("|");
    const prevUrls = prevSources.map((s) => s.url).sort().join("|");
    if (isLightNovel) {
      const chapterUpdatedAt = ep.chapterUpdatedAt || "";
      const prevSignature = [
        String(prev?.title || ""),
        String(prev?.synopsis || ""),
        String(prev?.releaseDate || ""),
        prevContent,
      ].join("||");
      const nextSignature = [
        String(ep.title || ""),
        String(ep.synopsis || ""),
        String(ep.releaseDate || ""),
        String(ep.content || "").trim(),
      ].join("||");
      if (!prev || !prevContent) {
        if (!chapterUpdatedAt) {
          return;
        }
        updates.push({
          kind: "Lançamento",
          reason: `${unitLabel} ${number} disponível`,
          episodeNumber: number,
          unit: unitLabel,
          updatedAt: chapterUpdatedAt,
        });
        return;
      }
      if (nextSignature !== prevSignature) {
        updates.push({
          kind: "Ajuste",
          reason: `Conteúdo ajustado no ${unitLabel.toLowerCase()} ${number}`,
          episodeNumber: number,
          unit: unitLabel,
          updatedAt: chapterUpdatedAt || new Date().toISOString(),
        });
      }
      return;
    }
    if (!prev || prevSources.length === 0) {
      updates.push({
        kind: "Lançamento",
        reason: `${unitLabel} ${number} disponível`,
        episodeNumber: number,
        unit: unitLabel,
      });
      return;
    }
    if (urls !== prevUrls) {
      const newUrlSet = new Set(sources.map((s) => s.url));
      const addedOnly = sources.length > prevSources.length && prevSources.every((s) => newUrlSet.has(s.url));
      updates.push({
        kind: addedOnly ? "Lançamento" : "Ajuste",
        reason: addedOnly
          ? `Novo link adicionado no ${unitLabel.toLowerCase()} ${number}`
          : `Links ajustados no ${unitLabel.toLowerCase()} ${number}`,
        episodeNumber: number,
        unit: unitLabel,
      });
    }
  });
  return updates;
};

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
};

const createDiscordAvatarUrl = (user) => {
  if (!user?.avatar) {
    return null;
  }
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
};

app.get("/auth/discord", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  if (req.session) {
    req.session.oauthState = state;
  }

  if (typeof req.query.next === "string" && req.query.next.trim()) {
    if (req.session) {
      req.session.loginNext = req.query.next;
    }
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID || "",
    response_type: "code",
    redirect_uri: DISCORD_REDIRECT_URI,
    scope: SCOPES.join(" "),
    state,
    prompt: "consent",
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

app.get("/login", async (req, res) => {
  const { code, state } = req.query;

  if (!code || typeof code !== "string") {
    return res.redirect(`${PRIMARY_APP_ORIGIN}/login?error=missing_code`);
  }

  if (!state || typeof state !== "string" || state !== req.session?.oauthState) {
    return res.redirect(`${PRIMARY_APP_ORIGIN}/login?error=state_mismatch`);
  }

  if (req.session) {
    req.session.oauthState = null;
  }

  try {
    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID || "",
        client_secret: DISCORD_CLIENT_SECRET || "",
        grant_type: "authorization_code",
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
        scope: SCOPES.join(" "),
      }),
    });

    if (!tokenResponse.ok) {
      return res.redirect(`${PRIMARY_APP_ORIGIN}/login?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: {
        authorization: `${tokenData.token_type} ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      return res.redirect(`${PRIMARY_APP_ORIGIN}/login?error=user_fetch_failed`);
    }

    const discordUser = await userResponse.json();
    const allowedUsers = loadAllowedUsers();
    const isAllowed = allowedUsers.includes(discordUser.id);

    if (!isAllowed) {
      if (req.session) {
        req.session.destroy(() => undefined);
      }
      return res.redirect(`${PRIMARY_APP_ORIGIN}/login?error=unauthorized`);
    }

    req.session.user = {
      id: discordUser.id,
      name: discordUser.global_name || discordUser.username,
      username: discordUser.username,
      email: discordUser.email || null,
      avatarUrl: createDiscordAvatarUrl(discordUser),
    };
    ensureOwnerUser(req.session.user);

    const next = req.session?.loginNext;
    if (req.session) {
      req.session.loginNext = null;
    }
    return res.redirect(next ? `${PRIMARY_APP_ORIGIN}${next}` : `${PRIMARY_APP_ORIGIN}/dashboard`);
  } catch {
    return res.redirect(`${PRIMARY_APP_ORIGIN}/login?error=server_error`);
  }
});

const buildUserPayload = (sessionUser) => {
  ensureOwnerUser(sessionUser);
  const users = normalizeUsers(loadUsers());
  const matched = users.find((user) => user.id === String(sessionUser.id));
  return {
    ...sessionUser,
    permissions: matched?.permissions || [],
    roles: matched?.roles || [],
  };
};

app.get("/api/me", (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  return res.json(buildUserPayload(req.session.user));
});

app.get("/api/public/me", (req, res) => {
  if (!req.session?.user) {
    return res.json({ user: null });
  }

  return res.json({ user: buildUserPayload(req.session.user) });
});

const requireAuth = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
};

const requireOwner = (req, res, next) => {
  if (!req.session?.user || !isOwner(req.session.user.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  return next();
};

const normalizeUsers = (users) => {
  return users.map((user, index) => ({
    id: String(user.id),
    name: user.name || "Sem nome",
    phrase: user.phrase || "",
    bio: user.bio || "",
    avatarUrl: user.avatarUrl || null,
    coverImageUrl: user.coverImageUrl || null,
    socials: Array.isArray(user.socials) ? user.socials.filter(Boolean) : [],
    status: user.status === "retired" ? "retired" : "active",
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    roles: Array.isArray(user.roles) ? user.roles.filter(Boolean) : [],
    order: typeof user.order === "number" ? user.order : index,
  }));
};

const applyOwnerRole = (user) => {
  if (!isOwner(user.id)) {
    return user;
  }
  const roles = user.roles || [];
  if (roles.includes("Dono")) {
    return user;
  }
  return { ...user, roles: ["Dono", ...roles] };
};

const isAdminUser = (user) => {
  if (!user) {
    return false;
  }
  if (isOwner(user.id)) {
    return true;
  }
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes("usuarios");
};

const canManagePosts = (userId) => {
  if (!userId) {
    return false;
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes("posts");
};

const canManageProjects = (userId) => {
  if (!userId) {
    return false;
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes("projetos");
};

const canManageComments = (userId) => {
  if (!userId) {
    return false;
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return (
    permissions.includes("*") ||
    permissions.includes("comentarios") ||
    permissions.includes("posts") ||
    permissions.includes("projetos")
  );
};

const canManagePages = (userId) => {
  if (!userId) {
    return false;
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes("paginas");
};

const canManageSettings = (userId) => {
  if (!userId) {
    return false;
  }
  if (isOwner(userId)) {
    return true;
  }
  const user = normalizeUsers(loadUsers()).find((item) => item.id === String(userId));
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes("*") || permissions.includes("configuracoes");
};

const syncAllowedUsers = (users) => {
  const activeIds = users.filter((user) => user.status === "active").map((user) => user.id);
  const unique = Array.from(new Set([...OWNER_IDS, ...activeIds]));
  writeAllowedUsers(unique);
};

const ensureOwnerUser = (sessionUser) => {
  if (!sessionUser || !isOwner(sessionUser.id)) {
    return;
  }

  let users = normalizeUsers(loadUsers());
  if (!users.some((user) => user.id === String(sessionUser.id))) {
    users.push({
      id: String(sessionUser.id),
      name: sessionUser.name || "Administrador",
      phrase: "",
      bio: "",
      avatarUrl: sessionUser.avatarUrl || null,
      coverImageUrl: null,
      socials: [],
      status: "active",
      permissions: ["*"],
      order: users.length,
    });
  }

  users = normalizeUsers(users).map((user) =>
    isOwner(user.id)
      ? { ...user, status: "active", permissions: ["*"] }
      : user,
  );
  users.sort((a, b) => a.order - b.order);
  writeUsers(users);
  syncAllowedUsers(users);
};

app.get("/api/users", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  ensureOwnerUser(sessionUser);
  let users = normalizeUsers(loadUsers());

  if (sessionUser?.id && isOwner(sessionUser.id) && !users.some((user) => user.id === String(sessionUser.id))) {
    users.push({
      id: String(sessionUser.id),
      name: sessionUser.name,
      phrase: "",
      bio: "",
      avatarUrl: sessionUser.avatarUrl || null,
      coverImageUrl: null,
      socials: [],
      status: "active",
      permissions: ["*"],
      order: users.length,
    });
  }

  users = normalizeUsers(users).map((user) =>
    isOwner(user.id)
      ? { ...user, status: "active", permissions: ["*"] }
      : user,
  );
  users.sort((a, b) => a.order - b.order);
  writeUsers(users);
  syncAllowedUsers(users);
  res.json({ users: users.map(applyOwnerRole), ownerIds: OWNER_IDS });
});

app.get("/api/public/users", (req, res) => {
  const users = normalizeUsers(loadUsers())
    .sort((a, b) => a.order - b.order)
    .map((user) => ({
      id: user.id,
      name: user.name,
      phrase: user.phrase,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      coverImageUrl: user.coverImageUrl,
      socials: user.socials,
      roles: applyOwnerRole(user).roles,
      status: user.status,
    }));

  res.json({ users });
});

app.get("/api/link-types", (req, res) => {
  const items = loadLinkTypes();
  res.json({ items });
});

app.put("/api/link-types", requireOwner, (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items_required" });
  }
  const normalized = items
    .map((item) => ({
      id: String(item.id || "").trim(),
      label: String(item.label || "").trim(),
      icon: String(item.icon || "globe").trim(),
    }))
    .filter((item) => item.id && item.label);
  writeLinkTypes(normalized);
  return res.json({ items: normalized });
});

app.get("/api/posts", requireAuth, (req, res) => {
  const posts = normalizePosts(loadPosts()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  res.json({ posts });
});

app.get("/api/public/posts", (req, res) => {
  const now = Date.now();
  const posts = normalizePosts(loadPosts())
    .filter((post) => {
      const publishTime = new Date(post.publishedAt).getTime();
      return publishTime <= now && (post.status === "published" || post.status === "scheduled");
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      coverImageUrl: post.coverImageUrl,
      coverAlt: post.coverAlt,
      excerpt: post.excerpt,
      author: post.author,
      publishedAt: post.publishedAt,
      views: post.views,
      commentsCount: post.commentsCount,
      projectId: post.projectId || "",
      tags: Array.isArray(post.tags) ? post.tags : [],
    }));

  res.json({ posts });
});

app.get("/api/public/posts/:slug", (req, res) => {
  const now = Date.now();
  const slug = String(req.params.slug || "");
  const posts = normalizePosts(loadPosts());
  const post = posts.find((item) => item.slug === slug);
  if (!post) {
    return res.status(404).json({ error: "not_found" });
  }
  const publishTime = new Date(post.publishedAt).getTime();
  if (publishTime > now || (post.status !== "published" && post.status !== "scheduled")) {
    return res.status(404).json({ error: "not_found" });
  }
  return res.json({
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      coverImageUrl: post.coverImageUrl,
      coverAlt: post.coverAlt,
      excerpt: post.excerpt,
      content: post.content,
      contentFormat: post.contentFormat,
      author: post.author,
      publishedAt: post.publishedAt,
      views: post.views,
      commentsCount: post.commentsCount,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      projectId: post.projectId || "",
      tags: Array.isArray(post.tags) ? post.tags : [],
    },
  });
});

app.get("/api/public/comments", (req, res) => {
  const type = String(req.query.type || "").toLowerCase();
  const id = String(req.query.id || "").trim();
  if (!type || !id) {
    return res.status(400).json({ error: "target_required" });
  }
  const chapterNumber = Number(req.query.chapter);
  const volume = Number(req.query.volume);
  const comments = loadComments()
    .filter((comment) => comment.status === "approved")
    .filter((comment) => comment.targetType === type && comment.targetId === id)
    .filter((comment) => {
      if (type !== "chapter") {
        return true;
      }
      if (!Number.isFinite(chapterNumber)) {
        return false;
      }
      const targetChapter = Number(comment.targetMeta?.chapterNumber);
      if (targetChapter !== chapterNumber) {
        return false;
      }
      if (Number.isFinite(volume)) {
        return Number(comment.targetMeta?.volume || 0) === volume;
      }
      return true;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((comment) => ({
      id: comment.id,
      parentId: comment.parentId || null,
      name: comment.name,
      content: comment.content,
      createdAt: comment.createdAt,
      avatarUrl: comment.avatarUrl || buildGravatarUrl(comment.emailHash || ""),
    }));

  return res.json({ comments });
});

app.post("/api/public/comments", async (req, res) => {
  const sessionUser = req.session?.user || null;
  const isStaff = sessionUser?.id ? canManageComments(sessionUser.id) : false;
  const { targetType, targetId, parentId, name, email, content, chapterNumber, volume, website } = req.body || {};
  if (website) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!canSubmitComment(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }
  const normalizedTargetType = String(targetType || "").toLowerCase();
  const normalizedTargetId = String(targetId || "").trim();
  const normalizedName = isStaff
    ? String(sessionUser?.name || "Equipe").trim()
    : String(name || "").trim();
  const normalizedEmail = isStaff ? normalizeEmail(sessionUser?.email) : normalizeEmail(email);
  const normalizedContent = String(content || "").trim().slice(0, 2000);

  if (!normalizedTargetType || !normalizedTargetId) {
    return res.status(400).json({ error: "target_required" });
  }
  if (!normalizedName || !normalizedContent) {
    return res.status(400).json({ error: "fields_required" });
  }
  if (!isStaff && (!normalizedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail))) {
    return res.status(400).json({ error: "invalid_email" });
  }
  if (normalizedContent.length > 2000) {
    return res.status(400).json({ error: "content_too_long" });
  }

  const posts = normalizePosts(loadPosts());
  const projects = normalizeProjects(loadProjects());
  if (normalizedTargetType === "post") {
    if (!posts.some((post) => post.slug === normalizedTargetId)) {
      return res.status(404).json({ error: "target_not_found" });
    }
  } else if (normalizedTargetType === "project") {
    if (!projects.some((project) => project.id === normalizedTargetId)) {
      return res.status(404).json({ error: "target_not_found" });
    }
  } else if (normalizedTargetType === "chapter") {
    const chapter = Number(chapterNumber);
    if (!Number.isFinite(chapter)) {
      return res.status(400).json({ error: "chapter_required" });
    }
    const project = projects.find((item) => item.id === normalizedTargetId);
    if (!project) {
      return res.status(404).json({ error: "target_not_found" });
    }
  } else {
    return res.status(400).json({ error: "invalid_target" });
  }

  const comments = loadComments();
  if (parentId) {
    const parent = comments.find((comment) => comment.id === String(parentId));
    if (!parent || parent.targetType !== normalizedTargetType || parent.targetId !== normalizedTargetId) {
      return res.status(400).json({ error: "invalid_parent" });
    }
  }

  const emailHash = createGravatarHash(normalizedEmail);
  const avatarUrl = isStaff
    ? String(sessionUser?.avatarUrl || "")
    : await resolveGravatarAvatarUrl(emailHash);
  const now = new Date().toISOString();
  const newComment = {
    id: crypto.randomUUID(),
    targetType: normalizedTargetType,
    targetId: normalizedTargetId,
    targetMeta:
      normalizedTargetType === "chapter"
        ? {
            chapterNumber: Number(chapterNumber),
            volume: Number.isFinite(Number(volume)) ? Number(volume) : undefined,
          }
        : {},
    parentId: parentId ? String(parentId) : null,
    name: normalizedName,
    emailHash,
    content: normalizedContent,
    status: isStaff ? "approved" : "pending",
    createdAt: now,
    approvedAt: isStaff ? now : null,
    avatarUrl,
  };

  comments.push(newComment);
  writeComments(comments);
  return res.json({ comment: { id: newComment.id, status: newComment.status } });
});

const buildCommentTargetInfo = (comment, posts, projects) => {
  if (comment.targetType === "post") {
    const post = posts.find((item) => item.slug === comment.targetId);
    if (!post) {
      return { label: "Postagem", url: PRIMARY_APP_ORIGIN };
    }
    return { label: post.title, url: `${PRIMARY_APP_ORIGIN}/postagem/${post.slug}` };
  }
  if (comment.targetType === "project") {
    const project = projects.find((item) => item.id === comment.targetId);
    if (!project) {
      return { label: "Projeto", url: PRIMARY_APP_ORIGIN };
    }
    return { label: project.title, url: `${PRIMARY_APP_ORIGIN}/projeto/${project.id}` };
  }
  if (comment.targetType === "chapter") {
    const project = projects.find((item) => item.id === comment.targetId);
    const chapterNumber = comment.targetMeta?.chapterNumber;
    const volume = comment.targetMeta?.volume;
    const chapterLabel = chapterNumber ? `Capítulo ${chapterNumber}` : "Capítulo";
    const projectLabel = project?.title ? `${project.title} • ${chapterLabel}` : chapterLabel;
    const volumeQuery = Number.isFinite(volume) ? `?volume=${volume}` : "";
    const url = project
      ? `${PRIMARY_APP_ORIGIN}/projeto/${project.id}/leitura/${chapterNumber}${volumeQuery}`
      : PRIMARY_APP_ORIGIN;
    return { label: projectLabel, url };
  }
  return { label: "Comentário", url: PRIMARY_APP_ORIGIN };
};

app.get("/api/comments/pending", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageComments(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const posts = normalizePosts(loadPosts());
  const projects = normalizeProjects(loadProjects());
  const comments = loadComments()
    .filter((comment) => comment.status === "pending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((comment) => {
      const target = buildCommentTargetInfo(comment, posts, projects);
      return {
        id: comment.id,
        targetType: comment.targetType,
        targetId: comment.targetId,
        parentId: comment.parentId || null,
        name: comment.name,
        content: comment.content,
        createdAt: comment.createdAt,
        avatarUrl: comment.avatarUrl || buildGravatarUrl(comment.emailHash || ""),
        targetLabel: target.label,
        targetUrl: target.url,
      };
    });
  return res.json({ comments });
});

app.post("/api/comments/:id/approve", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageComments(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  const comments = loadComments();
  const index = comments.findIndex((comment) => comment.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const existing = comments[index];
  if (existing.status === "approved") {
    return res.json({ ok: true });
  }
  comments[index] = {
    ...existing,
    status: "approved",
    approvedAt: new Date().toISOString(),
  };
  writeComments(comments);

  if (existing.targetType === "post") {
    const updatedPosts = applyCommentCountToPosts(normalizePosts(loadPosts()), comments, existing.targetId);
    writePosts(updatedPosts);
  }
  if (existing.targetType === "project") {
    const updatedProjects = applyCommentCountToProjects(
      normalizeProjects(loadProjects()),
      comments,
      existing.targetId,
    );
    writeProjects(updatedProjects);
  }

  return res.json({ ok: true });
});

app.delete("/api/comments/:id", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageComments(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  const comments = loadComments();
  const index = comments.findIndex((comment) => comment.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const [removed] = comments.splice(index, 1);
  writeComments(comments);

  if (removed.status === "approved") {
    if (removed.targetType === "post") {
      const updatedPosts = applyCommentCountToPosts(normalizePosts(loadPosts()), comments, removed.targetId);
      writePosts(updatedPosts);
    }
    if (removed.targetType === "project") {
      const updatedProjects = applyCommentCountToProjects(
        normalizeProjects(loadProjects()),
        comments,
        removed.targetId,
      );
      writeProjects(updatedProjects);
    }
  }

  return res.json({ ok: true });
});

app.post("/api/posts", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const {
    title,
    slug,
    coverImageUrl,
    coverAlt,
    excerpt,
    content,
    contentFormat,
    author,
    publishedAt,
    scheduledAt,
    status,
    seoTitle,
    seoDescription,
    projectId,
    tags,
  } = req.body || {};
  if (!title || !slug) {
    return res.status(400).json({ error: "title_and_slug_required" });
  }

  let posts = normalizePosts(loadPosts());
  if (posts.some((post) => post.slug === String(slug))) {
    return res.status(409).json({ error: "slug_exists" });
  }

  const now = new Date().toISOString();
  const normalizedStatus =
    status === "draft" || status === "scheduled" || status === "published" ? status : "draft";
  const normalizedPublishedAt =
    normalizedStatus === "published"
      ? publishedAt || now
      : normalizedStatus === "scheduled"
        ? publishedAt || scheduledAt || now
        : publishedAt || now;
  const newPost = {
    id: crypto.randomUUID(),
    title: String(title),
    slug: String(slug),
    coverImageUrl: coverImageUrl || null,
    coverAlt: coverAlt || "",
    excerpt: excerpt || "",
    content: content || "",
    contentFormat: contentFormat === "html" ? "html" : "markdown",
    author: author || sessionUser?.name || "Autor",
    publishedAt: normalizedPublishedAt,
    scheduledAt: scheduledAt || null,
    status: normalizedStatus,
    seoTitle: seoTitle || "",
    seoDescription: seoDescription || "",
    projectId: projectId || "",
    tags: normalizeTags(tags),
    views: 0,
    commentsCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  posts.push(newPost);
  writePosts(posts);
  return res.json({ post: newPost });
});

app.put("/api/posts/:id", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const { id } = req.params;
  const {
    title,
    slug,
    coverImageUrl,
    coverAlt,
    excerpt,
    content,
    contentFormat,
    author,
    publishedAt,
    scheduledAt,
    status,
    seoTitle,
    seoDescription,
    projectId,
    tags,
  } = req.body || {};
  let posts = normalizePosts(loadPosts());
  const index = posts.findIndex((post) => post.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }

  if (slug && posts.some((post) => post.slug === String(slug) && post.id !== String(id))) {
    return res.status(409).json({ error: "slug_exists" });
  }

  const existing = posts[index];
  const normalizedStatus =
    status === "draft" || status === "scheduled" || status === "published" ? status : existing.status;
  const updated = {
    ...existing,
    title: title ? String(title) : existing.title,
    slug: slug ? String(slug) : existing.slug,
    coverImageUrl: coverImageUrl === "" ? null : coverImageUrl ?? existing.coverImageUrl,
    coverAlt: typeof coverAlt === "string" ? coverAlt : existing.coverAlt,
    excerpt: typeof excerpt === "string" ? excerpt : existing.excerpt,
    content: typeof content === "string" ? content : existing.content,
    contentFormat: contentFormat === "html" ? "html" : contentFormat === "markdown" ? "markdown" : existing.contentFormat,
    author: typeof author === "string" ? author : existing.author,
    publishedAt: publishedAt || existing.publishedAt,
    scheduledAt: scheduledAt || existing.scheduledAt,
    status: normalizedStatus,
    seoTitle: typeof seoTitle === "string" ? seoTitle : existing.seoTitle,
    seoDescription: typeof seoDescription === "string" ? seoDescription : existing.seoDescription,
    projectId: typeof projectId === "string" ? projectId : existing.projectId,
    tags: normalizeTags(tags).length ? normalizeTags(tags) : existing.tags,
    updatedAt: new Date().toISOString(),
  };

  posts[index] = updated;
  writePosts(posts);
  return res.json({ post: updated });
});

app.delete("/api/posts/:id", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const { id } = req.params;
  let posts = normalizePosts(loadPosts());
  const next = posts.filter((post) => post.id !== String(id));
  if (next.length === posts.length) {
    return res.status(404).json({ error: "not_found" });
  }
  writePosts(next);
  return res.json({ ok: true });
});

app.get("/api/projects", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const projects = normalizeProjects(loadProjects()).sort((a, b) => a.order - b.order);
  res.json({ projects });
});

app.post("/api/projects", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const payload = req.body || {};
  const title = String(payload.title || "").trim();
  const id = String(payload.id || "").trim();
  if (!title || !id) {
    return res.status(400).json({ error: "title_and_id_required" });
  }

  let projects = normalizeProjects(loadProjects());
  if (projects.some((project) => project.id === id)) {
    return res.status(409).json({ error: "id_exists" });
  }

  const now = new Date().toISOString();
  const nextProject = normalizeProjects([
    {
      ...payload,
      id,
      title,
      createdAt: now,
      updatedAt: now,
      order: projects.length,
    },
  ])[0];

  projects.push(nextProject);
  writeProjects(projects);

  const updates = loadUpdates();
  const episodeUpdates = collectEpisodeUpdates(null, nextProject);
  if (episodeUpdates.length) {
    const nextUpdates = [
      ...updates,
      ...episodeUpdates.map((item) => ({
        id: crypto.randomUUID(),
        projectId: nextProject.id,
        projectTitle: nextProject.title,
        episodeNumber: item.episodeNumber,
        kind: item.kind,
        reason: item.reason,
        unit: item.unit,
        updatedAt: item.updatedAt || now,
        image: nextProject.cover || "",
      })),
    ];
    writeUpdates(nextUpdates);
  }
  if (String(nextProject.type || "").toLowerCase().includes("light") || String(nextProject.type || "").toLowerCase().includes("novel")) {
    const existingKeys = new Set(
      updates
        .filter((item) => item.projectId === nextProject.id)
        .map((item) => `${item.episodeNumber}`),
    );
    const fallbackSource = (nextProject.episodeDownloads || [])
      .filter((episode) => typeof episode.content === "string" && episode.content.trim().length > 0)
      .filter((episode) => !existingKeys.has(`${episode.number}`))
      .sort((a, b) => Number(b.number) - Number(a.number));
    const fallback = fallbackSource
      .map((episode) => ({
        id: crypto.randomUUID(),
        projectId: nextProject.id,
        projectTitle: nextProject.title,
        episodeNumber: episode.number,
        kind: "Lançamento",
        reason: `Capítulo ${episode.number} disponível`,
        unit: "Capítulo",
        updatedAt: new Date(Date.now() - fallbackSource.indexOf(episode) * 1000).toISOString(),
        image: nextProject.cover || "",
      }));
    if (fallback.length) {
      writeUpdates([...updates, ...fallback]);
    }
  }

  return res.status(201).json({ project: nextProject });
});

app.put("/api/projects/:id", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const { id } = req.params;
  let projects = normalizeProjects(loadProjects());
  const index = projects.findIndex((project) => project.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }

  const existing = projects[index];
  const payload = req.body || {};
  const now = new Date().toISOString();
  const merged = normalizeProjects([
    {
      ...existing,
      ...payload,
      id: existing.id,
      updatedAt: now,
    },
  ])[0];

  projects[index] = merged;
  writeProjects(projects);

  const updates = loadUpdates();
  const episodeUpdates = collectEpisodeUpdates(existing, merged);
  const nextUpdates = episodeUpdates.length
    ? [
        ...updates,
        ...episodeUpdates.map((item) => ({
          id: crypto.randomUUID(),
          projectId: merged.id,
          projectTitle: merged.title,
          episodeNumber: item.episodeNumber,
          kind: item.kind,
          reason: item.reason,
          unit: item.unit,
        updatedAt: item.updatedAt || now,
        image: merged.cover || "",
      })),
      ]
    : updates;
  if (episodeUpdates.length) {
    writeUpdates(nextUpdates);
  }
  if (String(merged.type || "").toLowerCase().includes("light") || String(merged.type || "").toLowerCase().includes("novel")) {
    const existingKeys = new Set(
      nextUpdates
        .filter((item) => item.projectId === merged.id)
        .map((item) => `${item.episodeNumber}`),
    );
    const fallbackSource = (merged.episodeDownloads || [])
      .filter((episode) => typeof episode.content === "string" && episode.content.trim().length > 0)
      .filter((episode) => !existingKeys.has(`${episode.number}`))
      .sort((a, b) => Number(b.number) - Number(a.number));
    const fallback = fallbackSource
      .map((episode) => ({
        id: crypto.randomUUID(),
        projectId: merged.id,
        projectTitle: merged.title,
        episodeNumber: episode.number,
        kind: "Lançamento",
        reason: `Capítulo ${episode.number} disponível`,
        unit: "Capítulo",
        updatedAt: new Date(Date.now() - fallbackSource.indexOf(episode) * 1000).toISOString(),
        image: merged.cover || "",
      }));
    if (fallback.length) {
      writeUpdates([...nextUpdates, ...fallback]);
    }
  }

  return res.json({ project: merged });
});

app.delete("/api/projects/:id", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  const projects = normalizeProjects(loadProjects());
  const next = projects.filter((project) => project.id !== String(id));
  if (next.length === projects.length) {
    return res.status(404).json({ error: "not_found" });
  }
  writeProjects(next);
  return res.json({ ok: true });
});

app.put("/api/projects/reorder", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { orderedIds } = req.body || {};
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "orderedIds_required" });
  }
  const projects = normalizeProjects(loadProjects());
  const orderMap = new Map(orderedIds.map((projectId, index) => [String(projectId), index]));
  const next = projects.map((project) =>
    orderMap.has(project.id) ? { ...project, order: orderMap.get(project.id) } : project,
  );
  writeProjects(next);
  return res.json({ ok: true });
});

app.post("/api/projects/:id/rebuild-updates", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const id = String(req.params.id || "");
  const projects = normalizeProjects(loadProjects());
  const project = projects.find((item) => item.id === id);
  if (!project) {
    return res.status(404).json({ error: "not_found" });
  }
  const updates = loadUpdates().filter((item) => item.projectId !== id);
  const episodeUpdates = collectEpisodeUpdates(null, project)
    .map((item) => ({
      id: crypto.randomUUID(),
      projectId: project.id,
      projectTitle: project.title,
      episodeNumber: item.episodeNumber,
      kind: item.kind,
      reason: item.reason,
      unit: item.unit,
      updatedAt: item.updatedAt || new Date().toISOString(),
      image: project.cover || "",
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const rebuilt = [...updates, ...episodeUpdates];
  writeUpdates(rebuilt);
  return res.json({ ok: true, updates: episodeUpdates.length });
});

app.get("/api/public/projects", (req, res) => {
  const projects = normalizeProjects(loadProjects())
    .sort((a, b) => a.order - b.order)
    .map((project) => ({
      id: project.id,
      title: project.title,
      titleOriginal: project.titleOriginal,
      titleEnglish: project.titleEnglish,
      synopsis: project.synopsis,
      description: project.description,
      type: project.type,
      status: project.status,
      year: project.year,
      studio: project.studio,
      episodes: project.episodes,
      tags: project.tags,
      genres: project.genres,
      cover: project.cover,
      banner: project.banner,
      season: project.season,
      schedule: project.schedule,
      rating: project.rating,
      country: project.country,
      source: project.source,
      producers: project.producers,
      score: project.score,
      startDate: project.startDate,
      endDate: project.endDate,
      relations: project.relations,
      staff: project.staff,
      animeStaff: project.animeStaff,
      trailerUrl: project.trailerUrl,
      episodeDownloads: project.episodeDownloads.map((episode) => ({
        ...episode,
        content: undefined,
        hasContent: typeof episode.content === "string" && episode.content.trim().length > 0,
      })),
      views: project.views,
      commentsCount: project.commentsCount,
    }));

  res.json({ projects });
});

app.get("/api/public/projects/:id", (req, res) => {
  const id = String(req.params.id || "");
  const projects = normalizeProjects(loadProjects());
  const project = projects.find((item) => item.id === id);
  if (!project) {
    return res.status(404).json({ error: "not_found" });
  }
  const sanitized = {
    ...project,
    episodeDownloads: project.episodeDownloads.map((episode) => ({
      ...episode,
      content: undefined,
      hasContent: typeof episode.content === "string" && episode.content.trim().length > 0,
    })),
  };
  return res.json({ project: sanitized });
});

app.get("/api/public/projects/:id/chapters/:number", (req, res) => {
  const id = String(req.params.id || "");
  const chapterNumber = Number(req.params.number);
  const volume = req.query.volume ? Number(req.query.volume) : null;
  if (!Number.isFinite(chapterNumber)) {
    return res.status(400).json({ error: "invalid_chapter" });
  }
  const projects = normalizeProjects(loadProjects());
  const project = projects.find((item) => item.id === id);
  if (!project) {
    return res.status(404).json({ error: "not_found" });
  }
  const chapter = project.episodeDownloads.find((episode) => {
    if (Number(episode.number) !== chapterNumber) {
      return false;
    }
    if (Number.isFinite(volume)) {
      return Number(episode.volume || 0) === volume;
    }
    return true;
  });
  if (!chapter) {
    return res.status(404).json({ error: "not_found" });
  }
  return res.json({
    chapter: {
      number: chapter.number,
      volume: chapter.volume,
      title: chapter.title,
      synopsis: chapter.synopsis,
      content: chapter.content || "",
      contentFormat: chapter.contentFormat || "markdown",
    },
  });
});

app.get("/api/public/updates", (req, res) => {
  const updates = loadUpdates()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);
  res.json({ updates });
});

app.get("/api/public/settings", (req, res) => {
  return res.json({ settings: loadSiteSettings() });
});

app.get("/api/public/tag-translations", (req, res) => {
  const translations = loadTagTranslations();
  res.json({ tags: translations.tags, genres: translations.genres });
});

app.get("/api/public/pages", (req, res) => {
  return res.json({ pages: loadPages() });
});

app.get("/api/settings", requireAuth, (req, res) => {
  const userId = req.session?.user?.id;
  if (!canManageSettings(userId)) {
    return res.status(403).json({ error: "Sem permissão para gerenciar configurações." });
  }
  return res.json({ settings: loadSiteSettings() });
});

app.put("/api/settings", requireAuth, (req, res) => {
  const userId = req.session?.user?.id;
  if (!canManageSettings(userId)) {
    return res.status(403).json({ error: "Sem permissão para gerenciar configurações." });
  }
  const settings = req.body?.settings;
  if (!settings || typeof settings !== "object") {
    return res.status(400).json({ error: "Payload inválido." });
  }
  const normalized = normalizeSiteSettings(settings);
  writeSiteSettings(normalized);
  return res.json({ settings: normalized });
});

app.get("/api/pages", requireAuth, (req, res) => {
  const userId = req.session?.user?.id;
  if (!canManagePages(userId)) {
    return res.status(403).json({ error: "Sem permissão para gerenciar páginas." });
  }
  return res.json({ pages: loadPages() });
});

app.put("/api/pages", requireAuth, (req, res) => {
  const userId = req.session?.user?.id;
  if (!canManagePages(userId)) {
    return res.status(403).json({ error: "Sem permissão para gerenciar páginas." });
  }
  const pages = req.body?.pages;
  if (!pages || typeof pages !== "object") {
    return res.status(400).json({ error: "Payload inválido." });
  }
  writePages(pages);
  return res.json({ pages });
});

app.post("/api/tag-translations/sync", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { tags, genres } = req.body || {};
  const current = loadTagTranslations();
  const nextTags = { ...current.tags };
  const nextGenres = { ...current.genres };

  const tagList = Array.isArray(tags) ? tags : [];
  tagList.forEach((tag) => {
    const key = String(tag || "").trim();
    if (key && typeof nextTags[key] !== "string") {
      nextTags[key] = "";
    }
  });

  const genreList = Array.isArray(genres) ? genres : [];
  genreList.forEach((genre) => {
    const key = String(genre || "").trim();
    if (key && typeof nextGenres[key] !== "string") {
      nextGenres[key] = "";
    }
  });

  const payload = { tags: nextTags, genres: nextGenres };
  writeTagTranslations(payload);
  return res.json(payload);
});

app.put("/api/tag-translations", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageSettings(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const tags = req.body?.tags;
  const genres = req.body?.genres;
  if (!tags || typeof tags !== "object") {
    return res.status(400).json({ error: "tags_required" });
  }
  const normalizedTags = Object.fromEntries(
    Object.entries(tags).map(([key, value]) => [String(key), String(value || "")]),
  );
  const normalizedGenres = genres && typeof genres === "object"
    ? Object.fromEntries(
        Object.entries(genres).map(([key, value]) => [String(key), String(value || "")]),
      )
    : {};
  const payload = { tags: normalizedTags, genres: normalizedGenres };
  writeTagTranslations(payload);
  return res.json(payload);
});

app.get("/api/anilist/:id", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "invalid_id" });
  }
  try {
    const query = `
      query ($id: Int) {
        Media(id: $id) {
          id
          title {
            romaji
            english
            native
          }
          description
          episodes
          genres
          format
          status
          countryOfOrigin
          season
          seasonYear
          startDate { year month day }
          endDate { year month day }
          source
          averageScore
          bannerImage
          coverImage { extraLarge large }
          studios {
            nodes { id name isAnimationStudio }
          }
          producers: studios(isMain: false) {
            nodes { id name }
          }
          tags {
            name
            rank
            isMediaSpoiler
          }
          trailer {
            id
            site
            thumbnail
          }
          relations {
            edges { relationType }
            nodes {
              id
              title { romaji }
              format
              status
              coverImage { large }
            }
          }
          staff(sort: RELEVANCE, perPage: 10) {
            edges { role }
            nodes { name { full } }
          }
        }
      }
    `;
    const response = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { id } }),
    });
    if (!response.ok) {
      return res.status(502).json({ error: "anilist_failed" });
    }
    const data = await response.json();
    return res.json(data);
  } catch {
    return res.status(502).json({ error: "anilist_failed" });
  }
});

app.post("/api/uploads/image", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const { dataUrl, filename, folder } = req.body || {};
  if (!dataUrl || typeof dataUrl !== "string") {
    return res.status(400).json({ error: "data_url_required" });
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: "invalid_data_url" });
  }

  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = mime.split("/")[1] || "png";
  const safeName = String(filename || "upload")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const fileName = `${safeName || "imagem"}-${Date.now()}.${ext}`;
  const uploadsDir = path.join(__dirname, "..", "public", "uploads");
  const safeFolder = typeof folder === "string" && folder.trim()
    ? folder
        .trim()
        .replace(/[^a-z0-9/_-]+/gi, "-")
        .replace(/\/{2,}/g, "/")
        .replace(/^\//, "")
    : "";
  const targetDir = safeFolder ? path.join(uploadsDir, safeFolder) : uploadsDir;
  fs.mkdirSync(targetDir, { recursive: true });
  const filePath = path.join(targetDir, fileName);
  fs.writeFileSync(filePath, buffer);

  return res.json({
    url: `${PRIMARY_APP_ORIGIN}/uploads/${safeFolder ? `${safeFolder}/` : ""}${fileName}`,
    fileName,
  });
});

app.get("/api/uploads/list", requireAuth, (req, res) => {
  const uploadsDir = path.join(__dirname, "..", "public", "uploads");
  const folder = typeof req.query.folder === "string" ? req.query.folder.trim() : "";
  const safeFolder = folder
    ? folder
        .replace(/[^a-z0-9/_-]+/gi, "-")
        .replace(/\/{2,}/g, "/")
        .replace(/^\//, "")
    : "";
  const targetDir = safeFolder ? path.join(uploadsDir, safeFolder) : uploadsDir;
  try {
    const items = fs.existsSync(targetDir) ? fs.readdirSync(targetDir) : [];
    const files = items
      .filter((item) => /\.(png|jpe?g|gif|webp|svg)$/i.test(item))
      .map((item) => ({
        name: item,
        url: `${PRIMARY_APP_ORIGIN}/uploads/${safeFolder ? `${safeFolder}/` : ""}${item}`,
      }));
    return res.json({ files });
  } catch {
    return res.json({ files: [] });
  }
});

app.post("/api/users", requireOwner, (req, res) => {
  const { id, name, phrase, bio, avatarUrl, coverImageUrl, socials, status, permissions, roles } = req.body || {};
  if (!id || !name) {
    return res.status(400).json({ error: "id_and_name_required" });
  }

  let users = normalizeUsers(loadUsers());
  if (users.some((user) => user.id === String(id))) {
    return res.status(409).json({ error: "user_exists" });
  }

  const newUser = {
    id: String(id),
    name,
    phrase: phrase || "",
    bio: bio || "",
    avatarUrl: avatarUrl || null,
    coverImageUrl: coverImageUrl || null,
    socials: Array.isArray(socials) ? socials.filter(Boolean) : [],
    status: status === "retired" ? "retired" : "active",
    permissions: Array.isArray(permissions) ? permissions : [],
    roles: Array.isArray(roles) ? roles.filter(Boolean) : [],
    order: users.length,
  };

  users.push(newUser);
  users = normalizeUsers(users).map((user) =>
    isOwner(user.id)
      ? { ...user, status: "active", permissions: ["*"] }
      : user,
  );
  writeUsers(users);
  syncAllowedUsers(users);
  return res.status(201).json({ user: newUser });
});

app.put("/api/users/reorder", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!isAdminUser(sessionUser)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { orderedIds, retiredIds } = req.body || {};
  if (!Array.isArray(orderedIds) && !Array.isArray(retiredIds)) {
    return res.status(400).json({ error: "orderedIds_required" });
  }

  let users = normalizeUsers(loadUsers());
  const activeUsers = users.filter((user) => user.status === "active").sort((a, b) => a.order - b.order);
  const retiredUsers = users.filter((user) => user.status === "retired").sort((a, b) => a.order - b.order);

  const activeOrder = Array.isArray(orderedIds) ? orderedIds.map(String) : activeUsers.map((user) => user.id);
  const retiredOrder = Array.isArray(retiredIds) ? retiredIds.map(String) : retiredUsers.map((user) => user.id);

  const activeOrderMap = new Map(activeOrder.map((id, index) => [String(id), index]));
  const retiredOrderMap = new Map(retiredOrder.map((id, index) => [String(id), index]));

  users = users.map((user) => {
    if (user.status === "active" && activeOrderMap.has(user.id)) {
      return { ...user, order: activeOrderMap.get(user.id) };
    }
    if (user.status === "retired" && retiredOrderMap.has(user.id)) {
      return { ...user, order: activeOrder.length + retiredOrderMap.get(user.id) };
    }
    return user;
  });

  users = normalizeUsers(users).map((user) =>
    isOwner(user.id)
      ? { ...user, status: "active", permissions: ["*"] }
      : user,
  );
  users.sort((a, b) => a.order - b.order);
  writeUsers(users);
  syncAllowedUsers(users);
  return res.json({ ok: true });
});

app.put("/api/users/:id", (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const targetId = String(req.params.id);
  let users = normalizeUsers(loadUsers());
  const index = users.findIndex((user) => user.id === targetId);
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }

  const sessionUser = req.session.user;
  const update = req.body || {};
  const existing = users[index];
  const isOwnerRequest = isOwner(sessionUser.id);
  const canManageBadges = isAdminUser(sessionUser);

  if (!isOwnerRequest && !canManageBadges) {
    return res.status(403).json({ error: "forbidden" });
  }

  if (!isOwnerRequest && canManageBadges) {
    const onlyRoles =
      Object.keys(update).length === 1 && Array.isArray(update.roles);
    if (!onlyRoles) {
      return res.status(403).json({ error: "roles_only" });
    }
  }

  const updated = {
    ...existing,
    name: update.name ?? existing.name,
    phrase: update.phrase ?? existing.phrase,
    bio: update.bio ?? existing.bio,
    avatarUrl: update.avatarUrl ?? existing.avatarUrl,
    coverImageUrl: update.coverImageUrl ?? existing.coverImageUrl,
    socials: Array.isArray(update.socials) ? update.socials : existing.socials,
    status: update.status === "retired" ? "retired" : "active",
    permissions: Array.isArray(update.permissions) ? update.permissions : existing.permissions,
    roles: Array.isArray(update.roles) ? update.roles : existing.roles,
  };

  users[index] = updated;
  users = normalizeUsers(users).map((user) =>
    isOwner(user.id)
      ? { ...user, status: "active", permissions: ["*"] }
      : user,
  );
  writeUsers(users);
  syncAllowedUsers(users);
  return res.json({ user: applyOwnerRole(updated) });
});

app.put("/api/users/self", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  let users = normalizeUsers(loadUsers());
  const index = users.findIndex((user) => user.id === String(sessionUser.id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }

  const update = req.body || {};
  const existing = users[index];
  const updated = {
    ...existing,
    name: update.name ?? existing.name,
    phrase: update.phrase ?? existing.phrase,
    bio: update.bio ?? existing.bio,
    avatarUrl: update.avatarUrl ?? existing.avatarUrl,
    coverImageUrl: update.coverImageUrl ?? existing.coverImageUrl,
    socials: Array.isArray(update.socials) ? update.socials : existing.socials,
  };

  users[index] = updated;
  users = normalizeUsers(users).map((user) =>
    isOwner(user.id)
      ? { ...user, status: "active", permissions: ["*"] }
      : user,
  );
  writeUsers(users);
  syncAllowedUsers(users);
  return res.json({ user: updated });
});

app.post("/api/logout", (req, res) => {
  req.session?.destroy(() => undefined);
  res.clearCookie("rainbow.sid");
  res.json({ ok: true });
});

app.listen(Number(PORT), () => {
  console.log(`Auth server running on http://127.0.0.1:${PORT}`);
});
