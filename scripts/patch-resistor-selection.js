"use strict";

/**
 * Shows the resistor selection outline in light mode.
 *
 * The resistor graphic only drew its selection ring when the outline colour
 * was the dark-mode yellow, so in light mode (where the outline uses the
 * amber theme colour) the resistor lost its selection ring completely.
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

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

const sourcePath = resolveInput(
  arg("source", "out/patched/resistor-selection/out/renderer/assets/index-N0START1.js"),
);
const outputPath = resolveInput(
  arg("output", "out/patched/resistor-selection/out/renderer/assets/index-N0START1.js"),
);

const MARKER = "const RESISTOR_SELECTION_PATCH_V1 = true;";

const ANCHOR_MARKER = `//#region src/renderer/ui/PartsPanel.tsx`;

const ANCHOR_METRICS = `    selected: outline === PART_SELECTED_STROKE,`;

const REPLACEMENT_METRICS = `    selected: outline === themedSelectedStroke(),`;

const ANCHOR_OUTLINE = `      outline === PART_SELECTED_STROKE &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rect, {`;

const REPLACEMENT_OUTLINE = `      outline === themedSelectedStroke() &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rect, {`;

const EDITS = [
  ["selection metrics", ANCHOR_METRICS, REPLACEMENT_METRICS],
  ["selection outline", ANCHOR_OUTLINE, REPLACEMENT_OUTLINE],
];

function main() {
  const source = fs.readFileSync(sourcePath, "utf8");

  const markerCount = count(source, MARKER);
  if (markerCount > 1) throw new Error("resistor selection marker count mismatch");
  const mode = markerCount === 1 ? "upgrade" : "fresh";

  let patched = source;

  if (mode === "fresh") {
    if (count(patched, ANCHOR_MARKER) !== 1) throw new Error("anchor mismatch: marker");
    patched = patched.replace(ANCHOR_MARKER, `${ANCHOR_MARKER}\n${MARKER}`);
    for (const [name, anchor, replacement] of EDITS) {
      if (count(patched, anchor) !== 1) throw new Error(`anchor mismatch: ${name}`);
      patched = patched.replace(anchor, replacement);
    }
  } else {
    for (const [name, , replacement] of EDITS) {
      if (count(patched, replacement) !== 1) throw new Error(`replacement mismatch: ${name}`);
    }
  }

  if (count(patched, MARKER) !== 1) throw new Error("patched marker count mismatch");
  if (count(patched, "outline === PART_SELECTED_STROKE") !== 0) {
    throw new Error("the old selection comparison is still present");
  }
  if (count(patched, "outline === themedSelectedStroke()") !== 2) {
    throw new Error("selection comparison count mismatch");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, patched);

  const sourceBuffer = fs.readFileSync(sourcePath);
  const patchedBuffer = fs.readFileSync(outputPath);
  console.log(`source=${path.relative(root, sourcePath).split(path.sep).join("/")}`);
  console.log(`output=${path.relative(root, outputPath).split(path.sep).join("/")}`);
  console.log(`mode=${mode}`);
  console.log(`source_bytes=${sourceBuffer.length}`);
  console.log(`output_bytes=${patchedBuffer.length}`);
  console.log(`source_sha256=${sha256(sourceBuffer)}`);
  console.log(`output_sha256=${sha256(patchedBuffer)}`);
  console.log(`marker_count=1`);
  console.log("PATCH: PASS");
}

main();
