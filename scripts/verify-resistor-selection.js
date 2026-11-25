"use strict";

/**
 * Verifies that the resistor keeps its selection outline in light mode.
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
  arg("patched", "out/patched/resistor-selection/out/renderer/assets/index-N0START1.js"),
);
const reportPath = resolveInput(arg("report", "reports/resistor-selection-verify.json"));

const MARKER = "const RESISTOR_SELECTION_PATCH_V1 = true;";

function main() {
  const patched = fs.readFileSync(patchedPath, "utf8");

  const checks = {
    marker_present: count(patched, MARKER) === 1,
    themed_comparison_used: count(patched, "outline === themedSelectedStroke()") === 2,
    colour_comparison_removed: count(patched, "outline === PART_SELECTED_STROKE") === 0,
    selected_stroke_kept: count(patched, 'var PART_SELECTED_STROKE = "#ffc928";') === 1,
    theme_stroke_kept: count(patched, "function themedSelectedStroke() {") === 1,
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
