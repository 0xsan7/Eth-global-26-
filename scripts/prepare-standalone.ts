import { cp } from "node:fs/promises";

// Next standalone output does not copy public/static assets automatically.
await cp(new URL("../public", import.meta.url), new URL("../.next/standalone/public", import.meta.url), { recursive: true });
await cp(new URL("../.next/static", import.meta.url), new URL("../.next/standalone/.next/static", import.meta.url), { recursive: true });
await cp(new URL("../src/lib/server/migrations", import.meta.url), new URL("../.next/standalone/src/lib/server/migrations", import.meta.url), { recursive: true });
console.log("Prepared standalone public/static assets, including checkout example.");
