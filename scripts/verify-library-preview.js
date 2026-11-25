"use strict";

/**
 * Verifies that the parts library renders the canvas drawing and drags the
 * component instead of the library card.
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
  arg("patched", "out/patched/library-preview/out/renderer/assets/index-BU2QbNS1.js"),
);
const reportPath = resolveInput(arg("report", "reports/library-preview-verify.json"));

const MARKER = "const LIBRARY_PREVIEW_PATCH_V1 = true;";

const OLD_PREVIEW = `function PartPreview({ type }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
    className: "cb-part-thumb",
    "aria-hidden": "true",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
      className: "cb-part-art",
      viewBox: "0 0 96 56",
      focusable: "false",
      children: partArt(type),
    }),
  });
}`;

const OLD_DRAG_START = `  const handleDragStart = (event, definition) => {
    event.dataTransfer.setData(PART_DRAG_MIME, definition.type);
    event.dataTransfer.effectAllowed = "copy";
  };`;

function main() {
  const patched = fs.readFileSync(patchedPath, "utf8");

  const checks = {
    marker_present: count(patched, MARKER) === 1,
    preview_component_present: count(patched, "function LibraryCanvasPreview({ type }) {") === 1,
    preview_component_used: count(patched, "jsx)(LibraryCanvasPreview, {") === 1,
    part_body_rendered: count(patched, "jsx)(PartBody, {") >= 1,
    stage_used: count(patched, "jsx)(Stage, {") >= 1,
    layer_used: count(patched, "jsx)(Layer, {") >= 1,
    canvas_capture: count(patched, "stage.toCanvas({ pixelRatio: 2 })") >= 1,
    png_export: count(patched, 'canvas.toDataURL("image/png")') >= 1,
    drag_image_used: count(patched, "event.dataTransfer.setDragImage(") === 1,
    drag_image_targets_artwork: count(patched, 'card.querySelector("img.cb-part-art")') === 1,
    old_preview_removed: count(patched, OLD_PREVIEW) === 0,
    old_drag_start_removed: count(patched, OLD_DRAG_START) === 0,
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
