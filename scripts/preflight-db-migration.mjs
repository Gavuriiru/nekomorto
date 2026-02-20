import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const rootDir = path.resolve(process.cwd());
const reportsDir = path.join(rootDir, "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = path.join(reportsDir, `preflight-db-migration-${stamp}.txt`);

const runNodeScript = (scriptRelativePath) => {
  const scriptPath = path.join(rootDir, scriptRelativePath);
  return spawnSync(process.execPath, [scriptPath], {
    cwd: rootDir,
    encoding: "utf-8",
  });
};

const sections = [];

const validate = runNodeScript("scripts/validate-data.mjs");
sections.push("## validate-data");
sections.push(validate.stdout?.trim() || "(no stdout)");
if (validate.stderr?.trim()) {
  sections.push("### stderr");
  sections.push(validate.stderr.trim());
}
sections.push(`exit_code=${validate.status ?? "unknown"}`);

const hash = spawnSync(
  process.execPath,
  [path.join(rootDir, "scripts/hash-data-snapshot.mjs")],
  {
    cwd: rootDir,
    encoding: "utf-8",
  },
);
sections.push("\n## hash-data-snapshot");
sections.push(hash.stdout?.trim() || "(no stdout)");
if (hash.stderr?.trim()) {
  sections.push("### stderr");
  sections.push(hash.stderr.trim());
}
sections.push(`exit_code=${hash.status ?? "unknown"}`);

const content = `${sections.join("\n\n")}\n`;
fs.writeFileSync(outPath, content, "utf-8");

console.log(content);
console.log(`\nSaved preflight report: ${path.relative(rootDir, outPath)}`);

if ((validate.status ?? 1) !== 0 || (hash.status ?? 1) !== 0) {
  process.exitCode = 1;
}
