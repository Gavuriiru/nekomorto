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

const ownerIdsFilePath = path.join(__dirname, "data", "owner-ids.json");
const auditLogFilePath = path.join(__dirname, "data", "audit-log.json");
const loadOwnerIds = () => {
  try {
    if (!fs.existsSync(ownerIdsFilePath)) {
      return [...OWNER_IDS];
    }
    const raw = fs.readFileSync(ownerIdsFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    const fileIds = Array.isArray(parsed) ? parsed : [];
    return Array.from(new Set([...OWNER_IDS, ...fileIds.map((id) => String(id))]));
  } catch {
    return [...OWNER_IDS];
  }
};
const writeOwnerIds = (ids) => {
  fs.mkdirSync(path.dirname(ownerIdsFilePath), { recursive: true });
  const unique = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
  fs.writeFileSync(ownerIdsFilePath, JSON.stringify(unique, null, 2));
};
const isOwner = (id) => loadOwnerIds().includes(String(id));
const getPrimaryOwnerId = () => loadOwnerIds()[0] || null;
const isPrimaryOwner = (id) => {
  const primary = getPrimaryOwnerId();
  return Boolean(primary && String(id) === String(primary));
};

const loadAuditLog = () => {
  try {
    if (!fs.existsSync(auditLogFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(auditLogFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAuditLog = (entries) => {
  fs.mkdirSync(path.dirname(auditLogFilePath), { recursive: true });
  fs.writeFileSync(auditLogFilePath, JSON.stringify(entries, null, 2));
};

const appendAuditLog = (req, action, resource, meta = {}) => {
  try {
    const now = new Date();
    const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    const sessionUser = req.session?.user || null;
    const resourceId =
      meta?.resourceId ||
      meta?.id ||
      meta?.slug ||
      meta?.projectId ||
      meta?.userId ||
      null;
    const entry = {
      id: crypto.randomUUID(),
      ts: now.toISOString(),
      actorId: sessionUser?.id || "anonymous",
      actorName: sessionUser?.name || "anonymous",
      ip: String(ip || ""),
      action,
      resource,
      resourceId,
      meta,
    };
    const existing = loadAuditLog().filter((item) => {
      const ts = new Date(item?.ts || 0).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
    existing.push(entry);
    writeAuditLog(existing);
  } catch {
    // ignore audit errors
  }
};

const DISCORD_API = "https://discord.com/api/v10";
const ANILIST_API = "https://graphql.anilist.co";
const SCOPES = ["identify", "email"];

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI = "http://127.0.0.1:8080/login",
  APP_ORIGIN = "http://127.0.0.1:5173",
  ADMIN_ORIGINS = "",
  SESSION_SECRET,
  PORT = 8080,
  OWNER_IDS: OWNER_IDS_ENV = "",
  BOOTSTRAP_TOKEN,
} = process.env;

const isProduction = process.env.NODE_ENV === "production";
const OWNER_IDS = (OWNER_IDS_ENV || (isProduction ? "" : "380305493391966208"))
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const APP_ORIGINS = APP_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const EXTRA_ORIGINS = ADMIN_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = Array.from(new Set([...APP_ORIGINS, ...EXTRA_ORIGINS]));
const PRIMARY_APP_ORIGIN = APP_ORIGINS[0] || "http://127.0.0.1:5173";

const clientRootDir = path.join(__dirname, "..");
const clientDistDir = path.join(clientRootDir, "dist");
const clientIndexPath = fs.existsSync(path.join(clientDistDir, "index.html"))
  ? path.join(clientDistDir, "index.html")
  : path.join(clientRootDir, "index.html");
let cachedIndexHtml = null;

const getIndexHtml = () => {
  if (!cachedIndexHtml) {
    cachedIndexHtml = fs.readFileSync(clientIndexPath, "utf-8");
  }
  return cachedIndexHtml;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toAbsoluteUrl = (value) => {
  const input = String(value || "").trim();
  if (!input) {
    return "";
  }
  if (input.startsWith("http://") || input.startsWith("https://") || input.startsWith("data:")) {
    return input;
  }
  try {
    return new URL(input, PRIMARY_APP_ORIGIN).toString();
  } catch {
    return input;
  }
};

const upsertMeta = (html, attr, key, content) => {
  const escaped = escapeHtml(content);
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`;
  const regex = new RegExp(`<meta[^>]*${attr}="${key}"[^>]*>`, "i");
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace("</head>", `  ${tag}\n</head>`);
};

const upsertLink = (html, rel, href) => {
  const escaped = escapeHtml(href);
  const tag = `<link rel="${rel}" href="${escaped}" />`;
  const regex = new RegExp(`<link[^>]*rel="${rel}"[^>]*>`, "i");
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace("</head>", `  ${tag}\n</head>`);
};

const replaceTitle = (html, title) =>
  html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

const renderMetaHtml = ({
  title,
  description,
  image,
  url,
  type = "website",
  siteName,
  favicon,
}) => {
  let html = getIndexHtml();
  const safeUrl = url || PRIMARY_APP_ORIGIN;
  const safeImage = image ? toAbsoluteUrl(image) : "";
  html = replaceTitle(html, title);
  html = upsertMeta(html, "name", "description", description);
  html = upsertMeta(html, "property", "og:title", title);
  html = upsertMeta(html, "property", "og:description", description);
  html = upsertMeta(html, "property", "og:type", type);
  html = upsertMeta(html, "property", "og:url", safeUrl);
  html = upsertMeta(html, "property", "og:site_name", siteName);
  html = upsertMeta(html, "property", "og:locale", "pt_BR");
  if (safeImage) {
    html = upsertMeta(html, "property", "og:image", safeImage);
    html = upsertMeta(html, "name", "twitter:image", safeImage);
  }
  html = upsertMeta(html, "name", "twitter:title", title);
  html = upsertMeta(html, "name", "twitter:description", description);
  html = upsertMeta(html, "name", "twitter:card", safeImage ? "summary_large_image" : "summary");
  html = upsertLink(html, "canonical", safeUrl);
  if (favicon) {
    html = upsertLink(html, "icon", toAbsoluteUrl(favicon));
  }
  return html;
};

const stripHtml = (value) => String(value || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

const buildSiteMetaWithSettings = (settings) => ({
  title: settings.site?.name || "Nekomata",
  description: settings.site?.description || "",
  image: settings.site?.defaultShareImage || "",
  url: PRIMARY_APP_ORIGIN,
  type: "website",
  siteName: settings.site?.name || "Nekomata",
  favicon: settings.site?.faviconUrl || "",
});

const buildSiteMeta = () => buildSiteMetaWithSettings(loadSiteSettings());

const getPageTitleFromPath = (value) => {
  const pathValue = String(value || "/");
  const rules = [
    [/^\/$/, "Início"],
    [/^\/postagem\/.+/, "Postagem"],
    [/^\/equipe\/?$/, "Equipe"],
    [/^\/sobre\/?$/, "Sobre"],
    [/^\/doacoes\/?$/, "Doações"],
    [/^\/faq\/?$/, "FAQ"],
    [/^\/projetos\/?$/, "Projetos"],
    [/^\/projeto\/.+\/leitura\/.+/, "Leitura"],
    [/^\/projeto\/.+/, "Projeto"],
    [/^\/projetos\/.+\/leitura\/.+/, "Leitura"],
    [/^\/projetos\/.+/, "Projeto"],
    [/^\/recrutamento\/?$/, "Recrutamento"],
    [/^\/login\/?$/, "Login"],
    [/^\/dashboard\/usuarios\/?$/, "Usuários"],
    [/^\/dashboard\/posts\/?$/, "Posts"],
    [/^\/dashboard\/projetos\/?$/, "Projetos"],
    [/^\/dashboard\/comentarios\/?$/, "Comentários"],
    [/^\/dashboard\/paginas\/?$/, "Páginas"],
    [/^\/dashboard\/configuracoes\/?$/, "Configurações"],
    [/^\/dashboard\/?$/, "Dashboard"],
  ];
  const match = rules.find(([regex]) => regex.test(pathValue));
  return match ? match[1] : "";
};

const buildProjectMeta = (project) => {
  const settings = loadSiteSettings();
  const siteName = settings.site?.name || "Nekomata";
  const title = project?.title ? `${project.title} | ${siteName}` : siteName;
  const description =
    stripHtml(project?.synopsis || project?.description || "") || settings.site?.description || "";
  const image = project?.banner || project?.cover || settings.site?.defaultShareImage || "";
  return {
    title,
    description,
    image,
    url: `${PRIMARY_APP_ORIGIN}/projeto/${project?.id || ""}`,
    type: "article",
    siteName,
    favicon: settings.site?.faviconUrl || "",
  };
};

const buildPostMeta = (post) => {
  const settings = loadSiteSettings();
  const siteName = settings.site?.name || "Nekomata";
  const title = post?.title ? `${post.title} | ${siteName}` : siteName;
  const description =
    stripHtml(post?.seoDescription || post?.excerpt || post?.content || "") ||
    settings.site?.description ||
    "";
  const image = post?.coverImageUrl || settings.site?.defaultShareImage || "";
  return {
    title,
    description,
    image,
    url: `${PRIMARY_APP_ORIGIN}/postagem/${post?.slug || ""}`,
    type: "article",
    siteName,
    favicon: settings.site?.faviconUrl || "",
  };
};
const MAX_SVG_SIZE_BYTES = 256 * 1024;
const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_DIMENSION = 8192;
const MAX_UPLOAD_IMAGE_PIXELS = 33_554_432;
const ALLOWED_UPLOAD_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);
const UPLOAD_EXTENSION_TO_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};
const UPLOAD_MIME_TO_EXTENSION = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const DEFAULT_AVATAR_DISPLAY = {
  x: 0,
  y: 0,
  zoom: 1,
  rotation: 0,
};
const sanitizeUploadFolder = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value
    .trim()
    .replace(/[^a-z0-9/_-]+/gi, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^\//, "");
};
const sanitizeUploadBaseName = (value) =>
  String(value || "upload")
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const sanitizeUploadSlot = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const normalizeAvatarDisplay = (value) => {
  const source = value && typeof value === "object" ? value : {};
  const x = Number(source.x);
  const y = Number(source.y);
  const zoom = Number(source.zoom);
  const rotation = Number(source.rotation);
  return {
    x: Number.isFinite(x) ? x : DEFAULT_AVATAR_DISPLAY.x,
    y: Number.isFinite(y) ? y : DEFAULT_AVATAR_DISPLAY.y,
    zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : DEFAULT_AVATAR_DISPLAY.zoom,
    rotation: Number.isFinite(rotation) ? rotation : DEFAULT_AVATAR_DISPLAY.rotation,
  };
};
const isSupportedUploadImageMime = (value) =>
  ALLOWED_UPLOAD_IMAGE_MIMES.has(String(value || "").toLowerCase());
const getUploadExtFromMime = (value) =>
  UPLOAD_MIME_TO_EXTENSION[String(value || "").toLowerCase()] || "png";
const getUploadMimeFromExtension = (value) =>
  UPLOAD_EXTENSION_TO_MIME[String(value || "").toLowerCase()] || "";
const normalizeUploadMime = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized;
};
const readUInt24LE = (buffer, offset) =>
  buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
const detectUploadImageMimeFromBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return "";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6) {
    const header = buffer.toString("ascii", 0, 6);
    if (header === "GIF87a" || header === "GIF89a") {
      return "image/gif";
    }
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  const snippet = buffer.toString("utf-8", 0, Math.min(buffer.length, 4096)).replace(/^\uFEFF/, "");
  if (/<svg[\s>]/i.test(snippet)) {
    return "image/svg+xml";
  }
  return "";
};
const getPngDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) {
    return null;
  }
  if (
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47 ||
    buffer[4] !== 0x0d ||
    buffer[5] !== 0x0a ||
    buffer[6] !== 0x1a ||
    buffer[7] !== 0x0a
  ) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};
const getGifDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10) {
    return null;
  }
  const header = buffer.toString("ascii", 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") {
    return null;
  }
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
};
const getJpegDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (offset + 4 > buffer.length) {
      break;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      break;
    }
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 9 >= buffer.length) {
        break;
      }
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
};
const getWebpDimensions = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > buffer.length) {
      break;
    }
    if (chunkType === "VP8X" && chunkSize >= 10) {
      return {
        width: 1 + readUInt24LE(buffer, dataOffset + 4),
        height: 1 + readUInt24LE(buffer, dataOffset + 7),
      };
    }
    if (chunkType === "VP8L" && chunkSize >= 5) {
      if (buffer[dataOffset] !== 0x2f) {
        return null;
      }
      const b0 = buffer[dataOffset + 1];
      const b1 = buffer[dataOffset + 2];
      const b2 = buffer[dataOffset + 3];
      const b3 = buffer[dataOffset + 4];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
    if (chunkType === "VP8 " && chunkSize >= 10) {
      if (
        buffer[dataOffset + 3] !== 0x9d ||
        buffer[dataOffset + 4] !== 0x01 ||
        buffer[dataOffset + 5] !== 0x2a
      ) {
        return null;
      }
      return {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  return null;
};
const getUploadImageDimensions = (buffer, mime) => {
  const normalizedMime = normalizeUploadMime(mime);
  if (normalizedMime === "image/png") {
    return getPngDimensions(buffer);
  }
  if (normalizedMime === "image/jpeg") {
    return getJpegDimensions(buffer);
  }
  if (normalizedMime === "image/gif") {
    return getGifDimensions(buffer);
  }
  if (normalizedMime === "image/webp") {
    return getWebpDimensions(buffer);
  }
  return null;
};
const validateUploadImageBuffer = (buffer, requestedMime, options = {}) => {
  const strictRequestedMime = options.strictRequestedMime === true;
  const normalizedRequested = normalizeUploadMime(requestedMime);
  const detectedMime = detectUploadImageMimeFromBuffer(buffer);
  if (strictRequestedMime && detectedMime && normalizedRequested && detectedMime !== normalizedRequested) {
    return { valid: false, error: "mime_mismatch" };
  }
  const mime = detectedMime || normalizedRequested;
  if (!isSupportedUploadImageMime(mime)) {
    return { valid: false, error: "unsupported_image_type" };
  }
  if (mime === "image/svg+xml") {
    return { valid: true, mime, dimensions: null };
  }
  const dimensions = getUploadImageDimensions(buffer, mime);
  if (!dimensions) {
    return { valid: false, error: "invalid_image_data" };
  }
  const width = Number(dimensions.width);
  const height = Number(dimensions.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { valid: false, error: "invalid_image_dimensions" };
  }
  if (width > MAX_UPLOAD_IMAGE_DIMENSION || height > MAX_UPLOAD_IMAGE_DIMENSION) {
    return { valid: false, error: "image_dimensions_too_large" };
  }
  if (width * height > MAX_UPLOAD_IMAGE_PIXELS) {
    return { valid: false, error: "image_pixel_count_too_large" };
  }
  return {
    valid: true,
    mime,
    dimensions: {
      width,
      height,
    },
  };
};
const resolveRequestOrigin = (req) => {
  const originHeader = String(req.headers.origin || "");
  if (originHeader) {
    return originHeader;
  }
  const refererHeader = String(req.headers.referer || "");
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      return "";
    }
  }
  if (req.headers.host) {
    const proto = req.protocol || "http";
    return `${proto}://${req.headers.host}`;
  }
  return "";
};
const resolveDiscordRedirectUri = (req) => {
  if (DISCORD_REDIRECT_URI && DISCORD_REDIRECT_URI !== "auto") {
    return DISCORD_REDIRECT_URI;
  }
  const candidate = resolveRequestOrigin(req);
  if (candidate && isAllowedOrigin(candidate)) {
    return `${candidate}/login`;
  }
  return `${PRIMARY_APP_ORIGIN}/login`;
};
const isAllowedOrigin = (origin) => {
  if (!origin) {
    return !isProduction;
  }
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }
  if (isProduction) {
    return false;
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
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, or SESSION_SECRET in env.");
  }
}
if (isProduction && !OWNER_IDS.length && !BOOTSTRAP_TOKEN) {
  throw new Error("Missing OWNER_IDS or BOOTSTRAP_TOKEN in env.");
}

app.use((req, res, next) => {
  if (!isProduction) {
    return next();
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );
  return next();
});

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

const requireSameOrigin = (req, res, next) => {
  if (!isProduction) {
    return next();
  }
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }
  const originHeader = String(req.headers.origin || "");
  const refererHeader = String(req.headers.referer || "");
  let origin = originHeader;
  if (!origin && refererHeader) {
    try {
      origin = new URL(refererHeader).origin;
    } catch {
      origin = "";
    }
  }
  if (!origin || !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: "csrf" });
  }
  return next();
};
app.use("/api", requireSameOrigin);

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
      secure: "auto",
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
    const items = Array.isArray(parsed) ? parsed : [];
    const normalized = normalizeUsers(items);
    if (JSON.stringify(items) !== JSON.stringify(normalized)) {
      writeUsers(normalized);
    }
    return normalized;
  } catch {
    return [];
  }
};

const writeUsers = (users) => {
  const filePath = path.join(__dirname, "data", "users.json");
  fs.writeFileSync(filePath, JSON.stringify(normalizeUploadsDeep(users), null, 2));
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
    const items = Array.isArray(parsed) ? parsed : [];
    const pruned = pruneExpiredDeleted(items);
    if (pruned.length !== items.length) {
      writePosts(pruned);
    }
    const normalized = normalizePosts(pruned);
    if (JSON.stringify(pruned) !== JSON.stringify(normalized)) {
      writePosts(normalized);
    }
    return normalized;
  } catch {
    return [];
  }
};

