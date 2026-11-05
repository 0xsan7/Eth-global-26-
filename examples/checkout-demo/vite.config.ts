import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "/checkout-demo/",
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  server: { proxy: { "/api": "http://localhost:3000" } },
  build: { outDir: "../../public/checkout-demo", emptyOutDir: true },
});
