import path from "path";
import { createUploadStorageService } from "../server/lib/upload-storage.js";
import {
  repairMissingLocalUploadsFromObjectStorage,
  restoreUploadsFromObjectStorage,
} from "../server/lib/uploads-object-storage.js";
import { loadDbDatasets, persistDbDatasets, prisma } from "./lib/db-datasets.mjs";

const HELP_FLAG = "--help";
const APPLY_FLAG = "--apply";
const DRY_RUN_FLAG = "--dry-run";
const REPAIR_MISSING_LOCAL_FLAG = "--repair-missing-local";
const FOLDER_FLAG = "--folder";
const UPLOAD_ID_FLAG = "--upload-id";
const URL_FLAG = "--url";

const printHelp = () => {
  console.log("Uso:");
  console.log("  node scripts/restore-uploads-from-object-storage.mjs --dry-run");
  console.log("  node scripts/restore-uploads-from-object-storage.mjs --apply");
  console.log("  node scripts/restore-uploads-from-object-storage.mjs --apply --folder posts");
  console.log(
    "  node scripts/restore-uploads-from-object-storage.mjs --apply --upload-id upload-1",
  );
  console.log(
    "  node scripts/restore-uploads-from-object-storage.mjs --apply --repair-missing-local --folder projects/21878",
  );
  console.log(
    "  node scripts/restore-uploads-from-object-storage.mjs --apply --repair-missing-local --url /uploads/projects/21878/episodes/capa.jpeg",
  );
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
const repairMissingLocal = args.includes(REPAIR_MISSING_LOCAL_FLAG);
const uploadsDir = path.join(process.cwd(), "public", "uploads");
const storageService = createUploadStorageService({ uploadsDir });

if (!storageService.isConfigured("s3")) {
  console.error("Storage S3-compatible nao configurado.");
  process.exit(1);
}

try {
  const datasets = await loadDbDatasets(prisma);
  const scope = {
    folder: readFlagValue(args, FOLDER_FLAG),
    uploadId: readFlagValue(args, UPLOAD_ID_FLAG),
    url: readFlagValue(args, URL_FLAG),
  };
  const action = repairMissingLocal
    ? repairMissingLocalUploadsFromObjectStorage
    : restoreUploadsFromObjectStorage;
  const result = await action({
    uploads: datasets.uploads,
    uploadsDir,
    storageService,
    applyChanges,
    ...scope,
  });

  console.log(`Modo: ${result.mode}`);
  console.log(`Operacao: ${result.operation || "restore-from-object-storage"}`);
  if (scope.folder) {
    console.log(`Filtro pasta: ${scope.folder}`);
  }
  if (scope.uploadId) {
    console.log(`Filtro upload-id: ${scope.uploadId}`);
  }
  if (scope.url) {
    console.log(`Filtro url: ${scope.url}`);
  }
  console.log(`Selecionados: ${result.selectedCount}`);
  if (repairMissingLocal) {
    console.log(`Reparados: ${result.repairedCount}`);
  } else {
    console.log(`Restaurados: ${result.restoredCount}`);
  }
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
