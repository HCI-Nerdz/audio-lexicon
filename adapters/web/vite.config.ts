import { defineConfig } from "vite";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../..");

export default defineConfig({
  base: "/audio-lexicon/",
  root: ".",
  publicDir: "public",
  resolve: {
    alias: {
      "@hci-nerdz/core-ts": resolve(repoRoot, "packages/core-ts/src/index.ts"),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        app: resolve(__dirname, "app.html"),
      },
    },
  },
});
