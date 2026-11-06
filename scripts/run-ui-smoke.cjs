/* eslint-disable @typescript-eslint/no-require-imports */
// Agent B: compile tests/ui + its relative imports to temp CJS and run node --test.
// No new deps. Handles the @/* alias via a temp tsconfig.
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "toolcity-smoke-"));
const out = path.join(tmp, "build");
const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
const tsconfigPath = path.join(tmp, "tsconfig.smoke.json");

const tsconfig = {
  compilerOptions: {
    target: "es2022",
    module: "commonjs",
    moduleResolution: "node",
    esModuleInterop: true,
    skipLibCheck: true,
    strict: true,
    outDir: out,
    rootDir: root,
    baseUrl: root,
    types: ["node"],
    typeRoots: [path.join(root, "node_modules", "@types")],
    paths: { "@/*": ["src/*"] },
  },
  include: [
    path.join(root, "tests/ui/smoke.test.ts"),
    path.join(root, "src/lib/shared/validation.ts"),
    path.join(root, "src/lib/shared/fixtures.ts"),
    path.join(root, "src/lib/shared/domain.ts"),
    path.join(root, "src/components/city/job-state-to-scene.ts"),
    path.join(root, "src/components/city/scene-config.ts"),
  ],
};
fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig));

execSync(`node "${tsc}" -p "${tsconfigPath}"`, { cwd: root, stdio: "inherit" });
execSync(`node --test "${path.join(out, "tests", "ui", "smoke.test.js")}"`, {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NODE_PATH: path.join(root, "node_modules") },
});
