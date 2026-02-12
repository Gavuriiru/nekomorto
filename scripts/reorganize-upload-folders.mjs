import path from "path";
import { runUploadsReorganization } from "../server/lib/uploads-reorganizer.js";

const APPLY_FLAG = "--apply";
const HELP_FLAG = "--help";
const applyChanges = process.argv.includes(APPLY_FLAG);

if (process.argv.includes(HELP_FLAG)) {
  console.log("Uso:");
  console.log("  node scripts/reorganize-upload-folders.mjs           # dry-run (padrao)");
  console.log("  node scripts/reorganize-upload-folders.mjs --apply   # aplica as alteracoes");
  process.exit(0);
}

const printReport = (report) => {
  console.log(`Modo: ${report.mode}`);
  console.log(`URLs referenciadas (posts/projetos): ${report.referencedUrlsCount}`);
  console.log(`Movimentos planejados: ${report.plannedMovesCount}`);
  console.log(`Movimentos aplicados: ${report.appliedMovesCount}`);
  console.log(`Mapeamentos efetivos: ${report.effectiveMappingsCount}`);
  console.log(`Falhas de movimento: ${report.moveFailuresCount}`);
  console.log(`Registros em uploads.json (previstos): ${report.uploadsInventoryCount}`);

  if (report.mappings.length > 0) {
    console.log("\nMapeamento de URLs:");
    report.mappings.forEach(({ oldUrl, newUrl }) => {
      console.log(`- ${oldUrl} -> ${newUrl}`);
    });
  }

  console.log("\nReescrita de referencias:");
  report.replacementsByFile.forEach((item) => {
    console.log(`- ${item.fileName}: ${item.replacements}`);
  });

  if (report.failures.length > 0) {
    console.log("\nFalhas ao mover arquivos:");
    report.failures.forEach((item) => {
      console.log(`- ${item.oldUrl} -> ${item.newUrl}: ${item.reason}`);
    });
  }

  if (report.skipped.length > 0) {
    console.log("\nItens nao processados:");
    report.skipped.forEach((item) => {
      if (item.path) {
        console.log(`- ${item.type}: ${item.url} (${item.path})`);
        return;
      }
      if (item.target) {
        console.log(`- ${item.type}: ${item.url} (target: ${item.target})`);
        return;
      }
      console.log(`- ${item.type}: ${item.url}`);
    });
  }
};

try {
  const rootDir = path.resolve(process.cwd());
  const report = runUploadsReorganization({
    rootDir,
    applyChanges,
  });
  printReport(report);
} catch (error) {
  console.error("Falha ao reorganizar uploads.");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
}