const writePosts = (posts) => {
  const filePath = path.join(__dirname, "data", "posts.json");
  fs.writeFileSync(filePath, JSON.stringify(normalizeUploadsDeep(posts), null, 2));
};

const updateLexicalPollVotes = (
  content,
  { question, optionUid, voterId, checked },
) => {
  if (!content || typeof content !== "string") {
    return { updated: false };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { updated: false };
  }
  if (!parsed || typeof parsed !== "object") {
    return { updated: false };
  }
  const safeQuestion = typeof question === "string" ? question : null;
  const safeOptionUid = String(optionUid || "").trim();
  const safeVoterId = String(voterId || "").trim();
  if (!safeOptionUid || !safeVoterId) {
    return { updated: false };
  }
  let updated = false;

  const updateNode = (node) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (node.type === "poll" && Array.isArray(node.options)) {
      if (safeQuestion && node.question !== safeQuestion) {
        // continue searching
      } else {
        const option = node.options.find(
          (entry) => entry && entry.uid === safeOptionUid,
        );
        if (option) {
          const votes = Array.isArray(option.votes)
            ? option.votes.filter((vote) => typeof vote === "string")
            : [];
          const hasVote = votes.includes(safeVoterId);
          const shouldCheck =
            typeof checked === "boolean" ? checked : !hasVote;
          if (shouldCheck && !hasVote) {
            votes.push(safeVoterId);
            option.votes = votes;
            updated = true;
          } else if (!shouldCheck && hasVote) {
            option.votes = votes.filter((vote) => vote !== safeVoterId);
            updated = true;
          }
          return;
        }
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(updateNode);
    }
  };

  updateNode(parsed.root || parsed);

  if (!updated) {
    return { updated: false };
  }

  return { updated: true, content: JSON.stringify(parsed) };
};

const projectsFilePath = path.join(__dirname, "data", "projects.json");
const updatesFilePath = path.join(__dirname, "data", "updates.json");
const uploadsFilePath = path.join(__dirname, "data", "uploads.json");
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
    titleSeparator: " | ",
  },
  theme: {
    accent: "#9667e0",
  },
  navbar: {
    links: [
      { label: "Início", href: "/", icon: "home" },
      { label: "Projetos", href: "/projetos", icon: "folder-kanban" },
      { label: "Equipe", href: "/equipe", icon: "users" },
      { label: "Recrutamento", href: "/recrutamento", icon: "user-plus" },
      { label: "Sobre", href: "/sobre", icon: "info" },
    ],
  },
  community: {
    discordUrl: "https://discord.com/invite/BAHKhdX2ju",
  },
  branding: {
    assets: {
      symbolUrl: "",
      wordmarkUrl: "",
    },
    overrides: {
      navbarSymbolUrl: "",
      footerSymbolUrl: "",
      navbarWordmarkUrl: "",
      footerWordmarkUrl: "",
    },
    display: {
      navbar: "symbol-text",
      footer: "symbol-text",
    },
    wordmarkUrl: "",
    wordmarkUrlNavbar: "",
    wordmarkUrlFooter: "",
    wordmarkPlacement: "both",
    wordmarkEnabled: false,
  },
  downloads: {
    sources: [
      { id: "google-drive", label: "Google Drive", color: "#34A853", icon: "google-drive", tintIcon: true },
      { id: "mega", label: "MEGA", color: "#D9272E", icon: "mega", tintIcon: true },
      { id: "torrent", label: "Torrent", color: "#7C3AED", icon: "torrent", tintIcon: true },
      { id: "mediafire", label: "Mediafire", color: "#2563EB", icon: "mediafire", tintIcon: true },
      { id: "telegram", label: "Telegram", color: "#0EA5E9", icon: "telegram", tintIcon: true },
      { id: "outro", label: "Outro", color: "#64748B", icon: "link", tintIcon: true },
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
          { label: "Recrutamento", href: "/recrutamento" },
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

const hasMojibake = (value) => /Ã|Â|�/.test(String(value || ""));
const fixMojibakeText = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  if (!hasMojibake(value)) {
    return value;
  }
  try {
    return Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
};
const fixMojibakeDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => fixMojibakeDeep(item));
  }
  if (value && typeof value === "object") {
    const next = { ...value };
    Object.keys(next).forEach((key) => {
      next[key] = fixMojibakeDeep(next[key]);
    });
    return next;
  }
  return fixMojibakeText(value);
};

const normalizeUploadsPath = (value) => {
  if (!value || typeof value !== "string") {
    return value;
  }
  if (value.startsWith("/uploads/")) {
    return value;
  }
  try {
    const parsed = new URL(value, PRIMARY_APP_ORIGIN);
    if (parsed.pathname && parsed.pathname.startsWith("/uploads/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // ignore
  }
  return value;
};

const normalizeUploadsInText = (value) => {
  if (!value || typeof value !== "string") {
    return value;
  }
  if (!value.includes("/uploads/")) {
    return value;
  }
  const urlPattern = /https?:\/\/[^\s"'()<>]+/gi;
  return value.replace(urlPattern, (match) => normalizeUploadsPath(match));
};

const normalizeUploadsDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeUploadsDeep(item));
  }
  if (value && typeof value === "object") {
    const next = { ...value };
    Object.keys(next).forEach((key) => {
      next[key] = normalizeUploadsDeep(next[key]);
    });
    return next;
  }
  return normalizeUploadsInText(value);
};

