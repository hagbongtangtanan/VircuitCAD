"use strict";

/**
 * Verifies that the toolchain no longer opens console windows.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value: --${name}`);
  return value;
}

function resolveInput(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

const patchedPath = resolveInput(arg("main", "out/patched/toolchain-console/out/main/index.js"));
const reportPath = resolveInput(arg("report", "reports/toolchain-console-verify.json"));

const MARKER = "const TOOLCHAIN_CONSOLE_PATCH_V1 = true;";

function main() {
  const mainText = fs.readFileSync(patchedPath, "utf8");

  const checks = {
    marker_present: count(mainText, MARKER) === 1,
    marker_placed: count(mainText, `${MARKER}\nvar partPropsSchemas = {`) === 1,
    single_spawn_call: count(mainText, "node_child_process.spawn") === 1,
    windows_hide_enabled: count(mainText, "windowsHide: true,") === 1,
    spawn_still_captures_output: count(mainText, 'stdio: ["ignore", stdoutFd, stderrFd],') === 1,
  };

  const pass = Object.values(checks).every((value) => value === true);
  const report = {
    main: path.relative(root, patchedPath).split(path.sep).join("/"),
    bytes: fs.statSync(patchedPath).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(patchedPath)).digest("hex"),
    checks,
    pass,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const [name, value] of Object.entries(checks)) {
    console.log(`${name}=${Number(value)}`);
  }
  console.log(`report=${path.relative(root, reportPath).split(path.sep).join("/")}`);
  console.log(pass ? "VERIFY: PASS" : "VERIFY: FAIL");
  if (!pass) process.exitCode = 1;
}

main();
