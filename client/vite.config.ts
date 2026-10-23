import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@shared": fileURLToPath(new URL("../shared/src", import.meta.url)) }, dedupe: ["react", "react-dom", "three"] },
  build: { chunkSizeWarningLimit: 2000 },
  // When this copy of the site was built, shown as "Last updated" in the footer.
  define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  server: { port: 5173, strictPort: true, proxy: { "/api": { target: process.env.HB_API_PROXY || "http://localhost:4000", changeOrigin: true } } },
});
