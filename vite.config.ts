import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Power Apps Code Apps exigem o dev server na porta 3000
// (deve bater com localAppUrl do power.config.json).
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 3003,
    strictPort: true,
  },
});
