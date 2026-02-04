import fs from "fs";
import path from "path";

const rootDir = path.resolve(process.cwd());
const dataDir = path.join(rootDir, "server", "data");
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

fs.mkdirSync(targetDir, { recursive: true });
copyDir(dataDir, path.join(targetDir, "data"));
copyDir(uploadsDir, path.join(targetDir, "uploads"));

console.log(`Backup criado em: ${targetDir}`);
