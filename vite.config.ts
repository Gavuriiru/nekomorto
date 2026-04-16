import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
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
    hmr: true,
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
      // Large lazy editor/tooling bundles are validated by custom build guards,
      // so we raise Vite's generic warning threshold to reduce false-positive noise.
      chunkSizeWarningLimit: 1200,
      sourcemap: env.VITE_BUILD_SOURCEMAP === "true",
      rollupOptions: {
        output: {
          manualChunks: classifyManualChunk,
        },
      },
    },
  };
});