const normalizeSiteSettings = (payload) => {
  const merged = fixMojibakeDeep(mergeSettings(defaultSiteSettings, payload || {}));
  const resolveNavbarIcon = (label, href, icon) => {
    const iconValue = String(icon || "").trim().toLowerCase();
    if (iconValue) {
      return iconValue;
    }
    const normalizedLabel = String(label || "").trim().toLowerCase();
    const normalizedHref = String(href || "").trim();
    const matchByHref = defaultSiteSettings.navbar.links.find((item) => String(item.href || "").trim() === normalizedHref);
    if (matchByHref?.icon) {
      return String(matchByHref.icon).trim().toLowerCase();
    }
    const matchByLabel = defaultSiteSettings.navbar.links.find(
      (item) => String(item.label || "").trim().toLowerCase() === normalizedLabel,
    );
    if (matchByLabel?.icon) {
      return String(matchByLabel.icon).trim().toLowerCase();
    }
    return "link";
  };
  const navbarLinks = Array.isArray(merged?.navbar?.links)
    ? merged.navbar.links
        .map((link) => ({
          label: String(link?.label || "").trim(),
          href: String(link?.href || "").trim(),
          icon: resolveNavbarIcon(link?.label, link?.href, link?.icon),
        }))
        .filter((link) => link.label && link.href)
    : [];
  const normalizedNavbarLinks =
    Array.isArray(merged?.navbar?.links)
      ? navbarLinks
      : defaultSiteSettings.navbar.links.map((link) => ({ ...link }));
  merged.navbar = {
    links: normalizedNavbarLinks,
  };
  const allowedPlacements = new Set(["navbar", "footer", "both"]);
  const allowedNavbarModes = new Set(["wordmark", "symbol-text", "symbol", "text"]);
  const allowedFooterModes = new Set(["wordmark", "symbol-text", "text"]);
  const legacyPlacement = String(merged?.branding?.wordmarkPlacement || "both");
  const normalizedLegacyPlacement = allowedPlacements.has(legacyPlacement) ? legacyPlacement : "both";
  const legacyWordmarkEnabled = Boolean(merged?.branding?.wordmarkEnabled);
  const legacyWordmarkUrl = String(merged?.branding?.wordmarkUrl || "").trim();
  const legacyWordmarkUrlNavbar = String(merged?.branding?.wordmarkUrlNavbar || "").trim();
  const legacyWordmarkUrlFooter = String(merged?.branding?.wordmarkUrlFooter || "").trim();
  const legacySiteSymbol = String(merged?.site?.logoUrl || "").trim();
  const legacyFooterSymbol = String(merged?.footer?.brandLogoUrl || "").trim();

  const payloadBranding =
    payload?.branding && typeof payload.branding === "object"
      ? payload.branding
      : null;
  const hasAnyNewBrandingInput = Boolean(
    payloadBranding &&
      (typeof payloadBranding.assets === "object" ||
        typeof payloadBranding.overrides === "object" ||
        typeof payloadBranding.display === "object"),
  );

  const rawBrandAssets =
    merged?.branding?.assets && typeof merged.branding.assets === "object"
      ? merged.branding.assets
      : {};
  const rawBrandOverrides =
    merged?.branding?.overrides && typeof merged.branding.overrides === "object"
      ? merged.branding.overrides
      : {};
  const rawBrandDisplay =
    merged?.branding?.display && typeof merged.branding.display === "object"
      ? merged.branding.display
      : {};

  const symbolAssetUrl = String(
    rawBrandAssets.symbolUrl || (!hasAnyNewBrandingInput ? legacySiteSymbol : "") || "",
  ).trim();
  const wordmarkAssetUrl = String(
    rawBrandAssets.wordmarkUrl ||
      (!hasAnyNewBrandingInput
        ? legacyWordmarkUrl || legacyWordmarkUrlNavbar || legacyWordmarkUrlFooter
        : "") ||
      "",
  ).trim();

  const navbarSymbolOverride = String(rawBrandOverrides.navbarSymbolUrl || "").trim();
  const footerSymbolOverride = String(
    rawBrandOverrides.footerSymbolUrl || (!hasAnyNewBrandingInput ? legacyFooterSymbol : "") || "",
  ).trim();
  const navbarWordmarkOverride = String(
    rawBrandOverrides.navbarWordmarkUrl || (!hasAnyNewBrandingInput ? legacyWordmarkUrlNavbar : "") || "",
  ).trim();
  const footerWordmarkOverride = String(
    rawBrandOverrides.footerWordmarkUrl || (!hasAnyNewBrandingInput ? legacyWordmarkUrlFooter : "") || "",
  ).trim();

  const legacyNavbarMode =
    legacyWordmarkEnabled &&
    (normalizedLegacyPlacement === "navbar" || normalizedLegacyPlacement === "both")
      ? "wordmark"
      : "symbol-text";
  const legacyFooterMode =
    legacyWordmarkEnabled &&
    (normalizedLegacyPlacement === "footer" || normalizedLegacyPlacement === "both")
      ? "wordmark"
      : "symbol-text";

  const navbarModeCandidate = String(rawBrandDisplay.navbar || "").trim();
  const footerModeCandidate = String(rawBrandDisplay.footer || "").trim();
  const navbarMode = allowedNavbarModes.has(navbarModeCandidate)
    ? navbarModeCandidate
    : legacyNavbarMode;
  const footerMode = allowedFooterModes.has(footerModeCandidate)
    ? footerModeCandidate
    : legacyFooterMode;

  const resolvedNavbarWordmark = navbarWordmarkOverride || wordmarkAssetUrl;
  const resolvedFooterWordmark = footerWordmarkOverride || wordmarkAssetUrl;
  const resolvedFooterSymbol = footerSymbolOverride || symbolAssetUrl;

  const usesWordmarkNavbar = navbarMode === "wordmark";
  const usesWordmarkFooter = footerMode === "wordmark";
  const compatPlacement = usesWordmarkNavbar && usesWordmarkFooter
    ? "both"
    : usesWordmarkNavbar
      ? "navbar"
      : usesWordmarkFooter
        ? "footer"
        : normalizedLegacyPlacement;
  const compatWordmarkEnabled = usesWordmarkNavbar || usesWordmarkFooter;

  merged.branding = {
    ...(merged.branding || {}),
    assets: {
      symbolUrl: symbolAssetUrl,
      wordmarkUrl: wordmarkAssetUrl,
    },
    overrides: {
      navbarSymbolUrl: navbarSymbolOverride,
      footerSymbolUrl: footerSymbolOverride,
      navbarWordmarkUrl: navbarWordmarkOverride,
      footerWordmarkUrl: footerWordmarkOverride,
    },
    display: {
      navbar: navbarMode,
      footer: footerMode,
    },
    wordmarkUrl: wordmarkAssetUrl,
    wordmarkUrlNavbar: resolvedNavbarWordmark,
    wordmarkUrlFooter: resolvedFooterWordmark,
    wordmarkPlacement: compatPlacement,
    wordmarkEnabled: compatWordmarkEnabled,
  };
  const normalizedSiteName =
    String(merged?.site?.name || defaultSiteSettings.site.name || "Nekomata").trim() ||
    String(defaultSiteSettings.site.name || "Nekomata").trim() ||
    "Nekomata";
  merged.site = {
    ...(merged.site || {}),
    name: normalizedSiteName,
    logoUrl: symbolAssetUrl,
  };
  merged.footer = {
    ...(merged.footer || {}),
    brandName: normalizedSiteName,
    brandLogoUrl: resolvedFooterSymbol,
  };
  const discordUrl = String(merged?.community?.discordUrl || "").trim();
  if (discordUrl) {
    if (Array.isArray(merged.footer?.socialLinks)) {
      merged.footer.socialLinks = merged.footer.socialLinks.map((link) => {
        if (String(link.label || "").toLowerCase() === "discord" && !link.href) {
          return { ...link, href: discordUrl };
        }
        return link;
      });
    }
  }
  if (Array.isArray(merged?.downloads?.sources)) {
    merged.downloads.sources = merged.downloads.sources.map((source) => ({
      ...source,
      tintIcon: source?.tintIcon !== false,
    }));
  }
  return normalizeUploadsDeep(merged);
};

const LEGACY_BRANDING_STORAGE_KEYS = [
  "wordmarkUrl",
  "wordmarkUrlNavbar",
  "wordmarkUrlFooter",
  "wordmarkPlacement",
  "wordmarkEnabled",
];
const LEGACY_SITE_STORAGE_KEYS = ["logoUrl"];
const LEGACY_FOOTER_STORAGE_KEYS = ["brandLogoUrl"];

const buildSiteSettingsStoragePayload = (settings) => {
  const normalized = normalizeUploadsDeep(fixMojibakeDeep(settings || {}));
  const next = { ...(normalized && typeof normalized === "object" ? normalized : {}) };

  if (next.branding && typeof next.branding === "object") {
    const branding = { ...next.branding };
    LEGACY_BRANDING_STORAGE_KEYS.forEach((key) => {
      delete branding[key];
    });
    next.branding = branding;
  }

  if (next.site && typeof next.site === "object") {
    const site = { ...next.site };
    LEGACY_SITE_STORAGE_KEYS.forEach((key) => {
      delete site[key];
    });
    next.site = site;
  }

  if (next.footer && typeof next.footer === "object") {
    const footer = { ...next.footer };
    LEGACY_FOOTER_STORAGE_KEYS.forEach((key) => {
      delete footer[key];
    });
    next.footer = footer;
  }

  return next;
};

