const { spawnSync } = require("node:child_process");

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  npx,
  ["--yes", "@electron/asar", "pack", "./recovered-src", "./app-modified.asar"],
  {
    cwd: __dirname,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
