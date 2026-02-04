import fs from "fs";
import path from "path";
import crypto from "crypto";

const rootDir = path.resolve(process.cwd());
const uploadsDir = path.join(rootDir, "public", "uploads");
const outPath = path.join(rootDir, "server", "data", "uploads.json");

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
const entries = files.map((item) => {
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
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(entries, null, 2));
console.log(`Inventario gerado em: ${outPath}`);
