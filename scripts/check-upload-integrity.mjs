import path from "path";
import { runUploadsIntegrityCheck } from "../server/lib/uploads-integrity.js";
import { createUploadStorageService } from "../server/lib/upload-storage.js";
import { loadDbDatasets, prisma } from "./lib/db-datasets.mjs";

const HELP_FLAG = "--help";
const MAX_EXAMPLES_FLAG = "--max-examples";
const MODE_FLAG = "--mode";
const FOLDER_FLAG = "--folder";
const UPLOAD_ID_FLAG = "--upload-id";
const URL_FLAG = "--url";
const DEFAULT_MAX_EXAMPLES = 20;
const DEFAULT_MODE = "fast";

const printHelp = () => {
  console.log("Uso:");
  console.log("  node scripts/check-upload-integrity.mjs");
  console.log("  node scripts/check-upload-integrity.mjs --max-examples 25");
  console.log("  node scripts/check-upload-integrity.mjs --mode deep");
  console.log("  node scripts/check-upload-integrity.mjs --folder projects/21878");
  console.log("  node scripts/check-upload-integrity.mjs --upload-id upload-1");
  console.log(
    "  node scripts/check-upload-integrity.mjs --url /uploads/projects/21878/episodes/capa.jpeg",
  );
  console.log("  node scripts/check-upload-integrity.mjs --help");
};

const readFlagValue = (args, flag) => {
  const index = args.findIndex((item) => item === flag);
  if (index === -1) {
    return "";
  }
  return String(args[index + 1] || "").trim();
};

const parseMaxExamples = (args) => {
  const index = args.findIndex((item) => item === MAX_EXAMPLES_FLAG);
  if (index === -1) {
    return DEFAULT_MAX_EXAMPLES;
  }
  const raw = Number(args[index + 1]);
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error("Valor invalido para --max-examples. Use um numero inteiro maior que zero.");
  }
  return Math.floor(raw);
};

const parseMode = (args) => {
  const index = args.findIndex((item) => item === MODE_FLAG);
  if (index === -1) {
    return DEFAULT_MODE;
  }
  const raw = String(args[index + 1] || "")
    .trim()
    .toLowerCase();
  if (raw !== "fast" && raw !== "deep") {
    throw new Error("Valor invalido para --mode. Use fast ou deep.");
  }
  return raw;
};

const printSummary = (result, uploadsDir, mode, filters) => {
  console.log("Modo: check-integrity");
  console.log(`Profundidade: ${mode}`);
  console.log(`Pasta de uploads: ${uploadsDir}`);
  if (filters.folder) {
    console.log(`Filtro pasta: ${filters.folder}`);
  }
  if (filters.uploadId) {
    console.log(`Filtro upload-id: ${filters.uploadId}`);
  }
  if (filters.url) {
    console.log(`Filtro url: ${filters.url}`);
  }
  console.log(`URLs referenciadas em posts/projetos: ${result.referencedUrlsCount}`);
  console.log(`Movimentos planejados (dry-run): ${result.plannedMovesCount}`);
  console.log(`Registros de inventario (estimado): ${result.uploadsInventoryCount}`);
  console.log(`Problemas criticos: ${result.criticalCount}`);
};

const printFailures = (result) => {
  const byType = Object.entries(result.criticalCountByType || {});
  if (byType.length > 0) {
    console.error("\nResumo por tipo:");
    byType
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]), "en"))
      .forEach(([type, total]) => {
        console.error(`- ${type}: ${total}`);
      });
  }

  if (result.examples.length > 0) {
    console.error("\nExemplos:");
    result.examples.forEach((item) => {
      const extra = item.path ? ` (${item.path})` : item.target ? ` (target: ${item.target})` : "";
      console.error(`- [${item.type}] ${item.url}${extra} [origem: ${item.source}]`);
    });
  }
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

let maxExamples = DEFAULT_MAX_EXAMPLES;
let mode = DEFAULT_MODE;
const folder = readFlagValue(args, FOLDER_FLAG);
const uploadId = readFlagValue(args, UPLOAD_ID_FLAG);
const url = readFlagValue(args, URL_FLAG);
try {
  maxExamples = parseMaxExamples(args);
  mode = parseMode(args);
} catch (error) {
  console.error(String(error?.message || error));
  process.exit(1);
}

const uploadsDir = path.join(process.cwd(), "public", "uploads");
const storageService = createUploadStorageService({ uploadsDir });

try {
  const datasets = await loadDbDatasets(prisma);
  const result = await runUploadsIntegrityCheck({
    datasets,
    uploadsDir,
    maxExamples,
    mode,
    storageService,
    folder,
    uploadId,
    url,
  });

  printSummary(result, uploadsDir, mode, { folder, uploadId, url });

  if (!result.ok) {
    console.error("\nIntegridade de uploads: FALHOU.");
    printFailures(result);
    process.exitCode = 1;
  } else {
    console.log("Integridade de uploads: OK.");
  }
} catch (error) {
  console.error("Falha ao validar integridade de uploads.");
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
} finally {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect failure
  }
}
