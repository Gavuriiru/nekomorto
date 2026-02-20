import crypto from "crypto";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outPath = outIndex >= 0 ? args[outIndex + 1] : "";

const rootDir = path.resolve(process.cwd());
const dataDir = path.join(rootDir, "server", "data");

const sha256File = (filePath) => {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
};

const collectEntries = () => {
  if (!fs.existsSync(dataDir)) {
    return [];
  }
  return fs
    .readdirSync(dataDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const absolute = path.join(dataDir, entry.name);
      const stat = fs.statSync(absolute);
      return {
        file: `server/data/${entry.name}`,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
        sha256: sha256File(absolute),
      };
    })
    .sort((a, b) => a.file.localeCompare(b.file, "en"));
};

const entries = collectEntries();
const aggregateHash = crypto
  .createHash("sha256")
  .update(
    entries
      .map((entry) => `${entry.file}:${entry.sha256}:${entry.size}`)
      .join("\n"),
  )
  .digest("hex");

const report = {
  generatedAt: new Date().toISOString(),
  aggregateHash,
  files: entries,
};

const output = JSON.stringify(report, null, 2);
console.log(output);

if (outPath) {
  const absoluteOut = path.isAbsolute(outPath) ? outPath : path.join(rootDir, outPath);
  fs.mkdirSync(path.dirname(absoluteOut), { recursive: true });
  fs.writeFileSync(absoluteOut, `${output}\n`, "utf-8");
}
