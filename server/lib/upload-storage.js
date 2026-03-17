import fs from "fs";
import path from "path";
import { Readable } from "node:stream";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const UPLOAD_STORAGE_PROVIDER_LOCAL = "local";
export const UPLOAD_STORAGE_PROVIDER_S3 = "s3";
export const UPLOAD_STORAGE_PROVIDER_VALUES = Object.freeze([
  UPLOAD_STORAGE_PROVIDER_LOCAL,
  UPLOAD_STORAGE_PROVIDER_S3,
]);
export const UPLOAD_STORAGE_DELIVERY_PROXY = "proxy";

const SAFE_ORIGIN = "https://nekomata.local";
const DEFAULT_S3_MAX_KEYS = 1000;
const DEFAULT_IMAGE_CONTENT_TYPE = "application/octet-stream";

const EXTENSION_TO_CONTENT_TYPE = Object.freeze({
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
});

const ensureTrailingSlash = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
};

const trimSlashes = (value) =>
  String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

const toPosix = (value) => String(value || "").replace(/\\/g, "/");

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const resolveContentTypeFromKey = (key, fallback = DEFAULT_IMAGE_CONTENT_TYPE) => {
  const ext = path.posix
    .extname(String(key || ""))
    .replace(".", "")
    .toLowerCase();
  return EXTENSION_TO_CONTENT_TYPE[ext] || String(fallback || DEFAULT_IMAGE_CONTENT_TYPE);
};

const isPathInsideRoot = (rootPath, targetPath) => {
  const safeRoot = path.resolve(rootPath);
  const safeTarget = path.resolve(targetPath);
  const relative = path.relative(safeRoot, safeTarget);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const createStorageError = (code, message, extra = {}) => {
  const error = new Error(String(message || code || "upload_storage_error"));
  error.code = String(code || "upload_storage_error");
  Object.assign(error, extra);
  return error;
};

const toNotFoundError = (provider, key) =>
  createStorageError("storage_object_not_found", `Upload not found in ${provider}: ${key}`, {
    provider,
    key,
    statusCode: 404,
  });

const isS3NotFoundError = (error) => {
  const code = String(error?.name || error?.Code || error?.code || "").trim();
  const httpStatus = Number(error?.$metadata?.httpStatusCode || error?.statusCode || 0);
  return (
    code === "NoSuchKey" ||
    code === "NotFound" ||
    code === "storage_object_not_found" ||
    httpStatus === 404
  );
};

export const isUploadStorageNotFoundError = (error) =>
  String(error?.code || "").trim() === "storage_object_not_found" || isS3NotFoundError(error);

export const normalizeUploadStorageProvider = (value, fallback = UPLOAD_STORAGE_PROVIDER_LOCAL) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === UPLOAD_STORAGE_PROVIDER_S3) {
    return UPLOAD_STORAGE_PROVIDER_S3;
  }
  if (normalized === UPLOAD_STORAGE_PROVIDER_LOCAL) {
    return UPLOAD_STORAGE_PROVIDER_LOCAL;
  }
  return normalizeUploadStorageProvider(fallback, UPLOAD_STORAGE_PROVIDER_LOCAL);
};

export const readUploadStorageProvider = (entry, fallback = UPLOAD_STORAGE_PROVIDER_LOCAL) =>
  normalizeUploadStorageProvider(entry?.storageProvider, fallback);

export const normalizeUploadUrlToRelativePath = (uploadUrl) => {
  const trimmed = String(uploadUrl || "").trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed, SAFE_ORIGIN);
    const decodedPathname = decodeURIComponent(parsed.pathname || "");
    if (!decodedPathname.startsWith("/uploads/")) {
      return "";
    }
    const relativePath = trimSlashes(decodedPathname.replace(/^\/uploads\//, ""));
    if (!relativePath) {
      return "";
    }
    const normalized = path.posix.normalize(toPosix(relativePath));
    if (
      !normalized ||
      normalized === "." ||
      normalized.startsWith("../") ||
      normalized.includes("/../") ||
      path.posix.isAbsolute(normalized)
    ) {
      return "";
    }
    return normalized;
  } catch {
    return "";
  }
};

export const buildUploadUrlFromRelativePath = (relativePath) => {
  const normalized = trimSlashes(toPosix(relativePath));
  return normalized ? `/uploads/${normalized}` : "";
};

