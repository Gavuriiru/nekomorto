import path from "node:path";
import { build } from "vite";

const workspaceRoot = process.cwd();

await build({
  build: {
    emptyOutDir: true,
    outDir: path.join(workspaceRoot, "dist-ssr", "public"),
    rollupOptions: {
      output: {
        entryFileNames: "renderer.mjs",
        format: "es",
      },
    },
    ssr: path.join(workspaceRoot, "src", "ssr", "public-app.tsx"),
  },
  configFile: path.join(workspaceRoot, "vite.config.ts"),
});

console.log("[build-public-ssr] wrote dist-ssr/public/renderer.mjs");
