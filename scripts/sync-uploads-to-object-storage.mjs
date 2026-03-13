import path from "path";
import { createUploadStorageService } from "../server/lib/upload-storage.js";
import { syncUploadsToObjectStorage } from "../server/lib/uploads-object-storage.js";
import { loadDbDatasets, persistDbDatasets, prisma } from "./lib/db-datasets.mjs";

const HELP_FLAG = "--help";
const APPLY_FLAG = "--apply";
const DRY_RUN_FLAG = "--dry-run";
const FOLDER_FLAG = "--folder";
const UPLOAD_ID_FLAG = "--upload-id";

const printHelp = () => {
  console.log("Uso:");
  console.log("  node scripts/sync-uploads-to-object-storage.mjs --dry-run");
  console.log("  node scripts/sync-uploads-to-object-storage.mjs --apply");
  console.log("  node scripts/sync-uploads-to-object-storage.mjs --apply --folder posts");
  console.log("  node scripts/sync-uploads-to-object-storage.mjs --apply --upload-id upload-1");
};

const readFlagValue = (args, flag) => {
  const index = args.findIndex((item) => item === flag);
  if (index === -1) {
    return "";
  }
  return String(args[index + 1] || "").trim();
};

const args = process.argv.slice(2);
if (args.includes(HELP_FLAG)) {
  printHelp();
  process.exit(0);
}

if (!String(process.env.DATABASE_URL || "").trim()) {
  console.error("DATABASE_URL obrigatoria.");
  process.exit(1);
}

const applyChanges = args.includes(APPLY_FLAG) && !args.includes(DRY_RUN_FLAG);
const uploadsDir = path.join(process.cwd(), "public", "uploads");
const storageService = createUploadStorageService({ uploadsDir });

if (!storageService.isConfigured("s3")) {
  console.error("Storage S3-compatible nao configurado.");
  process.exit(1);
}

try {
  const datasets = await loadDbDatasets(prisma);
  const result = await syncUploadsToObjectStorage({
    uploads: datasets.uploads,
    uploadsDir,
    storageService,
    applyChanges,
    folder: readFlagValue(args, FOLDER_FLAG),
    uploadId: readFlagValue(args, UPLOAD_ID_FLAG),
  });

  console.log(`Modo: ${result.mode}`);
  console.log(`Selecionados: ${result.selectedCount}`);
  console.log(`Sincronizados: ${result.syncedCount}`);
  console.log(`Ignorados: ${result.skippedCount}`);
  console.log(`Falhas: ${result.failedCount}`);

  if (applyChanges && result.changed) {
    await persistDbDatasets(prisma, { uploads: result.uploadsNext }, ["uploads"]);
    console.log("Metadados de uploads atualizados.");
  }

  if (result.failures.length > 0) {
    console.error("\nFalhas:");
    result.failures.forEach((failure) => {
      console.error(`- ${failure.url}: ${failure.reason}`);
    });
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
} finally {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect failure
  }
}
