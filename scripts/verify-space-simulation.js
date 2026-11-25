"use strict";

/**
 * Verifies that the spacebar shortcut for the simulation is installed.
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
  arg("patched", "out/patched/space-simulation/out/renderer/assets/index-BU2QbNS1.js"),
);
const reportPath = resolveInput(arg("report", "reports/space-simulation-verify.json"));

const MARKER = "const SPACE_SIMULATION_PATCH_V1 = true;";

function main() {
  const patched = fs.readFileSync(patchedPath, "utf8");

  const checks = {
    marker_present: count(patched, MARKER) === 1,
    space_keydown_handled: count(patched, 'if (event.code === "Space") {') === 1,
    space_keyup_handled: count(patched, 'if (event.code !== "Space") return;') === 1,
    repeat_guard: count(patched, "if (event.repeat === true) return;") === 1,
    pan_guard: count(patched, "spacePress.interacted = true;") === 2,
    text_entry_guard: count(patched, "if (isTextEntry(event.target)) return;") >= 1,
    simulation_toggled: count(patched, "void toggleSimulationShortcut();") === 1,
    toggle_bound: count(patched, "const toggleSimulationShortcut = useSimStore((state) => state.toggle);") === 1,
    code_panel_opens: count(patched, "setCodeOpen(true);") >= 1,
    keyup_listener: count(patched, 'window.addEventListener("keyup", onKeyUp);') >= 1,
    pointer_listeners:
      count(patched, 'window.addEventListener("pointermove", onPointerMove);') === 1 &&
      count(patched, 'window.addEventListener("pointerdown", onPointerDown);') === 1,
    shortcut_guide_entry: count(patched, 'label: "Run or stop the simulation"') === 1,
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
