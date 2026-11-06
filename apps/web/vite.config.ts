import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "@briefmint/shared": resolve(import.meta.dirname, "../../src/lib/shared/briefs.ts"),
      "@briefmint/arkiv": resolve(import.meta.dirname, "../../src/lib/arkiv/briefmint"),
      "@sudo-city/protocol": resolve(import.meta.dirname, "./src/vendor/protocol/index.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    fs: { allow: [resolve(import.meta.dirname, "../..")] },
    proxy: { "/api": { target: "http://127.0.0.1:4100", changeOrigin: false } },
  },
});
