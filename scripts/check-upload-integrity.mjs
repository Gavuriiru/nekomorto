import path from "path";
import { runUploadsIntegrityCheck } from "../server/lib/uploads-integrity.js";
import { loadDbDatasets, prisma } from "./lib/db-datasets.mjs";

const HELP_FLAG = "--help";
const MAX_EXAMPLES_FLAG = "--max-examples";
const DEFAULT_MAX_EXAMPLES = 20;

const printHelp = () => {
  console.log("Uso:");
  console.log("  node scripts/check-upload-integrity.mjs");
  console.log("  node scripts/check-upload-integrity.mjs --max-examples 25");
  console.log("  node scripts/check-upload-integrity.mjs --help");
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

const printSummary = (result, uploadsDir) => {
  console.log("Modo: check-integrity");
  console.log(`Pasta de uploads: ${uploadsDir}`);
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
try {
  maxExamples = parseMaxExamples(args);
} catch (error) {
  console.error(String(error?.message || error));
  process.exit(1);
}

const uploadsDir = path.join(process.cwd(), "public", "uploads");

try {
  const datasets = await loadDbDatasets(prisma);
  const result = runUploadsIntegrityCheck({
    datasets,
    uploadsDir,
    maxExamples,
  });

  printSummary(result, uploadsDir);

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
