import crypto from "crypto";
import fs from "fs";
import path from "path";
import { persistDbDatasets, prisma } from "./lib/db-datasets.mjs";

const rootDir = path.resolve(process.cwd());
const uploadsDir = path.join(rootDir, "public", "uploads");

if (!String(process.env.DATABASE_URL || "").trim()) {
  console.error("DATABASE_URL obrigatoria.");
  process.exit(1);
}

if (!fs.existsSync(uploadsDir)) {
  console.error("Pasta public/uploads nao encontrada.");
  process.exit(1);
}

const listFiles = (dir, base = "") => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  entries.forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFiles(full, path.join(base, entry.name)));
    } else {
      const relative = path.join(base, entry.name).split(path.sep).join("/");
      results.push({ full, relative });
    }
  });
  return results;
};

const files = listFiles(uploadsDir).filter((item) => /\.(png|jpe?g|gif|webp|svg)$/i.test(item.relative));
const entries = files
  .map((item) => {
    const stat = fs.statSync(item.full);
    return {
      id: crypto.randomUUID(),
      url: `/uploads/${item.relative}`,
      fileName: path.basename(item.relative),
      folder: path.dirname(item.relative) === "." ? "" : path.dirname(item.relative).replace(/\\/g, "/"),
      size: stat.size,
      mime: "",
      createdAt: stat.mtime.toISOString(),
    };
  })
  .sort((a, b) => a.url.localeCompare(b.url, "en"));

try {
  await persistDbDatasets(prisma, { uploads: entries }, ["uploads"]);
  console.log(`Inventario de uploads persistido no DB. Registros: ${entries.length}`);
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
