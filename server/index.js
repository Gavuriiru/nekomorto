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

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !SESSION_SECRET) {
  // eslint-disable-next-line no-console
  console.warn("Missing DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, or SESSION_SECRET in env.");
}

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: APP_ORIGIN,
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
      secure: APP_ORIGIN.startsWith("https://"),
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

const createSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizePosts = (posts) => {
  const now = Date.now();
  return posts.map((post, index) => {
    const id = String(post.id || `${Date.now()}-${index}`);
    const title = String(post.title || "Sem tÃ­tulo");
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
      views: Number.isFinite(post.views) ? post.views : 0,
      commentsCount: Number.isFinite(post.commentsCount) ? post.commentsCount : 0,
      createdAt: post.createdAt || new Date().toISOString(),
      updatedAt: post.updatedAt || post.createdAt || new Date().toISOString(),
    };
  });
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
    return res.redirect(`${APP_ORIGIN}/login?error=missing_code`);
  }

  if (!state || typeof state !== "string" || state !== req.session?.oauthState) {
    return res.redirect(`${APP_ORIGIN}/login?error=state_mismatch`);
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
      return res.redirect(`${APP_ORIGIN}/login?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();

    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: {
        authorization: `${tokenData.token_type} ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      return res.redirect(`${APP_ORIGIN}/login?error=user_fetch_failed`);
    }

    const discordUser = await userResponse.json();
    const allowedUsers = loadAllowedUsers();
    const isAllowed = allowedUsers.includes(discordUser.id);

    if (!isAllowed) {
      if (req.session) {
        req.session.destroy(() => undefined);
      }
      return res.redirect(`${APP_ORIGIN}/login?error=unauthorized`);
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
    return res.redirect(next ? `${APP_ORIGIN}${next}` : `${APP_ORIGIN}/dashboard`);
  } catch {
    return res.redirect(`${APP_ORIGIN}/login?error=server_error`);
  }
});

app.get("/api/me", (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  ensureOwnerUser(req.session.user);
  return res.json(req.session.user);
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
    },
  });
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

app.post("/api/uploads/image", requireAuth, (req, res) => {
  const sessionUser = req.session.user;
  if (!canManagePosts(sessionUser?.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const { dataUrl, filename } = req.body || {};
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
  fs.mkdirSync(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, buffer);

  return res.json({
    url: `${APP_ORIGIN}/uploads/${fileName}`,
    fileName,
  });
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

app.put("/api/users/reorder", requireOwner, (req, res) => {
  const { orderedIds } = req.body || {};
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "orderedIds_required" });
  }

  let users = normalizeUsers(loadUsers());
  const orderMap = new Map(orderedIds.map((id, index) => [String(id), index]));
  users = users.map((user) => {
    if (user.status !== "active" || !orderMap.has(user.id)) {
      return user;
    }
    return { ...user, order: orderMap.get(user.id) };
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
  // eslint-disable-next-line no-console
  console.log(`Auth server running on http://127.0.0.1:${PORT}`);
});
