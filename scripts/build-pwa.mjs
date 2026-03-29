import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateSW } from "workbox-build";

import {
  PWA_NAVIGATE_FALLBACK_ALLOWLIST,
  PWA_NAVIGATE_FALLBACK_DENYLIST,
} from "../shared/pwa-navigation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const distDir = path.join(workspaceRoot, "dist");
const distIndexPath = path.join(distDir, "index.html");

if (!fs.existsSync(distIndexPath)) {
  throw new Error(`Production build missing at ${distIndexPath}. Run "vite build" first.`);
}

const seenUrls = new Set();
const manifestTransforms = [
  async (entries) => ({
    manifest: entries.filter((entry) => {
      if (seenUrls.has(entry.url)) {
        return false;
      }
      seenUrls.add(entry.url);
      return true;
    }),
    warnings: [],
  }),
];

const { count, size, warnings } = await generateSW({
  swDest: path.join(distDir, "sw.js"),
  globDirectory: distDir,
  globPatterns: [
    "assets/**/*.{js,css,woff2,png,jpg,jpeg,gif,svg,webp,avif}",
    "pwa/**/*",
    "favicon.ico",
    "placeholder.svg",
  ],
  dontCacheBustURLsMatching: /-[A-Za-z0-9_-]{6,}\./,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  inlineWorkboxRuntime: true,
  navigateFallback: "/index.html",
  navigateFallbackAllowlist: PWA_NAVIGATE_FALLBACK_ALLOWLIST,
  navigateFallbackDenylist: PWA_NAVIGATE_FALLBACK_DENYLIST,
  manifestTransforms,
  runtimeCaching: [
    {
      urlPattern: ({ request, url }) =>
        request.mode === "navigate" &&
        !url.pathname.startsWith("/dashboard") &&
        !url.pathname.startsWith("/auth") &&
        !url.pathname.startsWith("/api"),
      handler: "NetworkOnly",
    },
    {
      urlPattern: ({ request, url }) =>
        request.destination === "image" &&
        (url.pathname.startsWith("/uploads/") ||
          url.pathname.startsWith("/assets/") ||
          url.pathname.startsWith("/pwa/") ||
          url.pathname === "/placeholder.svg"),
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "public-images-v1",
        expiration: {
          maxEntries: 300,
          maxAgeSeconds: 14 * 24 * 60 * 60,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
});

for (const warning of warnings) {
  console.warn(`[build-pwa] ${warning}`);
}

console.log(`[build-pwa] generated sw.js with ${count} precached entries (${size} bytes).`);
