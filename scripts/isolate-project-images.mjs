import path from "path";
import { isolateProjectImageUploads } from "../server/lib/project-image-isolator.js";

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
  console.log("Padrao: dry-run (nao altera arquivos).");
};

const args = process.argv.slice(2);
if (args.includes(HELP_FLAG)) {
  printHelp();
  process.exit(0);
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
  const report = isolateProjectImageUploads({
    rootDir: path.resolve(process.cwd()),
    applyChanges,
    targetProjectId,
  });

  console.log(`Modo: ${report.mode}`);
  console.log(`Projetos analisados: ${report.scopedProjects}`);
  console.log(`Copiados: ${report.copied}`);
  console.log(`Reescritas planejadas/aplicadas: ${report.rewritten}`);
  console.log(`Ocorrencias reescritas em projects.json: ${report.rewrittenReferences}`);
  console.log(`Ignorados: ${report.skipped}`);
  console.log(`Ausentes: ${report.missing}`);
  console.log(`Conflitos: ${report.conflicts}`);

  if (applyChanges) {
    console.log(`Registros de uploads atualizados: ${report.uploadsUpdated}`);
    if (report.filesUpdated.projects || report.filesUpdated.uploads) {
      console.log("");
      console.log("Arquivos atualizados:");
      if (report.filesUpdated.projects) {
        console.log(`- ${report.filesUpdated.projects}`);
      }
      if (report.filesUpdated.uploads) {
        console.log(`- ${report.filesUpdated.uploads}`);
      }
    }
  } else {
    console.log("Dry-run: nenhum arquivo foi alterado.");
  }
} catch (error) {
  console.error(String(error?.message || "Falha ao isolar imagens de projetos."));
  process.exit(1);
}
