import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { resolveViteAllowedHostsFromOrigins } from "./server/lib/frontend-runtime.js";
import { classifyManualChunk } from "./src/lib/build-chunking";

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
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      sourcemap: env.VITE_BUILD_SOURCEMAP === "true",
      rollupOptions: {
        output: {
          manualChunks: classifyManualChunk,
        },
      },
    },
  };
});
