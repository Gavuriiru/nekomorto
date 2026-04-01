import fs from "fs";
import path from "path";
import {
  getUsedUploadUrls,
  resolveProjectLibraryFolders,
  resolveProjectRootFolder,
} from "./upload-route-utils.js";
import { normalizeUploadUrl } from "../../lib/uploads-reorganizer.js";

export const registerUploadListingRoutes = (deps) => {
  const {
    app,
    canManageUploads,
    createSlug,
    getUploadMimeFromExtension,
    isUploadFolderAllowedInScope,
    loadComments,
    loadLinkTypes,
    loadPages,
    loadPosts,
    loadProjects,
    loadSiteSettings,
    loadUpdates,
    loadUploads,
    loadUsers,
    normalizeProjects,
    normalizeVariants,
    normalizeUploadScopeUserId,
    readUploadAltText,
    readUploadFocalState,
    readUploadSlot,
    readUploadSlotManaged,
    readUploadStorageProvider,
    resolveRequestUploadAccessScope,
    sanitizeUploadFolder,
  } = deps;

  app.get("/api/uploads/list", deps.requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    const folder = typeof req.query.folder === "string" ? req.query.folder.trim() : "";
    const requestedIncludeUrls = Array.isArray(req.query.includeUrl)
      ? req.query.includeUrl
      : [req.query.includeUrl];
    const includedUploadUrls = new Set(
      requestedIncludeUrls.map((value) => normalizeUploadUrl(value)).filter(Boolean),
    );
    const scopeUserId = normalizeUploadScopeUserId(req.query.scopeUserId);
    const listAll = folder === "__all__";
    const safeFolder = listAll ? "" : sanitizeUploadFolder(folder);
    const uploadAccessScope = resolveRequestUploadAccessScope({
      sessionUser,
      folder: safeFolder,
      listAll,
      scopeUserId,
    });
    if (!uploadAccessScope.allowed) {
      return res.status(403).json({ error: "forbidden" });
    }
    const uploadsDir = deps.PUBLIC_UPLOADS_DIR;
    const recursive = String(req.query.recursive || "")
      .trim()
      .toLowerCase();
    const listRecursively =
      listAll || (Boolean(folder) && (recursive === "1" || recursive === "true"));
    try {
      const normalizedProjects = normalizeProjects(loadProjects());
      const projectTitleByRoot = new Map(
        normalizedProjects
          .map((project) => {
            const projectRootFolder = resolveProjectLibraryFolders({
              createSlug,
              project,
            }).projectRootFolder;
            return [projectRootFolder, String(project?.title || "").trim()];
          })
          .filter(([projectRootFolder, projectTitle]) =>
            Boolean(projectRootFolder && projectTitle),
          ),
      );
      const usedUrls = getUsedUploadUrls({
        loadComments,
        loadLinkTypes,
        loadPages,
        loadPosts,
        loadProjects: () => normalizedProjects,
        loadSiteSettings,
        loadUpdates,
        loadUsers,
      });
      const uploadMeta = loadUploads();
      const uploadMetaMap = new Map(
        uploadMeta
          .map((item) => [normalizeUploadUrl(item?.url), item])
          .filter(([key]) => Boolean(key)),
      );
      const matchesFolder = (resolvedFolder) => {
        const normalizedFolder = String(resolvedFolder || "").trim();
        if (listAll) {
          return true;
        }
        if (listRecursively) {
          if (!safeFolder) {
            return true;
          }
          return normalizedFolder === safeFolder || normalizedFolder.startsWith(`${safeFolder}/`);
        }
        return normalizedFolder === safeFolder;
      };
      const shouldIncludeUploadUrl = (normalizedUrl, resolvedFolder) => {
        if (!isUploadFolderAllowedInScope(resolvedFolder, uploadAccessScope)) {
          return false;
        }
        if (includedUploadUrls.has(normalizedUrl)) {
          return true;
        }
        return matchesFolder(resolvedFolder);
      };
      const metadataFiles = uploadMeta
        .map((meta) => {
          const normalizedUrl = normalizeUploadUrl(meta?.url);
          if (!normalizedUrl) {
            return null;
          }
          const relative = normalizedUrl.replace(/^\/uploads\//, "");
          const resolvedFolder =
            meta?.folder ?? path.dirname(relative).replace(/\\/g, "/").replace(/^\.$/, "");
          if (!shouldIncludeUploadUrl(normalizedUrl, resolvedFolder)) {
            return null;
          }
          const inUse = usedUrls.has(normalizedUrl);
          const focalState = readUploadFocalState(meta);
          const projectRootFolder = resolveProjectRootFolder(resolvedFolder);
          const projectId = projectRootFolder ? String(projectRootFolder.split("/")[1] || "") : "";
          const projectTitle = projectTitleByRoot.get(projectRootFolder) || "";
          return {
            id: meta?.id || null,
            name: meta?.fileName || path.basename(relative),
            url: normalizedUrl,
            source: "upload",
            folder: resolvedFolder,
            fileName: meta?.fileName || path.basename(relative),
            mime:
              meta?.mime ||
              getUploadMimeFromExtension(path.extname(path.basename(relative)).replace(".", "")),
            size: typeof meta?.size === "number" ? meta.size : null,
            createdAt: meta?.createdAt || null,
            width: typeof meta?.width === "number" ? meta.width : null,
            height: typeof meta?.height === "number" ? meta.height : null,
            hashSha256: typeof meta?.hashSha256 === "string" ? meta.hashSha256 : "",
            focalCrops: focalState.focalCrops,
            focalPoints: focalState.focalPoints,
            focalPoint: focalState.focalPoint,
            variantsVersion: Number.isFinite(Number(meta?.variantsVersion))
              ? Number(meta.variantsVersion)
              : 1,
            variants: normalizeVariants(meta?.variants),
            variantBytes: Number.isFinite(Number(meta?.variantBytes))
              ? Number(meta.variantBytes)
              : 0,
            area:
              typeof meta?.area === "string" && meta.area
                ? meta.area
                : String((resolvedFolder || "").split("/")[0] || "root"),
            altText: readUploadAltText(meta),
            slot: readUploadSlot(meta) || undefined,
            slotManaged: readUploadSlotManaged(meta),
            storageProvider: readUploadStorageProvider(meta, "local"),
            projectId,
            projectTitle,
            inUse,
            canDelete: !inUse,
          };
        })
        .filter(Boolean);
      const seenUrls = new Set(metadataFiles.map((item) => String(item?.url || "")));
      const collectLooseLocalFiles = (dir, base) => {
        if (!fs.existsSync(dir)) {
          return [];
        }
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
          const fullPath = path.join(dir, entry.name);
          const nextBase = path.join(base, entry.name);
          const normalizedBase = nextBase.split(path.sep).join("/");
          if (normalizedBase === "_variants" || normalizedBase.startsWith("_variants/")) {
            return [];
          }
          if (entry.isDirectory()) {
            if (!isUploadFolderAllowedInScope(normalizedBase, uploadAccessScope)) {
              return [];
            }
            return collectLooseLocalFiles(fullPath, nextBase);
          }
          if (!/\.(png|jpe?g|gif|webp|svg(\+xml)?)$/i.test(entry.name)) {
            return [];
          }
          const relative = normalizedBase;
          const url = `/uploads/${relative}`;
          const normalizedUrl = normalizeUploadUrl(url) || url;
          if (seenUrls.has(normalizedUrl) || uploadMetaMap.has(normalizedUrl)) {
            return [];
          }
          const resolvedFolder = path.dirname(relative).replace(/\\/g, "/").replace(/^\.$/, "");
          if (!shouldIncludeUploadUrl(normalizedUrl, resolvedFolder)) {
            return [];
          }
          const stat = fs.statSync(fullPath);
          const inUse = usedUrls.has(normalizedUrl);
          const projectRootFolder = resolveProjectRootFolder(resolvedFolder);
          const projectId = projectRootFolder ? String(projectRootFolder.split("/")[1] || "") : "";
          const projectTitle = projectTitleByRoot.get(projectRootFolder) || "";
          return [
            {
              id: null,
              name: entry.name,
              url: normalizedUrl,
              source: "upload",
              folder: resolvedFolder,
              fileName: entry.name,
              mime: getUploadMimeFromExtension(path.extname(entry.name).replace(".", "")),
              size: stat.size,
              createdAt: stat.mtime.toISOString(),
              width: null,
              height: null,
              hashSha256: "",
              focalCrops: undefined,
              focalPoints: undefined,
              focalPoint: undefined,
              variantsVersion: 1,
              variants: {},
              variantBytes: 0,
              area: String((resolvedFolder || "").split("/")[0] || "root"),
              altText: "",
              slot: undefined,
              slotManaged: false,
              storageProvider: "local",
              projectId,
              projectTitle,
              inUse,
              canDelete: !inUse,
            },
          ];
        });
      };
      const looseLocalFiles = collectLooseLocalFiles(uploadsDir, "");
      const files = [...metadataFiles, ...looseLocalFiles].sort((left, right) =>
        String(left.url || "").localeCompare(String(right.url || ""), "en"),
      );
      return res.json({ files });
    } catch {
      return res.json({ files: [] });
    }
  });
};
