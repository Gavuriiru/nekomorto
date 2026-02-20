import fs from "fs";
import path from "path";

const rootDir = path.resolve(process.cwd());
const dataDir = path.join(rootDir, "server", "data");

const files = [
  "posts.json",
  "projects.json",
  "users.json",
  "site-settings.json",
  "pages.json",
  "comments.json",
  "updates.json",
  "tag-translations.json",
  "link-types.json",
  "uploads.json",
];

const issues = [];

const addIssue = (level, file, fieldPath, message) => {
  issues.push({ level, file, fieldPath, message });
};

const toUploadsPath = (value) => {
  if (!value || typeof value !== "string") return null;
  if (value.startsWith("/uploads/")) {
    return value.split("?")[0].split("#")[0];
  }
  if (value.includes("/uploads/")) {
    const idx = value.indexOf("/uploads/");
    return value.slice(idx).split("?")[0].split("#")[0];
  }
  return null;
};

const readJson = (fileName) => {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    return JSON.parse(sanitized);
  } catch (error) {
    try {
      const raw = fs.readFileSync(filePath);
      const fallback = Buffer.from(raw).toString("latin1").replace(/^\uFEFF/, "");
      return JSON.parse(fallback);
    } catch (fallbackError) {
      addIssue(
        "error",
        fileName,
        "",
        `JSON invalido: ${fallbackError.message}`,
      );
      return null;
    }
  }
};

const isIsoDate = (value) => {
  if (!value || typeof value !== "string") return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(value);
};

const isPrivateHost = (hostname) => {
  if (!hostname) return false;
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1") return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(lower)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(lower)) return true;
  if (lower.endsWith(".ngrok-free.app") || lower.endsWith(".ngrok.io")) return true;
  return false;
};