export const getUploadAssetDescriptors = (entry) => {
  const normalizedUrl = String(entry?.url || "").trim();
  if (!normalizedUrl.startsWith("/uploads/")) {
    return [];
  }
  const assets = [
    {
      kind: "original",
      url: normalizedUrl,
      contentType: String(entry?.mime || "").trim() || resolveContentTypeFromKey(normalizedUrl),
      expectedSize:
        Number.isFinite(Number(entry?.size)) && Number(entry?.size) >= 0
          ? Number(entry.size)
          : null,
    },
  ];
  const variants = entry?.variants && typeof entry.variants === "object" ? entry.variants : {};
  Object.entries(variants).forEach(([presetKey, presetRecord]) => {
    const formats =
      presetRecord?.formats && typeof presetRecord.formats === "object" ? presetRecord.formats : {};
    Object.entries(formats).forEach(([formatKey, formatRecord]) => {
      const variantUrl = String(formatRecord?.url || "").trim();
      if (!variantUrl.startsWith("/uploads/")) {
        return;
      }
      assets.push({
        kind: "variant",
        presetKey,
        formatKey,
        url: variantUrl,
        contentType:
          String(formatRecord?.mime || "").trim() || resolveContentTypeFromKey(variantUrl),
        expectedSize:
          Number.isFinite(Number(formatRecord?.size)) && Number(formatRecord?.size) >= 0
            ? Number(formatRecord.size)
            : null,
      });
    });
  });
  return assets;
};

export const getUploadVariantUrlPrefix = (entryOrUploadId) => {
  const uploadId =
    typeof entryOrUploadId === "string"
      ? String(entryOrUploadId || "").trim()
      : String(entryOrUploadId?.id || "").trim();
  if (!uploadId) {
    return "";
  }
  return `/uploads/_variants/${encodeURIComponent(uploadId)}/`;
};

export const buildUploadStorageConfig = (env = process.env) => ({
  activeProvider: normalizeUploadStorageProvider(env.UPLOAD_STORAGE_DRIVER),
  delivery:
    String(env.UPLOAD_STORAGE_DELIVERY || UPLOAD_STORAGE_DELIVERY_PROXY)
      .trim()
      .toLowerCase() || UPLOAD_STORAGE_DELIVERY_PROXY,
  s3: {
    bucket: String(env.UPLOAD_STORAGE_BUCKET || "").trim(),
    region: String(env.UPLOAD_STORAGE_REGION || "").trim(),
    endpoint: String(env.UPLOAD_STORAGE_ENDPOINT || "").trim(),
    accessKeyId: String(env.UPLOAD_STORAGE_ACCESS_KEY_ID || "").trim(),
    secretAccessKey: String(env.UPLOAD_STORAGE_SECRET_ACCESS_KEY || "").trim(),
    prefix: trimSlashes(env.UPLOAD_STORAGE_PREFIX),
    forcePathStyle: normalizeBoolean(env.UPLOAD_STORAGE_S3_FORCE_PATH_STYLE, false),
    publicBaseUrl: String(env.UPLOAD_STORAGE_PUBLIC_BASE_URL || "").trim(),
  },
});

