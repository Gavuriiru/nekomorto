import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  extractPublicPrerenderPathnamesFromSitemap,
  generatePublicPrerenderArtifact,
  writePublicPrerenderManifest,
} from "../server/lib/public-prerender-runtime.js";

const workspaceRoot = process.cwd();
const outputDir = path.resolve(
  workspaceRoot,
  process.env.PUBLIC_PRERENDER_DIR || path.join("backups", "public-prerender"),
);
const rendererModulePath = path.join(workspaceRoot, "dist-ssr", "public", "renderer.mjs");

const log = (message) => {
  console.log(`[prerender:public] ${message}`);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureRendererExists = () => {
  if (fs.existsSync(rendererModulePath)) {
    return true;
  }
  log(`SSR renderer not found at ${rendererModulePath}; skipping seed.`);
  return false;
};

const pickPort = () => 43000 + Math.floor(Math.random() * 1000);

const fetchWithRetry = async ({ url, attempts = 30, delayMs = 1000 }) => {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/xml,text/html",
        },
      });
      if (response.ok) {
        return response;
      }
      lastError = new Error(`unexpected_status_${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(delayMs);
  }
  throw lastError || new Error("fetch_retry_failed");
};

if (!ensureRendererExists()) {
  process.exit(0);
}

if (!String(process.env.DATABASE_URL || "").trim()) {
  log("DATABASE_URL not set; skipping build-time prerender seed.");
  process.exit(0);
}

const listenPort = pickPort();
const baseUrl = `http://127.0.0.1:${listenPort}`;
const child = spawn(process.execPath, ["server/index.js"], {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(listenPort),
    PUBLIC_PRERENDER_ENABLED: "false",
  },
  stdio: "inherit",
});

const stopChild = async () => {
  if (child.exitCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  await wait(500);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
};

try {
  const sitemapResponse = await fetchWithRetry({
    url: `${baseUrl}/sitemap.xml`,
  });
  const sitemapXml = await sitemapResponse.text();
  const pathnames = extractPublicPrerenderPathnamesFromSitemap({
    primaryAppOrigin: process.env.APP_ORIGIN || baseUrl,
    xml: sitemapXml,
  });
  if (pathnames.length === 0) {
    log("No supported prerender routes found in sitemap; nothing to seed.");
    process.exit(0);
  }

  const routes = [];
  for (const pathname of pathnames) {
    routes.push(
      await generatePublicPrerenderArtifact({
        baseUrl,
        outputDir,
        pathname,
        rendererModulePath,
      }),
    );
  }
  writePublicPrerenderManifest({ outputDir, routes });

  log(`seeded ${pathnames.length} route(s) into ${outputDir}`);
} finally {
  await stopChild();
}
