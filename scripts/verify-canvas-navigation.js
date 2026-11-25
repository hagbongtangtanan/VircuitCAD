"use strict";

/**
 * Verifies the canvas navigation improvements.
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
  arg("patched", "out/patched/canvas-navigation/out/renderer/assets/index-N0START1.js"),
);
const reportPath = resolveInput(arg("report", "reports/canvas-navigation-verify.json"));

const MARKER = "const CANVAS_NAVIGATION_PATCH_V1 = true;";

function main() {
  const patched = fs.readFileSync(patchedPath, "utf8");
  const panelStart = patched.indexOf("function PartsPanel() {");
  const panelEnd = patched.indexOf("function PartCard(");
  const panelText =
    panelStart === -1 || panelEnd === -1 ? "" : patched.slice(panelStart, panelEnd);

  const checks = {
    marker_present: count(patched, MARKER) === 1,
    library_does_not_follow_viewport:
      panelText.includes("useViewportStore((state) => state.viewport)") === false,
    library_reads_viewport_on_demand:
      count(patched, "const { viewport, size } = useViewportStore.getState();") === 1,
    parts_layer_stops_hit_testing:
      count(patched, "listening: !isPanning,") === 1,
    pan_throttled_to_frame: count(patched, "pendingPanFrame = requestAnimationFrame(") === 1,
    pan_state_present: count(patched, "var pendingPan = { x: 0, y: 0 };") === 1,
    canvas_still_follows_viewport:
      count(patched, "const panBy = useViewportStore((state) => state.panBy);") === 1,
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
