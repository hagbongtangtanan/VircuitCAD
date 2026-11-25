"use strict";

/**
 * Removes the block editor modes from the code window.
 *
 * The code panel offered "Blocks", "Text" and "Blocks + Text", but only the
 * text editor exists; the other two modes just showed a placeholder. The
 * panel now offers the text sketch only.
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
  arg("source", "out/patched/code-modes/out/renderer/assets/index-N0START1.js"),
);
const outputPath = resolveInput(
  arg("output", "out/patched/code-modes/out/renderer/assets/index-N0START1.js"),
);

const MARKER = "const CODE_MODES_PATCH_V1 = true;";

const ANCHOR_MARKER = `//#region src/renderer/ui/PartsPanel.tsx`;

const ANCHOR_MODES = `var MODES = [
  {
    id: "blocks",
    label: "Blocks",
  },
  {
    id: "text",
    label: "Text",
  },
  {
    id: "both",
    label: "Blocks + Text",
  },
];`;

const REPLACEMENT_MODES = `var MODES = [
  {
    id: "text",
    label: "Text",
  },
];`;

const ANCHOR_COMMENT = `/**
 * Collapsible code workspace. Only the text modes are wired up today; the
 * block editor lands in Milestone 6, so those modes explain themselves.
 */`;

const REPLACEMENT_COMMENT = `/**
 * Collapsible code workspace. The panel shows the Arduino C++ sketch and the
 * build output.
 */`;

const ANCHOR_BODY = `        children:
          mode === "blocks"
            ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                className: "cb-placeholder",
                "data-testid": "blocks-placeholder",
                children:
                  "The drag-and-drop block editor arrives in Milestone 6. Switch to Text to write Arduino C++ today.",
              })
            : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
                children: [
                  mode === "both" &&
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                      className: "cb-inline-note",
                      "data-testid": "blocks-placeholder",
                      children: "Blocks arrive in Milestone 6 — showing the text sketch.",
                    }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SketchEditor, {}),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BuildOutput, {}),
                ],
              }),`;

const REPLACEMENT_BODY = `        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          import_jsx_runtime.Fragment,
          {
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SketchEditor, {}),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BuildOutput, {}),
            ],
          },
        ),`;

const EDITS = [
  ["modes", ANCHOR_MODES, REPLACEMENT_MODES],
  ["panel comment", ANCHOR_COMMENT, REPLACEMENT_COMMENT],
  ["panel body", ANCHOR_BODY, REPLACEMENT_BODY],
];

function main() {
  const source = fs.readFileSync(sourcePath, "utf8");

  const markerCount = count(source, MARKER);
  if (markerCount > 1) throw new Error("code modes marker count mismatch");
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
  if (count(patched, 'id: "blocks"') !== 0) throw new Error("the blocks mode is still offered");
  if (count(patched, 'id: "both"') !== 0) throw new Error("the blocks + text mode is still offered");
  if (count(patched, 'id: "text"') !== 1) throw new Error("the text mode count mismatch");
  if (count(patched, "blocks-placeholder") !== 0) {
    throw new Error("the block editor placeholder is still in the bundle");
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