const extractUrls = (value) => {
  if (!value || typeof value !== "string") return [];
  const matches = value.match(/https?:\/\/[^\s"'()<>]+/gi);
  return matches || [];
};

const normalizeUploadsAbsolute = (url) => {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("/uploads/")) return null;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;
  return url;
};

const walkForUrls = (value, fileName, basePath = "") => {
  if (typeof value === "string") {
    extractUrls(value).forEach((url) => {
      if (normalizeUploadsAbsolute(url)) {
        addIssue("warning", fileName, basePath, `URL absoluta de upload: ${url}`);
      }
      try {
        const parsed = new URL(url);
        if (isPrivateHost(parsed.hostname)) {
          addIssue("warning", fileName, basePath, `URL com host privado: ${url}`);
        }
      } catch {
        // ignore
      }
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForUrls(item, fileName, `${basePath}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      const nextPath = basePath ? `${basePath}.${key}` : key;
      walkForUrls(item, fileName, nextPath);
    });
  }
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const validatePosts = (posts, fileName) => {
  if (!Array.isArray(posts)) {
    addIssue("error", fileName, "", "Posts nao e um array");
    return;
  }
  const ids = new Set();
  const slugs = new Set();
  posts.forEach((post, index) => {
    const base = `[${index}]`;
    if (!post?.id) {
      addIssue("error", fileName, `${base}.id`, "id ausente");
    } else if (typeof post.id !== "string") {
      addIssue("warning", fileName, `${base}.id`, "id nao e string");
    } else if (ids.has(String(post.id))) {
      addIssue("error", fileName, `${base}.id`, `id duplicado: ${post.id}`);
    } else {
      ids.add(String(post.id));
    }
    if (!post?.slug) {
      addIssue("error", fileName, `${base}.slug`, "slug ausente");
    } else if (slugs.has(String(post.slug))) {
      addIssue("error", fileName, `${base}.slug`, `slug duplicado: ${post.slug}`);
    } else {
      slugs.add(String(post.slug));
    }
    if (!post?.title) {
      addIssue("warning", fileName, `${base}.title`, "title vazio");
    }
    if (post?.publishedAt && !isIsoDate(post.publishedAt)) {
      addIssue("warning", fileName, `${base}.publishedAt`, "data invalida");
    }
    if (post?.createdAt && !isIsoDate(post.createdAt)) {
      addIssue("warning", fileName, `${base}.createdAt`, "data invalida");
    }
    if (post?.updatedAt && !isIsoDate(post.updatedAt)) {
      addIssue("warning", fileName, `${base}.updatedAt`, "data invalida");
    }
    if (post?.status && !["draft", "scheduled", "published"].includes(post.status)) {
      addIssue("warning", fileName, `${base}.status`, `status invalido: ${post.status}`);
    }
    if (post?.contentFormat && !["markdown", "html", "lexical"].includes(post.contentFormat)) {
      addIssue("warning", fileName, `${base}.contentFormat`, `contentFormat invalido: ${post.contentFormat}`);
    }
    if (normalizeUploadsAbsolute(post?.coverImageUrl)) {
      addIssue("warning", fileName, `${base}.coverImageUrl`, "coverImageUrl absoluto em /uploads");
    }
  });
};

const validateProjects = (projects, fileName) => {
  if (!Array.isArray(projects)) {
    addIssue("error", fileName, "", "Projects nao e um array");
    return;
  }
  const ids = new Set();
  projects.forEach((project, index) => {
    const base = `[${index}]`;
    if (!project?.id) {
      addIssue("error", fileName, `${base}.id`, "id ausente");
    } else if (typeof project.id !== "string") {
      addIssue("warning", fileName, `${base}.id`, "id nao e string");
    } else if (ids.has(String(project.id))) {
      addIssue("error", fileName, `${base}.id`, `id duplicado: ${project.id}`);
    } else {
      ids.add(String(project.id));
    }
    if (!project?.title) {
      addIssue("warning", fileName, `${base}.title`, "title vazio");
    }
    if (normalizeUploadsAbsolute(project?.cover)) {
      addIssue("warning", fileName, `${base}.cover`, "cover absoluto em /uploads");
    }
    if (normalizeUploadsAbsolute(project?.banner)) {
      addIssue("warning", fileName, `${base}.banner`, "banner absoluto em /uploads");
    }
    if (project?.createdAt && !isIsoDate(project.createdAt)) {
      addIssue("warning", fileName, `${base}.createdAt`, "data invalida");
    }
    if (project?.updatedAt && !isIsoDate(project.updatedAt)) {
      addIssue("warning", fileName, `${base}.updatedAt`, "data invalida");
    }
    ensureArray(project?.episodeDownloads).forEach((episode, epIndex) => {
      const epBase = `${base}.episodeDownloads[${epIndex}]`;
      if (normalizeUploadsAbsolute(episode?.coverImageUrl)) {
        addIssue("warning", fileName, `${epBase}.coverImageUrl`, "coverImageUrl absoluto em /uploads");
      }
      if (episode?.releaseDate && !isIsoDate(episode.releaseDate)) {
        addIssue("warning", fileName, `${epBase}.releaseDate`, "data invalida");
      }
      if (
        episode?.contentFormat &&
        !["markdown", "html", "lexical"].includes(String(episode.contentFormat))
      ) {
        addIssue(
          "warning",
          fileName,
          `${epBase}.contentFormat`,
          `contentFormat invalido: ${episode.contentFormat}`,
        );
      }
      if (episode?.hash !== undefined && typeof episode.hash !== "string") {
        addIssue("warning", fileName, `${epBase}.hash`, "hash nao e string");
      }
      if (episode?.sizeBytes !== undefined) {
        if (typeof episode.sizeBytes !== "number" || !Number.isFinite(episode.sizeBytes)) {
          addIssue("warning", fileName, `${epBase}.sizeBytes`, "sizeBytes nao e numero");
        } else if (episode.sizeBytes <= 0) {
          addIssue("warning", fileName, `${epBase}.sizeBytes`, "sizeBytes deve ser positivo");
        }
      }
      ensureArray(episode?.sources).forEach((source, sIndex) => {
        if (source?.url && typeof source.url !== "string") {
          addIssue("warning", fileName, `${epBase}.sources[${sIndex}].url`, "url nao e string");
        }
        if (source?.label && (!source?.url || String(source.url).trim().length === 0)) {
          addIssue("warning", fileName, `${epBase}.sources[${sIndex}].url`, "source com label sem url");
        }
      });
    });
    ensureArray(project?.relations).forEach((relation, relIndex) => {
      if (relation?.projectId && typeof relation.projectId !== "string") {
        addIssue(
          "warning",
          fileName,
          `${base}.relations[${relIndex}].projectId`,
          "projectId nao e string",
        );
      }
    });
  });
};

const validateUsers = (users, fileName) => {
  if (!Array.isArray(users)) {
    addIssue("error", fileName, "", "Users nao e um array");
    return;
  }
  const ids = new Set();
  const knownPermissions = new Set([
    "*",
    "posts",
    "projetos",
    "comentarios",
    "usuarios",
    "usuarios_basico",
    "usuarios_acesso",
    "paginas",
    "uploads",
    "analytics",
    "configuracoes",
    "audit_log",
    "integracoes",
  ]);
  users.forEach((user, index) => {
    const base = `[${index}]`;
    if (!user?.id) {
      addIssue("error", fileName, `${base}.id`, "id ausente");
    } else if (typeof user.id !== "string") {
      addIssue("warning", fileName, `${base}.id`, "id nao e string");
    } else if (ids.has(String(user.id))) {
      addIssue("error", fileName, `${base}.id`, `id duplicado: ${user.id}`);
    } else {
      ids.add(String(user.id));
    }
    if (!user?.name) {
      addIssue("warning", fileName, `${base}.name`, "name vazio");
    }
    ensureArray(user?.permissions).forEach((permission, pIndex) => {
      if (!knownPermissions.has(String(permission))) {
        addIssue(
          "warning",
          fileName,
          `${base}.permissions[${pIndex}]`,
          `permissao desconhecida: ${permission}`,
        );
      }
    });
    if (normalizeUploadsAbsolute(user?.avatarUrl)) {
      addIssue("warning", fileName, `${base}.avatarUrl`, "avatarUrl absoluto em /uploads");
    }
    if (normalizeUploadsAbsolute(user?.coverImageUrl)) {
      addIssue("warning", fileName, `${base}.coverImageUrl`, "coverImageUrl absoluto em /uploads");
    }
  });
};

const validateComments = (comments, fileName) => {
  if (!Array.isArray(comments)) {
    addIssue("error", fileName, "", "Comments nao e um array");
    return;
  }
  comments.forEach((comment, index) => {
    const base = `[${index}]`;
    if (!comment?.id) {
      addIssue("warning", fileName, `${base}.id`, "id ausente");
    } else if (typeof comment.id !== "string") {
      addIssue("warning", fileName, `${base}.id`, "id nao e string");
    }
    if (comment?.createdAt && !isIsoDate(comment.createdAt)) {
      addIssue("warning", fileName, `${base}.createdAt`, "data invalida");
    }
    if (comment?.status && !["pending", "approved", "rejected"].includes(comment.status)) {
      addIssue("warning", fileName, `${base}.status`, `status invalido: ${comment.status}`);
    }
  });
};

const validateReferences = (posts, projects, comments, fileName) => {
  const projectIds = new Set(ensureArray(projects).map((project) => String(project.id)));
  ensureArray(posts).forEach((post, index) => {
    if (post?.projectId && !projectIds.has(String(post.projectId))) {
      addIssue("warning", fileName, `[${index}].projectId`, `projectId nao existe: ${post.projectId}`);
    }
  });
  const postSlugs = new Set(ensureArray(posts).map((post) => String(post.slug)));
  ensureArray(comments).forEach((comment, index) => {
    if (comment?.targetType === "post" && comment?.targetId && !postSlugs.has(String(comment.targetId))) {
      addIssue(
        "warning",
        fileName,
        `[${index}].targetId`,
        `comentario aponta para post inexistente: ${comment.targetId}`,
      );
    }
    if (comment?.targetType === "project" && comment?.targetId && !projectIds.has(String(comment.targetId))) {
      addIssue(
        "warning",
        fileName,
        `[${index}].targetId`,
        `comentario aponta para projeto inexistente: ${comment.targetId}`,
      );
    }
  });
  ensureArray(projects).forEach((project, index) => {
    ensureArray(project?.relations).forEach((relation, relIndex) => {
      if (relation?.projectId && !projectIds.has(String(relation.projectId))) {
        addIssue(
          "warning",
          fileName,
          `[${index}].relations[${relIndex}].projectId`,
          `relacao aponta para projeto inexistente: ${relation.projectId}`,
        );
      }
    });
  });
};

const validateUpdates = (updates, fileName) => {
  if (!Array.isArray(updates)) {
    addIssue("error", fileName, "", "Updates nao e um array");
    return;
  }
  updates.forEach((update, index) => {
    const base = `[${index}]`;
    if (update?.createdAt && !isIsoDate(update.createdAt)) {
      addIssue("warning", fileName, `${base}.createdAt`, "data invalida");
    }
    if (update?.updatedAt && !isIsoDate(update.updatedAt)) {
      addIssue("warning", fileName, `${base}.updatedAt`, "data invalida");
    }
    if (update?.id && typeof update.id !== "string") {
      addIssue("warning", fileName, `${base}.id`, "id nao e string");
    }
    if (normalizeUploadsAbsolute(update?.image)) {
      addIssue("warning", fileName, `${base}.image`, "image absoluto em /uploads");
    }
  });
};

const validatePages = (pages, fileName) => {
  if (!pages || typeof pages !== "object") {
    addIssue("error", fileName, "", "Pages nao e um objeto");
    return;
  }
};

const validateSiteSettings = (settings, fileName) => {
  if (!settings || typeof settings !== "object") {
    addIssue("error", fileName, "", "Site settings nao e um objeto");
    return;
  }
  if (normalizeUploadsAbsolute(settings?.site?.logoUrl)) {
    addIssue("warning", fileName, "site.logoUrl", "logoUrl absoluto em /uploads");
  }
  if (normalizeUploadsAbsolute(settings?.site?.faviconUrl)) {
    addIssue("warning", fileName, "site.faviconUrl", "faviconUrl absoluto em /uploads");
  }
  if (normalizeUploadsAbsolute(settings?.site?.defaultShareImage)) {
    addIssue("warning", fileName, "site.defaultShareImage", "defaultShareImage absoluto em /uploads");
  }
};

const validateLinkTypes = (items, fileName) => {
  if (!Array.isArray(items)) {
    addIssue("error", fileName, "", "Link types nao e um array");
  }
};

const validateUploads = (uploads, fileName) => {
  if (!Array.isArray(uploads)) {
    addIssue("error", fileName, "", "Uploads nao e um array");
    return;
  }
  const maxBytes = 15 * 1024 * 1024;
  uploads.forEach((item, index) => {
    const base = `[${index}]`;
    if (!item?.url || typeof item.url !== "string") {
      addIssue("warning", fileName, `${base}.url`, "url ausente");
      return;
    }
    if (item.url.startsWith("http://") || item.url.startsWith("https://")) {
      addIssue("warning", fileName, `${base}.url`, "url deveria ser relativa (/uploads/...)");
    }
    if (typeof item.size === "number" && item.size > maxBytes) {
      addIssue(
        "warning",
        fileName,
        `${base}.size`,
        `arquivo acima do limite (${item.size} bytes)`,
      );
    }
    if (item?.createdAt && !isIsoDate(item.createdAt)) {
      addIssue("warning", fileName, `${base}.createdAt`, "data invalida");
    }
  });
};

const validateTagTranslations = (payload, fileName) => {
  if (!payload || typeof payload !== "object") {
    addIssue("error", fileName, "", "Tag translations nao e um objeto");
  }
};

const run = () => {
  const postsData = readJson("posts.json");
  const projectsData = readJson("projects.json");
  const commentsData = readJson("comments.json");
  const usersData = readJson("users.json");
  const pagesData = readJson("pages.json");
  const settingsData = readJson("site-settings.json");
  files.forEach((fileName) => {
    const data = readJson(fileName);
    if (data === null) return;
    walkForUrls(data, fileName);
    switch (fileName) {
      case "posts.json":
        validatePosts(data, fileName);
        break;
      case "projects.json":
        validateProjects(data, fileName);
        break;
      case "users.json":
        validateUsers(data, fileName);
        break;
      case "comments.json":
        validateComments(data, fileName);
        break;
      case "updates.json":
        validateUpdates(data, fileName);
        break;
      case "pages.json":
        validatePages(data, fileName);
        break;
      case "site-settings.json":
        validateSiteSettings(data, fileName);
        break;
      case "tag-translations.json":
        validateTagTranslations(data, fileName);
        break;
      case "link-types.json":
        validateLinkTypes(data, fileName);
        break;
      case "uploads.json":
        validateUploads(data, fileName);
        break;
      default:
        break;
    }
  });

  if (postsData && projectsData && commentsData) {
    validateReferences(postsData, projectsData, commentsData, "references");
  }

  const uploadPathsInData = new Set();
  [postsData, projectsData, commentsData, usersData, pagesData, settingsData].forEach((dataset) => {
    if (dataset === null || dataset === undefined) return;
    const collect = (value) => {
      if (!value) return;
      if (typeof value === "string") {
        const asPath = toUploadsPath(value);
        if (asPath) {
          uploadPathsInData.add(asPath);
        }
        extractUrls(value).forEach((url) => {
          const path = toUploadsPath(url);
          if (path) uploadPathsInData.add(path);
        });
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => collect(item));
        return;
      }
      if (typeof value === "object") {
        Object.values(value).forEach((item) => collect(item));
      }
    };
    collect(dataset);
  });

  try {
    const uploadsDir = path.join(rootDir, "public", "uploads");
    if (fs.existsSync(uploadsDir)) {
      const listFiles = (dir, base = "") => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const results = [];
        entries.forEach((entry) => {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results.push(...listFiles(full, path.join(base, entry.name)));
          } else {
            results.push({
              path: `/uploads/${path.join(base, entry.name).split(path.sep).join("/")}`,
              size: fs.statSync(full).size,
            });
          }
        });
        return results;
      };
      const filesOnDisk = listFiles(uploadsDir);
      const orphans = filesOnDisk.filter((item) => !uploadPathsInData.has(item.path));
      orphans.forEach((item) => {
        addIssue("warning", "uploads-orphans", item.path, "arquivo sem referencia");
      });
      const maxBytes = 15 * 1024 * 1024;
      filesOnDisk
        .filter((item) => item.size > maxBytes)
        .forEach((item) => {
          addIssue("warning", "uploads-size", item.path, `arquivo acima do limite (${item.size} bytes)`);
        });
    }
  } catch (error) {
    addIssue("warning", "uploads-scan", "", `falha ao escanear uploads: ${error.message}`);
  }

  const errors = issues.filter((item) => item.level === "error");
  const warnings = issues.filter((item) => item.level === "warning");

  const printGroup = (title, list) => {
    if (!list.length) return;
    console.log(`\n${title} (${list.length})`);
    list.forEach((item) => {
      const location = item.fieldPath ? `${item.file}:${item.fieldPath}` : item.file;
      console.log(`- ${location}: ${item.message}`);
    });
  };

  if (!issues.length) {
    console.log("Sem problemas encontrados.");
    return;
  }

  printGroup("ERROS", errors);
  printGroup("AVISOS", warnings);

  if (errors.length) {
    process.exitCode = 1;
  }
};

run();
