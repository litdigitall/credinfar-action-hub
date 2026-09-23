import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Power Apps Code Apps exigem o dev server na porta 3000
// (deve bater com localAppUrl do power.config.json).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // Imagens pequenas (logo Abbott) entram no bundle como data URI: dentro do
    // player do Power Apps, um arquivo .png separado não é servido para o <img>.
    assetsInlineLimit: 16384,
  },
  server: {
    port: 3003,
    strictPort: true,
  },
});