const createLocalDriver = ({ uploadsDir }) => {
  const uploadsRoot = path.resolve(
    String(uploadsDir || path.join(process.cwd(), "public", "uploads")),
  );

  const resolvePath = (key) => {
    const relative = trimSlashes(key);
    const absolute = path.resolve(path.join(uploadsRoot, relative));
    if (!isPathInsideRoot(uploadsRoot, absolute)) {
      throw createStorageError("invalid_storage_key", `Invalid upload key: ${key}`, {
        provider: UPLOAD_STORAGE_PROVIDER_LOCAL,
        key,
      });
    }
    return absolute;
  };

  const listPrefixRecursive = (directoryPath, prefixPath) => {
    if (!fs.existsSync(directoryPath)) {
      return [];
    }
    return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
      const entryAbsolute = path.join(directoryPath, entry.name);
      const entryKey = toPosix(path.posix.join(prefixPath, entry.name));
      if (entry.isDirectory()) {
        return listPrefixRecursive(entryAbsolute, entryKey);
      }
      if (!entry.isFile()) {
        return [];
      }
      return [entryKey];
    });
  };

  return {
    provider: UPLOAD_STORAGE_PROVIDER_LOCAL,
    async putObject({ key, buffer, contentType, cacheControl } = {}) {
      const targetPath = resolvePath(key);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, buffer);
      const stat = fs.statSync(targetPath);
      return {
        key,
        contentType: String(contentType || resolveContentTypeFromKey(key)),
        contentLength: Number(stat.size || 0),
        cacheControl: String(cacheControl || "").trim(),
        lastModified: stat.mtime,
      };
    },
    async getObjectStream({ key } = {}) {
      const targetPath = resolvePath(key);
      if (!fs.existsSync(targetPath)) {
        throw toNotFoundError(UPLOAD_STORAGE_PROVIDER_LOCAL, key);
      }
      const stat = fs.statSync(targetPath);
      return {
        key,
        stream: fs.createReadStream(targetPath),
        contentType: resolveContentTypeFromKey(key),
        contentLength: Number(stat.size || 0),
        cacheControl: "",
        lastModified: stat.mtime,
      };
    },
    async headObject({ key } = {}) {
      const targetPath = resolvePath(key);
      if (!fs.existsSync(targetPath)) {
        return { exists: false, key };
      }
      const stat = fs.statSync(targetPath);
      return {
        exists: true,
        key,
        contentType: resolveContentTypeFromKey(key),
        contentLength: Number(stat.size || 0),
        cacheControl: "",
        lastModified: stat.mtime,
      };
    },
    async copyObject({ sourceKey, targetKey } = {}) {
      const sourcePath = resolvePath(sourceKey);
      if (!fs.existsSync(sourcePath)) {
        throw toNotFoundError(UPLOAD_STORAGE_PROVIDER_LOCAL, sourceKey);
      }
      const targetPath = resolvePath(targetKey);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      return { ok: true };
    },
    async deleteObject({ key } = {}) {
      const targetPath = resolvePath(key);
      fs.rmSync(targetPath, { force: true });
      return { ok: true };
    },
    async deletePrefix({ prefix } = {}) {
      const targetPath = resolvePath(prefix);
      fs.rmSync(targetPath, { recursive: true, force: true });
      return { ok: true };
    },
    async listPrefix({ prefix } = {}) {
      const targetPath = resolvePath(prefix);
      const normalizedPrefix = trimSlashes(prefix);
      if (!fs.existsSync(targetPath)) {
        return [];
      }
      if (fs.statSync(targetPath).isFile()) {
        return [normalizedPrefix];
      }
      return listPrefixRecursive(targetPath, normalizedPrefix);
    },
  };
};

