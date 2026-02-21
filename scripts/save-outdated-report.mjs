import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const formatTimestamp = (value = new Date()) => {
  const year = String(value.getFullYear());
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
};

const runNpmOutdated = () =>
  new Promise((resolve, reject) => {
    const npmExecPath = process.env.npm_execpath;
    const command = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
    const args = npmExecPath ? [npmExecPath, "outdated", "--json"] : ["outdated", "--json"];
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });

const normalizeOutdatedPayload = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  return JSON.parse(trimmed);
};

const main = async () => {
  const { code, stdout, stderr } = await runNpmOutdated();
  if (code !== 0 && code !== 1) {
    if (stderr.trim()) {
      console.error(stderr.trim());
    }
    throw new Error(`npm outdated failed with exit code ${code}`);
  }

  const payload = normalizeOutdatedPayload(stdout);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });

  const filename = `modernization-outdated-${formatTimestamp()}.json`;
  const outputPath = join(reportsDir, filename);
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Saved outdated snapshot to ${outputPath}`);
  if (stderr.trim()) {
    console.warn(stderr.trim());
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
