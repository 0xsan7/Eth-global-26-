import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "@sudo-city/protocol": resolve(import.meta.dirname, "./src/vendor/protocol/index.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:4100",
      "/auth": "http://127.0.0.1:4100",
      "/health": "http://127.0.0.1:4100",
    },
  },
});
