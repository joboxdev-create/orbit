import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Workspace packages (@orbit/shared, …) build to CommonJS; let the commonjs
  // plugin transform them so Rollup sees their named exports during build.
  optimizeDeps: { include: ["@orbit/shared"] },
  // Fixed dev port so the sidecar's CORS / future Tauri config are predictable.
  server: { port: 1420, strictPort: true },
  build: {
    outDir: "dist",
    commonjsOptions: { include: [/packages\//, /node_modules/] },
  },
});
