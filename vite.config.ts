import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { resolveViteAllowedHostsFromOrigins } from "./server/lib/frontend-runtime.js";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
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
    plugins: [tailwindcss(), react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
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
