"use strict";

/**
 * Verifies that the code window only offers the text sketch.
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

const patchedPath = resolveInput(
  arg("patched", "out/patched/code-modes/out/renderer/assets/index-N0START1.js"),
);
const reportPath = resolveInput(arg("report", "reports/code-modes-verify.json"));

const MARKER = "const CODE_MODES_PATCH_V1 = true;";

function main() {
  const patched = fs.readFileSync(patchedPath, "utf8");

  const checks = {
    marker_present: count(patched, MARKER) === 1,
    text_mode_kept: count(patched, 'id: "text"') === 1,
    blocks_mode_removed: count(patched, 'id: "blocks"') === 0,
    blocks_and_text_mode_removed: count(patched, 'id: "both"') === 0,
    block_placeholder_removed: count(patched, "blocks-placeholder") === 0,
    editor_still_rendered: count(patched, "jsx)(SketchEditor, {})") === 1,
    build_output_still_rendered: count(patched, "jsx)(BuildOutput, {})") === 1,
    mode_switcher_kept: count(patched, '`code-mode-${entry.id}`') === 1,
  };

  const pass = Object.values(checks).every((value) => value === true);
  const report = {
    patched: path.relative(root, patchedPath).split(path.sep).join("/"),
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