const loadProjects = () => {
  try {
    if (!fs.existsSync(projectsFilePath)) {
      return [];
    }
    const raw = fs.readFileSync(projectsFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [];
    const pruned = pruneExpiredDeleted(items);
    if (pruned.length !== items.length) {
      writeProjects(pruned);
    }
    const normalized = normalizeProjects(pruned);
    if (JSON.stringify(pruned) !== JSON.stringify(normalized)) {
      writeProjects(normalized);
    }
    return normalized;
  } catch {
    return [];
  }
};

const writeProjects = (projects) => {
  fs.mkdirSync(path.dirname(projectsFilePath), { recursive: true });
  fs.writeFileSync(projectsFilePath, JSON.stringify(normalizeUploadsDeep(projects), null, 2));
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
      return { tags: {}, genres: {}, staffRoles: {} };
    }
    const raw = fs.readFileSync(tagTranslationsFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      tags: parsed?.tags && typeof parsed.tags === "object" ? parsed.tags : {},
      genres: parsed?.genres && typeof parsed.genres === "object" ? parsed.genres : {},
      staffRoles: parsed?.staffRoles && typeof parsed.staffRoles === "object" ? parsed.staffRoles : {},
    };
  } catch {
    return { tags: {}, genres: {}, staffRoles: {} };
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

const loadUploads = () => {
  try {
    if (!fs.existsSync(uploadsFilePath)) {
      fs.mkdirSync(path.dirname(uploadsFilePath), { recursive: true });
      fs.writeFileSync(uploadsFilePath, JSON.stringify([], null, 2));
      return [];
    }
    const raw = fs.readFileSync(uploadsFilePath, "utf-8");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeUploads = (uploads) => {
  fs.mkdirSync(path.dirname(uploadsFilePath), { recursive: true });
  fs.writeFileSync(uploadsFilePath, JSON.stringify(uploads, null, 2));
};

const PRIVATE_UPLOAD_FOLDERS = new Set(["downloads", "socials", "users"]);

const getUploadRootSegment = (value) => {
  if (!value) {
    return "";
  }
  const normalized = String(value).replace(/^\/+/, "");
  const [root] = normalized.split(/[\\/]/);
  return String(root || "").toLowerCase();
};

const isPrivateUploadFolder = (value) => PRIVATE_UPLOAD_FOLDERS.has(getUploadRootSegment(value));

const normalizeUploadUrlValue = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("/uploads/")) {
    return trimmed.split("?")[0].split("#")[0];
  }
  try {
    const parsed = new URL(trimmed, PRIMARY_APP_ORIGIN);
    if (parsed.pathname && parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // ignore
  }
  return null;
};

const collectDownloadIconUploads = (settings) => {
  const urls = new Set();
  const sources = settings?.downloads?.sources;
  if (!Array.isArray(sources)) {
    return urls;
  }
  sources.forEach((source) => {
    const normalized = normalizeUploadUrlValue(source?.icon);
    if (!normalized) {
      return;
    }
    const relative = normalized.replace(/^\/uploads\//, "");
    if (isPrivateUploadFolder(relative)) {
      urls.add(normalized);
    }
  });
  return urls;
};

const collectLinkTypeIconUploads = (items) => {
  const urls = new Set();
  if (!Array.isArray(items)) {
    return urls;
  }
  items.forEach((item) => {
    const normalized = normalizeUploadUrlValue(item?.icon);
    if (!normalized) {
      return;
    }
    const relative = normalized.replace(/^\/uploads\//, "");
    if (isPrivateUploadFolder(relative)) {
      urls.add(normalized);
    }
  });
  return urls;
};

const deletePrivateUploadByUrl = (value) => {
  try {
    const normalized = normalizeUploadUrlValue(value);
    if (!normalized) {
      return;
    }
    const relativePath = normalized.replace(/^\/uploads\//, "");
    if (!isPrivateUploadFolder(relativePath)) {
      return;
    }
    const uploadsDir = path.join(__dirname, "..", "public", "uploads");
    const targetPath = path.join(uploadsDir, relativePath);
    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(path.resolve(uploadsDir))) {
      return;
    }
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
    const uploads = loadUploads();
    const nextUploads = uploads.filter((item) => item.url !== normalized);
    if (nextUploads.length !== uploads.length) {
      writeUploads(nextUploads);
    }
  } catch {
    // ignore cleanup errors
  }
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
    let parsed = JSON.parse(raw || "{}");
    if (hasMojibake(raw)) {
      try {
        const fixedRaw = Buffer.from(raw, "latin1").toString("utf8");
        parsed = JSON.parse(fixedRaw || "{}");
      } catch {
        // ignore
      }
    }
    const normalized = normalizeUploadsDeep(fixMojibakeDeep(parsed));
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      fs.writeFileSync(pagesFilePath, JSON.stringify(normalized, null, 2));
    }
    return normalized;
  } catch {
    return {};
  }
};

const writePages = (pages) => {
  fs.mkdirSync(path.dirname(pagesFilePath), { recursive: true });
  fs.writeFileSync(pagesFilePath, JSON.stringify(normalizeUploadsDeep(fixMojibakeDeep(pages)), null, 2));
};

const loadSiteSettings = () => {
  try {
    if (!fs.existsSync(siteSettingsFilePath)) {
      const seeded = normalizeSiteSettings(defaultSiteSettings);
      const seededStorage = buildSiteSettingsStoragePayload(seeded);
      fs.mkdirSync(path.dirname(siteSettingsFilePath), { recursive: true });
      fs.writeFileSync(siteSettingsFilePath, JSON.stringify(seededStorage, null, 2));
      return seeded;
    }
    const raw = fs.readFileSync(siteSettingsFilePath, "utf-8");
    let parsed = {};
    try {
      parsed = JSON.parse(raw || "{}");
    } catch {
      parsed = {};
    }
    if (hasMojibake(raw)) {
      try {
        const fixedRaw = Buffer.from(raw, "latin1").toString("utf8");
        parsed = JSON.parse(fixedRaw || "{}");
      } catch {
        // ignore
      }
    }
    const normalized = normalizeSiteSettings(parsed);
    const storagePayload = buildSiteSettingsStoragePayload(normalized);
    if (JSON.stringify(parsed) !== JSON.stringify(storagePayload)) {
      fs.writeFileSync(siteSettingsFilePath, JSON.stringify(storagePayload, null, 2));
    }
    return normalized;
  } catch {
    return normalizeSiteSettings(defaultSiteSettings);
  }
};

const writeSiteSettings = (settings) => {
  const normalized = normalizeSiteSettings(settings);
  const storagePayload = buildSiteSettingsStoragePayload(normalized);
  fs.mkdirSync(path.dirname(siteSettingsFilePath), { recursive: true });
  fs.writeFileSync(siteSettingsFilePath, JSON.stringify(storagePayload, null, 2));
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

const authRateLimit = new Map();
const canAttemptAuth = (ip) => {
  if (!ip) {
    return true;
  }
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxPerWindow = isProduction ? 20 : 120;
  const entry = authRateLimit.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  authRateLimit.set(ip, entry);
  return entry.count <= maxPerWindow;
};

const uploadRateLimit = new Map();
const canUploadImage = (ip) => {
  if (!ip) {
    return true;
  }
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxPerWindow = isProduction ? 20 : 120;
  const entry = uploadRateLimit.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  uploadRateLimit.set(ip, entry);
  return entry.count <= maxPerWindow;
};

const bootstrapRateLimit = new Map();
const canBootstrap = (ip) => {
  if (!ip) {
    return true;
  }
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxPerWindow = isProduction ? 5 : 60;
  const entry = bootstrapRateLimit.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  bootstrapRateLimit.set(ip, entry);
  return entry.count <= maxPerWindow;
};

const sanitizeSvg = (value) => {
  if (!value) return "";
  let output = value;
  output = output.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "");
  output = output.replace(/<\s*foreignObject[^>]*>[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, "");
  output = output.replace(/<\s*(iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  output = output.replace(/\son\w+\s*=\s*(["']).*?\1/gi, "");
  output = output.replace(/javascript:/gi, "");
  output = output.replace(/data:(?!image\/(png|jpe?g|gif|webp);base64)/gi, "");
  output = output.replace(/(href|xlink:href|src)\s*=\s*(["'])(.*?)\2/gi, (_m, attr, quote, url) => {
    const safe = String(url || "");
    if (safe.startsWith("#") || safe.startsWith("/")) {
      return `${attr}=${quote}${safe}${quote}`;
    }
    return "";
  });
  return output;
};

const viewRateLimit = new Map();
const canRegisterView = (ip) => {
  if (!ip) {
    return true;
  }
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxPerWindow = isProduction ? 60 : 300;
  const entry = viewRateLimit.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  viewRateLimit.set(ip, entry);
  return entry.count <= maxPerWindow;
};

const pollVoteRateLimit = new Map();
const canRegisterPollVote = (ip) => {
  if (!ip) {
    return true;
  }
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxPerWindow = isProduction ? 20 : 120;
  const entry = pollVoteRateLimit.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  pollVoteRateLimit.set(ip, entry);
  return entry.count <= maxPerWindow;
};
const createSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const DELETE_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
const isWithinRestoreWindow = (deletedAt) => {
  if (!deletedAt) {
    return false;
  }
  const ts = new Date(deletedAt).getTime();
  if (!Number.isFinite(ts)) {
    return false;
  }
  return Date.now() - ts <= DELETE_RETENTION_MS;
};
const pruneExpiredDeleted = (items) =>
  (Array.isArray(items) ? items : []).filter((item) => !item?.deletedAt || isWithinRestoreWindow(item.deletedAt));

const buildSearchText = (...parts) =>
  parts
    .flat()
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

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
    const normalized = {
      id,
      title,
      slug,
      coverImageUrl: post.coverImageUrl || null,
      coverAlt: post.coverAlt || "",
      excerpt: post.excerpt || "",
      content: post.content || "",
      contentFormat:
        post.contentFormat === "html" || post.contentFormat === "lexical"
          ? post.contentFormat
          : "markdown",
      author: post.author || "",
      publishedAt,
      scheduledAt,
      status,
      seoTitle: post.seoTitle || "",
      seoDescription: post.seoDescription || "",
      projectId: post.projectId || "",
      tags: Array.isArray(post.tags) ? post.tags.filter(Boolean) : [],
      views: Number.isFinite(post.views) ? post.views : 0,
      viewsDaily: post.viewsDaily && typeof post.viewsDaily === "object" ? post.viewsDaily : {},
      commentsCount: Number.isFinite(post.commentsCount) ? post.commentsCount : 0,
      deletedAt: post.deletedAt || null,
      deletedBy: post.deletedBy || null,
      createdAt: post.createdAt || new Date().toISOString(),
      updatedAt: post.updatedAt || post.createdAt || new Date().toISOString(),
    };
    normalized.searchText = buildSearchText(
      normalized.title,
      normalized.excerpt,
      normalized.author,
      ...(Array.isArray(normalized.tags) ? normalized.tags : []),
    );
    return normalizeUploadsDeep(normalized);
  });
};

const normalizeProjects = (projects) =>
  projects.map((project, index) => {
    const normalized = {
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
    viewsDaily: project.viewsDaily && typeof project.viewsDaily === "object" ? project.viewsDaily : {},
    commentsCount: Number.isFinite(project.commentsCount) ? project.commentsCount : 0,
    order: Number.isFinite(project.order) ? project.order : index,
    deletedAt: project.deletedAt || null,
    deletedBy: project.deletedBy || null,
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: project.updatedAt || project.createdAt || new Date().toISOString(),
  };
  normalized.searchText = buildSearchText(
    normalized.title,
    normalized.titleOriginal,
    normalized.titleEnglish,
    normalized.synopsis,
    normalized.description,
    normalized.type,
    normalized.status,
    ...(Array.isArray(normalized.tags) ? normalized.tags : []),
    ...(Array.isArray(normalized.genres) ? normalized.genres : []),
  );
  return normalizeUploadsDeep(normalized);
  });

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const incrementPostViews = (slug) => {
  const posts = normalizePosts(loadPosts());
  const index = posts.findIndex((post) => post.slug === String(slug));
  if (index === -1) {
    return null;
  }
  const existing = posts[index];
  const nextViews = Number.isFinite(existing.views) ? existing.views + 1 : 1;
  const todayKey = getTodayKey();
  const nextViewsDaily = {
    ...(existing.viewsDaily || {}),
    [todayKey]: Number.isFinite(existing.viewsDaily?.[todayKey])
      ? existing.viewsDaily[todayKey] + 1
      : 1,
  };
  posts[index] = {
    ...existing,
    views: nextViews,
    viewsDaily: nextViewsDaily,
  };
  writePosts(posts);
  return posts[index];
};

const incrementProjectViews = (id) => {
  const projects = normalizeProjects(loadProjects());
  const index = projects.findIndex((project) => project.id === String(id));
  if (index === -1) {
    return null;
  }
  const existing = projects[index];
  const nextViews = Number.isFinite(existing.views) ? existing.views + 1 : 1;
  const todayKey = getTodayKey();
  const nextViewsDaily = {
    ...(existing.viewsDaily || {}),
    [todayKey]: Number.isFinite(existing.viewsDaily?.[todayKey])
      ? existing.viewsDaily[todayKey] + 1
      : 1,
  };
  projects[index] = {
    ...existing,
    views: nextViews,
    viewsDaily: nextViewsDaily,
  };
  writeProjects(projects);
  return projects[index];
};

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
        kind: "Ajuste",
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
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!canAttemptAuth(ip)) {
    appendAuditLog(req, "auth.discord.rate_limited", "auth", {});
    return res.status(429).json({ error: "rate_limited" });
  }
  const state = crypto.randomBytes(16).toString("hex");
  if (req.session) {
    req.session.oauthState = state;
  }

  if (typeof req.query.next === "string" && req.query.next.trim()) {
    if (req.session) {
      req.session.loginNext = req.query.next;
    }
  }

  const redirectUri = resolveDiscordRedirectUri(req);
  if (req.session) {
    req.session.discordRedirectUri = redirectUri;
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID || "",
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state,
    prompt: "consent",
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

app.get("/login", async (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!canAttemptAuth(ip)) {
    appendAuditLog(req, "auth.login.rate_limited", "auth", {});
    return res.redirect(`${PRIMARY_APP_ORIGIN}/login?error=rate_limited`);
  }
  const { code, state } = req.query;

  if (!code || typeof code !== "string") {
    appendAuditLog(req, "auth.login.failed", "auth", { error: "missing_code" });
    return res.redirect(`${PRIMARY_APP_ORIGIN}/login?error=missing_code`);
  }

  if (!state || typeof state !== "string" || state !== req.session?.oauthState) {
    appendAuditLog(req, "auth.login.failed", "auth", { error: "state_mismatch" });
    return res.redirect(`${PRIMARY_APP_ORIGIN}/login?error=state_mismatch`);
  }

  if (req.session) {
    req.session.oauthState = null;
  }

  try {
  const redirectUri = req.session?.discordRedirectUri || DISCORD_REDIRECT_URI || resolveDiscordRedirectUri(req);
  if (req.session) {
    req.session.discordRedirectUri = null;
  }

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
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
    }),
  });

    if (!tokenResponse.ok) {
      appendAuditLog(req, "auth.login.failed", "auth", { error: "token_exchange_failed" });
      return res.redirect(`${PRIMARY_APP_ORIGIN}/login?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: {
        authorization: `${tokenData.token_type} ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      appendAuditLog(req, "auth.login.failed", "auth", { error: "user_fetch_failed" });
      return res.redirect(`${PRIMARY_APP_ORIGIN}/login?error=user_fetch_failed`);
    }

    const discordUser = await userResponse.json();
    const allowedUsers = loadAllowedUsers();
    const isAllowed = allowedUsers.includes(discordUser.id);

    if (!isAllowed) {
      if (req.session) {
        req.session.destroy(() => undefined);
      }
      appendAuditLog(req, "auth.login.failed", "auth", { error: "unauthorized" });
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
    appendAuditLog(req, "auth.login.success", "auth", { userId: discordUser.id });

    const next = req.session?.loginNext;
    if (req.session) {
      req.session.loginNext = null;
    }
    return res.redirect(next ? `${PRIMARY_APP_ORIGIN}${next}` : `${PRIMARY_APP_ORIGIN}/dashboard`);
  } catch {
    appendAuditLog(req, "auth.login.failed", "auth", { error: "server_error" });
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
    avatarDisplay: normalizeAvatarDisplay(matched?.avatarDisplay),
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

const requirePrimaryOwner = (req, res, next) => {
  if (!req.session?.user || !isPrimaryOwner(req.session.user.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  return next();
};

const normalizeUsers = (users) => {
  return users.map((user, index) =>
    normalizeUploadsDeep({
    id: String(user.id),
    name: user.name || "Sem nome",
    phrase: user.phrase || "",
    bio: user.bio || "",
    avatarUrl: user.avatarUrl || null,
    socials: Array.isArray(user.socials) ? user.socials.filter(Boolean) : [],
    status: user.status === "retired" ? "retired" : "active",
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    roles: Array.isArray(user.roles) ? user.roles.filter(Boolean) : [],
    avatarDisplay: normalizeAvatarDisplay(user.avatarDisplay),
    order: typeof user.order === "number" ? user.order : index,
  }),
  );
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

const adminBadgePermissions = [
  "posts",
  "projetos",
  "comentarios",
  "usuarios",
  "paginas",
  "configuracoes",
];

const isAdminBadgeUser = (user) => {
  if (!user) {
    return false;
  }
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (permissions.includes("*")) {
    return true;
  }
  return adminBadgePermissions.every((permission) => permissions.includes(permission));
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

const canManageUploads = (userId) => {
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
    permissions.includes("posts") ||
    permissions.includes("projetos") ||
    permissions.includes("configuracoes")
  );
};
const syncAllowedUsers = (users) => {
  const activeIds = users.filter((user) => user.status === "active").map((user) => user.id);
  const unique = Array.from(new Set([...loadOwnerIds(), ...activeIds]));
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
      avatarDisplay: normalizeAvatarDisplay(null),
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
      avatarDisplay: normalizeAvatarDisplay(null),
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
  appendAuditLog(req, "users.read", "users", {});
  res.json({ users: users.map(applyOwnerRole), ownerIds: loadOwnerIds() });
});

app.get("/api/owners", requireOwner, (req, res) => {
  appendAuditLog(req, "owners.read", "owners", {});
  return res.json({ ownerIds: loadOwnerIds() });
});

app.put("/api/owners", requirePrimaryOwner, (req, res) => {
  const ownerIds = req.body?.ownerIds;
  if (!Array.isArray(ownerIds)) {
    return res.status(400).json({ error: "owner_ids_required" });
  }
  const primaryOwnerId = getPrimaryOwnerId();
  const nextIds = Array.isArray(ownerIds) ? ownerIds.map((id) => String(id)) : [];
  const unique = Array.from(new Set(nextIds.filter(Boolean)));
  if (primaryOwnerId) {
    const normalizedPrimary = String(primaryOwnerId);
    const filtered = unique.filter((id) => id !== normalizedPrimary);
    unique.length = 0;
    unique.push(normalizedPrimary, ...filtered);
  }
  writeOwnerIds(unique);
  syncAllowedUsers(normalizeUsers(loadUsers()));
  appendAuditLog(req, "owners.update", "owners", { count: unique.length });
  return res.json({ ownerIds: loadOwnerIds() });
});

app.post("/api/bootstrap-owner", requireAuth, (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!canBootstrap(ip)) {
    appendAuditLog(req, "auth.bootstrap.rate_limited", "owners", {});
    return res.status(429).json({ error: "rate_limited" });
  }
  if (!BOOTSTRAP_TOKEN) {
    appendAuditLog(req, "auth.bootstrap.disabled", "owners", {});
    return res.status(403).json({ error: "bootstrap_disabled" });
  }
  const currentOwners = loadOwnerIds();
  if (currentOwners.length) {
    appendAuditLog(req, "auth.bootstrap.denied", "owners", { error: "owner_exists" });
    return res.status(409).json({ error: "owner_exists" });
  }
  const token = String(req.body?.token || req.headers["x-bootstrap-token"] || "");
  if (!token || token !== BOOTSTRAP_TOKEN) {
    appendAuditLog(req, "auth.bootstrap.denied", "owners", { error: "invalid_token" });
    return res.status(403).json({ error: "invalid_token" });
  }
  const sessionUser = req.session?.user;
  if (!sessionUser?.id) {
    appendAuditLog(req, "auth.bootstrap.denied", "owners", { error: "unauthorized" });
    return res.status(401).json({ error: "unauthorized" });
  }
  writeOwnerIds([sessionUser.id]);
  ensureOwnerUser(sessionUser);
  syncAllowedUsers(normalizeUsers(loadUsers()));
  appendAuditLog(req, "auth.bootstrap.success", "owners", { ownerId: sessionUser.id });
  return res.json({ ok: true, ownerIds: loadOwnerIds() });
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
      avatarDisplay: normalizeAvatarDisplay(user.avatarDisplay),
      socials: user.socials,
      roles: applyOwnerRole(user).roles,
      isAdmin: !isOwner(user.id) && isAdminBadgeUser(user),
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
  const previousLinkTypes = loadLinkTypes();
  const previousIcons = collectLinkTypeIconUploads(previousLinkTypes);
  const normalized = items
    .map((item) => ({
      id: String(item.id || "").trim(),
      label: String(item.label || "").trim(),
      icon: String(item.icon || "globe").trim(),
    }))
    .filter((item) => item.id && item.label);
  writeLinkTypes(normalized);
  const nextIcons = collectLinkTypeIconUploads(normalized);
  const removedIcons = Array.from(previousIcons).filter((url) => !nextIcons.has(url));
  removedIcons.forEach((url) => deletePrivateUploadByUrl(url));
  return res.json({ items: normalized });
});

app.get("/api/posts", requireAuth, (req, res) => {
  const posts = normalizePosts(loadPosts()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  res.json({ posts });
});

app.get("/api/public/posts", (req, res) => {
  const limitRaw = Number(req.query.limit);
  const pageRaw = Number(req.query.page);
  const usePagination = Number.isFinite(limitRaw) || Number.isFinite(pageRaw);
  const limit = usePagination ? Math.min(Math.max(limitRaw || 10, 1), 100) : null;
  const page = usePagination ? Math.max(pageRaw || 1, 1) : null;
  const now = Date.now();
  const posts = normalizePosts(loadPosts())
    .filter((post) => !post.deletedAt)
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
  if (!usePagination) {
    return res.json({ posts });
  }
  const start = (page - 1) * limit;
  const paged = posts.slice(start, start + limit);
  return res.json({ posts: paged, page, limit, total: posts.length });
});

app.get("/api/public/posts/:slug", (req, res) => {
  const now = Date.now();
  const slug = String(req.params.slug || "");
  const posts = normalizePosts(loadPosts());
  const post = posts.find((item) => item.slug === slug);
  if (!post) {
    return res.status(404).json({ error: "not_found" });
  }
  if (post.deletedAt) {
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

app.post("/api/public/posts/:slug/view", (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!canRegisterView(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }
  const now = Date.now();
  const slug = String(req.params.slug || "");
  const posts = normalizePosts(loadPosts());
  const post = posts.find((item) => item.slug === slug);
  if (!post) {
    return res.status(404).json({ error: "not_found" });
  }
  if (post.deletedAt) {
    return res.status(404).json({ error: "not_found" });
  }
  const publishTime = new Date(post.publishedAt).getTime();
  if (publishTime > now || (post.status !== "published" && post.status !== "scheduled")) {
    return res.status(404).json({ error: "not_found" });
  }
  const updated = incrementPostViews(slug);
  return res.json({ views: updated?.views ?? post.views ?? 0 });
});

app.post("/api/public/posts/:slug/polls/vote", (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!canRegisterPollVote(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }
  const slug = String(req.params.slug || "");
  const { optionUid, voterId, checked, question } = req.body || {};
  if (!optionUid || !voterId) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  const posts = normalizePosts(loadPosts());
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const post = posts[index];
  const result = updateLexicalPollVotes(post.content, {
    question,
    optionUid,
    voterId,
    checked,
  });
  if (!result.updated || !result.content) {
    return res.status(404).json({ error: "poll_not_found" });
  }
  posts[index] = {
    ...post,
    content: result.content,
  };
  writePosts(posts);
  return res.json({ ok: true });
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
  if (!["post", "project", "chapter"].includes(normalizedTargetType)) {
    return res.status(400).json({ error: "invalid_target" });
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
  const nowEpoch = Date.now();
  if (normalizedTargetType === "post") {
    const post = posts.find((item) => item.slug === normalizedTargetId);
    if (!post || post.deletedAt) {
      return res.status(404).json({ error: "target_not_found" });
    }
    const publishTime = new Date(post.publishedAt).getTime();
    if (publishTime > nowEpoch || (post.status !== "published" && post.status !== "scheduled")) {
      return res.status(404).json({ error: "target_not_found" });
    }
  } else if (normalizedTargetType === "project") {
    const project = projects.find((item) => item.id === normalizedTargetId);
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: "target_not_found" });
    }
  } else if (normalizedTargetType === "chapter") {
    const chapter = Number(chapterNumber);
    if (!Number.isFinite(chapter)) {
      return res.status(400).json({ error: "chapter_required" });
    }
    const project = projects.find((item) => item.id === normalizedTargetId);
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: "target_not_found" });
    }
    const volumeNumber = Number.isFinite(volume) ? Number(volume) : null;
    const episode = (project.episodeDownloads || []).find((item) => {
      if (Number(item.number) !== chapter) {
        return false;
      }
      if (volumeNumber === null) {
        return true;
      }
      return Number(item.volume || 0) === volumeNumber;
    });
    if (!episode) {
      return res.status(404).json({ error: "target_not_found" });
    }
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
    return { label: post.title, url: `${PRIMARY_APP_ORIGIN}/postagem/${post.slug}#comment-${comment.id}` };
  }
  if (comment.targetType === "project") {
    const project = projects.find((item) => item.id === comment.targetId);
    if (!project) {
      return { label: "Projeto", url: PRIMARY_APP_ORIGIN };
    }
    return { label: project.title, url: `${PRIMARY_APP_ORIGIN}/projeto/${project.id}#comment-${comment.id}` };
  }
  if (comment.targetType === "chapter") {
    const project = projects.find((item) => item.id === comment.targetId);
    const chapterNumber = comment.targetMeta?.chapterNumber;
    const volume = comment.targetMeta?.volume;
    const chapterLabel = chapterNumber ? `Capítulo ${chapterNumber}` : "Capítulo";
    const projectLabel = project?.title ? `${project.title} • ${chapterLabel}` : chapterLabel;
    const volumeQuery = Number.isFinite(volume) ? `?volume=${volume}` : "";
    const url = project
      ? `${PRIMARY_APP_ORIGIN}/projeto/${project.id}/leitura/${chapterNumber}${volumeQuery}#comment-${comment.id}`
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

app.get("/api/comments/recent", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageComments(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 10) : 4;
  const posts = normalizePosts(loadPosts());
  const projects = normalizeProjects(loadProjects());
  const comments = loadComments();
  const pendingCount = comments.filter((comment) => comment.status === "pending").length;
  const recent = comments
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .map((comment) => {
      const target = buildCommentTargetInfo(comment, posts, projects);
      return {
        id: comment.id,
        status: comment.status,
        targetType: comment.targetType,
        targetId: comment.targetId,
        name: comment.name,
        content: comment.content,
        createdAt: comment.createdAt,
        avatarUrl: comment.avatarUrl || buildGravatarUrl(comment.emailHash || ""),
        targetLabel: target.label,
        targetUrl: target.url,
      };
    });
  return res.json({ comments: recent, pendingCount, totalCount: comments.length });
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
  if (!title) {
    return res.status(400).json({ error: "title_required" });
  }

  let posts = normalizePosts(loadPosts());
  const normalizedSlug = createSlug(slug || title);
  if (!normalizedSlug) {
    return res.status(400).json({ error: "slug_required" });
  }
  if (posts.some((post) => post.slug === normalizedSlug)) {
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
    slug: normalizedSlug,
    coverImageUrl: coverImageUrl || null,
    coverAlt: coverAlt || "",
    excerpt: excerpt || "",
    content: content || "",
    contentFormat:
      contentFormat === "html" || contentFormat === "lexical"
        ? contentFormat
        : "markdown",
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
  appendAuditLog(req, "posts.create", "posts", { id: newPost.id, slug: newPost.slug });
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

  const normalizedSlug = slug ? createSlug(slug) : "";
  if (normalizedSlug && posts.some((post) => post.slug === normalizedSlug && post.id !== String(id))) {
    return res.status(409).json({ error: "slug_exists" });
  }

  const existing = posts[index];
  const normalizedStatus =
    status === "draft" || status === "scheduled" || status === "published" ? status : existing.status;
  const updated = {
    ...existing,
    title: title ? String(title) : existing.title,
    slug: normalizedSlug || existing.slug,
    coverImageUrl: coverImageUrl === "" ? null : coverImageUrl ?? existing.coverImageUrl,
    coverAlt: typeof coverAlt === "string" ? coverAlt : existing.coverAlt,
    excerpt: typeof excerpt === "string" ? excerpt : existing.excerpt,
    content: typeof content === "string" ? content : existing.content,
    contentFormat:
      contentFormat === "html"
        ? "html"
        : contentFormat === "markdown"
          ? "markdown"
          : contentFormat === "lexical"
            ? "lexical"
            : existing.contentFormat,
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
  appendAuditLog(req, "posts.update", "posts", { id: updated.id, slug: updated.slug });
  return res.json({ post: updated });
});

app.delete("/api/posts/:id", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const { id } = req.params;
  let posts = normalizePosts(loadPosts());
  const index = posts.findIndex((post) => post.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const existing = posts[index];
  if (existing.deletedAt && !isWithinRestoreWindow(existing.deletedAt)) {
    const next = posts.filter((post) => post.id !== String(id));
    writePosts(next);
    appendAuditLog(req, "posts.delete.final", "posts", { id });
    return res.json({ ok: true });
  }
  if (!existing.deletedAt) {
    posts[index] = {
      ...existing,
      deletedAt: new Date().toISOString(),
      deletedBy: sessionUser?.id || null,
      updatedAt: new Date().toISOString(),
    };
    writePosts(posts);
    appendAuditLog(req, "posts.delete", "posts", { id });
  }
  return res.json({ ok: true });
});

app.post("/api/posts/:id/restore", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  let posts = normalizePosts(loadPosts());
  const index = posts.findIndex((post) => post.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const existing = posts[index];
  if (!existing.deletedAt) {
    return res.json({ post: existing });
  }
  if (!isWithinRestoreWindow(existing.deletedAt)) {
    return res.status(410).json({ error: "restore_window_expired" });
  }
  const restored = {
    ...existing,
    deletedAt: null,
    deletedBy: null,
    updatedAt: new Date().toISOString(),
  };
  posts[index] = restored;
  writePosts(posts);
  appendAuditLog(req, "posts.restore", "posts", { id });
  return res.json({ post: restored });
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
  appendAuditLog(req, "projects.create", "projects", { id: nextProject.id });

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
  appendAuditLog(req, "projects.update", "projects", { id: merged.id });

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
  const index = projects.findIndex((project) => project.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const existing = projects[index];
  if (existing.deletedAt && !isWithinRestoreWindow(existing.deletedAt)) {
    const next = projects.filter((project) => project.id !== String(id));
    writeProjects(next);
    appendAuditLog(req, "projects.delete.final", "projects", { id });
    return res.json({ ok: true });
  }
  if (!existing.deletedAt) {
    projects[index] = {
      ...existing,
      deletedAt: new Date().toISOString(),
      deletedBy: sessionUser?.id || null,
      updatedAt: new Date().toISOString(),
    };
    writeProjects(projects);
    appendAuditLog(req, "projects.delete", "projects", { id });
  }
  return res.json({ ok: true });
});

app.post("/api/projects/:id/restore", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { id } = req.params;
  const projects = normalizeProjects(loadProjects());
  const index = projects.findIndex((project) => project.id === String(id));
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const existing = projects[index];
  if (!existing.deletedAt) {
    return res.json({ project: existing });
  }
  if (!isWithinRestoreWindow(existing.deletedAt)) {
    return res.status(410).json({ error: "restore_window_expired" });
  }
  const restored = {
    ...existing,
    deletedAt: null,
    deletedBy: null,
    updatedAt: new Date().toISOString(),
  };
  projects[index] = restored;
  writeProjects(projects);
  appendAuditLog(req, "projects.restore", "projects", { id });
  return res.json({ project: restored });
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
  appendAuditLog(req, "projects.reorder", "projects", { count: next.length });
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
  appendAuditLog(req, "projects.rebuild_updates", "projects", { id });
  return res.json({ ok: true, updates: episodeUpdates.length });
});

app.get("/api/public/projects", (req, res) => {
  const limitRaw = Number(req.query.limit);
  const pageRaw = Number(req.query.page);
  const usePagination = Number.isFinite(limitRaw) || Number.isFinite(pageRaw);
  const limit = usePagination ? Math.min(Math.max(limitRaw || 20, 1), 200) : null;
  const page = usePagination ? Math.max(pageRaw || 1, 1) : null;
  const projects = normalizeProjects(loadProjects())
    .filter((project) => !project.deletedAt)
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
      forceHero: project.forceHero,
      heroImageUrl: project.heroImageUrl,
      episodeDownloads: project.episodeDownloads.map((episode) => ({
        ...episode,
        content: undefined,
        hasContent: typeof episode.content === "string" && episode.content.trim().length > 0,
      })),
      views: project.views,
      commentsCount: project.commentsCount,
    }));
  if (!usePagination) {
    return res.json({ projects });
  }
  const start = (page - 1) * limit;
  const paged = projects.slice(start, start + limit);
  return res.json({ projects: paged, page, limit, total: projects.length });
});

app.get("/api/public/projects/:id", (req, res) => {
  const id = String(req.params.id || "");
  const projects = normalizeProjects(loadProjects());
  const project = projects.find((item) => item.id === id);
  if (!project) {
    return res.status(404).json({ error: "not_found" });
  }
  if (project.deletedAt) {
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

app.post("/api/public/projects/:id/view", (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!canRegisterView(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }
  const id = String(req.params.id || "");
  const projects = normalizeProjects(loadProjects());
  const project = projects.find((item) => item.id === id);
  if (!project) {
    return res.status(404).json({ error: "not_found" });
  }
  if (project.deletedAt) {
    return res.status(404).json({ error: "not_found" });
  }
  const updated = incrementProjectViews(id);
  return res.json({ views: updated?.views ?? project.views ?? 0 });
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
  if (project.deletedAt) {
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

app.post("/api/public/projects/:id/chapters/:number/polls/vote", (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!canRegisterPollVote(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }
  const id = String(req.params.id || "");
  const chapterNumber = Number(req.params.number);
  const volume = req.query.volume ? Number(req.query.volume) : null;
  const { optionUid, voterId, checked, question } = req.body || {};
  if (!Number.isFinite(chapterNumber)) {
    return res.status(400).json({ error: "invalid_chapter" });
  }
  if (!optionUid || !voterId) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  const projects = normalizeProjects(loadProjects());
  const projectIndex = projects.findIndex((item) => item.id === id);
  if (projectIndex === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const project = projects[projectIndex];
  const chapterIndex = project.episodeDownloads.findIndex((episode) => {
    if (Number(episode.number) !== chapterNumber) {
      return false;
    }
    if (Number.isFinite(volume)) {
      return Number(episode.volume || 0) === volume;
    }
    return true;
  });
  if (chapterIndex === -1) {
    return res.status(404).json({ error: "not_found" });
  }
  const chapter = project.episodeDownloads[chapterIndex];
  const result = updateLexicalPollVotes(chapter.content, {
    question,
    optionUid,
    voterId,
    checked,
  });
  if (!result.updated || !result.content) {
    return res.status(404).json({ error: "poll_not_found" });
  }
  const updatedChapter = {
    ...chapter,
    content: result.content,
  };
  const updatedEpisodes = [...project.episodeDownloads];
  updatedEpisodes[chapterIndex] = updatedChapter;
  projects[projectIndex] = {
    ...project,
    episodeDownloads: updatedEpisodes,
  };
  writeProjects(projects);
  return res.json({ ok: true });
});

app.get("/api/public/updates", (req, res) => {
  const limitRaw = Number(req.query.limit);
  const pageRaw = Number(req.query.page);
  const usePagination = Number.isFinite(limitRaw) || Number.isFinite(pageRaw);
  const limit = usePagination ? Math.min(Math.max(limitRaw || 10, 1), 50) : 10;
  const page = usePagination ? Math.max(pageRaw || 1, 1) : 1;
  const projects = normalizeProjects(loadProjects());
  const validProjectIds = new Set(
    projects.filter((project) => !project.deletedAt).map((project) => project.id),
  );
  const updates = loadUpdates()
    .filter((update) => {
      if (!update?.projectId) {
        return true;
      }
      return validProjectIds.has(String(update.projectId));
    })
    .map((update) => {
      const reason = String(update?.reason || "");
      const kind = String(update?.kind || "");
      if (kind.toLowerCase().startsWith("lan") && reason.toLowerCase().includes("novo link adicionado")) {
        return { ...update, kind: "Ajuste" };
      }
      return update;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  if (!usePagination) {
    return res.json({ updates: updates.slice(0, limit) });
  }
  const start = (page - 1) * limit;
  const paged = updates.slice(start, start + limit);
  return res.json({ updates: paged, page, limit, total: updates.length });
});

app.get("/api/public/settings", (req, res) => {
  return res.json({ settings: loadSiteSettings() });
});

app.get("/api/public/tag-translations", (req, res) => {
  const translations = loadTagTranslations();
  res.json({
    tags: translations.tags,
    genres: translations.genres,
    staffRoles: translations.staffRoles,
  });
});

app.post("/api/tag-translations/anilist-sync", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageSettings(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const query = `
      query {
        GenreCollection
        MediaTagCollection {
          name
        }
      }
    `;
    const response = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      return res.status(502).json({ error: "anilist_failed" });
    }
    const data = await response.json();
    const rawGenres = Array.isArray(data?.data?.GenreCollection) ? data.data.GenreCollection : [];
    const rawTags = Array.isArray(data?.data?.MediaTagCollection) ? data.data.MediaTagCollection : [];
    const genres = rawGenres
      .map((genre) => String(genre || "").trim())
      .filter(Boolean);
    const tags = rawTags
      .map((tag) => String(tag?.name || "").trim())
      .filter(Boolean);
    const current = loadTagTranslations();
    const nextTags = { ...current.tags };
    const nextGenres = { ...current.genres };
    const nextStaffRoles = { ...current.staffRoles };
    tags.forEach((tag) => {
      if (typeof nextTags[tag] !== "string") {
        nextTags[tag] = "";
      }
    });
    genres.forEach((genre) => {
      if (typeof nextGenres[genre] !== "string") {
        nextGenres[genre] = "";
      }
    });
    const payload = { tags: nextTags, genres: nextGenres, staffRoles: nextStaffRoles };
    writeTagTranslations(payload);
    return res.json(payload);
  } catch {
    return res.status(502).json({ error: "anilist_failed" });
  }
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
  const previousSettings = loadSiteSettings();
  const previousDownloadIcons = collectDownloadIconUploads(previousSettings);
  const normalized = normalizeSiteSettings(settings);
  writeSiteSettings(normalized);
  const nextDownloadIcons = collectDownloadIconUploads(normalized);
  const removedIcons = Array.from(previousDownloadIcons).filter((url) => !nextDownloadIcons.has(url));
  removedIcons.forEach((url) => deletePrivateUploadByUrl(url));
  appendAuditLog(req, "settings.update", "settings", {});
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
  appendAuditLog(req, "pages.update", "pages", {});
  return res.json({ pages });
});

app.post("/api/tag-translations/sync", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageProjects(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const { tags, genres, staffRoles } = req.body || {};
  const current = loadTagTranslations();
  const nextTags = { ...current.tags };
  const nextGenres = { ...current.genres };
  const nextStaffRoles = { ...current.staffRoles };

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

  const staffRoleList = Array.isArray(staffRoles) ? staffRoles : [];
  staffRoleList.forEach((role) => {
    const key = String(role || "").trim();
    if (key && typeof nextStaffRoles[key] !== "string") {
      nextStaffRoles[key] = "";
    }
  });

  const payload = { tags: nextTags, genres: nextGenres, staffRoles: nextStaffRoles };
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
  const staffRoles = req.body?.staffRoles;
  if (
    (!tags || typeof tags !== "object") &&
    (!genres || typeof genres !== "object") &&
    (!staffRoles || typeof staffRoles !== "object")
  ) {
    return res.status(400).json({ error: "translations_required" });
  }
  const current = loadTagTranslations();
  const normalizedTags = tags && typeof tags === "object"
    ? Object.fromEntries(
        Object.entries(tags).map(([key, value]) => [String(key), String(value || "")]),
      )
    : current.tags;
  const normalizedGenres = genres && typeof genres === "object"
    ? Object.fromEntries(
        Object.entries(genres).map(([key, value]) => [String(key), String(value || "")]),
      )
    : current.genres;
  const normalizedStaffRoles = staffRoles && typeof staffRoles === "object"
    ? Object.fromEntries(
        Object.entries(staffRoles).map(([key, value]) => [String(key), String(value || "")]),
      )
    : current.staffRoles;
  const payload = { tags: normalizedTags, genres: normalizedGenres, staffRoles: normalizedStaffRoles };
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
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!canUploadImage(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const { dataUrl, filename, folder, slot } = req.body || {};
  if (!dataUrl || typeof dataUrl !== "string") {
    return res.status(400).json({ error: "data_url_required" });
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: "invalid_data_url" });
  }

  let mime = normalizeUploadMime(match[1]);
  if (!/^(image\/(png|jpe?g|gif|webp|svg\+xml))$/i.test(mime)) {
    return res.status(400).json({ error: "unsupported_image_type" });
  }
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    return res.status(400).json({ error: "empty_upload" });
  }
  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    return res.status(400).json({ error: "file_too_large" });
  }
  const validation = validateUploadImageBuffer(buffer, mime, { strictRequestedMime: true });
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  mime = validation.mime;
  if (mime === "image/svg+xml" && buffer.length > MAX_SVG_SIZE_BYTES) {
    return res.status(400).json({ error: "svg_too_large" });
  }
  const ext = getUploadExtFromMime(mime);
  const safeName = sanitizeUploadBaseName(filename || "upload");
  const safeSlot = sanitizeUploadSlot(slot);
  const uploadsDir = path.join(__dirname, "..", "public", "uploads");
  const safeFolder = sanitizeUploadFolder(folder);
  const targetDir = safeFolder ? path.join(uploadsDir, safeFolder) : uploadsDir;
  fs.mkdirSync(targetDir, { recursive: true });
  const useSlotName = Boolean(safeSlot && isPrivateUploadFolder(safeFolder));
  const fileName = useSlotName
    ? `${safeSlot}.${ext}`
    : `${safeName || "imagem"}-${Date.now()}.${ext}`;
  const filePath = path.join(targetDir, fileName);
  if (mime === "image/svg+xml") {
    const svgText = buffer.toString("utf-8");
    const sanitized = sanitizeSvg(svgText);
    fs.writeFileSync(filePath, sanitized);
  } else {
    fs.writeFileSync(filePath, buffer);
  }

  const relativeUrl = `/uploads/${safeFolder ? `${safeFolder}/` : ""}${fileName}`;
  const uploads = loadUploads();
  const uploadEntry = {
    id: crypto.randomUUID(),
    url: relativeUrl,
    fileName,
    folder: safeFolder || "",
    size: buffer.length,
    mime,
    width: validation.dimensions?.width || null,
    height: validation.dimensions?.height || null,
    createdAt: new Date().toISOString(),
  };
  const existingIndex = uploads.findIndex((item) => item.url === relativeUrl);
  if (existingIndex >= 0) {
    uploads[existingIndex] = {
      ...uploads[existingIndex],
      ...uploadEntry,
      id: uploads[existingIndex].id,
    };
  } else {
    uploads.push(uploadEntry);
  }
  writeUploads(uploads);

  appendAuditLog(req, "uploads.image", "uploads", { fileName, folder: safeFolder || "", url: relativeUrl });
  return res.json({
    url: relativeUrl,
    fileName,
  });
});

app.get("/api/uploads/list", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const uploadsDir = path.join(__dirname, "..", "public", "uploads");
  const folder = typeof req.query.folder === "string" ? req.query.folder.trim() : "";
  const listAll = folder === "__all__";
  const safeFolder = listAll ? "" : sanitizeUploadFolder(folder);
  const targetDir = safeFolder ? path.join(uploadsDir, safeFolder) : uploadsDir;
  try {
    const usedUrls = getUsedUploadUrls();
    const uploadMeta = loadUploads();
    const uploadMetaMap = new Map(
      uploadMeta
        .map((item) => [normalizeUploadUrl(item?.url), item])
        .filter(([key]) => Boolean(key)),
    );
    const collectFiles = (dir, base) => {
      if (!fs.existsSync(dir)) {
        return [];
      }
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const results = [];
      entries.forEach((entry) => {
        const fullPath = path.join(dir, entry.name);
        const nextBase = path.join(base, entry.name);
        const normalizedBase = nextBase.split(path.sep).join("/");
        if (listAll && isPrivateUploadFolder(normalizedBase)) {
          return;
        }
        if (entry.isDirectory()) {
          results.push(...collectFiles(fullPath, nextBase));
          return;
        }
        if (!/\.(png|jpe?g|gif|webp|svg(\+xml)?)$/i.test(entry.name)) {
          return;
        }
        const relative = normalizedBase;
        const url = `/uploads/${relative}`;
        const normalizedUrl = normalizeUploadUrl(url) || url;
        const stat = fs.statSync(fullPath);
        const meta = uploadMetaMap.get(normalizedUrl) || null;
        const inUse = usedUrls.has(normalizedUrl);
        results.push({
          name: entry.name,
          url: normalizedUrl,
          source: "upload",
          folder: meta?.folder ?? path.dirname(relative).replace(/\\/g, "/").replace(/^\.$/, ""),
          fileName: meta?.fileName || entry.name,
          mime: meta?.mime || getUploadMimeFromExtension(path.extname(entry.name).replace(".", "")),
          size: typeof meta?.size === "number" ? meta.size : stat.size,
          createdAt: meta?.createdAt || stat.mtime.toISOString(),
          inUse,
          canDelete: !inUse,
        });
      });
      return results;
    };
    const files = listAll
      ? collectFiles(uploadsDir, "")
      : (fs.existsSync(targetDir) ? fs.readdirSync(targetDir) : [])
          .filter((item) => /\.(png|jpe?g|gif|webp|svg(\+xml)?)$/i.test(item))
          .map((item) => {
            const fullPath = path.join(targetDir, item);
            const relativePath = `${safeFolder ? `${safeFolder}/` : ""}${item}`;
            const url = `/uploads/${relativePath}`;
            const normalizedUrl = normalizeUploadUrl(url) || url;
            const stat = fs.statSync(fullPath);
            const meta = uploadMetaMap.get(normalizedUrl) || null;
            const inUse = usedUrls.has(normalizedUrl);
            return {
              name: item,
              url: normalizedUrl,
              source: "upload",
              folder: meta?.folder ?? safeFolder,
              fileName: meta?.fileName || item,
              mime: meta?.mime || getUploadMimeFromExtension(path.extname(item).replace(".", "")),
              size: typeof meta?.size === "number" ? meta.size : stat.size,
              createdAt: meta?.createdAt || stat.mtime.toISOString(),
              inUse,
              canDelete: !inUse,
            };
          });
    return res.json({ files });
  } catch {
    return res.json({ files: [] });
  }
});

const collectProjectImageItems = (projects) => {
  const dedupe = new Set();
  const items = [];
  const push = (project, url, kind, label) => {
    const normalizedUrl = normalizeUploadUrl(url) || String(url || "").trim();
    if (!normalizedUrl || dedupe.has(normalizedUrl)) {
      return;
    }
    dedupe.add(normalizedUrl);
    items.push({
      source: "project",
      url: normalizedUrl,
      label,
      projectId: project.id,
      projectTitle: project.title,
      kind,
    });
  };
  projects.forEach((project) => {
    push(project, project.cover, "cover", `${project.title} (Capa)`);
    push(project, project.banner, "banner", `${project.title} (Banner)`);
    push(project, project.heroImageUrl, "hero", `${project.title} (Carrossel)`);
    (Array.isArray(project.relations) ? project.relations : []).forEach((relation, index) => {
      const relationLabel = relation?.title
        ? `${project.title} (Relação: ${relation.title})`
        : `${project.title} (Relação ${index + 1})`;
      push(project, relation?.image, "relation", relationLabel);
    });
    (Array.isArray(project.episodeDownloads) ? project.episodeDownloads : []).forEach((episode, index) => {
      const suffix = episode?.number ? `Cap/Ep ${episode.number}` : `Cap/Ep ${index + 1}`;
      push(project, episode?.coverImageUrl, "episode-cover", `${project.title} (${suffix})`);
    });
  });
  return items;
};

app.get("/api/uploads/project-images", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const projects = normalizeProjects(loadProjects());
  return res.json({ items: collectProjectImageItems(projects) });
});

app.post("/api/uploads/image-from-url", requireAuth, async (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  if (!canUploadImage(ip)) {
    return res.status(429).json({ error: "rate_limited" });
  }

  const remoteUrl = String(req.body?.url || "").trim();
  const safeFolder = sanitizeUploadFolder(req.body?.folder || "");
  if (!remoteUrl) {
    return res.status(400).json({ error: "url_required" });
  }
  let parsedRemote;
  try {
    parsedRemote = new URL(remoteUrl);
    if (parsedRemote.protocol !== "http:" && parsedRemote.protocol !== "https:") {
      return res.status(400).json({ error: "invalid_url" });
    }
  } catch {
    return res.status(400).json({ error: "invalid_url" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(parsedRemote.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return res.status(502).json({ error: "fetch_failed" });
    }

    const contentTypeHeader = String(response.headers.get("content-type") || "");
    const headerMime = normalizeUploadMime(contentTypeHeader.split(";")[0].trim().toLowerCase());
    const extFromUrl = path.extname(parsedRemote.pathname || "").replace(".", "").toLowerCase();
    let mime = isSupportedUploadImageMime(headerMime)
      ? headerMime
      : getUploadMimeFromExtension(extFromUrl);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      return res.status(400).json({ error: "empty_upload" });
    }
    if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
      return res.status(400).json({ error: "file_too_large" });
    }
    const validation = validateUploadImageBuffer(buffer, mime);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    mime = validation.mime;
    if (mime === "image/svg+xml" && buffer.length > MAX_SVG_SIZE_BYTES) {
      return res.status(400).json({ error: "svg_too_large" });
    }

    const uploadsDir = path.join(__dirname, "..", "public", "uploads");
    const targetDir = safeFolder ? path.join(uploadsDir, safeFolder) : uploadsDir;
    fs.mkdirSync(targetDir, { recursive: true });

    const parsedName = decodeURIComponent(path.basename(parsedRemote.pathname || "") || "upload");
    const safeBase = sanitizeUploadBaseName(parsedName || "upload");
    const ext = getUploadExtFromMime(mime);
    const fileName = `${safeBase || "imagem"}-${Date.now()}.${ext}`;
    const filePath = path.join(targetDir, fileName);

    if (mime === "image/svg+xml") {
      const sanitized = sanitizeSvg(buffer.toString("utf-8"));
      fs.writeFileSync(filePath, sanitized);
    } else {
      fs.writeFileSync(filePath, buffer);
    }

    const relativeUrl = `/uploads/${safeFolder ? `${safeFolder}/` : ""}${fileName}`;
    const uploads = loadUploads();
    uploads.push({
      id: crypto.randomUUID(),
      url: relativeUrl,
      fileName,
      folder: safeFolder || "",
      size: buffer.length,
      mime,
      width: validation.dimensions?.width || null,
      height: validation.dimensions?.height || null,
      createdAt: new Date().toISOString(),
    });
    writeUploads(uploads);
    appendAuditLog(req, "uploads.image_from_url", "uploads", {
      url: relativeUrl,
      remoteUrl: parsedRemote.toString(),
      folder: safeFolder || "",
    });
    return res.json({ url: relativeUrl, fileName });
  } catch {
    return res.status(502).json({ error: "fetch_failed" });
  }
});

const toUploadPath = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }
  if (value.startsWith("/uploads/")) {
    return value.split("?")[0].split("#")[0];
  }
  try {
    const parsed = new URL(value, PRIMARY_APP_ORIGIN);
    if (parsed.pathname && parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // ignore
  }
  return null;
};

const extractUploadPathsFromText = (value) => {
  if (!value || typeof value !== "string") {
    return [];
  }
  if (!value.includes("/uploads/")) {
    return [];
  }
  const matches = new Set();
  const absolutePattern = /https?:\/\/[^\s"'()<>]+/gi;
  const relativePattern = /\/uploads\/[^\s"'()<>]+/gi;
  const absoluteMatches = value.match(absolutePattern) || [];
  absoluteMatches.forEach((match) => {
    const normalized = toUploadPath(match);
    if (normalized) {
      matches.add(normalized);
    }
  });
  const relativeMatches = value.match(relativePattern) || [];
  relativeMatches.forEach((match) => {
    const normalized = toUploadPath(match);
    if (normalized) {
      matches.add(normalized);
    }
  });
  return Array.from(matches);
};

const normalizeUploadUrl = (value) => {
  if (!value || typeof value !== "string") return null;
  const direct = toUploadPath(value);
  if (direct) {
    return direct;
  }
  const extracted = extractUploadPathsFromText(value);
  return extracted[0] || null;
};

const collectUploadUrls = (value, urls) => {
  if (!value) return;
  if (typeof value === "string") {
    extractUploadPathsFromText(value).forEach((item) => urls.add(item));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUploadUrls(item, urls));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectUploadUrls(item, urls));
  }
};

const getUsedUploadUrls = () => {
  const urls = new Set();
  collectUploadUrls(loadSiteSettings(), urls);
  collectUploadUrls(loadPosts(), urls);
  collectUploadUrls(loadProjects(), urls);
  collectUploadUrls(loadUsers(), urls);
  collectUploadUrls(loadPages(), urls);
  collectUploadUrls(loadComments(), urls);
  collectUploadUrls(loadUpdates(), urls);
  return urls;
};

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceUploadReferencesInText = (value, oldUrl, newUrl) => {
  if (!value || typeof value !== "string") {
    return { value, count: 0 };
  }
  let next = value;
  let count = 0;
  const directRegex = new RegExp(escapeRegExp(oldUrl), "g");
  const directMatches = next.match(directRegex);
  if (directMatches?.length) {
    count += directMatches.length;
    next = next.replace(directRegex, newUrl);
  }
  const absolutePattern = /https?:\/\/[^\s"'()<>]+/gi;
  next = next.replace(absolutePattern, (match) => {
    const normalized = toUploadPath(match);
    if (normalized !== oldUrl) {
      return match;
    }
    count += 1;
    try {
      const parsed = new URL(match);
      parsed.pathname = newUrl;
      return parsed.toString();
    } catch {
      return match.replace(oldUrl, newUrl);
    }
  });
  return { value: next, count };
};

const replaceUploadReferencesDeep = (value, oldUrl, newUrl) => {
  if (typeof value === "string") {
    return replaceUploadReferencesInText(value, oldUrl, newUrl);
  }
  if (Array.isArray(value)) {
    let count = 0;
    const next = value.map((item) => {
      const result = replaceUploadReferencesDeep(item, oldUrl, newUrl);
      count += result.count;
      return result.value;
    });
    return { value: next, count };
  }
  if (value && typeof value === "object") {
    let count = 0;
    const next = { ...value };
    Object.keys(next).forEach((key) => {
      const result = replaceUploadReferencesDeep(next[key], oldUrl, newUrl);
      count += result.count;
      next[key] = result.value;
    });
    return { value: next, count };
  }
  return { value, count: 0 };
};

app.put("/api/uploads/rename", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const normalized = normalizeUploadUrl(req.body?.url);
  const requestedName = String(req.body?.newName || "").trim();
  if (!normalized) {
    return res.status(400).json({ error: "invalid_url" });
  }
  if (!requestedName) {
    return res.status(400).json({ error: "invalid_name" });
  }

  try {
    const uploadsDir = path.join(__dirname, "..", "public", "uploads");
    const parsed = new URL(normalized, PRIMARY_APP_ORIGIN);
    const pathname = decodeURIComponent(parsed.pathname || "");
    if (!pathname.startsWith("/uploads/")) {
      return res.status(400).json({ error: "invalid_path" });
    }
    const relativePath = pathname.replace(/^\/uploads\//, "");
    const oldFileName = path.basename(relativePath);
    const oldExt = path.extname(oldFileName).replace(".", "").toLowerCase();
    const oldFolder = path.dirname(relativePath).replace(/\\/g, "/").replace(/^\.$/, "");
    const safeBaseName = sanitizeUploadBaseName(requestedName);
    if (!safeBaseName) {
      return res.status(400).json({ error: "invalid_name" });
    }
    const nextFileName = `${safeBaseName}.${oldExt || "png"}`;
    if (nextFileName === oldFileName) {
      return res.json({ ok: true, oldUrl: normalized, newUrl: normalized, updatedReferences: 0 });
    }

    const oldFilePath = path.join(uploadsDir, relativePath);
    const nextRelativePath = `${oldFolder ? `${oldFolder}/` : ""}${nextFileName}`;
    const nextFilePath = path.join(uploadsDir, nextRelativePath);
    const resolvedOld = path.resolve(oldFilePath);
    const resolvedNew = path.resolve(nextFilePath);
    const uploadsRoot = path.resolve(uploadsDir);
    if (!resolvedOld.startsWith(uploadsRoot) || !resolvedNew.startsWith(uploadsRoot)) {
      return res.status(400).json({ error: "invalid_path" });
    }
    if (!fs.existsSync(resolvedOld)) {
      return res.status(404).json({ error: "not_found" });
    }
    if (fs.existsSync(resolvedNew)) {
      return res.status(409).json({ error: "name_conflict" });
    }
    fs.renameSync(resolvedOld, resolvedNew);

    const nextUrl = `/uploads/${nextRelativePath}`;
    const uploads = loadUploads();
    const uploadsNext = uploads.map((item) =>
      item.url === normalized
        ? {
            ...item,
            url: nextUrl,
            fileName: nextFileName,
            folder: oldFolder,
          }
        : item,
    );
    writeUploads(uploadsNext);

    const replacements = [];
    const pushResult = (key, result) => {
      if (result.count > 0) {
        replacements.push(`${key}:${result.count}`);
      }
    };

    const settingsResult = replaceUploadReferencesDeep(loadSiteSettings(), normalized, nextUrl);
    pushResult("settings", settingsResult);
    if (settingsResult.count > 0) {
      writeSiteSettings(settingsResult.value);
    }

    const postsResult = replaceUploadReferencesDeep(loadPosts(), normalized, nextUrl);
    pushResult("posts", postsResult);
    if (postsResult.count > 0) {
      writePosts(postsResult.value);
    }

    const projectsResult = replaceUploadReferencesDeep(loadProjects(), normalized, nextUrl);
    pushResult("projects", projectsResult);
    if (projectsResult.count > 0) {
      writeProjects(projectsResult.value);
    }

    const usersResult = replaceUploadReferencesDeep(loadUsers(), normalized, nextUrl);
    pushResult("users", usersResult);
    if (usersResult.count > 0) {
      writeUsers(usersResult.value);
    }

    const pagesResult = replaceUploadReferencesDeep(loadPages(), normalized, nextUrl);
    pushResult("pages", pagesResult);
    if (pagesResult.count > 0) {
      writePages(pagesResult.value);
    }

    const commentsResult = replaceUploadReferencesDeep(loadComments(), normalized, nextUrl);
    pushResult("comments", commentsResult);
    if (commentsResult.count > 0) {
      writeComments(commentsResult.value);
    }

    const updatesResult = replaceUploadReferencesDeep(loadUpdates(), normalized, nextUrl);
    pushResult("updates", updatesResult);
    if (updatesResult.count > 0) {
      writeUpdates(updatesResult.value);
    }

    const updatedReferences = [
      settingsResult.count,
      postsResult.count,
      projectsResult.count,
      usersResult.count,
      pagesResult.count,
      commentsResult.count,
      updatesResult.count,
    ].reduce((sum, value) => sum + value, 0);

    appendAuditLog(req, "uploads.rename", "uploads", {
      oldUrl: normalized,
      newUrl: nextUrl,
      updatedReferences,
      replacements,
    });

    return res.json({
      ok: true,
      oldUrl: normalized,
      newUrl: nextUrl,
      updatedReferences,
    });
  } catch {
    return res.status(500).json({ error: "rename_failed" });
  }
});

app.delete("/api/uploads/delete", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManageUploads(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const { url } = req.body || {};
  const normalized = normalizeUploadUrl(url);
  if (!normalized) {
    return res.status(400).json({ error: "invalid_url" });
  }

  const usedUrls = getUsedUploadUrls();
  if (usedUrls.has(normalized)) {
    return res.status(409).json({ error: "in_use" });
  }

  try {
    const uploadsDir = path.join(__dirname, "..", "public", "uploads");
    const parsed = new URL(normalized, PRIMARY_APP_ORIGIN);
    const pathname = decodeURIComponent(parsed.pathname || "");
    if (!pathname.startsWith("/uploads/")) {
      return res.status(400).json({ error: "invalid_path" });
    }
    const relativePath = pathname.replace(/^\/uploads\//, "");
    const targetPath = path.join(uploadsDir, relativePath);
    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(path.resolve(uploadsDir))) {
      return res.status(400).json({ error: "invalid_path" });
    }
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
    const uploads = loadUploads();
    const nextUploads = uploads.filter((item) => item.url !== normalized);
    if (nextUploads.length !== uploads.length) {
      writeUploads(nextUploads);
    }
    appendAuditLog(req, "uploads.delete", "uploads", { url: normalized });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "delete_failed" });
  }
});

app.post("/api/users", requireOwner, (req, res) => {
  const { id, name, phrase, bio, avatarUrl, avatarDisplay, socials, status, permissions, roles } = req.body || {};
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
    avatarDisplay: normalizeAvatarDisplay(avatarDisplay),
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
  appendAuditLog(req, "users.create", "users", { id: newUser.id });
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
  appendAuditLog(req, "users.reorder", "users", {});
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
    avatarDisplay:
      update.avatarDisplay !== undefined
        ? normalizeAvatarDisplay(update.avatarDisplay)
        : normalizeAvatarDisplay(existing.avatarDisplay),
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
  appendAuditLog(req, "users.update", "users", { id: targetId });
  return res.json({ user: applyOwnerRole(updated) });
});

app.delete("/api/users/:id", requireOwner, (req, res) => {
  const sessionUser = req.session.user;
  const targetId = String(req.params.id || "");
  const primaryOwnerId = getPrimaryOwnerId();

  if (!targetId) {
    return res.status(400).json({ error: "invalid_id" });
  }
  if (sessionUser?.id && String(sessionUser.id) === targetId) {
    return res.status(400).json({ error: "cannot_delete_self" });
  }
  if (primaryOwnerId && String(primaryOwnerId) === targetId) {
    return res.status(403).json({ error: "cannot_delete_primary_owner" });
  }
  if (isOwner(targetId) && !isPrimaryOwner(sessionUser?.id)) {
    return res.status(403).json({ error: "owner_delete_forbidden" });
  }

  let users = normalizeUsers(loadUsers());
  const index = users.findIndex((user) => user.id === targetId);
  if (index === -1) {
    return res.status(404).json({ error: "not_found" });
  }

  const removed = users[index];
  users = users.filter((user) => user.id !== targetId);

  const activeUsers = users.filter((user) => user.status === "active").sort((a, b) => a.order - b.order);
  const retiredUsers = users.filter((user) => user.status === "retired").sort((a, b) => a.order - b.order);
  let orderIndex = 0;
  const reordered = [
    ...activeUsers.map((user) => ({ ...user, order: orderIndex++ })),
    ...retiredUsers.map((user) => ({ ...user, order: orderIndex++ })),
  ];

  let nextOwnerIds = loadOwnerIds();
  if (nextOwnerIds.includes(targetId)) {
    nextOwnerIds = nextOwnerIds.filter((id) => id !== targetId);
    if (nextOwnerIds.length === 0 && primaryOwnerId) {
      nextOwnerIds = [String(primaryOwnerId)];
    }
    writeOwnerIds(nextOwnerIds);
  }

  const normalizedUsers = normalizeUsers(reordered).map((user) =>
    isOwner(user.id)
      ? { ...user, status: "active", permissions: ["*"] }
      : user,
  );
  normalizedUsers.sort((a, b) => a.order - b.order);
  writeUsers(normalizedUsers);
  syncAllowedUsers(normalizedUsers);
  appendAuditLog(req, "users.delete", "users", { id: targetId, wasOwner: isOwner(removed.id) });
  return res.json({ ok: true, ownerIds: loadOwnerIds() });
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
    avatarDisplay:
      update.avatarDisplay !== undefined
        ? normalizeAvatarDisplay(update.avatarDisplay)
        : normalizeAvatarDisplay(existing.avatarDisplay),
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
  appendAuditLog(req, "users.update_self", "users", { id: sessionUser.id });
  return res.json({ user: updated });
});

app.post("/api/logout", (req, res) => {
  appendAuditLog(req, "auth.logout", "auth", {});
  req.session?.destroy(() => undefined);
  res.clearCookie("rainbow.sid");
  res.json({ ok: true });
});

app.get(["/", "/projeto/:id", "/projeto/:id/leitura/:chapter", "/postagem/:slug"], (req, res) => {
  try {
    if (req.path.startsWith("/postagem/")) {
      const slug = String(req.params.slug || "");
      const post = normalizePosts(loadPosts()).find((item) => item.slug === slug);
      const meta = post ? buildPostMeta(post) : buildSiteMeta();
      return res.type("html").send(renderMetaHtml({ ...meta, url: `${PRIMARY_APP_ORIGIN}${req.path}` }));
    }
    if (req.path.startsWith("/projeto/")) {
      const id = String(req.params.id || "");
      const project = normalizeProjects(loadProjects()).find((item) => String(item.id) === id);
      const meta = project ? buildProjectMeta(project) : buildSiteMeta();
      return res.type("html").send(renderMetaHtml({ ...meta, url: `${PRIMARY_APP_ORIGIN}${req.path}` }));
    }
    const meta = buildSiteMeta();
    return res.type("html").send(renderMetaHtml({ ...meta, url: `${PRIMARY_APP_ORIGIN}${req.path}` }));
  } catch {
    return res.type("html").send(getIndexHtml());
  }
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/auth")) {
    return res.status(404).json({ error: "not_found" });
  }
  try {
    const settings = loadSiteSettings();
    const meta = buildSiteMetaWithSettings(settings);
    const siteName = settings.site?.name || "Nekomata";
    const separator = settings.site?.titleSeparator ?? "";
    const pageTitle = getPageTitleFromPath(req.path);
    const title = pageTitle ? `${pageTitle}${separator}${siteName}` : siteName;
    return res
      .type("html")
      .send(renderMetaHtml({ ...meta, title, url: `${PRIMARY_APP_ORIGIN}${req.path}` }));
  } catch {
    return res.type("html").send(getIndexHtml());
  }
});

app.listen(Number(PORT));
