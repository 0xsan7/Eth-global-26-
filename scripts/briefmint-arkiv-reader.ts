import { runArkivReader } from "./lib/briefmint-arkiv-reader";

// Read-only. Explicit env-file loading is optional and controlled by the operator.
process.exitCode = await runArkivReader(process.argv.slice(2), process.env, {
  log: line => console.log(line), error: line => console.error(line),
});
