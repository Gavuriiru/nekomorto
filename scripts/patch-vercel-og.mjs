import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const targetFile = path.join(projectRoot, "node_modules", "@vercel", "og", "dist", "index.node.js");
const originalSnippet = "sharp(new TextEncoder().encode(svg))";
const patchedSnippet = "sharp(Buffer.from(new TextEncoder().encode(svg)))";

if (!fs.existsSync(targetFile)) {
  process.exit(0);
}

const source = fs.readFileSync(targetFile, "utf8");
if (source.includes(patchedSnippet)) {
  process.exit(0);
}
if (!source.includes(originalSnippet)) {
  throw new Error("Could not find @vercel/og sharp input snippet to patch.");
}

fs.writeFileSync(targetFile, source.replace(originalSnippet, patchedSnippet));
