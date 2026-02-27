import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { resolveViteAllowedHostsFromOrigins } from "./server/lib/frontend-runtime.js";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isTestMode = mode === "test" || process.env.VITEST === "true";
  const isPwaDevEnabled = env.VITE_PWA_DEV_ENABLED === "true";
  const pwaRegisterTestAlias = path.resolve(__dirname, "./src/lib/pwa-register-virtual.ts");
  const pwaVirtualModuleTestResolver = {
    name: "pwa-virtual-module-test-resolver",
    enforce: "pre" as const,
    resolveId(source: string) {
      if (isTestMode && source === "virtual:pwa-register") {
        return pwaRegisterTestAlias;
      }
      return null;
    },
  };
  const allowedHosts = resolveViteAllowedHostsFromOrigins(env.APP_ORIGIN);
  const serverConfig = {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
    ...(allowedHosts.length ? { allowedHosts } : {}),
  };
  return {
    server: serverConfig,
    plugins: [
      pwaVirtualModuleTestResolver,
      tailwindcss(),
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        devOptions: {
          enabled: isPwaDevEnabled,
          type: "module",
          suppressWarnings: true,
        },
        includeAssets: ["favicon.ico", "placeholder.svg"],
        manifest: {
          id: "/",
          name: "Nekomata Fansub",
          short_name: "Nekomata",
          description: "Fansub dedicada a trazer historias inesqueciveis com o carinho que a comunidade merece.",
          categories: ["entertainment", "books"],
          theme_color: "#101114",
          background_color: "#101114",
          display: "standalone",
          start_url: "/",
          scope: "/",
          lang: "pt-BR",
          screenshots: [
            {
              src: "/pwa/screenshots/home-mobile-1080x1920.png",
              sizes: "1080x1920",
              type: "image/png",
              form_factor: "narrow",
              label: "Pagina inicial mobile",
            },
            {
              src: "/pwa/screenshots/project-mobile-1080x1920.png",
              sizes: "1080x1920",
              type: "image/png",
              form_factor: "narrow",
              label: "Pagina de projeto mobile",
            },
            {
              src: "/pwa/screenshots/home-desktop-1920x1080.png",
              sizes: "1920x1080",
              type: "image/png",
              form_factor: "wide",
              label: "Pagina inicial desktop",
            },
          ],
          icons: [
            {
              src: "/pwa/icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/pwa/icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/pwa/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: false,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" &&
                !url.pathname.startsWith("/dashboard") &&
                !url.pathname.startsWith("/auth") &&
                !url.pathname.startsWith("/api"),
              handler: "NetworkFirst",
              options: {
                cacheName: "public-pages-v1",
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 7 * 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ request, url }) =>
                ["script", "style", "worker", "font"].includes(request.destination) &&
                (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/pwa/") || url.pathname === "/favicon.ico"),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "public-assets-v1",
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
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
            {
              urlPattern: ({ url, request }) => request.method === "GET" && url.pathname.startsWith("/api/public/"),
              handler: "NetworkFirst",
              options: {
                cacheName: "public-api-v1",
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 3 * 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        ...(isTestMode
          ? {
              "virtual:pwa-register": pwaRegisterTestAlias,
            }
          : {}),
      },
    },
    test: {
      alias: isTestMode
        ? {
            "virtual:pwa-register": pwaRegisterTestAlias,
          }
        : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }
            if (
              id.includes("/node_modules/react/") ||
              id.includes("/node_modules/react-dom/") ||
              id.includes("/node_modules/react-router-dom/")
            ) {
              return "react-core";
            }
            if (id.includes("/@lexical/") || id.includes("/lexical/") || id.includes("/yjs/")) {
              return "lexical";
            }
            if (id.includes("/@mui/material/") || id.includes("/@mui/x-date-pickers/")) {
              return "mui";
            }
            if (id.includes("/recharts/")) {
              return "charts";
            }
            return undefined;
          },
        },
      },
    },
  };
});
