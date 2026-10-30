import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths so the built game works from any folder or host.
  base: "./",
  build: {
    target: "es2020",
    // Phaser is one large library; keep it in its own file so game code stays small.
    rollupOptions: { output: { manualChunks: { phaser: ["phaser"] } } },
    chunkSizeWarningLimit: 1600,
  },
});
