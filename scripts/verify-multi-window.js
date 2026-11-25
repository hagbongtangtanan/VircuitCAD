"use strict";

/**
 * Verifies that files opened by the operating system get their own window.
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

const patchedPath = resolveInput(arg("main", "out/patched/multi-window/out/main/index.js"));
const reportPath = resolveInput(arg("report", "reports/multi-window-verify.json"));

const MARKER = "const MULTI_WINDOW_PATCH_V1 = true;";

function main() {
  const mainText = fs.readFileSync(patchedPath, "utf8");

  const checks = {
    marker_present: count(mainText, MARKER) === 1,
    marker_placed: count(mainText, `${MARKER}\nvar partPropsSchemas = {`) === 1,
    launch_queue_is_a_list: count(mainText, "var pendingLaunchPaths = [];") === 1,
    per_window_launch_paths: count(mainText, "var windowLaunchPaths = new WeakMap();") === 1,
    window_launch_path_queued: count(mainText, "queueWindowLaunchPath(window, launchPath);") === 1,
    take_launch_file_reads_sender: count(mainText, "windowLaunchPaths.get(event.sender)") === 1,
    create_window_takes_a_path: count(mainText, "function createWindow(launchPath = null)") === 1,
    opened_file_creates_window: count(mainText, "const opened = createWindow(path);") === 1,
    closed_window_keeps_a_focus:
      count(mainText, "const remaining = electron.BrowserWindow.getAllWindows();") === 1,
    single_instance_lock_kept: count(mainText, "requestSingleInstanceLock()") === 1,
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
