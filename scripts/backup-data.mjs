import fs from "fs";
import path from "path";
import { loadDbDatasets, prisma } from "./lib/db-datasets.mjs";

const rootDir = path.resolve(process.cwd());
const uploadsDir = path.join(rootDir, "public", "uploads");
const backupsDir = path.join(rootDir, "backups");

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const targetDir = path.join(backupsDir, `backup-${timestamp}`);

const copyDir = (src, dest) => {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  entries.forEach((entry) => {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
};

if (!String(process.env.DATABASE_URL || "").trim()) {
  console.error("DATABASE_URL obrigatoria.");
  process.exit(1);
}

try {
  const datasets = await loadDbDatasets(prisma);

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, "db-snapshot.json"), `${JSON.stringify(datasets, null, 2)}\n`, "utf-8");
  copyDir(uploadsDir, path.join(targetDir, "uploads"));

  console.log(`Backup criado em: ${targetDir}`);
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