const createS3Driver = ({ config } = {}) => {
  const bucket = String(config?.bucket || "").trim();
  const region = String(config?.region || "").trim();
  const accessKeyId = String(config?.accessKeyId || "").trim();
  const secretAccessKey = String(config?.secretAccessKey || "").trim();
  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const client = new S3Client({
    region,
    endpoint: String(config?.endpoint || "").trim() || undefined,
    forcePathStyle: Boolean(config?.forcePathStyle),
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const send = async (command) => client.send(command);

  return {
    provider: UPLOAD_STORAGE_PROVIDER_S3,
    async putObject({ key, buffer, contentType, cacheControl } = {}) {
      await send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: String(contentType || resolveContentTypeFromKey(key)),
          CacheControl: String(cacheControl || "").trim() || undefined,
        }),
      );
      return {
        key,
        contentType: String(contentType || resolveContentTypeFromKey(key)),
        contentLength: Buffer.isBuffer(buffer) ? buffer.length : null,
        cacheControl: String(cacheControl || "").trim(),
      };
    },
    async getObjectStream({ key } = {}) {
      try {
        const response = await send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );
        const body = response?.Body;
        const stream =
          body instanceof Readable
            ? body
            : typeof body?.transformToWebStream === "function"
              ? Readable.fromWeb(body.transformToWebStream())
              : typeof body?.transformToByteArray === "function"
                ? Readable.from(Buffer.from(await body.transformToByteArray()))
                : null;
        if (!(stream instanceof Readable)) {
          throw createStorageError("storage_stream_unavailable", `Missing stream for key: ${key}`, {
            provider: UPLOAD_STORAGE_PROVIDER_S3,
            key,
          });
        }
        return {
          key,
          stream,
          contentType: String(response?.ContentType || resolveContentTypeFromKey(key)),
          contentLength:
            Number.isFinite(Number(response?.ContentLength)) && Number(response?.ContentLength) >= 0
              ? Number(response.ContentLength)
              : null,
          cacheControl: String(response?.CacheControl || "").trim(),
          lastModified: response?.LastModified || null,
          etag: String(response?.ETag || "").trim(),
        };
      } catch (error) {
        if (isS3NotFoundError(error)) {
          throw toNotFoundError(UPLOAD_STORAGE_PROVIDER_S3, key);
        }
        throw error;
      }
    },
    async headObject({ key } = {}) {
      try {
        const response = await send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );
        return {
          exists: true,
          key,
          contentType: String(response?.ContentType || resolveContentTypeFromKey(key)),
          contentLength:
            Number.isFinite(Number(response?.ContentLength)) && Number(response?.ContentLength) >= 0
              ? Number(response.ContentLength)
              : null,
          cacheControl: String(response?.CacheControl || "").trim(),
          lastModified: response?.LastModified || null,
          etag: String(response?.ETag || "").trim(),
        };
      } catch (error) {
        if (isS3NotFoundError(error)) {
          return { exists: false, key };
        }
        throw error;
      }
    },
    async copyObject({ sourceKey, targetKey } = {}) {
      try {
        await send(
          new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${sourceKey}`,
            Key: targetKey,
          }),
        );
        return { ok: true };
      } catch (error) {
        if (isS3NotFoundError(error)) {
          throw toNotFoundError(UPLOAD_STORAGE_PROVIDER_S3, sourceKey);
        }
        throw error;
      }
    },
    async deleteObject({ key } = {}) {
      await send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      return { ok: true };
    },
    async listPrefix({ prefix } = {}) {
      const normalizedPrefix = trimSlashes(prefix);
      const collected = [];
      let continuationToken = undefined;
      do {
        const response = await send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: normalizedPrefix ? ensureTrailingSlash(normalizedPrefix) : undefined,
            ContinuationToken: continuationToken,
            MaxKeys: DEFAULT_S3_MAX_KEYS,
          }),
        );
        (Array.isArray(response?.Contents) ? response.Contents : []).forEach((item) => {
          const key = String(item?.Key || "").trim();
          if (key) {
            collected.push(key);
          }
        });
        continuationToken = response?.IsTruncated ? response?.NextContinuationToken : undefined;
      } while (continuationToken);
      return collected;
    },
    async deletePrefix({ prefix } = {}) {
      const keys = await this.listPrefix({ prefix });
      if (keys.length === 0) {
        return { ok: true, deletedCount: 0 };
      }
      for (let index = 0; index < keys.length; index += 1000) {
        const batch = keys.slice(index, index + 1000);
        await send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: batch.map((key) => ({ Key: key })),
              Quiet: true,
            },
          }),
        );
      }
      return { ok: true, deletedCount: keys.length };
    },
  };
};

export const streamToBuffer = async (stream) => {
  if (Buffer.isBuffer(stream)) {
    return stream;
  }
  if (!(stream instanceof Readable)) {
    throw createStorageError("invalid_storage_stream", "Upload stream is not readable.");
  }
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const createUploadStorageService = ({ uploadsDir, env = process.env } = {}) => {
  const config = buildUploadStorageConfig(env);
  const localDriver = createLocalDriver({ uploadsDir });
  const s3Driver = createS3Driver({ config: config.s3 });

  const getDriver = (provider) => {
    const normalizedProvider = normalizeUploadStorageProvider(provider, config.activeProvider);
    if (normalizedProvider === UPLOAD_STORAGE_PROVIDER_LOCAL) {
      return localDriver;
    }
    if (normalizedProvider === UPLOAD_STORAGE_PROVIDER_S3 && s3Driver) {
      return s3Driver;
    }
    throw createStorageError(
      "storage_provider_not_configured",
      `Upload storage provider not configured: ${normalizedProvider}`,
      { provider: normalizedProvider },
    );
  };

  const buildKey = (provider, uploadUrlOrRelativePath) => {
    const normalizedProvider = normalizeUploadStorageProvider(provider, config.activeProvider);
    const relativePath = String(uploadUrlOrRelativePath || "").startsWith("/uploads/")
      ? normalizeUploadUrlToRelativePath(uploadUrlOrRelativePath)
      : trimSlashes(uploadUrlOrRelativePath);
    if (!relativePath) {
      throw createStorageError(
        "invalid_storage_key",
        `Invalid upload URL or key: ${String(uploadUrlOrRelativePath || "")}`,
        { provider: normalizedProvider },
      );
    }
    if (normalizedProvider === UPLOAD_STORAGE_PROVIDER_S3 && config.s3.prefix) {
      return trimSlashes(`${config.s3.prefix}/${relativePath}`);
    }
    return relativePath;
  };

  const stripS3Prefix = (key) => {
    const normalizedKey = trimSlashes(key);
    if (!config.s3.prefix) {
      return normalizedKey;
    }
    const prefixWithSlash = ensureTrailingSlash(config.s3.prefix);
    if (normalizedKey.startsWith(prefixWithSlash)) {
      return trimSlashes(normalizedKey.slice(prefixWithSlash.length));
    }
    return normalizedKey;
  };

  return {
    uploadsDir: path.resolve(String(uploadsDir || path.join(process.cwd(), "public", "uploads"))),
    config,
    activeProvider: config.activeProvider,
    delivery: config.delivery,
    isConfigured(provider) {
      const normalizedProvider = normalizeUploadStorageProvider(provider, config.activeProvider);
      return normalizedProvider === UPLOAD_STORAGE_PROVIDER_LOCAL || Boolean(s3Driver);
    },
    getDriver,
    getEntryProvider(entry) {
      return readUploadStorageProvider(entry, UPLOAD_STORAGE_PROVIDER_LOCAL);
    },
    buildStorageKey(provider, uploadUrlOrRelativePath) {
      return buildKey(provider, uploadUrlOrRelativePath);
    },
    buildRelativePathFromKey(provider, key) {
      const normalizedProvider = normalizeUploadStorageProvider(provider, config.activeProvider);
      if (normalizedProvider === UPLOAD_STORAGE_PROVIDER_S3) {
        return stripS3Prefix(key);
      }
      return trimSlashes(key);
    },
    async putUploadUrl({
      provider = config.activeProvider,
      uploadUrl,
      buffer,
      contentType,
      cacheControl,
    } = {}) {
      const normalizedProvider = normalizeUploadStorageProvider(provider, config.activeProvider);
      return getDriver(normalizedProvider).putObject({
        key: buildKey(normalizedProvider, uploadUrl),
        buffer,
        contentType,
        cacheControl,
      });
    },
    async getUploadStream({ provider = config.activeProvider, uploadUrl } = {}) {
      const normalizedProvider = normalizeUploadStorageProvider(provider, config.activeProvider);
      return getDriver(normalizedProvider).getObjectStream({
        key: buildKey(normalizedProvider, uploadUrl),
      });
    },
    async headUpload({ provider = config.activeProvider, uploadUrl } = {}) {
      const normalizedProvider = normalizeUploadStorageProvider(provider, config.activeProvider);
      return getDriver(normalizedProvider).headObject({
        key: buildKey(normalizedProvider, uploadUrl),
      });
    },
    async copyUpload({ provider = config.activeProvider, sourceUrl, targetUrl } = {}) {
      const normalizedProvider = normalizeUploadStorageProvider(provider, config.activeProvider);
      return getDriver(normalizedProvider).copyObject({
        sourceKey: buildKey(normalizedProvider, sourceUrl),
        targetKey: buildKey(normalizedProvider, targetUrl),
      });
    },
    async deleteUpload({ provider = config.activeProvider, uploadUrl } = {}) {
      const normalizedProvider = normalizeUploadStorageProvider(provider, config.activeProvider);
      return getDriver(normalizedProvider).deleteObject({
        key: buildKey(normalizedProvider, uploadUrl),
      });
    },
    async deleteUploadPrefix({ provider = config.activeProvider, uploadUrlPrefix } = {}) {
      const normalizedProvider = normalizeUploadStorageProvider(provider, config.activeProvider);
      return getDriver(normalizedProvider).deletePrefix({
        prefix: buildKey(normalizedProvider, uploadUrlPrefix),
      });
    },
    async listUploadPrefix({ provider = config.activeProvider, uploadUrlPrefix } = {}) {
      const normalizedProvider = normalizeUploadStorageProvider(provider, config.activeProvider);
      const keys = await getDriver(normalizedProvider).listPrefix({
        prefix: buildKey(normalizedProvider, uploadUrlPrefix),
      });
      return keys.map((key) =>
        buildUploadUrlFromRelativePath(this.buildRelativePathFromKey(normalizedProvider, key)),
      );
    },
    async downloadUploadBuffer({ provider = config.activeProvider, uploadUrl } = {}) {
      const response = await this.getUploadStream({ provider, uploadUrl });
      return streamToBuffer(response.stream);
    },
  };
};
