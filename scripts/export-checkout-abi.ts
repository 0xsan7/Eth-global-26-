import { readFile, writeFile, mkdir } from "node:fs/promises";

const artifact = JSON.parse(await readFile(new URL("../artifacts/contracts/ToolCityCheckout.sol/ToolCityCheckout.json", import.meta.url), "utf8")) as { abi: unknown[] };
if (!Array.isArray(artifact.abi) || !artifact.abi.length) throw new Error("Compiled checkout ABI is missing.");
await mkdir(new URL("../src/lib/shared/", import.meta.url), { recursive: true });
await writeFile(new URL("../src/lib/shared/checkout-abi.ts", import.meta.url), `// Generated from the compiled ToolCityCheckout artifact. Do not edit manually.\nexport const checkoutAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`);
console.log("Exported compiled checkout ABI.");
