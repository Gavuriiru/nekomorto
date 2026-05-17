import path from "node:path";
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  output: "server",
  adapter: node({
    mode: "middleware",
  }),
  srcDir: "./src-astro",
  publicDir: "./public",
  outDir: "./dist-astro",
  vite: {
    resolve: {
      alias: {
        "@": path.resolve("./src"),
      },
    },
  },
});
