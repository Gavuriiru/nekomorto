import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const distDir = path.join(workspaceRoot, "dist");
const distIndexPath = path.join(distDir, "index.html");
const cleanupWorkerTemplatePath = path.join(__dirname, "sw-cleanup-template.js");
const cleanupWorkerOutputPath = path.join(distDir, "sw.js");

if (!fs.existsSync(distIndexPath)) {
  throw new Error(`Production build missing at ${distIndexPath}. Run "vite build" first.`);
}

const resolveBuildFingerprint = () => {
  const parts = [
    process.env.VITE_APP_COMMIT_SHA,
    process.env.APP_COMMIT_SHA,
    process.env.VITE_APP_BUILD_TIME,
    process.env.APP_BUILD_TIME,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (parts.length > 0) {
    return parts.join("::");
  }

  return new Date().toISOString();
};

const cleanupWorkerTemplate = fs.readFileSync(cleanupWorkerTemplatePath, "utf8");
const cleanupWorkerSource = cleanupWorkerTemplate.replace(
  "__BUILD_FINGERPRINT__",
  JSON.stringify(resolveBuildFingerprint()),
);

for (const entry of fs.readdirSync(distDir)) {
  if (entry === "sw.js" || entry === "sw.js.map" || /^workbox-[A-Za-z0-9_-]+\.js(?:\.map)?$/.test(entry)) {
    fs.rmSync(path.join(distDir, entry), { force: true });
  }
}

fs.writeFileSync(cleanupWorkerOutputPath, cleanupWorkerSource);

console.log("[build-pwa] wrote cleanup sw.js for legacy service-worker removal.");
