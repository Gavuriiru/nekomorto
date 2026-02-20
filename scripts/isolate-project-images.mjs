import path from "path";
import { isolateProjectImageUploads } from "../server/lib/project-image-isolator.js";
import { loadDbDatasets, persistDbDatasets, prisma } from "./lib/db-datasets.mjs";

const APPLY_FLAG = "--apply";
const HELP_FLAG = "--help";
const PROJECT_FLAG = "--project";

const printHelp = () => {
  console.log("Uso:");
  console.log("  node scripts/isolate-project-images.mjs");
  console.log("  node scripts/isolate-project-images.mjs --apply");
  console.log("  node scripts/isolate-project-images.mjs --apply --project <id>");
  console.log("  node scripts/isolate-project-images.mjs --help");
  console.log("");
  console.log("Padrao: dry-run (nao altera dados no DB).\n");
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

const applyChanges = args.includes(APPLY_FLAG);
let targetProjectId = "";
const projectFlagIndex = args.findIndex((item) => item === PROJECT_FLAG);
if (projectFlagIndex >= 0) {
  targetProjectId = String(args[projectFlagIndex + 1] || "").trim();
  if (!targetProjectId) {
    console.error("Erro: informe um ID apos --project.");
    process.exit(1);
  }
}

try {
  const datasets = await loadDbDatasets(prisma);
  const report = isolateProjectImageUploads({
    datasets,
    uploadsDir: path.join(process.cwd(), "public", "uploads"),
    applyChanges,
    targetProjectId,
  });

  if (applyChanges && report.changedDatasets.length > 0) {
    await persistDbDatasets(prisma, report.rewrittenDatasets, report.changedDatasets);
  }

  console.log(`Modo: ${report.mode}`);
  console.log(`Projetos analisados: ${report.scopedProjects}`);
  console.log(`Copiados: ${report.copied}`);
  console.log(`Reescritas planejadas/aplicadas: ${report.rewritten}`);
  console.log(`Ocorrencias reescritas em projects: ${report.rewrittenReferences}`);
  console.log(`Ignorados: ${report.skipped}`);
  console.log(`Ausentes: ${report.missing}`);
  console.log(`Conflitos: ${report.conflicts}`);

  if (applyChanges) {
    console.log(`Registros de uploads atualizados: ${report.uploadsUpdated}`);
    console.log(`Datasets persistidos: ${report.changedDatasets.join(", ") || "(nenhum)"}`);
  } else {
    console.log("Dry-run: nenhum dado foi alterado.");
  }
} catch (error) {
  console.error(String(error?.message || "Falha ao isolar imagens de projetos."));
  process.exitCode = 1;
} finally {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect failure
  }
}
