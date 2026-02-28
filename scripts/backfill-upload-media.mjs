import fs from "fs";
import path from "path";
import { loadDbDatasets, persistDbDatasets, prisma } from "./lib/db-datasets.mjs";
import {
  attachUploadMediaMetadata,
  computeBufferSha256,
  resolveUploadAbsolutePath,
} from "../server/lib/upload-media.js";

const rootDir = path.resolve(process.cwd());
const uploadsDir = path.join(rootDir, "public", "uploads");

if (!String(process.env.DATABASE_URL || "").trim()) {
  console.error("DATABASE_URL obrigatoria.");
  process.exit(1);
}

const mimeFromFileName = (fileName) => {
  const extension = String(path.extname(fileName || "").replace(".", "")).toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "svg") return "image/svg+xml";
  return "";
};

const normalizeUploadMime = (value, fileName) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return mimeFromFileName(fileName);
  }
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized;
};

const areEqual = (left, right) => {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

try {
  const datasets = await loadDbDatasets(prisma);
  const uploads = Array.isArray(datasets?.uploads) ? datasets.uploads : [];
  if (uploads.length === 0) {
    console.log("Nenhum upload encontrado para backfill.");
    process.exit(0);
  }

  let processed = 0;
  let updated = 0;
  let skippedMissing = 0;
  let failed = 0;
  const nextUploads = [];
  const failures = [];

  for (const current of uploads) {
    processed += 1;
    const sourcePath = resolveUploadAbsolutePath({ uploadsDir, uploadUrl: current?.url });
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      skippedMissing += 1;
      nextUploads.push(current);
      continue;
    }
    try {
      const sourceBuffer = fs.readFileSync(sourcePath);
      const hashSha256 = computeBufferSha256(sourceBuffer);
      const next = await attachUploadMediaMetadata({
        uploadsDir,
        entry: current,
        sourcePath,
        sourceMime: normalizeUploadMime(current?.mime, current?.fileName),
        hashSha256,
        variantsVersion: Math.max(1, Number(current?.variantsVersion || 1)),
        regenerateVariants: true,
      });
      if (!areEqual(current, next)) {
        updated += 1;
      }
      nextUploads.push(next);
    } catch (error) {
      failed += 1;
      failures.push({
        id: String(current?.id || ""),
        url: String(current?.url || ""),
        error: String(error?.message || error || "unknown_error"),
      });
      nextUploads.push(current);
    }
  }

  if (updated > 0) {
    await persistDbDatasets(prisma, { uploads: nextUploads }, ["uploads"]);
  }

  const report = {
    processed,
    updated,
    skippedMissing,
    failed,
    failures,
  };
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
} finally {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect failure
  }
}
