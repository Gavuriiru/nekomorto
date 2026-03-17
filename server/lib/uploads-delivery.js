import fs from "fs";
import path from "path";
import {
  getUploadAssetDescriptors,
  isUploadStorageNotFoundError,
  normalizeUploadUrlToRelativePath,
  readUploadStorageProvider,
} from "./upload-storage.js";

const resolveRequestUploadUrl = (req) => {
  const rawUrl = String(req.originalUrl || req.url || "").trim();
  if (!rawUrl) {
    return "";
  }
  try {
    const parsed = new URL(rawUrl, "https://nekomata.local");
    const pathname = decodeURIComponent(parsed.pathname || "");
    return pathname.startsWith("/uploads/") ? pathname : "";
  } catch {
    return "";
  }
};

const isPathInsideRoot = (rootPath, targetPath) => {
  const safeRoot = path.resolve(rootPath);
  const safeTarget = path.resolve(targetPath);
  const relative = path.relative(safeRoot, safeTarget);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const findUploadEntryForUrl = (uploads, normalizedUrl) => {
  const items = Array.isArray(uploads) ? uploads : [];
  const exactEntry = items.find((item) => String(item?.url || "").trim() === normalizedUrl);
  if (exactEntry) {
    return exactEntry;
  }
  return (
    items.find((item) =>
      getUploadAssetDescriptors(item).some(
        (asset) => String(asset?.url || "").trim() === normalizedUrl,
      ),
    ) || null
  );
};

export const createUploadsDeliveryMiddleware = ({
  uploadsDir,
  loadUploads,
  storageService,
  defaultCacheControl = "public, max-age=0, must-revalidate",
} = {}) => {
  const uploadsRoot = path.resolve(
    String(uploadsDir || path.join(process.cwd(), "public", "uploads")),
  );

  return async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }

    const normalizedUrl = resolveRequestUploadUrl(req);
    if (!normalizedUrl) {
      return next();
    }
    if (normalizedUrl.startsWith("/uploads/_quarantine/")) {
      return res.status(404).end();
    }

    const uploads = typeof loadUploads === "function" ? loadUploads() : [];
    const entry = findUploadEntryForUrl(uploads, normalizedUrl);
    if (!entry) {
      return next();
    }

    const provider = readUploadStorageProvider(entry, "local");
    if (provider === "local") {
      const relativePath = normalizeUploadUrlToRelativePath(normalizedUrl);
      if (!relativePath) {
        return next();
      }
      const targetPath = path.resolve(path.join(uploadsRoot, relativePath));
      if (!isPathInsideRoot(uploadsRoot, targetPath) || !fs.existsSync(targetPath)) {
        return next();
      }
      if (String(defaultCacheControl || "").trim()) {
        res.setHeader("Cache-Control", defaultCacheControl);
      }
      return res.sendFile(targetPath);
    }

    try {
      const response = await storageService.getUploadStream({
        provider,
        uploadUrl: normalizedUrl,
      });
      if (String(response?.contentType || "").trim()) {
        res.setHeader("Content-Type", response.contentType);
      }
      if (
        Number.isFinite(Number(response?.contentLength)) &&
        Number(response?.contentLength) >= 0
      ) {
        res.setHeader("Content-Length", String(Number(response.contentLength)));
      }
      res.setHeader(
        "Cache-Control",
        String(response?.cacheControl || "").trim() || String(defaultCacheControl || "").trim(),
      );
      if (response?.lastModified instanceof Date) {
        res.setHeader("Last-Modified", response.lastModified.toUTCString());
      }
      if (req.method === "HEAD") {
        return res.status(200).end();
      }
      response.stream.on("error", (error) => {
        if (!res.headersSent) {
          next(error);
        } else {
          res.destroy(error);
        }
      });
      response.stream.pipe(res);
      return undefined;
    } catch (error) {
      if (isUploadStorageNotFoundError(error)) {
        return next();
      }
      return next(error);
    }
  };
};
