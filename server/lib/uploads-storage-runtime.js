import fs from "fs";
import os from "os";
import path from "path";
import { resolveUploadAbsolutePath } from "./upload-media.js";
import { getUploadAssetDescriptors, readUploadStorageProvider, streamToBuffer } from "./upload-storage.js";

const ensureWorkspaceShape = (workspace) =>
  workspace && typeof workspace === "object" && workspace.uploadsDir && workspace.rootDir
    ? workspace
    : null;

export const createUploadStagingWorkspace = ({ prefix = "nekomorto-upload-" } = {}) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const uploadsDir = path.join(rootDir, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  return {
    rootDir,
    uploadsDir,
  };
};

export const cleanupUploadStagingWorkspace = (workspace) => {
  const safeWorkspace = ensureWorkspaceShape(workspace);
  if (!safeWorkspace) {
    return;
  }
  fs.rmSync(safeWorkspace.rootDir, { recursive: true, force: true });
};

export const writeUploadBufferToStaging = ({
  uploadsDir,
  uploadUrl,
  buffer,
} = {}) => {
  const targetPath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl });
  if (!targetPath) {
    throw new Error(`invalid_upload_path:${uploadUrl}`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
  return targetPath;
};

export const persistUploadEntryFromStaging = async ({
  storageService,
  entry,
  uploadsDir,
  provider,
  cacheControl,
} = {}) => {
  const effectiveProvider = provider || readUploadStorageProvider(entry, "local");
  const assets = getUploadAssetDescriptors(entry);
  for (const asset of assets) {
    const filePath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl: asset.url });
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`staged_asset_missing:${asset.url}`);
    }
    const buffer = fs.readFileSync(filePath);
    await storageService.putUploadUrl({
      provider: effectiveProvider,
      uploadUrl: asset.url,
      buffer,
      contentType: asset.contentType,
      cacheControl,
    });
  }
};

export const materializeUploadEntrySourceToStaging = async ({
  storageService,
  entry,
  uploadsDir,
} = {}) => {
  const provider = readUploadStorageProvider(entry, "local");
  const response = await storageService.getUploadStream({
    provider,
    uploadUrl: entry?.url,
  });
  const buffer = await streamToBuffer(response.stream);
  const sourcePath = writeUploadBufferToStaging({
    uploadsDir,
    uploadUrl: entry?.url,
    buffer,
  });
  return {
    buffer,
    sourcePath,
    contentType: response?.contentType || entry?.mime || "",
  };
};
