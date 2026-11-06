import { runBriefmintSmoke } from "./lib/briefmint-smoke";

// Environment is supplied privately by the operator; this script reads no files.
process.exitCode = await runBriefmintSmoke(process.argv.slice(2), process.env, {
  log: line => console.log(line), error: line => console.error(line),
});
